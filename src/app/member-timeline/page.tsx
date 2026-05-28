"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Megaphone,
  MessageSquareText,
  PackageCheck,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

interface Member {
  id: number;
  name: string;
  title: string | null;
  bunyanghoe_number: string | null;
  assigned_to: string | null;
  contract_date: string | null;
  reservation_date?: string | null;
  meeting_result: string | null;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  detail: string;
  source: string;
  color: string;
  iconLabel: string;
  sourceId?: number;
}

type AddForm = {
  event_type: string;
  event_title: string;
  event_detail: string;
  event_date: string;
};

const EVENT_META: Record<string, { color: string; iconLabel: string; badge: string }> = {
  가입: { color: "#8b5cf6", iconLabel: "🎉", badge: "badge-purple" },
  리소스확보중: { color: "#0ea5e9", iconLabel: "🧩", badge: "badge-info" },
  사진수취: { color: "#ec4899", iconLabel: "📸", badge: "badge-purple" },
  정보수취: { color: "#3b82f6", iconLabel: "📋", badge: "badge-info" },
  TF2전달: { color: "#f59e0b", iconLabel: "📤", badge: "badge-warning" },
  PR완료: { color: "#10b981", iconLabel: "✅", badge: "badge-success" },
  제작불가: { color: "#ef4444", iconLabel: "🚫", badge: "badge-danger" },
  광고집행: { color: "#06b6d4", iconLabel: "📡", badge: "badge-cyan" },
  활동노트: { color: "#6366f1", iconLabel: "📝", badge: "badge-info" },
  수동: { color: "#f97316", iconLabel: "🔧", badge: "badge-warning" },
};

const ADD_EVENT_TYPES = ["수동", "리소스확보중", "사진수취", "정보수취", "TF2전달", "PR완료", "제작불가", "광고집행"];

function today() {
  return new Date().toISOString().split("T")[0];
}

function getMeta(type: string) {
  return EVENT_META[type] || EVENT_META["수동"];
}

