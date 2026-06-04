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
import CustomerGradeAssessment from "@/components/CustomerGradeAssessment";
import {
  appendGradeAssessmentBlock,
  calculateCustomerGrade,
  CUSTOMER_GRADE_OPTIONS,
  EMPTY_GRADE_ASSESSMENT,
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
  management_stage: string;
  customer_grade: string;
  memo: string;
  created_at: string;
  updated_at: string;
};

type FormState = {
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  management_stage: string;
  memo: string;
};

const STORAGE_KEY = "crm_go_customer_db_local_v2";

const INTAKE_ROUTES = ["분양의신DB", "완판트럭", "분양라인", "분양회MGM", "대협팀활동"];
const MANAGEMENT_STAGES = ["리드", "프로스펙팅", "딜크로징", "리텐션"];

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  phone: "",
  intake_route: "",
  management_stage: "",
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

function badgeClass(value?: string | null) {
  if (value === "마스터") return "grade-master";
  if (value === "챌린저") return "grade-challenger";
  if (value === "브론즈") return "grade-bronze";
  if (value === "추가 심사 후보") return "grade-review";
  if (value === "판정 보류") return "grade-hold";
  if (value === "분양의신DB") return "badge-purple";
  if (value === "완판트럭") return "badge-warning";
  if (value === "분양라인") return "badge-cyan";
  if (value === "분양회MGM") return "badge-success";
  if (value === "대협팀활동") return "badge-info";
  if (value === "리드") return "badge-info";
  if (value === "프로스펙팅") return "badge-warning";
  if (value === "딜크로징") return "badge-danger";
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
    </>
  );
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
  const [lastSavedRecord, setLastSavedRecord] = useState<CustomerDbRecord | null>(null);

  const [search, setSearch] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterGrade, setFilterGrade] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CustomerDbRecord[];
        if (Array.isArray(parsed)) setRecords(parsed);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [loaded, records]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const routeStats = useMemo(() => {
    const total = records.length;
    return INTAKE_ROUTES.map((route) => {
      const count = records.filter((record) => record.intake_route === route).length;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return { route, count, percent };
    });
  }, [records]);

  const gradeStats = useMemo(() => {
    return CUSTOMER_GRADE_OPTIONS.map((grade) => ({
      grade,
      count: records.filter((record) => record.customer_grade === grade).length,
    }));
  }, [records]);

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
            record.customer_grade,
            cleanMemo,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);

      return (
        matchesKeyword &&
        (!filterRoute || record.intake_route === filterRoute) &&
        (!filterStage || record.management_stage === filterStage) &&
        (!filterGrade || record.customer_grade === filterGrade)
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
      memo: stripGradeAssessmentBlock(record.memo),
    });
    setGradeAssessment(parseGradeAssessmentBlock(record.memo));
    setFormError("");
    setEditId(record.id);
    setShowForm(true);
  };

  const saveRecord = () => {
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
    const gradeResult = calculateCustomerGrade(gradeAssessment, form.title);
    const memoWithGrade = appendGradeAssessmentBlock(
      form.memo,
      gradeAssessment,
      gradeResult,
    );

    if (editId) {
      const updatedRecord = records.find((record) => record.id === editId);
      const nextUpdatedRecord: CustomerDbRecord = {
        ...(updatedRecord || {
          id: editId,
          created_at: now,
          updated_at: now,
          name: "",
          title: "",
          phone: "",
          intake_route: "",
          management_stage: "",
          customer_grade: "",
          memo: "",
        }),
        name: form.name.trim(),
        title: form.title.trim(),
        phone: form.phone.trim(),
        intake_route: form.intake_route,
        management_stage: form.management_stage,
        customer_grade: gradeResult.customerGrade,
        memo: memoWithGrade,
        updated_at: now,
      };

      console.log("[고객DB 수정 저장값]", nextUpdatedRecord);
      setLastSavedRecord(nextUpdatedRecord);
      setRecords((prev) =>
        prev.map((record) => (record.id === editId ? nextUpdatedRecord : record)),
      );
      showToast("고객 DB가 수정되었습니다.");
      resetForm();
      return;
    }

    const nextRecord: CustomerDbRecord = {
      id: Date.now(),
      name: form.name.trim(),
      title: form.title.trim(),
      phone: form.phone.trim(),
      intake_route: form.intake_route,
      management_stage: form.management_stage,
      customer_grade: gradeResult.customerGrade,
      memo: memoWithGrade,
      created_at: now,
      updated_at: now,
    };

    console.log("[고객DB 신규 저장값]", nextRecord);
    setLastSavedRecord(nextRecord);
    setRecords((prev) => [nextRecord, ...prev]);
    showToast("신규 고객 DB가 등록되었습니다.");
    resetForm();
  };

  const deleteRecord = (id: number) => {
    const ok = window.confirm("선택한 고객 DB를 삭제할까요? 현재 화면의 임시 데이터에서만 삭제됩니다.");
    if (!ok) return;
    setRecords((prev) => prev.filter((record) => record.id !== id));
    showToast("고객 DB가 삭제되었습니다.");
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
        <header className="premium-card relative overflow-hidden rounded-[26px] p-5 sm:p-6 xl:p-7">
          <div
            className="absolute right-0 top-0 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "var(--accent-bg)" }}
          />
          <div
            className="absolute bottom-0 right-40 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "var(--cyan-bg)" }}
          />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-[850] badge-purple sm:text-sm">
                <Database className="h-4 w-4 flex-none" />
                <span className="truncate">고객DB · 자동등급 판정 적용 · Supabase 미연동 임시 작업영역</span>
              </div>
              <h1 className="crm-title text-[34px] font-[930] leading-tight tracking-[-0.06em] sm:text-[42px]">
                고객DB
              </h1>
              <p className="crm-subtitle mt-3 max-w-3xl text-sm font-[620] leading-7 sm:text-base">
                고객등록 메뉴 구조를 기반으로, 유입경로별 DB 수취 현황과 자동 고객등급 판정 결과를 함께 관리합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="btn-premium btn-primary h-12 shrink-0"
            >
              <Plus className="h-4 w-4" />
              신규고객등록
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,2.2fr)]">
          <div className="premium-card rounded-[24px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="crm-meta">전체 수취 DB</p>
                <p
                  className="mt-2 text-[42px] font-[930] leading-none tracking-[-0.07em] sm:text-5xl"
                  style={{ color: "var(--text-strong)" }}
                >
                  {records.length.toLocaleString()}건
                </p>
              </div>
              <div className="premium-icon-lg">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gradeStats.map((item) => (
                <div
                  key={item.grade}
                  className="rounded-[18px] p-3 text-center sm:p-4"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="crm-tiny truncate">{item.grade}</p>
                  <p
                    className="mt-2 text-2xl font-[920]"
                    style={{ color: "var(--text-strong)" }}
                  >
                    {item.count}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {routeStats.map((item) => (
              <div key={item.route} className="premium-card min-w-0 rounded-[24px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="crm-meta truncate">{item.route}</p>
                    <p
                      className="mt-3 text-3xl font-[930] tracking-[-0.06em]"
                      style={{ color: "var(--text-strong)" }}
                    >
                      {item.count}건
                    </p>
                  </div>
                  <span className={`badge-premium ${badgeClass(item.route)}`}>
                    {item.percent}%
                  </span>
                </div>
                <div
                  className="mt-5 h-2 overflow-hidden rounded-full"
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
            <SelectBox value={filterRoute} onChange={setFilterRoute} options={INTAKE_ROUTES} placeholder="전체 유입경로" />
            <SelectBox value={filterStage} onChange={setFilterStage} options={MANAGEMENT_STAGES} placeholder="전체 관리구간" />
            <SelectBox value={filterGrade} onChange={setFilterGrade} options={CUSTOMER_GRADE_OPTIONS} placeholder="전체 고객등급" />

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

        {lastSavedRecord && (
          <section className="premium-card rounded-[22px] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="crm-card-title">최근 저장 확인</p>
                <p className="crm-tiny mt-1">
                  등록저장 또는 수정저장을 누르면 실제로 들어간 값이 아래에 표시됩니다.
                </p>
              </div>
              <span className={`badge-premium ${badgeClass(lastSavedRecord.customer_grade)}`}>
                {lastSavedRecord.customer_grade}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PreviewItem label="고객명" value={lastSavedRecord.name} />
              <PreviewItem label="직급" value={lastSavedRecord.title} />
              <PreviewItem label="연락처" value={lastSavedRecord.phone} />
              <PreviewItem label="유입경로" value={lastSavedRecord.intake_route} />
              <PreviewItem label="관리구간" value={lastSavedRecord.management_stage} />
              <PreviewItem label="자동등급" value={lastSavedRecord.customer_grade} />
              <PreviewItem label="등록일" value={dateLabel(lastSavedRecord.created_at)} />
              <PreviewItem label="저장위치" value="브라우저 localStorage" />
            </div>
          </section>
        )}

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
                  검색 결과 {filteredRecords.length.toLocaleString()}건 / 전체 {records.length.toLocaleString()}건
                </p>
              </div>
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-[850] badge-muted sm:text-sm">
              <Filter className="h-4 w-4 flex-none" />
              <span className="truncate">고객명 · 직급 · 연락처 · 유입경로 · 관리구간 · 고객등급 기준</span>
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
                      className="text-sm font-[680] transition hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                      style={{
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-[15px] text-sm font-[930] text-white"
                            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
                          >
                            {record.name.slice(0, 1)}
                          </div>
                          <div>
                            <p className="font-[900]" style={{ color: "var(--text-strong)" }}>
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
                          <Phone className="h-3.5 w-3.5" style={{ color: "var(--text-faint)" }} />
                          {fmt(record.phone)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`badge-premium ${badgeClass(record.intake_route)}`}>
                          {fmt(record.intake_route)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`badge-premium ${badgeClass(record.management_stage)}`}>
                          {fmt(record.management_stage)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`badge-premium ${badgeClass(record.customer_grade)}`}>
                          {fmt(record.customer_grade)}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-5 py-4">
                        <p className="truncate" style={{ color: "var(--text-subtle)" }}>
                          {fmt(stripGradeAssessmentBlock(record.memo))}
                        </p>
                      </td>
                      <td className="px-5 py-4" style={{ color: "var(--text-subtle)" }}>
                        {dateLabel(record.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <RowActions onEdit={() => openEdit(record)} onDelete={() => deleteRecord(record.id)} />
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
                <article key={record.id} className="premium-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] text-sm font-[930] text-white"
                        style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
                      >
                        {record.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-[900]" style={{ color: "var(--text-strong)" }}>
                          {fmt(record.name)}
                        </p>
                        <p className="crm-tiny mt-1 truncate">
                          {fmt(record.title)} · {fmt(record.phone)}
                        </p>
                      </div>
                    </div>
                    <RowActions onEdit={() => openEdit(record)} onDelete={() => deleteRecord(record.id)} compact />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`badge-premium ${badgeClass(record.intake_route)}`}>
                      {fmt(record.intake_route)}
                    </span>
                    <span className={`badge-premium ${badgeClass(record.management_stage)}`}>
                      {fmt(record.management_stage)}
                    </span>
                    <span className={`badge-premium ${badgeClass(record.customer_grade)}`}>
                      {fmt(record.customer_grade)}
                    </span>
                  </div>

                  <p className="mt-4 text-sm font-[620] leading-6" style={{ color: "var(--text-subtle)" }}>
                    {fmt(stripGradeAssessmentBlock(record.memo))}
                  </p>
                  <p className="crm-tiny mt-3">등록일 {dateLabel(record.created_at)}</p>
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
              <button type="button" onClick={resetForm} className="btn-premium btn-secondary h-10 w-10 p-0">
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormInput label="고객명 *" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="홍길동" />
                <FormInput label="직급" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="본부장 / 팀장 / 대표 등" />
                <FormInput label="연락처 *" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: formatPhoneInput(value) }))} placeholder="010-1234-5678" />
                <FormSelect label="유입경로" value={form.intake_route} onChange={(value) => setForm((prev) => ({ ...prev, intake_route: value }))} options={INTAKE_ROUTES} />
                <FormSelect label="관리구간" value={form.management_stage} onChange={(value) => setForm((prev) => ({ ...prev, management_stage: value }))} options={MANAGEMENT_STAGES} />
                <div
                  className="rounded-[15px] border px-4 py-3"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <p className="crm-meta">고객등급</p>
                  <p className="mt-2 text-xl font-[930]" style={{ color: "var(--text-strong)" }}>
                    {calculateCustomerGrade(gradeAssessment, form.title).customerGrade}
                  </p>
                  <p className="crm-tiny mt-1">등급판정 항목 기준 자동 설정</p>
                </div>
              </div>

              <div className="mt-5">
                <CustomerGradeAssessment
                  value={gradeAssessment}
                  title={form.title}
                  onChange={setGradeAssessment}
                />
              </div>

              <div className="mt-4">
                <label className="crm-meta mb-2 block">메모</label>
                <textarea
                  value={form.memo}
                  onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
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

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <div
                  className="rounded-[18px] border px-4 py-4"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <p className="crm-card-title text-[15px]">현재 입력값 미리보기</p>
                  <div className="mt-3 grid gap-2">
                    <PreviewItem label="고객명" value={form.name} />
                    <PreviewItem label="직급" value={form.title} />
                    <PreviewItem label="연락처" value={form.phone} />
                    <PreviewItem label="유입경로" value={form.intake_route} />
                    <PreviewItem label="관리구간" value={form.management_stage} />
                    <PreviewItem
                      label="자동등급"
                      value={calculateCustomerGrade(gradeAssessment, form.title).customerGrade}
                    />
                    <PreviewItem
                      label="총점"
                      value={`${calculateCustomerGrade(gradeAssessment, form.title).totalScore}/120점`}
                    />
                  </div>
                </div>

                <div
                  className="rounded-[18px] border px-4 py-4"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <p className="crm-card-title text-[15px]">저장 방식</p>
                  <p className="mt-3 text-sm font-[720] leading-6" style={{ color: "var(--text-subtle)" }}>
                    현재 고객DB 메뉴는 Supabase와 연결하지 않은 임시 화면입니다. 등록 데이터는 브라우저 localStorage에만 저장되며, 기존 CRM 데이터에는 영향을 주지 않습니다.
                  </p>
                  <p className="mt-3 text-xs font-[800]" style={{ color: "var(--text-faint)" }}>
                    개발자도구 Console에는 [고객DB 신규 저장값] 또는 [고객DB 수정 저장값]으로 전체 저장 객체가 표시됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="slide-panel-footer flex items-center justify-end gap-2">
              <button type="button" onClick={resetForm} className="btn-premium btn-secondary">
                취소
              </button>
              <button type="button" onClick={saveRecord} className="btn-premium btn-primary">
                <Save size={15} />
                {editId ? "수정 저장" : "등록 저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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


function PreviewItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2"
      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
    >
      <span className="text-xs font-[850]" style={{ color: "var(--text-faint)" }}>
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
        신규고객등록을 눌러 고객명, 직급, 연락처, 유입경로, 관리구간, 등급판정 항목을 입력하세요.
      </p>
      <button type="button" onClick={onCreate} className="btn-premium btn-primary mt-6">
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
