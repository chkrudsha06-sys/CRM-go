"use client";

import { getCurrentUser, type CRMUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Loader2,
  PhoneCall,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type ExecName = "조계현" | "이세호" | "기여운" | "최연전";

type ContactRow = Record<string, any> & {
  id: number;
  name?: string | null;
  title?: string | null;
  phone?: string | null;
  company?: string | null;
  assigned_to?: string | null;
  consultant?: string | null;
  activity_type?: string | null;
  crm_db_source?: string | null;
  customer_grade?: string | null;
  management_stage?: string | null;
  intake_route?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ContactNoteRow = Record<string, any> & {
  id: number;
  contact_id?: number | null;
  note_date?: string | null;
  content?: string | null;
  author?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkItem = {
  id?: string;
  text?: string;
  done?: boolean;
};

type DailyActivityRow = Record<string, any> & {
  id?: number;
  work_date?: string | null;
  owner_name?: string | null;
  owner_title?: string | null;
  owner_role?: string | null;
  is_outside_meeting?: boolean | null;
  goal_consultant_db?: number | null;
  goal_second_touch?: number | null;
  goal_new_tm?: number | null;
  goal_manage_tm?: number | null;
  goal_coldtalk?: number | null;
  goal_media_mix?: number | null;
  goal_meeting_confirmed?: number | null;
  goal_work_items?: WorkItem[] | null;
  result_consultant_db?: number | null;
  result_second_touch?: number | null;
  result_new_tm?: number | null;
  result_manage_tm?: number | null;
  result_coldtalk?: number | null;
  result_media_mix?: number | null;
  result_meeting_confirmed?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OwnerSummary = {
  owner: ExecName;
  title: string;
  newContacts: ContactRow[];
  newTmContacts: ContactRow[];
  newBronzeContacts: ContactRow[];
  newOnePercentContacts: ContactRow[];
  notes: Array<ContactNoteRow & { contact?: ContactRow }>;
  tmNotes: Array<ContactNoteRow & { contact?: ContactRow }>;
  pipelineNotes: Array<ContactNoteRow & { contact?: ContactRow }>;
  customerDbNotes: Array<ContactNoteRow & { contact?: ContactRow }>;
  noteContactNames: string[];
  dailyRow?: DailyActivityRow;
  specialItems: Required<WorkItem>[];
  specialDoneItems: Required<WorkItem>[];
  goalTotal: number;
  resultTotal: number;
  achievementRate: number;
};

const EXEC_MEMBERS: Array<{ name: ExecName; title: string }> = [
  { name: "조계현", title: "어쏘" },
  { name: "이세호", title: "어쏘" },
  { name: "기여운", title: "어쏘" },
  { name: "최연전", title: "CX" },
];
const EXEC_NAMES = EXEC_MEMBERS.map((member) => member.name) as ExecName[];
const ADMIN_NAMES = ["문시욱", "김정후", "김창완", "최웅"];
const CONTACT_SELECT =
  "id,name,title,phone,company,intake_route,assigned_to,consultant,activity_type,crm_db_source,customer_grade,management_stage,created_at,updated_at";
const NOTE_SELECT = "id,contact_id,note_date,content,author,created_at,updated_at";

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function nextDateString(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatKoreanDate(dateText: string) {
  if (!dateText) return "-";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;
}

function timeLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function n(value: unknown) {
  return Number(value || 0);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(999, Math.round(value)));
}

function percent(result: number, goal: number) {
  if (!goal) return result > 0 ? 100 : 0;
  return clampPercent((result / goal) * 100);
}

function contactOwner(row?: ContactRow | null): ExecName | null {
  const assigned = normalize(row?.assigned_to);
  const consultant = normalize(row?.consultant);
  const found = EXEC_NAMES.find((name) => assigned === name || consultant === name);
  return found || null;
}

function isDateInDay(value: string | null | undefined, dateText: string) {
  if (!value) return false;
  return String(value).slice(0, 10) === dateText;
}

function isTmContent(note: ContactNoteRow) {
  const content = normalize(note.content);
  const author = normalize(note.author);
  return (
    content.startsWith("[TM]") ||
    content.includes("활동항목: TM") ||
    content.includes("TM 활동") ||
    author.includes("AI 통화요약")
  );
}

function sourceLabel(contact?: ContactRow) {
  const source = normalize(contact?.crm_db_source);
  if (source === "vip_activity") return "파이프라인";
  if (source === "customer_db") return "고객DB";
  return source || "기타";
}

function displayCustomerName(row?: ContactRow | null) {
  if (!row) return "고객명 없음";
  const name = normalize(row.name) || "고객명 없음";
  const title = normalize(row.title);
  return title ? `${name} ${title}` : name;
}

function noteDateOf(note: ContactNoteRow) {
  return normalize(note.note_date) || normalize(note.created_at).slice(0, 10) || "-";
}

function mergeById<T extends { id?: number | string | null }>(items: T[]) {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const id = item?.id == null ? `${map.size}-${Math.random()}` : String(item.id);
    map.set(id, item);
  });
  return Array.from(map.values());
}

function normalizeWorkItems(value: unknown): Required<WorkItem>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const data = (item || {}) as WorkItem;
      return {
        id: normalize(data.id) || `work-${index}`,
        text: normalize(data.text),
        done: Boolean(data.done),
      };
    })
    .filter((item) => item.text.length > 0);
}

