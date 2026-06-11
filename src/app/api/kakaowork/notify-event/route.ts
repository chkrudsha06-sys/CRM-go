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

function desc(term: string, value: string) {
  return {
    type: "description",
    term,
    content: { type: "text", text: value || "-" },
    accent: true,
  };
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
    const d = body?.data || {};
    const truckId = body?.truck_id;

    if (event !== "wanpan_truck_created") {
      return NextResponse.json(
        { ok: false, message: `알 수 없는 이벤트: ${event}` },
        { status: 400 }
      );
    }

    // 담당자 @멘션 준비
    const assignedName = d.assigned_to as string | null;
    let mentionUserId: number | null = null;
    if (assignedName) {
      const email = getMentionEmail(assignedName);
      if (email) mentionUserId = await findUserIdByEmail(appKey, email);
    }

    // ===== 블록킷 카드 구성 =====
    const blocks: any[] = [
      { type: "header", text: "🚚 완판트럭 신규 등록", style: "yellow" },
      {
        type: "text",
        text: `${d.site_name || "현장 미입력"}`,
        inlines: [{ type: "styled", text: `${d.site_name || "현장 미입력"}`, bold: true }],
      },
      desc("출동일", d.dispatch_date),
      desc("지역", d.location),
      desc("대행사", d.agency),
      desc(
        "컨택포인트",
        `${d.contact_point || "-"}${d.contact_point_title ? ` ${d.contact_point_title}` : ""}`
      ),
      desc("연락처", d.contact_phone),
      desc("조직규모", d.team_size ? `${d.team_size}명` : "-"),
      desc(
        "발주수량",
        d.order_qty_base
          ? `${d.order_qty_base}${d.order_qty_extra ? ` + ${d.order_qty_extra}` : ""}`
          : "-"
      ),
    ];

    if (d.notes) blocks.push(desc("비고", String(d.notes).slice(0, 400)));

    blocks.push({ type: "divider" });

    // 담당자 멘션 라인
    if (assignedName && mentionUserId) {
      blocks.push({
        type: "text",
        text: `👤 담당자 확인 요청 : @${assignedName}`,
        inlines: [
          { type: "styled", text: "👤 담당자 확인 요청 : ", bold: true },
          {
            type: "mention",
            text: `@${assignedName}`,
            ref: { type: "kw", value: mentionUserId },
          },
        ],
      });
    } else if (assignedName) {
      blocks.push({ type: "text", text: `👤 담당자 확인 요청 : ${assignedName}` });
    }

    // 처리 버튼 3개 (truckId가 있을 때만)
    if (truckId) {
      blocks.push({
        type: "action",
        elements: [
          {
            type: "button",
            text: "발주 완료",
            style: "primary",
            action: {
              type: "submit_action",
              name: "wanpan_action",
              value: `wanpan:${truckId}:order`,
            },
          },
          {
            type: "button",
            text: "시안 발주",
            style: "default",
            action: {
              type: "submit_action",
              name: "wanpan_action",
              value: `wanpan:${truckId}:draft`,
            },
          },
          {
            type: "button",
            text: "담당자 확인",
            style: "default",
            action: {
              type: "submit_action",
              name: "wanpan_action",
              value: `wanpan:${truckId}:confirm`,
            },
          },
        ],
      });
    }

    // CRM 바로가기 버튼
    blocks.push({
      type: "button",
      text: "CRM에서 보기",
      style: "default",
      action: {
        type: "open_system_browser",
        name: "open_crm",
        value: `${baseUrl}/wanpan-truck`,
      },
    });

    const pushText = `🚚 완판트럭 신규 등록 | ${d.site_name || "-"} (${d.dispatch_date || "-"})`;

    const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        conversation_id: Number(conversationId),
        text: pushText,
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
