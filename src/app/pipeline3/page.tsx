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

type DetailTab = "summary" | "notes" | "ads";

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
  return (
    <button
      type="button"
      onClick={onClick}
      className="premium-card premium-card-hover group w-full p-3 text-left"
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
          <p className="crm-row-main truncate">
            {contact.name}
            {contact.title && (
              <span
                className="ml-1.5 text-[12px] font-[760]"
                style={{ color: "var(--text-subtle)" }}
              >
                · {contact.title}
              </span>
            )}
          </p>
          {contact.phone && (
            <div
              className="mt-2 flex items-center gap-2 text-[12px] font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              <Phone size={13} style={{ color: "var(--text-faint)" }} />
              {contact.phone}
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-3 flex items-center justify-between gap-2 pt-3"
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

function SampleNotesPanel({ contact }: { contact: Contact }) {
  return (
    <section className="premium-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <PremiumIcon icon={MessageSquare} tone="purple" />
        <div>
          <p className="crm-section-title">Activity notes</p>
          <p className="crm-tiny">샘플 활동노트 · 실제 DB 저장 없음</p>
        </div>
      </div>
      <div
        className="rounded-[14px] p-5 text-[14px] font-medium leading-[1.75]"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-muted)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {contact.memo || "등록된 활동노트가 없습니다."}
      </div>
    </section>
  );
}

function NextActionPanel({ contact }: { contact: Contact }) {
  const stage = getStageKey(contact);
  return (
    <section className="premium-card p-5 xl:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <PremiumIcon icon={Target} tone="success" />
        <div>
          <p className="crm-section-title">Next Action</p>
          <p className="crm-tiny">현재 단계 기준 다음 실행 흐름</p>
        </div>
      </div>
      <div
        className="rounded-[14px] p-5 text-[14px] font-medium leading-[1.75]"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-muted)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <p className="font-bold" style={{ color: "var(--text-strong)" }}>
          {stage} 단계 후속 액션
        </p>
        <p className="mt-2">{getNextActionMessage(contact)}</p>
        {hasMeetingInfo(contact) && (
          <p className="mt-3">
            미팅 일정: <b>{meetingDisplay(contact)}</b>
            {contact.meeting_address ? ` · ${contact.meeting_address}` : ""}
          </p>
        )}
      </div>
    </section>
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
                <div className="flex min-w-0 items-end gap-2">
                  <h2
                    className="truncate text-[30px] font-[780] tracking-[-0.035em]"
                    style={{ color: "var(--text-strong)" }}
                  >
                    {contact.name}
                  </h2>
                  {contact.title && (
                    <span
                      className="pb-1 text-[17px] font-[760]"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {contact.title}
                    </span>
                  )}
                </div>
                <p
                  className="mt-1.5 text-[14px] font-semibold"
                  style={{ color: "var(--text-subtle)" }}
                >
                  ID {contact.id} · {contact.phone || "연락처 없음"}
                </p>
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
              { key: "notes", label: "Notes" },
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
                <Field label="직급">{contact.title || "-"}</Field>
                <Field label="유입경로">
                  <Badge tone="muted">{contact.intake_route || "-"}</Badge>
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
                    <p className="crm-tiny">현재 관리 단계</p>
                  </div>
                </div>
                <Field label="관리단계">
                  <Badge tone={stageTone(stage)}>{stage}</Badge>
                </Field>
                <Field label="등록일">{formatShortDate(contact.created_at)}</Field>
              </section>

              <section className="premium-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <PremiumIcon icon={MessageSquare} tone="cyan" />
                  <div>
                    <p className="crm-section-title">Memo</p>
                    <p className="crm-tiny">상담 내용과 흐름</p>
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

              <NextActionPanel contact={contact} />
            </div>
          )}

          {tab === "notes" && <SampleNotesPanel contact={contact} />}

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
                className="flex min-h-[280px] items-center justify-center rounded-[14px] text-[13px] font-bold"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-faint)",
                  border: "1px dashed var(--border)",
                }}
              >
                광고 요청 및 운영 히스토리는 후속 단계에서 연결합니다.
              </div>
            </section>
          )}
        </div>

        <div className="slide-panel-footer" style={{ padding: "clamp(16px, 1.6vw, 22px) clamp(20px, 2vw, 28px)" }}>
          <div className="grid w-full gap-2 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setMeetingOpen(true)}
              className="btn-premium btn-secondary justify-center"
            >
              <MessageSquare size={14} />
              Notes
            </button>
            <button
              type="button"
              onClick={() => onTab("ads")}
              className="btn-premium btn-secondary justify-center"
            >
              <Plus size={14} />
              광고요청
            </button>
            {showMeetingAction && (
              <button
                type="button"
                onClick={() => setMeetingOpen(true)}
                className="btn-premium btn-primary justify-center"
              >
                <CalendarDays size={14} />
                미팅일정
              </button>
            )}
          </div>
        </div>
      </aside>

      {meetingOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,23,42,.45)" }}
            onClick={() => setMeetingOpen(false)}
          />
          <div className="premium-card relative w-full max-w-[460px] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="crm-section-title">미팅 일정 메모</p>
                <p className="crm-tiny">샘플 화면에서는 브라우저 상태에만 반영됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setMeetingOpen(false)}
                className="btn-premium btn-secondary h-8 w-8 p-0"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="crm-meta mb-1.5 block">미팅일</span>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </label>
              <label className="block">
                <span className="crm-meta mb-1.5 block">주소</span>
                <input
                  value={meetingAddress}
                  onChange={(e) => setMeetingAddress(e.target.value)}
                  placeholder="미팅 장소"
                  className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </label>
              <label className="block">
                <span className="crm-meta mb-1.5 block">메모</span>
                <textarea
                  value={meetingText}
                  onChange={(e) => setMeetingText(e.target.value)}
                  rows={3}
                  placeholder="미팅 관련 메모"
                  className="w-full resize-none rounded-[10px] border px-3 py-2 text-[13px] font-semibold outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </label>
              <button
                type="button"
                onClick={handleMeetingSubmit}
                disabled={meetingSaving}
                className="btn-premium btn-primary w-full justify-center"
              >
                {meetingSaving ? "저장 중..." : "일정 메모 반영"}
              </button>
            </div>
          </div>
        </div>
      )}

      {retentionOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,23,42,.45)" }}
            onClick={() => setRetentionOpen(false)}
          />
          <div className="premium-card relative w-full max-w-[360px] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="crm-section-title">계약/예약 전환</p>
                <p className="crm-tiny">샘플 화면에서는 브라우저 상태에만 반영됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setRetentionOpen(false)}
                className="btn-premium btn-secondary h-8 w-8 p-0"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => handleRetentionSelect("예약완료")}
                className="btn-premium btn-secondary justify-center"
              >
                예약완료
              </button>
              <button
                type="button"
                onClick={() => handleRetentionSelect("계약완료")}
                className="btn-premium btn-primary justify-center"
              >
                계약완료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const SAMPLE_CONTACTS: Contact[] = [
  {
    id: 12488,
    name: "조효숙",
    title: "팀장",
    phone: "010-2455-1709",
    customer_type: null,
    tm_sensitivity: null,
    prospect_type: "리드",
    meeting_date: null,
    meeting_date_text: null,
    meeting_address: null,
    meeting_result: null,
    management_stage: "리드",
    assigned_to: null,
    consultant: null,
    memo: "초기 유입 고객입니다. 상세한 상담 내용은 카드가 아닌 상세 패널에서 관리합니다.",
    contract_date: null,
    reservation_date: null,
    intake_route: "컨설턴트 고객DB",
    created_at: new Date().toISOString(),
  },
  {
    id: 12835,
    name: "주해랑",
    title: "팀장",
    phone: "010-3520-3365",
    customer_type: null,
    tm_sensitivity: null,
    prospect_type: "프로스펙팅",
    meeting_date: null,
    meeting_date_text: "3일 전",
    meeting_address: null,
    meeting_result: null,
    management_stage: "프로스펙팅",
    assigned_to: null,
    consultant: null,
    memo: "크롤링 주소 데이터와 CRM 활용 방안에 관심이 높습니다.",
    contract_date: null,
    reservation_date: null,
    intake_route: "컨설턴트 VIP DB",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: 12836,
    name: "박종필",
    title: "본부장",
    phone: "010-3349-6953",
    customer_type: null,
    tm_sensitivity: null,
    prospect_type: "딜크로징",
    meeting_date: TODAY,
    meeting_date_text: "이미지 현장 검토",
    meeting_address: "서울 서초구",
    meeting_result: null,
    management_stage: "딜크로징",
    assigned_to: null,
    consultant: null,
    memo: "분양광고 제안 검토 단계입니다. 계약 전환 가능성이 있습니다.",
    contract_date: null,
    reservation_date: null,
    intake_route: "컨설턴트 VIP DB",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
  {
    id: 12837,
    name: "고태경",
    title: "본부장",
    phone: "010-7641-0924",
    customer_type: null,
    tm_sensitivity: null,
    prospect_type: "예약완료",
    meeting_date: null,
    meeting_date_text: null,
    meeting_address: null,
    meeting_result: null,
    management_stage: "예약완료",
    assigned_to: null,
    consultant: null,
    memo: "예약 완료 고객입니다. 계약 전환 확인이 필요합니다.",
    contract_date: null,
    reservation_date: TODAY,
    intake_route: "컨설턴트 VIP DB",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
  {
    id: 12838,
    name: "윤선예",
    title: "본부장",
    phone: "010-4151-0857",
    customer_type: null,
    tm_sensitivity: null,
    prospect_type: "계약완료",
    meeting_date: null,
    meeting_date_text: null,
    meeting_address: null,
    meeting_result: "계약완료",
    management_stage: "계약완료",
    assigned_to: null,
    consultant: null,
    memo: "계약 완료 고객입니다. 계약관리 메뉴 이관 대상입니다.",
    contract_date: TODAY,
    reservation_date: null,
    intake_route: "컨설턴트 VIP DB",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
  },
  {
    id: 12839,
    name: "허가람",
    title: "이사",
    phone: "010-8272-8040",
    customer_type: null,
    tm_sensitivity: null,
    prospect_type: "보류",
    meeting_date: null,
    meeting_date_text: null,
    meeting_address: null,
    meeting_result: null,
    management_stage: "보류",
    assigned_to: null,
    consultant: null,
    memo: "재접점 필요 고객입니다.",
    contract_date: null,
    reservation_date: null,
    intake_route: "컨설턴트 고객DB",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
];


export default function Pipeline3Page() {
  const [contacts, setContacts] = useState<Contact[]>(SAMPLE_CONTACTS);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [search, setSearch] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fStage, setFStage] = useState("");
  const [fProspect, setFProspect] = useState("");
  const [fResult, setFResult] = useState("");
  const [mobileStage, setMobileStage] = useState(STAGES[0].key);

  const fetchContacts = useCallback(() => {
    setContacts(SAMPLE_CONTACTS);
    setSelectedContact(null);
    setDetailTab("summary");
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const values = [
        contact.name,
        contact.title,
        contact.phone,
        contact.memo,
        contact.intake_route,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchSearch = !keyword || values.includes(keyword);
      const matchAssigned = !fAssigned || contact.assigned_to === fAssigned;
      const matchStage = !fStage || getStageKey(contact) === fStage;
      const matchProspect = !fProspect || contact.prospect_type === fProspect;
      const matchResult = !fResult || contact.meeting_result === fResult;
      return matchSearch && matchAssigned && matchStage && matchProspect && matchResult;
    });
  }, [contacts, fAssigned, fProspect, fResult, fStage, search]);

  const byStage = useMemo(() => {
    const result: Record<string, Contact[]> = {};
    STAGES.forEach((stage) => {
      result[stage.key] = [];
    });
    filtered.forEach((contact) => {
      const stage = getStageKey(contact);
      if (!result[stage]) result[stage] = [];
      result[stage].push(contact);
    });
    return result;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: contacts.length,
    lead: contacts.filter((c) => getStageKey(c) === "리드").length,
    prospecting: contacts.filter((c) => getStageKey(c) === "프로스펙팅").length,
    closing: contacts.filter((c) => getStageKey(c) === "딜크로징").length,
    reserved: contacts.filter((c) => getStageKey(c) === "예약완료").length,
    signed: contacts.filter((c) => getStageKey(c) === "계약완료").length,
  }), [contacts]);

  const activeFilters = [fAssigned, fStage, fProspect, fResult].filter(Boolean).length + (search ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setFAssigned("");
    setFStage("");
    setFProspect("");
    setFResult("");
  };

  const syncSelected = (updated: Contact) => {
    setSelectedContact((prev) => (prev?.id === updated.id ? updated : prev));
  };

  const handleStageChange = async (contact: Contact, stage: string) => {
    const updated: Contact = {
      ...contact,
      management_stage: stage,
      prospect_type: stage,
      meeting_result: stage === "계약완료" ? "계약완료" : contact.meeting_result,
      reservation_date: stage === "예약완료" ? TODAY : contact.reservation_date,
      contract_date: stage === "계약완료" ? TODAY : contact.contract_date,
    };
    setContacts((prev) => prev.map((item) => (item.id === contact.id ? updated : item)));
    syncSelected(updated);
  };

  const handleMeetingSave = async (
    contact: Contact,
    meetingDate: string,
    meetingAddress: string,
    meetingText: string,
  ) => {
    const updated: Contact = {
      ...contact,
      meeting_date: meetingDate,
      meeting_address: meetingAddress || null,
      meeting_date_text: meetingText || null,
    };
    setContacts((prev) => prev.map((item) => (item.id === contact.id ? updated : item)));
    syncSelected(updated);
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
            <h1 className="crm-title">파이프라인3</h1>
          </div>
          <p className="crm-subtitle mt-1">
            기존 영업 파이프라인 화면을 유지한 샘플 보드입니다. 실제 DB 저장은 후속 단계에서 연결합니다.
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
        {filtered.length === 0 ? (
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
