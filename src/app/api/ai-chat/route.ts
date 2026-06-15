import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_KEY = process.env.GOOGLE_AI_KEY || process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY;

type AnyRow = Record<string, any>;

type ChatMessage = {
  role: string;
  content: string;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKstNow() {
  return new Date(Date.now() + KST_OFFSET_MS);
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayKey() {
  return toDateKey(getKstNow());
}

function getWeekRange() {
  const now = getKstNow();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diff);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return { start: toDateKey(mon), end: toDateKey(sun) };
}

function getMonthRange() {
  const now = getKstNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0));
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`,
    label: `${y}년 ${m}월`,
  };
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const raw = String(value).slice(0, 10);
  const dt = new Date(`${raw}T00:00:00+09:00`);
  if (Number.isNaN(dt.getTime())) return raw;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일(${days[dt.getDay()]})`;
}

function fmtMoney(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0원";
  return `${Math.round(n).toLocaleString()}원`;
}

function compact(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstValue(row: AnyRow, keys: string[], fallback: unknown = null) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return fallback;
}

function daysSince(dateValue?: string | null) {
  if (!dateValue) return 9999;
  const raw = String(dateValue).slice(0, 10);
  const target = new Date(`${raw}T00:00:00+09:00`).getTime();
  if (Number.isNaN(target)) return 9999;
  const today = new Date(`${getTodayKey()}T00:00:00+09:00`).getTime();
  return Math.floor((today - target) / (24 * 60 * 60 * 1000));
}

async function readTable(table: string, limit = 300): Promise<AnyRow[]> {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    if (error) {
      console.warn(`[JARVIS] ${table} load failed:`, error.message);
      return [];
    }
    return (data || []) as AnyRow[];
  } catch (error: any) {
    console.warn(`[JARVIS] ${table} exception:`, error?.message || error);
    return [];
  }
}

function sortByDateDesc(rows: AnyRow[], keys: string[]) {
  return [...rows].sort((a, b) => {
    const av = firstValue(a, keys, "") as string;
    const bv = firstValue(b, keys, "") as string;
    return String(bv).localeCompare(String(av));
  });
}

function sortByDateAsc(rows: AnyRow[], keys: string[]) {
  return [...rows].sort((a, b) => {
    const av = firstValue(a, keys, "") as string;
    const bv = firstValue(b, keys, "") as string;
    return String(av).localeCompare(String(bv));
  });
}

async function callAI(systemPrompt: string, messages: ChatMessage[]) {
  if (!API_KEY) return { reply: null, error: "API 키 없음" };

  try {
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            maxOutputTokens: 2200,
            temperature: 0.25,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { reply: null, error: `Gemini ${res.status}: ${errText.substring(0, 500)}` };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join("\n") || "";
    return { reply: text || null, error: text ? null : "빈 응답" };
  } catch (error: any) {
    return { reply: null, error: `Gemini 예외: ${error?.message || error}` };
  }
}

function buildContactSummary(contacts: AnyRow[]) {
  const resultCount: Record<string, number> = {};
  const assignCount: Record<string, number> = {};
  const prospectCount: Record<string, number> = {};

  contacts.forEach((row) => {
    const meetingResult = compact(firstValue(row, ["meeting_result", "status"], ""), "");
    const assignedTo = compact(firstValue(row, ["assigned_to", "owner_name", "manager"], ""), "");
    const prospectType = compact(firstValue(row, ["prospect_type", "grade", "auto_grade"], ""), "");
    if (meetingResult) resultCount[meetingResult] = (resultCount[meetingResult] || 0) + 1;
    if (assignedTo) assignCount[assignedTo] = (assignCount[assignedTo] || 0) + 1;
    if (prospectType) prospectCount[prospectType] = (prospectCount[prospectType] || 0) + 1;
  });

  return [
    "## 고객 현황",
    `총 고객: ${contacts.length}명`,
    `미팅결과별: ${Object.entries(resultCount).map(([k, v]) => `${k} ${v}명`).join(", ") || "데이터 없음"}`,
    `가망/등급별: ${Object.entries(prospectCount).map(([k, v]) => `${k} ${v}명`).join(", ") || "데이터 없음"}`,
    `담당자별: ${Object.entries(assignCount).map(([k, v]) => `${k} ${v}명`).join(", ") || "데이터 없음"}`,
  ];
}

