import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

// ──────────────────────────────────────────────────────
// 결재 알림 인라인 헬퍼 (외부 fetch 없이 직접 발송)
// ──────────────────────────────────────────────────────
function approvalMentionEmail(name: string | null | undefined): string | null {
  if (!name) return null;
  const map = process.env.KAKAO_WORK_MENTION_MAP || "";
  for (const pair of map.split(",")) {
    const [n, email] = pair.split(":").map((s) => s.trim());
    if (n === name && email) return email;
  }
  return null;
}

async function approvalFindUserId(appKey: string, email: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${KAKAO_WORK_API_BASE}/users.find_by_email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers: { Authorization: `Bearer ${appKey}` }, cache: "no-store" }
    );
    const data = await res.json();
    const id = Number(data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch { return null; }
}

async function approvalMentionInline(appKey: string, name: string | null | undefined) {
  if (!name) return { type: "styled", text: "-", bold: false };
  const email = approvalMentionEmail(name);
  if (email) {
    const uid = await approvalFindUserId(appKey, email);
    if (uid) return { type: "mention", text: `@${name}`, ref: { type: "kw", value: uid } };
  }
  return { type: "styled", text: `@${name}`, bold: true };
}

function approvalTextBlock(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: false }] };
}
function approvalBoldBlock(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: true }] };
}
function approvalSubmitBtn(label: string, value: string, style: "default"|"primary"|"danger" = "default") {
  return { type: "button", text: label, style, action: { type: "submit_action", name: "approval_action", value } };
}

function approvalPayloadLines(payload: Record<string, any>, requestType: string): string[] {
  const lines: string[] = [];
  const add = (label: string, v: any) => {
    if (v !== undefined && v !== null && v !== "" && v !== "-") lines.push(`${label}: ${v}`);
  };
  if (requestType.includes("결제요청")) {
    add("안건", payload.subject);
    add("결제금액", payload.totalAmount || payload.amount);
    add("결제처", payload.payeeName || payload.vendor);
    const acct = payload.accountNumber
      ? `${payload.bankName || ""} ${payload.accountNumber}${payload.accountHolder ? ` (${payload.accountHolder})` : ""}`
      : null;
    add("계좌", acct);
    add("사유", payload.reason);
  } else if (requestType.includes("환불")) {
    add("안건", payload.subject);
    add("환불금액", payload.totalAmount || payload.amount);
    add("사유", payload.reason || payload.refundReason);
  } else if (requestType.includes("연차") || requestType.includes("반차")) {
    add("신청일", payload.leaveStartDate);
    add("종료일", payload.leaveEndDate);
    add("사유", payload.leaveReason);
  } else {
    add("안건", payload.subject);
    add("금액", payload.totalAmount || payload.amount);
    add("사유", payload.reason);
  }
  return lines;
}

