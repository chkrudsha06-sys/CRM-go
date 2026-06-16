import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KW = "https://api.kakaowork.com/v1";
const DIV14 = "──────────────";
const DIV10 = "──────────────";

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
    const res = await fetch(`${KW}/users.find_by_email?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${appKey}` },
      cache: "no-store",
    });
    const data = await res.json();
    const id = Number(data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch { return null; }
}

async function getOrCreateDM(appKey: string, userId: number): Promise<number | null> {
  try {
    const res = await fetch(`${KW}/conversations.open`, {
      method: "POST",
      headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    const id = Number(data?.conversation?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch { return null; }
}

async function sendMessage(appKey: string, conversationId: number, blocks: any[]) {
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return fetch(`${KW}/messages.send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ conversation_id: conversationId, text, blocks }),
  });
}

async function mentionInline(appKey: string, name: string | null | undefined) {
  if (!name) return { type: "styled", text: `-`, bold: false };
  const email = getMentionEmail(name);
  if (email) {
    const uid = await findUserId(appKey, email);
    if (uid) return { type: "mention", text: `@${name}`, ref: { type: "kw", value: uid } };
  }
  return { type: "styled", text: `@${name}`, bold: true };
}

function textBlock(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: false }] };
}

function headerBlock(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: true }] };
}

function divBlock(type: "big" | "small" = "big") {
  const d = type === "big" ? DIV14 : DIV10;
  return { type: "text", text: d, inlines: [{ type: "styled", text: d, bold: false }] };
}

function actionButton(label: string, value: string, style: "default" | "primary" | "danger" = "default") {
  return {
    type: "button",
    text: label,
    style,
    value,
    action_type: "submit_action",
  };
}

// ── 페이로드에서 주요 항목 추출 ──
function extractPayloadLines(payload: Record<string, any>, requestType: string): string[] {
  const lines: string[] = [];
  const add = (label: string, value: any) => {
    if (value !== undefined && value !== null && value !== "" && value !== "-") {
      lines.push(`${label}: ${value}`);
    }
  };

  if (requestType.includes("결제요청")) {
    add("안건", payload.subject);
    add("결제금액", payload.totalAmount || payload.amount);
    add("결제처", payload.payeeName || payload.vendor);
    add("계좌번호", payload.accountNumber ? `${payload.bankName || ""} ${payload.accountNumber} (${payload.accountHolder || ""})` : undefined);
    add("결제사유", payload.reason);
    add("비고", payload.memo);
  } else if (requestType.includes("환불")) {
    add("안건", payload.subject);
    add("환불금액", payload.totalAmount || payload.amount);
    add("환불사유", payload.reason || payload.refundReason);
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

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

    if (!appKey) {
      return NextResponse.json({ ok: false, message: "APP_KEY 없음" }, { status: 400 });
    }

    const body = await request.json();
    const {
      request_id,
      request_type,
      requester_name,
      current_approver,   // 현재 승인이 필요한 사람
      reference_name,     // 참조자 (최웅)
      action,             // undefined = 신규 생성 | "승인" | "반려"
      actor,              // 승인/반려 처리한 사람
      is_final,           // 최종 승인 여부
      payload = {},
    } = body || {};

    const isNew      = !action;
    const isApproved = action === "승인";
    const isRejected = action === "반려";
    const isFinal    = !!is_final;

    const payloadLines = extractPayloadLines(payload, request_type || "");
    const crmUrl = `${baseUrl}/tasks`;

    // ────────────────────────────────────────
    // 케이스 A: 신규 결제요청 등록
    //   → 1차 승인권자(current_approver)에게 DM
    //   → 참조자(reference_name)에게 DM
    // ────────────────────────────────────────
    if (isNew && current_approver) {
      const approverMention = await mentionInline(appKey, current_approver);
      const requesterMention = await mentionInline(appKey, requester_name);

      const approverBlocks = [
        divBlock("big"),
        headerBlock(`📋 결재 승인 요청 — ${request_type}`),
        divBlock("small"),
        {
          type: "text",
          text: `신청자: @${requester_name}`,
          inlines: [
            { type: "styled", text: "신청자: ", bold: false },
            requesterMention,
          ],
        },
        textBlock(`유형: ${request_type}`),
        ...(payloadLines.length > 0 ? [divBlock("small"), ...payloadLines.map(textBlock)] : []),
        divBlock("small"),
        {
          type: "text",
          text: `승인권자: @${current_approver}`,
          inlines: [
            { type: "styled", text: "승인권자: ", bold: false },
            approverMention,
          ],
        },
        textBlock(`▶ CRM에서 확인: ${crmUrl}`),
        divBlock("big"),
      ];

      // 승인 / 반려 버튼
      const approverActions = {
        type: "button_group",
        elements: [
          actionButton("✅ 승인", `approval:${request_id}:approve`, "primary"),
          actionButton("❌ 반려", `approval:${request_id}:reject`, "danger"),
        ],
      };

      // 1차 승인권자에게 DM
      const approverEmail = getMentionEmail(current_approver);
      if (approverEmail) {
        const uid = await findUserId(appKey, approverEmail);
        if (uid) {
          const convId = await getOrCreateDM(appKey, uid);
          if (convId) {
            await sendMessage(appKey, convId, [...approverBlocks, approverActions]);
          }
        }
      }

      // 참조자에게 DM (버튼 없음)
      if (reference_name) {
        const refMention = await mentionInline(appKey, reference_name);
        const refBlocks = [
          divBlock("big"),
          headerBlock(`📎 결재 참조 알림 — ${request_type}`),
          divBlock("small"),
          {
            type: "text",
            text: `신청자: @${requester_name}`,
            inlines: [
              { type: "styled", text: "신청자: ", bold: false },
              requesterMention,
            ],
          },
          textBlock(`유형: ${request_type}`),
          ...(payloadLines.length > 0 ? [divBlock("small"), ...payloadLines.map(textBlock)] : []),
          divBlock("small"),
          textBlock(`현재 승인권자: ${current_approver}`),
          textBlock(`▶ CRM에서 확인: ${crmUrl}`),
          divBlock("big"),
        ];

        const refEmail = getMentionEmail(reference_name);
        if (refEmail) {
          const refUid = await findUserId(appKey, refEmail);
          if (refUid) {
            const refConvId = await getOrCreateDM(appKey, refUid);
            if (refConvId) await sendMessage(appKey, refConvId, refBlocks);
          }
        }
      }
    }

    // ────────────────────────────────────────
    // 케이스 B: 중간 승인 (다음 승인자에게 DM)
    // ────────────────────────────────────────
    if (isApproved && !isFinal && current_approver) {
      const nextMention = await mentionInline(appKey, current_approver);
      const actorMention = await mentionInline(appKey, actor);

      const nextBlocks = [
        divBlock("big"),
        headerBlock(`✅ 결재 순번 — ${request_type}`),
        divBlock("small"),
        {
          type: "text",
          text: `이전 승인: @${actor}`,
          inlines: [
            { type: "styled", text: "이전 승인: ", bold: false },
            actorMention,
          ],
        },
        textBlock(`신청자: ${requester_name}`),
        textBlock(`유형: ${request_type}`),
        ...(payloadLines.length > 0 ? [divBlock("small"), ...payloadLines.map(textBlock)] : []),
        divBlock("small"),
        {
          type: "text",
          text: `다음 승인권자: @${current_approver}`,
          inlines: [
            { type: "styled", text: "다음 승인권자: ", bold: false },
            nextMention,
          ],
        },
        textBlock(`▶ CRM에서 확인: ${crmUrl}`),
        divBlock("big"),
      ];

      const nextActions = {
        type: "button_group",
        elements: [
          actionButton("✅ 승인", `approval:${request_id}:approve`, "primary"),
          actionButton("❌ 반려", `approval:${request_id}:reject`, "danger"),
        ],
      };

      const nextEmail = getMentionEmail(current_approver);
      if (nextEmail) {
        const nextUid = await findUserId(appKey, nextEmail);
        if (nextUid) {
          const nextConvId = await getOrCreateDM(appKey, nextUid);
          if (nextConvId) await sendMessage(appKey, nextConvId, [...nextBlocks, nextActions]);
        }
      }
    }

    // ────────────────────────────────────────
    // 케이스 C: 최종 승인 (신청자 + 참조자에게 DM)
    // ────────────────────────────────────────
    if (isApproved && isFinal) {
      const actorMention = await mentionInline(appKey, actor);

      const finalBlocks = [
        divBlock("big"),
        headerBlock(`🎉 결재 최종 승인 완료 — ${request_type}`),
        divBlock("small"),
        {
          type: "text",
          text: `최종 승인: @${actor}`,
          inlines: [
            { type: "styled", text: "최종 승인: ", bold: false },
            actorMention,
          ],
        },
        textBlock(`신청자: ${requester_name}`),
        textBlock(`유형: ${request_type}`),
        ...(payloadLines.length > 0 ? [divBlock("small"), ...payloadLines.map(textBlock)] : []),
        divBlock("small"),
        textBlock(`▶ CRM에서 확인: ${crmUrl}`),
        divBlock("big"),
      ];

      for (const targetName of [requester_name, reference_name]) {
        if (!targetName) continue;
        const email = getMentionEmail(targetName);
        if (!email) continue;
        const uid = await findUserId(appKey, email);
        if (!uid) continue;
        const convId = await getOrCreateDM(appKey, uid);
        if (convId) await sendMessage(appKey, convId, finalBlocks);
      }
    }

    // ────────────────────────────────────────
    // 케이스 D: 반려 (신청자에게 DM)
    // ────────────────────────────────────────
    if (isRejected) {
      const actorMention = await mentionInline(appKey, actor);

      const rejectBlocks = [
        divBlock("big"),
        headerBlock(`❌ 결재 반려 — ${request_type}`),
        divBlock("small"),
        {
          type: "text",
          text: `반려 처리: @${actor}`,
          inlines: [
            { type: "styled", text: "반려 처리: ", bold: false },
            actorMention,
          ],
        },
        textBlock(`신청자: ${requester_name}`),
        textBlock(`유형: ${request_type}`),
        ...(payloadLines.length > 0 ? [divBlock("small"), ...payloadLines.map(textBlock)] : []),
        divBlock("small"),
        textBlock(`결재가 반려되었습니다. CRM에서 재요청하거나 수정 후 다시 제출하세요.`),
        textBlock(`▶ CRM에서 확인: ${crmUrl}`),
        divBlock("big"),
      ];

      const requesterEmail = getMentionEmail(requester_name);
      if (requesterEmail) {
        const uid = await findUserId(appKey, requesterEmail);
        if (uid) {
          const convId = await getOrCreateDM(appKey, uid);
          if (convId) await sendMessage(appKey, convId, rejectBlocks);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[send-approval-notify]", err?.message || err);
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
