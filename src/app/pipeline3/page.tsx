"use client";

import { supabase } from "@/lib/supabase";
import CustomerGradeAssessment from "@/components/CustomerGradeAssessment";
import {
  appendGradeAssessmentBlock,
  calculateCustomerGrade,
  EMPTY_GRADE_ASSESSMENT,
  hasGradeAssessmentInput,
  parseGradeAssessmentBlock,
  type GradeAssessmentForm,
} from "@/lib/customerGrade";
import {
  Award,
  CalendarDays,
  Edit3,
  FileText,
  Flame,
  Megaphone,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Save,
  Search,
  Send,
  Target,
  Trash2,
  User,
  UserCheck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

type StageKey = "리드" | "프로스펙팅" | "딜클로징" | "리텐션" | "보류/이탈";

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
  meeting_result: string | null;
  meeting_date?: string | null;
  meeting_date_text?: string | null;
  meeting_address?: string | null;
  reservation_date: string | null;
  contract_date: string | null;
  created_at: string;
  updated_at: string;
  crm_db_source?: string | null;
  vip_transferred_at?: string | null;
  assigned_to?: string | null;
  last_note_at?: string | null;
};

type PipelineCustomer = {
  id: number;
  name: string;
  title: string;
  phone: string;
  intakeRoute: string;
  company: string;
  grade: string;
  meetingResult: string;
  reservationDate: string;
  contractDate: string;
  stage: StageKey;
  lastActivity: string;
  registeredAt: string;
  nextContact: string;
  meetingSchedule: string;
  meetingAddress: string;
  noteSummary: string;
  adsSummary: string;
  owner: string;
  raw: CustomerDbRecord;
};

type ContactNote = {
  id: number;
  contact_id: number;
  note_date: string | null;
  content: string;
  author: string | null;
  created_at: string | null;
};

type DetailTab = "summary" | "notes" | "ads";
type FilterValue = "전체" | string;
type ContractConversionResult = "예약완료" | "계약완료";

type EditForm = {
  name: string;
  title: string;
  phone: string;
  intake_route: string;
  company: string;
  management_stage: StageKey;
  customer_grade: string;
  memo: string;
  gradeAssessment: GradeAssessmentForm;
  shouldUpdateGrade: boolean;
};

type AdRequestForm = {
  category: string;
  content: string;
  priority: string;
  assignee: string;
  tagged: string[];
  member_name: string;
  member_number: string;
  member_title: string;
  platform: string;
  age_range: string;
  site_name: string;
  ad_amount: string;
  send_count: string;
  hope_date: string;
  hope_time: string;
  region1: string;
  region2: string;
  region3: string;
};

const STORAGE_KEY = "crm_go_pipeline3_clean_v1";
const LEGACY_STORAGE_KEYS = [
  "crm_go_customer_db_local_v2",
  "crm_go_customer_db_local_v1",
  "pipeline3Customers",
  "pipeline3_customers",
  "crm_pipeline3_customers",
];
const TODAY = new Date().toISOString().slice(0, 10);
const UNREVIEWED_GRADE = "심사미진행";
const VIP_DB_SOURCE = "vip_activity";
const DEFAULT_ASSIGNED_TO = "조계현";
const PIPELINE_SELECT_FIELDS =
  "id,name,title,phone,intake_route,company,management_stage,customer_grade,memo,meeting_result,meeting_date,meeting_date_text,meeting_address,reservation_date,contract_date,created_at,updated_at,crm_db_source,vip_transferred_at,assigned_to";

const TITLE_OPTIONS = ["본부장", "팀장", "팀원"];
const INTAKE_ROUTES = [
  "분양의신DB",
  "완판트럭",
  "분양라인",
  "분양회MGM",
  "대협팀활동",
  "컨설턴트VIP DB",
];
const MANAGEMENT_STAGES: StageKey[] = [
  "리드",
  "프로스펙팅",
  "딜클로징",
  "리텐션",
];
const CUSTOMER_GRADES = [
  UNREVIEWED_GRADE,
  "마스터",
  "챌린저",
  "브론즈",
  "추가 심사 후보",
  "판정 보류",
];
const TEAM = [
  { name: "김정후", title: "본부장", group: "관리자" },
  { name: "김창완", title: "팀장", group: "관리자" },
  { name: "최웅", title: "파트장", group: "실행파트" },
  { name: "조계현", title: "메인", group: "실행파트" },
  { name: "이세호", title: "어쏘", group: "실행파트" },
  { name: "기여운", title: "어쏘", group: "실행파트" },
  { name: "최연전", title: "CX", group: "실행파트" },
  { name: "김재영", title: "어시", group: "운영파트" },
  { name: "최은정", title: "어시", group: "운영파트" },
];
const TEAM_GROUPS = ["관리자", "실행파트", "운영파트"];
const CATEGORIES = [
  "LMS부킹요청",
  "호갱노노 부킹요청",
  "호갱노노 광고요청",
  "일반 업무요청",
];
const PRIORITIES = ["긴급", "높음", "보통", "낮음"];
const LMS_PLATFORMS = [
  "전체플랫폼",
  "국민카드",
  "BC카드",
  "삼성카드",
  "신한카드",
  "롯데카드",
  "하나카드",
  "SKT",
  "KT",
  "롯데멤버스",
  "스마트스코어",
  "티맵",
  "신세계포인트",
  "OK캐시백",
];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const EMPTY_AD_REQUEST_FORM: AdRequestForm = {
  category: "호갱노노 광고요청",
  content: "",
  priority: "보통",
  assignee: "",
  tagged: [],
  member_name: "",
  member_number: "",
  member_title: "",
  platform: "",
  age_range: "",
  site_name: "",
  ad_amount: "",
  send_count: "",
  hope_date: "",
  hope_time: "",
  region1: "",
  region2: "",
  region3: "",
};

const STAGES: Stage[] = [
  {
    key: "리드",
    label: "Leads",
    desc: "초기 유입",
    tone: "danger",
    icon: Flame,
  },
  {
    key: "프로스펙팅",
    label: "Prospecting",
    desc: "상담/검토",
    tone: "warning",
    icon: Search,
  },
  {
    key: "딜클로징",
    label: "Closing",
    desc: "계약 직전",
    tone: "success",
    icon: Zap,
  },
  {
    key: "리텐션",
    label: "Retention",
    desc: "계약/사후관리",
    tone: "purple",
    icon: UserCheck,
  },
];

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "notes", label: "Notes" },
  { key: "ads", label: "Ads >" },
];

const SAMPLE_RECORDS: CustomerDbRecord[] = [];


function fmt(value?: string | null) {
  return value && value.trim() ? value : "-";
}

