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

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function hourKST(): number {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
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

function pct(result: number, goal: number): number {
  if (goal <= 0) return result > 0 ? 100 : 0;
  return Math.round((result / goal) * 100);
}

function bar(percent: number): string {
  const filled = Math.min(Math.round(percent / 10), 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${percent}%`;
}

function parseWorkItems(value: any): { total: number; done: number } {
  let items: any[] = [];
  if (typeof value === "string") {
    try { items = JSON.parse(value); } catch { items = []; }
  } else if (Array.isArray(value)) {
    items = value;
  }
  const active = items.filter((i: any) => i?.text?.trim());
  const completed = active.filter((i: any) => i?.done === true);
  return { total: active.length, done: completed.length };
}

function isGoalAchieved(row: any): boolean {
  if (row.is_outside_meeting) return false;
  const checks = [
    { goal: row.goal_new_tm || 0, result: row.result_new_tm || 0 },
    { goal: row.goal_coldtalk || 0, result: row.result_coldtalk || 0 },
    { goal: row.goal_consultant_db || 0, result: row.result_consultant_db || 0 },
    { goal: row.goal_second_touch || 0, result: row.result_second_touch || 0 },
  ];
  const numericOk = checks.every((c) => c.goal <= 0 || c.result >= c.goal);
  const wi = parseWorkItems(row.goal_work_items);
  const workOk = wi.total <= 0 || wi.done >= wi.total;
  return numericOk && workOk;
}

async function buildViewerMentionText(appKey: string): Promise<string> {
  const parts: string[] = [];
  for (const name of VIEWER_NAMES) {
    const email = getMentionEmail(name);
    if (email) {
      const uid = await findUserIdByEmail(appKey, email);
      if (uid) { parts.push(`@${name}`); continue; }
    }
    parts.push(name);
  }
  return parts.join(" ");
}

export async function GET() {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const convId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;
    if (!appKey || !convId) return NextResponse.json({ ok: false, message: "환경변수 누락" });

    const hour = hourKST();
    if (![14, 16, 18].includes(hour)) {
      return NextResponse.json({ ok: true, skipped: true, reason: `${hour}시는 보고 시간이 아닙니다` });
    }

    const today = todayKST();
    const supabase = getSupabase();
    const { data: rows } = await supabase
      .from("daily_activity_goals")
      .select("*")
      .eq("work_date", today);

    const viewerTag = await buildViewerMentionText(appKey);

    // ===== 진척율 텍스트 보고 =====
    const lines: string[] = [
      `📊 실행파트 활동목표 진척율 (${hour}시 기준)`,
      "──────────────",
      viewerTag,
      "",
    ];

    for (const member of EXEC_MEMBERS) {
      const row = (rows || []).find((r: any) => r.owner_name === member.name);

      if (!row) {
        lines.push(`■ ${member.name} ${member.title}`);
        lines.push("  ⚠️ 미등록");
        lines.push("");
        continue;
      }

      if ((row as any).is_outside_meeting) {
        lines.push(`■ ${member.name} ${member.title}`);
        lines.push("  📌 외근(미팅)");
        lines.push("");
        continue;
      }

      const r = row as any;
      const tmP = pct(r.result_new_tm || 0, r.goal_new_tm || 0);
      const coldP = pct(r.result_coldtalk || 0, r.goal_coldtalk || 0);
      const bronzeP = pct(r.result_consultant_db || 0, r.goal_consultant_db || 0);
      const dbP = pct(r.result_second_touch || 0, r.goal_second_touch || 0);
      const wi = parseWorkItems(r.goal_work_items);
      const wiP = wi.total > 0 ? pct(wi.done, wi.total) : 0;

      lines.push(`■ ${member.name} ${member.title}`);
      lines.push(`  TM ${bar(tmP)}  (${r.result_new_tm || 0}/${r.goal_new_tm || 0}건)`);
      lines.push(`  콜드톡 ${bar(coldP)}  (${r.result_coldtalk || 0}/${r.goal_coldtalk || 0}건)`);
      lines.push(`  브론즈 ${bar(bronzeP)}  (${r.result_consultant_db || 0}/${r.goal_consultant_db || 0}개)`);
      lines.push(`  1%DB ${bar(dbP)}  (${r.result_second_touch || 0}/${r.goal_second_touch || 0}개)`);
      if (wi.total > 0) {
        lines.push(`  특발성 ${bar(wiP)}  (${wi.done}/${wi.total}건)`);
      }
      lines.push("");
    }

    lines.push("──────────────");

    await sendMessage(appKey, convId, lines.join("\n"));

    // ===== 18시: 축하카드 =====
    if (hour === 18) {
      const achievers: string[] = [];
      for (const member of EXEC_MEMBERS) {
        const row = (rows || []).find((r: any) => r.owner_name === member.name);
        if (row && isGoalAchieved(row)) {
          achievers.push(member.name);
        }
      }

      if (achievers.length > 0) {
        const blocks: any[] = [
          { type: "header", text: "🏆 금일 목표달성 축하", style: "yellow" },
          {
            type: "text",
            text: "오늘 하루도 목표를 향해 최선을 다한 당신,\n정말 대단합니다! 🎉",
            inlines: [
              { type: "styled", text: "오늘 하루도 목표를 향해 최선을 다한 당신,\n정말 대단합니다! 🎉", bold: true },
            ],
          },
          { type: "divider" },
        ];

        // 달성자 멘션
        for (const name of achievers) {
          const mEmail = getMentionEmail(name);
          const mUid = mEmail ? await findUserIdByEmail(appKey, mEmail) : null;
          if (mUid) {
            blocks.push({
              type: "text",
              text: `🎯 @${name} — 금일 목표달성 완료!`,
              inlines: [
                { type: "styled", text: "🎯 " },
                { type: "mention", text: `@${name}`, ref: { type: "kw", value: Number(mUid) } },
                { type: "styled", text: " — 금일 목표달성 완료!", bold: true, color: "blue" },
              ],
            });
          } else {
            blocks.push({
              type: "text",
              text: `🎯 ${name} — 금일 목표달성 완료!`,
              inlines: [{ type: "styled", text: `🎯 ${name} — 금일 목표달성 완료!`, bold: true, color: "blue" }],
            });
          }
        }

        blocks.push({ type: "divider" });

        const quotes = [
          "작은 승리의 반복이 큰 성공을 만듭니다.",
          "오늘의 노력이 내일의 성과가 됩니다.",
          "목표를 이룬 자만이 더 큰 목표를 세울 수 있습니다.",
          "꾸준함이 재능을 이깁니다. 오늘도 증명했습니다.",
          "성공은 매일의 작은 실천에서 시작됩니다.",
        ];
        const todayQuote = quotes[new Date().getDate() % quotes.length];

        blocks.push({
          type: "text",
          text: `"${todayQuote}"`,
          inlines: [{ type: "styled", text: `"${todayQuote}"`, italic: true, color: "grey" }],
        });

        const pushText = `🏆 금일 목표달성 축하 | ${achievers.join(", ")}`;
        await sendMessage(appKey, convId, pushText, blocks);
      }
    }

    return NextResponse.json({ ok: true, hour, date: today });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || "알 수 없는 오류" }, { status: 500 });
  }
}
