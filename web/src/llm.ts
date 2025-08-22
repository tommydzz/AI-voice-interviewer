// 轻量 LLM 反馈：默认基于简单规则；可扩展为调用云端 LLM。

export interface LlmFeedback {
  followup: string;
}

export async function getFeedback(answer: string): Promise<LlmFeedback> {
  const trimmed = answer.trim();
  if (!trimmed) return { followup: "明白了，谢谢你的回答。" };

  // 简单启发式追问
  if (trimmed.length < 20) {
    return { followup: "能具体一点吗？比如你的目标、行动和结果分别是什么？" };
  }
  if (/困难|挑战|冲突/.test(trimmed)) {
    return { followup: "你是如何权衡不同方案的？有没有量化的结果？" };
  }
  if (/团队|合作|配合/.test(trimmed)) {
    return { followup: "你如何在团队中发挥影响力？有没有具体案例？" };
  }
  return { followup: "明白了，谢谢你的回答。" };
}
