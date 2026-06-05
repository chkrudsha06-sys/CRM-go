"use client";

import {
  BarChart3,
  CalendarDays,
  FileText,
  Megaphone,
  MessageSquare,
  Phone,
  Search,
  Target,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

type Stage = {
  key: string;
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
  stage: string;
  lastActivity: string;
  registeredAt: string;
  nextContact: string;
  meetingSchedule: string;
  followUp: string;
  noteSummary: string;
  adsSummary: string;
};

type DetailTab = "summary" | "notes" | "ads";

const STAGES: Stage[] = [
  { key: "리드", label: "리드", desc: "초기 접점과 응답 확인", tone: "danger", icon: Target },
  { key: "프로스펙팅", label: "프로스펙팅", desc: "상담 진행과 니즈 파악", tone: "warning", icon: Search },
  { key: "딜클로징", label: "딜클로징", desc: "계약 전환 설득", tone: "success", icon: Zap },
  { key: "계약완료", label: "리텐션 / 계약완료", desc: "계약관리 이관 전 확인", tone: "purple", icon: CalendarDays },
  { key: "보류/이탈", label: "보류/이탈", desc: "재접점 또는 이탈 관리", tone: "muted", icon: X },
];

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "notes", label: "Notes" },
  { key: "ads", label: "Ads" },
];