async function sendApprovalNotifyInline(params: {
  appKey: string;
  conversationId: string;
  crmUrl: string;
  request_id: number;
  request_type: string;
  requester_name: string | null;
  current_approver: string | null;
  reference_name: string | null;
  action?: string;     // undefined=신규 | "승인" | "반려"
  actor?: string;
  is_final?: boolean;
  payload: Record<string, any>;
}) {
  const {
    appKey, conversationId, crmUrl,
    request_id, request_type, requester_name,
    current_approver, reference_name,
    action, actor, is_final = false, payload,
  } = params;

  const pLines   = approvalPayloadLines(payload, request_type);
  const isNew    = !action;
  const isApproved = action === "승인";
  const isRejected = action === "반려";
  const isFinal  = !!is_final;

  let blocks: any[] = [];
  let textFallback = "";

  if (isNew) {
    const approverMention  = await approvalMentionInline(appKey, current_approver);
    const requesterMention = await approvalMentionInline(appKey, requester_name);
    const refMention       = reference_name ? await approvalMentionInline(appKey, reference_name) : null;
    textFallback = `📋 결재 승인 요청 — ${request_type}\n신청자: ${requester_name}\n승인권자: ${current_approver}`;
    blocks = [
      { type: "header", text: `📋 결재 승인 요청 — ${request_type}`, style: "yellow" },
      { type: "text", text: `신청자: @${requester_name}`, inlines: [{ type: "styled", text: "신청자: ", bold: false }, requesterMention] },
      ...(refMention ? [{ type: "text", text: `참조: @${reference_name}`, inlines: [{ type: "styled", text: "참조: ", bold: false }, refMention] }] : []),
      { type: "divider" },
      approvalBoldBlock(`■ ${request_type} 내용`),
      ...pLines.map(approvalTextBlock),
      { type: "divider" },
      { type: "text", text: `승인권자: @${current_approver}`, inlines: [{ type: "styled", text: "승인권자: ", bold: true }, { ...approverMention }] },
      { type: "divider" },
      { type: "button", text: "📄 결재요청서 확인하기", style: "default", action: { type: "open_inapp_browser", value: crmUrl } },
      approvalSubmitBtn("✅ 승인", `approval:${request_id}:approve`, "primary"),
      approvalSubmitBtn("❌ 반려", `approval:${request_id}:reject`,  "danger"),
    ];
  } else if (isApproved && !isFinal && current_approver) {
    const nextMention  = await approvalMentionInline(appKey, current_approver);
    const actorMention = await approvalMentionInline(appKey, actor);
    textFallback = `✅ 결재 순번 — ${request_type}\n${actor} 승인 완료 → 다음: ${current_approver}`;
    blocks = [
      { type: "header", text: `✅ 결재 순번 — ${request_type}`, style: "green" },
      { type: "text", text: `승인 완료: @${actor}`, inlines: [{ type: "styled", text: "승인 완료: ", bold: false }, actorMention] },
      approvalTextBlock(`신청자: ${requester_name}`),
      { type: "divider" },
      approvalBoldBlock(`■ ${request_type} 내용`),
      ...pLines.map(approvalTextBlock),
      { type: "divider" },
      { type: "text", text: `다음 승인권자: @${current_approver}`, inlines: [{ type: "styled", text: "다음 승인권자: ", bold: true }, nextMention] },
      { type: "divider" },
      { type: "button", text: "📄 결재요청서 확인하기", style: "default", action: { type: "open_inapp_browser", value: crmUrl } },
      approvalSubmitBtn("✅ 승인", `approval:${request_id}:approve`, "primary"),
      approvalSubmitBtn("❌ 반려", `approval:${request_id}:reject`,  "danger"),
    ];
  } else if (isApproved && isFinal) {
    const actorMention     = await approvalMentionInline(appKey, actor);
    const requesterMention = await approvalMentionInline(appKey, requester_name);
    const refMention2      = reference_name ? await approvalMentionInline(appKey, reference_name) : null;
    textFallback = `🎉 결재 최종 승인 완료 — ${request_type}\n신청자: ${requester_name}`;
    blocks = [
      { type: "header", text: `🎉 결재 최종 승인 완료 — ${request_type}`, style: "green" },
      { type: "text", text: `최종 승인: @${actor}`, inlines: [{ type: "styled", text: "최종 승인: ", bold: false }, actorMention] },
      { type: "text", text: `신청자: @${requester_name}`, inlines: [{ type: "styled", text: "신청자: ", bold: false }, requesterMention] },
      ...(refMention2 ? [{ type: "text", text: `참조: @${reference_name}`, inlines: [{ type: "styled", text: "참조: ", bold: false }, refMention2] }] : []),
      { type: "divider" },
      approvalBoldBlock(`■ 승인된 ${request_type} 내용`),
      ...pLines.map(approvalTextBlock),
      { type: "divider" },
      { type: "button", text: "📄 결재 내역 확인하기", style: "primary", action: { type: "open_inapp_browser", value: crmUrl } },
    ];
  } else if (isRejected) {
    const actorMention     = await approvalMentionInline(appKey, actor);
    const requesterMention = await approvalMentionInline(appKey, requester_name);
    textFallback = `❌ 결재 반려 — ${request_type}\n신청자: ${requester_name} / 반려자: ${actor}`;
    blocks = [
      { type: "header", text: `❌ 결재 반려 — ${request_type}`, style: "red" },
      { type: "text", text: `반려 처리: @${actor}`, inlines: [{ type: "styled", text: "반려 처리: ", bold: false }, actorMention] },
      { type: "text", text: `신청자: @${requester_name}`, inlines: [{ type: "styled", text: "신청자: ", bold: false }, requesterMention] },
      { type: "divider" },
      approvalBoldBlock(`■ 반려된 ${request_type} 내용`),
      ...pLines.map(approvalTextBlock),
      { type: "divider" },
      approvalTextBlock("결재가 반려되었습니다. CRM에서 내용을 수정 후 재요청하세요."),
      { type: "button", text: "📄 CRM에서 재요청하기", style: "default", action: { type: "open_inapp_browser", value: crmUrl } },
    ];
  }

  if (blocks.length === 0) return;

  await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ conversation_id: Number(conversationId), text: textFallback, blocks }),
  });
}


