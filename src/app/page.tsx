"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Database,
  FileText,
  Filter,
  LineChart,
  Loader2,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";

type CRMUserLite = {
  name?: string;
  title?: string;
  role?: string;
  id?: string;
};

type ContactRow = Record<string, any> & {
  id: number;
  name?: string | null;
  title?: string | null;
  phone?: string | null;
  intake_route?: string | null;
  activity_type?: string | null;
  has_tm?: boolean | null;
  tm_date?: string | null;
  meeting_result?: string | null;
  management_stage?: string | null;
  customer_grade?: string | null;
  crm_db_source?: string | null;
  vip_transferred_at?: string | null;
  assigned_to?: string | null;
  consultant?: string | null;
  contract_date?: string | null;
  reservation_date?: string | null;
  churn_date?: string | null;
  regular_payment_date?: string | null;
  payment_channel?: string | null;
  memo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type NoteRow = Record<string, any> & {
  id: number;
  contact_id: number;
  note_date?: string | null;
  content?: string | null;
  author?: string | null;
  created_at?: string | null;
};

type SalesRow = Record<string, any> & {
  id: number;
  member_name?: string | null;
  execution_amount?: number | null;
  vat_amount?: number | null;
  refund_amount?: number | null;
  channel?: string | null;
  contract_route?: string | null;
  payment_date?: string | null;
  team_member?: string | null;
  consultant?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type KpiRow = Record<string, any> & {
  year: number;
  month: number;
  week: number;
  scope: "team" | "execution" | "operation";
  target_name: string;
  recruit_count?: number | null;
  bunyanghoe_revenue?: number | null;
  linked_revenue?: number | null;
  special_revenue?: number | null;
  wanpan_truck_count?: number | null;
  ad_operation_revenue?: number | null;
};

type ActionItem = {
  key: string;
  type: string;
  tone: ToneName;
  title: string;
  desc: string;
  href: string;
  priority: number;
};

type ToneName = "info" | "success" | "warning" | "danger" | "purple" | "cyan" | "muted";

type FunnelRow = {
  label: string;
  value: number;
  sub: string;
  tone: ToneName;
};

const EXECUTION_PART_NAMES = ["조계현", "이세호", "기여운", "최연전"];
const ADMIN_NAMES = ["문시욱", "김정후", "김창완", "최웅"];
const PIPELINE_STAGES = ["리드", "프로스펙팅", "딜클로징", "리텐션", "이탈/탈퇴"];
const HIGH_VALUE_GRADES = ["마스터", "챌린저", "1%", "상위"];
const CORE_VIP_GRADES = ["마스터", "챌린저", "브론즈"];
const PAYMENT_CHANNEL_OPTIONS = ["자동이체 (효성CMS)", "카드 (사이다페이)", "기타 (별도입금)"];
const PAYMENT_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit" });
const TODAY = new Date();

function normalizePersonName(value?: string | null) {
  return String(value || "")
    .replace(/님|팀장|파트장|본부장|대표|메인|어쏘|CX|어시|관리자/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeText(value?: string | null) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function readUserFromStorage(): CRMUserLite | null {
  try {
    const current = getCurrentUser();
    if (current) return current;
    const raw = localStorage.getItem("crm_user");
    if (!raw) return null;
    return JSON.parse(raw) as CRMUserLite;
  } catch {
    return null;
  }
}

function isExecutionUser(user?: CRMUserLite | null) {
  const role = String(user?.role || "").toLowerCase();
  const name = normalizePersonName(user?.name);
  return role === "exec" || role.includes("실행") || EXECUTION_PART_NAMES.some((item) => normalizePersonName(item) === name);
}

function isAdminUser(user?: CRMUserLite | null) {
  const role = String(user?.role || "").toLowerCase();
  const name = normalizePersonName(user?.name);
  return role === "admin" || ADMIN_NAMES.some((item) => normalizePersonName(item) === name);
}

function contactOwner(row: Pick<ContactRow, "assigned_to" | "consultant">) {
  return row.assigned_to || row.consultant || "미지정";
}

function rowMatchesOwner(row: Pick<ContactRow, "assigned_to" | "consultant">, owner: string) {
  if (!owner || owner === "전체") return true;
  const target = normalizePersonName(owner);
  return normalizePersonName(row.assigned_to) === target || normalizePersonName(row.consultant) === target;
}

function salesMatchesOwner(row: SalesRow, owner: string) {
  if (!owner || owner === "전체") return true;
  const target = normalizePersonName(owner);
  return normalizePersonName(row.team_member) === target || normalizePersonName(row.consultant) === target;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = String(value).length === 10 ? `${value}T00:00:00` : String(value);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthWindow(key: string) {
  const [year, month] = key.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end, year, month };
}

function isInMonth(value: string | null | undefined, selectedMonth: string) {
  const date = parseDate(value);
  if (!date) return false;
  const { start, end } = getMonthWindow(selectedMonth);
  return date >= start && date < end;
}

function daysBetween(from?: string | null, to = new Date()) {
  const date = parseDate(from);
  if (!date) return null;
  return Math.floor((to.getTime() - date.getTime()) / 86_400_000);
}

function money(value?: number | null) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 1)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

function moneyFull(value?: number | null) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(date);
}

function formatDateTime(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function timeAgo(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "-";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 30) return `${day}일 전`;
  return formatDate(value);
}

function effectiveSales(row: SalesRow) {
  const execution = Number(row.execution_amount || 0);
  const vat = Number(row.vat_amount || 0);
  const refund = Number(row.refund_amount || 0);
  const base = vat && vat !== execution ? vat : execution;
  return Math.max(base - refund, 0);
}

function refundSales(row: SalesRow) {
  return Number(row.refund_amount || 0);
}

function salesCategory(row: SalesRow): "membership" | "lms" | "hogang" | "linked" | "other" {
  const channel = normalizeText(row.channel);
  const route = normalizeText(row.contract_route);
  const item = normalizeText(row.payment_item || row.payment_type || row.item_name || row.memo);

  if (route.includes("연계매출") || route.includes("하이타겟")) return "linked";
  if (channel.includes("LMS") || item.includes("LMS")) return "lms";
  if (channel.includes("호갱노노") || item.includes("호갱노노")) return "hogang";
  if (
    route.includes("분양회") ||
    channel.includes("효성CMS") ||
    channel.includes("사이다페이") ||
    item.includes("월회비") ||
    item.includes("회비")
  ) {
    return "membership";
  }
  return "other";
}

function isVipContact(contact: ContactRow) {
  const source = normalizeText(contact.crm_db_source);
  const stage = normalizeText(contact.management_stage);
  const grade = normalizeText(contact.customer_grade);
  return source === "vip_activity" || PIPELINE_STAGES.map(normalizeText).includes(stage) || Boolean(grade && grade !== normalizeText("심사미진행"));
}

function isHighValueContact(contact: ContactRow) {
  const grade = normalizeText(contact.customer_grade);
  return HIGH_VALUE_GRADES.some((token) => grade.includes(normalizeText(token)));
}

function isCoreVipGrade(contact: ContactRow) {
  const grade = normalizeText(contact.customer_grade);
  return CORE_VIP_GRADES.some((token) => grade.includes(normalizeText(token)));
}

function isGradeContact(contact: ContactRow, gradeName: string) {
  return normalizeText(contact.customer_grade).includes(normalizeText(gradeName));
}

function isContractedInMonth(contact: ContactRow, selectedMonth: string) {
  return isContracted(contact) && (isInMonth(contact.contract_date, selectedMonth) || isInMonth(contact.updated_at, selectedMonth) || isInMonth(contact.created_at, selectedMonth));
}

function touchedInMonth(contact: ContactRow, selectedMonth: string) {
  return isInMonth(contact.vip_transferred_at, selectedMonth) || isInMonth(contact.updated_at, selectedMonth) || isInMonth(contact.created_at, selectedMonth);
}

function isContracted(contact: ContactRow) {
  return normalizeText(contact.meeting_result) === normalizeText("계약완료") || normalizeText(contact.management_stage) === normalizeText("리텐션");
}

function isChurned(contact: ContactRow) {
  const stage = normalizeText(contact.management_stage);
  const result = normalizeText(contact.meeting_result);
  return stage.includes("이탈") || stage.includes("탈퇴") || result === normalizeText("계약거부") || result === normalizeText("미팅불발");
}

function latestActivityDate(contact: ContactRow, notesByContact: Map<string, NoteRow[]>) {
  const notes = notesByContact.get(String(contact.id)) || [];
  const latestNote = notes
    .map((note) => note.created_at || note.note_date)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0];
  return latestNote || contact.updated_at || contact.created_at || null;
}

function hasFirstTouch(contact: ContactRow, notesByContact: Map<string, NoteRow[]>, selectedMonth: string) {
  const activity = normalizeText(contact.activity_type);
  const notes = notesByContact.get(String(contact.id)) || [];
  const hasTypedNote = notes.some((note) => {
    const content = normalizeText(note.content);
    const inMonth = isInMonth(note.created_at || note.note_date, selectedMonth);
    return inMonth && (content.includes("TM") || content.includes("콜드톡") || content.includes("활동완료") || content.includes("녹취"));
  });
  return (
    activity.includes("TM") ||
    activity.includes("콜드톡") ||
    Boolean(contact.has_tm) ||
    isInMonth(contact.tm_date, selectedMonth) ||
    hasTypedNote
  );
}

function parsePaymentDay(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/\d+/);
  if (!match) return null;
  const day = Number(match[0]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return day;
}

function getNextPaymentInfo(day: number, now = TODAY) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  let due = new Date(year, month, Math.min(day, lastDayThisMonth), 0, 0, 0, 0);

  const todayOnly = new Date(year, month, now.getDate(), 0, 0, 0, 0);
  if (due < todayOnly) {
    const nextLast = new Date(year, month + 2, 0).getDate();
    due = new Date(year, month + 1, Math.min(day, nextLast), 0, 0, 0, 0);
  }

  const diff = Math.round((due.getTime() - todayOnly.getTime()) / 86_400_000);
  return { due, diff };
}

