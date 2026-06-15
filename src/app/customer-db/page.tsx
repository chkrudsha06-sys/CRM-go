"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Edit3,
  FileText,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CustomerGradeAssessment from "@/components/CustomerGradeAssessment";
import {
  appendGradeAssessmentBlock,
  calculateCustomerGrade,
  EMPTY_GRADE_ASSESSMENT,
  MANAGEMENT_STAGE_OPTIONS,
  stripGradeAssessmentBlock,
  type GradeAssessmentForm,
} from "@/lib/customerGrade";

type ActivityType = "TM" | "콜드톡";

type CustomerDbNote = {
  id: number;
  noteDate: string;
  activityType: ActivityType;
  content: string;
  author: string;
  createdAt: string;
};

type RawCustomerRecord = {
  id: number;
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  assigned_to: string;
  activity_type: ActivityType;
  memo: string;
  notes: CustomerDbNote[];
  created_at: string;
  updated_at: string;
  sensitivity?: string;
  sensitivity_updated_at?: string;
};

type RawCustomerForm = {
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  activity_type: "" | ActivityType;
  memo: string;
  first_note: string;
};

type VipRecord = {
  id: number;
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  management_stage: string;
  customer_grade: string;
  memo: string;
  created_at: string;
  updated_at: string;
};

const RAW_DB_STORAGE_KEY = "crm_go_raw_customer_db_v1";
const VIP_DB_STORAGE_KEY = "crm_go_customer_db_local_v2";
const CUSTOMER_DB_SOURCE = "customer_db";
const VIP_DB_SOURCE = "vip_activity";
const DEFAULT_ASSIGNED_TO = "조계현";

function currentAssignedTo() {
  return getCurrentUser()?.name || DEFAULT_ASSIGNED_TO;
}
const INTAKE_ROUTES = [
  "분양의신DB",
  "컨설턴트VIP DB",
  "완판트럭",
  "분양라인",
  "분양회MGM",
  "대협팀활동",
];
const ACTIVITY_TYPES: ActivityType[] = ["TM", "콜드톡"];
const TITLE_OPTIONS = ["본부장", "팀장", "팀원"];

const EMPTY_FORM: RawCustomerForm = {
  name: "",
  title: "",
  phone: "",
  intake_route: "",
  company: "",
  activity_type: "",
  memo: "",
  first_note: "",
};

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function dateLabel(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function timeLabel(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}


function normalizePhoneDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function mergeVipRecordsByPhone(records: VipRecord[], nextRecord: VipRecord) {
  const nextPhone = normalizePhoneDigits(nextRecord.phone);
  const existingIndex = records.findIndex(
    (record) => normalizePhoneDigits(record.phone) === nextPhone,
  );

  if (existingIndex < 0) return [nextRecord, ...records];

  return records.map((record, index) =>
    index === existingIndex
      ? {
          ...record,
          ...nextRecord,
          id: record.id,
          created_at: record.created_at || nextRecord.created_at,
        }
      : record,
  );
}


type ContactPhoneRecord = {
  id: number;
  phone?: string | null;
  mobile?: string | null;
  contact_phone?: string | null;
  customer_phone?: string | null;
  tel?: string | null;
};

function buildContactMemo(record: RawCustomerRecord) {
  return stripGradeAssessmentBlock(record.memo).trim();
}

async function findContactIdByPhone(phone: string) {
  const phoneDigits = normalizePhoneDigits(phone);
  if (!phoneDigits) return null;

  const { data, error } = await supabase
    .from("contacts")
    .select("id, phone, mobile, contact_phone, customer_phone, tel")
    .limit(2000);

  if (error) throw error;

  const matched = (data || []).find((item: ContactPhoneRecord) => {
    const phones = [
      item.phone,
      item.mobile,
      item.contact_phone,
      item.customer_phone,
      item.tel,
    ];
    return phones.some((value) => normalizePhoneDigits(value) === phoneDigits);
  });

  return matched?.id || null;
}

// 한국 공휴일 목록 (연도별 고정 공휴일 + 주요 대체공휴일)
function getKoreanHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const add = (m: number, d: number) => holidays.add(`${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  // 고정 공휴일
  add(1,1); add(3,1); add(5,5); add(6,6); add(8,15);
  add(10,3); add(10,9); add(12,25);
  // 설날/추석은 음력 계산 필요하나 근사값으로 2026년 기준 포함
  // 2026년 설날: 2월 17~19일 / 추석: 10월 4~6일
  if (year === 2026) {
    add(2,16); add(2,17); add(2,18); add(2,19);
    add(5,5); add(5,6); // 어린이날 대체
    add(10,3); add(10,4); add(10,5); add(10,6);
  }
  if (year === 2027) {
    add(2,6); add(2,7); add(2,8); add(2,9);
    add(9,23); add(9,24); add(9,25); add(9,26);
  }
  return holidays;
}

function isWeekendOrHoliday(date: Date, holidays: Set<string>): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return true;
  const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  return holidays.has(key);
}

function addBusinessDays(startDateStr: string, days: number): string {
  const start = new Date(startDateStr + "T00:00:00");
  const holidays2026 = getKoreanHolidays(2026);
  const holidays2027 = getKoreanHolidays(2027);
  const getHolidays = (y: number) => y === 2027 ? holidays2027 : holidays2026;

  let count = 0;
  let current = new Date(start);
  while (count < days) {
    current.setDate(current.getDate() + 1);
    if (!isWeekendOrHoliday(current, getHolidays(current.getFullYear()))) {
      count++;
    }
  }
  return `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,"0")}-${String(current.getDate()).padStart(2,"0")}`;
}

function formatRetmDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일","월","화","수","목","금","토"];
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function buildContactMemoWithSensitivity(record: RawCustomerRecord): string {
  const baseMemo = stripGradeAssessmentBlock(record.memo || "")
    .replace(/\[고객감도:[^\]]*\]/g, "")
    .replace(/\[재TM일:[^\]]*\]/g, "")
    .trim();
  const sensitivity = record.sensitivity || "감도없음";
  const retmTag = sensitivity === "재TM진행" && record.sensitivity_updated_at
    ? `
[재TM일: ${record.sensitivity_updated_at}]`
    : "";
  return baseMemo
    ? `${baseMemo}

