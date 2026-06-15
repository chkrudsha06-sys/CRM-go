import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

function getMentionEmail(name: string | null | undefined): string | null {
  if (!name) return null;
  const map = process.env.KAKAO_WORK_MENTION_MAP || "";
  for (const pair of map.split(",")) {
    const [n, email] = pair.split(":").map((s) => s.trim());
    if (n === name && email) return email;
  }
  return null;
}

async function findUserIdByEmail(appKey: string, email: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${KAKAO_WORK_API_BASE}/users.find_by_email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers: { Authorization: `Bearer ${appKey}` }, cache: "no-store" }
    );
    const data = await res.json();
    const id = Number(data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function sectionHeader(text: string) {
  return {
    type: "text",
    text,
    inlines: [{ type: "styled", text, bold: true }],
  };
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

    if (!appKey || !conversationId) {
      return NextResponse.json(
        { ok: false, message: "APP_KEY 또는 CONVERSATION_ID 환경변수가 없습니다." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { requester, assignee, category, content, priority, task_id } = body || {};

    const priorityEmoji: Record<string, string> = {
      "긴급": "🔴", "높음": "🟠", "보통": "🟡", "낮음": "🟢",
    };
    const prioIcon = priorityEmoji[priority] || "🟡";

    // ── 수신자 멘션 처리 ──
    let assigneeInline: any = { type: "styled", text: `@${assignee || "-"}` };
    const assigneeEmail = getMentionEmail(assignee);
    if (assigneeEmail) {
      const userId = await findUserIdByEmail(appKey, assigneeEmail);
      if (userId) {
        assigneeInline = {
          type: "mention",
          text: `@${assignee}`,
          ref: { type: "kw", value: userId },
        };
      }
    }

    // ── 업무 내용 줄 정리 ──
    const contentText = String(content || "")
      .split("\n")
      .slice(0, 25)
      .join("\n");

    // ── 텍스트 fallback ──
    const textFallback = [
      `📋 업무요청 알림`,
      `▪ 요청자 : ${requester || "-"}`,
      `▪ 수신자 : @${assignee || "-"}`,
      `▪ 우선순위 : ${prioIcon} ${priority || "보통"}`,
      `■ 업무요청 : ${category || "-"}`,
      contentText,
      `🔗 ${baseUrl}/tasks`,
    ].join("\n");

    // ── Block Kit ──
    const blocks: any[] = [
      // 헤더
      { type: "header", text: "📋 업무요청 알림", style: "blue" },

      // 요청자 / 수신자 / 우선순위
      {
        type: "text",
        text: `요청자 : ${requester || "-"}`,
      },
      {
        type: "text",
        text: `수신자 : @${assignee || "-"}`,
        inlines: [
          { type: "styled", text: "수신자 : " },
          assigneeInline,
        ],
      },
      {
        type: "text",
        text: `우선순위 : ${prioIcon} ${priority || "보통"}`,
      },

      { type: "divider" },

      // 카테고리
      sectionHeader(`■ 업무요청 : ${category || "-"}`),

      { type: "divider" },

      // 업무 내용
      {
        type: "text",
        text: contentText,
      },

      { type: "divider" },

      // CRM 바로가기 버튼
      {
        type: "button",
        text: "CRM 업무요청 바로가기",
        style: "default",
        action: {
          type: "open_inapp_browser",
          value: `${baseUrl}/tasks`,
        },
      },
    ];

    // ── 접수/보류 버튼 추가 (task_id가 있을 때만) ──
    if (task_id) {
      blocks.push({
        type: "button",
        text: "✅ 접수",
        style: "primary",
        action: {
          type: "submit_action",
          value: `task:${task_id}:accept`,
        },
      });
      blocks.push({
        type: "button",
        text: "⏸ 보류",
        style: "danger",
        action: {
          type: "submit_action",
          value: `task:${task_id}:hold`,
        },
      });
    }

    const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        conversation_id: Number(conversationId),
        text: textFallback,
        blocks,
      }),
    });

    const raw = await res.text();
    let result: any = null;
    try { result = raw ? JSON.parse(raw) : null; } catch { result = { raw }; }

    if (!res.ok || result?.success === false) {
      return NextResponse.json(
        { ok: false, message: "카카오워크 발송 실패", detail: result },
        { status: 500 }
      );
    }

    // 카카오워크가 반환하는 message id 추출
    const messageId = result?.message?.id || result?.id || null;
    return NextResponse.json({ ok: true, message: "업무요청 알림 발송 완료", kakao_message_id: messageId });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "서버 오류" },
      { status: 500 }
    );
  }
}
