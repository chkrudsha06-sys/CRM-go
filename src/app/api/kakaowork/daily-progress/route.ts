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

type AutoResult = {
  new_tm: number;
  consultant_db: number;
  second_touch: number;
  meeting_confirmed: number;
};

const EMPTY_AUTO_RESULT: AutoResult = {
  new_tm: 0,
  consultant_db: 0,
  second_touch: 0,
  meeting_confirmed: 0,
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function hourKST(): number {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
}

function minKST(): number {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCMinutes();
}

function nextDateString(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
      method: "GET",
      headers: { Authorization: `Bearer ${appKey}` },
      cache: "no-store",
    });
    const data = await res.json();
    const id = Number(data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function sendMessage(appKey: string, convId: string, text: string, blocks?: any[]) {
  const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      conversation_id: Number(convId),
      text,
      ...(blocks ? { blocks } : {}),
    }),
  });

  const raw = await res.text();
  let result: any = null;
  try {
    result = raw ? JSON.parse(raw) : null;
  } catch {
    result = { raw };
  }

  return { ok: res.ok && result?.success !== false, result };
}

function pct(result: number, goal: number): string {
  if (goal <= 0) return result > 0 ? "100%" : "0%";
  return Math.round((result / goal) * 100) + "%";
}

function parseWorkItems(value: any): { total: number; done: number } {
  let items: any[] = [];

  if (typeof value === "string") {
    try {
      items = JSON.parse(value);
    } catch {
      items = [];
    }
  } else if (Array.isArray(value)) {
    items = value;
  }

  const active = items.filter((item: any) => String(item?.text || "").trim());
  return {
    total: active.length,
    done: active.filter((item: any) => item?.done === true).length,
  };
}

function hasAnyAutoResult(result: AutoResult): boolean {
  return (
    result.new_tm > 0 ||
    result.consultant_db > 0 ||
    result.second_touch > 0 ||
    result.meeting_confirmed > 0
  );
  
}

function isGoalAchieved(row: any, live: AutoResult): boolean {
  if (!row || row.is_outside_meeting) return false;

  const checks = [
    { goal: Number(row.goal_new_tm || 0), result: live.new_tm },
    { goal: Number(row.goal_consultant_db || 0), result: live.consultant_db },
    { goal: Number(row.goal_second_touch || 0), result: live.second_touch },
  ];

  const numOk = checks.every((check) => check.goal <= 0 || check.result >= check.goal);
  const wi = parseWorkItems(row.goal_work_items);

  return numOk && (wi.total <= 0 || wi.done >= wi.total);
}

function buildMemberLines(
  row: any,
  member: { name: string; title: string },
  live: AutoResult,
): string {
  if (!row) {
    if (!hasAnyAutoResult(live)) {
      return `■ ${member.name} ${member.title} — ⚠️ 미등록`;
    }

    return [
      `■ ${member.name} ${member.title} — ⚠️ 목표 미등록`,
      `  실시간 자동집계 TM ${live.new_tm}건 · 브론즈DB ${live.consultant_db}개 · 1%DB ${live.second_touch}개`,
    ].join("\n");
  }

  if (row.is_outside_meeting) {
    return `■ ${member.name} ${member.title} — 📌 외근(미팅)`;
  }

  const wi = parseWorkItems(row.goal_work_items);
  const lines = [
    `■ ${member.name} ${member.title}`,
    `  TM : ${Number(row.goal_new_tm || 0)}/${live.new_tm}건 (${pct(live.new_tm, Number(row.goal_new_tm || 0))})`,
    `  브론즈DB수취 : ${Number(row.goal_consultant_db || 0)}/${live.consultant_db}개 (${pct(live.consultant_db, Number(row.goal_consultant_db || 0))})`,
    `  1%DB수취 : ${Number(row.goal_second_touch || 0)}/${live.second_touch}개 (${pct(live.second_touch, Number(row.goal_second_touch || 0))})`,
  ];

  if (wi.total > 0) {
    lines.push(`  특발성 : ${wi.total}/${wi.done}건 (${pct(wi.done, wi.total)})`);
  }

  return lines.join("\n");
}

async function loadRealtimeAutoResults(
  supabase: ReturnType<typeof getSupabase>,
  workDate: string,
): Promise<Record<string, AutoResult>> {
  const start = `${workDate}T00:00:00`;
  const end = `${nextDateString(workDate)}T00:00:00`;
  const memberNames = EXEC_MEMBERS.map((member) => member.name);

  const resultMap = Object.fromEntries(
    memberNames.map((name) => [name, { ...EMPTY_AUTO_RESULT }]),
  ) as Record<string, AutoResult>;

  const { data, error } = await supabase
    .from("contacts")
    .select("id,created_at,activity_type,customer_grade,crm_db_source,assigned_to")
    .gte("created_at", start)
    .lt("created_at", end)
    .in("assigned_to", memberNames)
    .limit(10000);

  if (error) {
    console.warn("카카오워크 일별활동 실시간 자동집계 조회 실패:", error.message);
    return resultMap;
  }

  for (const row of data || []) {
    const owner = String((row as any).assigned_to || "").trim();
    if (!resultMap[owner]) continue;

    const activityType = String((row as any).activity_type || "").trim();
    const grade = String((row as any).customer_grade || "").trim();
    const source = String((row as any).crm_db_source || "").trim();

    if (activityType === "TM") {
      resultMap[owner].new_tm += 1;
    }

    if (source === "vip_activity" && grade === "브론즈") {
      resultMap[owner].consultant_db += 1;
    }

    if (source === "vip_activity" && (grade === "마스터" || grade === "챌린저")) {
      resultMap[owner].second_touch += 1;
    }
  }

  return resultMap;
}

