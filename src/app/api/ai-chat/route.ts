// src/app/api/ai-chat/route.ts
// 자비스 V2 메인 라우트 — Intent → 컨텍스트 → LLM 통합

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { classifyByPattern } from "@/lib/jarvis/intent";
import { searchKnowledge, formatKnowledgeForContext } from "@/lib/jarvis/knowledge";
import { buildCRMContext } from "@/lib/jarvis/context";
import { callLLM, type Message } from "@/lib/jarvis/llm";
import { REQUEST_WRITE_ACTION_TOOL, checkPermission } from "@/lib/jarvis/tools";
import { buildSystemPrompt, extractCRMSourceLinks, extractKnowledgeSourceLinks } from "@/lib/jarvis/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

function getNowLabel(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const iso = kst.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} (KST)`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = String(body?.message || "").trim();
    const history: Message[] = Array.isArray(body?.history) ? body.history : [];
    const user = body?.user || { name: "", title: "", role: "exec" };
    const task: string | null = body?.task || null;

    if (!message) {
      return NextResponse.json({ error: "메시지가 비어있습니다." }, { status: 400 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1단계: Intent 분류
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const intent = classifyByPattern(message);

    // task ID가 있으면 카테고리 강제 매핑 (기존 quick action 호환)
    if (task) {
      const taskMap: Record<string, typeof intent.category> = {
        today_briefing: "insight_combined",
        inactive_customers: "insight_combined",
        sales_analysis: "sales_analytics",
        task_summary: "task_schedule",
        wanpan_schedule: "task_schedule",
        calendar_review: "task_schedule",
        priority_actions: "insight_combined",
      };
      if (taskMap[task]) intent.category = taskMap[task];
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2단계: 컨텍스트 수집 (병렬)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const [crmContext, knowledgeChunks] = await Promise.all([
      intent.needsCrmData ? buildCRMContext(intent, user).catch(() => "") : Promise.resolve(""),
      intent.needsKnowledge || intent.category === "insight_combined" || intent.category === "write_action"
        ? searchKnowledge(message, { topK: 4 }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const knowledgeContext = knowledgeChunks.length > 0 ? formatKnowledgeForContext(knowledgeChunks) : "";

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3단계: 시스템 프롬프트 빌드 + 도구 결정
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const hasWriteTools = intent.isWriteAction;
    const tools = hasWriteTools ? [REQUEST_WRITE_ACTION_TOOL] : undefined;

    const systemPrompt = buildSystemPrompt({
      category: intent.category,
      user,
      knowledgeContext,
      crmContext,
      hasWriteTools,
      nowLabel: getNowLabel(),
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4단계: LLM 호출 (하이브리드 자동 선택)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const messages: Message[] = [
      ...history.slice(-6), // 최근 6턴만 (토큰 절약)
      { role: "user", content: message },
    ];

    const llmResponse = await callLLM({
      category: intent.category,
      systemPrompt,
      messages,
      tools,
      maxTokens: 2048,
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5단계: 응답 처리 — 쓰기 액션 vs 일반 답변
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 5-A. 쓰기 액션이 요청된 경우 → 확인 대기 상태로 저장
    if (llmResponse.toolUse && llmResponse.toolUse.name === "request_write_action") {
      const input = llmResponse.toolUse.input as Record<string, unknown>;
      const actionType = String(input.action_type || "");

      // 권한 검증
      const perm = checkPermission(actionType, user.role);
      if (!perm.allowed) {
        return NextResponse.json({
          text: `죄송합니다. ${perm.reason}`,
          reply: `죄송합니다. ${perm.reason}`,
          sources: [],
          model: llmResponse.model,
        });
      }

      // jarvis_actions에 pending 상태로 저장
      const { data: actionRow } = await supabase
        .from("jarvis_actions")
        .insert({
          user_name: user.name,
          user_role: user.role,
          action_type: actionType,
          target_table: String(input.target_table || ""),
          target_id: input.target_id ? Number(input.target_id) : null,
          payload: input.payload || {},
          status: "pending",
          request_message: message,
        })
        .select("id")
        .maybeSingle();

      return NextResponse.json({
        text: llmResponse.text || "다음 작업을 진행하시겠습니까?",
        reply: llmResponse.text || "다음 작업을 진행하시겠습니까?",
        pendingAction: {
          actionId: actionRow?.id,
          actionType,
          targetLabel: input.target_label,
          previewText: input.preview_text,
          payload: input.payload,
        },
        sources: extractCRMSourceLinks(crmContext, intent.category),
        model: llmResponse.model,
        intent: intent.category,
      });
    }

    // 5-B. 일반 답변 — 출처 링크 추가
    const crmLinks = extractCRMSourceLinks(crmContext, intent.category);
    const knowledgeLinks = extractKnowledgeSourceLinks(knowledgeChunks);
    const sources = crmLinks.concat(knowledgeLinks).slice(0, 6);

    return NextResponse.json({
      text: llmResponse.text,
      reply: llmResponse.text,
      sources,
      model: llmResponse.model,
      intent: intent.category,
    });
  } catch (err) {
    console.error("[ai-chat] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "자비스 응답 생성 실패" },
      { status: 500 }
    );
  }
}
