/**
 * /api/kakaowork/send-approval-notify
 *
 * 결제요청 카카오워크 알림 (그룹방 발송)
 *   - conversationId: KAKAO_WORK_EVENT_CONVERSATION_ID (업무요청/일별활동과 동일한 방)
 *   - 버튼 action 구조: action: { type:"submit_action", value:"approval:{id}:approve|reject" }
 *     → callback route의 domain="approval" 핸들러와 연동
 *
 * 케이스 A: 신규 결제요청  → 승인/반려 버튼 포함
 * 케이스 B: 중간 승인      → 다음 승인권자 @멘션 + 승인/반려 버튼
 * 케이스 C: 최종 승인      → 완료 안내 (버튼 없음)
 * 케이스 D: 반려           → 반려 안내 (버튼 없음)
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KW = "https://api.kakaowork.com/v1";
const DIV = "──────────────"; // 대구분선 14개

// ── 멘션 이메일 맵 ──
function getMentionEmail(name: string | null | undefined): string | null {
  if (!name) return null;
  const map = process.env.KAKAO_WORK_MENTION_MAP || "";
  for (const pair of map.split(",")) {
    const [n, email] = pair.split(":").map((s) => s.trim());
    if (n === name && email) return email;
  }
  return null;
}

async function findUserId(appKey: string, email: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${KW}/users.find_by_email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers: { Authorization: `Bearer ${appKey}` }, cache: "no-store" },
    );
    const data = await res.json();
    const id = Number(data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch { return null; }
}

// ── 이름 → mention inline (없으면 styled) ──
async function mentionInline(appKey: string, name: string | null | undefined) {
  if (!name) return { type: "styled", text: "-", bold: false };
  const email = getMentionEmail(name);
  if (email) {
    const uid = await findUserId(appKey, email);
    if (uid) return { type: "mention", text: `@${name}`, ref: { type: "kw", value: uid } };
  }
  return { type: "styled", text: `@${name}`, bold: true };
}

// ── 블록 헬퍼 ──
function divBlock() {
  return { type: "text", text: DIV, inlines: [{ type: "styled", text: DIV, bold: false }] };
}
function textBlock(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: false }] };
}
function boldBlock(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: true }] };
}
// 올바른 submit_action 버튼 구조 (callback의 body.value 와 매칭)
function submitButton(label: string, value: string, style: "default" | "primary" | "danger" = "default") {
  return {
    type: "button",
    text: label,
    style,
    action: {
      type: "submit_action",
      name: "approval_action",
      value,
    },
  };
}

// ── payload → 표시 항목 추출 ──
function payloadLines(payload: Record<string, any>, requestType: string): string[] {
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

// ── 그룹방 메시지 발송 ──
async function sendToRoom(
  appKey: string,
  conversationId: string,
  text: string,
  blocks: any[],
) {
  const res = await fetch(`${KW}/messages.send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ conversation_id: Number(conversationId), text, blocks }),
  });
  const raw = await res.text();
  let result: any = null;
  try { result = raw ? JSON.parse(raw) : null; } catch { result = { raw }; }
  return { ok: res.ok && result?.success !== false, result };
}

// ══════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const appKey        = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID; // ★ 기존 그룹방
    const baseUrl       = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

    if (!appKey || !conversationId) {
      return NextResponse.json({ ok: false, message: "APP_KEY 또는 CONVERSATION_ID 환경변수 없음" }, { status: 400 });
    }

    const body = await request.json();
    const {
      request_id,
      request_type   = "결제요청",
      requester_name,
      current_approver,   // 현재 승인이 필요한 사람 (신규·중간)
      reference_name,
      action,             // undefined=신규 | "승인" | "반려"
      actor,              // 승인/반려를 처리한 사람
      is_final = false,
      payload  = {},
    } = body || {};

    const pLines  = payloadLines(payload as Record<string, any>, request_type);
    const crmUrl  = `${baseUrl}/tasks`;
    const isNew   = !action;
    const isApproved = action === "승인";
    const isRejected = action === "반려";
    const isFinal = !!is_final;

    let blocks: any[] = [];
    let textFallback = "";

    // ─────────────────────────────────────────
    // 케이스 A: 신규 결제요청 등록
    //   → 그룹방에 내용 + 승인권자 @멘션 + 승인/반려 버튼
    // ─────────────────────────────────────────
    if (isNew) {
      const approverMention = await mentionInline(appKey, current_approver);
      const requesterMention = await mentionInline(appKey, requester_name);
      const refMention = reference_name ? await mentionInline(appKey, reference_name) : null;

      textFallback = `📋 결재 승인 요청 — ${request_type}\n신청자: ${requester_name}\n승인권자: ${current_approver}`;

      blocks = [
        { type: "header", text: `📋 결재 승인 요청 — ${request_type}`, style: "yellow" },

        // 신청자 행
        {
          type: "text",
          text: `신청자: @${requester_name}`,
          inlines: [
            { type: "styled", text: "신청자: ", bold: false },
            requesterMention,
          ],
        },

        // 참조자 행
        ...(refMention ? [{
          type: "text",
          text: `참조: @${reference_name}`,
          inlines: [
            { type: "styled", text: "참조: ", bold: false },
            refMention,
          ],
        }] : []),

        { type: "divider" },

        // 결재 내용
        boldBlock(`■ ${request_type} 내용`),
        ...pLines.map(textBlock),

        { type: "divider" },

        // 현재 승인권자
        {
          type: "text",
          text: `승인권자: @${current_approver}`,
          inlines: [
            { type: "styled", text: "승인권자: ", bold: true },
            { ...approverMention },
          ],
        },

        { type: "divider" },

        // CRM 바로가기 버튼
        {
          type: "button",
          text: "📄 결재요청서 확인하기",
          style: "default",
          action: { type: "open_inapp_browser", value: crmUrl },
        },

        // ★ 승인/반려 버튼 (올바른 submit_action 구조)
        submitButton("✅ 승인", `approval:${request_id}:approve`, "primary"),
        submitButton("❌ 반려", `approval:${request_id}:reject`,  "danger"),
      ];
    }

    // ─────────────────────────────────────────
    // 케이스 B: 중간 승인 → 다음 승인권자에게
    // ─────────────────────────────────────────
    if (isApproved && !isFinal && current_approver) {
      const nextMention  = await mentionInline(appKey, current_approver);
      const actorMention = await mentionInline(appKey, actor);

      textFallback = `✅ 결재 순번 — ${request_type}\n${actor} 승인 완료 → 다음: ${current_approver}`;

      blocks = [
        { type: "header", text: `✅ 결재 순번 — ${request_type}`, style: "green" },

        {
          type: "text",
          text: `승인 완료: @${actor}`,
          inlines: [
            { type: "styled", text: "승인 완료: ", bold: false },
            actorMention,
          ],
        },
        textBlock(`신청자: ${requester_name}`),

        { type: "divider" },

        boldBlock(`■ ${request_type} 내용`),
        ...pLines.map(textBlock),

        { type: "divider" },

        {
          type: "text",
          text: `다음 승인권자: @${current_approver}`,
          inlines: [
            { type: "styled", text: "다음 승인권자: ", bold: true },
            nextMention,
          ],
        },

        { type: "divider" },

        {
          type: "button",
          text: "📄 결재요청서 확인하기",
          style: "default",
          action: { type: "open_inapp_browser", value: crmUrl },
        },
        submitButton("✅ 승인", `approval:${request_id}:approve`, "primary"),
        submitButton("❌ 반려", `approval:${request_id}:reject`,  "danger"),
      ];
    }

    // ─────────────────────────────────────────
    // 케이스 C: 최종 승인 완료
    // ─────────────────────────────────────────
    if (isApproved && isFinal) {
      const actorMention      = await mentionInline(appKey, actor);
      const requesterMention  = await mentionInline(appKey, requester_name);
      const refMention2       = reference_name ? await mentionInline(appKey, reference_name) : null;

      textFallback = `🎉 결재 최종 승인 완료 — ${request_type}\n신청자: ${requester_name}`;

      blocks = [
        { type: "header", text: `🎉 결재 최종 승인 완료 — ${request_type}`, style: "green" },

        {
          type: "text",
          text: `최종 승인: @${actor}`,
          inlines: [
            { type: "styled", text: "최종 승인: ", bold: false },
            actorMention,
          ],
        },
        {
          type: "text",
          text: `신청자: @${requester_name}`,
          inlines: [
            { type: "styled", text: "신청자: ", bold: false },
            requesterMention,
          ],
        },
        ...(refMention2 ? [{
          type: "text",
          text: `참조: @${reference_name}`,
          inlines: [
            { type: "styled", text: "참조: ", bold: false },
            refMention2,
          ],
        }] : []),

        { type: "divider" },

        boldBlock(`■ 승인된 ${request_type} 내용`),
        ...pLines.map(textBlock),

        { type: "divider" },

        {
          type: "button",
          text: "📄 결재 내역 확인하기",
          style: "primary",
          action: { type: "open_inapp_browser", value: crmUrl },
        },
      ];
    }

    // ─────────────────────────────────────────
    // 케이스 D: 반려
    // ─────────────────────────────────────────
    if (isRejected) {
      const actorMention      = await mentionInline(appKey, actor);
      const requesterMention  = await mentionInline(appKey, requester_name);

      textFallback = `❌ 결재 반려 — ${request_type}\n신청자: ${requester_name} / 반려자: ${actor}`;

      blocks = [
        { type: "header", text: `❌ 결재 반려 — ${request_type}`, style: "red" },

        {
          type: "text",
          text: `반려 처리: @${actor}`,
          inlines: [
            { type: "styled", text: "반려 처리: ", bold: false },
            actorMention,
          ],
        },
        {
          type: "text",
          text: `신청자: @${requester_name}`,
          inlines: [
            { type: "styled", text: "신청자: ", bold: false },
            requesterMention,
          ],
        },

        { type: "divider" },

        boldBlock(`■ 반려된 ${request_type} 내용`),
        ...pLines.map(textBlock),

        { type: "divider" },

        textBlock("결재가 반려되었습니다. CRM에서 내용을 수정 후 재요청하세요."),

        {
          type: "button",
          text: "📄 CRM에서 재요청하기",
          style: "default",
          action: { type: "open_inapp_browser", value: crmUrl },
        },
      ];
    }

    if (blocks.length === 0) {
      return NextResponse.json({ ok: false, message: "해당하는 케이스 없음" }, { status: 400 });
    }

    const { ok, result } = await sendToRoom(appKey, conversationId, textFallback, blocks);

    if (!ok) {
      // fallback: 텍스트만 재전송
      await sendToRoom(appKey, conversationId, textFallback, []);
    }

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("[send-approval-notify]", err?.message || err);
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
