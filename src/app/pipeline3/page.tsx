"use client";

import { supabase } from "@/lib/supabase";
import {
  CalendarDays,
  Edit3,
  FileText,
  Flame,
  Megaphone,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Search,
  Target,
  User,
  UserCheck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type StageKey = "리드" | "프로스펙팅" | "딜크로징" | "리텐션" | "보류/이탈";

type Stage = {
  key: StageKey;
  label: string;
  desc: string;
  tone: "danger" | "warning" | "success" | "purple" | "muted" | "info";
  icon: LucideIcon;
};

type CustomerDbRecord = {
  id: number;
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  management_stage: string;
  customer_grade: string;
  memo: string;
  created_at: string;
  updated_at: string;
};

type PipelineCustomer = {
  id: number;
  name: string;
  title: string;
  phone: string;
  intakeRoute: string;
  company: string;
  grade: string;
  stage: StageKey;
  lastActivity: string;
  registeredAt: string;
  nextContact: string;
  meetingSchedule: string;
  meetingAddress: string;
  noteSummary: string;
  adsSummary: string;
  raw: CustomerDbRecord;
};

type DetailTab = "summary" | "notes" | "ads";

type EditForm = {
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  management_stage: StageKey;
  customer_grade: string;
  memo: string;
};

type AdRequestForm = {
  category: string;
  assignee: string;
  priority: string;
  siteName: string;
  adProduct: string;
  hopeDate: string;
  content: string;
};

const STORAGE_KEY = "crm_go_customer_db_local_v2";
const TODAY = new Date().toISOString().slice(0, 10);
const UNREVIEWED_GRADE = "심사미진행";

const TITLE_OPTIONS = ["본부장", "팀장", "팀원"];
const INTAKE_ROUTES = ["분양의신DB", "완판트럭", "분양라인", "분양회MGM", "대협팀활동", "컨설턴트 고객DB", "컨설턴트 VIP DB"];
const MANAGEMENT_STAGES: StageKey[] = ["리드", "프로스펙팅", "딜크로징", "리텐션", "보류/이탈"];
const CUSTOMER_GRADES = [UNREVIEWED_GRADE, "마스터", "챌린저", "브론즈", "추가 심사 후보", "판정 보류", "리드", "프로스펙팅", "딜크로징", "리텐션", "보류"];
const TASK_ASSIGNEES = ["조계현", "이세호", "기여운", "최연전", "최웅", "김창완", "김정후"];
const PRIORITIES = ["긴급", "높음", "보통", "낮음"];

const STAGES: Stage[] = [
  { key: "리드", label: "Leads", desc: "초기 유입", tone: "danger", icon: Flame },
  { key: "프로스펙팅", label: "Prospecting", desc: "상담/검토", tone: "warning", icon: Search },
  { key: "딜크로징", label: "Closing", desc: "계약 직전", tone: "success", icon: Zap },
  { key: "리텐션", label: "Retention", desc: "계약/사후관리", tone: "purple", icon: UserCheck },
  { key: "보류/이탈", label: "Paused", desc: "보류/이탈", tone: "muted", icon: X },
];

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "notes", label: "Notes" },
  { key: "ads", label: "Ads >" },
];

const SAMPLE_RECORDS: CustomerDbRecord[] = [
  {
    id: 12488,
    name: "조효숙",
    title: "팀장",
    phone: "010-2455-1709",
    intake_route: "컨설턴트 고객DB",
    company: "-",
    management_stage: "리드",
    customer_grade: "리드",
    memo: "초기 유입 고객입니다. 상세한 상담 내용은 카드가 아닌 상세 패널에서 관리합니다.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 12835,
    name: "주해랑",
    title: "팀장",
    phone: "010-3520-3365",
    intake_route: "컨설턴트 VIP DB",
    company: "-",
    management_stage: "프로스펙팅",
    customer_grade: "프로스펙팅",
    memo: "대형 현장 운영 경험이 있고 계약 조건 검토 단계로 진입 가능.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 12836,
    name: "박중필",
    title: "본부장",
    phone: "010-3349-6953",
    intake_route: "컨설턴트 VIP DB",
    company: "-",
    management_stage: "딜크로징",
    customer_grade: "딜크로징",
    memo: "계약 의향이 높아 최종 조건 정리 필요.",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 12837,
    name: "이소영",
    title: "본부장",
    phone: "010-2777-4586",
    intake_route: "컨설턴트 VIP DB",
    company: "-",
    management_stage: "리텐션",
    customer_grade: "리텐션",
    memo: "계약 전환 완료. 계약관리 메뉴 이관 전 확인 상태로 표시합니다.",
    created_at: new Date(Date.now() - 345600000).toISOString(),
    updated_at: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 12838,
    name: "김소이",
    title: "팀장",
    phone: "010-2755-6981",
    intake_route: "컨설턴트 고객DB",
    company: "-",
    management_stage: "보류/이탈",
    customer_grade: "보류",
    memo: "초기 응답 이후 추가 답변 없음. 이탈 가능성 있음.",
    created_at: new Date(Date.now() - 604800000).toISOString(),
    updated_at: new Date(Date.now() - 604800000).toISOString(),
  },
];