function stripGradeAssessmentBlock(value?: string | null) {
  if (!value) return "";
  return value
    .replace(
      /\n?\[\[CRM_GRADE_ASSESSMENT\]\][\s\S]*?(?:\[\[\/CRM_GRADE_ASSESSMENT\]\]|$)\n?/g,
      "",
    )
    .replace(
      /\n?\[\[CRM_GRADE_ASSESSMEN[^\]]*\]\][\s\S]*?(?:\[\[\/CRM_GRADE_ASSESSMEN[^\]]*\]\]|$)\n?/g,
      "",
    )
    .replace(/\n?\[고객DB 등록 정보\][\s\S]*?(?=\n{2,}\[|$)/g, "")
    .replace(/\n?\[고객DB 이관 정보\][\s\S]*?(?=\n{2,}\[|$)/g, "")
    .replace(/\n?\[고객DB 활동노트\][\s\S]*?(?=\n{2,}\[|$)/g, "")
    .replace(/\n?\[계약전환\][^\n]*(?:\n[^\n]*)?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getGradeAssessmentBlock(value?: string | null) {
  if (!value) return "";
  const matched = value.match(
    /\[\[CRM_GRADE_ASSESSMENT\]\][\s\S]*?\[\[\/CRM_GRADE_ASSESSMENT\]\]/,
  );
  return matched?.[0] || "";
}

function mergeMemoWithExistingGradeBlock(
  memo: string,
  originalMemo?: string | null,
) {
  const cleanMemo = memo.trim();
  const existingBlock = getGradeAssessmentBlock(originalMemo);
  if (!existingBlock) return cleanMemo;
  return `${cleanMemo}${cleanMemo ? "\n\n" : ""}${existingBlock}`;
}

function displayCustomerGrade(record: CustomerDbRecord) {
  const storedGrade = String(record.customer_grade || "").trim();

  if (storedGrade && storedGrade !== UNREVIEWED_GRADE) {
    return storedGrade;
  }

  const assessment = parseGradeAssessmentBlock(record.memo);

  if (hasGradeAssessmentInput(assessment)) {
    return calculateCustomerGrade(assessment, record.title).customerGrade;
  }

  return UNREVIEWED_GRADE;
}

function normalizeRecordGrade(record: CustomerDbRecord): CustomerDbRecord {
  const cleanMemo = stripGradeAssessmentBlock(record.memo);
  const assessment = parseGradeAssessmentBlock(record.memo);
  const hasAssessment = hasGradeAssessmentInput(assessment);

  if (!hasAssessment) {
    const storedGrade = String(record.customer_grade || "").trim();
    return {
      ...record,
      customer_grade:
        storedGrade && storedGrade !== "-" ? storedGrade : UNREVIEWED_GRADE,
      memo: cleanMemo,
    };
  }

  const calculatedGrade = calculateCustomerGrade(
    assessment,
    record.title,
  ).customerGrade;
  const storedGrade = String(record.customer_grade || "").trim();

  return {
    ...record,
    customer_grade:
      storedGrade && storedGrade !== UNREVIEWED_GRADE && storedGrade !== "-"
        ? storedGrade
        : calculatedGrade,
  };
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
  if (value === "딜크로징") return "딜클로징";
  if (value === "딜클로징") return "딜클로징";
  if (value === "계약완료") return "리텐션";
  if (value === "예약완료") return "딜클로징";
  if (value === "보류" || value === "보류/이탈") return "리드";
  if (
    value === "리드" ||
    value === "프로스펙팅" ||
    value === "딜클로징" ||
    value === "리텐션"
  ) {
    return value;
  }
  return "리드";
}

function getPipelineStage(record: CustomerDbRecord): StageKey {
  if (record.meeting_result === "계약완료") return "리텐션";
  if (record.meeting_result === "예약완료") return "딜클로징";
  return normalizeStage(record.management_stage);
}

function isContractConversionResult(value?: string | null): value is ContractConversionResult {
  return value === "예약완료" || value === "계약완료";
}

function stageLabel(value: StageKey) {
  if (value === "딜클로징") return "딜클로징";
  if (value === "리텐션") return "리텐션";
  return value;
}

function normalizeSearchText(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]/g, "");
}

function normalizePhoneKey(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function mergeRecordsByPhone(
  localRecords: CustomerDbRecord[],
  remoteRecords: CustomerDbRecord[],
) {
  const map = new Map<string, CustomerDbRecord>();

  for (const record of localRecords) {
    const key = normalizePhoneKey(record.phone) || `local-${record.id}`;
    map.set(key, normalizeRecordGrade(record));
  }

  for (const record of remoteRecords) {
    const key = normalizePhoneKey(record.phone) || `remote-${record.id}`;
    const previous = map.get(key);

    if (!previous) {
      map.set(key, normalizeRecordGrade(record));
      continue;
    }

    const previousTime = new Date(previous.updated_at || previous.created_at || 0).getTime();
    const remoteTime = new Date(record.updated_at || record.created_at || 0).getTime();
    map.set(key, normalizeRecordGrade(remoteTime >= previousTime ? record : previous));
  }

  return Array.from(map.values()).sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

function isVipActivityRecord(record: CustomerDbRecord) {
  return record.crm_db_source === VIP_DB_SOURCE;
}

function getWeekday(date: string) {
  if (!date) return "";
  return WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
}

function formatAmount(value: string) {
  const n = value.replace(/[^0-9]/g, "");
  return n ? Number(n).toLocaleString() : "";
}

function buildTaskContent(form: AdRequestForm) {
  if (form.category === "LMS부킹요청") {
    return `■ 분양회원: ${form.member_number} ${form.member_name} ${form.member_title}
■ 플랫폼: ${form.platform}
■ 연령대: ${form.age_range}
■ 타겟팅: 부동산 관심자
■ 현장명: ${form.site_name}
■ 집행방식: LMS
■ 광고금액: ${formatAmount(form.ad_amount)}원
■ 발송건수: ${formatAmount(form.send_count)}건
■ 희망날짜: ${form.hope_date}${form.hope_date ? ` (${getWeekday(form.hope_date)})` : ""} ${form.hope_time ? `${form.hope_time}시` : ""}
■ 지역타겟팅: ①${form.region1} ②${form.region2} ③${form.region3}`;
  }

  if (form.category === "호갱노노 부킹요청") {
    return `■ 분양회원: ${form.member_number} ${form.member_name} ${form.member_title}
■ 현장명: ${form.site_name}
■ 플랫폼: 호갱노노 채널톡
■ 발송건수: ${formatAmount(form.send_count)}건
■ 발송일시: ${form.hope_date}${form.hope_date ? ` (${getWeekday(form.hope_date)})` : ""} ${form.hope_time ? `${form.hope_time}시` : ""}
■ 지역타겟팅: ①${form.region1} ②${form.region2} ③${form.region3}
■ 타겟연령: ${form.age_range}`;
  }

  return form.content;
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
  if (value === "딜클로징" || value === "딜크로징") return "badge-success";
  if (value === "예약완료") return "badge-info";
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


function badgeStyle(value: string): CSSProperties {
  if (value === "마스터") {
    return {
      color: "#5b21b6",
      background: "rgba(124, 58, 237, 0.10)",
      borderColor: "rgba(124, 58, 237, 0.28)",
    };
  }

  if (value === "챌린저") {
    return {
      color: "#1d4ed8",
      background: "rgba(37, 99, 235, 0.09)",
      borderColor: "rgba(37, 99, 235, 0.24)",
    };
  }

  if (value === "브론즈") {
    return {
      color: "#d97706",
      background: "rgba(180, 83, 9, 0.14)",
      borderColor: "rgba(217, 119, 6, 0.34)",
    };
  }

  if (value === "추가 심사 후보") {
    return {
      color: "#f59e0b",
      background: "rgba(245, 158, 11, 0.13)",
      borderColor: "rgba(245, 158, 11, 0.34)",
    };
  }

  if (value === UNREVIEWED_GRADE || value === "판정 보류") {
    return {
      color: "var(--text-faint)",
      background: "var(--surface-3)",
      borderColor: "var(--border)",
    };
  }

  return {};
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
  if (target === "리텐션") return "계약전환";
  return `${target} 전환`;
}

function getStageButtonIcon(target: StageKey) {
  if (target === "리드") return <Flame size={14} />;
  if (target === "프로스펙팅") return <Search size={14} />;
  if (target === "딜클로징") return <Zap size={14} />;
  if (target === "리텐션") return <UserCheck size={14} />;
  return <X size={14} />;
}

function getQuickStageTargets(stage: StageKey): StageKey[] {
  if (stage === "리드") return ["프로스펙팅", "딜클로징", "리텐션"];
  if (stage === "프로스펙팅") return ["리드", "딜클로징", "리텐션"];
  if (stage === "딜클로징") return ["리드", "프로스펙팅", "리텐션"];
  if (stage === "리텐션") return ["리드", "프로스펙팅", "딜클로징"];
  return ["리드", "프로스펙팅", "딜클로징"];
}

function getFollowUpByStage(stage: StageKey) {
  if (stage === "리드")
    return "철저한 고객관리를 통해 프로스펙팅 구간으로 관리를 변경하세요.";
  if (stage === "프로스펙팅")
    return "고객과의 라포 형성이 되었는지 확인하고 미팅 일정 확정을 진행하세요.";
  if (stage === "딜클로징")
    return "계약 전환을 위해 마지막 클로징을 진행하세요.";
  if (stage === "리텐션")
    return "계약완료 고객입니다. 분양회 입회자 메뉴와 정산/사후관리 흐름을 확인하세요.";
  return "재접점 필요 여부를 확인하고 리드 또는 프로스펙팅으로 복귀하세요.";
}

function toPipelineCustomer(record: CustomerDbRecord): PipelineCustomer {
  const stage = getPipelineStage(record);
  const memo = stripGradeAssessmentBlock(record.memo);
  return {
    id: record.id,
    name: fmt(record.name),
    title: fmt(record.title),
    phone: fmt(record.phone),
    intakeRoute: fmt(record.intake_route),
    company: fmt(record.company),
    grade: displayCustomerGrade(record),
    meetingResult: isContractConversionResult(record.meeting_result) ? record.meeting_result : "",
    reservationDate: record.meeting_result === "예약완료" ? formatShortDate(record.reservation_date) : "",
    contractDate: record.meeting_result === "계약완료" ? formatShortDate(record.contract_date) : "",
    stage,
    lastActivity: formatShortDate(record.last_note_at),
    registeredAt: formatShortDate(record.created_at),
    nextContact: getFollowUpByStage(stage),
    meetingSchedule: record.meeting_date
      ? formatShortDate(record.meeting_date)
      : "미팅 일정 조율 전",
    meetingAddress: fmt(record.meeting_address),
    noteSummary: memo,
    adsSummary:
      "광고 요청 이력 없음. 필요 시 하단 광고요청 버튼으로 업무요청을 생성하세요.",
    owner: fmt(record.assigned_to),
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
          <div className="flex min-w-0 items-center gap-2">
            <p
              className="truncate text-[14px] font-[900]"
              style={{ color: "var(--text-strong)" }}
            >
              {customer.name}{" "}
              <span className="font-[760]" style={{ color: "var(--text-muted)" }}>
                · {customer.title}
              </span>
            </p>
            {customer.meetingResult ? (
              <span
                className={`badge-premium shrink-0 px-2 py-1 text-[10.5px] ${badgeClass(customer.meetingResult)}`}
              >
                {customer.meetingResult}
              </span>
            ) : null}
          </div>
          <p className="crm-tiny mt-1 flex items-center gap-1 truncate">
            <Phone size={12} />
            {customer.phone}
          </p>
        </div>
        <span
          className={`badge-premium shrink-0 px-2 py-1 text-[11px] ${badgeClass(customer.grade)}`}
          style={badgeStyle(customer.grade)}
        >
          {customer.grade}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`badge-premium px-2 py-1 text-[11px] ${badgeClass(customer.intakeRoute)}`}
        >
          {customer.intakeRoute}
        </span>
      </div>

      <div
        className="mt-2 flex items-center justify-between gap-2 text-[11px] font-[760]"
        style={{ color: "var(--text-faint)" }}
      >
        <span>활동 {customer.lastActivity}</span>
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
  onContractConvert,
  onMeetingSave,
  onOpenNoteComposer,
  onOpenEdit,
  onOpenAdRequest,
  onDeleteCustomer,
}: {
  customer: PipelineCustomer;
  tab: DetailTab;
  noteComposerOpen: boolean;
  onTab: (tab: DetailTab) => void;
  onClose: () => void;
  onStageChange: (customer: PipelineCustomer, target: StageKey) => void;
  onContractConvert: (customer: PipelineCustomer, result: ContractConversionResult) => void;
  onMeetingSave: (
    customer: PipelineCustomer,
    meetingDate: string,
    meetingAddress: string,
  ) => void;
  onOpenNoteComposer: () => void;
  onOpenEdit: () => void;
  onOpenAdRequest: () => void;
  onDeleteCustomer: () => void;
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
        className="absolute right-0 top-0 flex h-full w-full max-w-[1120px] animate-[crmSlideIn_220ms_ease-out] flex-col border-l"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="slide-panel-header flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <span
                className={`badge-premium ${badgeClass(customer.grade)}`}
                style={badgeStyle(customer.grade)}
              >
                {customer.grade}
              </span>
              <span
                className={`badge-premium ${badgeClass(customer.intakeRoute)}`}
              >
                {customer.intakeRoute}
              </span>
              {customer.meetingResult ? (
                <span
                  className={`badge-premium ${badgeClass(customer.meetingResult)}`}
                >
                  {customer.meetingResult}
                </span>
              ) : null}
            </div>
            <h2
              className="truncate text-[30px] font-[930] tracking-[-0.06em]"
              style={{ color: "var(--text-strong)" }}
            >
              {customer.name}{" "}
              <span
                className="text-[18px] font-[820]"
                style={{ color: "var(--text-muted)" }}
              >
                {customer.title}
              </span>
            </h2>
            <p
              className="mt-2 text-sm font-[720]"
              style={{ color: "var(--text-muted)" }}
            >
              ID {customer.id} · {customer.phone}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary h-10 w-10 shrink-0 p-0"
          >
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
                className={
                  tab === item.key
                    ? "btn-premium btn-primary shrink-0"
                    : "btn-premium btn-secondary shrink-0"
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <SummaryTab
              customer={customer}
              onStageChange={onStageChange}
              onContractConvert={onContractConvert}
              onMeetingSave={onMeetingSave}
              onOpenNoteComposer={onOpenNoteComposer}
            />
          ) : null}
          {tab === "notes" ? (
            <NotesTab customer={customer} composerOpen={noteComposerOpen} />
          ) : null}
          {tab === "ads" ? (
            <AdsTab
              customer={customer}
              onOpenAdRequest={onOpenAdRequest}
              onDeleteCustomer={onDeleteCustomer}
            />
          ) : null}
        </div>

        <div
          className="slide-panel-footer"
          style={{ padding: "clamp(16px, 1.6vw, 22px) clamp(20px, 2vw, 28px)" }}
        >
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={onOpenEdit}
              className="btn-premium btn-secondary"
            >
              <User size={14} />
              고객정보수정
            </button>
            <button
              type="button"
              onClick={onOpenNoteComposer}
              className="btn-premium btn-secondary"
            >
              <MessageSquare size={14} />
              활동노트작성
            </button>
            <button
              type="button"
              onClick={onOpenAdRequest}
              className="btn-premium btn-secondary"
            >
              <Plus size={14} />
              광고요청
            </button>
            <button
              type="button"
              onClick={onDeleteCustomer}
              className="btn-premium btn-secondary"
              style={{ color: "#e11d48", borderColor: "rgba(225, 29, 72, 0.28)" }}
            >
              <Trash2 size={14} />
              고객삭제
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
  onContractConvert,
  onMeetingSave,
  onOpenNoteComposer,
}: {
  customer: PipelineCustomer;
  onStageChange: (customer: PipelineCustomer, target: StageKey) => void;
  onContractConvert: (customer: PipelineCustomer, result: ContractConversionResult) => void;
  onMeetingSave: (
    customer: PipelineCustomer,
    meetingDate: string,
    meetingAddress: string,
  ) => void;
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
          <InfoItem label="담당자" value={customer.owner} />
          <InfoItem label="심사결과" value={customer.grade} badge />
          <InfoItem label="관리구간" value={stageLabel(customer.stage)} badge />
          {customer.meetingResult === "예약완료" ? (
            <InfoItem label="예약완료일" value={customer.reservationDate} />
          ) : null}
          {customer.meetingResult === "계약완료" ? (
            <InfoItem label="계약완료일" value={customer.contractDate} />
          ) : null}
          <InfoItem label="등록일" value={customer.registeredAt} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={17} style={{ color: "var(--accent)" }} />
            <div>
              <p className="crm-section-title">Memo</p>
              <p className="crm-tiny">고객 메모</p>
            </div>
          </div>
          <div
            className="min-h-[128px] rounded-[16px] border p-4"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
            }}
          >
            <p
              className="whitespace-pre-wrap text-sm font-[760] leading-7"
              style={{ color: "var(--text-subtle)" }}
            >
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
                <p className="crm-tiny">Supabase contact_notes 기준 활동노트</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenNoteComposer}
              className="btn-premium btn-primary h-8 px-3 text-[12px]"
            >
              <Plus size={13} />
              노트 작성
            </button>
          </div>
          <div
            className="min-h-[128px] rounded-[16px] border p-4"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
            }}
          >
            <p
              className="text-sm font-[760] leading-7"
              style={{ color: "var(--text-subtle)" }}
            >
              {customer.noteSummary}
            </p>
            <p className="crm-tiny mt-3">
              실제 contact_notes 연결은 후속 작업에서 Supabase로 연결합니다.
            </p>
          </div>
        </section>
      </div>

      <QuickActions
        customer={customer}
        onStageChange={onStageChange}
        onContractConvert={onContractConvert}
        onMeetingSave={onMeetingSave}
        onOpenNoteComposer={onOpenNoteComposer}
      />
    </div>
  );
}

