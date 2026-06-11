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

const VIEWER_NAMES = ["김창완", "최웅", "김재영", "최은정"];

function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function pct(result: number, goal: number): string {
  if (goal <= 0) return result > 0 ? "100%" : "0%";
  return Math.round((result / goal) * 100) + "%";
}

function parseWorkItems(value: any): { total: number; done: number } {
  let items: any[] = [];
  if (typeof value === "string") { try { items = JSON.parse(value); } catch {} }
  else if (Array.isArray(value)) items = value;
  const active = items.filter((i: any) => i?.text?.trim());
  return { total: active.length, done: active.filter((i: any) => i?.done === true).length };
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
    const res = await fetch(`${KAKAO_WORK_API_BASE}/users.find_by_email?email=${encodeURIComponent(email)}`, {
      method: "GET", headers: { Authorization: `Bearer ${appKey}` }, cache: "no-store",
    });
    const data = await res.json();
    const id = Number(data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch { return null; }
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

function buildMemberLines(r: any, member: { name: string; title: string }): string {
  if (!r) return `■ ${member.name} ${member.title} — ⚠️ 미등록`;
  if (r.is_outside_meeting) return `■ ${member.name} ${member.title} — 📌 외근(미팅)`;

  const wi = parseWorkItems(r.goal_work_items);
  const lines = [
    `■ ${member.name} ${member.title}`,
    `  TM : ${r.goal_new_tm || 0}/${r.result_new_tm || 0}건 (${pct(r.result_new_tm || 0, r.goal_new_tm || 0)})`,
    `  콜드톡 : ${r.goal_coldtalk || 0}/${r.result_coldtalk || 0}건 (${pct(r.result_coldtalk || 0, r.goal_coldtalk || 0)})`,
    `  브론즈DB수취 : ${r.goal_consultant_db || 0}/${r.result_consultant_db || 0}개 (${pct(r.result_consultant_db || 0, r.goal_consultant_db || 0)})`,
    `  1%DB수취 : ${r.goal_second_touch || 0}/${r.result_second_touch || 0}개 (${pct(r.result_second_touch || 0, r.goal_second_touch || 0)})`,
  ];
  if (wi.total > 0) lines.push(`  특발성 : ${wi.total}/${wi.done}건 (${pct(wi.done, wi.total)})`);
  return lines.join("\n");
}

export async function GET() {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const convId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    if (!appKey || !convId) return NextResponse.json({ ok: false, message: "환경변수 누락" });

    const today = todayKST();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: rows } = await supabase.from("daily_activity_goals").select("*").eq("work_date", today);

    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const [, mm, dd] = today.split("-");
    const dateLabel = `${Number(mm)}월 ${Number(dd)}일`;
    const timeLabel = `${now.getUTCHours()}시 ${String(now.getUTCMinutes()).padStart(2, "0")}분`;

    // 블록킷: 헤더 + 날짜 + 뷰어 멘션 + 구분선
    const blocks: any[] = [
      { type: "header", text: "📊 실행파트 활동목표 진척율", style: "blue" },
      { type: "text", text: `${dateLabel} (${timeLabel} 기준)` },
    ];

    // 뷰어 멘션 (세로 배치, 간격 없음)
    {
      const vInlines: any[] = [];
      const vParts: string[] = [];
      for (let vi = 0; vi < VIEWER_NAMES.length; vi++) {
        const vName = VIEWER_NAMES[vi];
        const vEmail = getMentionEmail(vName);
        const vUid = vEmail ? await findUserIdByEmail(appKey, vEmail) : null;
        if (vi > 0) { vInlines.push({ type: "styled", text: "\n" }); vParts.push("\n"); }
        if (vUid) {
          vInlines.push({ type: "mention", text: `@${vName}`, ref: { type: "kw", value: Number(vUid) } });
        } else {
          vInlines.push({ type: "styled", text: `@${vName}` });
        }
        vParts.push(`@${vName}`);
      }
      if (vInlines.length > 0) {
        blocks.push({ type: "text", text: vParts.join(""), inlines: vInlines });
      }
    }

    blocks.push({ type: "divider" });

    // 각 멤버 데이터를 텍스트 블록으로
    // 멤버 데이터 한 블록으로 (간격 없음)
    const allMemberText = EXEC_MEMBERS.map((member) => {
      const row = (rows || []).find((r: any) => r.owner_name === member.name);
      return buildMemberLines(row, member);
    }).join("\n");
    blocks.push({ type: "text", text: allMemberText });

    const pushText = `📊 진척율 (${timeLabel} 기준)`;
    const res = await sendMessage(appKey, convId, pushText, blocks);

    return NextResponse.json({ ok: res.ok, date: today, time: timeLabel });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message });
  }
}
