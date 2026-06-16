// src/lib/jarvis/llm.ts
// AI 모델 라우터 — Gemini 전용 (2.5 Pro + 2.5 Flash)
// Claude 사용 안 함

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
// 모델 선택 (Gemini 전용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function selectModel(category: IntentCategory, hasTools: boolean): "gemini-pro" | "gemini-flash" {
  // 가벼운 인사만 Flash로 (응답 속도 빠름, 비용 매우 낮음)
  if (category === "greeting") return "gemini-flash";

  // 그 외 모든 것은 Gemini 2.5 Pro (한국어 + 도메인 추론 강함)
  return "gemini-pro";
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
  tools?: LLMTool[];      // Gemini는 아직 도구 미지원 — 무시함 (Phase B에서 지원 예정)
  maxTokens?: number;
}): Promise<LLMResponse> {
  const hasTools = !!(params.tools && params.tools.length > 0);
  const choice = selectModel(params.category, hasTools);

  const geminiModel = choice === "gemini-flash" ? "gemini-2.5-flash" : "gemini-2.5-pro";

  try {
    const result = await callGemini({
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      model: geminiModel,
      maxTokens: params.maxTokens,
    });
    return result;
  } catch (err) {
    console.warn(`[llm] ${geminiModel} 실패, Flash로 폴백:`, err);
    if (geminiModel === "gemini-2.5-pro") {
      return await callGemini({
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        model: "gemini-2.5-flash",
        maxTokens: params.maxTokens,
      });
    }
    throw err;
  }
}

// 호환성: 기존 callClaude 시그니처 유지 (사용 안 함)
export async function callClaude(_params: unknown): Promise<LLMResponse> {
  throw new Error("Claude API는 현재 비활성화되어 있습니다. callLLM을 사용하세요.");
}
