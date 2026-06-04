"use client";

import { useEffect, useMemo, useState } from "react";
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

const INTAKE_ROUTES = [
  "분양의신DB",
  "완판트럭",
  "분양라인",
  "분양회MGM",
  "대협팀활동",
];

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

const routeMeta: Record<string, { badge: string; bar: string }> = {
  분양의신DB: { badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", bar: "bg-indigo-500" },
  완판트럭: { badge: "bg-amber-50 text-amber-700 ring-amber-200", bar: "bg-amber-500" },
  분양라인: { badge: "bg-cyan-50 text-cyan-700 ring-cyan-200", bar: "bg-cyan-500" },
  분양회MGM: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500" },
  대협팀활동: { badge: "bg-violet-50 text-violet-700 ring-violet-200", bar: "bg-violet-500" },
};

const gradeMeta: Record<string, string> = {
  마스터: "bg-slate-950 text-white ring-slate-950",
  챌린저: "bg-blue-50 text-blue-700 ring-blue-200",
  브론즈: "bg-orange-50 text-orange-700 ring-orange-200",
};

const stageMeta: Record<string, string> = {
  리드: "bg-sky-50 text-sky-700 ring-sky-200",
  프로스펙팅: "bg-yellow-50 text-yellow-700 ring-yellow-200",
  딜크로징: "bg-rose-50 text-rose-700 ring-rose-200",
  리텐션: "bg-green-50 text-green-700 ring-green-200",
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

function Badge({ children, className = "bg-slate-100 text-slate-600 ring-slate-200" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${className}`}>
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-bold text-slate-700">{children}</span>;
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
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
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
    <div className="min-h-screen bg-[#f6f8fb] px-5 py-6 text-slate-950 lg:px-8">
      {toast && (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-2xl">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-[1680px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="relative p-7 lg:p-8">
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-indigo-100 blur-3xl" />
            <div className="absolute bottom-0 right-40 h-40 w-40 rounded-full bg-cyan-100 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">
                  <Database className="h-4 w-4" />
                  고객DB · Supabase 미연동 임시 작업영역
                </div>
                <h1 className="text-4xl font-black tracking-[-0.05em] text-slate-950 lg:text-5xl">
                  고객DB
                </h1>
                <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-500">
                  고객등록 메뉴 구조를 기반으로, 유입경로별 DB 수취 현황을 확인하고 신규 고객 DB를 입력하는 화면입니다.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                신규고객등록
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.9fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-500">전체 수취 DB</p>
                <p className="mt-2 text-5xl font-black tracking-[-0.06em] text-slate-950">
                  {records.length.toLocaleString()}건
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {gradeStats.map((item) => (
                <div key={item.grade} className="rounded-2xl bg-slate-50 p-4 text-center">
                  <p className="text-xs font-black text-slate-400">{item.grade}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{item.count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {routeStats.map((item) => (
              <div key={item.route} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-500">{item.route}</p>
                    <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
                      {item.count}건
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">
                    {item.percent}%
                  </span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${routeMeta[item.route]?.bar || "bg-slate-400"}`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="고객명, 직급, 연락처, 유입경로, 메모 검색"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>

            <SelectField value={filterRoute} onChange={setFilterRoute} options={INTAKE_ROUTES} placeholder="전체 유입경로" />
            <SelectField value={filterStage} onChange={setFilterStage} options={MANAGEMENT_STAGES} placeholder="전체 관리구간" />
            <SelectField value={filterGrade} onChange={setFilterGrade} options={CUSTOMER_GRADES} placeholder="전체 고객등급" />

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              초기화
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">고객 DB 리스트</h2>
                <p className="text-sm font-semibold text-slate-400">
                  검색 결과 {filteredRecords.length.toLocaleString()}건 / 전체 {records.length.toLocaleString()}건
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-bold text-slate-500">
              <Filter className="h-4 w-4" />
              고객명 · 직급 · 연락처 · 유입경로 · 관리구간 · 고객등급 기준
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-black uppercase tracking-[0.08em] text-slate-400">
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
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-400">
                          <UserRound className="h-7 w-7" />
                        </div>
                        <p className="mt-5 text-lg font-black text-slate-900">등록된 고객 DB가 없습니다.</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          신규고객등록을 눌러 고객명, 직급, 연락처, 유입경로, 관리구간, 고객등급을 입력하세요.
                        </p>
                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700"
                        >
                          <Plus className="h-4 w-4" />
                          신규고객등록
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                            {record.name.slice(0, 1)}
                          </div>
                          <div>
                            <p className="font-black text-slate-950">{fmt(record.name)}</p>
                            <p className="text-xs font-semibold text-slate-400">ID {record.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">{fmt(record.title)}</td>
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-slate-700">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {fmt(record.phone)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={routeMeta[record.intake_route]?.badge}>{fmt(record.intake_route)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={stageMeta[record.management_stage]}>{fmt(record.management_stage)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={gradeMeta[record.customer_grade]}>{fmt(record.customer_grade)}</Badge>
                      </td>
                      <td className="max-w-[260px] px-5 py-4">
                        <p className="truncate text-slate-500">{fmt(record.memo)}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{dateLabel(record.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                            aria-label="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecord(record.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-sm font-black text-indigo-600">CUSTOMER DB</p>
                <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">
                  {editId ? "고객 DB 수정" : "신규고객등록"}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block">
                  <FieldLabel>고객명</FieldLabel>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="고객명을 입력하세요"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>

                <label className="block">
                  <FieldLabel>직급</FieldLabel>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="직급을 입력하세요"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>

                <label className="block">
                  <FieldLabel>연락처</FieldLabel>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: formatPhoneInput(event.target.value) }))}
                    placeholder="010-0000-0000"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>

                <label className="block">
                  <FieldLabel>유입경로</FieldLabel>
                  <div className="mt-2">
                    <SelectField value={form.intake_route} onChange={(value) => setForm((prev) => ({ ...prev, intake_route: value }))} options={INTAKE_ROUTES} placeholder="유입경로 선택" />
                  </div>
                </label>

                <label className="block">
                  <FieldLabel>관리구간</FieldLabel>
                  <div className="mt-2">
                    <SelectField value={form.management_stage} onChange={(value) => setForm((prev) => ({ ...prev, management_stage: value }))} options={MANAGEMENT_STAGES} placeholder="관리구간 선택" />
                  </div>
                </label>

                <label className="block">
                  <FieldLabel>고객등급</FieldLabel>
                  <div className="mt-2">
                    <SelectField value={form.customer_grade} onChange={(value) => setForm((prev) => ({ ...prev, customer_grade: value }))} options={CUSTOMER_GRADES} placeholder="고객등급 선택" />
                  </div>
                </label>

                <label className="block md:col-span-2">
                  <FieldLabel>메모</FieldLabel>
                  <textarea
                    value={form.memo}
                    onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                    placeholder="고객 특이사항, 상담 내용, 후속 액션을 입력하세요"
                    rows={5}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveRecord}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4" />
                  {editId ? "수정 저장" : "등록 저장"}
                </button>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-none text-indigo-500" />
                  <p className="text-sm font-semibold leading-6 text-slate-500">
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
