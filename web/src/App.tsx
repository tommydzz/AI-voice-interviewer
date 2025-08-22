import { useCallback, useMemo, useState } from "react";
import "./App.css";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useTextToSpeech } from "./hooks/useTextToSpeech";
import { DEFAULT_QUESTIONS, type InterviewState } from "./types";
import { getFeedback } from "./llm";

function App() {
  const [state, setState] = useState<InterviewState>({
    phase: "welcome",
    currentIndex: 0,
    items: DEFAULT_QUESTIONS.map((q) => ({ question: q, answer: "" })),
  });

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

  const {
    isSupported: ttsSupported,
    speak,
    cancel,
  } = useTextToSpeech({ lang: "zh-CN", rate: 1.0 });

  const currentQuestion = useMemo(
    () => state.items[state.currentIndex]?.question ?? "",
    [state]
  );
  const isLastQuestion = useMemo(
    () => state.currentIndex >= state.items.length - 1,
    [state]
  );

  const beginInterview = useCallback(() => {
    setState((s) => ({ ...s, phase: "interview", currentIndex: 0 }));
    if (ttsSupported) {
      speak(
        "你好，我是Kora的语音面试官，接下来我会用中文向你提问一些常见面试问题，请用语音作答。"
      );
      setTimeout(() => speak(`第一个问题：${DEFAULT_QUESTIONS[0]}`), 800);
    }
  }, [speak, ttsSupported]);

  const startAnswer = useCallback(() => {
    reset();
    start();
  }, [reset, start]);

  const finishAnswer = useCallback(async () => {
    stop();
    const answerText = transcript.trim() || partial.trim();
    setState((s) => {
      const items = [...s.items];
      items[s.currentIndex] = { ...items[s.currentIndex], answer: answerText };
      return { ...s, items };
    });
    const fb = await getFeedback(answerText);
    setState((s) => {
      const items = [...s.items];
      items[s.currentIndex] = {
        ...items[s.currentIndex],
        followup: fb.followup,
      };
      return { ...s, items };
    });
    if (ttsSupported && fb.followup) speak(fb.followup);
  }, [partial, speak, stop, transcript, ttsSupported]);

  const nextQuestion = useCallback(() => {
    if (isLastQuestion) {
      cancel();
      setState((s) => ({ ...s, phase: "summary" }));
      return;
    }
    setState((s) => ({ ...s, currentIndex: s.currentIndex + 1 }));
    if (ttsSupported)
      speak(`下一个问题：${DEFAULT_QUESTIONS[state.currentIndex + 1]}`);
  }, [cancel, isLastQuestion, speak, state.currentIndex, ttsSupported]);

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
          <button onClick={beginInterview}>开始面试</button>
        </div>
      )}

      {state.phase === "interview" && (
        <div>
          <h2>
            问题 {state.currentIndex + 1} / {state.items.length}
          </h2>
          <p style={{ fontWeight: 600 }}>{currentQuestion}</p>

          <div style={{ marginTop: 12 }}>
            {sttStatus !== "listening" ? (
              <button onClick={startAnswer} disabled={!sttSupported}>
                开始回答
              </button>
            ) : (
              <button onClick={finishAnswer}>结束回答</button>
            )}
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
              识别中（{sttStatus}）
            </div>
            <div>
              {transcript || <span style={{ color: "#aaa" }}>{partial}</span>}
            </div>
            {sttError && (
              <div style={{ color: "red", marginTop: 4 }}>错误：{sttError}</div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={nextQuestion}>下一题 / 总结</button>
          </div>
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
                  A: {it.answer || "（未作答）"}
                </div>
                {it.followup && (
                  <div style={{ color: "#555", marginTop: 6 }}>
                    追问/反馈：{it.followup}
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
