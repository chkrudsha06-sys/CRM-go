"use client";

import {
  BarChart3,
  CalendarDays,
  Clock,
  FileText,
  Flame,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Target,
  User,
  UserCheck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

type StageKey = "리드" | "프로스펙팅" | "딜클로징" | "계약완료" | "보류/이탈";

type Stage = {
  key: StageKey;
  label: string;
  desc: string;
  tone: "danger" | "warning" | "success" | "purple" | "muted" | "info";
  icon: LucideIcon;
};

type PipelineCustomer = {
  id: number;
  name: string;
  title: string;
  phone: string;
  intakeRoute: string;
  grade: string;
  stage: StageKey;
  lastActivity: string;
  registeredAt: string;
  nextContact: string;
  meetingSchedule: string;
  meetingAddress: string;
  followUp: string;
  noteSummary: string;
  adsSummary: string;
};

type DetailTab = "summary" | "notes" | "ads";

const STAGES: Stage[] = [
  { key: "리드", label: "Leads", desc: "초기 유입", tone: "danger", icon: Flame },
  { key: "프로스펙팅", label: "Prospecting", desc: "상담/검토", tone: "warning", icon: Search },
  { key: "딜클로징", label: "Closing", desc: "계약 직전", tone: "success", icon: Zap },
  { key: "계약완료", label: "Signed", desc: "계약 완료", tone: "purple", icon: UserCheck },
  { key: "보류/이탈", label: "Paused", desc: "보류/이탈", tone: "muted", icon: X },
];

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "notes", label: "Notes" },
  { key: "ads", label: "Ads >" },
];

const INITIAL_CUSTOMERS: PipelineCustomer[] = [
  {
    id: 1,
    name: "조효숙",
    title: "팀장",
    phone: "010-2455-1709",
    intakeRoute: "컨설턴트 고객DB",
    grade: "리드",
    stage: "리드",
    lastActivity: "오늘 10:20",
    registeredAt: "06.05",
    nextContact: "오늘 17:00 재통화",
    meetingSchedule: "미팅 일정 조율 전",
    meetingAddress: "",
    followUp: "철저한 고객관리를 통해 프로스펙팅 구간으로 관리를 변경하세요.",
    noteSummary: "초기 유입 고객입니다. 상세한 상담 내용은 카드가 아닌 상세 패널에서 관리합니다.",
    adsSummary: "광고 요청 이력 없음. 상담 진행 후 필요 시 광고요청으로 전환 예정.",
  },
  {
    id: 2,
    name: "주해랑",
    title: "팀장",
    phone: "010-3520-3365",
    intakeRoute: "컨설턴트 VIP DB",
    grade: "프로스펙팅",
    stage: "프로스펙팅",
    lastActivity: "어제 17:40",
    registeredAt: "06.04",
    nextContact: "06.06 오전 자료 회신",
    meetingSchedule: "06.07 오후 2시",
    meetingAddress: "강남",
    followUp: "고객과의 라포 형성이 되었는지 확인하고 미팅 일정 확정을 진행하세요.",
    noteSummary: "대형 현장 운영 경험이 있고 계약 조건 검토 단계로 진입 가능.",
    adsSummary: "광고 집행 규모 검토 필요. 계약 전환 후 운영 광고 설계 예정.",
  },
  {
    id: 3,
    name: "박중필",
    title: "본부장",
    phone: "010-3349-6953",
    intakeRoute: "컨설턴트 VIP DB",
    grade: "딜클로징",
    stage: "딜클로징",
    lastActivity: "06.04",
    registeredAt: "06.03",
    nextContact: "계약 조건 최종 확인",
    meetingSchedule: "06.08 오전 11시",
    meetingAddress: "수원 모델하우스",
    followUp: "마지막 클로징을 진행하고 계약완료 또는 보류 여부를 확정하세요.",
    noteSummary: "계약 의향이 높아 최종 조건 정리 필요.",
    adsSummary: "계약 후 초기 광고비 지원 가능 여부 확인 예정.",
  },
  {
    id: 4,
    name: "이소영",
    title: "본부장",
    phone: "010-2777-4586",
    intakeRoute: "컨설턴트 VIP DB",
    grade: "계약완료",
    stage: "계약완료",
    lastActivity: "06.02",
    registeredAt: "05.31",
    nextContact: "계약관리 이관 확인",
    meetingSchedule: "계약 완료",
    meetingAddress: "",
    followUp: "계약관리 메뉴 이관 후 정산, 사후관리, MGM 관리로 전환하세요.",
    noteSummary: "계약 전환 완료. 파이프라인에서는 이관 전 확인 상태로만 표시합니다.",
    adsSummary: "계약 후 광고 운영 계획 별도 수립 필요.",
  },
  {
    id: 5,
    name: "김소이",
    title: "팀장",
    phone: "010-2755-6981",
    intakeRoute: "컨설턴트 고객DB",
    grade: "보류",
    stage: "보류/이탈",
    lastActivity: "05.30",
    registeredAt: "05.29",
    nextContact: "2주 후 재접점",
    meetingSchedule: "없음",
    meetingAddress: "",
    followUp: "응답률이 낮아 재접점 대상으로 분리했습니다. 필요 시 리드로 복귀하세요.",
    noteSummary: "초기 응답 이후 추가 답변 없음. 이탈 가능성 있음.",
    adsSummary: "광고 관련 요청 없음.",
  },
];