function buildInactiveCustomers(contacts: AnyRow[], notes: AnyRow[]) {
  const latestNoteByContact = new Map<number, AnyRow>();

  sortByDateDesc(notes, ["note_date", "created_at", "updated_at"]).forEach((note) => {
    const contactId = Number(note.contact_id);
    if (contactId && !latestNoteByContact.has(contactId)) latestNoteByContact.set(contactId, note);
  });

  const inactive = contacts
    .map((contact) => {
      const id = Number(contact.id);
      const latestNote = id ? latestNoteByContact.get(id) : null;
      const latestDate = compact(firstValue(latestNote || {}, ["note_date", "created_at", "updated_at"], ""), "");
      const fallbackDate = compact(firstValue(contact, ["updated_at", "created_at", "meeting_date", "contract_date"], ""), "");
      const baseDate = latestDate || fallbackDate;
      const result = compact(firstValue(contact, ["meeting_result", "status"], ""), "");
      return {
        contact,
        latestNote,
        latestDate: baseDate,
        inactiveDays: daysSince(baseDate),
        result,
      };
    })
    .filter((item) => !["탈퇴", "이탈", "계약완료"].includes(item.result))
    .sort((a, b) => b.inactiveDays - a.inactiveDays)
    .slice(0, 15);

  const lines = ["\n## 관리 누락 가능 고객 TOP 15"];
  if (inactive.length === 0) {
    lines.push("- 관리 누락 후보를 계산할 수 있는 고객/활동노트 데이터가 부족합니다.");
    return lines;
  }

  inactive.forEach(({ contact, latestNote, latestDate, inactiveDays }) => {
    const name = compact(firstValue(contact, ["name", "member_name"]));
    const title = compact(firstValue(contact, ["title", "position"], ""), "");
    const assignedTo = compact(firstValue(contact, ["assigned_to", "owner_name", "manager"]));
    const prospect = compact(firstValue(contact, ["prospect_type", "grade", "auto_grade"]));
    const result = compact(firstValue(contact, ["meeting_result", "status"]));
    const noteText = compact(firstValue(latestNote || {}, ["content", "memo"], ""), "").slice(0, 80);
    const dayLabel = inactiveDays >= 9999 ? "활동기록 없음" : `${inactiveDays}일 경과`;
    lines.push(`- ${name}${title ? ` ${title}` : ""} | 담당: ${assignedTo} | 가망/등급: ${prospect} | 상태: ${result} | 최근활동: ${latestDate ? fmtDate(latestDate) : "-"} (${dayLabel}) | 최근노트: ${noteText || "-"}`);
  });

  return lines;
}