[고객감도: ${sensitivity}]${retmTag}`
    : `[고객감도: ${sensitivity}]${retmTag}`;
}

async function saveCustomerDbRecordToContacts(record: RawCustomerRecord) {
  const now = new Date().toISOString();
  const existingId = await findContactIdByPhone(record.phone);
  const payload = {
    name: record.name,
    title: record.title,
    phone: record.phone,
    customer_phone: record.phone,
    intake_route: record.intake_route,
    company: record.company || "-",
    management_stage: "리드",
    customer_grade: "심사미진행",
    memo: buildContactMemo(record),
    activity_type: record.activity_type,
    crm_db_source: CUSTOMER_DB_SOURCE,
    assigned_to: currentAssignedTo(),
    updated_at: now,
  };

  if (existingId) {
    const { error } = await supabase
      .from("contacts")
      .update(payload)
      .eq("id", existingId);
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...payload, created_at: record.created_at || now })
    .select("id")
    .single();

  if (error) throw error;
  return data?.id || null;
}

async function saveCustomerDbNoteToSupabase(contactId: number | null, note: CustomerDbNote) {
  if (!contactId) return;

  const cleanContent = String(note.content || "")
    .replace(/^\[(TM|콜드톡)\]\s*/g, "")
    .trim();

  if (!cleanContent) return;

  const author = note.author || "현재 사용자";
  const noteDate = note.noteDate || today();
  const typedContent = `[${note.activityType}] ${cleanContent}`;

  const { data: existing, error: findError } = await supabase
    .from("contact_notes")
    .select("id, content")
    .eq("contact_id", contactId)
    .eq("note_date", noteDate)
    .eq("author", author)
    .limit(100);

  if (findError) throw findError;

  const duplicated = (existing || []).some((item: any) => {
    const existingClean = String(item.content || "")
      .replace(/^\[(TM|콜드톡)\]\s*/g, "")
      .trim();
    return existingClean === cleanContent;
  });

  if (duplicated) return;

  const { error } = await supabase.from("contact_notes").insert({
    contact_id: contactId,
    note_date: noteDate,
    content: typedContent,
    author,
  });
  if (error) throw error;
}

function fmt(value?: string | null) {
  return value && value.trim() ? value : "-";
}

function badgeClass(value?: string | null) {
  if (value === "분양의신DB") return "badge-purple";
  if (value === "컨설턴트VIP DB") return "badge-info";
  if (value === "완판트럭") return "badge-warning";
  if (value === "분양라인") return "badge-cyan";
  if (value === "분양회MGM") return "badge-success";
  if (value === "대협팀활동") return "badge-info";
  if (value === "TM") return "badge-info";
  if (value === "콜드톡") return "badge-cyan";
  return "badge-muted";
}

function readJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function buildNoteMemo(notes: CustomerDbNote[]) {
  if (!notes.length) return "";
  return notes
    .map(
      (note) =>
        `[${note.activityType}] ${note.noteDate} ${timeLabel(note.createdAt)}\n${note.content.trim()}\n- ${note.author}`,
    )
    .join("\n\n");
}

function normalizeRawRecord(record: Partial<RawCustomerRecord>): RawCustomerRecord {
  return {
    id: Number(record.id || Date.now()),
    name: String(record.name || ""),
    title: String(record.title || ""),
    phone: String(record.phone || ""),
    intake_route: INTAKE_ROUTES.includes(String(record.intake_route || ""))
      ? String(record.intake_route)
      : INTAKE_ROUTES[0],
    company: String(record.company || ""),
    assigned_to: String((record as any).assigned_to || currentAssignedTo()),
    activity_type:
      record.activity_type === "콜드톡" || record.activity_type === "TM"
        ? record.activity_type
        : "TM",
    memo: stripGradeAssessmentBlock(String(record.memo || "")),
    sensitivity: (() => {
      const memoText = String(record.memo || "");
      const match = memoText.match(/\[고객감도:\s*(.+?)\]/);
      return match ? match[1].trim() : "감도없음";
    })(),
    sensitivity_updated_at: (() => {
      const memoText = String(record.memo || "");
      const match = memoText.match(/\[재TM일:\s*(.+?)\]/);
      return match ? match[1].trim() : String(record.updated_at || "").slice(0, 10);
    })(),
    notes: Array.isArray(record.notes) ? record.notes : [],
    created_at: String(record.created_at || new Date().toISOString()),
    updated_at: String(record.updated_at || new Date().toISOString()),
  };
}

function RouteSummaryCard({
  items,
  total,
}: {
  items: { label: string; value: number }[];
  total: number;
}) {
  const visibleItems = items.filter((item) => item.value > 0);
  const displayItems = visibleItems.length ? visibleItems : items.slice(0, 4);

  return (
    <div className="premium-card h-full p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="crm-card-title">유입경로별 현황</p>
          <p className="crm-tiny mt-1">전체 {total}건 기준</p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[12px] font-[650]"
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid var(--accent-border)",
            color: "var(--accent-text)",
          }}
        >
          {total}건
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {displayItems.map((item) => {
          const percent = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div
              key={item.label}
              className="rounded-[15px] border p-3"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="crm-row-main truncate">{item.label}</p>
                <p className="crm-row-sub shrink-0">{item.value}건</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percent}%`, background: "var(--accent)" }}
                />
              </div>
              <p className="crm-tiny mt-1 text-right">{percent}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivitySummaryCard({ tm, cold }: { tm: number; cold: number }) {
  return (
    <div className="premium-card h-full p-4 md:p-5">
      <div className="mb-4">
        <p className="crm-card-title">활동항목 현황</p>
        <p className="crm-tiny mt-1">TM과 콜드톡만 표시합니다.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border p-4 text-center" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}>
            <Phone size={17} />
          </div>
          <p className="crm-meta">TM</p>
          <p className="mt-1 text-[26px] font-[700] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{tm}건</p>
        </div>
        <div className="rounded-[18px] border p-4 text-center" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(14, 165, 233, 0.14)", color: "#38bdf8" }}>
            <MessageCircle size={17} />
          </div>
          <p className="crm-meta">콜드톡</p>
          <p className="mt-1 text-[26px] font-[700] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{cold}건</p>
        </div>
      </div>
    </div>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return <span className="crm-meta mb-2 block">{children}</span>;
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <InputLabel>{label}</InputLabel>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="crm-search h-11 w-full px-3"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
  placeholder = "선택",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <InputLabel>{label}</InputLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="crm-search h-11 w-full px-3"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActivityTypeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: ActivityType) => void;
}) {
  return (
    <div>
      <InputLabel>활동항목</InputLabel>
      <div className="grid grid-cols-2 gap-2">
        {ACTIVITY_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className="rounded-[13px] border px-3 py-3 text-[13px] font-[650] transition"
            style={{
              borderColor:
                value === type ? "var(--accent-border)" : "var(--border)",
              background:
                value === type ? "var(--accent-subtle)" : "var(--surface-2)",
              color: value === type ? "var(--accent-text)" : "var(--text)",
            }}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoteComposer({
  onAdd,
  defaultType,
  currentSensitivity,
  onSaveSensitivity,
}: {
  onAdd: (note: Omit<CustomerDbNote, "id" | "createdAt"> & { sensitivity?: string }) => void;
  defaultType: ActivityType;
  currentSensitivity?: string;
  onSaveSensitivity?: (sensitivity: string) => Promise<void>;
}) {
  const [noteDate, setNoteDate] = useState(today());
  const [activityType, setActivityType] = useState<ActivityType>(defaultType);
  const [content, setContent] = useState("");
  const [sensitivity, setSensitivity] = useState(currentSensitivity || "감도없음");
  const [savingSensitivity, setSavingSensitivity] = useState(false);

  useEffect(() => {
    setSensitivity(currentSensitivity || "감도없음");
  }, [currentSensitivity]);

  const handleAdd = () => {
    if (!content.trim()) return;
    onAdd({
      noteDate,
      activityType,
      content: content.trim(),
      author: "현재 사용자",
    });
    setContent("");
    setNoteDate(today());
  };

  const handleSaveSensitivity = async () => {
    if (!onSaveSensitivity) return;
    setSavingSensitivity(true);
    try {
      await onSaveSensitivity(sensitivity);
    } finally {
      setSavingSensitivity(false);
    }
  };

  const btnStyle = (active: boolean) => ({
    background: active ? "var(--accent-subtle)" : "var(--surface-2)",
    borderColor: active ? "var(--accent-border)" : "var(--border-subtle)",
    color: active ? "var(--accent-text)" : "var(--text-muted)",
    fontWeight: active ? 600 : 400,
  });

  return (
    <div className="space-y-1.5 rounded-[12px] border px-2.5 py-2" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px]" style={{ color: "var(--text-strong)", fontWeight: 600 }}>활동노트 작성</p>
        <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="h-7 rounded-[8px] border px-2 text-[11px] outline-none" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }} />
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>활동항목</p>
      <div className="grid grid-cols-2 gap-1.5">
        {(["TM", "콜드톡"] as ActivityType[]).map((type) => (
          <button key={type} type="button" onClick={() => setActivityType(type)} className="h-8 rounded-[8px] border text-[12px] transition-colors" style={btnStyle(activityType === type)}>
            {type}
          </button>
        ))}
      </div>

      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="활동 내용을 입력하세요." rows={2} className="min-h-[56px] w-full resize-none rounded-[10px] border px-2.5 py-2 text-[12px] leading-5 outline-none" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }} />

      <button type="button" onClick={handleAdd} className="btn-premium btn-primary h-8 w-full text-[12px]">
        <Plus size={13} /> 저장
      </button>

      <div className="border-t pt-1.5" style={{ borderColor: "var(--border-subtle)" }}>
        <p className="mb-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>고객감도</p>
        <div className="grid grid-cols-2 gap-1.5">
          {["감도없음", "재TM진행"].map((opt) => (
            <button key={opt} type="button" onClick={() => setSensitivity(opt)} className="h-8 rounded-[8px] border text-[12px] transition-colors" style={btnStyle(sensitivity === opt)}>
              {opt}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSaveSensitivity}
          disabled={savingSensitivity}
          className="btn-premium btn-secondary mt-1.5 h-8 w-full text-[12px]"
        >
          <Save size={12} /> {savingSensitivity ? "저장 중..." : "고객감도 저장"}
        </button>
      </div>
    </div>
  );
}

