"use client";

import ContactNotes from "@/components/ContactNotes";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  Flame,
  MapPin,
  MessageSquare,
  Plus,
  Phone,
  RefreshCw,
  Search,
  Target,
  User,
  UserCheck,
  X,
  Zap,
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
  assigned_to: string | null;
  consultant: string | null;
  memo: string | null;
  contract_date: string | null;
  reservation_date: string | null;
  intake_route: string | null;
  created_at: string;
};

type Note = {
  id: number;
  contact_id: number;
  note_date: string;
  content: string;
  author: string | null;
};

type DetailTab = "summary" | "field" | "notes" | "action" | "ads";

const TODAY = new Date().toISOString().slice(0, 10);

type Stage = {
  key: string;
  label: string;
  desc: string;
  tone: "danger" | "warning" | "cyan" | "success" | "purple" | "muted" | "info";
  icon: ElementType;
};


const STAGES: Stage[] = [
  {
    key: "리드",
    label: "Leads",
    desc: "초기 유입",
    tone: "danger",
    icon: Flame,
  },
  {
    key: "프로스펙팅",
    label: "Prospecting",
    desc: "상담/검토",
    tone: "warning",
    icon: Search,
  },
  {
    key: "딜크로징",
    label: "Closing",
    desc: "계약 직전",
    tone: "success",
    icon: Zap,
  },
  {
    key: "예약완료",
    label: "Reserved",
    desc: "예약 완료",
    tone: "purple",
    icon: Clock,
  },
  {
    key: "계약완료",
    label: "Signed",
    desc: "계약 완료",
    tone: "success",
    icon: UserCheck,
  },
  { key: "보류", label: "Paused", desc: "보류/이탈", tone: "muted", icon: X },
];

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const PROSPECTS = ["즉가입가망", "미팅예정가망", "연계매출가망"];
const RESULTS = [
  "계약완료",
  "예약완료",
  "서류만수취",
  "미팅후가망관리",
  "계약거부",
  "미팅불발",
];


const SITE_CONDITIONS = ["그랜드오픈", "첫조직투입", "정체기", "설거지"];
const SALE_RATES = ["5%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%"];
const ORGANIZATION_SIZES = [
  "50명 미만",
  "50~100명",
  "100~150명",
  "150~200명",
  "200~250명",
  "250~300명",
  "300명 이상",
];
const MOVE_MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const INFO_SOURCES = ["본인통화", "카톡", "소개", "상담사 공유", "현장소식", "기타"];

type FieldHistory = {
  id: number;
  contact_id: number;
  site_name: string | null;
  area: string | null;
  site_condition: string | null;
  sale_rate: string | null;
  organization_size: string | null;
  organization_chart: string | null;
  rt_fee: string | null;
  next_site_name: string | null;
  next_move_month: string | null;
  expected_revenue_site: string | null;
  expected_revenue: string | null;
  info_date: string | null;
  info_source: string | null;
  field_memo: string | null;
  author: string | null;
  created_at: string;
};

type FieldHistoryForm = {
  site_name: string;
  area: string;
  site_condition: string;
  sale_rate: string;
  organization_size: string;
  organization_chart: string;
  rt_fee: string;
  next_site_name: string;
  next_move_month: string;
  expected_revenue_site: string;
  expected_revenue: string;
  info_date: string;
  info_source: string;
  field_memo: string;
};

const emptyFieldHistoryForm = (): FieldHistoryForm => ({
  site_name: "",
  area: "",
  site_condition: "",
  sale_rate: "",
  organization_size: "",
  organization_chart: "",
  rt_fee: "",
  next_site_name: "",
  next_move_month: "",
  expected_revenue_site: "",
  expected_revenue: "",
  info_date: TODAY,
  info_source: "",
  field_memo: "",
});

function formatFullDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );
  } catch {
    return value;
  }
}

function meetingDisplay(contact: Contact) {
  if (contact.meeting_date) return formatFullDate(contact.meeting_date);
  return contact.meeting_date_text || "-";
}

function hasMeetingInfo(contact: Contact) {
  return Boolean(contact.meeting_date || contact.meeting_date_text || contact.meeting_address);
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "ko-KR",
      {
        month: "2-digit",
        day: "2-digit",
      },
    );
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
  return formatShortDate(value);
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#8b7cf6,#60a5fa)",
    "linear-gradient(135deg,#60a5fa,#22d3ee)",
    "linear-gradient(135deg,#34d399,#22d3ee)",
    "linear-gradient(135deg,#fbbf24,#fb7185)",
    "linear-gradient(135deg,#c084fc,#fb7185)",
    "linear-gradient(135deg,#8b7cf6,#c084fc)",
  ];
  if (!name) return gradients[0];
  const idx =
    name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) %
    gradients.length;
  return gradients[idx];
}

function toneStyle(tone: string) {
  const map: Record<
    string,
    { bg: string; color: string; border: string; dot: string }
  > = {
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

function stageTone(value?: string | null) {
  if (value === "리드") return "danger";
  if (value === "프로스펙팅") return "warning";
  if (value === "딜크로징") return "success";
  if (value === "리텐션" || value === "계약완료" || value === "예약완료")
    return "purple";
  if (value === "보류") return "muted";
  return "muted";
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

function sensitivityTone(value?: string | null) {
  if (value === "상") return "danger";
  if (value === "중") return "warning";
  if (value === "하") return "muted";
  return "muted";
}

function getStageKey(contact: Contact) {
  if (contact.meeting_result === "계약완료") return "계약완료";
  if (contact.meeting_result === "예약완료") return "예약완료";
  if (
    contact.meeting_result === "계약거부" ||
    contact.meeting_result === "미팅불발"
  )
    return "보류";
  if (contact.management_stage) return contact.management_stage;
  if (contact.prospect_type === "미팅예정가망") return "프로스펙팅";
  if (contact.prospect_type === "즉가입가망") return "딜크로징";
  if (contact.prospect_type === "연계매출가망") return "프로스펙팅";
  return "리드";
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
      {Icon ? (
        <Icon size={12} />
      ) : (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: c.dot }}
        />
      )}
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
    <div className="premium-card flex h-[78px] items-center gap-3 px-4">
      <PremiumIcon icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p
          className="mt-1 text-[21px] font-[760] leading-none tracking-[-0.05em]"
          style={{ color: "var(--text-strong)" }}
        >
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[116px_1fr] gap-3 py-3">
      <div
        className="text-[12px] font-semibold"
        style={{ color: "var(--text-subtle)" }}
      >
        {label}
      </div>
      <div
        className="min-w-0 text-[13px] font-semibold"
        style={{ color: "var(--text)" }}
      >
        {children || <span style={{ color: "var(--text-faint)" }}>-</span>}
      </div>
    </div>
  );
}

