"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  MessageCircle,
  Phone,
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
import CustomerGradeAssessment from "@/components/CustomerGradeAssessment";
import {
  appendGradeAssessmentBlock,
  calculateCustomerGrade,
  EMPTY_GRADE_ASSESSMENT,
  hasGradeAssessmentInput,
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
  activity_type: ActivityType;
  memo: string;
  notes: CustomerDbNote[];
  created_at: string;
  updated_at: string;
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

function fmt(value?: string | null) {
  return value && value.trim() ? value : "-";
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
    activity_type:
      record.activity_type === "콜드톡" || record.activity_type === "TM"
        ? record.activity_type
        : "TM",
    memo: stripGradeAssessmentBlock(String(record.memo || "")),
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
    <div className="premium-card p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="crm-card-title">유입경로별 현황</p>
          <p className="crm-tiny mt-1">전체 {total}건 기준</p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[12px] font-[900]"
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
            <div key={item.label} className="rounded-[15px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
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
    <div className="premium-card p-4 md:p-5">
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
          <p className="mt-1 text-[26px] font-[950] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{tm}건</p>
        </div>
        <div className="rounded-[18px] border p-4 text-center" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(14, 165, 233, 0.14)", color: "#38bdf8" }}>
            <MessageCircle size={17} />
          </div>
          <p className="crm-meta">콜드톡</p>
          <p className="mt-1 text-[26px] font-[950] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{cold}건</p>
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
            className="rounded-[13px] border px-3 py-3 text-[13px] font-[900] transition"
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
}: {
  onAdd: (note: Omit<CustomerDbNote, "id" | "createdAt">) => void;
  defaultType: ActivityType;
}) {
  const [noteDate, setNoteDate] = useState(today());
  const [activityType, setActivityType] = useState<ActivityType>(defaultType);
  const [content, setContent] = useState("");

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

  return (
    <div
      className="space-y-3 rounded-[16px] border p-4"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="crm-card-title">활동노트 작성</p>
          <p className="crm-tiny mt-1">TM 또는 콜드톡 활동을 기록합니다.</p>
        </div>
        <input
          type="date"
          value={noteDate}
          onChange={(event) => setNoteDate(event.target.value)}
          className="h-10 rounded-[11px] border px-3 text-[12px] font-[800] outline-none"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-strong)",
          }}
        />
      </div>

      <ActivityTypeSelector value={activityType} onChange={setActivityType} />

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="활동 내용을 입력하세요."
        rows={4}
        className="w-full resize-none rounded-[12px] border px-3 py-3 text-[13px] font-semibold leading-7 outline-none"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-strong)",
        }}
      />
      <button type="button" onClick={handleAdd} className="btn-premium btn-primary w-full">
        <Plus size={14} /> 활동노트 저장
      </button>
    </div>
  );
}

function NotesList({ notes }: { notes: CustomerDbNote[] }) {
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
    <div className="max-h-[456px] space-y-3 overflow-y-auto pr-1">
      {notes.map((note) => (
        <article
          key={note.id}
          className="rounded-[16px] border p-4"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-[900]"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                  color: "var(--accent-text)",
                }}
              >
                {note.activityType}
              </span>
              <p className="crm-meta">{note.noteDate} · {timeLabel(note.createdAt)}</p>
            </div>
            <p className="crm-tiny">{note.author}</p>
          </div>
          <p
            className="whitespace-pre-wrap text-[13px] font-[700] leading-7"
            style={{ color: "var(--text)" }}
          >
            {note.content}
          </p>
        </article>
      ))}
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
      className="rounded-[16px] border p-4"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <p className="crm-meta">{label}</p>
      {badge ? (
        <span
          className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-[900]"
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid var(--accent-border)",
            color: "var(--accent-text)",
          }}
        >
          {display}
        </span>
      ) : (
        <p className="crm-card-title mt-2">{display}</p>
      )}
    </div>
  );
}