function fmt(value?: string | null) {
  return value && value.trim() ? value : "-";
}

function stripGradeAssessmentBlock(value?: string | null) {
  if (!value) return "";
  return value.replace(/\n?\[\[CRM_GRADE_ASSESSMENT\]\][\s\S]*?\[\[\/CRM_GRADE_ASSESSMENT\]\]\n?/g, "").trim();
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}

function normalizeStage(value?: string | null): StageKey {
  if (value === "딜클로징") return "딜크로징";
  if (value === "계약완료") return "리텐션";
  if (value === "예약완료") return "딜크로징";
  if (value === "보류") return "보류/이탈";
  if (value === "리드" || value === "프로스펙팅" || value === "딜크로징" || value === "리텐션" || value === "보류/이탈") {
    return value;
  }
  return "리드";
}

function stageLabel(value: StageKey) {
  if (value === "딜크로징") return "딜클로징";
  if (value === "리텐션") return "리텐션";
  return value;
}

function badgeClass(value: string) {
  if (value === "마스터") return "grade-master";
  if (value === "챌린저") return "grade-challenger";
  if (value === "브론즈") return "grade-bronze";
  if (value === "추가 심사 후보") return "grade-review";
  if (value === UNREVIEWED_GRADE) return "grade-hold";
  if (value === "판정 보류") return "grade-hold";
  if (value === "리드") return "badge-danger";
  if (value === "프로스펙팅") return "badge-warning";
  if (value === "딜크로징" || value === "딜클로징") return "badge-success";
  if (value === "리텐션" || value === "계약완료") return "badge-purple";
  if (value === "보류" || value === "보류/이탈") return "badge-muted";
  if (value === "분양의신DB") return "badge-purple";
  if (value === "완판트럭") return "badge-warning";
  if (value === "분양라인") return "badge-cyan";
  if (value === "분양회MGM") return "badge-success";
  if (value === "대협팀활동") return "badge-info";
  if (value === "컨설턴트 고객DB") return "badge-info";
  if (value === "컨설턴트 VIP DB") return "badge-success";
  return "badge-muted";
}

function toneClass(tone: Stage["tone"]) {
  if (tone === "danger") return "badge-danger";
  if (tone === "warning") return "badge-warning";
  if (tone === "success") return "badge-success";
  if (tone === "purple") return "badge-purple";
  if (tone === "info") return "badge-info";
  return "badge-muted";
}

function getStageButtonLabel(target: StageKey) {
  if (target === "딜크로징") return "딜클로징 전환";
  if (target === "리텐션") return "리텐션 전환";
  return `${target} 전환`;
}

function getStageButtonIcon(target: StageKey) {
  if (target === "리드") return <Flame size={14} />;
  if (target === "프로스펙팅") return <Search size={14} />;
  if (target === "딜크로징") return <Zap size={14} />;
  if (target === "리텐션") return <UserCheck size={14} />;
  return <X size={14} />;
}

function getQuickStageTargets(stage: StageKey): StageKey[] {
  if (stage === "리드") return ["프로스펙팅", "딜크로징", "리텐션"];
  if (stage === "프로스펙팅") return ["리드", "딜크로징", "리텐션"];
  if (stage === "딜크로징") return ["리드", "프로스펙팅", "리텐션"];
  if (stage === "리텐션") return ["리드", "프로스펙팅", "딜크로징"];
  return ["리드", "프로스펙팅", "딜크로징"];
}

function getFollowUpByStage(stage: StageKey) {
  if (stage === "리드") return "철저한 고객관리를 통해 프로스펙팅 구간으로 관리를 변경하세요.";
  if (stage === "프로스펙팅") return "고객과의 라포 형성이 되었는지 확인하고 미팅 일정 확정을 진행하세요.";
  if (stage === "딜크로징") return "계약 전환을 위해 마지막 클로징을 진행하세요.";
  if (stage === "리텐션") return "계약관리 메뉴 이관 후 정산, 사후관리, MGM 관리를 진행하세요.";
  return "재접점 필요 여부를 확인하고 리드 또는 프로스펙팅으로 복귀하세요.";
}

