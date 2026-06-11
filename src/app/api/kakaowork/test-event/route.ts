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

function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

async function sendMessage(appKey: string, convId: string, text: string) {
  const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ conversation_id: Number(convId), text }),
  });
  const raw = await res.text();
  let result: any = null;
  try { result = raw ? JSON.parse(raw) : null; } catch { result = { raw }; }
  return { ok: res.ok && result?.success !== false, result };
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
    const timeLabel = `${now.getUTCHours()}시 ${now.getUTCMinutes()}분`;

    const lines: string[] = [
      `📊 실행파트 활동목표 진척율 (${timeLabel} 기준)`,
      "──────────────",
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

    const res = await sendMessage(appKey, convId, lines.join("\n"));

    return NextResponse.json({
      ok: res.ok,
      date: today,
      time: timeLabel,
      memberCount: (rows || []).length,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message });
  }
}
