// src/lib/jarvis/context.ts
// CRM 컨텍스트 빌더 — 실제 DB 구조에 100% 맞춤 (2026-06-16 진단 반영)

import { supabase } from "@/lib/supabase";
import type { IntentResult } from "./intent";

export type CRMUser = { name: string; title?: string; role?: string };

export async function buildCRMContext(intent: IntentResult, user: CRMUser): Promise<string> {
  const isAdmin = user.role === "admin";
  const parts: string[] = [];

  switch (intent.category) {
    case "customer_lookup":
    case "activity_history":
      parts.push(await buildContactContext(intent, user, isAdmin));
      break;
    case "sales_analytics":
      parts.push(await buildSalesContext(intent, user, isAdmin));
      break;
    case "task_schedule":
      parts.push(await buildTaskContext(intent, user, isAdmin));
      break;
    case "kpi_activity":
      parts.push(await buildKpiContext(intent, user, isAdmin));
      break;
    case "bunyanghoe_ops":
      parts.push(await buildBunyanghoeContext(intent, user, isAdmin));
      break;
    case "insight_combined": {
      const [b, s, t] = await Promise.all([
        buildBunyanghoeContext(intent, user, isAdmin),
        buildSalesContext(intent, user, isAdmin),
        buildTaskContext(intent, user, isAdmin),
      ]);
      parts.push(b, s, t);
      break;
    }
    case "write_action":
      if (intent.keywords.some((k) => /[가-힣]{2,3}/.test(k))) {
        parts.push(await buildContactContext(intent, user, isAdmin));
      }
      break;
  }
  return parts.filter(Boolean).join("\n\n");
}

