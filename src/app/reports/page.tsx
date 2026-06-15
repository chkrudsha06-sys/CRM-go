"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3,
  ChevronDown, ChevronUp, CircleDollarSign, Lightbulb,
  Loader2, RefreshCw, Target, TrendingDown, TrendingUp,
  Truck, Users, WalletCards, Zap,
} from "lucide-react";

// ━━━ 상수 ━━━
const EXEC = ["조계현", "이세호", "기여운", "최연전"] as const;
const CONSULTANTS = ["박경화","박혜은","조승현","박민경","백선중","강아름","전정훈","박나라"];
type ExecName = (typeof EXEC)[number];
type ToneName = "info"|"success"|"warning"|"danger"|"purple"|"cyan"|"muted";

// ━━━ 포맷 ━━━
function money(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs/100_000_000).toFixed(abs%100_000_000===0?0:1)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs/10_000).toLocaleString()}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}
function moneyFull(n: number) { return `${n.toLocaleString()}원`; }
function pct(a: number, b: number) { return b > 0 ? Math.round((a/b)*100) : 0; }
function monthLabel(y: number, m: number) { return `${y}년 ${m}월`; }
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
          <p className="text-[14px] font-semibold leading-tight tracking-[-0.02em]"
            style={{ color:"var(--text-strong)" }}>{title}</p>
          {desc && <p className="mt-0.5 truncate text-[12px] font-medium tracking-[-0.01em]"
            style={{ color:"var(--text-subtle)" }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: ToneName }) {
  const c = toneStyle(tone);
  return (
    <span className="inline-flex min-h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11px] font-normal tracking-[-0.01em]"
      style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background:c.dot }} />{children}
    </span>
  );
}

function Bar({ value, total, tone = "info", height = 6 }: {
  value: number; total: number; tone?: ToneName; height?: number;
}) {
  const c = toneStyle(tone);
  const w = Math.min(100, pct(value, total || Math.max(value, 1)));
  return (
    <div className="overflow-hidden rounded-full" style={{ height, background:"var(--surface-3)" }}>
      <div className="h-full rounded-full transition-all"
        style={{ width:`${Math.max(w, value > 0 ? 2 : 0)}%`, background:c.bar }} />
    </div>
  );
}

function DeltaBadge({ curr, prev, invert = false, unit = "%" }: {
  curr: number; prev: number; invert?: boolean; unit?: string;
}) {
  if (prev === 0 && curr === 0) return null;
  const delta = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);
  const isUp = invert ? delta < 0 : delta > 0;
  const isDown = invert ? delta > 0 : delta < 0;
  const tone: ToneName = isUp ? "success" : isDown ? "danger" : "muted";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Activity;
  const label = delta === 0 ? `±0${unit}` : `${delta > 0 ? "+" : ""}${delta}${unit}`;
  const c = toneStyle(tone);
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] px-2 py-0.5 text-[11px] font-semibold"
      style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>
      <Icon size={11} />{label}
    </span>
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
  if (ch.includes("하이타겟")) return "하이타겟";
  if (ch.includes("입회비")) return "분양회 입회비";
  if (ch.includes("월회비")) return "분양회 월회비";
  if (ch.includes("LMS")) return "LMS";
  if (ch.includes("호갱")) return "호갱노노";
  return ch || "기타";
}

