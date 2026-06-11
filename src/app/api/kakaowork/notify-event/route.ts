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

function parseMembers(value: any): string[] {
  if (!value) return [];
  try {
    if (typeof value === "string") {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    }
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function desc(term: string, value: string) {
  return { type: "description", term, content: { type: "text", text: value || "-" }, accent: true };
}

function sectionHeader(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: true }] };
}

async function sendMessage(appKey: string, conversationId: string, text: string, blocks?: any[]) {
  const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ conversation_id: Number(conversationId), text, ...(blocks ? { blocks } : {}) }),
  });
  const raw = await res.text();
  let result: any = null;
  try { result = raw ? JSON.parse(raw) : null; } catch { result = { raw }; }
  return { ok: res.ok && result?.success !== false, result };
}

// ===== 완판트럭 블록 =====
function buildWanpanBlocks(d: Record<string, any>, truckId: any, baseUrl: string): any[] {
  const staff = parseMembers(d.staff_members);
  const consultants = parseMembers(d.consultant_members);

  return [
    { type: "header", text: "🚚 완판트럭 신규 등록", style: "yellow" },
    sectionHeader("■ 현장정보"),
    desc("발송일", d.dispatch_date || "-"),
    desc("현장명", d.site_name || "-"),
    desc("현장주소", d.location || "-"),
    { type: "divider" },
    sectionHeader("■ 소통자정보"),
    desc("소통자", d.contact_point || "-"),
    desc("직급", d.contact_point_title || "-"),
    desc("연락처", d.contact_phone || "-"),
    { type: "divider" },
    sectionHeader("■ BX요청사항"),
    desc("촬영여부", d.has_photo ? "촬영" : "미촬영"),
    { type: "divider" },
    sectionHeader("■ 발주수량"),
    desc("수량", `기본 ${d.order_qty_base || 0} + 추가 ${d.order_qty_extra || 0}`),
    { type: "divider" },
    sectionHeader("■ 참석자"),
    desc("대협팀", staff.length > 0 ? staff.join(", ") : "-"),
    desc("컨설턴트", consultants.length > 0 ? consultants.join(", ") : "-"),
    { type: "divider" },
  ];
}

// ===== 일별활동목표 블록 =====
function buildDailyActivityBlocks(d: Record<string, any>, baseUrl: string): any[] {
  const workItems = Array.isArray(d.work_items) ? d.work_items : [];
  const hasWorkItems = workItems.some((item: any) => item?.text?.trim());

  const blocks: any[] = [
    { type: "header", text: "📋 일별활동목표 등록", style: "blue" },
    sectionHeader(`■ ${d.owner_name || "-"} ${d.owner_title || ""}`),
    desc("날짜", d.work_date || "-"),
    { type: "divider" },
  ];

  if (d.is_outside_meeting) {
    blocks.push({ type: "text", text: "📌 외근/미팅일 (활동목표 없음)" });
  } else {
    blocks.push(sectionHeader("■ 활동목표"));
    blocks.push(desc("당일 TM", `${d.goal_new_tm || 0}건`));
    blocks.push(desc("당일 콜드톡", `${d.goal_coldtalk || 0}건`));
    blocks.push(desc("브론즈 DB", `${d.goal_consultant_db || 0}개`));
    blocks.push(desc("1% DB", `${d.goal_second_touch || 0}개`));

    if (hasWorkItems) {
      blocks.push({ type: "divider" });
      blocks.push(sectionHeader("■ 특발성활동목표"));
      const itemTexts = workItems
        .filter((item: any) => item?.text?.trim())
        .map((item: any, i: number) => `${i + 1}. ${item.text}`)
        .join("\n");
      blocks.push({ type: "text", text: itemTexts });
    }
  }

  blocks.push({
    type: "button", text: "CRM에서 보기", style: "default",
    action: { type: "open_system_browser", name: "open_crm", value: `${baseUrl}/daily-activity` },
  });

  return blocks;
}

