"use client";

import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  Database,
  LineChart,
  Loader2,
  RefreshCw,
  Users,
  WalletCards,
} from "lucide-react";

type ToneName = "info" | "success" | "warning" | "danger" | "purple" | "cyan" | "muted";
type GradeKey = "마스터" | "챌린저" | "브론즈";
type RankGroup = "본부장" | "팀장" | "팀원";
type SalesCategory = "membership" | "lms" | "hogang" | "other";

type ContactRow = Record<string, any> & {
  id: number;
  name?: string | null;
  title?: string | null;
  intake_route?: string | null;
  customer_grade?: string | null;
  management_stage?: string | null;
  meeting_result?: string | null;
  contract_date?: string | null;
  vip_transferred_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  crm_db_source?: string | null;
};

type SalesRow = Record<string, any> & {
  id: number;
  execution_amount?: number | null;
  vat_amount?: number | null;
  refund_amount?: number | null;
  channel?: string | null;
  contract_route?: string | null;
  payment_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FlowMetric = {
  grade: GradeKey;
  total: number;
  converted: number;
};

type FlowGroup = {
  rank: RankGroup;
  rows: FlowMetric[];
  total: number;
  converted: number;
  rate: number;
};

type FlowRoute = {
  route: string;
  groups: FlowGroup[];
};

const GRADES: GradeKey[] = ["마스터", "챌린저", "브론즈"];
const INTAKE_ROUTES = ["완판트럭", "분양라인", "분양회MGM", "대협팀활동", "분양의신 DB", "컨설턴트 VIP DB"];
const LEFT_INTAKE_ROUTES = ["분양의신 DB", "컨설턴트 VIP DB", "완판트럭", "분양라인", "분양회MGM", "대협팀활동"];
const RANK_GROUPS: RankGroup[] = ["본부장", "팀장"];
const VIP_DB_SOURCE = "vip_activity";

const FLOW_GRADE_MAP: Record<RankGroup, GradeKey[]> = {
  본부장: ["챌린저", "브론즈"],
  팀장: ["마스터", "브론즈"],
  팀원: ["마스터", "챌린저", "브론즈"],
};

function normalizeText(value?: string | number | null) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = raw.length === 10 ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isBefore(date: Date | null, end: Date) {
  return Boolean(date && date < end);
}

function isBetween(date: Date | null, start: Date, end: Date) {
  return Boolean(date && date >= start && date <= end);
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function moneyFull(value?: number | null) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function shortMoney(value?: number | null) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 1)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

function gradeOf(contact: ContactRow): GradeKey | null {
  const grade = normalizeText(contact.customer_grade || contact.grade || contact.assessment_result);
  if (!grade) return null;
  if (grade.includes("마스터")) return "마스터";
  if (grade.includes("챌린저")) return "챌린저";
  if (grade.includes("브론즈")) return "브론즈";
  return null;
}

function isGrade(contact: ContactRow, grade: GradeKey) {
  return gradeOf(contact) === grade;
}

function isContracted(contact: ContactRow) {
  const stage = normalizeText(contact.management_stage);
  const result = normalizeText(contact.meeting_result);
  return stage === normalizeText("리텐션") || result === normalizeText("계약완료");
}

function isRetentionMember(contact: ContactRow) {
  return isContracted(contact) && Boolean(parseDate(contact.contract_date));
}

function routeMatches(contact: ContactRow, route: string) {
  const value = normalizeText(contact.intake_route || contact.inflow_route || contact.source_route);
  const target = normalizeText(route);
  if (!value) return false;
  if (target === normalizeText("분양의신 DB")) return value.includes("분양의신");
  if (target === normalizeText("컨설턴트 VIP DB")) return value.includes("컨설턴트") && value.includes("VIP");
  return value.includes(target);
}

function routeLabelOf(contact: ContactRow) {
  const matched = [...INTAKE_ROUTES, ...LEFT_INTAKE_ROUTES].find((route) => routeMatches(contact, route));
  return matched || contact.intake_route || "기타";
}

function rankOf(contact: ContactRow): RankGroup {
  const title = normalizeText(contact.title);
  if (title.includes("본부장")) return "본부장";
  if (title.includes("팀장")) return "팀장";
  return "팀원";
}

function contactMonthDate(contact: ContactRow) {
  return parseDate(contact.vip_transferred_at || contact.created_at || contact.updated_at || null);
}

function effectiveSales(row: SalesRow) {
  return Number(row.execution_amount || 0) - Number(row.refund_amount || 0);
}

function salesCategory(row: SalesRow): SalesCategory {
  const route = normalizeText(row.contract_route || row.payment_item || row.payment_type || row.item_name);
  const channel = normalizeText(row.channel);
  const memo = normalizeText(row.memo || row.special_notes || "");
  const bag = `${route}${channel}${memo}`;

  if (bag.includes("LMS")) return "lms";
  if (bag.includes("호갱노노")) return "hogang";
  if (bag.includes("분양회") || bag.includes("월회비") || bag.includes("회비") || channel.includes("효성CMS")) return "membership";
  if (!route && (channel.includes("사이다페이") || channel.includes("카드"))) return "membership";
  return "other";
}

function salesDate(row: SalesRow) {
  return parseDate(row.payment_date || row.created_at || row.updated_at || null);
}

function sumSales(rows: SalesRow[], category: SalesCategory) {
  return rows.filter((row) => salesCategory(row) === category).reduce((sum, row) => sum + effectiveSales(row), 0);
}

function countByGrade(rows: ContactRow[]) {
  return GRADES.reduce<Record<GradeKey, number>>((acc, grade) => {
    acc[grade] = rows.filter((row) => isGrade(row, grade)).length;
    return acc;
  }, { 마스터: 0, 챌린저: 0, 브론즈: 0 });
}

function toneStyle(tone: ToneName) {
  const map: Record<ToneName, { bg: string; text: string; border: string; dot: string; bar: string }> = {
    info: { bg: "var(--info-bg)", text: "var(--info-text)", border: "var(--info-border)", dot: "var(--info)", bar: "linear-gradient(90deg,#60A5FA,#22D3EE)" },
    success: { bg: "var(--success-bg)", text: "var(--success-text)", border: "var(--success-border)", dot: "var(--success)", bar: "linear-gradient(90deg,#34D399,#22D3EE)" },
    warning: { bg: "var(--warning-bg)", text: "var(--warning-text)", border: "var(--warning-border)", dot: "var(--warning)", bar: "linear-gradient(90deg,#FBBF24,#FB7185)" },
    danger: { bg: "var(--danger-bg)", text: "var(--danger-text)", border: "var(--danger-border)", dot: "var(--danger)", bar: "linear-gradient(90deg,#FB7185,#F43F5E)" },
    purple: { bg: "var(--purple-bg)", text: "var(--purple-text)", border: "var(--purple-border)", dot: "var(--purple)", bar: "linear-gradient(90deg,#8B7CF6,#60A5FA)" },
    cyan: { bg: "var(--cyan-bg)", text: "var(--cyan-text)", border: "var(--cyan-border)", dot: "var(--cyan)", bar: "linear-gradient(90deg,#22D3EE,#34D399)" },
    muted: { bg: "var(--surface-3)", text: "var(--text-subtle)", border: "var(--border)", dot: "var(--text-faint)", bar: "linear-gradient(90deg,var(--text-faint),var(--border))" },
  };
  return map[tone];
}

function IconBox({ icon: Icon, tone = "info" }: { icon: ElementType; tone?: ToneName }) {
  const c = toneStyle(tone);
  return (
    <div
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      <Icon size={15} />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`premium-card overflow-hidden ${className}`}>{children}</section>;
}

function PanelTitle({ icon, tone, title, desc, right }: { icon: ElementType; tone: ToneName; title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex min-w-0 items-start gap-2.5">
        <IconBox icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
            {title}
          </p>
          {desc && <p className="mt-0.5 text-[12px] font-medium leading-relaxed tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: ToneName }) {
  const c = toneStyle(tone);
  return (
    <span
      className="inline-flex min-h-[23px] shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-[-0.01em]"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {children}
    </span>
  );
}

function MetricLine({ label, value, sub, tone = "muted" }: { label: string; value: number | string; sub?: string; tone?: ToneName }) {
  const c = toneStyle(tone);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[11px] border px-3 py-2" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium tracking-[-0.01em]" style={{ color: c.text }}>{label}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>{sub}</p>}
      </div>
      <p className="shrink-0 text-[17px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function SummaryGradeRows({ counts, increments }: { counts: Record<GradeKey, number>; increments?: Record<GradeKey, number> }) {
  const total = GRADES.reduce((sum, grade) => sum + counts[grade], 0);
  const incrementTotal = increments ? GRADES.reduce((sum, grade) => sum + increments[grade], 0) : 0;
  return (
    <div className="space-y-2">
      {GRADES.map((grade) => (
        <MetricLine
          key={grade}
          label={increments ? `누적 ${grade}` : grade}
          value={`${counts[grade].toLocaleString()}명`}
          sub={increments ? `당월증분 ${increments[grade].toLocaleString()}명` : undefined}
          tone={grade === "마스터" ? "warning" : grade === "챌린저" ? "purple" : "cyan"}
        />
      ))}
      <MetricLine
        label="합계"
        value={`${total.toLocaleString()}명`}
        sub={increments ? `당월증분 ${incrementTotal.toLocaleString()}명` : undefined}
        tone="success"
      />
    </div>
  );
}

function MoneyRows({ title, lms, hogang }: { title: string; lms: number; hogang: number }) {
  return (
    <div className="rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
      <p className="mb-2 text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{title}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-3 text-[13px]"><span style={{ color: "var(--text-subtle)" }}>LMS</span><span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>{moneyFull(lms)}</span></div>
        <div className="flex justify-between gap-3 text-[13px]"><span style={{ color: "var(--text-subtle)" }}>호갱노노</span><span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>{moneyFull(hogang)}</span></div>
        <div className="mt-2 flex justify-between gap-3 border-t pt-2 text-[13px]" style={{ borderColor: "var(--border-subtle)" }}>
          <span style={{ color: "var(--text-muted)" }}>합계</span>
          <span className="font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{moneyFull(lms + hogang)}</span>
        </div>
      </div>
    </div>
  );
}

function ProgressLine({ label, value, total, tone = "info" }: { label: string; value: number; total: number; tone?: ToneName }) {
  const c = toneStyle(tone);
  const width = Math.min(100, total ? Math.round((value / total) * 100) : 0);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
        <span className="truncate font-medium" style={{ color: "var(--text-subtle)" }}>{label}</span>
        <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--text)" }}>{value.toLocaleString()}명</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: c.bar }} />
      </div>
    </div>
  );
}