// ═══════════════════════════════════════════════════════════════
// 고객 조회 / 활동 이력
// ═══════════════════════════════════════════════════════════════
async function buildContactContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  const nameKeywords = intent.keywords.filter((k) => /^[가-힣]{2,4}/.test(k));
  if (nameKeywords.length === 0) return "[고객 조회] 조회할 고객 이름이 명확하지 않음. 사용자에게 고객명을 물어볼 것.";

  const targetName = nameKeywords[0].split(" ")[0];

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id,name,title,phone,mobile,company,intake_route,management_stage,customer_grade,assigned_to,consultant,crm_db_source,meeting_result,memo,site_name,next_site_name,expected_revenue,contract_date,reservation_date,vip_transferred_at,regular_payment_date,payment_channel,created_at")
    .ilike("name", `%${targetName}%`)
    .limit(5);

  if (!contacts || contacts.length === 0) {
    return `[고객 조회: "${targetName}"]\n→ 일치하는 고객이 CRM에 없습니다. 이름을 지어내지 말고 "${targetName}님은 CRM에 등록되어 있지 않습니다"라고 답할 것.`;
  }

  const contact = contacts[0];

  const { data: notes } = await supabase
    .from("contact_notes")
    .select("note_date,content,author")
    .eq("contact_id", contact.id)
    .order("note_date", { ascending: false })
    .limit(6);

  const { data: sales } = await supabase
    .from("ad_executions")
    .select("payment_date,channel,contract_route,execution_amount,refund_amount")
    .eq("member_name", contact.name)
    .order("payment_date", { ascending: false })
    .limit(6);

  const lines: string[] = ["[CRM 고객 정보]"];
  contacts.forEach((c, i) => {
    if (i > 0) lines.push("\n──────");
    lines.push(`이름: ${c.name} ${c.title || ""}`);
    lines.push(`연락처: ${c.phone || c.mobile || "-"}`);
    lines.push(`소속: ${c.company || "-"}`);
    lines.push(`담당자(우리팀): ${c.assigned_to || "-"}`);
    lines.push(`분류: ${c.crm_db_source === "vip_activity" ? "VIP활동DB(분양회 후보/회원)" : "고객DB"}`);
    lines.push(`관리단계: ${c.management_stage || "-"}`);
    lines.push(`고객등급: ${c.customer_grade || "-"}`);
    lines.push(`미팅결과: ${c.meeting_result || "-"}${c.meeting_result === "계약완료" ? " (분양회 가입 완료)" : ""}`);
    if (c.site_name) lines.push(`현재현장: ${c.site_name}`);
    if (c.next_site_name) lines.push(`다음현장: ${c.next_site_name}`);
    if (c.regular_payment_date) lines.push(`정기결제일: ${c.regular_payment_date}`);
    if (c.payment_channel) lines.push(`결제채널: ${c.payment_channel}`);
    if (c.vip_transferred_at) lines.push(`VIP 이관일: ${String(c.vip_transferred_at).split("T")[0]}`);
    if (c.memo) lines.push(`메모: ${c.memo}`);
    lines.push(`[내부 ID: ${c.id}]`);
  });

  if (notes && notes.length > 0) {
    lines.push("\n[최근 활동노트]");
    notes.forEach((n) => lines.push(`▸ ${n.note_date || "-"} (${n.author || "-"}): ${(n.content || "").slice(0, 250).replace(/\n/g, " ")}`));
  } else {
    lines.push("\n[활동노트] 기록 없음");
  }

  if (sales && sales.length > 0) {
    lines.push("\n[결제 이력]");
    sales.forEach((s) => {
      const amt = (s.execution_amount || 0).toLocaleString();
      const ref = (s.refund_amount || 0) > 0 ? ` (환불 ${s.refund_amount.toLocaleString()}원)` : "";
      lines.push(`▸ ${s.payment_date || "-"} ${s.channel || ""}/${s.contract_route || ""}: ${amt}원${ref}`);
    });
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// 매출 분석 (ad_executions) — payment_date는 date 타입
// ═══════════════════════════════════════════════════════════════
async function buildSalesContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();

  if (intent.keywords.includes("지난달")) {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    targetYear = last.getFullYear();
    targetMonth = last.getMonth();
  }

  const monthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(targetYear, targetMonth + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  // 매출은 팀 공유 데이터 — 전체 조회 (권한 필터 없음)
  const { data } = await supabase
    .from("ad_executions")
    .select("payment_date,channel,contract_route,execution_amount,refund_amount,team_member,member_name")
    .gte("payment_date", monthStart)
    .lt("payment_date", monthEnd)
    .order("payment_date", { ascending: false })
    .limit(500);

  const sales = data || [];

  if (sales.length === 0) {
    return `[매출 컨텍스트 — ${monthStart.slice(0, 7)}]\n조회된 매출: 0건\n(해당 월에 ad_executions 매출 레코드가 없음. 지어내지 말고 "${targetYear}년 ${targetMonth + 1}월 매출 기록이 없습니다. 통합매출관리에서 확인해 주세요"라고 답할 것.)`;
  }

  const totalExec = sales.reduce((s, r) => s + (r.execution_amount || 0), 0);
  const totalRefund = sales.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const net = totalExec - totalRefund;

  const byChannel: Record<string, number> = {};
  const byRoute: Record<string, number> = {};
  const byMember: Record<string, number> = {};
  for (const r of sales) {
    byChannel[r.channel || "-"] = (byChannel[r.channel || "-"] || 0) + (r.execution_amount || 0);
    byRoute[r.contract_route || "-"] = (byRoute[r.contract_route || "-"] || 0) + (r.execution_amount || 0);
    byMember[r.team_member || "미지정"] = (byMember[r.team_member || "미지정"] || 0) + (r.execution_amount || 0);
  }

  const lines: string[] = [`[매출 컨텍스트 — ${targetYear}년 ${targetMonth + 1}월]`];
  lines.push(`집행 합계: ${totalExec.toLocaleString()}원 (${sales.length}건)`);
  if (totalRefund > 0) lines.push(`환불: ${totalRefund.toLocaleString()}원`);
  lines.push(`순매출(환불 차감): ${net.toLocaleString()}원`);

  lines.push("\n[결제항목별]");
  Object.entries(byRoute).sort(([, a], [, b]) => b - a).forEach(([k, v]) => lines.push(`▸ ${k}: ${v.toLocaleString()}원`));
  lines.push("\n[채널별]");
  Object.entries(byChannel).sort(([, a], [, b]) => b - a).forEach(([k, v]) => lines.push(`▸ ${k}: ${v.toLocaleString()}원`));
  lines.push("\n[담당자별]");
  Object.entries(byMember).sort(([, a], [, b]) => b - a).forEach(([k, v]) => lines.push(`▸ ${k}: ${v.toLocaleString()}원`));

  lines.push("\n[개별 결제 내역]");
  sales.slice(0, 15).forEach((s) => {
    const ref = (s.refund_amount || 0) > 0 ? ` [환불 ${s.refund_amount.toLocaleString()}]` : "";
    lines.push(`▸ ${s.payment_date} ${s.member_name || "-"} (${s.contract_route || "-"}, 담당:${s.team_member || "-"}): ${(s.execution_amount || 0).toLocaleString()}원${ref}`);
  });

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// 분양회 운영 (contacts: crm_db_source=vip_activity + meeting_result=계약완료)
// ═══════════════════════════════════════════════════════════════
async function buildBunyanghoeContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  // 분양회 회원/후보는 팀 공유 — 전체 조회
  const { data: members } = await supabase
    .from("contacts")
    .select("id,name,title,company,meeting_result,customer_grade,management_stage,assigned_to,site_name,regular_payment_date,vip_transferred_at,contract_date")
    .eq("crm_db_source", "vip_activity")
    .limit(300);

  if (!members || members.length === 0) {
    return `[분양회 운영]\n조회된 VIP활동DB 회원: 0건\n(지어내지 말 것. "VIP활동DB에 회원이 없습니다"라고 답할 것.)`;
  }

  // 계약완료 = 분양회 정식 가입, 그 외 = 후보/관리중
  const contracted = members.filter((m) => m.meeting_result === "계약완료");
  const candidates = members.filter((m) => m.meeting_result !== "계약완료");

  const lines: string[] = ["[분양회 운영 컨텍스트]"];
  lines.push(`VIP활동DB 총 ${members.length}명`);
  lines.push(`├ 계약완료(분양회 정식 가입): ${contracted.length}명`);
  lines.push(`└ 관리중(후보/리드): ${candidates.length}명`);
  lines.push(`VIP 100명 목표 대비: ${(contracted.length / 100 * 100).toFixed(0)}% (${contracted.length}/100)`);

  // 담당자별 그룹핑 (계약완료 기준)
  const byAssignee: Record<string, typeof contracted> = {};
  for (const m of contracted) {
    const a = m.assigned_to || "미지정";
    if (!byAssignee[a]) byAssignee[a] = [];
    byAssignee[a].push(m);
  }

  lines.push("\n[담당자별 분양회 정식 회원(계약완료)]");
  Object.entries(byAssignee).forEach(([assignee, list]) => {
    lines.push(`\n● ${assignee} 담당 (${list.length}명)`);
    list.forEach((m) => {
      lines.push(`  · ${m.name} ${m.title || ""}${m.site_name ? ` / 현장:${m.site_name}` : ""}${m.regular_payment_date ? ` / 정기결제:${m.regular_payment_date}` : ""}`);
    });
  });

  // 관리중 후보도 간단히
  if (candidates.length > 0) {
    lines.push("\n[관리중 후보 (계약 전)]");
    candidates.slice(0, 15).forEach((m) => {
      lines.push(`  · ${m.name} ${m.title || ""} (담당:${m.assigned_to || "-"}, 단계:${m.management_stage || "-"})`);
    });
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// 업무 / 일정 (tasks + calendar_custom_events + wanpan_trucks)
// ═══════════════════════════════════════════════════════════════
async function buildTaskContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  const lines: string[] = ["[업무·일정 컨텍스트]"];
  const wantsWanpan = intent.keywords.some((k) => k.includes("완판")) || /완판트럭/.test(JSON.stringify(intent.keywords));

  // 완판트럭
  const { data: trucks } = await supabase
    .from("wanpan_trucks")
    .select("dispatch_date,site_name,location,agency,contact_point,contact_point_title,contact_phone,team_size,order_qty_base,order_qty_extra,assigned_to,staff_members,consultant_members,is_ordered,status")
    .order("dispatch_date", { ascending: false })
    .limit(30);

  if (trucks && trucks.length > 0) {
    lines.push("\n[완판트럭 일정]");
    trucks.slice(0, 15).forEach((t) => {
      const qty = (t.order_qty_base || 0) + (t.order_qty_extra || 0);
      lines.push(`▸ ${t.dispatch_date || "-"} ${t.site_name || "-"} (${t.location || "-"}) | 담당:${t.assigned_to || "-"} | 규모:${t.team_size || "-"}명 | 발주:${qty}개 | 컨택:${t.contact_point || "-"} ${t.contact_point_title || ""} | ${t.is_ordered ? "발주완료" : "발주전"}`);
    });
  } else {
    lines.push("\n[완판트럭] 등록된 일정 없음");
  }

  // 업무요청 (tasks)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id,category,content,priority,assignee,requester,status,due_date,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (tasks && tasks.length > 0) {
    const open = tasks.filter((t) => t.status !== "완료");
    lines.push(`\n[업무요청 — 미완료 ${open.length}건]`);
    open.slice(0, 12).forEach((t) =>
      lines.push(`▸ [${t.status || "-"}/${t.priority || "-"}] ${(t.content || t.category || "").slice(0, 60)} (담당:${t.assignee || "-"}, 요청:${t.requester || "-"}, 기한:${t.due_date || "미정"})`)
    );
  } else {
    lines.push("\n[업무요청] 없음");
  }

  // 일정 (calendar_custom_events) — date_start 기준 이번주~다음달
  const today = new Date();
  const start = today.toISOString().split("T")[0];
  const future = new Date(today); future.setDate(today.getDate() + 30);
  const end = future.toISOString().split("T")[0];

  const { data: events } = await supabase
    .from("calendar_custom_events")
    .select("title,category,detail,date_start,date_end,created_by")
    .gte("date_start", start)
    .lte("date_start", end)
    .order("date_start", { ascending: true })
    .limit(30);

  if (events && events.length > 0) {
    lines.push("\n[일정 (오늘~30일)]");
    events.forEach((e) =>
      lines.push(`▸ ${e.date_start} [${e.category || "-"}] ${e.title || ""}${e.detail ? ` - ${e.detail}` : ""} (등록:${e.created_by || "-"})`)
    );
  } else {
    lines.push("\n[일정] 예정된 일정 없음");
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// KPI / 활동량 (kpi_settings + daily_activity_goals)
// 실제 컬럼: work_date, owner_name, goal_*, result_*
// ═══════════════════════════════════════════════════════════════
async function buildKpiContext(intent: IntentResult, user: CRMUser, isAdmin: boolean): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const lines: string[] = [`[KPI·활동량 — ${year}년 ${month}월]`];

  // KPI 목표 (월간 = week 0)
  const { data: kpi } = await supabase
    .from("kpi_settings")
    .select("scope,target_name,recruit_count,bunyanghoe_revenue,linked_revenue,special_revenue,wanpan_truck_count,ad_operation_revenue,week")
    .eq("year", year)
    .eq("month", month);

  if (kpi && kpi.length > 0) {
    lines.push("\n[월간 KPI 목표]");
    kpi.filter((k) => k.week === 0 || k.week === null).forEach((k) => {
      const items: string[] = [];
      if (k.recruit_count) items.push(`분양회모집 ${k.recruit_count}명`);
      if (k.bunyanghoe_revenue) items.push(`회비매출 ${Number(k.bunyanghoe_revenue).toLocaleString()}`);
      if (k.linked_revenue) items.push(`연계매출 ${Number(k.linked_revenue).toLocaleString()}`);
      if (k.special_revenue) items.push(`특전매출 ${Number(k.special_revenue).toLocaleString()}`);
      if (k.wanpan_truck_count) items.push(`완판트럭 ${k.wanpan_truck_count}회`);
      lines.push(`▸ [${k.scope || "-"}] ${k.target_name || "-"}: ${items.join(", ") || "목표 미설정"}`);
    });
  } else {
    lines.push("\n[월간 KPI] 설정된 목표 없음");
  }

  // 활동량 (daily_activity_goals) — 이번달, work_date 기준
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = new Date(year, month, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: goals } = await supabase
    .from("daily_activity_goals")
    .select("owner_name,work_date,result_tm,result_new_tm,result_coldtalk,result_bronze_db,result_one_percent_db,result_consultant_db,result_second_touch,is_outside_meeting")
    .gte("work_date", monthStart)
    .lt("work_date", monthEnd)
    .limit(500);

  if (goals && goals.length > 0) {
    const byOwner: Record<string, { tm: number; newtm: number; cold: number; bronze: number; onepct: number; days: number }> = {};
    for (const g of goals) {
      const o = g.owner_name || "-";
      if (!byOwner[o]) byOwner[o] = { tm: 0, newtm: 0, cold: 0, bronze: 0, onepct: 0, days: 0 };
      byOwner[o].tm += g.result_tm || 0;
      byOwner[o].newtm += g.result_new_tm || 0;
      byOwner[o].cold += g.result_coldtalk || 0;
      byOwner[o].bronze += g.result_bronze_db || 0;
      byOwner[o].onepct += g.result_one_percent_db || 0;
      byOwner[o].days += 1;
    }
    lines.push("\n[이번달 활동 실적 (담당자별 누적)]");
    Object.entries(byOwner).forEach(([o, v]) =>
      lines.push(`▸ ${o}: 신규TM ${v.newtm}건, 콜드톡 ${v.cold}건, 브론즈DB ${v.bronze}건, 1%DB ${v.onepct}건 (${v.days}일 입력)`)
    );
  } else {
    lines.push("\n[활동 실적] 이번달 입력된 활동 기록 없음");
  }

  return lines.join("\n");
}
