// src/lib/jarvis/context.ts
// CRM 컨텍스트 빌더 — 필요한 데이터만 정확히 가져오기 (기존: 매번 전체 테이블 → 신규: intent별 부분)

import { supabase } from "@/lib/supabase";
import type { IntentResult } from "./intent";

export type CRMUser = { name: string; title?: string; role?: string };

/**
 * 카테고리에 맞는 CRM 데이터 수집
 */
export async function buildCRMContext(intent: IntentResult, user: CRMUser): Promise<string> {
  const isAdmin = user.role === "admin";
  const contextParts: string[] = [];

  switch (intent.category) {
    case "customer_lookup":
    case "activity_history":
      contextParts.push(await buildContactContext(intent, user, isAdmin));
      break;

    case "sales_analytics":
      contextParts.push(await buildSalesContext(intent, user, isAdmin));
      break;

    case "task_schedule":
      contextParts.push(await buildTaskContext(intent, user, isAdmin));
      break;

    case "kpi_activity":
      contextParts.push(await buildKpiContext(intent, user, isAdmin));
      break;

    case "bunyanghoe_ops":
      contextParts.push(await buildBunyanghoeContext(intent, user, isAdmin));
      break;

    case "insight_combined":
      // 종합 — 핵심 데이터 모두 가져오기
      const [c, s, t] = await Promise.all([
        buildContactContext(intent, user, isAdmin),
        buildSalesContext(intent, user, isAdmin),
        buildTaskContext(intent, user, isAdmin),
      ]);
      contextParts.push(c, s, t);
      break;

    case "write_action":
      // 쓰기 액션은 대상 고객 정보 필요
      if (intent.keywords.some((k) => /[가-힣]{2,3}/.test(k))) {
        contextParts.push(await buildContactContext(intent, user, isAdmin));
      }
      break;
  }

  return contextParts.filter(Boolean).join("\n\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 고객 컨텍스트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function buildContactContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  // 키워드에서 고객 이름 추출
  const nameKeywords = intent.keywords.filter((k) => /^[가-힣]{2,3}/.test(k));
  if (nameKeywords.length === 0) return "";

  const targetName = nameKeywords[0].split(" ")[0]; // "이정재 본부장" → "이정재"

  let query = supabase
    .from("contacts")
    .select("id,name,title,phone,company,intake_route,management_stage,customer_grade,assigned_to,crm_db_source,meeting_result,memo,bunyanghoe_number,contract_date,reservation_date,vip_transferred_at,created_at")
    .ilike("name", `%${targetName}%`)
    .limit(5);

  if (!isAdmin && user.name) {
    query = query.eq("assigned_to", user.name);
  }

  const { data: contacts } = await query;
  if (!contacts || contacts.length === 0) return `[고객 조회: "${targetName}"]\n→ 일치하는 고객을 찾을 수 없습니다.`;

  // 매칭된 고객의 활동노트 가져오기 (최근 5건)
  const contact = contacts[0];
  const { data: notes } = await supabase
    .from("contact_notes")
    .select("id,note_date,content,author")
    .eq("contact_id", contact.id)
    .order("note_date", { ascending: false })
    .limit(5);

  // 최근 매출
  const { data: sales } = await supabase
    .from("ad_executions")
    .select("payment_date,channel,execution_amount,refund_amount,contract_route")
    .or(`member_name.eq.${contact.name},contact_id.eq.${contact.id}`)
    .order("payment_date", { ascending: false })
    .limit(5);

  // 콘텐츠 제작 단계
  const { data: contentStatus } = await supabase
    .from("content_statuses")
    .select("*")
    .eq("contact_id", contact.id)
    .maybeSingle();

  return formatContactContext(contacts, notes || [], sales || [], contentStatus);
}

function formatContactContext(contacts: any[], notes: any[], sales: any[], content: any): string {
  const lines: string[] = ["[CRM 데이터 — 고객 정보]"];

  contacts.forEach((c, i) => {
    if (i > 0) lines.push("\n──────");
    lines.push(`이름: ${c.name} ${c.title || ""}`);
    lines.push(`연락처: ${c.phone || "-"}`);
    lines.push(`소속: ${c.company || "-"}`);
    lines.push(`담당자: ${c.assigned_to || "-"}`);
    lines.push(`분류: ${c.crm_db_source === "vip_activity" ? "VIP활동DB" : "고객DB"}`);
    lines.push(`관리단계: ${c.management_stage || "-"}`);
    lines.push(`고객등급: ${c.customer_grade || "-"}`);
    lines.push(`미팅결과: ${c.meeting_result || "-"}`);
    if (c.bunyanghoe_number) lines.push(`분양회 입회번호: B-${c.bunyanghoe_number}`);
    if (c.contract_date) lines.push(`계약일: ${c.contract_date}`);
    if (c.vip_transferred_at) lines.push(`VIP 이관일: ${String(c.vip_transferred_at).split("T")[0]}`);
    if (c.memo) lines.push(`메모: ${c.memo}`);
    lines.push(`[내부 ID: ${c.id}]`); // 쓰기 액션 시 참조용
  });

  if (notes.length > 0) {
    lines.push("\n[최근 활동노트]");
    notes.forEach((n) => {
      lines.push(`▸ ${n.note_date} (${n.author || "-"}): ${(n.content || "").slice(0, 300).replace(/\n/g, " ")}`);
    });
  }

  if (sales.length > 0) {
    lines.push("\n[최근 매출]");
    sales.forEach((s) => {
      const amt = (s.execution_amount || 0).toLocaleString();
      const ref = s.refund_amount > 0 ? ` (환불 ${s.refund_amount.toLocaleString()}원)` : "";
      lines.push(`▸ ${s.payment_date} - ${s.channel || s.contract_route || "광고"}: ${amt}원${ref}`);
    });
  }

  if (content) {
    const stages: string[] = [];
    if (content.resource_collecting) stages.push("리소스확보");
    if (content.photo_received) stages.push("사진수취");
    if (content.info_received) stages.push("정보수취");
    if (content.tf2_delivered) stages.push("TF2전달");
    if (content.pr_completed) stages.push("PR완료");
    if (stages.length > 0) {
      lines.push(`\n[콘텐츠 제작 단계] ${stages.join(" → ")}`);
    }
    if (content.production_impossible) {
      lines.push(`\n[제작불가] 사유: ${content.impossible_reason || "-"}`);
    }
  }

  return lines.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 매출 컨텍스트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function buildSalesContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  // 기간 필터 결정
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth(); // 0-indexed

  if (intent.keywords.includes("지난달")) {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    targetYear = last.getFullYear();
    targetMonth = last.getMonth();
  }

  // 월 시작 ~ 다음달 시작 (말일 계산 불필요, 존재하지 않는 날짜 회피)
  const monthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(targetYear, targetMonth + 1, 1);
  const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

  let query = supabase
    .from("ad_executions")
    .select("payment_date,channel,contract_route,execution_amount,refund_amount,team_member,member_name")
    .gte("payment_date", monthStart)
    .lt("payment_date", monthEnd)
    .order("payment_date", { ascending: false })
    .limit(500);

  // 매출은 팀 단위 관리이므로 전체 조회 (sales 페이지와 동일 동작)
  // 권한별 본인 필터를 적용하지 않음 — 대협팀 매출은 팀 공유 데이터

  // 채널 필터
  for (const ch of ["사이다페이", "효성CMS", "호갱노노", "LMS", "하이타겟"]) {
    if (intent.keywords.includes(ch)) {
      query = query.eq("channel", ch);
      break;
    }
  }

  const { data } = await query;
  const sales = data || [];

  if (sales.length === 0) {
    return `[매출 컨텍스트 — ${monthStart} ~ ${monthEnd}]\n조회된 매출 레코드: 0건\n(주의: 이는 해당 기간 매출이 실제로 없거나, payment_date 형식 차이로 조회되지 않았을 수 있음. 사용자에게 통합매출관리 페이지 직접 확인을 권유할 것.)`;
  }

  // 집계
  const total = sales.reduce((s, r) => s + (r.execution_amount || 0) - (r.refund_amount || 0), 0);
  const refund = sales.reduce((s, r) => s + (r.refund_amount || 0), 0);

  const byChannel: Record<string, number> = {};
  const byMember: Record<string, number> = {};
  for (const r of sales) {
    byChannel[r.channel || "-"] = (byChannel[r.channel || "-"] || 0) + (r.execution_amount || 0);
    byMember[r.team_member || "-"] = (byMember[r.team_member || "-"] || 0) + (r.execution_amount || 0);
  }

  const lines: string[] = [`[매출 컨텍스트 — ${monthStart} ~ ${monthEnd}]`];
  lines.push(`총 매출: ${total.toLocaleString()}원 (${sales.length}건)`);
  if (refund > 0) lines.push(`환불: ${refund.toLocaleString()}원`);
  lines.push("\n[채널별]");
  Object.entries(byChannel)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .forEach(([k, v]) => lines.push(`▸ ${k}: ${v.toLocaleString()}원`));
  lines.push("\n[담당자별]");
  Object.entries(byMember)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .forEach(([k, v]) => lines.push(`▸ ${k}: ${v.toLocaleString()}원`));

  return lines.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 업무·일정 컨텍스트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function buildTaskContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  const lines: string[] = ["[업무·일정 컨텍스트]"];

  // 내 업무요청
  let taskQuery = supabase
    .from("tasks")
    .select("id,title,assignee,requester,status,priority,due_date,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (!isAdmin && user.name) {
    taskQuery = taskQuery.or(`assignee.eq.${user.name},requester.eq.${user.name}`);
  }
  const { data: tasks } = await taskQuery;

  const myTasks = (tasks || []).filter((t) => t.assignee === user.name && t.status !== "완료");
  const requestedTasks = (tasks || []).filter((t) => t.requester === user.name && t.status !== "완료");

  if (myTasks.length > 0) {
    lines.push(`\n내가 처리할 업무 ${myTasks.length}건:`);
    myTasks.slice(0, 8).forEach((t) =>
      lines.push(`▸ [${t.status}] ${t.title} (요청자: ${t.requester}, 기한: ${t.due_date || "미정"})`)
    );
  }
  if (requestedTasks.length > 0) {
    lines.push(`\n내가 요청한 업무 ${requestedTasks.length}건:`);
    requestedTasks.slice(0, 5).forEach((t) =>
      lines.push(`▸ [${t.status}] ${t.title} (담당: ${t.assignee})`)
    );
  }

  // 이번주 일정
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const wsStr = weekStart.toISOString().split("T")[0];
  const weStr = weekEnd.toISOString().split("T")[0];

  const { data: events } = await supabase
    .from("calendar_custom_events")
    .select("title,event_date,assigned_to,memo")
    .gte("event_date", wsStr)
    .lte("event_date", weStr)
    .order("event_date", { ascending: true })
    .limit(20);

  if (events && events.length > 0) {
    lines.push(`\n이번주 일정 (${wsStr} ~ ${weStr}):`);
    events.forEach((e) =>
      lines.push(`▸ ${e.event_date} - ${e.title} (담당: ${e.assigned_to || "-"})`)
    );
  }

  return lines.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KPI/활동량 컨텍스트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function buildKpiContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 이번달 KPI 설정 (월간)
  const { data: kpi } = await supabase
    .from("kpi_settings")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .eq("week", 0);

  // 이번달 활동 기록
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  let goalQuery = supabase
    .from("daily_activity_goals")
    .select("user_name,activity_date,tm_count,coldtalk_count,bronze_db_count,special_goal,special_completed")
    .gte("activity_date", monthStart);

  if (!isAdmin && user.name) goalQuery = goalQuery.eq("user_name", user.name);
  const { data: goals } = await goalQuery;

  const lines: string[] = [`[KPI/활동량 컨텍스트 — ${year}년 ${month}월]`];

  if (kpi && kpi.length > 0) {
    lines.push("\n[월간 KPI 목표]");
    kpi.forEach((k) => {
      lines.push(`▸ ${k.scope} / ${k.target_name}: 분양회모집 ${k.recruit_count}명, 회비매출 ${(k.bunyanghoe_revenue || 0).toLocaleString()}, 연계매출 ${(k.linked_revenue || 0).toLocaleString()}`);
    });
  }

  if (goals && goals.length > 0) {
    const byUser: Record<string, { tm: number; cold: number; bronze: number; days: number }> = {};
    for (const g of goals) {
      const u = g.user_name || "-";
      if (!byUser[u]) byUser[u] = { tm: 0, cold: 0, bronze: 0, days: 0 };
      byUser[u].tm += g.tm_count || 0;
      byUser[u].cold += g.coldtalk_count || 0;
      byUser[u].bronze += g.bronze_db_count || 0;
      byUser[u].days += 1;
    }
    lines.push("\n[이번달 활동량 (담당자별)]");
    Object.entries(byUser).forEach(([u, v]) =>
      lines.push(`▸ ${u}: TM ${v.tm}건, 콜드톡 ${v.cold}건, 브론즈DB ${v.bronze}건 (${v.days}일 입력)`)
    );
  }

  return lines.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 분양회 운영 컨텍스트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function buildBunyanghoeContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  let query = supabase
    .from("contacts")
    .select("id,name,title,company,meeting_result,customer_grade,bunyanghoe_number,contract_date,reservation_date,assigned_to")
    .eq("crm_db_source", "vip_activity")
    .in("meeting_result", ["계약완료", "예약완료"])
    .order("bunyanghoe_number", { ascending: true });

  // 분양회 회원은 팀 단위 관리이므로 전체 조회 (담당자별 정리 요청 대응)
  // 권한 필터 미적용 — 회원 명단은 팀 공유 데이터

  const { data: members } = await query;
  if (!members || members.length === 0) {
    return "[분양회 운영 컨텍스트]\n조회된 분양회 회원: 0건\n(주의: VIP활동DB에 meeting_result가 계약완료/예약완료인 회원이 없거나 조회되지 않음. 회원 명단을 절대 지어내지 말고, 사용자에게 VIP활동DB/분양회 입회자 페이지 직접 확인을 권유할 것.)";
  }

  const contracted = members.filter((m) => m.meeting_result === "계약완료");
  const reserved = members.filter((m) => m.meeting_result === "예약완료");

  const lines: string[] = ["[분양회 운영 컨텍스트]"];
  lines.push(`총 ${members.length}명 (계약완료 ${contracted.length}명 + 예약완료 ${reserved.length}명)`);
  lines.push(`VIP 100명 목표 대비 진행률: ${(contracted.length / 100 * 100).toFixed(1)}%`);

  // 등급별
  const byGrade: Record<string, number> = {};
  for (const m of contracted) {
    byGrade[m.customer_grade || "-"] = (byGrade[m.customer_grade || "-"] || 0) + 1;
  }
  lines.push("\n[등급별]");
  Object.entries(byGrade).forEach(([k, v]) => lines.push(`▸ ${k}: ${v}명`));

  // 담당자별 그룹핑
  const byAssignee: Record<string, typeof contracted> = {};
  for (const m of contracted) {
    const a = m.assigned_to || "미지정";
    if (!byAssignee[a]) byAssignee[a] = [];
    byAssignee[a].push(m);
  }
  lines.push("\n[담당자별 회원 명단]");
  Object.entries(byAssignee).forEach(([assignee, list]) => {
    lines.push(`\n● ${assignee} (${list.length}명)`);
    list.forEach((m) => {
      lines.push(`  · B-${m.bunyanghoe_number || "?"} ${m.name} ${m.title || ""} (${m.company || "-"}, 계약일: ${m.contract_date || "-"})`);
    });
  });

  return lines.join("\n");
}