export async function GET() {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const convId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;

    if (!appKey || !convId) {
      return NextResponse.json({
        ok: false,
        message: "환경변수 누락",
      });
    }

    const hour = hourKST();
    if (![14, 16, 18].includes(hour)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `${hour}시는 보고 시간 아님`,
      });
    }

    const today = todayKST();
    const min = minKST();
    const supabase = getSupabase();

    const [{ data: rows }, realtimeResults] = await Promise.all([
      supabase.from("daily_activity_goals").select("*").eq("work_date", today),
      loadRealtimeAutoResults(supabase, today),
    ]);

    const [, mm, dd] = today.split("-");
    const dateLabel = `${Number(mm)}월 ${Number(dd)}일`;

    const blocks: any[] = [
      {
        type: "header",
        text: "📊 실행파트 활동목표 진척율",
        style: "blue",
      },
      {
        type: "text",
        text: `${dateLabel} (${hour}시 ${String(min).padStart(2, "0")}분 기준)\n자동집계 활동결과는 CRM 실시간 데이터 기준입니다.`,
      },
    ];

    const viewerInlines: any[] = [];
    const viewerParts: string[] = [];

    for (let index = 0; index < VIEWER_NAMES.length; index += 1) {
      const viewerName = VIEWER_NAMES[index];
      const viewerEmail = getMentionEmail(viewerName);
      const viewerUid = viewerEmail ? await findUserIdByEmail(appKey, viewerEmail) : null;

      if (index > 0) {
        viewerInlines.push({ type: "styled", text: "\n" });
        viewerParts.push("\n");
      }

      if (viewerUid) {
        viewerInlines.push({
          type: "mention",
          text: `@${viewerName}`,
          ref: { type: "kw", value: Number(viewerUid) },
        });
      } else {
        viewerInlines.push({ type: "styled", text: `@${viewerName}` });
      }

      viewerParts.push(`@${viewerName}`);
    }

    if (viewerInlines.length > 0) {
      blocks.push({
        type: "text",
        text: viewerParts.join(""),
        inlines: viewerInlines,
      });
    }

    blocks.push({ type: "divider" });

    const allMemberText = EXEC_MEMBERS.map((member) => {
      const row = (rows || []).find((item: any) => item.owner_name === member.name);
      const live = realtimeResults[member.name] || { ...EMPTY_AUTO_RESULT };
      return buildMemberLines(row, member, live);
    }).join("\n\n");

    blocks.push({
      type: "text",
      text: allMemberText,
    });

    const pushText = `📊 진척율 (${hour}시 기준 · CRM 실시간 자동집계)`;
    await sendMessage(appKey, convId, pushText, blocks);

    if (hour === 18) {
      const achievers: { name: string; title: string }[] = [];

      for (const member of EXEC_MEMBERS) {
        const row = (rows || []).find((item: any) => item.owner_name === member.name);
        const live = realtimeResults[member.name] || { ...EMPTY_AUTO_RESULT };

        if (row && isGoalAchieved(row, live)) {
          achievers.push(member);
        }
      }

      if (achievers.length > 0) {
        const quotes = [
          "작은 승리의 반복이 큰 성공을 만듭니다.",
          "오늘의 노력이 내일의 성과가 됩니다.",
          "목표를 이룬 자만이 더 큰 목표를 세울 수 있습니다.",
          "꾸준함이 재능을 이깁니다. 오늘도 증명했습니다.",
          "성공은 매일의 작은 실천에서 시작됩니다.",
        ];
        const todayQuote = quotes[new Date().getDate() % quotes.length];

        const cBlocks: any[] = [
          {
            type: "header",
            text: "🏆 금일 목표달성 축하",
            style: "yellow",
          },
          {
            type: "text",
            text: "🎉 오늘 하루도 목표를 향해 최선을 다한\n당신, 정말 대단합니다!",
            inlines: [
              {
                type: "styled",
                text: "🎉 오늘 하루도 목표를 향해 최선을 다한\n당신, 정말 대단합니다!",
                bold: true,
              },
            ],
          },
          { type: "divider" },
        ];

        for (const achiever of achievers) {
          const memberEmail = getMentionEmail(achiever.name);
          const memberUid = memberEmail ? await findUserIdByEmail(appKey, memberEmail) : null;

          if (memberUid) {
            cBlocks.push({
              type: "text",
              text: `🎯 @${achiever.name} ${achiever.title} — 금일 목표달성!`,
              inlines: [
                { type: "styled", text: "🎯 " },
                {
                  type: "mention",
                  text: `@${achiever.name}`,
                  ref: { type: "kw", value: Number(memberUid) },
                },
                {
                  type: "styled",
                  text: ` ${achiever.title} — 금일 목표달성!`,
                  bold: true,
                },
              ],
            });
          } else {
            cBlocks.push({
              type: "text",
              text: `🎯 ${achiever.name} ${achiever.title} — 금일 목표달성!`,
            });
          }
        }

        cBlocks.push({ type: "divider" });
        cBlocks.push({
          type: "text",
          text: `"${todayQuote}"`,
          inlines: [
            {
              type: "styled",
              text: `"${todayQuote}"`,
              italic: true,
              color: "grey",
            },
          ],
        });

        await sendMessage(
          appKey,
          convId,
          `🏆 금일 목표달성 축하 | ${achievers.map((item) => item.name).join(", ")}`,
          cBlocks,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      hour,
      date: today,
      resultMode: "realtime_contacts_auto_aggregate",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "알 수 없는 오류",
      },
      { status: 500 },
    );
  }
}
