// src/app/api/ai-chat/confirm/route.ts
// 사용자가 [확인] 버튼을 누르면 실제 DB 쓰기 실행

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ACTION_TABLE_MAP, checkPermission } from "@/lib/jarvis/tools";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const actionId: number | undefined = body?.actionId;
    const confirmed: boolean = !!body?.confirmed;
    const user = body?.user || { name: "", role: "exec" };

    if (!actionId) {
      return NextResponse.json({ error: "actionId 누락" }, { status: 400 });
    }

    // pending 액션 조회
    const { data: action, error: fetchErr } = await supabase
      .from("jarvis_actions")
      .select("*")
      .eq("id", actionId)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchErr || !action) {
      return NextResponse.json({ error: "대기 중인 액션을 찾을 수 없습니다." }, { status: 404 });
    }

    // 본인 액션만 처리 가능 (admin은 모두 가능)
    if (action.user_name !== user.name && user.role !== "admin") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 취소 처리
    if (!confirmed) {
      await supabase
        .from("jarvis_actions")
        .update({ status: "cancelled", confirmed_at: new Date().toISOString() })
        .eq("id", actionId);

      return NextResponse.json({
        text: "✓ 작업이 취소되었습니다.",
        cancelled: true,
      });
    }

    // 권한 재검증
    const perm = checkPermission(action.action_type, user.role);
    if (!perm.allowed) {
      await supabase
        .from("jarvis_actions")
        .update({ status: "failed", result: { error: perm.reason } })
        .eq("id", actionId);
      return NextResponse.json({ error: perm.reason || "권한 없음" }, { status: 403 });
    }

    // 실제 실행
    try {
      const result = await executeAction(action.action_type, action.payload, action.target_id, user);

      await supabase
        .from("jarvis_actions")
        .update({
          status: "executed",
          confirmed_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          result,
        })
        .eq("id", actionId);

      return NextResponse.json({
        text: `✅ 작업이 완료되었습니다.\n${result.summary || ""}`,
        executed: true,
        result,
      });
    } catch (execErr) {
      const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
      await supabase
        .from("jarvis_actions")
        .update({
          status: "failed",
          confirmed_at: new Date().toISOString(),
          result: { error: errMsg },
        })
        .eq("id", actionId);

      return NextResponse.json({ error: `실행 실패: ${errMsg}` }, { status: 500 });
    }
  } catch (err) {
    console.error("[ai-chat/confirm] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "확인 처리 실패" },
      { status: 500 }
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 실제 액션 실행 디스패처
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type ExecutionResult = { summary: string; data?: unknown };

async function executeAction(
  actionType: string,
  payload: Record<string, unknown>,
  targetId: number | null,
  user: { name: string; role?: string }
): Promise<ExecutionResult> {
  const tableName = ACTION_TABLE_MAP[actionType];
  if (!tableName) throw new Error(`알 수 없는 액션 타입: ${actionType}`);

  const now = new Date().toISOString();

  switch (actionType) {
    case "add_note": {
      const { data, error } = await supabase
        .from("contact_notes")
        .insert({
          contact_id: payload.contact_id,
          note_date: payload.note_date || now.split("T")[0],
          content: payload.content,
          author: payload.author || user.name,
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `활동노트가 추가되었습니다 (ID: ${data?.id})`, data };
    }

    case "update_contact_field": {
      if (!targetId) throw new Error("targetId 필요");
      const { error } = await supabase.from("contacts").update(payload).eq("id", targetId);
      if (error) throw error;
      const fields = Object.keys(payload).join(", ");
      return { summary: `고객 정보 수정 완료 (${fields})` };
    }

    case "transfer_to_vip": {
      if (!targetId) throw new Error("targetId 필요");
      const { error } = await supabase
        .from("contacts")
        .update({
          crm_db_source: "vip_activity",
          vip_transferred_at: now,
          ...(payload || {}),
        })
        .eq("id", targetId);
      if (error) throw error;
      return { summary: "VIP활동DB로 이관 완료" };
    }

    case "add_sales_record": {
      const { data, error } = await supabase
        .from("ad_executions")
        .insert({
          ...payload,
          team_member: payload.team_member || user.name,
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `매출 등록 완료 (ID: ${data?.id})`, data };
    }

    case "update_refund": {
      if (!targetId) throw new Error("targetId 필요");
      const { error } = await supabase
        .from("ad_executions")
        .update({ refund_amount: payload.refund_amount, refund_reason: payload.refund_reason })
        .eq("id", targetId);
      if (error) throw error;
      return { summary: `환불 처리 완료 (${payload.refund_amount}원)` };
    }

    case "create_task": {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...payload,
          requester: payload.requester || user.name,
          status: payload.status || "신규",
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `업무요청 생성 (ID: ${data?.id})`, data };
    }

    case "update_task_status": {
      if (!targetId) throw new Error("targetId 필요");
      const { error } = await supabase
        .from("tasks")
        .update({ status: payload.status })
        .eq("id", targetId);
      if (error) throw error;
      return { summary: `업무 상태 변경 완료 (${payload.status})` };
    }

    case "add_task_comment": {
      const { data, error } = await supabase
        .from("task_comments")
        .insert({
          task_id: payload.task_id,
          author: payload.author || user.name,
          content: payload.content,
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `코멘트 등록 완료 (ID: ${data?.id})`, data };
    }

    case "create_approval": {
      const { data, error } = await supabase
        .from("approval_requests")
        .insert({
          ...payload,
          requester: payload.requester || user.name,
          status: payload.status || "신청",
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `결재 신청 완료 (ID: ${data?.id})`, data };
    }

    case "create_calendar_event": {
      const { data, error } = await supabase
        .from("calendar_custom_events")
        .insert({
          ...payload,
          created_by: user.name,
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `일정 등록 완료 (${payload.event_date})`, data };
    }

    case "create_wanpan_truck": {
      const { data, error } = await supabase
        .from("wanpan_trucks")
        .insert({ ...payload, created_at: now })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `완판트럭 일정 등록 완료 (ID: ${data?.id})`, data };
    }

    case "upsert_daily_activity": {
      const targetDate = payload.activity_date || now.split("T")[0];
      const targetUser = payload.user_name || user.name;

      // upsert (있으면 update, 없으면 insert)
      const { data: existing } = await supabase
        .from("daily_activity_goals")
        .select("id")
        .eq("user_name", targetUser)
        .eq("activity_date", targetDate)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("daily_activity_goals")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
        return { summary: `${targetDate} ${targetUser} 활동 기록 업데이트` };
      } else {
        const { error } = await supabase.from("daily_activity_goals").insert({
          user_name: targetUser,
          activity_date: targetDate,
          ...payload,
        });
        if (error) throw error;
        return { summary: `${targetDate} ${targetUser} 활동 기록 추가` };
      }
    }

    case "add_memo": {
      const { data, error } = await supabase
        .from("memos")
        .insert({
          ...payload,
          author: payload.author || user.name,
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `메모 추가 완료 (ID: ${data?.id})`, data };
    }

    case "add_notice": {
      if (user.role !== "admin") throw new Error("관리자만 공지를 등록할 수 있습니다.");
      const { data, error } = await supabase
        .from("notices")
        .insert({
          ...payload,
          author: payload.author || user.name,
          created_at: now,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { summary: `공지 등록 완료 (ID: ${data?.id})`, data };
    }

    case "update_slogan": {
      const { error } = await supabase
        .from("crm_user_slogans")
        .upsert({ user_name: user.name, slogan: payload.slogan, updated_at: now });
      if (error) throw error;
      return { summary: "슬로건 업데이트 완료" };
    }

    case "update_content_status": {
      if (!payload.contact_id) throw new Error("contact_id 필요");
      const { error } = await supabase
        .from("content_statuses")
        .upsert({
          contact_id: payload.contact_id,
          ...payload,
          updated_at: now,
        });
      if (error) throw error;
      return { summary: "콘텐츠 단계 업데이트 완료" };
    }

    default:
      throw new Error(`구현되지 않은 액션: ${actionType}`);
  }
}
