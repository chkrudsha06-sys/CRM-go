"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRightCircle,
  ClipboardList,
  Database,
  FileText,
  Filter,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Search,
  Send,
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

type RawCustomerRecord = {
  id: number;
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  memo: string;
  activity_notes: ActivityNote[];
  created_at: string;
  updated_at: string;
};

type ActivityType = "TM" | "콜드톡";

type ActivityNote = {
  id: number;
  type: ActivityType;
  content: string;
  created_at: string;
};

type CustomerFormState = {
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  memo: string;
};

type ActivityFormState = {
  type: ActivityType;
  content: string;
};

const RAW_CUSTOMER_STORAGE_KEY = "crm_go_raw_customer_db_local_v1";
const VIP_CUSTOMER_STORAGE_KEY = "crm_go_customer_db_local_v2";

const TITLE_OPTIONS = ["본부장", "팀장", "팀원"];
const INTAKE_ROUTE_OPTIONS = [
  "TM대상DB",
  "콜드톡대상DB",
  "분양의신DB",
  "컨설턴트VIP DB",
  "완판트럭",
  "분양라인",
  "분양회MGM",
  "대협팀활동",
  "기타",
];

const EMPTY_FORM: CustomerFormState = {
  name: "",
  title: "",
  phone: "",
  intake_route: "",
  company: "",
  memo: "",
};

const EMPTY_ACTIVITY_FORM: ActivityFormState = {
  type: "TM",
  content: "",
};