function buildScheduleContext(contacts: AnyRow[], events: AnyRow[], trucks: AnyRow[]) {
  const today = getTodayKey();
  const week = getWeekRange();
  const lines: string[] = [];

  const weekEvents = sortByDateAsc(
    events.filter((event) => {
      const date = compact(firstValue(event, ["date", "event_date", "start_date"], ""), "").slice(0, 10);
      return date >= week.start && date <= week.end;
    }),
    ["date", "event_date", "start_date"]
  ).slice(0, 30);

  const weekTrucks = sortByDateAsc(
    trucks.filter((truck) => {
      const date = compact(firstValue(truck, ["dispatch_date", "date", "event_date"], ""), "").slice(0, 10);
      return date >= week.start && date <= week.end;
    }),
    ["dispatch_date", "date", "event_date"]
  ).slice(0, 30);

  const weekMeetings = sortByDateAsc(
    contacts.filter((contact) => {
      const date = compact(firstValue(contact, ["meeting_date"], ""), "").slice(0, 10);
      return date >= week.start && date <= week.end;
    }),
    ["meeting_date"]
  ).slice(0, 30);

  lines.push(`\n## 이번주 일정 (${fmtDate(week.start)} ~ ${fmtDate(week.end)})`);

  const todayItems: string[] = [];

  weekEvents.forEach((event) => {
    const date = compact(firstValue(event, ["date", "event_date", "start_date"]));
    const row = `- ${fmtDate(date)} | [캘린더] ${compact(firstValue(event, ["event_type", "type"]))} | ${compact(firstValue(event, ["title", "name"]))} | 담당: ${compact(firstValue(event, ["author", "owner_name", "assigned_to"]))}`;
    lines.push(row);
    if (String(date).slice(0, 10) === today) todayItems.push(row);
  });

  weekTrucks.forEach((truck) => {
    const date = compact(firstValue(truck, ["dispatch_date", "date", "event_date"]));
    const row = `- ${fmtDate(date)} | [완판트럭] ${compact(firstValue(truck, ["site_name", "title", "name"]))} | 위치: ${compact(firstValue(truck, ["location", "address"]))} | 대행사: ${compact(firstValue(truck, ["agency", "agency_name"]))} | 인원: ${compact(firstValue(truck, ["team_size", "member_count"]))}명 | 발주: ${firstValue(truck, ["is_ordered"], false) ? "완료" : "미완료"}`;
    lines.push(row);
    if (String(date).slice(0, 10) === today) todayItems.push(row);
  });

  weekMeetings.forEach((contact) => {
    const date = compact(firstValue(contact, ["meeting_date"]));
    const row = `- ${fmtDate(date)} | [고객미팅] ${compact(firstValue(contact, ["name", "member_name"]))} ${compact(firstValue(contact, ["title", "position"], ""), "")} | 담당: ${compact(firstValue(contact, ["assigned_to", "manager"]))} | 장소: ${compact(firstValue(contact, ["meeting_location", "location"]))}`;
    lines.push(row);
    if (String(date).slice(0, 10) === today) todayItems.push(row);
  });

  if (weekEvents.length + weekTrucks.length + weekMeetings.length === 0) lines.push("- 이번주 등록 일정 없음");

  lines.push(`\n## 오늘 일정 (${fmtDate(today)})`);
  if (todayItems.length === 0) lines.push("- 오늘 등록된 일정 없음");
  else todayItems.slice(0, 15).forEach((line) => lines.push(line));

  return lines;
}

function buildSalesContext(sales: AnyRow[], externalPayments: AnyRow[]) {
  const month = getMonthRange();
  const monthSales = sales.filter((sale) => {
    const date = compact(firstValue(sale, ["payment_date", "paid_at", "created_at", "execution_date"], ""), "").slice(0, 10);
    return date >= month.start && date <= month.end;
  });

  const channelMap: Record<string, { count: number; amount: number }> = {};
  const managerMap: Record<string, { count: number; amount: number }> = {};
  let total = 0;

  monthSales.forEach((sale) => {
    const amount = Number(firstValue(sale, ["vat_amount", "execution_amount", "amount", "price"], 0) || 0);
    total += amount;
    const channel = compact(firstValue(sale, ["channel", "sales_channel", "product_type"], "기타"));
    const manager = compact(firstValue(sale, ["team_member", "assigned_to", "manager", "owner_name"], "미지정"));
    if (!channelMap[channel]) channelMap[channel] = { count: 0, amount: 0 };
    if (!managerMap[manager]) managerMap[manager] = { count: 0, amount: 0 };
    channelMap[channel].count += 1;
    channelMap[channel].amount += amount;
    managerMap[manager].count += 1;
    managerMap[manager].amount += amount;
  });

  const lines = [`\n## ${month.label} 매출 현황`];
  lines.push(`총 ${monthSales.length}건, 총액 ${fmtMoney(total)}`);

  lines.push("\n담당자별 매출:");
  const managerEntries = Object.entries(managerMap).sort((a, b) => b[1].amount - a[1].amount);
  if (managerEntries.length === 0) lines.push("- 데이터 없음");
  managerEntries.forEach(([name, value]) => lines.push(`- ${name}: ${value.count}건, ${fmtMoney(value.amount)}`));

  lines.push("\n채널별 매출:");
  const channelEntries = Object.entries(channelMap).sort((a, b) => b[1].amount - a[1].amount);
  if (channelEntries.length === 0) lines.push("- 데이터 없음");
  channelEntries.forEach(([name, value]) => lines.push(`- ${name}: ${value.count}건, ${fmtMoney(value.amount)}`));

  const recentSales = sortByDateDesc(monthSales, ["payment_date", "paid_at", "created_at", "execution_date"]).slice(0, 15);
  lines.push("\n최근 매출 상세:");
  if (recentSales.length === 0) lines.push("- 데이터 없음");
  recentSales.forEach((sale) => {
    const date = compact(firstValue(sale, ["payment_date", "paid_at", "created_at", "execution_date"]));
    const name = compact(firstValue(sale, ["member_name", "customer_name", "name"]));
    const amount = Number(firstValue(sale, ["vat_amount", "execution_amount", "amount", "price"], 0) || 0);
    lines.push(`- ${fmtDate(date)} | ${name} | ${compact(firstValue(sale, ["channel", "sales_channel", "product_type"]))} | ${fmtMoney(amount)} | 담당: ${compact(firstValue(sale, ["team_member", "assigned_to", "manager", "owner_name"]))}`);
  });

  const paymentRows = externalPayments.slice(0, 300);
  const cancelRows = paymentRows.filter((row) => firstValue(row, ["cancel_completed_at", "cancel_completed_datetime", "cancel_date", "canceled_at"], null));
  if (paymentRows.length > 0) {
    lines.push("\n외부 결제자료 참고:");
    lines.push(`- 외부 결제자료 ${paymentRows.length}건 중 취소/환불 관련값 보유 ${cancelRows.length}건`);
    cancelRows.slice(0, 10).forEach((row) => {
      const name = compact(firstValue(row, ["customer_name", "member_name", "buyer_name", "name"]));
      const paidAt = compact(firstValue(row, ["payment_completed_at", "paid_at", "payment_date", "created_at"]));
      const canceledAt = compact(firstValue(row, ["cancel_completed_at", "cancel_completed_datetime", "cancel_date", "canceled_at"]));
      const amount = firstValue(row, ["amount", "payment_amount", "total_amount", "price"], 0);
      const sameDay = String(paidAt).slice(0, 10) && String(paidAt).slice(0, 10) === String(canceledAt).slice(0, 10);
      lines.push(`- ${name} | 결제: ${paidAt || "-"} | 취소: ${canceledAt || "-"} | ${fmtMoney(amount)} | 구분추정: ${sameDay ? "당일취소" : "환불 가능성"}`);
    });
  }

  return lines;
}

