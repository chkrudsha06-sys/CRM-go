import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

function formatWon(value: unknown): string {
  return Number(value || 0).toLocaleString("ko-KR") + "원";
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_SALES_CONVERSATION_ID;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go.vercel.app";

    if (!appKey || !conversationId) {
      return NextResponse.json(
        { ok: false, message: "APP_KEY 또는 CONVERSATION_ID 환경변수가 없습니다." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      member_name, execution_amount, vat_amount, refund_amount,
      channel, contract_route, payment_date, team_member, consultant, memo,
    } = body || {};

    const supply = Number(execution_amount || 0);
    const vat = Number(vat_amount || 0);
    const refund = Number(refund_amount || 0);
    const total = supply + vat - refund;

    const lines = [
      "💰 신규 매출 등록",
      "──────────────",
      `▪ 고객명 : ${member_name || "-"}`,
      `▪ 결제일 : ${payment_date || "-"}`,
      `▪ 채널 : ${channel || "-"}`,
      `▪ 계약경로 : ${contract_route || "-"}`,
      "──────────",
      `▪ 공급가 : ${formatWon(supply)}`,
      `▪ 부가세 : ${formatWon(vat)}`,
      refund ? `▪ 환불 : ${formatWon(refund)}` : null,
      `▪ 합계 : ${formatWon(total)}`,
      "──────────",
      `▪ 담당자 : ${team_member || "-"}`,
      `▪ 컨설턴트 : ${consultant || "-"}`,
      memo ? `▪ 메모 : ${memo}` : null,
      "──────────────",
      `🔗 CRM 바로가기 : ${baseUrl}/sales`,
    ].filter(Boolean);

    const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        conversation_id: Number(conversationId),
        text: lines.join("\n"),
      }),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok || data?.success === false) {
      return NextResponse.json(
        { ok: false, message: "카카오워크 발송 실패", detail: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "매출방 게시 완료" });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