function toPipelineCustomer(record: CustomerDbRecord): PipelineCustomer {
  const stage = normalizeStage(record.management_stage);
  const memo = stripGradeAssessmentBlock(record.memo);
  return {
    id: record.id,
    name: fmt(record.name),
    title: fmt(record.title),
    phone: fmt(record.phone),
    intakeRoute: fmt(record.intake_route),
    company: fmt(record.company),
    grade: fmt(record.customer_grade || UNREVIEWED_GRADE),
    stage,
    lastActivity: formatShortDate(record.updated_at || record.created_at),
    registeredAt: formatShortDate(record.created_at),
    nextContact: getFollowUpByStage(stage),
    meetingSchedule: "미팅 일정 조율 전",
    meetingAddress: "",
    noteSummary: memo || "등록된 메모가 없습니다. 상담 내용은 활동노트에서 관리하세요.",
    adsSummary: "광고 요청 이력 없음. 필요 시 하단 광고요청 버튼으로 업무요청을 생성하세요.",
    raw: record,
  };
}

function PipelineCard({
  customer,
  onClick,
}: {
  customer: PipelineCustomer;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[16px] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-[900]" style={{ color: "var(--text-strong)" }}>
            {customer.name}{" "}
            <span className="font-[760]" style={{ color: "var(--text-muted)" }}>
              · {customer.title}
            </span>
          </p>
          <p className="crm-tiny mt-1 flex items-center gap-1 truncate">
            <Phone size={12} />
            {customer.phone}
          </p>
        </div>
        <span className={`badge-premium shrink-0 px-2 py-1 text-[11px] ${badgeClass(customer.grade)}`}>
          {customer.grade}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`badge-premium px-2 py-1 text-[11px] ${badgeClass(customer.intakeRoute)}`}>
          {customer.intakeRoute}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-[760]" style={{ color: "var(--text-faint)" }}>
        <span>활동 {customer.lastActivity}</span>
        <span>등록 {customer.registeredAt}</span>
      </div>
    </button>
  );
}