const EXEC_MEMBERS: Record<string, string> = {
  조계현: "메인",
  이세호: "어쏘",
  기여운: "어쏘",
  최연전: "CX",
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// MENTION_MAP (이름:이메일) 으로부터 이메일→이름 역방향 맵 생성
function getNameByEmail(email: string): string | null {
  const map = process.env.KAKAO_WORK_MENTION_MAP || "";
  for (const pair of map.split(",")) {
    const [n, e] = pair.split(":").map((s) => s.trim());
    if (e === email) return n;
  }
  return null;
}

// userId → 카카오워크 이메일 조회
async function getUserEmail(appKey: string, userId: number): Promise<string | null> {
  try {
    const res = await fetch(`${KAKAO_WORK_API_BASE}/users.info?user_id=${userId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${appKey}` },
      cache: "no-store",
    });
    const data = await res.json();
    return data?.user?.identifications?.find((i: any) => i.type === "email")?.value
      || data?.user?.work_email
      || data?.user?.email
      || null;
  } catch { return null; }
}

// userId → CRM 이름 (MENTION_MAP 기반 → 없으면 display_name 폴백)
async function getUserName(appKey: string, userId: number): Promise<string> {
  try {
    const res = await fetch(`${KAKAO_WORK_API_BASE}/users.info?user_id=${userId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${appKey}` },
      cache: "no-store",
    });
    const data = await res.json();
    // 이메일로 MENTION_MAP에서 CRM 이름 먼저 조회
    const email =
      data?.user?.identifications?.find((i: any) => i.type === "email")?.value
      || data?.user?.work_email
      || data?.user?.email
      || null;
    if (email) {
      const mapped = getNameByEmail(email);
      if (mapped) return mapped;
    }
    // 폴백: display_name
    return data?.user?.display_name || data?.user?.name || "알 수 없음";
  } catch {
    return "알 수 없음";
  }
}

