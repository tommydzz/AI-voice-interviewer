export type InterviewPhase = "welcome" | "interview" | "summary";

export interface QaItem {
  question: string;
  answer: string;
  followup?: string;
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
