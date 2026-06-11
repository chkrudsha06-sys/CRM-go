import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function desc(term: string, value: string) {
  return {
    type: "description",
    term,
    content: { type: "text", text: value || "-" },
    accent: true,
  };
}

export async function GET() {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

    if (!appKey || !conversationId) {
      return NextResponse.json({
        ok: false,
        message: "APP_KEY 또는 EVENT_CONVERSATION_ID 환경변수가 없습니다.",
      });
    }

    const blocks: any[] = [
      { type: "header", text: "🚚 완판트럭 신규 등록 (테스트)", style: "yellow" },
      {
        type: "text",
        text: "테스트 현장",
        inlines: [{ type: "styled", text: "테스트 현장", bold: true }],
      },
      desc("출동일", "2026-06-19"),
      desc("지역", "광주"),
      { type: "divider" },
      {
        type: "action",
        elements: [
          {
            type: "button",
            text: "발주 완료",
            style: "primary",
            action: { type: "submit_action", name: "wanpan_action", value: "wanpan:0:order" },
          },
          {
            type: "button",
            text: "시안 발주",
            style: "default",
            action: { type: "submit_action", name: "wanpan_action", value: "wanpan:0:draft" },
          },
          {
            type: "button",
            text: "담당자 확인",
            style: "default",
            action: { type: "submit_action", name: "wanpan_action", value: "wanpan:0:confirm" },
          },
        ],
      },
      {
        type: "button",
        text: "CRM에서 보기",
        style: "default",
        action: {
          type: "open_system_browser",
          name: "open_crm",
          value: `${baseUrl}/wanpan-truck`,
        },
      },
    ];

    const res = await fetch("https://api.kakaowork.com/v1/messages.send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        conversation_id: Number(conversationId),
        text: "🚚 완판트럭 카드 테스트",
        blocks,
      }),
    });

    const raw = await res.text();
    let result: any = null;
    try {
      result = raw ? JSON.parse(raw) : null;
    } catch {
      result = { raw };
    }

    return NextResponse.json({
      ok: res.ok && result?.success !== false,
      httpStatus: res.status,
      detail: result,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || "알 수 없는 오류" });
  }
}