async function sendResultMessage(appKey: string, conversationId: number, text: string) {
  try {
    await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ conversation_id: conversationId, text }),
    });
  } catch {}
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const body = await request.json();

    if (body?.type !== "submit_action") {
      return NextResponse.json({ ok: true });
    }

    const value = String(body?.value || "");
    const [domain, param1, action] = value.split(":");

    const supabase = getSupabase();
    const conversationId = body?.message?.conversation_id;
    const clickerName = body?.react_user_id && appKey
      ? await getUserName(appKey, Number(body.react_user_id))
      : "알 수 없음";

    // ===== 완판트럭 버튼 =====
    if (domain === "wanpan") {
      const truckId = Number(param1);
      if (!truckId || !action) return NextResponse.json({ ok: true });

      const { data: truck } = await supabase
        .from("wanpan_trucks")
        .select("id, site_name, assigned_to, is_ordered, is_direct_order, order_confirmed_by")
        .eq("id", truckId)
        .single();

      if (!truck) return NextResponse.json({ ok: true });

      let updatePayload: Record<string, any> = {};
      let actionLabel = "";

      if (action === "order") {
        updatePayload = { is_ordered: true };
        actionLabel = "발주 완료";
      } else if (action === "draft") {
        updatePayload = { is_direct_order: true };
        actionLabel = "시안 발주 완료";
      } else if (action === "confirm") {
        updatePayload = { order_confirmed_by: truck.assigned_to || "확인완료" };
        actionLabel = "담당자 확인 완료";
      } else {
        return NextResponse.json({ ok: true });
      }

      const { error } = await supabase.from("wanpan_trucks").update(updatePayload).eq("id", truckId);

      if (appKey && conversationId) {
        const text = error
          ? `⚠️ [${truck.site_name || "현장"}] ${actionLabel} 처리 실패`
          : `✅ [${truck.site_name || "현장"}] ${actionLabel} 처리됨 (처리자: ${clickerName})`;
        await sendResultMessage(appKey, Number(conversationId), text);
      }

      return NextResponse.json({ ok: true });
    }

    // ===== 일별활동 외근(미팅) 버튼 =====
    if (domain === "daily") {
      const memberName = param1;
      if (action !== "outside" || !memberName) return NextResponse.json({ ok: true });

      const title = EXEC_MEMBERS[memberName] || "";
      const today = todayKST();

      // 이미 등록된 기록이 있는지 확인
      const { data: existing } = await supabase
        .from("daily_activity_goals")
        .select("id")
        .eq("work_date", today)
        .eq("owner_name", memberName)
        .maybeSingle();

      let error: any = null;

      if (existing) {
        // 기존 기록이 있으면 외근으로 업데이트
        const res = await supabase
          .from("daily_activity_goals")
          .update({ is_outside_meeting: true })
          .eq("id", existing.id);
        error = res.error;
      } else {
        // 기록이 없으면 외근으로 신규 생성
        const res = await supabase.from("daily_activity_goals").insert({
          work_date: today,
          owner_name: memberName,
          owner_title: title,
          owner_role: "exec",
          is_outside_meeting: true,
          goal_consultant_db: 0,
          goal_second_touch: 0,
          goal_new_tm: 0,
          goal_manage_tm: 0,
          goal_coldtalk: 0,
          goal_media_mix: 0,
          goal_meeting_confirmed: 0,
          goal_work_items: [],
          result_consultant_db: 0,
          result_second_touch: 0,
          result_new_tm: 0,
          result_manage_tm: 0,
          result_coldtalk: 0,
          result_media_mix: 0,
          result_meeting_confirmed: 0,
        });
        error = res.error;
      }

      if (appKey && conversationId) {
        const text = error
          ? `⚠️ ${memberName} ${title} 외근(미팅) 처리 실패`
          : `📌 ${memberName} ${title} — 금일 외근(미팅)으로 처리되었습니다. (처리자: ${clickerName})`;
        await sendResultMessage(appKey, Number(conversationId), text);
      }

      return NextResponse.json({ ok: true });
    }

    // ===== 업무요청 접수/보류 버튼 =====
    if (domain === "task") {
      const taskId = Number(param1);
      const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

      if (!taskId || !action) return NextResponse.json({ ok: true });

      const newStatus = action === "accept" ? "접수" : action === "hold" ? "보류" : null;
      if (!newStatus) return NextResponse.json({ ok: true });

      // tasks 테이블 상태 업데이트
      const { data: taskData } = await supabase
        .from("tasks")
        .select("id,category,content,requester,assignee,kakao_message_id")
        .eq("id", taskId)
        .single();

      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      // task_comments에 상태변경 댓글 추가
      if (!error && taskData) {
        const contentLines = String((taskData as any).content || "").split("\n");
        const customerLine = contentLines.find((l: string) => l.includes("고객명:"));
        const customerName = customerLine ? customerLine.replace(/^.*고객명:\s*/, "").trim() : "";

        const commentText = customerName
          ? `수신자 ${clickerName}가\n고객명: ${customerName}\n${(taskData as any).category}을(를) ${newStatus}하였습니다.\n\n@${(taskData as any).requester || ""}`
          : `수신자 ${clickerName}가\n${(taskData as any).category}을(를) ${newStatus}하였습니다.\n\n@${(taskData as any).requester || ""}`;

        await supabase.from("task_comments").insert({
          task_id: taskId,
          author: "워크봇",
          content: commentText,
          comment_type: "상태변경",
        });

        // 카카오워크로 상태변경 알림 발송
        if (appKey) {
          try {
            await fetch(`${baseUrl}/api/kakaowork/send-task-status-notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({
                task_id: taskId,
                status: newStatus,
                assignee: clickerName,
                requester: (taskData as any).requester || "",
                category: (taskData as any).category || "",
                customer_name: customerName,
                kakao_message_id: (taskData as any).kakao_message_id || null,
              }),
            });
          } catch {}
        }
      }

      if (appKey && conversationId) {
        const statusEmoji = newStatus === "접수" ? "✅" : "⏸";
        const text = error
          ? `⚠️ 업무요청 ${newStatus} 처리 실패`
          : `${statusEmoji} 업무요청이 ${newStatus} 처리되었습니다. (처리자: ${clickerName})`;
        await sendResultMessage(appKey, Number(conversationId), text);
      }

      return NextResponse.json({ ok: true });
    }

    // ===== 결제요청 승인/반려 버튼 =====
    if (domain === "approval") {
      const requestId = Number(param1);
      const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

      if (!requestId || !action) return NextResponse.json({ ok: true });

      if (action !== "approve" && action !== "reject") return NextResponse.json({ ok: true });

      // 현재 approval_requests 조회
      const { data: reqData, error: reqErr } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (!reqData || reqErr) {
        if (appKey && conversationId) {
          await sendResultMessage(appKey, Number(conversationId), "⚠️ 결제요청 정보를 찾을 수 없습니다.");
        }
        return NextResponse.json({ ok: true });
      }

      const currentApprover = reqData.current_approver_name;
      if (clickerName !== currentApprover && currentApprover) {
        if (appKey && conversationId) {
          await sendResultMessage(appKey, Number(conversationId), `⚠️ 현재 승인권자(${currentApprover})만 처리할 수 있습니다.`);
        }
        return NextResponse.json({ ok: true });
      }

      // 다음 승인자 계산 (팀장 → 본부장 순)
      let nextApprover: string | null = null;
      if (action === "approve") {
        if (reqData.current_approver_name === reqData.team_lead_name && reqData.head_name) {
          nextApprover = reqData.head_name;
        }
      }
      const nextStatus = action === "reject" ? "반려" : nextApprover ? "진행중" : "완료";

      const { error: updateErr } = await supabase
        .from("approval_requests")
        .update({ status: nextStatus, current_approver_name: nextApprover })
        .eq("id", requestId);

      if (updateErr) {
        if (appKey && conversationId) {
          await sendResultMessage(appKey, Number(conversationId), `⚠️ 처리 실패: ${updateErr.message}`);
        }
        return NextResponse.json({ ok: true });
      }

      // approval_actions 기록
      await supabase.from("approval_actions").insert({
        approval_request_id: requestId,
        actor_name: clickerName,
        action: action === "approve" ? "승인" : "반려",
        comment: `카카오워크에서 ${clickerName}님이 ${action === "approve" ? "승인" : "반려"} 처리했습니다.`,
      });

      // 카카오워크 결과 메시지
      const actionLabel = action === "approve" ? "✅ 승인" : "❌ 반려";
      const statusLabel = nextStatus === "완료" ? "최종 승인 완료" : nextStatus === "반려" ? "반려" : `다음 결재자(${nextApprover}) 승인 대기`;
      if (appKey && conversationId) {
        await sendResultMessage(
          appKey,
          Number(conversationId),
          `${actionLabel} 처리 완료\n결제요청 #${requestId} · ${statusLabel}\n처리자: ${clickerName}`
        );
      }

      // 결재 다음 단계 알림 (인라인 — 외부 fetch 없음으로 타임아웃 방지)
      try {
        const convId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
        const bUrl   = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";
        if (appKey && convId) {
          await sendApprovalNotifyInline({
            appKey,
            conversationId: convId,
            crmUrl: `${bUrl}/tasks`,
            request_id: requestId,
            request_type: reqData.request_type,
            requester_name: reqData.requester_name,
            current_approver: nextApprover,
            reference_name: reqData.reference_name,
            action: action === "approve" ? "승인" : "반려",
            actor: clickerName,
            is_final: action === "approve" && !nextApprover,
            payload: reqData.payload || {},
          });
        }
      } catch {}

      return NextResponse.json({ ok: true });
    }


    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
