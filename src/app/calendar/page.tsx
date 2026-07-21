"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronDown,
  Clock, MapPin, Phone, Plus, RefreshCw, Search, Target, Trash2, Truck, X,
} from "lucide-react";

/* ── 타입 ── */
type Contact = {
  id: number; name: string; title: string | null; phone: string | null;
  customer_type: string | null; tm_sensitivity: string | null; prospect_type: string | null;
  meeting_date: string | null; meeting_date_text: string | null; meeting_address: string | null;
  meeting_result: string | null; management_stage: string | null; assigned_to: string | null;
  sourcing_owner: string | null; closing_owner: string | null;
  consultant: string | null; memo: string | null; intake_route: string | null; created_at: string;
};
type ApprovalRequestRow = {
  id: number; request_type: string | null; requester_name: string | null;
  requester_title: string | null; status: string | null;
  payload: Record<string, any> | null; final_approved_at: string | null; created_at: string;
};
type CustomEvent = {
  id: number; title: string; category: string; detail: string;
  date_start: string; date_end: string | null; created_by: string | null; created_at: string;
};
type WanpanTruck = {
  id: number; dispatch_date: string | null; staff_members: string | null;
  assigned_to: string | null; site_name: string | null;
};
type CalendarEvent = {
  id: number; date: string; title: string; subtitle: string;
  kind: "meeting" | "leave" | "custom" | "wanpan";
  contact?: Contact; leaveType?: string; dateEnd?: string; category?: string;
  raw?: any;
};

/* ── 상수 ── */
const TEAM = ["조계현", "이세호", "기여운", "최연전", "김정후", "김창완", "최웅"];
const CATEGORIES = ["미팅", "외근", "프로젝트", "기타"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TODAY = new Date().toISOString().slice(0, 10);

/* ── 유틸 ── */
function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function monthStart(date: Date) { return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1)); }
function monthEnd(date: Date) { return toDateKey(new Date(date.getFullYear(), date.getMonth()+1, 0)); }
function formatMonth(date: Date) { return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" }); }
function formatFullDate(value?: string | null) {
  if (!value) return "-";
  try { return new Date(`${value.slice(0,10)}T00:00:00`).toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", weekday:"short" }); }
  catch { return value; }
}
function formatShortDate(value?: string | null) {
  if (!value) return "-";
  try { return new Date(`${value.slice(0,10)}T00:00:00`).toLocaleDateString("ko-KR", { month:"2-digit", day:"2-digit" }); }
  catch { return value; }
}
function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth()+1, 0);
  const days: { date: string; day: number; currentMonth: boolean }[] = [];
  for (let i = 0; i < first.getDay(); i++) {
    const d = new Date(first); d.setDate(d.getDate() - (first.getDay()-i));
    days.push({ date: toDateKey(d), day: d.getDate(), currentMonth: false });
  }
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({ date: toDateKey(new Date(month.getFullYear(), month.getMonth(), i)), day: i, currentMonth: true });
  }
  while (days.length < 42) {
    const d = new Date(last); d.setDate(d.getDate() + (days.length - last.getDate() - first.getDay() + 1));
    days.push({ date: toDateKey(d), day: d.getDate(), currentMonth: false });
  }
  return days;
}
function parseMembers(v: string | null): string[] {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return v.split(",").map(s=>s.trim()).filter(Boolean); }
}

/* ── 이벤트 색상 ── */
function eventStyle(kind: string, category?: string) {
  if (kind === "leave") return { bg:"var(--cyan-bg)", border:"var(--cyan-border)", color:"var(--cyan-text)" };
  if (kind === "wanpan") return { bg:"var(--purple-bg)", border:"var(--purple-border)", color:"var(--purple-text)" };
  if (kind === "custom") {
    if (category === "미팅") return { bg:"var(--info-bg)", border:"var(--info-border)", color:"var(--info-text)" };
    if (category === "외근") return { bg:"var(--warning-bg)", border:"var(--warning-border)", color:"var(--warning-text)" };
    if (category === "프로젝트") return { bg:"var(--success-bg)", border:"var(--success-border)", color:"var(--success-text)" };
    return { bg:"var(--surface-3)", border:"var(--border)", color:"var(--text-subtle)" };
  }
  return { bg:"var(--accent-subtle)", border:"var(--accent-border)", color:"var(--accent-text)" };
}

