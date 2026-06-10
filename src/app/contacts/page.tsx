"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Database,
  Filter,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import CustomerGradeAssessment from "@/components/CustomerGradeAssessment";
import {
  appendGradeAssessmentBlock,
  calculateCustomerGrade,
  CUSTOMER_GRADE_OPTIONS,
  EMPTY_GRADE_ASSESSMENT,
  MANAGEMENT_STAGE_OPTIONS,
  hasGradeAssessmentInput,
  parseGradeAssessmentBlock,
  stripGradeAssessmentBlock,
  type GradeAssessmentForm,
} from "@/lib/customerGrade";

type CustomerDbRecord = {
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
  crm_db_source?: string | null;
  vip_transferred_at?: string | null;
  assigned_to?: string | null;
};

type FormState = {
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  management_stage: string;
  company: string;
  memo: string;
};

type ContactNote = {
  id: number;
  contact_id: number;
  note_date: string | null;
  content: string;
  author: string | null;
  created_at: string;
  updated_at: string | null;
};

const STORAGE_KEY = "crm_go_customer_db_local_v2";
const PIPELINE_STORAGE_KEY = "crm_go_pipeline3_clean_v1";
const VIP_DB_SOURCE = "vip_activity";
const CUSTOMER_DB_SOURCE = "customer_db";
const DEFAULT_ASSIGNED_TO = "조계현";
const VIP_SELECT_FIELDS =
  "id,name,title,phone,intake_route,company,management_stage,customer_grade,memo,created_at,updated_at,crm_db_source,vip_transferred_at,assigned_to";

function normalizePhoneDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function mergeRecordsByPhone(
  localRecords: CustomerDbRecord[],
  remoteRecords: CustomerDbRecord[],
) {
  const merged = new Map<string, CustomerDbRecord>();

  [...localRecords, ...remoteRecords].forEach((record) => {
    const normalized = normalizeRecordGrade(record);
    const key = normalizePhoneDigits(normalized.phone) || String(normalized.id);
    const previous = merged.get(key);

    if (!previous) {
      merged.set(key, normalized);
      return;
    }

    const previousTime = new Date(previous.updated_at || previous.created_at).getTime();
    const currentTime = new Date(normalized.updated_at || normalized.created_at).getTime();

    merged.set(key, currentTime >= previousTime ? normalized : previous);
  });

  return Array.from(merged.values()).sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime(),
  );
}


const INTAKE_ROUTES = [
  "분양의신DB",
  "컨설턴트VIP DB",
  "완판트럭",
  "분양라인",
  "분양회MGM",
  "대협팀활동",
];
const TITLE_OPTIONS = ["본부장", "팀장", "팀원"];
const UNREVIEWED_GRADE = "심사미진행";

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  phone: "",
  intake_route: "",
  management_stage: "",
  company: "",
  memo: "",
};

function fmt(value?: string | null) {
  return value && value.trim() ? value : "-";
}

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

function getRecordDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameMonth(date: Date | null, baseDate: Date) {
  if (!date) return false;
  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth()
  );
}

function monthLabel(baseDate: Date) {
  return `${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`;
}

function badgeClass(value?: string | null) {
  if (value === "마스터") return "grade-master";
  if (value === "챌린저") return "grade-challenger";
  if (value === "브론즈") return "grade-bronze";
  if (value === "추가 심사 후보") return "grade-review";
  if (value === UNREVIEWED_GRADE) return "grade-hold";
  if (value === "판정 보류") return "grade-hold";
  if (value === "분양의신DB") return "badge-purple";
  if (value === "컨설턴트VIP DB") return "badge-info";
  if (value === "완판트럭") return "badge-warning";
  if (value === "분양라인") return "badge-cyan";
  if (value === "분양회MGM") return "badge-success";
  if (value === "대협팀활동") return "badge-info";
  if (value === "리드") return "badge-info";
  if (value === "프로스펙팅") return "badge-warning";
  if (value === "딜클로징" || value === "딜크로징") return "badge-danger";
  if (value === "리텐션") return "badge-success";
  return "badge-muted";
}

function SelectBox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="crm-search h-12 w-full appearance-none px-3 pr-9"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--text-faint)" }}
      />
    </div>
  );
}

function recordAssessment(record: CustomerDbRecord) {
  return parseGradeAssessmentBlock(record.memo);
}

function isRecordUnreviewed(record: CustomerDbRecord) {
  const storedGrade = String(record.customer_grade || "").trim();

  if (storedGrade && storedGrade !== UNREVIEWED_GRADE) {
    return false;
  }

  return !hasGradeAssessmentInput(recordAssessment(record));
}

function displayCustomerGrade(record: CustomerDbRecord) {
  const storedGrade = String(record.customer_grade || "").trim();

  if (storedGrade && storedGrade !== UNREVIEWED_GRADE) {
    return storedGrade;
  }

  const assessment = recordAssessment(record);

  if (hasGradeAssessmentInput(assessment)) {
    return calculateCustomerGrade(assessment, record.title).customerGrade;
  }

  return UNREVIEWED_GRADE;
}

