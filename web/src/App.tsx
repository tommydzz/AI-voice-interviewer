import { useCallback, useMemo, useState } from "react";
import "./App.css";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useTextToSpeech } from "./hooks/useTextToSpeech";
import {
  DEFAULT_QUESTIONS,
  STYLE_PRESETS,
  type InterviewState,
  type InterviewStyle,
} from "./types";
import { getFollowupQuestion } from "./llm";
import { DEFAULT_DEEPSEEK_API_KEY } from "./config";

function App() {
  const [state, setState] = useState<InterviewState>({
    phase: "welcome",
    currentIndex: 0,
    items: DEFAULT_QUESTIONS.map((q) => ({
      question: q,
      answer: "",
      followups: [],
    })),
  });
  const [subIdx, setSubIdx] = useState<number>(-1); // -1 主问题；0/1 追问编号

  const {
    isSupported: sttSupported,
    transcript,
    partial,
    status: sttStatus,
    error: sttError,
    start,
    stop,
    reset,
  } = useSpeechRecognition({
    lang: "zh-CN",
    interimResults: true,
    continuous: true,
    maxSilenceMs: 2000,
  });

  const [style, setStyle] = useState<InterviewStyle>("friendly");
  const presetTts = STYLE_PRESETS[style]?.tts ?? { rate: 1.0, pitch: 1.0 };

  const {
    isSupported: ttsSupported,
    status: ttsStatus,
    speak,
    cancel,
  } = useTextToSpeech({
    lang: "zh-CN",
    rate: presetTts.rate,
    pitch: presetTts.pitch,
    voiceName: presetTts.voiceName,
  });
  const [apiKey] = useState<string>(() => {
    const persisted =
      typeof window !== "undefined"
        ? localStorage.getItem("DEEPSEEK_API_KEY") || ""
        : "";
    return DEFAULT_DEEPSEEK_API_KEY || persisted;
  });
  const [textAnswer, setTextAnswer] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [textMode, setTextMode] = useState<boolean>(false);

  const currentQuestion = useMemo(
    () => state.items[state.currentIndex]?.question ?? "",
    [state]
  );
  const currentItem = useMemo(() => state.items[state.currentIndex], [state]);
  const isLastQuestion = useMemo(
    () => state.currentIndex >= state.items.length - 1,
    [state]
  );

  const beginInterview = useCallback(() => {
    setState((s) => ({ ...s, phase: "interview", currentIndex: 0 }));
    if (ttsSupported) {
      const preset = STYLE_PRESETS[style];
      speak(
        "你好，我是Kora的语音面试官，接下来我会用中文向你提问一些常见面试问题，请用语音作答。"
      );
      setTimeout(
        () => speak(`${preset.questionPreamble}${DEFAULT_QUESTIONS[0]}`),
        800
      );
    }
  }, [speak, style, ttsSupported]);

  const startAnswer = useCallback(() => {
    reset();
    start();
  }, [reset, start]);

  const finishAnswer = useCallback(async () => {
    stop();
    const answerText = transcript.trim() || partial.trim();
    // 写入答案：主问题或追问（via: voice）
    setState((s) => {
      const items = [...s.items];
      const cur = { ...items[s.currentIndex] };
      if (subIdx < 0) {
        cur.answer = answerText;
        cur.answerVia = "voice";
      } else {
        const fus = [...(cur.followups || [])];
        if (!fus[subIdx]) fus[subIdx] = { question: "", answer: "" } as any;
        fus[subIdx] = {
          ...fus[subIdx],
          answer: answerText,
          via: "voice",
        } as any;
        cur.followups = fus;
      }
      items[s.currentIndex] = cur;
      return { ...s, items };
    });

    if (apiKey) localStorage.setItem("DEEPSEEK_API_KEY", apiKey);

    if (subIdx < 0) {
      setIsGenerating(true);
      const mainQ = state.items[state.currentIndex].question;
      const fu = await getFollowupQuestion(
        {
          mainQuestion: mainQ,
          previousAnswers: [answerText],
          followupIndex: 0,
        },
        { apiKey, style }
      );
      setState((s) => {
        const items = [...s.items];
        const cur = { ...items[s.currentIndex] };
        const fus = [...(cur.followups || [])];
        fus[0] = { question: fu.question, answer: "" } as any;
        cur.followups = fus;
        items[s.currentIndex] = cur;
        return { ...s, items };
      });
      setIsGenerating(false);
      setSubIdx(0);
      if (ttsSupported) {
        const preset = STYLE_PRESETS[style];
        speak(`${preset.questionPreamble}${fu.question}`);
      }
      return;
    }

    if (subIdx === 0) {
      setIsGenerating(true);
      const cur = state.items[state.currentIndex];
      const fu = await getFollowupQuestion(
        {
          mainQuestion: cur.question,
          previousAnswers: [cur.answer, answerText].filter(Boolean),
          followupIndex: 1,
        },
        { apiKey, style }
      );
      setState((s) => {
        const items = [...s.items];
        const cur2 = { ...items[s.currentIndex] };
        const fus = [...(cur2.followups || [])];
        fus[1] = { question: fu.question, answer: "" } as any;
        cur2.followups = fus;
        items[s.currentIndex] = cur2;
        return { ...s, items };
      });
      setIsGenerating(false);
      setSubIdx(1);
      if (ttsSupported) {
        const preset = STYLE_PRESETS[style];
        speak(`${preset.questionPreamble}${fu.question}`);
      }
      return;
    }

    setSubIdx(-1);
    setIsGenerating(false);
    if (isLastQuestion) {
      cancel();
      setState((s) => ({ ...s, phase: "summary" }));
    } else {
      setState((s) => ({ ...s, currentIndex: s.currentIndex + 1 }));
      if (ttsSupported) {
        const preset = STYLE_PRESETS[style];
        speak(
          `${preset.questionPreamble}${
            DEFAULT_QUESTIONS[state.currentIndex + 1]
          }`
        );
      }
    }
  }, [
    apiKey,
    cancel,
    isLastQuestion,
    partial,
    speak,
    state,
    stop,
    style,
    subIdx,
    ttsSupported,
    transcript,
  ]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <h1>中文语音面试官 Demo</h1>

      {!sttSupported && (
        <div style={{ color: "red" }}>
          当前浏览器不支持 Web Speech API 语音识别，请使用 Chrome 桌面版。
        </div>
      )}
      {!ttsSupported && (
        <div style={{ color: "orange" }}>
          当前浏览器不支持语音合成，系统将仅展示文字。
        </div>
      )}

      {state.phase === "welcome" && (
        <div>
          <p>
            你好，我是Kora的语音面试官，接下来我会用中文向你提问一些常见面试问题，请用语音作答。
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <label>风格：</label>
            <select
              aria-label="面试风格"
              value={style}
              onChange={(e) => setStyle(e.target.value as InterviewStyle)}
            >
              <option value="serious">严肃</option>
              <option value="friendly">亲切</option>
              <option value="campus">校园风</option>
            </select>
          </div>
          <button onClick={beginInterview}>开始面试</button>
        </div>
      )}

      {state.phase === "interview" && (
        <div>
          <h2>
            问题 {state.currentIndex + 1} / {state.items.length}
          </h2>
          <p style={{ fontWeight: 600 }}>{currentQuestion}</p>
          <div
            style={{
              marginTop: 8,
              padding: 8,
              background: "#fafafa",
              border: "1px dashed #ddd",
              borderRadius: 8,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>当前提问：</div>
            {subIdx < 0 ? (
              <div>主问题：{currentItem?.question}</div>
            ) : (
              <div>
                追问{subIdx + 1}：
                {currentItem?.followups?.[subIdx]?.question || "（生成中...）"}
              </div>
            )}

            {currentItem?.followups?.length ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: "#666", fontSize: 12 }}>已生成追问：</div>
                {currentItem.followups.map((f, i) => (
                  <div key={i} style={{ marginTop: 4 }}>
                    <span style={{ fontWeight: 600 }}>追问{i + 1}：</span>
                    <span>{f.question || "（生成中...）"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            {sttStatus !== "listening" ? (
              <button
                onClick={startAnswer}
                disabled={
                  !sttSupported || isGenerating || ttsStatus === "speaking"
                }
              >
                {isGenerating
                  ? "生成追问中…"
                  : ttsStatus === "speaking"
                  ? "正在朗读…"
                  : "开始录音"}
              </button>
            ) : (
              <button onClick={finishAnswer}>提交录音</button>
            )}
          </div>
          {ttsStatus === "speaking" && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: "#e6f4ff",
                border: "1px solid #91caff",
                borderRadius: 6,
                color: "#0958d9",
              }}
            >
              正在朗读问题，请稍候…
            </div>
          )}
          {isGenerating && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: "#fffbe6",
                border: "1px solid #ffe58f",
                borderRadius: 6,
                color: "#ad6800",
              }}
            >
              正在生成下一条问题，请稍候…
            </div>
          )}
          {sttStatus === "listening" && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: "#fff3f3",
                border: "1px solid #ffd6d6",
                borderRadius: 6,
                color: "#b00020",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "#b00020",
                  borderRadius: "50%",
                  marginRight: 8,
                }}
              />
              录音中，请开始讲话… 完成后点击“提交录音”
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                if (!textMode) {
                  const ok = window.confirm(
                    "您的文本回答会被特殊标记，建议先尝试语音回答。确定要启用文本作答吗？"
                  );
                  if (!ok) return;
                }
                setTextMode((v) => !v);
              }}
              style={{
                background: textMode ? "#faad14" : "#ff4d4f",
                color: "#fff",
                border: "none",
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer",
                marginBottom: 6,
              }}
            >
              {textMode ? "关闭文本作答" : "切换为文本作答"}
            </button>
          </div>

          <div style={{ marginTop: 8, opacity: textMode ? 1 : 0.5 }}>
            <label>文本作答：</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder={
                  textMode
                    ? "若语音失败，可在此输入作答"
                    : "请先点击上方红色按钮启用文本作答"
                }
                style={{ flex: 1 }}
                disabled={
                  !textMode ||
                  isGenerating ||
                  ttsStatus === "speaking" ||
                  sttStatus === "listening"
                }
              />
              <button
                onClick={async () => {
                  const typed = textAnswer.trim();
                  if (!typed || !textMode) return;
                  setTextAnswer("");
                  const answerText = typed;
                  setState((s) => {
                    const items = [...s.items];
                    const cur = { ...items[s.currentIndex] };
                    if (subIdx < 0) {
                      cur.answer = answerText;
                      cur.answerVia = "text";
                    } else {
                      const fus = [...(cur.followups || [])];
                      if (!fus[subIdx])
                        fus[subIdx] = { question: "", answer: "" } as any;
                      fus[subIdx] = {
                        ...fus[subIdx],
                        answer: answerText,
                        via: "text",
                      } as any;
                      cur.followups = fus;
                    }
                    items[s.currentIndex] = cur;
                    return { ...s, items };
                  });
                  if (apiKey) localStorage.setItem("DEEPSEEK_API_KEY", apiKey);
                  if (subIdx < 0) {
                    setIsGenerating(true);
                    const mainQ = state.items[state.currentIndex].question;
                    const fu = await getFollowupQuestion(
                      {
                        mainQuestion: mainQ,
                        previousAnswers: [answerText],
                        followupIndex: 0,
                      },
                      { apiKey, style }
                    );
                    setState((s) => {
                      const items = [...s.items];
                      const cur = { ...items[s.currentIndex] };
                      const fus = [...(cur.followups || [])];
                      fus[0] = { question: fu.question, answer: "" } as any;
                      cur.followups = fus;
                      items[s.currentIndex] = cur;
                      return { ...s, items };
                    });
                    setIsGenerating(false);
                    setSubIdx(0);
                    if (ttsSupported) {
                      const preset = STYLE_PRESETS[style];
                      speak(`${preset.questionPreamble}${fu.question}`);
                    }
                    return;
                  }
                  if (subIdx === 0) {
                    setIsGenerating(true);
                    const cur = state.items[state.currentIndex];
                    const fu = await getFollowupQuestion(
                      {
                        mainQuestion: cur.question,
                        previousAnswers: [cur.answer, answerText].filter(
                          Boolean
                        ),
                        followupIndex: 1,
                      },
                      { apiKey, style }
                    );
                    setState((s) => {
                      const items = [...s.items];
                      const cur2 = { ...items[s.currentIndex] };
                      const fus = [...(cur2.followups || [])];
                      fus[1] = { question: fu.question, answer: "" } as any;
                      cur2.followups = fus;
                      items[s.currentIndex] = cur2;
                      return { ...s, items };
                    });
                    setIsGenerating(false);
                    setSubIdx(1);
                    if (ttsSupported) {
                      const preset = STYLE_PRESETS[style];
                      speak(`${preset.questionPreamble}${fu.question}`);
                    }
                    return;
                  }
                  setSubIdx(-1);
                  setIsGenerating(false);
                  if (isLastQuestion) {
                    cancel();
                    setState((s) => ({ ...s, phase: "summary" }));
                  } else {
                    setState((s) => ({
                      ...s,
                      currentIndex: s.currentIndex + 1,
                    }));
                    if (ttsSupported) {
                      const preset = STYLE_PRESETS[style];
                      speak(
                        `${preset.questionPreamble}${
                          DEFAULT_QUESTIONS[state.currentIndex + 1]
                        }`
                      );
                    }
                  }
                }}
                disabled={
                  !textMode ||
                  isGenerating ||
                  ttsStatus === "speaking" ||
                  sttStatus === "listening"
                }
              >
                提交文本回答
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              minHeight: 60,
              padding: 8,
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <div style={{ color: "#666", fontSize: 12 }}>
              识别状态：{sttStatus}
            </div>
            <div>
              {transcript || <span style={{ color: "#aaa" }}>{partial}</span>}
            </div>
            {sttError && (
              <div style={{ color: "red", marginTop: 4 }}>错误：{sttError}</div>
            )}
          </div>

          {/* 自动流程，无需手动“下一题” */}
        </div>
      )}

      {state.phase === "summary" && (
        <div>
          <h2>面试总结</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {state.items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  Q{idx + 1}: {it.question}
                </div>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                  A: {it.answer || "（未作答）"}{" "}
                  {it.answerVia === "text" ? (
                    <em style={{ color: "#ad6800" }}>（文本）</em>
                  ) : null}
                </div>
                {it.followups?.[0]?.question && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600 }}>
                      追问1：{it.followups[0].question}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                      A: {it.followups[0].answer || "（未作答）"}{" "}
                      {it.followups[0].via === "text" ? (
                        <em style={{ color: "#ad6800" }}>（文本）</em>
                      ) : null}
                    </div>
                  </div>
                )}
                {it.followups?.[1]?.question && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600 }}>
                      追问2：{it.followups[1].question}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                      A: {it.followups[1].answer || "（未作答）"}{" "}
                      {it.followups[1].via === "text" ? (
                        <em style={{ color: "#ad6800" }}>（文本）</em>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <details>
              <summary>查看 JSON 记录</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(state.items, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
