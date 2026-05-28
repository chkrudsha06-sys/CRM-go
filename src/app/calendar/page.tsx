"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Target,
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
  assigned_to: string | null;
  consultant: string | null;
  memo: string | null;
  intake_route: string | null;
  created_at: string;
};

type CalendarEvent = {
  id: number;
  date: string;
  title: string;
  subtitle: string;
  contact: Contact;
  kind: "meeting" | "leave";
  leaveType?: "연차" | "반차";
};

type ApprovalRequestRow = {
  id: number;
  request_type: string | null;
  requester_name: string | null;
  requester_title: string | null;
  status: string | null;
  payload: Record<string, any> | null;
  final_approved_at: string | null;
  created_at: string;
};

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const RESULTS = ["계약완료", "예약완료", "서류만수취", "미팅후가망관리", "계약거부", "미팅불발"];
const PROSPECTS = ["즉가입가망", "미팅예정가망", "연계매출가망"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TODAY = new Date().toISOString().slice(0, 10);

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStart(date: Date) {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthEnd(date: Date) {
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

function formatFullDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
  } catch {
    return value;
  }
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#8B7CF6,#60A5FA)",
    "linear-gradient(135deg,#60A5FA,#22D3EE)",
    "linear-gradient(135deg,#34D399,#22D3EE)",
    "linear-gradient(135deg,#FBBF24,#FB7185)",
    "linear-gradient(135deg,#C084FC,#8B7CF6)",
    "linear-gradient(135deg,#60A5FA,#34D399)",
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
  if (value === "연차") return "cyan";
  if (value === "반차") return "warning";
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

function PremiumIcon({ icon: Icon, tone = "info", size = "md" }: { icon: ElementType; tone?: string; size?: "sm" | "md" | "lg" }) {
  const c = toneStyle(tone);
  const cls = size === "lg" ? "h-12 w-12 rounded-[15px]" : size === "sm" ? "h-8 w-8 rounded-[10px]" : "h-10 w-10 rounded-[12px]";
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

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ElementType; tone: string }) {
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 py-3">
      <div className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{label}</div>
      <div className="min-w-0 text-[13px] font-semibold" style={{ color: "var(--text)" }}>{children || <span style={{ color: "var(--text-faint)" }}>-</span>}</div>
    </div>
  );
}

function buildCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = first.getDay();
  const totalDays = last.getDate();
  const cells: Array<{ date: string; day: number; currentMonth: boolean }> = [];
  const prevLast = new Date(year, month, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const date = new Date(year, month - 1, prevLast - i);
    cells.push({ date: toDateKey(date), day: date.getDate(), currentMonth: false });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date: toDateKey(date), day, currentMonth: true });
  }

  while (cells.length < 42) {
    const lastCell = cells[cells.length - 1];
    const next = new Date(`${lastCell.date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    cells.push({ date: toDateKey(next), day: next.getDate(), currentMonth: false });
  }

  return cells;
}

function EventCard({ event, selected, onClick }: { event: CalendarEvent; selected?: boolean; onClick: () => void }) {
  const contact = event.contact;
  const isLeave = event.kind === "leave";
  return (
    <button
      type="button"
      onClick={onClick}
      className="premium-card premium-card-hover group w-full p-4 text-left"
      style={{
        background: selected ? "linear-gradient(90deg, rgba(139,124,246,.16), rgba(139,124,246,.045)), var(--surface-selected)" : undefined,
        borderColor: selected ? "var(--accent-border)" : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="crm-avatar" style={{ background: avatarBg(contact.name) }}>{contact.name?.[0] || "고"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="crm-row-main truncate">{contact.name}</p>
            <Badge tone={resultTone(contact.meeting_result)}>{isLeave ? event.leaveType : contact.meeting_result || "미정"}</Badge>
          </div>
          <p className="crm-row-sub mt-0.5 truncate">{isLeave ? `${event.leaveType} 일정` : contact.title || "-"} · 담당 {contact.assigned_to || "-"}</p>
        </div>
        {!isLeave && (
          <a href="/contacts" onClick={(e) => e.stopPropagation()} className="btn-premium btn-secondary h-8 w-8 flex-shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100" title="고객DB">
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {isLeave ? (
          <>
            <Badge tone={resultTone(event.leaveType)}>{event.leaveType}</Badge>
            <Badge tone="success">최종 승인</Badge>
            <Badge tone="muted">운영캘린더 자동등록</Badge>
          </>
        ) : (
          <>
            <Badge tone={prospectTone(contact.prospect_type)}>{contact.prospect_type || "가망 없음"}</Badge>
            <Badge tone={stageTone(contact.management_stage)}>{contact.management_stage || "단계 없음"}</Badge>
            <Badge tone={sensitivityTone(contact.tm_sensitivity)}>TM {contact.tm_sensitivity || "-"}</Badge>
          </>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {contact.phone && (
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            <Phone size={13} style={{ color: "var(--text-faint)" }} />
            {contact.phone}
          </div>
        )}
        <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--cyan-text)" }}>
          <CalendarDays size={13} />
          {isLeave ? `${event.leaveType} · ${formatFullDate(event.date)}` : formatFullDate(event.date)}
        </div>
        {contact.meeting_address && (
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            <MapPin size={13} style={{ color: "var(--text-faint)" }} />
            <span className="truncate">{contact.meeting_address}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function DetailSlidePanel({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const contact = event.contact;
  const isLeave = event.kind === "leave";
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
                  <Badge tone={resultTone(contact.meeting_result)}>{isLeave ? event.leaveType : contact.meeting_result || "미정"}</Badge>
                </div>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>{isLeave ? "근태 일정" : `ID ${contact.id}`} · {contact.title || "직급 없음"} · 담당 {contact.assigned_to || "-"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={prospectTone(contact.prospect_type)}>{contact.prospect_type || "가망 없음"}</Badge>
                  <Badge tone={stageTone(contact.management_stage)}>{contact.management_stage || "단계 없음"}</Badge>
                  <Badge tone={sensitivityTone(contact.tm_sensitivity)}>TM {contact.tm_sensitivity || "-"}</Badge>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
          </div>
        </div>

        <div className="slide-panel-body">
          <div className="space-y-6">
            <section className="premium-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <PremiumIcon icon={CalendarDays} tone="cyan" />
                <div>
                  <p className="crm-section-title">{isLeave ? "근태 일정" : "미팅 일정"}</p>
                  <p className="crm-tiny">{isLeave ? "최종 승인된 연차·반차 일정" : "선택한 날짜의 고객 미팅 정보"}</p>
                </div>
              </div>
              <Field label={isLeave ? "일정일" : "미팅일"}><span className="inline-flex items-center gap-1.5" style={{ color: "var(--cyan-text)" }}><CalendarDays size={14} />{formatFullDate(event.date)}</span></Field>
              <Field label={isLeave ? "신청유형" : "미팅지역"}><span className="inline-flex items-center gap-1.5"><MapPin size={14} style={{ color: "var(--text-subtle)" }} />{isLeave ? contact.meeting_result || "-" : contact.meeting_address || "-"}</span></Field>
              <Field label={isLeave ? "구분" : "유입경로"}><Badge tone="muted">{isLeave ? contact.meeting_address || "-" : contact.intake_route || "-"}</Badge></Field>
              <Field label={isLeave ? "승인상태" : "컨설턴트"}><Badge tone="purple">{isLeave ? "최종 승인" : contact.consultant || "-"}</Badge></Field>
            </section>

            <section className="premium-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <PremiumIcon icon={Phone} tone="info" />
                <div>
                  <p className="crm-section-title">{isLeave ? "신청자 정보" : "고객 연락 정보"}</p>
                  <p className="crm-tiny">{isLeave ? "연차·반차 신청자 정보" : "미팅 전 확인해야 할 기본 정보"}</p>
                </div>
              </div>
              <Field label={isLeave ? "신청자" : "연락처"}><span className="inline-flex items-center gap-1.5" style={{ color: "var(--accent-text)" }}><Phone size={14} />{isLeave ? contact.name : contact.phone || "-"}</span></Field>
              <Field label={isLeave ? "직급" : "담당자"}><Badge tone="info" icon={User}>{isLeave ? contact.title || "-" : contact.assigned_to || "-"}</Badge></Field>
              <Field label={isLeave ? "캘린더" : "관리단계"}><Badge tone={stageTone(contact.management_stage)}>{isLeave ? "운영캘린더" : contact.management_stage || "-"}</Badge></Field>
              <Field label={isLeave ? "처리" : "가망유형"}><Badge tone={prospectTone(contact.prospect_type)}>{isLeave ? "결재 완료" : contact.prospect_type || "-"}</Badge></Field>
            </section>

            <section className="premium-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <PremiumIcon icon={Target} tone="warning" />
                <div>
                  <p className="crm-section-title">메모</p>
                  <p className="crm-tiny">{isLeave ? "신청 사유" : "미팅 관련 상담 내용과 특이사항"}</p>
                </div>
              </div>
              <div className="min-h-[140px] whitespace-pre-wrap rounded-[12px] p-4 text-[13px] font-medium leading-relaxed" style={{ background: "var(--surface-2)", color: contact.memo ? "var(--text-muted)" : "var(--text-faint)", border: "1px solid var(--border-subtle)" }}>
                {contact.memo || "등록된 메모가 없습니다."}
              </div>
            </section>
          </div>
        </div>

        <div className="slide-panel-footer">
          <div className="grid grid-cols-2 gap-2">
            {isLeave ? (
              <a href="/tasks" className="btn-premium btn-primary"><ExternalLink size={14} />결제&업무요청</a>
            ) : (
              <>
                <a href="/contacts" className="btn-premium btn-primary"><ExternalLink size={14} />고객DB</a>
                <a href="/pipeline" className="btn-premium btn-secondary"><Target size={14} />파이프라인</a>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default function CalendarPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [search, setSearch] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fResult, setFResult] = useState("");
  const [fProspect, setFProspect] = useState("");

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    let execName = "";
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.role === "exec") execName = u.name;
      }
    } catch {}

    const start = monthStart(currentMonth);
    const end = monthEnd(currentMonth);
    let q = supabase
      .from("contacts")
      .select("id,name,title,phone,customer_type,tm_sensitivity,prospect_type,meeting_date,meeting_date_text,meeting_address,meeting_result,management_stage,assigned_to,consultant,memo,intake_route,created_at")
      .not("meeting_date", "is", null)
      .gte("meeting_date", start)
      .lte("meeting_date", end)
      .order("meeting_date", { ascending: true })
      .limit(1000);

    if (execName) q = q.eq("assigned_to", execName);
    const [contactsResult, leaveResult] = await Promise.all([
      q,
      supabase
        .from("approval_requests")
        .select("id,request_type,requester_name,requester_title,status,payload,final_approved_at,created_at")
        .in("request_type", ["연차", "반차"])
        .eq("status", "완료")
        .order("final_approved_at", { ascending: false })
        .limit(1000),
    ]);

    if (contactsResult.error) {
      console.error("캘린더 조회 실패:", contactsResult.error.message);
      setContacts([]);
    } else {
      setContacts((contactsResult.data || []) as Contact[]);
    }

    if (leaveResult.error) {
      console.error("연차/반차 조회 실패:", leaveResult.error.message);
      setLeaveRequests([]);
    } else {
      setLeaveRequests((leaveResult.data || []) as unknown as ApprovalRequestRow[]);
    }
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    const channel = supabase
      .channel("calendar-approval-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        () => fetchCalendar(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_requests" },
        () => fetchCalendar(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCalendar]);

  const events = useMemo<CalendarEvent[]>(() => {
    const keyword = search.trim().toLowerCase();
    const meetingEvents: CalendarEvent[] = contacts
      .filter((contact) => {
        const matchSearch =
          !keyword ||
          [contact.name, contact.title, contact.phone, contact.memo, contact.assigned_to, contact.consultant, contact.meeting_address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchAssigned = !fAssigned || contact.assigned_to === fAssigned;
        const matchResult = !fResult || contact.meeting_result === fResult;
        const matchProspect = !fProspect || contact.prospect_type === fProspect;
        return matchSearch && matchAssigned && matchResult && matchProspect;
      })
      .map((contact) => ({
        id: contact.id,
        date: contact.meeting_date?.slice(0, 10) || TODAY,
        title: contact.name,
        subtitle: contact.meeting_address || contact.title || "",
        contact,
        kind: "meeting" as const,
      }));

    const leaveEvents: CalendarEvent[] = [];
    const visibleStart = monthStart(currentMonth);
    const visibleEnd = monthEnd(currentMonth);

    leaveRequests.forEach((request) => {
      const payload = request.payload || {};
      const start = String(payload.leaveStartDate || "").slice(0, 10);
      const end = String(payload.leaveEndDate || start).slice(0, 10);
      if (!start) return;

      const requester = request.requester_name || String(payload.writer || "신청자");
      const title = request.requester_title || String(payload.writerTitle || "");
      const leaveType = request.request_type === "반차" ? "반차" : "연차";
      const halfDay = leaveType === "반차" ? String(payload.halfDayType || "반차") : "종일";
      const reason = String(payload.leaveReason || "");

      const current = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);

      while (current <= last) {
        const dateKey = toDateKey(current);
        if (dateKey >= visibleStart && dateKey <= visibleEnd) {
          const pseudoContact: Contact = {
            id: -request.id * 10000 - Number(dateKey.replaceAll("-", "")),
            name: requester,
            title,
            phone: null,
            customer_type: null,
            tm_sensitivity: null,
            prospect_type: "결재완료",
            meeting_date: dateKey,
            meeting_date_text: reason,
            meeting_address: halfDay,
            meeting_result: leaveType,
            management_stage: "최종승인",
            assigned_to: requester,
            consultant: "근태",
            memo: reason,
            intake_route: "결제&업무요청",
            created_at: request.final_approved_at || request.created_at,
          };

          const matchSearch =
            !keyword ||
            [requester, title, leaveType, halfDay, reason]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(keyword);
          const matchAssigned = !fAssigned || requester === fAssigned;
          const matchResult = !fResult || leaveType === fResult;
          const matchProspect = !fProspect;

          if (matchSearch && matchAssigned && matchResult && matchProspect) {
            leaveEvents.push({
              id: pseudoContact.id,
              date: dateKey,
              title: `${requester} ${leaveType}`,
              subtitle: halfDay,
              contact: pseudoContact,
              kind: "leave",
              leaveType,
            });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    });

    return [...meetingEvents, ...leaveEvents];
  }, [contacts, leaveRequests, currentMonth, search, fAssigned, fResult, fProspect]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    });
    Object.keys(map).forEach((date) => map[date].sort((a, b) => a.title.localeCompare(b.title)));
    return map;
  }, [events]);

  const selectedEvents = eventsByDate[selectedDate] || [];
  const todayEvents = eventsByDate[TODAY] || [];
  const stats = useMemo(() => ({
    total: events.length,
    today: todayEvents.length,
    selected: selectedEvents.length,
    reservation: events.filter((e) => e.contact.meeting_result === "예약완료").length,
    contract: events.filter((e) => e.contact.meeting_result === "계약완료").length,
  }), [events, selectedEvents.length, todayEvents.length]);

  const days = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const activeFilters = [search, fAssigned, fResult, fProspect].filter(Boolean).length;
  const resetFilters = () => { setSearch(""); setFAssigned(""); setFResult(""); setFProspect(""); };
  const goPrevMonth = () => { setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); setSelectedEvent(null); };
  const goNextMonth = () => { setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); setSelectedEvent(null); };
  const goToday = () => { const today = new Date(); setCurrentMonth(today); setSelectedDate(TODAY); setSelectedEvent(null); };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} style={{ color: "var(--accent-text)" }} />
            <h1 className="crm-title">운영캘린더</h1>
          </div>
          <p className="crm-subtitle mt-1">고객 미팅 일정과 최종 승인된 연차·반차 일정을 월간 캘린더로 확인합니다.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button type="button" onClick={fetchCalendar} className="btn-premium btn-secondary"><RefreshCw size={14} />새로고침</button>
          <button type="button" onClick={goToday} className="btn-premium btn-primary"><Clock size={14} />오늘</button>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="이번 달 일정" value={stats.total} icon={CalendarDays} tone="info" />
          <StatCard label="오늘 일정" value={stats.today} icon={Clock} tone="cyan" />
          <StatCard label="선택일 일정" value={stats.selected} icon={Target} tone="warning" />
          <StatCard label="예약완료" value={stats.reservation} icon={UserCheck} tone="purple" />
          <StatCard label="계약완료" value={stats.contract} icon={Users} tone="success" />
        </div>
      </div>

      <div className="premium-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrevMonth} className="btn-premium btn-secondary h-9 w-9 p-0"><ArrowLeft size={14} /></button>
          <div className="flex h-9 min-w-[180px] items-center justify-center rounded-full border px-4 text-[13px] font-[760]" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}>{formatMonth(currentMonth)}</div>
          <button type="button" onClick={goNextMonth} className="btn-premium btn-secondary h-9 w-9 p-0"><ArrowRight size={14} /></button>
        </div>
        <div className="relative w-full sm:w-[320px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명, 직원명, 지역, 담당자 검색..." className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none" />
        </div>
        <SelectChip value={fAssigned} onChange={setFAssigned} options={TEAM} placeholder="담당자" />
        <SelectChip value={fResult} onChange={setFResult} options={RESULTS} placeholder="미팅결과" />
        <SelectChip value={fProspect} onChange={setFProspect} options={PROSPECTS} placeholder="가망유형" />
        {activeFilters > 0 && <button type="button" onClick={resetFilters} className="btn-premium btn-danger h-8">초기화</button>}
        <span className="ml-auto hidden text-[12px] font-bold md:block" style={{ color: "var(--text-faint)" }}>{events.length.toLocaleString()}건</span>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? (
          <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div>
        ) : (
          <div className="grid h-full gap-5 xl:grid-cols-[1fr_430px]">
            <section className="premium-card hidden min-h-0 overflow-hidden xl:flex xl:flex-col">
              <div className="grid flex-shrink-0 grid-cols-7 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                {WEEKDAYS.map((weekday) => <div key={weekday} className="flex h-11 items-center justify-center text-[12px] font-bold" style={{ color: weekday === "일" ? "var(--danger-text)" : weekday === "토" ? "var(--cyan-text)" : "var(--text-subtle)", borderRight: "1px solid var(--border-subtle)" }}>{weekday}</div>)}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
                {days.map((cell) => {
                  const dayEvents = eventsByDate[cell.date] || [];
                  const isToday = cell.date === TODAY;
                  const isSelected = cell.date === selectedDate;
                  return (
                    <button key={cell.date} type="button" onClick={() => { setSelectedDate(cell.date); setSelectedEvent(null); }} className="min-h-0 p-3 text-left transition-all" style={{ background: isSelected ? "linear-gradient(180deg, rgba(139,124,246,.18), rgba(139,124,246,.04)), var(--surface-selected)" : cell.currentMonth ? "var(--surface)" : "rgba(16,17,20,.48)", borderRight: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-[760]" style={{ background: isToday ? "var(--accent)" : isSelected ? "var(--accent-subtle)" : "transparent", color: isToday ? "#fff" : cell.currentMonth ? "var(--text)" : "var(--text-faint)", border: isSelected && !isToday ? "1px solid var(--accent-border)" : "1px solid transparent" }}>{cell.day}</span>
                        {dayEvents.length > 0 && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--cyan-bg)", border: "1px solid var(--cyan-border)", color: "var(--cyan-text)" }}>{dayEvents.length}</span>}
                      </div>
                      <div className="mt-2 space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 4).map((event) => {
                          const c = toneStyle(resultTone(event.contact.meeting_result));
                          return <div key={event.id} className="truncate rounded-[7px] px-2 py-1 text-[11px] font-bold" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>{event.title}</div>;
                        })}
                        {dayEvents.length > 4 && <div className="px-2 text-[11px] font-bold" style={{ color: "var(--text-faint)" }}>+{dayEvents.length - 4} 더보기</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="premium-card flex min-h-0 flex-col overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="min-w-0"><h2 className="crm-section-title">{formatFullDate(selectedDate)}</h2><p className="crm-tiny mt-0.5">선택한 날짜의 일정 {selectedEvents.length}건</p></div>
                <Badge tone={selectedDate === TODAY ? "cyan" : "muted"}>{selectedDate === TODAY ? "오늘" : formatShortDate(selectedDate)}</Badge>
              </div>
              <div className="flex gap-1.5 overflow-x-auto px-4 py-3 xl:hidden" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {days.filter((cell) => cell.currentMonth).map((cell) => {
                  const isSelected = selectedDate === cell.date;
                  const count = eventsByDate[cell.date]?.length || 0;
                  return <button key={cell.date} type="button" onClick={() => { setSelectedDate(cell.date); setSelectedEvent(null); }} className="flex h-14 min-w-[52px] flex-col items-center justify-center rounded-[12px] border text-[12px] font-bold" style={{ background: isSelected ? "var(--accent-subtle)" : "var(--surface-2)", borderColor: isSelected ? "var(--accent-border)" : "var(--border)", color: isSelected ? "var(--accent-text)" : "var(--text-muted)" }}><span>{cell.day}</span><span className="mt-0.5 text-[10px]" style={{ color: count ? "var(--cyan-text)" : "var(--text-faint)" }}>{count ? `${count}건` : "-"}</span></button>;
                })}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {selectedEvents.length === 0 ? (
                  <EmptyState icon="📅" title="선택한 날짜에 일정이 없습니다" description="다른 날짜를 선택하거나 필터 조건을 변경해보세요" />
                ) : (
                  <div className="space-y-3">
                    {selectedEvents.map((event) => <EventCard key={event.id} event={event} selected={selectedEvent?.id === event.id} onClick={() => setSelectedEvent(event)} />)}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {selectedEvent && <DetailSlidePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
