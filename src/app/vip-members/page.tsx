"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import BankAccountDialog from "@/components/BankAccountDialog";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import {
  Award,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Filter,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

interface VipContact {
  id: number;
  name: string;
  phone: string | null;
  assigned_to: string;
  meeting_result: string;
  contract_date: string | null;
  reservation_date: string | null;
  consultant: string | null;
  memo: string | null;
  bunyanghoe_number: string | null;
  bank_holder: string | null;
  bank_code: string | null;
  bank_name: string | null;
  bank_account: string | null;
}

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const STATUS_OPTIONS = ["계약완료", "예약완료"];

function bunNumValue(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = value.match(/\d+/);
  if (!match) return Number.POSITIVE_INFINITY;
  return parseInt(match[0], 10);
}

function fmtBun(value: string | null) {
  if (!value) return "-";
  return value.startsWith("B-") ? value : `B-${value}`;
}

function fmt(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function getDoneDate(contact: VipContact) {
  if (contact.meeting_result === "계약완료")
    return fmtDate(contact.contract_date);
  if (contact.meeting_result === "예약완료")
    return fmtDate(contact.reservation_date);
  return "-";
}

function getInitial(name: string) {
  return name?.trim()?.slice(0, 1) || "?";
}

function stageColor(status: string | null) {
  if (status === "계약완료") return "var(--success)";
  if (status === "예약완료") return "var(--info)";
  return "var(--accent)";
}

function statusBadgeClass(status: string | null) {
  if (status === "계약완료") return "badge-success";
  if (status === "예약완료") return "badge-info";
  return "badge-muted";
}

function AccountInfoCell({
  contact,
  onSaved,
}: {
  contact: VipContact;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasAccount = !!(
    contact.bank_holder ||
    contact.bank_name ||
    contact.bank_account
  );

  const handleCopy = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!contact.bank_account) return;

    navigator.clipboard.writeText(contact.bank_account).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-[132px] max-w-[172px] rounded-[12px] border px-2.5 py-1.5 text-center transition-all hover:-translate-y-0.5"
          style={{
            background: hasAccount ? "var(--surface)" : "var(--surface-2)",
            borderColor: hasAccount ? "var(--info-border)" : "var(--border)",
            boxShadow: hasAccount ? "var(--shadow-xs)" : "none",
          }}
          title="클릭하여 계좌정보 입력/편집"
        >
          {hasAccount ? (
            <div className="space-y-1">
              <div
                className="flex items-center justify-center gap-1 font-[740]"
                style={{ color: "var(--text)" }}
              >
                <CreditCard size={12} style={{ color: "var(--info-text)" }} />
                <span className="truncate text-[11px]">
                  {contact.bank_holder || "예금주 미입력"}
                </span>
              </div>
              <div
                className="truncate whitespace-nowrap text-center text-[10.5px] font-[700]"
                style={{ color: "var(--text-subtle)" }}
              >
                {contact.bank_name || "-"} {contact.bank_account || ""}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center gap-1 whitespace-nowrap text-[10.5px] font-[700]"
              style={{ color: "var(--text-faint)" }}
            >
              <CreditCard size={13} />
              <span>계좌정보 입력</span>
            </div>
          )}
        </button>

        {contact.bank_account && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border transition-colors"
            style={{
              background: copied ? "var(--success-bg)" : "var(--surface)",
              borderColor: copied ? "var(--success-border)" : "var(--border)",
              color: copied ? "var(--success-text)" : "var(--text-subtle)",
            }}
            title="계좌번호 복사"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>

      <BankAccountDialog
        open={open}
        onClose={() => setOpen(false)}
        contactId={contact.id}
        initial={{
          bank_holder: contact.bank_holder,
          bank_code: contact.bank_code,
          bank_name: contact.bank_name,
          bank_account: contact.bank_account,
        }}
        onSaved={onSaved}
      />
    </>
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
        className="h-[38px] min-w-[122px] appearance-none rounded-full border px-3 pr-8 text-[12.5px] font-[700] outline-none transition-colors"
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

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "success" | "info" | "warning" | "purple";
}) {
  const toneMap = {
    success: {
      bg: "var(--success-bg)",
      border: "var(--success-border)",
      text: "var(--success-text)",
    },
    info: {
      bg: "var(--info-bg)",
      border: "var(--info-border)",
      text: "var(--info-text)",
    },
    warning: {
      bg: "var(--warning-bg)",
      border: "var(--warning-border)",
      text: "var(--warning-text)",
    },
    purple: {
      bg: "var(--purple-bg)",
      border: "var(--purple-border)",
      text: "var(--purple-text)",
    },
  }[tone];

  return (
    <div className="premium-card flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[13px] border"
          style={{
            background: toneMap.bg,
            borderColor: toneMap.border,
            color: toneMap.text,
          }}
        >
          {icon}
        </div>
        <div>
          <p className="crm-tiny">{label}</p>
          <p
            className="mt-0.5 text-[22px] font-[820] tracking-[-0.02em]"
            style={{ color: "var(--text-strong)" }}
          >
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function RemoveMemberButton({
  contact,
  onSaved,
}: {
  contact: VipContact;
  onSaved: () => void;
}) {
  const handleRemove = async () => {
    if (
      !confirm(
        `${contact.name} 회원을 삭제하시겠습니까?\n고객DB에서 미팅결과, 완료일, 넘버링이 초기화됩니다.`,
      )
    )
      return;

    const { error } = await supabase
      .from("contacts")
      .update({
        meeting_result: "",
        contract_date: null,
        reservation_date: null,
        bunyanghoe_number: null,
      })
      .eq("id", contact.id);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }

    onSaved();
  };

  return (
    <button
      type="button"
      onClick={handleRemove}
      className="flex h-7 w-7 items-center justify-center rounded-[9px] border transition-colors"
      style={{
        background: "var(--danger-bg)",
        borderColor: "var(--danger-border)",
        color: "var(--danger-text)",
      }}
      title="입회자 목록에서 삭제"
    >
      <Trash2 size={14} />
    </button>
  );
}

function TableCell({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={`flex min-h-[64px] w-full items-center justify-center px-1.5 text-center ${className}`}
      title={title}
    >
      {children}
    </div>
  );
}

function VipTable({
  title,
  tone,
  rows,
  onSaved,
}: {
  title: string;
  tone: "success" | "info";
  rows: VipContact[];
  onSaved: () => void;
}) {
  const isSuccess = tone === "success";
  const softLine = "rgba(148, 163, 184, 0.16)";
  const softLineStrong = "rgba(148, 163, 184, 0.22)";
  const softHeader = "color-mix(in srgb, var(--surface-2) 88%, transparent)";
  const softRowAlt = "color-mix(in srgb, var(--surface-2) 68%, transparent)";
  const tableColumns =
    "62px minmax(116px,1fr) minmax(112px,0.95fr) minmax(88px,0.72fr) minmax(88px,0.72fr) minmax(96px,0.76fr) minmax(144px,1.05fr) 42px";

  return (
    <section
      className="premium-card flex min-h-[420px] max-h-[calc(100vh-330px)] flex-col overflow-hidden 2xl:max-h-[calc(100vh-320px)]"
      style={{
        background: "var(--surface)",
        borderColor: softLine,
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div
        className="flex min-h-[58px] items-center justify-between gap-3 border-b px-4 py-3"
        style={{
          borderColor: softLine,
          background: softHeader,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[13px] border"
            style={{
              background: isSuccess ? "var(--success-bg)" : "var(--info-bg)",
              borderColor: isSuccess
                ? "var(--success-border)"
                : "var(--info-border)",
              color: isSuccess ? "var(--success-text)" : "var(--info-text)",
            }}
          >
            {isSuccess ? <ShieldCheck size={17} /> : <Award size={17} />}
          </div>
          <div>
            <p className="text-[16px] font-[760] tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>
              {title}
            </p>
            <p className="mt-0.5 text-[12px] font-[720]" style={{ color: "var(--text-muted)" }}>
              분양회 입회 확정 고객 목록
            </p>
          </div>
        </div>

        <span
          className={`badge-premium ${isSuccess ? "badge-success" : "badge-info"}`}
        >
          {rows.length}명
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-10">
          <EmptyState
            icon="⭐"
            title="입회자가 없습니다"
            description="계약완료 또는 예약완료 고객이 표시됩니다"
          />
        </div>
      ) : (
        <>
          <div className="vip-member-table-scroll hidden min-h-0 flex-1 overflow-auto xl:block">
            <div className="min-w-[820px]">
              <div
                className="sticky top-0 z-20 grid h-12 min-h-[48px] items-center justify-items-center gap-1 border-b px-3 text-center text-[12px] font-[720] tracking-[-0.015em] backdrop-blur"
                style={{
                  gridTemplateColumns: tableColumns,
                  borderColor: softLine,
                  color: "var(--text-strong)",
                  background: softHeader,
                  boxShadow: `0 1px 0 ${softLine}`,
                }}
              >
                <span>넘버링</span>
                <span>고객명</span>
                <span>연락처</span>
                <span>담당컨설턴트</span>
                <span>대협팀담당자</span>
                <span>완료일</span>
                <span>계좌정보</span>
                <span>관리</span>
              </div>

              <div>
                {rows.map((contact, index) => (
                  <div
                    key={contact.id}
                    className="grid min-h-[66px] items-center justify-items-center gap-1 px-3 text-center transition-colors hover:bg-white/[0.06]"
                    style={{
                      gridTemplateColumns: tableColumns,
                      borderLeft: `4px solid ${stageColor(contact.meeting_result)}`,
                      borderTop: index === 0 ? "none" : `1px solid ${softLine}`,
                      background:
                        index % 2 === 0
                          ? "var(--surface)"
                          : softRowAlt,
                    }}
                  >
                    <TableCell>
                      <span
                        className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-[720]"
                        style={{
                          color: "var(--warning-text)",
                          borderColor: "var(--warning-border)",
                          background: "var(--warning-bg)",
                        }}
                      >
                        {fmtBun(contact.bunyanghoe_number)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex min-w-0 items-center justify-center gap-2 text-center">
                        <div
                          className="hidden h-7 w-7 flex-shrink-0 items-center justify-center rounded-[10px] text-[11px] font-[760] text-white shadow-sm min-[1480px]:flex"
                          style={{
                            background: `linear-gradient(135deg, ${stageColor(contact.meeting_result)}, var(--accent))`,
                          }}
                        >
                          {getInitial(contact.name)}
                        </div>
                        <div className="min-w-0 text-center">
                          <p className="truncate whitespace-nowrap text-center text-[12.5px] font-[720] leading-[1.15]" style={{ color: "var(--text-strong)" }}>
                            {contact.name}
                          </p>
                          <span
                            className={`badge-premium mt-1 text-[10.5px] ${statusBadgeClass(contact.meeting_result)}`}
                          >
                            {contact.meeting_result}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="flex items-center justify-center gap-1 whitespace-nowrap text-center text-[12px] font-[720]" style={{ color: "var(--text)" }}>
                        <Phone size={13} style={{ color: "var(--text-faint)" }} />
                        {fmt(contact.phone)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="whitespace-nowrap text-center text-[12px] font-[720]" style={{ color: "var(--text)" }}>
                        {fmt(contact.consultant)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span
                        className="whitespace-nowrap text-center text-[12px] font-[720]"
                        style={{ color: "var(--purple-text)" }}
                      >
                        {fmt(contact.assigned_to)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex items-center justify-center gap-1 whitespace-nowrap text-center text-[12px] font-[720]" style={{ color: "var(--text)" }}>
                        <Calendar size={13} style={{ color: "var(--text-faint)" }} />
                        {getDoneDate(contact)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <AccountInfoCell contact={contact} onSaved={onSaved} />
                    </TableCell>

                    <TableCell>
                      <RemoveMemberButton contact={contact} onSaved={onSaved} />
                    </TableCell>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 xl:hidden">
            {rows.map((contact) => (
              <article
                key={contact.id}
                className="premium-card premium-card-hover overflow-hidden p-4 text-center"
                style={{
                  borderLeft: `4px solid ${stageColor(contact.meeting_result)}`,
                  borderColor:
                    "color-mix(in srgb, var(--border) 48%, var(--text) 30%)",
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, var(--text) 4%), color-mix(in srgb, var(--surface) 99%, var(--text) 1%))",
                }}
              >
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-between">
                  <div className="flex min-w-0 items-center justify-center gap-2 text-center">
                    <div
                      className="crm-avatar flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${stageColor(contact.meeting_result)}, var(--accent))`,
                      }}
                    >
                      {getInitial(contact.name)}
                    </div>
                    <div className="min-w-0 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <p className="truncate text-center text-[15px] font-[760]" style={{ color: "var(--text-strong)" }}>
                          {contact.name}
                        </p>
                        <span
                          className={`badge-premium ${statusBadgeClass(contact.meeting_result)}`}
                        >
                          {contact.meeting_result}
                        </span>
                      </div>
                      <p className="mt-1 text-center text-[13.5px] font-[720]" style={{ color: "var(--text-muted)" }}>
                        {fmt(contact.phone)}
                      </p>
                    </div>
                  </div>

                  <span
                    className="rounded-full border px-3 py-1.5 text-[12.5px] font-[720]"
                    style={{
                      color: "var(--warning-text)",
                      borderColor: "var(--warning-border)",
                      background: "var(--warning-bg)",
                    }}
                  >
                    {fmtBun(contact.bunyanghoe_number)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <MiniInfo
                    label="담당컨설턴트"
                    value={fmt(contact.consultant)}
                  />
                  <MiniInfo
                    label="대협팀담당자"
                    value={fmt(contact.assigned_to)}
                  />
                  <MiniInfo label="완료일" value={getDoneDate(contact)} />
                </div>

                <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <AccountInfoCell contact={contact} onSaved={onSaved} />
                  <RemoveMemberButton contact={contact} onSaved={onSaved} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[13px] border px-3 py-2"
      style={{
        borderColor: "color-mix(in srgb, var(--border) 70%, var(--text) 18%)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 78%, var(--text) 10%), var(--surface-2))",
      }}
    >
      <p className="crm-tiny">{label}</p>
      <p className="crm-row-sub mt-1 truncate text-center">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

export default function VipMembersPage() {
  const [contacts, setContacts] = useState<VipContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMember, setFilterMember] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterConsultant, setFilterConsultant] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const user = JSON.parse(raw) as { role?: string; name?: string };
        if (user.role === "exec" && user.name) setFilterMember(user.name);
      }
    } catch {
      // localStorage parsing failure ignored
    }
  }, []);

  useEffect(() => {
    fetchVipMembers();
  }, [filterMember, filterStatus]);

  const fetchVipMembers = async () => {
    setLoading(true);

    let query = supabase
      .from("contacts")
      .select(
        "id,name,phone,assigned_to,meeting_result,contract_date,reservation_date,consultant,memo,bunyanghoe_number,bank_holder,bank_code,bank_name,bank_account",
      )
      .in("meeting_result", ["계약완료", "예약완료"]);

    if (filterMember) query = query.eq("assigned_to", filterMember);
    if (filterStatus) query = query.eq("meeting_result", filterStatus);

    const { data, error } = await query;

    if (error) {
      alert(`분양회 입회자 목록을 불러오지 못했습니다.\n${error.message}`);
      setContacts([]);
      setLoading(false);
      return;
    }

    const sorted = ((data as VipContact[]) || []).sort(
      (a, b) =>
        bunNumValue(a.bunyanghoe_number) - bunNumValue(b.bunyanghoe_number),
    );

    setContacts(sorted);
    setLoading(false);
  };

  const consultantOptions = useMemo(() => {
    return Array.from(
      new Set(
        contacts
          .map((contact) => contact.consultant)
          .filter(Boolean) as string[],
      ),
    ).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((contact) => {
      const keyword = search.trim().toLowerCase();
      if (keyword) {
        const target =
          `${contact.name || ""} ${contact.phone || ""} ${contact.bunyanghoe_number || ""} ${contact.assigned_to || ""} ${contact.consultant || ""}`.toLowerCase();
        if (!target.includes(keyword)) return false;
      }

      if (filterMember && contact.assigned_to !== filterMember) return false;
      if (filterConsultant && contact.consultant !== filterConsultant)
        return false;

      return true;
    });
  }, [contacts, filterConsultant, filterMember, search]);

  const contracts = filtered.filter(
    (contact) => contact.meeting_result === "계약완료",
  );
  const reservations = filtered.filter(
    (contact) => contact.meeting_result === "예약완료",
  );
  const accountCount = filtered.filter(
    (contact) =>
      contact.bank_holder || contact.bank_name || contact.bank_account,
  ).length;
  const activeFilters =
    [filterStatus, filterMember, filterConsultant].filter(Boolean).length +
    (search ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterMember("");
    setFilterConsultant("");
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <header className="premium-header flex-shrink-0 px-5 py-4 lg:px-7">
        <div className="premium-shell flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 text-center">
              <div className="mb-2 flex flex-wrap items-center justify-start gap-2">
                <span className="badge-premium badge-warning">
                  <Trophy size={13} /> 분양회 입회자
                </span>
                <span className="badge-premium badge-muted">
                  계약완료 · 예약완료 자동 집계
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] border"
                  style={{
                    background: "var(--warning-bg)",
                    borderColor: "var(--warning-border)",
                    color: "var(--warning-text)",
                  }}
                >
                  <Trophy size={20} />
                </div>
                <h1 className="crm-title text-left">분양회 입회자</h1>
              </div>
              <p className="crm-subtitle mt-2 text-left">
                계약완료 및 예약완료 고객의 넘버링, 계좌정보, 담당자, 완료일을
                한 화면에서 관리합니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[640px]">
              <StatCard
                icon={<Users size={17} />}
                label="전체 입회자"
                value={filtered.length}
                tone="purple"
              />
              <StatCard
                icon={<ShieldCheck size={17} />}
                label="계약완료"
                value={contracts.length}
                tone="success"
              />
              <StatCard
                icon={<Award size={17} />}
                label="예약완료"
                value={reservations.length}
                tone="info"
              />
              <StatCard
                icon={<CreditCard size={17} />}
                label="계좌등록"
                value={accountCount}
                tone="warning"
              />
            </div>
          </div>

          <div className="premium-filterbar rounded-[18px] px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[260px] flex-1 xl:max-w-[420px]">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-faint)" }}
                  />
                  <input
                    type="text"
                    placeholder="넘버링, 고객명, 연락처, 담당자, 컨설턴트 검색"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="crm-search w-full pl-9 pr-3"
                  />
                </div>

                <SelectFilter
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={STATUS_OPTIONS}
                  label="전체 상태"
                />
                <SelectFilter
                  value={filterMember}
                  onChange={setFilterMember}
                  options={TEAM}
                  label="대협팀 담당자"
                />
                <SelectFilter
                  value={filterConsultant}
                  onChange={setFilterConsultant}
                  options={consultantOptions}
                  label="담당컨설턴트"
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
                  onClick={fetchVipMembers}
                  className="btn-premium btn-secondary"
                >
                  <Filter size={14} /> 최신화
                </button>
                <span className="badge-premium badge-muted hidden sm:inline-flex">
                  <Sparkles size={13} /> B 넘버링 순 정렬
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-5 py-5 lg:px-7">
        <div className="premium-shell space-y-4">
          {loading ? (
            <section className="premium-card">
              <LoadingState />
            </section>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                <VipTable
                  title="예약완료"
                  tone="info"
                  rows={reservations}
                  onSaved={fetchVipMembers}
                />
                <VipTable
                  title="계약완료"
                  tone="success"
                  rows={contracts}
                  onSaved={fetchVipMembers}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