function PipelineCard({
  contact,
  selected,
  onClick,
}: {
  contact: Contact;
  selected: boolean;
  onClick: () => void;
}) {
  const stage = getStageKey(contact);

  return (
    <button
      type="button"
      onClick={onClick}
      className="premium-card premium-card-hover group w-full p-3.5 text-left"
      style={{
        background: selected
          ? "linear-gradient(90deg, rgba(139,124,246,.16), rgba(139,124,246,.045)), var(--surface-selected)"
          : undefined,
        borderColor: selected ? "var(--accent-border)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="crm-avatar"
          style={{ background: avatarBg(contact.name) }}
        >
          {contact.name?.[0] || "고"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="crm-row-main truncate">{contact.name}</p>
          <p className="crm-row-sub mt-0.5 truncate">
            {contact.title || "-"} · 담당 {contact.assigned_to || "-"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={stageTone(stage)}>{stage}</Badge>
            {contact.prospect_type && (
              <Badge tone={prospectTone(contact.prospect_type)}>
                {contact.prospect_type}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {contact.phone && (
          <div
            className="flex items-center gap-2 text-[12px] font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            <Phone size={13} style={{ color: "var(--text-faint)" }} />
            {contact.phone}
          </div>
        )}
        {hasMeetingInfo(contact) && (
          <div
            className="flex items-start gap-2 text-[12px] font-semibold leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            <CalendarDays
              size={13}
              className="mt-0.5 flex-shrink-0"
              style={{ color: "var(--info-text)" }}
            />
            <span className="min-w-0">
              <span className="font-bold" style={{ color: "var(--text-strong)" }}>
                {meetingDisplay(contact)}
              </span>
              {contact.meeting_address && (
                <span className="ml-1">· {contact.meeting_address}</span>
              )}
              {contact.meeting_date_text && !contact.meeting_date && (
                <span className="ml-1">· {contact.meeting_date_text}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {contact.memo && (
        <div
          className="mt-4 line-clamp-2 rounded-[10px] px-3 py-2 text-[12px] font-medium leading-relaxed"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {contact.memo}
        </div>
      )}

      <div
        className="mt-4 flex items-center justify-between pt-3"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <span className="crm-tiny truncate">
          {contact.intake_route || "유입경로 없음"}
        </span>
        <span className="crm-tiny flex-shrink-0">
          {timeAgo(contact.created_at)}
        </span>
      </div>
    </button>
  );
}

function getNextActionMessage(contact: Contact) {
  const stage = getStageKey(contact);
  if (stage === "리드")
    return "철저한 고객관리를 통해 프로스펙팅 구간으로 관리를 변경하세요 .";
  if (stage === "프로스펙팅")
    return "고객과의 라포형성이 잘 되었습니까? 클로징을 위해 고객과 미팅을 일정을 잡아보세요.";
  if (stage === "딜크로징")
    return "고객과의 모든 접점을 잘 만들어 냈습니다. 계약 전환을 위해 마지막 클로징을 진행해 보세요.";
  if (stage === "계약완료" || stage === "리텐션")
    return "고객여정의 마침표를 찍었습니다. 꾸준한 고객 관리를 통해 나의 팬으로 만들어보세요.";
  return "현재 고객 상태를 확인하고 다음 단계로 전환할 액션을 선택하세요.";
}

function RecentActivityNote({
  contactId,
  onShowAll,
}: {
  contactId: number;
  onShowAll: () => void;
}) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_notes")
      .select("id,contact_id,note_date,content,author")
      .eq("contact_id", contactId)
      .order("note_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
    setNote((data?.[0] as Note) || null);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  const getAuthor = () => {
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) return JSON.parse(raw).name || "";
    } catch {}
    return "";
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("contact_notes").insert({
      contact_id: contactId,
      note_date: newDate,
      content: newContent.trim(),
      author: getAuthor() || null,
    });
    setSaving(false);
    if (error) {
      alert("활동노트 저장 실패: " + error.message);
      return;
    }
    setNewContent("");
    setNewDate(new Date().toISOString().slice(0, 10));
    setAdding(false);
    await fetchLatest();
  };

  return (
    <section className="premium-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PremiumIcon icon={MessageSquare} tone="purple" />
          <div className="min-w-0">
            <p className="crm-section-title">활동노트</p>
            <p className="crm-tiny">가장 최근 작성된 1건</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onShowAll}
            className="btn-premium btn-secondary h-8 px-3 text-[12px]"
          >
            모두 보기
          </button>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="btn-premium btn-primary h-8 px-3 text-[12px]"
          >
            <Plus size={13} />
            노트 추가
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
            style={{
              borderColor: "var(--accent)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : note ? (
        <div
          className="rounded-[12px] p-4"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className="text-[12px] font-bold"
              style={{ color: "var(--accent-text)" }}
            >
              {formatFullDate(note.note_date)}
            </span>
            {note.author && (
              <span
                className="rounded-full px-2 py-1 text-[11px] font-bold"
                style={{
                  background: "var(--surface)",
                  color: "var(--text-subtle)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {note.author}
              </span>
            )}
          </div>
          <p
            className="line-clamp-4 whitespace-pre-wrap text-[14px] font-medium leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {note.content}
          </p>
        </div>
      ) : (
        <div
          className="rounded-[12px] p-4 text-center text-[12px] font-bold"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-faint)",
            border: "1px dashed var(--border)",
          }}
        >
          등록된 활동노트가 없습니다.
        </div>
      )}

      {adding && (
        <div
          className="mt-3 space-y-2 rounded-[12px] p-3"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-9 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            placeholder="활동 내용을 입력하세요..."
            className="w-full resize-none rounded-[10px] border px-3 py-2 text-[13px] font-medium outline-none"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewContent("");
              }}
              className="btn-premium btn-secondary h-9"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="btn-premium btn-primary h-9 disabled:opacity-50"
            >
              {saving ? "저장 중" : "저장"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}


function MiniInput({
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
    <label className="space-y-1.5">
      <span className="crm-tiny">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      />
    </label>
  );
}

function MiniSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "선택",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="crm-tiny">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldHistoryPanel({ contactId }: { contactId: number }) {
  const [items, setItems] = useState<FieldHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FieldHistoryForm>(() => emptyFieldHistoryForm());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_field_histories")
      .select(
        "id,contact_id,site_name,area,site_condition,sale_rate,organization_size,organization_chart,rt_fee,next_site_name,next_move_month,expected_revenue_site,expected_revenue,info_date,info_source,field_memo,author,created_at",
      )
      .eq("contact_id", contactId)
      .order("info_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("현장 히스토리 조회 실패:", error.message);
      setItems([]);
      setLoading(false);
      return;
    }
    setItems((data || []) as FieldHistory[]);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    fetchItems();
    setAdding(false);
    setForm(emptyFieldHistoryForm());
  }, [fetchItems]);

  const currentUserName = () => {
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) return JSON.parse(raw).name || "";
    } catch {}
    return "";
  };

  const patchForm = (key: keyof FieldHistoryForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveHistory = async () => {
    const latestSiteName = latest?.site_name?.trim() || "";
    const resolvedSiteName = form.site_name.trim() || latestSiteName;

    if (!resolvedSiteName) {
      alert("최초 현장정보는 현장명을 입력해줘.");
      return;
    }

    const hasInput = Boolean(
      form.site_name.trim() ||
        form.area.trim() ||
        form.site_condition ||
        form.sale_rate ||
        form.organization_size ||
        form.organization_chart.trim() ||
        form.rt_fee.trim() ||
        form.next_site_name.trim() ||
        form.next_move_month ||
        form.expected_revenue_site.trim() ||
        form.expected_revenue.trim() ||
        form.info_source ||
        form.field_memo.trim(),
    );

    if (!hasInput) {
      alert("추가할 현장 변경 내용 또는 이동예정 정보를 입력해줘.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("contact_field_histories").insert({
      contact_id: contactId,
      site_name: resolvedSiteName,
      area: form.area.trim() || latest?.area || null,
      site_condition: form.site_condition || latest?.site_condition || null,
      sale_rate: form.sale_rate || latest?.sale_rate || null,
      organization_size: form.organization_size || latest?.organization_size || null,
      organization_chart: form.organization_chart.trim() || latest?.organization_chart || null,
      rt_fee: form.rt_fee.trim() || latest?.rt_fee || null,
      next_site_name: form.next_site_name.trim() || null,
      next_move_month: form.next_move_month || null,
      expected_revenue_site:
        form.expected_revenue_site.trim() ||
        form.next_site_name.trim() ||
        resolvedSiteName ||
        null,
      expected_revenue: form.expected_revenue.trim() || null,
      info_date: form.info_date || TODAY,
      info_source: form.info_source || null,
      field_memo: form.field_memo.trim() || null,
      author: currentUserName() || null,
    });
    setSaving(false);

    if (error) {
      alert("현장 히스토리 저장 실패: " + error.message);
      return;
    }

    setAdding(false);
    setForm(emptyFieldHistoryForm());
    await fetchItems();
  };

  const siteOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .flatMap((item) => [item.site_name, item.next_site_name])
            .filter(Boolean) as string[],
        ),
      ),
    [items],
  );

  const latest = items[0];

  return (
    <div className="space-y-5">
      <section className="premium-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <PremiumIcon icon={MapPin} tone="info" />
            <div className="min-w-0">
              <p className="crm-section-title">현장 히스토리</p>
              <p className="crm-tiny">고객의 현재 현장, 이동 예정, 예상매출 누적 기록</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="btn-premium btn-primary h-9 flex-shrink-0 px-3 text-[12px]"
          >
            <Plus size={14} />
            현장정보 추가
          </button>
        </div>

        {latest ? (
          <div
            className="grid gap-3 rounded-[14px] p-4 md:grid-cols-2 xl:grid-cols-3"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <Field label="최근 현장명">{latest.site_name || "-"}</Field>
            <Field label="지역">{latest.area || "-"}</Field>
            <Field label="현장컨디션">
              <Badge tone="warning">{latest.site_condition || "-"}</Badge>
            </Field>
            <Field label="분양률">
              <Badge tone="info">{latest.sale_rate || "-"}</Badge>
            </Field>
            <Field label="조직수">{latest.organization_size || "-"}</Field>
            <Field label="예상매출">
              <span className="font-extrabold" style={{ color: "var(--danger-text)" }}>
                {latest.expected_revenue || "-"}
              </span>
            </Field>
          </div>
        ) : (
          <div
            className="rounded-[14px] border border-dashed p-5 text-center text-[13px] font-bold"
            style={{ color: "var(--text-faint)", borderColor: "var(--border)" }}
          >
            아직 등록된 현장 히스토리가 없습니다.
          </div>
        )}
      </section>

      {adding && (
        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <PremiumIcon icon={Plus} tone="success" />
            <div>
              <p className="crm-section-title">현장정보 입력</p>
              <p className="crm-tiny">새 기록으로 누적 저장됩니다.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[12px] font-black" style={{ color: "var(--text-strong)" }}>
                    현장정보 현재 기준
                  </p>
                  {latest?.site_name && (
                    <p className="crm-tiny mt-1">
                      기존 현장: <b style={{ color: "var(--text-strong)" }}>{latest.site_name}</b> ·
                      현장명이 비어 있으면 기존 현장 기준으로 누적 저장됩니다.
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MiniInput label={latest?.site_name ? "현장명 변경 시 입력" : "현장명"} value={form.site_name} onChange={(v) => patchForm("site_name", v)} placeholder={latest?.site_name ? `비워두면 ${latest.site_name} 기준` : "예: 대전 문화공원 수자인"} />
                <MiniInput label="지역" value={form.area} onChange={(v) => patchForm("area", v)} placeholder={latest?.area ? `비워두면 ${latest.area} 기준` : "예: 대전"} />
                <MiniSelect label="현장컨디션" value={form.site_condition} onChange={(v) => patchForm("site_condition", v)} options={SITE_CONDITIONS} />
                <MiniSelect label="분양률" value={form.sale_rate} onChange={(v) => patchForm("sale_rate", v)} options={SALE_RATES} />
              </div>
            </div>

            <div>
              <p className="mb-3 text-[12px] font-black" style={{ color: "var(--text-strong)" }}>
                조직정보
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MiniSelect label="조직수" value={form.organization_size} onChange={(v) => patchForm("organization_size", v)} options={ORGANIZATION_SIZES} />
                <MiniInput label="현장조직도" value={form.organization_chart} onChange={(v) => patchForm("organization_chart", v)} placeholder="예: 1총괄 3본부" />
                <MiniInput label="R/T(수수료)" value={form.rt_fee} onChange={(v) => patchForm("rt_fee", v)} placeholder="예: 팀 600만" />
                <MiniSelect label="정보출처" value={form.info_source} onChange={(v) => patchForm("info_source", v)} options={INFO_SOURCES} />
              </div>
            </div>

            <div>
              <p className="mb-3 text-[12px] font-black" style={{ color: "var(--text-strong)" }}>
                현장이동예정정보 / 예상매출
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MiniInput label="이동예정현장명" value={form.next_site_name} onChange={(v) => patchForm("next_site_name", v)} placeholder="예: 대전 문화공원 수자인" />
                <MiniSelect label="현장이동예정월" value={form.next_move_month} onChange={(v) => patchForm("next_move_month", v)} options={MOVE_MONTHS} />
                {siteOptions.length > 0 ? (
                  <MiniSelect label="예상매출 기준 현장" value={form.expected_revenue_site} onChange={(v) => patchForm("expected_revenue_site", v)} options={Array.from(new Set([form.site_name, form.next_site_name, latest?.site_name || "", ...siteOptions].filter(Boolean)))} placeholder="현장 선택" />
                ) : (
                  <MiniInput label="예상매출 기준 현장" value={form.expected_revenue_site} onChange={(v) => patchForm("expected_revenue_site", v)} placeholder="예: 현재 입력 현장" />
                )}
                <MiniInput label="예상매출" value={form.expected_revenue} onChange={(v) => patchForm("expected_revenue", v)} placeholder="예: 500만원" />
                <MiniInput label="정보 기준일" value={form.info_date} onChange={(v) => patchForm("info_date", v)} placeholder="YYYY-MM-DD" />
              </div>
              <label className="mt-3 block space-y-1.5">
                <span className="crm-tiny">현장 메모</span>
                <textarea
                  value={form.field_memo}
                  onChange={(e) => patchForm("field_memo", e.target.value)}
                  rows={3}
                  placeholder="예: 6월 말 이동 가능성 높음. 하이타겟 제안 가능성 있음."
                  className="w-full resize-none rounded-[12px] border px-3 py-2 text-[13px] font-medium outline-none"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setForm(emptyFieldHistoryForm());
                }}
                className="btn-premium btn-secondary h-10"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveHistory}
                disabled={saving}
                className="btn-premium btn-primary h-10 disabled:opacity-50"
              >
                {saving ? "저장 중" : "현장정보 저장"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="premium-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <PremiumIcon icon={Clock} tone="purple" />
          <div>
            <p className="crm-section-title">누적 기록</p>
            <p className="crm-tiny">최신 기록이 가장 위에 표시됩니다.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-[14px] border border-dashed p-5 text-center text-[13px] font-bold"
            style={{ color: "var(--text-faint)", borderColor: "var(--border)" }}
          >
            누적된 현장 기록이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <article
                key={item.id}
                className="rounded-[16px] p-4"
                style={{
                  background: index === 0 ? "var(--surface-2)" : "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-black" style={{ color: "var(--text-strong)" }}>
                        {item.site_name || "현장명 없음"}
                      </p>
                      {index === 0 && <Badge tone="success">현재 기준</Badge>}
                    </div>
                    <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>
                      {item.area || "지역 없음"} · 기준일 {formatFullDate(item.info_date)} · 작성 {item.author || "-"}
                    </p>
                  </div>
                  {item.expected_revenue && (
                    <Badge tone="danger">예상매출 {item.expected_revenue}</Badge>
                  )}
                </div>

                <div className="grid gap-2 text-[12px] md:grid-cols-2 xl:grid-cols-3">
                  <Field label="현장컨디션">{item.site_condition || "-"}</Field>
                  <Field label="분양률">{item.sale_rate || "-"}</Field>
                  <Field label="조직수">{item.organization_size || "-"}</Field>
                  <Field label="현장조직도">{item.organization_chart || "-"}</Field>
                  <Field label="R/T">{item.rt_fee || "-"}</Field>
                  <Field label="정보출처">{item.info_source || "-"}</Field>
                  <Field label="이동예정현장">{item.next_site_name || "-"}</Field>
                  <Field label="이동예정월">{item.next_move_month || "-"}</Field>
                  <Field label="예상매출 기준">{item.expected_revenue_site || item.site_name || "-"}</Field>
                </div>

                {item.field_memo && (
                  <div
                    className="mt-3 whitespace-pre-wrap rounded-[12px] p-3 text-[12px] font-medium leading-relaxed"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {item.field_memo}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailSlidePanel({
  contact,
  tab,
  onTab,
  onClose,
  onStageChange,
  onMeetingSave,
}: {
  contact: Contact;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onClose: () => void;
  onStageChange: (contact: Contact, stage: string) => Promise<void>;
  onMeetingSave: (
    contact: Contact,
    meetingDate: string,
    meetingAddress: string,
    meetingText: string,
  ) => Promise<void>;
}) {
  const stage = getStageKey(contact);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState(contact.meeting_date || TODAY);
  const [meetingAddress, setMeetingAddress] = useState(contact.meeting_address || "");
  const [meetingText, setMeetingText] = useState(contact.meeting_date_text || "");
  const [meetingSaving, setMeetingSaving] = useState(false);

  useEffect(() => {
    setMeetingDate(contact.meeting_date || TODAY);
    setMeetingAddress(contact.meeting_address || "");
    setMeetingText(contact.meeting_date_text || "");
  }, [contact.id, contact.meeting_address, contact.meeting_date, contact.meeting_date_text]);

  const quickStageTargets = useMemo(() => {
    if (stage === "리드") return ["프로스펙팅", "딜크로징"];
    if (stage === "프로스펙팅") return ["리드", "딜크로징"];
    if (stage === "딜크로징") return ["리드", "프로스펙팅"];
    if (stage === "예약완료" || stage === "계약완료") {
      return ["리드", "프로스펙팅", "딜크로징"];
    }
    return [];
  }, [stage]);

  const showRetentionAction = ["리드", "프로스펙팅", "딜크로징"].includes(stage);
  const showMeetingAction = !["예약완료", "계약완료"].includes(stage);

  const getStageButtonLabel = (target: string) => {
    if (target === "딜크로징") return "딜클로징 전환";
    return `${target} 전환`;
  };

  const getStageButtonIcon = (target: string) => {
    if (target === "리드") return <Flame size={14} />;
    if (target === "프로스펙팅") return <Search size={14} />;
    if (target === "딜크로징") return <Zap size={14} />;
    return <Target size={14} />;
  };

  const handleRetentionSelect = async (result: "예약완료" | "계약완료") => {
    await onStageChange(contact, result);
    setRetentionOpen(false);
  };

  const handleMeetingSubmit = async () => {
    if (!meetingDate) {
      alert("미팅일정을 선택해 주세요.");
      return;
    }

    setMeetingSaving(true);
    await onMeetingSave(contact, meetingDate, meetingAddress.trim(), meetingText.trim());
    setMeetingSaving(false);
    setMeetingOpen(false);
  };

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />
      <aside
        className="slide-panel"
        style={{ width: "min(1120px, calc(100vw - 48px))", maxWidth: "calc(100vw - 48px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="slide-panel-header" style={{ padding: "clamp(20px, 2vw, 28px)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className="crm-avatar-lg crm-avatar"
                style={{ background: avatarBg(contact.name), width: 64, height: 64, fontSize: 24 }}
              >
                {contact.name?.[0] || "고"}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    className="truncate text-[30px] font-[780] tracking-[-0.035em]"
                    style={{ color: "var(--text-strong)" }}
                  >
                    {contact.name}
                  </h2>
                  <Badge tone={stageTone(stage)}>{stage}</Badge>
                </div>
                <p
                  className="mt-1.5 text-[14px] font-semibold"
                  style={{ color: "var(--text-subtle)" }}
                >
                  ID {contact.id} · {contact.title || "직급 없음"} · 담당{" "}
                  {contact.assigned_to || "-"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={prospectTone(contact.prospect_type)}>
                    {contact.prospect_type || "가망 없음"}
                  </Badge>
                  <Badge tone={resultTone(contact.meeting_result)}>
                    {contact.meeting_result || "결과 없음"}
                  </Badge>
                  <Badge tone={sensitivityTone(contact.tm_sensitivity)}>
                    TM {contact.tm_sensitivity || "-"}
                  </Badge>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-premium btn-secondary h-9 w-9 p-0"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { key: "summary", label: "Summary" },
              { key: "field", label: "Field History" },
              { key: "notes", label: "Notes" },
              { key: "action", label: "Next action" },
              { key: "ads", label: "Ads >" },
            ].map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTab(item.key as DetailTab)}
                  className="h-10 rounded-[10px] px-4 text-[13px] font-bold transition-all"
                  style={{
                    background: active ? "var(--accent-subtle)" : "transparent",
                    color: active ? "var(--accent-text)" : "var(--text-subtle)",
                    border: active
                      ? "1px solid var(--accent-border)"
                      : "1px solid transparent",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="slide-panel-body" style={{ padding: "clamp(20px, 2vw, 28px)" }}>
          {tab === "summary" && (
            <div className="grid gap-5 xl:grid-cols-2">
              <section className="premium-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <PremiumIcon icon={Phone} tone="info" />
                  <div>
                    <p className="crm-section-title">고객정보</p>
                    <p className="crm-tiny">고객등록 연동 기본 정보</p>
                  </div>
                </div>
                <Field label="연락처">{contact.phone || "-"}</Field>
                <Field label="유입경로">
                  <Badge tone="muted">{contact.intake_route || "-"}</Badge>
                </Field>
                <Field label="담당컨설턴트">
                  <Badge tone="purple">
                    {contact.consultant || contact.assigned_to || "-"}
                  </Badge>
                </Field>
                <Field label="미팅일정">
                  <div className="space-y-1 text-left">
                    <div className="font-bold" style={{ color: "var(--text-strong)" }}>
                      {meetingDisplay(contact)}
                    </div>
                    {contact.meeting_address && (
                      <div
                        className="flex items-center gap-1.5 text-[12px] font-semibold"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        <MapPin size={12} />
                        {contact.meeting_address}
                      </div>
                    )}
                    {contact.meeting_date_text && (
                      <div
                        className="text-[12px] font-semibold leading-relaxed"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {contact.meeting_date_text}
                      </div>
                    )}
                  </div>
                </Field>
              </section>

              <section className="premium-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <PremiumIcon icon={Target} tone="success" />
                  <div>
                    <p className="crm-section-title">Pipeline state</p>
                    <p className="crm-tiny">관리 단계와 TM 감도</p>
                  </div>
                </div>
                <Field label="관리단계">
                  <Badge tone={stageTone(stage)}>{stage}</Badge>
                </Field>
                <Field label="TM감도">
                  <Badge tone={sensitivityTone(contact.tm_sensitivity)}>
                    {contact.tm_sensitivity || "-"}
                  </Badge>
                </Field>
              </section>

              <section className="premium-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <PremiumIcon icon={MessageSquare} tone="cyan" />
                  <div>
                    <p className="crm-section-title">Memo</p>
                    <p className="crm-tiny">상담 내용과 다음 흐름</p>
                  </div>
                </div>
                <div
                  className="min-h-[150px] whitespace-pre-wrap rounded-[14px] p-5 text-[14px] font-medium leading-[1.75]"
                  style={{
                    background: "var(--surface-2)",
                    color: contact.memo
                      ? "var(--text-muted)"
                      : "var(--text-faint)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {contact.memo || "등록된 메모가 없습니다."}
                </div>
              </section>

              <RecentActivityNote
                contactId={contact.id}
                onShowAll={() => onTab("notes")}
              />
            </div>
          )}

          {tab === "field" && <FieldHistoryPanel contactId={contact.id} />}

          {tab === "notes" && (
            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <PremiumIcon icon={MessageSquare} tone="purple" />
                <div>
                  <p className="crm-section-title">Activity notes</p>
                  <p className="crm-tiny">상담 이력과 후속 액션</p>
                </div>
              </div>
              <ContactNotes contactId={contact.id} />
            </section>
          )}

          {tab === "ads" && (
            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <PremiumIcon icon={Target} tone="info" />
                <div>
                  <p className="crm-section-title">Ads history</p>
                  <p className="crm-tiny">고객별 광고 운영 히스토리</p>
                </div>
              </div>
              <div
                className="rounded-[14px] border p-4 text-[13px] font-semibold leading-relaxed"
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-muted)",
                }}
              >
                추후 이 영역에서 고객이 언제 어떤 광고를 운영했는지, 현재 운영 중인 광고가 무엇인지 확인할 수 있도록 연결할 예정입니다.
              </div>
            </section>
          )}

          {tab === "action" && (
            <div className="space-y-6">
              <section className="premium-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={Clock} tone="info" />
                  <div>
                    <p className="crm-section-title">Next action</p>
                    <p className="crm-tiny">상태 기준 처리 방향</p>
                  </div>
                </div>
                <div
                  className="rounded-[12px] p-4 text-[13px] font-semibold leading-relaxed"
                  style={{
                    background: "var(--info-bg)",
                    color: "var(--info-text)",
                    border: "1px solid var(--info-border)",
                  }}
                >
                  {getNextActionMessage(contact)}
                </div>
              </section>

              <section className="premium-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={Zap} tone="warning" />
                  <div>
                    <p className="crm-section-title">Quick actions</p>
                    <p className="crm-tiny">현재 상태에서 바로 처리할 작업</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {quickStageTargets.length > 0 && (
                    <div className="grid gap-2">
                      {quickStageTargets.map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => onStageChange(contact, target)}
                          className="btn-premium btn-primary w-full"
                        >
                          {getStageButtonIcon(target)}
                          {getStageButtonLabel(target)}
                        </button>
                      ))}
                      {showRetentionAction && (
                        <button
                          type="button"
                          onClick={() => setRetentionOpen(true)}
                          className="btn-premium btn-primary w-full"
                        >
                          <UserCheck size={14} />
                          리텐션 전환
                        </button>
                      )}
                    </div>
                  )}

                  {showMeetingAction && (
                    <button
                      type="button"
                      onClick={() => setMeetingOpen((value) => !value)}
                      className="btn-premium btn-secondary w-full"
                    >
                      <CalendarDays size={14} />
                      미팅일정 등록
                    </button>
                  )}

                  {meetingOpen && (
                    <div
                      className="space-y-3 rounded-[14px] p-3"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div>
                        <p
                          className="text-[13px] font-bold"
                          style={{ color: "var(--text-strong)" }}
                        >
                          미팅일정 등록
                        </p>
                        <p
                          className="mt-1 text-[11px] font-semibold leading-relaxed"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          날짜, 장소, 일정 메모를 저장하면 고객카드와 고객정보에 표시됩니다.
                        </p>
                      </div>
                      <label className="block space-y-1.5">
                        <span className="crm-tiny">미팅일정</span>
                        <input
                          type="date"
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
                          style={{
                            background: "var(--surface)",
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-strong)",
                          }}
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="crm-tiny">미팅장소</span>
                        <input
                          value={meetingAddress}
                          onChange={(e) => setMeetingAddress(e.target.value)}
                          placeholder="예: 수원 / 모델하우스 / 고객 사무실"
                          className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
                          style={{
                            background: "var(--surface)",
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-strong)",
                          }}
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="crm-tiny">일정 메모</span>
                        <textarea
                          value={meetingText}
                          onChange={(e) => setMeetingText(e.target.value)}
                          placeholder="예: 미팅 전 자료 전달 필요"
                          rows={3}
                          className="w-full resize-none rounded-[10px] border px-3 py-2 text-[13px] font-semibold leading-relaxed outline-none"
                          style={{
                            background: "var(--surface)",
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-strong)",
                          }}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMeetingOpen(false)}
                          className="btn-premium btn-secondary h-9"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleMeetingSubmit}
                          disabled={meetingSaving}
                          className="btn-premium btn-primary h-9 disabled:opacity-50"
                        >
                          {meetingSaving ? "저장 중" : "일정 저장"}
                        </button>
                      </div>
                    </div>
                  )}

                  {retentionOpen && (
                    <div
                      className="space-y-3 rounded-[14px] p-3"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--purple-border)",
                      }}
                    >
                      <div>
                        <p
                          className="text-[13px] font-bold"
                          style={{ color: "var(--text-strong)" }}
                        >
                          리텐션 전환 상태 선택
                        </p>
                        <p
                          className="mt-1 text-[11px] font-semibold leading-relaxed"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          리텐션은 예약완료 또는 계약완료로 구분해 저장됩니다.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleRetentionSelect("예약완료")}
                          className="btn-premium btn-secondary h-9"
                        >
                          <Clock size={14} />
                          예약완료
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRetentionSelect("계약완료")}
                          className="btn-premium btn-primary h-9"
                        >
                          <UserCheck size={14} />
                          계약완료
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRetentionOpen(false)}
                        className="btn-premium btn-secondary h-9 w-full"
                      >
                        취소
                      </button>
                    </div>
                  )}


                  <a
                    href={`/customer-register?edit=${contact.id}`}
                    className="btn-premium btn-secondary w-full"
                  >
                    <User size={14} />
                    고객정보수정
                  </a>
                  <button
                    type="button"
                    onClick={() => onTab("notes")}
                    className="btn-premium btn-secondary w-full"
                  >
                    <MessageSquare size={14} />
                    활동노트 작성
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="slide-panel-footer" style={{ padding: "clamp(16px, 1.6vw, 22px) clamp(20px, 2vw, 28px)" }}>
          <div className="grid grid-cols-3 gap-3">
            <a
              href={`/customer-register?edit=${contact.id}`}
              className="btn-premium btn-primary"
            >
              <User size={14} />
              고객정보수정
            </a>
            <button
              type="button"
              onClick={() => onTab("notes")}
              className="btn-premium btn-secondary"
            >
              <MessageSquare size={14} />
              Notes
            </button>
            <button
              type="button"
              className="btn-premium btn-secondary"
              title="광고요청 기능은 추후 활성화 예정입니다."
            >
              <Plus size={14} />
              광고요청
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function PipelinePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");

  const [search, setSearch] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fProspect, setFProspect] = useState("");
  const [fResult, setFResult] = useState("");
  const [fStage, setFStage] = useState("");
  const [mobileStage, setMobileStage] = useState(STAGES[0].key);

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

    let q = supabase
      .from("contacts")
      .select(
        "id,name,title,phone,customer_type,tm_sensitivity,prospect_type,meeting_date,meeting_date_text,meeting_address,meeting_result,management_stage,assigned_to,consultant,memo,contract_date,reservation_date,intake_route,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(700);

    if (execName) q = q.eq("assigned_to", execName);

    const { data, error } = await q;
    if (error) {
      console.error("파이프라인 조회 실패:", error.message);
      setContacts([]);
      setLoading(false);
      return;
    }
    setContacts((data || []) as Contact[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchSearch =
        !keyword ||
        [
          contact.name,
          contact.title,
          contact.phone,
          contact.memo,
          contact.assigned_to,
          contact.consultant,
          contact.intake_route,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchAssigned = !fAssigned || contact.assigned_to === fAssigned;
      const matchProspect = !fProspect || contact.prospect_type === fProspect;
      const matchResult = !fResult || contact.meeting_result === fResult;
      const matchStage =
        !fStage ||
        getStageKey(contact) === fStage ||
        contact.management_stage === fStage;
      return (
        matchSearch &&
        matchAssigned &&
        matchProspect &&
        matchResult &&
        matchStage
      );
    });
  }, [contacts, search, fAssigned, fProspect, fResult, fStage]);

  const byStage = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    STAGES.forEach((stage) => {
      map[stage.key] = [];
    });
    filtered.forEach((contact) => {
      const key = getStageKey(contact);
      if (map[key]) map[key].push(contact);
      else map["리드"].push(contact);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
    return map;
  }, [filtered]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      lead: byStage["리드"]?.length || 0,
      prospecting: byStage["프로스펙팅"]?.length || 0,
      closing: byStage["딜크로징"]?.length || 0,
      reserved: byStage["예약완료"]?.length || 0,
      signed: byStage["계약완료"]?.length || 0,
    }),
    [filtered.length, byStage],
  );

  const activeFilters = [search, fAssigned, fProspect, fResult, fStage].filter(
    Boolean,
  ).length;

  const resetFilters = () => {
    setSearch("");
    setFAssigned("");
    setFProspect("");
    setFResult("");
    setFStage("");
    setMobileStage(STAGES[0].key);
  };

  const handleStageChange = async (contact: Contact, nextStage: string) => {
    const patch: Partial<Contact> = { management_stage: nextStage };

    if (nextStage === "예약완료" || nextStage === "계약완료") {
      patch.meeting_result = nextStage;
      patch.management_stage = nextStage;
    } else if (["리드", "프로스펙팅", "딜크로징"].includes(nextStage)) {
      patch.meeting_result = null;
    }

    const { error } = await supabase
      .from("contacts")
      .update(patch)
      .eq("id", contact.id);

    if (error) {
      alert("관리단계 변경 실패: " + error.message);
      return;
    }

    setContacts((prev) =>
      prev.map((item) =>
        item.id === contact.id ? { ...item, ...patch } : item,
      ),
    );
    setSelectedContact((prev) =>
      prev && prev.id === contact.id ? { ...prev, ...patch } : prev,
    );
  };


  const handleMeetingSave = async (
    contact: Contact,
    meetingDate: string,
    meetingAddress: string,
    meetingText: string,
  ) => {
    const patch: Partial<Contact> = {
      meeting_date: meetingDate,
      meeting_address: meetingAddress || null,
      meeting_date_text: meetingText || null,
    };

    const { error } = await supabase
      .from("contacts")
      .update(patch)
      .eq("id", contact.id);

    if (error) {
      alert("미팅일정 등록 실패: " + error.message);
      return;
    }

    setContacts((prev) =>
      prev.map((item) =>
        item.id === contact.id ? { ...item, ...patch } : item,
      ),
    );
    setSelectedContact((prev) =>
      prev && prev.id === contact.id ? { ...prev, ...patch } : prev,
    );
  };

  const selectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setDetailTab("summary");
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Target size={20} style={{ color: "var(--accent-text)" }} />
            <h1 className="crm-title">영업 파이프라인</h1>
          </div>
          <p className="crm-subtitle mt-1">
            영업 단계별 고객 흐름과 다음 액션을 Cycle-like compact board로
            관리합니다.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={fetchContacts}
            className="btn-premium btn-secondary"
          >
            <RefreshCw size={14} />
            새로고침
          </button>
          <a href="/contacts" className="btn-premium btn-primary">
            <User size={14} />
            고객DB
          </a>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard
            label="전체가망"
            value={stats.total}
            icon={Target}
            tone="info"
          />
          <StatCard
            label="신규리드"
            value={stats.lead}
            icon={Flame}
            tone="danger"
          />
          <StatCard
            label="프로스펙팅"
            value={stats.prospecting}
            icon={Search}
            tone="warning"
          />
          <StatCard
            label="클로징"
            value={stats.closing}
            icon={Zap}
            tone="success"
          />
          <StatCard
            label="예약완료"
            value={stats.reserved}
            icon={Clock}
            tone="purple"
          />
          <StatCard
            label="계약완료"
            value={stats.signed}
            icon={UserCheck}
            tone="success"
          />
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
            placeholder="고객명, 직급, 연락처, 메모 검색..."
            className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none"
          />
        </div>
        <SelectChip
          value={fAssigned}
          onChange={setFAssigned}
          options={TEAM}
          placeholder="담당자"
        />
        <SelectChip
          value={fStage}
          onChange={setFStage}
          options={STAGES.map((stage) => stage.key)}
          placeholder="단계"
        />
        <SelectChip
          value={fProspect}
          onChange={setFProspect}
          options={PROSPECTS}
          placeholder="가망"
        />
        <SelectChip
          value={fResult}
          onChange={setFResult}
          options={RESULTS}
          placeholder="결과"
        />
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="btn-premium btn-danger h-8"
          >
            초기화
          </button>
        )}
        <span
          className="ml-auto hidden text-[12px] font-bold md:block"
          style={{ color: "var(--text-faint)" }}
        >
          {filtered.length.toLocaleString()}명
        </span>
      </div>

      <div className="flex gap-0.5 overflow-x-auto px-5 xl:hidden">
        {STAGES.map((stage) => {
          const active = mobileStage === stage.key;
          const count = byStage[stage.key]?.length || 0;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setMobileStage(stage.key)}
              className="whitespace-nowrap border-b-2 px-3 py-3 text-[12px] font-bold"
              style={{
                color: active ? "var(--text)" : "var(--text-subtle)",
                borderBottomColor: active ? "var(--accent)" : "transparent",
              }}
            >
              {stage.label}
              <span
                className="ml-1.5"
                style={{
                  color: active ? "var(--accent-text)" : "var(--text-faint)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
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
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="premium-card p-8">
              <EmptyState
                icon="🔄"
                title="표시할 고객이 없습니다"
                description="검색어나 필터 조건을 변경해보세요"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="hidden h-full overflow-x-auto overflow-y-hidden xl:block">
              <div
                className="grid h-full min-h-[650px] gap-3"
                style={{
                  gridTemplateColumns: "repeat(6, minmax(292px, 1fr))",
                  minWidth: "1870px",
                }}
              >
                {STAGES.map((stage) => {
                  const c = toneStyle(stage.tone);
                  const list = byStage[stage.key] || [];
                  const Icon = stage.icon;
                  return (
                    <section
                      key={stage.key}
                      className="flex min-w-0 flex-col overflow-hidden rounded-[18px]"
                      style={{
                        background: "var(--surface)",
                        border: `1px solid ${c.border}`,
                        boxShadow: "var(--shadow-xs)",
                      }}
                    >
                      <div
                        className="flex flex-shrink-0 items-start justify-between gap-3 px-4 py-4"
                        style={{ borderBottom: `1px solid ${c.border}` }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <PremiumIcon
                            icon={Icon}
                            tone={stage.tone}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <h2
                              className="truncate text-[14px] font-[750] tracking-[-0.03em]"
                              style={{ color: c.color }}
                            >
                              {stage.label}
                            </h2>
                            <p className="crm-tiny mt-0.5 truncate">
                              {stage.desc}
                            </p>
                          </div>
                        </div>
                        <span
                          className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-[760]"
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            color: c.color,
                          }}
                        >
                          {list.length}
                        </span>
                      </div>

                      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                        {list.length === 0 ? (
                          <div
                            className="flex h-28 items-center justify-center rounded-[12px] text-[12px] font-bold"
                            style={{
                              background: "var(--surface-2)",
                              color: "var(--text-faint)",
                              border: "1px dashed var(--border)",
                            }}
                          >
                            고객 없음
                          </div>
                        ) : (
                          list.map((contact) => (
                            <PipelineCard
                              key={contact.id}
                              contact={contact}
                              selected={selectedContact?.id === contact.id}
                              onClick={() => selectContact(contact)}
                            />
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            <div className="h-full overflow-y-auto xl:hidden">
              <div className="space-y-3">
                {(byStage[mobileStage] || []).length === 0 ? (
                  <div
                    className="flex h-40 items-center justify-center rounded-[14px] text-[12px] font-bold"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-faint)",
                    }}
                  >
                    이 단계에 고객이 없습니다.
                  </div>
                ) : (
                  (byStage[mobileStage] || []).map((contact) => (
                    <PipelineCard
                      key={contact.id}
                      contact={contact}
                      selected={selectedContact?.id === contact.id}
                      onClick={() => selectContact(contact)}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {selectedContact && (
        <DetailSlidePanel
          contact={selectedContact}
          tab={detailTab}
          onTab={setDetailTab}
          onClose={() => setSelectedContact(null)}
          onStageChange={handleStageChange}
          onMeetingSave={handleMeetingSave}
        />
      )}
    </div>
  );
}
