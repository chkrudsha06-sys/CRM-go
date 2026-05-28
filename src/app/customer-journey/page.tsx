"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { Search, X, ChevronDown, ChevronUp, ArrowRight, CalendarPlus } from "lucide-react";
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

interface LastNote { contact_id: number; note_date: string; content: string; }
interface SiteHistory { id: number; operating_site: string; total_org_count: string; team_org_count: string; rt: string; changed_by: string; changed_at: string; }

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const CONSULTANTS = ["박경화", "박혜은", "조승현", "박민경", "백선중", "강아름", "전정훈", "박나라"];
const OPT = {
  customer_type: ["신규", "기고객"],
  management_stage: ["리드", "프로스펙팅", "딜크로징", "리텐션"],
  intake_route: ["컨설턴트VIP DB", "컨설턴트 교차DB", "신규TM", "완판트럭", "분양회MGM"],
};

const COLUMNS = [
  { key: "리드",       label: "리드",       color: "#3b82f6", bg: "rgba(59,130,246,0.06)",  border: "rgba(59,130,246,0.15)" },
  { key: "프로스펙팅", label: "프로스펙팅", color: "#f59e0b", bg: "rgba(245,158,11,0.06)",  border: "rgba(245,158,11,0.15)" },
  { key: "딜클로징",   label: "딜클로징",   color: "#ef4444", bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.15)" },
  { key: "리텐션",     label: "리텐션",     color: "#10b981", bg: "rgba(16,185,129,0.06)",  border: "rgba(16,185,129,0.15)" },
];

// 각 구간별 전환 버튼
const STAGE_TRANSITIONS: Record<string, { label: string; dbValue: string; color: string }[]> = {
  "리드": [
    { label: "프로스펙팅 전환", dbValue: "프로스펙팅", color: "#f59e0b" },
    { label: "딜클로징 전환", dbValue: "딜크로징", color: "#ef4444" },
  ],
  "프로스펙팅": [
    { label: "리드 전환", dbValue: "리드", color: "#3b82f6" },
    { label: "딜클로징 전환", dbValue: "딜크로징", color: "#ef4444" },
  ],
  "딜클로징": [
    { label: "리드 전환", dbValue: "리드", color: "#3b82f6" },
    { label: "프로스펙팅 전환", dbValue: "프로스펙팅", color: "#f59e0b" },
  ],
};

const MEETING_RESULTS = ["계약완료", "예약완료", "서류만수취", "2차접점", "계약거부", "미팅불발"];

const SURNAME_COLORS: Record<string,string> = {
  "김":"#3b82f6","이":"#8b5cf6","박":"#10b981","최":"#f43f5e","정":"#f59e0b","강":"#06b6d4",
  "조":"#6366f1","윤":"#ec4899","장":"#f97316","임":"#14b8a6","한":"#0ea5e9","오":"#a855f7",
  "서":"#ef4444","신":"#65a30d","권":"#d946ef","황":"#ca8a04","안":"#2563eb","송":"#16a34a",
  "류":"#4f46e5","전":"#e11d48","홍":"#dc2626","고":"#0891b2","문":"#7c3aed","양":"#d97706",
  "손":"#059669","배":"#0284c7","백":"#64748b","허":"#db2777","남":"#0d9488","유":"#ea580c",
  "민":"#7c3aed","곽":"#0891b2",
};
function getAvatarColor(name: string) {
  if (name && SURNAME_COLORS[name[0]]) return SURNAME_COLORS[name[0]];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  const colors = ["#3b82f6","#8b5cf6","#f59e0b","#10b981","#f43f5e","#06b6d4","#6366f1","#ec4899"];
  return colors[sum % colors.length];
}

function formatNoteDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default function CustomerJourneyPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lastNotes, setLastNotes] = useState<Record<number, LastNote>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const [fCustomerType, setFCustomerType] = useState("");
  const [fStage, setFStage] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fConsultant, setFConsultant] = useState("");
  const [fIntake, setFIntake] = useState("");

  const [notesPopup, setNotesPopup] = useState<{ contactId: number; name: string } | null>(null);
  const [meetingModal, setMeetingModal] = useState<{ contactId: number; name: string } | null>(null);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [meetingAddr, setMeetingAddr] = useState("");

  // 미팅결과 변경 시 날짜 모달
  const [resultDateModal, setResultDateModal] = useState<{ contactId: number; name: string; result: string } | null>(null);
  const [resultDate, setResultDate] = useState(new Date().toISOString().split("T")[0]);

  // 현장정보 수정 모달
  const [siteModal, setSiteModal] = useState<{ contactId: number; name: string } | null>(null);
  const [siteForm, setSiteForm] = useState({ operating_site: "", total_org_count: "", team_org_count: "", rt: "" });
  const [siteHistory, setSiteHistory] = useState<SiteHistory[]>([]);
  const [showSiteHistory, setShowSiteHistory] = useState(false);
  // 카드 내 인라인 히스토리
  const [inlineHistory, setInlineHistory] = useState<Record<number, SiteHistory[]>>({});
  const [inlineHistoryOpen, setInlineHistoryOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const u = getCurrentUser();
    if (u) { setUserName(u.name); setUserRole(u.role); }
    fetchAll();
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchAll = async () => {
    setLoading(true);
    const u = getCurrentUser();
    let q = supabase.from("contacts")
      .select("id,name,title,phone,customer_type,prospect_type,management_stage,assigned_to,consultant,intake_route,meeting_date,meeting_address,meeting_result,memo,tm_sensitivity,contract_date,reservation_date,operating_site,total_org_count,team_org_count,rt")
      .order("id", { ascending: false }).limit(500);
    if (u?.role === "exec") q = q.eq("assigned_to", u.name);
    const { data: cData } = await q;
    setContacts((cData || []) as Contact[]);

    const { data: nData } = await supabase.from("contact_notes")
      .select("contact_id,note_date,content")
      .order("note_date", { ascending: false });
    const noteMap: Record<number, LastNote> = {};
    (nData || []).forEach((n: LastNote) => {
      if (!noteMap[n.contact_id]) noteMap[n.contact_id] = n;
    });
    setLastNotes(noteMap);
    setLoading(false);
  };

  const handleStageTransition = async (contactId: number, name: string, newStage: string) => {
    if (!confirm(`${name} 고객을 "${newStage}"(으)로 전환하시겠습니까?`)) return;
    const { error } = await supabase.from("contacts").update({ management_stage: newStage }).eq("id", contactId);
    if (error) { showToast(`전환 실패: ${error.message}`); return; }
    showToast(`${name} → ${newStage} 전환 완료`);
    fetchAll();
  };

  const handleMeetingRegister = async () => {
    if (!meetingModal || !meetingDate) return;
    const { error } = await supabase.from("contacts").update({
      meeting_date: meetingDate, meeting_address: meetingAddr || null,
    }).eq("id", meetingModal.contactId);
    if (error) { showToast(`등록 실패: ${error.message}`); return; }
    showToast(`${meetingModal.name} 미팅 등록 완료`);
    setMeetingModal(null); setMeetingDate(new Date().toISOString().split("T")[0]); setMeetingAddr("");
    fetchAll();
  };

  const handleDeleteMeeting = async (contactId: number, name: string) => {
    if (!confirm(`${name} 미팅일정을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("contacts").update({
      meeting_date: null, meeting_address: null,
    }).eq("id", contactId);
    if (error) { showToast(`삭제 실패: ${error.message}`); return; }
    showToast(`${name} 미팅일정 삭제 완료`);
    fetchAll();
  };

  const handleDeleteContact = async (contactId: number, name: string) => {
    if (!confirm(`"${name}" 고객을 삭제하시겠습니까?\n\n관련 활동노트, 리워드, 알림 등 모든 데이터가 함께 삭제됩니다.`)) return;
    try {
      // FK cascade: 관련 테이블 먼저 삭제 (순서 중요)
      const tables = [
        "rewards", "mileage_usages", "contact_notes", "notifications",
        "push_subscriptions", "content_statuses", "site_info_history", "member_timeline"
      ];
      for (const table of tables) {
        const { error: tErr } = await supabase.from(table).delete().eq("contact_id", contactId);
        if (tErr) console.warn(`${table} 삭제 경고:`, tErr.message);
      }
      const { error } = await supabase.from("contacts").delete().eq("id", contactId);
      if (error) { showToast(`삭제 실패: ${error.message}`); return; }
      showToast(`${name} 고객 삭제 완료`);
      setExpandedId(null);
      fetchAll();
    } catch (err) {
      showToast(`삭제 중 오류 발생`);
    }
  };

  const handleDeleteMeetingResult = async (contactId: number, name: string) => {
    if (!confirm(`${name} 미팅결과를 초기화하시겠습니까?`)) return;
    const { error } = await supabase.from("contacts").update({
      meeting_result: null, contract_date: null, reservation_date: null,
    }).eq("id", contactId);
    if (error) { showToast(`초기화 실패: ${error.message}`); return; }
    showToast(`${name} 미팅결과 초기화 완료`);
    fetchAll();
  };

  // 미팅결과 변경
  const handleMeetingResultChange = async (contactId: number, name: string, result: string) => {
    // 계약완료/예약완료는 날짜 입력 모달
    if (result === "계약완료" || result === "예약완료") {
      setResultDateModal({ contactId, name, result });
      setResultDate(new Date().toISOString().split("T")[0]);
      return;
    }
    const { error } = await supabase.from("contacts").update({ meeting_result: result }).eq("id", contactId);
    if (error) { showToast(`변경 실패: ${error.message}`); return; }
    showToast(`${name} 미팅결과: ${result}`);
    fetchAll();
  };

  const handleResultDateSave = async () => {
    if (!resultDateModal) return;
    const isContract = resultDateModal.result === "계약완료";
    const updateData: Record<string, string | null> = {
      meeting_result: resultDateModal.result,
      [isContract ? "contract_date" : "reservation_date"]: resultDate,
    };
    const { error } = await supabase.from("contacts").update(updateData).eq("id", resultDateModal.contactId);
    if (error) { showToast(`저장 실패: ${error.message}`); return; }
    showToast(`${resultDateModal.name} ${resultDateModal.result} 처리 완료`);
    setResultDateModal(null);
    fetchAll();
  };

  // 현장정보 수정 모달 열기
  const openSiteModal = async (c: Contact) => {
    setSiteModal({ contactId: c.id, name: c.name });
    setSiteForm({
      operating_site: c.operating_site || "",
      total_org_count: c.total_org_count || "",
      team_org_count: c.team_org_count || "",
      rt: c.rt || "",
    });
    setShowSiteHistory(false);
    // 히스토리 로드
    const { data } = await supabase.from("site_info_history")
      .select("*").eq("contact_id", c.id)
      .order("changed_at", { ascending: false }).limit(20);
    setSiteHistory((data || []) as SiteHistory[]);
  };

  // 현장정보 저장
  const handleSiteInfoSave = async () => {
    if (!siteModal) return;
    const { error } = await supabase.from("contacts").update({
      operating_site: siteForm.operating_site || null,
      total_org_count: siteForm.total_org_count || null,
      team_org_count: siteForm.team_org_count || null,
      rt: siteForm.rt || null,
    }).eq("id", siteModal.contactId);
    if (error) { showToast(`저장 실패: ${error.message}`); return; }
    // 히스토리 기록
    await supabase.from("site_info_history").insert({
      contact_id: siteModal.contactId,
      operating_site: siteForm.operating_site || "",
      total_org_count: siteForm.total_org_count || "",
      team_org_count: siteForm.team_org_count || "",
      rt: siteForm.rt || "",
      changed_by: userName || "",
    });
    showToast(`${siteModal.name} 현장정보 수정 완료`);
    setSiteModal(null);
    // 인라인 히스토리 갱신
    const { data: freshH } = await supabase.from("site_info_history")
      .select("*").eq("contact_id", siteModal.contactId)
      .order("changed_at", { ascending: false }).limit(20);
    setInlineHistory(prev => ({ ...prev, [siteModal.contactId]: (freshH || []) as SiteHistory[] }));
    fetchAll();
  };

  const toggleInlineHistory = async (contactId: number) => {
    const isOpen = inlineHistoryOpen[contactId];
    if (isOpen) {
      setInlineHistoryOpen(prev => ({ ...prev, [contactId]: false }));
      return;
    }
    // 로드
    if (!inlineHistory[contactId]) {
      const { data } = await supabase.from("site_info_history")
        .select("*").eq("contact_id", contactId)
        .order("changed_at", { ascending: false }).limit(20);
      setInlineHistory(prev => ({ ...prev, [contactId]: (data || []) as SiteHistory[] }));
    }
    setInlineHistoryOpen(prev => ({ ...prev, [contactId]: true }));
  };

  const activeFilters = [fCustomerType, fStage, fAssigned, fConsultant, fIntake].filter(Boolean).length;
  const filtered = contacts.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!((c.name||"").toLowerCase().includes(q) || (c.title||"").toLowerCase().includes(q) || (c.phone||"").includes(q))) return false;
    }
    if (fCustomerType && c.customer_type !== fCustomerType) return false;
    if (fStage && c.management_stage !== fStage) return false;
    if (fAssigned && c.assigned_to !== fAssigned) return false;
    if (fConsultant && c.consultant !== fConsultant) return false;
    if (fIntake && c.intake_route !== fIntake) return false;
    return true;
  });

  // 컬럼 배치: 계약완료→리텐션, 예약완료→딜클로징, 나머지는 management_stage 기준
  const getColumnContacts = (colKey: string) => {
    return filtered.filter(c => {
      if (colKey === "리텐션") {
        return c.management_stage === "리텐션" || c.meeting_result === "계약완료";
      }
      if (colKey === "딜클로징") {
        const isContract = c.meeting_result === "계약완료";
        if (isContract) return false; // 계약완료는 리텐션으로
        return c.management_stage === "딜크로징" || c.meeting_result === "예약완료";
      }
      // 리드, 프로스펙팅: 계약완료/예약완료 제외
      const isCompleted = c.meeting_result === "계약완료" || c.meeting_result === "예약완료";
      if (isCompleted) return false;
      return c.management_stage === colKey;
    });
  };

  const totalDisplayed = COLUMNS.reduce((sum, col) => sum + getColumnContacts(col.key).length, 0);

  // 뱃지 표시
  const getBadge = (c: Contact) => {
    if (c.meeting_result === "계약완료") return { text: "계약완료", color: "#8b5cf6" };
    if (c.meeting_result === "예약완료") return { text: "예약완료", color: "#6366f1" };
    return null;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* 헤더 */}
      <div className="px-6 py-4 flex-shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>🗺️ 고객여정</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>고객 관리구간 기반 파이프라인</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
              전체 <span className="font-bold" style={{ color: "#3b82f6" }}>{totalDisplayed}</span>명 표시
              {search || activeFilters > 0 ? ` (전체 ${contacts.length}명)` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />실시간
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input type="text" placeholder="고객명, 직급, 연락처 검색..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:border-blue-400"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </div>
          {[
            { val: fIntake, set: setFIntake, opts: OPT.intake_route, ph: "유입경로" },
            { val: fCustomerType, set: setFCustomerType, opts: OPT.customer_type, ph: "고객유형" },
            { val: fStage, set: setFStage, opts: OPT.management_stage, ph: "관리구간" },
          ].map(s => (
            <select key={s.ph} value={s.val} onChange={e => s.set(e.target.value)}
              className="appearance-none px-2.5 py-2 text-xs rounded-xl focus:outline-none focus:border-blue-400"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 100, maxWidth: 130 }}>
              <option value="">{s.ph}</option>
              {s.opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <select value={fAssigned} onChange={e => setFAssigned(e.target.value)}
            className="appearance-none px-2.5 py-2 text-xs rounded-xl focus:outline-none focus:border-blue-400"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 110, maxWidth: 140 }}>
            <option value="">담당자</option>
            {TEAM.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fConsultant} onChange={e => setFConsultant(e.target.value)}
            className="appearance-none px-2.5 py-2 text-xs rounded-xl focus:outline-none focus:border-blue-400"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 110, maxWidth: 140 }}>
            <option value="">담당컨설턴트</option>
            {CONSULTANTS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => { setSearch(""); setFCustomerType(""); setFStage(""); setFAssigned(""); setFConsultant(""); setFIntake(""); }}
            className={`px-2.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${activeFilters > 0 || search ? "bg-red-500 text-white border border-red-500" : "text-red-400 border border-red-200"}`}>
            ↺ 초기화
          </button>
        </div>
      </div>

      {/* 칸반 4컬럼 */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-3 h-full" style={{ gridTemplateColumns: "repeat(4, minmax(220px, 1fr))", minWidth: "900px" }}>
            {COLUMNS.map(col => {
              const colContacts = getColumnContacts(col.key);
              const transitions = STAGE_TRANSITIONS[col.key];
              return (
                <div key={col.key} className="flex flex-col rounded-2xl overflow-hidden min-w-0"
                  style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${col.border}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                      <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{col.label}</span>
                    </div>
                    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${col.color}20`, color: col.color }}>
                      {colContacts.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                    {colContacts.length === 0 ? (
                      <div className="flex items-center justify-center h-20 text-sm" style={{ color: "var(--text-subtle)" }}>없음</div>
                    ) : (
                      colContacts.map(c => {
                        const isExpanded = expandedId === c.id;
                        const avatarColor = getAvatarColor(c.name);
                        const lastNote = lastNotes[c.id];
                        const badge = getBadge(c);
                        return (
                          <div key={c.id} className="rounded-xl overflow-hidden"
                            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                            <div className="px-3 py-2.5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                              {/* 이름 + 직급 + 뱃지 */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                  style={{ background: avatarColor }}>{c.name[0]}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[13px] font-bold truncate" style={{ color: "var(--text)" }}>{c.name}</span>
                                    {c.title && <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>{c.title}</span>}
                                    {badge && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                        style={{ background: `${badge.color}20`, color: badge.color }}>{badge.text}</span>
                                    )}
                                  </div>
                                  {c.assigned_to && <span className="text-[10px] font-semibold" style={{ color: "#8b5cf6" }}>{c.assigned_to}</span>}
                                </div>
                                {isExpanded ? <ChevronUp size={13} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={13} style={{ color: "var(--text-muted)" }} />}
                              </div>

                              {/* 최근 활동노트 */}
                              <div className="rounded-lg px-2 py-1.5 mb-1.5" style={{ background: "var(--bg)" }}>
                                {lastNote ? (
                                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                                    <span className="font-semibold" style={{ color: "#60a5fa" }}>{formatNoteDate(lastNote.note_date)}</span>
                                    <span className="mx-1" style={{ color: "var(--text-subtle)" }}>-</span>
                                    <span style={{ color: "var(--text)" }}>{lastNote.content}</span>
                                  </p>
                                ) : (
                                  <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>활동노트 없음</p>
                                )}
                              </div>

                              {/* 미팅일정 표시 */}
                              {c.meeting_date && (
                                <div className="flex items-center justify-between rounded-lg px-2 py-1.5 mb-1.5" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}
                                  onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px]">📅</span>
                                    <span className="text-[11px] font-semibold" style={{ color: "#60a5fa" }}>
                                      {new Date(c.meeting_date + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                                    </span>
                                    {c.meeting_address && (
                                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>📍 {c.meeting_address}</span>
                                    )}
                                  </div>
                                  <button onClick={() => handleDeleteMeeting(c.id, c.name)}
                                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded transition-colors"
                                    style={{ color: "#ef4444" }}>✕</button>
                                </div>
                              )}

                              {/* 액션 버튼 */}
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                {transitions && transitions.map(t => (
                                  <button key={t.dbValue} onClick={() => handleStageTransition(c.id, c.name, t.dbValue)}
                                    className="flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1.5 text-[9px] font-bold rounded-lg transition-colors"
                                    style={{ background: `${t.color}12`, color: t.color, border: `1px solid ${t.color}25` }}>
                                    <ArrowRight size={9} />{t.label}
                                  </button>
                                ))}
                                <button onClick={() => { setMeetingModal({ contactId: c.id, name: c.name }); setMeetingDate(c.meeting_date || new Date().toISOString().split("T")[0]); setMeetingAddr(c.meeting_address || ""); }}
                                  className="flex items-center justify-center gap-0.5 px-1.5 py-1.5 text-[9px] font-bold rounded-lg transition-colors"
                                  style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
                                  <CalendarPlus size={9} />미팅
                                </button>
                              </div>
                            </div>

                            {/* 확장 상세 */}
                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
                                {/* 고객 기본정보 */}
                                <div className="pt-2 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{c.name}</span>
                                    {c.title && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{c.title}</span>}
                                  </div>
                                  {c.phone && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px]" style={{ color: "var(--text)" }}>📞 {c.phone}</span>
                                    </div>
                                  )}
                                  {c.meeting_date && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-semibold" style={{ color: "#60a5fa" }}>
                                        📅 {new Date(c.meeting_date + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                                      </span>
                                      {c.meeting_address && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>📍 {c.meeting_address}</span>}
                                    </div>
                                  )}
                                </div>

                                {/* 미팅결과 드롭다운 */}
                                <div>
                                  <p className="text-[9px] font-semibold mb-1" style={{ color: "var(--text-subtle)" }}>미팅결과</p>
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={c.meeting_result || ""}
                                      onChange={e => { e.stopPropagation(); if (e.target.value) handleMeetingResultChange(c.id, c.name, e.target.value); }}
                                      onClick={e => e.stopPropagation()}
                                      className="flex-1 appearance-none px-2.5 py-1.5 text-[11px] font-semibold rounded-lg outline-none"
                                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
                                      <option value="">미팅결과 선택</option>
                                    {MEETING_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    {c.meeting_result && (
                                      <button onClick={e => { e.stopPropagation(); handleDeleteMeetingResult(c.id, c.name); }}
                                        className="px-2 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex-shrink-0"
                                        style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)" }}>
                                        초기화
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* 현장정보 */}
                                <div className="rounded-lg p-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-bold" style={{ color: "var(--text)" }}>🏗️ 현장정보</p>
                                    <button onClick={e => { e.stopPropagation(); openSiteModal(c); }}
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                                      style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>수정</button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    <div><p className="text-[9px]" style={{ color: "var(--text-subtle)" }}>운영현장</p><p className="text-[11px] font-semibold" style={{ color: c.operating_site ? "var(--text)" : "var(--text-subtle)" }}>{c.operating_site || "-"}</p></div>
                                    <div><p className="text-[9px]" style={{ color: "var(--text-subtle)" }}>전체조직수</p><p className="text-[11px] font-semibold" style={{ color: c.total_org_count ? "var(--text)" : "var(--text-subtle)" }}>{c.total_org_count || "-"}</p></div>
                                    <div><p className="text-[9px]" style={{ color: "var(--text-subtle)" }}>팀조직수</p><p className="text-[11px] font-semibold" style={{ color: c.team_org_count ? "var(--text)" : "var(--text-subtle)" }}>{c.team_org_count || "-"}</p></div>
                                    <div><p className="text-[9px]" style={{ color: "var(--text-subtle)" }}>R/T</p><p className="text-[11px] font-semibold" style={{ color: c.rt ? "var(--text)" : "var(--text-subtle)" }}>{c.rt || "-"}</p></div>
                                  </div>
                                  {/* 히스토리 토글 */}
                                  <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => toggleInlineHistory(c.id)}
                                      className="text-[10px] font-semibold" style={{ color: "#3b82f6" }}>
                                      {inlineHistoryOpen[c.id] ? "▾ 수정 히스토리 닫기" : "▸ 수정 히스토리 보기"}
                                      {inlineHistory[c.id] ? ` (${inlineHistory[c.id].length}건)` : ""}
                                    </button>
                                    {inlineHistoryOpen[c.id] && (
                                      <div className="mt-1.5 space-y-1 max-h-36 overflow-y-auto">
                                        {(!inlineHistory[c.id] || inlineHistory[c.id].length === 0) ? (
                                          <p className="text-[10px] py-2 text-center" style={{ color: "var(--text-subtle)" }}>수정 기록 없음</p>
                                        ) : inlineHistory[c.id].map(h => (
                                          <div key={h.id} className="rounded-lg px-2 py-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                                            <div className="flex items-center justify-between mb-0.5">
                                              <span className="text-[9px] font-bold" style={{ color: "#60a5fa" }}>
                                                {new Date(h.changed_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                                                {" "}
                                                {new Date(h.changed_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                              </span>
                                              {h.changed_by && <span className="text-[9px]" style={{ color: "#8b5cf6" }}>{h.changed_by}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] flex-wrap">
                                              {h.operating_site && <span style={{ color: "var(--text)" }}>현장:<b>{h.operating_site}</b></span>}
                                              {h.total_org_count && <span style={{ color: "var(--text)" }}>전체:<b>{h.total_org_count}</b></span>}
                                              {h.team_org_count && <span style={{ color: "var(--text)" }}>팀:<b>{h.team_org_count}</b></span>}
                                              {h.rt && <span style={{ color: "var(--text)" }}>R/T:<b>{h.rt}</b></span>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  {[
                                    { label: "유입경로", value: c.intake_route },
                                    { label: "고객유형", value: c.customer_type },
                                    { label: "담당컨설턴트", value: c.consultant },
                                    { label: "계약일", value: c.contract_date },
                                  ].map(item => (
                                    <div key={item.label}>
                                      <p className="text-[9px] font-semibold" style={{ color: "var(--text-subtle)" }}>{item.label}</p>
                                      <p className="text-[11px] font-semibold" style={{ color: item.value ? "var(--text)" : "var(--text-subtle)" }}>{item.value || "-"}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* 활동노트 */}
                                <div className="rounded-lg p-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-bold" style={{ color: "var(--text)" }}>📝 활동노트</p>
                                    <button onClick={e => { e.stopPropagation(); setNotesPopup({ contactId: c.id, name: c.name }); }}
                                      className="text-[10px] font-semibold hover:underline" style={{ color: "#3b82f6" }}>전체보기 →</button>
                                  </div>
                                  <ContactNotes contactId={c.id} compact />
                                </div>

                                <div className="flex items-center gap-2">
                                  <a href={`/contacts/${c.id}`} onClick={e => e.stopPropagation()}
                                    className="flex-1 block text-center text-[11px] font-semibold py-1.5 rounded-lg"
                                    style={{ background: "var(--bg)", color: "#3b82f6", border: "1px solid var(--border)" }}>상세 페이지 →</a>
                                  <button onClick={e => { e.stopPropagation(); handleDeleteContact(c.id, c.name); }}
                                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors"
                                    style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)" }}>
                                    삭제
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 활동노트 팝업 */}
      {notesPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { setNotesPopup(null); fetchAll(); }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            style={{ background: "var(--modal-bg)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{notesPopup.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>활동노트</span>
              </div>
              <button onClick={() => { setNotesPopup(null); fetchAll(); }} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ContactNotes contactId={notesPopup.contactId} authorName={userName} />
            </div>
          </div>
        </div>
      )}

      {/* 미팅등록 모달 */}
      {meetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMeetingModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm"
            style={{ background: "var(--modal-bg)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <CalendarPlus size={16} style={{ color: "#3b82f6" }} />
                <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{meetingModal.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>미팅등록</span>
              </div>
              <button onClick={() => setMeetingModal(null)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>미팅 날짜</label>
                <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:border-blue-400"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>미팅 지역 (선택)</label>
                <input type="text" value={meetingAddr} onChange={e => setMeetingAddr(e.target.value)} placeholder="예: 서울 강남"
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:border-blue-400"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>
            </div>
            <div className="flex items-center gap-2 px-5 pb-4">
              <button onClick={() => setMeetingModal(null)}
                className="flex-1 py-2 text-sm font-semibold rounded-xl" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>취소</button>
              <button onClick={handleMeetingRegister}
                className="flex-1 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700">등록</button>
            </div>
          </div>
        </div>
      )}

      {/* 계약완료/예약완료 날짜 모달 */}
      {resultDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setResultDateModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm"
            style={{ background: "var(--modal-bg)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-base">{resultDateModal.result === "계약완료" ? "📋" : "📌"}</span>
                <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{resultDateModal.name}</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: resultDateModal.result === "계약완료" ? "rgba(139,92,246,0.15)" : "rgba(99,102,241,0.15)",
                    color: resultDateModal.result === "계약완료" ? "#8b5cf6" : "#6366f1" }}>{resultDateModal.result}</span>
              </div>
              <button onClick={() => setResultDateModal(null)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="p-5">
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>
                {resultDateModal.result === "계약완료" ? "계약일" : "예약일"}
              </label>
              <input type="date" value={resultDate} onChange={e => setResultDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:border-blue-400"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div className="flex items-center gap-2 px-5 pb-4">
              <button onClick={() => setResultDateModal(null)}
                className="flex-1 py-2 text-sm font-semibold rounded-xl" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>취소</button>
              <button onClick={handleResultDateSave}
                className="flex-1 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90"
                style={{ background: resultDateModal.result === "계약완료" ? "#8b5cf6" : "#6366f1" }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 현장정보 수정 모달 */}
      {siteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSiteModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
            style={{ background: "var(--modal-bg)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-base">🏗️</span>
                <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{siteModal.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>현장정보 수정</span>
              </div>
              <button onClick={() => setSiteModal(null)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>운영현장</label>
                  <input type="text" value={siteForm.operating_site} onChange={e => setSiteForm(p => ({ ...p, operating_site: e.target.value }))}
                    placeholder="예: 경남 양산" className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>전체조직수</label>
                  <input type="text" value={siteForm.total_org_count} onChange={e => setSiteForm(p => ({ ...p, total_org_count: e.target.value }))}
                    placeholder="예: 150" className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>팀조직수</label>
                  <input type="text" value={siteForm.team_org_count} onChange={e => setSiteForm(p => ({ ...p, team_org_count: e.target.value }))}
                    placeholder="예: 30" className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>R/T</label>
                  <input type="text" value={siteForm.rt} onChange={e => setSiteForm(p => ({ ...p, rt: e.target.value }))}
                    placeholder="예: 3/5" className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setSiteModal(null)}
                  className="flex-1 py-2 text-sm font-semibold rounded-xl" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>취소</button>
                <button onClick={handleSiteInfoSave}
                  className="flex-1 py-2 text-sm font-bold text-white rounded-xl" style={{ background: "#f59e0b" }}>저장</button>
              </div>

              {/* 수정 히스토리 */}
              <div>
                <button onClick={() => setShowSiteHistory(v => !v)}
                  className="text-[11px] font-semibold" style={{ color: "#3b82f6" }}>
                  {showSiteHistory ? "▾ 수정 히스토리 닫기" : "▸ 수정 히스토리 보기"} ({siteHistory.length}건)
                </button>
                {showSiteHistory && (
                  <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                    {siteHistory.length === 0 ? (
                      <p className="text-[11px] py-3 text-center" style={{ color: "var(--text-subtle)" }}>수정 기록이 없습니다</p>
                    ) : siteHistory.map(h => (
                      <div key={h.id} className="rounded-lg px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold" style={{ color: "#60a5fa" }}>
                            {new Date(h.changed_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                            {" "}
                            {new Date(h.changed_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {h.changed_by && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "#8b5cf6" }}>{h.changed_by}</span>}
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-[10px]">
                          <div><span style={{ color: "var(--text-subtle)" }}>현장</span> <span className="font-semibold" style={{ color: "var(--text)" }}>{h.operating_site || "-"}</span></div>
                          <div><span style={{ color: "var(--text-subtle)" }}>전체</span> <span className="font-semibold" style={{ color: "var(--text)" }}>{h.total_org_count || "-"}</span></div>
                          <div><span style={{ color: "var(--text-subtle)" }}>팀</span> <span className="font-semibold" style={{ color: "var(--text)" }}>{h.team_org_count || "-"}</span></div>
                          <div><span style={{ color: "var(--text-subtle)" }}>R/T</span> <span className="font-semibold" style={{ color: "var(--text)" }}>{h.rt || "-"}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