function DetailPanel({
  customer,
  tab,
  noteComposerOpen,
  onTab,
  onClose,
  onStageChange,
  onMeetingSave,
  onOpenNoteComposer,
  onOpenEdit,
  onOpenAdRequest,
}: {
  customer: PipelineCustomer;
  tab: DetailTab;
  noteComposerOpen: boolean;
  onTab: (tab: DetailTab) => void;
  onClose: () => void;
  onStageChange: (customer: PipelineCustomer, target: StageKey) => void;
  onMeetingSave: (customer: PipelineCustomer, meetingDate: string, meetingAddress: string, meetingMemo: string) => void;
  onOpenNoteComposer: () => void;
  onOpenEdit: () => void;
  onOpenAdRequest: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="상세 패널 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default backdrop-blur-[2px]"
        style={{ background: "var(--overlay)" }}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[1120px] flex-col border-l"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="slide-panel-header flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={`badge-premium ${badgeClass(customer.grade)}`}>{customer.grade}</span>
              <span className={`badge-premium ${badgeClass(customer.intakeRoute)}`}>{customer.intakeRoute}</span>
            </div>
            <h2 className="truncate text-[30px] font-[930] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
              {customer.name}{" "}
              <span className="text-[18px] font-[820]" style={{ color: "var(--text-muted)" }}>
                {customer.title}
              </span>
            </h2>
            <p className="mt-2 text-sm font-[720]" style={{ color: "var(--text-muted)" }}>
              ID {customer.id} · {customer.phone}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-10 w-10 shrink-0 p-0">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {DETAIL_TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onTab(item.key)}
                className={tab === item.key ? "btn-premium btn-primary shrink-0" : "btn-premium btn-secondary shrink-0"}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <SummaryTab
              customer={customer}
              onStageChange={onStageChange}
              onMeetingSave={onMeetingSave}
              onOpenNoteComposer={onOpenNoteComposer}
            />
          ) : null}
          {tab === "notes" ? <NotesTab customer={customer} composerOpen={noteComposerOpen} /> : null}
          {tab === "ads" ? <AdsTab customer={customer} onOpenAdRequest={onOpenAdRequest} /> : null}
        </div>

        <div className="slide-panel-footer" style={{ padding: "clamp(16px, 1.6vw, 22px) clamp(20px, 2vw, 28px)" }}>
          <div className="grid grid-cols-3 gap-3">
            <button type="button" onClick={onOpenEdit} className="btn-premium btn-secondary">
              <User size={14} />
              고객정보수정
            </button>
            <button type="button" onClick={onOpenNoteComposer} className="btn-premium btn-secondary">
              <MessageSquare size={14} />
              활동노트작성
            </button>
            <button type="button" onClick={onOpenAdRequest} className="btn-premium btn-secondary">
              <Plus size={14} />
              광고요청
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SummaryTab({
  customer,
  onStageChange,
  onMeetingSave,
  onOpenNoteComposer,
}: {
  customer: PipelineCustomer;
  onStageChange: (customer: PipelineCustomer, target: StageKey) => void;
  onMeetingSave: (customer: PipelineCustomer, meetingDate: string, meetingAddress: string, meetingMemo: string) => void;
  onOpenNoteComposer: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <section className="premium-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Phone size={17} style={{ color: "var(--accent)" }} />
          <div>
            <p className="crm-section-title">고객정보</p>
            <p className="crm-tiny">고객DB와 연동되는 기본 정보</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="고객명" value={customer.name} />
          <InfoItem label="직급" value={customer.title} />
          <InfoItem label="연락처" value={customer.phone} />
          <InfoItem label="소속회사" value={customer.company} />
          <InfoItem label="유입경로" value={customer.intakeRoute} badge />
          <InfoItem label="자동등급" value={customer.grade} badge />
          <InfoItem label="관리단계" value={stageLabel(customer.stage)} badge />
          <InfoItem label="등록일" value={customer.registeredAt} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={17} style={{ color: "var(--accent)" }} />
            <div>
              <p className="crm-section-title">Memo</p>
              <p className="crm-tiny">고객DB 메모와 상담 흐름</p>
            </div>
          </div>
          <div className="min-h-[128px] rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <p className="whitespace-pre-wrap text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
              {customer.noteSummary}
            </p>
          </div>
        </section>

        <section className="premium-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText size={17} style={{ color: "var(--accent)" }} />
              <div className="min-w-0">
                <p className="crm-section-title">활동노트</p>
                <p className="crm-tiny">최근 상담 기록과 추가 작성</p>
              </div>
            </div>
            <button type="button" onClick={onOpenNoteComposer} className="btn-premium btn-primary h-8 px-3 text-[12px]">
              <Plus size={13} />
              노트 작성
            </button>
          </div>
          <div className="min-h-[128px] rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <p className="text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
              {customer.noteSummary}
            </p>
            <p className="crm-tiny mt-3">실제 contact_notes 연결은 후속 작업에서 Supabase로 연결합니다.</p>
          </div>
        </section>
      </div>

      <QuickActions
        customer={customer}
        onStageChange={onStageChange}
        onMeetingSave={onMeetingSave}
        onOpenNoteComposer={onOpenNoteComposer}
      />
    </div>
  );
}

