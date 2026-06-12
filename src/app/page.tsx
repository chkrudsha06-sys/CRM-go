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

type ToneName = "info" | "success" | "warning" | "danger" | "purple" | "cyan" | "muted" | "bronze";

type ActionItem = {
  key: string;
  type: string;
  tone: ToneName;
  title: string;
  desc: string;
  href: string;
  priority: number;
  contactId?: number;
};

type StageKey = "리드" | "프로스펙팅" | "딜클로징" | "리텐션" | "이탈/탈퇴";

const EXECUTION_PART_NAMES = ["조계현", "이세호", "기여운", "최연전"];
const ADMIN_NAMES = ["문시욱", "김정후", "김창완", "최웅"];
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit" });
const TODAY = new Date();

const PIPELINE_STAGES: { key: StageKey; label: string; desc: string; tone: ToneName }[] = [
  { key: "리드", label: "리드", desc: "VIP 이관 후 초기 관리", tone: "info" },
  { key: "프로스펙팅", label: "프로스펙팅", desc: "관심·니즈 확인", tone: "purple" },
  { key: "딜클로징", label: "클로징", desc: "계약 전환 집중", tone: "warning" },
  { key: "리텐션", label: "리텐션", desc: "계약완료·정기결제", tone: "success" },
  { key: "이탈/탈퇴", label: "Churn", desc: "이탈·탈퇴 고객", tone: "danger" },
];

const PAYMENT_CHANNEL_OPTIONS = [
  "자동이체 (효성CMS)",
  "카드 (사이다페이)",
  "기타 (별도입금)",
];

const PAYMENT_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => index + 1);

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

function normalizeStage(value?: string | null): StageKey {
  const v = normalizeText(value);
  if (!v) return "리드";
  if (v === normalizeText("딜크로징") || v === normalizeText("딜클로징") || v === normalizeText("클로징")) return "딜클로징";
  if (v === normalizeText("계약완료") || v === normalizeText("리텐션")) return "리텐션";
  if (v === normalizeText("예약완료")) return "딜클로징";
  if (v === normalizeText("탈퇴") || v === normalizeText("이탈") || v === normalizeText("이탈/탈퇴") || v.toLowerCase() === "churn") return "이탈/탈퇴";
  if (v === normalizeText("프로스펙팅")) return "프로스펙팅";
  return "리드";
}

function isVipContact(contact: ContactRow) {
  const source = normalizeText(contact.crm_db_source);
  const stage = normalizeStage(contact.management_stage);
  const grade = normalizeText(contact.customer_grade);
  return source === "vip_activity" || PIPELINE_STAGES.some((item) => item.key === stage) || Boolean(grade && grade !== normalizeText("심사미진행"));
}

function gradeToken(contact: ContactRow) {
  const grade = normalizeText(contact.customer_grade);
  if (grade.includes("마스터")) return "마스터";
  if (grade.includes("챌린저")) return "챌린저";
  if (grade.includes("브론즈")) return "브론즈";
  if (!grade || grade === normalizeText("심사미진행")) return "심사미진행";
  return contact.customer_grade || "기타";
}

function isPriorityGrade(contact: ContactRow) {
  const grade = gradeToken(contact);
  return grade === "마스터" || grade === "챌린저" || grade === "브론즈";
}

function isContracted(contact: ContactRow) {
  return normalizeText(contact.meeting_result) === normalizeText("계약완료") || normalizeStage(contact.management_stage) === "리텐션";
}

function isChurned(contact: ContactRow) {
  const stage = normalizeStage(contact.management_stage);
  const result = normalizeText(contact.meeting_result);
  return stage === "이탈/탈퇴" || result === normalizeText("계약거부") || result === normalizeText("미팅불발");
}

function latestActivityDate(contact: ContactRow, notesByContact: Map<string, NoteRow[]>) {
  const notes = notesByContact.get(String(contact.id)) || [];
  const latestNote = notes
    .map((note) => note.created_at || note.note_date)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0];
  return latestNote || contact.updated_at || contact.created_at || null;
}

function isTmTouch(contact: ContactRow) {
  const activity = normalizeText(contact.activity_type).toLowerCase();
  return activity.includes("tm") || Boolean(contact.has_tm) || Boolean(contact.tm_date);
}

function isColdTalkTouch(contact: ContactRow) {
  const activity = normalizeText(contact.activity_type);
  return activity.includes("콜드톡") || activity.includes("카톡") || activity.includes("문자");
}

function hasFirstTouch(contact: ContactRow, notesByContact: Map<string, NoteRow[]>, selectedMonth: string) {
  const notes = notesByContact.get(String(contact.id)) || [];
  const hasTypedNote = notes.some((note) => {
    const content = normalizeText(note.content);
    const inMonth = isInMonth(note.created_at || note.note_date, selectedMonth);
    return inMonth && (content.includes("TM") || content.includes("콜드톡") || content.includes("활동완료") || content.includes("녹취") || content.includes("통화"));
  });
  return isTmTouch(contact) || isColdTalkTouch(contact) || isInMonth(contact.tm_date, selectedMonth) || hasTypedNote;
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
    bronze: { bg: "rgba(180, 113, 48, .12)", text: "#d99a5b", border: "rgba(180, 113, 48, .30)", dot: "#d99a5b", bar: "linear-gradient(90deg,#B87333,#F59E0B)" },
    muted: { bg: "var(--surface-3)", text: "var(--text-subtle)", border: "var(--border)", dot: "var(--text-faint)", bar: "linear-gradient(90deg,var(--text-faint),var(--border))" },
  };
  return map[tone];
}

function gradeTone(grade: string): ToneName {
  if (grade === "마스터") return "warning";
  if (grade === "챌린저") return "purple";
  if (grade === "브론즈") return "bronze";
  return "muted";
}

