import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

    if (!appKey || !conversationId) {
      return NextResponse.json({ ok: false, message: "환경변수 없음" }, { status: 400 });
    }

    const body = await request.json();
    const { task_id, status, assignee, requester, category, customer_name } = body || {};

    // 상태 이모지
    const statusEmoji = status === "접수" ? "✅" : status === "보류" ? "⏸" : "📋";

    // 요청자 멘션
    let requesterInline: any = { type: "styled", text: `@${requester || "-"}` };
    const requesterEmail = getMentionEmail(requester);
    if (requesterEmail) {
      const uid = await findUserIdByEmail(appKey, requesterEmail);
      if (uid) {
        requesterInline = {
          type: "mention",
          text: `@${requester}`,
          ref: { type: "kw", value: uid },
        };
      }
    }

    // 메시지 텍스트
    const textFallback = [
      `${statusEmoji} 업무요청 ${status} 알림`,
      `──────────────`,
      `수신자 ${assignee}가`,
      customer_name ? `고객명: ${customer_name}` : "",
      `${category} 을(를) ${status}하였습니다.`,
      ``,
      `@${requester}`,
      `──────────────`,
      `🔗 ${baseUrl}/tasks`,
    ].filter(Boolean).join("\n");

    // Block Kit
    const customerLine = customer_name ? `고객명: ${customer_name}\n` : "";
    const blocks: any[] = [
      { type: "header", text: `${statusEmoji} 업무요청 ${status} 알림`, style: status === "접수" ? "blue" : "yellow" },
      {
        type: "text",
        text: `수신자 ${assignee}가\n${customerLine}${category} 을(를) ${status}하였습니다.`,
      },
      { type: "divider" },
      {
        type: "text",
        text: `@${requester}`,
        inlines: [requesterInline],
      },
      { type: "divider" },
      {
        type: "button",
        text: "업무요청 확인하기",
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
      return NextResponse.json({ ok: false, detail: result }, { status: 500 });
    }

    // ── task_comments에도 댓글 추가 ──
    if (task_id) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const commentContent = customer_name
        ? `수신자 ${assignee}가\n고객명: ${customer_name}\n${category}을(를) ${status}하였습니다.\n\n@${requester}`
        : `수신자 ${assignee}가\n${category}을(를) ${status}하였습니다.\n\n@${requester}`;
      await supabase.from("task_comments").insert({
        task_id: Number(task_id),
        author: "워크봇",
        content: commentContent,
        comment_type: "상태변경",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message }, { status: 500 });
  }
}
