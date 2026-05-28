"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Edit2,
  ExternalLink,
  FileCheck2,
  Hash,
  LayoutDashboard,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  Wallet,
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
  bunyanghoe_number: string;
  bank_account: string;
  dashboard_code: string;
  regular_payment_date: string;
};

type DetailTab = "overview" | "operation" | "memo";

const RESULTS = ["계약완료", "예약완료"];
const TEAM = ["조계현", "이세호", "기여운", "최연전"];

const EMPTY_FORM: FormState = {
  bunyanghoe_number: "",
  bank_account: "",
  dashboard_code: "",
  regular_payment_date: "",
};

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

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#6366F1,#8B5CF6)",
    "linear-gradient(135deg,#3B82F6,#06B6D4)",
    "linear-gradient(135deg,#22C55E,#14B8A6)",
    "linear-gradient(135deg,#F97316,#EF4444)",
    "linear-gradient(135deg,#8B5CF6,#EC4899)",
    "linear-gradient(135deg,#06B6D4,#3B82F6)",
  ];

  if (!name) return gradients[0];

  const idx = name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % gradients.length;
  return gradients[idx];
}

function toneStyle(tone: string) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    success: {
      bg: "var(--success-bg)",
      color: "var(--success-text)",
      border: "var(--success-border)",
      dot: "var(--success)",
    },
    info: {
      bg: "var(--info-bg)",
      color: "var(--info-text)",
      border: "var(--info-border)",
      dot: "var(--info)",
    },
    cyan: {
      bg: "var(--cyan-bg)",
      color: "var(--cyan-text)",
      border: "var(--cyan-border)",
      dot: "var(--cyan)",
    },
    warning: {
      bg: "var(--warning-bg)",
      color: "var(--warning-text)",
      border: "var(--warning-border)",
      dot: "var(--warning)",
    },
    danger: {
      bg: "var(--danger-bg)",
      color: "var(--danger-text)",
      border: "var(--danger-border)",
      dot: "var(--danger)",
    },
    purple: {
      bg: "var(--purple-bg)",
      color: "var(--purple-text)",
      border: "var(--purple-border)",
      dot: "var(--purple)",
    },
    muted: {
      bg: "var(--surface-3)",
      color: "var(--text-subtle)",
      border: "var(--border)",
      dot: "var(--text-faint)",
    },
  };

  return map[tone] || map.muted;
}

function resultTone(value?: string | null) {
  if (value === "계약완료") return "success";
  if (value === "예약완료") return "purple";
  return "muted";
}

function statusTone(value?: string | null) {
  return value ? "success" : "muted";
}