function badgeClass(value: string) {
  if (value === "마스터") return "grade-master";
  if (value === "챌린저") return "grade-challenger";
  if (value === "브론즈") return "grade-bronze";
  if (value === "추가 심사 후보") return "grade-review";
  if (value === "심사미진행") return "grade-hold";
  if (value === "리드") return "badge-danger";
  if (value === "프로스펙팅") return "badge-warning";
  if (value === "딜클로징") return "badge-success";
  if (value === "계약완료") return "badge-purple";
  if (value === "보류") return "badge-muted";
  if (value === "분양의신DB") return "badge-purple";
  if (value === "완판트럭") return "badge-warning";
  if (value === "분양라인") return "badge-cyan";
  if (value === "분양회MGM") return "badge-success";
  if (value === "대협팀활동") return "badge-info";
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
  if (target === "딜클로징") return "딜클로징 전환";
  if (target === "계약완료") return "리텐션 전환";
  return `${target} 전환`;
}

function getStageButtonIcon(target: StageKey) {
  if (target === "리드") return <Flame size={14} />;
  if (target === "프로스펙팅") return <Search size={14} />;
  if (target === "딜클로징") return <Zap size={14} />;
  if (target === "계약완료") return <UserCheck size={14} />;
  return <X size={14} />;
}

function getQuickStageTargets(stage: StageKey): StageKey[] {
  if (stage === "리드") return ["프로스펙팅", "딜클로징", "계약완료"];
  if (stage === "프로스펙팅") return ["리드", "딜클로징", "계약완료"];
  if (stage === "딜클로징") return ["리드", "프로스펙팅", "계약완료"];
  if (stage === "계약완료") return ["리드", "프로스펙팅", "딜클로징"];
  return ["리드", "프로스펙팅", "딜클로징"];
}

