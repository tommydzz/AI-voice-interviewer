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
import { getFollowupQuestion, checkDeepseekConnectivity } from "./llm";
import { DEFAULT_DEEPSEEK_API_KEY } from "./config";
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Box,
  useMediaQuery,
} from "@mui/material";
import { useEffect } from "react";

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
  const [dsStatus, setDsStatus] = useState<{
    ok: boolean;
    code: string;
  } | null>(null);

  const isMobile = useMediaQuery("(max-width:600px)");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await checkDeepseekConnectivity();
      if (mounted) setDsStatus(res);
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
    <Container
      maxWidth="md"
      sx={{ py: isMobile ? 2 : 4, px: isMobile ? 1.5 : 2 }}
    >
      <Stack spacing={isMobile ? 1.5 : 2}>
        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700}>
          中文语音面试官 Demo
        </Typography>

        {dsStatus &&
          (dsStatus.ok ? (
            <Alert severity="success">
              DeepSeek 连接正常（{dsStatus.code}）
            </Alert>
          ) : (
            <Alert severity="info">
              DeepSeek 未就绪（{dsStatus.code}）。部署后请在 Vercel
              项目设置中配置环境变量 VITE_DEEPSEEK_API_KEY。
            </Alert>
          ))}

        {!sttSupported && (
          <Alert severity="error">
            当前浏览器不支持 Web Speech API 语音识别，请使用 Chrome 桌面版。
          </Alert>
        )}
        {!ttsSupported && (
          <Alert severity="warning">
            当前浏览器不支持语音合成，系统将仅展示文字。
          </Alert>
        )}

        {state.phase === "welcome" && (
          <Card className="glass-card">
            <CardContent>
              <Typography sx={{ mb: 1.5 }}>
                你好，我是Kora的语音面试官，接下来我会用中文向你提问一些常见面试问题，请用语音作答。
              </Typography>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="style-label">风格</InputLabel>
                  <Select
                    labelId="style-label"
                    label="风格"
                    value={style}
                    onChange={(e) => setStyle(e.target.value as InterviewStyle)}
                  >
                    <MenuItem value="serious">严肃</MenuItem>
                    <MenuItem value="friendly">亲切</MenuItem>
                    <MenuItem value="campus">校园风</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Button
                size={isMobile ? "medium" : "large"}
                fullWidth={isMobile}
                variant="contained"
                onClick={beginInterview}
              >
                开始面试
              </Button>
            </CardContent>
          </Card>
        )}

        {state.phase === "interview" && (
          <Stack spacing={isMobile ? 1.5 : 2}>
            <Typography
              variant={isMobile ? "subtitle1" : "h6"}
              fontWeight={700}
            >
              问题 {state.currentIndex + 1} / {state.items.length}
            </Typography>
            <Typography fontWeight={600}>{currentQuestion}</Typography>

            <Card className="glass-card">
              <CardContent>
                <Typography fontWeight={600} gutterBottom>
                  当前提问：
                </Typography>
                {subIdx < 0 ? (
                  <Typography>主问题：{currentItem?.question}</Typography>
                ) : (
                  <Typography>
                    追问{subIdx + 1}：
                    {currentItem?.followups?.[subIdx]?.question ||
                      "（生成中...）"}
                  </Typography>
                )}

                {currentItem?.followups?.length ? (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography color="text.secondary" fontSize={12}>
                      已生成追问：
                    </Typography>
                    {currentItem.followups.map((f, i) => (
                      <Typography key={i}>
                        追问{i + 1}：{f.question || "（生成中...）"}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </CardContent>
            </Card>

            {/* 底部粘性操作区（移动端） */}
            <Box
              sx={{
                position: isMobile ? "sticky" : "static",
                bottom: isMobile ? 12 : "auto",
                zIndex: 10,
              }}
            >
              <Stack direction={isMobile ? "column" : "row"} spacing={1.5}>
                {sttStatus !== "listening" ? (
                  <Button
                    size={isMobile ? "large" : "medium"}
                    fullWidth={isMobile}
                    variant="contained"
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
                  </Button>
                ) : (
                  <Button
                    size={isMobile ? "large" : "medium"}
                    fullWidth={isMobile}
                    variant="contained"
                    color="success"
                    onClick={finishAnswer}
                  >
                    提交录音
                  </Button>
                )}
                {!subIdx && subIdx >= 0 ? (
                  <Chip label={`追问 ${subIdx + 1}`} />
                ) : null}
              </Stack>
            </Box>

            {ttsStatus === "speaking" && (
              <Alert severity="info">正在朗读问题，请稍候…</Alert>
            )}
            {isGenerating && (
              <Alert severity="warning">正在生成下一条问题，请稍候…</Alert>
            )}
            {sttStatus === "listening" && (
              <Alert severity="error">
                录音中，请开始讲话… 完成后点击“提交录音”
              </Alert>
            )}

            <Stack spacing={1}>
              <Button
                variant="contained"
                color={textMode ? "warning" : "error"}
                onClick={() => {
                  if (!textMode) {
                    const ok = window.confirm(
                      "您的文本回答会被特殊标记，建议先尝试语音回答。确定要启用文本作答吗？"
                    );
                    if (!ok) return;
                  }
                  setTextMode((v) => !v);
                }}
                sx={{ alignSelf: "flex-start" }}
              >
                {textMode ? "关闭文本作答" : "切换为文本作答"}
              </Button>

              <Stack
                direction={isMobile ? "column" : "row"}
                spacing={1}
                alignItems={isMobile ? "stretch" : "center"}
                sx={{ opacity: textMode ? 1 : 0.5 }}
              >
                <TextField
                  fullWidth
                  size={isMobile ? "medium" : "small"}
                  placeholder={
                    textMode
                      ? "若语音失败，可在此输入作答"
                      : "请先点击上方红色按钮启用文本作答"
                  }
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  disabled={
                    !textMode ||
                    isGenerating ||
                    ttsStatus === "speaking" ||
                    sttStatus === "listening"
                  }
                />
                <Button
                  variant="contained"
                  size={isMobile ? "large" : "medium"}
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
                    if (apiKey)
                      localStorage.setItem("DEEPSEEK_API_KEY", apiKey);
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
                </Button>
              </Stack>
            </Stack>

            <Card className="glass-card">
              <CardContent>
                <Typography color="text.secondary" fontSize={12} gutterBottom>
                  识别状态：{sttStatus}
                </Typography>
                <Typography>
                  {transcript || (
                    <span style={{ color: "#aaa" }}>{partial}</span>
                  )}
                </Typography>
                {sttError && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    错误：{sttError}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Stack>
        )}

        {state.phase === "summary" && (
          <Stack spacing={2}>
            <Typography variant={isMobile ? "subtitle1" : "h6"}>
              面试总结
            </Typography>
            <Stack spacing={isMobile ? 1.5 : 2}>
              {state.items.map((it, idx) => (
                <Card key={idx} variant="outlined" className="glass-card">
                  <CardContent>
                    <Typography fontWeight={600}>
                      Q{idx + 1}: {it.question}
                    </Typography>
                    <Typography sx={{ whiteSpace: "pre-wrap", mt: 1 }}>
                      A: {it.answer || "（未作答）"}{" "}
                      {it.answerVia === "text" ? (
                        <em style={{ color: "#ad6800" }}>（文本）</em>
                      ) : null}
                    </Typography>
                    {it.followups?.[0]?.question && (
                      <Stack sx={{ mt: 1 }}>
                        <Typography fontWeight={600}>
                          追问1：{it.followups[0].question}
                        </Typography>
                        <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                          A: {it.followups[0].answer || "（未作答）"}{" "}
                          {it.followups[0].via === "text" ? (
                            <em style={{ color: "#ad6800" }}>（文本）</em>
                          ) : null}
                        </Typography>
                      </Stack>
                    )}
                    {it.followups?.[1]?.question && (
                      <Stack sx={{ mt: 1 }}>
                        <Typography fontWeight={600}>
                          追问2：{it.followups[1].question}
                        </Typography>
                        <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                          A: {it.followups[1].answer || "（未作答）"}{" "}
                          {it.followups[1].via === "text" ? (
                            <em style={{ color: "#ad6800" }}>（文本）</em>
                          ) : null}
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

export default App;