function Badge({
  children,
  tone = "muted",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: string;
  icon?: ElementType;
}) {
  const c = toneStyle(tone);

  return (
    <span
      className="inline-flex h-[23px] items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-bold"
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {Icon ? <Icon size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
      {children}
    </span>
  );
}

function PremiumIcon({
  icon: Icon,
  tone = "info",
  size = "md",
}: {
  icon: ElementType;
  tone?: string;
  size?: "sm" | "md" | "lg";
}) {
  const c = toneStyle(tone);
  const cls =
    size === "lg"
      ? "h-12 w-12 rounded-[15px]"
      : size === "sm"
      ? "h-8 w-8 rounded-[10px]"
      : "h-10 w-10 rounded-[12px]";

  return (
    <div
      className={`inline-flex flex-shrink-0 items-center justify-center ${cls}`}
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02)), ${c.bg}`,
        border: `1px solid ${c.border}`,
        color: c.color,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
      }}
    >
      <Icon size={size === "lg" ? 22 : size === "sm" ? 14 : 18} />
    </div>
  );
}

function SelectChip({
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
          <option key={item} value={item}>
            {item}
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

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ElementType;
  tone: string;
}) {
  return (
    <div className="premium-card flex h-[82px] items-center gap-4 px-4">
      <PremiumIcon icon={icon} tone={tone} />

      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p className="mt-1 text-[22px] font-[760] leading-none tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[118px_1fr] gap-3 py-3">
      <div className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>
        {label}
      </div>
      <div className="min-w-0 text-[13px] font-semibold" style={{ color: "var(--text)" }}>
        {children || <span style={{ color: "var(--text-faint)" }}>-</span>}
      </div>
    </div>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
      {children}
    </label>
  );
}

function completionScore(contact: Contact) {
  let score = 0;

  if (contact.bunyanghoe_number) score += 25;
  if (contact.bank_account) score += 25;
  if (contact.dashboard_code) score += 25;
  if (contact.regular_payment_date) score += 25;

  return score;
}

function MemberMobileCard({
  contact,
  onClick,
}: {
  contact: Contact;
  onClick: () => void;
}) {
  const score = completionScore(contact);

  return (
    <button
      type="button"
      onClick={onClick}
      className="premium-card premium-card-hover w-full p-4 text-left"
    >
      <div className="flex items-center gap-3">
        <div className="crm-avatar" style={{ background: avatarBg(contact.name) }}>
          {contact.name?.[0] || "회"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="crm-row-main truncate">{contact.name}</p>
            <Badge tone={resultTone(contact.meeting_result)}>{contact.meeting_result || "-"}</Badge>
          </div>
          <p className="crm-row-sub mt-0.5 truncate">
            {contact.title || "-"} · {contact.phone || "-"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone={statusTone(contact.bunyanghoe_number)} icon={Hash}>
          {contact.bunyanghoe_number || "넘버링 없음"}
        </Badge>
        <Badge tone={statusTone(contact.bank_account)} icon={Wallet}>
          {contact.bank_account ? "계좌등록" : "계좌미등록"}
        </Badge>
        <Badge tone={statusTone(contact.dashboard_code)} icon={LayoutDashboard}>
          {contact.dashboard_code ? "대시보드" : "대시보드 없음"}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
          <span style={{ color: "var(--text-subtle)" }}>운영 세팅</span>
          <span style={{ color: score === 100 ? "var(--success-text)" : "var(--warning-text)" }}>
            {score}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${score}%`,
              background: score === 100 ? "var(--success)" : "var(--warning)",
            }}
          />
        </div>
      </div>
    </button>
  );
}

