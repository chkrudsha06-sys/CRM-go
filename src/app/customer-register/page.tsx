"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ClipboardList,
  Filter,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import ContactNotes from "@/components/ContactNotes";

interface Contact {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  customer_type: string | null;
  prospect_type: string | null;
  management_stage: string | null;
  assigned_to: string | null;
  consultant: string | null;
  intake_route: string | null;
  meeting_date: string | null;
  meeting_address: string | null;
  meeting_result: string | null;
  memo: string | null;
  tm_sensitivity: string | null;
  contract_date: string | null;
  reservation_date: string | null;
  operating_site: string | null;
  total_org_count: string | null;
  team_org_count: string | null;
  rt: string | null;
}

type FormState = {
  name: string;
  title: string;
  phone: string;
  customer_type: string;
  management_stage: string;
  assigned_to: string;
  consultant: string;
  intake_route: string;
  prospect_type: string;
  meeting_date: string;
  meeting_address: string;
  meeting_result: string;
  memo: string;
  tm_sensitivity: string;
  operating_site: string;
  total_org_count: string;
  team_org_count: string;
  rt: string;
};

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const CONSULTANTS = [
  "박경화",
  "박혜은",
  "조승현",
  "박민경",
  "백선중",
  "강아름",
  "전정훈",
  "박나라",
];

const OPT = {
  customer_type: ["신규", "기고객"],
  management_stage: ["리드", "프로스펙팅", "딜크로징", "리텐션"],
  intake_route: [
    "컨설턴트VIP DB",
    "컨설턴트 교차DB",
    "신규TM",
    "완판트럭",
    "분양회MGM",
  ],
  prospect_type: ["즉가입가망", "미팅예정가망", "연계매출가망"],
  meeting_result: [
    "계약완료",
    "예약완료",
    "서류만수취",
    "미팅후가망관리",
    "계약거부",
    "미팅불발",
  ],
};

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  phone: "",
  customer_type: "",
  management_stage: "",
  assigned_to: "",
  consultant: "",
  intake_route: "",
  prospect_type: "",
  meeting_date: "",
  meeting_address: "",
  meeting_result: "",
  memo: "",
  tm_sensitivity: "",
  operating_site: "",
  total_org_count: "",
  team_org_count: "",
  rt: "",
};

const stageMeta: Record<string, { className: string; color: string }> = {
  리드: { className: "badge-info", color: "#3b82f6" },
  프로스펙팅: { className: "badge-warning", color: "#f59e0b" },
  딜크로징: { className: "badge-danger", color: "#ef4444" },
  리텐션: { className: "badge-success", color: "#10b981" },
};

function stageColor(stage: string | null) {
  if (!stage) return "#94a3b8";
  return stageMeta[stage]?.color || "#94a3b8";
}

function badgeClass(type: string | null, fallback = "badge-muted") {
  if (!type) return fallback;
  if (type === "신규") return "badge-success";
  if (type === "기고객") return "badge-warning";
  if (type === "컨설턴트VIP DB") return "badge-purple";
  if (type === "컨설턴트 교차DB") return "badge-info";
  if (type === "신규TM") return "badge-cyan";
  if (type === "완판트럭") return "badge-warning";
  if (type === "분양회MGM") return "badge-success";
  return fallback;
}