function fmt(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function fmtBun(value: string | null) {
  if (!value) return "-";
  const num = value.replace(/[^0-9]/g, "");
  return num ? `B-${num}` : value;
}

function bunNumValue(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = value.match(/\d+/);
  if (!match) return Number.POSITIVE_INFINITY;
  return parseInt(match[0], 10);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function fmtFullDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function getInitial(name: string) {
  return name?.trim()?.slice(0, 1) || "?";
}

function iconForType(type: string): ReactNode {
  const size = 16;
  switch (type) {
    case "가입":
      return <Sparkles size={size} />;
    case "리소스확보중":
      return <PackageCheck size={size} />;
    case "사진수취":
      return <Camera size={size} />;
    case "정보수취":
      return <ClipboardList size={size} />;
    case "TF2전달":
      return <Send size={size} />;
    case "PR완료":
      return <CheckCircle2 size={size} />;
    case "제작불가":
      return <XCircle size={size} />;
    case "광고집행":
      return <Megaphone size={size} />;
    case "활동노트":
      return <MessageSquareText size={size} />;
    default:
      return <Wrench size={size} />;
  }
}

function StatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "info" | "success" | "warning" | "purple" }) {
  const colorMap = {
    info: { bg: "var(--info-bg)", border: "var(--info-border)", text: "var(--info-text)" },
    success: { bg: "var(--success-bg)", border: "var(--success-border)", text: "var(--success-text)" },
    warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", text: "var(--warning-text)" },
    purple: { bg: "var(--purple-bg)", border: "var(--purple-border)", text: "var(--purple-text)" },
  }[tone];

  return (
    <div className="premium-card flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[13px] border"
          style={{ background: colorMap.bg, borderColor: colorMap.border, color: colorMap.text }}
        >
          {icon}
        </div>
        <div>
          <p className="crm-tiny">{label}</p>
          <p className="mt-0.5 text-[22px] font-[830] tracking-[-0.055em]" style={{ color: "var(--text-strong)" }}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
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
        className="h-[38px] min-w-[126px] appearance-none rounded-full border px-3 pr-8 text-[12.5px] font-[740] outline-none transition-colors"
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

function EventTypeBadge({ type }: { type: string }) {
  const meta = getMeta(type);
  return <span className={`badge-premium ${meta.badge}`}>{meta.iconLabel} {type}</span>;
}

function MemberCard({ member, selected, onClick }: { member: Member; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[15px] border p-3 text-left transition-all hover:-translate-y-0.5"
      style={{
        background: selected ? "var(--accent-subtle)" : "var(--surface)",
        borderColor: selected ? "var(--accent-border)" : "var(--border)",
        boxShadow: selected ? "var(--shadow-xs)" : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="crm-avatar-sm"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}
        >
          {getInitial(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="crm-row-main truncate">{member.name}</span>
            <span className="crm-tiny truncate">{member.title || ""}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="badge-premium badge-warning h-[22px] px-2 text-[10.5px]">{fmtBun(member.bunyanghoe_number)}</span>
            {member.assigned_to && <span className="crm-tiny" style={{ color: "var(--purple-text)" }}>{member.assigned_to}</span>}
            {(member.contract_date || member.reservation_date) && <span className="crm-tiny">{fmtDate(member.contract_date || member.reservation_date)}</span>}
          </div>
        </div>
        <ChevronRight size={15} style={{ color: selected ? "var(--accent-text)" : "var(--text-faint)" }} />
      </div>
    </button>
  );
}

function EmptySelectState() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="premium-card max-w-[420px] p-8">
        <div className="premium-icon-lg mx-auto mb-4">
          <UserRound size={22} />
        </div>
        <p className="crm-section-title">회원을 선택해 주세요</p>
        <p className="crm-subtitle mt-2">좌측 입회자 목록에서 회원을 클릭하면 전체 타임라인을 확인할 수 있습니다.</p>
      </div>
    </div>
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

export default function MemberTimelinePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterType, setFilterType] = useState("");
  const [userName, setUserName] = useState("");
  const [toast, setToast] = useState("");
  const [detailEvent, setDetailEvent] = useState<TimelineEvent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    event_type: "수동",
    event_title: "",
    event_detail: "",
    event_date: today(),
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setUserName(user.name);
    fetchMembers();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  };

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,title,bunyanghoe_number,assigned_to,contract_date,reservation_date,meeting_result")
      .in("meeting_result", ["계약완료", "예약완료"]);

    if (error) {
      showToast(`회원 목록 불러오기 실패: ${error.message}`);
      setMembers([]);
      setLoading(false);
      return;
    }

    const sorted = ((data || []) as Member[]).sort((a, b) => bunNumValue(a.bunyanghoe_number) - bunNumValue(b.bunyanghoe_number));
    setMembers(sorted);
    setLoading(false);

    if (!selectedId && sorted.length > 0) {
      setSelectedId(sorted[0].id);
      loadTimeline(sorted[0].id, sorted);
    }
  };

  const loadTimeline = async (contactId: number, memberSource = members) => {
    setEventsLoading(true);
    const allEvents: TimelineEvent[] = [];
    const member = memberSource.find((item) => item.id === contactId);

    if (member?.contract_date || member?.reservation_date) {
      const joinDate = member.contract_date || member.reservation_date || "";
      const meta = getMeta("가입");
      allEvents.push({
        id: `join-${contactId}`,
        date: joinDate,
        type: "가입",
        title: "분양회 입회 등록",
        detail: `상태: ${fmt(member.meeting_result)}\n입회번호: ${fmtBun(member.bunyanghoe_number)}\n담당자: ${fmt(member.assigned_to)}\n완료일: ${fmtFullDate(joinDate)}`,
        source: "contacts",
        color: meta.color,
        iconLabel: meta.iconLabel,
      });
    }

    const { data: contentStatus } = await supabase
      .from("content_statuses")
      .select("*")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (contentStatus) {
      const baseDate = contentStatus.updated_at ? String(contentStatus.updated_at).split("T")[0] : member?.contract_date || member?.reservation_date || today();
      const contentEvents = [
        { key: "resource_collecting", type: "리소스확보중", title: "리소스 확보중", detail: "사진 및 기본정보 수취 전 리소스 확보 단계입니다." },
        { key: "photo_received", type: "사진수취", title: "사진 수취 완료", detail: "PR패키지 제작용 사진 자료를 수취했습니다." },
        { key: "info_received", type: "정보수취", title: "기본정보 수취 완료", detail: "PR패키지 기본정보 입력이 완료되었습니다." },
        { key: "tf2_delivered", type: "TF2전달", title: "TF2팀 전달 완료", detail: "콘텐츠 제작팀에 제작 자료가 전달되었습니다." },
        { key: "pr_completed", type: "PR완료", title: "PR패키지 제작 완료", detail: "PR패키지 제작 단계가 완료되었습니다." },
      ];

      contentEvents.forEach((item) => {
        if (contentStatus[item.key]) {
          const meta = getMeta(item.type);
          allEvents.push({
            id: `cs-${item.key}-${contactId}`,
            date: baseDate,
            type: item.type,
            title: item.title,
            detail: item.detail,
            source: "content_statuses",
            color: meta.color,
            iconLabel: meta.iconLabel,
          });
        }
      });

      if (contentStatus.production_impossible) {
        const meta = getMeta("제작불가");
        allEvents.push({
          id: `cs-impossible-${contactId}`,
          date: baseDate,
          type: "제작불가",
          title: "제작불가 처리",
          detail: contentStatus.impossible_reason || "제작불가 사유가 입력되지 않았습니다.",
          source: "content_statuses",
          color: meta.color,
          iconLabel: meta.iconLabel,
        });
      }
    }

    if (member) {
      const { data: ads } = await supabase
        .from("ad_executions")
        .select("id,channel,execution_amount,payment_date,member_name,bunyanghoe_number")
        .or(`member_name.eq.${member.name},bunyanghoe_number.eq.${member.bunyanghoe_number}`)
        .order("payment_date", { ascending: true });

      (ads || []).forEach((ad) => {
        const meta = getMeta("광고집행");
        allEvents.push({
          id: `ad-${ad.id}`,
          date: ad.payment_date || today(),
          type: "광고집행",
          title: `${ad.channel || "광고"} 집행`,
          detail: `채널: ${fmt(ad.channel)}\n집행금액: ${(ad.execution_amount || 0).toLocaleString()}원\n결제일: ${fmtFullDate(ad.payment_date)}`,
          source: "ad_executions",
          sourceId: ad.id,
          color: meta.color,
          iconLabel: meta.iconLabel,
        });
      });
    }

    const { data: notes } = await supabase
      .from("contact_notes")
      .select("id,note_date,content,author")
      .eq("contact_id", contactId)
      .order("note_date", { ascending: true });

    (notes || []).forEach((note) => {
      const meta = getMeta("활동노트");
      allEvents.push({
        id: `note-${note.id}`,
        date: note.note_date || today(),
        type: "활동노트",
        title: `활동노트${note.author ? ` · ${note.author}` : ""}`,
        detail: note.content || "내용 없음",
        source: "contact_notes",
        sourceId: note.id,
        color: meta.color,
        iconLabel: meta.iconLabel,
      });
    });

    const { data: manual } = await supabase
      .from("member_timeline")
      .select("*")
      .eq("contact_id", contactId)
      .order("event_date", { ascending: true });

    (manual || []).forEach((manualEvent) => {
      const type = manualEvent.event_type || "수동";
      const meta = getMeta(type);
      allEvents.push({
        id: `mt-${manualEvent.id}`,
        date: manualEvent.event_date || today(),
        type,
        title: manualEvent.event_title || "수동 이벤트",
        detail: manualEvent.event_detail || "상세 내용 없음",
        source: "member_timeline",
        sourceId: manualEvent.id,
        color: meta.color,
        iconLabel: meta.iconLabel,
      });
    });

    allEvents.sort((a, b) => a.date.localeCompare(b.date));
    setEvents(allEvents);
    setEventsLoading(false);
  };

  const selectMember = (id: number) => {
    setSelectedId(id);
    setDetailEvent(null);
    loadTimeline(id);
  };

  const handleAddEvent = async () => {
    if (!selectedId) return;
    if (!addForm.event_title.trim()) {
      showToast("이벤트 제목을 입력하세요");
      return;
    }

    const { error } = await supabase.from("member_timeline").insert({
      contact_id: selectedId,
      event_type: addForm.event_type,
      event_title: addForm.event_title.trim(),
      event_detail: addForm.event_detail.trim() || null,
      event_date: addForm.event_date,
      created_by: userName,
    });

    if (error) {
      showToast(`이벤트 추가 실패: ${error.message}`);
      return;
    }

    showToast("이벤트 추가 완료");
    setShowAdd(false);
    setAddForm({ event_type: "수동", event_title: "", event_detail: "", event_date: today() });
    loadTimeline(selectedId);
  };

  const handleDeleteEvent = async (event: TimelineEvent) => {
    if (event.source !== "member_timeline") {
      showToast("수동으로 추가한 이벤트만 삭제할 수 있습니다");
      return;
    }

    if (!confirm("이 이벤트를 삭제하시겠습니까?")) return;

    const { error } = await supabase.from("member_timeline").delete().eq("id", event.sourceId);
    if (error) {
      showToast(`삭제 실패: ${error.message}`);
      return;
    }

    showToast("이벤트 삭제 완료");
    setDetailEvent(null);
    if (selectedId) loadTimeline(selectedId);
  };

  const assignedList = useMemo(() => Array.from(new Set(members.map((member) => member.assigned_to).filter(Boolean) as string[])).sort(), [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const keyword = search.trim().toLowerCase();
      if (keyword) {
        const target = `${member.name || ""} ${member.title || ""} ${member.bunyanghoe_number || ""} ${member.assigned_to || ""}`.toLowerCase();
        if (!target.includes(keyword)) return false;
      }
      if (filterAssigned && member.assigned_to !== filterAssigned) return false;
      return true;
    });
  }, [filterAssigned, members, search]);

  const visibleEvents = useMemo(() => {
    if (!filterType) return events;
    return events.filter((event) => event.type === filterType);
  }, [events, filterType]);

  const selectedMember = members.find((member) => member.id === selectedId) || null;
  const eventTypes = useMemo(() => Array.from(new Set(events.map((event) => event.type))), [events]);
  const prDoneCount = events.filter((event) => event.type === "PR완료").length;
  const adCount = events.filter((event) => event.type === "광고집행").length;
  const manualCount = events.filter((event) => event.source === "member_timeline").length;
  const activeFilters = [search, filterAssigned, filterType].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setFilterAssigned("");
    setFilterType("");
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <header className="premium-header flex-shrink-0 px-5 py-4 lg:px-7">
        <div className="premium-shell flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="badge-premium badge-purple">
                  <CalendarDays size={13} /> 회원 타임라인
                </span>
                <span className="badge-premium badge-muted">이벤트 클릭 상세보기</span>
              </div>
              <h1 className="crm-title">회원 타임라인</h1>
              <p className="crm-subtitle mt-2">
                입회부터 리소스 확보, PR 제작, 광고집행, 활동노트까지 회원별 진행 이력을 한 화면에서 확인합니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[640px]">
              <StatCard icon={<Users size={17} />} label="입회자" value={members.length} tone="purple" />
              <StatCard icon={<Activity size={17} />} label="현재 이벤트" value={visibleEvents.length} tone="info" />
              <StatCard icon={<CheckCircle2 size={17} />} label="PR완료" value={prDoneCount} tone="success" />
              <StatCard icon={<Megaphone size={17} />} label="광고집행" value={adCount} tone="warning" />
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
                    placeholder="회원명, 직급, B넘버, 담당자 검색"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="crm-search w-full pl-9 pr-3"
                  />
                </div>

                <SelectFilter value={filterAssigned} onChange={setFilterAssigned} options={assignedList} label="전체 담당자" />
                <SelectFilter value={filterType} onChange={setFilterType} options={eventTypes} label="전체 이벤트" />
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <button type="button" onClick={resetFilters} className="btn-premium btn-secondary">
                  <RefreshCcw size={14} /> 초기화{activeFilters > 0 ? ` ${activeFilters}` : ""}
                </button>
                <button type="button" onClick={fetchMembers} className="btn-premium btn-secondary">
                  <RefreshCcw size={14} /> 최신화
                </button>
                <button type="button" onClick={() => setShowAdd(true)} disabled={!selectedMember} className="btn-premium btn-primary">
                  <Plus size={15} /> 이벤트 추가
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden px-5 py-5 lg:px-7">
        <div className="premium-shell grid h-full min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="premium-card flex min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="crm-section-title">입회자 목록</p>
                <p className="crm-tiny mt-1">총 {filteredMembers.length.toLocaleString()}명</p>
              </div>
              <span className="badge-premium badge-muted">B번호순</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <LoadingState />
              ) : filteredMembers.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <div className="premium-icon mb-3"><UserRound size={18} /></div>
                  <p className="crm-card-title">검색 결과가 없습니다</p>
                  <p className="crm-tiny mt-1">필터를 초기화해 주세요.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      selected={selectedId === member.id}
                      onClick={() => selectMember(member.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="premium-card min-h-0 overflow-hidden">
            {!selectedMember ? (
              <EmptySelectState />
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="crm-avatar" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))" }}>
                      {getInitial(selectedMember.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-premium badge-warning">{fmtBun(selectedMember.bunyanghoe_number)}</span>
                        <p className="crm-section-title">{selectedMember.name}</p>
                        {selectedMember.title && <span className="crm-meta">{selectedMember.title}</span>}
                      </div>
                      <p className="crm-tiny mt-1">
                        담당자 {fmt(selectedMember.assigned_to)} · 상태 {fmt(selectedMember.meeting_result)} · 완료일 {fmtDate(selectedMember.contract_date || selectedMember.reservation_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {Object.entries(EVENT_META).map(([type, meta]) => {
                      const count = events.filter((event) => event.type === type).length;
                      if (!count) return null;
                      return (
                        <button
                          type="button"
                          key={type}
                          onClick={() => setFilterType(filterType === type ? "" : type)}
                          className={`badge-premium ${meta.badge}`}
                          style={{ opacity: filterType && filterType !== type ? 0.45 : 1 }}
                        >
                          {meta.iconLabel} {type} {count}
                        </button>
                      );
                    })}
                    <span className="badge-premium badge-muted">수동 {manualCount}</span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {eventsLoading ? (
                    <LoadingState />
                  ) : visibleEvents.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center text-center">
                      <div className="premium-icon-lg mb-4"><FileText size={22} /></div>
                      <p className="crm-section-title">표시할 이벤트가 없습니다</p>
                      <p className="crm-subtitle mt-2">이벤트를 추가하거나 필터를 초기화해 주세요.</p>
                    </div>
                  ) : (
                    <div className="relative ml-3 max-w-[980px] pl-8">
                      <div className="absolute bottom-5 left-[15px] top-5 w-px rounded-full" style={{ background: "var(--border)" }} />

                      <div className="space-y-3">
                        {visibleEvents.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setDetailEvent(event)}
                            className="group relative w-full rounded-[18px] border p-4 text-left transition-all hover:-translate-y-0.5"
                            style={{
                              background: "var(--surface)",
                              borderColor: "var(--border)",
                              boxShadow: "var(--shadow-xs)",
                            }}
                          >
                            <div
                              className="absolute -left-[31px] top-5 flex h-8 w-8 items-center justify-center rounded-full border-4"
                              style={{ background: event.color, borderColor: "var(--bg)", color: "#fff" }}
                            >
                              {iconForType(event.type)}
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <EventTypeBadge type={event.type} />
                                  <span className="crm-tiny">{fmtFullDate(event.date)}</span>
                                </div>
                                <p className="crm-card-title truncate">{event.title}</p>
                                <p className="crm-body mt-2 line-clamp-2 whitespace-pre-wrap">{event.detail || "상세 내용 없음"}</p>
                              </div>

                              <div className="flex flex-shrink-0 items-center gap-2">
                                <span className="crm-tiny rounded-full border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                                  {event.source}
                                </span>
                                <ChevronRight size={16} style={{ color: "var(--text-faint)" }} />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {detailEvent && (
        <div className="slide-panel-overlay" onClick={() => setDetailEvent(null)}>
          <aside className="slide-panel" onClick={(event) => event.stopPropagation()}>
            <div className="slide-panel-header">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <EventTypeBadge type={detailEvent.type} />
                    <span className="badge-premium badge-muted">{detailEvent.source}</span>
                  </div>
                  <h2 className="crm-title text-[24px]">{detailEvent.title}</h2>
                  <p className="crm-subtitle mt-2">{fmtFullDate(detailEvent.date)}</p>
                </div>
                <button type="button" onClick={() => setDetailEvent(null)} className="btn-premium btn-secondary h-10 w-10 p-0">
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="slide-panel-body space-y-4">
              <div className="premium-card p-4">
                <p className="crm-card-title mb-3">상세 내용</p>
                <p className="crm-body whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                  {detailEvent.detail || "상세 내용 없음"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MiniInfo label="이벤트 유형" value={detailEvent.type} />
                <MiniInfo label="이벤트 일자" value={fmtFullDate(detailEvent.date)} />
                <MiniInfo label="데이터 소스" value={detailEvent.source} />
                <MiniInfo label="소스 ID" value={detailEvent.sourceId ? String(detailEvent.sourceId) : "-"} />
              </div>

              {selectedMember && (
                <div className="premium-card p-4">
                  <p className="crm-card-title mb-3">회원 정보</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniInfo label="회원명" value={selectedMember.name} />
                    <MiniInfo label="입회번호" value={fmtBun(selectedMember.bunyanghoe_number)} />
                    <MiniInfo label="담당자" value={fmt(selectedMember.assigned_to)} />
                    <MiniInfo label="입회상태" value={fmt(selectedMember.meeting_result)} />
                  </div>
                </div>
              )}
            </div>

            <div className="slide-panel-footer flex items-center justify-between gap-2">
              <button type="button" onClick={() => setDetailEvent(null)} className="btn-premium btn-secondary">
                닫기
              </button>
              {detailEvent.source === "member_timeline" && (
                <button type="button" onClick={() => handleDeleteEvent(detailEvent)} className="btn-premium btn-danger">
                  <Trash2 size={15} /> 수동 이벤트 삭제
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {showAdd && (
        <div className="crm-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="crm-modal flex max-w-[560px] flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="slide-panel-header flex items-start justify-between gap-4">
              <div>
                <p className="crm-title text-[22px]">이벤트 추가</p>
                <p className="crm-subtitle mt-1">{selectedMember ? `${selectedMember.name} 회원의 수동 타임라인 이벤트를 등록합니다.` : "회원을 먼저 선택해 주세요."}</p>
              </div>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-premium btn-secondary h-10 w-10 p-0">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="crm-meta mb-2 block">이벤트 유형</label>
                <select
                  value={addForm.event_type}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, event_type: event.target.value }))}
                  className="h-[40px] w-full rounded-[13px] border px-3 text-[13px] font-[680] outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  {ADD_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getMeta(type).iconLabel} {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="crm-meta mb-2 block">제목 *</label>
                <input
                  value={addForm.event_title}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, event_title: event.target.value }))}
                  placeholder="예: PR패키지 7종 작업 요청"
                  className="h-[40px] w-full rounded-[13px] border px-3 text-[13px] font-[680] outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              <div>
                <label className="crm-meta mb-2 block">날짜</label>
                <input
                  type="date"
                  value={addForm.event_date}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, event_date: event.target.value }))}
                  className="h-[40px] w-full rounded-[13px] border px-3 text-[13px] font-[680] outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              <div>
                <label className="crm-meta mb-2 block">상세 내용</label>
                <textarea
                  value={addForm.event_detail}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, event_detail: event.target.value }))}
                  rows={5}
                  placeholder="이벤트 상세 내용, 후속 액션, 참고사항을 입력하세요."
                  className="w-full resize-none rounded-[13px] border px-3 py-3 text-[13px] font-[620] outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
            </div>

            <div className="slide-panel-footer flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-premium btn-secondary">
                취소
              </button>
              <button type="button" onClick={handleAddEvent} disabled={!selectedMember} className="btn-premium btn-primary">
                <Plus size={15} /> 등록
              </button>
            </div>
          </div>
        </div>
      )}

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

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[13px] border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="crm-tiny">{label}</p>
      <p className="crm-row-sub mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