function buildTasksContext(tasks: AnyRow[]) {
  const recent = sortByDateDesc(tasks, ["created_at", "request_date", "date"]).slice(0, 20);
  const statusCount: Record<string, number> = {};
  recent.forEach((task) => {
    const status = compact(firstValue(task, ["status", "state"], "미지정"));
    statusCount[status] = (statusCount[status] || 0) + 1;
  });

  const lines = ["\n## 최근 업무요청"];
  lines.push(`상태별: ${Object.entries(statusCount).map(([k, v]) => `${k} ${v}건`).join(", ") || "데이터 없음"}`);
  if (recent.length === 0) {
    lines.push("- 업무요청 데이터 없음");
    return lines;
  }

  recent.forEach((task) => {
    const date = compact(firstValue(task, ["created_at", "request_date", "date"]));
    const requester = compact(firstValue(task, ["requester", "requester_name", "author"]));
    const assignee = compact(firstValue(task, ["assignee", "assignee_name", "owner_name"]));
    const category = compact(firstValue(task, ["category", "type"]));
    const status = compact(firstValue(task, ["status", "state"]));
    const content = compact(firstValue(task, ["content", "title", "memo", "description"], ""), "").slice(0, 100);
    lines.push(`- ${fmtDate(date)} | ${requester} → ${assignee} | [${category}] ${status} | ${content || "-"}`);
  });

  return lines;
}

