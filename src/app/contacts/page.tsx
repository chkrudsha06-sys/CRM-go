"use client";

import ContactNotes from "@/components/ContactNotes";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Edit2,
  Filter,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";

type Contact = {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  customer_type: string | null;
  tm_sensitivity: string | null;
  prospect_type: string | null;
  meeting_date: string | null;
  meeting_date_text: string | null;
  meeting_address: string | null;
  meeting_result: string | null;
  management_stage: string | null;
  memo: string | null;
  assigned_to: string | null;
  consultant: string | null;
  contract_date: string | null;
  reservation_date: string | null;
  regular_payment_date: string | null;
  intake_route: string | null;
  bunyanghoe_number?: string | null;
  bank_account?: string | null;
  dashboard_code?: string | null;
  created_at: string;
};

type FormState = {
  name: string;
  title: string;
  phone: string;
  customer_type: string;
  tm_sensitivity: string;
  prospect_type: string;
  meeting_date: string;
  meeting_date_text: string;
  meeting_address: string;
  meeting_result: string;
  management_stage: string;
  memo: string;
  assigned_to: string;
  consultant: string;
  contract_date: string;
  reservation_date: string;
  regular_payment_date: string;
  intake_route: string;
};

type DetailTab = "summary" | "notes" | "member";

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  phone: "",
  customer_type: "",
  tm_sensitivity: "",
  prospect_type: "",
  meeting_date: "",
  meeting_date_text: "",
  meeting_address: "",
  meeting_result: "",
  management_stage: "",
  memo: "",
  assigned_to: "",
  consultant: "",
  contract_date: "",
  reservation_date: "",
  regular_payment_date: "",
  intake_route: "",
};

const OPTIONS = {
  customer_type: ["신규", "기고객"],
  tm_sensitivity: ["상", "중", "하"],
  prospect_type: ["즉가입가망", "미팅예정가망", "연계매출가망"],
  meeting_result: ["계약완료", "예약완료", "서류만수취", "미팅후가망관리", "계약거부", "미팅불발"],
  management_stage: ["리드", "프로스펙팅", "미팅예정", "딜크로징", "리텐션", "보류"],
};

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const CONSULTANTS = ["박경화", "박혜은", "조승현", "박민경", "백선중", "강아름", "전정훈", "박나라"];
const INTAKE_ROUTES = ["영업부토스TM", "신규고객TM", "기고객TM", "완판트럭", "대협팀활동"];

function formatFullDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}

function timeAgo(value?: string | null) {
  if (!value) return "-";
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 7) return `${day}일 전`;
  return formatFullDate(value);
}

function phoneFormat(value: string) {
  let v = value.replace(/[^0-9]/g, "");
  if (v.length > 3 && v.length <= 7) v = `${v.slice(0, 3)}-${v.slice(3)}`;
  if (v.length > 7) v = `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7, 11)}`;
  return v;
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#8B7CF6,#60A5FA)",
    "linear-gradient(135deg,#60A5FA,#22D3EE)",
    "linear-gradient(135deg,#34D399,#22D3EE)",
    "linear-gradient(135deg,#FBBF24,#FB7185)",
    "linear-gradient(135deg,#C084FC,#FB7185)",
    "linear-gradient(135deg,#8B7CF6,#C084FC)",
  ];
  if (!name) return gradients[0];
  const idx = name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % gradients.length;
  return gradients[idx];
}

function toneStyle(tone: string) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    success: { bg: "var(--success-bg)", color: "var(--success-text)", border: "var(--success-border)", dot: "var(--success)" },
    info: { bg: "var(--info-bg)", color: "var(--info-text)", border: "var(--info-border)", dot: "var(--info)" },
    cyan: { bg: "var(--cyan-bg)", color: "var(--cyan-text)", border: "var(--cyan-border)", dot: "var(--cyan)" },
    warning: { bg: "var(--warning-bg)", color: "var(--warning-text)", border: "var(--warning-border)", dot: "var(--warning)" },
    danger: { bg: "var(--danger-bg)", color: "var(--danger-text)", border: "var(--danger-border)", dot: "var(--danger)" },
    purple: { bg: "var(--purple-bg)", color: "var(--purple-text)", border: "var(--purple-border)", dot: "var(--purple)" },
    muted: { bg: "var(--surface-3)", color: "var(--text-subtle)", border: "var(--border)", dot: "var(--text-faint)" },
  };
  return map[tone] || map.muted;
}