function TransferModal({
  customer,
  assessment,
  onAssessmentChange,
  onClose,
  onConfirm,
  error,
}: {
  customer: RawCustomerRecord;
  assessment: GradeAssessmentForm;
  onAssessmentChange: (value: GradeAssessmentForm) => void;
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
                className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-[900]"
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
                고객등급 자동판정을 완료하면 VIP활동DB로 이관되고, 고객DB에서는 삭제됩니다.
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
              className="mb-3 rounded-[14px] border px-4 py-3 text-[13px] font-[800]"
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
            <button type="button" onClick={onConfirm} className="btn-premium btn-primary">
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
  const [form, setForm] = useState<RawCustomerForm>({ ...EMPTY_FORM });
  const [selectedRecord, setSelectedRecord] = useState<RawCustomerRecord | null>(null);
  const [search, setSearch] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [transferTarget, setTransferTarget] = useState<RawCustomerRecord | null>(null);
  const [transferAssessment, setTransferAssessment] = useState<GradeAssessmentForm>({
    ...EMPTY_GRADE_ASSESSMENT,
  });
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    setRecords(readJsonArray<RawCustomerRecord>(RAW_DB_STORAGE_KEY).map(normalizeRawRecord));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    writeJsonArray(RAW_DB_STORAGE_KEY, records);
  }, [loaded, records]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const stats = useMemo(() => {
    const tm = records.filter((record) => record.activity_type === "TM").length;
    const cold = records.filter((record) => record.activity_type === "콜드톡").length;
    const routeCounts = INTAKE_ROUTES.map((route) => ({
      label: route,
      value: records.filter((record) => record.intake_route === route).length,
    }));

    return { total: records.length, tm, cold, routeCounts };
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

      return matchesKeyword && (!filterRoute || record.intake_route === filterRoute) && (!filterActivity || record.activity_type === filterActivity);
    });
  }, [records, search, filterRoute, filterActivity]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / 10));
  const pagedRecords = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * 10;
    return filteredRecords.slice(start, start + 10);
  }, [filteredRecords, currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRoute, filterActivity]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setShowForm(false);
  };

  const handleSave = () => {
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
    const firstNote = form.first_note.trim()
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

    const record: RawCustomerRecord = {
      id: Date.now(),
      name: form.name.trim(),
      title: form.title.trim(),
      phone: form.phone.trim(),
      intake_route: form.intake_route,
      company: form.company.trim(),
      activity_type: form.activity_type,
      memo: form.memo.trim(),
      notes: firstNote,
      created_at: now,
      updated_at: now,
    };

    setRecords((items) => [record, ...items]);
    setSelectedRecord(record);
    resetForm();
    showToast("고객DB에 등록되었습니다.");
  };

  const handleAddNote = (customerId: number, note: Omit<CustomerDbNote, "id" | "createdAt">) => {
    const createdAt = new Date().toISOString();
    const newNote: CustomerDbNote = {
      id: Date.now(),
      createdAt,
      ...note,
    };

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

  const requestTransfer = (record: RawCustomerRecord) => {
    const first = window.confirm("VIP활동 DB로 이관하겠습니까?");
    if (!first) return;
    const second = window.confirm("심사를 진행하겠습니까?");
    if (!second) return;
    setTransferTarget(record);
    setTransferAssessment({ ...EMPTY_GRADE_ASSESSMENT });
    setTransferError("");
  };

  const confirmTransfer = () => {
    if (!transferTarget) return;
    if (!hasGradeAssessmentInput(transferAssessment)) {
      setTransferError("VIP활동DB 이관 전 고객등급 심사값을 1개 이상 입력해주세요.");
      return;
    }

    const result = calculateCustomerGrade(transferAssessment, transferTarget.title);
    const now = new Date().toISOString();
    const noteMemo = buildNoteMemo(transferTarget.notes);
    const baseMemo = [
      stripGradeAssessmentBlock(transferTarget.memo),
      noteMemo ? `[고객DB 활동노트]\n${noteMemo}` : "",
      `[고객DB 이관 정보]\n유입경로: ${transferTarget.intake_route}\n활동항목: ${transferTarget.activity_type}\n소속회사: ${fmt(transferTarget.company)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const vipMemo = appendGradeAssessmentBlock(baseMemo, transferAssessment, result);
    const vipRecords = readJsonArray<VipRecord>(VIP_DB_STORAGE_KEY);
    const nextVipRecord: VipRecord = {
      id: Date.now(),
      name: transferTarget.name,
      title: transferTarget.title,
      phone: transferTarget.phone,
      intake_route: transferTarget.intake_route,
      company: transferTarget.company,
      management_stage: "리드",
      customer_grade: result.customerGrade,
      memo: vipMemo,
      created_at: now,
      updated_at: now,
    };

    writeJsonArray(VIP_DB_STORAGE_KEY, [nextVipRecord, ...vipRecords]);
    setRecords((items) => items.filter((record) => record.id !== transferTarget.id));
    if (selectedRecord?.id === transferTarget.id) setSelectedRecord(null);
    setTransferTarget(null);
    setTransferError("");
    showToast("VIP활동DB로 이관되었습니다.");
  };

  const deleteRecord = (record: RawCustomerRecord) => {
    if (!window.confirm(`${record.name} 고객을 고객DB에서 삭제하시겠습니까?`)) return;
    setRecords((items) => items.filter((item) => item.id !== record.id));
    if (selectedRecord?.id === record.id) setSelectedRecord(null);
    showToast("고객DB에서 삭제되었습니다.");
  };

  return (
    <main className="premium-page min-h-screen px-4 py-5 md:px-6 xl:px-8">
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
        gap: 8px !important;
        width: 100% !important;
      }
    `}</style>
      <section className="premium-hero mb-5 overflow-hidden p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-[900]"
              style={{
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent-text)",
              }}
            >
              <Database size={14} /> VIP활동DB 발굴용 원천 DB
            </div>
            <h1 className="crm-title">고객DB</h1>
            <p className="crm-subtitle mt-2 max-w-[820px]">
              TM과 콜드톡 활동으로 확보한 원천 고객을 등록하고, 심사 후 VIP활동DB로 이관합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowForm(true)} className="btn-premium btn-primary">
              <Plus size={16} /> 신규고객등록
            </button>
            <button
              type="button"
              onClick={() => {
                setRecords(readJsonArray<RawCustomerRecord>(RAW_DB_STORAGE_KEY).map(normalizeRawRecord));
                showToast("고객DB를 새로고침했습니다.");
              }}
              className="btn-premium btn-ghost"
            >
              <RefreshCcw size={15} /> 새로고침
            </button>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <RouteSummaryCard items={stats.routeCounts} total={stats.total} />
        <ActivitySummaryCard tm={stats.tm} cold={stats.cold} />
      </section>

      <section className="premium-card mb-5 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px]">
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-faint)" }}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="고객명, 연락처, 소속회사, 메모, 활동노트 검색"
              className="crm-search h-11 w-full pl-9 pr-3"
            />
          </label>
          <select
            value={filterRoute}
            onChange={(event) => setFilterRoute(event.target.value)}
            className="crm-search h-11 w-full px-3"
          >
            <option value="">전체 유입경로</option>
            {INTAKE_ROUTES.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))}
          </select>
          <select
            value={filterActivity}
            onChange={(event) => setFilterActivity(event.target.value)}
            className="crm-search h-11 w-full px-3"
          >
            <option value="">전체 활동항목</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="premium-card overflow-hidden">
        <div className="crm-table-wrap max-h-[690px] overflow-auto rounded-[18px]">
          <table className="crm-table customer-db-centered-table customer-db-force-center min-w-[1540px] table-fixed text-center">
            <colgroup>
              <col className="w-[170px]" />
              <col className="w-[110px]" />
              <col className="w-[165px]" />
              <col className="w-[190px]" />
              <col className="w-[140px]" />
              <col className="w-[160px]" />
              <col className="w-[230px]" />
              <col className="w-[170px]" />
              <col className="w-[245px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">고객명</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">직급</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">연락처</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">유입경로</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">활동항목</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">소속회사</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">최근 활동</th>
                <th className="customer-db-th sticky top-0 z-10 text-center align-middle">등록일</th>
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
                      <span
                        className="customer-db-badge rounded-full"
                        style={{
                          background: "var(--accent-subtle)",
                          border: "1px solid var(--accent-border)",
                          color: "var(--accent-text)",
                        }}
                      >
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
                  <td colSpan={9} className="py-12 text-center">
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
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="btn-premium btn-ghost h-9 px-3 text-[12px] disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
              className="btn-premium btn-ghost h-9 px-3 text-[12px] disabled:opacity-40"
            >
              다음
            </button>
          </div>
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
            className="absolute right-0 top-0 flex h-full w-full max-w-[720px] animate-[crmSlideIn_220ms_ease-out] flex-col border-l"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <style jsx global>{`
              @keyframes crmSlideIn {
                from {
                  transform: translateX(100%);
                  opacity: 0.72;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
            `}</style>

            <div className="slide-panel-header flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-[900]"
                    style={{
                      background: "var(--accent-subtle)",
                      border: "1px solid var(--accent-border)",
                      color: "var(--accent-text)",
                    }}
                  >
                    {selectedRecord.intake_route}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-[900]"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-subtle)",
                    }}
                  >
                    {selectedRecord.activity_type}
                  </span>
                </div>
                <h2 className="truncate text-[30px] font-[930] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
                  {fmt(selectedRecord.name)}
                </h2>
                <p className="mt-2 text-sm font-[720]" style={{ color: "var(--text-muted)" }}>
                  {fmt(selectedRecord.title)} · {fmt(selectedRecord.phone)}
                </p>
              </div>

              <button type="button" onClick={() => setSelectedRecord(null)} className="btn-premium btn-secondary h-10 w-10 shrink-0 p-0">
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <section className="premium-card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="crm-card-title">고객 기본정보</p>
                    <p className="crm-tiny mt-1">최근 활동노트와 이관 전 원천 고객 정보를 확인합니다.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => requestTransfer(selectedRecord)} className="btn-premium btn-primary">
                      <ArrowRight size={14} /> VIP활동DB 이관
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRecord(selectedRecord)}
                      className="btn-premium"
                      style={{
                        color: "var(--danger-text)",
                        background: "var(--danger-bg)",
                        border: "1px solid var(--danger-border)",
                      }}
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <DetailBlock label="고객명" value={selectedRecord.name} />
                  <DetailBlock label="직급" value={selectedRecord.title} />
                  <DetailBlock label="연락처" value={selectedRecord.phone} />
                  <DetailBlock label="유입경로" value={selectedRecord.intake_route} badge />
                  <DetailBlock label="활동항목" value={selectedRecord.activity_type} badge />
                  <DetailBlock label="소속회사" value={selectedRecord.company} />
                  <DetailBlock label="등록일" value={dateLabel(selectedRecord.created_at)} />
                  <DetailBlock label="수정일" value={dateLabel(selectedRecord.updated_at)} />
                </div>
              </section>

              <section className="premium-card mt-4 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <MessageCircle size={17} style={{ color: "var(--accent)" }} />
                  <p className="crm-section-title">메모</p>
                </div>
                <div className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  <p className="crm-body whitespace-pre-wrap">{selectedRecord.memo || "등록된 메모가 없습니다."}</p>
                </div>
              </section>

              <section className="premium-card mt-4 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileText size={17} style={{ color: "var(--accent)" }} />
                  <p className="crm-section-title">활동노트</p>
                </div>
                <NoteComposer defaultType={selectedRecord.activity_type} onAdd={(note) => handleAddNote(selectedRecord.id, note)} />
                <div className="mt-4">
                  <NotesList notes={selectedRecord.notes} />
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
                <h2 className="crm-title">고객DB 신규등록</h2>
                <p className="crm-subtitle mt-2">VIP활동DB 발굴을 위한 원천 고객을 등록합니다.</p>
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
                <InputLabel>최초 활동노트</InputLabel>
                <textarea
                  value={form.first_note}
                  onChange={(event) => setForm((current) => ({ ...current, first_note: event.target.value }))}
                  placeholder="TM 또는 콜드톡 활동내용을 입력하세요."
                  rows={6}
                  className="w-full resize-none rounded-[14px] border px-3 py-3 text-[13px] font-semibold leading-7 outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
                />
              </label>
            </div>

            {formError ? (
              <p
                className="mt-4 rounded-[14px] border px-4 py-3 text-[13px] font-[800]"
                style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.28)", color: "#ef4444" }}
              >
                {formError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button type="button" onClick={resetForm} className="btn-premium btn-ghost">
                취소
              </button>
              <button type="button" onClick={handleSave} className="btn-premium btn-primary">
                <Save size={15} /> 고객DB 등록
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
          onClose={() => setTransferTarget(null)}
          onConfirm={confirmTransfer}
          error={transferError}
        />
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-5 right-5 z-[90] rounded-[16px] border px-4 py-3 text-[13px] font-[900] shadow-xl"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-strong)" }}
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}
