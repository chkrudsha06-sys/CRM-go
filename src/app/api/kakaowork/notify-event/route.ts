import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

const VIEWER_NAMES = ["김창완", "최웅", "김재영", "최은정"];

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
    const res = await fetch(`${KAKAO_WORK_API_BASE}/users.find_by_email?email=${encodeURIComponent(email)}`, {
      method: "GET", headers: { Authorization: `Bearer ${appKey}` }, cache: "no-store",
    });
    const data = await res.json();
    const id = Number(data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch { return null; }
}

function parseMembers(value: any): string[] {
  if (!value) return [];
  try {
    if (typeof value === "string") { const p = JSON.parse(value); return Array.isArray(p) ? p : []; }
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function desc(term: string, value: string) {
  return { type: "description", term, content: { type: "text", text: value || "-" }, accent: true };
}

function sectionHeader(text: string) {
  return { type: "text", text, inlines: [{ type: "styled", text, bold: true }] };
}

async function sendMessage(appKey: string, convId: string, text: string, blocks?: any[]) {
  const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ conversation_id: Number(convId), text, ...(blocks ? { blocks } : {}) }),
  });
  const raw = await res.text();
  let result: any = null;
  try { result = raw ? JSON.parse(raw) : null; } catch { result = { raw }; }
  return { ok: res.ok && result?.success !== false, result };
}

// 뷰어 멘션 블록 (세로 배치, 간격 없음)
async function buildViewerMentionBlock(appKey: string): Promise<any | null> {
  const inlines: any[] = [];
  const textParts: string[] = [];
  for (let i = 0; i < VIEWER_NAMES.length; i++) {
    const name = VIEWER_NAMES[i];
    const email = getMentionEmail(name);
    const uid = email ? await findUserIdByEmail(appKey, email) : null;
    if (i > 0) { inlines.push({ type: "styled", text: "\n" }); textParts.push("\n"); }
    if (uid) {
      inlines.push({ type: "mention", text: `@${name}`, ref: { type: "kw", value: Number(uid) } });
    } else {
      inlines.push({ type: "styled", text: `@${name}` });
    }
    textParts.push(`@${name}`);
  }
  if (inlines.length === 0) return null;
  return { type: "text", text: textParts.join(""), inlines };
}

// ===== 완판트럭 블록 =====
function buildWanpanBlocks(d: Record<string, any>, truckId: any, baseUrl: string): any[] {
  const staff = parseMembers(d.staff_members);
  const consultants = parseMembers(d.consultant_members);
  return [
    { type: "header", text: "🚚 완판트럭 신규 등록", style: "yellow" },
    sectionHeader("■ 현장정보"),
    { type: "text", text: [
      `발송일 : ${d.dispatch_date || "-"}`,
      `현장명 : ${d.site_name || "-"}`,
      `현장주소 : ${d.location || "-"}`,
    ].join("\n") },
    { type: "divider" },
    sectionHeader("■ 소통자정보"),
    { type: "text", text: [
      `소통자 : ${d.contact_point || "-"}`,
      `직급 : ${d.contact_point_title || "-"}`,
      `연락처 : ${d.contact_phone || "-"}`,
    ].join("\n") },
    { type: "divider" },
    sectionHeader("■ BX요청사항"),
    { type: "text", text: `촬영여부 : ${d.has_photo ? "촬영" : "미촬영"}` },
    { type: "divider" },
    sectionHeader("■ 발주수량"),
    { type: "text", text: `수량 : 기본 ${d.order_qty_base || 0} + 추가 ${d.order_qty_extra || 0}` },
    { type: "divider" },
    sectionHeader("■ 참석자"),
    { type: "text", text: [
      `대협팀 : ${staff.length > 0 ? staff.join(", ") : "-"}`,
      `컨설턴트 : ${consultants.length > 0 ? consultants.join(", ") : "-"}`,
    ].join("\n") },
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
    { type: "text", text: `날짜 : ${d.work_date || "-"}` },
    { type: "divider" },
  ];
  if (d.is_outside_meeting) {
    blocks.push({ type: "text", text: "📌 외근/미팅일 (활동목표 없음)" });
  } else {
    blocks.push(sectionHeader("■ 활동목표"));
    blocks.push({
      type: "text",
      text: [
        `TM : ${d.goal_new_tm || 0}건`,
        `콜드톡 : ${d.goal_coldtalk || 0}건`,
        `브론즈DB수취 : ${d.goal_consultant_db || 0}개`,
        `1%DB수취 : ${d.goal_second_touch || 0}개`,
      ].join("\n"),
    });
    if (hasWorkItems) {
      blocks.push({ type: "divider" });
      blocks.push(sectionHeader("■ 특발성활동목표"));
      blocks.push({ type: "text", text: workItems.filter((i: any) => i?.text?.trim()).map((i: any, idx: number) => `${idx + 1}. ${i.text}`).join("\n") });
    }
  }
  blocks.push({ type: "button", text: "CRM에서 보기", style: "default", action: { type: "open_system_browser", name: "open_crm", value: `${baseUrl}/daily-activity` } });
  return blocks;
}

