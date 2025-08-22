export type InterviewPhase = "welcome" | "interview" | "summary";

export interface QaItem {
  question: string;
  answer: string;
  answerVia?: "voice" | "text";
  followups: { question: string; answer: string; via?: "voice" | "text" }[]; // 最多两条
}

export interface InterviewState {
  phase: InterviewPhase;
  currentIndex: number;
  items: QaItem[];
}

export const DEFAULT_QUESTIONS: string[] = [
  "你最近完成的一件最有成就感的事是什么？你在其中扮演了什么角色？",
  "请讲讲一次你解决冲突或困难的经历。",
  "如果你加入一个你不熟悉的项目团队，你会如何快速融入？",
];

export type InterviewStyle = "serious" | "friendly" | "campus";

export interface StyleProfile {
  name: string;
  tts: { rate: number; pitch: number; voiceName?: string };
  questionPreamble: string; // 朗读问题前的说辞
  systemPrompt: string; // 传给 LLM 的风格指令
}

export const STYLE_PRESETS: Record<InterviewStyle, StyleProfile> = {
  serious: {
    name: "严肃",
    tts: { rate: 0.95, pitch: 0.9 },
    questionPreamble: "请回答：",
    systemPrompt:
      "你是一位严谨专业的中文结构化面试官。问题简洁、逻辑清晰、避免寒暄。根据候选人的回答提出高质量的追问，聚焦 STAR（情景、任务、行动、结果）和可量化指标。",
  },
  friendly: {
    name: "亲切",
    tts: { rate: 1.05, pitch: 1.1 },
    questionPreamble: "好的，我们聊聊这个：",
    systemPrompt:
      "你是一位亲切、鼓励式的中文面试官。语气友好，追问温和且具体，引导候选人给出可观测行为与结果。",
  },
  campus: {
    name: "校园风",
    tts: { rate: 1.1, pitch: 1.2 },
    questionPreamble: "来个轻松的问题：",
    systemPrompt:
      "你是一位校园招聘风格的中文面试官。表达轻松但结构化，追问聚焦在角色、团队合作、学习与成长。",
  },
};
