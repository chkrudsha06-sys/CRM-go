// src/lib/jarvis/llm.ts
// AI 모델 라우터 — 하이브리드 (Claude Sonnet 4.6 + Gemini 2.5 Pro/Flash)

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "";

import type { IntentCategory } from "./intent";

export type Message = { role: "user" | "assistant"; content: string };
export type LLMTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};
export type LLMResponse = {
  text: string;
  toolUse?: { name: string; input: Record<string, unknown> };
  model: string;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 모델 선택 (하이브리드 전략)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function selectModel(category: IntentCategory, hasTools: boolean): "claude" | "gemini-pro" | "gemini-flash" {
  // 쓰기 액션은 무조건 Claude (Function Calling 정확도 높음)
  if (hasTools) return "claude";

  // 복잡한 추론·도메인 지식·종합 인사이트는 Claude
  if (category === "knowledge" || category === "insight_combined") return "claude";

  // 활동 이력 (활동노트 의미 파악)도 Claude
  if (category === "activity_history") return "claude";

  // 단순 조회·통계는 Gemini Pro (충분히 똑똑하고 저렴)
  if (category === "customer_lookup" || category === "sales_analytics" ||
      category === "kpi_activity" || category === "bunyanghoe_ops" ||
      category === "task_schedule") {
    return "gemini-pro";
  }

  // 인사 등 가벼운 응답은 Gemini Flash
  if (category === "greeting") return "gemini-flash";

  // 불명확한 경우는 Claude (안전)
  return "claude";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Claude Sonnet 4.6 호출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function callClaude(params: {
  systemPrompt: string;
  messages: Message[];
  tools?: LLMTool[];
  maxTokens?: number;
}): Promise<LLMResponse> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY 누락");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: params.maxTokens || 2048,
      system: params.systemPrompt,
      messages: params.messages,
      ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
    }),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Claude failed: ${JSON.stringify(data)}`);
  }

  // 응답 파싱: text + tool_use 블록 분리
  let text = "";
  let toolUse: { name: string; input: Record<string, unknown> } | undefined;

  for (const block of data.content || []) {
    if (block.type === "text") text += block.text;
    if (block.type === "tool_use") {
      toolUse = { name: block.name, input: block.input };
    }
  }

  return { text: text.trim(), toolUse, model: "claude-sonnet-4-6" };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Gemini 호출 (Pro/Flash)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function callGemini(params: {
  systemPrompt: string;
  messages: Message[];
  model: "gemini-2.5-pro" | "gemini-2.5-flash";
  maxTokens?: number;
}): Promise<LLMResponse> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY 누락");

  // Gemini는 대화 형식이 다름: contents 배열 + role 변환
  const contents = params.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: params.maxTokens || 2048,
        temperature: 0.3,
      },
    }),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini failed: ${JSON.stringify(data)}`);
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || "")
    .join("")
    .trim();

  return { text, model: params.model };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 통합 호출 함수 — 카테고리 기반 자동 선택
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function callLLM(params: {
  category: IntentCategory;
  systemPrompt: string;
  messages: Message[];
  tools?: LLMTool[];
  maxTokens?: number;
}): Promise<LLMResponse> {
  const hasTools = !!(params.tools && params.tools.length > 0);
  const choice = selectModel(params.category, hasTools);

  try {
    if (choice === "claude") {
      return await callClaude({
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        tools: params.tools,
        maxTokens: params.maxTokens,
      });
    } else if (choice === "gemini-pro") {
      return await callGemini({
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        model: "gemini-2.5-pro",
        maxTokens: params.maxTokens,
      });
    } else {
      return await callGemini({
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        model: "gemini-2.5-flash",
        maxTokens: params.maxTokens,
      });
    }
  } catch (err) {
    // Claude 실패 시 Gemini Pro로 폴백, Gemini 실패 시 Flash로 폴백
    console.warn(`[llm] ${choice} 실패, 폴백 시도:`, err);
    if (choice === "claude") {
      return await callGemini({
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        model: "gemini-2.5-pro",
        maxTokens: params.maxTokens,
      });
    } else {
      return await callGemini({
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        model: "gemini-2.5-flash",
        maxTokens: params.maxTokens,
      });
    }
  }
}