function FlowGroupBox({ group }: { group: FlowGroup }) {
  return (
    <div className="rounded-[13px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{group.rank}</p>
        <Badge tone={group.rank === "본부장" ? "purple" : group.rank === "팀장" ? "info" : "cyan"}>전환율 {group.rate}%</Badge>
      </div>
      <div className="space-y-1.5">
        {group.rows.map((row) => (
          <div key={`${group.rank}-${row.grade}`} className="flex items-center justify-between gap-2 text-[12px]">
            <span style={{ color: "var(--text-subtle)" }}>{row.grade}</span>
            <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {row.total.toLocaleString()}건 <span style={{ color: "var(--text-faint)" }}>→</span> 계약전환 {row.converted.toLocaleString()}건
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-[12px]" style={{ borderColor: "var(--border-subtle)" }}>
        <span style={{ color: "var(--text-muted)" }}>합계</span>
        <span className="font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>
          {group.total.toLocaleString()}건 / 계약전환 {group.converted.toLocaleString()}건
        </span>
      </div>
    </div>
  );
}

function FlowRoutePanel({ item }: { item: FlowRoute }) {
  const routeTotal = item.groups.reduce((sum, group) => sum + group.total, 0);
  const routeConverted = item.groups.reduce((sum, group) => sum + group.converted, 0);
  return (
    <div className="rounded-[16px] border p-3" style={{ background: "var(--surface)", borderColor: "var(--border-2)" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
          <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{item.route}</p>
        </div>
        <Badge tone="success">합계 {routeTotal.toLocaleString()}건 · 전환 {routeConverted.toLocaleString()}건</Badge>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {item.groups.map((group) => <FlowGroupBox key={`${item.route}-${group.rank}`} group={group} />)}
      </div>
    </div>
  );
}

export default function ManagementDashboardPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const now = useMemo(() => new Date(), [lastLoadedAt]);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), [now]);
  const prevMonthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0), [now]);
  const prevMonthEnd = monthStart;
  const currentMonthLabel = monthLabel(now);
  const prevMonthLabel = monthLabel(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [contactsRes, salesRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id,name,title,intake_route,customer_grade,management_stage,meeting_result,contract_date,vip_transferred_at,created_at,updated_at,crm_db_source")
          .order("updated_at", { ascending: false })
          .limit(8000),
        supabase
          .from("ad_executions")
          .select("*")
          .order("payment_date", { ascending: false })
          .limit(8000),
      ]);

      if (contactsRes.error) throw contactsRes.error;
      if (salesRes.error) throw salesRes.error;

      setContacts((contactsRes.data || []) as ContactRow[]);
      setSales((salesRes.data || []) as SalesRow[]);
      setLastLoadedAt(new Date());
    } catch (error: any) {
      console.error("관리대시보드 조회 실패:", error);
      setContacts([]);
      setSales([]);
      setErrorMessage(error?.message || "관리대시보드 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = window.setInterval(fetchData, 60_000);
    return () => window.clearInterval(timer);
  }, [fetchData]);

  const dashboard = useMemo(() => {
    const retentionMembers = contacts.filter(isRetentionMember);
    const prevCumulative = retentionMembers.filter((contact) => isBefore(parseDate(contact.contract_date), monthStart));
    const currentIncrement = retentionMembers.filter((contact) => isBetween(parseDate(contact.contract_date), monthStart, now));
    const currentCumulative = retentionMembers.filter((contact) => isBetween(parseDate(contact.contract_date), new Date(2000, 0, 1), now));

    const prevCounts = countByGrade(prevCumulative);
    const incrementCounts = countByGrade(currentIncrement);
    const currentCounts = countByGrade(currentCumulative);

    const intakeCounts = LEFT_INTAKE_ROUTES.map((route) => ({
      route,
      count: currentIncrement.filter((contact) => routeMatches(contact, route)).length,
    }));

    const vipMonthly = contacts.filter((contact) => {
      const source = normalizeText(contact.crm_db_source);
      const movedAt = contactMonthDate(contact);
      return source === normalizeText(VIP_DB_SOURCE) && isBetween(movedAt, monthStart, now);
    });

    const flowRoutes: FlowRoute[] = INTAKE_ROUTES.map((route) => {
      const routeRows = vipMonthly.filter((contact) => routeMatches(contact, route));
      const groups = RANK_GROUPS.map((rank) => {
        const rankRows = routeRows.filter((contact) => rankOf(contact) === rank);
        const rows = FLOW_GRADE_MAP[rank].map((grade) => {
          const gradeRows = rankRows.filter((contact) => isGrade(contact, grade));
          return {
            grade,
            total: gradeRows.length,
            converted: gradeRows.filter(isContracted).length,
          };
        });
        const total = rows.reduce((sum, row) => sum + row.total, 0);
        const converted = rows.reduce((sum, row) => sum + row.converted, 0);
        return { rank, rows, total, converted, rate: percent(converted, total) };
      });
      return { route, groups };
    });

    const vipRouteGrades = INTAKE_ROUTES.map((route) => {
      const routeRows = vipMonthly.filter((contact) => routeMatches(contact, route));
      const counts = countByGrade(routeRows);
      return { route, counts, total: GRADES.reduce((sum, grade) => sum + counts[grade], 0) };
    });

    const prevSalesRows = sales.filter((row) => {
      const date = salesDate(row);
      return Boolean(date && date >= prevMonthStart && date < prevMonthEnd);
    });
    const currentSalesRows = sales.filter((row) => isBetween(salesDate(row), monthStart, now));

    const prevAdSales = {
      lms: sumSales(prevSalesRows, "lms"),
      hogang: sumSales(prevSalesRows, "hogang"),
    };

    const currentSales = {
      membership: sumSales(currentSalesRows, "membership"),
      lms: sumSales(currentSalesRows, "lms"),
      hogang: sumSales(currentSalesRows, "hogang"),
    };

    return {
      retentionMembers,
      prevCumulative,
      currentIncrement,
      currentCumulative,
      prevCounts,
      incrementCounts,
      currentCounts,
      intakeCounts,
      vipMonthly,
      vipRouteGrades,
      flowRoutes,
      prevAdSales,
      currentSales,
    };
  }, [contacts, monthStart, now, prevMonthStart, prevMonthEnd, sales]);

  const currentTotal = GRADES.reduce((sum, grade) => sum + dashboard.currentCounts[grade], 0);
  const prevTotal = GRADES.reduce((sum, grade) => sum + dashboard.prevCounts[grade], 0);
  const incrementTotal = GRADES.reduce((sum, grade) => sum + dashboard.incrementCounts[grade], 0);
  const vipMonthlyTotal = dashboard.vipMonthly.length;

  return (
    <main className="crm-modern-main min-h-screen premium-page px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-4">
        <section className="premium-hero overflow-hidden rounded-[22px] border px-5 py-4" style={{ background: "var(--surface)", borderColor: "var(--border-2)", boxShadow: "var(--shadow-md)" }}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="purple">관리대시보드</Badge>
                <Badge tone="info">전체 인원 공용</Badge>
                <Badge tone="success">{formatDateTime(now)} 기준</Badge>
              </div>
              <h1 className="crm-title">관리대시보드</h1>
              <p className="crm-subtitle mt-1">
                파이프라인 리텐션 회원, VIP DB 유입경로, 통합매출관리 매출을 한 화면에서 확인합니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] px-3 text-[13px] font-semibold transition-all disabled:opacity-60"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)", color: "var(--accent-text)" }}
              >
                {loading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                새로고침
              </button>
              {lastLoadedAt && <Badge tone="muted">최근 갱신 {formatDateTime(lastLoadedAt)}</Badge>}
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-[14px] border px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-text)" }}>
            {errorMessage}
          </div>
        )}

        {loading && contacts.length === 0 ? (
          <div className="flex min-h-[520px] items-center justify-center">
            <Loader2 className="animate-spin" size={34} style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          <div className="grid gap-4 2xl:grid-cols-[300px_minmax(560px,1fr)_440px]">
            <aside className="space-y-4">
              <Panel>
                <PanelTitle icon={Users} tone="purple" title="분양회 현황" desc="리텐션 고객 · 계약완료일 · 심사결과 기준" />
                <div className="space-y-4 p-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{prevMonthLabel} 이전 누적</p>
                      <Badge tone="muted">합계 {prevTotal.toLocaleString()}명</Badge>
                    </div>
                    <SummaryGradeRows counts={dashboard.prevCounts} />
                  </div>

                  <div className="crm-divider" />

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{currentMonthLabel} 현황</p>
                      <Badge tone="success">당월증분 {incrementTotal.toLocaleString()}명</Badge>
                    </div>
                    <SummaryGradeRows counts={dashboard.currentCounts} increments={dashboard.incrementCounts} />
                  </div>

                  <div className="crm-divider" />

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>당월 유입경로별 유치현황</p>
                      <Badge tone="info">계약완료일 기준</Badge>
                    </div>
                    <div className="space-y-2">
                      {dashboard.intakeCounts.map((row) => (
                        <MetricLine key={row.route} label={row.route} value={`${row.count.toLocaleString()}명`} tone="muted" />
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={WalletCards} tone="warning" title="광고특전 현황" desc="통합매출관리 · 집행금액 - 환불금액" />
                <div className="space-y-3 p-4">
                  <MoneyRows title={`${prevMonthLabel} 광고특전 매출기록`} lms={dashboard.prevAdSales.lms} hogang={dashboard.prevAdSales.hogang} />
                  <MoneyRows title={`${currentMonthLabel} 광고특전 매출누적`} lms={dashboard.currentSales.lms} hogang={dashboard.currentSales.hogang} />
                </div>
              </Panel>
            </aside>

            <section className="min-w-0">
              <Panel className="h-full">
                <PanelTitle
                  icon={LineChart}
                  tone="info"
                  title={`${currentMonthLabel} VIP DB 유입경로 흐름`}
                  desc="VIP활동DB 당월 이관 고객 · 직급/심사결과별 계약전환 현황"
                  right={<Badge tone="success">VIP DB 총 {vipMonthlyTotal.toLocaleString()}건</Badge>}
                />
                <div className="space-y-3 p-4">
                  {dashboard.flowRoutes.map((item) => <FlowRoutePanel key={item.route} item={item} />)}
                </div>
              </Panel>
            </section>

            <aside className="space-y-4">
              <Panel>
                <PanelTitle icon={BadgeCheck} tone="success" title="당월 실시간 KPI 진척율" desc="현재 월 기준 자동 집계" />
                <div className="space-y-4 p-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>분양회 현황</p>
                      <Badge tone="muted">{incrementTotal.toLocaleString()}명</Badge>
                    </div>
                    <div className="space-y-3">
                      <ProgressLine label="마스터" value={dashboard.incrementCounts.마스터} total={Math.max(incrementTotal, 1)} tone="warning" />
                      <ProgressLine label="챌린저" value={dashboard.incrementCounts.챌린저} total={Math.max(incrementTotal, 1)} tone="purple" />
                      <ProgressLine label="브론즈" value={dashboard.incrementCounts.브론즈} total={Math.max(incrementTotal, 1)} tone="cyan" />
                    </div>
                  </div>

                  <div className="crm-divider" />

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>당월 VIP DB 데이터</p>
                      <Badge tone="info">{vipMonthlyTotal.toLocaleString()}건</Badge>
                    </div>
                    <div className="space-y-3">
                      {dashboard.vipRouteGrades.map((row) => (
                        <div key={row.route} className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="truncate text-[12px] font-semibold" style={{ color: "var(--text-strong)" }}>{row.route}</p>
                            <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-faint)" }}>{row.total.toLocaleString()}건</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                            <div className="rounded-[8px] px-1.5 py-1.5" style={{ background: "var(--surface-3)", color: "var(--text-subtle)" }}>마스터<br /><b style={{ color: "var(--text)" }}>{row.counts.마스터}</b></div>
                            <div className="rounded-[8px] px-1.5 py-1.5" style={{ background: "var(--surface-3)", color: "var(--text-subtle)" }}>챌린저<br /><b style={{ color: "var(--text)" }}>{row.counts.챌린저}</b></div>
                            <div className="rounded-[8px] px-1.5 py-1.5" style={{ background: "var(--surface-3)", color: "var(--text-subtle)" }}>브론즈<br /><b style={{ color: "var(--text)" }}>{row.counts.브론즈}</b></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>VIP DB 총합계</p>
                    <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--accent-text)" }}>{vipMonthlyTotal.toLocaleString()}<span className="ml-1 text-[14px]" style={{ color: "var(--text-subtle)" }}>건</span></p>
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={BarChart3} tone="warning" title="매출현황" desc="환불 차감 기준" />
                <div className="space-y-2 p-4">
                  <MetricLine label="분양회 월회비" value={shortMoney(dashboard.currentSales.membership)} sub={moneyFull(dashboard.currentSales.membership)} tone="success" />
                  <MetricLine label="LMS" value={shortMoney(dashboard.currentSales.lms)} sub={moneyFull(dashboard.currentSales.lms)} tone="info" />
                  <MetricLine label="호갱노노" value={shortMoney(dashboard.currentSales.hogang)} sub={moneyFull(dashboard.currentSales.hogang)} tone="purple" />
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={Database} tone="cyan" title="집계 기준" desc="현재 반영된 기준" />
                <div className="space-y-2 p-4 text-[12px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>
                  <p>· 회원 현황: 파이프라인 리텐션 + 계약완료일 + 심사결과</p>
                  <p>· 당월증분: {dateKey(monthStart)} 00:00부터 현재까지 계약완료 고객</p>
                  <p>· VIP DB 흐름: 당월 VIP활동DB 이관일 기준</p>
                  <p>· 매출: 통합매출관리 집행금액에서 환불금액 차감</p>
                </div>
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
