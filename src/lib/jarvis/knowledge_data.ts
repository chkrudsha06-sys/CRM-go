// src/lib/jarvis/knowledge.ts
// 지식 베이스 검색 (RAG) 모듈

import { supabase } from "@/lib/supabase";

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "";

export type KnowledgeChunk = {
  id: number;
  source_file: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  similarity?: number;
};

/**
 * 텍스트를 Gemini text-embedding-004로 임베딩 (768차원)
 */
export async function embedQuery(text: string): Promise<number[]> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY 누락");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Embedding failed: ${JSON.stringify(data)}`);
  }
  return data.embedding.values;
}

/**
 * 의미 검색 (vector similarity)
 */
export async function searchKnowledge(
  query: string,
  options: { topK?: number; threshold?: number; category?: string } = {}
): Promise<KnowledgeChunk[]> {
  const { topK = 5, threshold = 0.6, category } = options;

  try {
    const embedding = await embedQuery(query);

    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_category: category || null,
    });

    if (error) {
      console.warn("[knowledge] vector search failed, falling back to text search:", error.message);
      return await searchKnowledgeText(query, topK);
    }

    return (data as KnowledgeChunk[]) || [];
  } catch (err) {
    console.warn("[knowledge] embedding failed, falling back to text search:", err);
    return await searchKnowledgeText(query, topK);
  }
}

/**
 * 키워드 검색 (vector 실패 시 폴백)
 */
export async function searchKnowledgeText(
  query: string,
  topK = 5
): Promise<KnowledgeChunk[]> {
  // 한국어 핵심 키워드 추출
  const keywords = query
    .replace(/[?.,!]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 3);

  const results: KnowledgeChunk[] = [];
  for (const kw of keywords) {
    const { data } = await supabase.rpc("search_knowledge_text", {
      search_query: kw,
      match_count: topK,
    });
    if (data) results.push(...(data as KnowledgeChunk[]));
  }

  // 중복 제거
  const seen = new Set<number>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).slice(0, topK);
}

/**
 * 검색 결과를 LLM 컨텍스트 텍스트로 포맷
 */
export function formatKnowledgeForContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "";

  const sections = chunks.map((c, idx) => {
    const sim = c.similarity ? ` (유사도 ${(c.similarity * 100).toFixed(0)}%)` : "";
    return `[지식 ${idx + 1}] ${c.title || c.source_file}${sim}
출처: ${c.source_file}
${c.content}`;
  });

  return `다음은 분양의신 내부 지식 베이스에서 검색된 관련 문서입니다.\n반드시 이 내용을 기반으로 답변하고, 사실이 아닌 추측은 하지 마세요.\n\n${sections.join("\n\n──────────\n\n")}`;
}
