import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_KEY = process.env.GOOGLE_AI_KEY || process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY;

// Google Gemini API 호출
async function callAI(systemPrompt: string, messages: { role: string; content: string }[]) {
  if (!API_KEY) return { reply: null, error: "API 키 없음" };
  try {
    const contents = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 1500, temperature: 0.3 },
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      return { reply: null, error: `Gemini ${res.status}: ${errText.substring(0, 200)}` };
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return { reply: text || null, error: text ? null : "빈 응답" };
  } catch (e: any) {
    return { reply: null, error: `Gemini 예외: ${e.message}` };
  }
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: mon.toISOString().split("T")[0], end: sun.toISOString().split("T")[0] };
}

function getMonthRange() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`,
    label: `${y}년 ${m}월`,
  };
}

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일(${days[dt.getDay()]})`;
}

function fmtMoney(n: number) { return n.toLocaleString() + "원"; }

async function buildContext(question: string) {
  const q = question.toLowerCase();
  const week = getWeekRange();
  const month = getMonthRange();
  const lines: string[] = [];

  // ── 항상 포함: 고객 요약 ──
  const { data: contacts } = await supabase.from("contacts")
    .select("name,title,assigned_to,consultant,prospect_type,meeting_result,meeting_date,meeting_location,bunyanghoe_number,contract_date,phone")
    .limit(500);
  const c = contacts || [];
  const resultCount: Record<string, number> = {};
  const assignCount: Record<string, number> = {};
  const prospectCount: Record<string, number> = {};
  c.forEach((x: any) => {
    if (x.meeting_result) resultCount[x.meeting_result] = (resultCount[x.meeting_result] || 0) + 1;
    if (x.assigned_to) assignCount[x.assigned_to] = (assignCount[x.assigned_to] || 0) + 1;
    if (x.prospect_type) prospectCount[x.prospect_type] = (prospectCount[x.prospect_type] || 0) + 1;
  });

  lines.push("## 고객 현황");
  lines.push(`총 고객: ${c.length}명`);
  lines.push(`미팅결과별: ${Object.entries(resultCount).map(([k, v]) => `${k} ${v}명`).join(", ")}`);
  lines.push(`가망구분별: ${Object.entries(prospectCount).map(([k, v]) => `${k} ${v}명`).join(", ")}`);
  lines.push(`담당자별: ${Object.entries(assignCount).map(([k, v]) => `${k} ${v}명`).join(", ")}`);

  // ── 특정 사람 이름이 질문에 포함된 경우 ──
  const nameMatches = c.filter((x: any) => {
    const name = x.name || "";
    return name.length >= 2 && (q.includes(name) || q.includes(name.substring(0, 2)));
  });
  if (nameMatches.length > 0 && nameMatches.length <= 15) {
    lines.push("\n## 이름 매칭 고객");
    nameMatches.forEach((x: any) => {
      lines.push(`- ${x.name} (${x.title || "-"}) | 담당: ${x.assigned_to || "-"} | 컨설턴트: ${x.consultant || "-"} | 가망: ${x.prospect_type || "-"} | 미팅결과: ${x.meeting_result || "-"} | 미팅일: ${x.meeting_date || "-"} | 미팅지역: ${x.meeting_location || "-"} | 넘버링: ${x.bunyanghoe_number || "-"} | 계약일: ${x.contract_date || "-"} | 연락처: ${x.phone || "-"}`);
    });
  }

  // ── 일정 (항상 이번주 포함) ──
  // 캘린더 이벤트
  const { data: weekEvents } = await supabase.from("calendar_events")
    .select("date,event_type,title,content,author").gte("date", week.start).lte("date", week.end).order("date");
  // 완판트럭 (이번주)
  const { data: weekTrucks } = await supabase.from("wanpan_trucks")
    .select("dispatch_date,location,site_name,agency,staff_members,consultant_members,team_size")
    .gte("dispatch_date", week.start).lte("dispatch_date", week.end).order("dispatch_date");
  // 미팅 예정 (이번주, contacts)
  const weekMeetings = c.filter((x: any) => x.meeting_date && x.meeting_date >= week.start && x.meeting_date <= week.end);

  const hasWeekData = (weekEvents && weekEvents.length > 0) || (weekTrucks && weekTrucks.length > 0) || weekMeetings.length > 0;
  if (hasWeekData) {
    lines.push(`\n## 이번주 일정 (${fmtDate(week.start)} ~ ${fmtDate(week.end)})`);
    weekEvents?.forEach((e: any) => {
      lines.push(`- ${fmtDate(e.date)} | [캘린더] ${e.event_type} | ${e.title || ""} | 담당: ${e.author || "-"}`);
    });
    weekTrucks?.forEach((t: any) => {
      lines.push(`- ${fmtDate(t.dispatch_date)} | [완판트럭] ${t.site_name || "-"} | 위치: ${t.location || "-"} | 대행사: ${t.agency || "-"} | 인원: ${t.team_size || "-"}명 | 직원: ${t.staff_members || "-"} | 컨설턴트: ${t.consultant_members || "-"}`);
    });
    weekMeetings.forEach((x: any) => {
      lines.push(`- ${fmtDate(x.meeting_date)} | [미팅] ${x.name} ${x.title || ""} | 담당: ${x.assigned_to || "-"} | 장소: ${x.meeting_location || "-"}`);
    });
  } else {
    lines.push(`\n## 이번주 일정: 등록된 일정 없음`);
  }

  // ── 이번달 일정 (키워드 매칭) ──
  if (q.includes("이번달") || q.includes("월") || q.includes("캘린더") || q.includes("전체")) {
    const { data: monthEvents } = await supabase.from("calendar_events")
      .select("date,event_type,title,author").gte("date", month.start).lte("date", month.end).order("date");
    const { data: monthTrucks } = await supabase.from("wanpan_trucks")
      .select("dispatch_date,location,site_name,agency,team_size,staff_members,consultant_members")
      .gte("dispatch_date", month.start).lte("dispatch_date", month.end).order("dispatch_date");
    if ((monthEvents && monthEvents.length > 0) || (monthTrucks && monthTrucks.length > 0)) {
      lines.push(`\n## 이번달 일정 (${month.label})`);
      monthEvents?.forEach((e: any) => {
        lines.push(`- ${fmtDate(e.date)} | [캘린더] ${e.event_type} | ${e.title || ""} | ${e.author || "-"}`);
      });
      monthTrucks?.forEach((t: any) => {
        lines.push(`- ${fmtDate(t.dispatch_date)} | [완판트럭] ${t.site_name || "-"} | ${t.location || "-"} | ${t.agency || "-"} | ${t.team_size || "-"}명`);
      });
    }
  }

  // ── 매출 (항상 이번달 요약 포함) ──
  const { data: sales } = await supabase.from("ad_executions")
    .select("member_name,execution_amount,vat_amount,channel,team_member,payment_date,consultant,contract_route,bunyanghoe_number")
    .gte("payment_date", month.start).lte("payment_date", month.end);
  if (sales && sales.length > 0) {
    const chMap: Record<string, { n: number; a: number }> = {};
    const tmMap: Record<string, { n: number; a: number }> = {};
    let totalAmt = 0;
    sales.forEach((s: any) => {
      const amt = (s.vat_amount && s.vat_amount !== s.execution_amount) ? s.vat_amount : (s.execution_amount || 0);
      totalAmt += amt;
      const ch = s.channel || "기타";
      if (!chMap[ch]) chMap[ch] = { n: 0, a: 0 }; chMap[ch].n++; chMap[ch].a += amt;
      const tm = s.team_member || "미지정";
      if (!tmMap[tm]) tmMap[tm] = { n: 0, a: 0 }; tmMap[tm].n++; tmMap[tm].a += amt;
    });

    lines.push(`\n## ${month.label} 매출 현황`);
    lines.push(`총 ${sales.length}건, 총액 ${fmtMoney(totalAmt)}`);
    lines.push(`\n채널별:`);
    Object.entries(chMap).forEach(([k, v]) => lines.push(`- ${k}: ${v.n}건, ${fmtMoney(v.a)}`));
    lines.push(`\n담당자별:`);
    Object.entries(tmMap).forEach(([k, v]) => lines.push(`- ${k}: ${v.n}건, ${fmtMoney(v.a)}`));

    // 최근 매출 상세 (20건)
    if (q.includes("매출") || q.includes("실적") || q.includes("집계") || q.includes("월회비") || q.includes("하이타") || q.includes("광고")) {
      lines.push(`\n최근 매출 상세:`);
      sales.slice(0, 20).forEach((s: any) => {
        const amt = (s.vat_amount && s.vat_amount !== s.execution_amount) ? s.vat_amount : (s.execution_amount || 0);
        lines.push(`- ${s.payment_date} | ${s.member_name || "-"} (${s.bunyanghoe_number || "-"}) | ${s.channel} | ${fmtMoney(amt)} | 담당: ${s.team_member || "-"} | 컨설턴트: ${s.consultant || "-"}`);
      });
    }
  } else {
    lines.push(`\n## ${month.label} 매출: 데이터 없음`);
  }

  // ── 분양회 입회자 ──
  if (q.includes("입회") || q.includes("분양회") || q.includes("계약") || q.includes("예약") || q.includes("넘버") || q.includes("B-") || q.includes("회원")) {
    const vip = c.filter((x: any) => ["계약완료", "예약완료"].includes(x.meeting_result));
    lines.push(`\n## 분양회 입회자 (${vip.length}명)`);
    lines.push(`계약완료: ${vip.filter((x: any) => x.meeting_result === "계약완료").length}명 | 예약완료: ${vip.filter((x: any) => x.meeting_result === "예약완료").length}명`);
    vip.forEach((x: any) => {
      lines.push(`- ${x.bunyanghoe_number || "-"} | ${x.name} ${x.title || ""} | 담당: ${x.assigned_to || "-"} | ${x.meeting_result} | 계약일: ${x.contract_date || "-"}`);
    });
  }

  // ── 업무전달 ──
  if (q.includes("업무") || q.includes("요청") || q.includes("태스크") || q.includes("할일") || q.includes("전달")) {
    const { data: tasks } = await supabase.from("tasks")
      .select("requester,assignee,category,content,status,created_at").order("created_at", { ascending: false }).limit(10);
    if (tasks && tasks.length > 0) {
      lines.push(`\n## 최근 업무전달`);
      tasks.forEach((t: any) => {
        lines.push(`- ${fmtDate(t.created_at?.split("T")[0])} | ${t.requester} → ${t.assignee} | [${t.category}] ${t.status} | ${(t.content || "").substring(0, 80)}`);
      });
    }
  }

  // ── 완판트럭 (최근 전체) ──
  if (q.includes("완판") || q.includes("트럭") || q.includes("출동")) {
    const { data: trucks } = await supabase.from("wanpan_trucks")
      .select("dispatch_date,site_name,location,agency,team_size,staff_members,consultant_members,is_ordered")
      .order("dispatch_date", { ascending: false }).limit(10);
    if (trucks && trucks.length > 0) {
      lines.push(`\n## 최근 완판트럭 (전체)`);
      trucks.forEach((t: any) => {
        lines.push(`- ${fmtDate(t.dispatch_date)} | ${t.site_name || "-"} | ${t.location || "-"} | 대행사: ${t.agency || "-"} | ${t.team_size || "-"}명 | 직원: ${t.staff_members || "-"} | 컨설턴트: ${t.consultant_members || "-"} | 발주: ${t.is_ordered ? "완료" : "미완료"}`);
      });
    }
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();
    if (!message) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
    if (!API_KEY) return NextResponse.json({ error: "AI API 키가 설정되지 않았습니다." }, { status: 500 });

    const crmData = await buildContext(message);
    const today = new Date();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${dayNames[today.getDay()]}요일)`;

    const systemPrompt = `You are "분양의신 AI", a CRM assistant for 광고인㈜ 대외협력팀.
You MUST answer in Korean only. Be accurate, specific, and helpful.

IMPORTANT RULES:
1. Answer ONLY based on the CRM data provided below. Do NOT make up data.
2. If the data doesn't contain the answer, say "해당 데이터를 찾을 수 없습니다."
3. Format money as "5,500,000원" (with commas).
4. Format dates as "4월 23일(수)" style.
5. Use bullet points and clean formatting.
6. Be concise but complete.

TODAY: ${todayStr}

TEAM MEMBERS (use these exact names):
- 관리자: 김정후 본부장, 김창완 팀장, 최웅 파트장
- 실행파트(대외협력팀): 조계현 메인, 이세호 어쏘, 기여운 어쏘, 최연전 CX
- 운영파트: 김재영 어시, 최은정 어시

NICKNAME MAPPING (user may use these):
- 계현, 조메인 → 조계현
- 세호 → 이세호
- 여운 → 기여운
- 연전 → 최연전
- 재영 → 김재영
- 은정 → 최은정

CRM DATA:
${crmData}`;

    const chatMessages: { role: string; content: string }[] = [];
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        chatMessages.push({ role: h.role, content: h.content });
      }
    }
    chatMessages.push({ role: "user", content: message });

    // DeepSeek API 호출
    const result = await callAI(systemPrompt, chatMessages);

    if (!result.reply) {
      return NextResponse.json({ error: `AI 응답 실패: ${result.error}` }, { status: 500 });
    }

    return NextResponse.json({ reply: result.reply });
  } catch (err: any) {
    console.error("AI Chat error:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}