function buildFallbackText(event: string, d: Record<string, any>, baseUrl: string): string {
  if (event === "wanpan_truck_created") {
    const staff = parseMembers(d.staff_members);
    const consultants = parseMembers(d.consultant_members);
    const assignedLabel = d.assigned_to === "모두" ? "김재영, 최은정" : d.assigned_to;
    return ["🚚 완판트럭 신규 등록","──────────────",`▪ 발송일 : ${d.dispatch_date || "-"}`,`▪ 현장명 : ${d.site_name || "-"}`,`▪ 현장주소 : ${d.location || "-"}`,`▪ 대행사 : ${d.agency || "-"}`,"──────────",`▪ 접점 : ${d.contact_point || "-"}${d.contact_point_title ? ` ${d.contact_point_title}` : ""}`,`▪ 연락처 : ${d.contact_phone || "-"}`,`▪ 대협팀 : ${staff.length > 0 ? staff.join(", ") : "-"}`,`▪ 컨설턴트 : ${consultants.length > 0 ? consultants.join(", ") : "-"}`,"──────────────",assignedLabel ? `👤 담당자 확인 요청 : ${assignedLabel}` : null,`🔗 CRM : ${baseUrl}/wanpan-truck`].filter(Boolean).join("\n");
  }
  if (event === "daily_activity_saved") {
    const workItems = Array.isArray(d.work_items) ? d.work_items : [];
    return ["📋 일별활동목표 등록","──────────────",`▪ ${d.owner_name || "-"} ${d.owner_title || ""}`,`▪ 날짜 : ${d.work_date || "-"}`,"──────────",d.is_outside_meeting ? "📌 외근/미팅일" : null,!d.is_outside_meeting ? `▪ TM : ${d.goal_new_tm || 0}건` : null,!d.is_outside_meeting ? `▪ 콜드톡 : ${d.goal_coldtalk || 0}건` : null,!d.is_outside_meeting ? `▪ 브론즈 : ${d.goal_consultant_db || 0}개` : null,!d.is_outside_meeting ? `▪ 1%DB : ${d.goal_second_touch || 0}개` : null,...workItems.filter((i: any) => i?.text?.trim()).map((i: any, idx: number) => `${idx + 1}. ${i.text}`),"──────────────",`🔗 CRM : ${baseUrl}/daily-activity`].filter(Boolean).join("\n");
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";
    if (!appKey || !conversationId) return NextResponse.json({ ok: false, message: "환경변수 누락" }, { status: 400 });

    const body = await request.json();
    const event = body?.event;
    const d = body?.data || {};
    const truckId = body?.truck_id;

    let blocks: any[] = [];
    let pushText = "";

    if (event === "wanpan_truck_created") {
      blocks = buildWanpanBlocks(d, truckId, baseUrl);
      pushText = `🚚 완판트럭 신규 등록 | ${d.site_name || "-"} (${d.dispatch_date || "-"})`;

      const assignedName = d.assigned_to as string | null;
      const CONFIRM_LIST = ["김재영", "최은정"];
      const mentionNames = assignedName === "모두" ? CONFIRM_LIST : assignedName ? [assignedName] : [];
      for (const mName of mentionNames) {
        const mEmail = getMentionEmail(mName);
        const mUid = mEmail ? await findUserIdByEmail(appKey, mEmail) : null;
        if (mUid) {
          blocks.push({ type: "text", text: `👤 담당자 확인 요청 : @${mName}`, inlines: [{ type: "styled", text: "👤 담당자 확인 요청 : ", bold: true }, { type: "mention", text: `@${mName}`, ref: { type: "kw", value: Number(mUid) } }] });
        } else { blocks.push({ type: "text", text: `👤 담당자 확인 요청 : ${mName}` }); }
      }
      if (truckId) {
        blocks.push({ type: "action", elements: [
          { type: "button", text: "발주 완료", style: "primary", action: { type: "submit_action", name: "wanpan_action", value: `wanpan:${truckId}:order` } },
          { type: "button", text: "시안 발주", style: "default", action: { type: "submit_action", name: "wanpan_action", value: `wanpan:${truckId}:draft` } },
          { type: "button", text: "담당자 확인", style: "default", action: { type: "submit_action", name: "wanpan_action", value: `wanpan:${truckId}:confirm` } },
        ]});
      }
      blocks.push({ type: "button", text: "CRM에서 보기", style: "default", action: { type: "open_system_browser", name: "open_crm", value: `${baseUrl}/wanpan-truck` } });

    } else if (event === "daily_activity_saved") {
      blocks = buildDailyActivityBlocks(d, baseUrl);
      pushText = `📋 활동목표 등록 | ${d.owner_name || "-"} (${d.work_date || "-"})`;

      // 뷰어 멘션 한 줄로 (헤더 바로 아래)
      const viewerBlock = await buildViewerMentionBlock(appKey);
      if (viewerBlock) blocks.splice(1, 0, viewerBlock);

    } else {
      return NextResponse.json({ ok: false, message: `알 수 없는 이벤트: ${event}` }, { status: 400 });
    }

    // ===== 발송 =====
    const first = await sendMessage(appKey, conversationId, pushText, blocks);
    if (!first.ok) {
      const fallbackText = buildFallbackText(event, d, baseUrl);
      if (fallbackText) await sendMessage(appKey, conversationId, fallbackText);
    }

    // ===== 일별활동: 전원 완료 체크 =====
    if (event === "daily_activity_saved" && d.work_date) {
      try {
        const EXEC_NAMES = ["조계현", "이세호", "기여운", "최연전"];
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data: todayRows } = await supabase.from("daily_activity_goals").select("owner_name, is_outside_meeting").eq("work_date", d.work_date);

        const registered = new Set((todayRows || []).map((r: any) => r.owner_name));
        const allDone = EXEC_NAMES.every((name) => registered.has(name));

        if (allDone) {
          const outsideNames: string[] = [];
          const goalNames: string[] = [];
          for (const r of (todayRows || [])) {
            const row = r as any;
            if (EXEC_NAMES.includes(row.owner_name)) {
              (row.is_outside_meeting ? outsideNames : goalNames).push(row.owner_name);
            }
          }

          // 블록킷 카드로 전원 완료 알림 (뷰어 멘션 포함)
          const completeBlocks: any[] = [
            { type: "header", text: "✅ 실행파트 금일 목표등록 모두 완료", style: "blue" },
          ];
          const viewerBlock = await buildViewerMentionBlock(appKey);
          if (viewerBlock) completeBlocks.push(viewerBlock);

          completeBlocks.push({ type: "divider" });
          completeBlocks.push({ type: "text", text: `${d.work_date} 실행파트 전원의\n일별활동목표 등록이 완료되었습니다.` });

          const statusLines: string[] = [];
          if (goalNames.length > 0) statusLines.push(`▪ 목표등록 : ${goalNames.join(", ")}`);
          if (outsideNames.length > 0) statusLines.push(`▪ 외근(미팅) : ${outsideNames.join(", ")}`);
          if (statusLines.length > 0) completeBlocks.push({ type: "text", text: statusLines.join("\n") });

          const completeRes = await sendMessage(appKey, conversationId, "✅ 실행파트 금일 목표등록 모두 완료", completeBlocks);

          // 블록킷 실패 시 텍스트 폴백
          if (!completeRes.ok) {
            const vTag = VIEWER_NAMES.map((n) => `@${n}`).join(" ");
            await sendMessage(appKey, conversationId, [
              "✅ 실행파트 금일 목표등록 모두 완료", "──────────────", vTag, "",
              `${d.work_date} 실행파트 전원의 일별활동목표 등록이 완료되었습니다.`, "──────────",
              ...statusLines, "──────────────",
            ].join("\n"));
          }
        }
      } catch {}
    }

    return NextResponse.json({ ok: first.ok, mode: first.ok ? "card" : "fallback" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || "알 수 없는 오류" }, { status: 500 });
  }
}
