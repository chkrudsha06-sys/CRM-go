"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  Activity, AlertTriangle, BarChart3, ChevronDown, ChevronUp,
  CircleDollarSign, Lightbulb, Loader2, RefreshCw, Target,
  TrendingDown, TrendingUp, Truck, Users, WalletCards,
  Phone, MessageSquare, Award, Crown, ArrowRight, UserPlus,
  CheckCircle2, FileText, Filter,
} from "lucide-react";

// ━━━ 상수 ━━━
const EXEC = ["조계현", "이세호", "기여운", "최연전"] as const;
type ToneName = "info"|"success"|"warning"|"danger"|"purple"|"cyan"|"muted";

const VIP_DB_SOURCE = "vip_activity";

// ━━━ 포맷 ━━━
function money(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs/100_000_000).toFixed(abs%100_000_000===0?0:1)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs/10_000).toLocaleString()}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}
function pct1(a: number, b: number) { return b > 0 ? Math.round((a/b)*1000)/10 : 0; }
function prevMonth(y: number, m: number) { return m === 1 ? { y: y-1, m: 12 } : { y, m: m-1 }; }
function monthRange(y: number, m: number) {
  const ms = String(m).padStart(2,"0");
  const ld = new Date(y, m, 0).getDate();
  return { s: `${y}-${ms}-01`, e: `${y}-${ms}-${String(ld).padStart(2,"0")}` };
}

// ━━━ 디자인 시스템 ━━━
function toneStyle(t: ToneName) {
  const map: Record<ToneName,{bg:string;text:string;border:string;dot:string;bar:string}> = {
    info:    { bg:"var(--info-bg)",    text:"var(--info-text)",    border:"var(--info-border)",    dot:"var(--info)",    bar:"linear-gradient(90deg,#60A5FA,#22D3EE)" },
    success: { bg:"var(--success-bg)", text:"var(--success-text)", border:"var(--success-border)", dot:"var(--success)", bar:"linear-gradient(90deg,#34D399,#22D3EE)" },
    warning: { bg:"var(--warning-bg)", text:"var(--warning-text)", border:"var(--warning-border)", dot:"var(--warning)", bar:"linear-gradient(90deg,#FBBF24,#FB7185)" },
    danger:  { bg:"var(--danger-bg)",  text:"var(--danger-text)",  border:"var(--danger-border)",  dot:"var(--danger)",  bar:"linear-gradient(90deg,#FB7185,#F43F5E)" },
    purple:  { bg:"var(--purple-bg)",  text:"var(--purple-text)",  border:"var(--purple-border)",  dot:"var(--purple)",  bar:"linear-gradient(90deg,#8B7CF6,#60A5FA)" },
    cyan:    { bg:"var(--cyan-bg)",    text:"var(--cyan-text)",    border:"var(--cyan-border)",    dot:"var(--cyan)",    bar:"linear-gradient(90deg,#22D3EE,#34D399)" },
    muted:   { bg:"var(--surface-3)",  text:"var(--text-subtle)",  border:"var(--border)",         dot:"var(--text-faint)", bar:"linear-gradient(90deg,var(--text-faint),var(--border))" },
  };
  return map[t];
}

function IconBox({ icon: Icon, tone = "info", size = "md" }: { icon: ElementType; tone?: ToneName; size?: "sm"|"md" }) {
  const c = toneStyle(tone);
  const cls = size === "sm" ? "h-7 w-7 rounded-[9px]" : "h-9 w-9 rounded-[11px]";
  return (
    <div className={`inline-flex shrink-0 items-center justify-center ${cls}`}
      style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>
      <Icon size={size === "sm" ? 13 : 16} />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`premium-card overflow-hidden ${className}`}>{children}</section>;
}