function normalizeRecordGrade(record: CustomerDbRecord): CustomerDbRecord {
  const assessment = recordAssessment(record);
  const cleanMemo = stripGradeAssessmentBlock(record.memo);
  const hasAssessment = hasGradeAssessmentInput(assessment);

  if (!hasAssessment) {
    const storedGrade = String(record.customer_grade || "").trim();
    return {
      ...record,
      customer_grade:
        storedGrade && storedGrade !== "-" ? storedGrade : UNREVIEWED_GRADE,
      memo: cleanMemo,
    };
  }

  const calculatedGrade = calculateCustomerGrade(assessment, record.title).customerGrade;
  const storedGrade = String(record.customer_grade || "").trim();

  return {
    ...record,
    customer_grade:
      storedGrade && storedGrade !== UNREVIEWED_GRADE
        ? storedGrade
        : calculatedGrade,
  };
}

function TextInput({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
}) {
  return (
    <label className="relative block min-w-0">
      {icon ? (
        <span
          className="absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center"
          style={{ color: "var(--text-faint)" }}
        >
          {icon}
        </span>
      ) : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`crm-search h-12 w-full ${icon ? "pl-9" : "pl-3"} pr-3`}
      />
    </label>
  );
}

export default function ContactsPage() {
  const [records, setRecords] = useState<CustomerDbRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [gradeAssessment, setGradeAssessment] = useState<GradeAssessmentForm>({
    ...EMPTY_GRADE_ASSESSMENT,
  });
  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CustomerDbRecord | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterGrade, setFilterGrade] = useState("");

  useEffect(() => {
    let alive = true;

    const loadRecords = async () => {
      try {
        // 과거 VIP활동DB가 사용하던 브라우저 캐시입니다.
        // 이 값을 읽으면 Supabase에서 삭제한 고객도 다시 살아나므로 더 이상 사용하지 않습니다.
        window.localStorage.removeItem(STORAGE_KEY);

        const { data, error } = await supabase
          .from("contacts")
          .select(VIP_SELECT_FIELDS)
          .eq("crm_db_source", VIP_DB_SOURCE)
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const remoteRecords = Array.isArray(data)
          ? (data as CustomerDbRecord[]).map(normalizeRecordGrade)
          : [];

        if (!alive) return;
        setRecords(remoteRecords);
      } catch (error) {
        console.error("VIP활동DB Supabase 불러오기 실패", error);
        if (alive) {
          setRecords([]);
          setToast("VIP활동DB 불러오기 실패: Supabase SQL 적용 여부를 확인해주세요.");
        }
      } finally {
        if (alive) setLoaded(true);
      }
    };

    loadRecords();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // 이전 버전의 localStorage 복원 로직 때문에 삭제한 고객이 되살아나는 문제가 있어
    // VIP활동DB는 Supabase 단일 기준으로만 운영합니다.
    window.localStorage.removeItem(STORAGE_KEY);
  }, [loaded, records]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const dashboardBaseDate = useMemo(() => new Date(), []);
  const currentMonthLabel = useMemo(
    () => monthLabel(dashboardBaseDate),
    [dashboardBaseDate],
  );

  const monthRecords = useMemo(() => {
    return records.filter((record) =>
      isSameMonth(getRecordDate(record.created_at), dashboardBaseDate),
    );
  }, [records, dashboardBaseDate]);

  const routeStats = useMemo(() => {
    const monthlyTotal = monthRecords.length;
    return INTAKE_ROUTES.map((route) => {
      const count = monthRecords.filter(
        (record) => record.intake_route === route,
      ).length;
      const percent = monthlyTotal ? Math.round((count / monthlyTotal) * 100) : 0;

      return {
        route,
        count,
        percent,
      };
    });
  }, [monthRecords]);

  const gradeStats = useMemo(() => {
    return CUSTOMER_GRADE_OPTIONS.map((grade) => ({
      grade,
      count: monthRecords.filter((record) => displayCustomerGrade(record) === grade)
        .length,
    }));
  }, [monthRecords]);

  const unreviewedCount = useMemo(
    () => monthRecords.filter(isRecordUnreviewed).length,
    [monthRecords],
  );

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return records.filter((record) => {
      const cleanMemo = stripGradeAssessmentBlock(record.memo);
      const matchesKeyword = !keyword
        ? true
        : [
            record.name,
            record.title,
            record.phone,
            record.intake_route,
            record.management_stage,
            record.company,
            displayCustomerGrade(record),
            cleanMemo,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);

      return (
        matchesKeyword &&
        (!filterRoute || record.intake_route === filterRoute) &&
        (!filterStage || record.management_stage === filterStage) &&
        (!filterGrade || displayCustomerGrade(record) === filterGrade)
      );
    });
  }, [records, search, filterRoute, filterStage, filterGrade]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
    setFormError("");
    setEditId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
    setFormError("");
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (record: CustomerDbRecord) => {
    setForm({
      name: record.name,
      title: record.title,
      phone: record.phone,
      intake_route: record.intake_route,
      management_stage: record.management_stage,
      company: record.company || "",
      memo: stripGradeAssessmentBlock(record.memo),
    });
    setGradeAssessment(parseGradeAssessmentBlock(record.memo));
    setFormError("");
    setEditId(record.id);
    setShowForm(true);
  };

  const saveRecord = async () => {
    setFormError("");

    if (!form.name.trim()) {
      const message = "고객명을 입력해주세요.";
      setFormError(message);
      showToast(message);
      return;
    }
    if (!form.phone.trim()) {
      const message = "연락처를 입력해주세요.";
      setFormError(message);
      showToast(message);
      return;
    }

    const now = new Date().toISOString();
    const hasAssessment = hasGradeAssessmentInput(gradeAssessment);
    const gradeResult = calculateCustomerGrade(gradeAssessment, form.title);
    const customerGrade = hasAssessment
      ? gradeResult.customerGrade
      : UNREVIEWED_GRADE;
    const cleanMemo = stripGradeAssessmentBlock(form.memo);
    const memoWithGrade = hasAssessment
      ? appendGradeAssessmentBlock(cleanMemo, gradeAssessment, gradeResult)
      : cleanMemo;

    const payload = {
      name: form.name.trim(),
      title: form.title.trim(),
      phone: form.phone.trim(),
      intake_route: form.intake_route,
      management_stage: form.management_stage || "리드",
      company: form.company.trim() || "-",
      customer_grade: customerGrade,
      memo: memoWithGrade,
      crm_db_source: VIP_DB_SOURCE,
      vip_transferred_at: now,
      assigned_to: DEFAULT_ASSIGNED_TO,
      updated_at: now,
    };

    try {
      if (editId) {
        const { data, error } = await supabase
          .from("contacts")
          .update(payload)
          .eq("id", editId)
          .eq("crm_db_source", VIP_DB_SOURCE)
          .select(VIP_SELECT_FIELDS)
          .single();

        if (error) throw error;

        const savedRecord = normalizeRecordGrade(data as CustomerDbRecord);
        setRecords((prev) =>
          prev.map((record) => (record.id === editId ? savedRecord : record)),
        );
        setSelectedRecord((current) =>
          current?.id === editId ? savedRecord : current,
        );
        showToast("VIP활동DB 정보가 저장되었습니다.");
        resetForm();
        return;
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert({ ...payload, created_at: now })
        .select(VIP_SELECT_FIELDS)
        .single();

      if (error) throw error;

      const savedRecord = normalizeRecordGrade(data as CustomerDbRecord);
      setRecords((prev) => [savedRecord, ...prev]);
      setSelectedRecord(savedRecord);
      showToast("VIP활동DB에 등록되었습니다.");
      resetForm();
    } catch (error) {
      console.error("VIP활동DB 저장 실패", error);
      const message = "VIP활동DB 저장 실패: Supabase SQL 적용 여부를 확인해주세요.";
      setFormError(message);
      showToast(message);
    }
  };

  const deleteRecord = async (id: number) => {
    const ok = window.confirm(
      "선택한 고객을 VIP활동DB에서 삭제하면 파이프라인3에서도 함께 삭제됩니다. 삭제하시겠습니까?",
    );
    if (!ok) return;

    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);

      if (error) throw error;

      try {
        window.localStorage.removeItem(PIPELINE_STORAGE_KEY);
      } catch {}

      setRecords((prev) => prev.filter((record) => record.id !== id));
      if (selectedRecord?.id === id) setSelectedRecord(null);
      showToast("VIP활동DB와 파이프라인3에서 함께 삭제되었습니다.");
    } catch (error) {
      console.error("VIP활동DB 삭제 실패", error);
      const message = error instanceof Error ? error.message : "Supabase DELETE 권한 또는 참조 제약을 확인해주세요.";
      showToast(`VIP활동DB 삭제 실패: ${message}`);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilterRoute("");
    setFilterStage("");
    setFilterGrade("");
  };

  return (
    <>
      <style jsx global>{`
        .grade-master {
          color: #c4b5fd !important;
          background: rgba(124, 58, 237, 0.16) !important;
          border-color: rgba(167, 139, 250, 0.42) !important;
        }

        [data-theme="light"] .grade-master,
        .light .grade-master {
          color: #5b21b6 !important;
          background: rgba(124, 58, 237, 0.1) !important;
          border-color: rgba(124, 58, 237, 0.28) !important;
        }

        .grade-challenger {
          color: #93c5fd !important;
          background: rgba(37, 99, 235, 0.15) !important;
          border-color: rgba(96, 165, 250, 0.38) !important;
        }

        [data-theme="light"] .grade-challenger,
        .light .grade-challenger {
          color: #1d4ed8 !important;
          background: rgba(37, 99, 235, 0.09) !important;
          border-color: rgba(37, 99, 235, 0.24) !important;
        }

        .grade-bronze {
          color: #d97706 !important;
          background: rgba(180, 83, 9, 0.14) !important;
          border-color: rgba(217, 119, 6, 0.34) !important;
        }

        [data-theme="dark"] .grade-bronze,
        .dark .grade-bronze {
          color: #fbbf24 !important;
          background: rgba(146, 64, 14, 0.26) !important;
          border-color: rgba(251, 191, 36, 0.38) !important;
        }

        .grade-review {
          color: #f59e0b !important;
          background: rgba(245, 158, 11, 0.13) !important;
          border-color: rgba(245, 158, 11, 0.34) !important;
        }

        [data-theme="dark"] .grade-review,
        .dark .grade-review {
          color: #fcd34d !important;
          background: rgba(245, 158, 11, 0.18) !important;
          border-color: rgba(252, 211, 77, 0.35) !important;
        }

        .grade-hold {
          color: var(--text-faint) !important;
          background: var(--surface-3) !important;
          border-color: var(--border) !important;
        }
      `}</style>

      <div
        className="premium-page min-h-full w-full overflow-x-hidden"
        style={{
          background:
            "radial-gradient(circle at 82% 0%, rgba(139,124,246,0.12), transparent 28%), radial-gradient(circle at 14% 6%, rgba(34,211,238,0.08), transparent 25%), var(--bg)",
          color: "var(--text)",
        }}
      >
        {toast && (
          <div
            className="fixed right-5 top-5 z-50 rounded-[18px] px-5 py-3 text-sm font-[850]"
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border-2)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {toast}
          </div>
        )}

        <div className="w-full space-y-5 px-4 py-5 sm:px-5 md:px-6 lg:px-7 2xl:px-9">
          <header className="premium-card relative overflow-hidden rounded-[24px] p-4 sm:p-5">
            <div
              className="absolute right-0 top-0 h-56 w-56 rounded-full blur-3xl"
              style={{ background: "var(--accent-bg)" }}
            />
            <div
              className="absolute bottom-0 right-40 h-40 w-40 rounded-full blur-3xl"
              style={{ background: "var(--cyan-bg)" }}
            />

            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-[850] badge-purple">
                  <Database className="h-4 w-4 flex-none" />
                  <span className="truncate">
                    고객DB · 자동등급 판정 적용 · Supabase 미연동 임시 작업영역
                  </span>
                </div>
                <h1 className="crm-title text-[30px] font-[930] leading-tight tracking-[-0.06em] sm:text-[36px]">
                  고객DB
                </h1>
                <p className="crm-subtitle mt-2 max-w-3xl text-sm font-[620] leading-6">
                  고객등록 메뉴 구조를 기반으로, 유입경로별 DB 수취 현황과 자동
                  고객등급 판정 결과를 함께 관리합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreate}
                className="btn-premium btn-primary h-11 shrink-0"
              >
                <Plus className="h-4 w-4" />
                신규고객등록
              </button>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,2.6fr)]">
            <div className="premium-card rounded-[20px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="crm-meta">당월 수취 DB · {currentMonthLabel}</p>
                  <p
                    className="mt-1.5 text-[34px] font-[930] leading-none tracking-[-0.07em] sm:text-[38px]"
                    style={{ color: "var(--text-strong)" }}
                  >
                    {monthRecords.length.toLocaleString()}건
                  </p>
                  <div
                    className="mt-2 text-[11px] font-[850]"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    미심사 {unreviewedCount.toLocaleString()}건
                  </div>
                </div>
                <div className="premium-icon-lg h-10 w-10">
                  <ClipboardList className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {gradeStats.map((item) => (
                  <div
                    key={item.grade}
                    className="rounded-[12px] px-2 py-2 text-center"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p className="crm-tiny truncate">{item.grade}</p>
                    <p
                      className="mt-1 text-base font-[920]"
                      style={{ color: "var(--text-strong)" }}
                    >
                      {item.count}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {routeStats.map((item) => (
                <div
                  key={item.route}
                  className="premium-card min-w-0 rounded-[16px] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="crm-meta truncate">{item.route}</p>
                      <p
                        className="mt-1.5 text-xl font-[930] tracking-[-0.06em]"
                        style={{ color: "var(--text-strong)" }}
                      >
                        {item.count.toLocaleString()}건
                      </p>
                      <p className="crm-tiny mt-1">당월 수취</p>
                    </div>
                    <span
                      className={`badge-premium px-2 py-1 text-[11px] ${badgeClass(item.route)}`}
                    >
                      {item.percent}%
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.percent}%`,
                        background: item.percent
                          ? "linear-gradient(90deg,var(--accent),var(--accent-3))"
                          : "transparent",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="premium-filterbar rounded-[24px] p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(320px,1.5fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_auto]">
              <TextInput
                value={search}
                onChange={setSearch}
                placeholder="고객명, 직급, 연락처, 유입경로, 관리구간, 고객등급, 메모 검색"
                icon={<Search className="h-4 w-4" />}
              />
              <SelectBox
                value={filterRoute}
                onChange={setFilterRoute}
                options={INTAKE_ROUTES}
                placeholder="전체 유입경로"
              />
              <SelectBox
                value={filterStage}
                onChange={setFilterStage}
                options={[...MANAGEMENT_STAGE_OPTIONS]}
                placeholder="전체 관리구간"
              />
              <SelectBox
                value={filterGrade}
                onChange={setFilterGrade}
                options={CUSTOMER_GRADE_OPTIONS}
                placeholder="전체 고객등급"
              />

              <button
                type="button"
                onClick={resetFilters}
                className="btn-premium btn-secondary h-12 xl:w-auto"
              >
                <RefreshCcw className="h-4 w-4" />
                초기화
              </button>
            </div>
          </section>

          <section className="premium-card overflow-hidden rounded-[24px]">
            <div
              className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="premium-icon">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="crm-card-title truncate text-lg font-[900]">
                    고객 DB 리스트
                  </h2>
                  <p className="crm-tiny mt-1">
                    검색 결과 {filteredRecords.length.toLocaleString()}건 / 전체{" "}
                    {records.length.toLocaleString()}건
                  </p>
                </div>
              </div>
              <div className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-[850] badge-muted sm:text-sm">
                <Filter className="h-4 w-4 flex-none" />
                <span className="truncate">
                  고객명 · 직급 · 연락처 · 유입경로 · 관리구간 · 고객등급 기준
                </span>
              </div>
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead>
                  <tr
                    className="text-xs font-[900] uppercase tracking-[0.08em]"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-faint)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <th className="px-5 py-4">고객명</th>
                    <th className="px-5 py-4">직급</th>
                    <th className="px-5 py-4">연락처</th>
                    <th className="px-5 py-4">유입경로</th>
                    <th className="px-5 py-4">관리구간</th>
                    <th className="px-5 py-4">자동등급</th>
                    <th className="px-5 py-4">메모</th>
                    <th className="px-5 py-4">등록일</th>
                    <th className="px-5 py-4 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-20 text-center">
                        <EmptyList onCreate={openCreate} />
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className="cursor-pointer text-sm font-[680] transition hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                        style={{
                          color: "var(--text-muted)",
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-[15px] text-sm font-[930] text-white"
                              style={{
                                background:
                                  "linear-gradient(135deg, var(--accent), var(--accent-3))",
                              }}
                            >
                              {record.name.slice(0, 1)}
                            </div>
                            <div>
                              <p
                                className="font-[900]"
                                style={{ color: "var(--text-strong)" }}
                              >
                                {fmt(record.name)}
                              </p>
                              <p className="crm-tiny">ID {record.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">{fmt(record.title)}</td>
                        <td className="px-5 py-4">
                          <div
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                            style={{
                              background: "var(--surface-2)",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <Phone
                              className="h-3.5 w-3.5"
                              style={{ color: "var(--text-faint)" }}
                            />
                            {fmt(record.phone)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`badge-premium ${badgeClass(record.intake_route)}`}
                          >
                            {fmt(record.intake_route)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`badge-premium ${badgeClass(record.management_stage)}`}
                          >
                            {fmt(record.management_stage)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`badge-premium ${badgeClass(displayCustomerGrade(record))}`}
                          >
                            {fmt(displayCustomerGrade(record))}
                          </span>
                        </td>
                        <td className="max-w-[260px] px-5 py-4">
                          <p
                            className="truncate"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {fmt(stripGradeAssessmentBlock(record.memo))}
                          </p>
                        </td>
                        <td
                          className="px-5 py-4"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {dateLabel(record.created_at)}
                        </td>
                        <td
                          className="px-5 py-4"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <RowActions
                            onEdit={() => openEdit(record)}
                            onDelete={() => deleteRecord(record.id)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 xl:hidden">
              {filteredRecords.length === 0 ? (
                <div className="py-12">
                  <EmptyList onCreate={openCreate} />
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <article
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="premium-card cursor-pointer p-4 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] text-sm font-[930] text-white"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--accent), var(--accent-3))",
                          }}
                        >
                          {record.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="truncate text-base font-[900]"
                            style={{ color: "var(--text-strong)" }}
                          >
                            {fmt(record.name)}
                          </p>
                          <p className="crm-tiny mt-1 truncate">
                            {fmt(record.title)} · {fmt(record.phone)}
                          </p>
                        </div>
                      </div>
                      <div onClick={(event) => event.stopPropagation()}>
                        <RowActions
                          onEdit={() => openEdit(record)}
                          onDelete={() => deleteRecord(record.id)}
                          compact
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`badge-premium ${badgeClass(record.intake_route)}`}
                      >
                        {fmt(record.intake_route)}
                      </span>
                      <span
                        className={`badge-premium ${badgeClass(record.management_stage)}`}
                      >
                        {fmt(record.management_stage)}
                      </span>
                      <span
                        className={`badge-premium ${badgeClass(displayCustomerGrade(record))}`}
                      >
                        {fmt(displayCustomerGrade(record))}
                      </span>
                    </div>

                    <p
                      className="mt-4 text-sm font-[620] leading-6"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {fmt(stripGradeAssessmentBlock(record.memo))}
                    </p>
                    <p className="crm-tiny mt-3">
                      등록일 {dateLabel(record.created_at)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        {showForm && (
          <div className="crm-modal-overlay">
            <div className="crm-modal flex max-h-[94vh] w-[min(1180px,calc(100vw-32px))] max-w-none flex-col">
              <div className="slide-panel-header flex items-center justify-between gap-4">
                <div>
                  <p className="crm-title text-[22px]">
                    {editId ? "고객 DB 수정" : "신규고객등록"}
                  </p>
                  <p className="crm-subtitle mt-1">
                    고객 기본정보와 등급판정 항목을 입력합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-premium btn-secondary h-10 w-10 p-0"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FormInput
                    label="고객명 *"
                    value={form.name}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, name: value }))
                    }
                    placeholder="홍길동"
                  />
                  <FormSelect
                    label="직급"
                    value={form.title}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, title: value }))
                    }
                    options={TITLE_OPTIONS}
                  />
                  <FormInput
                    label="연락처 *"
                    value={form.phone}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        phone: formatPhoneInput(value),
                      }))
                    }
                    placeholder="010-1234-5678"
                  />
                  <FormSelect
                    label="유입경로"
                    value={form.intake_route}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, intake_route: value }))
                    }
                    options={INTAKE_ROUTES}
                  />
                  <FormInput
                    label="소속회사"
                    value={form.company}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, company: value }))
                    }
                    placeholder="소속회사명을 입력하세요"
                  />
                </div>

                <div className="mt-5">
                  <CustomerGradeAssessment
                    value={gradeAssessment}
                    title={form.title}
                    onChange={setGradeAssessment}
                    managementStage={form.management_stage || "리드"}
                    onManagementStageChange={(value) =>
                      setForm((prev) => ({ ...prev, management_stage: value }))
                    }
                    managementStageOptions={MANAGEMENT_STAGE_OPTIONS}
                  />
                </div>

                <div className="mt-4">
                  <label className="crm-meta mb-2 block">메모</label>
                  <textarea
                    value={form.memo}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, memo: event.target.value }))
                    }
                    rows={4}
                    placeholder="고객 특이사항, 상담 메모, 다음 액션 등을 입력하세요."
                    className="w-full resize-none rounded-[14px] border px-4 py-3 text-[13px] font-[640] outline-none"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                {formError && (
                  <div
                    className="mt-5 rounded-[18px] border px-4 py-3 text-sm font-[850]"
                    style={{
                      background: "var(--danger-bg)",
                      color: "var(--danger-text)",
                      borderColor: "var(--danger-border)",
                    }}
                  >
                    {formError}
                  </div>
                )}
              </div>

              <div className="slide-panel-footer flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-premium btn-secondary"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveRecord}
                  className="btn-premium btn-primary"
                >
                  <Save size={15} />
                  {editId ? "수정 저장" : "등록 저장"}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedRecord && (
          <CustomerDetailPanel
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onEdit={() => {
              openEdit(selectedRecord);
              setSelectedRecord(null);
            }}
            onDelete={() => deleteRecord(selectedRecord.id)}
          />
        )}
      </div>
    </>
  );
}

function FormInput({
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
      <span className="crm-meta mb-2 block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-[42px] w-full rounded-[13px] border px-3 text-[13px] font-[680] outline-none"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block min-w-0">
      <span className="crm-meta mb-2 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[42px] w-full rounded-[13px] border px-3 text-[13px] font-[680] outline-none"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
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

function CustomerDetailPanel({
  record,
  onClose,
  onEdit,
  onDelete,
}: {
  record: CustomerDbRecord;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cleanMemo = stripGradeAssessmentBlock(record.memo);
  const assessment = parseGradeAssessmentBlock(record.memo);
  const result = calculateCustomerGrade(assessment, record.title);
  const hasAssessment = hasGradeAssessmentInput(assessment);
  const visibleGrade = displayCustomerGrade(record);
  const isUnreviewed = visibleGrade === UNREVIEWED_GRADE;
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadNotes = async () => {
      setNotesLoading(true);
      try {
        const { data, error } = await supabase
          .from("contact_notes")
          .select("id,contact_id,note_date,content,author,created_at,updated_at")
          .eq("contact_id", record.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        if (alive) setNotes(Array.isArray(data) ? (data as ContactNote[]) : []);
      } catch (error) {
        console.warn("VIP활동DB 활동노트 불러오기 실패", error);
        if (alive) setNotes([]);
      } finally {
        if (alive) setNotesLoading(false);
      }
    };

    loadNotes();

    return () => {
      alive = false;
    };
  }, [record.id]);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="고객 상세 닫기"
        onClick={onClose}
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
              <span className={`badge-premium ${badgeClass(visibleGrade)}`}>
                {fmt(visibleGrade)}
              </span>
              <span
                className={`badge-premium ${badgeClass(record.intake_route)}`}
              >
                {fmt(record.intake_route)}
              </span>
              <span
                className={`badge-premium ${badgeClass(record.management_stage)}`}
              >
                {fmt(record.management_stage)}
              </span>
            </div>
            <h2
              className="truncate text-[30px] font-[930] tracking-[-0.06em]"
              style={{ color: "var(--text-strong)" }}
            >
              {fmt(record.name)}
            </h2>
            <p
              className="mt-2 text-sm font-[720]"
              style={{ color: "var(--text-muted)" }}
            >
              {fmt(record.title)} · {fmt(record.phone)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary h-10 w-10 shrink-0 p-0"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="premium-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="crm-card-title">고객 기본정보</p>
                <p className="crm-tiny mt-1">
                  리스트에서 선택한 고객의 전체 저장값입니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onEdit}
                  className="btn-premium btn-secondary"
                >
                  <Pencil size={14} />
                  수정
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="btn-premium"
                  style={{
                    color: "var(--danger-text)",
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger-border)",
                  }}
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DetailItem label="고객명" value={record.name} />
              <DetailItem label="직급" value={record.title} />
              <DetailItem label="연락처" value={record.phone} />
              <DetailItem label="유입경로" value={record.intake_route} badge />
              <DetailItem
                label="관리구간"
                value={record.management_stage}
                badge
              />
              <DetailItem label="소속회사" value={record.company} />
              <DetailItem label="자동등급" value={visibleGrade} badge />
              <DetailItem label="등록일" value={dateLabel(record.created_at)} />
              <DetailItem label="수정일" value={dateLabel(record.updated_at)} />
              <DetailItem label="등록 ID" value={`#${record.id}`} />
            </div>
          </section>

          <section className="premium-card mt-4 p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="crm-card-title">자동등급 판정 결과</p>
                <p className="crm-tiny mt-1">
                  저장 당시 입력된 판정 항목을 기준으로 다시 계산한 결과입니다.
                </p>
              </div>
              <span className={`badge-premium ${badgeClass(visibleGrade)}`}>
                {isUnreviewed
                  ? visibleGrade
                  : hasAssessment
                    ? `${visibleGrade} · ${result.totalScore}/120점`
                    : visibleGrade}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ScoreBox
                label="현장운영력"
                value={result.categoryScores.siteOperation}
                max={30}
              />
              <ScoreBox
                label="조직운영력"
                value={result.categoryScores.organization}
                max={40}
              />
              <ScoreBox
                label="브랜딩/네트워킹"
                value={result.categoryScores.branding}
                max={20}
              />
              <ScoreBox
                label="광고 집행력"
                value={result.categoryScores.advertising}
                max={30}
              />
            </div>

            <div
              className="mt-4 rounded-[16px] border px-4 py-3 text-sm font-[720] leading-6"
              style={{
                color: "var(--text-subtle)",
                background: "var(--surface-2)",
                borderColor: "var(--border)",
              }}
            >
              {isUnreviewed
                ? "등급 판정 항목이 아직 입력되지 않았습니다."
                : hasAssessment
                  ? result.decisionMessage
                  : "저장된 자동등급을 기준으로 표시 중입니다. 세부 판정 입력값이 필요한 경우 고객정보 수정에서 재심사해 주세요."}
            </div>
          </section>

          <section className="premium-card mt-4 p-5">
            <button
              type="button"
              onClick={() => setAssessmentOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="crm-card-title">등급 판정 입력값</p>
                <p className="crm-tiny mt-1">
                  세부 입력값은 필요할 때만 열어서 확인합니다.
                </p>
              </div>
              <span
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-[850]"
                style={{
                  color: "var(--text-subtle)",
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                }}
              >
                {assessmentOpen ? "닫기" : "열기"}
                <ChevronDown
                  size={15}
                  style={{
                    transform: assessmentOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 160ms ease",
                  }}
                />
              </span>
            </button>

            {assessmentOpen ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label="1년간 진행 현장 수"
                  value={
                    assessment.annual_site_count
                      ? `${assessment.annual_site_count}개`
                      : "-"
                  }
                />
                <DetailItem
                  label="주 운영 물건 종류"
                  value={assessment.property_type}
                />
                <DetailItem
                  label="직접 양성 상담사 수"
                  value={
                    assessment.trained_consultants
                      ? `${assessment.trained_consultants}명`
                      : "-"
                  }
                />
                <DetailItem
                  label="현장 셋팅 가능 인원수"
                  value={
                    assessment.setup_people ? `${assessment.setup_people}명` : "-"
                  }
                />
                <DetailItem
                  label="지속 운영 팀원수"
                  value={
                    assessment.steady_team_members
                      ? `${assessment.steady_team_members}명`
                      : "-"
                  }
                />
                <DetailItem
                  label="소속회사 규모"
                  value={assessment.company_scale}
                />
                <DetailItem
                  label="본인 PR 플랫폼"
                  value={assessment.pr_platform}
                />
                <DetailItem label="네트워킹 활동" value={assessment.networking} />
                <DetailItem
                  label="월 평균 광고비"
                  value={
                    assessment.monthly_ad_budget
                      ? `${assessment.monthly_ad_budget}만원`
                      : "-"
                  }
                />
                <DetailItem
                  label="광고 셋팅 운영"
                  value={assessment.ad_operation}
                />
                <DetailItem
                  label="광고비 지원 가능 여부"
                  value={assessment.ad_budget_support}
                />
                <DetailItem
                  label="판정 기준"
                  value={`${result.roleBasis} 기준`}
                />
              </div>
            ) : null}
          </section>

          <section className="premium-card mt-4 p-5">
            <p className="crm-card-title">메모</p>
            <p className="crm-tiny mt-1">고객DB에서 이관된 메모 내용입니다.</p>
            <div
              className="mt-4 min-h-[104px] whitespace-pre-wrap rounded-[16px] border px-4 py-4 text-sm font-[650] leading-7"
              style={{
                color: "var(--text-subtle)",
                background: "var(--surface-2)",
                borderColor: "var(--border)",
              }}
            >
              {cleanMemo || "등록된 메모가 없습니다."}
            </div>
          </section>

          <section className="premium-card mt-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="crm-card-title">활동노트</p>
                <p className="crm-tiny mt-1">
                  고객DB/파이프라인3에서 작성된 활동노트 내역입니다.
                </p>
              </div>
              <span className="badge-premium badge-muted">읽기전용</span>
            </div>

            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {notesLoading ? (
                <div
                  className="rounded-[16px] border px-4 py-5 text-center text-sm font-[780]"
                  style={{
                    color: "var(--text-muted)",
                    background: "var(--surface-2)",
                    borderColor: "var(--border)",
                  }}
                >
                  활동노트를 불러오는 중입니다.
                </div>
              ) : notes.length > 0 ? (
                notes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-[16px] border px-4 py-4"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="badge-premium badge-info">
                        {note.content.includes("활동항목: 콜드톡")
                          ? "콜드톡"
                          : note.content.includes("활동항목: TM") ||
                              note.content.includes("[AI 통화요약]")
                            ? "TM"
                            : "활동노트"}
                      </span>
                      <p className="crm-tiny">
                        {fmt(note.note_date || dateLabel(note.created_at))}
                        {note.author ? ` · ${note.author}` : ""}
                      </p>
                    </div>
                    <p
                      className="whitespace-pre-wrap text-sm font-[650] leading-7"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {note.content || "내용 없음"}
                    </p>
                  </article>
                ))
              ) : (
                <div
                  className="rounded-[16px] border px-4 py-5 text-center text-sm font-[780]"
                  style={{
                    color: "var(--text-muted)",
                    background: "var(--surface-2)",
                    borderColor: "var(--border)",
                  }}
                >
                  등록된 활동노트가 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function DetailItem({
  label,
  value,
  badge = false,
}: {
  label: string;
  value: string | number | null | undefined;
  badge?: boolean;
}) {
  const displayValue = fmt(String(value ?? ""));

  return (
    <div
      className="rounded-[15px] border px-4 py-3"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border)",
      }}
    >
      <p className="crm-meta">{label}</p>
      <div className="mt-2">
        {badge ? (
          <span className={`badge-premium ${badgeClass(displayValue)}`}>
            {displayValue}
          </span>
        ) : (
          <p
            className="text-sm font-[780] leading-6"
            style={{ color: "var(--text-strong)" }}
          >
            {displayValue}
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreBox({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = max ? Math.round((value / max) * 100) : 0;

  return (
    <div
      className="rounded-[16px] border px-4 py-4"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="crm-meta truncate">{label}</p>
        <p
          className="text-sm font-[930]"
          style={{ color: "var(--text-strong)" }}
        >
          {value}/{max}
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg,var(--accent),var(--accent-3))",
          }}
        />
      </div>
    </div>
  );
}

function PreviewItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <span
        className="text-xs font-[850]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </span>
      <span
        className="max-w-[65%] truncate text-right text-xs font-[900]"
        style={{ color: "var(--text-strong)" }}
      >
        {fmt(String(value ?? ""))}
      </span>
    </div>
  );
}

function EmptyList({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center">
      <div className="premium-icon-lg mb-4">
        <UserRound className="h-7 w-7" />
      </div>
      <p className="crm-card-title">등록된 고객 DB가 없습니다.</p>
      <p className="crm-subtitle mt-2 text-center">
        신규고객등록을 눌러 고객명, 직급, 연락처, 유입경로, 관리구간, 등급판정
        항목을 입력하세요.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="btn-premium btn-primary mt-6"
      >
        <Plus className="h-4 w-4" />
        신규고객등록
      </button>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  compact = false,
}: {
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const size = compact ? "h-8 w-8 rounded-[12px]" : "h-9 w-9 rounded-[13px]";

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className={`inline-flex items-center justify-center border transition hover:-translate-y-0.5 ${size}`}
        style={{
          background: "var(--info-bg)",
          color: "var(--info-text)",
          borderColor: "var(--info-border)",
        }}
        aria-label="수정"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={`inline-flex items-center justify-center border transition hover:-translate-y-0.5 ${size}`}
        style={{
          background: "var(--danger-bg)",
          color: "var(--danger-text)",
          borderColor: "var(--danger-border)",
        }}
        aria-label="삭제"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