function getFollowUpByStage(stage: StageKey) {
  if (stage === "리드") return "철저한 고객관리를 통해 프로스펙팅 구간으로 관리를 변경하세요.";
  if (stage === "프로스펙팅") return "고객과의 라포 형성이 되었는지 확인하고 미팅 일정 확정을 진행하세요.";
  if (stage === "딜클로징") return "계약 전환을 위해 마지막 클로징을 진행하세요.";
  if (stage === "계약완료") return "계약관리 메뉴 이관 후 정산, 사후관리, MGM 관리를 진행하세요.";
  return "재접점 필요 여부를 확인하고 리드 또는 프로스펙팅으로 복귀하세요.";
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
}: {
  customer: PipelineCustomer;
  tab: DetailTab;
  noteComposerOpen: boolean;
  onTab: (tab: DetailTab) => void;
  onClose: () => void;
  onStageChange: (customer: PipelineCustomer, target: StageKey) => void;
  onMeetingSave: (customer: PipelineCustomer, meetingDate: string, meetingAddress: string, meetingMemo: string) => void;
  onOpenNoteComposer: () => void;
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
          {tab === "ads" ? <AdsTab customer={customer} /> : null}
        </div>

        <div className="slide-panel-footer" style={{ padding: "clamp(16px, 1.6vw, 22px) clamp(20px, 2vw, 28px)" }}>
          <div className="grid grid-cols-3 gap-3">
            <button type="button" className="btn-premium btn-secondary" title="샘플 화면에서는 저장되지 않습니다.">
              <User size={14} />
              고객정보수정
            </button>
            <button type="button" onClick={onOpenNoteComposer} className="btn-premium btn-secondary">
              <MessageSquare size={14} />
              Notes
            </button>
            <button type="button" className="btn-premium btn-secondary" title="광고요청 기능은 추후 활성화 예정입니다.">
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
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Phone size={17} style={{ color: "var(--accent)" }} />
            <div>
              <p className="crm-section-title">고객정보</p>
              <p className="crm-tiny">고객등록 연동 기본 정보</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="연락처" value={customer.phone} />
            <InfoItem label="직급" value={customer.title} />
            <InfoItem label="유입경로" value={customer.intakeRoute} badge />
            <InfoItem label="등록일" value={customer.registeredAt} />
            <InfoItem label="미팅일정" value={customer.meetingSchedule || "-"} />
            <InfoItem label="미팅장소" value={customer.meetingAddress || "-"} />
          </div>
        </section>

        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target size={17} style={{ color: "var(--accent)" }} />
            <div>
              <p className="crm-section-title">Pipeline state</p>
              <p className="crm-tiny">현재 관리 단계</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="관리단계" value={customer.stage} badge />
            <InfoItem label="자동등급" value={customer.grade} badge />
            <InfoItem label="마지막 활동" value={customer.lastActivity} />
            <InfoItem label="다음 연락 예정" value={customer.nextContact} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={17} style={{ color: "var(--accent)" }} />
            <div>
              <p className="crm-section-title">Memo</p>
              <p className="crm-tiny">상담 내용과 다음 흐름</p>
            </div>
          </div>
          <div className="min-h-[108px] rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <p className="text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
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
          <div className="min-h-[108px] rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <p className="text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
              {customer.noteSummary}
            </p>
            <p className="crm-tiny mt-3">샘플 활동노트입니다. 실제 contact_notes 연결은 후속 작업에서 진행합니다.</p>
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
      author: "샘플",
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
          <p className="crm-tiny">샘플 화면이므로 실제 Supabase 저장은 후속 작업에서 연결합니다.</p>
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

function AdsTab({ customer }: { customer: PipelineCustomer }) {
  return (
    <section className="premium-card mt-4 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Megaphone size={17} style={{ color: "var(--accent)" }} />
        <div>
          <p className="crm-section-title">Ads</p>
          <p className="crm-tiny">광고 요청 및 진행 이력</p>
        </div>
      </div>
      <div className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
        <p className="text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
          {customer.adsSummary}
        </p>
        <p className="crm-tiny mt-3">광고 요청 저장/연동은 이번 단계에서 동작하지 않습니다.</p>
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

export default function Pipeline3Page() {
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const stats = useMemo(
    () => ({
      total: customers.length,
      lead: customers.filter((customer) => customer.stage === "리드").length,
      prospecting: customers.filter((customer) => customer.stage === "프로스펙팅").length,
      closing: customers.filter((customer) => customer.stage === "딜클로징").length,
      signed: customers.filter((customer) => customer.stage === "계약완료").length,
      paused: customers.filter((customer) => customer.stage === "보류/이탈").length,
    }),
    [customers],
  );

  const openDetail = (customer: PipelineCustomer) => {
    setSelectedCustomerId(customer.id);
    setDetailTab("summary");
    setNoteComposerOpen(false);
  };

  const handleStageChange = (customer: PipelineCustomer, target: StageKey) => {
    setCustomers((items) =>
      items.map((item) =>
        item.id === customer.id
          ? {
              ...item,
              stage: target,
              grade: target === "보류/이탈" ? "보류" : target,
              lastActivity: "방금 전",
              followUp: getFollowUpByStage(target),
            }
          : item,
      ),
    );
  };

  const handleMeetingSave = (customer: PipelineCustomer, meetingDate: string, meetingAddress: string, meetingMemo: string) => {
    setCustomers((items) =>
      items.map((item) =>
        item.id === customer.id
          ? {
              ...item,
              meetingSchedule: meetingDate,
              meetingAddress: meetingAddress || "미팅 장소 미입력",
              nextContact: meetingDate,
              followUp: meetingMemo || item.followUp,
              lastActivity: "방금 전",
            }
          : item,
      ),
    );
  };

  const handleOpenNoteComposer = () => {
    setDetailTab("notes");
    setNoteComposerOpen(true);
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
            기존 파이프라인 구조를 유지한 샘플 보드입니다. 실제 DB 저장은 후속 작업에서 연결합니다.
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="전체 샘플" value={stats.total} icon={Target} />
          <StatCard label="리드" value={stats.lead} icon={Flame} />
          <StatCard label="프로스펙팅" value={stats.prospecting} icon={Search} />
          <StatCard label="딜클로징" value={stats.closing} icon={Zap} />
          <StatCard label="계약완료" value={stats.signed} icon={UserCheck} />
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
        />
      ) : null}
    </div>
  );
}