function nowIso() {
  return new Date().toISOString();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}.${String(date.getDate()).padStart(2, "0")}`;
}

function normalizePhone(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function makeId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function loadRawCustomers() {
  if (typeof window === "undefined") return [] as RawCustomerRecord[];
  const rows = safeJsonParse<RawCustomerRecord[]>(
    window.localStorage.getItem(RAW_CUSTOMER_STORAGE_KEY),
    [],
  );
  return Array.isArray(rows)
    ? rows.map((row) => ({
        ...row,
        activity_notes: Array.isArray(row.activity_notes)
          ? row.activity_notes
          : [],
      }))
    : [];
}

function saveRawCustomers(rows: RawCustomerRecord[]) {
  window.localStorage.setItem(RAW_CUSTOMER_STORAGE_KEY, JSON.stringify(rows));
}

function loadVipCustomers() {
  if (typeof window === "undefined") return [] as Record<string, unknown>[];
  const rows = safeJsonParse<Record<string, unknown>[]>(
    window.localStorage.getItem(VIP_CUSTOMER_STORAGE_KEY),
    [],
  );
  return Array.isArray(rows) ? rows : [];
}

function saveVipCustomers(rows: Record<string, unknown>[]) {
  window.localStorage.setItem(VIP_CUSTOMER_STORAGE_KEY, JSON.stringify(rows));
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block text-[12px] font-[900] text-slate-500">
      {children}
    </span>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        {icon ? (
          <span className="absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-slate-400">
            {icon}
          </span>
        ) : null}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-12 w-full rounded-[16px] border border-slate-200 bg-white ${
            icon ? "pl-10" : "pl-4"
          } pr-4 text-sm font-[800] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100`}
        />
      </div>
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm font-[800] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      >
        <option value="">선택</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const styles: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-[900] ${
        styles[tone] || styles.slate
      }`}
    >
      {children}
    </span>
  );
}

export default function CustomerDbPage() {
  const [records, setRecords] = useState<RawCustomerRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerFormState>({ ...EMPTY_FORM });
  const [selectedRecord, setSelectedRecord] = useState<RawCustomerRecord | null>(
    null,
  );
  const [activityForm, setActivityForm] = useState<ActivityFormState>({
    ...EMPTY_ACTIVITY_FORM,
  });
  const [transferRecord, setTransferRecord] = useState<RawCustomerRecord | null>(
    null,
  );
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeAssessment, setGradeAssessment] = useState<GradeAssessmentForm>({
    ...EMPTY_GRADE_ASSESSMENT,
  });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRecords(loadRawCustomers());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveRawCustomers(records);
  }, [records, loaded]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = keyword
        ? [
            record.name,
            record.title,
            record.phone,
            record.intake_route,
            record.company,
            record.memo,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      const matchesRoute = filterRoute
        ? record.intake_route === filterRoute
        : true;
      return matchesKeyword && matchesRoute;
    });
  }, [records, search, filterRoute]);

  const dashboard = useMemo(() => {
    const total = records.length;
    const tm = records.filter((record) =>
      record.activity_notes.some((note) => note.type === "TM"),
    ).length;
    const coldtalk = records.filter((record) =>
      record.activity_notes.some((note) => note.type === "콜드톡"),
    ).length;
    const ready = records.filter((record) => record.activity_notes.length > 0)
      .length;
    return { total, tm, coldtalk, ready };
  }, [records]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setError("");
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (record: RawCustomerRecord) => {
    setForm({
      name: record.name,
      title: record.title,
      phone: record.phone,
      intake_route: record.intake_route,
      company: record.company,
      memo: stripGradeAssessmentBlock(record.memo),
    });
    setEditingId(record.id);
    setError("");
    setShowForm(true);
  };

  const handleSaveCustomer = () => {
    if (!form.name.trim()) {
      setError("고객명을 입력해주세요.");
      return;
    }
    if (!form.phone.trim()) {
      setError("연락처를 입력해주세요.");
      return;
    }

    const cleanMemo = stripGradeAssessmentBlock(form.memo).trim();
    const phone = normalizePhone(form.phone.trim());

    if (editingId) {
      setRecords((prev) =>
        prev.map((record) =>
          record.id === editingId
            ? {
                ...record,
                name: form.name.trim(),
                title: form.title,
                phone,
                intake_route: form.intake_route,
                company: form.company.trim(),
                memo: cleanMemo,
                updated_at: nowIso(),
              }
            : record,
        ),
      );
      setSelectedRecord((prev) =>
        prev && prev.id === editingId
          ? {
              ...prev,
              name: form.name.trim(),
              title: form.title,
              phone,
              intake_route: form.intake_route,
              company: form.company.trim(),
              memo: cleanMemo,
              updated_at: nowIso(),
            }
          : prev,
      );
      showToast("고객DB가 수정되었습니다.");
    } else {
      const record: RawCustomerRecord = {
        id: makeId(),
        name: form.name.trim(),
        title: form.title,
        phone,
        intake_route: form.intake_route,
        company: form.company.trim(),
        memo: cleanMemo,
        activity_notes: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      setRecords((prev) => [record, ...prev]);
      showToast("고객DB가 등록되었습니다.");
    }

    setShowForm(false);
    resetForm();
  };

  const handleDeleteCustomer = (record: RawCustomerRecord) => {
    const ok = window.confirm("고객DB에서 해당 데이터를 삭제하시겠습니까?");
    if (!ok) return;
    setRecords((prev) => prev.filter((item) => item.id !== record.id));
    if (selectedRecord?.id === record.id) setSelectedRecord(null);
    showToast("고객DB가 삭제되었습니다.");
  };

  const handleSaveActivityNote = () => {
    if (!selectedRecord) return;
    if (!activityForm.content.trim()) {
      showToast("활동노트 내용을 입력해주세요.");
      return;
    }

    const note: ActivityNote = {
      id: makeId(),
      type: activityForm.type,
      content: activityForm.content.trim(),
      created_at: nowIso(),
    };

    setRecords((prev) =>
      prev.map((record) =>
        record.id === selectedRecord.id
          ? {
              ...record,
              activity_notes: [note, ...record.activity_notes],
              updated_at: nowIso(),
            }
          : record,
      ),
    );
    setSelectedRecord((prev) =>
      prev
        ? {
            ...prev,
            activity_notes: [note, ...prev.activity_notes],
            updated_at: nowIso(),
          }
        : prev,
    );
    setActivityForm({ ...EMPTY_ACTIVITY_FORM });
    showToast("활동노트가 저장되었습니다.");
  };

  const startTransfer = (record: RawCustomerRecord) => {
    const ok = window.confirm("VIP활동 DB로 이관하겠습니까?");
    if (!ok) return;

    const reviewOk = window.confirm("심사를 진행하겠습니까?");
    if (!reviewOk) return;

    setTransferRecord(record);
    setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
    setShowGradeModal(true);
  };

  const completeTransfer = () => {
    if (!transferRecord) return;
    if (!hasGradeAssessmentInput(gradeAssessment)) {
      setError("VIP활동 DB 이관 전 고객등급 자동판정을 입력해주세요.");
      return;
    }

    const result = calculateCustomerGrade(
      gradeAssessment,
      transferRecord.title || "팀장",
    );
    const cleanMemo = stripGradeAssessmentBlock(transferRecord.memo).trim();
    const noteSummary = transferRecord.activity_notes
      .map(
        (note) =>
          `[${note.type}] ${formatDate(note.created_at)} ${note.content}`,
      )
      .join("\n");
    const vipMemoBase = [cleanMemo, noteSummary ? `[고객DB 활동노트]\n${noteSummary}` : ""]
      .filter(Boolean)
      .join("\n\n");
    const memoWithAssessment = appendGradeAssessmentBlock(
      vipMemoBase,
      gradeAssessment,
      result,
    );

    const vipRecord = {
      id: makeId(),
      name: transferRecord.name,
      title: transferRecord.title,
      phone: transferRecord.phone,
      intake_route: transferRecord.intake_route,
      company: transferRecord.company,
      management_stage: "리드",
      customer_grade: result.customerGrade,
      memo: memoWithAssessment,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const vipRows = loadVipCustomers();
    saveVipCustomers([vipRecord, ...vipRows]);

    setRecords((prev) => prev.filter((record) => record.id !== transferRecord.id));
    if (selectedRecord?.id === transferRecord.id) setSelectedRecord(null);
    setTransferRecord(null);
    setShowGradeModal(false);
    setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
    setError("");
    showToast("VIP활동 DB로 이관되었습니다.");
  };

  return (
    <main className="customer-db-page min-h-screen px-5 py-6 md:px-8">
      <style jsx global>{`
        .customer-db-page {
          background: var(--bg);
          color: var(--text);
        }
        .customer-db-page .bg-white {
          background: var(--surface) !important;
        }
        .customer-db-page .bg-slate-50 {
          background: var(--surface-2) !important;
        }
        .customer-db-page .bg-slate-950 {
          background: var(--text-strong) !important;
          color: var(--surface) !important;
        }
        .customer-db-page .border-slate-100,
        .customer-db-page .border-slate-200 {
          border-color: var(--border) !important;
        }
        .customer-db-page .text-slate-950,
        .customer-db-page .text-slate-900,
        .customer-db-page .text-slate-800,
        .customer-db-page .text-slate-700 {
          color: var(--text-strong) !important;
        }
        .customer-db-page .text-slate-600,
        .customer-db-page .text-slate-500,
        .customer-db-page .text-slate-400 {
          color: var(--text-subtle) !important;
        }
        .customer-db-page input,
        .customer-db-page select,
        .customer-db-page textarea {
          background: var(--surface-2) !important;
          border-color: var(--border) !important;
          color: var(--text) !important;
        }
        .customer-db-page input::placeholder,
        .customer-db-page textarea::placeholder {
          color: var(--text-muted) !important;
        }
        .customer-db-page input:focus,
        .customer-db-page select:focus,
        .customer-db-page textarea:focus {
          border-color: var(--accent-border) !important;
          box-shadow: 0 0 0 4px var(--accent-bg) !important;
        }
        .customer-db-page .hover\:bg-slate-50:hover {
          background: var(--surface-3) !important;
        }
        .customer-db-page .shadow-sm {
          box-shadow: var(--shadow-sm) !important;
        }
        .customer-db-page .shadow-xl,
        .customer-db-page .shadow-2xl {
          box-shadow: var(--shadow-lg) !important;
        }
        .customer-db-page .bg-violet-50 {
          background: var(--accent-bg) !important;
        }
        .customer-db-page .border-violet-200,
        .customer-db-page .border-violet-300 {
          border-color: var(--accent-border) !important;
        }
        .customer-db-page .text-violet-600,
        .customer-db-page .text-violet-700 {
          color: var(--accent-text) !important;
        }
        .customer-db-page .bg-blue-50 {
          background: rgba(59, 130, 246, 0.12) !important;
        }
        .customer-db-page .border-blue-200 {
          border-color: rgba(59, 130, 246, 0.28) !important;
        }
        .customer-db-page .text-blue-500,
        .customer-db-page .text-blue-700 {
          color: #3b82f6 !important;
        }
        .customer-db-page .bg-emerald-50 {
          background: rgba(16, 185, 129, 0.12) !important;
        }
        .customer-db-page .border-emerald-200 {
          border-color: rgba(16, 185, 129, 0.28) !important;
        }
        .customer-db-page .text-emerald-500,
        .customer-db-page .text-emerald-700 {
          color: #10b981 !important;
        }
        .customer-db-page .bg-amber-50 {
          background: rgba(245, 158, 11, 0.14) !important;
        }
        .customer-db-page .border-amber-200 {
          border-color: rgba(245, 158, 11, 0.3) !important;
        }
        .customer-db-page .text-amber-500,
        .customer-db-page .text-amber-600,
        .customer-db-page .text-amber-700 {
          color: #f59e0b !important;
        }
        .customer-db-page .bg-red-50 {
          background: rgba(239, 68, 68, 0.12) !important;
        }
        .customer-db-page .border-red-200 {
          border-color: rgba(239, 68, 68, 0.28) !important;
        }
        .customer-db-page .text-red-600 {
          color: #ef4444 !important;
        }
      `}</style>
      {toast ? (
        <div className="fixed right-5 top-5 z-[80] rounded-[16px] bg-slate-950 px-4 py-3 text-sm font-[900] text-white shadow-xl">
          {toast}
        </div>
      ) : null}

      <section className="mb-5 rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-[900] text-violet-700">
              <Database size={14} /> 고객DB
            </div>
            <h1 className="text-3xl font-[950] tracking-[-0.05em] text-slate-950">
              고객DB
            </h1>
            <p className="mt-2 text-sm font-[700] text-slate-500">
              TM·콜드톡 대상 DB를 등록하고 활동 후 VIP활동 DB로 이관하는
              전처리 공간입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 text-sm font-[950] text-white shadow-lg shadow-violet-200/70 transition hover:-translate-y-0.5"
          >
            <Plus size={16} /> 고객DB 등록
          </button>
        </div>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-[900] text-slate-400">전체 DB</p>
          <p className="mt-2 text-3xl font-[950] text-slate-950">{dashboard.total}</p>
        </div>
        <div className="rounded-[20px] border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-[900] text-blue-500">TM 활동</p>
          <p className="mt-2 text-3xl font-[950] text-blue-700">{dashboard.tm}</p>
        </div>
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-[900] text-emerald-500">콜드톡 활동</p>
          <p className="mt-2 text-3xl font-[950] text-emerald-700">
            {dashboard.coldtalk}
          </p>
        </div>
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-[900] text-amber-600">이관 준비</p>
          <p className="mt-2 text-3xl font-[950] text-amber-700">{dashboard.ready}</p>
        </div>
      </section>

      <section className="mb-5 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="고객명, 연락처, 회사, 메모 검색"
              className="h-12 w-full rounded-[16px] border border-slate-200 bg-white pl-11 pr-4 text-sm font-[800] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            />
          </label>
          <label className="relative block">
            <Filter
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={filterRoute}
              onChange={(event) => setFilterRoute(event.target.value)}
              className="h-12 w-full rounded-[16px] border border-slate-200 bg-white pl-11 pr-4 text-sm font-[800] text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            >
              <option value="">전체 유입경로</option>
              {INTAKE_ROUTE_OPTIONS.map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.1fr_120px_150px_150px_1.2fr_190px] border-b border-slate-200 px-4 py-3 text-xs font-[950] text-slate-400">
          <span>고객명</span>
          <span>직급</span>
          <span>연락처</span>
          <span>유입경로</span>
          <span>소속회사</span>
          <span className="text-center">관리</span>
        </div>
        <div className="max-h-[620px] overflow-y-auto">
          {filteredRecords.length ? (
            filteredRecords.map((record) => (
              <div
                key={record.id}
                className="grid grid-cols-[1.1fr_120px_150px_150px_1.2fr_190px] items-center border-b border-slate-100 px-4 py-3 text-sm font-[800] text-slate-700 last:border-b-0 hover:bg-slate-50"
              >
                <button
                  type="button"
                  onClick={() => setSelectedRecord(record)}
                  className="text-left font-[950] text-slate-950 hover:text-violet-600"
                >
                  {record.name}
                </button>
                <span>{record.title || "-"}</span>
                <span>{record.phone || "-"}</span>
                <span>
                  <Badge tone="violet">{record.intake_route || "미지정"}</Badge>
                </span>
                <span className="truncate pr-4">{record.company || "-"}</span>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(record)}
                    className="rounded-[12px] border border-slate-200 px-3 py-2 text-xs font-[900] text-slate-600 hover:bg-slate-50"
                  >
                    상세
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransfer(record)}
                    className="rounded-[12px] bg-slate-950 px-3 py-2 text-xs font-[900] text-white hover:bg-violet-600"
                  >
                    VIP 이관
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <Database size={34} className="text-slate-300" />
              <p className="text-sm font-[900] text-slate-500">
                등록된 고객DB가 없습니다.
              </p>
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-[14px] bg-slate-950 px-4 py-2 text-sm font-[900] text-white"
              >
                고객DB 등록하기
              </button>
            </div>
          )}
        </div>
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-[950] tracking-[-0.04em] text-slate-950">
                  {editingId ? "고객DB 수정" : "고객DB 등록"}
                </h2>
                <p className="mt-1 text-sm font-[700] text-slate-500">
                  VIP활동 DB로 이관하기 전 TM·콜드톡 대상 정보를 정리합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            {error ? (
              <div className="mb-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-[800] text-red-600">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="고객명"
                value={form.name}
                onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder="고객명 입력"
                icon={<UserRound size={16} />}
              />
              <SelectInput
                label="직급"
                value={form.title}
                options={TITLE_OPTIONS}
                onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
              />
              <TextInput
                label="연락처"
                value={form.phone}
                onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                placeholder="010-0000-0000"
                icon={<Phone size={16} />}
              />
              <SelectInput
                label="유입경로"
                value={form.intake_route}
                options={INTAKE_ROUTE_OPTIONS}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, intake_route: value }))
                }
              />
              <TextInput
                label="소속회사"
                value={form.company}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, company: value }))
                }
                placeholder="소속회사 입력"
              />
              <label className="block md:col-span-2">
                <FieldLabel>메모</FieldLabel>
                <textarea
                  value={form.memo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, memo: event.target.value }))
                  }
                  placeholder="고객 발굴 과정에서 확인한 메모를 입력하세요."
                  className="min-h-[130px] w-full resize-none rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-[700] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-[14px] border border-slate-200 px-4 py-3 text-sm font-[900] text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveCustomer}
                className="inline-flex items-center gap-2 rounded-[14px] bg-slate-950 px-5 py-3 text-sm font-[950] text-white hover:bg-violet-600"
              >
                <Save size={16} /> 저장
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRecord ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/35 backdrop-blur-sm">
          <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-[950] tracking-[-0.04em] text-slate-950">
                    {selectedRecord.name}
                  </h2>
                  {selectedRecord.title ? <Badge>{selectedRecord.title}</Badge> : null}
                  {selectedRecord.intake_route ? (
                    <Badge tone="violet">{selectedRecord.intake_route}</Badge>
                  ) : null}
                </div>
                <p className="text-sm font-[800] text-slate-500">
                  {selectedRecord.phone || "연락처 없음"} · {selectedRecord.company || "소속회사 없음"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <section className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-[950] text-slate-900">
                  <FileText size={16} /> 메모
                </div>
                <p className="min-h-[130px] whitespace-pre-wrap rounded-[16px] bg-white p-4 text-sm font-[700] leading-6 text-slate-600">
                  {stripGradeAssessmentBlock(selectedRecord.memo) || "등록된 메모가 없습니다."}
                </p>
              </section>

              <section className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-[950] text-slate-900">
                  <ClipboardList size={16} /> 활동노트
                </div>
                <div className="space-y-2">
                  {selectedRecord.activity_notes.length ? (
                    selectedRecord.activity_notes.map((note) => (
                      <div key={note.id} className="rounded-[16px] bg-white p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge tone={note.type === "TM" ? "blue" : "emerald"}>
                            {note.type}
                          </Badge>
                          <span className="text-[11px] font-[800] text-slate-400">
                            {formatDate(note.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm font-[700] leading-6 text-slate-600">
                          {note.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[16px] bg-white p-4 text-sm font-[800] text-slate-400">
                      등록된 활동노트가 없습니다.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="mb-5 rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-[950] text-slate-900">
                <MessageCircle size={16} /> 활동노트 작성
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(["TM", "콜드톡"] as ActivityType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setActivityForm((prev) => ({ ...prev, type }))
                    }
                    className={`rounded-full border px-4 py-2 text-sm font-[950] transition ${
                      activityForm.type === type
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <textarea
                value={activityForm.content}
                onChange={(event) =>
                  setActivityForm((prev) => ({ ...prev, content: event.target.value }))
                }
                placeholder="TM 또는 콜드톡 활동 내용을 입력하세요."
                className="min-h-[110px] w-full resize-none rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-[700] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveActivityNote}
                  className="inline-flex items-center gap-2 rounded-[14px] bg-slate-950 px-4 py-3 text-sm font-[950] text-white hover:bg-violet-600"
                >
                  <Send size={15} /> 활동노트 저장
                </button>
              </div>
            </section>

            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(selectedRecord)}
                  className="rounded-[14px] border border-slate-200 px-4 py-3 text-sm font-[900] text-slate-600 hover:bg-slate-50"
                >
                  고객정보 수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCustomer(selectedRecord)}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-red-200 px-4 py-3 text-sm font-[900] text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} /> 삭제
                </button>
              </div>
              <button
                type="button"
                onClick={() => startTransfer(selectedRecord)}
                className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 text-sm font-[950] text-white shadow-lg shadow-violet-200/70"
              >
                <ArrowRightCircle size={16} /> VIP활동 DB 이관
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {showGradeModal && transferRecord ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-[950] tracking-[-0.04em] text-slate-950">
                  VIP활동 DB 이관 심사
                </h2>
                <p className="mt-1 text-sm font-[700] text-slate-500">
                  {transferRecord.name} {transferRecord.title ? `· ${transferRecord.title}` : ""} 고객의 등급을 심사한 뒤 VIP활동 DB로 이관합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGradeModal(false);
                  setTransferRecord(null);
                  setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
                  setError("");
                }}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            {error ? (
              <div className="mb-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-[800] text-red-600">
                {error}
              </div>
            ) : null}

            <CustomerGradeAssessment
              value={gradeAssessment}
              title={transferRecord.title || "팀장"}
              onChange={setGradeAssessment}
            />

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGradeModal(false);
                  setTransferRecord(null);
                  setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
                  setError("");
                }}
                className="rounded-[14px] border border-slate-200 px-4 py-3 text-sm font-[900] text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={completeTransfer}
                className="inline-flex items-center gap-2 rounded-[14px] bg-slate-950 px-5 py-3 text-sm font-[950] text-white hover:bg-violet-600"
              >
                <ArrowRightCircle size={16} /> 심사 완료 후 이관
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
