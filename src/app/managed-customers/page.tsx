"use client";

import { getCurrentUser } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { hasCrmFullAccess } from "@/lib/crm-permissions";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileClock,
  History,
  Loader2,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Contact = {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  intake_route: string | null;
  company: string | null;
  current_site: string | null;
  sourcing_owner: string | null;
  assigned_to: string | null;
  closing_owner: string | null;
  managed_customer_grade: string | null;
  management_status: string | null;
  handoff_at: string | null;
  meeting_date: string | null;
  meeting_date_text: string | null;
  meeting_address: string | null;
  created_at: string;
};

type Profile = {
  id: number;
  contact_id: number;
  grade: string | null;
  grade_reason: string | null;
  grade_updated_at: string | null;
  grade_updated_by: string | null;
  management_status: string | null;
  site_status: string | null;
  organization_info: string | null;
  advertising_operation: string | null;
  advertising_budget: string | null;
  advertising_support: string | null;
  site_move_plan: string | null;
  decision_authority: string | null;
  customer_needs: string | null;
  next_management_at: string | null;
  updated_by: string | null;
};

type Meeting = {
  id: number;
  contact_id: number;
  meeting_at: string;
  meeting_address: string | null;
  meeting_type: string;
  status: string;
  attendees: string | null;
  purpose: string | null;
  site_status: string | null;
  organization_info: string | null;
  advertising_operation: string | null;
  advertising_budget: string | null;
  advertising_support: string | null;
  site_move_plan: string | null;
  decision_authority: string | null;
  customer_request: string | null;
  closing_judgement: string | null;
  follow_up_action: string | null;
  next_meeting_at: string | null;
  result_memo: string | null;
  created_by: string | null;
  created_at: string;
};

type Note = {
  id: number;
  contact_id: number;
  note_date: string;
  content: string;
  author: string | null;
  created_at: string;
};

type SiteMove = {
  id: number;
  contact_id: number;
  current_site: string | null;
  destination_site: string;
  destination_region: string | null;
  planned_move_date: string;
  move_status: string;
  is_confirmed: boolean;
  memo: string | null;
  created_by: string | null;
  created_at: string;
};

type HistoryRow = {
  id: number;
  contact_id: number;
  event_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  source_screen: string | null;
  changed_by: string | null;
  created_at: string;
};

type ProfileForm = {
  managementStatus: string;
  siteStatus: string;
  organizationInfo: string;
  advertisingOperation: string;
  advertisingBudget: string;
  advertisingSupport: string;
  siteMovePlan: string;
  decisionAuthority: string;
  customerNeeds: string;
  nextManagementAt: string;
};

type MeetingForm = {
  meetingDate: string;
  meetingTime: string;
  meetingAddress: string;
  meetingType: string;
  status: string;
  attendees: string;
  purpose: string;
  siteStatus: string;
  organizationInfo: string;
  advertisingOperation: string;
  advertisingBudget: string;
  advertisingSupport: string;
  siteMovePlan: string;
  decisionAuthority: string;
  customerRequest: string;
  closingJudgement: string;
  followUpAction: string;
  nextMeetingAt: string;
  resultMemo: string;
};

type SiteMoveForm = {
  currentSite: string;
  destinationSite: string;
  destinationRegion: string;
  plannedMoveDate: string;
  moveStatus: string;
  isConfirmed: boolean;
  memo: string;
};

type ContactEditForm = {
  name: string;
  title: string;
  phone: string;
  intakeRoute: string;
  company: string;
  currentSite: string;
  sourcingOwner: string;
  closingOwner: string;
  managementStatus: string;
};

type DeleteMode = "managed_only" | "permanent";

