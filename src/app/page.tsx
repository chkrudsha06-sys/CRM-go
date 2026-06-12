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

function Badge({ children, tone = "muted", icon: Icon }: { children: ReactNode; tone?: ToneName; icon?: ElementType }) {
  const c = toneStyle(tone);
  return (
    <span
      className="inline-flex min-h-[24px] items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-semibold"
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
    <div className="flex items-center justify-between gap-3 border-b px-4 py-4" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex min-w-0 items-center gap-3">
        <IconBox icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{title}</p>
          {desc && <p className="mt-1 truncate text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function MetricCard({ title, value, sub, icon, tone, href }: { title: string; value: string | number; sub: string; icon: ElementType; tone: ToneName; href?: string }) {
  const Wrapper: any = href ? "a" : "div";
  return (
    <Wrapper href={href} className="premium-card premium-card-hover block min-h-[126px] p-4">
      <div className="flex items-start justify-between gap-3">
        <IconBox icon={icon} tone={tone} />
        {href ? <ChevronRight size={15} style={{ color: "var(--text-faint)" }} /> : null}
      </div>
      <div className="mt-5">
        <p className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{title}</p>
        <p className="mt-1 text-[26px] font-semibold leading-none tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-2 truncate text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
    </Wrapper>
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

function EmptyBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>
        <FileText size={18} />
      </div>
      <p className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>{title}</p>
      <p className="mt-1 max-w-[300px] text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{desc}</p>
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
    const vipThisMonth = visibleContacts.filter((contact) => isVipContact(contact) && touchedInMonth(contact, selectedMonth)).length;
    const highValue = visibleContacts.filter((contact) => isHighValueContact(contact)).length;
    const highValueThisMonth = visibleContacts.filter((contact) => isHighValueContact(contact) && touchedInMonth(contact, selectedMonth)).length;
    const coreVip = visibleContacts.filter((contact) => isCoreVipGrade(contact)).length;
    const coreVipThisMonth = visibleContacts.filter((contact) => isCoreVipGrade(contact) && touchedInMonth(contact, selectedMonth)).length;
    const master = visibleContacts.filter((contact) => isGradeContact(contact, "마스터")).length;
    const challenger = visibleContacts.filter((contact) => isGradeContact(contact, "챌린저")).length;
    const bronze = visibleContacts.filter((contact) => isGradeContact(contact, "브론즈")).length;
    const bronzeThisMonth = visibleContacts.filter((contact) => isGradeContact(contact, "브론즈") && touchedInMonth(contact, selectedMonth)).length;
    const contracts = visibleContacts.filter((contact) => isContractedInMonth(contact, selectedMonth)).length;
    const churn = visibleContacts.filter((contact) => isChurned(contact) && (isInMonth(contact.churn_date, selectedMonth) || isInMonth(contact.updated_at, selectedMonth))).length;

    const membershipSales = monthSales.filter((row) => salesCategory(row) === "membership").reduce((sum, row) => sum + effectiveSales(row), 0);
    const lmsSales = monthSales.filter((row) => salesCategory(row) === "lms").reduce((sum, row) => sum + effectiveSales(row), 0);
    const hogangSales = monthSales.filter((row) => salesCategory(row) === "hogang").reduce((sum, row) => sum + effectiveSales(row), 0);
    const linkedSales = monthSales.filter((row) => salesCategory(row) === "linked").reduce((sum, row) => sum + effectiveSales(row), 0);
    const otherSales = monthSales.filter((row) => salesCategory(row) === "other").reduce((sum, row) => sum + effectiveSales(row), 0);
    const refund = monthSales.reduce((sum, row) => sum + refundSales(row), 0);
    const totalSales = monthSales.reduce((sum, row) => sum + effectiveSales(row), 0);

    const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = vipContacts.filter((contact) => normalizeText(contact.management_stage) === normalizeText(stage)).length;
      return acc;
    }, {} as Record<string, number>);

    const retention = stageCounts["리텐션"] || visibleContacts.filter(isContracted).length;
    const churnRate = percent(stageCounts["이탈/탈퇴"] || 0, Math.max(vipContacts.length, 1));

    return {
      firstTouch,
      vipThisMonth,
      highValue,
      highValueThisMonth,
      coreVip,
      coreVipThisMonth,
      master,
      challenger,
      bronze,
      bronzeThisMonth,
      contracts,
      churn,
      membershipSales,
      lmsSales,
      hogangSales,
      linkedSales,
      otherSales,
      refund,
      totalSales,
      stageCounts,
      retention,
      churnRate,
      currentPipelineTotal: vipContacts.length,
    };
  }, [monthContacts, monthSales, notesByContact, selectedMonth, vipContacts, visibleContacts]);

  const acquisitionRows = useMemo<FunnelRow[]>(() => {
    return [
      { label: "신규고객DB", value: monthContacts.length, sub: "당월 신규 등록 DB", tone: "info" },
      { label: "첫접촉완료", value: stats.firstTouch, sub: "TM·콜드톡·활동노트 발생", tone: "cyan" },
    ];
  }, [monthContacts.length, stats.firstTouch]);

  const vipGradeSummaryRows = useMemo<FunnelRow[]>(() => {
    return [
      { label: "VIP 이관DB", value: stats.vipThisMonth, sub: `현재 VIP ${stats.currentPipelineTotal}명`, tone: "purple" },
      { label: "마스터·챌린저", value: stats.master + stats.challenger, sub: `마스터 ${stats.master} · 챌린저 ${stats.challenger}`, tone: "warning" },
      { label: "브론즈 등록DB", value: stats.bronze, sub: `당월 등록/변경 ${stats.bronzeThisMonth}명`, tone: "success" },
    ];
  }, [stats.bronze, stats.bronzeThisMonth, stats.challenger, stats.currentPipelineTotal, stats.master, stats.vipThisMonth]);

  const pipelineRows = useMemo<FunnelRow[]>(() => {
    return [
      { label: "리드", value: stats.stageCounts["리드"] || 0, sub: "초기 분류 고객", tone: "info" },
      { label: "프로스펙팅", value: stats.stageCounts["프로스펙팅"] || 0, sub: "상담·니즈 확인", tone: "purple" },
      { label: "클로징", value: stats.stageCounts["딜클로징"] || 0, sub: "계약 전환 집중", tone: "warning" },
      { label: "리텐션", value: stats.retention, sub: "계약·사후관리", tone: "success" },
    ];
  }, [stats.retention, stats.stageCounts]);

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
            desc: paymentLabel(contact),
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
          desc: "계약완료 고객이지만 결제채널 또는 결제일이 없습니다.",
          href: "/pipeline3",
          priority: 1,
        });
      }

      const stage = normalizeText(contact.management_stage);
      const latest = latestActivityDate(contact, notesByContact);
      const inactiveDays = daysBetween(latest);
      if (["리드", "프로스펙팅", "딜클로징"].some((item) => stage === normalizeText(item)) && inactiveDays !== null && inactiveDays >= 7) {
        items.push({
          key: `inactive-${contact.id}`,
          type: "장기 미활동",
          tone: "warning",
          title: contact.name || "고객명 없음",
          desc: `${contact.management_stage || "관리구간"} · 최근 활동 ${inactiveDays}일 전`,
          href: "/pipeline3",
          priority: 4 + inactiveDays,
        });
      }

      const closingDays = daysBetween(contact.updated_at || contact.vip_transferred_at || contact.created_at);
      if (stage === normalizeText("딜클로징") && closingDays !== null && closingDays >= 5) {
        items.push({
          key: `closing-${contact.id}`,
          type: "클로징 지연",
          tone: "danger",
          title: contact.name || "고객명 없음",
          desc: `딜클로징 ${closingDays}일째 체류 중입니다.`,
          href: "/pipeline3",
          priority: 2 + closingDays,
        });
      }

      if (isHighValueContact(contact) && !isContracted(contact) && !isChurned(contact)) {
        items.push({
          key: `high-${contact.id}`,
          type: "1% 미전환",
          tone: "purple",
          title: contact.name || "고객명 없음",
          desc: `${contact.customer_grade || "고등급"} · 현재 ${contact.management_stage || "관리구간 미지정"}`,
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
    return Array.from(unique.values()).slice(0, 10);
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
      return {
        owner,
        db: ownerMonthContacts.length,
        vip: ownerVip.length,
        lead: ownerStage("리드"),
        prospect: ownerStage("프로스펙팅"),
        closing: ownerStage("딜클로징"),
        retention: ownerStage("리텐션"),
        churn: ownerStage("이탈/탈퇴"),
        contracts: ownerVisible.filter((contact) => isContracted(contact) && (isInMonth(contact.contract_date, selectedMonth) || isInMonth(contact.updated_at, selectedMonth))).length,
        sales: ownerSales.reduce((sum, row) => sum + effectiveSales(row), 0),
      };
    });
  }, [contacts, keyword, sales, selectedMonth]);

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
        const baseRows = monthRows.length ? monthRows : rows;
        const contract = rows.filter(isContracted).length;
        const vip = rows.filter(isVipContact).length;
        const firstTouch = rows.filter((row) => hasFirstTouch(row, notesByContact, selectedMonth)).length;
        return { route, count: baseRows.length, total: rows.length, firstTouch, vip, contract, rate: percent(contract, rows.length) };
      })
      .sort((a, b) => b.contract - a.contract || b.vip - a.vip || b.count - a.count)
      .slice(0, 7);
  }, [notesByContact, selectedMonth, visibleContacts]);

  const gradeRows = useMemo(() => {
    const groups = new Map<string, ContactRow[]>();
    vipContacts.forEach((contact) => {
      const key = contact.customer_grade || "심사미진행";
      const list = groups.get(key) || [];
      list.push(contact);
      groups.set(key, list);
    });

    const rows = Array.from(groups.entries()).map(([grade, rows]) => {
      const contracts = rows.filter(isContracted).length;
      const priority = normalizeText(grade).includes(normalizeText("마스터"))
        ? 1
        : normalizeText(grade).includes(normalizeText("챌린저"))
          ? 2
          : normalizeText(grade).includes(normalizeText("브론즈"))
            ? 3
            : 9;
      return { grade, count: rows.length, contracts, rate: percent(contracts, rows.length), priority };
    });

    return rows
      .sort((a, b) => a.priority - b.priority || b.rate - a.rate || b.count - a.count)
      .slice(0, 6);
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
      { label: "브론즈 DB", value: stats.bronzeThisMonth, goal: 0, unit: "명", tone: "success" as ToneName },
      { label: "완판트럭 DB", value: monthContacts.filter((contact) => normalizeText(contact.intake_route).includes(normalizeText("완판트럭"))).length, goal: Number(target?.wanpan_truck_count || 0), unit: "건", tone: "cyan" as ToneName },
    ];
  }, [kpiTarget, monthContacts, stats]);

  const selectedMonthLabel = MONTH_LABEL_FORMAT.format(getMonthWindow(selectedMonth).start);
  const dashboardScopeLabel = activeOwner === "전체" ? "팀 전체" : `${activeOwner} 담당자`;

  return (
    <div className="premium-page h-full overflow-y-auto">
      <div className="premium-shell px-5 py-5 md:px-7 md:py-6">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="purple" icon={Sparkles}>당월 영업 지휘센터</Badge>
              <Badge tone={fixedOwner ? "success" : "info"} icon={UserCheck}>{dashboardScopeLabel}</Badge>
              <Badge tone="muted" icon={CalendarDays}>{selectedMonthLabel}</Badge>
            </div>
            <h1 className="crm-title">대시보드</h1>
            <p className="crm-subtitle mt-1">
              고객DB → 첫접촉 → VIP 이관/브론즈 등록 → 파이프라인 → 계약/리텐션 → 매출/KPI 흐름을 한 화면에서 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="고객명, 연락처, 메모 검색"
                className="crm-search w-full pl-9 pr-3"
              />
            </div>

            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="crm-search w-[150px] px-3">
              {monthOptions().map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>

            <select
              value={activeOwner}
              disabled={fixedOwner}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="crm-search w-[150px] px-3 disabled:opacity-70"
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
          <div className="mb-4 rounded-[16px] border px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-text)" }}>
            {errorMessage}
          </div>
        )}

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <MetricCard title="당월 신규DB" value={monthContacts.length} sub={`첫 접촉 ${stats.firstTouch}명 · ${percent(stats.firstTouch, monthContacts.length)}%`} icon={Database} tone="info" href="/customer-db" />
          <MetricCard title="VIP 이관" value={stats.vipThisMonth} sub={`현재 VIP ${stats.currentPipelineTotal}명`} icon={ShieldCheck} tone="purple" href="/contacts" />
          <MetricCard title="핵심등급DB" value={stats.coreVip} sub={`마스터 ${stats.master} · 챌린저 ${stats.challenger}`} icon={Target} tone="warning" href="/pipeline3" />
          <MetricCard title="브론즈 등록DB" value={stats.bronze} sub={`당월 등록/변경 ${stats.bronzeThisMonth}명`} icon={UserCheck} tone="success" href="/pipeline3" />
          <MetricCard title="계약완료" value={stats.contracts} sub={`리텐션 ${stats.retention}명`} icon={BadgeCheck} tone="success" href="/pipeline3" />
          <MetricCard title="이탈/탈퇴" value={stats.churn} sub={`현재 이탈률 ${stats.churnRate}%`} icon={TrendingDown} tone="danger" href="/pipeline3" />
          <MetricCard title="당월 순매출" value={money(stats.totalSales)} sub={`환불 ${moneyFull(stats.refund)}`} icon={CircleDollarSign} tone="cyan" href="/sales" />
          <MetricCard title="광고특전" value={money(stats.lmsSales + stats.hogangSales)} sub={`LMS ${money(stats.lmsSales)} · 호갱노노 ${money(stats.hogangSales)}`} icon={Zap} tone="purple" href="/sales" />
        </section>

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center">
            <Loader2 className="animate-spin" size={32} style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          <div className="grid gap-5 2xl:grid-cols-[1.22fr_.78fr]">
            <div className="space-y-5">
              <Panel>
                <PanelTitle icon={LineChart} tone="info" title="당월 영업 퍼널" desc="신규DB/첫접촉은 사전 구간으로 분리하고, 실제 영업퍼널은 리드·프로스펙팅·클로징·리텐션 기준으로 봅니다." right={<Badge tone="muted">{selectedMonthLabel}</Badge>} />
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
                    <div className="xl:col-span-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>사전 DB 구간</p>
                        <Badge tone="cyan">신규 · 첫접촉</Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {acquisitionRows.map((row) => (
                          <div key={row.label} className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <Badge tone={row.tone}>{row.label}</Badge>
                              <span className="text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>{row.label === "첫접촉완료" ? `${percent(row.value, monthContacts.length)}%` : "기준DB"}</span>
                            </div>
                            <p className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{row.value.toLocaleString()}</p>
                            <p className="mt-2 text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{row.sub}</p>
                            <div className="mt-4"><ProgressBar value={row.value} total={row.label === "첫접촉완료" ? Math.max(monthContacts.length, 1) : Math.max(row.value, 1)} tone={row.tone} /></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="xl:col-span-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>VIP 이관/등급화 구간</p>
                        <Badge tone="success">브론즈 포함</Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {vipGradeSummaryRows.map((row) => (
                          <div key={row.label} className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                            <Badge tone={row.tone}>{row.label}</Badge>
                            <p className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{row.value.toLocaleString()}</p>
                            <p className="mt-2 text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{row.sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[18px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>파이프라인 본 구간</p>
                        <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>숫자 순번 표기를 제거하고 CRM 파이프라인 단계명으로만 구분합니다.</p>
                      </div>
                      <Badge tone="purple">리드 → 프로스펙팅 → 클로징 → 리텐션</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      {pipelineRows.map((row, index) => {
                        const previous = index === 0 ? stats.currentPipelineTotal : pipelineRows[index - 1]?.value || 0;
                        const rate = percent(row.value, Math.max(previous, 1));
                        return (
                          <div key={row.label} className="rounded-[16px] border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <Badge tone={row.tone}>{row.label}</Badge>
                              <span className="text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>{index === 0 ? `${percent(row.value, Math.max(stats.currentPipelineTotal, 1))}%` : `${rate}%`}</span>
                            </div>
                            <p className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{row.value.toLocaleString()}</p>
                            <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>{row.sub}</p>
                            <div className="mt-4"><ProgressBar value={row.value} total={index === 0 ? Math.max(stats.currentPipelineTotal, 1) : Math.max(previous, 1)} tone={row.tone} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={Users} tone="purple" title="담당자별 파이프라인 현황" desc="가로 스크롤 없이 담당자별 신규DB·VIP·파이프라인·계약·매출을 한 화면에서 확인합니다." right={<Badge tone="info" icon={Filter}>관리자 뷰</Badge>} />
                <div className="grid gap-3 p-4">
                  {teamRows.map((row) => (
                    <div key={row.owner} className="rounded-[16px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="grid items-center gap-3 xl:grid-cols-[120px_repeat(8,minmax(0,1fr))]">
                        <div className="min-w-0">
                          <Badge tone={normalizePersonName(row.owner) === normalizePersonName(activeOwner) ? "purple" : "muted"} icon={UserCheck}>{row.owner}</Badge>
                        </div>
                        {[
                          { label: "신규", value: row.db, tone: "info" as ToneName },
                          { label: "VIP", value: row.vip, tone: "purple" as ToneName },
                          { label: "리드", value: row.lead, tone: "info" as ToneName },
                          { label: "프로스펙팅", value: row.prospect, tone: "purple" as ToneName },
                          { label: "클로징", value: row.closing, tone: "warning" as ToneName },
                          { label: "계약", value: row.contracts, tone: "success" as ToneName },
                          { label: "이탈", value: row.churn, tone: "danger" as ToneName },
                          { label: "매출", value: money(row.sales), tone: "cyan" as ToneName },
                        ].map((item) => (
                          <div key={`${row.owner}-${item.label}`} className="min-w-0 rounded-[12px] px-2 py-2 text-center" style={{ background: "var(--surface-1)" }}>
                            <p className="truncate text-[10px] font-semibold" style={{ color: toneStyle(item.tone).text }}>{item.label}</p>
                            <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid items-stretch gap-5 xl:grid-cols-[.95fr_1.05fr]">
                <Panel className="h-full">
                  <PanelTitle icon={Target} tone="warning" title="KPI 목표 대비 달성률" desc="가로로 길게 늘어지지 않도록 카드형으로 재정렬" right={<a href="/kpi-settings" className="btn-premium btn-secondary">KPI 설정</a>} />
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {kpiRows.map((row) => {
                      const hasGoal = row.goal > 0;
                      return (
                        <div key={row.label} className="rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="truncate text-[12px] font-semibold" style={{ color: "var(--text)" }}>{row.label}</p>
                            <Badge tone={row.tone}>{hasGoal ? `${percent(row.value, row.goal)}%` : "집계"}</Badge>
                          </div>
                          <p className="truncate text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>{row.money ? moneyFull(row.value) : `${row.value.toLocaleString()}${row.unit}`}</p>
                          <p className="mt-1 truncate text-[11px] font-medium" style={{ color: "var(--text-subtle)" }}>목표 {hasGoal ? (row.money ? moneyFull(row.goal) : `${row.goal.toLocaleString()}${row.unit}`) : "미설정"}</p>
                          <div className="mt-3"><ProgressBar value={row.value} total={hasGoal ? row.goal : Math.max(row.value, 1)} tone={row.tone} /></div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel className="h-full">
                  <PanelTitle icon={BarChart3} tone="cyan" title="매출 구성" desc="통합매출관리 기준 당월 순매출" right={<a href="/sales" className="btn-premium btn-secondary">매출관리</a>} />
                  <div className="space-y-4 p-4">
                    {[
                      { label: "분양회 월회비", value: stats.membershipSales, tone: "warning" as ToneName },
                      { label: "LMS", value: stats.lmsSales, tone: "info" as ToneName },
                      { label: "호갱노노", value: stats.hogangSales, tone: "purple" as ToneName },
                      { label: "연계매출", value: stats.linkedSales, tone: "success" as ToneName },
                      { label: "기타/별도입금", value: stats.otherSales, tone: "muted" as ToneName },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-semibold">
                          <span style={{ color: "var(--text)" }}>{item.label}</span>
                          <span style={{ color: "var(--text-strong)" }}>{moneyFull(item.value)}</span>
                        </div>
                        <ProgressBar value={item.value} total={Math.max(stats.totalSales, 1)} tone={item.tone} />
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="grid items-stretch gap-5 xl:grid-cols-[1.15fr_.85fr]">
                <Panel className="h-full">
                  <PanelTitle icon={TrendingUp} tone="success" title="유입경로별 성과" desc="글자 간격을 줄이고 DB→VIP→계약 흐름만 명확하게 표시" />
                  <div className="p-4">
                    {intakeRows.length === 0 ? <EmptyBlock title="유입경로 데이터가 없습니다" desc="고객DB에 유입경로가 입력되면 자동 집계됩니다." /> : (
                      <div className="space-y-3">
                        {intakeRows.map((row) => (
                          <div key={row.route} className="rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{row.route}</p>
                              <Badge tone={row.rate >= 20 ? "success" : row.rate >= 8 ? "warning" : "muted"}>{row.rate}% 계약</Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-[12px] font-semibold">
                              <div className="rounded-[10px] py-2" style={{ background: "var(--surface-1)" }}><p style={{ color: "var(--text-subtle)" }}>DB</p><p style={{ color: "var(--text-strong)" }}>{row.count}</p></div>
                              <div className="rounded-[10px] py-2" style={{ background: "var(--surface-1)" }}><p style={{ color: "var(--text-subtle)" }}>첫접촉</p><p style={{ color: "var(--text-strong)" }}>{row.firstTouch}</p></div>
                              <div className="rounded-[10px] py-2" style={{ background: "var(--surface-1)" }}><p style={{ color: "var(--text-subtle)" }}>VIP</p><p style={{ color: "var(--text-strong)" }}>{row.vip}</p></div>
                              <div className="rounded-[10px] py-2" style={{ background: "var(--surface-1)" }}><p style={{ color: "var(--text-subtle)" }}>계약</p><p style={{ color: "var(--success-text)" }}>{row.contract}</p></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel className="h-full">
                  <PanelTitle icon={Activity} tone="purple" title="자동등급별 계약전환율" desc="마스터·챌린저·브론즈를 세로형으로 비교" />
                  <div className="space-y-3 p-4">
                    {gradeRows.length === 0 ? <EmptyBlock title="등급 데이터가 없습니다" desc="VIP활동DB에서 고객등급을 판정하면 여기에 표시됩니다." /> : gradeRows.map((row) => (
                      <div key={row.grade} className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <Badge tone={isGradeContact({ customer_grade: row.grade } as ContactRow, "브론즈") ? "success" : isHighValueContact({ customer_grade: row.grade } as ContactRow) ? "warning" : "muted"}>{row.grade}</Badge>
                          <span className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{row.contracts}/{row.count}명</span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-[28px] font-semibold leading-none tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{row.rate}%</p>
                            <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>계약전환율</p>
                          </div>
                          <div className="w-[52%]"><ProgressBar value={row.contracts} total={row.count} tone={row.rate >= 20 ? "success" : row.priority <= 3 ? "warning" : "purple"} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>

            <div className="space-y-5">
              <Panel>
                <PanelTitle icon={AlertTriangle} tone="danger" title="오늘 챙겨야 할 고객" desc="D-DAY, 장기미활동, 클로징 지연, 결제정보 누락" right={<Badge tone="danger">{actionItems.length}건</Badge>} />
                <div className="max-h-[560px] overflow-y-auto p-2">
                  {actionItems.length === 0 ? <EmptyBlock title="오늘 긴급 관리 고객이 없습니다" desc="결제 D-DAY 또는 장기미활동 고객이 생기면 이곳에 표시됩니다." /> : actionItems.map((item) => (
                    <a key={item.key} href={item.href} className="flex gap-3 rounded-[15px] p-3 transition-all hover:bg-white/[.04]">
                      <IconBox icon={item.tone === "danger" ? AlertTriangle : item.tone === "purple" ? Target : CalendarClock} tone={item.tone} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge tone={item.tone}>{item.type}</Badge>
                          <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>{item.title}</p>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{item.desc}</p>
                      </div>
                      <ChevronRight size={14} style={{ color: "var(--text-faint)" }} />
                    </a>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={CalendarClock} tone="warning" title="자동이체 결제 D-DAY" desc="계약/리텐션 고객의 다음 결제일 기준" right={<a href="/pipeline3" className="btn-premium btn-secondary">파이프라인</a>} />
                <div className="max-h-[430px] overflow-y-auto p-2">
                  {paymentDdays.length === 0 ? <EmptyBlock title="결제일 등록 고객이 없습니다" desc="계약전환 시 결제채널과 결제일을 입력하면 자동으로 계산됩니다." /> : paymentDdays.map(({ contact, day, diff, due }) => (
                    <a key={contact.id} href="/pipeline3" className="flex items-center gap-3 rounded-[15px] p-3 transition-all hover:bg-white/[.04]">
                      <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-[14px]" style={{ background: diff <= 4 ? "var(--warning-bg)" : "var(--surface-3)", color: diff <= 4 ? "var(--warning-text)" : "var(--text-subtle)", border: `1px solid ${diff <= 4 ? "var(--warning-border)" : "var(--border)"}` }}>
                        <span className="text-[11px] font-semibold">{ddayLabel(diff)}</span>
                        <span className="text-[10px] font-medium">{formatDate(toDateKey(due))}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>{contact.name || "고객명 없음"}</p>
                        <p className="mt-1 truncate text-[12px] font-medium" style={{ color: "var(--text-subtle)" }}>{contact.payment_channel || "결제채널 미입력"} · 매월 {day}일</p>
                      </div>
                      <Badge tone={diff <= 4 ? "warning" : "muted"}>{contactOwner(contact)}</Badge>
                    </a>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={PhoneCall} tone="info" title="활동량 요약" desc="당월 첫 접촉과 활동노트 기준" />
                <div className="grid grid-cols-2 gap-3 p-4">
                  <div className="rounded-[15px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <IconBox icon={MessageCircle} tone="info" size="sm" />
                    <p className="mt-4 text-[24px] font-semibold leading-none" style={{ color: "var(--text-strong)" }}>{stats.firstTouch}</p>
                    <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>첫 접촉 완료</p>
                  </div>
                  <div className="rounded-[15px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <IconBox icon={FileText} tone="purple" size="sm" />
                    <p className="mt-4 text-[24px] font-semibold leading-none" style={{ color: "var(--text-strong)" }}>{monthNotes.length}</p>
                    <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>활동노트</p>
                  </div>
                  <div className="col-span-2 rounded-[15px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>첫 접촉률</p>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>{percent(stats.firstTouch, monthContacts.length)}%</p>
                    </div>
                    <ProgressBar value={stats.firstTouch} total={monthContacts.length} tone="cyan" />
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelTitle icon={Clock3} tone="muted" title="최근 활동노트" desc="녹취 요약 및 수동 기록" />
                <div className="max-h-[430px] overflow-y-auto p-2">
                  {monthNotes.length === 0 ? <EmptyBlock title="당월 활동노트가 없습니다" desc="고객 상세 또는 녹취 요약을 통해 활동노트가 쌓이면 표시됩니다." /> : monthNotes.slice(0, 8).map((note) => {
                    const contact = visibleContacts.find((row) => String(row.id) === String(note.contact_id));
                    return (
                      <a key={note.id} href="/contacts" className="flex gap-3 rounded-[15px] p-3 transition-all hover:bg-white/[.04]">
                        <IconBox icon={Activity} tone="purple" size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>{contact?.name || `고객 #${note.contact_id}`}</p>
                            <span className="shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>{timeAgo(note.created_at || note.note_date)}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{note.content || "활동노트 내용 없음"}</p>
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
    </div>
  );
}