function ddayLabel(diff: number) {
  if (diff === 0) return "D-DAY";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function paymentLabel(contact: ContactRow) {
  const channel = contact.payment_channel || "결제채널 미입력";
  const day = parsePaymentDay(contact.regular_payment_date);
  return `${channel} · ${day ? `매월 ${day}일` : "결제일 미입력"}`;
}

function monthOptions() {
  const base = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - 4 + index, 1);
    return { key: monthKey(date), label: MONTH_LABEL_FORMAT.format(date) };
  }).reverse();
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

/* ─────────────────────────────────────────────────────────────
 * 통일 디자인 시스템 (전 카드 공통 규격)
 *  - 카드 헤더: px-4 py-3 / 타이틀 14px tracking-[-0.02em] / 설명 12px
 *  - 메인 숫자: 20~22px tracking-[-0.04em] / 라벨 11px · 서브 12px
 *  - 서브카드: rounded-[12px] p-3 surface-2 / 그리드 갭: 외부 gap-4 · 내부 gap-2.5
 * ───────────────────────────────────────────────────────────── */

type DashboardActionItem = ActionItem & { contactId: number };

function Badge({ children, tone = "muted", icon: Icon }: { children: ReactNode; tone?: ToneName; icon?: ElementType }) {
  const c = toneStyle(tone);
  return (
    <span
      className="inline-flex min-h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11px] font-semibold tracking-[-0.01em]"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {Icon ? <Icon size={11} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
      {children}
    </span>
  );
}

function IconBox({ icon: Icon, tone = "info", size = "md" }: { icon: ElementType; tone?: ToneName; size?: "sm" | "md" }) {
  const c = toneStyle(tone);
  const cls = size === "sm" ? "h-7 w-7 rounded-[9px]" : "h-9 w-9 rounded-[11px]";
  return (
    <div className={`inline-flex shrink-0 items-center justify-center ${cls}`} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <Icon size={size === "sm" ? 13 : 16} />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`premium-card overflow-hidden ${className}`}>{children}</section>;
}

function PanelTitle({ icon, tone, title, desc, right }: { icon: ElementType; tone: ToneName; title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <IconBox icon={icon} tone={tone} size="sm" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{title}</p>
          {desc && <p className="mt-0.5 truncate text-[12px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function StatBox({ label, value, sub, tone = "muted" }: { label: string; value: number | string; sub?: string; tone?: ToneName }) {
  const c = toneStyle(tone);
  return (
    <div className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
      <p className="truncate text-[11px] font-semibold tracking-[-0.01em]" style={{ color: c.text }}>{label}</p>
      <p className="mt-1.5 truncate text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-1 truncate text-[12px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, total, tone = "info" }: { value: number; total: number; tone?: ToneName }) {
  const c = toneStyle(tone);
  const width = Math.min(100, percent(value, total || value || 1));
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: c.bar }} />
    </div>
  );
}

function EmptyBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center p-5 text-center">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>
        <FileText size={15} />
      </div>
      <p className="text-[13px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{title}</p>
      <p className="mt-1 max-w-[280px] text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{desc}</p>
    </div>
  );
}