const SAMPLE_CUSTOMERS: PipelineCustomer[] = [
  {
    id: 1,
    name: "조효숙",
    title: "팀장",
    phone: "010-8422-1904",
    intakeRoute: "분양의신DB",
    grade: "챌린저",
    stage: "리드",
    lastActivity: "오늘 10:20",
    registeredAt: "06.05",
    nextContact: "오늘 17:00 재통화",
    meetingSchedule: "미팅 일정 조율 전",
    followUp: "통화요약 확인 후 관심 현장 기준으로 1차 제안",
    noteSummary: "첫 통화에서 분양회 운영 경험과 광고지원 조건에 관심을 보임.",
    adsSummary: "광고 집행 이력 확인 전. 상담 후 필요 시 광고요청으로 전환 예정.",
  },
  {
    id: 2,
    name: "김도윤",
    title: "본부장",
    phone: "010-4881-9021",
    intakeRoute: "완판트럭",
    grade: "마스터",
    stage: "프로스펙팅",
    lastActivity: "어제 17:40",
    registeredAt: "06.04",
    nextContact: "06.06 오전 자료 회신",
    meetingSchedule: "06.07 오후 2시 강남",
    followUp: "기존 조직 규모와 현장 이동 예정 정보를 확인",
    noteSummary: "대형 현장 운영 경험이 있고 계약 조건 검토 단계로 진입 가능.",
    adsSummary: "완판트럭 유입. 현장별 광고 집행 규모 검토 필요.",
  },
  {
    id: 3,
    name: "박서연",
    title: "팀원",
    phone: "010-7712-6408",
    intakeRoute: "분양라인",
    grade: "브론즈",
    stage: "프로스펙팅",
    lastActivity: "06.04",
    registeredAt: "06.03",
    nextContact: "상담 자료 발송 후 반응 확인",
    meetingSchedule: "미정",
    followUp: "소속회사와 운영 물건 종류 추가 확인",
    noteSummary: "정보 탐색 단계. 직접 의사결정권은 약해 추가 확인 필요.",
    adsSummary: "광고 요청 없음. 콘텐츠 반응 기반 리마인드 예정.",
  },
  {
    id: 4,
    name: "이준호",
    title: "팀장",
    phone: "010-9133-2240",
    intakeRoute: "분양회MGM",
    grade: "추가 심사 후보",
    stage: "딜클로징",
    lastActivity: "06.03",
    registeredAt: "06.01",
    nextContact: "계약 조건 최종 재확인",
    meetingSchedule: "06.06 오전 11시",
    followUp: "계약 전환 가능성이 높아 혜택 조건 정리",
    noteSummary: "MGM 소개 고객. 가입 조건과 광고비 지원 여부를 비교 중.",
    adsSummary: "광고 예산 일부 가능. 계약 후 운영 광고 설계 필요.",
  },
  {
    id: 5,
    name: "최민재",
    title: "본부장",
    phone: "010-1204-7781",
    intakeRoute: "대협팀활동",
    grade: "마스터",
    stage: "계약완료",
    lastActivity: "06.02",
    registeredAt: "05.31",
    nextContact: "계약관리 이관 확인",
    meetingSchedule: "계약 완료",
    followUp: "정산 및 사후관리 메뉴 이관 예정",
    noteSummary: "계약 전환 완료. 파이프라인3에는 임시 확인 상태로만 노출.",
    adsSummary: "계약 후 광고 운영 계획 별도 수립 필요.",
  },
  {
    id: 6,
    name: "한지우",
    title: "팀원",
    phone: "010-6500-3344",
    intakeRoute: "분양의신DB",
    grade: "심사미진행",
    stage: "보류/이탈",
    lastActivity: "05.30",
    registeredAt: "05.29",
    nextContact: "2주 후 재접점",
    meetingSchedule: "없음",
    followUp: "연락 응답률 낮아 재접점 대상으로 분리",
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

function customersForStage(stageKey: string) {
  return SAMPLE_CUSTOMERS.filter((customer) => customer.stage === stageKey);
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
            {customer.name} <span className="font-[760]" style={{ color: "var(--text-muted)" }}>· {customer.title}</span>
          </p>
          <p className="crm-tiny mt-1 truncate">{customer.phone}</p>
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
              <span className={`badge-premium ${badgeClass(customer.grade)}`}>{customer.grade}</span>
              <span className={`badge-premium ${badgeClass(customer.intakeRoute)}`}>{customer.intakeRoute}</span>
            </div>
            <h2 className="truncate text-[30px] font-[930] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
              {customer.name} <span className="text-[18px] font-[820]" style={{ color: "var(--text-muted)" }}>{customer.title}</span>
            </h2>
            <p className="mt-2 text-sm font-[720]" style={{ color: "var(--text-muted)" }}>
              {customer.phone}
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

          {tab === "summary" ? <SummaryTab customer={customer} /> : null}
          {tab === "notes" ? <NotesTab customer={customer} /> : null}
          {tab === "ads" ? <AdsTab customer={customer} /> : null}
        </div>
      </aside>
    </div>
  );
}

function SummaryTab({ customer }: { customer: PipelineCustomer }) {
  return (
    <div className="mt-4 space-y-4">
      <section className="premium-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={17} style={{ color: "var(--accent)" }} />
          <p className="crm-section-title">Summary</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoItem label="고객명" value={`${customer.name} · ${customer.title}`} />
          <InfoItem label="연락처" value={customer.phone} />
          <InfoItem label="DB 유입경로" value={customer.intakeRoute} badge />
          <InfoItem label="자동등급" value={customer.grade} badge />
          <InfoItem label="마지막 활동일" value={customer.lastActivity} />
          <InfoItem label="등록일" value={customer.registeredAt} />
        </div>
      </section>

      <section className="premium-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target size={17} style={{ color: "var(--accent)" }} />
          <p className="crm-section-title">Next Action</p>
        </div>
        <div className="grid gap-3">
          <InfoItem label="다음 연락 예정" value={customer.nextContact} />
          <InfoItem label="미팅 일정" value={customer.meetingSchedule} />
          <InfoItem label="후속 처리 내용" value={customer.followUp} />
        </div>
      </section>
    </div>
  );
}

function NotesTab({ customer }: { customer: PipelineCustomer }) {
  return (
    <section className="premium-card mt-4 p-5">
      <div className="mb-4 flex items-center gap-2">
        <FileText size={17} style={{ color: "var(--accent)" }} />
        <p className="crm-section-title">Notes</p>
      </div>
      <div className="rounded-[16px] border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
        <p className="text-sm font-[760] leading-7" style={{ color: "var(--text-subtle)" }}>
          {customer.noteSummary}
        </p>
        <p className="crm-tiny mt-3">샘플 활동노트입니다. 실제 contact_notes 연결은 후속 작업에서 진행합니다.</p>
      </div>
    </section>
  );
}

function AdsTab({ customer }: { customer: PipelineCustomer }) {
  return (
    <section className="premium-card mt-4 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Megaphone size={17} style={{ color: "var(--accent)" }} />
        <p className="crm-section-title">Ads</p>
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
          <p className="text-sm font-[820] leading-6" style={{ color: "var(--text-strong)" }}>{value}</p>
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
          <p className="mt-1 text-2xl font-[930]" style={{ color: "var(--text-strong)" }}>{value}</p>
        </div>
        <div className="premium-icon-lg h-10 w-10">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function Pipeline3Page() {
  const [selectedCustomer, setSelectedCustomer] = useState<PipelineCustomer | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");

  const stats = useMemo(
    () => ({
      total: SAMPLE_CUSTOMERS.length,
      lead: customersForStage("리드").length,
      prospecting: customersForStage("프로스펙팅").length,
      closing: customersForStage("딜클로징").length,
      signed: customersForStage("계약완료").length,
      paused: customersForStage("보류/이탈").length,
    }),
    [],
  );

  const openDetail = (customer: PipelineCustomer) => {
    setSelectedCustomer(customer);
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
            기존 파이프라인 구조를 참고한 UI 검토용 샘플 보드입니다. 실제 DB 저장은 발생하지 않습니다.
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="전체 샘플" value={stats.total} icon={Target} />
          <StatCard label="리드" value={stats.lead} icon={Target} />
          <StatCard label="프로스펙팅" value={stats.prospecting} icon={Search} />
          <StatCard label="딜클로징" value={stats.closing} icon={Zap} />
          <StatCard label="계약완료" value={stats.signed} icon={CalendarDays} />
          <StatCard label="보류/이탈" value={stats.paused} icon={X} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto px-5 pb-5 md:px-7">
        <div className="grid h-full min-w-[1180px] grid-cols-5 gap-3 2xl:min-w-0">
          {STAGES.map((stage) => {
            const customers = customersForStage(stage.key);
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
                    <span className="crm-tiny shrink-0">{customers.length}명</span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="grid gap-2.5">
                    {customers.map((customer) => (
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
          onTab={setDetailTab}
          onClose={() => setSelectedCustomer(null)}
        />
      ) : null}
    </div>
  );
}
