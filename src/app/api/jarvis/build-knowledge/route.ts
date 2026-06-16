// src/app/api/jarvis/build-knowledge/route.ts
// 지식 베이스 임베딩 실행 API
// 브라우저에서 한 번만 호출하면 모든 마크다운을 Gemini로 임베딩 → Supabase 저장

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { KNOWLEDGE_FILES } from "@/lib/jarvis/knowledge_data";

export const runtime = "nodejs";
export const maxDuration = 300; // 5분 (대량 임베딩용)

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 마크다운 청크 분할 (헤더 기준)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function splitMarkdownIntoChunks(body: string): Array<{ title: string; content: string }> {
  const MIN_SIZE = 300;
  const MAX_SIZE = 1500;
  const lines = body.split("\n");
  const chunks: Array<{ title: string; content: string }> = [];
  let current = { title: "", content: "" };

  for (const line of lines) {
    const isHeader = /^#{1,3}\s+/.test(line);
    if (isHeader) {
      if (current.content.trim().length >= MIN_SIZE) {
        chunks.push({ ...current });
        current = { title: line.replace(/^#+\s+/, "").trim(), content: line + "\n" };
      } else {
        current.title = current.title || line.replace(/^#+\s+/, "").trim();
        current.content += line + "\n";
      }
    } else {
      current.content += line + "\n";
      if (current.content.length > MAX_SIZE) {
        chunks.push({ ...current });
        current = { title: current.title + " (계속)", content: "" };
      }
    }
  }
  if (current.content.trim().length > 0) chunks.push(current);
  return chunks.filter((c) => c.content.trim().length > 50);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Gemini 임베딩 (768차원)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function embedText(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini embedding failed: ${JSON.stringify(data)}`);
  return data.embedding.values;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/jarvis/build-knowledge
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(req: Request) {
  try {
    // 보안: Bearer 토큰 또는 admin role 확인
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const expectedToken = process.env.JARVIS_EMBED_SECRET || process.env.CRON_SECRET || process.env.CALL_RECORDINGS_PROCESS_SECRET || "";

    // 요청 body에서 user 정보 확인
    let body: { user?: { role?: string } } = {};
    try {
      body = await req.json();
    } catch {}

    const isAdmin = body?.user?.role === "admin";
    const hasValidToken = expectedToken && token === expectedToken;

    if (!isAdmin && !hasValidToken) {
      return NextResponse.json(
        { error: "관리자 권한 또는 유효한 토큰이 필요합니다." },
        { status: 403 }
      );
    }

    if (!GEMINI_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY 환경변수 누락" }, { status: 500 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 기존 청크 모두 삭제
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await supabase.from("knowledge_chunks").delete().gte("id", 0);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 각 파일을 청크 분할 + 임베딩 + 저장
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const result = {
      totalFiles: 0,
      totalChunks: 0,
      failed: 0,
      errors: [] as string[],
      perFile: [] as Array<{ file: string; chunks: number }>,
    };

    for (const file of KNOWLEDGE_FILES) {
      const chunks = splitMarkdownIntoChunks(file.body);
      result.totalFiles++;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const embedding = await embedText(chunk.content);

          const { error } = await supabase.from("knowledge_chunks").insert({
            source_file: file.source_file,
            chunk_index: i,
            title: chunk.title || file.frontmatter.category || "",
            content: chunk.content.trim(),
            category: file.frontmatter.category || null,
            tags: file.frontmatter.tags || [],
            embedding,
            metadata: { ...file.frontmatter },
          });

          if (error) {
            result.failed++;
            result.errors.push(`${file.source_file} chunk ${i}: ${error.message}`);
          } else {
            result.totalChunks++;
          }

          // Rate limit (Gemini 무료 60 RPM, 유료 1500 RPM)
          await new Promise((r) => setTimeout(r, 100));
        } catch (err) {
          result.failed++;
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`${file.source_file} chunk ${i}: ${msg}`);
        }
      }

      result.perFile.push({ file: file.source_file, chunks: chunks.length });
    }

    return NextResponse.json({
      ok: true,
      summary: `✅ ${result.totalFiles}개 파일에서 ${result.totalChunks}개 청크 인덱싱 완료${result.failed > 0 ? ` (실패 ${result.failed}개)` : ""}`,
      ...result,
    });
  } catch (err) {
    console.error("[build-knowledge] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "임베딩 실패" },
      { status: 500 }
    );
  }
}

// 편의: GET 요청도 지원 (브라우저 주소창에서 직접 호출 가능)
// 단, 반드시 ?secret=XXX 토큰 필요
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || "";
  const expected = process.env.JARVIS_EMBED_SECRET || process.env.CRON_SECRET || process.env.CALL_RECORDINGS_PROCESS_SECRET || "";

  if (!expected || secret !== expected) {
    return NextResponse.json(
      { error: "URL에 ?secret=환경변수에 등록된 토큰 을 추가하세요." },
      { status: 403 }
    );
  }

  // GET을 POST로 위임 (토큰 인증 그대로 사용)
  const fakeReq = new Request(req.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`,
    },
    body: JSON.stringify({}),
  });
  return await POST(fakeReq);
}
