"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
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
import { getCurrentUser } from "@/lib/auth";
import ContactNotes from "@/components/ContactNotes";
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

type Contact = {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  customer_type: string | null;
  management_stage: string | null;
  intake_route: string | null;
  memo: string | null;
};

type FormState = {
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  management_stage: string;
  memo: string;
};

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

function fmt(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function badgeClass(value: string | null | undefined) {
  if (value === "마스터") return "badge-purple";
  if (value === "챌린저") return "badge-info";
  if (value === "브론즈") return "badge-success";
  if (value === "추가 심사 후보") return "badge-warning";
  if (value === "판정 보류") return "badge-muted";
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

export default function CustomerRegisterPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [userName, setUserName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [notesTarget, setNotesTarget] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [gradeAssessment, setGradeAssessment] = useState<GradeAssessmentForm>({
    ...EMPTY_GRADE_ASSESSMENT,
  });

  const [search, setSearch] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterGrade, setFilterGrade] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.name) setUserName(user.name);
    fetchContacts();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,title,phone,customer_type,management_stage,intake_route,memo")
      .order("id", { ascending: false })
      .limit(1000);

    if (error) {
      showToast(`불러오기 실패: ${error.message}`);
      setContacts([]);
      setLoading(false);
      return;
    }

    setContacts((data || []) as Contact[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditId(null);
    setSelected(null);
    setForm({ ...EMPTY_FORM });
    setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
    setShowModal(true);
  };

  const openEdit = (contact: Contact) => {
    setEditId(contact.id);
    setSelected(contact);
    setForm({
      name: contact.name || "",
      title: contact.title || "",
      phone: contact.phone || "",
      intake_route: contact.intake_route || "",
      management_stage: contact.management_stage || "",
      memo: stripGradeAssessmentBlock(contact.memo),
    });
    setGradeAssessment(parseGradeAssessmentBlock(contact.memo));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setGradeAssessment({ ...EMPTY_GRADE_ASSESSMENT });
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("고객명을 입력하세요.");
      return;
    }
    if (!form.phone.trim()) {
      showToast("연락처를 입력하세요.");
      return;
    }

    setSaving(true);

    const gradeResult = calculateCustomerGrade(gradeAssessment, form.title);
    const memoWithGrade = appendGradeAssessmentBlock(
      form.memo,
      gradeAssessment,
      gradeResult,
    );

    const payload = {
      name: form.name.trim(),
      title: form.title.trim() || null,
      phone: form.phone.trim() || null,
      intake_route: form.intake_route || null,
      management_stage: form.management_stage || null,
      customer_type: gradeResult.customerGrade,
      prospect_type: null,
      assigned_to: null,
      consultant: null,
      memo: memoWithGrade || null,
    };

    const { error } = editId
      ? await supabase.from("contacts").update(payload).eq("id", editId)
      : await supabase.from("contacts").insert(payload);

    setSaving(false);

    if (error) {
      showToast(`저장 실패: ${error.message}`);
      return;
    }

    showToast(editId ? "고객 정보가 수정되었습니다." : "신규 고객이 등록되었습니다.");
    closeModal();
    fetchContacts();
  };

  const handleDelete = async (contact: Contact) => {
    const ok = confirm(`${contact.name} 고객을 삭제하시겠습니까?`);
    if (!ok) return;

    await supabase.from("rewards").delete().eq("contact_id", contact.id);
    await supabase.from("mileage_usages").delete().eq("contact_id", contact.id);
    await supabase.from("contact_notes").delete().eq("contact_id", contact.id);
    await supabase.from("notifications").delete().eq("contact_id", contact.id);
    await supabase.from("content_statuses").delete().eq("contact_id", contact.id);
    await supabase.from("member_timeline").delete().eq("contact_id", contact.id);

    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    if (error) {
      showToast(`삭제 실패: ${error.message}`);
      return;
    }

    showToast("고객이 삭제되었습니다.");
    if (selected?.id === contact.id) setSelected(null);
    fetchContacts();
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesKeyword = !keyword
        ? true
        : [
            contact.name,
            contact.title,
            contact.phone,
            contact.customer_type,
            contact.management_stage,
            contact.intake_route,
            stripGradeAssessmentBlock(contact.memo),
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);

      return (
        matchesKeyword &&
        (!filterRoute || contact.intake_route === filterRoute) &&
        (!filterStage || contact.management_stage === filterStage) &&
        (!filterGrade || contact.customer_type === filterGrade)
      );
    });
  }, [contacts, search, filterRoute, filterStage, filterGrade]);

  const routeStats = useMemo(() => {
    return INTAKE_ROUTES.map((route) => ({
      label: route,
      count: contacts.filter((contact) => contact.intake_route === route).length,
    }));
  }, [contacts]);

  const gradeStats = useMemo(() => {
    return CUSTOMER_GRADE_OPTIONS.map((grade) => ({
      label: grade,
      count: contacts.filter((contact) => contact.customer_type === grade).length,
    }));
  }, [contacts]);

  const activeFilters = [search, filterRoute, filterStage, filterGrade].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setFilterRoute("");
    setFilterStage("");
    setFilterGrade("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {toast && (
        <div
          className="fixed right-5 top-5 z-[80] rounded-[18px] px-5 py-3 text-sm font-[850]"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
        >
          {toast}
        </div>
      )}

      <header className="flex-shrink-0 px-5 pt-5 lg:px-7">
        <div className="premium-card overflow-hidden rounded-[26px] p-5 lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-[850] badge-purple">
                <Database size={15} /> 고객등록 · 자동등급 판정 적용
              </div>
              <h1 className="crm-title text-[34px] font-[930] tracking-[-0.06em] lg:text-[42px]">고객등록</h1>
              <p className="crm-subtitle mt-2 max-w-3xl">
                고객 기본정보, 유입경로, 관리구간과 등급판정 항목을 입력하면 고객등급이 자동으로 설정됩니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={fetchContacts} className="btn-premium btn-secondary">
                <RefreshCcw size={14} /> 최신화
              </button>
              <button type="button" onClick={openCreate} className="btn-premium btn-primary">
                <Plus size={15} /> 신규 고객 등록
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_2fr]">
            <div className="premium-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="crm-meta">전체 고객</p>
                  <p className="mt-2 text-[38px] font-[930] leading-none tracking-[-0.07em]" style={{ color: "var(--text-strong)" }}>
                    {contacts.length.toLocaleString()}건
                  </p>
                </div>
                <div className="premium-icon-lg">
                  <ClipboardList size={20} />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {gradeStats.slice(0, 5).map((item) => (
                  <div key={item.label} className="rounded-[16px] p-3 text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <p className="crm-tiny truncate">{item.label}</p>
                    <p className="mt-1 text-2xl font-[920]" style={{ color: "var(--text-strong)" }}>{item.count}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {routeStats.map((item) => {
                const percent = contacts.length ? Math.round((item.count / contacts.length) * 100) : 0;
                return (
                  <div key={item.label} className="premium-card min-w-0 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="crm-meta truncate">{item.label}</p>
                      <span className={`badge-premium ${badgeClass(item.label)}`}>{percent}%</span>
                    </div>
                    <p className="mt-3 text-3xl font-[930] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
                      {item.count}건
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-3))" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-5 py-5 lg:px-7">
        <div className="premium-shell space-y-4">
          <section className="premium-filterbar rounded-[18px] px-3 py-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(280px,1.4fr)_minmax(160px,0.7fr)_minmax(160px,0.7fr)_minmax(160px,0.7fr)_auto]">
              <div className="relative min-w-0">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="고객명, 직급, 연락처, 유입경로, 고객등급 검색"
                  className="crm-search w-full pl-9 pr-3"
                />
              </div>
              <SelectFilter value={filterRoute} onChange={setFilterRoute} options={INTAKE_ROUTES} label="전체 유입경로" />
              <SelectFilter value={filterStage} onChange={setFilterStage} options={MANAGEMENT_STAGES} label="전체 관리구간" />
              <SelectFilter value={filterGrade} onChange={setFilterGrade} options={CUSTOMER_GRADE_OPTIONS} label="전체 고객등급" />
              <button type="button" onClick={resetFilters} className="btn-premium btn-secondary whitespace-nowrap">
                <RefreshCcw size={14} /> 초기화 {activeFilters ? activeFilters : ""}
              </button>
            </div>
          </section>

          <section className="premium-card overflow-hidden rounded-[22px]">
            <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="premium-icon">
                  <BarChart3 size={18} />
                </div>
                <div className="min-w-0">
                  <p className="crm-card-title">고객 등록 리스트</p>
                  <p className="crm-tiny mt-1">검색 결과 {filtered.length.toLocaleString()}건 / 전체 {contacts.length.toLocaleString()}건</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-[850] badge-muted">
                <Filter size={14} /> 고객명 · 직급 · 연락처 · 유입경로 · 관리구간 · 고객등급 기준
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : filtered.length === 0 ? (
              <EmptyState onCreate={openCreate} />
            ) : (
              <>
                <div className="hidden overflow-x-auto xl:block">
                  <table className="w-full min-w-[1040px] border-collapse text-left">
                    <thead>
                      <tr className="text-xs font-[900] uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)", background: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                        <th className="px-4 py-4">고객명</th>
                        <th className="px-4 py-4">직급</th>
                        <th className="px-4 py-4">연락처</th>
                        <th className="px-4 py-4">유입경로</th>
                        <th className="px-4 py-4">관리구간</th>
                        <th className="px-4 py-4">자동등급</th>
                        <th className="px-4 py-4">메모</th>
                        <th className="px-4 py-4">등록번호</th>
                        <th className="px-4 py-4 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((contact) => (
                        <tr
                          key={contact.id}
                          onClick={() => setSelected(contact)}
                          className="cursor-pointer text-sm font-[680] transition hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                          style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] text-sm font-[930] text-white" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-3))" }}>
                                {contact.name?.slice(0, 1) || "?"}
                              </div>
                              <div>
                                <p className="font-[900]" style={{ color: "var(--text-strong)" }}>{fmt(contact.name)}</p>
                                <p className="crm-tiny">ID {contact.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">{fmt(contact.title)}</td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                              <Phone size={13} /> {fmt(contact.phone)}
                            </span>
                          </td>
                          <td className="px-4 py-4"><span className={`badge-premium ${badgeClass(contact.intake_route)}`}>{fmt(contact.intake_route)}</span></td>
                          <td className="px-4 py-4"><span className={`badge-premium ${badgeClass(contact.management_stage)}`}>{fmt(contact.management_stage)}</span></td>
                          <td className="px-4 py-4"><span className={`badge-premium ${badgeClass(contact.customer_type)}`}>{fmt(contact.customer_type)}</span></td>
                          <td className="max-w-[260px] px-4 py-4"><p className="truncate">{fmt(stripGradeAssessmentBlock(contact.memo))}</p></td>
                          <td className="px-4 py-4">#{contact.id}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                              <IconButton label="수정" onClick={() => openEdit(contact)}><Pencil size={14} /></IconButton>
                              <IconButton label="삭제" danger onClick={() => handleDelete(contact)}><Trash2 size={14} /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 xl:hidden">
                  {filtered.map((contact) => (
                    <article key={contact.id} className="premium-card p-4" onClick={() => setSelected(contact)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-sm font-[930] text-white" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-3))" }}>
                            {contact.name?.slice(0, 1) || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-[900]" style={{ color: "var(--text-strong)" }}>{fmt(contact.name)}</p>
                            <p className="crm-tiny mt-1 truncate">{fmt(contact.title)} · {fmt(contact.phone)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                          <IconButton label="수정" onClick={() => openEdit(contact)}><Pencil size={14} /></IconButton>
                          <IconButton label="삭제" danger onClick={() => handleDelete(contact)}><Trash2 size={14} /></IconButton>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className={`badge-premium ${badgeClass(contact.intake_route)}`}>{fmt(contact.intake_route)}</span>
                        <span className={`badge-premium ${badgeClass(contact.management_stage)}`}>{fmt(contact.management_stage)}</span>
                        <span className={`badge-premium ${badgeClass(contact.customer_type)}`}>{fmt(contact.customer_type)}</span>
                      </div>
                      <p className="mt-3 text-sm font-[620] leading-6" style={{ color: "var(--text-subtle)" }}>{fmt(stripGradeAssessmentBlock(contact.memo))}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {showModal && (
        <CustomerModal
          editId={editId}
          form={form}
          gradeAssessment={gradeAssessment}
          saving={saving}
          setField={setField}
          setGradeAssessment={setGradeAssessment}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {selected && (
        <CustomerDetail
          contact={selected}
          userName={userName}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onOpenNotes={() => setNotesTarget(selected)}
        />
      )}

      {notesTarget && (
        <div className="crm-modal-overlay">
          <div className="crm-modal w-[min(720px,calc(100vw-32px))]">
            <div className="slide-panel-header flex items-center justify-between gap-4">
              <div>
                <p className="crm-title text-[22px]">활동노트</p>
                <p className="crm-subtitle mt-1">{notesTarget.name} 고객 상담 이력</p>
              </div>
              <button type="button" onClick={() => setNotesTarget(null)} className="btn-premium btn-secondary h-10 w-10 p-0">
                <X size={17} />
              </button>
            </div>
            <div className="p-5">
              <ContactNotes contactId={notesTarget.id} authorName={userName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectFilter({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="crm-search w-full px-3">
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function CustomerModal({
  editId,
  form,
  gradeAssessment,
  saving,
  setField,
  setGradeAssessment,
  onClose,
  onSave,
}: {
  editId: number | null;
  form: FormState;
  gradeAssessment: GradeAssessmentForm;
  saving: boolean;
  setField: (key: keyof FormState, value: string) => void;
  setGradeAssessment: (value: GradeAssessmentForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal flex max-h-[94vh] w-[min(1180px,calc(100vw-32px))] max-w-none flex-col">
        <div className="slide-panel-header flex items-center justify-between gap-4">
          <div>
            <p className="crm-title text-[22px]">{editId ? "고객 수정" : "신규 고객 등록"}</p>
            <p className="crm-subtitle mt-1">고객 기본정보와 등급판정 항목을 입력합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-10 w-10 p-0">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="고객명 *" value={form.name} onChange={(value) => setField("name", value)} placeholder="홍길동" />
            <FormInput label="직급" value={form.title} onChange={(value) => setField("title", value)} placeholder="본부장 / 팀장 / 대표 등" />
            <FormInput label="연락처 *" value={form.phone} onChange={(value) => setField("phone", formatPhoneInput(value))} placeholder="010-1234-5678" />
            <FormSelect label="유입경로" value={form.intake_route} onChange={(value) => setField("intake_route", value)} options={INTAKE_ROUTES} />
            <FormSelect label="관리구간" value={form.management_stage} onChange={(value) => setField("management_stage", value)} options={MANAGEMENT_STAGES} />
            <div className="rounded-[15px] border px-4 py-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              <p className="crm-meta">고객등급</p>
              <p className="mt-2 text-xl font-[930]" style={{ color: "var(--text-strong)" }}>
                {calculateCustomerGrade(gradeAssessment, form.title).customerGrade}
              </p>
              <p className="crm-tiny mt-1">등급판정 항목 기준 자동 설정</p>
            </div>
          </div>

          <div className="mt-5">
            <CustomerGradeAssessment value={gradeAssessment} title={form.title} onChange={setGradeAssessment} />
          </div>

          <div className="mt-4">
            <label className="crm-meta mb-2 block">메모</label>
            <textarea
              value={form.memo}
              onChange={(event) => setField("memo", event.target.value)}
              rows={4}
              placeholder="고객 특이사항, 상담 메모, 다음 액션 등을 입력하세요."
              className="w-full resize-none rounded-[14px] border px-4 py-3 text-[13px] font-[640] outline-none"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>
        </div>

        <div className="slide-panel-footer flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-premium btn-secondary">취소</button>
          <button type="button" onClick={onSave} disabled={saving} className="btn-premium btn-primary">
            <Save size={15} /> {saving ? "저장 중..." : editId ? "수정 저장" : "고객 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetail({
  contact,
  userName,
  onClose,
  onEdit,
  onOpenNotes,
}: {
  contact: Contact;
  userName: string;
  onClose: () => void;
  onEdit: () => void;
  onOpenNotes: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-30 w-full max-w-[560px] border-l" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}>
      <div className="flex h-full flex-col">
        <div className="slide-panel-header flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className={`badge-premium ${badgeClass(contact.customer_type)}`}>{fmt(contact.customer_type)}</span>
              <span className={`badge-premium ${badgeClass(contact.management_stage)}`}>{fmt(contact.management_stage)}</span>
            </div>
            <p className="crm-title text-[24px]">{fmt(contact.name)}</p>
            <p className="crm-subtitle mt-1">{fmt(contact.title)} · {fmt(contact.phone)}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-10 w-10 p-0">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="premium-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="crm-card-title">고객 상세정보</p>
                <p className="crm-tiny mt-1">등록된 고객 기본정보입니다.</p>
              </div>
              <button type="button" onClick={onEdit} className="btn-premium btn-secondary">
                <Pencil size={14} /> 수정
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="고객명" value={contact.name} />
              <DetailItem label="직급" value={contact.title} />
              <DetailItem label="연락처" value={contact.phone} />
              <DetailItem label="유입경로" value={contact.intake_route} />
              <DetailItem label="관리구간" value={contact.management_stage} />
              <DetailItem label="고객등급" value={contact.customer_type} />
              <DetailItem label="등록번호" value={`#${contact.id}`} />
              <DetailItem label="메모" value={stripGradeAssessmentBlock(contact.memo)} wide />
            </div>
          </section>

          <section className="premium-card mt-4 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="crm-card-title">활동노트</p>
                <p className="crm-tiny mt-1">상담 이력과 후속 액션을 관리합니다.</p>
              </div>
              <button type="button" onClick={onOpenNotes} className="btn-premium btn-secondary">
                전체보기
              </button>
            </div>
            <ContactNotes contactId={contact.id} authorName={userName} />
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, wide = false }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={`rounded-[15px] border px-4 py-3 ${wide ? "sm:col-span-2" : ""}`} style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <p className="crm-meta">{label}</p>
      <p className="mt-2 text-sm font-[760] leading-6" style={{ color: "var(--text-strong)" }}>{fmt(value)}</p>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block min-w-0">
      <span className="crm-meta mb-2 block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-[42px] w-full rounded-[13px] border px-3 text-[13px] font-[680] outline-none"
        style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
      />
    </label>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block min-w-0">
      <span className="crm-meta mb-2 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[42px] w-full rounded-[13px] border px-3 text-[13px] font-[680] outline-none"
        style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <option value="">선택</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function IconButton({ children, label, danger = false, onClick }: { children: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors"
      style={{
        color: danger ? "var(--danger-text)" : "var(--info-text)",
        background: danger ? "var(--danger-bg)" : "var(--info-bg)",
        border: `1px solid ${danger ? "var(--danger-border)" : "var(--info-border)"}`,
      }}
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex h-60 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center px-4 text-center">
      <div className="premium-icon-lg mb-4"><UserRound size={22} /></div>
      <p className="crm-card-title">등록된 고객이 없습니다.</p>
      <p className="crm-subtitle mt-2">신규 고객 등록을 눌러 고객 DB를 입력하세요.</p>
      <button type="button" onClick={onCreate} className="btn-premium btn-primary mt-5">
        <Plus size={15} /> 신규 고객 등록
      </button>
    </div>
  );
}
