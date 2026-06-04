"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

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
  customer_grade: string;
  memo: string;
};

const STORAGE_KEY = "crm_go_customer_db_local_v1";

const INTAKE_ROUTES = ["분양의신DB", "완판트럭", "분양라인", "분양회MGM", "대협팀활동"];
const MANAGEMENT_STAGES = ["리드", "프로스펙팅", "딜크로징", "리텐션"];
const CUSTOMER_GRADES = ["마스터", "챌린저", "브론즈"];

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  phone: "",
  intake_route: "",
  management_stage: "",
  customer_grade: "",
  memo: "",
};

const routeMeta: Record<string, { color: string; bg: string; border: string }> = {
  분양의신DB: { color: "var(--accent-text)", bg: "var(--accent-bg)", border: "var(--accent-border)" },
  완판트럭: { color: "var(--warning-text)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
  분양라인: { color: "var(--cyan-text)", bg: "var(--cyan-bg)", border: "var(--cyan-border)" },
  분양회MGM: { color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)" },
  대협팀활동: { color: "var(--purple-text)", bg: "var(--purple-bg)", border: "var(--purple-border)" },
};

const gradeMeta: Record<string, { color: string; bg: string; border: string }> = {
  마스터: { color: "var(--text-strong)", bg: "var(--surface-4)", border: "var(--border-strong)" },
  챌린저: { color: "var(--info-text)", bg: "var(--info-bg)", border: "var(--info-border)" },
  브론즈: { color: "var(--warning-text)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
};

const stageMeta: Record<string, { color: string; bg: string; border: string }> = {
  리드: { color: "var(--cyan-text)", bg: "var(--cyan-bg)", border: "var(--cyan-border)" },
  프로스펙팅: { color: "var(--warning-text)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
  딜크로징: { color: "var(--danger-text)", bg: "var(--danger-bg)", border: "var(--danger-border)" },
  리텐션: { color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)" },
};

const panelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-xs)",
};

const subtlePanelStyle: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border-subtle)",
};

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function fmt(value?: string | null) {
  return value && value.trim() ? value : "-";
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

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: { color: string; bg: string; border: string };
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-[800]"
      style={{
        color: tone?.color || "var(--text-muted)",
        background: tone?.bg || "var(--surface-3)",
        border: `1px solid ${tone?.border || "var(--border)"}`,
      }}
    >
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-sm font-[780]" style={{ color: "var(--text)" }}>
      {children}
    </span>
  );
}