function NotesList({
  notes,
  onDelete,
}: {
  notes: CustomerDbNote[];
  onDelete?: (note: CustomerDbNote) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!notes.length) {
    return (
      <div
        className="rounded-[16px] border px-4 py-8 text-center"
        style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
      >
        <p className="crm-card-title">등록된 활동노트가 없습니다.</p>
        <p className="crm-tiny mt-1">TM 또는 콜드톡 활동 후 기록을 남겨주세요.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {notes.map((note) => {
        const isExpanded = expandedId === note.id;
        const preview = note.content.replace(/\s+/g, " ").trim();

        return (
          <article
            key={`${note.id}-${note.createdAt}`}
            className="overflow-hidden rounded-[13px] border"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <div className="flex w-full items-stretch justify-between gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : note.id)}
                className="min-w-0 flex-1 text-left transition hover:opacity-90"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-[700]"
                    style={{
                      background:
                        note.activityType === "TM"
                          ? "var(--accent-subtle)"
                          : "rgba(14, 165, 233, 0.12)",
                      border:
                        note.activityType === "TM"
                          ? "1px solid var(--accent-border)"
                          : "1px solid rgba(14, 165, 233, 0.28)",
                      color:
                        note.activityType === "TM"
                          ? "var(--accent-text)"
                          : "#0284c7",
                    }}
                  >
                    {note.activityType}
                  </span>
                  <span className="text-[12px] font-[650]" style={{ color: "var(--text-muted)" }}>
                    {note.noteDate} · {timeLabel(note.createdAt)}
                  </span>
                  <span className="text-[11px] font-[650]" style={{ color: "var(--text-faint)" }}>
                    {note.author}
                  </span>
                </div>
                <p className="mt-1 truncate text-[12.5px] font-[500]" style={{ color: "var(--text-strong)" }}>
                  {preview || "내용 없음"}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : note.id)}
                  className="h-8 rounded-[9px] border px-2.5 text-[11px] font-[650]"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--accent-text)",
                  }}
                >
                  {isExpanded ? "닫기" : "보기"}
                </button>
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(note)}
                    className="h-8 rounded-[9px] border px-2.5 text-[11px] font-[650]"
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      borderColor: "rgba(239, 68, 68, 0.28)",
                      color: "#ef4444",
                    }}
                  >
                    삭제
                  </button>
                ) : null}
              </div>
            </div>

            {isExpanded ? (
              <div
                className="border-t px-3 py-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <p
                  className="whitespace-pre-wrap text-[12.5px] font-[700] leading-6"
                  style={{ color: "var(--text)" }}
                >
                  {note.content}
                </p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function MemoPreview({ memo }: { memo?: string | null }) {
  const [open, setOpen] = useState(false);
  const text = memo?.trim() || "등록된 메모가 없습니다.";

  return (
    <div className="rounded-[12px] border" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3 px-2.5 py-2">
        <p
          className={`${open ? "whitespace-pre-wrap" : "line-clamp-2"} memo-body-text text-[12.5px] leading-5`}
          style={{ color: memo?.trim() ? "var(--text)" : "var(--text-faint)" }}
        >
          {text}
        </p>
        {memo?.trim() ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 rounded-[8px] border px-2 py-1 text-[11px] font-[650]"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--accent-text)",
            }}
          >
            {open ? "닫기" : "보기"}
          </button>
        ) : null}
      </div>
    </div>
  );
}


function DetailBlock({
  label,
  value,
  badge = false,
}: {
  label: string;
  value?: string | number | null;
  badge?: boolean;
}) {
  const display = typeof value === "number" ? String(value) : fmt(value || "");

  return (
    <div
      className="rounded-[12px] border px-2.5 py-2"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <p className="crm-meta">{label}</p>
      {badge ? (
        <span className={`badge-premium mt-1 ${badgeClass(display)}`}>
          {display}
        </span>
      ) : (
        <p className="mt-1 truncate text-[13.5px] font-[650] leading-5" style={{ color: "var(--text-strong)" }}>{display}</p>
      )}
    </div>
  );
}