function Badge({ children, tone = "muted", icon: Icon }: { children: ReactNode; tone?: ToneName; icon?: ElementType }) {
  const c = toneStyle(tone);
  return (
    <span
      className="inline-flex min-h-[22px] items-center gap-1.5 rounded-[8px] px-2 text-[11px] font-semibold tracking-[-0.01em]"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {Icon ? <Icon size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
      {children}
    </span>
  );
}

function IconBox({ icon: Icon, tone = "info", size = "md" }: { icon: ElementType; tone?: ToneName; size?: "sm" | "md" | "lg" }) {
  const c = toneStyle(tone);
  const cls = size === "lg" ? "h-12 w-12 rounded-[16px]" : size === "sm" ? "h-8 w-8 rounded-[10px]" : "h-10 w-10 rounded-[13px]";
  return (
    <div className={`inline-flex shrink-0 items-center justify-center ${cls}`} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <Icon size={size === "lg" ? 22 : size === "sm" ? 15 : 18} />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`premium-card overflow-hidden ${className}`}>{children}</section>;
}

function PanelTitle({ icon, tone, title, desc, right }: { icon: ElementType; tone: ToneName; title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex min-w-0 items-center gap-3">
        <IconBox icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.015em]" style={{ color: "var(--text-strong)" }}>{title}</p>
          {desc && <p className="mt-0.5 truncate text-[12px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function ProgressBar({ value, total, tone = "info" }: { value: number; total: number; tone?: ToneName }) {
  const c = toneStyle(tone);
  const width = Math.min(100, percent(value, total || value || 1));
  return (
    <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: c.bar }} />
    </div>
  );
}