function SelectField({
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
        className="h-12 w-full min-w-0 appearance-none rounded-[16px] border px-4 pr-10 text-sm font-[740] outline-none transition"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--text-faint)" }}
      />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
  type?: string;
}) {
  return (
    <label className="relative block min-w-0">
      {icon ? (
        <span
          className="absolute left-4 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center"
          style={{ color: "var(--text-faint)" }}
        >
          {icon}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-12 w-full min-w-0 rounded-[16px] border px-4 text-sm font-[720] outline-none transition placeholder:font-[620] ${
          icon ? "pl-11" : ""
        }`}
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
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
  const [toast, setToast] = useState("");

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
    window.setTimeout(() => setToast(""), 2200);
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
    return CUSTOMER_GRADES.map((grade) => ({
      grade,
      count: records.filter((record) => record.customer_grade === grade).length,
    }));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = !keyword
        ? true
        : [record.name, record.title, record.phone, record.intake_route, record.management_stage, record.customer_grade, record.memo]
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
    setEditId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
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
      customer_grade: record.customer_grade,
      memo: record.memo,
    });
    setEditId(record.id);
    setShowForm(true);
  };

  const saveRecord = () => {
    if (!form.name.trim()) {
      showToast("고객명을 입력해주세요.");
      return;
    }
    if (!form.phone.trim()) {
      showToast("연락처를 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();

    if (editId) {
      setRecords((prev) =>
        prev.map((record) =>
          record.id === editId
            ? {
                ...record,
                ...form,
                name: form.name.trim(),
                title: form.title.trim(),
                phone: form.phone.trim(),
                memo: form.memo.trim(),
                updated_at: now,
              }
            : record,
        ),
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
      customer_grade: form.customer_grade,
      memo: form.memo.trim(),
      created_at: now,
      updated_at: now,
    };

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
          className="fixed right-5 top-5 z-50 rounded-[18px] px-5 py-3 text-sm font-[820]"
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
        <header className="premium-hero relative overflow-hidden rounded-[26px]" style={panelStyle}>
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full blur-3xl" style={{ background: "var(--accent-bg)" }} />
          <div className="absolute bottom-0 right-40 h-40 w-40 rounded-full blur-3xl" style={{ background: "var(--cyan-bg)" }} />

          <div className="relative z-10 flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between xl:p-7">
            <div className="min-w-0">
              <div
                className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-[820] sm:text-sm"
                style={{
                  color: "var(--accent-text)",
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <Database className="h-4 w-4 flex-none" />
                <span className="truncate">고객DB · Supabase 미연동 임시 작업영역</span>
              </div>
              <h1 className="crm-title text-[34px] font-[900] leading-tight tracking-[-0.06em] sm:text-[42px]" style={{ color: "var(--text-strong)" }}>
                고객DB
              </h1>
              <p className="crm-subtitle mt-3 max-w-3xl text-sm font-[620] leading-7 sm:text-base" style={{ color: "var(--text-muted)" }}>
                고객등록 메뉴 구조를 기반으로, 유입경로별 DB 수취 현황을 확인하고 신규 고객 DB를 입력하는 화면입니다.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[16px] px-5 text-sm font-[850] text-white shadow-lg transition hover:-translate-y-0.5 sm:h-13"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
            >
              <Plus className="h-4 w-4" />
              신규고객등록
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,2.2fr)]">
          <div className="rounded-[24px] p-5 sm:p-6" style={panelStyle}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-[820]" style={{ color: "var(--text-muted)" }}>
                  전체 수취 DB
                </p>
                <p className="mt-2 text-[42px] font-[920] leading-none tracking-[-0.07em] sm:text-5xl" style={{ color: "var(--text-strong)" }}>
                  {records.length.toLocaleString()}건
                </p>
              </div>
              <div
                className="flex h-13 w-13 items-center justify-center rounded-[18px] text-white sm:h-14 sm:w-14"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
              >
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {gradeStats.map((item) => (
                <div key={item.grade} className="rounded-[18px] p-3 text-center sm:p-4" style={subtlePanelStyle}>
                  <p className="text-[11px] font-[850] sm:text-xs" style={{ color: "var(--text-faint)" }}>
                    {item.grade}
                  </p>
                  <p className="mt-2 text-2xl font-[920]" style={{ color: "var(--text-strong)" }}>
                    {item.count}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {routeStats.map((item) => {
              const tone = routeMeta[item.route];
              return (
                <div key={item.route} className="min-w-0 rounded-[24px] p-5" style={panelStyle}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-[850]" style={{ color: "var(--text-muted)" }}>
                        {item.route}
                      </p>
                      <p className="mt-3 text-3xl font-[920] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
                        {item.count}건
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-[850]"
                      style={{ color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}
                    >
                      {item.percent}%
                    </span>
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.percent}%`,
                        background: item.percent ? tone.color : "transparent",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] p-4 sm:p-5" style={panelStyle}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(320px,1.5fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_auto]">
            <TextInput
              value={search}
              onChange={setSearch}
              placeholder="고객명, 직급, 연락처, 유입경로, 메모 검색"
              icon={<Search className="h-4 w-4" />}
            />
            <SelectField value={filterRoute} onChange={setFilterRoute} options={INTAKE_ROUTES} placeholder="전체 유입경로" />
            <SelectField value={filterStage} onChange={setFilterStage} options={MANAGEMENT_STAGES} placeholder="전체 관리구간" />
            <SelectField value={filterGrade} onChange={setFilterGrade} options={CUSTOMER_GRADES} placeholder="전체 고객등급" />

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border px-4 text-sm font-[850] transition hover:-translate-y-0.5 xl:w-auto"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                borderColor: "var(--border)",
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              초기화
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px]" style={panelStyle}>
          <div
            className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
                style={{
                  color: "var(--accent-text)",
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-[900]" style={{ color: "var(--text-strong)" }}>
                  고객 DB 리스트
                </h2>
                <p className="text-sm font-[700]" style={{ color: "var(--text-faint)" }}>
                  검색 결과 {filteredRecords.length.toLocaleString()}건 / 전체 {records.length.toLocaleString()}건
                </p>
              </div>
            </div>
            <div
              className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-[800] sm:text-sm"
              style={{ color: "var(--text-muted)", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            >
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
                  <th className="px-5 py-4">고객등급</th>
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
                      className="text-sm font-[680] transition"
                      style={{
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-[15px] text-sm font-[900] text-white"
                            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
                          >
                            {record.name.slice(0, 1)}
                          </div>
                          <div>
                            <p className="font-[900]" style={{ color: "var(--text-strong)" }}>
                              {fmt(record.name)}
                            </p>
                            <p className="text-xs font-[650]" style={{ color: "var(--text-faint)" }}>
                              ID {record.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">{fmt(record.title)}</td>
                      <td className="px-5 py-4">
                        <div
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                          style={{ color: "var(--text-muted)", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
                        >
                          <Phone className="h-3.5 w-3.5" style={{ color: "var(--text-faint)" }} />
                          {fmt(record.phone)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={routeMeta[record.intake_route]}>{fmt(record.intake_route)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={stageMeta[record.management_stage]}>{fmt(record.management_stage)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={gradeMeta[record.customer_grade]}>{fmt(record.customer_grade)}</Badge>
                      </td>
                      <td className="max-w-[260px] px-5 py-4">
                        <p className="truncate" style={{ color: "var(--text-subtle)" }}>
                          {fmt(record.memo)}
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
                <article key={record.id} className="rounded-[20px] p-4" style={subtlePanelStyle}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] text-sm font-[900] text-white"
                        style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
                      >
                        {record.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-[900]" style={{ color: "var(--text-strong)" }}>
                          {fmt(record.name)}
                        </p>
                        <p className="mt-1 truncate text-xs font-[700]" style={{ color: "var(--text-faint)" }}>
                          {fmt(record.title)} · {fmt(record.phone)}
                        </p>
                      </div>
                    </div>
                    <RowActions onEdit={() => openEdit(record)} onDelete={() => deleteRecord(record.id)} compact />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone={routeMeta[record.intake_route]}>{fmt(record.intake_route)}</Badge>
                    <Badge tone={stageMeta[record.management_stage]}>{fmt(record.management_stage)}</Badge>
                    <Badge tone={gradeMeta[record.customer_grade]}>{fmt(record.customer_grade)}</Badge>
                  </div>

                  <p className="mt-4 text-sm font-[620] leading-6" style={{ color: "var(--text-subtle)" }}>
                    {fmt(record.memo)}
                  </p>
                  <p className="mt-3 text-xs font-[720]" style={{ color: "var(--text-faint)" }}>
                    등록일 {dateLabel(record.created_at)}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 backdrop-blur-sm" style={{ background: "var(--overlay)" }}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[28px]" style={panelStyle}>
            <div className="flex items-center justify-between px-5 py-5 sm:px-6" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <p className="text-sm font-[900]" style={{ color: "var(--accent)" }}>
                  CUSTOMER DB
                </p>
                <h3 className="mt-1 text-2xl font-[920] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>
                  {editId ? "고객 DB 수정" : "신규고객등록"}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="flex h-11 w-11 items-center justify-center rounded-[16px] transition"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block">
                  <FieldLabel>고객명</FieldLabel>
                  <div className="mt-2">
                    <TextInput
                      value={form.name}
                      onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                      placeholder="고객명을 입력하세요"
                    />
                  </div>
                </label>

                <label className="block">
                  <FieldLabel>직급</FieldLabel>
                  <div className="mt-2">
                    <TextInput
                      value={form.title}
                      onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
                      placeholder="직급을 입력하세요"
                    />
                  </div>
                </label>

                <label className="block">
                  <FieldLabel>연락처</FieldLabel>
                  <div className="mt-2">
                    <TextInput
                      value={form.phone}
                      onChange={(value) => setForm((prev) => ({ ...prev, phone: formatPhoneInput(value) }))}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </label>

                <label className="block">
                  <FieldLabel>유입경로</FieldLabel>
                  <div className="mt-2">
                    <SelectField
                      value={form.intake_route}
                      onChange={(value) => setForm((prev) => ({ ...prev, intake_route: value }))}
                      options={INTAKE_ROUTES}
                      placeholder="유입경로 선택"
                    />
                  </div>
                </label>

                <label className="block">
                  <FieldLabel>관리구간</FieldLabel>
                  <div className="mt-2">
                    <SelectField
                      value={form.management_stage}
                      onChange={(value) => setForm((prev) => ({ ...prev, management_stage: value }))}
                      options={MANAGEMENT_STAGES}
                      placeholder="관리구간 선택"
                    />
                  </div>
                </label>

                <label className="block">
                  <FieldLabel>고객등급</FieldLabel>
                  <div className="mt-2">
                    <SelectField
                      value={form.customer_grade}
                      onChange={(value) => setForm((prev) => ({ ...prev, customer_grade: value }))}
                      options={CUSTOMER_GRADES}
                      placeholder="고객등급 선택"
                    />
                  </div>
                </label>

                <label className="block md:col-span-2">
                  <FieldLabel>메모</FieldLabel>
                  <textarea
                    value={form.memo}
                    onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                    placeholder="고객 특이사항, 상담 내용, 후속 액션을 입력하세요"
                    rows={5}
                    className="mt-2 w-full resize-none rounded-[16px] border px-4 py-3 text-sm font-[700] leading-6 outline-none transition"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-12 items-center justify-center rounded-[16px] border px-6 text-sm font-[850] transition"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    borderColor: "var(--border)",
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveRecord}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] px-6 text-sm font-[900] text-white shadow-lg transition hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
                >
                  <Save className="h-4 w-4" />
                  {editId ? "수정 저장" : "등록 저장"}
                </button>
              </div>

              <div className="mt-6 rounded-[20px] px-4 py-4" style={subtlePanelStyle}>
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-none" style={{ color: "var(--accent)" }} />
                  <p className="text-sm font-[650] leading-6" style={{ color: "var(--text-subtle)" }}>
                    현재 고객DB 메뉴는 Supabase와 연결하지 않은 임시 화면입니다. 메뉴 구조와 UI 확인 후, 필요 시 동일한 항목 기준으로 실제 테이블 연동을 진행할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyList({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-[22px]"
        style={{
          color: "var(--text-faint)",
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <UserRound className="h-7 w-7" />
      </div>
      <p className="mt-5 text-lg font-[900]" style={{ color: "var(--text-strong)" }}>
        등록된 고객 DB가 없습니다.
      </p>
      <p className="mt-2 text-sm font-[620] leading-6" style={{ color: "var(--text-muted)" }}>
        신규고객등록을 눌러 고객명, 직급, 연락처, 유입경로, 관리구간, 고객등급을 입력하세요.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 rounded-[16px] px-5 py-3 text-sm font-[900] text-white transition hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
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
          background: "var(--surface)",
          color: "var(--text-muted)",
          borderColor: "var(--border)",
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