const MANAGEMENT_STATUSES = ["미팅예정", "관리중", "집중관리", "장기관리", "재접촉예정", "보류"];
const MEETING_STATUSES = ["예정", "완료", "변경", "취소", "불발"];
const MEETING_TYPES = ["최초미팅", "관리미팅", "광고미팅", "후속미팅", "기타"];
const MOVE_STATUSES = ["계획", "조율중", "확정", "이동완료", "취소", "연기"];
const TABS = ["고객개요", "미팅기록", "상세정보", "활동노트", "현장이동", "변경히스토리"] as const;
type TabName = (typeof TABS)[number];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getUserName() {
  return getCurrentUser()?.name || "현재 사용자";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`premium-card ${className}`}>{children}</div>;
}

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "blue" | "green" | "amber" | "purple" | "red" }) {
  const styles = {
    default: { background: "var(--surface-2)", color: "var(--text-subtle)", borderColor: "var(--border-subtle)" },
    blue: { background: "var(--info-bg)", color: "var(--info-text)", borderColor: "var(--info-border)" },
    green: { background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" },
    amber: { background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" },
    purple: { background: "var(--purple-bg)", color: "var(--purple-text)", borderColor: "var(--purple-border)" },
    red: { background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" },
  }[tone];
  return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold" style={styles}>{children}</span>;
}

function GradePill({ grade }: { grade?: string | null }) {
  const tone = grade === "A" ? "green" : grade === "B" ? "blue" : grade === "C" ? "amber" : "default";
  return <Pill tone={tone}>{grade ? `${grade}등급` : "미등급"}</Pill>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>{children}</label>;
}

const inputClass = "h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none";
const textareaClass = "w-full rounded-[10px] border px-3 py-2.5 text-[13px] font-medium leading-relaxed outline-none";
const inputStyle = { background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" };

function Modal({ title, subtitle, onClose, children, maxWidth = "880px" }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="premium-card max-h-[94vh] w-full overflow-hidden" style={{ maxWidth }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border-subtle)" }}>
          <div><h2 className="crm-title">{title}</h2>{subtitle && <p className="crm-subtitle mt-1">{subtitle}</p>}</div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
        </div>
        <div className="max-h-[calc(94vh-76px)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function profileToForm(profile?: Profile): ProfileForm {
  return {
    managementStatus: profile?.management_status || "미팅예정",
    siteStatus: profile?.site_status || "",
    organizationInfo: profile?.organization_info || "",
    advertisingOperation: profile?.advertising_operation || "",
    advertisingBudget: profile?.advertising_budget || "",
    advertisingSupport: profile?.advertising_support || "",
    siteMovePlan: profile?.site_move_plan || "",
    decisionAuthority: profile?.decision_authority || "",
    customerNeeds: profile?.customer_needs || "",
    nextManagementAt: profile?.next_management_at ? profile.next_management_at.slice(0, 16) : "",
  };
}

function contactToEditForm(contact?: Contact | null, profile?: Profile): ContactEditForm {
  return {
    name: contact?.name || "",
    title: contact?.title || "",
    phone: contact?.phone || "",
    intakeRoute: contact?.intake_route || "",
    company: contact?.company || "",
    currentSite: contact?.current_site || "",
    sourcingOwner: contact?.sourcing_owner || contact?.assigned_to || "",
    closingOwner: contact?.closing_owner || "",
    managementStatus: profile?.management_status || contact?.management_status || "미팅예정",
  };
}

function toKstInputParts(value?: string | null) {
  if (!value) return { date: today(), time: "14:00", datetime: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: today(), time: "14:00", datetime: "" };
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return { date: kst.slice(0, 10), time: kst.slice(11, 16), datetime: kst.slice(0, 16) };
}

export default function ManagedCustomersPage() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const userName = currentUser?.name || getUserName();
  const canManageCustomer = hasCrmFullAccess(currentUser);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [siteMoves, setSiteMoves] = useState<SiteMove[]>([]);
  const [histories, setHistories] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("고객개요");
  const [showMeeting, setShowMeeting] = useState(false);
  const [showSiteMove, setShowSiteMove] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [showDeleteCustomer, setShowDeleteCustomer] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>("managed_only");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingSiteMoveId, setEditingSiteMoveId] = useState<number | null>(null);
  const [contactEditForm, setContactEditForm] = useState<ContactEditForm>(() => contactToEditForm());
  const [grade, setGrade] = useState("");
  const [gradeReason, setGradeReason] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileForm>(() => profileToForm());
  const [meetingForm, setMeetingForm] = useState<MeetingForm>({
    meetingDate: today(),
    meetingTime: "14:00",
    meetingAddress: "",
    meetingType: "관리미팅",
    status: "완료",
    attendees: "",
    purpose: "",
    siteStatus: "",
    organizationInfo: "",
    advertisingOperation: "",
    advertisingBudget: "",
    advertisingSupport: "",
    siteMovePlan: "",
    decisionAuthority: "",
    customerRequest: "",
    closingJudgement: "",
    followUpAction: "",
    nextMeetingAt: "",
    resultMemo: "",
  });
  const [siteMoveForm, setSiteMoveForm] = useState<SiteMoveForm>({
    currentSite: "",
    destinationSite: "",
    destinationRegion: "",
    plannedMoveDate: today(),
    moveStatus: "계획",
    isConfirmed: false,
    memo: "",
  });

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const contactRes = await supabase
      .from("contacts")
      .select("id,name,title,phone,intake_route,company,current_site,sourcing_owner,assigned_to,closing_owner,managed_customer_grade,management_status,handoff_at,meeting_date,meeting_date_text,meeting_address,created_at")
      .eq("crm_db_source", "managed_customer")
      .order("handoff_at", { ascending: false, nullsFirst: false })
      .limit(5000);
    const rows = (contactRes.data || []) as Contact[];
    const ids = rows.map((row) => row.id);
    if (!ids.length) {
      setContacts([]); setProfiles([]); setMeetings([]); setNotes([]); setSiteMoves([]); setHistories([]); setLoading(false); return;
    }
    const [profileRes, meetingRes, noteRes, moveRes, historyRes] = await Promise.all([
      supabase.from("managed_customer_profiles").select("*").in("contact_id", ids).limit(5000),
      supabase.from("customer_meetings").select("*").in("contact_id", ids).order("meeting_at", { ascending: false }).limit(10000),
      supabase.from("contact_notes").select("id,contact_id,note_date,content,author,created_at").in("contact_id", ids).order("created_at", { ascending: false }).limit(10000),
      supabase.from("customer_site_moves").select("*").in("contact_id", ids).order("planned_move_date", { ascending: true }).limit(10000),
      supabase.from("customer_change_history").select("*").in("contact_id", ids).order("created_at", { ascending: false }).limit(10000),
    ]);
    if (contactRes.error) console.error(contactRes.error);
    setContacts(rows);
    setProfiles((profileRes.data || []) as Profile[]);
    setMeetings((meetingRes.data || []) as Meeting[]);
    setNotes((noteRes.data || []) as Note[]);
    setSiteMoves((moveRes.data || []) as SiteMove[]);
    setHistories((historyRes.data || []) as HistoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
    const queryId = new URLSearchParams(window.location.search).get("contact");
    if (queryId) setSelectedId(Number(queryId));
    const channel = supabase.channel("managed-customers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "managed_customer_profiles" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_meetings" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_notes" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_site_moves" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_change_history" }, () => void fetchData(true))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchData]);

  const profileMap = useMemo(() => new Map(profiles.map((row) => [row.contact_id, row])), [profiles]);
  const selected = contacts.find((row) => row.id === selectedId) || null;
  const selectedProfile = selected ? profileMap.get(selected.id) : undefined;
  const selectedMeetings = meetings.filter((row) => row.contact_id === selectedId);
  const selectedNotes = notes.filter((row) => row.contact_id === selectedId);
  const selectedMoves = siteMoves.filter((row) => row.contact_id === selectedId);
  const selectedHistories = histories.filter((row) => row.contact_id === selectedId);

  useEffect(() => {
    setProfileForm(profileToForm(selectedProfile));
    setContactEditForm(contactToEditForm(selected, selectedProfile));
    setGrade(selectedProfile?.grade || selected?.managed_customer_grade || "");
    setGradeReason(selectedProfile?.grade_reason || "");
    if (selected) setSiteMoveForm((prev) => ({ ...prev, currentSite: selected.current_site || selected.company || "" }));
  }, [selected, selectedProfile]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const profile = profileMap.get(contact.id);
      const gradeValue = profile?.grade || contact.managed_customer_grade || "";
      const statusValue = profile?.management_status || contact.management_status || "미팅예정";
      const keywordMatch = !keyword || [contact.name, contact.title, contact.phone, contact.current_site, contact.company, contact.closing_owner, contact.sourcing_owner]
        .filter(Boolean).join(" ").toLowerCase().includes(keyword);
      return keywordMatch && (!gradeFilter || gradeValue === gradeFilter) && (!statusFilter || statusValue === statusFilter);
    });
  }, [contacts, gradeFilter, profileMap, search, statusFilter]);

  const metrics = useMemo(() => ({
    total: contacts.length,
    a: contacts.filter((row) => (profileMap.get(row.id)?.grade || row.managed_customer_grade) === "A").length,
    meetingSoon: meetings.filter((row) => row.status === "예정" && new Date(row.meeting_at).getTime() >= Date.now()).length,
    moveSoon: siteMoves.filter((row) => !["이동완료", "취소"].includes(row.move_status)).length,
  }), [contacts, meetings, profileMap, siteMoves]);

  async function logHistory(contactId: number, eventType: string, fieldName: string, oldValue: string | null, newValue: string | null, reason?: string) {
    const { error } = await supabase.from("customer_change_history").insert({
      contact_id: contactId,
      event_type: eventType,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      change_reason: reason || null,
      source_screen: "관리고객",
      changed_by: userName,
    });
    if (error) console.warn(error.message);
  }

  function openContactEdit() {
    if (!selected) return;
    setContactEditForm(contactToEditForm(selected, selectedProfile));
    setShowContactEdit(true);
  }

  async function saveContactEdit() {
    if (!selected || !contactEditForm.name.trim()) {
      alert("고객명을 입력해주세요.");
      return;
    }
    if (!canManageCustomer) {
      alert("관리자·최연전·이세호·기여운만 고객 기본정보를 수정할 수 있습니다.");
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch(`/api/managed-customers/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactEditForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "고객정보 수정에 실패했습니다.");

      setShowContactEdit(false);
      await fetchData(true);
      alert("고객 기본정보가 수정되었습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "고객정보 수정 중 오류가 발생했습니다.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteCustomer() {
    if (!selected) return;
    if (!canManageCustomer) {
      alert("관리자·최연전·이세호·기여운만 관리고객을 삭제할 수 있습니다.");
      return;
    }
    setDeleteMode("managed_only");
    setDeleteConfirmText("");
    setShowDeleteCustomer(true);
  }

  async function deleteCustomer() {
    if (!selected) return;
    if (!canManageCustomer) {
      alert("관리자·최연전·이세호·기여운만 관리고객을 삭제할 수 있습니다.");
      return;
    }
    if (deleteConfirmText.trim() !== selected.name) {
      alert(`확인을 위해 고객명 '${selected.name}'을 정확히 입력해주세요.`);
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch("/api/managed-customers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selected.id,
          mode: deleteMode,
          confirmationName: deleteConfirmText.trim(),
        }),
      });

      const rawBody = await response.text();
      let result: {
        success?: boolean;
        error?: string;
        message?: string;
        warnings?: string[];
      } = {};

      if (rawBody) {
        try {
          result = JSON.parse(rawBody) as typeof result;
        } catch {
          result = {};
        }
      }

      if (!response.ok) {
        const serverDetail = rawBody && !result.error
          ? `\n\n서버 응답: ${rawBody.slice(0, 500)}`
          : "";
        throw new Error(
          result.error ||
          `삭제 API 오류 (${response.status} ${response.statusText})${serverDetail}`,
        );
      }

      setShowDeleteCustomer(false);
      setDeleteConfirmText("");
      setSelectedId(null);
      await fetchData(true);

      const warningText = result.warnings && result.warnings.length > 0
        ? `\n\n경고:\n- ${result.warnings.join("\n- ")}`
        : "";

      alert(
        `${result.message || (deleteMode === "permanent"
          ? "고객과 연결된 CRM 데이터가 완전히 삭제되었습니다."
          : "관리고객에서 제거하고 신규DB2 재접촉 대상으로 이동했습니다.")}${warningText}`,
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "관리고객 삭제 중 오류가 발생했습니다.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  function openNewMeeting() {
    setEditingMeetingId(null);
    setMeetingForm({
      meetingDate: today(),
      meetingTime: "14:00",
      meetingAddress: "",
      meetingType: "관리미팅",
      status: "완료",
      attendees: "",
      purpose: "",
      siteStatus: "",
      organizationInfo: "",
      advertisingOperation: "",
      advertisingBudget: "",
      advertisingSupport: "",
      siteMovePlan: "",
      decisionAuthority: "",
      customerRequest: "",
      closingJudgement: "",
      followUpAction: "",
      nextMeetingAt: "",
      resultMemo: "",
    });
    setShowMeeting(true);
  }

  function openMeetingEdit(meeting: Meeting) {
    const meetingParts = toKstInputParts(meeting.meeting_at);
    const nextParts = toKstInputParts(meeting.next_meeting_at);
    setEditingMeetingId(meeting.id);
    setMeetingForm({
      meetingDate: meetingParts.date,
      meetingTime: meetingParts.time,
      meetingAddress: meeting.meeting_address || "",
      meetingType: meeting.meeting_type,
      status: meeting.status,
      attendees: meeting.attendees || "",
      purpose: meeting.purpose || "",
      siteStatus: meeting.site_status || "",
      organizationInfo: meeting.organization_info || "",
      advertisingOperation: meeting.advertising_operation || "",
      advertisingBudget: meeting.advertising_budget || "",
      advertisingSupport: meeting.advertising_support || "",
      siteMovePlan: meeting.site_move_plan || "",
      decisionAuthority: meeting.decision_authority || "",
      customerRequest: meeting.customer_request || "",
      closingJudgement: meeting.closing_judgement || "",
      followUpAction: meeting.follow_up_action || "",
      nextMeetingAt: meeting.next_meeting_at ? nextParts.datetime : "",
      resultMemo: meeting.result_memo || "",
    });
    setShowMeeting(true);
  }

  async function deleteMeeting(meeting: Meeting) {
    if (!selected || !confirm(`${formatDateTime(meeting.meeting_at)} 미팅기록을 삭제하시겠습니까?`)) return;
    setSaving(true);
    const { error } = await supabase.from("customer_meetings").delete().eq("id", meeting.id).eq("contact_id", selected.id);
    setSaving(false);
    if (error) {
      alert(`미팅기록 삭제 실패: ${error.message}`);
      return;
    }
    await logHistory(selected.id, "미팅기록 삭제", "meeting_at", meeting.meeting_at, null, meeting.purpose || undefined);
    await fetchData(true);
  }

  function openNewNote() {
    setEditingNoteId(null);
    setNoteContent("");
    setShowNote(true);
  }

  function openNoteEdit(note: Note) {
    setEditingNoteId(note.id);
    setNoteContent(note.content.replace(/^\[관리활동\]\s*/, ""));
    setShowNote(true);
  }

  async function deleteNote(note: Note) {
    if (!selected || !confirm("이 활동노트를 삭제하시겠습니까?")) return;
    setSaving(true);
    const { error } = await supabase.from("contact_notes").delete().eq("id", note.id).eq("contact_id", selected.id);
    setSaving(false);
    if (error) {
      alert(`활동노트 삭제 실패: ${error.message}`);
      return;
    }
    await logHistory(selected.id, "활동노트 삭제", "contact_notes", note.content, null);
    await fetchData(true);
  }

  function openNewSiteMove() {
    setEditingSiteMoveId(null);
    setSiteMoveForm({
      currentSite: selected?.current_site || selected?.company || "",
      destinationSite: "",
      destinationRegion: "",
      plannedMoveDate: today(),
      moveStatus: "계획",
      isConfirmed: false,
      memo: "",
    });
    setShowSiteMove(true);
  }

  function openSiteMoveEdit(move: SiteMove) {
    setEditingSiteMoveId(move.id);
    setSiteMoveForm({
      currentSite: move.current_site || "",
      destinationSite: move.destination_site,
      destinationRegion: move.destination_region || "",
      plannedMoveDate: move.planned_move_date,
      moveStatus: move.move_status,
      isConfirmed: move.is_confirmed,
      memo: move.memo || "",
    });
    setShowSiteMove(true);
  }

  async function deleteSiteMove(move: SiteMove) {
    if (!selected || !confirm(`${move.destination_site} 현장이동 일정을 삭제하시겠습니까?\n현장캘린더에서도 함께 사라집니다.`)) return;
    setSaving(true);
    const { error } = await supabase.from("customer_site_moves").delete().eq("id", move.id).eq("contact_id", selected.id);
    setSaving(false);
    if (error) {
      alert(`현장이동 삭제 실패: ${error.message}`);
      return;
    }
    await logHistory(selected.id, "현장이동 삭제", "destination_site", move.destination_site, null, move.memo || undefined);
    await fetchData(true);
  }

  async function saveProfile() {
    if (!selected) return;
    setSaving(true);
    const previousStatus = selectedProfile?.management_status || selected.management_status || "미팅예정";
    const payload = {
      contact_id: selected.id,
      management_status: profileForm.managementStatus,
      site_status: profileForm.siteStatus || null,
      organization_info: profileForm.organizationInfo || null,
      advertising_operation: profileForm.advertisingOperation || null,
      advertising_budget: profileForm.advertisingBudget || null,
      advertising_support: profileForm.advertisingSupport || null,
      site_move_plan: profileForm.siteMovePlan || null,
      decision_authority: profileForm.decisionAuthority || null,
      customer_needs: profileForm.customerNeeds || null,
      next_management_at: profileForm.nextManagementAt ? new Date(`${profileForm.nextManagementAt}:00+09:00`).toISOString() : null,
      updated_by: userName,
    };
    const [profileRes, contactRes] = await Promise.all([
      supabase.from("managed_customer_profiles").upsert(payload, { onConflict: "contact_id" }),
      supabase.from("contacts").update({ management_status: profileForm.managementStatus }).eq("id", selected.id),
    ]);
    setSaving(false);
    if (profileRes.error || contactRes.error) { alert(`저장 실패: ${profileRes.error?.message || contactRes.error?.message}`); return; }
    if (previousStatus !== profileForm.managementStatus) await logHistory(selected.id, "관리상태 변경", "management_status", previousStatus, profileForm.managementStatus);
    await fetchData(true);
    alert("상세 고객정보를 저장했습니다.");
  }

  async function saveGrade() {
    if (!selected || !["A", "B", "C"].includes(grade) || !gradeReason.trim()) {
      alert("등급과 등급 사유를 입력해주세요."); return;
    }
    const previousGrade = selectedProfile?.grade || selected.managed_customer_grade || "미등급";
    setSaving(true);
    const now = new Date().toISOString();
    const [profileRes, contactRes] = await Promise.all([
      supabase.from("managed_customer_profiles").upsert({
        contact_id: selected.id,
        grade,
        grade_reason: gradeReason.trim(),
        grade_updated_at: now,
        grade_updated_by: userName,
        management_status: selectedProfile?.management_status || selected.management_status || "미팅예정",
        updated_by: userName,
      }, { onConflict: "contact_id" }),
      supabase.from("contacts").update({ managed_customer_grade: grade }).eq("id", selected.id),
    ]);
    setSaving(false);
    if (profileRes.error || contactRes.error) { alert(`등급 저장 실패: ${profileRes.error?.message || contactRes.error?.message}`); return; }
    await logHistory(selected.id, "고객등급 변경", "grade", previousGrade, grade, gradeReason.trim());
    setShowGrade(false);
    await fetchData(true);
  }

  async function saveMeeting() {
    if (!selected || !meetingForm.meetingDate || !meetingForm.meetingTime) { alert("미팅 일시를 입력해주세요."); return; }
    const meetingAt = new Date(`${meetingForm.meetingDate}T${meetingForm.meetingTime}:00+09:00`).toISOString();
    const payload = {
      contact_id: selected.id,
      meeting_at: meetingAt,
      meeting_address: meetingForm.meetingAddress || null,
      meeting_type: meetingForm.meetingType,
      status: meetingForm.status,
      attendees: meetingForm.attendees || null,
      purpose: meetingForm.purpose || null,
      site_status: meetingForm.siteStatus || null,
      organization_info: meetingForm.organizationInfo || null,
      advertising_operation: meetingForm.advertisingOperation || null,
      advertising_budget: meetingForm.advertisingBudget || null,
      advertising_support: meetingForm.advertisingSupport || null,
      site_move_plan: meetingForm.siteMovePlan || null,
      decision_authority: meetingForm.decisionAuthority || null,
      customer_request: meetingForm.customerRequest || null,
      closing_judgement: meetingForm.closingJudgement || null,
      follow_up_action: meetingForm.followUpAction || null,
      next_meeting_at: meetingForm.nextMeetingAt ? new Date(`${meetingForm.nextMeetingAt}:00+09:00`).toISOString() : null,
      result_memo: meetingForm.resultMemo || null,
      created_by: userName,
    };
    setSaving(true);
    const query = editingMeetingId
      ? supabase.from("customer_meetings").update(payload).eq("id", editingMeetingId).eq("contact_id", selected.id)
      : supabase.from("customer_meetings").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) { alert(`미팅기록 저장 실패: ${error.message}`); return; }
    await logHistory(
      selected.id,
      editingMeetingId ? "미팅기록 수정" : "미팅기록 추가",
      "meeting_at",
      editingMeetingId ? selectedMeetings.find((row) => row.id === editingMeetingId)?.meeting_at || null : null,
      meetingAt,
      meetingForm.purpose,
    );
    setEditingMeetingId(null);
    setShowMeeting(false);
    await fetchData(true);
  }

  async function saveNote() {
    if (!selected || !noteContent.trim()) { alert("활동노트를 입력해주세요."); return; }
    const content = `[관리활동] ${noteContent.trim()}`;
    setSaving(true);
    const query = editingNoteId
      ? supabase.from("contact_notes").update({ content, author: userName }).eq("id", editingNoteId).eq("contact_id", selected.id)
      : supabase.from("contact_notes").insert({ contact_id: selected.id, note_date: today(), content, author: userName });
    const { error } = await query;
    setSaving(false);
    if (error) { alert(`활동노트 저장 실패: ${error.message}`); return; }
    await logHistory(
      selected.id,
      editingNoteId ? "활동노트 수정" : "활동노트 추가",
      "contact_notes",
      editingNoteId ? selectedNotes.find((row) => row.id === editingNoteId)?.content || null : null,
      content,
      noteContent.trim(),
    );
    setEditingNoteId(null);
    setNoteContent("");
    setShowNote(false);
    await fetchData(true);
  }

  async function saveSiteMove() {
    if (!selected || !siteMoveForm.destinationSite.trim() || !siteMoveForm.plannedMoveDate) { alert("이동예정 현장과 이동예정일을 입력해주세요."); return; }
    const payload = {
      contact_id: selected.id,
      current_site: siteMoveForm.currentSite || null,
      destination_site: siteMoveForm.destinationSite.trim(),
      destination_region: siteMoveForm.destinationRegion || null,
      planned_move_date: siteMoveForm.plannedMoveDate,
      move_status: siteMoveForm.moveStatus,
      is_confirmed: siteMoveForm.isConfirmed,
      memo: siteMoveForm.memo || null,
      created_by: userName,
    };
    setSaving(true);
    const query = editingSiteMoveId
      ? supabase.from("customer_site_moves").update(payload).eq("id", editingSiteMoveId).eq("contact_id", selected.id)
      : supabase.from("customer_site_moves").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) { alert(`현장이동 저장 실패: ${error.message}`); return; }
    const previousMove = editingSiteMoveId ? selectedMoves.find((row) => row.id === editingSiteMoveId) : undefined;
    await logHistory(
      selected.id,
      editingSiteMoveId ? "현장이동 수정" : "현장이동 등록",
      "destination_site",
      previousMove?.destination_site || selected.current_site || selected.company || null,
      siteMoveForm.destinationSite,
      siteMoveForm.memo,
    );
    setEditingSiteMoveId(null);
    setShowSiteMove(false);
    await fetchData(true);
  }

  return (
    <main className="space-y-5 p-4 md:p-6 xl:p-8">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div><div className="mb-2 flex gap-2"><Pill tone="purple">CLOSING CRM</Pill><Pill>신규 메뉴</Pill></div><h1 className="text-[28px] font-[820] tracking-[-0.045em]" style={{ color: "var(--text-strong)" }}>관리고객</h1><p className="crm-subtitle mt-1">미팅 이후 상세정보, A·B·C등급, 활동노트, 현장이동과 모든 변경 이력을 관리합니다.</p></div>
        <div className="flex gap-2"><a href="/site-calendar" className="btn-premium btn-secondary h-10"><CalendarDays size={15} /> 현장캘린더</a><button type="button" onClick={() => void fetchData()} className="btn-premium btn-secondary h-10"><RefreshCcw size={15} /> 새로고침</button></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "전체 관리고객", value: metrics.total, icon: UsersRound, sub: "이관 누적 고객" },
          { label: "A등급 고객", value: metrics.a, icon: BadgeCheck, sub: "집중 관리 대상" },
          { label: "예정 미팅", value: metrics.meetingSoon, icon: CalendarDays, sub: "예정 상태 미팅" },
          { label: "현장이동 관리", value: metrics.moveSoon, icon: MapPin, sub: "진행 중 이동계획" },
        ].map((metric) => { const Icon = metric.icon; return <Card key={metric.label} className="p-4"><div className="flex items-start justify-between"><div><p className="crm-tiny">{metric.label}</p><p className="mt-2 text-[28px] font-[820]" style={{ color: "var(--text-strong)" }}>{metric.value}<span className="ml-1 text-[13px]">건</span></p><p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>{metric.sub}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}><Icon size={18} /></div></div></Card>; })}
      </section>

      <Card className="p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} style={inputStyle} placeholder="고객명, 연락처, 현장명, 담당자 검색" /></div><select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className={inputClass} style={{ ...inputStyle, width: 140 }}><option value="">등급 전체</option><option value="A">A등급</option><option value="B">B등급</option><option value="C">C등급</option></select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass} style={{ ...inputStyle, width: 160 }}><option value="">관리상태 전체</option>{MANAGEMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div></Card>

      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="min-w-[1180px] w-full text-center"><thead><tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>{["등급", "고객명", "직급", "현재 현장", "클로징 담당자", "소싱 담당자", "최초 미팅", "최근 활동", "현장이동 예정", "다음 관리", "관리상태", "상세"].map((head) => <th key={head} className="px-3 py-3 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{head}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={12} className="py-20"><Loader2 className="mx-auto animate-spin" /></td></tr> : filtered.length === 0 ? <tr><td colSpan={12} className="py-20 text-[13px]" style={{ color: "var(--text-faint)" }}>관리고객 데이터가 없습니다.</td></tr> : filtered.map((contact) => {
        const profile = profileMap.get(contact.id);
        const customerMeetings = meetings.filter((row) => row.contact_id === contact.id);
        const customerNotes = notes.filter((row) => row.contact_id === contact.id);
        const customerMoves = siteMoves.filter((row) => row.contact_id === contact.id && !["이동완료", "취소"].includes(row.move_status));
        const latestMeeting = customerMeetings[0];
        const upcomingMove = customerMoves[0];
        return <tr key={contact.id} onClick={() => { setSelectedId(contact.id); setActiveTab("고객개요"); }} className="cursor-pointer transition hover:brightness-110" style={{ borderBottom: "1px solid var(--border-subtle)" }}><td className="px-3 py-3"><GradePill grade={profile?.grade || contact.managed_customer_grade} /></td><td className="px-3 py-3 text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{contact.name}</td><td className="px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.title || "-"}</td><td className="max-w-[170px] truncate px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.current_site || contact.company || "-"}</td><td className="px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.closing_owner || "-"}</td><td className="px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.sourcing_owner || contact.assigned_to || "-"}</td><td className="px-3 py-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>{formatDateTime(latestMeeting?.meeting_at || contact.meeting_date)}</td><td className="px-3 py-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>{formatDateTime(customerNotes[0]?.created_at)}</td><td className="px-3 py-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>{upcomingMove ? `${upcomingMove.destination_site} · ${upcomingMove.planned_move_date}` : "-"}</td><td className="px-3 py-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>{formatDateTime(profile?.next_management_at)}</td><td className="px-3 py-3"><Pill tone="purple">{profile?.management_status || contact.management_status || "미팅예정"}</Pill></td><td className="px-3 py-3"><ChevronRight size={16} className="mx-auto" /></td></tr>;
      })}</tbody></table></div></Card>

      {selected && <div className="fixed inset-0 z-[80] bg-black/35" onClick={() => setSelectedId(null)}><aside className="absolute right-0 top-0 h-full w-full max-w-[920px] overflow-y-auto border-l p-5 shadow-2xl" style={{ background: "var(--bg)", borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[24px] font-[820]" style={{ color: "var(--text-strong)" }}>{selected.name}</h2><Pill tone="purple">{selected.title || "직급 미지정"}</Pill><GradePill grade={selectedProfile?.grade || selected.managed_customer_grade} /></div><p className="crm-subtitle mt-1">{selected.phone || "연락처 없음"} · {selected.current_site || selected.company || "현장 미입력"}</p></div><div className="flex items-center gap-2">{canManageCustomer && <><button onClick={openContactEdit} className="btn-premium btn-secondary h-9 px-3"><Pencil size={14} /> 고객정보 수정</button><button onClick={openDeleteCustomer} className="btn-premium btn-danger h-9 px-3"><Trash2 size={14} /> 삭제</button></>}<button onClick={() => setSelectedId(null)} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button></div></div>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={openNewMeeting} className="btn-premium btn-primary h-10"><Plus size={15} /> 미팅기록</button><button onClick={openNewNote} className="btn-premium btn-secondary h-10"><MessageSquareText size={15} /> 활동노트</button><button onClick={openNewSiteMove} className="btn-premium btn-secondary h-10"><MapPin size={15} /> 현장이동</button><button onClick={() => setShowGrade(true)} className="btn-premium btn-secondary h-10"><BadgeCheck size={15} /> 등급설정</button></div>
        <div className="mt-5 flex overflow-x-auto border-b" style={{ borderColor: "var(--border-subtle)" }}>{TABS.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className="shrink-0 border-b-2 px-4 py-3 text-[12px] font-bold" style={{ borderColor: activeTab === tab ? "var(--accent)" : "transparent", color: activeTab === tab ? "var(--accent-text)" : "var(--text-muted)" }}>{tab}</button>)}</div>

        <div className="mt-5">
          {activeTab === "고객개요" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["유입경로", selected.intake_route || "-"], ["소싱 담당자", selected.sourcing_owner || selected.assigned_to || "-"], ["클로징 담당자", selected.closing_owner || "-"], ["관리상태", selectedProfile?.management_status || selected.management_status || "미팅예정"], ["이관일", formatDateTime(selected.handoff_at)], ["다음 관리", formatDateTime(selectedProfile?.next_management_at)]].map(([label, value]) => <Card key={label} className="p-3"><p className="crm-tiny">{label}</p><p className="mt-1 text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{value}</p></Card>)}</div><Card className="p-4"><h3 className="text-[14px] font-bold" style={{ color: "var(--text-strong)" }}>핵심 관리정보</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{[["현장상태", selectedProfile?.site_status], ["조직정보", selectedProfile?.organization_info], ["광고운영", selectedProfile?.advertising_operation], ["광고비 규모", selectedProfile?.advertising_budget], ["광고비 지원", selectedProfile?.advertising_support], ["의사결정권", selectedProfile?.decision_authority], ["현장이동 계획", selectedProfile?.site_move_plan], ["고객 니즈", selectedProfile?.customer_needs]].map(([label, value]) => <div key={label} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)" }}><p className="crm-tiny">{label}</p><p className="mt-1 whitespace-pre-wrap text-[12px]" style={{ color: "var(--text-subtle)" }}>{value || "미입력"}</p></div>)}</div></Card></div>}

          {activeTab === "미팅기록" && <div className="space-y-3">{selectedMeetings.length === 0 ? <Card className="p-10 text-center text-[12px]" >미팅기록이 없습니다.</Card> : selectedMeetings.map((meeting) => <Card key={meeting.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Pill tone={meeting.status === "완료" ? "green" : meeting.status === "예정" ? "blue" : "amber"}>{meeting.status}</Pill><Pill>{meeting.meeting_type}</Pill><p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{formatDateTime(meeting.meeting_at)}</p></div><div className="flex items-center gap-2"><span className="text-[10px]" style={{ color: "var(--text-faint)" }}>작성자 {meeting.created_by || "-"}</span>{canManageCustomer && <><button type="button" onClick={() => openMeetingEdit(meeting)} className="btn-premium btn-secondary h-8 px-2.5 text-[11px]"><Pencil size={12} /> 수정</button><button type="button" onClick={() => void deleteMeeting(meeting)} className="btn-premium btn-danger h-8 px-2.5 text-[11px]"><Trash2 size={12} /> 삭제</button></>}</div></div><p className="mt-2 text-[12px]" style={{ color: "var(--text-subtle)" }}>{meeting.meeting_address || "장소 미입력"} · {meeting.purpose || "목적 미입력"}</p><div className="mt-3 grid gap-2 md:grid-cols-2">{[["현장상태", meeting.site_status], ["조직정보", meeting.organization_info], ["광고운영", meeting.advertising_operation], ["광고비 규모", meeting.advertising_budget], ["광고비 지원", meeting.advertising_support], ["의사결정권", meeting.decision_authority], ["고객 요청", meeting.customer_request], ["후속조치", meeting.follow_up_action]].map(([label, value]) => value ? <div key={label} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border-subtle)" }}><p className="crm-tiny">{label}</p><p className="mt-1 whitespace-pre-wrap text-[12px]" style={{ color: "var(--text-subtle)" }}>{value}</p></div> : null)}</div></Card>)}</div>}

          {activeTab === "상세정보" && <Card className="p-4"><div className="grid gap-4 md:grid-cols-2"><Field label="관리상태"><select value={profileForm.managementStatus} onChange={(e) => setProfileForm((p) => ({ ...p, managementStatus: e.target.value }))} className={inputClass} style={inputStyle}>{MANAGEMENT_STATUSES.map((v) => <option key={v}>{v}</option>)}</select></Field><Field label="다음 관리일"><input type="datetime-local" value={profileForm.nextManagementAt} onChange={(e) => setProfileForm((p) => ({ ...p, nextManagementAt: e.target.value }))} className={inputClass} style={inputStyle} /></Field>{[["현장상태", "siteStatus"], ["조직정보", "organizationInfo"], ["광고운영", "advertisingOperation"], ["광고비 규모", "advertisingBudget"], ["광고비 지원여부", "advertisingSupport"], ["현장이동 계획", "siteMovePlan"], ["의사결정권 유무", "decisionAuthority"], ["고객 니즈", "customerNeeds"]].map(([label, key]) => <Field key={key} label={label}><textarea rows={3} value={profileForm[key as keyof ProfileForm]} onChange={(e) => setProfileForm((p) => ({ ...p, [key]: e.target.value }))} className={textareaClass} style={inputStyle} /></Field>)}</div><div className="mt-5 flex justify-end"><button onClick={() => void saveProfile()} disabled={saving} className="btn-premium btn-primary h-10"><Save size={15} /> {saving ? "저장 중..." : "상세정보 저장"}</button></div></Card>}

          {activeTab === "활동노트" && <div className="space-y-2">{selectedNotes.length === 0 ? <Card className="p-10 text-center text-[12px]">활동노트가 없습니다.</Card> : selectedNotes.map((note) => <Card key={note.id} className="p-4"><div className="flex items-start justify-between gap-2"><Pill tone={note.content.startsWith("[관리활동]") ? "purple" : "blue"}>{note.content.match(/^\[([^\]]+)\]/)?.[1] || "활동"}</Pill><div className="flex items-center gap-2"><span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{formatDateTime(note.created_at)}</span>{canManageCustomer && <><button type="button" onClick={() => openNoteEdit(note)} className="btn-premium btn-secondary h-8 px-2.5 text-[11px]"><Pencil size={12} /> 수정</button><button type="button" onClick={() => void deleteNote(note)} className="btn-premium btn-danger h-8 px-2.5 text-[11px]"><Trash2 size={12} /> 삭제</button></>}</div></div><p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>{note.content}</p><p className="mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>작성자 {note.author || "-"}</p></Card>)}</div>}

          {activeTab === "현장이동" && <div className="space-y-3">{selectedMoves.length === 0 ? <Card className="p-10 text-center text-[12px]">현장이동 기록이 없습니다.</Card> : selectedMoves.map((move) => <Card key={move.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Pill tone={move.is_confirmed ? "green" : "amber"}>{move.move_status}</Pill><p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{move.current_site || "현재현장 미입력"} → {move.destination_site}</p></div><div className="flex items-center gap-2"><p className="text-[12px] font-bold" style={{ color: "var(--accent-text)" }}>{move.planned_move_date}</p>{canManageCustomer && <><button type="button" onClick={() => openSiteMoveEdit(move)} className="btn-premium btn-secondary h-8 px-2.5 text-[11px]"><Pencil size={12} /> 수정</button><button type="button" onClick={() => void deleteSiteMove(move)} className="btn-premium btn-danger h-8 px-2.5 text-[11px]"><Trash2 size={12} /> 삭제</button></>}</div></div><p className="mt-2 text-[12px]" style={{ color: "var(--text-subtle)" }}>{move.destination_region || "지역 미입력"} · {move.memo || "비고 없음"}</p></Card>)}</div>}

          {activeTab === "변경히스토리" && <div className="space-y-2">{selectedHistories.length === 0 ? <Card className="p-10 text-center text-[12px]">변경히스토리가 없습니다.</Card> : selectedHistories.map((row) => <Card key={row.id} className="p-4"><div className="flex gap-3"><FileClock size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent-text)" }} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{row.event_type}</p><span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{formatDateTime(row.created_at)}</span></div><p className="mt-1 text-[12px]" style={{ color: "var(--text-subtle)" }}>{[row.old_value, row.new_value].filter(Boolean).join(" → ") || row.change_reason || "변경 기록"}</p><p className="mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>{row.source_screen || "CRM"} · {row.changed_by || "시스템"}</p></div></div></Card>)}</div>}
        </div>
      </aside></div>}

      {selected && showContactEdit && <Modal title="관리고객 기본정보 수정" subtitle="고객카드 상단과 목록에 표시되는 기본정보를 수정합니다." onClose={() => setShowContactEdit(false)} maxWidth="760px">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="고객명 *"><input value={contactEditForm.name} onChange={(e) => setContactEditForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
          <Field label="직급"><input value={contactEditForm.title} onChange={(e) => setContactEditForm((p) => ({ ...p, title: e.target.value }))} className={inputClass} style={inputStyle} placeholder="대표, 총괄본부장, 본부장, 팀장" /></Field>
          <Field label="연락처"><input value={contactEditForm.phone} onChange={(e) => setContactEditForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} style={inputStyle} placeholder="010-0000-0000" /></Field>
          <Field label="유입경로"><input value={contactEditForm.intakeRoute} onChange={(e) => setContactEditForm((p) => ({ ...p, intakeRoute: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
          <Field label="회사·현장"><input value={contactEditForm.company} onChange={(e) => setContactEditForm((p) => ({ ...p, company: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
          <Field label="현재 현장"><input value={contactEditForm.currentSite} onChange={(e) => setContactEditForm((p) => ({ ...p, currentSite: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
          <Field label="소싱 담당자"><input value={contactEditForm.sourcingOwner} onChange={(e) => setContactEditForm((p) => ({ ...p, sourcingOwner: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
          <Field label="클로징 담당자"><input value={contactEditForm.closingOwner} onChange={(e) => setContactEditForm((p) => ({ ...p, closingOwner: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
          <div className="md:col-span-2"><Field label="관리상태"><select value={contactEditForm.managementStatus} onChange={(e) => setContactEditForm((p) => ({ ...p, managementStatus: e.target.value }))} className={inputClass} style={inputStyle}>{MANAGEMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field></div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowContactEdit(false)} className="btn-premium btn-secondary h-10">취소</button><button type="button" onClick={() => void saveContactEdit()} disabled={saving} className="btn-premium btn-primary h-10"><Save size={15} /> {saving ? "저장 중..." : "고객정보 저장"}</button></div>
      </Modal>}

      {selected && showDeleteCustomer && <Modal title="관리고객 삭제" subtitle="삭제 범위를 선택한 뒤 고객명을 직접 입력해야 실행됩니다." onClose={() => setShowDeleteCustomer(false)} maxWidth="680px">
        <div className="rounded-[12px] border p-4" style={{ borderColor: "var(--danger-border)", background: "var(--danger-bg)" }}>
          <div className="flex gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0" style={{ color: "var(--danger-text)" }} /><div><p className="text-[13px] font-bold" style={{ color: "var(--danger-text)" }}>삭제 전 반드시 범위를 확인해주세요.</p><p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>완전삭제는 되돌릴 수 없습니다. 일반적인 잘못 이관은 ‘관리고객에서만 제거’를 권장합니다.</p></div></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => setDeleteMode("managed_only")} className="rounded-[12px] border p-4 text-left" style={{ borderColor: deleteMode === "managed_only" ? "var(--accent)" : "var(--border-subtle)", background: deleteMode === "managed_only" ? "var(--accent-subtle)" : "var(--surface-2)" }}><p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>관리고객에서만 제거</p><p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>관리고객 전용 상세정보·미팅·현장이동을 제거하고 신규DB2의 재접촉예정 고객으로 되돌립니다. 활동노트와 기본 고객정보는 유지됩니다.</p></button>
          <button type="button" onClick={() => setDeleteMode("permanent")} className="rounded-[12px] border p-4 text-left" style={{ borderColor: deleteMode === "permanent" ? "var(--danger-border)" : "var(--border-subtle)", background: deleteMode === "permanent" ? "var(--danger-bg)" : "var(--surface-2)" }}><p className="text-[13px] font-bold" style={{ color: deleteMode === "permanent" ? "var(--danger-text)" : "var(--text-strong)" }}>CRM에서 완전삭제</p><p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>고객 기본정보와 활동노트·미팅·현장이동·리워드 등 연결 데이터를 함께 삭제합니다. 복구할 수 없습니다.</p></button>
        </div>
        <div className="mt-5"><Field label={`확인을 위해 '${selected.name}' 입력 *`}><input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className={inputClass} style={inputStyle} placeholder={selected.name} /></Field></div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowDeleteCustomer(false)} className="btn-premium btn-secondary h-10">취소</button><button type="button" onClick={() => void deleteCustomer()} disabled={saving || deleteConfirmText.trim() !== selected.name} className="btn-premium btn-danger h-10"><Trash2 size={15} /> {saving ? "삭제 중..." : deleteMode === "permanent" ? "완전삭제" : "관리고객에서 제거"}</button></div>
      </Modal>}

      {selected && showGrade && <Modal title="고객등급 설정" subtitle="등급 변경 시 이전 등급과 사유가 히스토리에 남습니다." onClose={() => setShowGrade(false)} maxWidth="560px"><div className="grid grid-cols-3 gap-2">{["A", "B", "C"].map((value) => <button key={value} onClick={() => setGrade(value)} className="rounded-[12px] border py-5 text-[24px] font-[850]" style={{ borderColor: grade === value ? "var(--accent)" : "var(--border-subtle)", background: grade === value ? "var(--accent-subtle)" : "var(--surface-2)", color: grade === value ? "var(--accent-text)" : "var(--text-muted)" }}>{value}</button>)}</div><div className="mt-4"><Field label="등급 사유 *"><textarea rows={5} value={gradeReason} onChange={(e) => setGradeReason(e.target.value)} className={textareaClass} style={inputStyle} placeholder="의사결정권, 광고비 규모, 현장이동 계획 등 판단 근거" /></Field></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowGrade(false)} className="btn-premium btn-secondary h-10">취소</button><button onClick={() => void saveGrade()} disabled={saving} className="btn-premium btn-primary h-10">등급 저장</button></div></Modal>}

      {selected && showNote && <Modal title={editingNoteId ? "관리 활동노트 수정" : "관리 활동노트 추가"} subtitle="기존 소싱 활동노트와 함께 고객의 전체 타임라인에 누적됩니다." onClose={() => { setShowNote(false); setEditingNoteId(null); }} maxWidth="620px"><Field label="활동내용 *"><textarea rows={7} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} className={textareaClass} style={inputStyle} /></Field><div className="mt-5 flex justify-end gap-2"><button onClick={() => { setShowNote(false); setEditingNoteId(null); }} className="btn-premium btn-secondary h-10">취소</button><button onClick={() => void saveNote()} disabled={saving} className="btn-premium btn-primary h-10">{editingNoteId ? "활동 수정" : "활동 저장"}</button></div></Modal>}

      {selected && showSiteMove && <Modal title={editingSiteMoveId ? "현장이동 일정 수정" : "현장이동 일정 등록"} subtitle="등록한 일정은 현장캘린더에 자동 표시됩니다." onClose={() => { setShowSiteMove(false); setEditingSiteMoveId(null); }} maxWidth="680px"><div className="grid gap-4 md:grid-cols-2"><Field label="현재 현장"><input value={siteMoveForm.currentSite} onChange={(e) => setSiteMoveForm((p) => ({ ...p, currentSite: e.target.value }))} className={inputClass} style={inputStyle} /></Field><Field label="이동예정 현장 *"><input value={siteMoveForm.destinationSite} onChange={(e) => setSiteMoveForm((p) => ({ ...p, destinationSite: e.target.value }))} className={inputClass} style={inputStyle} /></Field><Field label="이동지역"><input value={siteMoveForm.destinationRegion} onChange={(e) => setSiteMoveForm((p) => ({ ...p, destinationRegion: e.target.value }))} className={inputClass} style={inputStyle} /></Field><Field label="이동예정일 *"><input type="date" value={siteMoveForm.plannedMoveDate} onChange={(e) => setSiteMoveForm((p) => ({ ...p, plannedMoveDate: e.target.value }))} className={inputClass} style={inputStyle} /></Field><Field label="이동상태"><select value={siteMoveForm.moveStatus} onChange={(e) => setSiteMoveForm((p) => ({ ...p, moveStatus: e.target.value }))} className={inputClass} style={inputStyle}>{MOVE_STATUSES.map((v) => <option key={v}>{v}</option>)}</select></Field><label className="flex items-center gap-2 rounded-[10px] border px-3" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)" }}><input type="checkbox" checked={siteMoveForm.isConfirmed} onChange={(e) => setSiteMoveForm((p) => ({ ...p, isConfirmed: e.target.checked }))} /><span className="text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>이동 확정</span></label><div className="md:col-span-2"><Field label="비고"><textarea rows={4} value={siteMoveForm.memo} onChange={(e) => setSiteMoveForm((p) => ({ ...p, memo: e.target.value }))} className={textareaClass} style={inputStyle} /></Field></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => { setShowSiteMove(false); setEditingSiteMoveId(null); }} className="btn-premium btn-secondary h-10">취소</button><button onClick={() => void saveSiteMove()} disabled={saving} className="btn-premium btn-primary h-10">{editingSiteMoveId ? "일정 수정" : "일정 저장"}</button></div></Modal>}

      {selected && showMeeting && <Modal title={editingMeetingId ? "미팅기록 수정" : "미팅기록 추가"} subtitle="미팅마다 상세정보를 별도 기록으로 남깁니다." onClose={() => { setShowMeeting(false); setEditingMeetingId(null); }}><div className="grid gap-4 md:grid-cols-2"><Field label="미팅일 *"><input type="date" value={meetingForm.meetingDate} onChange={(e) => setMeetingForm((p) => ({ ...p, meetingDate: e.target.value }))} className={inputClass} style={inputStyle} /></Field><Field label="미팅시간 *"><input type="time" value={meetingForm.meetingTime} onChange={(e) => setMeetingForm((p) => ({ ...p, meetingTime: e.target.value }))} className={inputClass} style={inputStyle} /></Field><Field label="미팅유형"><select value={meetingForm.meetingType} onChange={(e) => setMeetingForm((p) => ({ ...p, meetingType: e.target.value }))} className={inputClass} style={inputStyle}>{MEETING_TYPES.map((v) => <option key={v}>{v}</option>)}</select></Field><Field label="미팅상태"><select value={meetingForm.status} onChange={(e) => setMeetingForm((p) => ({ ...p, status: e.target.value }))} className={inputClass} style={inputStyle}>{MEETING_STATUSES.map((v) => <option key={v}>{v}</option>)}</select></Field><Field label="미팅장소"><input value={meetingForm.meetingAddress} onChange={(e) => setMeetingForm((p) => ({ ...p, meetingAddress: e.target.value }))} className={inputClass} style={inputStyle} /></Field><Field label="참석자"><input value={meetingForm.attendees} onChange={(e) => setMeetingForm((p) => ({ ...p, attendees: e.target.value }))} className={inputClass} style={inputStyle} /></Field>{[["미팅목적", "purpose"], ["현장상태", "siteStatus"], ["조직정보", "organizationInfo"], ["광고운영", "advertisingOperation"], ["광고비 규모", "advertisingBudget"], ["광고비 지원여부", "advertisingSupport"], ["현장이동 계획", "siteMovePlan"], ["의사결정권 유무", "decisionAuthority"], ["고객 요청사항", "customerRequest"], ["클로징팀 판단", "closingJudgement"], ["후속조치", "followUpAction"], ["종합 메모", "resultMemo"]].map(([label, key]) => <Field key={key} label={label}><textarea rows={3} value={meetingForm[key as keyof MeetingForm] as string} onChange={(e) => setMeetingForm((p) => ({ ...p, [key]: e.target.value }))} className={textareaClass} style={inputStyle} /></Field>)}<div className="md:col-span-2"><Field label="다음 미팅예정"><input type="datetime-local" value={meetingForm.nextMeetingAt} onChange={(e) => setMeetingForm((p) => ({ ...p, nextMeetingAt: e.target.value }))} className={inputClass} style={inputStyle} /></Field></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => { setShowMeeting(false); setEditingMeetingId(null); }} className="btn-premium btn-secondary h-10">취소</button><button onClick={() => void saveMeeting()} disabled={saving} className="btn-premium btn-primary h-10">{editingMeetingId ? "미팅기록 수정" : "미팅기록 저장"}</button></div></Modal>}
    </main>
  );
}
