"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Filter,
  MessageCircle,
  Paperclip,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";

type TaskRow = {
  id: number;
  category: string | null;
  content: string | null;
  priority: string | null;
  assignee: string | null;
  requester: string | null;
  status: string | null;
  tagged: string[] | null;
  file_urls: string[] | null;
  file_names: string[] | null;
  completed_at: string | null;
  kakao_message_id: string | null;
  created_at: string;
};

type CommentRow = {
  id: number;
  task_id: number;
  author: string | null;
  content: string | null;
  comment_type: string | null;
  created_at: string;
};

type MemberRow = {
  id: number;
  name: string | null;
  title: string | null;
  bunyanghoe_number: string | null;
  meeting_result: string | null;
};

type TaskForm = {
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
  combination: string;
  script: string;
  script_text: string;
  domain: string;
  rep_number: string;
  test_number: string;
  kakao_type: string;
  image_template: string;
  cta_left: string;
  cta_right: string;
  coupon: string;
  coupon_text: string;
  advertiser: string;
  ad_period: string;
  ad_start_date: string;
  ad_date_range: string;
  site_phone: string;
  site_url: string;
  line1: string;
  line2: string;
  line3: string;
  psd_file: string;
  bird_file: string;
};

function calcAdDateRange(startDate: string, period: string): string {
  if (!startDate || !period) return "";
  const weeks = parseInt(period);
  if (isNaN(weeks)) return "";
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + weeks * 7 - 1);
  const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
  return `${fmt(start)}~${fmt(end)}(${period})`;
}

function formatPhoneAuto(val: string): string {
  const digits = val.replace(/[^0-9]/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
}

type ApprovalType =
  | "반차"
  | "연차"
  | "결제요청서"
  | "환불요청서"
  | "페이백요청서";

type ApprovalForm = {
  requestType: ApprovalType;
  documentNo: string;
  pageNo: string;
  writer: string;
  subject: string;
  department: string;
  requestDate: string;
  amount: string;
  itemName: string;
  vendor: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  reason: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  leaveStartDate: string;
  leaveEndDate: string;
  halfDayType: string;
  leaveReason: string;
};

type ApprovalRequestRow = {
  id: number;
  request_type: ApprovalType | string;
  request_group: string | null;
  requester_name: string | null;
  requester_title: string | null;
  reference_name: string | null;
  team_lead_name: string | null;
  head_name: string | null;
  ceo_name: string | null;
  current_approver_name: string | null;
  status: string | null;
  payload: ApprovalForm | Record<string, any> | null;
  approval_line: Array<{
    role?: string;
    name?: string;
    step?: number;
    status?: string;
  }> | null;
  final_approved_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type ApprovalActionRow = {
  id: number;
  approval_request_id: number;
  actor_name: string | null;
  action: string | null;
  memo: string | null;
  created_at: string;
};

type DetailTab = "detail" | "comments" | "files";

// ━━━ 파일 업로드/다운로드 유틸 ━━━
// Supabase Storage 키는 한글/특수문자를 허용하지 않으므로 안전한 영문 키로 변환한다.
function safeTaskKey(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}_${rand}${ext ? "." + ext : ""}`;
}
// cross-origin 파일 진짜 다운로드 (새 탭이 아닌 저장 다이얼로그)
async function downloadFile(bucketUrl: string, displayName: string) {
  try {
    const res = await fetch(bucketUrl);
    if (!res.ok) throw new Error("파일을 찾을 수 없습니다.");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  } catch (e: any) {
    alert("다운로드 실패: " + (e?.message || "오류"));
  }
}

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
  "LMS업무요청",
  "호갱노노(직방)_채널톡",
  "호갱노노(직방)_단지마커",
  "호갱노노(기타광고)",
  "일반 업무요청",
];
const STATUSES = ["요청", "접수", "진행중", "완료", "보류"];
const PRIORITIES = ["긴급", "높음", "보통", "낮음"];

const LMS_PLATFORMS = [
  "삼성카드", "국민카드", "BC카드", "신한카드", "하나카드",
  "롯데카드", "롯데멤버스", "스마트스코어", "티맵", "OK캐쉬백",
  "신세계포인트", "SKT", "KT",
];
const HOGAENG_CHANNEL_PLATFORMS = ["호갱노노 채널톡", "직방 채널톡"];
const KAKAO_MESSAGE_TYPES = ["일반타입", "와이드", "케러셀", "동영상"];
const IMAGE_TEMPLATES = ["일반", "하단바확장", "핫이슈", "아파트랭킹", "프리미엄1", "프리미엄2", "프리미엄3", "프리미엄4"];
const AD_PERIODS = ["1주", "2주", "3주", "4주", "5주", "6주"];

const EMPTY_FORM: TaskForm = {
  category: CATEGORIES[0],
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
  combination: "X",
  script: "X",
  script_text: "",
  domain: "",
  rep_number: "",
  test_number: "",
  kakao_type: "",
  image_template: "",
  cta_left: "방문예약",
  cta_right: "홈페이지",
  coupon: "X",
  coupon_text: "",
  advertiser: "",
  ad_period: "",
  ad_start_date: "",
  ad_date_range: "",
  site_phone: "",
  site_url: "",
  line1: "",
  line2: "",
  line3: "",
  psd_file: "",
  bird_file: "",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const APPROVAL_TYPES: { group: string; items: ApprovalType[] }[] = [
  { group: "근태 요청", items: ["반차", "연차"] },
  {
    group: "결제/정산 요청",
    items: ["결제요청서", "환불요청서", "페이백요청서"],
  },
];

const PAYMENT_TYPES: ApprovalType[] = [
  "결제요청서",
  "환불요청서",
  "페이백요청서",
];
const LEAVE_TYPES: ApprovalType[] = ["반차", "연차"];

const EMPTY_APPROVAL_FORM: ApprovalForm = {
  requestType: "결제요청서",
  documentNo: "",
  pageNo: "",
  writer: "",
  subject: "",
  department: "",
  requestDate: new Date().toISOString().slice(0, 10),
  amount: "",
  itemName: "",
  vendor: "",
  quantity: "",
  unitPrice: "",
  totalAmount: "",
  reason: "",
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  leaveStartDate: new Date().toISOString().slice(0, 10),
  leaveEndDate: new Date().toISOString().slice(0, 10),
  halfDayType: "오전 반차",
  leaveReason: "",
};

const APPROVAL_OFFICERS = {
  reference: "최웅",
  teamLead: "김창완",
  head: "김정후",
  ceo: "문시욱",
};

function getWeekday(date: string) {
  if (!date) return "";
  return WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function timeAgo(value?: string | null) {
  if (!value) return "-";

  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 7) return `${day}일 전`;

  return new Date(value).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatAmount(value: string) {
  const n = value.replace(/[^0-9]/g, "");
  return n ? Number(n).toLocaleString() : "";
}

function toneStyle(tone: string) {
  const map: Record<
    string,
    { bg: string; color: string; border: string; dot: string }
  > = {
    success: {
      bg: "var(--success-bg)",
      color: "var(--success-text)",
      border: "var(--success-border)",
      dot: "var(--success)",
    },
    info: {
      bg: "var(--info-bg)",
      color: "var(--info-text)",
      border: "var(--info-border)",
      dot: "var(--info)",
    },
    cyan: {
      bg: "var(--cyan-bg)",
      color: "var(--cyan-text)",
      border: "var(--cyan-border)",
      dot: "var(--cyan)",
    },
    warning: {
      bg: "var(--warning-bg)",
      color: "var(--warning-text)",
      border: "var(--warning-border)",
      dot: "var(--warning)",
    },
    danger: {
      bg: "var(--danger-bg)",
      color: "var(--danger-text)",
      border: "var(--danger-border)",
      dot: "var(--danger)",
    },
    purple: {
      bg: "var(--purple-bg)",
      color: "var(--purple-text)",
      border: "var(--purple-border)",
      dot: "var(--purple)",
    },
    muted: {
      bg: "var(--surface-3)",
      color: "var(--text-subtle)",
      border: "var(--border)",
      dot: "var(--text-faint)",
    },
  };

  return map[tone] || map.muted;
}

function priorityTone(priority?: string | null) {
  if (priority === "긴급") return "danger";
  if (priority === "높음") return "warning";
  if (priority === "보통") return "info";
  return "muted";
}

function statusTone(status?: string | null) {
  if (status === "완료") return "success";
  if (status === "진행중") return "warning";
  if (status === "접수") return "cyan";
  if (status === "요청") return "info";
  return "muted";
}

function statusIcon(status?: string | null) {
  if (status === "완료") return CheckCircle2;
  if (status === "진행중") return Clock;
  if (status === "접수") return Check;
  if (status === "보류") return Pause;
  return Send;
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#8B7CF6,#60A5FA)",
    "linear-gradient(135deg,#60A5FA,#22D3EE)",
    "linear-gradient(135deg,#34D399,#22D3EE)",
    "linear-gradient(135deg,#FBBF24,#FB7185)",
    "linear-gradient(135deg,#C084FC,#FB7185)",
    "linear-gradient(135deg,#60A5FA,#A78BFA)",
  ];

  if (!name) return gradients[0];
  const idx =
    name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) %
    gradients.length;
  return gradients[idx];
}

function Badge({
  children,
  tone = "muted",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: string;
  icon?: ElementType;
}) {
  const c = toneStyle(tone);

  return (
    <span
      className="inline-flex h-[23px] items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-bold"
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {Icon ? (
        <Icon size={12} />
      ) : (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: c.dot }}
        />
      )}
      {children}
    </span>
  );
}

function PremiumIcon({
  icon: Icon,
  tone = "info",
  size = "md",
}: {
  icon: ElementType;
  tone?: string;
  size?: "sm" | "md" | "lg";
}) {
  const c = toneStyle(tone);
  const cls =
    size === "lg"
      ? "h-12 w-12 rounded-[15px]"
      : size === "sm"
        ? "h-8 w-8 rounded-[10px]"
        : "h-10 w-10 rounded-[12px]";

  return (
    <div
      className={`inline-flex flex-shrink-0 items-center justify-center ${cls}`}
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02)), ${c.bg}`,
        border: `1px solid ${c.border}`,
        color: c.color,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
      }}
    >
      <Icon size={size === "lg" ? 22 : size === "sm" ? 14 : 18} />
    </div>
  );
}

