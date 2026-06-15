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
    const {
      requester,    // 요청자 이름
      assignee,     // 수신자 이름
      category,     // 업무 카테고리
      content,      // 업무 내용 (buildContent 결과)
      priority,     // 우선순위
    } = body || {};

    // ── 수신자 멘션 처리 ──
    let assigneeMentionBlock: any = null;
    const assigneeEmail = getMentionEmail(assignee);
    if (appKey && assigneeEmail) {
      const userId = await findUserIdByEmail(appKey, assigneeEmail);
      if (userId) {
        assigneeMentionBlock = {
          type: "text",
          text: `@${assignee}`,
          inlines: [{ type: "mention", user_id: userId }],
        };
      }
    }

    // ── 우선순위 이모지 ──
    const priorityEmoji: Record<string, string> = {
      "긴급": "🔴",
      "높음": "🟠",
      "보통": "🟡",
      "낮음": "🟢",
    };
    const prioIcon = priorityEmoji[priority] || "🟡";

    // ── 메시지 본문 구성 ──
    const divider = "──────────────";
    const shortDivider = "──────────";

    // 업무 내용을 줄별로 분리 (최대 20줄)
    const contentLines = String(content || "")
      .split("\n")
      .slice(0, 20)
      .map((line) => line.trim())
      .filter(Boolean);

    const textLines = [
      `📋 업무요청 알림`,
      divider,
      `▪ 요청자 : ${requester || "-"}`,
      `▪ 수신자 : @${assignee || "-"}`,
      `▪ 우선순위 : ${prioIcon} ${priority || "보통"}`,
      shortDivider,
      `■ 업무요청 : ${category || "-"}`,
      shortDivider,
      ...contentLines,
      divider,
      `🔗 CRM 바로가기 : ${baseUrl}/tasks`,
    ];

    const textFallback = textLines.join("\n");

    // ── Block Kit 구성 ──
    const blocks: any[] = [
      {
        type: "text",
        text: "📋 업무요청 알림",
        inlines: [{ type: "styled", text: "📋 업무요청 알림", bold: true }],
      },
      { type: "divider" },
      {
        type: "description",
        term: "요청자",
        content: { type: "text", text: requester || "-" },
        accent: true,
      },
      // 수신자 멘션
      assigneeMentionBlock
        ? {
            type: "description",
            term: "수신자",
            content: assigneeMentionBlock,
            accent: true,
          }
        : {
            type: "description",
            term: "수신자",
            content: { type: "text", text: `@${assignee || "-"}` },
            accent: true,
          },
      {
        type: "description",
        term: "우선순위",
        content: { type: "text", text: `${prioIcon} ${priority || "보통"}` },
        accent: false,
      },
      { type: "divider" },
      {
        type: "text",
        text: `■ 업무요청 : ${category || "-"}`,
        inlines: [{ type: "styled", text: `■ 업무요청 : ${category || "-"}`, bold: true }],
      },
      { type: "divider" },
      // 업무 내용 (텍스트 블록으로)
      {
        type: "text",
        text: contentLines.join("\n"),
      },
      { type: "divider" },
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

    return NextResponse.json({ ok: true, message: "업무요청 알림 발송 완료" });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "서버 오류" },
      { status: 500 }
    );
  }
}
