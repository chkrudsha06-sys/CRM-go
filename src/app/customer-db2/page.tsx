"use client";

import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileClock,
  History,
  Loader2,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Trash2,
  UserRound,
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
  assigned_to: string | null;
  sourcing_owner: string | null;
  closing_owner: string | null;
  sourcing_status: string | null;
  crm_db_source: string | null;
  next_contact_at: string | null;
  last_activity_at: string | null;
  handoff_at: string | null;
  meeting_date: string | null;
  meeting_date_text: string | null;
  meeting_address: string | null;
  created_at: string;
  updated_at: string | null;
};

type Note = {
  id: number;
  contact_id: number;
  note_date: string;
  content: string;
  author: string | null;
  created_at: string;
};

type Handoff = {
  id: number;
  contact_id: number;
  sourcing_owner: string | null;
  closing_owner: string;
  meeting_at: string;
  meeting_address: string | null;
  meeting_purpose: string | null;
  handoff_memo: string | null;
  status: string;
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
  changed_by: string | null;
  created_at: string;
};

type NewCustomerForm = {
  name: string;
  title: string;
  phone: string;
  intakeRoute: string;
  currentSite: string;
};

type EditCustomerForm = {
  name: string;
  title: string;
  phone: string;
  intakeRoute: string;
  currentSite: string;
  sourcingOwner: string;
  sourcingStatus: string;
  nextContactAt: string;
};

type ApiResult = {
  success?: boolean;
  error?: string;
  warnings?: string[];
  hint?: string;
};

type ActivityForm = {
  activityType: string;
  noteDate: string;
  content: string;
  result: string;
  nextAction: string;
  nextContactAt: string;
  nextStatus: string;
};

type HandoffForm = {
  closingOwner: string;
  meetingDate: string;
  meetingTime: string;
  meetingAddress: string;
  meetingPurpose: string;
  handoffMemo: string;
};

const SOURCE = "customer_db2";
const MANAGED_SOURCE = "managed_customer";
const INTAKE_ROUTES = ["분양회DB", "분양라인", "완판트럭", "미관리DB", "대협팀활동"];
const TITLE_OPTIONS = ["총괄본부장", "본부장", "팀장"];
const STATUS_OPTIONS = [
  "신규DB",
  "TM 진행중",
  "접점확보",
  "미팅조율",
  "미팅확정",
  "재접촉예정",
  "보류",
  "연락불가",
  "유효하지 않은 DB",
  "이관완료",
];
const ACTIVE_STATUS_OPTIONS = STATUS_OPTIONS.filter((status) => status !== "이관완료");
const ACTIVITY_TYPES = ["TM", "문자", "카카오톡", "미팅조율", "정보수집", "후속연락", "기타"];
const DEFAULT_CLOSERS = ["김정후", "김창완", "최웅"];
const EMPTY_CUSTOMER: NewCustomerForm = {
  name: "",
  title: "",
  phone: "",
  intakeRoute: "",
  currentSite: "",
};

const EMPTY_EDIT_CUSTOMER: EditCustomerForm = {
  name: "",
  title: "",
  phone: "",
  intakeRoute: "",
  currentSite: "",
  sourcingOwner: "",
  sourcingStatus: "신규DB",
  nextContactAt: "",
};

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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function getUser() {
  const user = getCurrentUser();
  return {
    id: user?.id || "",
    name: user?.name || "현재 사용자",
    role: user?.role || "shared",
    sessionToken: user?.sessionToken || "",
    isAdmin: user?.role === "admin",
    isSourcing: user?.role === "exec",
  };
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

async function readApiResult(response: Response): Promise<ApiResult> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ApiResult;
  } catch {
    return { error: raw.slice(0, 500) };
  }
}