function fmt(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function HeaderCell({ label }: { label: string }) {
  return (
    <div className="flex min-w-0 items-center justify-center text-center">
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function CustomerRegisterPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState("");
  const [toast, setToast] = useState("");
  const [notesPopup, setNotesPopup] = useState<{
    contactId: number;
    name: string;
  } | null>(null);
  const [openedEditQuery, setOpenedEditQuery] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [fCustomerType, setFCustomerType] = useState("");
  const [fStage, setFStage] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fConsultant, setFConsultant] = useState("");
  const [fIntake, setFIntake] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setUserName(user.name);
      if (user.role === "exec") {
        setForm((prev) => ({ ...prev, assigned_to: user.name }));
      }
    }
    fetchContacts();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || loading || openedEditQuery) return;
    const params = new URLSearchParams(window.location.search);
    const editIdFromQuery = params.get("edit");
    if (!editIdFromQuery) return;

    const targetId = Number(editIdFromQuery);
    if (!Number.isFinite(targetId)) return;

    const targetContact = contacts.find((contact) => contact.id === targetId);
    if (!targetContact) return;

    setSelectedContact(targetContact);
    handleEdit(targetContact);
    setOpenedEditQuery(editIdFromQuery);
  }, [contacts, loading, openedEditQuery]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  };

  const fetchContacts = async () => {
    setLoading(true);
    const user = getCurrentUser();

    let query = supabase
      .from("contacts")
      .select(
        "id,name,title,phone,customer_type,prospect_type,management_stage,assigned_to,consultant,intake_route,meeting_date,meeting_address,meeting_result,memo,tm_sensitivity,contract_date,reservation_date,operating_site,total_org_count,team_org_count,rt",
      )
      .order("id", { ascending: false })
      .limit(500);

    if (user?.role === "exec") {
      query = query.eq("assigned_to", user.name);
    }

    const { data, error } = await query;
    if (error) {
      showToast(`불러오기 실패: ${error.message}`);
      setContacts([]);
      setLoading(false);
      return;
    }

    setContacts((data || []) as Contact[]);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("고객명을 입력하세요");
      return;
    }

    setSaving(true);
    const payload: Record<string, string | null> = {};
    Object.entries(form).forEach(([key, value]) => {
      payload[key] = value.trim() || null;
    });

    const { error } = editId
      ? await supabase.from("contacts").update(payload).eq("id", editId)
      : await supabase.from("contacts").insert(payload);

    setSaving(false);

    if (error) {
      showToast(`저장 실패: ${error.message}`);
      return;
    }

    showToast(editId ? "수정 완료" : "등록 완료");
    setShowAdd(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    fetchContacts();
  };

  const handleEdit = (contact: Contact) => {
    setEditId(contact.id);
    setForm({
      name: contact.name || "",
      title: contact.title || "",
      phone: contact.phone || "",
      customer_type: contact.customer_type || "",
      management_stage: contact.management_stage || "",
      assigned_to: contact.assigned_to || "",
      consultant: contact.consultant || "",
      intake_route: contact.intake_route || "",
      prospect_type: contact.prospect_type || "",
      meeting_date: contact.meeting_date || "",
      meeting_address: contact.meeting_address || "",
      meeting_result: contact.meeting_result || "",
      memo: contact.memo || "",
      tm_sensitivity: contact.tm_sensitivity || "",
      operating_site: contact.operating_site || "",
      total_org_count: contact.total_org_count || "",
      team_org_count: contact.team_org_count || "",
      rt: contact.rt || "",
    });
    setShowAdd(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${name} 고객을 삭제하시겠습니까?`)) return;

    await supabase.from("rewards").delete().eq("contact_id", id);
    await supabase.from("mileage_usages").delete().eq("contact_id", id);
    await supabase.from("contact_notes").delete().eq("contact_id", id);
    await supabase.from("notifications").delete().eq("contact_id", id);
    await supabase.from("push_subscriptions").delete().eq("contact_id", id);
    await supabase.from("content_statuses").delete().eq("contact_id", id);
    await supabase.from("site_info_history").delete().eq("contact_id", id);
    await supabase.from("member_timeline").delete().eq("contact_id", id);

    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      showToast(`삭제 실패: ${error.message}`);
      return;
    }

    showToast(`${name} 삭제 완료`);
    fetchContacts();
  };

  const activeFilters = [
    fCustomerType,
    fStage,
    fAssigned,
    fConsultant,
    fIntake,
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    return contacts.filter((contact) => {
      if (search) {
        const keyword = search.toLowerCase();
        const target =
          `${contact.name || ""} ${contact.title || ""} ${contact.phone || ""}`.toLowerCase();
        if (!target.includes(keyword)) return false;
      }
      if (fCustomerType && contact.customer_type !== fCustomerType)
        return false;
      if (fStage && contact.management_stage !== fStage) return false;
      if (fAssigned && contact.assigned_to !== fAssigned) return false;
      if (fConsultant && contact.consultant !== fConsultant) return false;
      if (fIntake && contact.intake_route !== fIntake) return false;
      return true;
    });
  }, [
    contacts,
    fAssigned,
    fConsultant,
    fCustomerType,
    fIntake,
    fStage,
    search,
  ]);

  const intakeCounts = useMemo(() => {
    return OPT.intake_route.map((route) => ({
      route,
      count: filtered.filter((contact) => contact.intake_route === route)
        .length,
    }));
  }, [filtered]);

  const assigneeCount = useMemo(() => {
    return new Set(
      filtered.map((contact) => contact.assigned_to).filter(Boolean),
    ).size;
  }, [filtered]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setSearch("");
    setFCustomerType("");
    setFStage("");
    setFAssigned("");
    setFConsultant("");
    setFIntake("");
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    const user = getCurrentUser();
    if (user?.role === "exec") {
      setForm((prev) => ({ ...prev, assigned_to: user.name }));
    }
    setShowAdd(true);
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <header className="premium-header flex-shrink-0 px-5 py-4 lg:px-7">
        <div className="premium-shell flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="badge-premium badge-purple">
                  <ClipboardList size={13} /> 고객등록
                </span>
                <span className="badge-premium badge-muted">
                  실시간 고객 관리
                </span>
              </div>
              <h1 className="crm-title">고객등록</h1>
              <p className="crm-subtitle mt-2">
                신규 고객 등록부터 유입경로, 담당자, 활동노트까지 한 화면에서
                관리합니다.
              </p>
            </div>

          </div>

          <div className="premium-filterbar rounded-[18px] px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[240px] flex-1 xl:max-w-[360px]">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-faint)" }}
                  />
                  <input
                    type="text"
                    placeholder="고객명, 직급, 연락처 검색"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="crm-search w-full pl-9 pr-3"
                  />
                </div>

                <SelectFilter
                  value={fIntake}
                  onChange={setFIntake}
                  options={OPT.intake_route}
                  label="유입경로"
                />
                <SelectFilter
                  value={fCustomerType}
                  onChange={setFCustomerType}
                  options={OPT.customer_type}
                  label="고객유형"
                />
                <SelectFilter
                  value={fStage}
                  onChange={setFStage}
                  options={OPT.management_stage}
                  label="관리구간"
                />
                <SelectFilter
                  value={fAssigned}
                  onChange={setFAssigned}
                  options={TEAM}
                  label="담당자"
                />
                <SelectFilter
                  value={fConsultant}
                  onChange={setFConsultant}
                  options={CONSULTANTS}
                  label="컨설턴트"
                />
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn-premium btn-secondary"
                >
                  <RefreshCcw size={14} /> 초기화
                  {activeFilters > 0 ? ` ${activeFilters}` : ""}
                </button>
                <button
                  type="button"
                  onClick={fetchContacts}
                  className="btn-premium btn-secondary"
                >
                  <Filter size={14} /> 최신화
                </button>
                <button
                  type="button"
                  onClick={openCreate}
                  className="btn-premium btn-primary"
                >
                  <Plus size={15} /> 신규 등록
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-5 py-5 lg:px-7">
        <div className="premium-shell space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(180px,0.55fr)_minmax(180px,0.55fr)]">
            <IntakeRouteSummary counts={intakeCounts} />
            <StatusCard
              icon={<Sparkles size={17} />}
              label="활성 필터"
              value={activeFilters + (search ? 1 : 0)}
              tone="purple"
            />
            <StatusCard
              icon={<Users size={17} />}
              label="담당자 수"
              value={assigneeCount}
              tone="success"
            />
          </div>

          <section
            className="crm-table-wrap overflow-y-auto overflow-x-hidden"
            style={{
              borderColor: "rgba(148,163,184,0.22)",
              background: "var(--surface)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.04), var(--shadow-sm)",
              maxHeight: "calc(100vh - 300px)",
            }}
          >
            <div className="hidden w-full min-w-0 xl:block">
              <div
                className="sticky top-0 z-20 grid h-[50px] items-center gap-1 border-b px-3 text-[11px] font-[820] tracking-[-0.02em] backdrop-blur-xl 2xl:h-[54px] 2xl:gap-2 2xl:px-4 2xl:text-[13px]"
                style={{
                  gridTemplateColumns:
                    "clamp(36px,2.35vw,54px) minmax(84px,0.8fr) minmax(108px,1.05fr) minmax(104px,0.9fr) minmax(70px,0.72fr) minmax(76px,0.74fr) minmax(66px,0.66fr) minmax(72px,0.7fr) minmax(118px,1.08fr) minmax(42px,0.46fr) minmax(42px,0.46fr) minmax(42px,0.42fr) minmax(150px,1.38fr) minmax(62px,0.58fr)",
                  borderColor: "rgba(148,163,184,0.28)",
                  color: "var(--text-strong)",
                  background: "var(--surface-2)",
                  boxShadow: "0 10px 24px rgba(15,23,42,0.10)",
                }}
              >
                <HeaderCell label="No" />
                <HeaderCell label="유입경로" />
                <HeaderCell label="고객명 / 직급" />
                <HeaderCell label="연락처" />
                <HeaderCell label="고객유형" />
                <HeaderCell label="관리구간" />
                <HeaderCell label="담당자" />
                <HeaderCell label="컨설턴트" />
                <HeaderCell label="운영현장" />
                <HeaderCell label="전체조직" />
                <HeaderCell label="팀조직" />
                <HeaderCell label="R/T" />
                <HeaderCell label="활동노트" />
                <span className="text-center">관리</span>
              </div>

              {loading ? (
                <LoadingState />
              ) : filtered.length === 0 ? (
                <EmptyState />
              ) : (
                <div style={{ background: "rgba(255,255,255,0.015)" }}>
                  {filtered.map((contact, index) => {
                    return (
                      <div key={contact.id}>
                        <div
                          className="crm-contact-row group grid min-h-[66px] cursor-pointer items-center gap-1 border-b px-3 text-center text-[10.5px] transition-all duration-150 2xl:min-h-[78px] 2xl:gap-2 2xl:px-4 2xl:text-[12px]"
                          onClick={() => setSelectedContact(contact)}
                          style={{
                            gridTemplateColumns:
                              "clamp(36px,2.35vw,54px) minmax(84px,0.8fr) minmax(108px,1.05fr) minmax(104px,0.9fr) minmax(70px,0.72fr) minmax(76px,0.74fr) minmax(66px,0.66fr) minmax(72px,0.7fr) minmax(118px,1.08fr) minmax(42px,0.46fr) minmax(42px,0.46fr) minmax(42px,0.42fr) minmax(150px,1.38fr) minmax(62px,0.58fr)",
                            borderLeft: `3px solid ${stageColor(contact.management_stage)}`,
                            borderBottomColor: "rgba(148,163,184,0.18)",
                            background:
                              index % 2 === 0
                                ? "rgba(255,255,255,0.018)"
                                : "rgba(255,255,255,0.008)",
                          }}
                        >
                          <span
                            className="text-center text-[10.5px] font-[720] 2xl:text-[12px]"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {index + 1}
                          </span>

                          <span
                            className={`badge-premium mx-auto justify-center ${badgeClass(contact.intake_route)}`}
                          >
                            {fmt(contact.intake_route)}
                          </span>

                          <div className="flex min-w-0 flex-col items-center justify-center text-center leading-tight">
                            <p
                              className="min-w-0 max-w-full truncate text-[12px] font-[800] tracking-[-0.02em] 2xl:text-[13.5px]"
                              style={{ color: "var(--text-strong)" }}
                            >
                              {contact.name}
                            </p>
                            <p
                              className="mt-0.5 min-w-0 max-w-full truncate text-[10px] font-[620] tracking-[-0.01em] 2xl:mt-1 2xl:text-[11.5px]"
                              style={{ color: "var(--text-subtle)" }}
                            >
                              {fmt(contact.title)}
                            </p>
                          </div>

                          <span className="crm-row-sub flex items-center justify-center gap-1 text-center text-[10.5px] font-[680] 2xl:gap-1.5 2xl:text-[12px]">
                            <Phone size={12} className="flex-shrink-0 2xl:h-[13px] 2xl:w-[13px]" /> {fmt(contact.phone)}
                          </span>

                          <span
                            className={`badge-premium mx-auto justify-center ${badgeClass(contact.customer_type)}`}
                          >
                            {fmt(contact.customer_type)}
                          </span>

                          <span
                            className={`badge-premium mx-auto justify-center ${stageMeta[contact.management_stage || ""]?.className || "badge-muted"}`}
                          >
                            {fmt(contact.management_stage)}
                          </span>

                          <span
                            className="crm-row-sub text-center text-[10.5px] font-[720] 2xl:text-[12px]"
                            style={{ color: "var(--purple-text)" }}
                          >
                            {fmt(contact.assigned_to)}
                          </span>

                          <span className="crm-row-sub text-center text-[10.5px] font-[680] 2xl:text-[12px]">
                            {fmt(contact.consultant)}
                          </span>

                          <span className="crm-row-sub flex min-w-0 items-center justify-center gap-1 px-0.5 text-center text-[10.5px] font-[680] leading-snug whitespace-nowrap 2xl:gap-1.5 2xl:px-1 2xl:text-[12px]">
                            <MapPin size={12} className="flex-shrink-0 2xl:h-[13px] 2xl:w-[13px]" />
                            <span className="min-w-0 truncate whitespace-nowrap">
                              {fmt(contact.operating_site)}
                            </span>
                          </span>

                          <span className="crm-row-sub text-center text-[10.5px] font-[680] 2xl:text-[12px]">
                            {fmt(contact.total_org_count)}
                          </span>
                          <span className="crm-row-sub text-center text-[10.5px] font-[680] 2xl:text-[12px]">
                            {fmt(contact.team_org_count)}
                          </span>
                          <span className="crm-row-sub text-center text-[10.5px] font-[680] 2xl:text-[12px]">
                            {fmt(contact.rt)}
                          </span>

                          <div
                            className="min-w-0 cursor-pointer overflow-hidden text-center"
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              setNotesPopup({
                                contactId: contact.id,
                                name: contact.name,
                              });
                            }}
                            title="더블클릭하여 활동노트 보기/편집"
                          >
                            <ContactNotes contactId={contact.id} compact />
                          </div>

                          <div className="flex items-center justify-center gap-1">
                            <IconButton
                              label="수정"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEdit(contact);
                              }}
                            >
                              <Pencil size={14} />
                            </IconButton>
                            <IconButton
                              label="삭제"
                              danger
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(contact.id, contact.name);
                              }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                            <span
                              className="ml-1 text-[11px] font-[800]"
                              style={{ color: "var(--text-faint)" }}
                            >
                              상세
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 p-3 xl:hidden">
              {loading ? (
                <LoadingState />
              ) : filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map((contact, index) => {
                  return (
                    <article
                      key={contact.id}
                      className="premium-card premium-card-hover overflow-hidden"
                      style={{
                        borderLeft: `3px solid ${stageColor(contact.management_stage)}`,
                      }}
                    >
                      <div
                        className="cursor-pointer p-4"
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="min-w-0">
                                <p className="crm-row-main truncate text-[15px]">
                                  {contact.name}
                                </p>
                                <p className="crm-row-sub mt-1 truncate text-[12px]">
                                  {fmt(contact.title)}
                                </p>
                              </div>
                              <span className="crm-tiny">#{index + 1}</span>
                            </div>
                            <p className="crm-row-sub mt-0.5">
                              {fmt(contact.phone)}
                            </p>
                          </div>
                          <span
                            className="rounded-full border px-2.5 py-1 text-[11px] font-[800]"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-subtle)",
                              background: "var(--surface-2)",
                            }}
                          >
                            상세보기
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span
                            className={`badge-premium mx-auto justify-center ${badgeClass(contact.intake_route)}`}
                          >
                            {fmt(contact.intake_route)}
                          </span>
                          <span
                            className={`badge-premium mx-auto justify-center ${stageMeta[contact.management_stage || ""]?.className || "badge-muted"}`}
                          >
                            {fmt(contact.management_stage)}
                          </span>
                          <span
                            className={`badge-premium mx-auto justify-center ${badgeClass(contact.customer_type)}`}
                          >
                            {fmt(contact.customer_type)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <MiniInfo
                            label="담당자"
                            value={fmt(contact.assigned_to)}
                          />
                          <MiniInfo
                            label="컨설턴트"
                            value={fmt(contact.consultant)}
                          />
                          <MiniInfo
                            label="운영현장"
                            value={fmt(contact.operating_site)}
                          />
                          <MiniInfo
                            label="조직/R/T"
                            value={`${fmt(contact.total_org_count)} / ${fmt(contact.rt)}`}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>

      {showAdd && (
        <CustomerModal
          editId={editId}
          form={form}
          saving={saving}
          setField={setField}
          onClose={() => {
            setShowAdd(false);
            setEditId(null);
          }}
          onSave={handleSave}
        />
      )}

      {selectedContact && (
        <CustomerDetailPanel
          contact={selectedContact}
          userName={userName}
          onClose={() => setSelectedContact(null)}
          onEdit={(contact) => {
            setSelectedContact(null);
            handleEdit(contact);
          }}
        />
      )}

      {notesPopup && (
        <div className="crm-modal-overlay" onClick={() => setNotesPopup(null)}>
          <div
            className="crm-modal flex max-h-[80vh] max-w-[620px] flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <p className="crm-card-title">{notesPopup.name} 활동노트</p>
                <p className="crm-tiny mt-1">
                  메모를 추가하거나 기존 활동 이력을 확인합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesPopup(null)}
                className="btn-premium btn-secondary h-9 w-9 p-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <ContactNotes
                contactId={notesPopup.contactId}
                authorName={userName}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`

        .crm-contact-row .badge-premium {
          max-width: 100%;
          min-width: 0;
          padding-left: clamp(6px, 0.45vw, 10px);
          padding-right: clamp(6px, 0.45vw, 10px);
          font-size: clamp(10px, 0.55vw, 11.5px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .crm-table-wrap .crm-row-sub,
        .crm-table-wrap .crm-contact-row span,
        .crm-table-wrap .crm-contact-row p {
          min-width: 0;
        }
        @media (min-width: 2300px) {
          .crm-contact-row .badge-premium {
            font-size: 12px;
            padding-left: 10px;
            padding-right: 10px;
          }
        }
        .crm-contact-row {
          position: relative;
        }
        .crm-contact-row:hover {
          background: color-mix(in srgb, var(--accent) 10%, var(--surface-2)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 -1px 0 rgba(255,255,255,0.04),
            0 12px 30px rgba(15,23,42,0.16);
          transform: translateY(-1px);
          outline: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
          outline-offset: -1px;
        }
        .crm-contact-row:hover::after {
          content: "";
          position: absolute;
          inset: 8px 10px;
          border-radius: 16px;
          pointer-events: none;
          border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
        }
        .crm-contact-row:hover .crm-row-sub,
        .crm-contact-row:hover p,
        .crm-contact-row:hover span {
          color: var(--text-strong);
        }
        html[data-theme="light"] .crm-contact-row:hover,
        body.light .crm-contact-row:hover {
          background: color-mix(in srgb, var(--accent) 8%, #ffffff) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.88),
            0 10px 26px rgba(15,23,42,0.10);
        }
        html[data-theme="dark"] .crm-contact-row:hover,
        body.dark .crm-contact-row:hover {
          background: color-mix(in srgb, var(--accent) 13%, #111827) !important;
        }
      `}</style>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[14px] px-5 py-3 text-[13px] font-[780] text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[38px] min-w-[118px] appearance-none rounded-full border px-3 pr-8 text-[12.5px] font-[720] outline-none transition-colors"
        style={{
          background: value ? "var(--accent-subtle)" : "var(--surface-2)",
          borderColor: value ? "var(--accent-border)" : "var(--border)",
          color: value ? "var(--accent-text)" : "var(--text-muted)",
        }}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--text-faint)" }}
      />
    </div>
  );
}

function IntakeRouteSummary({
  counts,
}: {
  counts: { route: string; count: number }[];
}) {
  return (
    <div className="premium-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="premium-icon-sm badge-info">
            <ClipboardList size={17} />
          </div>
          <div>
            <p className="crm-tiny">유입경로별 카운팅</p>
            <p className="crm-card-title mt-0.5">현재 표시 기준</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {counts.map((item) => (
          <div
            key={item.route}
            className="rounded-[13px] border px-3 py-2 text-center"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
            }}
          >
            <p
              className="truncate text-[11px] font-[780] tracking-[-0.02em]"
              style={{ color: "var(--text-subtle)" }}
            >
              {item.route}
            </p>
            <p
              className="mt-1 text-[18px] font-[850] tracking-[-0.05em]"
              style={{ color: "var(--text-strong)" }}
            >
              {item.count.toLocaleString()}건
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "info" | "purple" | "success";
}) {
  const toneClass =
    tone === "info"
      ? "badge-info"
      : tone === "purple"
        ? "badge-purple"
        : "badge-success";
  return (
    <div className="premium-card flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`premium-icon-sm ${toneClass}`}>{icon}</div>
        <div>
          <p className="crm-tiny">{label}</p>
          <p className="crm-card-title mt-0.5">{value.toLocaleString()}건</p>
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[12px] border px-3 py-2"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <p className="crm-tiny">{label}</p>
      <p className="crm-row-sub mt-1 truncate">{value}</p>
    </div>
  );
}

function DetailGrid({ contact }: { contact: Contact }) {
  const detailItems = [
    { label: "고객명", value: contact.name },
    { label: "직급", value: contact.title },
    { label: "연락처", value: contact.phone },
    { label: "고객유형", value: contact.customer_type },
    { label: "관리구간", value: contact.management_stage },
    { label: "담당자", value: contact.assigned_to },
    { label: "컨설턴트", value: contact.consultant },
    { label: "유입경로", value: contact.intake_route },
    { label: "가망유형", value: contact.prospect_type },
    { label: "미팅결과", value: contact.meeting_result },
    { label: "TM감도", value: contact.tm_sensitivity },
    { label: "계약일", value: contact.contract_date },
    { label: "예약일", value: contact.reservation_date },
    { label: "운영현장", value: contact.operating_site },
    { label: "전체조직", value: contact.total_org_count },
    { label: "팀조직", value: contact.team_org_count },
    { label: "R/T", value: contact.rt },
    { label: "메모", value: contact.memo },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {detailItems.map((item) => (
        <MiniInfo key={item.label} label={item.label} value={fmt(item.value)} />
      ))}
    </div>
  );
}

function CustomerDetailPanel({
  contact,
  userName,
  onClose,
  onEdit,
}: {
  contact: Contact;
  userName: string;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        aria-label="상세 패널 닫기"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        style={{ background: "rgba(2,6,23,0.42)", backdropFilter: "blur(3px)" }}
      />

      <aside
        className="relative z-[71] flex h-full w-full max-w-[680px] flex-col overflow-hidden border-l"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border-2)",
          boxShadow: "-24px 0 70px rgba(2,6,23,0.34)",
          animation:
            "customerDetailSlideIn 240ms var(--ease-soft, cubic-bezier(.2,.8,.2,1)) both",
        }}
      >
        <div
          className="flex flex-shrink-0 items-start justify-between gap-4 px-5 py-5"
          style={{
            borderBottom: "1px solid var(--border)",
            background:
              "radial-gradient(circle at 0% 0%, rgba(139,124,246,0.14), transparent 42%), var(--surface)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] border"
              style={{
                background: "var(--accent-subtle)",
                borderColor: "var(--accent-border)",
                color: "var(--accent-text)",
              }}
            >
              <UserRound size={20} />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className={`badge-premium ${badgeClass(contact.intake_route)}`}
                >
                  {fmt(contact.intake_route)}
                </span>
                <span
                  className={`badge-premium ${stageMeta[contact.management_stage || ""]?.className || "badge-muted"}`}
                >
                  {fmt(contact.management_stage)}
                </span>
              </div>
              <h2 className="crm-title text-[24px]">{contact.name}</h2>
              <p className="crm-subtitle mt-1">
                {fmt(contact.title)} · {fmt(contact.phone)} · 담당{" "}
                {fmt(contact.assigned_to)}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(contact)}
              className="btn-premium btn-secondary"
            >
              <Pencil size={14} /> 수정
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-premium btn-secondary h-10 w-10 p-0"
              aria-label="닫기"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="premium-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="crm-card-title">고객 상세정보</p>
                <p className="crm-tiny mt-1">
                  신규 고객 등록 시 입력한 기본 정보를 기준으로 표시합니다.
                </p>
              </div>
              <span
                className={`badge-premium ${badgeClass(contact.customer_type)}`}
              >
                {fmt(contact.customer_type)}
              </span>
            </div>
            <DetailGrid contact={contact} />
          </section>

          <section className="premium-card mt-4 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="crm-card-title">활동노트</p>
                <p className="crm-tiny mt-1">
                  상담 이력과 후속 액션을 관리합니다.
                </p>
              </div>
              <span className="badge-premium badge-muted">실시간 메모</span>
            </div>
            <ContactNotes contactId={contact.id} authorName={userName} />
          </section>
        </div>
      </aside>

      <style>{`
        @keyframes customerDetailSlideIn {
          from {
            transform: translateX(42px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function CustomerModal({
  editId,
  form,
  saving,
  setField,
  onClose,
  onSave,
}: {
  editId: number | null;
  form: FormState;
  saving: boolean;
  setField: (key: keyof FormState, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal flex max-h-[94vh] w-[min(1180px,calc(100vw-40px))] max-w-none flex-col">
        <div className="slide-panel-header flex items-center justify-between gap-4">
          <div>
            <p className="crm-title text-[22px]">
              {editId ? "고객 수정" : "신규 고객 등록"}
            </p>
            <p className="crm-subtitle mt-1">
              고객 기본정보와 영업 관리 항목을 입력합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary h-10 w-10 p-0"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput
              label="고객명 *"
              value={form.name}
              onChange={(value) => setField("name", value)}
              placeholder="홍길동"
            />
            <FormInput
              label="직급"
              value={form.title}
              onChange={(value) => setField("title", value)}
              placeholder="본부장"
            />
            <FormInput
              label="연락처"
              value={form.phone}
              onChange={(value) => setField("phone", formatPhoneInput(value))}
              placeholder="010-1234-5678"
            />
            <FormSelect
              label="유입경로"
              value={form.intake_route}
              onChange={(value) => setField("intake_route", value)}
              options={OPT.intake_route}
            />
            <FormSelect
              label="고객유형"
              value={form.customer_type}
              onChange={(value) => setField("customer_type", value)}
              options={OPT.customer_type}
            />
            <FormSelect
              label="관리구간"
              value={form.management_stage}
              onChange={(value) => setField("management_stage", value)}
              options={OPT.management_stage}
            />
            <FormSelect
              label="가망유형"
              value={form.prospect_type}
              onChange={(value) => setField("prospect_type", value)}
              options={OPT.prospect_type}
            />
            <FormSelect
              label="미팅결과"
              value={form.meeting_result}
              onChange={(value) => setField("meeting_result", value)}
              options={OPT.meeting_result}
            />
            <FormSelect
              label="대협팀 담당자"
              value={form.assigned_to}
              onChange={(value) => setField("assigned_to", value)}
              options={TEAM}
            />
            <FormSelect
              label="담당 컨설턴트"
              value={form.consultant}
              onChange={(value) => setField("consultant", value)}
              options={CONSULTANTS}
            />
            <FormInput
              label="운영현장"
              value={form.operating_site}
              onChange={(value) => setField("operating_site", value)}
              placeholder="예: 경남 양산"
            />
            <FormSelect
              label="TM감도"
              value={form.tm_sensitivity}
              onChange={(value) => setField("tm_sensitivity", value)}
              options={["상", "중", "하"]}
            />
            <FormInput
              label="전체조직수"
              value={form.total_org_count}
              onChange={(value) => setField("total_org_count", value)}
              placeholder="예: 150"
            />
            <FormInput
              label="팀조직수"
              value={form.team_org_count}
              onChange={(value) => setField("team_org_count", value)}
              placeholder="예: 30"
            />
            <FormInput
              label="R/T"
              value={form.rt}
              onChange={(value) => setField("rt", value)}
              placeholder="예: 팀500만원"
            />
          </div>

          <div className="mt-4">
            <label className="crm-meta mb-2 block">메모</label>
            <textarea
              value={form.memo}
              onChange={(event) => setField("memo", event.target.value)}
              rows={3}
              placeholder="고객 특이사항, 상담 메모, 다음 액션 등을 입력하세요."
              className="w-full resize-none rounded-[14px] border px-4 py-3 text-[13px] font-[620] outline-none"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>
        </div>

        <div className="slide-panel-footer flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-premium btn-primary"
          >
            <Save size={15} />{" "}
            {saving ? "저장 중..." : editId ? "수정 저장" : "고객 등록"}
          </button>
        </div>
      </div>
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
    <div>
      <label className="crm-meta mb-2 block">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-[40px] w-full rounded-[13px] border px-3 text-[13px] font-[640] outline-none"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      />
    </div>
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
    <div>
      <label className="crm-meta mb-2 block">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[40px] w-full rounded-[13px] border px-3 text-[13px] font-[640] outline-none"
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
    </div>
  );
}

function IconButton({
  children,
  label,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
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
    <div className="flex h-56 items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <div className="premium-icon-lg mb-4">
        <UserRound size={22} />
      </div>
      <p className="crm-card-title">등록된 고객이 없습니다</p>
      <p className="crm-subtitle mt-2">
        필터를 초기화하거나 신규 고객을 등록해 주세요.
      </p>
    </div>
  );
}
