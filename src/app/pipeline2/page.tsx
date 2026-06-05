"use client";

import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Kanban,
  MessageSquarePlus,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type PipelineStage = {
  key: string;
  label: string;
  helper: string;
  tone: string;
};

type PipelineCustomer = {
  id: number;
  name: string;
  title: string;
  manager: string;
  phone: string;
  grade: string;
  lastActivity: string;
  nextAction: string;
  stage: string;
  needsMeeting?: boolean;
  contractPending?: boolean;
  followUpToday?: boolean;
};

type DetailTab = "basic" | "notes" | "meeting" | "summary" | "move" | "contract";

const STAGES: PipelineStage[] = [
  {
    key: "db-assigned",
    label: "DB 배정",
    helper: "고객DB에서 유입된 초기 배정",
    tone: "badge-info",
  },
  {
    key: "lead",
    label: "리드",
    helper: "1차 접점과 응답 확인",
    tone: "badge-purple",
  },
  {
    key: "prospecting",
    label: "프로스펙팅",
    helper: "상담 진행과 니즈 확인",
    tone: "badge-warning",
  },
  {
    key: "closing",
    label: "딜클로징",
    helper: "계약 전환 설득과 조건 정리",
    tone: "badge-danger",
  },
  {
    key: "contracted",
    label: "계약완료",
    helper: "계약관리 이관 전 임시 확인",
    tone: "badge-success",
  },
];

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "basic", label: "기본정보" },
  { key: "notes", label: "활동노트" },
  { key: "meeting", label: "미팅/일정" },
  { key: "summary", label: "통화요약" },
  { key: "move", label: "단계이동" },
  { key: "contract", label: "계약전환" },
];

const EVENT_BUTTONS = ["통화완료", "부재중", "미팅확정", "계약유력", "계약완료", "활동노트 추가"];

const SAMPLE_CUSTOMERS: PipelineCustomer[] = [
  {
    id: 1,
    name: "주해랑",
    title: "팀장",
    manager: "조계현",
    phone: "010-3520-3365",
    grade: "챌린저",
    lastActivity: "오늘 10:20",
    nextAction: "통화요약 확인 후 미팅 제안",
    stage: "db-assigned",
    needsMeeting: true,
    followUpToday: true,
  },
  {
    id: 2,
    name: "김도윤",
    title: "본부장",
    manager: "이세호",
    phone: "010-4881-9021",
    grade: "마스터",
    lastActivity: "어제 17:40",
    nextAction: "1차 콜백",
    stage: "lead",
    followUpToday: true,
  },
  {
    id: 3,
    name: "박서연",
    title: "팀원",
    manager: "기여운",
    phone: "010-7712-6408",
    grade: "브론즈",
    lastActivity: "06.04",
    nextAction: "상담 자료 발송",
    stage: "prospecting",
    needsMeeting: true,
  },
  {
    id: 4,
    name: "이준호",
    title: "팀장",
    manager: "최연전",
    phone: "010-9133-2240",
    grade: "추가 심사 후보",
    lastActivity: "06.03",
    nextAction: "계약 조건 재확인",
    stage: "closing",
    contractPending: true,
  },
  {
    id: 5,
    name: "최민재",
    title: "본부장",
    manager: "조계현",
    phone: "010-1204-7781",
    grade: "마스터",
    lastActivity: "06.02",
    nextAction: "계약관리 이관 준비",
    stage: "contracted",
  },
];

function gradeClass(grade: string) {
  if (grade === "마스터") return "grade-master";
  if (grade === "챌린저") return "grade-challenger";
  if (grade === "브론즈") return "grade-bronze";
  if (grade === "추가 심사 후보") return "grade-review";
  return "badge-muted";
}

function customersForStage(stageKey: string) {
  return SAMPLE_CUSTOMERS.filter((customer) => customer.stage === stageKey);
}

function stageLabel(stageKey: string) {
  return STAGES.find((stage) => stage.key === stageKey)?.label || "-";
}