function QuickActions({
  customer,
  onStageChange,
  onMeetingSave,
  onOpenNoteComposer,
}: {
  customer: PipelineCustomer;
  onStageChange: (customer: PipelineCustomer, target: StageKey) => void;
  onMeetingSave: (customer: PipelineCustomer, meetingDate: string, meetingAddress: string, meetingMemo: string) => void;
  onOpenNoteComposer: () => void;
}) {
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingAddress, setMeetingAddress] = useState("");
  const [meetingMemo, setMeetingMemo] = useState("");
  const targets = getQuickStageTargets(customer.stage);

  const handleMeetingSubmit = () => {
    if (!meetingDate) {
      alert("미팅일정을 선택해 주세요.");
      return;
    }
    onMeetingSave(customer, meetingDate, meetingAddress, meetingMemo);
    setMeetingOpen(false);
    setMeetingDate("");
    setMeetingAddress("");
    setMeetingMemo("");
  };

  return (
    <section className="premium-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap size={17} style={{ color: "var(--accent)" }} />
        <div>
          <p className="crm-section-title">Quick actions</p>
          <p className="crm-tiny">현재 상태에서 바로 처리할 작업</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {targets.map((target) => (
          <button key={target} type="button" onClick={() => onStageChange(customer, target)} className="btn-premium btn-primary w-full">
            {getStageButtonIcon(target)}
            {getStageButtonLabel(target)}
          </button>
        ))}
        <button type="button" onClick={() => setMeetingOpen((value) => !value)} className="btn-premium btn-secondary w-full">
          <CalendarDays size={14} />
          미팅일정 등록
        </button>
        <button type="button" onClick={onOpenNoteComposer} className="btn-premium btn-secondary w-full">
          <MessageSquare size={14} />
          활동노트 작성
        </button>
      </div>

      {meetingOpen ? (
        <div className="mt-4 grid gap-3 rounded-[16px] border p-4 md:grid-cols-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
          <label className="block space-y-1.5">
            <span className="crm-tiny">미팅일정</span>
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
              style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="crm-tiny">미팅장소</span>
            <input
              value={meetingAddress}
              onChange={(event) => setMeetingAddress(event.target.value)}
              placeholder="예: 모델하우스 / 고객 사무실"
              className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
              style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="crm-tiny">일정 메모</span>
            <input
              value={meetingMemo}
              onChange={(event) => setMeetingMemo(event.target.value)}
              placeholder="예: 미팅 전 자료 전달"
              className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
              style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
            />
          </label>
          <div className="flex gap-2 md:col-span-3">
            <button type="button" onClick={() => setMeetingOpen(false)} className="btn-premium btn-secondary h-9 flex-1">
              취소
            </button>
            <button type="button" onClick={handleMeetingSubmit} className="btn-premium btn-primary h-9 flex-1">
              일정 저장
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NotesTab({ customer, composerOpen }: { customer: PipelineCustomer; composerOpen: boolean }) {
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newContent, setNewContent] = useState("");
  const [notes, setNotes] = useState([
    {
      id: 1,
      noteDate: customer.registeredAt,
      content: customer.noteSummary,
      author: "고객DB 메모",
    },
  ]);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    setNotes((items) => [
      {
        id: Date.now(),
        noteDate: newDate,
        content: newContent.trim(),
        author: "현재 사용자",
      },
      ...items,
    ]);
    setNewContent("");
    setNewDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <section className="premium-card mt-4 p-5">
      <div className="mb-4 flex items-center gap-2">
        <FileText size={17} style={{ color: "var(--accent)" }} />
        <div>
          <p className="crm-section-title">Notes</p>
          <p className="crm-tiny">활동노트 작성과 상담 기록</p>
        </div>
      </div>

      {composerOpen ? (
        <div className="mb-4 space-y-3 rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-[900]" style={{ color: "var(--text-strong)" }}>
              활동노트 작성
            </p>
            <input
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              className="h-9 rounded-[10px] border px-3 text-[12px] font-semibold outline-none"
              style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
            />
          </div>
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            placeholder="활동 내용을 입력하세요."
            rows={5}
            className="w-full resize-none rounded-[12px] border px-3 py-3 text-[13px] font-semibold leading-7 outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}
          />
          <button type="button" onClick={handleAdd} className="btn-premium btn-primary w-full">
            <Plus size={14} />
            활동노트 저장
          </button>
          <p className="crm-tiny">현재 화면에서는 패널 내 임시 작성이며, 실제 Supabase 저장은 후속 작업에서 연결합니다.</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {notes.map((note) => (
          <article key={note.id} className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] font-[900]" style={{ color: "var(--text-subtle)" }}>
                {note.noteDate}
              </p>
              <span className="badge-premium badge-muted">{note.author}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
              {note.content}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdsTab({ customer, onOpenAdRequest }: { customer: PipelineCustomer; onOpenAdRequest: () => void }) {
  return (
    <section className="premium-card mt-4 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone size={17} style={{ color: "var(--accent)" }} />
          <div>
            <p className="crm-section-title">Ads</p>
            <p className="crm-tiny">광고 요청 및 진행 이력</p>
          </div>
        </div>
        <button type="button" onClick={onOpenAdRequest} className="btn-premium btn-primary h-9 px-3 text-[12px]">
          <Plus size={13} />
          광고요청 생성
        </button>
      </div>
      <div className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
        <p className="text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
          {customer.adsSummary}
        </p>
        <p className="crm-tiny mt-3">광고요청 버튼을 누르면 결제&업무요청의 업무요청 형식으로 생성합니다.</p>
      </div>
    </section>
  );
}

function InfoItem({ label, value, badge = false }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="rounded-[14px] border px-3 py-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <p className="crm-meta">{label}</p>
      <div className="mt-2">
        {badge ? (
          <span className={`badge-premium ${badgeClass(value)}`}>{value}</span>
        ) : (
          <p className="text-sm font-[820] leading-6" style={{ color: "var(--text-strong)" }}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="premium-card rounded-[18px] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="crm-meta">{label}</p>
          <p className="mt-1 text-2xl font-[930]" style={{ color: "var(--text-strong)" }}>
            {value}
          </p>
        </div>
        <div className="premium-icon-lg h-10 w-10">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ModalShell({ title, subtitle, children, onClose }: { title: string; subtitle: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="모달 닫기" onClick={onClose} className="absolute inset-0 cursor-default" style={{ background: "var(--overlay)" }} />
      <div className="premium-card relative z-10 max-h-[88vh] w-full max-w-[820px] overflow-hidden rounded-[24px]">
        <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: "var(--border-subtle)" }}>
          <div>
            <p className="crm-section-title">{title}</p>
            <p className="crm-tiny mt-1">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0">
            <X size={15} />
          </button>
        </div>
        <div className="max-h-[calc(88vh-86px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function EditCustomerModal({ customer, onClose, onSave }: { customer: PipelineCustomer; onClose: () => void; onSave: (customer: PipelineCustomer, form: EditForm) => void }) {
  const [form, setForm] = useState<EditForm>({
    name: customer.name === "-" ? "" : customer.name,
    title: customer.title === "-" ? "" : customer.title,
    phone: customer.phone === "-" ? "" : customer.phone,
    intake_route: customer.intakeRoute === "-" ? "" : customer.intakeRoute,
    company: customer.company === "-" ? "" : customer.company,
    management_stage: customer.stage,
    customer_grade: customer.grade === "-" ? UNREVIEWED_GRADE : customer.grade,
    memo: stripGradeAssessmentBlock(customer.raw.memo),
  });

  const setValue = (key: keyof EditForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ModalShell title="고객정보 수정" subtitle="고객DB와 파이프라인3에 함께 반영됩니다." onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="고객명">
          <input className="crm-search h-11 w-full px-3" value={form.name} onChange={(event) => setValue("name", event.target.value)} />
        </FormField>
        <FormField label="직급">
          <select className="crm-search h-11 w-full px-3" value={form.title} onChange={(event) => setValue("title", event.target.value)}>
            <option value="">선택</option>
            {TITLE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="연락처">
          <input className="crm-search h-11 w-full px-3" value={form.phone} onChange={(event) => setValue("phone", formatPhoneInput(event.target.value))} />
        </FormField>
        <FormField label="소속회사">
          <input className="crm-search h-11 w-full px-3" value={form.company} onChange={(event) => setValue("company", event.target.value)} placeholder="소속회사명을 입력하세요" />
        </FormField>
        <FormField label="유입경로">
          <select className="crm-search h-11 w-full px-3" value={form.intake_route} onChange={(event) => setValue("intake_route", event.target.value)}>
            <option value="">선택</option>
            {INTAKE_ROUTES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="관리단계">
          <select className="crm-search h-11 w-full px-3" value={form.management_stage} onChange={(event) => setValue("management_stage", event.target.value)}>
            {MANAGEMENT_STAGES.map((item) => <option key={item} value={item}>{stageLabel(item)}</option>)}
          </select>
        </FormField>
        <FormField label="자동등급">
          <select className="crm-search h-11 w-full px-3" value={form.customer_grade} onChange={(event) => setValue("customer_grade", event.target.value)}>
            {CUSTOMER_GRADES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </FormField>
        <div className="md:col-span-2">
          <FormField label="메모">
            <textarea
              rows={5}
              className="crm-search w-full resize-none px-3 py-3"
              value={form.memo}
              onChange={(event) => setValue("memo", event.target.value)}
              placeholder="고객 메모를 입력하세요"
            />
          </FormField>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="btn-premium btn-secondary h-10 flex-1">취소</button>
        <button type="button" onClick={() => onSave(customer, form)} className="btn-premium btn-primary h-10 flex-1">
          <Save size={14} />
          저장
        </button>
      </div>
    </ModalShell>
  );
}

function AdRequestModal({ customer, onClose, onCreated }: { customer: PipelineCustomer; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdRequestForm>({
    category: "호갱노노 광고요청",
    assignee: "",
    priority: "보통",
    siteName: "",
    adProduct: "",
    hopeDate: TODAY,
    content: `${customer.name} ${customer.title} 고객 광고요청\n연락처: ${customer.phone}\n유입경로: ${customer.intakeRoute}\n관리단계: ${stageLabel(customer.stage)}\n\n요청내용:\n`,
  });

  const setValue = (key: keyof AdRequestForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    if (!form.assignee) {
      alert("수신자를 선택하세요.");
      return;
    }
    if (!form.content.trim()) {
      alert("요청 내용을 입력하세요.");
      return;
    }

    let requester = "";
    try {
      const raw = localStorage.getItem("crm_user");
      requester = raw ? JSON.parse(raw)?.name || "" : "";
    } catch {}

    const content = [
      `[파이프라인3 광고요청]`,
      `고객명: ${customer.name} ${customer.title}`,
      `연락처: ${customer.phone}`,
      `유입경로: ${customer.intakeRoute}`,
      `관리단계: ${stageLabel(customer.stage)}`,
      form.siteName ? `현장명: ${form.siteName}` : "",
      form.adProduct ? `광고상품: ${form.adProduct}` : "",
      form.hopeDate ? `희망일자: ${form.hopeDate}` : "",
      "",
      form.content.trim(),
    ].filter(Boolean).join("\n");

    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      category: form.category,
      content,
      priority: form.priority,
      assignee: form.assignee,
      requester: requester || "파이프라인3",
      status: "요청",
      tagged: null,
      file_urls: null,
    });
    setSaving(false);

    if (error) {
      alert(`광고요청 생성 실패: ${error.message}`);
      return;
    }

    alert("광고요청이 결제&업무요청에 생성되었습니다.");
    onCreated();
  };

  return (
    <ModalShell title="광고요청 생성" subtitle="결제&업무요청의 업무요청으로 저장됩니다." onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="수신자">
          <select className="crm-search h-11 w-full px-3" value={form.assignee} onChange={(event) => setValue("assignee", event.target.value)}>
            <option value="">선택</option>
            {TASK_ASSIGNEES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="카테고리">
          <select className="crm-search h-11 w-full px-3" value={form.category} onChange={(event) => setValue("category", event.target.value)}>
            <option value="호갱노노 광고요청">호갱노노 광고요청</option>
            <option value="일반 업무요청">일반 업무요청</option>
          </select>
        </FormField>
        <FormField label="우선순위">
          <select className="crm-search h-11 w-full px-3" value={form.priority} onChange={(event) => setValue("priority", event.target.value)}>
            {PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="희망일자">
          <input type="date" className="crm-search h-11 w-full px-3" value={form.hopeDate} onChange={(event) => setValue("hopeDate", event.target.value)} />
        </FormField>
        <FormField label="현장명">
          <input className="crm-search h-11 w-full px-3" value={form.siteName} onChange={(event) => setValue("siteName", event.target.value)} placeholder="예: 대우엘크루 일산" />
        </FormField>
        <FormField label="광고상품">
          <input className="crm-search h-11 w-full px-3" value={form.adProduct} onChange={(event) => setValue("adProduct", event.target.value)} placeholder="예: 호갱노노 / LMS / 배너" />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="상세 요청 내용">
            <textarea
              rows={8}
              className="crm-search w-full resize-none px-3 py-3"
              value={form.content}
              onChange={(event) => setValue("content", event.target.value)}
              placeholder="업무 요청 내용을 상세히 입력하세요."
            />
          </FormField>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="btn-premium btn-secondary h-10 flex-1">취소</button>
        <button type="button" onClick={handleCreate} disabled={saving} className="btn-premium btn-primary h-10 flex-1">
          <Plus size={14} />
          {saving ? "생성 중..." : "업무요청 생성"}
        </button>
      </div>
    </ModalShell>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="crm-meta mb-2 block">{label}</span>
      {children}
    </label>
  );
}

export default function Pipeline3Page() {
  const [records, setRecords] = useState<CustomerDbRecord[]>(SAMPLE_RECORDS);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [adRequestCustomerId, setAdRequestCustomerId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CustomerDbRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecords(parsed);
          setLoadedFromDb(true);
        }
      }
    } catch {
      setLoadedFromDb(false);
    }
  }, []);

  const customers = useMemo(() => records.map(toPipelineCustomer), [records]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const editCustomer = useMemo(
    () => customers.find((customer) => customer.id === editCustomerId) || null,
    [customers, editCustomerId],
  );

  const adRequestCustomer = useMemo(
    () => customers.find((customer) => customer.id === adRequestCustomerId) || null,
    [customers, adRequestCustomerId],
  );

  const stats = useMemo(
    () => ({
      total: customers.length,
      lead: customers.filter((customer) => customer.stage === "리드").length,
      prospecting: customers.filter((customer) => customer.stage === "프로스펙팅").length,
      closing: customers.filter((customer) => customer.stage === "딜크로징").length,
      signed: customers.filter((customer) => customer.stage === "리텐션").length,
      paused: customers.filter((customer) => customer.stage === "보류/이탈").length,
    }),
    [customers],
  );

  const persistRecords = (nextRecords: CustomerDbRecord[]) => {
    setRecords(nextRecords);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
      setLoadedFromDb(true);
    } catch {}
  };

  const updateRecord = (id: number, patch: Partial<CustomerDbRecord>) => {
    const now = new Date().toISOString();
    persistRecords(
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              ...patch,
              updated_at: now,
            }
          : record,
      ),
    );
  };

  const openDetail = (customer: PipelineCustomer) => {
    setSelectedCustomerId(customer.id);
    setDetailTab("summary");
    setNoteComposerOpen(false);
  };

  const handleStageChange = (customer: PipelineCustomer, target: StageKey) => {
    updateRecord(customer.id, {
      management_stage: target,
      customer_grade: target === "보류/이탈" ? "보류" : stageLabel(target),
      memo: stripGradeAssessmentBlock(customer.raw.memo) || getFollowUpByStage(target),
    });
  };

  const handleMeetingSave = (customer: PipelineCustomer, meetingDate: string, meetingAddress: string, meetingMemo: string) => {
    const currentMemo = stripGradeAssessmentBlock(customer.raw.memo);
    const meetingMemoBlock = [
      currentMemo,
      "",
      `[미팅일정] ${meetingDate}`,
      meetingAddress ? `장소: ${meetingAddress}` : "장소: 미입력",
      meetingMemo ? `메모: ${meetingMemo}` : "",
    ].filter(Boolean).join("\n");

    updateRecord(customer.id, {
      memo: meetingMemoBlock,
    });
  };

  const handleOpenNoteComposer = () => {
    setDetailTab("notes");
    setNoteComposerOpen(true);
  };

  const handleSaveEdit = (customer: PipelineCustomer, form: EditForm) => {
    if (!form.name.trim()) {
      alert("고객명을 입력하세요.");
      return;
    }
    if (!form.phone.trim()) {
      alert("연락처를 입력하세요.");
      return;
    }

    updateRecord(customer.id, {
      name: form.name.trim(),
      title: form.title,
      phone: form.phone,
      intake_route: form.intake_route,
      company: form.company,
      management_stage: form.management_stage,
      customer_grade: form.customer_grade,
      memo: form.memo,
    });
    setEditCustomerId(null);
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
            고객DB 기본정보를 기반으로 계약 전환 전 영업 활동을 관리합니다.
            {loadedFromDb ? " 고객DB 로컬 데이터와 연동 중입니다." : " 현재는 샘플 데이터가 표시됩니다."}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="전체 고객" value={stats.total} icon={Target} />
          <StatCard label="리드" value={stats.lead} icon={Flame} />
          <StatCard label="프로스펙팅" value={stats.prospecting} icon={Search} />
          <StatCard label="딜클로징" value={stats.closing} icon={Zap} />
          <StatCard label="리텐션" value={stats.signed} icon={UserCheck} />
          <StatCard label="보류/이탈" value={stats.paused} icon={X} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto px-5 pb-5 md:px-7">
        <div className="grid h-full min-w-[1180px] grid-cols-5 gap-3 2xl:min-w-0">
          {STAGES.map((stage) => {
            const stageCustomers = customers.filter((customer) => customer.stage === stage.key);
            const Icon = stage.icon;
            return (
              <section key={stage.key} className="premium-card flex min-w-0 flex-col overflow-hidden rounded-[22px]">
                <div className="flex-shrink-0 border-b p-4" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                        <span className={`badge-premium ${toneClass(stage.tone)}`}>{stage.label}</span>
                      </div>
                      <p className="crm-tiny mt-2 leading-5">{stage.desc}</p>
                    </div>
                    <span className="crm-tiny shrink-0">{stageCustomers.length}명</span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="grid gap-2.5">
                    {stageCustomers.map((customer) => (
                      <PipelineCard key={customer.id} customer={customer} onClick={() => openDetail(customer)} />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {selectedCustomer ? (
        <DetailPanel
          customer={selectedCustomer}
          tab={detailTab}
          noteComposerOpen={noteComposerOpen}
          onTab={(nextTab) => {
            setDetailTab(nextTab);
            if (nextTab !== "notes") setNoteComposerOpen(false);
          }}
          onClose={() => setSelectedCustomerId(null)}
          onStageChange={handleStageChange}
          onMeetingSave={handleMeetingSave}
          onOpenNoteComposer={handleOpenNoteComposer}
          onOpenEdit={() => setEditCustomerId(selectedCustomer.id)}
          onOpenAdRequest={() => setAdRequestCustomerId(selectedCustomer.id)}
        />
      ) : null}

      {editCustomer ? (
        <EditCustomerModal
          customer={editCustomer}
          onClose={() => setEditCustomerId(null)}
          onSave={handleSaveEdit}
        />
      ) : null}

      {adRequestCustomer ? (
        <AdRequestModal
          customer={adRequestCustomer}
          onClose={() => setAdRequestCustomerId(null)}
          onCreated={() => setAdRequestCustomerId(null)}
        />
      ) : null}
    </div>
  );
}