function QuickActions({
  customer,
  onStageChange,
  onContractConvert,
  onMeetingSave,
  onOpenNoteComposer,
}: {
  customer: PipelineCustomer;
  onStageChange: (customer: PipelineCustomer, target: StageKey) => void;
  onContractConvert: (customer: PipelineCustomer, result: ContractConversionResult) => void;
  onMeetingSave: (
    customer: PipelineCustomer,
    meetingDate: string,
    meetingAddress: string,
  ) => void;
  onOpenNoteComposer: () => void;
}) {
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingAddress, setMeetingAddress] = useState("");
  const targets = getQuickStageTargets(customer.stage);

  const handleMeetingSubmit = () => {
    if (!meetingDate) {
      alert("미팅일정을 선택해 주세요.");
      return;
    }
    onMeetingSave(customer, meetingDate, meetingAddress);
    setMeetingOpen(false);
    setMeetingDate("");
    setMeetingAddress("");
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
          target === "리텐션" ? (
            <button
              key={target}
              type="button"
              onClick={() => setContractOpen((value) => !value)}
              className="btn-premium btn-primary w-full"
            >
              {getStageButtonIcon(target)}
              계약전환
            </button>
          ) : (
            <button
              key={target}
              type="button"
              onClick={() => onStageChange(customer, target)}
              className="btn-premium btn-primary w-full"
            >
              {getStageButtonIcon(target)}
              {getStageButtonLabel(target)}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={() => setMeetingOpen((value) => !value)}
          className="btn-premium btn-secondary w-full"
        >
          <CalendarDays size={14} />
          미팅일정 등록
        </button>
        <button
          type="button"
          onClick={onOpenNoteComposer}
          className="btn-premium btn-secondary w-full"
        >
          <MessageSquare size={14} />
          활동노트 작성
        </button>
      </div>

      {contractOpen ? (
        <div
          className="mt-4 grid gap-3 rounded-[16px] border p-4 md:grid-cols-2"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="md:col-span-2">
            <p className="crm-section-title">계약전환 상태 선택</p>
            <p className="crm-tiny mt-1">예약완료는 클로징 구간, 계약완료는 리텐션 구간으로 자동 이동합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onContractConvert(customer, "예약완료");
              setContractOpen(false);
            }}
            className="btn-premium btn-secondary h-11 w-full"
          >
            <Award size={14} />
            예약완료
          </button>
          <button
            type="button"
            onClick={() => {
              onContractConvert(customer, "계약완료");
              setContractOpen(false);
            }}
            className="btn-premium btn-primary h-11 w-full"
          >
            <UserCheck size={14} />
            계약완료
          </button>
        </div>
      ) : null}

      {meetingOpen ? (
        <div
          className="mt-4 grid gap-3 rounded-[16px] border p-4 md:grid-cols-2"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <label className="block space-y-1.5">
            <span className="crm-tiny">미팅일정</span>
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-strong)",
              }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="crm-tiny">미팅장소</span>
            <input
              value={meetingAddress}
              onChange={(event) => setMeetingAddress(event.target.value)}
              placeholder="예: 모델하우스 / 고객 사무실"
              className="h-10 w-full rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-strong)",
              }}
            />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="button"
              onClick={() => setMeetingOpen(false)}
              className="btn-premium btn-secondary h-9 flex-1"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleMeetingSubmit}
              className="btn-premium btn-primary h-9 flex-1"
            >
              일정 저장
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NotesTab({
  customer,
  composerOpen,
}: {
  customer: PipelineCustomer;
  composerOpen: boolean;
}) {
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newContent, setNewContent] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notes, setNotes] = useState<ContactNote[]>([]);

  useEffect(() => {
    let alive = true;

    const loadNotes = async () => {
      setLoadingNotes(true);
      try {
        const { data, error } = await supabase
          .from("contact_notes")
          .select("id,contact_id,note_date,content,author,created_at")
          .eq("contact_id", customer.id)
          .order("note_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!alive) return;
        setNotes(Array.isArray(data) ? (data as ContactNote[]) : []);
      } catch (error) {
        console.warn("파이프라인3 활동노트 불러오기 실패", error);
        if (alive) setNotes([]);
      } finally {
        if (alive) setLoadingNotes(false);
      }
    };

    loadNotes();

    return () => {
      alive = false;
    };
  }, [customer.id]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;

    const optimisticNote: ContactNote = {
      id: Date.now(),
      contact_id: customer.id,
      note_date: newDate,
      content: `[TM] 활동완료\n\n${newContent.trim()}`,
      author: "현재 사용자",
      created_at: new Date().toISOString(),
    };

    setNotes((items) => [optimisticNote, ...items]);
    setNewContent("");
    setNewDate(new Date().toISOString().slice(0, 10));

    try {
      const { data, error } = await supabase
        .from("contact_notes")
        .insert({
          contact_id: customer.id,
          note_date: optimisticNote.note_date,
          content: optimisticNote.content,
          author: "현재 사용자",
        })
        .select("id,contact_id,note_date,content,author,created_at")
        .single();

      if (error) throw error;

      if (data) {
        setNotes((items) =>
          items.map((item) =>
            item.id === optimisticNote.id ? (data as ContactNote) : item,
          ),
        );
      }
    } catch (error) {
      console.warn("파이프라인3 활동노트 저장 실패", error);
      alert("활동노트 저장에 실패했습니다. Supabase 권한과 contact_notes 테이블을 확인해 주세요.");
      setNotes((items) => items.filter((item) => item.id !== optimisticNote.id));
    }
  };

  const visibleNotes = notes;

  return (
    <section className="premium-card mt-4 p-5">
      <div className="mb-4 flex items-center gap-2">
        <FileText size={17} style={{ color: "var(--accent)" }} />
        <div>
          <p className="crm-section-title">Notes</p>
          <p className="crm-tiny">Supabase contact_notes 기준 활동노트</p>
        </div>
      </div>

      {composerOpen ? (
        <div
          className="mb-4 space-y-3 rounded-[16px] border p-4"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-[14px] font-[900]"
              style={{ color: "var(--text-strong)" }}
            >
              활동노트 작성
            </p>
            <input
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              className="h-9 rounded-[10px] border px-3 text-[12px] font-semibold outline-none"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-strong)",
              }}
            />
          </div>
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            placeholder="활동 내용을 입력하세요."
            rows={5}
            className="w-full resize-none rounded-[12px] border px-3 py-3 text-[13px] font-semibold leading-7 outline-none"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-strong)",
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="btn-premium btn-primary w-full"
          >
            <Plus size={14} />
            활동노트 저장
          </button>
        </div>
      ) : null}

      {loadingNotes ? (
        <div
          className="rounded-[16px] border p-4 text-sm font-[760]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          활동노트를 불러오는 중입니다.
        </div>
      ) : visibleNotes.length === 0 ? (
        <div
          className="rounded-[16px] border p-4 text-sm font-[760]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          등록된 활동노트가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNotes.map((note) => (
            <article
              key={note.id}
              className="rounded-[16px] border p-4"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p
                  className="text-[12px] font-[900]"
                  style={{ color: "var(--text-subtle)" }}
                >
                  {note.note_date ? formatShortDate(note.note_date) : formatShortDate(note.created_at)}
                </p>
                <span className="badge-premium badge-muted">
                  {note.author || "활동노트"}
                </span>
              </div>
              <p
                className="whitespace-pre-wrap text-sm font-[760] leading-7"
                style={{ color: "var(--text-subtle)" }}
              >
                {note.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AdsTab({
  customer,
  onOpenAdRequest,
  onDeleteCustomer,
}: {
  customer: PipelineCustomer;
  onOpenAdRequest: () => void;
  onDeleteCustomer: () => void;
}) {
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
        <button
          type="button"
          onClick={onOpenAdRequest}
          className="btn-premium btn-primary h-9 px-3 text-[12px]"
        >
          <Plus size={13} />
          광고요청 생성
        </button>
      </div>
      <div
        className="rounded-[16px] border p-4"
        style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
      >
        <p
          className="text-sm font-[760] leading-7"
          style={{ color: "var(--text-subtle)" }}
        >
          {customer.adsSummary}
        </p>
        <p className="crm-tiny mt-3">
          광고요청 버튼을 누르면 결제&업무요청의 업무요청 형식으로 생성합니다.
        </p>
      </div>
    </section>
  );
}

function InfoItem({
  label,
  value,
  badge = false,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div
      className="rounded-[14px] border px-3 py-3"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <p className="crm-meta">{label}</p>
      <div className="mt-2">
        {badge ? (
          <span className={`badge-premium ${badgeClass(value)}`} style={badgeStyle(value)}>
            {value}
          </span>
        ) : (
          <p
            className="text-sm font-[820] leading-6"
            style={{ color: "var(--text-strong)" }}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="premium-card rounded-[18px] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="crm-meta">{label}</p>
          <p
            className="mt-1 text-2xl font-[930]"
            style={{ color: "var(--text-strong)" }}
          >
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

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: "var(--overlay)" }}
      />
      <div className="premium-card relative z-10 max-h-[88vh] w-full max-w-[820px] overflow-hidden rounded-[24px]">
        <div
          className="flex items-start justify-between gap-4 border-b p-5"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div>
            <p className="crm-section-title">{title}</p>
            <p className="crm-tiny mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary h-9 w-9 p-0"
          >
            <X size={15} />
          </button>
        </div>
        <div className="max-h-[calc(88vh-86px)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onSave,
}: {
  customer: PipelineCustomer;
  onClose: () => void;
  onSave: (customer: PipelineCustomer, form: EditForm) => void;
}) {
  const storedAssessment = parseGradeAssessmentBlock(customer.raw.memo);
  const [form, setForm] = useState({
    name: customer.name === "-" ? "" : customer.name,
    title: customer.title === "-" ? "" : customer.title,
    phone: customer.phone === "-" ? "" : customer.phone,
    intake_route: customer.intakeRoute === "-" ? "" : customer.intakeRoute,
    company: customer.company === "-" ? "" : customer.company,
    management_stage: customer.stage,
    memo: stripGradeAssessmentBlock(customer.raw.memo),
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAssessment, setReviewAssessment] = useState<GradeAssessmentForm>(
    {
      ...EMPTY_GRADE_ASSESSMENT,
      ...storedAssessment,
    },
  );

  const setValue = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const reviewResult = calculateCustomerGrade(reviewAssessment, form.title);
  const hasReviewInput = hasGradeAssessmentInput(reviewAssessment);
  const fixedGrade = displayCustomerGrade(customer.raw);
  const previewGrade =
    reviewOpen && hasReviewInput ? reviewResult.customerGrade : fixedGrade;

  const handleSave = () => {
    onSave(customer, {
      ...form,
      customer_grade: fixedGrade,
      gradeAssessment: reviewAssessment,
      shouldUpdateGrade: reviewOpen && hasReviewInput,
    });
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal flex max-h-[94vh] w-[min(1180px,calc(100vw-32px))] max-w-none flex-col">
        <div className="slide-panel-header flex items-center justify-between gap-4">
          <div>
            <p className="crm-title text-[22px]">고객정보 수정</p>
            <p className="crm-subtitle mt-1">
              신규고객등록과 동일한 기준으로 기본정보를 수정합니다. 자동등급은
              재심사 시에만 변경됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary h-10 w-10 p-0"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="고객명 *">
              <input
                className="crm-search h-12 w-full px-3"
                value={form.name}
                onChange={(event) => setValue("name", event.target.value)}
                placeholder="홍길동"
              />
            </FormField>
            <FormField label="직급">
              <select
                className="crm-search h-12 w-full px-3"
                value={form.title}
                onChange={(event) => setValue("title", event.target.value)}
              >
                <option value="">선택</option>
                {TITLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="연락처 *">
              <input
                className="crm-search h-12 w-full px-3"
                value={form.phone}
                onChange={(event) =>
                  setValue("phone", formatPhoneInput(event.target.value))
                }
                placeholder="010-1234-5678"
              />
            </FormField>
            <FormField label="유입경로">
              <select
                className="crm-search h-12 w-full px-3"
                value={form.intake_route}
                onChange={(event) =>
                  setValue("intake_route", event.target.value)
                }
              >
                <option value="">선택</option>
                {INTAKE_ROUTES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="관리구간">
              <select
                className="crm-search h-12 w-full px-3"
                value={form.management_stage}
                onChange={(event) =>
                  setValue("management_stage", event.target.value)
                }
              >
                {MANAGEMENT_STAGES.map((item) => (
                  <option key={item} value={item}>
                    {stageLabel(item)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="소속회사">
              <input
                className="crm-search h-12 w-full px-3"
                value={form.company}
                onChange={(event) => setValue("company", event.target.value)}
                placeholder="소속회사명을 입력하세요"
              />
            </FormField>
          </div>

          <section
            className="mt-5 rounded-[18px] border p-4"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="crm-section-title">자동등급</p>
                <p className="crm-tiny mt-1">
                  기존 고객DB에서 저장된 등급으로 고정됩니다. 재심사를 저장할
                  때만 등급이 변경됩니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`badge-premium px-3 py-2 text-[13px] ${badgeClass(previewGrade)}`}
                    style={badgeStyle(previewGrade)}
                  >
                  {previewGrade}
                </span>
                <button
                  type="button"
                  onClick={() => setReviewOpen((value) => !value)}
                  className="btn-premium btn-primary h-9 px-4 text-[12px]"
                >
                  {reviewOpen ? "재심사 닫기" : "재심사"}
                </button>
              </div>
            </div>
          </section>

          {reviewOpen ? (
            <div className="mt-5">
              <CustomerGradeAssessment
                value={reviewAssessment}
                title={form.title}
                onChange={setReviewAssessment}
              />
              <p className="crm-tiny mt-2">
                재심사 항목을 입력하고 저장하면 고객DB와 파이프라인3의
                자동등급이 함께 갱신됩니다.
              </p>
            </div>
          ) : null}

          <div className="mt-4">
            <label className="crm-meta mb-2 block">메모</label>
            <textarea
              value={form.memo}
              onChange={(event) => setValue("memo", event.target.value)}
              rows={4}
              placeholder="고객 특이사항, 상담 메모, 다음 액션 등을 입력하세요."
              className="w-full resize-none rounded-[14px] border px-4 py-3 text-[13px] font-[640] outline-none"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>
        </div>

        <div
          className="slide-panel-footer"
          style={{ padding: "clamp(16px, 1.6vw, 22px) clamp(20px, 2vw, 28px)" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-premium btn-secondary h-11"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-premium btn-primary h-11"
            >
              <Save size={14} />
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function InputLabel({ children }: { children: ReactNode }) {
  return (
    <label
      className="mb-1.5 block text-[12px] font-[850]"
      style={{ color: "var(--text-subtle)" }}
    >
      {children}
    </label>
  );
}

function AdRequestModal({
  customer,
  onClose,
  onCreated,
}: {
  customer: PipelineCustomer;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [me, setMe] = useState("파이프라인3");
  const [form, setForm] = useState<AdRequestForm>(() => ({
    ...EMPTY_AD_REQUEST_FORM,
    content: `[파이프라인3 광고요청]
고객명: ${customer.name} ${customer.title}
연락처: ${customer.phone}
유입경로: ${customer.intakeRoute}
관리단계: ${stageLabel(customer.stage)}

요청내용:
`,
  }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const current = JSON.parse(raw);
        setMe(current.name || "파이프라인3");
      }
    } catch {}
  }, []);

  const inputClass =
    "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";
  const textareaClass =
    "min-h-[96px] w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] font-semibold outline-none";

  const toggleTag = (name: string) => {
    setForm((prev) => ({
      ...prev,
      tagged: prev.tagged.includes(name)
        ? prev.tagged.filter((item) => item !== name)
        : [...prev.tagged, name],
    }));
  };

  const resetCategory = (category: string) => {
    setForm((prev) => ({
      ...EMPTY_AD_REQUEST_FORM,
      category,
      priority: prev.priority || "보통",
      assignee: prev.assignee,
      tagged: prev.tagged,
      content:
        category === "호갱노노 광고요청" || category === "일반 업무요청"
          ? `[파이프라인3 광고요청]
고객명: ${customer.name} ${customer.title}
연락처: ${customer.phone}
유입경로: ${customer.intakeRoute}
관리단계: ${stageLabel(customer.stage)}

요청내용:
`
          : "",
    }));
  };

  const handleCreate = async () => {
    if (!form.assignee) {
      alert("수신자를 선택하세요.");
      return;
    }

    const content = buildTaskContent(form);

    if (!content.trim()) {
      alert("요청 내용을 입력하세요.");
      return;
    }

    setSaving(true);

    const fileUrls: string[] = [];

    for (const file of files) {
      const fileName = `${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("task-files")
        .upload(fileName, file);
      if (!error) fileUrls.push(fileName);
    }

    const { error } = await supabase.from("tasks").insert({
      category: form.category,
      content,
      priority: form.priority,
      assignee: form.assignee,
      requester: me,
      status: "요청",
      tagged: form.tagged.length > 0 ? form.tagged : null,
      file_urls: fileUrls.length > 0 ? fileUrls : null,
    });

    setSaving(false);

    if (error) {
      alert(`생성 실패: ${error.message}`);
      return;
    }

    alert("업무요청이 결제&업무요청에 생성되었습니다.");
    onCreated();
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div
        className="crm-modal flex max-w-3xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 px-6 py-5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div>
            <h2 className="crm-section-title">업무 요청</h2>
            <p className="crm-subtitle mt-1">
              수신자, 카테고리, 우선순위, 요청 내용을 입력합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary h-9 w-9 p-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <InputLabel>수신자</InputLabel>
              <select
                value={form.assignee}
                onChange={(event) =>
                  setForm({ ...form, assignee: event.target.value })
                }
                className={inputClass}
              >
                <option value="">선택</option>
                {TEAM_GROUPS.map((group) => (
                  <optgroup key={group} label={`■ ${group}`}>
                    {TEAM.filter(
                      (member) => member.group === group && member.name !== me,
                    ).map((member) => (
                      <option key={member.name} value={member.name}>
                        {member.name} {member.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <InputLabel>카테고리</InputLabel>
              <select
                value={form.category}
                onChange={(event) => resetCategory(event.target.value)}
                className={inputClass}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <InputLabel>우선순위</InputLabel>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map((priority) => {
                  const active = form.priority === priority;
                  return (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setForm({ ...form, priority })}
                      className="h-9 rounded-[8px] border text-[13px] font-bold"
                      style={{
                        background: active
                          ? "var(--accent-bg)"
                          : "var(--surface-2)",
                        borderColor: active
                          ? "var(--accent-border)"
                          : "var(--border)",
                        color: active
                          ? "var(--accent-text)"
                          : "var(--text-muted)",
                      }}
                    >
                      {priority}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <InputLabel>태그자</InputLabel>
              <div className="flex flex-wrap gap-1.5">
                {TEAM.filter(
                  (member) =>
                    member.name !== me && member.name !== form.assignee,
                ).map((member) => {
                  const active = form.tagged.includes(member.name);
                  return (
                    <button
                      key={member.name}
                      type="button"
                      onClick={() => toggleTag(member.name)}
                      className="rounded-[8px] border px-2.5 py-1.5 text-[12px] font-bold"
                      style={{
                        background: active
                          ? "var(--purple-bg)"
                          : "var(--surface-2)",
                        borderColor: active
                          ? "var(--purple-border)"
                          : "var(--border)",
                        color: active
                          ? "var(--purple-text)"
                          : "var(--text-muted)",
                      }}
                    >
                      @{member.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {form.category === "LMS부킹요청" && (
            <div className="premium-card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div>
                <InputLabel>플랫폼</InputLabel>
                <select
                  className={inputClass}
                  value={form.platform}
                  onChange={(event) =>
                    setForm({ ...form, platform: event.target.value })
                  }
                >
                  <option value="">선택</option>
                  {LMS_PLATFORMS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <InputLabel>연령대</InputLabel>
                <input
                  className={inputClass}
                  value={form.age_range}
                  onChange={(event) =>
                    setForm({ ...form, age_range: event.target.value })
                  }
                  placeholder="예: 30~60대"
                />
              </div>
              <div>
                <InputLabel>현장명</InputLabel>
                <input
                  className={inputClass}
                  value={form.site_name}
                  onChange={(event) =>
                    setForm({ ...form, site_name: event.target.value })
                  }
                />
              </div>
              <div>
                <InputLabel>광고금액</InputLabel>
                <input
                  className={inputClass}
                  value={form.ad_amount}
                  onChange={(event) =>
                    setForm({ ...form, ad_amount: event.target.value })
                  }
                />
              </div>
              <div>
                <InputLabel>발송건수</InputLabel>
                <input
                  className={inputClass}
                  value={form.send_count}
                  onChange={(event) =>
                    setForm({ ...form, send_count: event.target.value })
                  }
                />
              </div>
              <div>
                <InputLabel>희망일시</InputLabel>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.hope_date}
                    onChange={(event) =>
                      setForm({ ...form, hope_date: event.target.value })
                    }
                  />
                  <select
                    className="h-9 w-24 rounded-[8px] border px-3 text-[13px] font-semibold outline-none"
                    value={form.hope_time}
                    onChange={(event) =>
                      setForm({ ...form, hope_time: event.target.value })
                    }
                  >
                    <option value="">시간</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, "0")}>
                        {String(i).padStart(2, "0")}시
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <InputLabel>지역 타겟팅</InputLabel>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <input
                    className={inputClass}
                    value={form.region1}
                    onChange={(event) =>
                      setForm({ ...form, region1: event.target.value })
                    }
                    placeholder="① 지역"
                  />
                  <input
                    className={inputClass}
                    value={form.region2}
                    onChange={(event) =>
                      setForm({ ...form, region2: event.target.value })
                    }
                    placeholder="② 지역"
                  />
                  <input
                    className={inputClass}
                    value={form.region3}
                    onChange={(event) =>
                      setForm({ ...form, region3: event.target.value })
                    }
                    placeholder="③ 지역"
                  />
                </div>
              </div>
            </div>
          )}

          {form.category === "호갱노노 부킹요청" && (
            <div className="premium-card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div>
                <InputLabel>현장명</InputLabel>
                <input
                  className={inputClass}
                  value={form.site_name}
                  onChange={(event) =>
                    setForm({ ...form, site_name: event.target.value })
                  }
                />
              </div>
              <div>
                <InputLabel>발송건수</InputLabel>
                <input
                  className={inputClass}
                  value={form.send_count}
                  onChange={(event) =>
                    setForm({ ...form, send_count: event.target.value })
                  }
                />
              </div>
              <div>
                <InputLabel>타겟연령</InputLabel>
                <input
                  className={inputClass}
                  value={form.age_range}
                  onChange={(event) =>
                    setForm({ ...form, age_range: event.target.value })
                  }
                />
              </div>
              <div>
                <InputLabel>발송일시</InputLabel>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.hope_date}
                    onChange={(event) =>
                      setForm({ ...form, hope_date: event.target.value })
                    }
                  />
                  <select
                    className="h-9 w-24 rounded-[8px] border px-3 text-[13px] font-semibold outline-none"
                    value={form.hope_time}
                    onChange={(event) =>
                      setForm({ ...form, hope_time: event.target.value })
                    }
                  >
                    <option value="">시간</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, "0")}>
                        {String(i).padStart(2, "0")}시
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <InputLabel>지역 타겟팅</InputLabel>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <input
                    className={inputClass}
                    value={form.region1}
                    onChange={(event) =>
                      setForm({ ...form, region1: event.target.value })
                    }
                    placeholder="① 지역"
                  />
                  <input
                    className={inputClass}
                    value={form.region2}
                    onChange={(event) =>
                      setForm({ ...form, region2: event.target.value })
                    }
                    placeholder="② 지역"
                  />
                  <input
                    className={inputClass}
                    value={form.region3}
                    onChange={(event) =>
                      setForm({ ...form, region3: event.target.value })
                    }
                    placeholder="③ 지역"
                  />
                </div>
              </div>
            </div>
          )}

          {(form.category === "일반 업무요청" ||
            form.category === "호갱노노 광고요청") && (
            <div>
              <InputLabel>상세 요청 내용</InputLabel>
              <textarea
                className={textareaClass}
                value={form.content}
                onChange={(event) =>
                  setForm({ ...form, content: event.target.value })
                }
                placeholder="업무 요청 내용을 상세히 입력하세요."
              />
            </div>
          )}

          <div>
            <InputLabel>파일첨부</InputLabel>
            <input
              type="file"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files || []))
              }
              className="hidden"
              id="pipeline3-task-file-input"
            />
            <button
              type="button"
              onClick={() =>
                document.getElementById("pipeline3-task-file-input")?.click()
              }
              className="flex w-full items-center gap-2 rounded-[12px] border border-dashed px-4 py-3 text-[13px] font-bold"
              style={{
                borderColor: "var(--border-2)",
                color: "var(--text-muted)",
                background: "var(--surface-2)",
              }}
            >
              <Paperclip size={14} />
              {files.length > 0
                ? `${files.length}개 파일 선택됨`
                : "파일을 선택하세요"}
            </button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <p
                    key={`${file.name}-${index}`}
                    className="truncate text-[12px] font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    📎 {file.name}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="btn-premium btn-primary"
          >
            <Send size={14} />
            {saving ? "전송 중..." : "요청 전송"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [adRequestCustomerId, setAdRequestCustomerId] = useState<number | null>(
    null,
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [intakeFilter, setIntakeFilter] = useState<FilterValue>("전체");
  const [stageFilter, setStageFilter] = useState<FilterValue>("전체");

  useEffect(() => {
    let alive = true;

    const loadPipelineRecords = async () => {
      try {
        // 파이프라인3은 VIP활동DB와 같은 contacts 테이블만 기준으로 사용합니다.
        // 이전 localStorage 캐시를 읽으면 VIP활동DB에서 삭제한 고객이 파이프라인3에 다시 남는 문제가 생기므로
        // 모든 구버전/현버전 캐시를 비우고 Supabase 결과만 화면에 출력합니다.
        LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {}

      try {
        const { data, error } = await supabase
          .from("contacts")
          .select(PIPELINE_SELECT_FIELDS)
          .eq("crm_db_source", VIP_DB_SOURCE)
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const baseRecords = Array.isArray(data)
          ? (data as CustomerDbRecord[]).map(normalizeRecordGrade).filter(isVipActivityRecord)
          : [];

        const ids = baseRecords.map((record) => record.id);
        let lastNoteMap = new Map<number, string>();

        if (ids.length > 0) {
          const { data: notes, error: notesError } = await supabase
            .from("contact_notes")
            .select("contact_id,note_date,created_at")
            .in("contact_id", ids);

          if (!notesError && Array.isArray(notes)) {
            notes.forEach((note) => {
              const contactId = Number((note as { contact_id?: number }).contact_id);
              const noteDate =
                (note as { note_date?: string | null; created_at?: string | null }).note_date ||
                (note as { note_date?: string | null; created_at?: string | null }).created_at ||
                "";

              if (!contactId || !noteDate) return;

              const prev = lastNoteMap.get(contactId);
              if (!prev || new Date(noteDate).getTime() > new Date(prev).getTime()) {
                lastNoteMap.set(contactId, noteDate);
              }
            });
          }
        }

        const remoteRecords = baseRecords.map((record) => ({
          ...record,
          last_note_at: lastNoteMap.get(record.id) || null,
        }));

        if (!alive) return;

        setRecords(remoteRecords);
        setLoadedFromDb(true);
      } catch (error) {
        console.warn("파이프라인3 VIP활동DB 데이터 불러오기 실패", error);
        if (!alive) return;
        setRecords([]);
        setLoadedFromDb(false);
      }
    };

    loadPipelineRecords();

    return () => {
      alive = false;
    };
  }, []);

  const customers = useMemo(() => records.map(toPipelineCustomer), [records]);

  const filteredCustomers = useMemo(() => {
    const keyword = normalizeSearchText(searchKeyword);

    return customers.filter((customer) => {
      const matchesKeyword =
        !keyword ||
        [customer.name, customer.phone, customer.title, customer.company]
          .map(normalizeSearchText)
          .some((value) => value.includes(keyword));

      const matchesIntake =
        intakeFilter === "전체" || customer.intakeRoute === intakeFilter;
      const matchesStage = stageFilter === "전체" || customer.stage === stageFilter;

      return matchesKeyword && matchesIntake && matchesStage;
    });
  }, [customers, searchKeyword, intakeFilter, stageFilter]);

  const hasActiveFilter =
    searchKeyword.trim() || intakeFilter !== "전체" || stageFilter !== "전체";

  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const editCustomer = useMemo(
    () => customers.find((customer) => customer.id === editCustomerId) || null,
    [customers, editCustomerId],
  );

  const adRequestCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === adRequestCustomerId) || null,
    [customers, adRequestCustomerId],
  );

  const stats = useMemo(
    () => ({
      total: filteredCustomers.length,
      lead: filteredCustomers.filter((customer) => customer.stage === "리드").length,
      prospecting: filteredCustomers.filter(
        (customer) => customer.stage === "프로스펙팅",
      ).length,
      closing: filteredCustomers.filter((customer) => customer.stage === "딜클로징")
        .length,
      signed: filteredCustomers.filter((customer) => customer.stage === "리텐션")
        .length,
    }),
    [filteredCustomers],
  );

  const persistRecords = (nextRecords: CustomerDbRecord[]) => {
    setRecords(nextRecords);
    setLoadedFromDb(true);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const updateRecord = (id: number, patch: Partial<CustomerDbRecord>) => {
    const now = new Date().toISOString();
    let nextRecord: CustomerDbRecord | null = null;
    const nextRecords = records.map((record) => {
      if (record.id !== id) return record;

      nextRecord = {
        ...record,
        ...patch,
        updated_at: now,
      };

      return nextRecord;
    });

    persistRecords(nextRecords);

    if (nextRecord) {
      const recordToSave = nextRecord as CustomerDbRecord;

      supabase
        .from("contacts")
        .upsert(
          {
            id: recordToSave.id,
            name: recordToSave.name,
            title: recordToSave.title,
            phone: recordToSave.phone,
            intake_route: recordToSave.intake_route,
            company: recordToSave.company,
            management_stage: recordToSave.management_stage,
            customer_grade: recordToSave.customer_grade,
            memo: recordToSave.memo,
            meeting_result: recordToSave.meeting_result || null,
            meeting_date: recordToSave.meeting_date || null,
            meeting_date_text: recordToSave.meeting_date_text || null,
            meeting_address: recordToSave.meeting_address || null,
            reservation_date: recordToSave.reservation_date || null,
            contract_date: recordToSave.contract_date || null,
            created_at: recordToSave.created_at,
            updated_at: recordToSave.updated_at,
            crm_db_source: VIP_DB_SOURCE,
            vip_transferred_at: recordToSave.vip_transferred_at || recordToSave.created_at,
            assigned_to: recordToSave.assigned_to || DEFAULT_ASSIGNED_TO,
          },
          { onConflict: "id" },
        )
        .then(({ error }) => {
          if (error) {
            console.warn("파이프라인3 변경사항 Supabase 저장 실패:", error.message);
          }
        });
    }
  };
  const deleteRecord = async (customer: PipelineCustomer) => {
    const confirmed = window.confirm(
      "파이프라인3에서 고객 데이터를 삭제하면 VIP활동DB에서도 함께 삭제됩니다. 삭제하시겠습니까?",
    );

    if (!confirmed) return;

    const nextRecords = records.filter((record) => record.id !== customer.id);
    persistRecords(nextRecords);
    setSelectedCustomerId(null);
    setEditCustomerId(null);
    setAdRequestCustomerId(null);

    try {
      const { error } = await supabase.from("contacts").delete().eq("id", customer.id);
      if (error) {
        alert(`VIP활동DB 삭제 중 오류가 발생했습니다: ${error.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`VIP활동DB 삭제 중 오류가 발생했습니다: ${message}`);
    }
  };


  const openDetail = (customer: PipelineCustomer) => {
    setSelectedCustomerId(customer.id);
    setDetailTab("summary");
    setNoteComposerOpen(false);
  };

  const handleStageChange = (customer: PipelineCustomer, target: StageKey) => {
    const cleanMemo = stripGradeAssessmentBlock(customer.raw.memo);
    updateRecord(customer.id, {
      management_stage: target,
      memo: mergeMemoWithExistingGradeBlock(cleanMemo, customer.raw.memo),
    });
  };

  const handleContractConvert = (
    customer: PipelineCustomer,
    result: ContractConversionResult,
  ) => {
    const isReservation = result === "예약완료";
    const nextStage: StageKey = isReservation ? "딜클로징" : "리텐션";
    const cleanMemo = stripGradeAssessmentBlock(customer.raw.memo);

    updateRecord(customer.id, {
      management_stage: nextStage,
      meeting_result: result,
      reservation_date: isReservation
        ? TODAY
        : customer.raw.reservation_date || null,
      contract_date: isReservation ? null : TODAY,
      memo: mergeMemoWithExistingGradeBlock(cleanMemo, customer.raw.memo),
    });
  };

  const handleMeetingSave = (
    customer: PipelineCustomer,
    meetingDate: string,
    meetingAddress: string,
  ) => {
    updateRecord(customer.id, {
      meeting_date: meetingDate,
      meeting_date_text: "파이프라인3 미팅일정",
      meeting_address: meetingAddress.trim() || null,
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

    const gradeResult = calculateCustomerGrade(
      form.gradeAssessment,
      form.title,
    );
    const nextGrade = form.shouldUpdateGrade
      ? gradeResult.customerGrade
      : customer.grade;
    const nextMemo = form.shouldUpdateGrade
      ? appendGradeAssessmentBlock(form.memo, form.gradeAssessment, gradeResult)
      : mergeMemoWithExistingGradeBlock(form.memo, customer.raw.memo);

    updateRecord(customer.id, {
      name: form.name.trim(),
      title: form.title,
      phone: form.phone,
      intake_route: form.intake_route,
      company: form.company,
      management_stage: form.management_stage,
      customer_grade: nextGrade,
      memo: nextMemo,
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
            VIP활동DB 고객만 관리구간 기준으로 계약 전환 전 영업 활동을 관리합니다.
            {loadedFromDb
              ? " VIP활동DB 데이터 기준으로 표시 중입니다."
              : " 기존 샘플 데이터는 제거되었으며, 등록된 고객만 표시됩니다."}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="전체 고객" value={stats.total} icon={Target} />
          <StatCard label="리드" value={stats.lead} icon={Flame} />
          <StatCard
            label="프로스펙팅"
            value={stats.prospecting}
            icon={Search}
          />
          <StatCard label="딜클로징" value={stats.closing} icon={Zap} />
          <StatCard label="리텐션" value={stats.signed} icon={UserCheck} />
        </div>
      </div>


      <div className="flex-shrink-0 px-5 pb-4 md:px-7">
        <div className="premium-card rounded-[22px] p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.4fr)_minmax(190px,0.8fr)_minmax(190px,0.8fr)_auto]">
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block">고객 검색</span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  className="crm-search h-12 w-full pl-10 pr-3"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="고객명, 연락처, 직급, 소속회사 검색"
                />
              </div>
            </label>

            <label className="block min-w-0">
              <span className="crm-meta mb-2 block">유입경로 필터</span>
              <select
                className="crm-search h-12 w-full px-3"
                value={intakeFilter}
                onChange={(event) => setIntakeFilter(event.target.value)}
              >
                <option value="전체">전체 유입경로</option>
                {INTAKE_ROUTES.map((route) => (
                  <option key={route} value={route}>
                    {route}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="crm-meta mb-2 block">관리구간 필터</span>
              <select
                className="crm-search h-12 w-full px-3"
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
              >
                <option value="전체">전체 관리구간</option>
                {MANAGEMENT_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabel(stage)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                className="btn-premium btn-secondary h-12 whitespace-nowrap px-4"
                onClick={() => {
                  setSearchKeyword("");
                  setIntakeFilter("전체");
                  setStageFilter("전체");
                }}
                disabled={!hasActiveFilter}
              >
                필터 초기화
              </button>
            </div>
          </div>
          <p className="crm-tiny mt-3">
            현재 조건 기준 {filteredCustomers.length.toLocaleString()}명 / 전체 {customers.length.toLocaleString()}명
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto px-5 pb-5 md:px-7">
        <div className="grid h-full min-w-[1180px] grid-cols-5 gap-3 2xl:min-w-0">
          {STAGES.map((stage) => {
            const stageCustomers = filteredCustomers.filter(
              (customer) => customer.stage === stage.key,
            );
            const Icon = stage.icon;
            return (
              <section
                key={stage.key}
                className="premium-card flex min-w-0 flex-col overflow-hidden rounded-[22px]"
              >
                <div
                  className="flex-shrink-0 border-b p-4"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-4 w-4"
                          style={{ color: "var(--accent)" }}
                        />
                        <span
                          className={`badge-premium ${toneClass(stage.tone)}`}
                        >
                          {stage.label}
                        </span>
                      </div>
                      <p className="crm-tiny mt-2 leading-5">{stage.desc}</p>
                    </div>
                    <span className="crm-tiny shrink-0">
                      {stageCustomers.length}명
                    </span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="grid gap-2.5">
                    {stageCustomers.map((customer) => (
                      <PipelineCard
                        key={customer.id}
                        customer={customer}
                        onClick={() => openDetail(customer)}
                      />
                    ))}
                    {stageCustomers.length === 0 ? (
                      <div
                        className="rounded-[18px] border p-4 text-center"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        <p className="crm-tiny">조건에 맞는 고객이 없습니다.</p>
                      </div>
                    ) : null}
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
          onContractConvert={handleContractConvert}
          onMeetingSave={handleMeetingSave}
          onOpenNoteComposer={handleOpenNoteComposer}
          onOpenEdit={() => setEditCustomerId(selectedCustomer.id)}
          onOpenAdRequest={() => setAdRequestCustomerId(selectedCustomer.id)}
          onDeleteCustomer={() => deleteRecord(selectedCustomer)}
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