function goalValue(row: DailyActivityRow | undefined, key: string) {
  return n(row?.[`goal_${key}`]);
}

function isBronzeVip(contact: ContactRow) {
  return normalize(contact.crm_db_source) === "vip_activity" && normalize(contact.customer_grade) === "브론즈";
}

function isOnePercentVip(contact: ContactRow) {
  const grade = normalize(contact.customer_grade);
  return normalize(contact.crm_db_source) === "vip_activity" && (grade === "마스터" || grade === "챌린저");
}

function isAdminUser(user: CRMUser | null) {
  if (!user) return false;
  return user.role === "admin" || ADMIN_NAMES.includes(user.name);
}

function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "purple" | "cyan" }) {
  const styles: Record<string, { background: string; borderColor: string; color: string }> = {
    default: { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-subtle)" },
    success: { background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" },
    warning: { background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" },
    purple: { background: "var(--purple-bg)", borderColor: "var(--purple-border)", color: "var(--purple-text)" },
    cyan: { background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--info-text)" },
  };

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-[650]"
      style={styles[tone]}
    >
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone = "default" }: { icon: any; label: string; value: string | number; sub?: string; tone?: "default" | "success" | "warning" | "purple" | "cyan" }) {
  const toneStyle: Record<string, { bg: string; border: string; color: string }> = {
    default: { bg: "var(--surface-2)", border: "var(--border)", color: "var(--accent-text)" },
    success: { bg: "var(--success-bg)", border: "var(--success-border)", color: "var(--success-text)" },
    warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", color: "var(--warning-text)" },
    purple: { bg: "var(--purple-bg)", border: "var(--purple-border)", color: "var(--purple-text)" },
    cyan: { bg: "var(--info-bg)", border: "var(--info-border)", color: "var(--info-text)" },
  };
  const style = toneStyle[tone];

  return (
    <article className="premium-card flex h-[92px] items-center gap-4 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border" style={{ background: style.bg, borderColor: style.border, color: style.color }}>
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p className="mt-1 truncate text-[24px] font-[760] tracking-[-0.055em]" style={{ color: "var(--text)" }}>{value}</p>
        {sub ? <p className="crm-tiny mt-1 truncate">{sub}</p> : null}
      </div>
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: value >= 100 ? "var(--success)" : "var(--accent)" }} />
    </div>
  );
}

function EmptyList({ text }: { text: string }) {
  return <p className="rounded-[12px] border px-3 py-3 text-center text-[13px]" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-faint)" }}>{text}</p>;
}