/** 영업 퍼널 단계 (압축형) + 가운데 정렬된 전환율 커넥터 */
function FunnelStage({ label, value, sub, tone, rate, isLast }: { label: string; value: number; sub: string; tone: ToneName; rate?: number | null; isLast?: boolean }) {
  const c = toneStyle(tone);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-stretch gap-1 lg:flex-row lg:gap-0">
      <div className="min-w-0 flex-1 rounded-[10px] border px-2.5 py-2" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.dot }} />
          <p className="truncate text-[11px] font-semibold tracking-[-0.01em]" style={{ color: c.text }}>{label}</p>
        </div>
        <p className="mt-1 text-[18px] font-semibold leading-none tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>
          {value.toLocaleString()}<span className="ml-0.5 text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>건</span>
        </p>
        <p className="mt-1 truncate text-[10px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
      {!isLast && (
        <div className="flex shrink-0 items-center justify-center py-0.5 lg:w-[68px] lg:py-0">
          {rate !== null && rate !== undefined ? (
            <span
              className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums tracking-[-0.02em]"
              style={{ background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}
            >
              {rate}% <ArrowRight size={11} className="rotate-90 lg:rotate-0" />
            </span>
          ) : (
            <ArrowRight size={13} className="rotate-90 lg:rotate-0" style={{ color: "var(--text-faint)" }} />
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [me, setMe] = useState<CRMUserLite | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [ownerFilter, setOwnerFilter] = useState("전체");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /* 고객 즉시수정 팝업 상태 (파이프라인3 contacts 테이블과 동일 소스 → 자동 연동) */
  const [editTarget, setEditTarget] = useState<ContactRow | null>(null);
  const [editIssue, setEditIssue] = useState("");
  const [editForm, setEditForm] = useState({ name: "", title: "", phone: "", management_stage: "", payment_channel: "", regular_payment_date: "", memo: "" });
  const [quickNote, setQuickNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const currentUser = readUserFromStorage();
    setMe(currentUser);

    if (isExecutionUser(currentUser)) {
      setOwnerFilter(currentUser?.name || "전체");
    }

    const { year, month } = getMonthWindow(selectedMonth);

    try {
      const [contactRes, noteRes, salesRes, kpiRes] = await Promise.all([
        supabase.from("contacts").select("*").order("created_at", { ascending: false }).limit(3000),
        supabase.from("contact_notes").select("*").order("created_at", { ascending: false }).limit(3000),
        supabase.from("ad_executions").select("*").order("created_at", { ascending: false }).limit(3000),
        supabase.from("kpi_settings").select("*").eq("year", year).eq("month", month).eq("week", 0),
      ]);

      if (contactRes.error) throw contactRes.error;
      if (noteRes.error) console.warn("contact_notes:", noteRes.error.message);
      if (salesRes.error) console.warn("ad_executions:", salesRes.error.message);
      if (kpiRes.error) console.warn("kpi_settings:", kpiRes.error.message);

      setContacts(((contactRes.data || []) as unknown) as ContactRow[]);
      setNotes(((noteRes.data || []) as unknown) as NoteRow[]);
      setSales(((salesRes.data || []) as unknown) as SalesRow[]);
      setKpis(((kpiRes.data || []) as unknown) as KpiRow[]);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "대시보드 데이터를 불러오지 못했습니다.");
      setContacts([]);
      setNotes([]);
      setSales([]);
      setKpis([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const openCustomerEdit = useCallback((contactId: number, issue: string) => {
    const target = contacts.find((row) => Number(row.id) === Number(contactId));
    if (!target) return;
    setEditTarget(target);
    setEditIssue(issue);
    setQuickNote("");
    setEditForm({
      name: target.name || "",
      title: target.title || "",
      phone: target.phone || "",
      management_stage: target.management_stage || "",
      payment_channel: target.payment_channel || "",
      regular_payment_date: target.regular_payment_date || "",
      memo: target.memo || "",
    });
  }, [contacts]);

  const saveCustomerEdit = useCallback(async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, any> = {
        name: editForm.name.trim() || null,
        title: editForm.title.trim() || null,
        phone: editForm.phone.trim() || null,
        management_stage: editForm.management_stage || null,
        payment_channel: editForm.payment_channel.trim() || null,
        regular_payment_date: editForm.regular_payment_date.trim() || null,
        memo: editForm.memo.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("contacts").update(payload).eq("id", editTarget.id);
      if (error) throw error;

      if (quickNote.trim()) {
        const { error: noteError } = await supabase.from("contact_notes").insert({
          contact_id: editTarget.id,
          content: quickNote.trim(),
          note_date: toDateKey(new Date()),
          author: me?.name || null,
        });
        if (noteError) console.warn("contact_notes insert:", noteError.message);
      }

      setEditTarget(null);
      setQuickNote("");
      await fetchDashboard();
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "고객 정보를 저장하지 못했습니다.");
    } finally {
      setSavingEdit(false);
    }
  }, [editForm, editTarget, fetchDashboard, me?.name, quickNote]);

  const fixedOwner = isExecutionUser(me);
  const activeOwner = fixedOwner ? me?.name || "전체" : ownerFilter;

  const notesByContact = useMemo(() => {
    const map = new Map<string, NoteRow[]>();
    notes.forEach((note) => {
      const key = String(note.contact_id);
      const list = map.get(key) || [];
      list.push(note);
      map.set(key, list);
    });
    map.forEach((list) => {
      list.sort((a, b) => new Date(String(b.created_at || b.note_date || 0)).getTime() - new Date(String(a.created_at || a.note_date || 0)).getTime());
    });
    return map;
  }, [notes]);

  const visibleContacts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return contacts.filter((contact) => {
      const ownerMatch = rowMatchesOwner(contact, activeOwner);
      if (!ownerMatch) return false;
      if (!q) return true;
      return [contact.name, contact.phone, contact.title, contact.intake_route, contact.assigned_to, contact.consultant, contact.memo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [contacts, activeOwner, keyword]);

  const visibleSales = useMemo(() => {
    return sales.filter((row) => salesMatchesOwner(row, activeOwner));
  }, [sales, activeOwner]);

  const monthContacts = useMemo(() => {
    return visibleContacts.filter((contact) => isInMonth(contact.created_at, selectedMonth));
  }, [visibleContacts, selectedMonth]);

  const monthSales = useMemo(() => {
    return visibleSales.filter((row) => isInMonth(row.payment_date || row.created_at, selectedMonth));
  }, [visibleSales, selectedMonth]);

  const monthNotes = useMemo(() => {
    const visibleIds = new Set(visibleContacts.map((contact) => String(contact.id)));
    return notes.filter((note) => visibleIds.has(String(note.contact_id)) && isInMonth(note.created_at || note.note_date, selectedMonth));
  }, [notes, visibleContacts, selectedMonth]);

  const vipContacts = useMemo(() => visibleContacts.filter(isVipContact), [visibleContacts]);

  const stats = useMemo(() => {
    const firstTouch = monthContacts.filter((contact) => hasFirstTouch(contact, notesByContact, selectedMonth)).length;
    const tmCount = monthContacts.filter((contact) => {
      const activity = normalizeText(contact.activity_type);
      return activity.includes("TM") || Boolean(contact.has_tm) || isInMonth(contact.tm_date, selectedMonth);
    }).length;
    const coldTalkCount = monthContacts.filter((contact) => normalizeText(contact.activity_type).includes("콜드톡")).length;
    const vipThisMonth = visibleContacts.filter((contact) => isVipContact(contact) && touchedInMonth(contact, selectedMonth)).length;
    const master = visibleContacts.filter((contact) => isGradeContact(contact, "마스터")).length;
    const challenger = visibleContacts.filter((contact) => isGradeContact(contact, "챌린저")).length;
    const bronze = visibleContacts.filter((contact) => isGradeContact(contact, "브론즈")).length;
    const masterThisMonth = visibleContacts.filter((contact) => isGradeContact(contact, "마스터") && touchedInMonth(contact, selectedMonth)).length;
    const challengerThisMonth = visibleContacts.filter((contact) => isGradeContact(contact, "챌린저") && touchedInMonth(contact, selectedMonth)).length;
    const bronzeThisMonth = visibleContacts.filter((contact) => isGradeContact(contact, "브론즈") && touchedInMonth(contact, selectedMonth)).length;
    const contracts = visibleContacts.filter((contact) => isContractedInMonth(contact, selectedMonth)).length;

    const membershipSales = monthSales.filter((row) => salesCategory(row) === "membership").reduce((sum, row) => sum + effectiveSales(row), 0);
    const lmsSales = monthSales.filter((row) => salesCategory(row) === "lms").reduce((sum, row) => sum + effectiveSales(row), 0);
    const hogangSales = monthSales.filter((row) => salesCategory(row) === "hogang").reduce((sum, row) => sum + effectiveSales(row), 0);
    const refund = monthSales.reduce((sum, row) => sum + refundSales(row), 0);
    const totalSales = monthSales.reduce((sum, row) => sum + effectiveSales(row), 0);

    const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = vipContacts.filter((contact) => normalizeText(contact.management_stage) === normalizeText(stage)).length;
      return acc;
    }, {} as Record<string, number>);

    const retention = stageCounts["리텐션"] || visibleContacts.filter(isContracted).length;
    const churnCount = stageCounts["이탈/탈퇴"] || 0;
    const churnRate = percent(churnCount, Math.max(vipContacts.length, 1));
    const activePipeline = (stageCounts["리드"] || 0) + (stageCounts["프로스펙팅"] || 0) + (stageCounts["딜클로징"] || 0);
    const contractRate = percent(retention, Math.max(vipContacts.length, 1));

    return {
      firstTouch, tmCount, coldTalkCount, vipThisMonth,
      master, challenger, bronze,
      masterThisMonth, challengerThisMonth, bronzeThisMonth,
      contracts, churnCount, churnRate,
      membershipSales, lmsSales, hogangSales, refund, totalSales,
      stageCounts, retention, activePipeline, contractRate,
      currentPipelineTotal: vipContacts.length,
    };
  }, [monthContacts, monthSales, notesByContact, selectedMonth, vipContacts, visibleContacts]);

  /* 당월 영업 퍼널: 4단계 */
  const funnelStages = useMemo(() => {
    return [
      { label: "고객DB 신규", value: monthContacts.length, sub: "당월 업로드 DB", tone: "info" as ToneName, rate: percent(stats.firstTouch, monthContacts.length) },
      { label: "첫접촉 완료", value: stats.firstTouch, sub: `TM ${stats.tmCount} · 콜드톡 ${stats.coldTalkCount}`, tone: "cyan" as ToneName, rate: percent(stats.vipThisMonth, Math.max(stats.firstTouch, 1)) },
      { label: "VIP 이관·등급심사", value: stats.vipThisMonth, sub: `현재 VIP ${stats.currentPipelineTotal}명`, tone: "purple" as ToneName, rate: percent(stats.retention, Math.max(stats.vipThisMonth, 1)) },
      { label: "계약 · 리텐션", value: stats.retention, sub: `당월 계약 ${stats.contracts}건`, tone: "success" as ToneName, rate: null, isLast: true },
    ];
  }, [monthContacts.length, stats]);

  /* 오늘 챙겨야 할 고객 (크리티컬 통합 리스트) */
  const { actionItems, criticalCounts } = useMemo(() => {
    const items: DashboardActionItem[] = [];
    const counts = { payment: 0, missing: 0, inactive: 0, closing: 0 };

    visibleContacts.forEach((contact) => {
      const contactId = Number(contact.id);
      const day = parsePaymentDay(contact.regular_payment_date);
      if (isContracted(contact) && day) {
        const { diff } = getNextPaymentInfo(day);
        if (diff >= 0 && diff <= 4) {
          counts.payment += 1;
          items.push({
            key: `pay-${contact.id}`,
            type: `결제 ${ddayLabel(diff)}`,
            tone: diff === 0 ? "danger" : "warning",
            title: contact.name || "고객명 없음",
            desc: paymentLabel(contact),
            href: "/pipeline3",
            priority: diff,
            contactId,
          });
        }
      }

      if (isContracted(contact) && (!contact.payment_channel || !parsePaymentDay(contact.regular_payment_date))) {
        counts.missing += 1;
        items.push({
          key: `missing-payment-${contact.id}`,
          type: "결제정보 누락",
          tone: "danger",
          title: contact.name || "고객명 없음",
          desc: "결제채널 또는 결제일이 비어 있습니다. 클릭해 바로 입력하세요.",
          href: "/pipeline3",
          priority: 1,
          contactId,
        });
      }

      const stage = normalizeText(contact.management_stage);
      const latest = latestActivityDate(contact, notesByContact);
      const inactiveDays = daysBetween(latest);
      if (["리드", "프로스펙팅", "딜클로징"].some((item) => stage === normalizeText(item)) && inactiveDays !== null && inactiveDays >= 7) {
        counts.inactive += 1;
        items.push({
          key: `inactive-${contact.id}`,
          type: "장기 미활동",
          tone: "warning",
          title: contact.name || "고객명 없음",
          desc: `${contact.management_stage || "관리구간"} · 최근 활동 ${inactiveDays}일 전`,
          href: "/pipeline3",
          priority: 4 + inactiveDays,
          contactId,
        });
      }

      const closingDays = daysBetween(contact.updated_at || contact.vip_transferred_at || contact.created_at);
      if (stage === normalizeText("딜클로징") && closingDays !== null && closingDays >= 5) {
        counts.closing += 1;
        items.push({
          key: `closing-${contact.id}`,
          type: "클로징 지연",
          tone: "danger",
          title: contact.name || "고객명 없음",
          desc: `딜클로징 ${closingDays}일째 체류 중입니다.`,
          href: "/pipeline3",
          priority: 2 + closingDays,
          contactId,
        });
      }
    });

    const unique = new Map<string, DashboardActionItem>();
    items
      .sort((a, b) => a.priority - b.priority)
      .forEach((item) => {
        if (!unique.has(item.key)) unique.set(item.key, item);
      });
    return { actionItems: Array.from(unique.values()).slice(0, 14), criticalCounts: counts };
  }, [notesByContact, visibleContacts]);

  const paymentDdays = useMemo(() => {
    return visibleContacts
      .filter((contact) => isContracted(contact) && parsePaymentDay(contact.regular_payment_date))
      .map((contact) => {
        const day = parsePaymentDay(contact.regular_payment_date) || 1;
        const info = getNextPaymentInfo(day);
        return { contact, day, ...info };
      })
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 12);
  }, [visibleContacts]);

  const paymentDueSoonCount = useMemo(() => paymentDdays.filter((row) => row.diff >= 0 && row.diff <= 4).length, [paymentDdays]);

  const teamRows = useMemo(() => {
    return EXECUTION_PART_NAMES.map((owner) => {
      const ownerContacts = contacts.filter((contact) => rowMatchesOwner(contact, owner));
      const ownerVisible = ownerContacts.filter((contact) => {
        if (!keyword.trim()) return true;
        return [contact.name, contact.phone, contact.memo].filter(Boolean).join(" ").toLowerCase().includes(keyword.toLowerCase());
      });
      const ownerMonthContacts = ownerVisible.filter((contact) => isInMonth(contact.created_at, selectedMonth));
      const ownerVip = ownerVisible.filter(isVipContact);
      const ownerSales = sales.filter((row) => salesMatchesOwner(row, owner) && isInMonth(row.payment_date || row.created_at, selectedMonth));
      const ownerStage = (stage: string) => ownerVip.filter((contact) => normalizeText(contact.management_stage) === normalizeText(stage)).length;
      const masterChallenger = ownerVisible.filter((contact) => isGradeContact(contact, "마스터") || isGradeContact(contact, "챌린저")).length;
      const bronze = ownerVisible.filter((contact) => isGradeContact(contact, "브론즈")).length;
      return {
        owner,
        db: ownerMonthContacts.length,
        masterChallenger,
        bronze,
        lead: ownerStage("리드"),
        prospect: ownerStage("프로스펙팅"),
        closing: ownerStage("딜클로징"),
        contracts: ownerVisible.filter((contact) => isContracted(contact) && (isInMonth(contact.contract_date, selectedMonth) || isInMonth(contact.updated_at, selectedMonth))).length,
        churn: ownerStage("이탈/탈퇴"),
        sales: ownerSales.reduce((sum, row) => sum + effectiveSales(row), 0),
      };
    });
  }, [contacts, keyword, sales, selectedMonth]);

  /* 유입경로별 성과: DB → 접촉 → VIP 확보 흐름이 핵심 */
  const intakeRows = useMemo(() => {
    const groups = new Map<string, ContactRow[]>();
    visibleContacts.forEach((contact) => {
      const key = contact.intake_route || "유입경로 미지정";
      const list = groups.get(key) || [];
      list.push(contact);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .map(([route, rows]) => {
        const contract = rows.filter(isContracted).length;
        const vip = rows.filter(isVipContact).length;
        const firstTouch = rows.filter((row) => hasFirstTouch(row, notesByContact, selectedMonth)).length;
        return {
          route,
          total: rows.length,
          firstTouch,
          vip,
          contract,
          touchRate: percent(firstTouch, rows.length),
          vipRate: percent(vip, rows.length),
        };
      })
      .sort((a, b) => b.vip - a.vip || b.vipRate - a.vipRate || b.total - a.total)
      .slice(0, 7);
  }, [notesByContact, selectedMonth, visibleContacts]);

  /* 등급별 계약전환율: 마스터·챌린저·브론즈 계약건수 + 계약 유입경로 */
  const gradeContractRows = useMemo(() => {
    return CORE_VIP_GRADES.map((grade) => {
      const rows = vipContacts.filter((contact) => isGradeContact(contact, grade));
      const contracted = rows.filter(isContracted);
      const routeCounts = new Map<string, number>();
      contracted.forEach((contact) => {
        const key = contact.intake_route || "경로 미지정";
        routeCounts.set(key, (routeCounts.get(key) || 0) + 1);
      });
      const routes = Array.from(routeCounts.entries()).sort((a, b) => b[1] - a[1]);
      return {
        grade,
        count: rows.length,
        contracts: contracted.length,
        rate: percent(contracted.length, rows.length),
        routes,
        tone: (grade === "마스터" ? "warning" : grade === "챌린저" ? "purple" : "success") as ToneName,
      };
    });
  }, [vipContacts]);

  const kpiTarget = useMemo(() => {
    const userName = activeOwner === "전체" ? "team" : activeOwner;
    const target = activeOwner === "전체"
      ? kpis.find((row) => row.scope === "team" && row.target_name === "team")
      : kpis.find((row) => row.scope === "execution" && normalizePersonName(row.target_name) === normalizePersonName(userName));
    return target || null;
  }, [activeOwner, kpis]);

  /* KPI: 분양회 모집 · 분양회 회비 2종만 */
  const kpiRows = useMemo(() => {
    return [
      { label: "분양회 모집", value: stats.contracts, goal: Number(kpiTarget?.recruit_count || 0), unit: "명", tone: "success" as ToneName, money: false },
      { label: "분양회 회비", value: stats.membershipSales, goal: Number(kpiTarget?.bunyanghoe_revenue || 0), unit: "원", tone: "warning" as ToneName, money: true },
    ];
  }, [kpiTarget, stats.contracts, stats.membershipSales]);

  /* 매출 구성: 분양회 월회비 · LMS · 호갱노노 3종만 */
  const salesBreakdown = useMemo(() => ([
    { label: "분양회 월회비", value: stats.membershipSales, tone: "warning" as ToneName },
    { label: "LMS", value: stats.lmsSales, tone: "info" as ToneName },
    { label: "호갱노노", value: stats.hogangSales, tone: "purple" as ToneName },
  ]), [stats.hogangSales, stats.lmsSales, stats.membershipSales]);

  const coreSalesTotal = stats.membershipSales + stats.lmsSales + stats.hogangSales;

  const selectedMonthLabel = MONTH_LABEL_FORMAT.format(getMonthWindow(selectedMonth).start);
  const dashboardScopeLabel = activeOwner === "전체" ? "팀 전체" : `${activeOwner} 담당자`;
  const totalCritical = criticalCounts.payment + criticalCounts.missing + criticalCounts.inactive + criticalCounts.closing;

  const gradeJoinRows = [
    { label: "마스터", value: stats.masterThisMonth, total: stats.master, tone: "warning" as ToneName },
    { label: "챌린저", value: stats.challengerThisMonth, total: stats.challenger, tone: "purple" as ToneName },
    { label: "브론즈", value: stats.bronzeThisMonth, total: stats.bronze, tone: "success" as ToneName },
  ];

  return (
    <div className="premium-page h-full overflow-y-auto">
      <div className="premium-shell px-5 py-5 md:px-7 md:py-6">

        {/* ── 헤더 ── */}
        <header className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="crm-title">대시보드</h1>
              <Badge tone={fixedOwner ? "success" : "info"} icon={UserCheck}>{dashboardScopeLabel}</Badge>
              <Badge tone="muted" icon={CalendarDays}>{selectedMonthLabel}</Badge>
            </div>
            <p className="crm-subtitle mt-1">고객DB → 첫접촉 → VIP 이관·등급심사 → 파이프라인 → 계약·리텐션 → 매출까지 당월 영업 흐름을 한 화면에서 봅니다.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="고객명, 연락처, 메모 검색"
                className="crm-search w-full pl-9 pr-3"
              />
            </div>

            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="crm-search w-[130px] px-3">
              {monthOptions().map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>

            <select
              value={activeOwner}
              disabled={fixedOwner}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="crm-search w-[130px] px-3 disabled:opacity-70"
            >
              <option value="전체">전체 담당자</option>
              {EXECUTION_PART_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>

            <button type="button" onClick={fetchDashboard} className="btn-premium btn-secondary">
              <RefreshCw size={14} /> 새로고침
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="mb-4 rounded-[12px] border px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-text)" }}>
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center">
            <Loader2 className="animate-spin" size={32} style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── ① 최상단: 당월 영업 퍼널(좌) + 당월 등급 가입 현황(우) ── */}
            <div className="grid items-stretch gap-4 2xl:grid-cols-[1fr_300px]">
              <Panel className="h-full">
                <PanelTitle
                  icon={LineChart}
                  tone="info"
                  title="당월 영업 퍼널"
                  desc="고객DB → 첫접촉 → VIP 이관·등급심사 → 파이프라인 → 계약·리텐션"
                  right={<Badge tone="danger" icon={TrendingDown}>이탈 {stats.churnCount}건 · {stats.churnRate}%</Badge>}
                />
                <div className="p-4">
                  <div className="flex flex-col gap-1 lg:flex-row lg:items-stretch lg:gap-0">
                    {funnelStages.map((stage) => (
                      <FunnelStage key={stage.label} {...stage} />
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel className="flex h-full flex-col">
                <PanelTitle icon={BadgeCheck} tone="warning" title="당월 등급별 가입현황" desc="등급별 가입현황 실시간 집계" right={<Badge tone="muted">{selectedMonthLabel}</Badge>} />
                <div className="flex flex-1 flex-col justify-center gap-2 p-4">
                  {gradeJoinRows.map((row) => {
                    const c = toneStyle(row.tone);
                    return (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                        <Badge tone={row.tone}>{row.label}</Badge>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-[20px] font-semibold leading-none tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>{row.value.toLocaleString()}<span className="ml-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>건</span></p>
                          <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-faint)" }}>/ 누적 {row.total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            {/* ── ② 본문 그리드 ── */}
            <div className="grid gap-4 2xl:grid-cols-[1.25fr_.75fr]">
              {/* 좌측 */}
              <div className="space-y-4">

                {/* 담당자별 파이프라인 현황 */}
                <Panel>
                  <PanelTitle icon={Users} tone="purple" title="담당자별 파이프라인 현황" desc="DB입력 · 등급DB → 파이프라인 → 계약 · 이탈 · 매출" right={<Badge tone="info" icon={Filter}>관리자 뷰</Badge>} />
                  <div className="overflow-x-auto p-2">
                    <table className="w-full border-separate" style={{ borderSpacing: "0 4px" }}>
                      <thead>
                        <tr>
                          <th className="w-[72px] px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>담당자</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>DB입력</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>마스터·챌린저DB</th>
                          <th className="border-r px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)", borderColor: "var(--border)" }}>브론즈DB</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>리드</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>프로스펙팅</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>클로징</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--success-text)" }}>계약</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--danger-text)" }}>이탈</th>
                          <th className="px-1.5 pb-1 text-center text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cyan-text)" }}>매출</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamRows.map((row) => {
                          const isMine = normalizePersonName(row.owner) === normalizePersonName(activeOwner);
                          const cellCls = "px-1.5 py-2.5 text-center text-[13px] font-semibold tabular-nums tracking-[-0.02em]";
                          return (
                            <tr key={row.owner} style={{ background: isMine ? "var(--surface-selected)" : "var(--surface-2)" }}>
                              <td className="rounded-l-[10px] px-1.5 py-2.5 text-center text-[12px] font-semibold tracking-[-0.01em]" style={{ color: isMine ? "var(--accent-text)" : "var(--text-strong)" }}>{row.owner}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.db}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.masterChallenger}</td>
                              <td className={`${cellCls} border-r`} style={{ color: "var(--text)", borderColor: "var(--border)" }}>{row.bronze}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.lead}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.prospect}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.closing}</td>
                              <td className={cellCls} style={{ color: "var(--success-text)" }}>{row.contracts}</td>
                              <td className={cellCls} style={{ color: row.churn > 0 ? "var(--danger-text)" : "var(--text-faint)" }}>{row.churn}</td>
                              <td className={`${cellCls} rounded-r-[10px]`} style={{ color: "var(--cyan-text)" }}>{money(row.sales)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                {/* KPI 2종 + 매출 구성 3종 (높이 통일) */}
                <div className="grid items-stretch gap-4 xl:grid-cols-2">
                  <Panel className="flex h-full flex-col">
                    <PanelTitle icon={Target} tone="warning" title="KPI 목표 대비 달성률" desc="분양회 모집 · 분양회 회비" right={<a href="/kpi-settings" className="btn-premium btn-secondary">KPI 설정</a>} />
                    <div className="flex flex-1 flex-col justify-center gap-2.5 p-4">
                      {kpiRows.map((row) => {
                        const hasGoal = row.goal > 0;
                        return (
                          <div key={row.label} className="rounded-[12px] border p-3.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{row.label}</p>
                              <Badge tone={row.tone}>{hasGoal ? `달성 ${percent(row.value, row.goal)}%` : "목표 미설정"}</Badge>
                            </div>
                            <div className="mt-2 flex items-baseline justify-between gap-3">
                              <p className="truncate text-[22px] font-semibold leading-none tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>{row.money ? moneyFull(row.value) : `${row.value.toLocaleString()}${row.unit}`}</p>
                              <p className="shrink-0 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>목표 {hasGoal ? (row.money ? moneyFull(row.goal) : `${row.goal.toLocaleString()}${row.unit}`) : "—"}</p>
                            </div>
                            <div className="mt-3"><ProgressBar value={row.value} total={hasGoal ? row.goal : Math.max(row.value, 1)} tone={row.tone} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>

                  <Panel className="flex h-full flex-col">
                    <PanelTitle icon={BarChart3} tone="cyan" title="매출 구성" desc={`분양회 월회비 · LMS · 호갱노노 합계 ${money(coreSalesTotal)}`} right={<a href="/sales" className="btn-premium btn-secondary">매출관리</a>} />
                    <div className="flex flex-1 flex-col justify-center gap-3 p-4">
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                        {salesBreakdown.filter((item) => item.value > 0).map((item) => (
                          <div key={item.label} style={{ width: `${percent(item.value, Math.max(coreSalesTotal, 1))}%`, background: toneStyle(item.tone).bar }} />
                        ))}
                      </div>
                      {salesBreakdown.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toneStyle(item.tone).dot }} />
                            <span className="truncate text-[12px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text)" }}>{item.label}</span>
                          </div>
                          <div className="flex shrink-0 items-baseline gap-2.5">
                            <span className="text-[14px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{moneyFull(item.value)}</span>
                            <span className="w-9 text-right text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-subtle)" }}>{percent(item.value, Math.max(coreSalesTotal, 1))}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                {/* 유입경로별 성과 + 등급별 계약전환율 */}
                <div className="grid items-stretch gap-4 xl:grid-cols-2">
                  <Panel className="h-full">
                    <PanelTitle icon={TrendingUp} tone="success" title="유입경로별 성과" desc="보유 DB로 몇 건을 접촉해 몇 건의 VIP DB를 확보했는가" />
                    <div className="p-4">
                      {intakeRows.length === 0 ? <EmptyBlock title="유입경로 데이터가 없습니다" desc="고객DB에 유입경로가 입력되면 자동 집계됩니다." /> : (
                        <div className="space-y-2.5">
                          {intakeRows.map((row) => (
                            <div key={row.route} className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{row.route}</p>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums"
                                  style={{
                                    background: row.vipRate >= 60 ? "var(--success-bg)" : row.vipRate >= 30 ? "var(--warning-bg)" : "var(--surface-3)",
                                    color: row.vipRate >= 60 ? "var(--success-text)" : row.vipRate >= 30 ? "var(--warning-text)" : "var(--text-subtle)",
                                    border: `1px solid ${row.vipRate >= 60 ? "var(--success-border)" : row.vipRate >= 30 ? "var(--warning-border)" : "var(--border)"}`,
                                  }}
                                >
                                  VIP 확보 {row.vipRate}%
                                </span>
                              </div>
                              {/* DB → 접촉 → VIP 누적 레이어 바 */}
                              <div className="relative mt-2.5 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, row.touchRate)}%`, background: "var(--cyan-border)" }} />
                                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, row.vipRate)}%`, background: toneStyle("purple").bar }} />
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className="text-[12px] font-semibold tabular-nums tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>
                                  DB <strong style={{ color: "var(--text-strong)" }}>{row.total}건</strong>
                                  <span className="mx-1" style={{ color: "var(--text-faint)" }}>→</span>
                                  접촉 <strong style={{ color: "var(--cyan-text)" }}>{row.firstTouch}건</strong>
                                  <span className="mx-1" style={{ color: "var(--text-faint)" }}>→</span>
                                  VIP <strong style={{ color: "var(--purple-text)" }}>{row.vip}건</strong>
                                </p>
                                <p className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: "var(--success-text)" }}>계약 {row.contract}건</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Panel>

                  <Panel className="h-full">
                    <PanelTitle icon={Activity} tone="purple" title="등급별 계약전환율" desc="마스터 · 챌린저 · 브론즈 계약건수와 계약 유입경로" />
                    <div className="space-y-2.5 p-4">
                      {gradeContractRows.map((row) => (
                        <div key={row.grade} className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Badge tone={row.tone}>{row.grade}</Badge>
                              <p className="text-[13px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                                계약 {row.contracts}건 <span className="text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>/ 보유 {row.count}건</span>
                              </p>
                            </div>
                            <p className="shrink-0 text-[18px] font-semibold leading-none tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>{row.rate}<span className="text-[12px]">%</span></p>
                          </div>
                          <div className="mt-2.5"><ProgressBar value={row.contracts} total={Math.max(row.count, 1)} tone={row.tone} /></div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold" style={{ color: "var(--text-faint)" }}>계약 유입경로</span>
                            {row.routes.length === 0 ? (
                              <span className="text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>아직 계약이 없습니다</span>
                            ) : row.routes.map(([route, count]) => (
                              <span key={route} className="rounded-[7px] px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--surface-1)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>
                                {route} {count}건
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>

              {/* 우측 */}
              <div className="space-y-4">

                {/* 오늘 챙겨야 할 고객: 크리티컬 4종 통합 + 클릭 시 즉시수정 팝업 */}
                <Panel>
                  <PanelTitle icon={AlertTriangle} tone="danger" title="오늘 챙겨야 할 고객" desc="클릭하면 팝업에서 바로 수정 · 파이프라인3 자동 연동" right={<Badge tone={totalCritical > 0 ? "danger" : "muted"}>{totalCritical}건</Badge>} />
                  <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                    <Badge tone={criticalCounts.payment > 0 ? "warning" : "muted"}>결제임박 {criticalCounts.payment}</Badge>
                    <Badge tone={criticalCounts.missing > 0 ? "danger" : "muted"}>결제누락 {criticalCounts.missing}</Badge>
                    <Badge tone={criticalCounts.inactive > 0 ? "warning" : "muted"}>장기미활동 {criticalCounts.inactive}</Badge>
                    <Badge tone={criticalCounts.closing > 0 ? "danger" : "muted"}>클로징지연 {criticalCounts.closing}</Badge>
                  </div>
                  <div className="max-h-[440px] overflow-y-auto p-2">
                    {actionItems.length === 0 ? <EmptyBlock title="오늘 긴급 관리 고객이 없습니다" desc="결제 D-DAY 또는 장기미활동 고객이 생기면 이곳에 표시됩니다." /> : actionItems.map((item) => {
                      const target = contacts.find((row) => Number(row.id) === item.contactId);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => openCustomerEdit(item.contactId, item.type)}
                          className="flex w-full items-start gap-2.5 rounded-[12px] p-2.5 text-left transition-colors hover:bg-white/[.04]"
                        >
                          <IconBox icon={item.tone === "danger" ? AlertTriangle : CalendarClock} tone={item.tone} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge tone={item.tone}>{item.type}</Badge>
                              <p className="truncate text-[13px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                                {item.title}
                                {target?.title ? <span className="ml-1 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>· {target.title}</span> : null}
                              </p>
                            </div>
                            <p className="mt-1 line-clamp-1 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>{item.desc}</p>
                          </div>
                          <ChevronRight size={13} className="mt-1.5 shrink-0" style={{ color: "var(--text-faint)" }} />
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                {/* 정기결제 D-DAY */}
                <Panel>
                  <PanelTitle icon={CreditCard} tone="warning" title="정기결제 D-DAY" desc={`D-4 이내 ${paymentDueSoonCount}건 · 계약/리텐션 고객 기준`} right={<a href="/pipeline3" className="btn-premium btn-secondary">파이프라인</a>} />
                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {paymentDdays.length === 0 ? <EmptyBlock title="결제일 등록 고객이 없습니다" desc="계약전환 시 결제채널과 결제일을 입력하면 자동으로 계산됩니다." /> : paymentDdays.map(({ contact, day, diff, due }) => (
                      <button key={contact.id} type="button" onClick={() => openCustomerEdit(Number(contact.id), `결제 ${ddayLabel(diff)}`)} className="flex w-full items-center gap-2.5 rounded-[12px] p-2.5 text-left transition-colors hover:bg-white/[.04]">
                        <div className="flex h-10 w-[52px] shrink-0 flex-col items-center justify-center rounded-[10px]" style={{ background: diff === 0 ? "var(--danger-bg)" : diff <= 4 ? "var(--warning-bg)" : "var(--surface-3)", color: diff === 0 ? "var(--danger-text)" : diff <= 4 ? "var(--warning-text)" : "var(--text-subtle)", border: `1px solid ${diff === 0 ? "var(--danger-border)" : diff <= 4 ? "var(--warning-border)" : "var(--border)"}` }}>
                          <span className="text-[11px] font-semibold leading-none">{ddayLabel(diff)}</span>
                          <span className="mt-0.5 text-[10px] font-medium leading-none">{formatDate(toDateKey(due))}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                            {contact.name || "고객명 없음"}
                            {contact.title ? <span className="ml-1 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>· {contact.title}</span> : null}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>{contact.payment_channel || "결제채널 미입력"} · 매월 {day}일</p>
                        </div>
                        <Badge tone={diff <= 4 ? "warning" : "muted"}>{contactOwner(contact)}</Badge>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 활동량 요약 */}
                <Panel>
                  <PanelTitle icon={PhoneCall} tone="info" title="활동량 요약" desc="당월 첫 접촉과 활동노트 기준" />
                  <div className="space-y-2.5 p-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      <StatBox label="첫 접촉 완료" value={`${stats.firstTouch}건`} sub={`TM ${stats.tmCount} · 콜드톡 ${stats.coldTalkCount}`} tone="info" />
                      <StatBox label="활동노트" value={`${monthNotes.length}건`} sub="녹취 요약 · 수동 기록" tone="purple" />
                    </div>
                    <div className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text)" }}>첫 접촉률</p>
                        <p className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{percent(stats.firstTouch, monthContacts.length)}%</p>
                      </div>
                      <ProgressBar value={stats.firstTouch} total={monthContacts.length} tone="cyan" />
                    </div>
                  </div>
                </Panel>

                {/* 최근 활동노트 */}
                <Panel>
                  <PanelTitle icon={Clock3} tone="muted" title="최근 활동노트" desc="녹취 요약 및 수동 기록" />
                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {monthNotes.length === 0 ? <EmptyBlock title="당월 활동노트가 없습니다" desc="고객 상세 또는 녹취 요약을 통해 활동노트가 쌓이면 표시됩니다." /> : monthNotes.slice(0, 8).map((note) => {
                      const contact = visibleContacts.find((row) => String(row.id) === String(note.contact_id));
                      return (
                        <a key={note.id} href="/contacts" className="flex gap-2.5 rounded-[12px] p-2.5 transition-colors hover:bg-white/[.04]">
                          <IconBox icon={Activity} tone="purple" size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[13px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{contact?.name || `고객 #${note.contact_id}`}</p>
                              <span className="shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>{timeAgo(note.created_at || note.note_date)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{note.content || "활동노트 내용 없음"}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        )}

        {/* ── 고객 즉시수정 팝업 (파이프라인3 contacts 테이블 직접 갱신 → 상호 연동) ── */}
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="팝업 닫기"
              onClick={() => !savingEdit && setEditTarget(null)}
              className="absolute inset-0 cursor-default backdrop-blur-[2px]"
              style={{ background: "var(--overlay)", animation: "overlayIn 160ms ease-out" }}
            />
            <div
              className="relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] border"
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)", animation: "modalIn 200ms ease-out" }}
            >
              {/* 팝업 헤더 */}
              <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="danger">{editIssue}</Badge>
                    {editTarget.customer_grade ? <Badge tone={isHighValueContact(editTarget) ? "warning" : "success"}>{editTarget.customer_grade}</Badge> : null}
                    {editTarget.intake_route ? <Badge tone="muted">{editTarget.intake_route}</Badge> : null}
                  </div>
                  <h2 className="truncate text-[19px] font-semibold tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>
                    {editTarget.name || "고객명 없음"}
                    {editTarget.title ? <span className="ml-1.5 text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>{editTarget.title}</span> : null}
                  </h2>
                  <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>ID {editTarget.id} · {editTarget.phone || "연락처 미입력"} · 담당 {contactOwner(editTarget)}</p>
                </div>
                <button type="button" onClick={() => !savingEdit && setEditTarget(null)} className="btn-premium btn-secondary h-9 w-9 shrink-0 p-0">
                  <X size={15} />
                </button>
              </div>

              {/* 팝업 본문: 즉시 수정 필드 */}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>고객명</span>
                    <input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} className="crm-search w-full px-3" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>직급</span>
                    <input value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="예: 본부장" className="crm-search w-full px-3" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>연락처</span>
                    <input value={editForm.phone} onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))} className="crm-search w-full px-3" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>관리구간</span>
                    <select value={editForm.management_stage} onChange={(event) => setEditForm((prev) => ({ ...prev, management_stage: event.target.value }))} className="crm-search w-full px-3">
                      <option value="">미지정</option>
                      {PIPELINE_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                  </label>
                </div>

                <div className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: editIssue.includes("결제") ? "var(--warning-border)" : "var(--border-subtle)" }}>
                  <p className="mb-2 text-[11px] font-semibold" style={{ color: editIssue.includes("결제") ? "var(--warning-text)" : "var(--text-subtle)" }}>
                    결제 정보 {editIssue.includes("결제") ? "· 이 항목을 채우면 알림이 해제됩니다" : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>결제채널</span>
                      <select value={editForm.payment_channel} onChange={(event) => setEditForm((prev) => ({ ...prev, payment_channel: event.target.value }))} className="crm-search w-full px-3">
                        <option value="">선택해주세요</option>
                        {PAYMENT_CHANNEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>정기결제일</span>
                      <select value={editForm.regular_payment_date} onChange={(event) => setEditForm((prev) => ({ ...prev, regular_payment_date: event.target.value }))} className="crm-search w-full px-3">
                        <option value="">선택해주세요</option>
                        {PAYMENT_DAY_OPTIONS.map((d) => <option key={d} value={String(d)}>매월 {d}일</option>)}
                      </select>
                    </label>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>메모</span>
                  <textarea value={editForm.memo} onChange={(event) => setEditForm((prev) => ({ ...prev, memo: event.target.value }))} rows={2} className="crm-search w-full resize-none px-3 py-2" />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>활동노트 빠른 작성 <span style={{ color: "var(--text-faint)" }}>(입력 시 활동 기록으로 저장 → 장기미활동 해제)</span></span>
                  <textarea value={quickNote} onChange={(event) => setQuickNote(event.target.value)} rows={2} placeholder="예: TM 재접촉 완료, 다음주 미팅 예정" className="crm-search w-full resize-none px-3 py-2" />
                </label>
              </div>

              {/* 팝업 푸터 */}
              <div className="flex items-center justify-between gap-3 border-t px-5 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
                <a href="/pipeline3" className="text-[12px] font-semibold" style={{ color: "var(--accent-text)" }}>파이프라인3에서 전체 상세보기 →</a>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={savingEdit} onClick={() => setEditTarget(null)} className="btn-premium btn-secondary">취소</button>
                  <button type="button" disabled={savingEdit} onClick={saveCustomerEdit} className="btn-premium btn-primary">
                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} 저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