function SelectChip({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[122px] appearance-none rounded-full border px-3 pr-8 text-[12px] font-bold outline-none"
        style={{
          background: value ? "var(--accent-subtle)" : "var(--surface-2)",
          borderColor: value ? "var(--accent-border)" : "var(--border)",
          color: value ? "var(--accent-text)" : "var(--text-muted)",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
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

function StatCard({
  label,
  value,
  icon,
  tone,
  sub,
  onClick,
}: {
  label: string;
  value: number;
  icon: ElementType;
  tone: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="premium-card flex h-[82px] items-center gap-4 px-4 transition-all"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined, outline: tone !== "muted" && onClick ? "2px solid var(--accent-border)" : undefined }}
    >
      <PremiumIcon icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p
          className="mt-1 text-[22px] font-[760] leading-none tracking-[-0.05em]"
          style={{ color: "var(--text-strong)" }}
        >
          {value.toLocaleString()}
        </p>
        {sub && <p className="crm-tiny mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 py-3">
      <div
        className="text-[12px] font-semibold"
        style={{ color: "var(--text-subtle)" }}
      >
        {label}
      </div>
      <div
        className="min-w-0 text-[13px] font-semibold"
        style={{ color: "var(--text)" }}
      >
        {children || <span style={{ color: "var(--text-faint)" }}>-</span>}
      </div>
    </div>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return (
    <label
      className="mb-1.5 block text-[12px] font-bold"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </label>
  );
}

function getMemberTitle(name: string) {
  return TEAM.find((member) => member.name === name)?.title || "";
}

function getApprovalLine(type: ApprovalType, requesterName: string) {
  const base = [
    { role: "담당", name: requesterName, step: 0, status: "기안" },
    {
      role: "참조",
      name: APPROVAL_OFFICERS.reference,
      step: 1,
      status: "대기",
    },
    { role: "팀장", name: APPROVAL_OFFICERS.teamLead, step: 2, status: "대기" },
  ];

  if (LEAVE_TYPES.includes(type)) return base;

  return [
    ...base,
    { role: "본부장", name: APPROVAL_OFFICERS.head, step: 3, status: "대기" },
  ];
}

function getApprovalGroup(type: ApprovalType) {
  return LEAVE_TYPES.includes(type) ? "근태 요청" : "결제/정산 요청";
}

function getCurrentApprover(type: ApprovalType) {
  // 최웅 파트장은 참조자이며, 실제 승인권자는 팀장부터 시작합니다.
  return APPROVAL_OFFICERS.teamLead;
}

function fieldValue(value: string) {
  return value?.trim() || "-";
}

function formatKoreanDate(value: string) {
  if (!value) return "20  년   월   일";
  const [y, m, d] = value.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

function buildContent(form: TaskForm) {
  if (form.category === "LMS업무요청") {
    const d = form.hope_date ? new Date(form.hope_date) : null;
    const days = ["일","월","화","수","목","금","토"];
    const dateStr = d ? `${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})` : "";
    const cnt = parseInt((form.send_count||"").replace(/,/g,""));
    const cntStr = isNaN(cnt) ? form.send_count : cnt.toLocaleString("ko-KR");
    return [
      `[LMS 업무요청]`,
      ``,
      `0. 고객명: ${form.member_name} ${form.member_title}`,
      `0. 고객연락처: ${form.member_number}`,
      `1. 현장명: ${form.site_name}`,
      `2. 발송채널: LMS_${form.platform}`,
      `3. 조합여부: ${form.combination}`,
      `4. 발송일자: ${dateStr}`,
      `5. 발송시각: ${form.hope_time}`,
      `6. 발송건수: ${cntStr}건`,
      `7. 착신번호(대표번호): ${form.rep_number || ""}`,
      `8. 타겟지역: ①${form.region1} ②${form.region2} ③${form.region3}`,
      `9. 타겟연령: ${form.age_range}세 (부동산 관심자)`,
      `10. 스크립트: ${form.script === "O" ? form.script_text : form.script === "스크립트요청" ? "스크립트 요청" : "X"}`,
      `11. 발송도메인: ${form.domain || "X"}`,
    ].join("\n");
  }
  if (form.category === "호갱노노(직방)_채널톡") {
    const d = form.hope_date ? new Date(form.hope_date) : null;
    const days = ["일","월","화","수","목","금","토"];
    const dateStr = d ? `${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})` : "";
    const cnt = parseInt((form.send_count||"").replace(/,/g,""));
    const cntStr = isNaN(cnt) ? form.send_count : cnt.toLocaleString("ko-KR");
    return [
      `[호갱노노(직방) 채널톡 업무요청]`,
      ``,
      `0. 고객명: ${form.member_name} ${form.member_title}`,
      `0. 고객연락처: ${form.member_number}`,
      `1. 현장명: ${form.site_name}`,
      `2. 테스트번호: ${form.test_number}`,
      `2-1. 착신번호(대표번호): ${form.rep_number || ""}`,
      `3. 발송채널: ${form.platform || "호갱노노 채널톡"}`,
      `4. 조합여부: ${form.combination === "O" ? "해당" : "미해당"}`,
      `5. 발송일자: ${dateStr}`,
      `6. 발송시각: ${form.hope_time}`,
      `7. 발송건수: ${cntStr}건`,
      `8. 발송 타겟지역: ①${form.region1} ②${form.region2} ③${form.region3}`,
      `9. 발송 타겟연령대: ${form.age_range}세 (부동산 관심자)`,
      `10. 카카오톡 채널 메시지유형: ${form.kakao_type}`,
      `11. 이미지 템플릿: ${form.image_template}`,
      `12. 스크립트: ${form.script === "O" ? form.script_text : form.script === "스크립트요청" ? "스크립트 요청" : "X"}`,
      `13. CTA 영역: 왼) ${form.cta_left} , 오) ${form.cta_right}`,
      `→ 발송도메인: ${form.domain || "X"}`,
      `14. 쿠폰여부: ${form.coupon === "O" ? form.coupon_text || "별도첨부" : "해당없음"}`,
    ].join("\n");
  }
  if (form.category === "호갱노노(직방)_단지마커") {
    return [
      `[호갱노노(직방) 단지마커 업무요청]`,
      ``,
      `0. 고객명: ${form.member_name} ${form.member_title}`,
      `0. 고객연락처: ${form.member_number}`,
      `광고주명: ${form.advertiser}`,
      `광고집행기간: ${form.ad_period}`,
      `광고시작일: ${form.ad_start_date}`,
      `광고집행일자: ${form.ad_date_range || calcAdDateRange(form.ad_start_date, form.ad_period)}`,
      `분양단지 전화번호: ${form.site_phone}`,
      `분양단지 URL: ${form.site_url}`,
      ``,
      `[메시지 텍스트]`,
      `1행: ${form.line1} (${form.line1.length}/17자)`,
      `2행: ${form.line2} (${form.line2.length}/10자)`,
      `3행: ${form.line3} (${form.line3.length}/15자)`,
      ``,
      `PSD첨부: ${form.psd_file || "없음"}`,
      `조감도 첨부: ${form.bird_file || "없음"}`,
    ].join("\n");
  }
  return form.content;
}

function TaskCard({
  task,
  selected,
  commentCount,
  onClick,
  onDelete,
  canDelete,
}: {
  task: TaskRow;
  selected: boolean;
  commentCount: number;
  onClick: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const StatusIcon = statusIcon(task.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className="premium-card premium-card-hover group w-full p-4 text-left"
      style={{
        background: selected
          ? "linear-gradient(90deg, rgba(139,124,246,.16), rgba(139,124,246,.045)), var(--surface-selected)"
          : undefined,
        borderColor: selected ? "var(--accent-border)" : undefined,
      }}
    >
      <div className="flex items-start gap-4">
        <PremiumIcon icon={StatusIcon} tone={statusTone(task.status)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={priorityTone(task.priority)}>
              {task.priority || "보통"}
            </Badge>
            <Badge tone="muted">{task.category || "업무"}</Badge>
            <Badge tone={statusTone(task.status)} icon={StatusIcon}>
              {task.status || "요청"}
            </Badge>
          </div>

          <p
            className="mt-3 line-clamp-2 whitespace-pre-wrap text-[13.5px] font-[700] leading-relaxed tracking-[-0.02em]"
            style={{ color: "var(--text)" }}
          >
            {task.content || "-"}
          </p>

          <div
            className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-semibold"
            style={{ color: "var(--text-subtle)" }}
          >
            <span>
              {task.requester || "-"} →{" "}
              <strong style={{ color: "var(--text-muted)" }}>
                {task.assignee || "-"}
              </strong>
            </span>
            {!!task.tagged?.length && (
              <span style={{ color: "var(--purple-text)" }}>
                @{task.tagged.join(" @")}
              </span>
            )}
            <span>{timeAgo(task.created_at)}</span>
            {!!task.file_urls?.length && (
              <span className="inline-flex items-center gap-1">
                <Paperclip size={12} />
                파일 {task.file_urls.length}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={12} />
              댓글 {commentCount}
            </span>
          </div>
        </div>

        {canDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="btn-premium btn-danger h-8 w-8 flex-shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </span>
        )}
      </div>
    </button>
  );
}

function getApprovalLabel(request: ApprovalRequestRow) {
  const payload = (request.payload || {}) as Partial<ApprovalForm>;
  if (LEAVE_TYPES.includes(request.request_type as ApprovalType)) {
    const range =
      payload.leaveStartDate && payload.leaveEndDate
        ? `${formatKoreanDate(payload.leaveStartDate)} ~ ${formatKoreanDate(payload.leaveEndDate)}`
        : "일정 미입력";
    return `${request.request_type} · ${range}`;
  }

  return `${request.request_type} · ${payload.subject || payload.itemName || "안건 미입력"}`;
}

function effectiveCurrentApprover(request: ApprovalRequestRow) {
  // 참조자는 승인권자가 아닙니다.
  // 이전 버전에서 current_approver_name에 참조자(최웅)가 들어간 요청도
  // 화면과 처리 기준에서는 실제 1차 승인자인 팀장으로 보정합니다.
  if (request.current_approver_name === request.reference_name) {
    return request.team_lead_name || request.current_approver_name || null;
  }
  return request.current_approver_name || null;
}

function approvalStepText(request: ApprovalRequestRow) {
  if (request.status === "완료") return "결재완료";
  if (request.status === "반려") return "반려";
  return `${effectiveCurrentApprover(request) || "-"} 승인대기`;
}

// ── 결재선 진행상황 컴포넌트 ──
function ApprovalLineProgress({ request }: { request: ApprovalRequestRow }) {
  const line = request.approval_line;
  if (!line || line.length === 0) return null;

  const currentApprover = effectiveCurrentApprover(request);
  const isDone   = request.status === "완료";
  const isRejected = request.status === "반려";

  // 각 스텝의 실제 상태 계산
  type StepItem = { role?: string; name?: string; step?: number; status?: string };
  function stepStatus(step: StepItem) {
    if (step.status === "승인" || step.status === "완료") return "approved";
    if (step.status === "반려") return "rejected";
    // 현재 승인권자이면 "active"
    if (step.name === currentApprover && !isDone && !isRejected) return "active";
    // 완료/반려된 요청의 나머지 스텝은 done/rejected 처리
    if (isDone) return "done_skip";
    if (isRejected) return "rejected_skip";
    return "pending";
  }

  return (
    <div
      className="mt-3 rounded-[12px] border px-3 py-2.5"
      style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-faint)" }}>결재선 진행현황</p>
      <div className="flex items-center gap-0">
        {line.map((step, idx) => {
          const st = stepStatus(step);
          const isLast = idx === line.length - 1;

          const dotBg =
            st === "approved" ? "var(--success)" :
            st === "rejected" ? "var(--danger)" :
            st === "active"   ? "var(--accent-text)" :
            "var(--surface-3)";
          const dotBorder =
            st === "active"   ? "2px solid var(--accent-text)" :
            st === "approved" ? "2px solid var(--success)" :
            st === "rejected" ? "2px solid var(--danger)" :
            "2px solid var(--border)";
          const label =
            st === "approved" ? "✓" :
            st === "rejected" ? "✕" :
            st === "active"   ? "●" : "";
          const nameColor =
            st === "active"   ? "var(--accent-text)" :
            st === "approved" ? "var(--success-text)" :
            st === "rejected" ? "var(--danger-text)" :
            "var(--text-faint)";
          const roleColor =
            st === "active" ? "var(--accent-text)" : "var(--text-faint)";

          return (
            <div key={idx} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                {/* 스텝 도트 */}
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                  style={{
                    background: dotBg,
                    border: dotBorder,
                    color: st === "pending" || st === "done_skip" || st === "rejected_skip" ? "var(--text-faint)" : "white",
                  }}
                >
                  {label}
                </div>
                {/* 이름 + 역할 */}
                <div className="flex flex-col items-center text-center" style={{ minWidth: 44 }}>
                  <span className="text-[10px] font-bold leading-tight" style={{ color: nameColor }}>
                    {step.name || "-"}
                  </span>
                  <span className="text-[9px] font-normal" style={{ color: roleColor }}>
                    {step.role || ""}
                  </span>
                  {st === "active" && (
                    <span className="mt-0.5 rounded-[5px] px-1 py-px text-[9px] font-bold"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}>
                      대기중
                    </span>
                  )}
                  {(st === "approved") && (
                    <span className="mt-0.5 text-[9px] font-bold" style={{ color: "var(--success-text)" }}>승인</span>
                  )}
                  {(st === "rejected") && (
                    <span className="mt-0.5 text-[9px] font-bold" style={{ color: "var(--danger-text)" }}>반려</span>
                  )}
                </div>
              </div>
              {/* 연결선 */}
              {!isLast && (
                <div className="mx-1 h-px flex-1"
                  style={{ background: st === "approved" ? "var(--success)" : "var(--border-subtle)" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApprovalCard({
  request,
  me,
  onView,
  onApprove,
  onReject,
  onDelete,
}: {
  request: ApprovalRequestRow;
  me: string;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete?: () => void;
}) {
  const payload = (request.payload || {}) as Partial<ApprovalForm>;
  const currentApprover = effectiveCurrentApprover(request);
  const isReference = request.reference_name === me && currentApprover !== me;
  const isApprover = currentApprover === me;
  const isRequester = request.requester_name === me;
  const canApprove = isApprover && request.status === "진행중";

  return (
    <div className="premium-card premium-card-hover w-full p-4">
      <div className="flex items-start gap-4">
        <PremiumIcon
          icon={FileText}
          tone={
            LEAVE_TYPES.includes(request.request_type as ApprovalType)
              ? "success"
              : "warning"
          }
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              tone={
                LEAVE_TYPES.includes(request.request_type as ApprovalType)
                  ? "success"
                  : "warning"
              }
            >
              {request.request_group || "결재요청"}
            </Badge>
            <Badge
              tone={
                request.status === "완료"
                  ? "success"
                  : request.status === "반려"
                    ? "danger"
                    : "info"
              }
            >
              {request.status || "진행중"}
            </Badge>
            {isReference && <Badge tone="purple">참조확인</Badge>}
            {isApprover && <Badge tone="danger">승인요청</Badge>}
            {isRequester && <Badge tone="muted">내 요청</Badge>}
          </div>

          <p
            className="mt-3 text-[14px] font-[820] leading-relaxed"
            style={{ color: "var(--text)" }}
          >
            {getApprovalLabel(request)}
          </p>

          <div
            className="mt-2 flex flex-wrap items-center gap-3 text-[12px] font-semibold"
            style={{ color: "var(--text-subtle)" }}
          >
            <span>
              신청자{" "}
              <strong style={{ color: "var(--text-muted)" }}>
                {request.requester_name || "-"}
              </strong>{" "}
              {request.requester_title || ""}
            </span>
            {PAYMENT_TYPES.includes(request.request_type as ApprovalType) && (
              <span>
                금액{" "}
                <strong style={{ color: "var(--accent-text)" }}>
                  {payload.totalAmount || payload.amount || "-"}
                </strong>
              </span>
            )}
            <span style={{ color: "var(--text-faint)" }}>작성 {timeAgo(request.created_at)}</span>
          </div>

          {/* ── 결재선 진행상황 ── */}
          <ApprovalLineProgress request={request} />

          {payload.reason || payload.leaveReason ? (
            <p
              className="mt-3 line-clamp-2 whitespace-pre-wrap rounded-[12px] px-3 py-2 text-[12.5px] font-semibold leading-relaxed"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {payload.reason || payload.leaveReason}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onView}
              className="btn-premium btn-secondary h-8"
            >
              <FileText size={13} />
              작성 양식 보기
            </button>

            {canApprove && (
              <>
                <button
                  type="button"
                  onClick={onApprove}
                  className="btn-premium btn-primary h-8"
                >
                  <Check size={13} />
                  승인
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="btn-premium btn-danger h-8"
                >
                  <X size={13} />
                  반려
                </button>
              </>
            )}
            {/* 본인 요청건 삭제 버튼 (모든 상태) */}
            {onDelete && isRequester && (
              <button
                type="button"
                onClick={onDelete}
                className="btn-premium btn-danger h-8"
              >
                <Trash2 size={13} />
                삭제
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalDetailSlidePanel({
  request,
  me,
  actions,
  onClose,
  onApprove,
  onReject,
  onDelete,
}: {
  request: ApprovalRequestRow;
  me: string;
  actions: ApprovalActionRow[];
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete?: () => void;
}) {
  const payload = (request.payload || {}) as Partial<ApprovalForm>;
  const currentApprover = effectiveCurrentApprover(request);
  const canApprove = currentApprover === me && request.status === "진행중";
  const isReference = request.reference_name === me && currentApprover !== me;
  const previewForm: ApprovalForm = {
    ...EMPTY_APPROVAL_FORM,
    ...(payload as Partial<ApprovalForm>),
    requestType: request.request_type as ApprovalType,
    writer: request.requester_name || payload.writer || me,
    department: payload.department || "실행파트",
    requestDate: payload.requestDate || request.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  };

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />
      <aside
        className="slide-panel"
        style={{ width: "min(1280px, calc(100vw - 24px))", maxWidth: "calc(100vw - 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="slide-panel-header">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={LEAVE_TYPES.includes(request.request_type as ApprovalType) ? "success" : "warning"}>
                  {request.request_group || "결재요청"}
                </Badge>
                <Badge tone={request.status === "완료" ? "success" : request.status === "반려" ? "danger" : "info"}>
                  {request.status || "진행중"}
                </Badge>
                {isReference && <Badge tone="purple">참조확인</Badge>}
                {canApprove && <Badge tone="danger">승인권자</Badge>}
              </div>
              <h2
                className="mt-3 text-[21px] font-[820] leading-snug tracking-[-0.025em]"
                style={{ color: "var(--text-strong)" }}
              >
                작성된 양식 보기
              </h2>
              <p
                className="mt-2 text-[13px] font-semibold"
                style={{ color: "var(--text-subtle)" }}
              >
                신청자 {request.requester_name || "-"} · 현재 결재자 {currentApprover || "-"}
                {isReference ? " · 참조자는 승인 권한이 없습니다." : ""}
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

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("approval-preview-print");
                if (!el) return;
                const iframe = document.createElement("iframe");
                iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;";
                document.body.appendChild(iframe);
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc) return;
                doc.open();
                doc.write(`<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"/>
<title></title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"/>
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body { width: 210mm; height: 297mm; background: white; overflow: hidden; }
body { display: flex; align-items: flex-start; justify-content: center; padding: 5mm; }
</style>
</head><body>${el.innerHTML}</body></html>`);
                doc.close();
                iframe.onload = () => {
                  try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                  } finally {
                    setTimeout(() => document.body.removeChild(iframe), 2000);
                  }
                };
              }}
              className="btn-premium btn-secondary h-9"
            >
              <FileText size={14} />
              양식 출력
            </button>
            {canApprove && (
              <>
                <button type="button" onClick={onApprove} className="btn-premium btn-primary h-9">
                  <Check size={14} />
                  승인
                </button>
                <button type="button" onClick={onReject} className="btn-premium btn-danger h-9">
                  <X size={14} />
                  반려
                </button>
              </>
            )}
          </div>
          {/* 본인 요청건 삭제 버튼 (모든 상태) */}
          {onDelete && request.requester_name === me && (
            <div className="mt-3 px-1">
              <button
                type="button"
                onClick={onDelete}
                className="btn-premium btn-danger w-full h-9 text-[12px]"
              >
                <Trash2 size={13} />
                요청서 삭제
              </button>
            </div>
          )}
        </div>

        <div className="slide-panel-body">
          <div
            className="rounded-[18px] p-4"
            style={{
              background: "#0b0d12",
              overflow: "auto",
              maxWidth: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div id="approval-preview-print">
              <ApprovalPreview form={previewForm} me={me} actions={actions} />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function DetailSlidePanel({
  task,
  comments,
  activeTab,
  onTabChange,
  me,
  onClose,
  onStatus,
  onComment,
  onDelete,
}: {
  task: TaskRow;
  comments: CommentRow[];
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  me: string;
  onClose: () => void;
  onStatus: (status: string) => void;
  onComment: (text: string) => void;
  onDelete: () => void;
}) {
  const [commentText, setCommentText] = useState("");
  const StatusIcon = statusIcon(task.status);

  useEffect(() => {
    setCommentText("");
  }, [task.id]);

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />

      <aside
        className="slide-panel"
        style={{ width: "min(1280px, calc(100vw - 24px))", maxWidth: "calc(100vw - 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="slide-panel-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <PremiumIcon
                icon={StatusIcon}
                tone={statusTone(task.status)}
                size="lg"
              />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={priorityTone(task.priority)}>
                    {task.priority || "보통"}
                  </Badge>
                  <Badge tone="muted">{task.category || "업무"}</Badge>
                  <Badge tone={statusTone(task.status)} icon={StatusIcon}>
                    {task.status || "요청"}
                  </Badge>
                </div>

                <h2
                  className="mt-3 line-clamp-2 text-[20px] font-[760] leading-snug tracking-[-0.045em]"
                  style={{ color: "var(--text-strong)" }}
                >
                  {task.content?.split("\n")[0] || "업무 요청"}
                </h2>

                <p
                  className="mt-2 text-[13px] font-semibold"
                  style={{ color: "var(--text-subtle)" }}
                >
                  {task.requester || "-"} → {task.assignee || "-"} ·{" "}
                  {formatDateTime(task.created_at)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-premium btn-secondary h-9 w-9 p-0"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-5 gap-1.5">
            {STATUSES.map((status) => {
              const active = (task.status || "요청") === status;
              const c = toneStyle(statusTone(status));

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatus(status)}
                  className="h-9 rounded-[9px] border text-[12px] font-bold"
                  style={{
                    background: active ? c.bg : "var(--surface-2)",
                    borderColor: active ? c.border : "var(--border)",
                    color: active ? c.color : "var(--text-muted)",
                  }}
                >
                  {status}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex gap-1.5">
            {[
              { key: "detail", label: "상세" },
              { key: "comments", label: `댓글 ${comments.length}` },
              { key: "files", label: `파일 ${task.file_urls?.length || 0}` },
            ].map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTabChange(item.key as DetailTab)}
                  className="h-9 rounded-[9px] px-3 text-[12px] font-bold transition-all"
                  style={{
                    background: active ? "var(--accent-subtle)" : "transparent",
                    color: active ? "var(--accent-text)" : "var(--text-subtle)",
                    border: active
                      ? "1px solid var(--accent-border)"
                      : "1px solid transparent",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="slide-panel-body">
          {activeTab === "detail" && (
            <div className="space-y-6">
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={FileText} tone="info" />
                  <div>
                    <p className="crm-section-title">요청 내용</p>
                    <p className="crm-tiny">업무 요청의 상세 내용</p>
                  </div>
                </div>

                <div
                  className="min-h-[180px] whitespace-pre-wrap rounded-[12px] p-4 text-[13px] font-medium leading-relaxed"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {task.content || "-"}
                </div>
              </section>

              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={User} tone="purple" />
                  <div>
                    <p className="crm-section-title">업무 정보</p>
                    <p className="crm-tiny">요청자, 담당자, 태그자 정보</p>
                  </div>
                </div>

                <Field label="요청자">
                  <Badge tone="info" icon={User}>
                    {task.requester || "-"}
                  </Badge>
                </Field>
                <Field label="담당자">
                  <Badge tone="purple" icon={User}>
                    {task.assignee || "-"}
                  </Badge>
                </Field>
                <Field label="태그자">
                  {task.tagged?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {task.tagged.map((name) => (
                        <Badge key={name} tone="muted">
                          @{name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )}
                </Field>
                <Field label="생성일">{formatDateTime(task.created_at)}</Field>
                <Field label="완료일">
                  {formatDateTime(task.completed_at)}
                </Field>
              </section>
            </div>
          )}

          {activeTab === "comments" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <PremiumIcon icon={MessageCircle} tone="cyan" />
                <div>
                  <p className="crm-section-title">댓글 / 히스토리</p>
                  <p className="crm-tiny">업무 처리 과정과 상태 변경 이력</p>
                </div>
              </div>

              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div
                    className="flex h-28 items-center justify-center rounded-[12px] text-[12px] font-bold"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-faint)",
                      border: "1px dashed var(--border)",
                    }}
                  >
                    댓글이 없습니다.
                  </div>
                ) : (
                  comments.map((comment) => {
                    const isStatus = comment.comment_type === "상태변경";
                    return (
                      <div
                        key={comment.id}
                        className="rounded-[12px] p-3"
                        style={{
                          background: isStatus
                            ? "var(--info-bg)"
                            : "var(--surface-2)",
                          border: `1px solid ${isStatus ? "var(--info-border)" : "var(--border-subtle)"}`,
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span
                            className="text-[12px] font-bold"
                            style={{ color: "var(--text)" }}
                          >
                            {comment.author || "-"}
                          </span>
                          <span className="crm-tiny">
                            {formatDateTime(comment.created_at)}
                          </span>
                        </div>
                        <p
                          className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed"
                          style={{
                            color: isStatus
                              ? "var(--info-text)"
                              : "var(--text-muted)",
                          }}
                        >
                          {comment.content}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {activeTab === "files" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <PremiumIcon icon={Paperclip} tone="warning" />
                <div>
                  <p className="crm-section-title">첨부파일</p>
                  <p className="crm-tiny">업무 요청에 연결된 파일</p>
                </div>
              </div>

              <div className="space-y-2">
                {!task.file_urls?.length ? (
                  <div
                    className="flex h-28 items-center justify-center rounded-[12px] text-[12px] font-bold"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-faint)",
                      border: "1px dashed var(--border)",
                    }}
                  >
                    첨부파일이 없습니다.
                  </div>
                ) : (
                  task.file_urls.map((file, index) => {
                    const displayName = task.file_names?.[index] || file.split("_").slice(1).join("_") || file;
                    const { data } = supabase.storage.from("task-files").getPublicUrl(file);
                    const fileUrl = data?.publicUrl || "";
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); downloadFile(fileUrl, displayName); }}
                        className="premium-card premium-card-hover flex w-full items-center gap-3 p-3 text-left"
                      >
                        <PremiumIcon icon={Download} tone="info" size="sm" />
                        <span
                          className="min-w-0 flex-1 truncate text-[13px] font-bold"
                          style={{ color: "var(--accent-text)" }}
                        >
                          {displayName}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </div>

        <div className="slide-panel-footer">
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (commentText.trim()) {
                    onComment(commentText.trim());
                    setCommentText("");
                    onTabChange("comments");
                  }
                }
              }}
              placeholder="댓글을 입력하세요..."
              className="h-10 flex-1 rounded-[9px] border px-3 text-[13px] font-semibold outline-none"
            />

            <button
              type="button"
              onClick={() => {
                if (commentText.trim()) {
                  onComment(commentText.trim());
                  setCommentText("");
                  onTabChange("comments");
                }
              }}
              className="btn-premium btn-primary h-10 w-11 p-0"
            >
              <Send size={14} />
            </button>
          </div>

          {task.requester === me && (
            <button
              type="button"
              onClick={onDelete}
              className="btn-premium btn-danger mt-3 w-full"
            >
              <Trash2 size={14} />
              업무 삭제
            </button>
          )}
        </div>
      </aside>
    </>
  );
}


const STAMP_IMAGE_BY_NAME: Record<string, string> = {
  "조계현": "/approval-stamps/cho-gyehyun.png",
  "이세호": "/approval-stamps/lee-seho.png",
  "최연전": "/approval-stamps/choi-yeonjeon.png",
  "김정후": "/approval-stamps/kim-jeonghu.png",
  "김창완": "/approval-stamps/kim-changwan.png",
  "최웅": "/approval-stamps/choi-woong.png",
  "최은정": "/approval-stamps/choi-eunjung.png",
  "기여운": "/approval-stamps/gi-yeoun.png",
};

function KoreanSeal({
  name,
  compact = false,
  overlay = false,
  size,
}: {
  name?: string | null;
  compact?: boolean;
  overlay?: boolean;
  size?: number;
}) {
  const cleanName = (name || "").trim();
  if (!cleanName) return null;

  const sealSize = size || (compact ? 38 : 50);
  const imageSrc = STAMP_IMAGE_BY_NAME[cleanName];

  return (
    <span
      aria-label={`${cleanName} 도장`}
      style={{
        position: overlay ? "absolute" : "relative",
        left: overlay ? "50%" : undefined,
        top: overlay ? "50%" : undefined,
        zIndex: overlay ? 4 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: sealSize,
        height: sealSize,
        marginLeft: overlay ? 0 : 6,
        transform: overlay
          ? "translate(-50%, -50%) rotate(-4deg)"
          : "rotate(-4deg)",
        verticalAlign: "middle",
        flexShrink: 0,
        pointerEvents: "none",
        mixBlendMode: "multiply",
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`${cleanName} 도장`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            opacity: 0.9,
          }}
        />
      ) : (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: sealSize,
            height: sealSize,
            borderRadius: "999px",
            border: `${compact ? 2 : 2.6}px solid #dc2626`,
            color: "#dc2626",
            fontSize: compact ? 9 : 10.5,
            fontWeight: 950,
            lineHeight: 1.02,
            letterSpacing: "-0.08em",
            background: "rgba(255,255,255,0.18)",
          }}
        >
          {cleanName.length >= 3 ? (
            <span
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                alignItems: "center",
                justifyItems: "center",
                gap: 0,
                width: "70%",
              }}
            >
              {cleanName.slice(0, 4).split("").map((char, index) => (
                <span key={`${char}-${index}`}>{char}</span>
              ))}
            </span>
          ) : (
            cleanName
          )}
        </span>
      )}
    </span>
  );
}

function buildApprovedNameSet(
  form: ApprovalForm,
  actions: ApprovalActionRow[] = [],
) {
  const signed = new Set<string>();
  const requester = (form.writer || "").trim();
  if (requester) signed.add(requester);

  actions.forEach((action) => {
    const actor = (action.actor_name || "").trim();
    if (!actor) return;
    if (action.action === "승인" || action.action === "제출") {
      signed.add(actor);
    }
  });

  return signed;
}

function ApprovalPreview({
  form,
  me,
  actions = [],
}: {
  form: ApprovalForm;
  me: string;
  actions?: ApprovalActionRow[];
}) {
  const requester = form.writer || me || "담당자";
  const line = getApprovalLine(form.requestType, requester);
  const approvedActorNames = new Set(
    actions
      .filter((action) => action.action === "승인")
      .map((action) => (action.actor_name || "").trim())
      .filter(Boolean),
  );
  const isLeave = LEAVE_TYPES.includes(form.requestType);
  const title =
    form.requestType === "결제요청서"
      ? "결제 요청서"
      : form.requestType === "환불요청서"
        ? "환불 요청서"
        : form.requestType === "페이백요청서"
          ? "페이백 요청서"
          : form.requestType === "반차"
            ? "반차 신청서"
            : "연차 신청서";
  const accent =
    form.requestType === "결제요청서"
      ? "#1f3f60"
      : form.requestType === "환불요청서"
        ? "#d8b2b2"
        : form.requestType === "페이백요청서"
          ? "#cfe2a3"
          : "#111827";
  const accentText =
    form.requestType === "결제요청서" || isLeave ? "#ffffff" : "#111827";
  const border = "1px solid #1f2f57";
  const dotted = "1px dotted #9ca3af";
  const labelBg = "#f4f6f8";
  const cell: CSSProperties = {
    border: dotted,
    padding: "8px 10px",
    verticalAlign: "middle",
    wordBreak: "keep-all",
  };
  const label: CSSProperties = {
    ...cell,
    background: labelBg,
    textAlign: "center",
    fontWeight: 800,
    color: "#1f2937",
    whiteSpace: "nowrap",
  };
  const value: CSSProperties = { ...cell, fontWeight: 700, color: "#111827" };
  const sectionTitle: CSSProperties = {
    borderLeft: "6px solid #111827",
    paddingLeft: 8,
    margin: "18px 0 8px",
    fontWeight: 900,
    color: "#111827",
  };
  const documentDate = formatKoreanDate(form.requestDate);
  const amount = fieldValue(form.totalAmount || form.amount);
  const leaveRange = `${formatKoreanDate(form.leaveStartDate)} ~ ${formatKoreanDate(form.leaveEndDate)}${form.requestType === "반차" ? ` · ${form.halfDayType}` : ""}`;

  const ApprovalLineTable = () => (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        fontSize: 12,
      }}
    >
      <tbody>
        <tr>
          <td
            rowSpan={2}
            style={{
              border,
              width: 48,
              textAlign: "center",
              fontWeight: 900,
              letterSpacing: "0.16em",
              color: "#111827",
            }}
          >
            결<br />재
          </td>
          {line.map((item) => (
            <td
              key={`role-${item.role}`}
              style={{
                border: dotted,
                height: 34,
                textAlign: "center",
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {item.role}
            </td>
          ))}
        </tr>
        <tr>
          {line.map((item) => {
            const isRequesterStamp = item.role === "담당" && item.name === requester;
            const isApproverStamp = item.role !== "참조" && approvedActorNames.has(item.name);
            const shouldShowSeal = isRequesterStamp || isApproverStamp;

            return (
              <td
                key={`name-${item.role}-${item.name}`}
                style={{
                  border: dotted,
                  height: 62,
                  textAlign: "center",
                  fontWeight: 800,
                  color: "#111827",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 40,
                    minWidth: 44,
                    padding: "0 8px",
                    lineHeight: 1.25,
                  }}
                >
                  <span style={{ position: "relative", zIndex: 1 }}>{item.name}</span>
                  {shouldShowSeal && <KoreanSeal name={item.name} overlay size={50} />}
                </span>
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );

  if (isLeave) {
    return (
      <div
        className="mx-auto bg-white p-8 text-black shadow-xl"
        style={{
          width: 794,
          minHeight: 1123,
          fontFamily: "Pretendard, Arial, sans-serif",
        }}
      >
        <div
          style={{ border: "2px solid #111827", minHeight: 850, padding: 28 }}
        >
          <div className="flex items-start justify-between gap-8">
            <div className="flex min-h-[120px] items-center">
              <h2
                style={{
                  fontSize: 32,
                  fontWeight: 950,
                  letterSpacing: "0.08em",
                  lineHeight: 1.25,
                  color: "#111827",
                }}
              >
                {form.requestType === "반차" ? "반차" : "연차"}
                <br />
                신청서
              </h2>
            </div>
            <div style={{ width: 420 }}>
              <ApprovalLineTable />
            </div>
          </div>

          <div style={{ marginTop: 28, fontSize: 14, color: "#111827" }}>
            <p style={{ marginBottom: 14, fontWeight: 800 }}>
              ■ 문서번호 : {fieldValue(form.documentNo)}
            </p>
            <p style={sectionTitle}>신청자</p>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontSize: 13,
              }}
            >
              <tbody>
                <tr>
                  <td style={label}>부서</td>
                  <td style={value}>{fieldValue(form.department)}</td>
                  <td style={label}>직위</td>
                  <td style={value}>{fieldValue(getMemberTitle(requester))}</td>
                </tr>
                <tr>
                  <td style={label}>성명</td>
                  <td style={value}>{requester}</td>
                  <td style={label}>전화번호</td>
                  <td style={value}>-</td>
                </tr>
              </tbody>
            </table>

            <p style={sectionTitle}>신청사항</p>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontSize: 13,
              }}
            >
              <tbody>
                <tr>
                  <td style={{ ...label, width: 120 }}>신청구분</td>
                  <td style={value}>{form.requestType}</td>
                </tr>
                <tr>
                  <td style={label}>신청기간</td>
                  <td style={value}>{leaveRange}</td>
                </tr>
                <tr>
                  <td style={label}>신청사유</td>
                  <td
                    style={{
                      ...value,
                      height: 76,
                      verticalAlign: "top",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {fieldValue(form.leaveReason)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginTop: 42, textAlign: "center", fontWeight: 800 }}>
              상기와 같이 {form.requestType}를 신청합니다.
            </p>
            <p style={{ marginTop: 44, textAlign: "center", fontWeight: 800 }}>
              {documentDate}
            </p>
            <p style={{ marginTop: 48, textAlign: "right", fontWeight: 800 }}>
              신청자 : {requester}{" "}
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 44,
                  minHeight: 38,
                }}
              >
                (인)
                <KoreanSeal name={requester} compact overlay size={42} />
              </span>
            </p>

            <p
              style={{
                marginTop: 90,
                textAlign: "center",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              (주) 광고인
            </p>
          </div>
        </div>
      </div>
    );
  }

  const paymentLabel =
    form.requestType === "환불요청서"
      ? "환불요청액"
      : form.requestType === "페이백요청서"
        ? "페이백금액"
        : "결제금액";
  const reasonLabel =
    form.requestType === "환불요청서"
      ? "환불사유"
      : form.requestType === "페이백요청서"
        ? "지급사유"
        : "결제사유";

  return (
    <div
      className="mx-auto bg-white text-black shadow-xl"
      style={{
        width: 794,
        minHeight: 1123,
        fontFamily: "Pretendard, Arial, sans-serif",
      }}
    >
      <div style={{ border: "3px solid #2563eb", minHeight: 1123 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: 170,
                  background: accent,
                  color: accentText,
                  borderBottom: border,
                  padding: "22px 16px",
                  textAlign: "center",
                  fontSize: 23,
                  fontWeight: 950,
                }}
              >
                (주) 광고인
              </td>
              <td
                style={{
                  background: accent,
                  color: accentText,
                  borderBottom: border,
                  padding: "22px 16px",
                  textAlign: "center",
                  fontSize: 28,
                  fontWeight: 950,
                  letterSpacing: "0.12em",
                }}
              >
                {title}
              </td>
              <td style={{ width: 250, padding: 0, borderBottom: border }}>
                <table
                  style={{
                    width: "100%",
                    height: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={label}>문서번호</td>
                      <td style={value}>{fieldValue(form.documentNo)}</td>
                    </tr>
                    <tr>
                      <td style={label}>페이지번호</td>
                      <td style={value}>{fieldValue(form.pageNo)}</td>
                    </tr>
                    <tr>
                      <td style={label}>작성자</td>
                      <td style={value}>{requester}</td>
                    </tr>
                    <tr>
                      <td style={label}>작성일자</td>
                      <td style={value}>{documentDate}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 390px",
            borderBottom: border,
          }}
        >
          <div
            style={{
              minHeight: 150,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 28,
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.7,
            }}
          >
            아래와 같이 {title}를 제출합니다.
          </div>
          <div style={{ padding: 18 }}>
            <ApprovalLineTable />
          </div>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: 13,
          }}
        >
          <tbody>
            <tr>
              <td style={label}>성명</td>
              <td style={value}>{requester}</td>
              <td style={label}>부서</td>
              <td style={value}>{fieldValue(form.department)}</td>
            </tr>
            <tr>
              <td style={label}>결제안건</td>
              <td style={value}>{fieldValue(form.subject)}</td>
              <td style={label}>요청일</td>
              <td style={value}>{documentDate}</td>
            </tr>
            <tr>
              <td style={label}>{paymentLabel}</td>
              <td style={value}>{amount}원</td>
              <td style={label}>담당자</td>
              <td style={value}>{requester}</td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            padding: "14px 28px 8px",
            fontSize: 15,
            fontWeight: 950,
            color: "#111827",
          }}
        >
          ■ 요청내역
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: 13,
          }}
        >
          <tbody>
            <tr>
              <td style={label}>
                {form.requestType === "페이백요청서" ? "광고현장" : "상품명"}
              </td>
              <td style={label}>
                {form.requestType === "페이백요청서" ? "광고주" : "결제처"}
              </td>
              <td style={{ ...label, width: 80 }}>수량</td>
              <td style={label}>기준금액</td>
              <td style={label}>{paymentLabel}</td>
            </tr>
            <tr>
              <td style={{ ...value, height: 96, textAlign: "center" }}>
                {fieldValue(form.itemName)}
              </td>
              <td style={{ ...value, textAlign: "center" }}>
                {fieldValue(form.vendor)}
              </td>
              <td style={{ ...value, textAlign: "center" }}>
                {fieldValue(form.quantity)}
              </td>
              <td style={{ ...value, textAlign: "center" }}>
                {fieldValue(form.unitPrice)}
              </td>
              <td style={{ ...value, textAlign: "center" }}>{amount}</td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            padding: "14px 28px 8px",
            fontSize: 15,
            fontWeight: 950,
            color: "#111827",
          }}
        >
          ■ {reasonLabel}
        </div>
        <div
          style={{
            minHeight: 245,
            borderTop: dotted,
            borderBottom: dotted,
            padding: "28px",
            whiteSpace: "pre-wrap",
            color: "#111827",
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.85,
          }}
        >
          {fieldValue(form.reason)}
        </div>

        <div
          style={{
            padding: "14px 28px 8px",
            fontSize: 15,
            fontWeight: 950,
            color: "#111827",
          }}
        >
          ■ 예금정보
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: 13,
          }}
        >
          <tbody>
            <tr>
              <td style={label}>은행명</td>
              <td style={value}>{fieldValue(form.bankName)}</td>
              <td style={label}>계좌번호</td>
              <td style={value}>{fieldValue(form.accountNumber)}</td>
            </tr>
            <tr>
              <td style={label}>예금주</td>
              <td style={value}>{fieldValue(form.accountHolder)}</td>
              <td style={label}>금액</td>
              <td style={value}>{amount}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ height: 54 }} />
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequestRow[]>([]);
  const [approvalActions, setApprovalActions] = useState<ApprovalActionRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequestRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("detail");

  const [showCreate, setShowCreate] = useState(false);
  const [showApprovalCreate, setShowApprovalCreate] = useState(false);
  const [approvalForm, setApprovalForm] =
    useState<ApprovalForm>(EMPTY_APPROVAL_FORM);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState("나에게 온");
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [me, setMe] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const inputClass =
    "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";
  const textareaClass =
    "min-h-[96px] w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] font-semibold outline-none";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const current = JSON.parse(raw);
        setMe(current.name || "");
        const adminNames = ["문시욱","김정후","김창완","최웅"];
        const role = String(current.role || "").toLowerCase();
        setIsAdmin(role === "admin" || adminNames.includes(current.name || ""));
        setApprovalForm((prev) => ({
          ...prev,
          writer: current.name || "",
          department:
            current.role === "ops"
              ? "운영파트"
              : current.role === "exec"
                ? "실행파트"
                : "관리자",
        }));
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [tasksRes, approvalsRes, actionsRes, commentsRes, membersRes] = await Promise.all(
      [
        supabase
          .from("tasks")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("approval_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("approval_actions")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("task_comments")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("contacts")
          .select("id,name,title,bunyanghoe_number,meeting_result")
          .in("meeting_result", ["계약완료", "예약완료"])
          .order("bunyanghoe_number", { ascending: true }),
      ],
    );

    if (tasksRes.error) console.error("tasks:", tasksRes.error.message);
    if (approvalsRes.error)
      console.error("approval_requests:", approvalsRes.error.message);
    if (actionsRes.error)
      console.error("approval_actions:", actionsRes.error.message);
    if (commentsRes.error)
      console.error("task_comments:", commentsRes.error.message);

    setTasks((tasksRes.data || []) as unknown as TaskRow[]);
    setApprovals((approvalsRes.data || []) as unknown as ApprovalRequestRow[]);
    setApprovalActions((actionsRes.data || []) as unknown as ApprovalActionRow[]);
    setComments((commentsRes.data || []) as CommentRow[]);
    setMembers((membersRes.data || []) as unknown as MemberRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("tasks-page-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_requests" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_actions" },
        () => loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const taskComments = useCallback(
    (taskId: number) =>
      comments.filter((comment) => comment.task_id === taskId),
    [comments],
  );

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return members;

    return members.filter((member) =>
      [member.name, member.title, member.bunyanghoe_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [members, memberSearch]);

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (
        tab === "나에게 온" &&
        !(task.assignee === me || task.tagged?.includes(me))
      )
        return false;
      if (tab === "내가 요청한" && task.requester !== me) return false;
      if (tab === "미완료" && task.status === "완료") return false;
      if (tab === "완료" && task.status !== "완료") return false;

      const matchSearch =
        !keyword ||
        [
          task.category,
          task.content,
          task.requester,
          task.assignee,
          ...(task.tagged || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchStatus = !fStatus || task.status === fStatus;
      const matchPriority = !fPriority || task.priority === fPriority;
      const matchCategory = !fCategory || task.category === fCategory;
      const matchAssignee = !fAssignee || task.assignee === fAssignee;

      return (
        matchSearch &&
        matchStatus &&
        matchPriority &&
        matchCategory &&
        matchAssignee
      );
    });
  }, [tasks, tab, me, search, fStatus, fPriority, fCategory, fAssignee]);

  const filteredApprovals = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return approvals.filter((request) => {
      const visibleToMe =
        request.requester_name === me ||
        request.reference_name === me ||
        request.current_approver_name === me ||
        request.team_lead_name === me ||
        request.head_name === me ||
        request.ceo_name === me;

      if (
        tab === "나에게 온" &&
        !(request.reference_name === me || request.current_approver_name === me)
      )
        return false;
      if (tab === "내가 요청한" && request.requester_name !== me) return false;
      if (tab === "미완료" && (request.status === "완료" || request.status === "반려")) return false;
      if (tab === "완료" && request.status !== "완료") return false;
      if (
        tab === "전체" &&
        !visibleToMe &&
        !["최웅", "김창완", "김정후", "문시욱"].includes(me)
      )
        return false;

      const payload = (request.payload || {}) as Partial<ApprovalForm>;
      const matchSearch =
        !keyword ||
        [
          request.request_type,
          request.request_group,
          request.requester_name,
          request.reference_name,
          request.current_approver_name,
          request.team_lead_name,
          payload.subject,
          payload.itemName,
          payload.reason,
          payload.leaveReason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchStatus = !fStatus || request.status === fStatus;
      const matchCategory =
        !fCategory ||
        request.request_group === fCategory ||
        request.request_type === fCategory;
      const matchAssignee =
        !fAssignee ||
        [
          request.current_approver_name,
          request.reference_name,
          request.team_lead_name,
          request.head_name,
          request.ceo_name,
        ].includes(fAssignee);

      return matchSearch && matchStatus && matchCategory && matchAssignee;
    });
  }, [approvals, tab, me, search, fStatus, fCategory, fAssignee]);

  const stats = useMemo(() => {
    const approvalInbox = approvals.filter(
      (request) =>
        request.reference_name === me || request.current_approver_name === me,
    ).length;
    const approvalRequested = approvals.filter(
      (request) => request.requester_name === me,
    ).length;
    const approvalPending = approvals.filter(
      (request) => request.status !== "완료" && request.status !== "반려",
    ).length;
    const approvalDone = approvals.filter(
      (request) => request.status === "완료",
    ).length;

    return {
      total: tasks.length + approvals.length,
      mine:
        tasks.filter(
          (task) => task.assignee === me || task.tagged?.includes(me),
        ).length + approvalInbox,
      requested:
        tasks.filter((task) => task.requester === me).length +
        approvalRequested,
      pending:
        tasks.filter((task) => task.status !== "완료").length + approvalPending,
      done:
        tasks.filter((task) => task.status === "완료").length + approvalDone,
    };
  }, [tasks, approvals, me]);

  const statusCounts = useMemo(() => {
    const result: Record<string, number> = {};
    STATUSES.forEach((status) => {
      result[status] = filteredTasks.filter(
        (task) => (task.status || "요청") === status,
      ).length;
    });
    return result;
  }, [filteredTasks]);

  const activeFilters = [
    search,
    fStatus,
    fPriority,
    fCategory,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setFStatus("");
    setFPriority("");
    setFCategory("");
    setFAssignee("");
  };

  const toggleTag = (name: string) => {
    setForm((prev) => ({
      ...prev,
      tagged: prev.tagged.includes(name)
        ? prev.tagged.filter((item) => item !== name)
        : [...prev.tagged, name],
    }));
  };

  const resetCategory = (category: string) => {
    setForm({
      ...EMPTY_FORM,
      category,
      priority: form.priority || "보통",
      assignee: form.assignee,
      tagged: form.tagged,
    });
  };

  const handleCreate = async () => {
    if (!form.assignee) {
      alert("수신자를 선택하세요.");
      return;
    }

    const content = buildContent(form);

    if (!content.trim()) {
      alert("요청 내용을 입력하세요.");
      return;
    }

    const fileUrls: string[] = [];
    const fileNames: string[] = [];

    for (const file of files) {
      const safeKey = safeTaskKey(file.name);
      const { error } = await supabase.storage
        .from("task-files")
        .upload(safeKey, file, { upsert: true, contentType: file.type || undefined });
      if (!error) { fileUrls.push(safeKey); fileNames.push(file.name); }
    }

    const insertData: Record<string, any> = {
      category: form.category,
      content,
      priority: form.priority,
      assignee: form.assignee,
      requester: me,
      status: "요청",
      tagged: form.tagged.length > 0 ? form.tagged : null,
      file_urls: fileUrls.length > 0 ? fileUrls : null,
      file_names: fileNames.length > 0 ? fileNames : null,
    };
    // file_names 컬럼이 아직 없을 수 있으므로 실패 시 제외하고 재시도
    let insertRes = await supabase.from("tasks").insert(insertData);
    if (insertRes.error && /file_names|column/i.test(insertRes.error.message || "")) {
      const { file_names: _fn, ...fallback } = insertData;
      insertRes = await supabase.from("tasks").insert(fallback);
    }
    const error = insertRes.error;

    if (error) {
      alert(`생성 실패: ${error.message}`);
      return;
    }

    // ── 저장된 task id 조회 ──
    let savedTaskId: number | null = null;
    try {
      const { data: latestTask } = await supabase
        .from("tasks")
        .select("id")
        .eq("requester", me)
        .eq("category", form.category)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      savedTaskId = (latestTask as any)?.id || null;
    } catch {}

    // ── 카카오워크 업무요청 알림 발송 + message_id 저장 ──
    try {
      const kakaoRes = await fetch("/api/kakaowork/send-task-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: me,
          assignee: form.assignee,
          category: form.category,
          content,
          priority: form.priority,
          task_id: savedTaskId,
        }),
      });
      const kakaoData = await kakaoRes.json();
      // 카카오워크 message_id를 tasks 테이블에 저장 (답글용)
      if (kakaoData?.kakao_message_id && savedTaskId) {
        await supabase.from("tasks").update({
          kakao_message_id: String(kakaoData.kakao_message_id),
        }).eq("id", savedTaskId);
      }
    } catch (kakaoErr) {
      console.warn("카카오워크 업무요청 알림 실패 (무시):", kakaoErr);
    }

    setForm(EMPTY_FORM);
    setFiles([]);
    setShowCreate(false);
    loadData();
  };

  const handleCreateApproval = async () => {
    const requesterName = approvalForm.writer || me;
    const requestType = approvalForm.requestType;

    if (!requesterName) {
      alert("로그인 사용자 정보를 확인할 수 없습니다.");
      return;
    }

    if (PAYMENT_TYPES.includes(requestType) && !approvalForm.subject.trim()) {
      alert("결제/정산 요청의 안건을 입력하세요.");
      return;
    }

    if (LEAVE_TYPES.includes(requestType) && !approvalForm.leaveStartDate) {
      alert("연차/반차 신청일을 입력하세요.");
      return;
    }

    const line = getApprovalLine(requestType, requesterName);
    const currentApprover = getCurrentApprover(requestType);
    const payload = {
      ...approvalForm,
      writer: requesterName,
      writerTitle: getMemberTitle(requesterName),
      approvalLine: line,
    };

    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        request_type: requestType,
        request_group: getApprovalGroup(requestType),
        requester_name: requesterName,
        requester_title: getMemberTitle(requesterName),
        reference_name: APPROVAL_OFFICERS.reference,
        team_lead_name: APPROVAL_OFFICERS.teamLead,
        head_name: LEAVE_TYPES.includes(requestType)
          ? null
          : APPROVAL_OFFICERS.head,
        ceo_name: null,
        current_approver_name: currentApprover,
        status: "진행중",
        payload,
        approval_line: line,
      })
      .select("id")
      .single();

    if (error) {
      alert(`결제요청 저장 실패: ${error.message}`);
      return;
    }

    const requestId = data?.id;
    if (requestId) {
      await supabase.from("approval_actions").insert({
        approval_request_id: requestId,
        actor_name: requesterName,
        action: "제출",
        comment: `${requestType} 요청을 제출했습니다.`,
      });

      await supabase.from("notifications").insert([
        {
          assignee_name: APPROVAL_OFFICERS.reference,
          title: `${requesterName}님의 ${requestType} 요청`,
          message: `${requestType} 참조 확인이 필요합니다. 실제 승인권자는 ${currentApprover}입니다.`,
          source_type: "결제요청",
          source_id: requestId,
          is_read: false,
        },
        {
          assignee_name: currentApprover,
          title: `${requesterName}님의 ${requestType} 승인 요청`,
          message: `${requestType} 승인 처리가 필요합니다.`,
          source_type: "결제요청",
          source_id: requestId,
          is_read: false,
        },
      ]);
    }

    // ── 카카오워크 결제요청 알림 발송 ──
    if (requestId) {
      const approvalPayload = (await supabase
        .from("approval_requests")
        .select("*")
        .eq("id", requestId)
        .single()).data;
      if (approvalPayload) {
        try {
          await fetch("/api/kakaowork/send-approval-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request_id: requestId,
              request_type: requestType,
              requester_name: requesterName,
              current_approver: currentApprover,
              reference_name: APPROVAL_OFFICERS.reference,
              payload: { ...approvalForm },
            }),
          });
        } catch {}
      }
    }

    setApprovalForm({
      ...EMPTY_APPROVAL_FORM,
      writer: requesterName,
      department: approvalForm.department,
    });
    setShowApprovalCreate(false);
    alert("결제요청이 저장되었습니다. 카카오워크로 승인 요청 알림이 발송됩니다.");
  };

  const notifyApprovalTarget = async (
    requestId: number,
    targetName: string | null | undefined,
    title: string,
    message: string,
  ) => {
    if (!targetName) return;
    await supabase.from("notifications").insert({
      assignee_name: targetName,
      title,
      message,
      source_type: "결제요청",
      source_id: requestId,
      is_read: false,
    });
  };

  const nextApproverAfter = (request: ApprovalRequestRow) => {
    const current = request.current_approver_name;
    if (current === request.team_lead_name && request.head_name)
      return request.head_name;
    // 본부장이 마지막 결재자
    return null;
  };

  const handleApprovalAction = async (
    request: ApprovalRequestRow,
    action: "승인" | "반려",
  ) => {
    const currentApprover = effectiveCurrentApprover(request);
    if (currentApprover !== me) {
      alert("현재 승인권자만 처리할 수 있습니다. 참조자는 승인/반려 권한이 없습니다.");
      return;
    }

    const normalizedRequest = { ...request, current_approver_name: currentApprover };
    const nextApprover = action === "승인" ? nextApproverAfter(normalizedRequest) : null;
    const nextStatus =
      action === "반려" ? "반려" : nextApprover ? "진행중" : "완료";

    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: nextStatus,
        current_approver_name: nextApprover,

      })
      .eq("id", request.id);

    if (error) {
      alert(`결재 처리 실패: ${error.message}`);
      return;
    }

    await supabase.from("approval_actions").insert({
      approval_request_id: request.id,
      actor_name: me,
      action: action,
      comment: `${me}님이 ${action} 처리했습니다.`,
    });

    if (action === "승인" && nextApprover) {
      await notifyApprovalTarget(
        request.id,
        nextApprover,
        `${request.requester_name}님의 ${request.request_type} 요청`,
        `${me}님 승인 완료. 다음 결재 확인이 필요합니다.`,
      );
    }

    if (action === "승인" && !nextApprover) {
      await notifyApprovalTarget(
        request.id,
        request.requester_name,
        `${request.request_type} 결재 완료`,
        `${request.request_type} 요청이 최종 승인되었습니다.`,
      );
      await notifyApprovalTarget(
        request.id,
        request.reference_name,
        `${request.request_type} 결재 완료`,
        `${request.requester_name}님의 요청이 최종 승인되었습니다.`,
      );
    }

    if (action === "반려") {
      await notifyApprovalTarget(
        request.id,
        request.requester_name,
        `${request.request_type} 반려`,
        `${me}님이 요청을 반려했습니다.`,
      );
      await notifyApprovalTarget(
        request.id,
        request.reference_name,
        `${request.request_type} 반려`,
        `${request.requester_name}님의 요청이 반려되었습니다.`,
      );
    }

    // ── 카카오워크 승인/반려 결과 알림 ──
    try {
      await fetch("/api/kakaowork/send-approval-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          request_type: request.request_type,
          requester_name: request.requester_name,
          current_approver: action === "승인" ? nextApprover : null,
          reference_name: request.reference_name,
          action,
          actor: me,
          is_final: action === "승인" && !nextApprover,
          payload: request.payload || {},
        }),
      });
    } catch {}

    loadData();
  };

  const handleStatus = async (task: TaskRow, status: string) => {
    await supabase
      .from("tasks")
      .update({
        status,
        completed_at: status === "완료" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    await supabase
      .from("task_comments")
      .insert({
        task_id: task.id,
        author: me,
        content: `상태를 '${status}'(으)로 변경했습니다.`,
        comment_type: "상태변경",
      });

    // ── 접수 시 요청자에게 워크봇 답글 알림 ──
    if (status === "접수" || status === "보류") {
      try {
        // 고객명 추출 (content 첫 줄에서)
        const contentLines = String(task.content || "").split("\n");
        const customerLine = contentLines.find((l) => l.includes("고객명:"));
        const customerName = customerLine ? customerLine.replace(/^.*고객명:\s*/, "").trim() : "";
        const categoryLine = contentLines[0] || task.category || "";

        // tasks에서 kakao_message_id 조회
        const { data: taskRow } = await supabase
          .from("tasks")
          .select("kakao_message_id")
          .eq("id", task.id)
          .single();
        const kakaoMsgId = (taskRow as any)?.kakao_message_id || null;

        await fetch("/api/kakaowork/send-task-status-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: task.id,
            status,
            assignee: me,
            requester: task.requester || "",
            category: task.category || "",
            customer_name: customerName,
            kakao_message_id: kakaoMsgId,
          }),
        });
      } catch (err) {
        console.warn("카카오워크 상태변경 알림 실패:", err);
      }
    }

    setSelectedTask({
      ...task,
      status,
      completed_at: status === "완료" ? new Date().toISOString() : null,
    });
    loadData();
  };

  const handleComment = async (task: TaskRow, text: string) => {
    await supabase
      .from("task_comments")
      .insert({
        task_id: task.id,
        author: me,
        content: text,
        comment_type: "코멘트",
      });
    loadData();
  };

  const handleDelete = async (task: TaskRow) => {
    const statusLabel = task.status && !["완료","취소"].includes(task.status) ? `⚠ "${task.status}" 상태입니다. ` : "";
    if (
      !confirm(
        `${statusLabel}이 업무를 삭제하시겠습니까?\n관련 코멘트와 첨부파일도 함께 정리됩니다.`,
      )
    )
      return;

    if (task.file_urls?.length)
      await supabase.storage.from("task-files").remove(task.file_urls);

    await supabase.from("task_comments").delete().eq("task_id", task.id);
    await supabase
      .from("notifications")
      .delete()
      .eq("source_type", "업무전달")
      .eq("source_id", task.id);
    await supabase.from("tasks").delete().eq("id", task.id);

    setSelectedTask(null);
    loadData();
  };

  const handleDeleteApproval = async (request: ApprovalRequestRow) => {
    const statusLabel = request.status === "진행중" ? "⚠ 진행 중인 요청서입니다. " : "";
    if (
      !confirm(
        `${statusLabel}"${request.request_type}" 요청서를 삭제하시겠습니까?\n삭제된 요청서는 복구할 수 없습니다.`,
      )
    )
      return;

    await supabase
      .from("approval_actions")
      .delete()
      .eq("approval_request_id", request.id);

    await supabase
      .from("approval_requests")
      .delete()
      .eq("id", request.id);

    setSelectedApproval(null);
    loadData();
  };

  const selectedComments = selectedTask ? taskComments(selectedTask.id) : [];

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} style={{ color: "var(--accent-text)" }} />
            <h1 className="crm-title">결제&업무요청</h1>
          </div>
          <p className="crm-subtitle mt-1">
            요청, 접수, 진행, 완료까지 업무요청과 결제/정산·근태 결재 흐름을 한
            화면에서 관리합니다.
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="btn-premium btn-secondary"
          >
            <RefreshCw size={14} />
            새로고침
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-premium btn-secondary"
          >
            <Plus size={14} />
            업무요청 생성
          </button>
          <button
            type="button"
            onClick={() => setShowApprovalCreate(true)}
            className="btn-premium btn-primary"
          >
            <FileText size={14} />
            결제요청 생성
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="stat-grid grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="전체 업무"
            value={stats.total}
            icon={FileText}
            tone={tab === "전체" ? "info" : "muted"}
            onClick={() => setTab("전체")}
          />
          <StatCard
            label="나에게 온"
            value={stats.mine}
            icon={User}
            tone={tab === "나에게 온" ? "purple" : "muted"}
            onClick={() => setTab("나에게 온")}
          />
          <StatCard
            label="내가 요청"
            value={stats.requested}
            icon={Send}
            tone={tab === "내가 요청한" ? "cyan" : "muted"}
            onClick={() => setTab("내가 요청한")}
          />
          <StatCard
            label="미완료"
            value={stats.pending}
            icon={AlertCircle}
            tone={tab === "미완료" ? "warning" : "muted"}
            onClick={() => setTab("미완료")}
          />
          <StatCard
            label="완료"
            value={stats.done}
            icon={CheckCircle2}
            tone={tab === "완료" ? "success" : "muted"}
            onClick={() => setTab("완료")}
          />
        </div>
      </div>

      <div className="flex flex-shrink-0 gap-0.5 overflow-x-auto px-5 md:px-7">
        {[
          { label: "전체", count: stats.total },
          { label: "나에게 온", count: stats.mine },
          { label: "내가 요청한", count: stats.requested },
          { label: "미완료", count: stats.pending },
          { label: "완료", count: stats.done },
        ].map((item) => {
          const active = tab === item.label;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setTab(item.label)}
              className="whitespace-nowrap border-b-2 px-3 py-3 text-[12px] font-bold"
              style={{
                color: active ? "var(--text)" : "var(--text-subtle)",
                borderBottomColor: active ? "var(--accent)" : "transparent",
              }}
            >
              {item.label}
              <span
                className="ml-1.5"
                style={{
                  color: active ? "var(--accent-text)" : "var(--text-faint)",
                }}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="premium-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <div className="relative w-full sm:w-[340px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-faint)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업무 내용, 요청자, 담당자 검색..."
            className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none"
          />
        </div>

        <SelectChip
          value={fStatus}
          onChange={setFStatus}
          options={STATUSES}
          placeholder="상태"
        />
        <SelectChip
          value={fPriority}
          onChange={setFPriority}
          options={PRIORITIES}
          placeholder="우선순위"
        />
        <SelectChip
          value={fCategory}
          onChange={setFCategory}
          options={CATEGORIES}
          placeholder="카테고리"
        />
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="btn-premium btn-danger h-8"
          >
            초기화
          </button>
        )}
        <span
          className="ml-auto hidden text-[12px] font-bold md:block"
          style={{ color: "var(--text-faint)" }}
        >
          {(filteredTasks.length + filteredApprovals.length).toLocaleString()}건
        </span>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: "var(--accent)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : filteredTasks.length + filteredApprovals.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="premium-card p-8">
              <EmptyState
                icon="📬"
                title="업무가 없습니다"
                description="검색어나 필터 조건을 변경하거나 결제/업무 요청을 생성해보세요"
                actionLabel="결제요청 생성"
                onAction={() => setShowApprovalCreate(true)}
              />
            </div>
          </div>
        ) : (
          <div className="grid h-full gap-5 xl:grid-cols-[1fr_280px]">
            <section className="min-h-0 overflow-y-auto">
              <div className="space-y-3">
                {filteredApprovals.map((request) => (
                  <ApprovalCard
                    key={`approval-${request.id}`}
                    request={request}
                    me={me}
                    onView={() => setSelectedApproval(request)}
                    onApprove={() => handleApprovalAction(request, "승인")}
                    onReject={() => handleApprovalAction(request, "반려")}
                    onDelete={() => handleDeleteApproval(request)}
                  />
                ))}

                {filteredTasks.map((task) => (
                  <TaskCard
                    key={`task-${task.id}`}
                    task={task}
                    selected={selectedTask?.id === task.id}
                    commentCount={taskComments(task.id).length}
                    onClick={() => {
                      setSelectedTask(task);
                      setDetailTab("detail");
                    }}
                    canDelete={task.requester === me || isAdmin}
                    onDelete={() => handleDelete(task)}
                  />
                ))}
              </div>
            </section>

            <aside className="hidden min-h-0 xl:block">
              <div className="premium-card sticky top-0 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={Filter} tone="info" />
                  <div>
                    <p className="crm-section-title">상태 요약</p>
                    <p className="crm-tiny">현재 필터 기준</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {STATUSES.map((status) => {
                    const Icon = statusIcon(status);
                    const c = toneStyle(statusTone(status));
                    return (
                      <div
                        key={status}
                        className="flex items-center gap-2 rounded-[12px] p-3"
                        style={{
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        <Icon size={15} style={{ color: c.color }} />
                        <span
                          className="text-[12px] font-bold"
                          style={{ color: c.color }}
                        >
                          {status}
                        </span>
                        <span
                          className="ml-auto text-[15px] font-[760]"
                          style={{ color: "var(--text-strong)" }}
                        >
                          {statusCounts[status] || 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {selectedTask && (
        <DetailSlidePanel
          task={selectedTask}
          comments={selectedComments}
          activeTab={detailTab}
          onTabChange={setDetailTab}
          me={me}
          onClose={() => setSelectedTask(null)}
          onStatus={(status) => handleStatus(selectedTask, status)}
          onComment={(text) => handleComment(selectedTask, text)}
          onDelete={() => handleDelete(selectedTask)}
        />
      )}

      {selectedApproval && (
        <ApprovalDetailSlidePanel
          request={selectedApproval}
          me={me}
          actions={approvalActions.filter((action) => action.approval_request_id === selectedApproval.id)}
          onClose={() => setSelectedApproval(null)}
          onApprove={() => handleApprovalAction(selectedApproval, "승인")}
          onReject={() => handleApprovalAction(selectedApproval, "반려")}
          onDelete={() => handleDeleteApproval(selectedApproval)}
        />
      )}

      {showApprovalCreate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="flex h-[96vh] w-full max-w-[1600px] overflow-hidden rounded-[24px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-2)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div
                className="flex items-center justify-between gap-3 px-6 py-4"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <div>
                  <p className="crm-title">결제요청 생성</p>
                  <p className="crm-subtitle mt-1">
                    왼쪽 양식 미리보기와 오른쪽 입력값이 실시간으로 연결됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApprovalCreate(false)}
                  className="btn-premium btn-secondary h-9 w-9 p-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden xl:grid-cols-[1.08fr_0.92fr]">
                <div
                  className="min-h-0 overflow-y-auto p-6"
                  style={{ background: "var(--surface-2)" }}
                >
                  <ApprovalPreview form={approvalForm} me={me} />
                </div>

                <div className="min-h-0 overflow-y-auto p-6">
                  <div className="space-y-5">
                    <section className="premium-card p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <InputLabel>요청 유형</InputLabel>
                          <select
                            className={inputClass}
                            value={approvalForm.requestType}
                            onChange={(e) =>
                              setApprovalForm({
                                ...approvalForm,
                                requestType: e.target.value as ApprovalType,
                              })
                            }
                          >
                            {APPROVAL_TYPES.map((group) => (
                              <optgroup key={group.group} label={group.group}>
                                {group.items.map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <InputLabel>작성일자</InputLabel>
                          <input
                            type="date"
                            className={inputClass}
                            value={approvalForm.requestDate}
                            onChange={(e) =>
                              setApprovalForm({
                                ...approvalForm,
                                requestDate: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <InputLabel>담당</InputLabel>
                          <input
                            className={inputClass}
                            value={approvalForm.writer || me}
                            readOnly
                          />
                        </div>
                        <div>
                          <InputLabel>부서</InputLabel>
                          <input
                            className={inputClass}
                            value={approvalForm.department}
                            onChange={(e) =>
                              setApprovalForm({
                                ...approvalForm,
                                department: e.target.value,
                              })
                            }
                            placeholder="실행파트 / 운영파트"
                          />
                        </div>
                      </div>
                    </section>

                    {PAYMENT_TYPES.includes(approvalForm.requestType) ? (
                      <section className="premium-card p-4">
                        <p
                          className="mb-4 text-[14px] font-[800]"
                          style={{ color: "var(--text)" }}
                        >
                          결제/정산 입력
                        </p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <InputLabel>안건 / 제목</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.subject}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  subject: e.target.value,
                                })
                              }
                              placeholder="예: 호갱노노 광고 결제 요청"
                            />
                          </div>
                          <div>
                            <InputLabel>상호명 / 상품명</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.itemName}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  itemName: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <InputLabel>결제처 / 광고주</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.vendor}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  vendor: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <InputLabel>수량</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.quantity}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  quantity: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <InputLabel>단가 / 기준금액</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.unitPrice}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  unitPrice: formatAmount(e.target.value),
                                })
                              }
                              placeholder="4,829,500"
                            />
                          </div>
                          <div>
                            <InputLabel>총금액 / 요청금액</InputLabel>
                            <input
                              className={inputClass}
                              value={
                                approvalForm.totalAmount || approvalForm.amount
                              }
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  totalAmount: formatAmount(e.target.value),
                                  amount: formatAmount(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <InputLabel>은행명</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.bankName}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  bankName: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <InputLabel>계좌번호</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.accountNumber}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  accountNumber: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <InputLabel>예금주</InputLabel>
                            <input
                              className={inputClass}
                              value={approvalForm.accountHolder}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  accountHolder: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="md:col-span-2">
                            <InputLabel>결제/환불/페이백 사유</InputLabel>
                            <textarea
                              className={textareaClass}
                              value={approvalForm.reason}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  reason: e.target.value,
                                })
                              }
                              placeholder="요청 사유를 입력하세요."
                            />
                          </div>
                        </div>
                      </section>
                    ) : (
                      <section className="premium-card p-4">
                        <p
                          className="mb-4 text-[14px] font-[800]"
                          style={{ color: "var(--text)" }}
                        >
                          연차/반차 입력
                        </p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <InputLabel>시작일</InputLabel>
                            <input
                              type="date"
                              className={inputClass}
                              value={approvalForm.leaveStartDate}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  leaveStartDate: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <InputLabel>종료일</InputLabel>
                            <input
                              type="date"
                              className={inputClass}
                              value={approvalForm.leaveEndDate}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  leaveEndDate: e.target.value,
                                })
                              }
                            />
                          </div>
                          {approvalForm.requestType === "반차" && (
                            <div className="md:col-span-2">
                              <InputLabel>반차 구분</InputLabel>
                              <select
                                className={inputClass}
                                value={approvalForm.halfDayType}
                                onChange={(e) =>
                                  setApprovalForm({
                                    ...approvalForm,
                                    halfDayType: e.target.value,
                                  })
                                }
                              >
                                <option>오전 반차</option>
                                <option>오후 반차</option>
                              </select>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <InputLabel>신청 사유</InputLabel>
                            <textarea
                              className={textareaClass}
                              value={approvalForm.leaveReason}
                              onChange={(e) =>
                                setApprovalForm({
                                  ...approvalForm,
                                  leaveReason: e.target.value,
                                })
                              }
                              placeholder="연차/반차 신청 사유를 입력하세요."
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    <section className="premium-card p-4">
                      <p
                        className="mb-4 text-[14px] font-[800]"
                        style={{ color: "var(--text)" }}
                      >
                        결재 라인
                      </p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                        {getApprovalLine(
                          approvalForm.requestType,
                          approvalForm.writer || me,
                        ).map((line) => (
                          <div
                            key={`${line.role}-${line.name}`}
                            className="rounded-[12px] border p-3 text-center"
                            style={{
                              borderColor: "var(--border)",
                              background: "var(--surface-2)",
                            }}
                          >
                            <p
                              className="text-[11px] font-bold"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {line.role}
                            </p>
                            <p
                              className="mt-1 text-[13px] font-[800]"
                              style={{ color: "var(--text)" }}
                            >
                              {line.name}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p
                        className="mt-3 text-[12px] font-semibold leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        연차/반차는 팀장 결재까지만 진행되며, 결제/환불/페이백은
                        본부장까지 결재 라인이 생성됩니다.
                      </p>
                    </section>
                  </div>
                </div>
              </div>

              <div
                className="flex justify-end gap-2 px-6 py-4"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
              >
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-premium btn-secondary"
                >
                  <Download size={14} />
                  출력
                </button>
                <button
                  type="button"
                  onClick={() => setShowApprovalCreate(false)}
                  className="btn-premium btn-secondary"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreateApproval}
                  className="btn-premium btn-primary"
                >
                  <Send size={14} />
                  저장 및 제출
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="crm-modal-overlay" onClick={() => setShowCreate(false)}>
          <div
            className="crm-modal flex max-w-3xl flex-col"
            onClick={(e) => e.stopPropagation()}
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
                onClick={() => setShowCreate(false)}
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
                    onChange={(e) =>
                      setForm({ ...form, assignee: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">선택</option>
                    {TEAM_GROUPS.map((group) => (
                      <optgroup key={group} label={`■ ${group}`}>
                        {TEAM.filter(
                          (member) =>
                            member.group === group && member.name !== me,
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
                    onChange={(e) => resetCategory(e.target.value)}
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
                      const c = toneStyle(priorityTone(priority));
                      return (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => setForm({ ...form, priority })}
                          className="h-9 rounded-[8px] border text-[13px] font-bold"
                          style={{
                            background: active ? c.bg : "var(--surface-2)",
                            borderColor: active ? c.border : "var(--border)",
                            color: active ? c.color : "var(--text-muted)",
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

              {form.category !== "일반 업무요청" &&
                form.category !== "호갱노노 광고요청" && (
                  <div>
                    <InputLabel>분양회 회원</InputLabel>
                    {form.member_name ? (
                      <div
                        className="flex items-center justify-between rounded-[12px] border px-4 py-3"
                        style={{
                          background: "var(--accent-subtle)",
                          borderColor: "var(--accent-border)",
                        }}
                      >
                        <span
                          className="text-[13px] font-bold"
                          style={{ color: "var(--accent-text)" }}
                        >
                          {form.member_number} {form.member_name}{" "}
                          {form.member_title}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              member_name: "",
                              member_number: "",
                              member_title: "",
                            })
                          }
                          className="text-[12px] font-bold"
                          style={{ color: "var(--danger-text)" }}
                        >
                          변경
                        </button>
                      </div>
                    ) : (
                      <div
                        className="overflow-hidden rounded-[12px] border"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="relative">
                          <Search
                            size={13}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: "var(--text-faint)" }}
                          />
                          <input
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="이름, 넘버링, 직급 검색..."
                            className="h-10 w-full border-0 border-b pl-9 pr-3 text-[13px] font-semibold outline-none"
                            style={{
                              borderBottomColor: "var(--border-subtle)",
                              background: "var(--surface)",
                              color: "var(--text)",
                            }}
                          />
                        </div>
                        <div className="max-h-[190px] overflow-y-auto">
                          {filteredMembers.slice(0, 30).map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                setForm({
                                  ...form,
                                  member_name: member.name || "",
                                  member_number: member.bunyanghoe_number || "",
                                  member_title: member.title || "",
                                });
                                setMemberSearch("");
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold"
                              style={{
                                borderBottom: "1px solid var(--border-subtle)",
                                color: "var(--text)",
                              }}
                            >
                              <span
                                className="w-14 font-bold"
                                style={{ color: "var(--accent-text)" }}
                              >
                                {member.bunyanghoe_number || "-"}
                              </span>
                              <span>{member.name}</span>
                              <span style={{ color: "var(--text-muted)" }}>
                                {member.title || ""}
                              </span>
                              <span className="ml-auto">
                                <Badge
                                  tone={
                                    member.meeting_result === "계약완료"
                                      ? "success"
                                      : "info"
                                  }
                                >
                                  {member.meeting_result || "-"}
                                </Badge>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* LMS 업무요청 */}
              {form.category === "LMS업무요청" && (
                <div className="premium-card space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><InputLabel>현장명</InputLabel><input className={inputClass} value={form.site_name} onChange={(e) => setForm({...form, site_name: e.target.value})} placeholder="현장명 입력" /></div>
                    <div><InputLabel>발송채널 (LMS)</InputLabel><select className={inputClass} value={form.platform} onChange={(e) => setForm({...form, platform: e.target.value})}><option value="">선택</option>{LMS_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div><InputLabel>조합여부</InputLabel><div className="flex gap-2">{["O","X"].map((v) => <button key={v} type="button" onClick={() => setForm({...form, combination: v})} className="h-9 flex-1 rounded-[8px] border text-[13px] font-bold" style={{background: form.combination===v?"var(--accent-bg)":"var(--surface-2)", borderColor: form.combination===v?"var(--accent-border)":"var(--border)", color: form.combination===v?"var(--accent-text)":"var(--text-muted)"}}>{v}</button>)}</div></div>
                    <div><InputLabel>발송일자</InputLabel><input type="date" className={inputClass} value={form.hope_date} onChange={(e) => setForm({...form, hope_date: e.target.value})} /></div>
                    <div><InputLabel>발송시각</InputLabel><input type="time" className={inputClass} value={form.hope_time} onChange={(e) => setForm({...form, hope_time: e.target.value})} /></div>
                    <div><InputLabel>발송건수</InputLabel><input className={inputClass} value={form.send_count} onChange={(e) => setForm({...form, send_count: e.target.value})} placeholder="00,000" /></div>
                    <div><InputLabel>타겟연령</InputLabel><input className={inputClass} value={form.age_range} onChange={(e) => setForm({...form, age_range: e.target.value})} placeholder="30~60" /></div>
                    <div><InputLabel>착신번호 (대표번호)</InputLabel><input className={inputClass} value={form.rep_number || ""} onChange={(e) => setForm({...form, rep_number: e.target.value})} placeholder="000-0000-0000" /></div>
                    <div><InputLabel>발송도메인</InputLabel><input className={inputClass} value={form.domain} onChange={(e) => setForm({...form, domain: e.target.value})} placeholder="없으면 X" /></div>
                  </div>
                  <div><InputLabel>타겟지역</InputLabel><div className="grid grid-cols-3 gap-2"><input className={inputClass} value={form.region1} onChange={(e) => setForm({...form, region1: e.target.value})} placeholder="① 지역" /><input className={inputClass} value={form.region2} onChange={(e) => setForm({...form, region2: e.target.value})} placeholder="② 지역" /><input className={inputClass} value={form.region3} onChange={(e) => setForm({...form, region3: e.target.value})} placeholder="③ 지역" /></div></div>
                  <div><InputLabel>스크립트</InputLabel><div className="flex gap-2 mb-2">{["O","X","스크립트요청"].map((v) => <button key={v} type="button" onClick={() => setForm({...form, script: v})} className="h-9 rounded-[8px] border px-3 text-[13px] font-bold" style={{background: form.script===v?"var(--accent-bg)":"var(--surface-2)", borderColor: form.script===v?"var(--accent-border)":"var(--border)", color: form.script===v?"var(--accent-text)":"var(--text-muted)"}}>{v}</button>)}</div>{form.script === "O" && <textarea className={textareaClass} value={form.script_text} onChange={(e) => setForm({...form, script_text: e.target.value})} placeholder="스크립트 내용" rows={5} />}</div>
                </div>
              )}
              {/* 호갱노노(직방) 채널톡 */}
              {form.category === "호갱노노(직방)_채널톡" && (
                <div className="premium-card space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><InputLabel>현장명</InputLabel><input className={inputClass} value={form.site_name} onChange={(e) => setForm({...form, site_name: e.target.value})} /></div>
                    <div><InputLabel>테스트번호</InputLabel><input className={inputClass} value={form.test_number} onChange={(e) => setForm({...form, test_number: formatPhoneAuto(e.target.value)})} placeholder="010-0000-0000" maxLength={13} /></div>
                    <div><InputLabel>착신번호 (대표번호)</InputLabel><input className={inputClass} value={form.rep_number || ""} onChange={(e) => setForm({...form, rep_number: e.target.value})} placeholder="000-0000-0000" /></div>
                    <div><InputLabel>발송채널</InputLabel><select className={inputClass} value={form.platform} onChange={(e) => setForm({...form, platform: e.target.value})}><option value="">선택</option>{HOGAENG_CHANNEL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div><InputLabel>조합여부</InputLabel><div className="flex gap-2">{["O","X"].map((v) => <button key={v} type="button" onClick={() => setForm({...form, combination: v})} className="h-9 flex-1 rounded-[8px] border text-[13px] font-bold" style={{background: form.combination===v?"var(--accent-bg)":"var(--surface-2)", borderColor: form.combination===v?"var(--accent-border)":"var(--border)", color: form.combination===v?"var(--accent-text)":"var(--text-muted)"}}>{v}</button>)}</div></div>
                    <div><InputLabel>발송일자</InputLabel><input type="date" className={inputClass} value={form.hope_date} onChange={(e) => setForm({...form, hope_date: e.target.value})} /></div>
                    <div><InputLabel>발송시각</InputLabel><input type="time" className={inputClass} value={form.hope_time} onChange={(e) => setForm({...form, hope_time: e.target.value})} /></div>
                    <div><InputLabel>발송건수</InputLabel><input className={inputClass} value={form.send_count} onChange={(e) => setForm({...form, send_count: e.target.value})} placeholder="00,000" /></div>
                    <div><InputLabel>타겟연령</InputLabel><input className={inputClass} value={form.age_range} onChange={(e) => setForm({...form, age_range: e.target.value})} placeholder="30~60" /></div>
                    <div><InputLabel>카카오톡 메시지유형</InputLabel><select className={inputClass} value={form.kakao_type} onChange={(e) => setForm({...form, kakao_type: e.target.value})}><option value="">선택</option>{KAKAO_MESSAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><InputLabel>이미지 템플릿</InputLabel><select className={inputClass} value={form.image_template} onChange={(e) => setForm({...form, image_template: e.target.value})}><option value="">선택</option>{IMAGE_TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><InputLabel>발송도메인</InputLabel><input className={inputClass} value={form.domain} onChange={(e) => setForm({...form, domain: e.target.value})} placeholder="없으면 X" /></div>
                    <div><InputLabel>쿠폰여부</InputLabel><div className="flex gap-2">{["O","X"].map((v) => <button key={v} type="button" onClick={() => setForm({...form, coupon: v})} className="h-9 flex-1 rounded-[8px] border text-[13px] font-bold" style={{background: form.coupon===v?"var(--accent-bg)":"var(--surface-2)", borderColor: form.coupon===v?"var(--accent-border)":"var(--border)", color: form.coupon===v?"var(--accent-text)":"var(--text-muted)"}}>{v}</button>)}{form.coupon==="O" && <input className={inputClass} value={form.coupon_text} onChange={(e) => setForm({...form, coupon_text: e.target.value})} placeholder="쿠폰 내용" />}</div></div>
                  </div>
                  <div><InputLabel>타겟지역</InputLabel><div className="grid grid-cols-3 gap-2"><input className={inputClass} value={form.region1} onChange={(e) => setForm({...form, region1: e.target.value})} placeholder="① 지역" /><input className={inputClass} value={form.region2} onChange={(e) => setForm({...form, region2: e.target.value})} placeholder="② 지역" /><input className={inputClass} value={form.region3} onChange={(e) => setForm({...form, region3: e.target.value})} placeholder="③ 지역" /></div></div>
                  <div><InputLabel>CTA 영역</InputLabel><div className="grid grid-cols-2 gap-2"><div><span className="text-[11px]" style={{color:"var(--text-subtle)"}}>왼쪽</span><input className={inputClass} value={form.cta_left} onChange={(e) => setForm({...form, cta_left: e.target.value})} /></div><div><span className="text-[11px]" style={{color:"var(--text-subtle)"}}>오른쪽</span><input className={inputClass} value={form.cta_right} onChange={(e) => setForm({...form, cta_right: e.target.value})} /></div></div></div>
                  <div><InputLabel>스크립트</InputLabel><div className="flex gap-2 mb-2">{["O","X","스크립트요청"].map((v) => <button key={v} type="button" onClick={() => setForm({...form, script: v})} className="h-9 rounded-[8px] border px-3 text-[13px] font-bold" style={{background: form.script===v?"var(--accent-bg)":"var(--surface-2)", borderColor: form.script===v?"var(--accent-border)":"var(--border)", color: form.script===v?"var(--accent-text)":"var(--text-muted)"}}>{v}</button>)}</div>{form.script === "O" && <textarea className={textareaClass} value={form.script_text} onChange={(e) => setForm({...form, script_text: e.target.value})} placeholder="스크립트 내용" rows={5} />}</div>
                </div>
              )}
              {/* 호갱노노(직방) 단지마커 */}
              {form.category === "호갱노노(직방)_단지마커" && (
                <div className="premium-card space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><InputLabel>광고주명</InputLabel><input className={inputClass} value={form.advertiser} onChange={(e) => setForm({...form, advertiser: e.target.value})} /></div>
                    <div><InputLabel>광고집행기간</InputLabel><select className={inputClass} value={form.ad_period} onChange={(e) => setForm({...form, ad_period: e.target.value, ad_date_range: calcAdDateRange(form.ad_start_date, e.target.value)})}><option value="">선택</option>{AD_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div><InputLabel>광고시작일</InputLabel><input type="date" className={inputClass} value={form.ad_start_date} onChange={(e) => setForm({...form, ad_start_date: e.target.value, ad_date_range: calcAdDateRange(e.target.value, form.ad_period)})} /></div>
                    <div><InputLabel>광고집행일자 (자동산출)</InputLabel><input className={inputClass} value={form.ad_date_range || calcAdDateRange(form.ad_start_date, form.ad_period)} readOnly style={{background:"var(--surface-2)", color:"var(--accent-text)", fontWeight:700}} /></div>
                    <div><InputLabel>분양단지 전화번호</InputLabel><input className={inputClass} value={form.site_phone} onChange={(e) => setForm({...form, site_phone: e.target.value})} /></div>
                    <div><InputLabel>분양단지 URL</InputLabel><input className={inputClass} value={form.site_url} onChange={(e) => setForm({...form, site_url: e.target.value})} placeholder="https://" /></div>
                  </div>
                  <div><InputLabel>메시지 텍스트</InputLabel><div className="space-y-2"><div className="flex items-center gap-2"><input className={inputClass} value={form.line1} onChange={(e) => e.target.value.length<=17 && setForm({...form, line1: e.target.value})} placeholder="1행 (최대 17자)" maxLength={17} /><span className="shrink-0 text-[12px] font-bold" style={{color:form.line1.length>14?"var(--danger-text)":"var(--text-subtle)",minWidth:36}}>{form.line1.length}/17</span></div><div className="flex items-center gap-2"><input className={inputClass} value={form.line2} onChange={(e) => e.target.value.length<=10 && setForm({...form, line2: e.target.value})} placeholder="2행 (최대 10자)" maxLength={10} /><span className="shrink-0 text-[12px] font-bold" style={{color:form.line2.length>8?"var(--danger-text)":"var(--text-subtle)",minWidth:36}}>{form.line2.length}/10</span></div><div className="flex items-center gap-2"><input className={inputClass} value={form.line3} onChange={(e) => e.target.value.length<=15 && setForm({...form, line3: e.target.value})} placeholder="3행 (최대 15자)" maxLength={15} /><span className="shrink-0 text-[12px] font-bold" style={{color:form.line3.length>12?"var(--danger-text)":"var(--text-subtle)",minWidth:36}}>{form.line3.length}/15</span></div></div></div>
                  <div className="grid grid-cols-2 gap-4"><div><InputLabel>PSD 파일명</InputLabel><input className={inputClass} value={form.psd_file} onChange={(e) => setForm({...form, psd_file: e.target.value})} placeholder="없으면 공란" /></div><div><InputLabel>조감도 파일명</InputLabel><input className={inputClass} value={form.bird_file} onChange={(e) => setForm({...form, bird_file: e.target.value})} placeholder="PSD 없는 경우" /></div></div>
                  <p className="text-[11px]" style={{color:"var(--text-subtle)"}}>※ 파일은 하단 파일첨부를 통해 업로드해주세요.</p>
                </div>
              )}
              {(form.category === "일반 업무요청" ||
                form.category === "호갱노노(기타광고)") && (
                <div>
                  <InputLabel>상세 요청 내용</InputLabel>
                  <textarea
                    className={textareaClass}
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    placeholder="업무 요청 내용을 상세히 입력하세요."
                  />
                </div>
              )}

              <div>
                <InputLabel>파일첨부</InputLabel>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  onChange={(e) => { setFiles(Array.from(e.target.files || [])); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{ position:"fixed", top:"-9999px", left:"-9999px", opacity:0 }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
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
                        key={index}
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
                onClick={() => setShowCreate(false)}
                className="btn-premium btn-secondary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="btn-premium btn-primary"
              >
                <Send size={14} />
                요청 전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