function buildActivityContent(form: ActivityForm) {
  return [
    `[${form.activityType}] ${form.content.trim()}`,
    form.result.trim() ? `활동결과: ${form.result.trim()}` : "",
    form.nextAction.trim() ? `다음조치: ${form.nextAction.trim()}` : "",
    form.nextContactAt ? `다음연락예정: ${form.nextContactAt.replace("T", " ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold" style={styles}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none";
const textareaClass = "w-full rounded-[10px] border px-3 py-2.5 text-[13px] font-medium leading-relaxed outline-none";
const inputStyle = { background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" };

function Modal({ title, subtitle, onClose, children, maxWidth = "720px" }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="premium-card max-h-[92vh] w-full overflow-hidden" style={{ maxWidth }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border-subtle)" }}>
          <div>
            <h2 className="crm-title">{title}</h2>
            {subtitle && <p className="crm-subtitle mt-1">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
        </div>
        <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export default function CustomerDb2Page() {
  const currentUser = useMemo(() => getUser(), []);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [histories, setHistories] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("진행중");
  const [routeFilter, setRouteFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>(EMPTY_CUSTOMER);
  const [editCustomer, setEditCustomer] = useState<EditCustomerForm>(EMPTY_EDIT_CUSTOMER);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [activity, setActivity] = useState<ActivityForm>({
    activityType: "TM",
    noteDate: today(),
    content: "",
    result: "",
    nextAction: "",
    nextContactAt: "",
    nextStatus: "TM 진행중",
  });
  const [handoffForm, setHandoffForm] = useState<HandoffForm>({
    closingOwner: "",
    meetingDate: today(),
    meetingTime: "14:00",
    meetingAddress: "",
    meetingPurpose: "신규 고객 최초 미팅",
    handoffMemo: "",
  });

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    let query = supabase
      .from("contacts")
      .select("id,name,title,phone,intake_route,company,current_site,assigned_to,sourcing_owner,closing_owner,sourcing_status,crm_db_source,next_contact_at,last_activity_at,handoff_at,meeting_date,meeting_date_text,meeting_address,created_at,updated_at")
      .in("crm_db_source", [SOURCE, MANAGED_SOURCE])
      .order("created_at", { ascending: false })
      .limit(5000);

    if (currentUser.isSourcing) {
      query = query.or(`sourcing_owner.eq.${currentUser.name},assigned_to.eq.${currentUser.name}`) as typeof query;
    }

    const contactRes = await query;
    const rows = (contactRes.data || []) as Contact[];
    const ids = rows.map((row) => row.id);

    if (!ids.length) {
      setContacts([]);
      setNotes([]);
      setHandoffs([]);
      setHistories([]);
      setLoading(false);
      return;
    }

    const [noteRes, handoffRes, historyRes] = await Promise.all([
      supabase.from("contact_notes").select("id,contact_id,note_date,content,author,created_at").in("contact_id", ids).order("created_at", { ascending: false }).limit(10000),
      supabase.from("customer_handoffs").select("*").in("contact_id", ids).order("created_at", { ascending: false }).limit(5000),
      supabase.from("customer_change_history").select("id,contact_id,event_type,field_name,old_value,new_value,change_reason,changed_by,created_at").in("contact_id", ids).order("created_at", { ascending: false }).limit(10000),
    ]);

    if (contactRes.error) console.error(contactRes.error);
    if (noteRes.error) console.warn(noteRes.error.message);
    if (handoffRes.error) console.warn(handoffRes.error.message);
    if (historyRes.error) console.warn(historyRes.error.message);

    setContacts(rows);
    setNotes((noteRes.data || []) as Note[]);
    setHandoffs((handoffRes.data || []) as Handoff[]);
    setHistories((historyRes.data || []) as HistoryRow[]);
    setLoading(false);
  }, [currentUser.isSourcing, currentUser.name]);

  useEffect(() => {
    void fetchData();
    const channel = supabase
      .channel("customer-db2-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_notes" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_handoffs" }, () => void fetchData(true))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchData]);

  const selected = contacts.find((contact) => contact.id === selectedId) || null;
  const selectedNotes = notes.filter((note) => note.contact_id === selectedId);
  const selectedHandoffs = handoffs.filter((handoff) => handoff.contact_id === selectedId);
  const selectedHistories = histories.filter((history) => history.contact_id === selectedId);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const status = contact.sourcing_status || (contact.crm_db_source === MANAGED_SOURCE ? "이관완료" : "신규DB");
      const statusMatch = statusFilter === "전체"
        || (statusFilter === "진행중" && contact.crm_db_source === SOURCE && status !== "이관완료")
        || status === statusFilter;
      const routeMatch = !routeFilter || contact.intake_route === routeFilter;
      const keywordMatch = !keyword || [contact.name, contact.title, contact.phone, contact.intake_route, contact.current_site, contact.company, contact.sourcing_owner]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
      return statusMatch && routeMatch && keywordMatch;
    });
  }, [contacts, routeFilter, search, statusFilter]);

  const metrics = useMemo(() => {
    const active = contacts.filter((contact) => contact.crm_db_source === SOURCE);
    return {
      total: active.length,
      tm: active.filter((contact) => (contact.sourcing_status || "") === "TM 진행중").length,
      meeting: active.filter((contact) => ["접점확보", "미팅조율", "미팅확정"].includes(contact.sourcing_status || "")).length,
      handed: contacts.filter((contact) => contact.crm_db_source === MANAGED_SOURCE).length,
    };
  }, [contacts]);

  async function addHistory(contactId: number, eventType: string, fieldName: string, oldValue: string | null, newValue: string | null, reason?: string) {
    const { error } = await supabase.from("customer_change_history").insert({
      contact_id: contactId,
      event_type: eventType,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      change_reason: reason || null,
      source_screen: "신규DB2",
      changed_by: currentUser.name,
    });
    if (error) console.warn("히스토리 기록 실패:", error.message);
  }

  async function handleCreate() {
    if (!newCustomer.name.trim() || !newCustomer.title || !normalizePhone(newCustomer.phone) || !newCustomer.intakeRoute || !newCustomer.currentSite.trim()) {
      alert("고객명, 직급, 연락처, 유입경로, 현장명을 모두 입력해주세요.");
      return;
    }
    setSaving(true);
    const { data: phoneRows, error: phoneError } = await supabase
      .from("contacts")
      .select("id,name,phone,crm_db_source")
      .limit(5000);
    if (phoneError) {
      setSaving(false);
      alert(`중복 확인 실패: ${phoneError.message}`);
      return;
    }
    const duplicate = (phoneRows || []).find((row: { id: number; name: string; phone: string | null; crm_db_source: string | null }) => normalizePhone(row.phone) === normalizePhone(newCustomer.phone));
    if (duplicate) {
      setSaving(false);
      alert(`동일 연락처 고객이 이미 존재합니다.\n고객명: ${duplicate.name}\n현재 구분: ${duplicate.crm_db_source || "미지정"}`);
      return;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        name: newCustomer.name.trim(),
        title: newCustomer.title,
        phone: formatPhone(newCustomer.phone),
        intake_route: newCustomer.intakeRoute,
        company: newCustomer.currentSite.trim(),
        current_site: newCustomer.currentSite.trim(),
        assigned_to: currentUser.name,
        sourcing_owner: currentUser.name,
        sourcing_status: "신규DB",
        crm_db_source: SOURCE,
        activity_type: "TM",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    setSaving(false);
    if (error || !data) {
      alert(`신규 고객 등록 실패: ${error?.message || "알 수 없는 오류"}`);
      return;
    }
    await addHistory(Number(data.id), "신규DB 등록", "crm_db_source", null, SOURCE, `${newCustomer.intakeRoute} 유입`);
    setNewCustomer(EMPTY_CUSTOMER);
    setShowCreate(false);
    await fetchData(true);
    setSelectedId(Number(data.id));
  }

  async function handleAddActivity() {
    if (!selected || !activity.content.trim()) {
      alert("활동내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    const previousStatus = selected.sourcing_status || "신규DB";
    const content = buildActivityContent(activity);
    const [noteRes, contactRes] = await Promise.all([
      supabase.from("contact_notes").insert({
        contact_id: selected.id,
        note_date: activity.noteDate,
        content,
        author: currentUser.name,
      }),
      supabase.from("contacts").update({
        sourcing_status: activity.nextStatus,
        last_activity_at: new Date().toISOString(),
        next_contact_at: activity.nextContactAt ? new Date(`${activity.nextContactAt}:00+09:00`).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", selected.id),
    ]);
    setSaving(false);
    if (noteRes.error || contactRes.error) {
      alert(`활동 저장 실패: ${noteRes.error?.message || contactRes.error?.message}`);
      return;
    }
    await addHistory(selected.id, "활동 등록", "sourcing_status", previousStatus, activity.nextStatus, activity.content.trim());
    setActivity({
      activityType: "TM",
      noteDate: today(),
      content: "",
      result: "",
      nextAction: "",
      nextContactAt: "",
      nextStatus: activity.nextStatus,
    });
    setShowActivity(false);
    await fetchData(true);
  }

  function apiHeaders() {
    return {
      "Content-Type": "application/json",
      "x-user-id": currentUser.id,
      "x-session-token": currentUser.sessionToken,
    };
  }

  function canModifyContact(contact: Contact | null) {
    if (!contact || contact.crm_db_source !== SOURCE) return false;
    if (currentUser.isAdmin) return true;
    if (!currentUser.isSourcing) return false;
    return [contact.sourcing_owner, contact.assigned_to]
      .filter(Boolean)
      .includes(currentUser.name);
  }

  function openEditCustomer(contact: Contact) {
    if (!canModifyContact(contact)) {
      alert("본인 담당 신규DB 또는 관리자만 수정할 수 있습니다.");
      return;
    }
    setEditCustomer({
      name: contact.name || "",
      title: contact.title || "",
      phone: contact.phone || "",
      intakeRoute: contact.intake_route || "",
      currentSite: contact.current_site || contact.company || "",
      sourcingOwner: contact.sourcing_owner || contact.assigned_to || currentUser.name,
      sourcingStatus: contact.sourcing_status || "신규DB",
      nextContactAt: toDateTimeLocal(contact.next_contact_at),
    });
    setShowEdit(true);
  }

  async function handleUpdateCustomer() {
    if (!selected || !canModifyContact(selected)) {
      alert("수정할 수 없는 고객입니다.");
      return;
    }
    if (!editCustomer.name.trim() || !editCustomer.title || !normalizePhone(editCustomer.phone) || !editCustomer.intakeRoute || !editCustomer.currentSite.trim()) {
      alert("고객명, 직급, 연락처, 유입경로, 현재 현장을 모두 입력해주세요.");
      return;
    }
    if (!currentUser.id || !currentUser.sessionToken) {
      alert("로그인 세션 정보가 없습니다. 로그아웃 후 다시 로그인해주세요.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/customer-db2/update", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          contactId: selected.id,
          name: editCustomer.name.trim(),
          title: editCustomer.title,
          phone: editCustomer.phone,
          intakeRoute: editCustomer.intakeRoute,
          currentSite: editCustomer.currentSite.trim(),
          sourcingOwner: editCustomer.sourcingOwner.trim(),
          sourcingStatus: editCustomer.sourcingStatus,
          nextContactAt: editCustomer.nextContactAt,
        }),
      });
      const result = await readApiResult(response);
      if (!response.ok || !result.success) {
        const detail = [result.error || `HTTP ${response.status}`, result.hint].filter(Boolean).join("\n");
        alert(`신규DB 수정에 실패했습니다.\n${detail}`);
        return;
      }
      setShowEdit(false);
      await fetchData(true);
      if (result.warnings?.length) {
        alert(`수정은 완료됐지만 일부 변경이력 저장에 실패했습니다.\n${result.warnings.join("\n")}`);
      } else {
        alert("신규DB 고객정보를 수정했습니다.");
      }
    } catch (error) {
      alert(`신규DB 수정 요청 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteCustomer(contact: Contact) {
    if (!canModifyContact(contact)) {
      alert("본인 담당 신규DB 또는 관리자만 삭제할 수 있습니다.");
      return;
    }
    setDeleteConfirmText("");
    setShowDelete(true);
  }

  async function handleDeleteCustomer() {
    if (!selected || !canModifyContact(selected)) {
      alert("삭제할 수 없는 고객입니다.");
      return;
    }
    if (deleteConfirmText.trim() !== selected.name) {
      alert(`확인을 위해 고객명 '${selected.name}'을 정확히 입력해주세요.`);
      return;
    }
    if (!currentUser.id || !currentUser.sessionToken) {
      alert("로그인 세션 정보가 없습니다. 로그아웃 후 다시 로그인해주세요.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/customer-db2/delete", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          contactId: selected.id,
          confirmationName: deleteConfirmText.trim(),
        }),
      });
      const result = await readApiResult(response);
      if (!response.ok || !result.success) {
        const detail = [result.error || `HTTP ${response.status}`, result.hint, ...(result.warnings || [])]
          .filter(Boolean)
          .join("\n");
        alert(`신규DB 삭제에 실패했습니다.\n${detail}`);
        return;
      }
      setShowDelete(false);
      setSelectedId(null);
      await fetchData(true);
      if (result.warnings?.length) {
        alert(`고객은 삭제됐지만 일부 선택 테이블 정리에 경고가 있습니다.\n${result.warnings.join("\n")}`);
      } else {
        alert("신규DB 고객을 삭제했습니다.");
      }
    } catch (error) {
      alert(`신규DB 삭제 요청 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleHandoff() {
    if (!selected || !handoffForm.closingOwner.trim() || !handoffForm.meetingDate || !handoffForm.meetingTime) {
      alert("클로징 담당자와 미팅 일시를 입력해주세요.");
      return;
    }
    const meetingAt = new Date(`${handoffForm.meetingDate}T${handoffForm.meetingTime}:00+09:00`).toISOString();
    setSaving(true);
    const { error } = await supabase.rpc("crm_handoff_sourcing_customer", {
      p_contact_id: selected.id,
      p_sourcing_owner: selected.sourcing_owner || selected.assigned_to || currentUser.name,
      p_closing_owner: handoffForm.closingOwner.trim(),
      p_meeting_at: meetingAt,
      p_meeting_address: handoffForm.meetingAddress.trim() || null,
      p_meeting_purpose: handoffForm.meetingPurpose.trim() || null,
      p_handoff_memo: handoffForm.handoffMemo.trim() || null,
      p_created_by: currentUser.name,
    });
    setSaving(false);
    if (error) {
      alert(`관리고객 이관 실패: ${error.message}\n먼저 제공된 Supabase SQL을 실행했는지 확인해주세요.`);
      return;
    }
    setShowHandoff(false);
    await fetchData(true);
    alert("미팅 일정이 등록되고 관리고객으로 이관되었습니다. 운영캘린더에도 자동 표시됩니다.");
  }

  return (
    <main className="space-y-5 p-4 md:p-6 xl:p-8">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Pill tone="blue">SOURCING CRM</Pill>
            <Pill>기존 고객DB 유지</Pill>
          </div>
          <h1 className="text-[28px] font-[820] tracking-[-0.045em]" style={{ color: "var(--text-strong)" }}>신규DB2</h1>
          <p className="crm-subtitle mt-1">신규 DB 발굴부터 TM, 접점확보, 미팅확정, 관리고객 이관까지 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void fetchData()} className="btn-premium btn-secondary h-10"><RefreshCcw size={15} /> 새로고침</button>
          <button type="button" onClick={() => setShowCreate(true)} className="btn-premium btn-primary h-10"><Plus size={15} /> 신규 DB 등록</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "진행중 DB", value: metrics.total, icon: Database, sub: "신규DB2 활성 고객" },
          { label: "TM 진행중", value: metrics.tm, icon: Phone, sub: "지속 접촉 대상" },
          { label: "접점·미팅 단계", value: metrics.meeting, icon: CalendarDays, sub: "접점확보 이상" },
          { label: "관리고객 이관", value: metrics.handed, icon: ArrowRight, sub: "누적 이관 고객" },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="crm-tiny">{metric.label}</p>
                  <p className="mt-2 text-[28px] font-[820]" style={{ color: "var(--text-strong)" }}>{metric.value}<span className="ml-1 text-[13px]">명</span></p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>{metric.sub}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}><Icon size={18} /></div>
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1 xl:max-w-[440px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="고객명, 연락처, 현장명 검색" className={`${inputClass} pl-9`} style={inputStyle} />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass} style={{ ...inputStyle, width: 150 }}>
              <option value="진행중">진행중 전체</option>
              <option value="전체">전체 고객</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className={inputClass} style={{ ...inputStyle, width: 150 }}>
              <option value="">유입경로 전체</option>
              {INTAKE_ROUTES.map((route) => <option key={route} value={route}>{route}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-center">
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                {["상태", "고객명", "직급", "연락처", "유입경로", "현재 현장", "소싱 담당자", "TM 누적", "최근 활동", "다음 연락", "미팅·이관", "등록일"].map((head) => (
                  <th key={head} className="px-3 py-3 text-[11px] font-[760]" style={{ color: "var(--text-muted)" }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="py-20"><Loader2 className="mx-auto animate-spin" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="py-20 text-[13px]" style={{ color: "var(--text-faint)" }}>조건에 맞는 신규DB2 고객이 없습니다.</td></tr>
              ) : filtered.map((contact) => {
                const contactNotes = notes.filter((note) => note.contact_id === contact.id);
                const latest = contactNotes[0];
                const status = contact.sourcing_status || (contact.crm_db_source === MANAGED_SOURCE ? "이관완료" : "신규DB");
                return (
                  <tr key={contact.id} onClick={() => setSelectedId(contact.id)} className="cursor-pointer transition hover:brightness-110" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-3 py-3"><Pill tone={status === "이관완료" ? "green" : status.includes("미팅") || status === "접점확보" ? "purple" : status === "보류" || status === "연락불가" ? "amber" : "blue"}>{status}</Pill></td>
                    <td className="px-3 py-3 text-[13px] font-[760]" style={{ color: "var(--text-strong)" }}>{contact.name}</td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.title || "-"}</td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.phone || "-"}</td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.intake_route || "-"}</td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.current_site || contact.company || "-"}</td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>{contact.sourcing_owner || contact.assigned_to || "-"}</td>
                    <td className="px-3 py-3 text-[13px] font-bold" style={{ color: "var(--accent-text)" }}>{contactNotes.filter((note) => note.content.startsWith("[TM]")).length}건</td>
                    <td className="max-w-[220px] px-3 py-3 text-left">
                      <p className="truncate text-[12px]" style={{ color: "var(--text-subtle)" }}>{latest?.content.split("\n")[0] || "활동기록 없음"}</p>
                      <p className="mt-1 text-[10px]" style={{ color: "var(--text-faint)" }}>{latest ? formatDateTime(latest.created_at) : "-"}</p>
                    </td>
                    <td className="px-3 py-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>{formatDateTime(contact.next_contact_at)}</td>
                    <td className="px-3 py-3">
                      {contact.crm_db_source === MANAGED_SOURCE ? <Pill tone="green">{contact.closing_owner || "관리고객"}</Pill> : <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>미확정</span>}
                    </td>
                    <td className="px-3 py-3 text-[11px]" style={{ color: "var(--text-faint)" }}>{formatDateTime(contact.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreate && (
        <Modal title="신규 DB 등록" subtitle="등록 즉시 신규DB2에 저장되며 기존 고객DB에는 영향을 주지 않습니다." onClose={() => setShowCreate(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="고객명 *"><input value={newCustomer.name} onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="직급 *"><select value={newCustomer.title} onChange={(e) => setNewCustomer((prev) => ({ ...prev, title: e.target.value }))} className={inputClass} style={inputStyle}><option value="">선택</option>{TITLE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="연락처 *"><input value={newCustomer.phone} onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))} className={inputClass} style={inputStyle} placeholder="010-0000-0000" /></Field>
            <Field label="유입경로 *"><select value={newCustomer.intakeRoute} onChange={(e) => setNewCustomer((prev) => ({ ...prev, intakeRoute: e.target.value }))} className={inputClass} style={inputStyle}><option value="">선택</option>{INTAKE_ROUTES.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <div className="md:col-span-2"><Field label="현재 현장명 *"><input value={newCustomer.currentSite} onChange={(e) => setNewCustomer((prev) => ({ ...prev, currentSite: e.target.value }))} className={inputClass} style={inputStyle} /></Field></div>
          </div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="btn-premium btn-secondary h-10">취소</button><button type="button" onClick={() => void handleCreate()} disabled={saving} className="btn-premium btn-primary h-10">{saving ? "저장 중..." : "신규DB2 등록"}</button></div>
        </Modal>
      )}

      {selected && (
        <div className="fixed inset-0 z-[80] bg-black/35" onClick={() => setSelectedId(null)}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-[720px] overflow-y-auto border-l p-5 shadow-2xl" style={{ background: "var(--bg)", borderColor: "var(--border)" }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-[24px] font-[820]" style={{ color: "var(--text-strong)" }}>{selected.name}</h2><Pill tone="purple">{selected.title || "직급 미지정"}</Pill><Pill tone={selected.crm_db_source === MANAGED_SOURCE ? "green" : "blue"}>{selected.sourcing_status || "신규DB"}</Pill></div>
                <p className="crm-subtitle mt-1">{selected.phone || "연락처 없음"} · {selected.current_site || selected.company || "현장 미입력"}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["유입경로", selected.intake_route || "-"],
                ["소싱 담당자", selected.sourcing_owner || selected.assigned_to || "-"],
                ["클로징 담당자", selected.closing_owner || "미지정"],
                ["다음 연락", formatDateTime(selected.next_contact_at)],
              ].map(([label, value]) => <Card key={label} className="p-3"><p className="crm-tiny">{label}</p><p className="mt-1 text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{value}</p></Card>)}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowActivity(true)} className="btn-premium btn-secondary h-10"><MessageSquareText size={15} /> 활동노트 추가</button>
              {selected.crm_db_source === SOURCE && canModifyContact(selected) && (
                <>
                  <button type="button" onClick={() => openEditCustomer(selected)} className="btn-premium btn-secondary h-10"><Pencil size={15} /> 고객정보 수정</button>
                  <button type="button" onClick={() => openDeleteCustomer(selected)} className="btn-premium btn-danger h-10"><Trash2 size={15} /> 신규DB 삭제</button>
                </>
              )}
              {selected.crm_db_source === SOURCE && <button type="button" onClick={() => setShowHandoff(true)} className="btn-premium btn-primary h-10"><Send size={15} /> 미팅확정·관리고객 이관</button>}
              {selected.crm_db_source === MANAGED_SOURCE && <a href={`/managed-customers?contact=${selected.id}`} className="btn-premium btn-primary h-10"><ArrowRight size={15} /> 관리고객 열기</a>}
            </div>

            <div className="mt-6 space-y-4">
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2"><MessageSquareText size={16} /><h3 className="text-[14px] font-bold" style={{ color: "var(--text-strong)" }}>활동노트</h3><Pill>{selectedNotes.length}건</Pill></div>
                <div className="space-y-2">
                  {selectedNotes.length === 0 ? <p className="py-8 text-center text-[12px]" style={{ color: "var(--text-faint)" }}>활동노트가 없습니다.</p> : selectedNotes.map((note) => (
                    <div key={note.id} className="rounded-[12px] border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)" }}>
                      <div className="flex items-center justify-between gap-2"><Pill tone={note.content.startsWith("[TM]") ? "blue" : "default"}>{note.content.match(/^\[([^\]]+)\]/)?.[1] || "활동"}</Pill><span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{formatDateTime(note.created_at)}</span></div>
                      <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>{note.content}</p>
                      <p className="mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>작성자 {note.author || "-"}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2"><History size={16} /><h3 className="text-[14px] font-bold" style={{ color: "var(--text-strong)" }}>이관·변경 히스토리</h3></div>
                <div className="space-y-2">
                  {[...selectedHandoffs.map((row) => ({ id: `h-${row.id}`, title: "관리고객 이관", desc: `${row.sourcing_owner || "소싱팀"} → ${row.closing_owner} · ${formatDateTime(row.meeting_at)}`, date: row.created_at })), ...selectedHistories.map((row) => ({ id: `c-${row.id}`, title: row.event_type, desc: [row.old_value, row.new_value].filter(Boolean).join(" → ") || row.change_reason || "변경 기록", date: row.created_at }))]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((row) => <div key={row.id} className="flex gap-3 border-b py-3 last:border-0" style={{ borderColor: "var(--border-subtle)" }}><FileClock size={15} className="mt-0.5 shrink-0" style={{ color: "var(--accent-text)" }} /><div className="min-w-0 flex-1"><p className="text-[12px] font-bold" style={{ color: "var(--text-strong)" }}>{row.title}</p><p className="mt-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>{row.desc}</p></div><span className="shrink-0 text-[10px]" style={{ color: "var(--text-faint)" }}>{formatDateTime(row.date)}</span></div>)}
                  {selectedHandoffs.length + selectedHistories.length === 0 && <p className="py-8 text-center text-[12px]" style={{ color: "var(--text-faint)" }}>변경 히스토리가 없습니다.</p>}
                </div>
              </Card>
            </div>
          </aside>
        </div>
      )}

      {selected && showEdit && (
        <Modal
          title="신규DB 고객정보 수정"
          subtitle="신규DB2 기본정보와 진행상태를 수정합니다. 변경사항은 변경히스토리에 기록됩니다."
          onClose={() => setShowEdit(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="고객명 *"><input value={editCustomer.name} onChange={(e) => setEditCustomer((prev) => ({ ...prev, name: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="직급 *"><select value={editCustomer.title} onChange={(e) => setEditCustomer((prev) => ({ ...prev, title: e.target.value }))} className={inputClass} style={inputStyle}><option value="">선택</option>{TITLE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="연락처 *"><input value={editCustomer.phone} onChange={(e) => setEditCustomer((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))} className={inputClass} style={inputStyle} placeholder="010-0000-0000" /></Field>
            <Field label="유입경로 *"><select value={editCustomer.intakeRoute} onChange={(e) => setEditCustomer((prev) => ({ ...prev, intakeRoute: e.target.value }))} className={inputClass} style={inputStyle}><option value="">선택</option>{INTAKE_ROUTES.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <div className="md:col-span-2"><Field label="현재 현장명 *"><input value={editCustomer.currentSite} onChange={(e) => setEditCustomer((prev) => ({ ...prev, currentSite: e.target.value }))} className={inputClass} style={inputStyle} /></Field></div>
            <Field label="진행상태"><select value={editCustomer.sourcingStatus} onChange={(e) => setEditCustomer((prev) => ({ ...prev, sourcingStatus: e.target.value }))} className={inputClass} style={inputStyle}>{ACTIVE_STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="다음 연락예정"><input type="datetime-local" value={editCustomer.nextContactAt} onChange={(e) => setEditCustomer((prev) => ({ ...prev, nextContactAt: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <div className="md:col-span-2">
              <Field label="소싱 담당자">
                <input
                  value={editCustomer.sourcingOwner}
                  onChange={(e) => setEditCustomer((prev) => ({ ...prev, sourcingOwner: e.target.value }))}
                  disabled={!currentUser.isAdmin}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  style={inputStyle}
                />
              </Field>
              {!currentUser.isAdmin && <p className="mt-1 text-[10px]" style={{ color: "var(--text-faint)" }}>소싱 담당자 변경은 관리자만 가능합니다.</p>}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-premium btn-secondary h-10">취소</button>
            <button type="button" onClick={() => void handleUpdateCustomer()} disabled={saving} className="btn-premium btn-primary h-10">{saving ? "수정 중..." : "수정 저장"}</button>
          </div>
        </Modal>
      )}

      {selected && showDelete && (
        <Modal
          title="신규DB 고객 삭제"
          subtitle="삭제한 고객과 연결된 신규DB 활동기록은 복구할 수 없습니다."
          onClose={() => setShowDelete(false)}
          maxWidth="640px"
        >
          <div className="rounded-[14px] border p-4" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)" }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" style={{ color: "var(--danger-text)" }} />
              <div>
                <p className="text-[14px] font-bold" style={{ color: "var(--danger-text)" }}>신규DB에서 완전히 삭제됩니다.</p>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--danger-text)" }}>고객 기본정보, 활동노트, 변경히스토리와 연결된 신규DB 데이터가 함께 삭제됩니다. 이미 관리고객으로 이관된 고객은 이 화면에서 삭제할 수 없습니다.</p>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-[12px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)" }}>
            <p className="text-[12px] font-bold" style={{ color: "var(--text-strong)" }}>{selected.name} · {selected.title || "직급 미지정"}</p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>{selected.phone || "연락처 없음"} · {selected.current_site || selected.company || "현장 미입력"}</p>
          </div>
          <div className="mt-5">
            <Field label={`확인을 위해 '${selected.name}' 입력 *`}>
              <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className={inputClass} style={inputStyle} autoComplete="off" />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setShowDelete(false)} className="btn-premium btn-secondary h-10">취소</button>
            <button type="button" onClick={() => void handleDeleteCustomer()} disabled={saving || deleteConfirmText.trim() !== selected.name} className="btn-premium btn-danger h-10"><Trash2 size={15} /> {saving ? "삭제 중..." : "신규DB 완전삭제"}</button>
          </div>
        </Modal>
      )}

      {selected && showActivity && (
        <Modal title="활동노트 추가" subtitle="기존 노트를 덮어쓰지 않고 새로운 활동기록으로 누적합니다." onClose={() => setShowActivity(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="활동유형"><select value={activity.activityType} onChange={(e) => setActivity((prev) => ({ ...prev, activityType: e.target.value }))} className={inputClass} style={inputStyle}>{ACTIVITY_TYPES.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="활동일"><input type="date" value={activity.noteDate} onChange={(e) => setActivity((prev) => ({ ...prev, noteDate: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <div className="md:col-span-2"><Field label="활동내용 *"><textarea value={activity.content} onChange={(e) => setActivity((prev) => ({ ...prev, content: e.target.value }))} rows={4} className={textareaClass} style={inputStyle} /></Field></div>
            <Field label="활동결과"><input value={activity.result} onChange={(e) => setActivity((prev) => ({ ...prev, result: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="다음조치"><input value={activity.nextAction} onChange={(e) => setActivity((prev) => ({ ...prev, nextAction: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="다음 연락예정"><input type="datetime-local" value={activity.nextContactAt} onChange={(e) => setActivity((prev) => ({ ...prev, nextContactAt: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="저장 후 상태"><select value={activity.nextStatus} onChange={(e) => setActivity((prev) => ({ ...prev, nextStatus: e.target.value }))} className={inputClass} style={inputStyle}>{ACTIVE_STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
          </div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowActivity(false)} className="btn-premium btn-secondary h-10">취소</button><button type="button" onClick={() => void handleAddActivity()} disabled={saving} className="btn-premium btn-primary h-10">{saving ? "저장 중..." : "활동 저장"}</button></div>
        </Modal>
      )}

      {selected && showHandoff && (
        <Modal title="미팅확정 및 관리고객 이관" subtitle="미팅 일정은 운영캘린더에 자동 표시되고, 동일 고객 ID로 관리고객에 이관됩니다." onClose={() => setShowHandoff(false)}>
          <div className="mb-4 rounded-[12px] border p-4" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent-border)" }}>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} style={{ color: "var(--accent-text)" }} /><p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{selected.name} · {selected.title}</p></div>
            <p className="mt-2 text-[12px]" style={{ color: "var(--text-subtle)" }}>기본정보와 전체 활동노트가 관리고객에서 그대로 이어집니다.</p>
          </div>
          <datalist id="closing-owner-options">{DEFAULT_CLOSERS.map((name) => <option key={name} value={name} />)}</datalist>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="클로징 담당자 *"><input list="closing-owner-options" value={handoffForm.closingOwner} onChange={(e) => setHandoffForm((prev) => ({ ...prev, closingOwner: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="미팅일 *"><input type="date" value={handoffForm.meetingDate} onChange={(e) => setHandoffForm((prev) => ({ ...prev, meetingDate: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="미팅시간 *"><input type="time" value={handoffForm.meetingTime} onChange={(e) => setHandoffForm((prev) => ({ ...prev, meetingTime: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <Field label="미팅장소"><input value={handoffForm.meetingAddress} onChange={(e) => setHandoffForm((prev) => ({ ...prev, meetingAddress: e.target.value }))} className={inputClass} style={inputStyle} /></Field>
            <div className="md:col-span-2"><Field label="미팅목적"><input value={handoffForm.meetingPurpose} onChange={(e) => setHandoffForm((prev) => ({ ...prev, meetingPurpose: e.target.value }))} className={inputClass} style={inputStyle} /></Field></div>
            <div className="md:col-span-2"><Field label="이관메모"><textarea value={handoffForm.handoffMemo} onChange={(e) => setHandoffForm((prev) => ({ ...prev, handoffMemo: e.target.value }))} rows={5} className={textareaClass} style={inputStyle} placeholder="소싱팀에서 파악한 고객 기본정보와 미팅 시 참고사항" /></Field></div>
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-[12px] border p-3" style={{ borderColor: "var(--warning-border)", background: "var(--warning-bg)" }}><Clock3 size={15} className="mt-0.5 shrink-0" style={{ color: "var(--warning-text)" }} /><p className="text-[11px] leading-relaxed" style={{ color: "var(--warning-text)" }}>이관 후 고객은 신규DB2의 이관완료 이력에서 계속 확인할 수 있으며 삭제되지 않습니다.</p></div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowHandoff(false)} className="btn-premium btn-secondary h-10">취소</button><button type="button" onClick={() => void handleHandoff()} disabled={saving} className="btn-premium btn-primary h-10">{saving ? "이관 중..." : "미팅확정·이관"}</button></div>
        </Modal>
      )}
    </main>
  );
}