function toneStyle(tone: string) {
  const map: Record<string, {bg:string;color:string;border:string;dot:string}> = {
    success:{bg:"var(--success-bg)",color:"var(--success-text)",border:"var(--success-border)",dot:"var(--success)"},
    info:{bg:"var(--info-bg)",color:"var(--info-text)",border:"var(--info-border)",dot:"var(--info)"},
    cyan:{bg:"var(--cyan-bg)",color:"var(--cyan-text)",border:"var(--cyan-border)",dot:"var(--cyan)"},
    warning:{bg:"var(--warning-bg)",color:"var(--warning-text)",border:"var(--warning-border)",dot:"var(--warning)"},
    danger:{bg:"var(--danger-bg)",color:"var(--danger-text)",border:"var(--danger-border)",dot:"var(--danger)"},
    purple:{bg:"var(--purple-bg)",color:"var(--purple-text)",border:"var(--purple-border)",dot:"var(--purple)"},
    muted:{bg:"var(--surface-3)",color:"var(--text-subtle)",border:"var(--border)",dot:"var(--text-faint)"},
  };
  return map[tone] || map.muted;
}

/* ── UI 컴포넌트 ── */
function Badge({ children, tone="muted" }: { children: ReactNode; tone?: string }) {
  const c = toneStyle(tone);
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-[760]" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>{children}</span>;
}
function StatCard({ label, value, icon: Icon, tone }: { label:string; value:number; icon:ElementType; tone:string }) {
  const c = toneStyle(tone);
  return (
    <div className="premium-card flex h-[82px] items-center gap-4 px-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]" style={{background:c.bg,border:`1px solid ${c.border}`}}>
        <Icon size={18} style={{color:c.color}} />
      </div>
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p className="mt-1 text-[22px] font-[760] leading-none tracking-[-0.05em]" style={{color:"var(--text-strong)"}}>{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
function SelectChip({ value, onChange, options, placeholder }: { value:string; onChange:(v:string)=>void; options:string[]; placeholder:string }) {
  return (
    <div className="relative">
      <select value={value} onChange={e=>onChange(e.target.value)} className="h-9 appearance-none rounded-full border pl-4 pr-8 text-[12px] font-[720] outline-none" style={{background:"var(--surface-2)",borderColor:value?"var(--accent-border)":"var(--border)",color:value?"var(--accent-text)":"var(--text-muted)"}}>
        <option value="">{placeholder}</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{color:"var(--text-faint)"}} />
    </div>
  );
}

/* ── 이벤트 카드 ── */
function EventCard({
  event,
  selected,
  onClick,
  canDelete = false,
  onDelete,
}: {
  event: CalendarEvent;
  selected?: boolean;
  onClick: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const s = eventStyle(event.kind, event.category);
  const isLeave = event.kind === "leave";
  const isWanpan = event.kind === "wanpan";
  const isCustom = event.kind === "custom";
  const contact = event.contact;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="premium-card premium-card-hover w-full cursor-pointer p-4 text-left outline-none"
      style={selected ? { outline:"2px solid var(--accent)", outlineOffset:2 } : {}}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{background:s.color}} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge tone={isLeave?"cyan":isWanpan?"purple":isCustom?"info":"info"}>
              {isLeave ? event.leaveType : isWanpan ? "완판트럭" : isCustom ? (event.category||"기타") : "미팅"}
            </Badge>
          </div>
          <p className="text-[14px] font-[760] leading-snug" style={{color:"var(--text-strong)"}}>{event.title}</p>
          {event.subtitle && <p className="mt-1 text-[12px] font-semibold" style={{color:"var(--text-subtle)"}}>{event.subtitle}</p>}
          {contact?.phone && (
            <div className="mt-2 flex items-center gap-1">
              <Phone size={11} style={{color:"var(--text-faint)"}} />
              <span className="text-[11px]" style={{color:"var(--text-faint)"}}>{contact.phone}</span>
            </div>
          )}
          {(contact?.meeting_address || isWanpan) && (
            <div className="mt-1 flex items-center gap-1">
              <MapPin size={11} style={{color:"var(--text-faint)"}} />
              <span className="text-[11px]" style={{color:"var(--text-faint)"}}>{contact?.meeting_address || event.subtitle}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-[11px] font-semibold" style={{color:"var(--text-faint)"}}>{formatShortDate(event.date)}</span>
          {canDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-[760] transition hover:brightness-110"
              style={{background:"var(--danger-bg)", borderColor:"var(--danger-border)", color:"var(--danger-text)"}}
              title="내가 등록한 일정 삭제"
            >
              <Trash2 size={12} />
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 일정등록 팝업 ── */
function AddEventModal({ onClose, onSaved, defaultDate, currentUser }: { onClose:()=>void; onSaved:()=>void; defaultDate:string; currentUser:string }) {
  const [category, setCategory] = useState("미팅");
  const [detail, setDetail] = useState("");
  const [dateStart, setDateStart] = useState(defaultDate);
  const [dateEnd, setDateEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const isProject = category === "프로젝트";
  const title = `${category}_${currentUser || "팀"}${detail ? ` ${detail}` : ""}`;

  const handleSave = async () => {
    if (!dateStart) { alert("날짜를 선택해주세요."); return; }
    if (isProject && !dateEnd) { alert("프로젝트 종료일을 선택해주세요."); return; }
    setSaving(true);
    const { error } = await supabase.from("calendar_custom_events").insert({
      title,
      category,
      detail: detail.trim(),
      date_start: dateStart,
      date_end: isProject ? dateEnd : null,
      created_by: currentUser,
    });
    setSaving(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div className="premium-card w-full max-w-[480px] overflow-hidden rounded-[20px]">
        <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:"1px solid var(--border-subtle)"}}>
          <div>
            <p className="crm-title">일정 등록</p>
            <p className="crm-subtitle mt-0.5">팀 공용 운영캘린더에 일정을 추가합니다</p>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16}/></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="crm-tiny">대주제</span>
              <div className="relative">
                <select value={category} onChange={e=>setCategory(e.target.value)} className="h-10 w-full appearance-none rounded-[10px] border pl-3 pr-8 text-[13px] font-semibold outline-none" style={{background:"var(--surface)",borderColor:"var(--border-subtle)",color:"var(--text-strong)"}}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{color:"var(--text-faint)"}}/>
              </div>
            </label>
            <label className="block space-y-1.5">
              <span className="crm-tiny">세부일정</span>
              <input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="예: 베스플러스 미팅" className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none" style={{background:"var(--surface)",borderColor:"var(--border-subtle)",color:"var(--text-strong)"}}/>
            </label>
          </div>
          <div className="rounded-[12px] border p-3 text-[12px] font-semibold" style={{background:"var(--surface-2)",borderColor:"var(--border-subtle)",color:"var(--text-subtle)"}}>
            📋 캘린더 표시: <span style={{color:"var(--accent-text)"}}>{title}</span>
          </div>
          {isProject ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="crm-tiny">프로젝트 시작일</span>
                <input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)} className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none" style={{background:"var(--surface)",borderColor:"var(--border-subtle)",color:"var(--text-strong)"}}/>
              </label>
              <label className="block space-y-1.5">
                <span className="crm-tiny">프로젝트 종료일</span>
                <input type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} min={dateStart} className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none" style={{background:"var(--surface)",borderColor:"var(--border-subtle)",color:"var(--text-strong)"}}/>
              </label>
            </div>
          ) : (
            <label className="block space-y-1.5">
              <span className="crm-tiny">날짜</span>
              <input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)} className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none" style={{background:"var(--surface)",borderColor:"var(--border-subtle)",color:"var(--text-strong)"}}/>
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-10 flex-1">취소</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary h-10 flex-1">{saving?"저장 중...":"일정 저장"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function CalendarPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<ApprovalRequestRow[]>([]);
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [wanpanTrucks, setWanpanTrucks] = useState<WanpanTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [search, setSearch] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    let execName = "";
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUser(u.name || "");
        if (u.role === "exec") execName = u.name;
      }
    } catch {}

    const start = monthStart(currentMonth);
    const end = monthEnd(currentMonth);

    let q = supabase
      .from("contacts")
      .select("id,name,title,phone,customer_type,tm_sensitivity,prospect_type,meeting_date,meeting_date_text,meeting_address,meeting_result,management_stage,assigned_to,sourcing_owner,closing_owner,consultant,memo,intake_route,created_at")
      .not("meeting_date", "is", null)
      .gte("meeting_date", start)
      .lte("meeting_date", end)
      .order("meeting_date", { ascending: true })
      .limit(1000);
    if (execName) q = q.eq("assigned_to", execName) as typeof q;

    const [contactsRes, leaveRes, wanpanRes, customRes] = await Promise.all([
      q,
      supabase.from("approval_requests")
        .select("id,request_type,requester_name,requester_title,status,payload,final_approved_at,created_at")
        .in("request_type", ["연차","반차"]).eq("status","완료")
        .order("created_at", { ascending: false }).limit(1000),
      supabase.from("wanpan_trucks")
        .select("id,dispatch_date,staff_members,assigned_to,site_name")
        .not("dispatch_date","is",null)
        .gte("dispatch_date", start).lte("dispatch_date", end)
        .order("dispatch_date", { ascending: true }).limit(200),
      supabase.from("calendar_custom_events")
        .select("*")
        .or(`date_start.gte.${start},date_end.gte.${start}`)
        .lte("date_start", end)
        .order("date_start", { ascending: true }).limit(500),
    ]);

    setContacts(!contactsRes.error ? (contactsRes.data||[]) as Contact[] : []);
    setLeaveRequests(!leaveRes.error ? (leaveRes.data||[]) as unknown as ApprovalRequestRow[] : []);
    setWanpanTrucks(!wanpanRes.error ? (wanpanRes.data||[]) as WanpanTruck[] : []);
    setCustomEvents(!customRes.error ? (customRes.data||[]) as CustomEvent[] : []);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  useEffect(() => {
    const ch = supabase.channel("calendar-rt")
      .on("postgres_changes", { event:"*", schema:"public", table:"contacts" }, ()=>fetchCalendar())
      .on("postgres_changes", { event:"*", schema:"public", table:"approval_requests" }, ()=>fetchCalendar())
      .on("postgres_changes", { event:"*", schema:"public", table:"wanpan_trucks" }, ()=>fetchCalendar())
      .on("postgres_changes", { event:"*", schema:"public", table:"calendar_custom_events" }, ()=>fetchCalendar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCalendar]);

  const events = useMemo<CalendarEvent[]>(() => {
    const keyword = search.trim().toLowerCase();
    const visibleStart = monthStart(currentMonth);
    const visibleEnd = monthEnd(currentMonth);

    // 1. 미팅 이벤트 (파이프라인 연동): "미팅_조계현"
    const meetingEvents: CalendarEvent[] = contacts
      .filter(c => {
        const matchSearch = !keyword || [c.name,c.title,c.assigned_to,c.sourcing_owner,c.closing_owner,c.meeting_address,c.meeting_date_text].filter(Boolean).join(" ").toLowerCase().includes(keyword);
        const meetingOwner = c.closing_owner || c.assigned_to;
        const matchAssigned = !fAssigned || meetingOwner === fAssigned;
        return matchSearch && matchAssigned;
      })
      .map(c => ({
        id: c.id,
        date: c.meeting_date?.slice(0,10) || TODAY,
        title: `미팅_${c.closing_owner || c.assigned_to || c.name}`,
        subtitle: c.meeting_date_text || c.meeting_address || c.name,
        kind: "meeting" as const,
        contact: c,
        category: "미팅",
      }));

    // 2. 연차/반차: "연차_조계현", "반차_조계현"
    const leaveEvents: CalendarEvent[] = [];
    leaveRequests.forEach(req => {
      const payload = req.payload || {};
      const start = String(payload.leaveStartDate || "").slice(0,10);
      const end = String(payload.leaveEndDate || start).slice(0,10);
      if (!start) return;
      const requester = req.requester_name || String(payload.writer || "신청자");
      const leaveType = req.request_type === "반차" ? "반차" : "연차";
      const halfDay = leaveType === "반차" ? String(payload.halfDayType || "반차") : "종일";
      const matchAssigned = !fAssigned || requester === fAssigned;
      if (!matchAssigned) return;

      const cur = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cur <= last) {
        const dateKey = toDateKey(cur);
        if (dateKey >= visibleStart && dateKey <= visibleEnd) {
          const matchSearch = !keyword || [requester, leaveType].join(" ").toLowerCase().includes(keyword);
          if (matchSearch) {
            leaveEvents.push({
              id: -req.id * 10000 - Number(dateKey.replaceAll("-","")),
              date: dateKey,
              title: `${leaveType}_${requester}`,
              subtitle: halfDay,
              kind: "leave",
              leaveType,
              raw: req,
            });
          }
        }
        cur.setDate(cur.getDate()+1);
      }
    });

    // 3. 완판트럭: "완판트럭_조계현,이세호"
    const wanpanEvents: CalendarEvent[] = wanpanTrucks
      .filter(t => t.dispatch_date)
      .map(t => {
        const members = parseMembers(t.staff_members);
        const memberStr = members.length > 0 ? members.join(",") : (t.assigned_to || "대협팀");
        const matchAssigned = !fAssigned || members.includes(fAssigned) || t.assigned_to === fAssigned;
        const matchSearch = !keyword || [memberStr, t.site_name].filter(Boolean).join(" ").toLowerCase().includes(keyword);
        if (!matchAssigned || !matchSearch) return null;
        return {
          id: 9000000 + t.id,
          date: t.dispatch_date!.slice(0,10),
          title: `완판트럭_${memberStr}`,
          subtitle: t.site_name || "",
          kind: "wanpan" as const,
          raw: t,
        };
      })
      .filter(Boolean) as CalendarEvent[];

    // 4. 커스텀 일정 (일정등록 팝업)
    const customEvts: CalendarEvent[] = [];
    customEvents.forEach(ev => {
      const start = ev.date_start;
      const end = ev.date_end || start;
      const matchSearch = !keyword || [ev.title, ev.detail, ev.created_by].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      const matchAssigned = !fAssigned || ev.created_by === fAssigned;
      if (!matchSearch || !matchAssigned) return;

      const cur = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cur <= last) {
        const dateKey = toDateKey(cur);
        if (dateKey >= visibleStart && dateKey <= visibleEnd) {
          customEvts.push({
            id: 5000000 + ev.id * 1000 + Number(dateKey.replaceAll("-","")) % 1000,
            date: dateKey,
            title: ev.title,
            subtitle: ev.detail,
            kind: "custom",
            category: ev.category,
            dateEnd: ev.date_end || undefined,
            raw: ev,
          });
        }
        cur.setDate(cur.getDate()+1);
      }
    });

    return [...meetingEvents, ...leaveEvents, ...wanpanEvents, ...customEvts];
  }, [contacts, leaveRequests, wanpanTrucks, customEvents, currentMonth, search, fAssigned]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

  const selectedEvents = eventsByDate[selectedDate] || [];
  const todayEvents = eventsByDate[TODAY] || [];
  const stats = useMemo(() => ({
    total: events.length,
    today: todayEvents.length,
    selected: selectedEvents.length,
  }), [events.length, todayEvents.length, selectedEvents.length]);

  const days = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const activeFilters = [search, fAssigned].filter(Boolean).length;
  const resetFilters = () => { setSearch(""); setFAssigned(""); };
  const goPrevMonth = () => { setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth()-1, 1)); setSelectedEvent(null); };
  const goNextMonth = () => { setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth()+1, 1)); setSelectedEvent(null); };
  const goToday = () => { const t = new Date(); setCurrentMonth(t); setSelectedDate(TODAY); setSelectedEvent(null); };

  const canDeleteEvent = useCallback((event: CalendarEvent) => {
    if (!currentUser) return false;

    if (event.kind === "custom") {
      const owner = String(event.raw?.created_by || "");
      return Boolean(event.raw?.id) && owner === currentUser;
    }

    if (event.kind === "meeting") {
      const assignedOwner = String(event.contact?.closing_owner || event.contact?.assigned_to || "");
      const consultantOwner = String(event.contact?.consultant || "");
      return Boolean(event.contact?.id) && (assignedOwner === currentUser || consultantOwner === currentUser);
    }

    return false;
  }, [currentUser]);

  const handleDeleteEvent = useCallback(async (event: CalendarEvent) => {
    if (!currentUser) {
      alert("로그인 사용자 정보를 확인할 수 없습니다.");
      return;
    }

    if (event.kind === "meeting") {
      const contact = event.contact;
      if (!contact?.id) return;

      const assignedOwner = String(contact.closing_owner || contact.assigned_to || "");
      const consultantOwner = String(contact.consultant || "");
      const isOwner = assignedOwner === currentUser || consultantOwner === currentUser;

      if (!isOwner) {
        alert("본인 담당 고객의 미팅일정만 삭제할 수 있습니다.");
        return;
      }

      const message = `파이프라인에서 등록한 미팅일정을 삭제할까요?\n\n고객명: ${contact.name || event.title}\n일자: ${formatFullDate(event.date)}\n내용: ${contact.meeting_date_text || event.subtitle || "파이프라인3 미팅일정"}\n\n삭제하면 파이프라인 고객카드의 미팅일정도 함께 초기화되고, 운영캘린더에서도 사라집니다.`;

      if (!window.confirm(message)) return;

      const { error } = await supabase
        .from("contacts")
        .update({
          meeting_date: null,
          meeting_date_text: null,
          meeting_address: null,
        })
        .eq("id", contact.id);

      if (error) {
        alert(`미팅일정 삭제 실패: ${error.message}`);
        return;
      }

      setSelectedEvent(null);
      await fetchCalendar();
      alert("미팅일정이 삭제되었습니다.");
      return;
    }

    if (event.kind === "custom") {
      if (!event.raw?.id) return;

      const owner = String(event.raw?.created_by || "");
      if (owner !== currentUser) {
        alert("본인이 등록한 일정만 삭제할 수 있습니다.");
        return;
      }

      const isRangeEvent = Boolean(event.raw?.date_end && event.raw.date_end !== event.raw.date_start);
      const periodText = isRangeEvent
        ? `${formatFullDate(event.raw.date_start)} ~ ${formatFullDate(event.raw.date_end)}`
        : formatFullDate(event.raw?.date_start);
      const message = isRangeEvent
        ? `프로젝트 일정 전체 기간을 삭제할까요?\n\n일정명: ${event.raw.title || event.title}\n기간: ${periodText}\n\n삭제하면 해당 기간에 표시된 모든 프로젝트 일정이 함께 사라집니다.`
        : `선택한 일정을 삭제할까요?\n\n일정명: ${event.raw.title || event.title}\n일자: ${periodText}`;

      if (!window.confirm(message)) return;

      const { error } = await supabase
        .from("calendar_custom_events")
        .delete()
        .eq("id", event.raw.id)
        .eq("created_by", currentUser);

      if (error) {
        alert(`삭제 실패: ${error.message}`);
        return;
      }

      setSelectedEvent(null);
      await fetchCalendar();
      alert("일정이 삭제되었습니다.");
    }
  }, [currentUser, fetchCalendar]);

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} style={{color:"var(--accent-text)"}} />
            <h1 className="crm-title">운영캘린더</h1>
          </div>
          <p className="crm-subtitle mt-1">팀 공용 캘린더 — 미팅·연차·완판트럭·팀 일정을 한 곳에서 관리합니다.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button type="button" onClick={() => setShowAddEvent(true)} className="btn-premium btn-primary">
            <Plus size={14} />일정등록
          </button>
          <button type="button" onClick={fetchCalendar} className="btn-premium btn-secondary">
            <RefreshCw size={14} />새로고침
          </button>
          <button type="button" onClick={goToday} className="btn-premium btn-secondary">
            <Clock size={14} />오늘
          </button>
        </div>
      </div>

      {/* 대시보드 — 3개만 */}
      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="stat-grid grid grid-cols-3 gap-3">
          <StatCard label="이번 달 일정" value={stats.total} icon={CalendarDays} tone="info" />
          <StatCard label="오늘 일정" value={stats.today} icon={Clock} tone="cyan" />
          <StatCard label="선택일 일정" value={stats.selected} icon={Target} tone="warning" />
        </div>
      </div>

      {/* 필터바 */}
      <div className="flex-shrink-0 px-5 py-3 md:px-7">
        <div className="premium-card rounded-[22px] p-4">
          <div className="grid gap-3 xl:grid-cols-[auto_minmax(260px,1.4fr)_minmax(140px,0.65fr)_auto]" style={{ justifyContent: "start" }}>

            {/* 월 이동 */}
            <div className="flex flex-col items-start gap-1.5">
              <span className="crm-meta block pl-3 font-normal">월 선택</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={goPrevMonth} className="btn-premium btn-secondary h-12 w-10 p-0">
                  <ArrowLeft size={14}/>
                </button>
                <div
                  className="flex h-12 min-w-[140px] items-center justify-center rounded-[12px] border px-4 text-[13px] font-normal"
                  style={{ background:"var(--surface-2)", borderColor:"var(--border)", color:"var(--text)" }}
                >
                  {formatMonth(currentMonth)}
                </div>
                <button type="button" onClick={goNextMonth} className="btn-premium btn-secondary h-12 w-10 p-0">
                  <ArrowRight size={14}/>
                </button>
              </div>
            </div>

            {/* 검색 */}
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-10 font-normal">일정 검색</span>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="일정, 담당자, 장소 검색..."
                  className="crm-search h-12 w-full pl-10 pr-3 font-normal"
                />
              </div>
            </label>

            {/* 담당자 필터 */}
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">담당자 필터</span>
              <select
                className="crm-search h-12 w-full px-3 font-normal"
                value={fAssigned}
                onChange={(e) => setFAssigned(e.target.value)}
              >
                <option value="">전체 담당자</option>
                {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            {/* 필터 초기화 */}
            <div className="flex flex-col items-start gap-1.5">
              <span
                className="crm-meta block text-[11px] font-normal transition-colors"
                style={{ color: activeFilters > 0 ? "var(--accent-text)" : "transparent", userSelect: "none" }}
              >
                필터 적용중
              </span>
              <button
                type="button"
                className="h-12 whitespace-nowrap rounded-[12px] px-4 text-[13px] font-normal transition-all"
                style={{
                  background: activeFilters > 0 ? "var(--accent-subtle)" : "var(--surface-2)",
                  border: `1px solid ${activeFilters > 0 ? "var(--accent-border)" : "var(--border)"}`,
                  color: activeFilters > 0 ? "var(--accent-text)" : "var(--text-subtle)",
                }}
                onClick={resetFilters}
                disabled={activeFilters === 0}
              >
                <RefreshCw className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
                필터 초기화
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{borderColor:"var(--accent)",borderTopColor:"transparent"}}/>
          </div>
        ) : (
          <div className="grid h-full gap-5 xl:grid-cols-[1fr_400px]">
            {/* 캘린더 그리드 */}
            <section className="premium-card hidden min-h-0 overflow-y-auto xl:block">
              <div className="grid grid-cols-7 border-b sticky top-0 z-20" style={{borderColor:"var(--border-subtle)", background:"var(--surface-2)", boxShadow:"0 2px 8px rgba(0,0,0,0.18)"}}>
                {WEEKDAYS.map(w => (
                  <div key={w} className="flex h-11 items-center justify-center text-[12px] font-bold"
                    style={{color:w==="일"?"var(--danger-text)":w==="토"?"var(--cyan-text)":"var(--text-subtle)",borderRight:"1px solid var(--border-subtle)"}}>
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7" style={{gridAutoRows:"minmax(116px, auto)"}}>
                {days.map(cell => {
                  const dayEvents = eventsByDate[cell.date] || [];
                  const isToday = cell.date === TODAY;
                  const isSelected = cell.date === selectedDate;
                  const visible = dayEvents;
                  return (
                    <button key={cell.date} type="button"
                      onClick={() => { setSelectedDate(cell.date); setSelectedEvent(null); }}
                      className="p-2 text-left transition-all flex flex-col"
                      style={{
                        background: isSelected ? "linear-gradient(180deg,rgba(139,124,246,.18),rgba(139,124,246,.04)),var(--surface-selected)" : cell.currentMonth ? "var(--surface)" : "rgba(148, 163, 184, 0.12)",
                        borderRight:"1px solid var(--border-subtle)",
                        borderBottom:"1px solid var(--border-subtle)",
                      }}>
                      {/* 날짜 왼쪽 상단 고정 + +N 오른쪽 */}
                      <div className="flex items-start justify-between w-full mb-1">
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px]"
                          style={{
                            background: isToday ? "var(--accent)" : isSelected ? "var(--accent-subtle)" : "transparent",
                            color: isToday ? "#fff" : cell.currentMonth ? "var(--text)" : "var(--text-subtle)",
                            fontWeight: isToday ? 700 : 500,
                            border: isSelected&&!isToday ? "1px solid var(--accent-border)" : "1px solid transparent",
                          }}>
                          {cell.day}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[11px]" style={{color:"var(--text-faint)"}}>{dayEvents.length}건</span>
                        )}
                      </div>
                      {/* 이벤트 전부 표시 */}
                      <div className="space-y-0.5 w-full">
                        {visible.map(ev => {
                          const s = eventStyle(ev.kind, ev.category);
                          return (
                            <div key={ev.id} className="truncate rounded-[5px] px-1.5 py-[3px] text-[12px] leading-tight"
                              style={{background:s.bg, border:`1px solid ${s.border}`, color:s.color, fontWeight:500}}>
                              {ev.title}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 선택일 이벤트 패널 */}
            <section className="premium-card flex min-h-0 flex-col overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-3 px-5 py-4" style={{borderBottom:"1px solid var(--border-subtle)"}}>
                <div className="min-w-0">
                  <h2 className="crm-section-title">{formatFullDate(selectedDate)}</h2>
                  <p className="crm-tiny mt-0.5">일정 {selectedEvents.length}건</p>
                </div>
                <Badge tone={selectedDate===TODAY?"cyan":"muted"}>{selectedDate===TODAY?"오늘":formatShortDate(selectedDate)}</Badge>
              </div>
              {/* 모바일 날짜 선택 */}
              <div className="flex gap-1.5 overflow-x-auto px-4 py-3 xl:hidden" style={{borderBottom:"1px solid var(--border-subtle)"}}>
                {days.filter(c=>c.currentMonth).map(cell=>{
                  const isSelected = selectedDate===cell.date;
                  const count = eventsByDate[cell.date]?.length||0;
                  return <button key={cell.date} type="button" onClick={()=>{setSelectedDate(cell.date);setSelectedEvent(null);}} className="flex h-14 min-w-[52px] flex-col items-center justify-center rounded-[12px] border text-[12px] font-bold" style={{background:isSelected?"var(--accent-subtle)":"var(--surface-2)",borderColor:isSelected?"var(--accent-border)":"var(--border)",color:isSelected?"var(--accent-text)":"var(--text-muted)"}}><span>{cell.day}</span><span className="mt-0.5 text-[10px]" style={{color:count?"var(--cyan-text)":"var(--text-faint)"}}>{count?`${count}건`:"-"}</span></button>;
                })}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {selectedEvents.length===0 ? (
                  <EmptyState icon="📅" title="선택한 날짜에 일정이 없습니다" description="다른 날짜를 선택하거나 일정을 등록해보세요" />
                ) : (
                  <div className="space-y-3">
                    {selectedEvents.map(ev=>(
                      <EventCard
                        key={ev.id}
                        event={ev}
                        selected={selectedEvent?.id===ev.id}
                        onClick={()=>setSelectedEvent(ev===selectedEvent?null:ev)}
                        canDelete={canDeleteEvent(ev)}
                        onDelete={()=>handleDeleteEvent(ev)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* 일정등록 모달 */}
      {showAddEvent && (
        <AddEventModal
          onClose={()=>setShowAddEvent(false)}
          onSaved={fetchCalendar}
          defaultDate={selectedDate}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