function buildRecentNotesContext(notes: AnyRow[], contacts: AnyRow[]) {
  const contactById = new Map<number, AnyRow>();
  contacts.forEach((contact) => {
    const id = Number(contact.id);
    if (id) contactById.set(id, contact);
  });

  const recent = sortByDateDesc(notes, ["note_date", "created_at", "updated_at"]).slice(0, 20);
  const lines = ["\n## 최근 활동노트 / 통화요약"];
  if (recent.length === 0) {
    lines.push("- 활동노트 데이터 없음");
    return lines;
  }

  recent.forEach((note) => {
    const contact = contactById.get(Number(note.contact_id));
    const name = compact(firstValue(contact || {}, ["name", "member_name"], "미확인 고객"));
    const assigned = compact(firstValue(contact || {}, ["assigned_to", "manager", "owner_name"], "-"));
    const date = compact(firstValue(note, ["note_date", "created_at", "updated_at"]));
    const author = compact(firstValue(note, ["author", "created_by"], "-"));
    const content = compact(firstValue(note, ["content", "summary", "memo"], ""), "").slice(0, 120);
    lines.push(`- ${fmtDate(date)} | ${name} | 담당: ${assigned} | 작성: ${author} | ${content || "-"}`);
  });

  return lines;
}

function buildGoalsContext(goals: AnyRow[]) {
  const today = getTodayKey();
  const todayGoals = goals.filter((goal) => String(firstValue(goal, ["work_date", "date", "goal_date"], "")).slice(0, 10) === today);
  const lines = [`\n## 오늘 활동목표 (${fmtDate(today)})`];
  if (todayGoals.length === 0) {
    lines.push("- 오늘 활동목표 데이터 없음");
    return lines;
  }

  todayGoals.slice(0, 20).forEach((goal) => {
    const owner = compact(firstValue(goal, ["owner_name", "name", "user_name"]));
    const outside = firstValue(goal, ["is_outside_meeting"], false) ? "외근" : "내근";
    const raw = Object.entries(goal)
      .filter(([key, value]) => value !== null && value !== undefined && !["id", "created_at", "updated_at", "work_date"].includes(key))
      .slice(0, 8)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" / ");
    lines.push(`- ${owner} | ${outside} | ${raw}`);
  });

  return lines;
}

async function buildContext(question: string, task?: string | null) {
  const [contacts, notes, sales, events, trucks, tasks, goals, externalPayments] = await Promise.all([
    readTable("contacts", 1000),
    readTable("contact_notes", 1000),
    readTable("ad_executions", 1000),
    readTable("calendar_events", 500),
    readTable("wanpan_trucks", 500),
    readTable("tasks", 500),
    readTable("daily_activity_goals", 300),
    readTable("external_payment_records", 500),
  ]);

  const q = `${question} ${task || ""}`.toLowerCase();
  const lines: string[] = [];

  lines.push(...buildContactSummary(contacts));
  lines.push(...buildScheduleContext(contacts, events, trucks));
  lines.push(...buildSalesContext(sales, externalPayments));
  lines.push(...buildTasksContext(tasks));
  lines.push(...buildRecentNotesContext(notes, contacts));
  lines.push(...buildGoalsContext(goals));

  if (
    q.includes("관리") ||
    q.includes("누락") ||
    q.includes("뜸") ||
    q.includes("inactive") ||
    q.includes("priority") ||
    q.includes("브리핑") ||
    q.includes("today_briefing") ||
    q.includes("inactive_customers") ||
    q.includes("priority_actions")
  ) {
    lines.push(...buildInactiveCustomers(contacts, notes));
  }

  const matchedNames = contacts
    .filter((contact) => {
      const name = compact(firstValue(contact, ["name", "member_name"], ""), "");
      return name.length >= 2 && (q.includes(name.toLowerCase()) || q.includes(name.slice(0, 2).toLowerCase()));
    })
    .slice(0, 15);

  if (matchedNames.length > 0) {
    lines.push("\n## 질문과 이름이 매칭된 고객");
    matchedNames.forEach((contact) => {
      lines.push(
        `- ${compact(firstValue(contact, ["name", "member_name"]))} ${compact(firstValue(contact, ["title", "position"], ""), "")} | 담당: ${compact(firstValue(contact, ["assigned_to", "manager", "owner_name"]))} | 가망/등급: ${compact(firstValue(contact, ["prospect_type", "grade", "auto_grade"]))} | 미팅결과: ${compact(firstValue(contact, ["meeting_result", "status"]))} | 미팅일: ${fmtDate(compact(firstValue(contact, ["meeting_date"], ""), ""))} | 연락처: ${compact(firstValue(contact, ["phone", "mobile"]))}`
      );
    });
  }

  return lines.join("\n");
}