function DetailSlidePanel({
  contact,
  tab,
  onTab,
  onClose,
  onEdit,
}: {
  contact: Contact;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
}) {
  const score = completionScore(contact);

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />

      <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-panel-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="crm-avatar-lg crm-avatar" style={{ background: avatarBg(contact.name) }}>
                {contact.name?.[0] || "회"}
              </div>

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-[22px] font-[780] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>
                    {contact.name}
                  </h2>
                  <Badge tone={resultTone(contact.meeting_result)}>{contact.meeting_result || "-"}</Badge>
                </div>

                <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>
                  ID {contact.id} · {contact.title || "직급 없음"} · 담당 {contact.assigned_to || "-"}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={statusTone(contact.bunyanghoe_number)} icon={Hash}>
                    {contact.bunyanghoe_number || "넘버링 없음"}
                  </Badge>
                  <Badge tone={statusTone(contact.bank_account)} icon={Wallet}>
                    {contact.bank_account ? "계좌등록" : "계좌미등록"}
                  </Badge>
                  <Badge tone={statusTone(contact.dashboard_code)} icon={LayoutDashboard}>
                    {contact.dashboard_code ? "대시보드" : "대시보드 없음"}
                  </Badge>
                </div>
              </div>
            </div>

            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0">
              <X size={16} />
            </button>
          </div>

          <div className="mt-5 flex gap-1.5">
            {[
              { key: "overview", label: "개요" },
              { key: "operation", label: "운영세팅" },
              { key: "memo", label: "메모" },
            ].map((item) => {
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTab(item.key as DetailTab)}
                  className="h-9 rounded-[9px] px-3 text-[12px] font-bold transition-all"
                  style={{
                    background: active ? "var(--accent-subtle)" : "transparent",
                    color: active ? "var(--accent-text)" : "var(--text-subtle)",
                    border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="slide-panel-body">
          {tab === "overview" && (
            <div className="space-y-6">
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={UserCheck} tone="success" />
                  <div>
                    <p className="crm-section-title">회원 기본 정보</p>
                    <p className="crm-tiny">계약/예약 전환 고객 정보</p>
                  </div>
                </div>

                <Field label="연락처">
                  <span className="inline-flex items-center gap-1.5" style={{ color: "var(--accent-text)" }}>
                    <Phone size={14} />
                    {contact.phone || "-"}
                  </span>
                </Field>

                <Field label="미팅결과">
                  <Badge tone={resultTone(contact.meeting_result)}>
                    {contact.meeting_result || "-"}
                  </Badge>
                </Field>

                <Field label="계약일">{formatFullDate(contact.contract_date)}</Field>
                <Field label="예약일">{formatFullDate(contact.reservation_date)}</Field>

                <Field label="담당자">
                  <Badge tone="info" icon={User}>
                    {contact.assigned_to || "-"}
                  </Badge>
                </Field>

                <Field label="컨설턴트">
                  <Badge tone="purple">{contact.consultant || "-"}</Badge>
                </Field>
              </section>

              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={ShieldCheck} tone={score === 100 ? "success" : "warning"} />
                  <div>
                    <p className="crm-section-title">운영 세팅 완성도</p>
                    <p className="crm-tiny">넘버링, 계좌, 대시보드, 출금일 기준</p>
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between text-[12px] font-bold">
                  <span style={{ color: "var(--text-subtle)" }}>완성도</span>
                  <span style={{ color: score === 100 ? "var(--success-text)" : "var(--warning-text)" }}>
                    {score}%
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${score}%`,
                      background: score === 100 ? "var(--success)" : "var(--warning)",
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Badge tone={statusTone(contact.bunyanghoe_number)} icon={Hash}>
                    넘버링
                  </Badge>
                  <Badge tone={statusTone(contact.bank_account)} icon={Wallet}>
                    계좌
                  </Badge>
                  <Badge tone={statusTone(contact.dashboard_code)} icon={LayoutDashboard}>
                    대시보드
                  </Badge>
                  <Badge tone={statusTone(contact.regular_payment_date)} icon={CalendarDays}>
                    출금일
                  </Badge>
                </div>
              </section>
            </div>
          )}

          {tab === "operation" && (
            <div className="space-y-6">
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={Hash} tone="warning" />
                  <div>
                    <p className="crm-section-title">회원 운영 정보</p>
                    <p className="crm-tiny">회원관리 운영에 필요한 내부 정보</p>
                  </div>
                </div>

                <Field label="분양회 넘버링">
                  <Badge tone={statusTone(contact.bunyanghoe_number)} icon={Hash}>
                    {contact.bunyanghoe_number || "-"}
                  </Badge>
                </Field>

                <Field label="계좌정보">
                  <Badge tone={statusTone(contact.bank_account)} icon={Wallet}>
                    {contact.bank_account ? "등록됨" : "미등록"}
                  </Badge>
                </Field>

                <Field label="대시보드 코드">
                  <Badge tone={statusTone(contact.dashboard_code)} icon={LayoutDashboard}>
                    {contact.dashboard_code || "-"}
                  </Badge>
                </Field>

                <Field label="정기출금일">
                  <Badge tone={statusTone(contact.regular_payment_date)} icon={CalendarDays}>
                    {contact.regular_payment_date ? `매월 ${contact.regular_payment_date}일` : "-"}
                  </Badge>
                </Field>
              </section>

              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={FileCheck2} tone="info" />
                  <div>
                    <p className="crm-section-title">운영 체크</p>
                    <p className="crm-tiny">현재 회원의 다음 처리 상태</p>
                  </div>
                </div>

                <div
                  className="rounded-[12px] p-4 text-[13px] font-semibold leading-relaxed"
                  style={{
                    background: score === 100 ? "var(--success-bg)" : "var(--warning-bg)",
                    border: `1px solid ${score === 100 ? "var(--success-border)" : "var(--warning-border)"}`,
                    color: score === 100 ? "var(--success-text)" : "var(--warning-text)",
                  }}
                >
                  {score === 100
                    ? "회원 운영 세팅이 모두 완료되었습니다. 이후 컨텐츠, 리워드, 마일리지 운영 상태를 점검하면 됩니다."
                    : "회원 운영 세팅이 아직 완료되지 않았습니다. 넘버링, 계좌, 대시보드 코드, 정기출금일을 확인하세요."}
                </div>
              </section>
            </div>
          )}

          {tab === "memo" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <PremiumIcon icon={FileCheck2} tone="cyan" />
                <div>
                  <p className="crm-section-title">고객 메모</p>
                  <p className="crm-tiny">계약/예약 전환 전후 특이사항</p>
                </div>
              </div>

              <div
                className="min-h-[180px] whitespace-pre-wrap rounded-[12px] p-4 text-[13px] font-medium leading-relaxed"
                style={{
                  background: "var(--surface-2)",
                  color: contact.memo ? "var(--text-muted)" : "var(--text-faint)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {contact.memo || "등록된 메모가 없습니다."}
              </div>
            </section>
          )}
        </div>

        <div className="slide-panel-footer">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onEdit(contact)} className="btn-premium btn-primary">
              <Edit2 size={14} />
              운영정보 수정
            </button>

            <a href={`/contacts/${contact.id}`} className="btn-premium btn-secondary">
              <ExternalLink size={14} />
              고객DB 이동
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function MemberManagePage() {
  const [members, setMembers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMember, setSelectedMember] = useState<Contact | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  const [showEdit, setShowEdit] = useState(false);
  const [editMember, setEditMember] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [fResult, setFResult] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fSetup, setFSetup] = useState("");

  const inputClass = "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    let execName = "";

    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.role === "exec") execName = u.name;
      }
    } catch {}

    let q = supabase
      .from("contacts")
      .select("*")
      .in("meeting_result", RESULTS)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (execName) q = q.eq("assigned_to", execName);

    const { data, error } = await q;

    if (error) {
      console.error("회원관리 조회 실패:", error.message);
      setMembers([]);
      setLoading(false);
      return;
    }

    setMembers((data || []) as Contact[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter((member) => {
      const score = completionScore(member);

      const matchSearch =
        !keyword ||
        [
          member.name,
          member.title,
          member.phone,
          member.memo,
          member.assigned_to,
          member.consultant,
          member.bunyanghoe_number,
          member.dashboard_code,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchResult = !fResult || member.meeting_result === fResult;
      const matchAssigned = !fAssigned || member.assigned_to === fAssigned;
      const matchSetup =
        !fSetup ||
        (fSetup === "완료" && score === 100) ||
        (fSetup === "미완료" && score < 100) ||
        (fSetup === "넘버링없음" && !member.bunyanghoe_number) ||
        (fSetup === "계좌없음" && !member.bank_account) ||
        (fSetup === "대시보드없음" && !member.dashboard_code);

      return matchSearch && matchResult && matchAssigned && matchSetup;
    });
  }, [members, search, fResult, fAssigned, fSetup]);

  const stats = useMemo(() => {
    return {
      total: members.length,
      contract: members.filter((m) => m.meeting_result === "계약완료").length,
      reservation: members.filter((m) => m.meeting_result === "예약완료").length,
      complete: members.filter((m) => completionScore(m) === 100).length,
      incomplete: members.filter((m) => completionScore(m) < 100).length,
    };
  }, [members]);

  const activeFilters = [search, fResult, fAssigned, fSetup].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setFResult("");
    setFAssigned("");
    setFSetup("");
  };

  const openEdit = (member: Contact) => {
    setEditMember(member);
    setForm({
      bunyanghoe_number: member.bunyanghoe_number || "",
      bank_account: member.bank_account || "",
      dashboard_code: member.dashboard_code || "",
      regular_payment_date: member.regular_payment_date || "",
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!editMember) return;

    setSaving(true);

    const { error } = await supabase
      .from("contacts")
      .update({
        bunyanghoe_number: form.bunyanghoe_number || null,
        bank_account: form.bank_account || null,
        dashboard_code: form.dashboard_code || null,
        regular_payment_date: form.regular_payment_date || null,
      })
      .eq("id", editMember.id);

    setSaving(false);

    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }

    setShowEdit(false);
    setEditMember(null);
    fetchMembers();

    if (selectedMember?.id === editMember.id) {
      setSelectedMember({
        ...selectedMember,
        bunyanghoe_number: form.bunyanghoe_number || null,
        bank_account: form.bank_account || null,
        dashboard_code: form.dashboard_code || null,
        regular_payment_date: form.regular_payment_date || null,
      });
    }
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UserCheck size={20} style={{ color: "var(--accent-text)" }} />
            <h1 className="crm-title">회원관리</h1>
          </div>
          <p className="crm-subtitle mt-1">
            계약완료/예약완료 고객의 회원 운영 세팅과 관리 상태를 확인합니다.
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button type="button" onClick={fetchMembers} className="btn-premium btn-secondary">
            <RefreshCw size={14} />
            새로고침
          </button>

          <a href="/contacts" className="btn-premium btn-primary">
            <Users size={14} />
            고객DB
          </a>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="전체 회원" value={stats.total} icon={Users} tone="info" />
          <StatCard label="계약완료" value={stats.contract} icon={BadgeCheck} tone="success" />
          <StatCard label="예약완료" value={stats.reservation} icon={CalendarDays} tone="purple" />
          <StatCard label="세팅완료" value={stats.complete} icon={ShieldCheck} tone="cyan" />
          <StatCard label="미완료" value={stats.incomplete} icon={FileCheck2} tone="warning" />
        </div>
      </div>

      <div className="premium-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <div className="relative w-full sm:w-[340px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-faint)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회원명, 넘버링, 연락처, 대시보드 코드 검색..."
            className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none"
          />
        </div>

        <SelectChip value={fResult} onChange={setFResult} options={RESULTS} placeholder="전환상태" />
        <SelectChip value={fAssigned} onChange={setFAssigned} options={TEAM} placeholder="담당자" />
        <SelectChip
          value={fSetup}
          onChange={setFSetup}
          options={["완료", "미완료", "넘버링없음", "계좌없음", "대시보드없음"]}
          placeholder="운영세팅"
        />

        {activeFilters > 0 && (
          <button type="button" onClick={resetFilters} className="btn-premium btn-danger h-8">
            초기화
          </button>
        )}

        <span className="ml-auto hidden text-[12px] font-bold md:block" style={{ color: "var(--text-faint)" }}>
          {filteredMembers.length.toLocaleString()} / {members.length.toLocaleString()}명
        </span>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: "var(--accent)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="premium-card p-8">
              <EmptyState
                icon="👤"
                title="표시할 회원이 없습니다"
                description="계약완료 또는 예약완료 고객이 있으면 이곳에 표시됩니다"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="crm-table-wrap hidden h-full overflow-auto xl:block">
              <table className="crm-table min-w-[1380px]">
                <thead>
                  <tr>
                    <th className="w-[290px]">회원명</th>
                    <th className="w-[130px]">전환상태</th>
                    <th className="w-[140px]">넘버링</th>
                    <th className="w-[130px]">계좌</th>
                    <th className="w-[150px]">대시보드</th>
                    <th className="w-[130px]">정기출금일</th>
                    <th className="w-[120px]">담당자</th>
                    <th className="w-[120px]">컨설턴트</th>
                    <th className="w-[140px]">계약/예약일</th>
                    <th className="w-[130px]">완성도</th>
                    <th className="w-[90px]"></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMembers.map((member) => {
                    const selected = selectedMember?.id === member.id;
                    const score = completionScore(member);
                    const eventDate =
                      member.meeting_result === "계약완료"
                        ? member.contract_date
                        : member.reservation_date;

                    return (
                      <tr
                        key={member.id}
                        data-selected={selected ? "true" : "false"}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedMember(member);
                          setDetailTab("overview");
                        }}
                      >
                        <td>
                          <div className="crm-row-center gap-3">
                            <div className="crm-avatar" style={{ background: avatarBg(member.name) }}>
                              {member.name?.[0] || "회"}
                            </div>

                            <div className="min-w-0">
                              <div className="crm-row-main truncate">{member.name}</div>
                              <div className="crm-row-sub truncate">
                                {member.title || "-"} · {member.phone || "-"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <Badge tone={resultTone(member.meeting_result)}>
                            {member.meeting_result || "-"}
                          </Badge>
                        </td>

                        <td>
                          <Badge tone={statusTone(member.bunyanghoe_number)} icon={Hash}>
                            {member.bunyanghoe_number || "-"}
                          </Badge>
                        </td>

                        <td>
                          <Badge tone={statusTone(member.bank_account)} icon={Wallet}>
                            {member.bank_account ? "등록됨" : "미등록"}
                          </Badge>
                        </td>

                        <td>
                          <Badge tone={statusTone(member.dashboard_code)} icon={LayoutDashboard}>
                            {member.dashboard_code || "-"}
                          </Badge>
                        </td>

                        <td>
                          <Badge tone={statusTone(member.regular_payment_date)} icon={CalendarDays}>
                            {member.regular_payment_date ? `매월 ${member.regular_payment_date}일` : "-"}
                          </Badge>
                        </td>

                        <td>
                          <Badge tone="info">{member.assigned_to || "-"}</Badge>
                        </td>

                        <td>
                          <Badge tone="purple">{member.consultant || "-"}</Badge>
                        </td>

                        <td>
                          <span className="crm-meta">{formatFullDate(eventDate)}</span>
                        </td>

                        <td>
                          <div className="flex min-w-[110px] items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${score}%`,
                                  background: score === 100 ? "var(--success)" : "var(--warning)",
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-bold" style={{ color: score === 100 ? "var(--success-text)" : "var(--warning-text)" }}>
                              {score}%
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(member);
                              }}
                              className="btn-premium btn-secondary h-8 w-8 p-0"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="h-full overflow-y-auto xl:hidden">
              <div className="space-y-3">
                {filteredMembers.map((member) => (
                  <MemberMobileCard
                    key={member.id}
                    contact={member}
                    onClick={() => {
                      setSelectedMember(member);
                      setDetailTab("overview");
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {selectedMember && (
        <DetailSlidePanel
          contact={selectedMember}
          tab={detailTab}
          onTab={setDetailTab}
          onClose={() => setSelectedMember(null)}
          onEdit={openEdit}
        />
      )}

      {showEdit && editMember && (
        <div className="crm-modal-overlay" onClick={() => setShowEdit(false)}>
          <div
            className="crm-modal flex max-w-xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <h2 className="crm-section-title">회원 운영정보 수정</h2>
                <p className="crm-subtitle mt-1">
                  {editMember.name} 회원의 넘버링, 계좌, 대시보드, 출금일을 관리합니다.
                </p>
              </div>

              <button type="button" onClick={() => setShowEdit(false)} className="btn-premium btn-secondary h-9 w-9 p-0">
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <InputLabel>분양회 넘버링</InputLabel>
                <input
                  className={inputClass}
                  value={form.bunyanghoe_number}
                  onChange={(e) => setForm({ ...form, bunyanghoe_number: e.target.value })}
                  placeholder="예: 001"
                />
              </div>

              <div>
                <InputLabel>계좌정보</InputLabel>
                <input
                  className={inputClass}
                  value={form.bank_account}
                  onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                  placeholder="은행 / 계좌번호 / 예금주"
                />
              </div>

              <div>
                <InputLabel>대시보드 코드</InputLabel>
                <input
                  className={inputClass}
                  value={form.dashboard_code}
                  onChange={(e) => setForm({ ...form, dashboard_code: e.target.value })}
                  placeholder="대시보드 접속 코드"
                />
              </div>

              <div>
                <InputLabel>정기출금일</InputLabel>
                <select
                  className={inputClass}
                  value={form.regular_payment_date}
                  onChange={(e) => setForm({ ...form, regular_payment_date: e.target.value })}
                >
                  <option value="">선택</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={String(day)}>
                      매월 {day}일
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button type="button" onClick={() => setShowEdit(false)} className="btn-premium btn-secondary">
                취소
              </button>

              <button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary disabled:opacity-50">
                <ShieldCheck size={14} />
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
