import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

// 이름 → 카카오워크 이메일 매핑 (환경변수 KAKAO_WORK_MENTION_MAP)
// 형식 예시: 김재영:kim@company.com,최은정:choi@company.com
function getMentionEmail(name: string | null | undefined): string | null {
  if (!name) return null;
  const map = process.env.KAKAO_WORK_MENTION_MAP || "";
  for (const pair of map.split(",")) {
    const [n, email] = pair.split(":").map((s) => s.trim());
    if (n === name && email) return email;
  }
  return null;
}

// 이메일 → 카카오워크 user_id 조회
async function findUserIdByEmail(appKey: string, email: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${KAKAO_WORK_API_BASE}/users.find_by_email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${appKey}` },
        cache: "no-store",
      }
    );
    const data = await res.json();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function buildWanpanTruckText(d: Record<string, any>, baseUrl: string): string {
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

    if (event !== "wanpan_truck_created") {
      return NextResponse.json(
        { ok: false, message: `알 수 없는 이벤트: ${event}` },
        { status: 400 }
      );
    }

    const text = buildWanpanTruckText(data, baseUrl);

    // 담당자 @멘션 준비
    const assignedName = data.assigned_to as string | null;
    let mentionUserId: number | null = null;
    if (assignedName) {
      const email = getMentionEmail(assignedName);
      if (email) {
        mentionUserId = await findUserIdByEmail(appKey, email);
      }
    }

    // 메시지 블록 구성
    const blocks: any[] = [{ type: "text", text }];

    if (assignedName && mentionUserId) {
      // 진짜 @멘션 블록 추가 (멘션 알림 발생)
      blocks.push({
        type: "text",
        text: `👤 담당자 확인 요청 : @${assignedName}`,
        inlines: [
          { type: "styled", text: "👤 담당자 확인 요청 : " },
          {
            type: "mention",
            text: `@${assignedName}`,
            ref: { type: "kw", value: mentionUserId },
          },
        ],
      });
    } else if (assignedName) {
      // user_id를 못 찾으면 일반 텍스트로 표시
      blocks.push({ type: "text", text: `👤 담당자 확인 요청 : ${assignedName}` });
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
        text, // 알림(푸시)용 텍스트
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

    if (!res.ok || result?.success === false) {
      return NextResponse.json(
        { ok: false, message: "카카오워크 발송 실패", detail: result },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, mentioned: !!mentionUserId });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