function getTaskGuide(task?: string | null) {
  if (!task) return "일반 질문으로 판단하고, 질문과 가장 관련 높은 CRM 데이터만 중심으로 답변한다.";

  const guides: Record<string, string> = {
    today_briefing:
      "오늘 브리핑 모드다. 오늘 일정, 이번주 일정, 관리 누락 고객, 이번달 매출, 최근 업무요청, 완판트럭, 활동목표를 한 번에 요약하고 마지막에 오늘 우선순위 TOP 5를 제안한다.",
    inactive_customers:
      "관리 누락 고객 모드다. 활동노트/최근활동 기준으로 관리가 필요한 고객을 담당자별로 분류하고, 각 고객별 후속 연락 방향을 제안한다.",
    sales_analysis:
      "매출 분석 모드다. 이번달 매출을 담당자별/채널별로 정리하고, 특이사항과 추가 확인 포인트를 제시한다.",
    task_summary:
      "업무요청 요약 모드다. 최근 업무요청을 요청자/담당자/상태별로 정리하고 미처리 우선순위를 제시한다.",
    wanpan_schedule:
      "완판트럭 일정 모드다. 이번주 및 최근 완판트럭 일정과 발주/인원/현장 확인 포인트를 정리한다.",
    calendar_review:
      "일정 점검 모드다. 캘린더, 고객미팅, 완판트럭 일정을 날짜순으로 정리하고 담당자별 체크포인트를 제시한다.",
    priority_actions:
      "우선순위 추천 모드다. 고객관리, 매출, 일정, 업무요청을 종합해서 지금 처리해야 할 순서대로 제안한다.",
  };

  return guides[task] || "일반 질문으로 판단하고, 질문과 가장 관련 높은 CRM 데이터만 중심으로 답변한다.";
}