function resultTone(value?: string | null) {
  if (value === "계약완료") return "success";
  if (value === "예약완료") return "purple";
  if (value === "미팅후가망관리") return "warning";
  if (value === "계약거부" || value === "미팅불발") return "danger";
  if (value === "서류만수취") return "info";
  return "muted";
}

function prospectTone(value?: string | null) {
  if (value === "즉가입가망") return "danger";
  if (value === "미팅예정가망") return "warning";
  if (value === "연계매출가망") return "info";
  return "muted";
}

function stageTone(value?: string | null) {
  if (value === "리드") return "danger";
  if (value === "프로스펙팅") return "warning";
  if (value === "미팅예정") return "cyan";
  if (value === "딜크로징") return "success";
  if (value === "리텐션") return "purple";
  if (value === "보류") return "muted";
  return "muted";
}

function sensitivityTone(value?: string | null) {
  if (value === "상") return "danger";
  if (value === "중") return "warning";
  return "muted";
}

function Badge({ children, tone = "muted", icon: Icon }: { children: ReactNode; tone?: string; icon?: ElementType }) {
  const c = toneStyle(tone);
  return (
    <span
      className="inline-flex h-[23px] items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-bold"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {Icon ? <Icon size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
      {children}
    </span>
  );
}

function PremiumIcon({ icon: Icon, tone = "info" }: { icon: ElementType; tone?: string }) {
  const c = toneStyle(tone);
  return (
    <div
      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px]"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      <Icon size={17} />
    </div>
  );
}

