import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

function buildWanpanTruckMessage(d: Record<string, any>, baseUrl: string): string {
  const lines = [
    "🚚 완판트럭 신규 등록",
    "──────────────",
    `▪ 출동일 : ${d.dispatch_date || "-"}`,
    `▪ 현장명 : ${d.site_name || "-"}`,
    `▪ 지역 : ${d.location || "-"}`,
    `▪ 대행사 : ${d.agency || "-"}`,
    "──────────",
    `▪ 컨택포인트 : ${d.contact_point || "-"}${d.contact_point_title ? ` ${d.contact_point_title}` : ""}`,
    `▪ 연락처 : ${d.contact_phone || "-"}`,
    `▪ 조직규모 : ${d.team_size ? d.team_size + "명" : "-"}`,
    "──────────",
    `▪ 발주여부 : ${d.is_ordered ? "발주 완료" : "미발주"}`,
    d.order_qty_base ? `▪ 기본수량 : ${d.order_qty_base}` : null,
    d.order_qty_extra ? `▪ 추가수량 : ${d.order_qty_extra}` : null,
    `▪ 담당자 : ${d.assigned_to || "-"}`,
    d.notes ? `▪ 비고 : ${d.notes}` : null,
    "──────────────",
    `🔗 CRM 바로가기 : ${baseUrl}/wanpan-truck`,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

    if (!appKey || !conversationId) {
      return NextResponse.json(
        { ok: false, message: "APP_KEY 또는 EVENT_CONVERSATION_ID 환경변수가 없습니다." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const event = body?.event;
    const data = body?.data || {};

    let text = "";
    if (event === "wanpan_truck_created") {
      text = buildWanpanTruckMessage(data, baseUrl);
    } else {
      return NextResponse.json(
        { ok: false, message: `알 수 없는 이벤트: ${event}` },
        { status: 400 }
      );
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
        text,
      }),
    });

    const raw = await res.text();
    let result: any = null;
    try {
      result = raw ? JSON.parse(raw) : null;
    } catch {
      result = { raw };
    }

    if (!res.ok || result?.success === false) {
      return NextResponse.json(
        { ok: false, message: "카카오워크 발송 실패", detail: result },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