function PanelTitle({ icon, tone, title, desc, right }: {
  icon: ElementType; tone: ToneName; title: string; desc?: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3"
      style={{ borderColor:"var(--border-subtle)" }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <IconBox icon={icon} tone={tone} size="sm" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight tracking-[-0.01em]"
            style={{ color:"var(--text-strong)" }}>{title}</p>
          {desc && <p className="text-[12px] font-medium leading-tight"
            style={{ color:"var(--text-subtle)" }}>{desc}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function Bar({ value, max, tone = "info", height = 8 }: {
  value: number; max: number; tone?: ToneName; height?: number;
}) {
  const c = toneStyle(tone);
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="overflow-hidden rounded-full" style={{ height, background:"var(--surface-3)" }}>
      <div className="h-full rounded-full transition-all"
        style={{ width:`${Math.max(w, value > 0 ? 2 : 0)}%`, background:c.bar }} />
    </div>
  );
}

function Badge({ tone, children }: { tone: ToneName; children: ReactNode }) {
  const c = toneStyle(tone);
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>
      {children}
    </span>
  );
}

function MetricCard({ icon, tone, label, value, sub }: {
  icon: ElementType; tone: ToneName; label: string; value: ReactNode; sub?: ReactNode;
}) {
  return (
    <div className="premium-card flex items-center gap-3 rounded-[14px] p-4">
      <IconBox icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium tracking-[-0.01em]" style={{ color:"var(--text-subtle)" }}>{label}</p>
        <p className="mt-0.5 text-[20px] font-bold tracking-[-0.02em]" style={{ color:"var(--text-strong)" }}>{value}</p>
        {sub && <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ━━━ 데이터 유틸 ━━━
function netAmt(e: Record<string,any>) {
  const base = (e.vat_amount > 0 && e.vat_amount !== e.execution_amount)
    ? e.vat_amount : (e.execution_amount || 0);
  return base - (e.refund_amount || 0);
}

function chGroup(e: Record<string,any>) {
  const ch = String(e.channel || "기타");
  if (ch.includes("월회비")) return "분양회 월회비";
  if (ch.includes("입회비")) return "분양회 입회비";
  if (ch.includes("LMS")) return "LMS";
  if (ch.includes("호갱")) return "호갱노노";
  if (ch.includes("하이타겟")) return "하이타겟";
  return ch || "기타";
}

const CH_TONES: Record<string,ToneName> = {
  "분양회 월회비":"cyan", "분양회 입회비":"warning",
  "LMS":"success", "호갱노노":"info", "하이타겟":"purple",
};

const PERSON_TONES: ToneName[] = ["info", "purple", "success", "warning"];

// ════════════════════════════════════════════════════════
// 메인 컴포넌트
// ════════════════════════════════════════════════════════
export default function ReportsPage() {
  const now = new Date();
  const [year]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [execs,     setExecs]     = useState<Record<string,any>[]>([]);
  const [prevExecs, setPrevExecs] = useState<Record<string,any>[]>([]);
  const [contacts,  setContacts]  = useState<Record<string,any>[]>([]);
  const [wanpans,   setWanpans]   = useState<Record<string,any>[]>([]);
  const [dailyGoals, setDailyGoals] = useState<Record<string,any>[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expandedPerson, setExpandedPerson] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { s, e } = monthRange(year, month);
    const { y: py, m: pm } = prevMonth(year, month);
    const { s: ps, e: pe } = monthRange(py, pm);
    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from("ad_executions").select("*").gte("payment_date", s).lte("payment_date", e),
      supabase.from("ad_executions").select("*").gte("payment_date", ps).lte("payment_date", pe),
      supabase.from("contacts").select("*"),
      supabase.from("wanpan_trucks").select("*").gte("dispatch_date", s).lte("dispatch_date", e),
      supabase.from("daily_activity_goals").select("*").gte("work_date", s).lte("work_date", e),
    ]);
    setExecs(r1.data || []);
    setPrevExecs(r2.data || []);
    setContacts(r3.data || []);
    setWanpans(r4.data || []);
    setDailyGoals(r5.data || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const ms      = String(month).padStart(2, "0");
  const mPrefix = `${year}-${ms}`;
  const { y: py, m: pm } = prevMonth(year, month);
  const pmPrefix = `${py}-${String(pm).padStart(2, "0")}`;

  // 1. 월간 종합
  const summary = useMemo(() => {
    const totalRev = execs.reduce((s,e) => s + netAmt(e), 0);
    const refundAmt = execs.reduce((s,e) => s + (e.refund_amount || 0), 0);
    const monthFeeAmt = execs.filter(e => chGroup(e) === "분양회 월회비").reduce((s,e)=>s+netAmt(e), 0);

    const refundByCh: Record<string, number> = {};
    execs.forEach(e => {
      if (e.refund_amount > 0) {
        const k = chGroup(e);
        refundByCh[k] = (refundByCh[k] || 0) + (e.refund_amount || 0);
      }
    });

    const contracts = contacts.filter(c => c.contract_date?.startsWith(mPrefix));
    const reservs   = contacts.filter(c => c.reservation_date?.startsWith(mPrefix));
    const truckCount = wanpans.length;
    const truckTotalAttendees = wanpans.reduce((s,w) => s + (w.attendee_count || 0), 0);

    return {
      totalRev, refundAmt, monthFeeAmt, refundByCh,
      contractCount: contracts.length,
      reservCount: reservs.length,
      truckCount, truckTotalAttendees,
    };
  }, [execs, contacts, wanpans, mPrefix]);

  // 2. 담당자별 영업 플로우
  const personFlow = useMemo(() => {
    return EXEC.map((name) => {
      const myContacts = contacts.filter(c => c.assigned_to === name);
      const newDb = myContacts.filter(c => String(c.created_at || "").startsWith(mPrefix));
      const vipDb = myContacts.filter(c => c.crm_db_source === VIP_DB_SOURCE);
      const vipTransferThisMonth = myContacts.filter(c =>
        String(c.vip_transferred_at || "").startsWith(mPrefix)
      );
      const contracts = myContacts.filter(c => c.contract_date?.startsWith(mPrefix));
      const reservs   = myContacts.filter(c => c.reservation_date?.startsWith(mPrefix));

      const revenue = execs.filter(e => e.team_member === name).reduce((s,e) => s + netAmt(e), 0);
      const prevRev = prevExecs.filter(e => e.team_member === name).reduce((s,e) => s + netAmt(e), 0);

      const byCh: Record<string, number> = {};
      execs.filter(e => e.team_member === name).forEach(e => {
        const k = chGroup(e);
        byCh[k] = (byCh[k] || 0) + netAmt(e);
      });

      const vipConvRate = pct1(vipTransferThisMonth.length, newDb.length);
      const contractConvRate = pct1(contracts.length + reservs.length, vipDb.length);

      return {
        name, newDb: newDb.length, vipTransferred: vipTransferThisMonth.length,
        vipDb: vipDb.length,
        contracts: contracts.length, reservs: reservs.length,
        revenue, prevRev, byCh,
        vipConvRate, contractConvRate,
      };
    });
  }, [contacts, execs, prevExecs, mPrefix]);

  // 3. 유입경로별 성과
  const intakeFlow = useMemo(() => {
    const monthContacts = contacts.filter(c => String(c.created_at || "").startsWith(mPrefix));
    const routes = Array.from(new Set(monthContacts.map(c => c.intake_route).filter(Boolean)));
    return routes.map(route => {
      const all = monthContacts.filter(c => c.intake_route === route);
      const vip = all.filter(c => c.crm_db_source === VIP_DB_SOURCE);
      const contracted = all.filter(c => c.contract_date || c.reservation_date);
      return {
        route: String(route),
        total: all.length,
        vip: vip.length,
        vipRate: pct1(vip.length, all.length),
        contracted: contracted.length,
        contractedRate: pct1(contracted.length, all.length),
      };
    }).sort((a, b) => b.total - a.total);
  }, [contacts, mPrefix]);

  // 4. 계약 고객 유입경로
  const contractRoutes = useMemo(() => {
    const closed = contacts.filter(c =>
      c.contract_date?.startsWith(mPrefix) || c.reservation_date?.startsWith(mPrefix)
    );
    const routeMap: Record<string, number> = {};
    closed.forEach(c => {
      const r = String(c.intake_route || "미분류");
      routeMap[r] = (routeMap[r] || 0) + 1;
    });
    const total = closed.length;
    return Object.entries(routeMap)
      .map(([route, count]) => ({ route, count, share: pct1(count, total) }))
      .sort((a, b) => b.count - a.count);
  }, [contacts, mPrefix]);

  // 5. 활동량 분석
  const activityStats = useMemo(() => {
    const totalTm = dailyGoals.reduce((s, r) => s + (r.result_new_tm || 0), 0);
    const totalCold = dailyGoals.reduce((s, r) => s + (r.result_coldtalk || 0), 0);
    const goalTm = dailyGoals.reduce((s, r) => s + (r.goal_new_tm || 0), 0);
    const goalCold = dailyGoals.reduce((s, r) => s + (r.goal_coldtalk || 0), 0);
    const totalManageTm = dailyGoals.reduce((s, r) => s + (r.result_manage_tm || 0), 0);
    const totalConsultantDb = dailyGoals.reduce((s, r) => s + (r.result_consultant_db || 0), 0);
    const totalSecondTouch = dailyGoals.reduce((s, r) => s + (r.result_second_touch || 0), 0);

    const byPerson = EXEC.map(name => {
      const rows = dailyGoals.filter(r => r.owner_name === name);
      return {
        name,
        tm: rows.reduce((s, r) => s + (r.result_new_tm || 0), 0),
        cold: rows.reduce((s, r) => s + (r.result_coldtalk || 0), 0),
        manageTm: rows.reduce((s, r) => s + (r.result_manage_tm || 0), 0),
        consultantDb: rows.reduce((s, r) => s + (r.result_consultant_db || 0), 0),
      };
    });

    return {
      totalTm, totalCold, goalTm, goalCold,
      tmAchievement: pct1(totalTm, goalTm),
      coldAchievement: pct1(totalCold, goalCold),
      totalManageTm, totalConsultantDb, totalSecondTouch,
      byPerson,
    };
  }, [dailyGoals]);

  // 6. 활동노트 품질
  const notesQuality = useMemo(() => {
    return EXEC.map(name => {
      const myContacts = contacts.filter(c =>
        c.assigned_to === name && c.crm_db_source === VIP_DB_SOURCE
      );
      const withNotes = myContacts.filter(c => c.memo && String(c.memo).trim().length > 30);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);
      const recentlyTouched = myContacts.filter(c => {
        const up = c.updated_at ? new Date(c.updated_at).getTime() : 0;
        return up >= recentDate.getTime();
      });
      return {
        name,
        totalVip: myContacts.length,
        withNotes: withNotes.length,
        recentlyTouched: recentlyTouched.length,
        noteRate: pct1(withNotes.length, myContacts.length),
        recencyRate: pct1(recentlyTouched.length, myContacts.length),
      };
    });
  }, [contacts]);

  // 7. 일별 활동목표
  const dailyGoalStats = useMemo(() => {
    return EXEC.map(name => {
      const rows = dailyGoals.filter(r => r.owner_name === name);
      const daysInput = rows.length;
      const tmGoal = rows.reduce((s, r) => s + (r.goal_new_tm || 0), 0);
      const tmResult = rows.reduce((s, r) => s + (r.result_new_tm || 0), 0);
      const coldGoal = rows.reduce((s, r) => s + (r.goal_coldtalk || 0), 0);
      const coldResult = rows.reduce((s, r) => s + (r.result_coldtalk || 0), 0);
      const totalGoal = tmGoal + coldGoal;
      const totalResult = tmResult + coldResult;
      const businessDays = 22;
      return {
        name,
        daysInput,
        inputRate: pct1(daysInput, businessDays),
        achievement: pct1(totalResult, totalGoal),
      };
    });
  }, [dailyGoals]);

  // 8. 인사이트
  const insights = useMemo(() => {
    const items: { tone: ToneName; icon: ElementType; title: string; desc: string }[] = [];

    const sortedRev = [...personFlow].sort((a, b) => b.revenue - a.revenue);
    if (sortedRev[0]?.revenue > 0) {
      items.push({
        tone: "success", icon: Crown,
        title: `매출 1위 — ${sortedRev[0].name}`,
        desc: `${money(sortedRev[0].revenue)} / 2위 ${sortedRev[1]?.name || "-"}(${money(sortedRev[1]?.revenue || 0)})와 ${money(sortedRev[0].revenue - (sortedRev[1]?.revenue || 0))} 격차`,
      });
    }

    const sortedVipConv = [...personFlow].filter(p => p.newDb > 0).sort((a, b) => b.vipConvRate - a.vipConvRate);
    if (sortedVipConv.length >= 2) {
      const top = sortedVipConv[0], bottom = sortedVipConv[sortedVipConv.length - 1];
      if (top.vipConvRate - bottom.vipConvRate > 20) {
        items.push({
          tone: "warning", icon: TrendingUp,
          title: `VIP 전환율 편차 ${(top.vipConvRate - bottom.vipConvRate).toFixed(1)}%p`,
          desc: `${top.name}(${top.vipConvRate}%) vs ${bottom.name}(${bottom.vipConvRate}%) — ${top.name}의 심사 기준을 공유하세요.`,
        });
      }
    }

    const sortedCtrConv = [...personFlow].filter(p => p.vipDb > 0).sort((a, b) => b.contractConvRate - a.contractConvRate);
    if (sortedCtrConv[0]?.contractConvRate > 0) {
      items.push({
        tone: "info", icon: Target,
        title: `계약전환율 최상위 — ${sortedCtrConv[0].name}`,
        desc: `VIP DB → 계약/예약 ${sortedCtrConv[0].contractConvRate}% — 영업 클로징 노하우를 팀 전파하세요.`,
      });
    }

    const sortedActivity = [...activityStats.byPerson].sort((a, b) => (b.tm + b.cold) - (a.tm + a.cold));
    if (sortedActivity.length >= 2) {
      const top = sortedActivity[0];
      const sum = top.tm + top.cold;
      if (sum > 0) {
        items.push({
          tone: "purple", icon: Activity,
          title: `활동량 최상위 — ${top.name}`,
          desc: `TM ${top.tm}건 · 콜드톡 ${top.cold}건 = 총 ${sum}건. 활동 패턴 분석으로 팀 평균을 끌어올리세요.`,
        });
      }
    }

    const lowNote = notesQuality.filter(n => n.totalVip > 0 && n.noteRate < 50);
    if (lowNote.length > 0) {
      items.push({
        tone: "danger", icon: AlertTriangle,
        title: `활동노트 누락 — ${lowNote.map(n => n.name).join(", ")}`,
        desc: `VIP 고객 중 활동노트 작성률이 50% 미만입니다. 정기 활동 기록을 강화하세요.`,
      });
    }

    const lowInput = dailyGoalStats.filter(d => d.inputRate < 50);
    if (lowInput.length > 0) {
      items.push({
        tone: "warning", icon: FileText,
        title: `일별 활동목표 입력 부족 — ${lowInput.map(d => d.name).join(", ")}`,
        desc: `이번달 활동기록 입력률이 50% 미만입니다. 매일 활동기록을 입력하도록 챙겨주세요.`,
      });
    }

    if (summary.refundAmt > 0) {
      const refundRate = pct1(summary.refundAmt, summary.totalRev + summary.refundAmt);
      if (refundRate > 10) {
        items.push({
          tone: "danger", icon: AlertTriangle,
          title: `환불률 ${refundRate}% — 위험`,
          desc: `환불 ${money(summary.refundAmt)}. 계약 전 약정 이행과 고객 검증 프로세스를 점검하세요.`,
        });
      }
    }

    return items;
  }, [personFlow, activityStats, notesQuality, dailyGoalStats, summary]);

  if (loading) {
    return (
      <div className="premium-page flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin" size={32} style={{ color: "var(--accent-text)" }} />
          <p className="crm-meta">데이터를 분석하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-page mx-auto w-full max-w-[1920px] px-4 pb-12 pt-6 md:px-6 2xl:px-8">

      {/* 헤더 */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconBox icon={BarChart3} tone="purple" />
          <div>
            <h1 className="crm-title">팀 성과 분석</h1>
            <p className="crm-subtitle mt-0.5">{year}년 {month}월 · 실행파트 영업 종합 인사이트</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="crm-search h-10 w-[110px] px-3 font-normal"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i+1} value={i+1}>{i+1}월</option>
            ))}
          </select>
          <button type="button" onClick={load} className="btn-premium btn-secondary h-10">
            <RefreshCw size={14} /> 새로고침
          </button>
        </div>
      </div>

      {/* 1. 핵심 지표 */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          icon={CircleDollarSign} tone="success"
          label="당월 총매출"
          value={money(summary.totalRev)}
          sub="광고특전 + 분양회 월회비"
        />
        <MetricCard
          icon={WalletCards} tone="cyan"
          label="당월 분양회 월회비"
          value={money(summary.monthFeeAmt)}
          sub={`전체 매출 중 ${pct1(summary.monthFeeAmt, summary.totalRev)}%`}
        />
        <MetricCard
          icon={Award} tone="purple"
          label="당월 계약 + 예약"
          value={`${summary.contractCount + summary.reservCount}건`}
          sub={`계약 ${summary.contractCount} · 예약 ${summary.reservCount}`}
        />
        <MetricCard
          icon={AlertTriangle} tone={summary.refundAmt > 0 ? "danger" : "muted"}
          label="당월 환불금액"
          value={money(summary.refundAmt)}
          sub={summary.refundAmt > 0 ? `${Object.keys(summary.refundByCh).length}개 항목` : "환불 없음"}
        />
        <MetricCard
          icon={Truck} tone="warning"
          label="완판트럭 출장"
          value={`${summary.truckCount}회`}
          sub={`접촉 ${summary.truckTotalAttendees}명`}
        />
        <MetricCard
          icon={Users} tone="info"
          label="신규 DB 등록"
          value={`${personFlow.reduce((s, p) => s + p.newDb, 0)}건`}
          sub={`팀 합산 · ${EXEC.length}명`}
        />
      </div>

      {/* 환불 항목별 (환불 있을 때만) */}
      {Object.keys(summary.refundByCh).length > 0 && (
        <Panel className="mb-5">
          <PanelTitle icon={AlertTriangle} tone="danger" title="환불 항목별 분해" desc="채널별 환불 발생 내역" />
          <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(summary.refundByCh).sort((a,b)=>b[1]-a[1]).map(([ch, amt]) => (
              <div key={ch} className="flex items-center justify-between rounded-[10px] border px-3 py-2.5"
                style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                <Badge tone={CH_TONES[ch] || "muted"}>{ch}</Badge>
                <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--danger-text)" }}>
                  {money(amt)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* 담당자별 영업 플로우 */}
      <Panel className="mb-5">
        <PanelTitle icon={TrendingUp} tone="purple" title="담당자별 영업 플로우" desc="신규 DB → VIP 이관 → 계약/예약 전환율" />
        <div className="space-y-3 p-4">
          {personFlow.map((p, idx) => {
            const tone = PERSON_TONES[idx % PERSON_TONES.length];
            const expanded = expandedPerson === p.name;
            return (
              <div key={p.name} className="rounded-[14px] border p-4"
                style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold"
                      style={{ background: toneStyle(tone).bg, color: toneStyle(tone).text }}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>{p.name}</p>
                      <p className="text-[12px]" style={{ color: "var(--text-subtle)" }}>매출 {money(p.revenue)}</p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => setExpandedPerson(expanded ? null : p.name)}
                    className="btn-premium btn-secondary h-8">
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {expanded ? "접기" : "상세"}
                  </button>
                </div>

                <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
                  <FlowStep label="신규 DB" count={p.newDb} tone="info" icon={UserPlus} />
                  <ArrowRight size={16} className="hidden lg:block mx-auto" style={{ color: "var(--text-faint)" }} />
                  <FlowStep label="VIP 이관" count={p.vipTransferred} tone="purple" icon={CheckCircle2}
                    rate={p.vipConvRate} rateLabel="전환율" />
                  <ArrowRight size={16} className="hidden lg:block mx-auto" style={{ color: "var(--text-faint)" }} />
                  <FlowStep label="VIP DB 보유" count={p.vipDb} tone="cyan" icon={Users} />
                  <ArrowRight size={16} className="hidden lg:block mx-auto" style={{ color: "var(--text-faint)" }} />
                  <FlowStep label="계약/예약" count={p.contracts + p.reservs} tone="success" icon={Award}
                    rate={p.contractConvRate} rateLabel="계약전환" />
                </div>

                {expanded && (
                  <div className="mt-4 grid gap-3 rounded-[10px] border p-3 lg:grid-cols-2"
                    style={{ background: "var(--surface-3)", borderColor: "var(--border-subtle)" }}>
                    <div>
                      <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-strong)" }}>채널별 매출 구성</p>
                      {Object.keys(p.byCh).length === 0 ? (
                        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>매출 데이터 없음</p>
                      ) : Object.entries(p.byCh).sort((a,b)=>b[1]-a[1]).map(([ch, amt]) => {
                        const max = Math.max(...Object.values(p.byCh), 1);
                        return (
                          <div key={ch} className="mb-1.5">
                            <div className="mb-0.5 flex items-center justify-between text-[11px]">
                              <Badge tone={CH_TONES[ch] || "muted"}>{ch}</Badge>
                              <span className="font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>{money(amt)}</span>
                            </div>
                            <Bar value={amt} max={max} tone={CH_TONES[ch] || "muted"} height={5} />
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-strong)" }}>활동 요약</p>
                      <div className="grid grid-cols-2 gap-2">
                        <MiniStat label="TM" value={activityStats.byPerson.find(x=>x.name===p.name)?.tm || 0} unit="건" />
                        <MiniStat label="콜드톡" value={activityStats.byPerson.find(x=>x.name===p.name)?.cold || 0} unit="건" />
                        <MiniStat label="활동노트 작성률" value={notesQuality.find(x=>x.name===p.name)?.noteRate || 0} unit="%" />
                        <MiniStat label="활동기록 입력률" value={dailyGoalStats.find(x=>x.name===p.name)?.inputRate || 0} unit="%" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 유입경로별 분석 */}
      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelTitle icon={Filter} tone="info" title="당월 유입경로별 성과" desc="DB 입력 대비 VIP 전환 현황" />
          <div className="p-4">
            {intakeFlow.length === 0 ? (
              <p className="py-6 text-center text-[12px]" style={{ color: "var(--text-faint)" }}>당월 유입경로 데이터 없음</p>
            ) : (
              <div className="space-y-2">
                {intakeFlow.map((r) => (
                  <div key={r.route} className="rounded-[10px] border px-3 py-2.5"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <p className="flex-1 truncate text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{r.route}</p>
                      <span className="text-[11px]" style={{ color: "var(--text-subtle)" }}>DB <strong style={{color:"var(--text-strong)"}}>{r.total}건</strong></span>
                      <ArrowRight size={11} style={{ color: "var(--text-faint)" }} />
                      <span className="text-[11px]" style={{ color: "var(--text-subtle)" }}>VIP <strong style={{color:"var(--purple-text)"}}>{r.vip}건</strong></span>
                      <Badge tone={r.vipRate >= 60 ? "success" : r.vipRate >= 30 ? "warning" : "muted"}>{r.vipRate}%</Badge>
                    </div>
                    <Bar value={r.vip} max={r.total} tone="purple" height={5} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={Award} tone="success" title="계약 고객 유입경로" desc="어떤 경로에서 계약이 나왔는가" />
          <div className="p-4">
            {contractRoutes.length === 0 ? (
              <p className="py-6 text-center text-[12px]" style={{ color: "var(--text-faint)" }}>당월 계약 없음</p>
            ) : (
              <div className="space-y-2">
                {contractRoutes.map((r) => (
                  <div key={r.route} className="flex items-center gap-2 rounded-[10px] border px-3 py-2.5"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <p className="flex-1 truncate text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{r.route}</p>
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{r.count}건</span>
                    <Badge tone="success">{r.share}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* 활동량 분석 */}
      <Panel className="mb-5">
        <PanelTitle icon={Phone} tone="cyan" title="당월 활동량 분석" desc="TM · 콜드톡 활동 건수와 달성률" />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <ActivityBlock label="당월 TM" value={activityStats.totalTm}
              goal={activityStats.goalTm} tone="info" icon={Phone} />
            <ActivityBlock label="당월 콜드톡" value={activityStats.totalCold}
              goal={activityStats.goalCold} tone="success" icon={MessageSquare} />
            <ActivityBlock label="관리 TM" value={activityStats.totalManageTm} tone="purple" icon={Activity} />
            <ActivityBlock label="브론즈 DB 확보" value={activityStats.totalConsultantDb} tone="warning" icon={UserPlus} />
          </div>
          <div className="rounded-[12px] border p-3"
            style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
            <p className="mb-2 text-[12px] font-bold" style={{ color: "var(--text-strong)" }}>담당자별 활동량 비교</p>
            <div className="space-y-2.5">
              {activityStats.byPerson.map(p => {
                const maxVal = Math.max(...activityStats.byPerson.map(x => x.tm + x.cold), 1);
                const total = p.tm + p.cold;
                return (
                  <div key={p.name}>
                    <div className="mb-0.5 flex items-center justify-between text-[12px]">
                      <span className="font-bold" style={{ color: "var(--text)" }}>{p.name}</span>
                      <span className="font-semibold tabular-nums" style={{ color: "var(--text-subtle)" }}>
                        TM {p.tm} · 콜드톡 {p.cold} = <strong style={{color:"var(--text-strong)"}}>{total}건</strong>
                      </span>
                    </div>
                    <Bar value={total} max={maxVal} tone="cyan" height={6} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      {/* 활동노트 + 일별 활동목표 */}
      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelTitle icon={FileText} tone="purple" title="활동노트 관리 품질" desc="VIP 고객 정기 관리 현황" />
          <div className="space-y-2.5 p-4">
            {notesQuality.map(n => (
              <div key={n.name} className="rounded-[10px] border p-3"
                style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{n.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>VIP {n.totalVip}명</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-0.5 flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--text-subtle)" }}>활동노트 작성</span>
                      <strong style={{ color: "var(--text-strong)" }}>{n.noteRate}%</strong>
                    </div>
                    <Bar value={n.withNotes} max={Math.max(n.totalVip, 1)} tone={n.noteRate >= 70 ? "success" : n.noteRate >= 40 ? "warning" : "danger"} height={4} />
                  </div>
                  <div>
                    <div className="mb-0.5 flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--text-subtle)" }}>최근 7일 활동</span>
                      <strong style={{ color: "var(--text-strong)" }}>{n.recencyRate}%</strong>
                    </div>
                    <Bar value={n.recentlyTouched} max={Math.max(n.totalVip, 1)} tone={n.recencyRate >= 70 ? "success" : n.recencyRate >= 40 ? "warning" : "danger"} height={4} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={Target} tone="warning" title="일별 활동기록 입력·달성률" desc="당월 매일 활동 입력 충실도" />
          <div className="space-y-2.5 p-4">
            {dailyGoalStats.map(d => (
              <div key={d.name} className="rounded-[10px] border p-3"
                style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{d.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>입력 {d.daysInput}일</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-0.5 flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--text-subtle)" }}>입력률</span>
                      <strong style={{ color: "var(--text-strong)" }}>{d.inputRate}%</strong>
                    </div>
                    <Bar value={d.daysInput} max={22} tone={d.inputRate >= 70 ? "success" : d.inputRate >= 40 ? "warning" : "danger"} height={4} />
                  </div>
                  <div>
                    <div className="mb-0.5 flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--text-subtle)" }}>달성률</span>
                      <strong style={{ color: "var(--text-strong)" }}>{d.achievement}%</strong>
                    </div>
                    <Bar value={d.achievement} max={100} tone={d.achievement >= 70 ? "success" : d.achievement >= 40 ? "warning" : "danger"} height={4} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* 인사이트 (하단) */}
      <Panel>
        <PanelTitle icon={Lightbulb} tone="warning" title="당월 인사이트" desc="데이터 기반 자동 분석 — 상대평가와 액션포인트" />
        <div className="p-4">
          {insights.length === 0 ? (
            <p className="py-6 text-center text-[12px]" style={{ color: "var(--text-faint)" }}>인사이트를 생성할 데이터가 부족합니다</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((it, idx) => {
                const c = toneStyle(it.tone);
                return (
                  <div key={idx} className="rounded-[12px] border p-3.5"
                    style={{ background: c.bg, borderColor: c.border }}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <it.icon size={14} style={{ color: c.text }} />
                      <p className="text-[13px] font-bold leading-tight" style={{ color: c.text }}>{it.title}</p>
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text)" }}>{it.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ━━━ 보조 컴포넌트 ━━━
function FlowStep({ label, count, tone, icon: Icon, rate, rateLabel }: {
  label: string; count: number; tone: ToneName; icon: ElementType; rate?: number; rateLabel?: string;
}) {
  const c = toneStyle(tone);
  return (
    <div className="rounded-[10px] border p-3 text-center"
      style={{ background: c.bg, borderColor: c.border }}>
      <div className="mb-1 flex items-center justify-center gap-1.5">
        <Icon size={12} style={{ color: c.text }} />
        <p className="text-[11px] font-semibold" style={{ color: c.text }}>{label}</p>
      </div>
      <p className="text-[18px] font-bold tabular-nums tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
        {count}<span className="ml-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>건</span>
      </p>
      {rate !== undefined && (
        <p className="mt-0.5 text-[11px] font-semibold" style={{ color: c.text }}>
          {rateLabel} {rate}%
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-[8px] border px-2.5 py-1.5"
      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
      <p className="text-[10px]" style={{ color: "var(--text-subtle)" }}>{label}</p>
      <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
        {value}<span className="ml-0.5 text-[10px] font-normal" style={{ color: "var(--text-subtle)" }}>{unit}</span>
      </p>
    </div>
  );
}

function ActivityBlock({ label, value, goal, tone, icon: Icon }: {
  label: string; value: number; goal?: number; tone: ToneName; icon: ElementType;
}) {
  const c = toneStyle(tone);
  const achievement = goal !== undefined && goal > 0 ? pct1(value, goal) : null;
  return (
    <div className="rounded-[12px] border p-3"
      style={{ background: c.bg, borderColor: c.border }}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon size={13} style={{ color: c.text }} />
        <p className="text-[11px] font-semibold" style={{ color: c.text }}>{label}</p>
      </div>
      <p className="text-[20px] font-bold tabular-nums tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
        {value}<span className="ml-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>건</span>
      </p>
      {achievement !== null && (
        <p className="text-[11px] font-semibold" style={{ color: c.text }}>
          목표 {goal} · 달성 {achievement}%
        </p>
      )}
    </div>
  );
}
