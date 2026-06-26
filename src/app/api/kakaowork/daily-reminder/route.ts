import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

const EXEC_MEMBERS = [
  { name: "조계현", title: "메인" },
  { name: "이세호", title: "어쏘" },
  { name: "기여운", title: "어쏘" },
  { name: "최연전", title: "CX" },
];

function normalizeMemberName(name: unknown): string {
  return String(name || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function getMentionEmail(name: string): string | null {
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

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function hourKST(): number {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

function nextDateString(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function kstDayRangeIso(dateText: string) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  const end = new Date(`${nextDateString(dateText)}T00:00:00+09:00`);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function uniqueRowsByOwner(rows: any[]) {
  const byOwner = new Map<string, any>();

  for (const row of rows) {
    const key = normalizeMemberName(row?.owner_name);
    if (!key) continue;
    if (!byOwner.has(key)) byOwner.set(key, row);
  }

  return Array.from(byOwner.values());
}

async function loadDailyActivityRows(
  supabase: ReturnType<typeof getSupabase>,
  dateText: string
) {
  const { startIso, endIso } = kstDayRangeIso(dateText);

  const [byWorkDate, byCreatedAt, byUpdatedAt] = await Promise.all([
    supabase
      .from("daily_activity_goals")
      .select("owner_name, is_outside_meeting, work_date, created_at, updated_at")
      .eq("work_date", dateText),
    supabase
      .from("daily_activity_goals")
      .select("owner_name, is_outside_meeting, work_date, created_at, updated_at")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("daily_activity_goals")
      .select("owner_name, is_outside_meeting, work_date, created_at, updated_at")
      .gte("updated_at", startIso)
      .lt("updated_at", endIso),
  ]);

  return uniqueRowsByOwner([
    ...(byWorkDate.data || []),
    ...(byCreatedAt.data || []),
    ...(byUpdatedAt.data || []),
  ]);
}

function getMissingMembers(rows: any[]) {
  const registeredNames = new Set(
    (rows || []).map((r: any) => normalizeMemberName(r.owner_name))
  );

  return EXEC_MEMBERS.filter((m) => !registeredNames.has(normalizeMemberName(m.name)));
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

export async function GET() {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";

    if (!appKey || !conversationId) {
      return NextResponse.json({ ok: false, message: "환경변수 누락" });
    }

    const hour = hourKST();
    if (hour < 10 || hour >= 18) {
      return NextResponse.json({ ok: true, skipped: true, reason: "업무시간 외" });
    }

    const today = todayKST();
    const supabase = getSupabase();

    const rows = await loadDailyActivityRows(supabase, today);
    let missing = getMissingMembers(rows);

    if (missing.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "전원 등록 완료" });
    }

    // 저장 직후 크론이 겹쳐 오발송되는 일을 줄이기 위해 발송 직전에 한 번 더 확인합니다.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const refreshedRows = await loadDailyActivityRows(supabase, today);
    missing = getMissingMembers(refreshedRows);

    if (missing.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "전원 등록 완료(재확인)" });
    }

    // ===== 미등록자 개별 @멘션 블록 구성 =====
    const blocks: any[] = [
      { type: "header", text: "⏰ 금일 활동목표 미등록 알림", style: "red" },
      {
        type: "text",
        text: "아래 인원은 금일 활동목표를 아직 등록하지 않았습니다.\n외근/미팅인 경우 아래 버튼을 눌러주세요.",
      },
      { type: "divider" },
    ];

    // 미등록자별 @멘션 + 외근 버튼
    for (const member of missing) {
      const mEmail = getMentionEmail(member.name);
      const mUid = mEmail ? await findUserIdByEmail(appKey, mEmail) : null;

      if (mUid) {
        blocks.push({
          type: "text",
          text: `@${member.name} ${member.title} — 미등록`,
          inlines: [
            { type: "mention", text: `@${member.name}`, ref: { type: "kw", value: Number(mUid) } },
            { type: "styled", text: ` ${member.title} — 미등록`, color: "red" },
          ],
        });
      } else {
        blocks.push({
          type: "text",
          text: `${member.name} ${member.title} — 미등록`,
          inlines: [{ type: "styled", text: `${member.name} ${member.title} — 미등록`, bold: true, color: "red" }],
        });
      }

      blocks.push({
        type: "button",
        text: `${member.name} 외근(미팅)`,
        style: "default",
        action: {
          type: "submit_action",
          name: "daily_outside",
          value: `daily:${member.name}:outside`,
        },
      });
    }

    blocks.push({ type: "divider" });
    blocks.push({
      type: "button",
      text: "CRM에서 목표 등록하기",
      style: "primary",
      action: {
        type: "open_system_browser",
        name: "open_crm",
        value: `${baseUrl}/daily-activity`,
      },
    });

    const pushText = `⏰ 활동목표 미등록 | ${missing.map((m) => m.name).join(", ")}`;

    const res = await sendMessage(appKey, conversationId, pushText, blocks);

    if (!res.ok) {
      const fallbackLines = [
        "⏰ 금일 활동목표 미등록 알림",
        "──────────────",
        ...missing.map((m) => `▪ @${m.name} ${m.title} — 미등록`),
        "",
        "외근/미팅인 경우 CRM에서 외근 체크 부탁드립니다.",
        "──────────────",
        `🔗 CRM 바로가기 : ${baseUrl}/daily-activity`,
      ];
      await sendMessage(appKey, conversationId, fallbackLines.join("\n"));
    }

    return NextResponse.json({ ok: true, reminded: missing.map((m) => m.name) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || "알 수 없는 오류" }, { status: 500 });
  }
}