export async function POST(req: Request) {
  try {
    const { message, history, task, user } = await req.json();
    if (!message) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
    if (!API_KEY) return NextResponse.json({ error: "AI API 키가 설정되지 않았습니다." }, { status: 500 });

    const crmData = await buildContext(message, task);
    const today = getKstNow();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const todayStr = `${today.getUTCFullYear()}년 ${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일 (${dayNames[today.getUTCDay()]}요일)`;
    const userName = compact(user?.name, "현재 사용자");
    const userTitle = compact(user?.title, "");

    const needsBunyanghoeKnowledge =
    message.toLowerCase().includes("분양회") ||
    message.toLowerCase().includes("vip") ||
    message.toLowerCase().includes("모집") ||
    message.toLowerCase().includes("멤버십") ||
    message.toLowerCase().includes("110") ||
    message.toLowerCase().includes("55만") ||
    message.toLowerCase().includes("스크립트") ||
    message.toLowerCase().includes("브리핑") ||
    message.toLowerCase().includes("등급") ||
    message.toLowerCase().includes("마스터") ||
    message.toLowerCase().includes("챌린저") ||
    message.toLowerCase().includes("브론즈") ||
    message.toLowerCase().includes("완판트럭") ||
    message.toLowerCase().includes("특전") ||
    message.toLowerCase().includes("광고특전") ||
    message.toLowerCase().includes("설득") ||
    message.toLowerCase().includes("거절") ||
    message.toLowerCase().includes("파이프라인") ||
    message.toLowerCase().includes("crm") ||
    (task === "today_briefing") ||
    (task === "inactive_customers") ||
    (task === "priority_actions");

  const systemPrompt = \`너는 광고인X분양의신 CRM 안에서 동작하는 AI 운영 에이전트 "JARVIS(자비스)"다.
너는 CRM 화면 오른쪽 하단에 상주하는 AI 비서이며, 사용자는 \${userName}\${userTitle ? \` \${userTitle}\` : ""}이다.

반드시 한국어로만 답변한다.

현재 날짜: \${todayStr}
현재 작업 모드: \${getTaskGuide(task)}

팀 기준:
- 대표이사: 문시욱
- 관리자: 김정후 본부장, 김창완 팀장, 최웅 파트장
- 실행파트: 조계현(메인), 이세호(어쏘), 기여운(어쏘), 최연전(CX)
- 운영파트: 김재영(어시), 최은정(어시)

별칭 매핑:
- 계현, 조메인 → 조계현
- 세호 → 이세호
- 여운 → 기여운
- 연전 → 최연전
- 재영 → 김재영
- 은정 → 최은정

답변 규칙:
1. CRM DATA와 분양회 지식베이스에 있는 사실만 근거로 답변한다. 데이터가 없으면 "해당 데이터는 CRM에서 확인되지 않습니다."라고 말한다.
2. 숫자, 금액, 날짜, 담당자 이름은 가능한 한 구체적으로 쓴다.
3. 사용자가 업무 판단을 쉽게 하도록 "요약 → 상세 → 다음 액션" 순서로 정리한다.
4. 오늘 브리핑이나 우선순위 요청이면 마지막에 "자비스 추천 우선순위"를 3~5개 제안한다.
5. 관리 누락 고객은 담당자별로 묶고, 각 고객별 후속 연락 문구 또는 조치 방향을 짧게 제안한다.
6. 매출 분석은 담당자별/채널별/최근 상세를 분리해서 정리한다.
7. 업무요청은 미처리·진행중·완료를 구분해서 정리한다.
8. CRM 데이터를 수정하거나 전송했다고 말하지 않는다. 현재 자비스는 읽기/분석 전용이다.
9. 모르는 내용은 추측하지 않는다.
10. 고객 응대 스크립트나 분양회 관련 조언 시 "분양회 지식베이스"를 반드시 참고한다.
11. 분양회 관련 답변 시 "가입" 대신 "모집·참여 검토", "혜택" 대신 "서포트" 표현을 사용한다.
12. 답변은 실제 업무자가 바로 볼 수 있게 간결하게 정리한다.
\${needsBunyanghoeKnowledge ? \`
분양회 지식베이스:

## ════════════════════════════════════════
## 분양회 & 광고인 CRM 핵심 지식베이스
## ════════════════════════════════════════

### [A] 분양회 본질 정의
- 분양회는 광고 할인 상품이 아니다. 리워드·포인트 상품도 아니다.
- 분양회 = 팀장·본부장·총괄본부장급 상위 1% 분양 리더를 선점하여 좋은 현장·팀원·브랜딩을 연결하는 VIP 성장 네트워크
- 핵심 슬로건: "광고회사 차리지 마세요, 분양회 가입하세요."
- 월회비: 55만원(얼리버드) → 110만원(정식 운영가 7월 전환)

### [B] 모집 기준
- 대상: 총괄본부장 > 본부장 > 팀장
- 제외: 각개팀장 이하 (실장·부장·주임·경력 상담사 포함)
- 핵심 조건: 팀원 모집·조직 성장 욕구가 있는 사람 / 월 100만원을 투자로 이해하는 사람
- 권유 불필요 고객: 광고할인만 원하는 고객, 페이백 기대 고객

### [C] 3대 특전
1. 광고특전: 광고회사 가격으로 공식 견적서 제공 (LMS, 호갱노노). 리워드·페이백 표현 절대 금지
2. 홍보특전: 취재아티클, 인터뷰, 매거진, 퍼스널 브랜딩 (팀원이 찾아오게 만들기)
3. 네트워킹특전: 컨퍼런스, 대행사 접점, 상위 리더 네트워크

### [D] 금지어 & 대체 표현
- 가입 → 모집/참여 검토/선정
- 혜택 → 서포트
- 광고 할인 → 광고 운영 서포트
- 누구나 가능 → 기준 해당 시 검토 가능
- 사람 구해드림 → 조건 확인 후 연결 가능성 검토
핵심 태도: 부탁하지 않는다. 고객이 아쉬워야 한다.

### [E] 고객 응대 6단계 흐름
1. 분양의신 권위 설정 (12년, 25,000명)
2. 팀장/본부장급 여부 확인
3. 조직 수/현장/팀원 모집 니즈 확인
4. 필요한 서포트 먼저 보여주기
5. 분양회 모집 기준 해당 여부 검토
6. 필요성이 생긴 뒤 분양회 자연 연결

### [F] 기고객 110만원 전환 설득 논리 (금액 환산 순서)
1. 직원용 홈페이지: 개당 20~30만원 (10명=200~300만원, 20명=400~600만원)
2. 광고특전+포인트: 광고 집행액 큰 고객 전용
3. 구인구직 유료 노출: 분양라인 상단 노출 대비
4. SMS 반값문자: 월 발송량 기준 절감액 계산 (현재 안정화 중 표현 필수)
5. 디자인 시안물: 현수막·전단지·삽지·통돌이
- 브랜딩·컨퍼런스·네트워킹은 보조 가치로만 사용
- 금지: "월회비가 다 상계됩니다" / "무조건 다 드립니다" / "바로 사용 가능합니다"

### [G] 시장 수치
- 분양상담사 전체: 50,000명 (활성 35,000명)
- 골드 세그먼트(타겟): 10,476명 (본부장 972 + 팀장 4,860 + 각개팀장 4,644)
- 분양회 100명 = 골드 세그먼트 상위 1% 선점

### [H] CRM 운영 로직
고객 흐름: 고객DB → 첫접촉(TM/콜드톡) → VIP심사 → VIP활동DB 이관 → 관리구간(리드>프로스펙팅>딜클로징>리텐션)

메뉴별 역할:
- 대시보드: 영업 퍼널 KPI + 오늘 챙겨야 할 고객 알림 (결제임박/결제누락/재TM예정/장기미활동/클로징지연)
- 고객DB: TM/콜드톡 원천 DB, 재TM 예정일([재TM일:YYYY-MM-DD] 태그), VIP이관 심사
- VIP활동DB(파이프라인3): VIP 회원 파이프라인, 활동노트, 미팅일정(미팅일/장소/목적), 결제정보
- 통합매출관리: 분양회비·광고 매출 (사이다페이·효성CMS 자동연동)
- 완판트럭: 현장 방문 일정·발주·리포트
- 운영캘린더: 팀 공용 (미팅/연차/완판트럭/커스텀 일정 자동 반영)
- 결제&업무요청: 전자결재 (연차·반차·결제·환불·페이백 요청서)
- 일별활동기록: 개인 TM/콜드톡/DB확보 목표·달성 기록

등급 체계: 마스터(본부장급 이상) > 챌린저(팀장급) > 브론즈 > 심사미진행

자동화:
- 사이다페이 크론: 5분마다 신규 결제 감지 → CRM 저장 → 카카오워크 매출방 자동 알림 (N회차 포함)
- 효성CMS: 엑셀 업로드 → 자동 매칭 → CRM 저장 → 카카오워크 알림
- 녹취록 자동요약: Google Drive 녹음 → AI 요약 → 활동노트 자동 등록 (매일 0시 크론)
- 카카오워크 봇: 오전 업무 리마인더, 30분 활동 알림, 진행상황 리포트

대외협력팀 KPI:
- 분양회 VIP 100명 모집 목표 (현재 진행 중)
- 완판트럭 월 6~8회 (회당 100~200명 접촉)
- 취재아티클 누적 생산
- 광고연계매출은 대외협력팀 KPI 제외

분신 유니버스 로드맵:
- 2026.05: 제1회 분신 컨퍼런스 + 분양의신 앱/웹 런칭 완료
- 2026.06: 광주 투자진흥지구 본사 이전
- 2026년 말: 분양회 VIP 100명 + 프리미엄 대행사 27개사

### [I] 자비스 답변 시 반드시 지킬 것
- "가입" 대신 "모집/참여 검토" 사용
- 분양회를 광고 할인 상품으로 설명 금지
- 페이백·리워드·포인트 지급 표현 금지
- 고객 응대 스크립트 제안 시 "부탁하는 말투" 금지
- 110만원 설득 시 고객별 맞춤 계산 항목 제시

\` : ""}

CRM DATA:
\${crmData}\`;

    const chatMessages: ChatMessage[] = [];
    if (history && Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item?.role && item?.content) chatMessages.push({ role: item.role, content: item.content });
      }
    }
    chatMessages.push({ role: "user", content: message });

    const result = await callAI(systemPrompt, chatMessages);

    if (!result.reply) {
      return NextResponse.json({ error: `AI 응답 실패: ${result.error}` }, { status: 500 });
    }

    return NextResponse.json({ reply: result.reply });
  } catch (error: any) {
    console.error("JARVIS AI Chat error:", error);
    return NextResponse.json({ error: error?.message || "서버 오류" }, { status: 500 });
  }
}