const PERSON_TONES: ToneName[] = ["info", "purple", "success", "warning"];
const CH_TONES: Record<string,ToneName> = {
  "하이타겟":"purple","분양회 입회비":"warning","분양회 월회비":"cyan","LMS":"success","호갱노노":"info",
};

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
  const [loading,   setLoading]   = useState(true);
  const [expandedPerson, setExpandedPerson] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { s, e } = monthRange(year, month);
    const { y: py, m: pm } = prevMonth(year, month);
    const { s: ps, e: pe } = monthRange(py, pm);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("ad_executions").select("*").gte("payment_date", s).lte("payment_date", e),
      supabase.from("ad_executions").select("*").gte("payment_date", ps).lte("payment_date", pe),
      supabase.from("contacts").select("*"),
      supabase.from("wanpan_trucks").select("*").gte("dispatch_date", s).lte("dispatch_date", e),
    ]);
    setExecs(r1.data || []);
    setPrevExecs(r2.data || []);
    setContacts(r3.data || []);
    setWanpans(r4.data || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const ms      = String(month).padStart(2, "0");
  const mPrefix = `${year}-${ms}`;
  const { y: py, m: pm } = prevMonth(year, month);
  const pmPrefix = `${py}-${String(pm).padStart(2, "0")}`;

  // ── 1. 월간 종합 ──
  const summary = useMemo(() => {
    const totalRev  = execs.reduce((s,e) => s + netAmt(e), 0);
    const prevRev   = prevExecs.reduce((s,e) => s + netAmt(e), 0);
    const refundAmt = execs.reduce((s,e) => s + (e.refund_amount || 0), 0);
    const grossRev  = totalRev + refundAmt;
    const refundRate = grossRev > 0 ? Math.round(refundAmt/grossRev*1000)/10 : 0;
    const prevRefund = prevExecs.reduce((s,e) => s + (e.refund_amount || 0), 0);
    const prevGross  = prevExecs.reduce((s,e) => s + netAmt(e), 0) + prevRefund;
    const prevRefundRate = prevGross > 0 ? Math.round(prevRefund/prevGross*1000)/10 : 0;

    const byCh: Record<string,number> = {};
    execs.forEach(e => { const k = chGroup(e); byCh[k] = (byCh[k] || 0) + netAmt(e); });

    const newContracts  = contacts.filter(c => c.contract_date?.startsWith(mPrefix)).length;
    const newReservs    = contacts.filter(c => c.reservation_date?.startsWith(mPrefix)).length;
    const prevContracts = contacts.filter(c => c.contract_date?.startsWith(pmPrefix)).length;

    const wpCount  = wanpans.length;
    const wpPeople = wanpans.reduce((s,w) => s + (w.team_size || 0), 0);

    const feeRev  = execs.filter(e => (e.channel||"").includes("월회비")).reduce((s,e) => s + netAmt(e), 0);
    const prevFee = prevExecs.filter(e => (e.channel||"").includes("월회비")).reduce((s,e) => s + netAmt(e), 0);

    return { totalRev, prevRev, refundAmt, refundRate, prevRefundRate,
             byCh, newContracts, newReservs, prevContracts,
             wpCount, wpPeople, feeRev, prevFee };
  }, [execs, prevExecs, contacts, wanpans, mPrefix, pmPrefix]);

  // ── 2. 담당자별 성과 ──
  const personData = useMemo(() => {
    return (EXEC as readonly string[]).map(name => {
      const myExecs   = execs.filter(e => (e.team_member || "").includes(name));
      const totalAmt  = myExecs.reduce((s,e) => s + netAmt(e), 0);
      const hitAmt    = myExecs.filter(e => (e.channel||"").includes("하이타겟")).reduce((s,e) => s + netAmt(e), 0);
      const feeAmt    = myExecs.filter(e => (e.channel||"").includes("월회비")).reduce((s,e) => s + netAmt(e), 0);
      const lmsAmt    = myExecs.filter(e => (e.channel||"").includes("LMS")).reduce((s,e) => s + netAmt(e), 0);
      const hogAmt    = myExecs.filter(e => (e.channel||"").includes("호갱")).reduce((s,e) => s + netAmt(e), 0);
      const refundAmt = myExecs.reduce((s,e) => s + (e.refund_amount || 0), 0);
      const execCount = myExecs.length;

      const mine       = contacts.filter(c => c.assigned_to === name);
      const total      = mine.length;
      const contracted = mine.filter(c => c.contract_date?.startsWith(mPrefix)).length;
      const reserved   = mine.filter(c => c.reservation_date?.startsWith(mPrefix)).length;
      const hasMeeting = mine.filter(c => ["계약완료","예약완료","미팅후가망관리","계약거부","미팅불발"]
        .includes(c.meeting_result || "")).length;
      const convRate   = hasMeeting > 0 ? pct(contracted + reserved, hasMeeting) : 0;

      const wpTrips = wanpans.filter(w => {
        try { return JSON.parse(w.staff_members || "[]").includes(name); } catch { return false; }
      }).length;

      const prevMyExecs = prevExecs.filter(e => (e.team_member || "").includes(name));
      const prevAmt     = prevMyExecs.reduce((s,e) => s + netAmt(e), 0);
      const avgDeal     = contracted > 0 ? Math.round(totalAmt / contracted) : 0;

      return { name, totalAmt, hitAmt, feeAmt, lmsAmt, hogAmt, refundAmt, execCount,
               total, contracted, reserved, hasMeeting, convRate, wpTrips,
               prevAmt, avgDeal };
    }).sort((a,b) => b.totalAmt - a.totalAmt);
  }, [execs, prevExecs, contacts, wanpans, mPrefix]);

  // ── 3. 주차별 추이 ──
  const weeklyData = useMemo(() => {
    const ld = new Date(year, month, 0).getDate();
    const weeks: {label:string;s:number;e:number;rev:number;contracts:number;byPerson:Record<string,number>;count:number}[] = [];
    for (let w = 0; w < 5; w++) {
      const s = w*7+1, e2 = Math.min((w+1)*7, ld);
      if (s > ld) break;
      const ms2 = String(month).padStart(2,"0");
      const sD = `${year}-${ms2}-${String(s).padStart(2,"0")}`;
      const eD = `${year}-${ms2}-${String(e2).padStart(2,"0")}`;
      const wExecs = execs.filter(ex => ex.payment_date >= sD && ex.payment_date <= eD);
      const rev = wExecs.reduce((sum,ex) => sum + netAmt(ex), 0);
      const contracts = contacts.filter(c =>
        (c.contract_date >= sD && c.contract_date <= eD) ||
        (c.reservation_date >= sD && c.reservation_date <= eD)).length;
      const byPerson: Record<string,number> = {};
      (EXEC as readonly string[]).forEach(n => {
        byPerson[n] = wExecs.filter(ex => (ex.team_member||"").includes(n)).reduce((sum,ex) => sum + netAmt(ex), 0);
      });
      weeks.push({ label:`${w+1}주차`, s, e:e2, rev, contracts, byPerson, count:wExecs.length });
    }
    return weeks;
  }, [execs, contacts, month, year]);

  // ── 4. 채널 매출구조 ──
  const salesStructure = useMemo(() => {
    const total = summary.totalRev;
    return Object.entries(summary.byCh)
      .sort((a,b) => b[1]-a[1])
      .map(([k,v]) => ({ label:k, value:v, pct:pct(v, total), tone:(CH_TONES[k]||"muted") as ToneName }));
  }, [summary]);

  // ── 5. 컨설턴트별 ──
  const consultantData = useMemo(() => {
    return CONSULTANTS.map(name => {
      const mine   = execs.filter(e => (e.consultant || "") === name);
      const amt    = mine.reduce((s,e) => s + netAmt(e), 0);
      const cnt    = mine.length;
      const refund = mine.reduce((s,e) => s + (e.refund_amount || 0), 0);
      return { name, amt, cnt, refund };
    }).sort((a,b) => b.amt-a.amt);
  }, [execs]);

  // ── 6. AI 인사이트 ──
  const insights = useMemo(() => {
    const list: { tone: ToneName; icon: ElementType; title: string; body: string }[] = [];
    const { totalRev, prevRev, refundRate, newContracts, prevContracts, wpCount } = summary;
    const growth = prevRev > 0 ? Math.round((totalRev-prevRev)/prevRev*100) : 0;

    if (growth >= 20)     list.push({ tone:"success", icon:TrendingUp,    title:`매출 급성장 +${growth}%`,        body:"전월 대비 크게 성장했습니다. 성장세를 이어가려면 상위 채널 집중 투자와 담당자 활동량 유지가 핵심입니다." });
    else if (growth >= 5) list.push({ tone:"info",    icon:TrendingUp,    title:`매출 소폭 상승 +${growth}%`,     body:"안정적 상승이지만 목표 달성을 위해 고전환율 가망 고객 집중 관리가 필요합니다." });
    else if (growth < -5) list.push({ tone:"danger",  icon:TrendingDown,  title:`매출 하락 ${growth}%`,           body:"담당자별 실적 편차를 점검하고 주차별 추이에서 하락 시점을 확인하세요." });

    if (refundRate > 10)  list.push({ tone:"danger",  icon:AlertTriangle, title:`환불률 ${refundRate}% — 위험`,   body:"환불률이 10%를 초과했습니다. 계약 전 고객 검증 프로세스와 약정 이행 관리를 강화하세요." });
    else if (refundRate > 5) list.push({ tone:"warning", icon:AlertTriangle, title:`환불률 ${refundRate}% — 주의`, body:"가입 직후 30일 관리를 강화하면 환불률을 낮출 수 있습니다." });

    const contractGrowth = prevContracts > 0 ? Math.round((newContracts-prevContracts)/prevContracts*100) : 0;
    if (newContracts === 0) list.push({ tone:"danger", icon:Target, title:"이달 계약 0건", body:"미팅 전환율이 낮은 담당자의 미팅 품질 개선이 우선입니다." });
    else if (contractGrowth >= 30) list.push({ tone:"success", icon:Target, title:`계약 급증 +${contractGrowth}%`, body:`${newContracts}건으로 전월 대비 크게 증가했습니다. 성공 패턴을 분석해 팀 전체에 공유하세요.` });

    const topCh = salesStructure[0];
    if (topCh && topCh.pct >= 60) list.push({ tone:"warning", icon:BarChart3, title:`${topCh.label} 의존도 ${topCh.pct}%`, body:"매출의 절반 이상이 단일 채널에 집중됩니다. 호갱노노·LMS 등 보조 채널 비중을 높여 리스크를 분산하세요." });

    const amts = personData.map(p => p.totalAmt);
    const maxAmt = Math.max(...amts, 1), minAmt = Math.min(...amts);
    const gap = maxAmt > 0 ? Math.round((maxAmt-minAmt)/maxAmt*100) : 0;
    if (gap >= 70 && personData.length > 1) {
      const top = personData[0], bot = personData[personData.length-1];
      list.push({ tone:"warning", icon:Users, title:`팀 내 실적 편차 ${gap}%`, body:`${top.name}(${money(top.totalAmt)})과 ${bot.name}(${money(bot.totalAmt)})의 격차가 큽니다. 상위 담당자의 성공 전략을 팀에 전파하세요.` });
    }

    if (wpCount === 0)    list.push({ tone:"muted",   icon:Truck, title:"이달 완판트럭 0회",        body:"네트워킹 망 유지를 위해 다음 달 일정을 조기에 확정하세요." });
    else if (wpCount >= 6) list.push({ tone:"success", icon:Truck, title:`완판트럭 ${wpCount}회 달성`, body:"목표 월 6~8회를 달성했습니다. 접촉 현장의 후속 관리(TM/콜드톡)로 분양회 가입 전환을 이어가세요." });

    const bestConv = [...personData].sort((a,b) => b.convRate-a.convRate)[0];
    if (bestConv?.convRate >= 50) list.push({ tone:"success", icon:Activity, title:`${bestConv.name} 미팅전환율 ${bestConv.convRate}%`, body:"미팅 전환율이 탁월합니다. 제안 방식·타이밍·고객 유형을 문서화해 팀 표준으로 삼으세요." });

    return list.slice(0, 6);
  }, [summary, salesStructure, personData]);

  // ━━━ 스케일 최대값 ━━━
  const maxPersonAmt  = Math.max(...personData.map(p => p.totalAmt), 1);
  const maxWeekRev    = Math.max(...weeklyData.map(w => w.rev), 1);
  const maxConsultAmt = Math.max(...consultantData.map(c => c.amt), 1);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 size={22} className="animate-spin" style={{ color:"var(--text-faint)" }} />
    </div>
  );

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="premium-header flex shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} style={{ color:"var(--accent-text)" }} />
            <h1 className="crm-title">팀 성과 분석</h1>
          </div>
          <p className="crm-subtitle mt-1">{monthLabel(year,month)} · 실행파트 영업 종합 인사이트</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="h-9 rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
            style={{ background:"var(--surface-2)", borderColor:"var(--border)", color:"var(--text-strong)" }}>
            {Array.from({length:12},(_,i) => i+1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <button type="button" onClick={load} className="btn-premium btn-secondary">
            <RefreshCw size={14} />새로고침
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 md:px-7">
        <div className="mx-auto max-w-[1400px] space-y-5 pt-4">

          {/* ══════════════════════════════
               1. 월간 종합 지표 카드 6종
          ══════════════════════════════ */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">

            {/* 총매출 */}
            <div className="premium-card col-span-2 p-4 sm:col-span-1">
              <div className="mb-2 flex items-center justify-between">
                <IconBox icon={CircleDollarSign} tone="info" size="sm" />
                <DeltaBadge curr={summary.totalRev} prev={summary.prevRev} />
              </div>
              <p className="text-[11px] font-normal" style={{ color:"var(--text-subtle)" }}>월 총매출</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color:"var(--text-strong)" }}>{money(summary.totalRev)}</p>
              <p className="mt-1 text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>전월 {money(summary.prevRev)}</p>
            </div>

            {/* 계약+예약 */}
            <div className="premium-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <IconBox icon={Target} tone="success" size="sm" />
                <DeltaBadge curr={summary.newContracts} prev={summary.prevContracts} />
              </div>
              <p className="text-[11px] font-normal" style={{ color:"var(--text-subtle)" }}>계약+예약</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color:"var(--text-strong)" }}>
                {summary.newContracts + summary.newReservs}<span className="text-[14px]">건</span>
              </p>
              <p className="mt-1 text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>계약 {summary.newContracts} · 예약 {summary.newReservs}</p>
            </div>

            {/* 분양회 월회비 */}
            <div className="premium-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <IconBox icon={WalletCards} tone="cyan" size="sm" />
                <DeltaBadge curr={summary.feeRev} prev={summary.prevFee} />
              </div>
              <p className="text-[11px] font-normal" style={{ color:"var(--text-subtle)" }}>분양회 월회비</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color:"var(--text-strong)" }}>{money(summary.feeRev)}</p>
              <p className="mt-1 text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>전월 {money(summary.prevFee)}</p>
            </div>

            {/* 환불률 */}
            <div className="premium-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <IconBox icon={AlertTriangle} tone={summary.refundRate > 10 ? "danger" : summary.refundRate > 5 ? "warning" : "muted"} size="sm" />
                <Badge tone={summary.refundRate > 10 ? "danger" : summary.refundRate > 5 ? "warning" : "success"}>
                  {summary.refundRate > 10 ? "위험" : summary.refundRate > 5 ? "주의" : "양호"}
                </Badge>
              </div>
              <p className="text-[11px] font-normal" style={{ color:"var(--text-subtle)" }}>환불률</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color:"var(--text-strong)" }}>
                {summary.refundRate}<span className="text-[14px]">%</span>
              </p>
              <p className="mt-1 text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>환불 {money(summary.refundAmt)}</p>
            </div>

            {/* 완판트럭 */}
            <div className="premium-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <IconBox icon={Truck} tone="warning" size="sm" />
                <Badge tone={summary.wpCount >= 6 ? "success" : summary.wpCount >= 3 ? "info" : "muted"}>
                  {summary.wpCount >= 6 ? "목표달성" : "진행중"}
                </Badge>
              </div>
              <p className="text-[11px] font-normal" style={{ color:"var(--text-subtle)" }}>완판트럭 출장</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color:"var(--text-strong)" }}>
                {summary.wpCount}<span className="text-[14px]">회</span>
              </p>
              <p className="mt-1 text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>접촉 {summary.wpPeople}명</p>
            </div>

            {/* 총 실행건수 */}
            <div className="premium-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <IconBox icon={Zap} tone="purple" size="sm" />
              </div>
              <p className="text-[11px] font-normal" style={{ color:"var(--text-subtle)" }}>총 실행건수</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color:"var(--text-strong)" }}>
                {execs.length}<span className="text-[14px]">건</span>
              </p>
              <p className="mt-1 text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>
                평균 {execs.length > 0 ? money(Math.round(summary.totalRev / execs.length)) : "0"}/건
              </p>
            </div>
          </div>

          {/* ══════════════════════════
               2. 데이터 인사이트
          ══════════════════════════ */}
          {insights.length > 0 && (
            <Panel>
              <PanelTitle icon={Lightbulb} tone="warning" title="이달의 인사이트"
                desc="데이터 기반 자동 생성 — 주목해야 할 시그널과 액션 포인트" />
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {insights.map((ins, i) => {
                  const c = toneStyle(ins.tone);
                  const Icon = ins.icon;
                  return (
                    <div key={i} className="rounded-[12px] border p-3.5" style={{ background:c.bg, borderColor:c.border }}>
                      <div className="mb-2 flex items-center gap-2">
                        <Icon size={14} style={{ color:c.text }} />
                        <p className="text-[13px] font-semibold tracking-[-0.02em]" style={{ color:c.text }}>{ins.title}</p>
                      </div>
                      <p className="text-[12px] font-medium leading-relaxed tracking-[-0.01em]" style={{ color:"var(--text-muted)" }}>{ins.body}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* ══════════════════════════
               3. 담당자별 성과
          ══════════════════════════ */}
          <Panel>
            <PanelTitle icon={Users} tone="info" title="담당자별 성과"
              desc="매출 · 영업활동 · 미팅전환 · 채널별 구성 — 이름 클릭 시 채널 상세 확장" />
            <div className="p-4 space-y-4">

              {/* 카드 그리드 */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {personData.map((p, idx) => {
                  const tone = PERSON_TONES[idx % 4];
                  const c    = toneStyle(tone);
                  const isExpanded = expandedPerson === p.name;
                  return (
                    <div key={p.name} className="rounded-[14px] border overflow-hidden"
                      style={{ background:"var(--surface-2)", borderColor:"var(--border-subtle)" }}>

                      {/* 이름+순위 헤더 (클릭 → 채널 상세 토글) */}
                      <button type="button"
                        onClick={() => setExpandedPerson(isExpanded ? null : p.name)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:opacity-80">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[13px] font-black"
                            style={{ background:c.bar }}>
                            {p.name[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14px] font-semibold tracking-[-0.02em]" style={{ color:"var(--text-strong)" }}>{p.name}</span>
                              {idx === 0 && <Badge tone="warning">1위</Badge>}
                            </div>
                            <DeltaBadge curr={p.totalAmt} prev={p.prevAmt} />
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp size={14} style={{ color:"var(--text-faint)" }} />
                          : <ChevronDown size={14} style={{ color:"var(--text-faint)" }} />
                        }
                      </button>

                      {/* 총매출 + 바 */}
                      <div className="px-4 pb-3">
                        <div className="mb-1 flex items-baseline justify-between">
                          <span className="text-[20px] font-semibold leading-none tracking-[-0.04em]"
                            style={{ color:"var(--text-strong)" }}>{money(p.totalAmt)}</span>
                          <span className="text-[11px] font-medium" style={{ color:"var(--text-subtle)" }}>
                            {pct(p.totalAmt, maxPersonAmt)}%
                          </span>
                        </div>
                        <Bar value={p.totalAmt} total={maxPersonAmt} tone={tone} height={6} />
                      </div>

                      {/* KPI 4종 격자 */}
                      <div className="grid grid-cols-4 border-t" style={{ borderColor:"var(--border-subtle)" }}>
                        {[
                          { label:"계약",   value:`${p.contracted}건`, tone:"success" as ToneName },
                          { label:"전환율", value:`${p.convRate}%`,    tone:(p.convRate>=40?"success":p.convRate>=20?"warning":"muted") as ToneName },
                          { label:"완판",   value:`${p.wpTrips}회`,    tone:"warning" as ToneName },
                          { label:"실행",   value:`${p.execCount}건`,  tone:"cyan" as ToneName },
                        ].map(k => {
                          const kc = toneStyle(k.tone);
                          return (
                            <div key={k.label} className="flex flex-col items-center py-2.5">
                              <span className="text-[10px] font-normal" style={{ color:"var(--text-faint)" }}>{k.label}</span>
                              <span className="mt-0.5 text-[13px] font-semibold tabular-nums" style={{ color:kc.text }}>{k.value}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* 채널별 상세 (확장) */}
                      {isExpanded && (
                        <div className="border-t p-4 space-y-3" style={{ borderColor:"var(--border-subtle)" }}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color:"var(--text-faint)" }}>채널별 매출</p>
                          {[
                            { label:"하이타겟",    value:p.hitAmt, tone:"purple" as ToneName },
                            { label:"분양회 월회비", value:p.feeAmt, tone:"cyan" as ToneName },
                            { label:"LMS",        value:p.lmsAmt, tone:"success" as ToneName },
                            { label:"호갱노노",    value:p.hogAmt, tone:"info" as ToneName },
                          ].filter(item => item.value > 0).map(item => (
                            <div key={item.label}>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>{item.label}</span>
                                <span className="text-[12px] font-semibold tabular-nums" style={{ color:"var(--text-strong)" }}>{money(item.value)}</span>
                              </div>
                              <Bar value={item.value} total={p.totalAmt || 1} tone={item.tone} height={4} />
                            </div>
                          ))}
                          {[p.hitAmt,p.feeAmt,p.lmsAmt,p.hogAmt].every(v=>v===0) && (
                            <p className="text-[12px]" style={{ color:"var(--text-faint)" }}>채널 데이터 없음</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="rounded-[10px] border p-2.5" style={{ background:"var(--surface-3)", borderColor:"var(--border-subtle)" }}>
                              <p className="text-[10px] font-normal" style={{ color:"var(--text-faint)" }}>평균 계약 단가</p>
                              <p className="mt-0.5 text-[14px] font-semibold" style={{ color:"var(--text-strong)" }}>{p.avgDeal > 0 ? money(p.avgDeal) : "—"}</p>
                            </div>
                            <div className="rounded-[10px] border p-2.5" style={{ background:"var(--surface-3)", borderColor:"var(--border-subtle)" }}>
                              <p className="text-[10px] font-normal" style={{ color:"var(--text-faint)" }}>환불액</p>
                              <p className="mt-0.5 text-[14px] font-semibold"
                                style={{ color:p.refundAmt > 0 ? "var(--danger-text)" : "var(--text-strong)" }}>
                                {p.refundAmt > 0 ? money(p.refundAmt) : "0원"}
                              </p>
                            </div>
                          </div>
                          <div className="rounded-[10px] border p-2.5" style={{ background:"var(--surface-3)", borderColor:"var(--border-subtle)" }}>
                            <p className="text-[10px] font-normal mb-1" style={{ color:"var(--text-faint)" }}>고객 파이프라인</p>
                            <div className="flex gap-3 text-[12px]">
                              <span style={{ color:"var(--text-muted)" }}>총 <strong style={{ color:"var(--text-strong)" }}>{p.total}명</strong></span>
                              <span style={{ color:"var(--text-muted)" }}>미팅 <strong style={{ color:"var(--text-strong)" }}>{p.hasMeeting}건</strong></span>
                              <span style={{ color:"var(--text-muted)" }}>예약 <strong style={{ color:"var(--success-text)" }}>{p.reserved}건</strong></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 비교 테이블 */}
              <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor:"var(--border-subtle)" }}>
                <table className="w-full min-w-[960px] border-collapse text-center">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                      style={{ background:"var(--surface-2)", color:"var(--text-faint)", borderBottom:"1px solid var(--border-subtle)" }}>
                      {["순위","담당자","총매출","하이타겟","월회비","LMS","호갱노노","계약","예약","미팅전환율","완판트럭","평균단가"].map(h => (
                        <th key={h} className="px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {personData.map((p, idx) => (
                      <tr key={p.name} className="text-[13px] font-medium transition hover:bg-white/[0.03]"
                        style={{ color:"var(--text-muted)", borderBottom:"1px solid var(--border-subtle)" }}>
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-black"
                            style={{ color:idx===0?"var(--warning-text)":idx===1?"var(--text-subtle)":"var(--text-faint)" }}>
                            {idx+1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[14px] font-semibold" style={{ color:"var(--text-strong)" }}>{p.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold tabular-nums" style={{ color:"var(--text-strong)" }}>{moneyFull(p.totalAmt)}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color:"var(--purple-text)" }}>{p.hitAmt > 0 ? moneyFull(p.hitAmt) : "—"}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color:"var(--cyan-text)" }}>{p.feeAmt > 0 ? moneyFull(p.feeAmt) : "—"}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color:"var(--success-text)" }}>{p.lmsAmt > 0 ? moneyFull(p.lmsAmt) : "—"}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color:"var(--info-text)" }}>{p.hogAmt > 0 ? moneyFull(p.hogAmt) : "—"}</td>
                        <td className="px-4 py-3"><Badge tone={p.contracted > 0 ? "success" : "muted"}>{p.contracted}건</Badge></td>
                        <td className="px-4 py-3"><Badge tone={p.reserved > 0 ? "info" : "muted"}>{p.reserved}건</Badge></td>
                        <td className="px-4 py-3">
                          <Badge tone={p.convRate >= 40 ? "success" : p.convRate >= 20 ? "warning" : "muted"}>{p.convRate}%</Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color:"var(--text)" }}>{p.wpTrips}회</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color:"var(--text-muted)" }}>{p.avgDeal > 0 ? money(p.avgDeal) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          {/* ══════════════════════════
               4. 매출구조 + 주차별 추이
          ══════════════════════════ */}
          <div className="grid gap-4 xl:grid-cols-2">

            {/* 채널별 매출구성 */}
            <Panel>
              <PanelTitle icon={CircleDollarSign} tone="cyan" title="채널별 매출 구성"
                desc={`${monthLabel(year,month)} 합계 ${moneyFull(summary.totalRev)}`} />
              <div className="p-4 space-y-3">
                {/* 스택 바 */}
                <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background:"var(--surface-3)" }}>
                  {salesStructure.filter(s => s.value > 0).map(s => (
                    <div key={s.label} style={{ width:`${s.pct}%`, background:toneStyle(s.tone).bar }} />
                  ))}
                </div>
                <div className="space-y-2">
                  {salesStructure.map(s => (
                    <div key={s.label} className="rounded-[12px] border px-3 py-2.5"
                      style={{ background:"var(--surface-2)", borderColor:"var(--border-subtle)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background:toneStyle(s.tone).dot }} />
                          <span className="truncate text-[13px] font-semibold tracking-[-0.02em]" style={{ color:"var(--text-strong)" }}>{s.label}</span>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-2">
                          <span className="text-[14px] font-semibold tabular-nums" style={{ color:"var(--text-strong)" }}>{moneyFull(s.value)}</span>
                          <span className="w-9 text-right text-[11px] font-semibold" style={{ color:"var(--text-subtle)" }}>{s.pct}%</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Bar value={s.value} total={summary.totalRev || 1} tone={s.tone} height={4} />
                      </div>
                    </div>
                  ))}
                  {salesStructure.length === 0 && (
                    <p className="py-8 text-center text-[12px]" style={{ color:"var(--text-faint)" }}>이달 매출 데이터가 없습니다</p>
                  )}
                </div>
              </div>
            </Panel>

            {/* 주차별 추이 */}
            <Panel>
              <PanelTitle icon={TrendingUp} tone="success" title="주차별 매출 추이"
                desc="전체 채널 합산 · 담당자별 기여도" />
              <div className="p-4 space-y-2">
                {weeklyData.map(w => {
                  const weekMax = Math.max(...(EXEC as readonly string[]).map(n => w.byPerson[n] || 0), 1);
                  return (
                    <div key={w.label} className="rounded-[12px] border p-3"
                      style={{ background:"var(--surface-2)", borderColor:"var(--border-subtle)" }}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold" style={{ color:"var(--text-strong)" }}>{w.label}</span>
                          <span className="text-[11px]" style={{ color:"var(--text-faint)" }}>{w.s}~{w.e}일</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="success">{w.contracts}건</Badge>
                          <span className="text-[13px] font-semibold tabular-nums" style={{ color:"var(--text-strong)" }}>{money(w.rev)}</span>
                        </div>
                      </div>
                      <Bar value={w.rev} total={maxWeekRev} tone="info" height={6} />
                      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                        {(EXEC as readonly string[]).map((n, ni) => {
                          const val  = w.byPerson[n] || 0;
                          const tone = PERSON_TONES[ni];
                          return (
                            <div key={n}>
                              <div className="mb-0.5 flex items-center justify-between">
                                <span className="text-[10px]" style={{ color:"var(--text-faint)" }}>{n[0]}</span>
                                <span className="text-[10px] tabular-nums" style={{ color:"var(--text-subtle)" }}>{val > 0 ? money(val) : "—"}</span>
                              </div>
                              <Bar value={val} total={weekMax} tone={tone} height={3} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {weeklyData.length === 0 && (
                  <p className="py-8 text-center text-[12px]" style={{ color:"var(--text-faint)" }}>이달 데이터가 없습니다</p>
                )}

                {/* 주차×개인 교차표 */}
                <div className="mt-3 overflow-x-auto rounded-[10px] border" style={{ borderColor:"var(--border-subtle)" }}>
                  <table className="w-full border-collapse text-center text-[12px]">
                    <thead>
                      <tr style={{ background:"var(--surface-3)", borderBottom:"1px solid var(--border-subtle)" }}>
                        <th className="px-3 py-2 font-semibold" style={{ color:"var(--text-faint)" }}>주차</th>
                        {(EXEC as readonly string[]).map(n => (
                          <th key={n} className="px-3 py-2 font-semibold" style={{ color:"var(--text-faint)" }}>{n}</th>
                        ))}
                        <th className="px-3 py-2 font-semibold" style={{ color:"var(--text-faint)" }}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyData.map(w => (
                        <tr key={w.label} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                          <td className="px-3 py-2 font-semibold" style={{ color:"var(--text-muted)" }}>{w.label}</td>
                          {(EXEC as readonly string[]).map((n, ni) => {
                            const val   = w.byPerson[n] || 0;
                            const ratio = val > 0 ? Math.max(pct(val, Math.max(...(EXEC as readonly string[]).map(nn => w.byPerson[nn]||0), 1)), 20) : 0;
                            const tone  = PERSON_TONES[ni];
                            const tc    = toneStyle(tone);
                            return (
                              <td key={n} className="px-3 py-2 tabular-nums"
                                style={{ color:val > 0 ? tc.text : "var(--text-faint)" }}>
                                {val > 0 ? money(val) : "—"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 font-bold tabular-nums" style={{ color:"var(--text-strong)" }}>{money(w.rev)}</td>
                        </tr>
                      ))}
                      <tr style={{ background:"var(--surface-2)" }}>
                        <td className="px-3 py-2 font-bold" style={{ color:"var(--text-strong)" }}>합계</td>
                        {(EXEC as readonly string[]).map((n, ni) => {
                          const total = weeklyData.reduce((s,w) => s + (w.byPerson[n] || 0), 0);
                          const tc    = toneStyle(PERSON_TONES[ni]);
                          return (
                            <td key={n} className="px-3 py-2 font-bold tabular-nums" style={{ color:tc.text }}>{money(total)}</td>
                          );
                        })}
                        <td className="px-3 py-2 font-black tabular-nums" style={{ color:"var(--text-strong)" }}>
                          {money(weeklyData.reduce((s,w) => s + w.rev, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          </div>

          {/* ══════════════════════════
               5. 컨설턴트별 매출
          ══════════════════════════ */}
          <Panel>
            <PanelTitle icon={Users} tone="purple" title="담당컨설턴트별 매출"
              desc="전체 채널 합산 · 환불 차감 순매출" />
            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {consultantData.map((c, i) => (
                  <div key={c.name} className="rounded-[12px] border p-3"
                    style={{ background:"var(--surface-2)", borderColor:"var(--border-subtle)" }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-black"
                          style={{ background:i===0?"var(--warning)":i===1?"var(--text-subtle)":i===2?"var(--cyan)":"var(--surface-3)" }}>
                          {i < 3 ? i+1 : c.name[0]}
                        </div>
                        <span className="text-[13px] font-semibold tracking-[-0.02em]" style={{ color:"var(--text-strong)" }}>{c.name}</span>
                      </div>
                      <span className="text-[11px]" style={{ color:"var(--text-faint)" }}>{c.cnt}건</span>
                    </div>
                    <p className="text-[17px] font-semibold tabular-nums leading-none tracking-[-0.03em]"
                      style={{ color:c.amt > 0 ? "var(--info-text)" : "var(--text-faint)" }}>
                      {c.amt > 0 ? moneyFull(c.amt) : "실적 없음"}
                    </p>
                    {c.amt > 0 && (
                      <>
                        <div className="mt-2"><Bar value={c.amt} total={maxConsultAmt} tone="info" height={4} /></div>
                        {c.refund > 0 && <p className="mt-1 text-[11px]" style={{ color:"var(--danger-text)" }}>환불 {money(c.refund)}</p>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* ══════════════════════════
               6. 전월 대비 종합 비교
          ══════════════════════════ */}
          <Panel>
            <PanelTitle icon={BarChart3} tone="muted" title="전월 대비 종합 비교"
              desc={`${monthLabel(py,pm)} → ${monthLabel(year,month)}`} />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label:"총매출",      curr:summary.totalRev,                     prev:summary.prevRev,   fmt:moneyFull, tone:"info"    as ToneName, invert:false },
                { label:"계약+예약",   curr:summary.newContracts+summary.newReservs, prev:summary.prevContracts, fmt:(n:number)=>`${n}건`, tone:"success" as ToneName, invert:false },
                { label:"분양회 월회비", curr:summary.feeRev,                      prev:summary.prevFee,   fmt:moneyFull, tone:"cyan"    as ToneName, invert:false },
                { label:"환불률",      curr:summary.refundRate,                    prev:summary.prevRefundRate, fmt:(n:number)=>`${n}%`, tone:"danger" as ToneName, invert:true },
              ].map(item => {
                const isUp = item.invert
                  ? item.curr < item.prev
                  : item.curr > item.prev;
                return (
                  <div key={item.label} className="rounded-[12px] border p-4"
                    style={{ background:"var(--surface-2)", borderColor:"var(--border-subtle)" }}>
                    <p className="text-[11px] font-normal" style={{ color:"var(--text-subtle)" }}>{item.label}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[20px] font-semibold tabular-nums leading-none tracking-[-0.04em]"
                        style={{ color:"var(--text-strong)" }}>{item.fmt(item.curr)}</span>
                      <DeltaBadge curr={item.curr} prev={item.prev} invert={item.invert} />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <ArrowRight size={11} style={{ color:"var(--text-faint)" }} />
                      <span className="text-[12px] font-medium" style={{ color:"var(--text-muted)" }}>전월 {item.fmt(item.prev)}</span>
                    </div>
                    <div className="mt-3">
                      <Bar value={item.curr} total={Math.max(item.curr, item.prev, 1)} tone={isUp ? item.tone : "muted"} height={4} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 담당자별 전월 비교 */}
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor:"var(--border-subtle)" }}>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color:"var(--text-faint)" }}>담당자별 전월 대비</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {personData.map((p) => (
                  <div key={p.name} className="rounded-[12px] border p-3"
                    style={{ background:"var(--surface-2)", borderColor:"var(--border-subtle)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold" style={{ color:"var(--text-strong)" }}>{p.name}</span>
                      <DeltaBadge curr={p.totalAmt} prev={p.prevAmt} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                      <div className="flex justify-between">
                        <span style={{ color:"var(--text-faint)" }}>이번달</span>
                        <span className="font-semibold tabular-nums" style={{ color:"var(--text-strong)" }}>{money(p.totalAmt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color:"var(--text-faint)" }}>전월</span>
                        <span className="tabular-nums" style={{ color:"var(--text-muted)" }}>{money(p.prevAmt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color:"var(--text-faint)" }}>계약</span>
                        <span className="font-semibold" style={{ color:"var(--success-text)" }}>{p.contracted}건</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color:"var(--text-faint)" }}>전환율</span>
                        <span className="font-semibold" style={{ color:"var(--text-strong)" }}>{p.convRate}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}
