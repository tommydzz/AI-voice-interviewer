// DeepSeek Chat 接入：基于风格与 prompt 生成“中文追问”。
// 默认使用浏览器端 fetch 直连 DeepSeek API（需在部署端配置 CORS 或经代理）。

import { STYLE_PRESETS, type InterviewStyle } from "./types";
import { DEFAULT_DEEPSEEK_API_KEY } from "./config";

export interface LlmFollowupResult {
  question: string;
}

export interface DeepSeekOptions {
  apiKey?: string; // 建议从环境变量注入
  model?: string; // deepseek-chat v3.1 非思考模式
  style?: InterviewStyle;
}

export async function getFollowupQuestion(
  params: {
    mainQuestion: string;
    previousAnswers: string[]; // 包含主问题答案与已回答的追问
    followupIndex: number; // 0 或 1
  },
  options?: DeepSeekOptions
): Promise<LlmFollowupResult> {
  const style = options?.style ?? "friendly";
  const preset = STYLE_PRESETS[style];
  const envKey = (import.meta as any)?.env?.VITE_DEEPSEEK_API_KEY as
    | string
    | undefined;
  const apiKey =
    options?.apiKey ||
    envKey ||
    DEFAULT_DEEPSEEK_API_KEY ||
    (typeof window !== "undefined"
      ? localStorage.getItem("DEEPSEEK_API_KEY") || ""
      : "");
  const model = options?.model || "deepseek-chat";

  // 无 key 时退回本地启发式
  if (!apiKey) {
    const heuristics = [
      "能具体说明你的目标、行动与量化结果吗？",
      "此事的关键难点是什么？你如何化解？",
      "你的影响如何体现？能给出数据吗？",
    ];
    const idx = params.followupIndex % heuristics.length;
    return { question: heuristics[idx] };
  }

  const system = `${preset.systemPrompt} 你只需输出一条中文“追问问题”，不要寒暄，不要输出分析，不超过40字。`;
  const user = `主问题：${params.mainQuestion}\n已回答：${
    params.previousAnswers.join(" | ") || "（空）"
  }\n这是第${
    params.followupIndex + 1
  }条追问。请基于 STAR 框架提出一个高价值追问。`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 128,
      }),
    });
    if (!res.ok) throw new Error(`deepseek_http_${res.status}`);
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    return {
      question:
        (content || "").trim() || "能具体说明你的目标、行动与量化结果吗？",
    };
  } catch (e) {
    const fallbacks = [
      "能具体说明你的目标、行动与量化结果吗？",
      "此事的关键难点是什么？你如何化解？",
      "你的影响如何体现？能给出数据吗？",
    ];
    const idx = params.followupIndex % fallbacks.length;
    return { question: fallbacks[idx] };
  }
}