function TransferModal({
  customer,
  assessment,
  onAssessmentChange,
  managementStage,
  onManagementStageChange,
  onClose,
  onConfirm,
  error,
}: {
  customer: RawCustomerRecord;
  assessment: GradeAssessmentForm;
  onAssessmentChange: (value: GradeAssessmentForm) => void;
  managementStage: string;
  onManagementStageChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  error: string;
}) {
  const result = calculateCustomerGrade(assessment, customer.title);

  return (
    <div className="crm-modal-overlay z-[80] p-3 md:p-5">
      <div className="crm-modal flex max-h-[92vh] w-full max-w-[1180px] flex-col overflow-hidden p-0">
        <div
          className="shrink-0 px-5 py-5 md:px-6"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-[650]"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                  color: "var(--accent-text)",
                }}
              >
                <Sparkles size={14} /> VIP활동 DB 이관 심사
              </div>
              <h2 className="crm-title">{customer.name} 고객 심사 진행</h2>
              <p className="crm-subtitle mt-2">
                입력값이 없어도 판정 보류 등급으로 VIP활동DB 이관이 가능하며, 고객DB에서는 삭제됩니다.
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-premium btn-ghost h-10 w-10 shrink-0 p-0">
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <CustomerGradeAssessment
            value={assessment}
            title={customer.title}
            onChange={onAssessmentChange}
            managementStage={managementStage}
            onManagementStageChange={onManagementStageChange}
            managementStageOptions={MANAGEMENT_STAGE_OPTIONS}
          />
        </div>

        <div
          className="shrink-0 px-5 py-4 md:px-6"
          style={{
            background: "var(--surface)",
            borderTop: "1px solid var(--border-subtle)",
            boxShadow: "0 -18px 34px rgba(15, 23, 42, 0.08)",
          }}
        >
          {error ? (
            <p
              className="mb-3 rounded-[14px] border px-4 py-3 text-[13px] font-[550]"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                borderColor: "rgba(239, 68, 68, 0.28)",
                color: "#ef4444",
              }}
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <button type="button" onClick={onClose} className="btn-premium btn-ghost">
              취소
            </button>
            <button type="button" onClick={onConfirm} className="btn-premium btn-primary h-9 px-3 text-[12px]">
              <CheckCircle2 size={15} /> {result.customerGrade} 등급으로 VIP활동DB 이관
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDbPage() {
  const [records, setRecords] = useState<RawCustomerRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RawCustomerRecord | null>(null);
  const [form, setForm] = useState<RawCustomerForm>({ ...EMPTY_FORM });
  const [selectedRecord, setSelectedRecord] = useState<RawCustomerRecord | null>(null);
  const [memoEditing, setMemoEditing] = useState(false);
  const [editingMemo, setEditingMemo] = useState("");
  const [selectedRemoteNotes, setSelectedRemoteNotes] = useState<CustomerDbNote[]>([]);
  const [search, setSearch] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [transferTarget, setTransferTarget] = useState<RawCustomerRecord | null>(null);
  const [transferAssessment, setTransferAssessment] = useState<GradeAssessmentForm>({
    ...EMPTY_GRADE_ASSESSMENT,
  });
  const [transferManagementStage, setTransferManagementStage] = useState<string>("리드");
  const [transferError, setTransferError] = useState("");

  // Supabase에서 직접 고객DB 로딩 (담당자 기준 필터 포함)
  useEffect(() => {
    let alive = true;

    const loadFromSupabase = async () => {
      try {
        // 현재 로그인 사용자 파악
        const userRaw = typeof window !== "undefined" ? window.localStorage.getItem("crm_user") : null;
        let execName: string | null = null;
        if (userRaw) {
          const u = JSON.parse(userRaw);
          const role = String(u?.role || "").toLowerCase();
          const name = String(u?.name || "");
          const adminNames = ["문시욱", "김정후", "김창완", "최웅"];
          const execNames = ["조계현", "이세호", "기여운", "최연전"];
          const normName = name.replace(/님|팀장|파트장|본부장|대표/g, "").trim();
          const isAdmin = role === "admin" || adminNames.some((n) => n === normName);
          const isExec = role === "exec" || role.includes("실행") || execNames.some((n) => n === normName);
          if (isExec && !isAdmin) execName = name;
        }

        let q = supabase
          .from("contacts")
          .select("*")
          .eq("crm_db_source", "customer_db")
          .order("created_at", { ascending: false });

        if (execName) {
          q = q.eq("assigned_to", execName);
        }

        const { data, error } = await q;
        if (error) throw error;
        if (!alive) return;

        const remoteRecords: RawCustomerRecord[] = (data || []).map((row: any) => normalizeRawRecord({
          id: row.id,
          name: row.name || "",
          title: row.title || "",
          phone: row.phone || row.customer_phone || "",
          intake_route: row.intake_route || "",
          company: row.company || "",
          assigned_to: row.assigned_to || "",
          activity_type: row.activity_type || "TM",
          memo: row.memo || "",
          sensitivity: (() => {
            const m = String(row.memo || "");
            const match = m.match(/\[고객감도:\s*(.+?)\]/);
            return match ? match[1].trim() : "감도없음";
          })(),
          sensitivity_updated_at: (() => {
            const m = String(row.memo || "");
            const match = m.match(/\[재TM일:\s*(.+?)\]/);
            return match ? match[1].trim() : String(row.updated_at || "").slice(0, 10);
          })(),
          notes: [],
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }));

        setRecords(remoteRecords);
        setLoaded(true);
      } catch (err) {
        console.warn("고객DB Supabase 로딩 실패, localStorage 폴백:", err);
        // 폴백: localStorage
        const local = readJsonArray<RawCustomerRecord>(RAW_DB_STORAGE_KEY).map(normalizeRawRecord);
        if (alive) {
          setRecords(local);
          setLoaded(true);
        }
      }
    };

    loadFromSupabase();
    return () => { alive = false; };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const loadRemoteNotesForRecord = async (record: RawCustomerRecord | null) => {
    if (!record?.phone) {
      setSelectedRemoteNotes([]);
      return;
    }

    try {
      const contactId = await findContactIdByPhone(record.phone);
      if (!contactId) {
        setSelectedRemoteNotes([]);
        return;
      }

      const { data, error } = await supabase
        .from("contact_notes")
        .select("id, note_date, content, author, created_at, updated_at")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const notes: CustomerDbNote[] = (data || []).map((note: any) => {
        const rawContent = String(note.content || "");
        const content = rawContent.replace(/^\[(TM|콜드톡)\]\s*/g, "").trim();
        const isColdTalk =
          rawContent.startsWith("[콜드톡]") ||
          rawContent.includes("활동항목: 콜드톡");
        const isTm =
          rawContent.startsWith("[TM]") ||
          rawContent.includes("활동항목: TM") ||
          String(note.author || "").includes("AI 통화요약");

        return {
          id: Number(note.id || Date.now()),
          noteDate: String(note.note_date || new Date().toISOString().slice(0, 10)),
          activityType: isTm && !isColdTalk ? "TM" : "콜드톡",
          content,
          author: String(note.author || "AI 통화요약"),
          createdAt: String(note.created_at || note.updated_at || new Date().toISOString()),
        };
      });

      setSelectedRemoteNotes(notes);
    } catch (error) {
      console.error("활동노트 조회 실패", error);
      setSelectedRemoteNotes([]);
    }
  };

  const stats = useMemo(() => {
    const tm = records.filter((record) => record.activity_type === "TM").length;
    const cold = records.filter((record) => record.activity_type === "콜드톡").length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = records.filter((record) => String(record.created_at || "").slice(0, 10) === today).length;
    const totalActivity = tm + cold;
    const todayTm = records.filter((record) => record.activity_type === "TM" && (record.notes || []).some((n) => String(n.noteDate || "").slice(0, 10) === today)).length;
    const todayCold = records.filter((record) => record.activity_type === "콜드톡" && (record.notes || []).some((n) => String(n.noteDate || "").slice(0, 10) === today)).length;
    const todayActivity = todayTm + todayCold;
    const routeCounts = INTAKE_ROUTES
      .map((route) => ({
        route,
        count: records.filter((record) => record.intake_route === route).length,
      }))
      .filter((item) => item.count > 0);

    return { total: records.length, tm, cold, todayCount, totalActivity, todayActivity, todayTm, todayCold, routeCounts };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = !keyword
        ? true
        : [
            record.name,
            record.title,
            record.phone,
            record.intake_route,
            record.company,
            record.activity_type,
            record.memo,
            ...record.notes.map((note) => note.content),
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);

      return matchesKeyword && (!filterRoute || record.intake_route === filterRoute) && (!filterActivity || record.activity_type === filterActivity) && (!filterTitle || record.title === filterTitle);
    });
  }, [records, search, filterRoute, filterActivity, filterTitle]);

  const PAGE_SIZE = 10;
  const DISPLAY_SIZE = 7;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage, totalPages]);

  // 재TM진행 고객 목록 (D+3 영업일 기준)
  const retmRecords = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredRecords
      .filter((r) => r.sensitivity === "재TM진행")
      .map((r) => {
        const baseDate = r.sensitivity_updated_at || r.updated_at?.slice(0, 10) || today;
        const retmDate = addBusinessDays(baseDate, 3);
        return { ...r, retmDate };
      })
      .sort((a, b) => (a as any).retmDate.localeCompare((b as any).retmDate))
      .slice(0, DISPLAY_SIZE);
  }, [filteredRecords]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRoute, filterActivity]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);


  useEffect(() => {
    loadRemoteNotesForRecord(selectedRecord);
    setMemoEditing(false);
  }, [selectedRecord?.id, selectedRecord?.phone]);

  const selectedDisplayNotes = useMemo(() => {
    if (!selectedRecord) return [];

    const map = new Map<string, CustomerDbNote>();
    [...selectedRemoteNotes, ...(selectedRecord.notes || [])].forEach((note) => {
      const normalizedContent = String(note.content || "")
        .replace(/^\[(TM|콜드톡)\]\s*/g, "")
        .trim();
      const normalizedAuthor = String(note.author || "").trim();
      const key = `${normalizedAuthor}|${note.noteDate}|${normalizedContent}`;
      if (!map.has(key)) map.set(key, { ...note, content: normalizedContent });
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [selectedRecord, selectedRemoteNotes]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setShowForm(false);
    setEditingRecord(null);
  };

  const openEditForm = (record: RawCustomerRecord) => {
    setEditingRecord(record);
    setForm({
      name: record.name || "",
      title: record.title || "",
      phone: record.phone || "",
      intake_route: record.intake_route || "",
      company: record.company || "",
      activity_type: record.activity_type || "",
      memo: record.memo || "",
      first_note: "",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("고객명을 입력해주세요.");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("연락처를 입력해주세요.");
      return;
    }
    if (!form.intake_route) {
      setFormError("유입경로를 선택해주세요.");
      return;
    }
    if (!form.activity_type) {
      setFormError("활동항목을 선택해주세요.");
      return;
    }

    const now = new Date().toISOString();
    const firstNote: CustomerDbNote[] = form.first_note.trim()
      ? [
          {
            id: Date.now() + 1,
            noteDate: today(),
            activityType: form.activity_type,
            content: form.first_note.trim(),
            author: "현재 사용자",
            createdAt: now,
          },
        ]
      : [];

    if (editingRecord) {
      const updatedRecord: RawCustomerRecord = {
        ...editingRecord,
        name: form.name.trim(),
        title: form.title.trim(),
        phone: form.phone.trim(),
        intake_route: form.intake_route,
        company: form.company.trim(),
        assigned_to: editingRecord.assigned_to || currentAssignedTo(),
        activity_type: form.activity_type,
        memo: form.memo.trim(),
        notes: firstNote.length ? [...firstNote, ...editingRecord.notes] : editingRecord.notes,
        updated_at: now,
      };

      try {
        const contactId = await saveCustomerDbRecordToContacts(updatedRecord);
        for (const note of firstNote) {
          await saveCustomerDbNoteToSupabase(contactId, note);
        }
      } catch (error) {
        console.error("고객DB 수정 저장 실패", error);
        setFormError("Supabase 저장 실패로 고객 정보를 수정하지 못했습니다.");
        return;
      }

      setRecords((items) => items.map((item) => (item.id === editingRecord.id ? updatedRecord : item)));
      setSelectedRecord((current) => (current?.id === editingRecord.id ? updatedRecord : current));
      resetForm();
      showToast("고객DB 정보가 수정되었습니다.");
      return;
    }

    const record: RawCustomerRecord = {
      id: Date.now(),
      name: form.name.trim(),
      title: form.title.trim(),
      phone: form.phone.trim(),
      intake_route: form.intake_route,
      company: form.company.trim(),
      assigned_to: currentAssignedTo(),
      activity_type: form.activity_type,
      memo: form.memo.trim(),
      notes: firstNote,
      created_at: now,
      updated_at: now,
    };

    try {
      const contactId = await saveCustomerDbRecordToContacts(record);
      for (const note of firstNote) {
        await saveCustomerDbNoteToSupabase(contactId, note);
      }
    } catch (error) {
      console.error("고객DB Supabase 저장 실패", error);
      setFormError("Supabase 저장 실패로 고객을 등록하지 못했습니다. Vercel 로그 또는 Supabase 권한을 확인해주세요.");
      return;
    }

    setRecords((items) => [record, ...items]);
    setSelectedRecord(record);
    resetForm();
    showToast("고객DB에 등록되었습니다.");
  };


  const handleSaveSensitivity = async (customerId: number, sensitivity: string) => {
    const targetRecord = records.find((record) => record.id === customerId);
    if (!targetRecord) return;
    const now = new Date().toISOString();
    const todayStr = now.slice(0, 10);
    const updated = {
      ...targetRecord,
      sensitivity,
      sensitivity_updated_at: sensitivity === "재TM진행" ? todayStr : targetRecord.sensitivity_updated_at,
    };
    try {
      const contactId = await findContactIdByPhone(targetRecord.phone);
      if (contactId) {
        await supabase.from("contacts").update({ memo: buildContactMemoWithSensitivity(updated) }).eq("id", contactId);
      }
      setRecords((items) => items.map((r) => r.id === customerId ? updated : r));
      setSelectedRecord((current) => current?.id === customerId ? updated : current);
      showToast("고객감도가 저장되었습니다.");
    } catch (e) {
      console.error("고객감도 저장 실패", e);
      showToast("고객감도 저장 실패");
    }
  };

  const handleAddNote = async (customerId: number, note: Omit<CustomerDbNote, "id" | "createdAt">) => {
    const createdAt = new Date().toISOString();
    const newNote: CustomerDbNote = {
      id: Date.now(),
      createdAt,
      ...note,
    };

    const targetRecord = records.find((record) => record.id === customerId);
    if (targetRecord) {
      try {
        const contactId = await saveCustomerDbRecordToContacts(targetRecord);
        await saveCustomerDbNoteToSupabase(contactId, newNote);
        if (selectedRecord?.id === customerId) await loadRemoteNotesForRecord(targetRecord);
      } catch (error) {
        console.error("활동노트 Supabase 저장 실패", error);
        showToast("활동노트 저장 실패");
        return;
      }
    }

    setRecords((items) =>
      items.map((record) =>
        record.id === customerId
          ? {
              ...record,
              notes: [newNote, ...record.notes],
              updated_at: createdAt,
            }
          : record,
      ),
    );

    if (selectedRecord?.id === customerId) {
      setSelectedRecord((current) =>
        current
          ? {
              ...current,
              notes: [newNote, ...current.notes],
              updated_at: createdAt,
            }
          : current,
      );
    }
  };

  const handleDeleteNote = async (customerId: number, note: CustomerDbNote) => {
    if (!window.confirm("해당 활동노트를 삭제하시겠습니까?")) return;

    const sameNote = (item: CustomerDbNote) =>
      item.noteDate === note.noteDate &&
      String(item.author || "").trim() === String(note.author || "").trim() &&
      String(item.content || "").trim() === String(note.content || "").trim();

    const remoteTarget =
      note.id < 1000000000000
        ? note
        : selectedRemoteNotes.find((item) => sameNote(item) && item.id < 1000000000000);

    try {
      const contactId = await findContactIdByPhone(selectedRecord?.phone || "");
      if (contactId && remoteTarget?.id && remoteTarget.id < 1000000000000) {
        const { error } = await supabase
          .from("contact_notes")
          .delete()
          .eq("id", remoteTarget.id)
          .eq("contact_id", contactId);

        if (error) throw error;
      }
    } catch (error) {
      console.error("활동노트 Supabase 삭제 실패", error);
      showToast("활동노트 삭제 실패");
      return;
    }

    setRecords((items) =>
      items.map((record) =>
        record.id === customerId
          ? {
              ...record,
              notes: record.notes.filter((item) => !(item.id === note.id || sameNote(item))),
              updated_at: new Date().toISOString(),
            }
          : record,
      ),
    );

    setSelectedRecord((current) =>
      current?.id === customerId
        ? {
            ...current,
            notes: current.notes.filter((item) => !(item.id === note.id || sameNote(item))),
          }
        : current,
    );

    setSelectedRemoteNotes((items) =>
      items.filter((item) => !(item.id === note.id || item.id === remoteTarget?.id || sameNote(item))),
    );
    showToast("활동노트가 삭제되었습니다.");
  };

  const requestTransfer = (record: RawCustomerRecord) => {
    const first = window.confirm("VIP활동 DB로 이관하겠습니까?");
    if (!first) return;
    const second = window.confirm("심사를 진행하겠습니까?");
    if (!second) return;
    setTransferTarget(record);
    setTransferAssessment({ ...EMPTY_GRADE_ASSESSMENT });
    setTransferManagementStage("리드");
    setTransferError("");
  };

  const confirmTransfer = async () => {
    if (!transferTarget) return;

    const result = calculateCustomerGrade(transferAssessment, transferTarget.title);
    const now = new Date().toISOString();
    const baseMemo = stripGradeAssessmentBlock(transferTarget.memo).trim();

    const vipMemo = appendGradeAssessmentBlock(baseMemo, transferAssessment, result);
    const vipPayload = {
      name: transferTarget.name,
      title: transferTarget.title,
      phone: transferTarget.phone,
      intake_route: transferTarget.intake_route,
      company: transferTarget.company,
      management_stage: transferManagementStage || "리드",
      customer_grade: result.customerGrade,
      memo: vipMemo,
      crm_db_source: VIP_DB_SOURCE,
      vip_transferred_at: now,
      activity_type: transferTarget.activity_type,
      assigned_to: currentAssignedTo(),
      updated_at: now,
    };

    const phoneDigits = normalizePhoneDigits(transferTarget.phone);

    // 이전 버전은 VIP활동DB localStorage에도 저장했기 때문에
    // Supabase에서 삭제한 고객이 다시 살아나는 문제가 있었습니다.
    // 이제 VIP활동DB는 Supabase contacts.crm_db_source = 'vip_activity' 값만 기준으로 표시합니다.
    window.localStorage.removeItem(VIP_DB_STORAGE_KEY);

    try {
      const { data: existingVip, error: findError } = await supabase
        .from("contacts")
        .select("id, created_at")
        .eq("phone", transferTarget.phone)
        .maybeSingle();

      if (findError) throw findError;

      if (existingVip?.id) {
        const { error: updateError } = await supabase
          .from("contacts")
          .update(vipPayload)
          .eq("id", existingVip.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("contacts").insert({
          ...vipPayload,
          created_at: now,
        });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error("VIP활동DB 이관 저장 실패", error);
      setTransferError("VIP활동DB 이관 저장 실패: Supabase SQL 적용 여부와 contacts 컬럼을 확인해주세요.");
      return;
    }

    setRecords((items) => {
      const nextItems = items.filter(
        (record) => normalizePhoneDigits(record.phone) !== phoneDigits,
      );
      writeJsonArray(RAW_DB_STORAGE_KEY, nextItems);
      return nextItems;
    });

    if (selectedRecord?.id === transferTarget.id) setSelectedRecord(null);
    setTransferTarget(null);
    setTransferError("");
    showToast("VIP활동DB로 이관되었습니다.");
  };

  const deleteRecord = async (record: RawCustomerRecord) => {
    if (!window.confirm(`${record.name} 고객을 고객DB에서 삭제하시겠습니까?`)) return;
    setRecords((items) => items.filter((item) => item.id !== record.id));
    if (selectedRecord?.id === record.id) setSelectedRecord(null);

    // Supabase에서도 삭제 (crm_db_source = "customer_db"인 레코드)
    try {
      const contactId = await findContactIdByPhone(record.phone);
      if (contactId) {
        await supabase.from("contacts").delete().eq("id", contactId);
      }
    } catch (error) {
      console.warn("Supabase 삭제 실패 (localStorage는 삭제됨)", error);
    }

    showToast("고객DB에서 삭제되었습니다.");
  };

  return (
    <main className="premium-page customer-db-typography min-h-screen px-4 py-5 md:px-6 xl:px-8">
    <style jsx global>{`
      .customer-db-force-center {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        table-layout: fixed !important;
      }

      .customer-db-force-center thead th,
      .customer-db-force-center tbody td,
      .customer-db-force-center th.customer-db-th,
      .customer-db-force-center td.customer-db-td {
        text-align: center !important;
        vertical-align: middle !important;
        padding-left: 14px !important;
        padding-right: 14px !important;
      }

      .customer-db-force-center thead th {
        height: 54px !important;
        background: var(--surface-2) !important;
        color: var(--text-muted) !important;
        font-size: 13px !important;
        font-weight: 950 !important;
        letter-spacing: -0.02em !important;
        white-space: nowrap !important;
      }

      .customer-db-force-center tbody td {
        height: 72px !important;
        color: var(--text-strong) !important;
        font-size: 14px !important;
        font-weight: 850 !important;
        white-space: nowrap !important;
      }

      .customer-db-force-center .customer-db-center-cell {
        width: 100% !important;
        min-height: 36px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        gap: 6px !important;
      }

      .customer-db-force-center .customer-db-two-line-cell {
        width: 100% !important;
        min-height: 42px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        gap: 3px !important;
      }

      .customer-db-force-center .customer-db-cell-text {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        text-align: center !important;
        margin-left: auto !important;
        margin-right: auto !important;
        letter-spacing: -0.035em !important;
      }

      .customer-db-force-center .customer-db-badge {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 104px !important;
        min-height: 30px !important;
        padding: 0 14px !important;
        font-size: 13px !important;
        font-weight: 950 !important;
        line-height: 1 !important;
        text-align: center !important;
      }

      .customer-db-force-center .customer-db-action-wrap {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        width: 100% !important;
      }

      .customer-db-typography,
      .customer-db-typography * {
        letter-spacing: -0.015em;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }

      .customer-db-typography .crm-title {
        font-weight: 700 !important;
        letter-spacing: -0.045em !important;
      }

      .customer-db-typography .crm-subtitle,
      .customer-db-typography .crm-tiny,
      .customer-db-typography .crm-meta,
      .customer-db-typography .crm-row-sub {
        font-weight: 450 !important;
        letter-spacing: -0.015em !important;
      }

      .customer-db-typography .crm-card-title,
      .customer-db-typography .crm-section-title,
      .customer-db-typography .crm-row-main {
        font-weight: 650 !important;
        letter-spacing: -0.025em !important;
      }

      .customer-db-typography button,
      .customer-db-typography .btn-premium {
        font-weight: 600 !important;
        letter-spacing: -0.015em !important;
      }

      .customer-db-typography input,
      .customer-db-typography select,
      .customer-db-typography textarea {
        font-weight: 500 !important;
      }

      .customer-db-typography .customer-db-force-center thead th {
        font-size: 12.5px !important;
        font-weight: 650 !important;
      }

      .customer-db-typography .customer-db-force-center tbody td {
        font-size: 13.5px !important;
        font-weight: 500 !important;
      }

      .customer-db-typography .customer-db-cell-text {
        font-weight: 500 !important;
      }

      .customer-db-typography .customer-db-badge {
        font-size: 12px !important;
        font-weight: 600 !important;
      }

      .customer-db-typography .note-body-text,
      .customer-db-typography .memo-body-text {
        font-weight: 400 !important;
        line-height: 1.65 !important;
        letter-spacing: -0.008em !important;
      }

    `}</style>

      <section className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11px]" style={{ background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}>
            <Database size={12} /> VIP활동DB 발굴용 원천 DB
          </div>
          <h1 className="crm-title">고객DB</h1>
          <p className="crm-subtitle mt-1">TM과 콜드톡 활동으로 확보한 원천 고객을 등록하고, 심사 후 VIP활동DB로 이관합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowForm(true)} className="btn-premium btn-primary h-9 px-3 text-[12px]">
            <Plus size={16} /> 신규고객등록
          </button>
          <button
            type="button"
            onClick={() => {
              // Supabase에서 재로딩
              try {
                const userRaw = window.localStorage.getItem("crm_user");
                let execName: string | null = null;
                if (userRaw) {
                  const u = JSON.parse(userRaw);
                  const role = String(u?.role || "").toLowerCase();
                  const name = String(u?.name || "");
                  const execNames = ["조계현", "이세호", "기여운", "최연전"];
                  const adminNames = ["문시욱", "김정후", "김창완", "최웅"];
                  const normName = name.replace(/님|팀장|파트장|본부장|대표/g, "").trim();
                  const isAdmin = role === "admin" || adminNames.some((n) => n === normName);
                  const isExec = role === "exec" || role.includes("실행") || execNames.some((n) => n === normName);
                  if (isExec && !isAdmin) execName = name;
                }
                let q = supabase.from("contacts").select("*").eq("crm_db_source", "customer_db").order("created_at", { ascending: false });
                if (execName) q = q.eq("assigned_to", execName);
                const { data } = await q;
                if (data) setRecords((data as any[]).map((row) => normalizeRawRecord({ id: row.id, name: row.name || "", title: row.title || "", phone: row.phone || row.customer_phone || "", intake_route: row.intake_route || "", company: row.company || "", assigned_to: row.assigned_to || "", activity_type: row.activity_type || "TM", memo: row.memo || "", notes: [], created_at: row.created_at || new Date().toISOString(), updated_at: row.updated_at || new Date().toISOString() })));
              } catch {}
              showToast("고객DB를 새로고침했습니다.");
            }}
            className="btn-premium btn-ghost"
          >
            <RefreshCcw size={15} /> 새로고침
          </button>
        </div>
      </section>

      <section className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="rounded-[12px] border px-3.5 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>전체 등록DB</p>
          <p className="mt-1 text-[18px] font-semibold tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{stats.total}<span className="ml-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>건</span></p>
        </div>
        <div className="rounded-[12px] border px-3.5 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>당일 등록DB</p>
          <p className="mt-1 text-[18px] font-semibold tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{stats.todayCount}<span className="ml-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>건</span></p>
        </div>
        <div className="rounded-[12px] border px-3.5 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>전체 활동진행</p>
          <p className="mt-1 text-[18px] font-semibold tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{stats.totalActivity}<span className="ml-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>건</span>
            <span className="ml-2 text-[11px]" style={{ color: "var(--text-faint)" }}>TM {stats.tm} · 콜드톡 {stats.cold}</span>
          </p>
        </div>
        <div className="rounded-[12px] border px-3.5 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>당일 활동진행</p>
          <p className="mt-1 text-[18px] font-semibold tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>{stats.todayActivity}<span className="ml-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>건</span>
            <span className="ml-2 text-[11px]" style={{ color: "var(--text-faint)" }}>TM {stats.todayTm} · 콜드톡 {stats.todayCold}</span>
          </p>
        </div>
      </section>

      <section className="mb-3">
        <div className="flex items-center gap-2">
          <label className="relative block w-1/2">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-faint)" }}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="고객명, 연락처, 소속회사, 메모 검색"
              className="crm-search h-10 w-full pl-9 pr-3"
            />
          </label>
          <select value={filterTitle} onChange={(event) => setFilterTitle(event.target.value)} className="crm-search h-10 w-[120px] px-3">
            <option value="">전체 직급</option>
            {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterRoute} onChange={(event) => setFilterRoute(event.target.value)} className="crm-search h-10 w-[140px] px-3">
            <option value="">전체 유입경로</option>
            {INTAKE_ROUTES.map((route) => <option key={route} value={route}>{route}</option>)}
          </select>
          <select value={filterActivity} onChange={(event) => setFilterActivity(event.target.value)} className="crm-search h-10 w-[140px] px-3">
            <option value="">전체 활동항목</option>
            {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </section>

      <section className="premium-card overflow-hidden">
        <div className="crm-table-wrap max-h-[690px] overflow-auto rounded-[18px]">
          <table className="crm-table customer-db-centered-table customer-db-force-center w-full table-fixed text-center">
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "27%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">고객명</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">직급</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">연락처</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">유입경로</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">활동항목</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">소속회사</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">담당자</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">최근 활동</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">등록일</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">고객감도</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">관리</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => {
                const latestNote = record.notes[0];
                return (
                  <tr
                    key={record.id}
                    data-selected={selectedRecord?.id === record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="customer-db-row cursor-pointer"
                  >
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span className="customer-db-cell-text">{record.name}</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span className="customer-db-cell-text">{fmt(record.title)}</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span className="customer-db-cell-text tabular-nums">{fmt(record.phone)}</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                      <span className={`customer-db-badge badge-premium ${badgeClass(record.intake_route)}`}>
                        {record.intake_route}
                      </span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                      <span
                        className="customer-db-badge rounded-full"
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: "var(--text-strong)",
                        }}
                      >
                        {record.activity_type}
                      </span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span className="customer-db-cell-text">{fmt(record.company)}</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span className="customer-db-cell-text">{fmt(record.assigned_to)}</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-two-line-cell">
                        <span className="customer-db-cell-text">{latestNote ? latestNote.activityType : "-"}</span>
                        <span className="crm-row-sub customer-db-cell-text">
                          {latestNote ? `${latestNote.noteDate} ${timeLabel(latestNote.createdAt)}` : "활동노트 없음"}
                        </span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span className="customer-db-cell-text">{dateLabel(record.created_at)}</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span
                          className="customer-db-badge badge-premium"
                          style={{
                            background: record.sensitivity === "재TM진행" ? "var(--warning-bg)" : "var(--surface-2)",
                            border: `1px solid ${record.sensitivity === "재TM진행" ? "var(--warning-border)" : "var(--border-subtle)"}`,
                            color: record.sensitivity === "재TM진행" ? "var(--warning-text)" : "var(--text-faint)",
                            fontSize: "11px",
                          }}
                        >
                          {record.sensitivity || "감도없음"}
                        </span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-action-wrap" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => requestTransfer(record)}
                          className="btn-premium btn-primary h-9 px-3 text-[12px]"
                        >
                          <ArrowRight size={13} /> VIP DB이관
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(record)}
                          className="btn-premium btn-secondary h-9 px-3 text-[12px]"
                        >
                          <Edit3 size={13} /> 수정
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRecord(record)}
                          className="btn-premium btn-danger h-9 px-3 text-[12px]"
                        >
                          <Trash2 size={13} /> 삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRecords.length ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <p className="crm-card-title">등록된 고객DB가 없습니다.</p>
                    <p className="crm-tiny mt-1">TM 또는 콜드톡 활동 고객을 등록해주세요.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--border)" }}>
          <p className="crm-tiny">
            총 {filteredRecords.length}건 · 페이지 {Math.min(currentPage, totalPages)} / {totalPages}
          </p>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="btn-premium btn-ghost h-8 px-2.5 text-[12px] disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 7) return true;
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 2) return true;
                return false;
              })
              .reduce((acc: (number | string)[], page, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && (page as number) - (arr[idx - 1] as number) > 1) {
                  acc.push("...");
                }
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-[12px]" style={{ color: "var(--text-faint)" }}>…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item as number)}
                    className="h-8 min-w-[32px] rounded-[8px] border px-2 text-[12px] font-[650] transition-colors"
                    style={{
                      background: currentPage === item ? "var(--accent-subtle)" : "var(--surface-2)",
                      borderColor: currentPage === item ? "var(--accent-border)" : "var(--border-subtle)",
                      color: currentPage === item ? "var(--accent-text)" : "var(--text-muted)",
                    }}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
              className="btn-premium btn-ghost h-8 px-2.5 text-[12px] disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {/* 재TM진행 고객 리스트 */}
      <section className="premium-card overflow-hidden mt-4">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-[700]" style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", color: "var(--warning-text)" }}>재TM진행</span>
            <p className="text-[14px] font-[700]" style={{ color: "var(--text-strong)" }}>재TM진행 고객</p>
            <span className="crm-tiny">{retmRecords.length}건</span>
          </div>
          <p className="crm-tiny">최대 7건 표시 · 고객상세에서 감도 변경 가능</p>
        </div>
        <div className="crm-table-wrap overflow-auto rounded-b-[18px]">
          <table className="crm-table customer-db-centered-table customer-db-force-center w-full table-fixed text-center">
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "27%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">고객명</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">직급</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">연락처</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">유입경로</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">활동항목</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">소속회사</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">담당자</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">최근 활동</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle" style={{ color: "var(--warning-text)", background: "var(--warning-bg)" }}>재TM 예정일 (D+3)</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">고객감도</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">관리</th>
              </tr>
            </thead>
            <tbody>
              {retmRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center">
                    <p className="crm-card-title">재TM진행 고객이 없습니다.</p>
                    <p className="crm-tiny mt-1">고객 상세에서 고객감도를 재TM진행으로 설정하면 여기에 표시됩니다.</p>
                  </td>
                </tr>
              ) : retmRecords.map((record) => {
                const latestNote = record.notes[0];
                return (
                  <tr
                    key={`retm-${record.id}`}
                    data-selected={selectedRecord?.id === record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="customer-db-row cursor-pointer"
                  >
                    <td className="customer-db-td"><div className="customer-db-center-cell"><span className="customer-db-cell-text">{record.name}</span></div></td>
                    <td className="customer-db-td"><div className="customer-db-center-cell"><span className="customer-db-cell-text">{fmt(record.title)}</span></div></td>
                    <td className="customer-db-td"><div className="customer-db-center-cell"><span className="customer-db-cell-text tabular-nums">{fmt(record.phone)}</span></div></td>
                    <td className="customer-db-td"><div className="customer-db-center-cell"><span className={`customer-db-badge badge-premium ${badgeClass(record.intake_route)}`}>{record.intake_route}</span></div></td>
                    <td className="customer-db-td"><div className="customer-db-center-cell"><span className="customer-db-badge rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-strong)" }}>{record.activity_type}</span></div></td>
                    <td className="customer-db-td"><div className="customer-db-center-cell"><span className="customer-db-cell-text">{fmt(record.company)}</span></div></td>
                    <td className="customer-db-td"><div className="customer-db-center-cell"><span className="customer-db-cell-text">{fmt(record.assigned_to)}</span></div></td>
                    <td className="customer-db-td">
                      <div className="customer-db-two-line-cell">
                        <span className="customer-db-cell-text">{latestNote ? latestNote.activityType : "-"}</span>
                        <span className="crm-row-sub customer-db-cell-text">{latestNote ? `${latestNote.noteDate} ${timeLabel(latestNote.createdAt)}` : "활동노트 없음"}</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="customer-db-cell-text font-[700]" style={{ color: "var(--warning-text)" }}>
                            {formatRetmDate((record as any).retmDate)}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                            감도저장일: {(record.sensitivity_updated_at || record.updated_at?.slice(0,10) || "-")}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-center-cell">
                        <span className="customer-db-badge badge-premium" style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", color: "var(--warning-text)", fontSize: "11px" }}>재TM진행</span>
                      </div>
                    </td>
                    <td className="customer-db-td">
                      <div className="customer-db-action-wrap" onClick={(event) => event.stopPropagation()}>
                        <button type="button" onClick={() => requestTransfer(record)} className="btn-premium btn-primary h-9 px-3 text-[12px]"><ArrowRight size={13} /> VIP DB이관</button>
                        <button type="button" onClick={() => openEditForm(record)} className="btn-premium btn-secondary h-9 px-3 text-[12px]"><Edit3 size={13} /> 수정</button>
                        <button type="button" onClick={() => deleteRecord(record)} className="btn-premium btn-danger h-9 px-3 text-[12px]"><Trash2 size={13} /> 삭제</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRecord ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="고객 상세 닫기"
            onClick={() => setSelectedRecord(null)}
            className="absolute inset-0 cursor-default backdrop-blur-[2px]"
            style={{ background: "var(--overlay)" }}
          />

          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-[760px] animate-[crmSlideIn_220ms_ease-out] flex-col border-l"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="slide-panel-header compact-customer-detail flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-[650]"
                    style={{
                      background: "var(--accent-subtle)",
                      border: "1px solid var(--accent-border)",
                      color: "var(--accent-text)",
                    }}
                  >
                    {selectedRecord.intake_route}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-[650]"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-subtle)",
                    }}
                  >
                    {selectedRecord.activity_type}
                  </span>
                </div>
                <h2 className="truncate text-[20px] font-[700] tracking-[-0.055em]" style={{ color: "var(--text-strong)" }}>
                  {fmt(selectedRecord.name)}
                </h2>
                <p className="mt-0.5 text-[12px] font-[450]" style={{ color: "var(--text-muted)" }}>
                  {fmt(selectedRecord.title)} · {fmt(selectedRecord.phone)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => requestTransfer(selectedRecord)} className="btn-premium btn-primary h-8 px-2.5 text-[11px]">
                  <ArrowRight size={12} /> VIP DB이관
                </button>
                <button type="button" onClick={() => openEditForm(selectedRecord)} className="btn-premium btn-secondary h-8 px-2.5 text-[11px]">
                  <Edit3 size={12} /> 수정
                </button>
                <button type="button" onClick={() => deleteRecord(selectedRecord)} className="btn-premium h-8 px-2.5 text-[11px]" style={{ color: "var(--danger-text)", background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}>
                  <Trash2 size={12} /> 삭제
                </button>
                <button type="button" onClick={() => setSelectedRecord(null)} className="btn-premium btn-secondary h-8 w-8 shrink-0 p-0">
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <section className="rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                <p className="mb-2 text-[13px]" style={{ color: "var(--text-strong)", fontWeight: 600 }}>고객 기본정보</p>
                <div className="grid grid-cols-[72px_1fr_72px_1fr] gap-x-2 gap-y-1 text-[12px]">
                  {[
                    ["고객명", fmt(selectedRecord.name)],
                    ["직급", fmt(selectedRecord.title)],
                    ["연락처", fmt(selectedRecord.phone)],
                    ["유입경로", fmt(selectedRecord.intake_route)],
                    ["활동항목", fmt(selectedRecord.activity_type)],
                    ["소속회사", fmt(selectedRecord.company)],
                    ["담당자", fmt(selectedRecord.assigned_to)],
                    ["등록일", dateLabel(selectedRecord.created_at)],
                  ].map(([label, value]) => (
                    <Fragment key={label}>
                      <span style={{ color: "var(--text-faint)" }}>{label}</span>
                      <span style={{ color: "var(--text-strong)" }}>{value}</span>
                    </Fragment>
                  ))}
                </div>
              </section>

              <section className="mt-2 rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle size={14} style={{ color: "var(--accent)" }} />
                    <p className="text-[13px]" style={{ color: "var(--text-strong)", fontWeight: 600 }}>메모</p>
                  </div>
                  <button type="button" onClick={() => { setEditingMemo(selectedRecord.memo || ""); setMemoEditing(true); }} className="btn-premium btn-secondary h-7 px-2 text-[11px]">
                    <Edit3 size={11} /> 수정
                  </button>
                </div>
                {memoEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editingMemo}
                      onChange={(e) => setEditingMemo(e.target.value)}
                      rows={3}
                      className="min-h-[60px] w-full resize-none rounded-[10px] border px-2.5 py-2 text-[12px] leading-5 outline-none"
                      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
                      placeholder="메모를 입력하세요."
                    />
                    <div className="flex gap-1.5">
                      <button type="button" onClick={async () => {
                        const updated = { ...selectedRecord, memo: editingMemo.trim() };
                        setRecords((items) => items.map((r) => r.id === selectedRecord.id ? { ...r, memo: editingMemo.trim() } : r));
                        setSelectedRecord(updated);
                        setMemoEditing(false);
                        try { await saveCustomerDbRecordToContacts(updated); } catch (e) { console.warn("메모 Supabase 동기화 실패", e); }
                        showToast("메모가 저장되었습니다.");
                      }} className="btn-premium btn-primary h-7 flex-1 text-[11px]"><Save size={11} /> 저장</button>
                      <button type="button" onClick={() => setMemoEditing(false)} className="btn-premium btn-secondary h-7 px-3 text-[11px]">취소</button>
                    </div>
                  </div>
                ) : (
                  <MemoPreview memo={selectedRecord.memo} />
                )}
              </section>

              <section className="mt-2 rounded-[14px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                <div className="mb-1 flex items-center gap-1.5">
                  <FileText size={14} style={{ color: "var(--accent)" }} />
                  <p className="text-[13px]" style={{ color: "var(--text-strong)", fontWeight: 600 }}>활동노트</p>
                </div>
                <NoteComposer
                  defaultType={selectedRecord.activity_type}
                  onAdd={(note) => handleAddNote(selectedRecord.id, note)}
                  currentSensitivity={selectedRecord.sensitivity || "감도없음"}
                  onSaveSensitivity={(sensitivity) => handleSaveSensitivity(selectedRecord.id, sensitivity)}
                />
                <div className="mt-1.5">
                  <NotesList
                    notes={selectedDisplayNotes}
                    onDelete={(note) => handleDeleteNote(selectedRecord.id, note)}
                  />
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {showForm ? (
        <div className="crm-modal-overlay z-[70]">
          <div className="crm-modal max-h-[92vh] w-full max-w-[980px] overflow-y-auto p-5 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="crm-title">{editingRecord ? "고객DB 수정" : "고객DB 신규등록"}</h2>
                <p className="crm-subtitle mt-2">{editingRecord ? "고객 기본정보와 활동항목을 수정합니다." : "VIP활동DB 발굴을 위한 원천 고객을 등록합니다."}</p>
              </div>
              <button type="button" onClick={resetForm} className="btn-premium btn-ghost h-10 w-10 p-0">
                <X size={17} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextInput
                label="고객명"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder="고객명 입력"
              />
              <SelectInput
                label="직급"
                value={form.title}
                options={TITLE_OPTIONS}
                onChange={(value) => setForm((current) => ({ ...current, title: value }))}
              />
              <TextInput
                label="연락처"
                value={form.phone}
                onChange={(value) => setForm((current) => ({ ...current, phone: formatPhoneInput(value) }))}
                placeholder="010-0000-0000"
              />
              <SelectInput
                label="유입경로"
                value={form.intake_route}
                options={INTAKE_ROUTES}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    intake_route: value,
                  }))
                }
              />
              <TextInput
                label="소속회사"
                value={form.company}
                onChange={(value) => setForm((current) => ({ ...current, company: value }))}
                placeholder="소속회사 입력"
              />
              <ActivityTypeSelector
                value={form.activity_type}
                onChange={(value) => setForm((current) => ({ ...current, activity_type: value }))}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <InputLabel>메모</InputLabel>
                <textarea
                  value={form.memo}
                  onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
                  placeholder="고객 관련 메모를 입력하세요."
                  rows={6}
                  className="w-full resize-none rounded-[14px] border px-3 py-3 text-[13px] font-semibold leading-7 outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
                />
              </label>
              <label className="block">
                <InputLabel>{editingRecord ? "추가 활동노트" : "최초 활동노트"}</InputLabel>
                <textarea
                  value={form.first_note}
                  onChange={(event) => setForm((current) => ({ ...current, first_note: event.target.value }))}
                  placeholder={editingRecord ? "수정하면서 추가할 활동노트가 있으면 입력하세요." : "TM 또는 콜드톡 활동내용을 입력하세요."}
                  rows={6}
                  className="w-full resize-none rounded-[14px] border px-3 py-3 text-[13px] font-semibold leading-7 outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
                />
              </label>
            </div>

            {formError ? (
              <p
                className="mt-4 rounded-[14px] border px-4 py-3 text-[13px] font-[550]"
                style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.28)", color: "#ef4444" }}
              >
                {formError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button type="button" onClick={resetForm} className="btn-premium btn-ghost">
                취소
              </button>
              <button type="button" onClick={handleSave} className="btn-premium btn-primary h-9 px-3 text-[12px]">
                <Save size={15} /> {editingRecord ? "수정 저장" : "고객DB 등록"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {transferTarget ? (
        <TransferModal
          customer={transferTarget}
          assessment={transferAssessment}
          onAssessmentChange={setTransferAssessment}
          managementStage={transferManagementStage}
          onManagementStageChange={setTransferManagementStage}
          onClose={() => setTransferTarget(null)}
          onConfirm={confirmTransfer}
          error={transferError}
        />
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-5 right-5 z-[90] rounded-[16px] border px-4 py-3 text-[13px] font-[650] shadow-xl"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-strong)" }}
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}