// ===== 공통 폴백 텍스트 =====
function buildFallbackText(event: string, d: Record<string, any>, baseUrl: string): string {
  if (event === "wanpan_truck_created") {
    const staff = parseMembers(d.staff_members);
    const consultants = parseMembers(d.consultant_members);
    const assignedLabel = d.assigned_to === "모두" ? "김재영, 최은정" : d.assigned_to;
    return [
      "🚚 완판트럭 신규 등록", "──────────────",
      `▪ 발송일 : ${d.dispatch_date || "-"}`, `▪ 현장명 : ${d.site_name || "-"}`,
      `▪ 현장주소 : ${d.location || "-"}`, `▪ 대행사 : ${d.agency || "-"}`,
      "──────────",
      `▪ 접점 : ${d.contact_point || "-"}${d.contact_point_title ? ` ${d.contact_point_title}` : ""}`,
      `▪ 연락처 : ${d.contact_phone || "-"}`,
      `▪ 조직수 : ${d.team_size ? d.team_size + "명" : "-"}`,
      "──────────",
      `▪ 대협팀 : ${staff.length > 0 ? staff.join(", ") : "-"}`,
      `▪ 컨설턴트 : ${consultants.length > 0 ? consultants.join(", ") : "-"}`,
      "──────────────",
      assignedLabel ? `👤 담당자 확인 요청 : ${assignedLabel}` : null,
      `🔗 CRM 바로가기 : ${baseUrl}/wanpan-truck`,
    ].filter(Boolean).join("\n");
  }

  if (event === "daily_activity_saved") {
    const workItems = Array.isArray(d.work_items) ? d.work_items : [];
    return [
      "📋 일별활동목표 등록", "──────────────",
      `▪ 담당자 : ${d.owner_name || "-"} ${d.owner_title || ""}`,
      `▪ 날짜 : ${d.work_date || "-"}`,
      "──────────",
      d.is_outside_meeting ? "📌 외근/미팅일" : null,
      !d.is_outside_meeting ? `▪ 당일 TM : ${d.goal_new_tm || 0}건` : null,
      !d.is_outside_meeting ? `▪ 당일 콜드톡 : ${d.goal_coldtalk || 0}건` : null,
      !d.is_outside_meeting ? `▪ 브론즈 DB : ${d.goal_consultant_db || 0}개` : null,
      !d.is_outside_meeting ? `▪ 1% DB : ${d.goal_second_touch || 0}개` : null,
      ...workItems.filter((item: any) => item?.text?.trim()).map((item: any, i: number) => `${i + 1}. ${item.text}`),
      "──────────────",
      `🔗 CRM 바로가기 : ${baseUrl}/daily-activity`,
    ].filter(Boolean).join("\n");
  }

  return "";
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

    let blocks: any[] = [];
    let pushText = "";

    // ===== 이벤트 라우팅 =====
    if (event === "wanpan_truck_created") {
      blocks = buildWanpanBlocks(d, truckId, baseUrl);
      pushText = `🚚 완판트럭 신규 등록 | ${d.site_name || "-"} (${d.dispatch_date || "-"})`;

      // 담당자 멘션
      const assignedName = d.assigned_to as string | null;
      const CONFIRM_LIST = ["김재영", "최은정"];
      const mentionNames = assignedName === "모두" ? CONFIRM_LIST : assignedName ? [assignedName] : [];

      for (const mName of mentionNames) {
        const mEmail = getMentionEmail(mName);
        const mUid = mEmail ? await findUserIdByEmail(appKey, mEmail) : null;
        if (mUid) {
          blocks.push({
            type: "text",
            text: `👤 담당자 확인 요청 : @${mName}`,
            inlines: [
              { type: "styled", text: "👤 담당자 확인 요청 : ", bold: true },
              { type: "mention", text: `@${mName}`, ref: { type: "kw", value: Number(mUid) } },
            ],
          });
        } else if (mName) {
          blocks.push({ type: "text", text: `👤 담당자 확인 요청 : ${mName}` });
        }
      }

      // 처리 버튼 3개
      if (truckId) {
        blocks.push({
          type: "action",
          elements: [
            { type: "button", text: "발주 완료", style: "primary", action: { type: "submit_action", name: "wanpan_action", value: `wanpan:${truckId}:order` } },
            { type: "button", text: "시안 발주", style: "default", action: { type: "submit_action", name: "wanpan_action", value: `wanpan:${truckId}:draft` } },
            { type: "button", text: "담당자 확인", style: "default", action: { type: "submit_action", name: "wanpan_action", value: `wanpan:${truckId}:confirm` } },
          ],
        });
      }

      blocks.push({
        type: "button", text: "CRM에서 보기", style: "default",
        action: { type: "open_system_browser", name: "open_crm", value: `${baseUrl}/wanpan-truck` },
      });

    } else if (event === "daily_activity_saved") {
      blocks = buildDailyActivityBlocks(d, baseUrl);
      pushText = `📋 활동목표 등록 | ${d.owner_name || "-"} (${d.work_date || "-"})`;

      // 담당자 @멘션 (본인)
      const mEmail = getMentionEmail(d.owner_name);
      const mUid = mEmail ? await findUserIdByEmail(appKey, mEmail) : null;
      if (mUid) {
        // 멘션을 헤더 바로 아래(인덱스 1)에 삽입
        blocks.splice(1, 0, {
          type: "text",
          text: `@${d.owner_name} ${d.owner_title || ""}`,
          inlines: [
            { type: "mention", text: `@${d.owner_name}`, ref: { type: "kw", value: Number(mUid) } },
            { type: "styled", text: ` ${d.owner_title || ""}` },
          ],
        });
      }

    } else {
      return NextResponse.json(
        { ok: false, message: `알 수 없는 이벤트: ${event}` },
        { status: 400 }
      );
    }

    // ===== 발송 (카드 → 실패 시 텍스트 폴백) =====
    const first = await sendMessage(appKey, conversationId, pushText, blocks);
    if (first.ok) {
      return NextResponse.json({ ok: true, mode: "card" });
    }

    const fallbackText = buildFallbackText(event, d, baseUrl);
    if (fallbackText) {
      const fallback = await sendMessage(appKey, conversationId, fallbackText);
      return NextResponse.json({ ok: fallback.ok, mode: "fallback_text", cardError: first.result }, { status: fallback.ok ? 200 : 500 });
    }

    return NextResponse.json({ ok: false, mode: "failed", cardError: first.result }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || "알 수 없는 오류" }, { status: 500 });
  }
}