export default function CrmActivityPage() {
  const [user, setUser] = useState<CRMUser | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [notes, setNotes] = useState<Array<ContactNoteRow & { contact?: ContactRow }>>([]);
  const [dailyRows, setDailyRows] = useState<DailyActivityRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setLoadError(null);

    try {
      const start = `${selectedDate}T00:00:00`;
      const end = `${nextDateString(selectedDate)}T00:00:00`;

      const [assignedResult, consultantResult, dailyResult] = await Promise.all([
        supabase
          .from("contacts")
          .select(CONTACT_SELECT)
          .in("assigned_to", EXEC_NAMES)
          .order("created_at", { ascending: false })
          .limit(12000),
        supabase
          .from("contacts")
          .select(CONTACT_SELECT)
          .in("consultant", EXEC_NAMES)
          .order("created_at", { ascending: false })
          .limit(12000),
        supabase.from("daily_activity_goals").select("*").eq("work_date", selectedDate),
      ]);

      if (assignedResult.error) throw assignedResult.error;
      if (consultantResult.error) throw consultantResult.error;
      if (dailyResult.error) throw dailyResult.error;

      const mergedContacts = mergeById<ContactRow>([
        ...((assignedResult.data || []) as ContactRow[]),
        ...((consultantResult.data || []) as ContactRow[]),
      ]).filter((row) => Boolean(contactOwner(row)));

      const contactMap = new Map<number, ContactRow>();
      mergedContacts.forEach((row) => contactMap.set(Number(row.id), row));
      const contactIds = Array.from(contactMap.keys()).filter(Boolean);

      let mergedNotes: Array<ContactNoteRow & { contact?: ContactRow }> = [];
      if (contactIds.length > 0) {
        const [noteDateResult, createdAtResult] = await Promise.all([
          supabase
            .from("contact_notes")
            .select(NOTE_SELECT)
            .in("contact_id", contactIds)
            .eq("note_date", selectedDate)
            .order("created_at", { ascending: false })
            .limit(6000),
          supabase
            .from("contact_notes")
            .select(NOTE_SELECT)
            .in("contact_id", contactIds)
            .gte("created_at", start)
            .lt("created_at", end)
            .order("created_at", { ascending: false })
            .limit(6000),
        ]);

        if (noteDateResult.error) throw noteDateResult.error;
        if (createdAtResult.error) throw createdAtResult.error;

        mergedNotes = mergeById<ContactNoteRow>([
          ...((noteDateResult.data || []) as ContactNoteRow[]),
          ...((createdAtResult.data || []) as ContactNoteRow[]),
        ])
          .map((note) => ({ ...note, contact: contactMap.get(Number(note.contact_id || 0)) }))
          .filter((note) => Boolean(note.contact && contactOwner(note.contact)))
          .filter((note) => isDateInDay(note.note_date, selectedDate) || isDateInDay(note.created_at, selectedDate));
      }

      setContacts(mergedContacts);
      setNotes(mergedNotes);
      setDailyRows((dailyResult.data || []) as DailyActivityRow[]);
    } catch (error: any) {
      console.warn("CRM 활동내역 로드 실패", error);
      setLoadError(error?.message || "CRM 활동내역을 불러오지 못했습니다.");
      setContacts([]);
      setNotes([]);
      setDailyRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`crm-activity-${selectedDate}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_notes" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_activity_goals" }, () => void fetchData(true))
      .subscribe();

    const timer = window.setInterval(() => void fetchData(true), 30000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [fetchData, selectedDate]);

  const summaries = useMemo<OwnerSummary[]>(() => {
    const dailyMap = new Map<string, DailyActivityRow>();
    dailyRows.forEach((row) => {
      if (row.owner_name) dailyMap.set(row.owner_name, row);
    });

    return EXEC_MEMBERS.map((member) => {
      const ownerContacts = contacts.filter((contact) => contactOwner(contact) === member.name);
      const newContacts = ownerContacts.filter((contact) => isDateInDay(contact.created_at, selectedDate));
      const ownerNotes = notes.filter((note) => contactOwner(note.contact) === member.name);
      const tmNotes = ownerNotes.filter(isTmContent);
      const pipelineNotes = ownerNotes.filter((note) => normalize(note.contact?.crm_db_source) === "vip_activity");
      const customerDbNotes = ownerNotes.filter((note) => normalize(note.contact?.crm_db_source) === "customer_db");
      const noteContactNames = Array.from(new Set(ownerNotes.map((note) => displayCustomerName(note.contact)))).filter(Boolean);
      const dailyRow = dailyMap.get(member.name);
      const specialItems = normalizeWorkItems(dailyRow?.goal_work_items);
      const specialDoneItems = specialItems.filter((item) => item.done);
      const newTmContacts = newContacts.filter((contact) => normalize(contact.activity_type) === "TM");
      const newBronzeContacts = newContacts.filter(isBronzeVip);
      const newOnePercentContacts = newContacts.filter(isOnePercentVip);

      const activityGoal = dailyRow?.is_outside_meeting
        ? 0
        : goalValue(dailyRow, "new_tm") + goalValue(dailyRow, "consultant_db") + goalValue(dailyRow, "second_touch");
      const activityResult = dailyRow?.is_outside_meeting
        ? 0
        : newTmContacts.length + newBronzeContacts.length + newOnePercentContacts.length;
      const goalTotal = activityGoal + specialItems.length;
      const resultTotal = activityResult + specialDoneItems.length;
      const achievementRate = dailyRow?.is_outside_meeting ? 100 : percent(resultTotal, goalTotal);

      return {
        owner: member.name,
        title: member.title,
        newContacts,
        newTmContacts,
        newBronzeContacts,
        newOnePercentContacts,
        notes: ownerNotes,
        tmNotes,
        pipelineNotes,
        customerDbNotes,
        noteContactNames,
        dailyRow,
        specialItems,
        specialDoneItems,
        goalTotal,
        resultTotal,
        achievementRate,
      };
    });
  }, [contacts, notes, dailyRows, selectedDate]);

  const filteredSummaries = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((summary) => {
      const haystack = [
        summary.owner,
        summary.title,
        ...summary.newContacts.map(displayCustomerName),
        ...summary.noteContactNames,
        ...summary.notes.map((note) => `${note.content || ""} ${note.author || ""}`),
        ...summary.specialItems.map((item) => item.text),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [summaries, keyword]);

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, item) => {
        acc.newContacts += item.newContacts.length;
        acc.tmNotes += item.tmNotes.length;
        acc.noteContacts += item.noteContactNames.length;
        acc.pipelineNotes += item.pipelineNotes.length;
        acc.specialGoals += item.specialItems.length;
        acc.specialDone += item.specialDoneItems.length;
        acc.goalTotal += item.goalTotal;
        acc.resultTotal += item.resultTotal;
        return acc;
      },
      { newContacts: 0, tmNotes: 0, noteContacts: 0, pipelineNotes: 0, specialGoals: 0, specialDone: 0, goalTotal: 0, resultTotal: 0 },
    );
  }, [summaries]);

  const totalAchievement = totals.goalTotal ? percent(totals.resultTotal, totals.goalTotal) : 0;

  if (user && !isAdminUser(user)) {
    return (
      <main className="crm-modern-main min-h-screen px-5 py-6 md:px-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <section className="premium-card mx-auto max-w-2xl p-8 text-center">
          <ShieldIcon />
          <h1 className="mt-4 text-[24px] font-[780] tracking-[-0.05em]" style={{ color: "var(--text)" }}>관리자 전용 메뉴입니다</h1>
          <p className="crm-row-sub mt-2">CRM 활동내역은 관리자 계정에서만 확인할 수 있습니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="crm-modern-main min-h-screen px-4 py-5 md:px-8 md:py-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
        <section className="premium-card p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent-border)", color: "var(--accent-text)" }}>
                <Activity size={22} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[26px] font-[820] tracking-[-0.06em] md:text-[30px]" style={{ color: "var(--text)" }}>CRM 활동내역</h1>
                  <Chip tone="purple">관리자</Chip>
                  <Chip tone="cyan">실시간 집계</Chip>
                </div>
                <p className="crm-row-sub mt-1.5">실행파트 4명의 신규 DB, TM, 활동노트, 파이프라인 노트, 일별활동기록 달성률을 일자별로 확인합니다.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex h-11 items-center gap-2 rounded-[14px] border px-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-subtle)" }}>
                <CalendarDays size={16} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value || todayString())}
                  className="h-full bg-transparent text-[14px] font-[650] outline-none"
                  style={{ color: "var(--text)" }}
                />
              </label>
              <button type="button" onClick={() => void fetchData(false)} disabled={refreshing} className="btn-premium btn-primary h-11 px-4">
                {refreshing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                새로고침
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_260px]">
            <label className="flex h-11 items-center gap-2 rounded-[14px] border px-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              <Search size={16} style={{ color: "var(--text-faint)" }} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="담당자, 고객명, 활동노트, 특발성활동 검색"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                style={{ color: "var(--text)" }}
              />
            </label>
            <div className="flex items-center justify-center rounded-[14px] border px-3 text-[13px] font-[700]" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-subtle)" }}>
              기준일 · {formatKoreanDate(selectedDate)}
            </div>
          </div>
        </section>

        {loadError ? (
          <section className="premium-card border p-4" style={{ borderColor: "var(--danger-border)", background: "var(--danger-bg)", color: "var(--danger-text)" }}>
            {loadError}
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <StatCard icon={Database} label="신규 등록 DB" value={`${totals.newContacts.toLocaleString()}명`} sub="contacts.created_at 기준" tone="cyan" />
          <StatCard icon={PhoneCall} label="TM 활동노트" value={`${totals.tmNotes.toLocaleString()}건`} sub="[TM] 노트·통화요약 포함" tone="success" />
          <StatCard icon={Users} label="노트 기록 고객" value={`${totals.noteContacts.toLocaleString()}명`} sub="활동노트 고객 중복 제거" tone="purple" />
          <StatCard icon={FileText} label="파이프라인 노트" value={`${totals.pipelineNotes.toLocaleString()}건`} sub="VIP활동DB / 파이프라인 기준" tone="default" />
          <StatCard icon={Sparkles} label="특발성활동" value={`${totals.specialDone}/${totals.specialGoals}건`} sub="완료 / 등록 목표" tone="warning" />
          <StatCard icon={Target} label="목표 달성률" value={`${totalAchievement}%`} sub={`${totals.resultTotal}/${totals.goalTotal} 달성`} tone={totalAchievement >= 100 ? "success" : "default"} />
        </section>

        <section className="grid gap-4 2xl:grid-cols-4">
          {loading ? (
            <div className="premium-card col-span-full flex min-h-[320px] items-center justify-center gap-3 p-8" style={{ color: "var(--text-subtle)" }}>
              <Loader2 className="animate-spin" size={20} /> CRM 활동내역을 불러오는 중입니다.
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="premium-card col-span-full p-8 text-center">
              <p className="text-[18px] font-[760]" style={{ color: "var(--text)" }}>검색 결과가 없습니다.</p>
              <p className="crm-row-sub mt-2">검색어를 지우거나 다른 일자를 선택해 주세요.</p>
            </div>
          ) : (
            filteredSummaries.map((summary) => <OwnerActivityCard key={summary.owner} summary={summary} />)
          )}
        </section>
      </div>
    </main>
  );
}

function ShieldIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent-border)", color: "var(--accent-text)" }}>
      <ClipboardList size={24} />
    </div>
  );
}

function OwnerActivityCard({ summary }: { summary: OwnerSummary }) {
  const outside = Boolean(summary.dailyRow?.is_outside_meeting);
  const statusTone = outside ? "warning" : summary.achievementRate >= 100 ? "success" : summary.dailyRow ? "cyan" : "default";

  return (
    <article className="premium-card flex min-h-[620px] flex-col overflow-hidden p-0">
      <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="crm-avatar flex h-12 w-12 items-center justify-center rounded-[16px] text-[18px] font-[800]" style={{ background: "linear-gradient(135deg,#8b7cf6,#60a5fa)" }}>
              {summary.owner.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="text-[21px] font-[820] tracking-[-0.055em]" style={{ color: "var(--text)" }}>{summary.owner} <span className="text-[14px] font-[650]" style={{ color: "var(--text-subtle)" }}>{summary.title}</span></p>
              <p className="crm-tiny mt-1">{outside ? "외근/미팅 기록대상 제외" : summary.dailyRow ? "일별활동기록 입력됨" : "일별활동기록 미입력"}</p>
            </div>
          </div>
          <Chip tone={statusTone as any}>{outside ? "외근" : `${summary.achievementRate}%`}</Chip>
        </div>
        <ProgressBar value={summary.achievementRate} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniMetric label="목표" value={summary.goalTotal} />
          <MiniMetric label="달성" value={summary.resultTotal} />
          <MiniMetric label="특발성" value={`${summary.specialDoneItems.length}/${summary.specialItems.length}`} />
        </div>
      </div>

      <div className="grid gap-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <MetricBox icon={Database} label="신규 DB" value={`${summary.newContacts.length}명`} />
          <MetricBox icon={PhoneCall} label="TM 노트" value={`${summary.tmNotes.length}건`} />
          <MetricBox icon={Users} label="노트 고객" value={`${summary.noteContactNames.length}명`} />
          <MetricBox icon={FileText} label="파이프라인 노트" value={`${summary.pipelineNotes.length}건`} />
        </div>

        <DetailSection title="금일 신규 등록 고객" icon={Database} count={summary.newContacts.length}>
          {summary.newContacts.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {summary.newContacts.slice(0, 16).map((contact) => (
                <Chip key={contact.id} tone={normalize(contact.crm_db_source) === "vip_activity" ? "purple" : "cyan"}>{displayCustomerName(contact)}</Chip>
              ))}
              {summary.newContacts.length > 16 ? <Chip>+{summary.newContacts.length - 16}</Chip> : null}
            </div>
          ) : <EmptyList text="신규 등록 고객 없음" />}
        </DetailSection>

        <DetailSection title="활동노트 기록 고객" icon={Users} count={summary.noteContactNames.length}>
          {summary.noteContactNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {summary.noteContactNames.slice(0, 14).map((name) => <Chip key={name} tone="default">{name}</Chip>)}
              {summary.noteContactNames.length > 14 ? <Chip>+{summary.noteContactNames.length - 14}</Chip> : null}
            </div>
          ) : <EmptyList text="활동노트 기록 고객 없음" />}
        </DetailSection>

        <DetailSection title="특발성활동" icon={Sparkles} count={summary.specialDoneItems.length} sub={`목표 ${summary.specialItems.length}건`}>
          {summary.specialItems.length > 0 ? (
            <ol className="grid list-none gap-2 p-0">
              {summary.specialItems.map((item, index) => (
                <li key={item.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-[12px] border p-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-[800]" style={{ background: item.done ? "var(--success-bg)" : "var(--accent-subtle)", color: item.done ? "var(--success-text)" : "var(--accent-text)" }}>{index + 1}</span>
                  <span className={`text-[13px] font-[650] leading-[1.45] ${item.done ? "line-through" : ""}`} style={{ color: item.done ? "var(--text-faint)" : "var(--text)" }}>{item.text}</span>
                  {item.done ? <CheckCircle2 size={16} style={{ color: "var(--success-text)" }} /> : <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>대기</span>}
                </li>
              ))}
            </ol>
          ) : <EmptyList text="등록된 특발성활동 없음" />}
        </DetailSection>

        <DetailSection title="최근 활동노트" icon={FileText} count={summary.notes.length}>
          {summary.notes.length > 0 ? (
            <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {summary.notes.slice(0, 8).map((note) => (
                <div key={note.id} className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Chip tone={sourceLabel(note.contact) === "파이프라인" ? "purple" : "cyan"}>{sourceLabel(note.contact)}</Chip>
                      {isTmContent(note) ? <Chip tone="success">TM</Chip> : null}
                    </div>
                    <span className="crm-tiny">{noteDateOf(note)} · {timeLabel(note.created_at)}</span>
                  </div>
                  <p className="text-[13px] font-[750]" style={{ color: "var(--text)" }}>{displayCustomerName(note.contact)}</p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-[1.55]" style={{ color: "var(--text-subtle)" }}>{normalize(note.content).replace(/^\[(TM|콜드톡)\]\s*/g, "") || "내용 없음"}</p>
                </div>
              ))}
            </div>
          ) : <EmptyList text="당일 활동노트 없음" />}
        </DetailSection>
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[12px] border px-3 py-2 text-center" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <p className="crm-tiny">{label}</p>
      <p className="mt-1 text-[17px] font-[820]" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function MetricBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} style={{ color: "var(--accent-text)" }} />
        <span className="crm-tiny">{label}</span>
      </div>
      <p className="text-[20px] font-[820] tracking-[-0.045em]" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function DetailSection({ title, icon: Icon, count, sub, children }: { title: string; icon: any; count: number; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-[16px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: "var(--accent-text)" }} />
          <p className="text-[14px] font-[760]" style={{ color: "var(--text)" }}>{title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {sub ? <span className="crm-tiny">{sub}</span> : null}
          <Chip>{count.toLocaleString()}</Chip>
        </div>
      </div>
      {children}
    </section>
  );
}