function CustomerCard({
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
            {customer.name}
          </p>
          <p className="crm-tiny mt-0.5 truncate">{customer.title}</p>
        </div>
        <span className={`badge-premium shrink-0 px-2 py-1 text-[11px] ${gradeClass(customer.grade)}`}>
          {customer.grade}
        </span>
      </div>

      <div className="mt-2 grid gap-1.5 text-[12px] font-[720]" style={{ color: "var(--text-subtle)" }}>
        <div className="flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5" style={{ color: "var(--text-faint)" }} />
          <span className="truncate">담당 {customer.manager}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" style={{ color: "var(--text-faint)" }} />
          <span className="truncate">{customer.phone}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" style={{ color: "var(--text-faint)" }} />
          <span className="truncate">마지막 활동 {customer.lastActivity}</span>
        </div>
      </div>

      <div className="mt-2 rounded-[12px] border px-2.5 py-2" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
        <p className="crm-meta">다음 액션</p>
        <p className="mt-1 line-clamp-2 text-[12.5px] font-[760] leading-5" style={{ color: "var(--text)" }}>
          {customer.nextAction}
        </p>
      </div>
    </button>
  );
}

function DetailPanel({
  customer,
  tab,
  onTab,
  onClose,
}: {
  customer: PipelineCustomer;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onClose: () => void;
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
        className="absolute right-0 top-0 flex h-full w-full max-w-[720px] flex-col border-l"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="slide-panel-header flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={`badge-premium ${gradeClass(customer.grade)}`}>{customer.grade}</span>
              <span className="badge-premium badge-info">{stageLabel(customer.stage)}</span>
            </div>
            <h2 className="truncate text-[28px] font-[930] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
              {customer.name}
            </h2>
            <p className="mt-2 text-sm font-[720]" style={{ color: "var(--text-muted)" }}>
              {customer.title} · 담당 {customer.manager} · {customer.phone}
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

          <section className="premium-card mt-4 p-5">
            <p className="crm-card-title">{DETAIL_TABS.find((item) => item.key === tab)?.label}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoItem label="고객명" value={customer.name} />
              <InfoItem label="직급" value={customer.title} />
              <InfoItem label="담당자" value={customer.manager} />
              <InfoItem label="연락처" value={customer.phone} />
              <InfoItem label="자동등급" value={customer.grade} />
              <InfoItem label="현재 단계" value={stageLabel(customer.stage)} />
              <InfoItem label="마지막 활동일" value={customer.lastActivity} />
              <InfoItem label="다음 액션" value={customer.nextAction} />
            </div>
            <p className="crm-tiny mt-4 leading-6">
              이 패널은 1차 UI 뼈대입니다. 실제 활동노트, 미팅/일정, 통화요약, 단계 이동, 계약전환 저장은 후속 작업에서 Supabase와 연결합니다.
            </p>
          </section>
        </div>

        <div className="slide-panel-footer">
          <div className="flex flex-wrap gap-2">
            {EVENT_BUTTONS.map((label) => (
              <button key={label} type="button" className="btn-premium btn-secondary">
                {label === "활동노트 추가" ? <MessageSquarePlus size={14} /> : null}
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border px-3 py-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <p className="crm-meta">{label}</p>
      <p className="mt-2 text-sm font-[820] leading-6" style={{ color: "var(--text-strong)" }}>
        {value}
      </p>
    </div>
  );
}

export default function Pipeline2Page() {
  const [selectedCustomer, setSelectedCustomer] = useState<PipelineCustomer | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("basic");

  const summaryItems = useMemo(
    () => [
      { label: "전체 고객", value: SAMPLE_CUSTOMERS.length },
      { label: "계약 전환 대기", value: SAMPLE_CUSTOMERS.filter((customer) => customer.contractPending).length },
      { label: "미팅 필요", value: SAMPLE_CUSTOMERS.filter((customer) => customer.needsMeeting).length },
      { label: "계약완료", value: customersForStage("contracted").length },
      { label: "오늘 후속 액션", value: SAMPLE_CUSTOMERS.filter((customer) => customer.followUpToday).length },
    ],
    [],
  );

  const openCustomer = (customer: PipelineCustomer) => {
    setSelectedCustomer(customer);
    setDetailTab("basic");
  };

  return (
    <div
      className="premium-page min-h-full w-full overflow-x-hidden"
      style={{
        background:
          "radial-gradient(circle at 80% 0%, rgba(139,124,246,0.12), transparent 28%), radial-gradient(circle at 14% 6%, rgba(34,211,238,0.08), transparent 25%), var(--bg)",
        color: "var(--text)",
      }}
    >
      <div className="w-full space-y-4 px-4 py-5 sm:px-5 md:px-6 lg:px-7 2xl:px-8">
        <header className="premium-card relative overflow-hidden rounded-[24px] p-4 sm:p-5">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full blur-3xl" style={{ background: "var(--accent-bg)" }} />
          <div className="absolute bottom-0 right-40 h-40 w-40 rounded-full blur-3xl" style={{ background: "var(--cyan-bg)" }} />

          <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-[850] badge-purple">
                <Kanban className="h-4 w-4 flex-none" />
                <span className="truncate">계약 전환 전 영업 실행 보드 · 샘플 데이터</span>
              </div>
              <h1 className="crm-title text-[30px] font-[930] leading-tight tracking-[-0.06em] sm:text-[36px]">
                파이프라인2
              </h1>
              <p className="crm-subtitle mt-2 max-w-3xl text-sm font-[620] leading-6">
                고객DB에서 유입된 고객을 담당자별로 실행하고, 계약 전환 전까지 다음 액션을 관리하는 보드입니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {summaryItems.map((item) => (
                <div key={item.label} className="rounded-[15px] border px-3 py-2" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  <p className="crm-tiny truncate">{item.label}</p>
                  <p className="mt-1 text-xl font-[930]" style={{ color: "var(--text-strong)" }}>
                    {item.value}건
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="overflow-x-auto pb-2">
          <div className="grid min-w-[1180px] grid-cols-5 gap-3 2xl:min-w-0">
            {STAGES.map((stage) => {
              const customers = customersForStage(stage.key);
              return (
                <div key={stage.key} className="premium-card flex h-[calc(100vh-260px)] min-h-[520px] min-w-0 flex-col rounded-[22px] p-3.5">
                  <div className="mb-3 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`badge-premium ${stage.tone}`}>{stage.label}</span>
                      <span className="crm-tiny">{customers.length}명</span>
                    </div>
                    <p className="crm-tiny mt-2 leading-5">{stage.helper}</p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="grid gap-2.5">
                      {customers.map((customer) => (
                        <CustomerCard key={customer.id} customer={customer} onClick={() => openCustomer(customer)} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="premium-card rounded-[20px] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="crm-card-title">샘플 UI 단계</p>
              <p className="crm-tiny mt-1">
                실제 DB 연결, 단계 이동 저장, 활동노트 저장, 카카오워크 알림, 계약관리 이관은 아직 실행하지 않습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="badge-premium badge-muted"><ClipboardList className="h-3.5 w-3.5" /> 상세 패널 UI</span>
              <span className="badge-premium badge-muted"><Phone className="h-3.5 w-3.5" /> 통화요약 탭 준비</span>
              <span className="badge-premium badge-muted"><CheckCircle2 className="h-3.5 w-3.5" /> 계약관리 이관 예정</span>
            </div>
          </div>
        </section>
      </div>

      {selectedCustomer ? (
        <DetailPanel
          customer={selectedCustomer}
          tab={detailTab}
          onTab={setDetailTab}
          onClose={() => setSelectedCustomer(null)}
        />
      ) : null}
    </div>
  );
}