function SelectChip({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[122px] appearance-none rounded-full border px-3 pr-8 text-[12px] font-bold outline-none"
        style={{
          background: value ? "var(--accent-subtle)" : "var(--surface-2)",
          borderColor: value ? "var(--accent-border)" : "var(--border)",
          color: value ? "var(--accent-text)" : "var(--text-muted)",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
    </div>
  );
}

function Metric({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: ElementType }) {
  return (
    <div className="premium-card flex h-[78px] items-center gap-3 px-4">
      <PremiumIcon icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p className="mt-1 text-[21px] font-[760] leading-none tracking-[-0.055em]" style={{ color: "var(--text-strong)" }}>{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[116px_1fr] gap-3 py-3">
      <div className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{label}</div>
      <div className="min-w-0 text-[13px] font-semibold" style={{ color: "var(--text)" }}>{children || <span style={{ color: "var(--text-faint)" }}>-</span>}</div>
    </div>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{children}</label>;
}

function ContactMobileCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="premium-card premium-card-hover w-full p-4 text-left">
      <div className="flex items-center gap-3">
        <div className="crm-avatar" style={{ background: avatarBg(contact.name) }}>{contact.name?.[0] || "고"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="crm-row-main truncate">{contact.name}</p>
            <Badge tone={resultTone(contact.meeting_result)}>{contact.meeting_result || "미정"}</Badge>
          </div>
          <p className="crm-row-sub mt-0.5 truncate">{contact.title || "-"} · {contact.phone || "-"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone={prospectTone(contact.prospect_type)}>{contact.prospect_type || "가망 없음"}</Badge>
        <Badge tone={stageTone(contact.management_stage)}>{contact.management_stage || "단계 없음"}</Badge>
        <Badge tone="info">{contact.assigned_to || "담당 없음"}</Badge>
      </div>
    </button>
  );
}

function DetailPanel({ contact, tab, onTab, onClose, onEdit, onDelete }: { contact: Contact; tab: DetailTab; onTab: (tab: DetailTab) => void; onClose: () => void; onEdit: (contact: Contact) => void; onDelete: (contact: Contact) => void }) {
  const meeting = contact.meeting_date ? formatFullDate(contact.meeting_date) : contact.meeting_date_text || "-";

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />
      <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-panel-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="crm-avatar-lg crm-avatar" style={{ background: avatarBg(contact.name) }}>{contact.name?.[0] || "고"}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-[22px] font-[780] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{contact.name}</h2>
                  <Badge tone={resultTone(contact.meeting_result)}>{contact.meeting_result || "미정"}</Badge>
                </div>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>ID {contact.id} · {contact.title || "직급 없음"} · 담당 {contact.assigned_to || "-"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={prospectTone(contact.prospect_type)}>{contact.prospect_type || "가망 없음"}</Badge>
                  <Badge tone={stageTone(contact.management_stage)}>{contact.management_stage || "단계 없음"}</Badge>
                  <Badge tone={sensitivityTone(contact.tm_sensitivity)}>TM {contact.tm_sensitivity || "-"}</Badge>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
          </div>
          <div className="mt-5 flex gap-1.5">
            {[
              { key: "summary", label: "요약" },
              { key: "notes", label: "활동노트" },
              { key: "member", label: "계약/회원" },
            ].map((item) => {
              const active = tab === item.key;
              return (
                <button key={item.key} type="button" onClick={() => onTab(item.key as DetailTab)} className="h-9 rounded-[9px] px-3 text-[12px] font-bold transition-all" style={{ background: active ? "var(--accent-subtle)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-subtle)", border: active ? "1px solid var(--accent-border)" : "1px solid transparent" }}>{item.label}</button>
              );
            })}
          </div>
        </div>

        <div className="slide-panel-body">
          {tab === "summary" && (
            <div className="space-y-5">
              <section className="premium-card p-4">
                <div className="mb-3 flex items-center gap-2"><PremiumIcon icon={Phone} tone="info" /><div><p className="crm-section-title">고객 접점</p><p className="crm-tiny">연락처와 미팅 정보</p></div></div>
                <Field label="연락처"><span className="inline-flex items-center gap-1.5" style={{ color: "var(--accent-text)" }}><Phone size={14} />{contact.phone || "-"}</span></Field>
                <Field label="미팅일"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} style={{ color: "var(--text-subtle)" }} />{meeting}</span></Field>
                <Field label="미팅지역"><span className="inline-flex items-center gap-1.5"><MapPin size={14} style={{ color: "var(--text-subtle)" }} />{contact.meeting_address || "-"}</span></Field>
                <Field label="유입경로"><Badge tone="muted">{contact.intake_route || "-"}</Badge></Field>
              </section>

              <section className="premium-card p-4">
                <div className="mb-3 flex items-center gap-2"><PremiumIcon icon={UserCheck} tone="success" /><div><p className="crm-section-title">영업 상태</p><p className="crm-tiny">가망, 단계, 결과</p></div></div>
                <Field label="고객유형"><Badge tone={contact.customer_type === "신규" ? "info" : "muted"}>{contact.customer_type || "-"}</Badge></Field>
                <Field label="관리단계"><Badge tone={stageTone(contact.management_stage)}>{contact.management_stage || "-"}</Badge></Field>
                <Field label="가망유형"><Badge tone={prospectTone(contact.prospect_type)}>{contact.prospect_type || "-"}</Badge></Field>
                <Field label="미팅결과"><Badge tone={resultTone(contact.meeting_result)}>{contact.meeting_result || "-"}</Badge></Field>
                <Field label="컨설턴트"><Badge tone="purple">{contact.consultant || "-"}</Badge></Field>
              </section>

              <section className="premium-card p-4">
                <div className="mb-3 flex items-center gap-2"><PremiumIcon icon={MessageSquare} tone="cyan" /><div><p className="crm-section-title">메모</p><p className="crm-tiny">상담 내용과 특이사항</p></div></div>
                <div className="min-h-[120px] whitespace-pre-wrap rounded-[12px] p-4 text-[13px] font-medium leading-relaxed" style={{ background: "var(--surface-2)", color: contact.memo ? "var(--text-muted)" : "var(--text-faint)", border: "1px solid var(--border-subtle)" }}>{contact.memo || "등록된 메모가 없습니다."}</div>
              </section>
            </div>
          )}

          {tab === "notes" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={MessageSquare} tone="purple" /><div><p className="crm-section-title">활동노트</p><p className="crm-tiny">상담 이력과 후속 액션</p></div></div>
              <ContactNotes contactId={contact.id} />
            </section>
          )}

          {tab === "member" && (
            <div className="space-y-5">
              <section className="premium-card p-4">
                <div className="mb-3 flex items-center gap-2"><PremiumIcon icon={UserCheck} tone="success" /><div><p className="crm-section-title">계약 / 예약 정보</p><p className="crm-tiny">회원 전환 관련 정보</p></div></div>
                <Field label="계약일">{formatFullDate(contact.contract_date)}</Field>
                <Field label="예약일">{formatFullDate(contact.reservation_date)}</Field>
                <Field label="정기출금일">{contact.regular_payment_date ? `매월 ${contact.regular_payment_date}일` : "-"}</Field>
                <Field label="분양회 넘버"><Badge tone={contact.bunyanghoe_number ? "warning" : "muted"}>{contact.bunyanghoe_number || "-"}</Badge></Field>
                <Field label="대시보드"><Badge tone={contact.dashboard_code ? "success" : "muted"}>{contact.dashboard_code ? "생성됨" : "미생성"}</Badge></Field>
              </section>
            </div>
          )}
        </div>

        <div className="slide-panel-footer">
          <div className="flex gap-2">
            <button type="button" onClick={() => onEdit(contact)} className="btn-premium btn-primary flex-1"><Edit2 size={14} />고객 수정</button>
            <button type="button" onClick={() => onDelete(contact)} className="btn-premium btn-danger"><Trash2 size={14} />삭제</button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [useDatePicker, setUseDatePicker] = useState(true);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [search, setSearch] = useState("");
  const [fCustomerType, setFCustomerType] = useState("");
  const [fTmSens, setFTmSens] = useState("");
  const [fProspect, setFProspect] = useState("");
  const [fResult, setFResult] = useState("");
  const [fStage, setFStage] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fConsultant, setFConsultant] = useState("");

  const inputClass = "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";
  const textareaClass = "min-h-[96px] w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] font-semibold outline-none";

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let execName = "";
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.role === "exec") execName = u.name;
      }
    } catch {}

    let q = supabase.from("contacts").select("*").order("created_at", { ascending: false }).limit(1000);
    if (execName) q = q.eq("assigned_to", execName);
    const { data, error } = await q;
    if (error) {
      console.error("고객 조회 실패:", error.message);
      setContacts([]);
    } else {
      setContacts((data || []) as Contact[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchSearch = !keyword || [contact.name, contact.title, contact.phone, contact.memo, contact.assigned_to, contact.consultant, contact.intake_route].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      return (
        matchSearch &&
        (!fCustomerType || contact.customer_type === fCustomerType) &&
        (!fTmSens || contact.tm_sensitivity === fTmSens) &&
        (!fProspect || contact.prospect_type === fProspect) &&
        (!fResult || contact.meeting_result === fResult) &&
        (!fStage || contact.management_stage === fStage) &&
        (!fAssigned || contact.assigned_to === fAssigned) &&
        (!fConsultant || contact.consultant === fConsultant)
      );
    });
  }, [contacts, search, fCustomerType, fTmSens, fProspect, fResult, fStage, fAssigned, fConsultant]);

  const stats = useMemo(() => ({
    total: contacts.length,
    contract: contacts.filter((c) => c.meeting_result === "계약완료").length,
    reservation: contacts.filter((c) => c.meeting_result === "예약완료").length,
    prospect: contacts.filter((c) => !!c.prospect_type && c.meeting_result !== "계약완료").length,
  }), [contacts]);

  const activeFilters = [search, fCustomerType, fTmSens, fProspect, fResult, fStage, fAssigned, fConsultant].filter(Boolean).length;

  const resetFilters = () => {
    setSearch(""); setFCustomerType(""); setFTmSens(""); setFProspect(""); setFResult(""); setFStage(""); setFAssigned(""); setFConsultant("");
  };

  const setFormValue = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openAdd = () => {
    let defaultAssigned = "";
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.role === "exec") defaultAssigned = u.name;
      }
    } catch {}
    setEditContact(null);
    setForm({ ...EMPTY_FORM, assigned_to: defaultAssigned });
    setUseDatePicker(true);
    setShowModal(true);
  };

  const openEdit = (contact: Contact) => {
    setEditContact(contact);
    setForm({
      name: contact.name || "",
      title: contact.title || "",
      phone: contact.phone || "",
      customer_type: contact.customer_type || "",
      tm_sensitivity: contact.tm_sensitivity || "",
      prospect_type: contact.prospect_type || "",
      meeting_date: contact.meeting_date?.split("T")[0] || "",
      meeting_date_text: contact.meeting_date_text || "",
      meeting_address: contact.meeting_address || "",
      meeting_result: contact.meeting_result || "",
      management_stage: contact.management_stage || "",
      memo: contact.memo || "",
      assigned_to: contact.assigned_to || "",
      consultant: contact.consultant || "",
      contract_date: contact.contract_date || "",
      reservation_date: contact.reservation_date || "",
      regular_payment_date: contact.regular_payment_date || "",
      intake_route: contact.intake_route || "",
    });
    setUseDatePicker(!contact.meeting_date_text);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("고객명을 입력하세요.");
      return;
    }
    const payload = {
      name: form.name || null,
      title: form.title || null,
      phone: form.phone || null,
      customer_type: form.customer_type || null,
      tm_sensitivity: form.tm_sensitivity || null,
      prospect_type: form.prospect_type || null,
      meeting_date: useDatePicker ? form.meeting_date || null : null,
      meeting_date_text: !useDatePicker ? form.meeting_date_text || null : null,
      meeting_address: form.meeting_address || null,
      meeting_result: form.meeting_result || null,
      management_stage: form.management_stage || null,
      memo: form.memo || null,
      assigned_to: form.assigned_to || null,
      consultant: form.consultant || null,
      contract_date: form.contract_date || null,
      reservation_date: form.reservation_date || null,
      regular_payment_date: form.regular_payment_date || null,
      intake_route: form.intake_route || null,
    };
    setSaving(true);
    const res = editContact ? await supabase.from("contacts").update(payload).eq("id", editContact.id) : await supabase.from("contacts").insert(payload);
    setSaving(false);
    if (res.error) {
      alert(`저장 실패: ${res.error.message}`);
      return;
    }
    setShowModal(false);
    fetchContacts();
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`${contact.name} 고객을 삭제하시겠습니까?`)) return;
    await supabase.from("rewards").delete().eq("contact_id", contact.id);
    await supabase.from("mileage_usages").delete().eq("contact_id", contact.id);
    await supabase.from("contact_notes").delete().eq("contact_id", contact.id);
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    setSelectedContact(null);
    fetchContacts();
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><Users size={20} style={{ color: "var(--accent-text)" }} /><h1 className="crm-title">고객DB</h1></div>
          <p className="crm-subtitle mt-1">고객 정보, 영업 단계, 미팅 결과, 활동노트를 하나의 워크스페이스에서 관리합니다.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button type="button" onClick={fetchContacts} className="btn-premium btn-secondary"><RefreshCw size={14} />새로고침</button>
          <button type="button" onClick={openAdd} className="btn-premium btn-primary"><Plus size={14} />새 고객</button>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="전체 고객" value={stats.total} icon={Users} tone="info" />
          <Metric label="계약완료" value={stats.contract} icon={UserCheck} tone="success" />
          <Metric label="예약완료" value={stats.reservation} icon={CalendarDays} tone="purple" />
          <Metric label="가망고객" value={stats.prospect} icon={Filter} tone="warning" />
        </div>
      </div>

      <div className="premium-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <div className="relative w-full sm:w-[360px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명, 직급, 연락처, 메모 검색..." className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none" />
        </div>
        <SelectChip value={fResult} onChange={setFResult} options={OPTIONS.meeting_result} placeholder="미팅결과" />
        <SelectChip value={fStage} onChange={setFStage} options={OPTIONS.management_stage} placeholder="관리단계" />
        <SelectChip value={fAssigned} onChange={setFAssigned} options={TEAM} placeholder="담당자" />
        <button type="button" onClick={() => setShowMoreFilters((v) => !v)} className="btn-premium btn-secondary h-8"><MoreHorizontal size={14} />상세 필터</button>
        {activeFilters > 0 && <button type="button" onClick={resetFilters} className="btn-premium btn-danger h-8">초기화</button>}
        <span className="ml-auto hidden text-[12px] font-bold md:block" style={{ color: "var(--text-faint)" }}>{filteredContacts.length.toLocaleString()} / {contacts.length.toLocaleString()}명</span>
        {showMoreFilters && (
          <div className="mt-2 flex w-full flex-wrap gap-2">
            <SelectChip value={fCustomerType} onChange={setFCustomerType} options={OPTIONS.customer_type} placeholder="고객유형" />
            <SelectChip value={fTmSens} onChange={setFTmSens} options={OPTIONS.tm_sensitivity} placeholder="TM감도" />
            <SelectChip value={fProspect} onChange={setFProspect} options={OPTIONS.prospect_type} placeholder="가망유형" />
            <SelectChip value={fConsultant} onChange={setFConsultant} options={CONSULTANTS} placeholder="컨설턴트" />
          </div>
        )}
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? (
          <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex h-full items-center justify-center"><div className="premium-card p-8"><EmptyState icon="👥" title="표시할 고객이 없습니다" description="검색어나 필터 조건을 변경하거나 새 고객을 등록하세요" actionLabel="고객 등록" onAction={openAdd} /></div></div>
        ) : (
          <>
            <div className="crm-table-wrap hidden h-full overflow-auto xl:block">
              <table className="crm-table min-w-[1420px]">
                <thead><tr><th className="w-[300px]">고객</th><th className="w-[130px]">미팅결과</th><th className="w-[140px]">가망유형</th><th className="w-[140px]">관리단계</th><th className="w-[130px]">연락처</th><th className="w-[120px]">담당자</th><th className="w-[120px]">컨설턴트</th><th className="w-[150px]">미팅일</th><th className="w-[130px]">유입경로</th><th className="w-[120px]">등록</th><th className="w-[70px]"></th></tr></thead>
                <tbody>
                  {filteredContacts.map((contact) => {
                    const selected = selectedContact?.id === contact.id;
                    return (
                      <tr key={contact.id} data-selected={selected ? "true" : "false"} className="cursor-pointer" onClick={() => { setSelectedContact(contact); setDetailTab("summary"); }}>
                        <td><div className="crm-row-center gap-3"><div className="crm-avatar" style={{ background: avatarBg(contact.name) }}>{contact.name?.[0] || "고"}</div><div className="min-w-0"><div className="crm-row-main truncate">{contact.name}</div><div className="crm-row-sub truncate">{contact.title || "직급 없음"} · ID {contact.id}</div></div></div></td>
                        <td><Badge tone={resultTone(contact.meeting_result)}>{contact.meeting_result || "-"}</Badge></td>
                        <td><Badge tone={prospectTone(contact.prospect_type)}>{contact.prospect_type || "-"}</Badge></td>
                        <td><Badge tone={stageTone(contact.management_stage)}>{contact.management_stage || "-"}</Badge></td>
                        <td><span className="crm-meta">{contact.phone || "-"}</span></td>
                        <td><Badge tone="info">{contact.assigned_to || "-"}</Badge></td>
                        <td><Badge tone="purple">{contact.consultant || "-"}</Badge></td>
                        <td><span className="crm-meta">{contact.meeting_date ? formatFullDate(contact.meeting_date) : contact.meeting_date_text || "-"}</span></td>
                        <td><Badge tone="muted">{contact.intake_route || "-"}</Badge></td>
                        <td><span className="crm-meta">{timeAgo(contact.created_at)}</span></td>
                        <td><button type="button" onClick={(e) => { e.stopPropagation(); openEdit(contact); }} className="btn-premium btn-secondary h-8 w-8 p-0"><Edit2 size={13} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="h-full overflow-y-auto xl:hidden"><div className="space-y-3">{filteredContacts.map((contact) => <ContactMobileCard key={contact.id} contact={contact} onClick={() => { setSelectedContact(contact); setDetailTab("summary"); }} />)}</div></div>
          </>
        )}
      </main>

      {selectedContact && <DetailPanel contact={selectedContact} tab={detailTab} onTab={setDetailTab} onClose={() => setSelectedContact(null)} onEdit={openEdit} onDelete={handleDelete} />}

      {showModal && (
        <div className="crm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="crm-modal flex max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div><h2 className="crm-section-title">{editContact ? "고객 정보 수정" : "새 고객 등록"}</h2><p className="crm-subtitle mt-1">고객 기본 정보와 영업 상태를 입력합니다.</p></div>
              <button type="button" onClick={() => setShowModal(false)} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><InputLabel>고객명 *</InputLabel><input className={inputClass} value={form.name} onChange={(e) => setFormValue("name", e.target.value)} placeholder="고객명" /></div>
                <div><InputLabel>직급</InputLabel><input className={inputClass} value={form.title} onChange={(e) => setFormValue("title", e.target.value)} placeholder="대표, 팀장, 소장 등" /></div>
                <div><InputLabel>연락처</InputLabel><input className={inputClass} value={form.phone} onChange={(e) => setFormValue("phone", phoneFormat(e.target.value))} placeholder="010-0000-0000" maxLength={13} /></div>
                <div><InputLabel>담당자</InputLabel><select className={inputClass} value={form.assigned_to} onChange={(e) => setFormValue("assigned_to", e.target.value)}><option value="">선택</option>{TEAM.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><InputLabel>고객유형</InputLabel><select className={inputClass} value={form.customer_type} onChange={(e) => setFormValue("customer_type", e.target.value)}><option value="">선택</option>{OPTIONS.customer_type.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><InputLabel>TM감도</InputLabel><select className={inputClass} value={form.tm_sensitivity} onChange={(e) => setFormValue("tm_sensitivity", e.target.value)}><option value="">선택</option>{OPTIONS.tm_sensitivity.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><InputLabel>관리단계</InputLabel><select className={inputClass} value={form.management_stage} onChange={(e) => setFormValue("management_stage", e.target.value)}><option value="">선택</option>{OPTIONS.management_stage.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><InputLabel>가망유형</InputLabel><select className={inputClass} value={form.prospect_type} onChange={(e) => setFormValue("prospect_type", e.target.value)}><option value="">선택</option>{OPTIONS.prospect_type.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><InputLabel>미팅결과</InputLabel><select className={inputClass} value={form.meeting_result} onChange={(e) => setFormValue("meeting_result", e.target.value)}><option value="">선택</option>{OPTIONS.meeting_result.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><InputLabel>담당 컨설턴트</InputLabel><select className={inputClass} value={form.consultant} onChange={(e) => setFormValue("consultant", e.target.value)}><option value="">선택</option>{CONSULTANTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div className="md:col-span-2"><InputLabel>미팅일정</InputLabel><div className="mb-2 flex gap-2"><button type="button" onClick={() => setUseDatePicker(true)} className={useDatePicker ? "btn-premium btn-primary" : "btn-premium btn-secondary"}>날짜 선택</button><button type="button" onClick={() => setUseDatePicker(false)} className={!useDatePicker ? "btn-premium btn-primary" : "btn-premium btn-secondary"}>텍스트 입력</button></div>{useDatePicker ? <input type="date" className={inputClass} value={form.meeting_date} onChange={(e) => setFormValue("meeting_date", e.target.value)} /> : <input className={inputClass} value={form.meeting_date_text} onChange={(e) => setFormValue("meeting_date_text", e.target.value)} placeholder="예: 4월 셋째주, 조율중" />}</div>
                <div><InputLabel>미팅지역</InputLabel><input className={inputClass} value={form.meeting_address} onChange={(e) => setFormValue("meeting_address", e.target.value)} placeholder="서울 강남" /></div>
                <div><InputLabel>유입경로</InputLabel><select className={inputClass} value={form.intake_route} onChange={(e) => setFormValue("intake_route", e.target.value)}><option value="">선택</option>{INTAKE_ROUTES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                {form.meeting_result === "계약완료" && <><div><InputLabel>계약완료일</InputLabel><input type="date" className={inputClass} value={form.contract_date} onChange={(e) => setFormValue("contract_date", e.target.value)} /></div><div><InputLabel>정기출금일</InputLabel><select className={inputClass} value={form.regular_payment_date} onChange={(e) => setFormValue("regular_payment_date", e.target.value)}><option value="">선택</option>{Array.from({ length: 31 }, (_, i) => i + 1).map((day) => <option key={day} value={String(day)}>매월 {day}일</option>)}</select></div></>}
                {form.meeting_result === "예약완료" && <div><InputLabel>예약완료일</InputLabel><input type="date" className={inputClass} value={form.reservation_date} onChange={(e) => setFormValue("reservation_date", e.target.value)} /></div>}
                <div className="md:col-span-2"><InputLabel>메모</InputLabel><textarea className={textareaClass} value={form.memo} onChange={(e) => setFormValue("memo", e.target.value)} placeholder="상담 내용, 특이사항, 다음 액션 등을 입력하세요" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}><button type="button" onClick={() => setShowModal(false)} className="btn-premium btn-secondary">취소</button><button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary disabled:opacity-50"><UserCheck size={14} />{saving ? "저장 중..." : editContact ? "수정 완료" : "등록"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