function MetricCard({ title, value, sub, icon, tone, href }: { title: string; value: string | number; sub: string; icon: ElementType; tone: ToneName; href?: string }) {
  const Wrapper: any = href ? "a" : "div";
  return (
    <Wrapper href={href} className="premium-card premium-card-hover block min-h-[112px] p-4">
      <div className="flex items-start justify-between gap-3">
        <IconBox icon={icon} tone={tone} />
        {href ? <ChevronRight size={15} style={{ color: "var(--text-faint)" }} /> : null}
      </div>
      <div className="mt-4">
        <p className="text-[12px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{title}</p>
        <p className="mt-1 text-[25px] font-semibold leading-none tracking-[-0.035em]" style={{ color: "var(--text-strong)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-2 truncate text-[12px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
    </Wrapper>
  );
}

function EmptyBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex min-h-[132px] flex-col items-center justify-center p-5 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>
        <FileText size={18} />
      </div>
      <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{title}</p>
      <p className="mt-1 max-w-[320px] text-[12px] font-medium leading-relaxed tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{desc}</p>
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
  const [paymentModalContact, setPaymentModalContact] = useState<ContactRow | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    regular_payment_date: "",
    payment_channel: "",
  });
  const [paymentSaving, setPaymentSaving] = useState(false);

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

  const openPaymentModal = useCallback((contact: ContactRow) => {
    const day = parsePaymentDay(contact.regular_payment_date);
    setPaymentModalContact(contact);
    setPaymentForm({
      regular_payment_date: day ? String(day) : "",
      payment_channel: contact.payment_channel || "",
    });
  }, []);

  const closePaymentModal = useCallback(() => {
    if (paymentSaving) return;
    setPaymentModalContact(null);
    setPaymentForm({ regular_payment_date: "", payment_channel: "" });
  }, [paymentSaving]);

  const savePaymentInfo = useCallback(async () => {
    if (!paymentModalContact) return;

    if (!paymentForm.regular_payment_date) {
      alert("정기결제일을 선택해주세요.");
      return;
    }

    if (!paymentForm.payment_channel) {
      alert("결제채널을 선택해주세요.");
      return;
    }

    setPaymentSaving(true);

    try {
      const payload = {
        regular_payment_date: paymentForm.regular_payment_date,
        payment_channel: paymentForm.payment_channel,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", paymentModalContact.id);

      if (error) throw error;

      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === paymentModalContact.id
            ? { ...contact, ...payload }
            : contact
        )
      );

      setPaymentModalContact(null);
      setPaymentForm({ regular_payment_date: "", payment_channel: "" });
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "결제정보 저장 중 오류가 발생했습니다.");
    } finally {
      setPaymentSaving(false);
    }
  }, [paymentForm.payment_channel, paymentForm.regular_payment_date, paymentModalContact]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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

  const visibleSales = useMemo(() => sales.filter((row) => salesMatchesOwner(row, activeOwner)), [sales, activeOwner]);

  const monthContacts = useMemo(() => visibleContacts.filter((contact) => isInMonth(contact.created_at, selectedMonth)), [visibleContacts, selectedMonth]);
  const monthSales = useMemo(() => visibleSales.filter((row) => isInMonth(row.payment_date || row.created_at, selectedMonth)), [visibleSales, selectedMonth]);
  const monthNotes = useMemo(() => {
    const visibleIds = new Set(visibleContacts.map((contact) => String(contact.id)));
    return notes.filter((note) => visibleIds.has(String(note.contact_id)) && isInMonth(note.created_at || note.note_date, selectedMonth));
  }, [notes, visibleContacts, selectedMonth]);

  const vipContacts = useMemo(() => visibleContacts.filter(isVipContact), [visibleContacts]);

  const stats = useMemo(() => {
    const tmTouch = monthContacts.filter(isTmTouch).length;
    const coldTalk = monthContacts.filter(isColdTalkTouch).length;
    const firstTouch = monthContacts.filter((contact) => hasFirstTouch(contact, notesByContact, selectedMonth)).length;

    const vipThisMonth = visibleContacts.filter((contact) =>
      isVipContact(contact) && (isInMonth(contact.vip_transferred_at, selectedMonth) || isInMonth(contact.updated_at, selectedMonth) || isInMonth(contact.created_at, selectedMonth))
    ).length;

    const priorityContacts = vipContacts.filter(isPriorityGrade);
    const bronze = vipContacts.filter((contact) => gradeToken(contact) === "브론즈").length;
    const challenger = vipContacts.filter((contact) => gradeToken(contact) === "챌린저").length;
    const master = vipContacts.filter((contact) => gradeToken(contact) === "마스터").length;
    const gradeReviewed = vipContacts.filter((contact) => gradeToken(contact) !== "심사미진행").length;
    const priorityThisMonth = visibleContacts.filter((contact) =>
      isPriorityGrade(contact) && (isInMonth(contact.vip_transferred_at, selectedMonth) || isInMonth(contact.updated_at, selectedMonth) || isInMonth(contact.created_at, selectedMonth))
    ).length;

    const contracts = visibleContacts.filter((contact) =>
      isContracted(contact) && (isInMonth(contact.contract_date, selectedMonth) || isInMonth(contact.updated_at, selectedMonth) || isInMonth(contact.created_at, selectedMonth))
    ).length;
    const allContracts = visibleContacts.filter(isContracted).length;
    const churn = visibleContacts.filter((contact) => isChurned(contact) && (isInMonth(contact.churn_date, selectedMonth) || isInMonth(contact.updated_at, selectedMonth))).length;

    const membershipSales = monthSales.filter((row) => salesCategory(row) === "membership").reduce((sum, row) => sum + effectiveSales(row), 0);
    const lmsSales = monthSales.filter((row) => salesCategory(row) === "lms").reduce((sum, row) => sum + effectiveSales(row), 0);
    const hogangSales = monthSales.filter((row) => salesCategory(row) === "hogang").reduce((sum, row) => sum + effectiveSales(row), 0);
    const linkedSales = monthSales.filter((row) => salesCategory(row) === "linked").reduce((sum, row) => sum + effectiveSales(row), 0);
    const otherSales = monthSales.filter((row) => salesCategory(row) === "other").reduce((sum, row) => sum + effectiveSales(row), 0);
    const refund = monthSales.reduce((sum, row) => sum + refundSales(row), 0);
    const totalSales = monthSales.reduce((sum, row) => sum + effectiveSales(row), 0);

    const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.key] = vipContacts.filter((contact) => normalizeStage(contact.management_stage) === stage.key).length;
      return acc;
    }, {} as Record<StageKey, number>);

    const activePipeline = stageCounts["리드"] + stageCounts["프로스펙팅"] + stageCounts["딜클로징"];
    const retention = stageCounts["리텐션"] || allContracts;
    const churnRate = percent(stageCounts["이탈/탈퇴"] || 0, Math.max(vipContacts.length, 1));

    const paymentDueSoon = visibleContacts.filter((contact) => {
      if (!isContracted(contact)) return false;
      const day = parsePaymentDay(contact.regular_payment_date);
      if (!day) return false;
      const { diff } = getNextPaymentInfo(day);
      return diff >= 0 && diff <= 4;
    }).length;

    const missingPayment = visibleContacts.filter((contact) => isContracted(contact) && (!contact.payment_channel || !parsePaymentDay(contact.regular_payment_date))).length;

    const inactive = visibleContacts.filter((contact) => {
      const stage = normalizeStage(contact.management_stage);
      if (!["리드", "프로스펙팅", "딜클로징"].includes(stage)) return false;
      const inactiveDays = daysBetween(latestActivityDate(contact, notesByContact));
      return inactiveDays !== null && inactiveDays >= 7;
    }).length;

    const closingDelayed = visibleContacts.filter((contact) => {
      if (normalizeStage(contact.management_stage) !== "딜클로징") return false;
      const stayDays = daysBetween(contact.updated_at || contact.vip_transferred_at || contact.created_at);
      return stayDays !== null && stayDays >= 5;
    }).length;

    return {
      tmTouch,
      coldTalk,
      firstTouch,
      vipThisMonth,
      priorityContacts: priorityContacts.length,
      priorityThisMonth,
      gradeReviewed,
      bronze,
      challenger,
      master,
      contracts,
      allContracts,
      churn,
      membershipSales,
      lmsSales,
      hogangSales,
      linkedSales,
      otherSales,
      refund,
      totalSales,
      stageCounts,
      activePipeline,
      retention,
      churnRate,
      paymentDueSoon,
      missingPayment,
      inactive,
      closingDelayed,
      currentPipelineTotal: vipContacts.length,
    };
  }, [monthContacts, monthSales, notesByContact, selectedMonth, vipContacts, visibleContacts]);

  const topFunnelRows = useMemo(() => {
    return [
      {
        label: "고객DB",
        value: monthContacts.length,
        desc: `TM ${stats.tmTouch} · 콜드톡 ${stats.coldTalk}`,
        rate: 100,
        tone: "info" as ToneName,
      },
      {
        label: "첫 접촉 완료",
        value: stats.firstTouch,
        desc: "최초 TM·콜드톡 확인",
        rate: percent(stats.firstTouch, monthContacts.length),
        tone: "cyan" as ToneName,
      },
      {
        label: "VIP DB 이관",
        value: stats.vipThisMonth,
        desc: "고객DB에서 VIP활동DB로 이관",
        rate: percent(stats.vipThisMonth, monthContacts.length),
        tone: "purple" as ToneName,
      },
      {
        label: "자동등급 심사",
        value: stats.gradeReviewed,
        desc: `마스터 ${stats.master} · 챌린저 ${stats.challenger} · 브론즈 ${stats.bronze}`,
        rate: percent(stats.gradeReviewed, Math.max(stats.currentPipelineTotal, 1)),
        tone: "warning" as ToneName,
      },
    ];
  }, [monthContacts.length, stats]);

  const pipelineFunnelRows = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => ({
      ...stage,
      value: stats.stageCounts[stage.key] || 0,
      rate: percent(stats.stageCounts[stage.key] || 0, Math.max(stats.currentPipelineTotal, 1)),
    }));
  }, [stats]);

  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    visibleContacts.forEach((contact) => {
      const day = parsePaymentDay(contact.regular_payment_date);
      if (isContracted(contact) && day) {
        const { diff } = getNextPaymentInfo(day);
        if (diff >= 0 && diff <= 4) {
          items.push({
            key: `pay-${contact.id}`,
            type: ddayLabel(diff),
            tone: diff === 0 ? "danger" : "warning",
            title: contact.name || "고객명 없음",
            desc: `${contact.payment_channel || "결제채널 미입력"} · 매월 ${day}일`,
            href: "/pipeline3",
            priority: diff,
          });
        }
      }

      if (isContracted(contact) && (!contact.payment_channel || !parsePaymentDay(contact.regular_payment_date))) {
        items.push({
          key: `missing-payment-${contact.id}`,
          type: "결제정보 누락",
          tone: "danger",
          title: contact.name || "고객명 없음",
          desc: "계약완료 고객이지만 결제채널 또는 정기결제일이 없습니다.",
          href: "/pipeline3",
          priority: 1,
          contactId: contact.id,
        });
      }

      const stage = normalizeStage(contact.management_stage);
      const latest = latestActivityDate(contact, notesByContact);
      const inactiveDays = daysBetween(latest);
      if (["리드", "프로스펙팅", "딜클로징"].includes(stage) && inactiveDays !== null && inactiveDays >= 7) {
        items.push({
          key: `inactive-${contact.id}`,
          type: "장기 미활동",
          tone: "warning",
          title: contact.name || "고객명 없음",
          desc: `${stage === "딜클로징" ? "클로징" : stage} · 최근 활동 ${inactiveDays}일 전`,
          href: "/pipeline3",
          priority: 4 + inactiveDays,
        });
      }

      const closingDays = daysBetween(contact.updated_at || contact.vip_transferred_at || contact.created_at);
      if (stage === "딜클로징" && closingDays !== null && closingDays >= 5) {
        items.push({
          key: `closing-${contact.id}`,
          type: "클로징 지연",
          tone: "danger",
          title: contact.name || "고객명 없음",
          desc: `클로징 ${closingDays}일째 체류 중입니다.`,
          href: "/pipeline3",
          priority: 2 + closingDays,
        });
      }

      if (isPriorityGrade(contact) && !isContracted(contact) && !isChurned(contact)) {
        const grade = gradeToken(contact);
        items.push({
          key: `grade-${contact.id}`,
          type: `${grade} 미전환`,
          tone: gradeTone(grade),
          title: contact.name || "고객명 없음",
          desc: `${grade} DB · 현재 ${normalizeStage(contact.management_stage) === "딜클로징" ? "클로징" : normalizeStage(contact.management_stage)}`,
          href: "/pipeline3",
          priority: 8,
        });
      }
    });

    const unique = new Map<string, ActionItem>();
    items
      .sort((a, b) => a.priority - b.priority)
      .forEach((item) => {
        if (!unique.has(item.key)) unique.set(item.key, item);
      });
    return Array.from(unique.values()).slice(0, 12);
  }, [notesByContact, visibleContacts]);

  const paymentDdays = useMemo(() => {
    return visibleContacts
      .filter((contact) => isContracted(contact) && parsePaymentDay(contact.regular_payment_date))
      .map((contact) => {
        const day = parsePaymentDay(contact.regular_payment_date) || 1;
        const { due, diff } = getNextPaymentInfo(day);
        return { contact, day, due, diff };
      })
      .filter((item) => item.diff >= 0 && item.diff <= 4)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 8);
  }, [visibleContacts]);

  const missingPaymentContacts = useMemo(() => {
    return visibleContacts
      .filter((contact) => isContracted(contact) && (!contact.payment_channel || !parsePaymentDay(contact.regular_payment_date)))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  }, [visibleContacts]);

  const teamRows = useMemo(() => {
    const owners = activeOwner === "전체" ? EXECUTION_PART_NAMES : [activeOwner];
    return owners.map((owner) => {
      const ownerVisible = contacts.filter((contact) => rowMatchesOwner(contact, owner));
      const ownerMonthContacts = ownerVisible.filter((contact) => isInMonth(contact.created_at, selectedMonth));
      const ownerVip = ownerVisible.filter(isVipContact);
      const ownerSales = sales.filter((row) => salesMatchesOwner(row, owner) && isInMonth(row.payment_date || row.created_at, selectedMonth));
      const ownerStage = (stage: StageKey) => ownerVip.filter((contact) => normalizeStage(contact.management_stage) === stage).length;
      const ownerContracts = ownerVisible.filter((contact) => isContracted(contact) && (isInMonth(contact.contract_date, selectedMonth) || isInMonth(contact.updated_at, selectedMonth))).length;
      const ownerBronze = ownerVip.filter((contact) => gradeToken(contact) === "브론즈").length;
      const ownerChallenger = ownerVip.filter((contact) => gradeToken(contact) === "챌린저").length;
      const ownerMaster = ownerVip.filter((contact) => gradeToken(contact) === "마스터").length;
      return {
        owner,
        db: ownerMonthContacts.length,
        vip: ownerVip.length,
        lead: ownerStage("리드"),
        prospect: ownerStage("프로스펙팅"),
        closing: ownerStage("딜클로징"),
        retention: ownerStage("리텐션"),
        churn: ownerStage("이탈/탈퇴"),
        contracts: ownerContracts,
        bronze: ownerBronze,
        challenger: ownerChallenger,
        master: ownerMaster,
        sales: ownerSales.reduce((sum, row) => sum + effectiveSales(row), 0),
        conversion: percent(ownerContracts, Math.max(ownerVip.length, 1)),
      };
    });
  }, [activeOwner, contacts, sales, selectedMonth]);

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
        const monthRows = rows.filter((row) => isInMonth(row.created_at, selectedMonth) || isInMonth(row.vip_transferred_at, selectedMonth));
        const vip = rows.filter(isVipContact).length;
        const contract = rows.filter(isContracted).length;
        const master = rows.filter((row) => gradeToken(row) === "마스터").length;
        const challenger = rows.filter((row) => gradeToken(row) === "챌린저").length;
        const bronze = rows.filter((row) => gradeToken(row) === "브론즈").length;
        return {
          route,
          count: monthRows.length || rows.length,
          total: rows.length,
          vip,
          contract,
          master,
          challenger,
          bronze,
          vipRate: percent(vip, rows.length),
          contractRate: percent(contract, rows.length),
        };
      })
      .sort((a, b) => b.contract - a.contract || b.vip - a.vip || b.count - a.count)
      .slice(0, 7);
  }, [selectedMonth, visibleContacts]);

  const gradeRows = useMemo(() => {
    const priorityOrder = ["마스터", "챌린저", "브론즈"];
    const rows = priorityOrder.map((grade) => {
      const contactsByGrade = vipContacts.filter((contact) => gradeToken(contact) === grade);
      const contracts = contactsByGrade.filter(isContracted).length;
      return { grade, count: contactsByGrade.length, contracts, rate: percent(contracts, contactsByGrade.length), tone: gradeTone(grade) };
    });

    const otherRows = Array.from(
      vipContacts.reduce((map, contact) => {
        const grade = gradeToken(contact);
        if (priorityOrder.includes(grade) || grade === "심사미진행") return map;
        const list = map.get(grade) || [];
        list.push(contact);
        map.set(grade, list);
        return map;
      }, new Map<string, ContactRow[]>())
    ).map(([grade, rows]) => ({ grade, count: rows.length, contracts: rows.filter(isContracted).length, rate: percent(rows.filter(isContracted).length, rows.length), tone: "muted" as ToneName }));

    return [...rows, ...otherRows.sort((a, b) => b.count - a.count)].slice(0, 6);
  }, [vipContacts]);

  const kpiTarget = useMemo(() => {
    const userName = activeOwner === "전체" ? "team" : activeOwner;
    const target = activeOwner === "전체"
      ? kpis.find((row) => row.scope === "team" && row.target_name === "team")
      : kpis.find((row) => row.scope === "execution" && normalizePersonName(row.target_name) === normalizePersonName(userName));
    return target || null;
  }, [activeOwner, kpis]);

  const kpiRows = useMemo(() => {
    const target = kpiTarget;
    return [
      { label: "분양회 모집", value: stats.contracts, goal: Number(target?.recruit_count || 0), unit: "명", tone: "success" as ToneName },
      { label: "분양회 회비", value: stats.membershipSales, goal: Number(target?.bunyanghoe_revenue || 0), unit: "원", tone: "warning" as ToneName, money: true },
      { label: "연계매출", value: stats.linkedSales, goal: Number(target?.linked_revenue || 0), unit: "원", tone: "info" as ToneName, money: true },
      { label: "광고특전", value: stats.lmsSales + stats.hogangSales, goal: Number(target?.special_revenue || 0), unit: "원", tone: "purple" as ToneName, money: true },
      { label: "완판트럭 DB", value: monthContacts.filter((contact) => normalizeText(contact.intake_route).includes(normalizeText("완판트럭"))).length, goal: Number(target?.wanpan_truck_count || 0), unit: "건", tone: "cyan" as ToneName },
    ];
  }, [kpiTarget, monthContacts, stats]);

  const selectedMonthLabel = MONTH_LABEL_FORMAT.format(getMonthWindow(selectedMonth).start);
  const dashboardScopeLabel = activeOwner === "전체" ? "팀 전체" : `${activeOwner} 담당자`;

  return (
    <div className="premium-page h-full overflow-y-auto">
      <div className="premium-shell px-5 py-5 md:px-7 md:py-6">
        <header className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="purple" icon={Sparkles}>영업 인사이트</Badge>
              <Badge tone={fixedOwner ? "success" : "info"} icon={UserCheck}>{dashboardScopeLabel}</Badge>
              <Badge tone="muted" icon={CalendarDays}>{selectedMonthLabel}</Badge>
            </div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] md:text-[30px]" style={{ color: "var(--text-strong)" }}>대시보드</h1>
            <p className="mt-1 text-[13px] font-medium leading-relaxed tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>
              고객DB → 첫 접촉 → VIP 이관/자동등급 → 파이프라인3 → 계약/리텐션 → 매출까지 한눈에 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="고객명, 연락처, 메모 검색" className="crm-search w-full pl-9 pr-3 tracking-[-0.01em]" />
            </div>

            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="crm-search w-[150px] px-3 tracking-[-0.01em]">
              {monthOptions().map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>

            <select value={activeOwner} disabled={fixedOwner} onChange={(event) => setOwnerFilter(event.target.value)} className="crm-search w-[150px] px-3 tracking-[-0.01em] disabled:opacity-70">
              <option value="전체">전체 담당자</option>
              {EXECUTION_PART_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>

            <button type="button" onClick={fetchDashboard} className="btn-premium btn-secondary">
              <RefreshCw size={14} /> 새로고침
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="mb-4 rounded-[16px] border px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-text)" }}>
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[620px] items-center justify-center">
            <Loader2 className="animate-spin" size={32} style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          <div className="space-y-4">
            <Panel>
              <PanelTitle icon={LineChart} tone="info" title="당월 영업 퍼널" desc="고객DB 발굴부터 계약/리텐션과 Churn까지의 전체 흐름" right={<Badge tone="muted">{selectedMonthLabel}</Badge>} />
              <div className="space-y-4 p-4">
                <div className="grid gap-3 lg:grid-cols-4">
                  {topFunnelRows.map((row, index) => (
                    <div key={row.label} className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={row.tone}>{index === 0 ? "시작" : `${row.rate}%`}</Badge>
                        {index < topFunnelRows.length - 1 ? <ArrowRight size={14} style={{ color: "var(--text-faint)" }} /> : <CheckCircle2 size={14} style={{ color: "var(--success-text)" }} />}
                      </div>
                      <p className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.035em]" style={{ color: "var(--text-strong)" }}>{row.value.toLocaleString()}</p>
                      <p className="mt-2 text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text)" }}>{row.label}</p>
                      <p className="mt-1 truncate text-[12px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{row.desc}</p>
                      <div className="mt-3"><ProgressBar value={row.value} total={index === 0 ? Math.max(row.value, 1) : Math.max(topFunnelRows[index - 1].value, 1)} tone={row.tone} /></div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-5">
                  {pipelineFunnelRows.map((row) => (
                    <a key={row.key} href="/pipeline3" className="rounded-[16px] border p-4 transition-all hover:-translate-y-0.5 hover:bg-white/[.035]" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone={row.tone}>{row.label}</Badge>
                        <span className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{row.rate}%</span>
                      </div>
                      <p className="mt-4 text-[26px] font-semibold leading-none tracking-[-0.035em]" style={{ color: "var(--text-strong)" }}>{row.value.toLocaleString()}</p>
                      <p className="mt-2 text-[12px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{row.desc}</p>
                      <div className="mt-3"><ProgressBar value={row.value} total={Math.max(stats.currentPipelineTotal, 1)} tone={row.tone} /></div>
                    </a>
                  ))}
                </div>
              </div>
            </Panel>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              <MetricCard title="당월 고객DB" value={monthContacts.length} sub={`첫 접촉 ${stats.firstTouch}명 · ${percent(stats.firstTouch, monthContacts.length)}%`} icon={Database} tone="info" href="/customer-db" />
              <MetricCard title="VIP 이관DB" value={stats.vipThisMonth} sub={`현재 VIP ${stats.currentPipelineTotal}명`} icon={ShieldCheck} tone="purple" href="/contacts" />
              <MetricCard title="브론즈 등록DB" value={stats.bronze} sub="중요 육성 DB" icon={BadgeCheck} tone="bronze" href="/contacts" />
              <MetricCard title="챌린저·마스터" value={stats.challenger + stats.master} sub={`챌린저 ${stats.challenger} · 마스터 ${stats.master}`} icon={Target} tone="warning" href="/pipeline3" />
              <MetricCard title="계약완료" value={stats.contracts} sub={`리텐션 ${stats.retention}명`} icon={CheckCircle2} tone="success" href="/pipeline3" />
              <MetricCard title="Churn" value={stats.churn} sub={`이탈률 ${stats.churnRate}%`} icon={TrendingDown} tone="danger" href="/pipeline3" />
              <MetricCard title="당월 순매출" value={money(stats.totalSales)} sub={`환불 ${moneyFull(stats.refund)}`} icon={CircleDollarSign} tone="cyan" href="/sales" />
              <MetricCard title="정기결제 D-4" value={stats.paymentDueSoon} sub={`결제정보 누락 ${stats.missingPayment}명`} icon={CalendarClock} tone="warning" href="/pipeline3" />
            </section>

            <div className="grid gap-4 2xl:grid-cols-[1.05fr_.95fr]">
              <Panel>
                <PanelTitle icon={AlertTriangle} tone="danger" title="크리티컬 관리 이슈" desc="장기미활동, 클로징 지연, 결제정보 누락, 정기결제 도래 고객" right={<Badge tone="danger">{actionItems.length}건</Badge>} />
                <div className="grid gap-3 p-4 md:grid-cols-4">
                  {[
                    { label: "정기결제 D-4", value: stats.paymentDueSoon, tone: "warning" as ToneName, icon: CalendarClock },
                    { label: "장기미활동", value: stats.inactive, tone: "warning" as ToneName, icon: Clock3 },
                    { label: "클로징 지연", value: stats.closingDelayed, tone: "danger" as ToneName, icon: Target },
                    { label: "결제정보 누락", value: stats.missingPayment, tone: "danger" as ToneName, icon: CreditCard },
                  ].map((item) => {
                    const isMissingPayment = item.label === "결제정보 누락";
                    const shared = (
                      <>
                        <IconBox icon={item.icon} tone={item.tone} size="sm" />
                        <p className="mt-4 text-[25px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{item.value}</p>
                        <p className="mt-2 text-[12px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{item.label}</p>
                        {isMissingPayment ? <p className="mt-2 text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--danger-text)" }}>클릭하여 결제정보 입력</p> : null}
                      </>
                    );

                    if (isMissingPayment) {
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            const firstContact = missingPaymentContacts[0];
                            if (firstContact) openPaymentModal(firstContact);
                          }}
                          disabled={missingPaymentContacts.length === 0}
                          className="rounded-[16px] border p-4 text-left transition-all hover:bg-white/[.035] disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
                        >
                          {shared}
                        </button>
                      );
                    }

                    return (
                      <a key={item.label} href="/pipeline3" className="rounded-[16px] border p-4 transition-all hover:bg-white/[.035]" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                        {shared}
                      </a>
                    );
                  })}
                </div>
                <div className="max-h-[300px] overflow-y-auto px-2 pb-2">
                  {actionItems.length === 0 ? <EmptyBlock title="현재 긴급 관리 이슈가 없습니다" desc="D-4 결제, 장기미활동, 클로징 지연이 생기면 이곳에 표시됩니다." /> : actionItems.map((item) => {
                    const icon = item.tone === "danger" ? AlertTriangle : item.type.includes("D-") || item.type === "D-DAY" ? CalendarClock : Target;
                    const body = (
                      <>
                        <IconBox icon={icon} tone={item.tone} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge tone={item.tone}>{item.type}</Badge>
                            <p className="truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{item.title}</p>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-relaxed tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{item.desc}</p>
                          {item.type === "결제정보 누락" ? <p className="mt-2 text-[11px] font-semibold tracking-[-0.01em]" style={{ color: "var(--danger-text)" }}>정기결제일/결제채널 등록</p> : null}
                        </div>
                        <ChevronRight size={14} style={{ color: "var(--text-faint)" }} />
                      </>
                    );

                    if (item.type === "결제정보 누락" && item.contactId) {
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            const contact = visibleContacts.find((row) => row.id === item.contactId);
                            if (contact) openPaymentModal(contact);
                          }}
                          className="flex w-full gap-3 rounded-[15px] p-3 text-left transition-all hover:bg-white/[.04]"
                        >
                          {body}
                        </button>
                      );
                    }

                    return (
                      <a key={item.key} href={item.href} className="flex gap-3 rounded-[15px] p-3 transition-all hover:bg-white/[.04]">
                        {body}
                      </a>
                    );
                  })}
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={BarChart3} tone="cyan" title="통합매출관리 매출 현황" desc="분양회 월회비, LMS, 호갱노노, 연계매출 집계" right={<a href="/sales" className="btn-premium btn-secondary">매출관리</a>} />
                <div className="space-y-3 p-4">
                  <div className="rounded-[18px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <p className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>당월 순매출</p>
                    <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.035em]" style={{ color: "var(--text-strong)" }}>{moneyFull(stats.totalSales)}</p>
                    <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>환불/차감 {moneyFull(stats.refund)}</p>
                  </div>
                  {[
                    { label: "분양회 월회비", value: stats.membershipSales, tone: "warning" as ToneName },
                    { label: "LMS", value: stats.lmsSales, tone: "info" as ToneName },
                    { label: "호갱노노", value: stats.hogangSales, tone: "purple" as ToneName },
                    { label: "연계매출", value: stats.linkedSales, tone: "success" as ToneName },
                    { label: "기타/별도입금", value: stats.otherSales, tone: "muted" as ToneName },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-semibold tracking-[-0.01em]">
                        <span style={{ color: "var(--text)" }}>{item.label}</span>
                        <span style={{ color: "var(--text-strong)" }}>{moneyFull(item.value)}</span>
                      </div>
                      <ProgressBar value={item.value} total={Math.max(stats.totalSales, 1)} tone={item.tone} />
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 2xl:grid-cols-[1.16fr_.84fr]">
              <Panel>
                <PanelTitle icon={Users} tone="purple" title="담당자별 파이프라인 현황" desc="스크롤 없이 담당자별 DB·등급·파이프라인·매출을 한 번에 확인" right={<Badge tone="info" icon={Filter}>{isAdminUser(me) || activeOwner === "전체" ? "관리자 뷰" : "개인 뷰"}</Badge>} />
                <div className="grid gap-3 p-4 xl:grid-cols-2">
                  {teamRows.map((row) => (
                    <div key={row.owner} className="rounded-[18px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge tone={normalizePersonName(row.owner) === normalizePersonName(activeOwner) ? "purple" : "muted"} icon={UserCheck}>{row.owner}</Badge>
                          <p className="mt-3 text-[24px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{row.sales ? money(row.sales) : "매출 0원"}</p>
                          <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>VIP 대비 계약전환율 {row.conversion}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>당월 신규DB</p>
                          <p className="mt-1 text-[22px] font-semibold leading-none" style={{ color: "var(--text-strong)" }}>{row.db}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[12px] font-semibold tracking-[-0.01em]">
                        <div className="rounded-[12px] p-2" style={{ background: "var(--surface-3)" }}><p style={{ color: "var(--text-subtle)" }}>VIP</p><p style={{ color: "var(--text-strong)" }}>{row.vip}</p></div>
                        <div className="rounded-[12px] p-2" style={{ background: "var(--surface-3)" }}><p style={{ color: "#d99a5b" }}>브론즈</p><p style={{ color: "var(--text-strong)" }}>{row.bronze}</p></div>
                        <div className="rounded-[12px] p-2" style={{ background: "var(--surface-3)" }}><p style={{ color: "var(--purple-text)" }}>챌린저</p><p style={{ color: "var(--text-strong)" }}>{row.challenger}</p></div>
                        <div className="rounded-[12px] p-2" style={{ background: "var(--surface-3)" }}><p style={{ color: "var(--warning-text)" }}>마스터</p><p style={{ color: "var(--text-strong)" }}>{row.master}</p></div>
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[12px] font-semibold tracking-[-0.01em]">
                        <div><p style={{ color: "var(--text-subtle)" }}>리드</p><p style={{ color: "var(--text-strong)" }}>{row.lead}</p></div>
                        <div><p style={{ color: "var(--text-subtle)" }}>프로스펙팅</p><p style={{ color: "var(--text-strong)" }}>{row.prospect}</p></div>
                        <div><p style={{ color: "var(--text-subtle)" }}>클로징</p><p style={{ color: "var(--text-strong)" }}>{row.closing}</p></div>
                        <div><p style={{ color: "var(--success-text)" }}>계약</p><p style={{ color: "var(--text-strong)" }}>{row.contracts || row.retention}</p></div>
                        <div><p style={{ color: "var(--danger-text)" }}>Churn</p><p style={{ color: "var(--text-strong)" }}>{row.churn}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={Activity} tone="purple" title="자동등급별 계약전환율" desc="브론즈·챌린저·마스터 DB의 실제 계약 전환 성과" />
                <div className="space-y-3 p-4">
                  {gradeRows.length === 0 ? <EmptyBlock title="등급 데이터가 없습니다" desc="VIP활동DB에서 자동등급 심사를 진행하면 표시됩니다." /> : gradeRows.map((row) => (
                    <div key={row.grade} className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone={row.tone}>{row.grade}</Badge>
                        <span className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{row.contracts}/{row.count}명 계약</span>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[30px] font-semibold leading-none tracking-[-0.035em]" style={{ color: "var(--text-strong)" }}>{row.rate}%</p>
                          <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>계약전환율</p>
                        </div>
                        <p className="text-right text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>보유 {row.count}명</p>
                      </div>
                      <div className="mt-3"><ProgressBar value={row.contracts} total={row.count} tone={row.tone} /></div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
              <Panel>
                <PanelTitle icon={TrendingUp} tone="success" title="유입경로별 성과" desc="DB 유입경로별 VIP 이관율과 계약률" />
                <div className="p-4">
                  {intakeRows.length === 0 ? <EmptyBlock title="유입경로 데이터가 없습니다" desc="고객DB에 유입경로가 입력되면 자동 집계됩니다." /> : (
                    <div className="space-y-3">
                      {intakeRows.map((row) => (
                        <div key={row.route} className="rounded-[16px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{row.route}</p>
                            <div className="flex shrink-0 gap-2">
                              <Badge tone={row.vipRate >= 40 ? "success" : row.vipRate >= 20 ? "warning" : "muted"}>VIP {row.vipRate}%</Badge>
                              <Badge tone={row.contractRate >= 20 ? "success" : row.contractRate >= 8 ? "warning" : "muted"}>계약 {row.contractRate}%</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center text-[12px] font-semibold tracking-[-0.01em]">
                            <div><p style={{ color: "var(--text-subtle)" }}>DB</p><p style={{ color: "var(--text-strong)" }}>{row.count}</p></div>
                            <div><p style={{ color: "var(--text-subtle)" }}>VIP</p><p style={{ color: "var(--text-strong)" }}>{row.vip}</p></div>
                            <div><p style={{ color: "#d99a5b" }}>브론즈</p><p style={{ color: "var(--text-strong)" }}>{row.bronze}</p></div>
                            <div><p style={{ color: "var(--success-text)" }}>계약</p><p style={{ color: "var(--text-strong)" }}>{row.contract}</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={Target} tone="warning" title="KPI 목표 대비 달성률" desc="오른쪽으로 길게 늘리지 않고 핵심 목표만 압축 표시" right={<a href="/kpi-settings" className="btn-premium btn-secondary">KPI 설정</a>} />
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {kpiRows.map((row) => {
                    const hasGoal = row.goal > 0;
                    return (
                      <div key={row.label} className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text)" }}>{row.label}</p>
                          <Badge tone={hasGoal && row.value >= row.goal ? "success" : row.tone}>{hasGoal ? `${percent(row.value, row.goal)}%` : "목표 없음"}</Badge>
                        </div>
                        <p className="mt-4 text-[20px] font-semibold leading-tight tracking-[-0.025em]" style={{ color: "var(--text-strong)" }}>
                          {row.money ? money(row.value) : `${row.value.toLocaleString()}${row.unit}`}
                        </p>
                        <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>
                          목표 {hasGoal ? (row.money ? money(row.goal) : `${row.goal.toLocaleString()}${row.unit}`) : "미설정"}
                        </p>
                        <div className="mt-3"><ProgressBar value={row.value} total={hasGoal ? row.goal : Math.max(row.value, 1)} tone={row.tone} /></div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 2xl:grid-cols-[.95fr_1.05fr]">
              <Panel>
                <PanelTitle icon={CalendarClock} tone="warning" title="정기결제 도래 고객" desc="계약/리텐션 고객 중 4일 이내 정기결제 예정" right={<a href="/pipeline3" className="btn-premium btn-secondary">파이프라인</a>} />
                <div className="max-h-[360px] overflow-y-auto p-2">
                  {paymentDdays.length === 0 ? <EmptyBlock title="4일 이내 정기결제 도래 고객이 없습니다" desc="계약자별 정기결제일을 입력하면 D-4부터 표시됩니다." /> : paymentDdays.map(({ contact, day, diff, due }) => (
                    <a key={contact.id} href="/pipeline3" className="flex items-center gap-3 rounded-[15px] p-3 transition-all hover:bg-white/[.04]">
                      <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-[14px]" style={{ background: diff <= 1 ? "var(--danger-bg)" : "var(--warning-bg)", color: diff <= 1 ? "var(--danger-text)" : "var(--warning-text)", border: `1px solid ${diff <= 1 ? "var(--danger-border)" : "var(--warning-border)"}` }}>
                        <span className="text-[11px] font-semibold">{ddayLabel(diff)}</span>
                        <span className="text-[10px] font-medium">{formatDate(toDateKey(due))}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{contact.name || "고객명 없음"}</p>
                        <p className="mt-1 truncate text-[12px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{contact.payment_channel || "결제채널 미입력"} · 매월 {day}일</p>
                      </div>
                      <Badge tone="muted">{contactOwner(contact)}</Badge>
                    </a>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={Clock3} tone="muted" title="최근 활동노트" desc="고객DB/VIP활동DB/파이프라인에서 쌓인 최근 접촉 기록" />
                <div className="max-h-[360px] overflow-y-auto p-2">
                  {monthNotes.length === 0 ? <EmptyBlock title="당월 활동노트가 없습니다" desc="고객 상세 또는 녹취 요약을 통해 활동노트가 쌓이면 표시됩니다." /> : monthNotes.slice(0, 9).map((note) => {
                    const contact = visibleContacts.find((row) => String(row.id) === String(note.contact_id));
                    return (
                      <a key={note.id} href="/contacts" className="flex gap-3 rounded-[15px] p-3 transition-all hover:bg-white/[.04]">
                        <IconBox icon={Activity} tone="purple" size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{contact?.name || `고객 #${note.contact_id}`}</p>
                            <span className="shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>{timeAgo(note.created_at || note.note_date)}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-relaxed tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{note.content || "활동노트 내용 없음"}</p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>

      {paymentModalContact ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6"
          style={{ background: "rgba(0, 0, 0, .62)", backdropFilter: "blur(10px)" }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closePaymentModal();
          }}
        >
          <div
            className="w-full max-w-[520px] rounded-[24px] border p-5 shadow-2xl"
            style={{ background: "var(--surface)", borderColor: "var(--border-2)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Badge tone="danger" icon={CreditCard}>결제정보 누락</Badge>
                <h2 className="mt-3 truncate text-[22px] font-semibold tracking-[-0.025em]" style={{ color: "var(--text-strong)" }}>
                  {paymentModalContact.name || "고객명 없음"}
                </h2>
                <p className="mt-1 text-[13px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>
                  계약완료 고객의 정기결제일과 결제채널을 등록합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={closePaymentModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[20px] font-semibold transition-all hover:bg-white/[.05]"
                style={{ color: "var(--text-subtle)", border: "1px solid var(--border-subtle)" }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 rounded-[18px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>정기결제일</span>
                  <select
                    value={paymentForm.regular_payment_date}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, regular_payment_date: event.target.value }))}
                    className="h-11 w-full rounded-[12px] border px-3 text-[13px] font-semibold outline-none"
                    style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
                  >
                    <option value="">정기결제일 선택</option>
                    {PAYMENT_DAY_OPTIONS.map((day) => (
                      <option key={day} value={String(day)}>
                        매월 {day}일
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>결제채널</span>
                  <select
                    value={paymentForm.payment_channel}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_channel: event.target.value }))}
                    className="h-11 w-full rounded-[12px] border px-3 text-[13px] font-semibold outline-none"
                    style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
                  >
                    <option value="">결제채널 선택</option>
                    {[
                      ...(paymentForm.payment_channel && !PAYMENT_CHANNEL_OPTIONS.includes(paymentForm.payment_channel) ? [paymentForm.payment_channel] : []),
                      ...PAYMENT_CHANNEL_OPTIONS,
                    ].map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-2 text-[12px] font-semibold tracking-[-0.01em] sm:grid-cols-3">
                <div className="rounded-[12px] p-3" style={{ background: "var(--surface-3)" }}>
                  <p style={{ color: "var(--text-subtle)" }}>담당자</p>
                  <p className="mt-1 truncate" style={{ color: "var(--text-strong)" }}>{contactOwner(paymentModalContact)}</p>
                </div>
                <div className="rounded-[12px] p-3" style={{ background: "var(--surface-3)" }}>
                  <p style={{ color: "var(--text-subtle)" }}>현재 등급</p>
                  <p className="mt-1 truncate" style={{ color: "var(--text-strong)" }}>{gradeToken(paymentModalContact)}</p>
                </div>
                <div className="rounded-[12px] p-3" style={{ background: "var(--surface-3)" }}>
                  <p style={{ color: "var(--text-subtle)" }}>관리구간</p>
                  <p className="mt-1 truncate" style={{ color: "var(--text-strong)" }}>{normalizeStage(paymentModalContact.management_stage) === "딜클로징" ? "클로징" : normalizeStage(paymentModalContact.management_stage)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePaymentModal}
                className="btn-premium btn-secondary"
                disabled={paymentSaving}
              >
                취소
              </button>
              <button
                type="button"
                onClick={savePaymentInfo}
                className="btn-premium btn-primary"
                disabled={paymentSaving}
              >
                {paymentSaving ? <Loader2 className="animate-spin" size={14} /> : <CreditCard size={14} />}
                결제정보 저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
