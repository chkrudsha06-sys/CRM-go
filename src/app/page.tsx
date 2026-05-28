"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

type Contact = {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  customer_type: string | null;
  tm_sensitivity: string | null;
  prospect_type: string | null;
  meeting_date: string | null;
  meeting_date_text: string | null;
  meeting_address: string | null;
  meeting_result: string | null;
  management_stage: string | null;
  assigned_to: string | null;
  consultant: string | null;
  memo: string | null;
  contract_date: string | null;
  reservation_date: string | null;
  intake_route: string | null;
  created_at: string;
  updated_at?: string | null;
  meeting_registered_at?: string | null;
};

type Task = {
  id: number;
  category: string | null;
  content: string | null;
  priority: string | null;
  assignee: string | null;
  requester: string | null;
  status: string | null;
  tagged: string[] | null;
  created_at: string;
  updated_at?: string | null;
};

type AdExecution = {
  id: number;
  member_name: string | null;
  execution_amount: number | null;
  vat_amount: number | null;
  refund_amount: number | null;
  channel: string | null;
  contract_route: string | null;
  payment_date: string | null;
  team_member: string | null;
  consultant: string | null;
  created_at: string;
  updated_at?: string | null;
};

type Note = {
  id: number;
  contact_id: number;
  content: string | null;
  created_at: string;
  updated_at?: string | null;
};

type NoteContact = Contact;

type UserInfo = {
  name?: string;
  role?: string;
};

const TODAY = new Date().toISOString().slice(0, 10);

const EXECUTION_PART_NAMES = ["조계현", "기여운", "최연전", "이세호"];

function normalizePersonName(value?: string | null) {
  return (value || "")
    .replace(/님|팀장|파트장|메인|어쏘|CX|어시|본부장|대표/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function isExecutionPartUser(user: UserInfo | null) {
  const userName = normalizePersonName(user?.name);
  const userRole = (user?.role || "").toLowerCase();

  return (
    EXECUTION_PART_NAMES.some((name) => normalizePersonName(name) === userName) ||
    userRole === "exec" ||
    userRole === "execution" ||
    userRole.includes("실행")
  );
}

function isOwnedByUser(contact: Pick<Contact, "assigned_to" | "consultant">, user: UserInfo | null) {
  const userName = normalizePersonName(user?.name);
  if (!userName) return false;

  return (
    normalizePersonName(contact.assigned_to) === userName ||
    normalizePersonName(contact.consultant) === userName
  );
}


const DEFAULT_WORKSPACE_HREFS = [
  "/contacts",
  "/pipeline",
  "/tasks",
  "/content-manage",
  "/sales",
  "/rewards",
];

const WORKSPACE_LINKS = [
  {
    title: "고객DB",
    desc: "고객 정보와 상담 히스토리",
    href: "/contacts",
    icon: Users,
    tone: "info",
  },
  {
    title: "고객등록",
    desc: "신규 고객 입력과 관리",
    href: "/customer-register",
    icon: UserCheck,
    tone: "cyan",
  },
  {
    title: "파이프라인",
    desc: "영업 단계와 다음 액션",
    href: "/pipeline",
    icon: Target,
    tone: "warning",
  },
  {
    title: "업무전달",
    desc: "요청과 처리 스레드",
    href: "/tasks",
    icon: MessageCircle,
    tone: "purple",
  },
  {
    title: "일별활동기록",
    desc: "목표와 결과 기록",
    href: "/daily-activity",
    icon: CheckCircle2,
    tone: "success",
  },
  {
    title: "완판트럭",
    desc: "촬영과 발주 관리",
    href: "/wanpan-truck",
    icon: PackageCheck,
    tone: "warning",
  },
  {
    title: "컨텐츠관리",
    desc: "PR패키지 제작 흐름",
    href: "/content-manage",
    icon: PackageCheck,
    tone: "success",
  },
  {
    title: "운영캘린더",
    desc: "미팅과 운영 일정",
    href: "/calendar",
    icon: CalendarDays,
    tone: "cyan",
  },
  {
    title: "매출관리",
    desc: "실매출과 집행 내역",
    href: "/sales",
    icon: CreditCard,
    tone: "cyan",
  },
  {
    title: "리워드",
    desc: "리워드와 마일리지",
    href: "/rewards",
    icon: Wallet,
    tone: "danger",
  },
  {
    title: "메모장",
    desc: "메모와 스프레드시트",
    href: "/memo",
    icon: FileText,
    tone: "purple",
  },
];

function formatFullDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );
  } catch {
    return value;
  }
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "ko-KR",
      {
        month: "2-digit",
        day: "2-digit",
      },
    );
  } catch {
    return value;
  }
}

function timeAgo(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 7) return `${day}일 전`;

  return formatShortDate(value);
}

function dateKey(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDateValue(value?: string | null, target = TODAY) {
  if (!value) return false;
  return value.slice(0, 10) === target;
}

const KOREA_PUBLIC_HOLIDAYS_2026 = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-03-02",
  "2026-05-05",
  "2026-05-25",
  "2026-06-03",
  "2026-06-06",
  "2026-07-17",
  "2026-08-17",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-10-05",
  "2026-10-09",
  "2026-12-25",
]);

function isWeekendOrHoliday(value = new Date()) {
  const day = value.getDay();
  return (
    day === 0 || day === 6 || KOREA_PUBLIC_HOLIDAYS_2026.has(dateKey(value))
  );
}

function meetingRegisteredAgo(contact: Contact) {
  return timeAgo(contact.meeting_registered_at || contact.updated_at || contact.created_at);
}

function money(value?: number | null) {
  const n = value || 0;

  if (!n) return "0원";
  if (n >= 100_000_000) {
    const v = n / 100_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}억`;
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`;

  return `${n.toLocaleString()}원`;
}

function effectiveSales(row: AdExecution) {
  const execution = row.execution_amount || 0;
  const vat = row.vat_amount || 0;
  const refund = row.refund_amount || 0;
  const base = vat && vat !== execution ? vat : execution;
  return Math.max(base - refund, 0);
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#8B7CF6,#60A5FA)",
    "linear-gradient(135deg,#60A5FA,#22D3EE)",
    "linear-gradient(135deg,#34D399,#22D3EE)",
    "linear-gradient(135deg,#FBBF24,#FB7185)",
    "linear-gradient(135deg,#C084FC,#8B7CF6)",
    "linear-gradient(135deg,#FB7185,#C084FC)",
  ];

  if (!name) return gradients[0];
  const idx =
    name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) %
    gradients.length;
  return gradients[idx];
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

function resultTone(value?: string | null) {
  if (value === "계약완료") return "success";
  if (value === "예약완료") return "purple";
  if (value === "미팅후가망관리") return "warning";
  if (value === "계약거부" || value === "미팅불발") return "danger";
  if (value === "서류만수취") return "info";
  return "muted";
}

function taskTone(value?: string | null) {
  if (value === "완료") return "success";
  if (value === "진행중") return "warning";
  if (value === "접수") return "cyan";
  if (value === "요청") return "info";
  return "muted";
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
      }}
    >
      <Icon size={size === "lg" ? 22 : size === "sm" ? 14 : 18} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
  href,
  sub,
  compact = false,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
  tone: string;
  href: string;
  sub?: string;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      className={`premium-card premium-card-hover flex flex-col justify-between ${compact ? "min-h-[92px] p-3" : "min-h-[104px] p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <PremiumIcon icon={icon} tone={tone} size={compact ? "sm" : "md"} />
        <ChevronRight size={14} style={{ color: "var(--text-faint)" }} />
      </div>

      <div className={compact ? "mt-3 min-w-0" : "mt-5 min-w-0"}>
        <p className="crm-tiny">{label}</p>
        <p
          className={`${compact ? "mt-1 text-[20px]" : "mt-1 text-[24px]"} font-[760] leading-none tracking-[-0.06em]`}
          style={{ color: "var(--text-strong)" }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="crm-meta mt-2 truncate">{sub}</p>}
      </div>
    </a>
  );
}

function WorkspaceLink({ item }: { item: (typeof WORKSPACE_LINKS)[number] }) {
  return (
    <a
      href={item.href}
      className="premium-card premium-card-hover group flex items-center gap-3 p-3"
    >
      <PremiumIcon icon={item.icon} tone={item.tone} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="crm-row-main truncate">{item.title}</p>
        <p className="crm-row-sub mt-0.5 truncate">{item.desc}</p>
      </div>
      <ArrowRight
        size={14}
        className="opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--text-subtle)" }}
      />
    </a>
  );
}

function ContactRow({
  contact,
  mode = "recent",
}: {
  contact: Contact;
  mode?: "recent" | "meeting";
}) {
  const rightLabel =
    mode === "meeting"
      ? meetingRegisteredAgo(contact)
      : timeAgo(contact.created_at);

  return (
    <a
      href="/contacts"
      className="flex items-center gap-3 rounded-[14px] p-3 transition-all hover:bg-white/[.035]"
    >
      <div
        className="crm-avatar"
        style={{ background: avatarBg(contact.name) }}
      >
        {contact.name?.[0] || "고"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="crm-row-main truncate">{contact.name}</p>
          <Badge tone={resultTone(contact.meeting_result)}>
            {contact.meeting_result || "미정"}
          </Badge>
        </div>
        <p className="crm-row-sub mt-0.5 truncate">
          {contact.title || "-"} · {contact.phone || "-"} · 담당{" "}
          {contact.assigned_to || "-"}
        </p>
      </div>

      <span className="crm-tiny flex-shrink-0">{rightLabel}</span>
    </a>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <a
      href="/tasks"
      className="flex gap-3 rounded-[14px] p-3 transition-all hover:bg-white/[.035]"
    >
      <PremiumIcon
        icon={MessageCircle}
        tone={taskTone(task.status)}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={taskTone(task.status)}>{task.status || "요청"}</Badge>
          <Badge tone="muted">{task.category || "업무"}</Badge>
          {task.priority && (
            <Badge
              tone={
                task.priority === "긴급"
                  ? "danger"
                  : task.priority === "높음"
                    ? "warning"
                    : "info"
              }
            >
              {task.priority}
            </Badge>
          )}
        </div>
        <p
          className="mt-2 line-clamp-2 text-[13px] font-semibold leading-relaxed"
          style={{ color: "var(--text)" }}
        >
          {task.content || "내용 없음"}
        </p>
        <p className="crm-row-sub mt-2 truncate">
          {task.requester || "-"} → {task.assignee || "-"} ·{" "}
          {timeAgo(task.created_at)}
        </p>
      </div>
    </a>
  );
}

function ActivityNote({
  note,
  contact,
}: {
  note: Note;
  contact?: NoteContact;
}) {
  const manager = contact?.assigned_to || contact?.consultant || "-";

  return (
    <a
      href="/contacts"
      className="flex gap-3 rounded-[14px] p-3 transition-all hover:bg-white/[.035]"
    >
      <PremiumIcon icon={Activity} tone="purple" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="crm-row-main truncate">
              {contact?.name || `고객 #${note.contact_id}`}
            </p>
            <p className="crm-row-sub mt-1 truncate">
              {contact?.title || "직급 정보 없음"} · 담당 {manager}
            </p>
          </div>
          <span className="crm-tiny flex-shrink-0 text-right">
            {timeAgo(note.created_at)}
          </span>
        </div>

        <p
          className="mt-2 line-clamp-2 text-[12.5px] font-medium leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {note.content || "활동노트 내용 없음"}
        </p>
      </div>
    </a>
  );
}

function getTimeBasedDashboardMessage(user?: UserInfo | null) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const isWednesday = now.getDay() === 3;
  const lunchEnd = isWednesday ? 14 * 60 : 13 * 60 + 30;

  const name = user?.name || "담당자";
  const role = user?.role || "shared";
  const honorificNameMap: Record<string, string> = {
    문시욱: "문시욱 대표님",
    김정후: "김정후 본부장님",
    김창완: "김창완 팀장님",
    최웅: "최웅 파트장님",
    조계현: "조계현 메인님",
    이세호: "이세호 어쏘님",
    기여운: "기여운 어쏘님",
    최연전: "최연전 CX님",
    김재영: "김재영 어시님",
    최은정: "최은정 어시님",
  };
  const isExec =
    role === "exec" || ["조계현", "이세호", "기여운", "최연전"].includes(name);
  const isOps = role === "ops" || ["최은정", "김재영"].includes(name);
  const isAdmin =
    role === "admin" || ["문시욱", "김정후", "김창완", "최웅"].includes(name);
  const displayName = honorificNameMap[name] || `${name}님`;

  if (isWeekendOrHoliday(now)) {
    const weekendMessages = [
      {
        title: `${displayName}, 쉬는 날에도 흐름을 놓치지 않는 당신을 진심으로 응원합니다.`,
        desc: "오늘은 잠시 속도를 낮춰도 괜찮은 날입니다. 그럼에도 고객과 팀을 생각하는 마음이 결국 더 단단한 결과로 이어질 거예요.",
      },
      {
        title: `${displayName}, 휴일에도 묵묵히 움직이는 그 마음을 응원합니다.`,
        desc: "쉬는 날의 작은 확인 하나가 다음 영업일의 큰 여유가 됩니다. 무리하지 말고 필요한 흐름만 가볍게 점검해 주세요.",
      },
      {
        title: `${displayName}, 쉬는 날에도 책임감을 잃지 않는 모습이 멋집니다.`,
        desc: "오늘의 노력은 조용하지만 분명히 쌓이고 있습니다. 잠깐의 휴식도 좋은 성과를 만드는 중요한 과정입니다.",
      },
    ];
    return weekendMessages[now.getDate() % weekendMessages.length];
  }

  const period =
    minutes >= 9 * 60 + 30 && minutes < 10 * 60
      ? "morningBrief"
      : minutes >= 10 * 60 && minutes < 12 * 60 + 30
        ? "morning"
        : minutes >= 12 * 60 + 30 && minutes < lunchEnd
          ? "lunch"
          : minutes >= lunchEnd && minutes < 18 * 60
            ? "afternoon"
            : minutes >= 18 * 60 && minutes < 18 * 60 + 30
              ? "closing"
              : "default";

  if (period === "lunch") {
    return {
      title: `${displayName}, 꿀같은 점심시간 잠시동안 업무를 내려놓고 휴식을 취할 시간입니다.`,
      desc: isWednesday
        ? "수요일 점심시간은 12:30부터 14:00까지입니다. 오후의 집중력을 위해 잠시 숨을 고르고 편안하게 재충전해 주세요."
        : "점심시간은 12:30부터 13:30까지입니다. 오전의 긴장을 내려놓고 오후의 흐름을 위해 편안하게 재충전해 주세요.",
    };
  }

  if (isAdmin) {
    const adminMessages: Record<string, { title: string; desc: string }> = {
      morningBrief: {
        title: `${displayName}, 오늘의 조직 흐름이 조용히 정렬되기 시작하는 시간입니다.`,
        desc: "숫자보다 먼저 사람과 흐름을 바라보고, 실행파트와 운영파트가 같은 방향으로 움직일 수 있는 하루의 기준을 확인해 주세요.",
      },
      morning: {
        title: `${displayName}, 오전에는 팀의 리듬과 고객 흐름을 넓게 바라볼 시간입니다.`,
        desc: "고객 유입, 미팅 예정, 파이프라인, 매출 흐름을 가볍게 점검하며 오늘 조직이 집중해야 할 방향을 읽어보세요.",
      },
      lunch: {
        title: `${displayName}, 잠시 속도를 낮추고 오후의 판단을 선명하게 준비할 시간입니다.`,
        desc: isWednesday
          ? "수요일은 점심시간이 14:00까지입니다. 여유 있는 호흡으로 오전 흐름을 정리하고 오후의 핵심 장면을 준비해 주세요."
          : "오전의 움직임을 가볍게 되돌아보고, 오후에는 어떤 고객과 어떤 의사결정이 중요할지 차분히 정리해 주세요.",
      },
      afternoon: {
        title: `${displayName}, 오후에는 결과로 이어질 가능성을 조용히 관찰할 시간입니다.`,
        desc: "실행파트의 고객 접점, 운영파트의 지원 흐름, 미팅 확정과 계약 가능성을 함께 보며 필요한 판단 포인트를 확인해 주세요.",
      },
      closing: {
        title: `${displayName}, 오늘의 흐름이 어떤 결과로 남았는지 정리할 시간입니다.`,
        desc: "고객, 업무, 매출, 미팅 흐름을 차분히 확인하고 내일 더 좋은 움직임으로 이어질 수 있는 단서를 남겨보세요.",
      },
      default: {
        title: `${displayName}, 오늘의 CRM 흐름을 한눈에 바라볼 수 있습니다.`,
        desc: "대시보드는 고객, 미팅, 업무, 매출의 핵심 지표를 조용히 정리해 조직의 현재 상태를 보여줍니다.",
      },
    };
    return adminMessages[period];
  }

  if (isOps) {
    const opsMessages: Record<string, { title: string; desc: string }> = {
      morningBrief: {
        title: `${displayName}, 오늘 회원 요청과 실행 지원 흐름을 먼저 정렬할 시간입니다.`,
        desc: "분양회 회원 요청사항, 컨텐츠 진행상태, 실행파트 지원 포인트를 확인하고 오늘 운영 우선순위를 잡아주세요.",
      },
      morning: {
        title: `${displayName}, 오전에는 회원 요청사항을 기반으로 운영 흐름을 안정화할 시간입니다.`,
        desc: "회원 요청, 컨텐츠 제작, 업무전달, 실행파트가 움직일 수 있는 계획과 전략을 먼저 정리해 주세요.",
      },
      lunch: {
        title: `${displayName}, 점심시간에는 오전 요청 처리 흐름과 오후 지원 계획을 점검하세요.`,
        desc: isWednesday
          ? "수요일은 점심시간이 14:00까지입니다. 오후 시작 전 회원 요청, 컨텐츠 제공 구성, 실행 지원 전략을 여유 있게 정리해 주세요."
          : "오후에 집중할 고객 요청사항과 실행파트 지원 포인트를 정리하면 업무 흐름이 더 가볍게 이어집니다.",
      },
      afternoon: {
        title: `${displayName}, 오후에는 고객 요청사항 관리와 프로세스 개선에 집중할 시간입니다.`,
        desc: "분양회 회원에게 제공될 구성, 실행파트의 전략적 움직임, 업무 간소화 포인트를 중심으로 운영 품질을 높여주세요.",
      },
      closing: {
        title: `${displayName}, 오늘 처리한 요청과 내일 이어질 운영 흐름을 정리할 시간입니다.`,
        desc: "완료된 요청, 진행 중인 컨텐츠, 실행파트 지원 필요사항을 확인하고 내일의 운영 기준을 남겨주세요.",
      },
      default: {
        title: `${displayName}, 오늘의 운영 흐름을 안정적으로 확인하세요.`,
        desc: "회원 요청, 컨텐츠 진행, 실행 지원, 업무전달 상태를 기준으로 운영파트의 현재 흐름을 확인할 수 있습니다.",
      },
    };
    return opsMessages[period];
  }

  if (isExec) {
    const execMessages: Record<string, { title: string; desc: string }> = {
      morningBrief: {
        title: `${displayName}, 아침조례 이후 오늘의 활동목표와 고객 우선순위를 정렬할 시간입니다.`,
        desc: "기 가입회원 관리, 오후 고객접점 강화 목표, 당일 활동목표를 기준으로 오늘의 움직임을 먼저 설계해 주세요.",
      },
      morning: {
        title: `${displayName}, 오전에는 기 가입회원 관리와 당일 활동목표 셋팅에 집중하세요.`,
        desc: "기존 회원의 요청과 관리 포인트를 확인하고, 오후 고객접점 강화를 위해 컨설턴트 DB·2차 접점·TM 목표를 명확히 잡아주세요.",
      },
      lunch: {
        title: `${displayName}, 점심시간에는 오전 관리 흐름을 정리하고 오후 접점 전략을 준비하세요.`,
        desc: isWednesday
          ? "수요일은 점심시간이 14:00까지입니다. 오후 신규고객 창출, 입회 대상자 컨택, 미팅 일정 확보 흐름을 차분히 준비해 주세요."
          : "오후에는 신규고객 창출과 입회 대상자 컨택이 중요합니다. 파이프라인과 미팅 가능 고객을 다시 확인해 주세요.",
      },
      afternoon: {
        title: `${displayName}, 오후에는 신규고객 창출과 분양회 입회 대상자 컨택에 집중할 시간입니다.`,
        desc: "분양회 회원 요청사항을 실행하고, 입회 대상자를 파이프라인 흐름대로 컨택해 미팅일정과 다음 액션을 만들어 주세요.",
      },
      closing: {
        title: `${displayName}, 일과 마무리 전 오늘의 접점과 결과를 기록할 시간입니다.`,
        desc: "신규 TM, 관리 TM, 2차 접점, 미팅 확정 결과를 정리하고 일별활동기록에 오늘의 결과를 남겨주세요.",
      },
      default: {
        title: `${displayName}, 오늘의 고객 흐름과 다음 액션을 확인하세요.`,
        desc: "기 가입회원 관리, 신규고객 창출, 파이프라인 컨택, 미팅 일정 확보 흐름을 기준으로 오늘의 실행 방향을 점검할 수 있습니다.",
      },
    };
    return execMessages[period];
  }

  return {
    title: `${displayName}, 오늘의 CRM 흐름을 한눈에 확인하세요.`,
    desc: "고객, 업무, 미팅, 매출 지표를 기준으로 현재 운영상태를 빠르게 확인할 수 있습니다.",
  };
}

export default function HomePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sales, setSales] = useState<AdExecution[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteContacts, setNoteContacts] = useState<NoteContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<UserInfo | null>(null);
  const [keyword, setKeyword] = useState("");
  const [workspaceEdit, setWorkspaceEdit] = useState(false);
  const [workspaceSelected, setWorkspaceSelected] = useState<string[]>(
    DEFAULT_WORKSPACE_HREFS,
  );

  const fetchDashboard = useCallback(async () => {
    setLoading(true);

    let user: UserInfo | null = null;

    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) user = JSON.parse(raw) as UserInfo;
    } catch {}

    setMe(user);

    const baseContactColumns =
      "id,name,title,phone,customer_type,tm_sensitivity,prospect_type,meeting_date,meeting_date_text,meeting_address,meeting_result,management_stage,assigned_to,consultant,memo,contract_date,reservation_date,intake_route,created_at";

    const shouldLimitToOwnCustomers = isExecutionPartUser(user);

    const buildContactQuery = (columns: string) => {
      return supabase
        .from("contacts")
        .select(columns)
        .order("created_at", { ascending: false })
        .limit(700);
    };

    const contactQuery = buildContactQuery(`${baseContactColumns},updated_at,meeting_registered_at`);

    const { start, end } = (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const last = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      return { start: first, end: last };
    })();

    let [contactRes, taskRes, salesRes, noteRes] = await Promise.all([
      contactQuery,
      supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("ad_executions")
        .select("*")
        .gte("payment_date", start)
        .lte("payment_date", end)
        .order("payment_date", { ascending: false })
        .limit(100),
      supabase
        .from("contact_notes")
        .select("id,contact_id,content,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (contactRes.error && contactRes.error.message.includes("meeting_registered_at")) {
      contactRes = await buildContactQuery(`${baseContactColumns},updated_at`);
    }

    if (contactRes.error && contactRes.error.message.includes("updated_at")) {
      contactRes = await buildContactQuery(baseContactColumns);
    }

    if (contactRes.error) console.error("contacts:", contactRes.error.message);
    if (taskRes.error) console.error("tasks:", taskRes.error.message);
    if (salesRes.error) console.error("ad_executions:", salesRes.error.message);
    if (noteRes.error) console.error("contact_notes:", noteRes.error.message);

    const allContactRows = ((contactRes.data || []) as unknown) as Contact[];
    const dashboardContacts = shouldLimitToOwnCustomers
      ? allContactRows.filter((contact) => isOwnedByUser(contact, user))
      : allContactRows;

    let noteRows = ((noteRes.data || []) as unknown) as Note[];

    if (shouldLimitToOwnCustomers) {
      const visibleContactIds = dashboardContacts
        .map((contact) => contact.id)
        .filter(Boolean);

      if (visibleContactIds.length > 0) {
        const ownNoteRes = await supabase
          .from("contact_notes")
          .select("id,contact_id,content,created_at")
          .in("contact_id", visibleContactIds)
          .order("created_at", { ascending: false })
          .limit(30);

        if (ownNoteRes.error) {
          console.error("own contact_notes:", ownNoteRes.error.message);
          const visibleIdSet = new Set(visibleContactIds.map((id) => String(id)));
          noteRows = noteRows.filter((note) =>
            visibleIdSet.has(String(note.contact_id)),
          );
        } else {
          noteRows = ((ownNoteRes.data || []) as unknown) as Note[];
        }
      } else {
        noteRows = [];
      }
    }

    const noteContactIds = Array.from(
      new Set(noteRows.map((note) => note.contact_id).filter(Boolean)),
    );
    let noteContactRows: NoteContact[] = [];

    if (noteContactIds.length > 0) {
      let noteContactRes: any = await supabase
        .from("contacts")
        .select(`${baseContactColumns},updated_at`)
        .in("id", noteContactIds);

      if (
        noteContactRes.error &&
        noteContactRes.error.message.includes("updated_at")
      ) {
        noteContactRes = await supabase
          .from("contacts")
          .select(baseContactColumns)
          .in("id", noteContactIds);
      }

      if (noteContactRes.error) {
        console.error("note contacts:", noteContactRes.error.message);
      } else {
        noteContactRows = ((noteContactRes.data || []) as unknown) as NoteContact[];
      }
    }

    if (shouldLimitToOwnCustomers) {
      noteContactRows = noteContactRows.filter((contact) =>
        isOwnedByUser(contact, user),
      );
      const allowedNoteContactIds = new Set(
        noteContactRows.map((contact) => String(contact.id)),
      );
      noteRows = noteRows.filter((note) =>
        allowedNoteContactIds.has(String(note.contact_id)),
      );
    }

    setContacts(dashboardContacts);
    setTasks(((taskRes.data || []) as unknown) as Task[]);
    setSales(((salesRes.data || []) as unknown) as AdExecution[]);
    setNotes(noteRows);
    setNoteContacts(noteContactRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm_dashboard_workspace_links");
      if (!saved) return;
      const parsed = JSON.parse(saved) as string[];
      const valid = parsed.filter((href) =>
        WORKSPACE_LINKS.some((item) => item.href === href),
      );
      if (valid.length > 0) setWorkspaceSelected(valid.slice(0, 8));
    } catch {
      // ignore invalid localStorage data
    }
  }, []);

  const toggleWorkspaceLink = (href: string) => {
    setWorkspaceSelected((prev) => {
      const next = prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href].slice(0, 8);
      localStorage.setItem(
        "crm_dashboard_workspace_links",
        JSON.stringify(next),
      );
      return next;
    });
  };

  const filteredContacts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return contacts;

    return contacts.filter((contact) =>
      [
        contact.name,
        contact.title,
        contact.phone,
        contact.memo,
        contact.assigned_to,
        contact.consultant,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [contacts, keyword]);

  const contactById = useMemo(() => {
    const map = new Map<string, NoteContact>();
    contacts.forEach((contact) => map.set(String(contact.id), contact));
    noteContacts.forEach((contact) => map.set(String(contact.id), contact));
    return map;
  }, [contacts, noteContacts]);

  const stats = useMemo(() => {
    const todayMeetings = contacts.filter((c) =>
      isSameDateValue(c.meeting_date),
    );
    const contracts = contacts.filter((c) => c.meeting_result === "계약완료");
    const reservations = contacts.filter(
      (c) => c.meeting_result === "예약완료",
    );
    const closing = contacts.filter(
      (c) =>
        c.management_stage === "딜크로징" || c.prospect_type === "즉가입가망",
    );
    const openTasks = tasks.filter((task) => task.status !== "완료");
    const myTasks = tasks.filter(
      (task) =>
        task.assignee === me?.name || task.tagged?.includes(me?.name || ""),
    );

    const adSpecialSales = sales
      .filter(
        (row) =>
          ["호갱노노", "LMS"].includes(row.channel || "") &&
          row.contract_route !== "연계매출",
      )
      .reduce((sum, row) => sum + effectiveSales(row), 0);

    const linkedHighTargetSales = sales
      .filter((row) => row.contract_route === "연계매출")
      .reduce((sum, row) => sum + effectiveSales(row), 0);

    const bunyanghoeMonthlyFee = sales
      .filter((row) => row.contract_route === "분양회")
      .reduce((sum, row) => sum + effectiveSales(row), 0);

    return {
      customers: contacts.length,
      todayMeetings: todayMeetings.length,
      contracts: contracts.length,
      reservations: reservations.length,
      closing: closing.length,
      openTasks: openTasks.length,
      myTasks: myTasks.length,
      adSpecialSales,
      linkedHighTargetSales,
      bunyanghoeMonthlyFee,
    };
  }, [contacts, tasks, sales, me?.name]);

  const todayMeetings = useMemo(() => {
    return contacts
      .filter((c) => isSameDateValue(c.meeting_date))
      .sort((a, b) =>
        (meetingRegisteredAgo(b) || "").localeCompare(
          meetingRegisteredAgo(a) || "",
        ),
      );
  }, [contacts]);

  const importantTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status !== "완료")
      .sort((a, b) => {
        const priority = (value?: string | null) => {
          if (value === "긴급") return 0;
          if (value === "높음") return 1;
          if (value === "보통") return 2;
          return 3;
        };
        return priority(a.priority) - priority(b.priority);
      })
      .slice(0, 6);
  }, [tasks]);

  const recentContacts = useMemo(() => {
    return [...contacts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 7);
  }, [contacts]);
  const recentNotes = notes.slice(0, 6);
  const workspaceLinks = useMemo(() => {
    const selected = WORKSPACE_LINKS.filter((item) =>
      workspaceSelected.includes(item.href),
    );
    return selected.length > 0
      ? selected
      : WORKSPACE_LINKS.filter((item) =>
          DEFAULT_WORKSPACE_HREFS.includes(item.href),
        );
  }, [workspaceSelected]);
  const dashboardMessage = useMemo(
    () => getTimeBasedDashboardMessage(me),
    [me],
  );

  return (
    <div className="premium-page h-full overflow-y-auto">
      <div className="premium-shell px-5 py-5 md:px-7 md:py-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone="purple" icon={Sparkles}>
                Cycle-like CRM v3
              </Badge>
              <Badge tone="muted">
                <span
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{
                    background: me?.name
                      ? "var(--success)"
                      : "var(--text-disabled)",
                    boxShadow: me?.name
                      ? "0 0 0 3px rgba(52, 211, 153, 0.16)"
                      : "none",
                  }}
                />
                {me?.name ? `${me.name}님` : "Workspace"}
              </Badge>
            </div>
            <h1 className="crm-title">오늘의 운영 루프</h1>
            <p className="crm-subtitle mt-1">
              고객 유입, 미팅, 계약, 컨텐츠, 업무, 매출을 하나의 흐름으로
              확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[320px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-faint)" }}
              />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="고객명, 연락처, 메모 검색..."
                className="crm-search w-full pl-9 pr-3"
              />
            </div>

            <button
              type="button"
              onClick={fetchDashboard}
              className="btn-premium btn-secondary"
            >
              <RefreshCw size={14} />
              새로고침
            </button>

            <a href="/contacts" className="btn-premium btn-primary">
              <Users size={14} />
              고객DB 열기
            </a>
          </div>
        </header>

        <section className="premium-hero mb-5 p-5 md:p-6">
          <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="info" icon={CalendarDays}>
                  오늘 미팅 {stats.todayMeetings}건
                </Badge>
                <Badge tone="success" icon={BadgeCheck}>
                  계약완료 {stats.contracts}명
                </Badge>
                <Badge tone="warning" icon={Zap}>
                  딜클로징 {stats.closing}명
                </Badge>
              </div>

              <h2
                className="max-w-5xl text-[28px] font-[760] leading-[1.28] tracking-[0.02em] md:text-[38px]"
                style={{
                  color: "var(--text-strong)",
                  wordBreak: "keep-all",
                  overflowWrap: "normal",
                }}
              >
                {dashboardMessage.title}
              </h2>

              <p
                className="mt-4 max-w-3xl text-[13px] font-medium leading-[1.95] tracking-[0.005em] md:text-[14px]"
                style={{ color: "var(--text-muted)" }}
              >
                {dashboardMessage.desc}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <a href="/pipeline" className="btn-premium btn-primary">
                  <Target size={14} />
                  파이프라인 확인
                </a>
                <a href="/tasks" className="btn-premium btn-secondary">
                  <MessageCircle size={14} />
                  업무전달 보기
                </a>
                <a href="/calendar" className="btn-premium btn-secondary">
                  <CalendarDays size={14} />
                  캘린더 열기
                </a>
              </div>
            </div>

            <div className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <PremiumIcon icon={Activity} tone="purple" />
                <div>
                  <p className="crm-section-title">운영 상태</p>
                  <p className="crm-tiny">실시간 요약</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: "오늘 미팅",
                    value: stats.todayMeetings,
                    max: Math.max(stats.customers, 1),
                    tone: "cyan",
                  },
                  {
                    label: "딜클로징",
                    value: stats.closing,
                    max: Math.max(stats.customers, 1),
                    tone: "warning",
                  },
                  {
                    label: "미완료 업무",
                    value: stats.openTasks,
                    max: Math.max(tasks.length, 1),
                    tone: "danger",
                  },
                  {
                    label: "계약/예약",
                    value: stats.contracts + stats.reservations,
                    max: Math.max(stats.customers, 1),
                    tone: "success",
                  },
                ].map((item) => {
                  const c = toneStyle(item.tone);
                  const width = Math.min(
                    100,
                    Math.max(4, (item.value / item.max) * 100),
                  );
                  return (
                    <div key={item.label}>
                      <div className="mb-1.5 flex items-center justify-between text-[12px] font-bold">
                        <span style={{ color: "var(--text-muted)" }}>
                          {item.label}
                        </span>
                        <span style={{ color: c.color }}>
                          {item.value.toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full"
                        style={{ background: "var(--surface-3)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, background: c.dot }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <div className="premium-card overflow-hidden">
            <div
              className="flex flex-col gap-1 border-b px-4 py-3 md:px-5"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2">
                <PremiumIcon icon={Users} tone="info" size="sm" />
                <p className="crm-section-title">고객관리</p>
              </div>
              <p className="crm-tiny">
                전체 누적 고객 흐름과 오늘 예정된 미팅을 한 영역에서 빠르게
                확인합니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 2xl:grid-cols-5">
              <MetricCard
                label="전체 고객"
                value={stats.customers}
                icon={Users}
                tone="info"
                href="/contacts"
                sub="전체 누적"
                compact
              />
              <MetricCard
                label="딜클로징"
                value={stats.closing}
                icon={Zap}
                tone="warning"
                href="/pipeline"
                sub="전체 누적"
                compact
              />
              <MetricCard
                label="예약완료"
                value={stats.reservations}
                icon={Clock}
                tone="purple"
                href="/vip-members"
                sub="전체 누적"
                compact
              />
              <MetricCard
                label="계약완료"
                value={stats.contracts}
                icon={BadgeCheck}
                tone="success"
                href="/vip-members"
                sub="전체 누적"
                compact
              />
              <MetricCard
                label="오늘 미팅"
                value={stats.todayMeetings}
                icon={CalendarDays}
                tone="cyan"
                href="/calendar"
                sub="당일 기준"
                compact
              />
            </div>
          </div>

          <div className="premium-card overflow-hidden">
            <div
              className="flex flex-col gap-1 border-b px-4 py-3 md:px-5"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2">
                <PremiumIcon icon={TrendingUp} tone="success" size="sm" />
                <p className="crm-section-title">당월 진척율</p>
              </div>
              <p className="crm-tiny">
                광고특전, 하이타겟 연계매출, 분양회 월회비를 당월 기준으로
                구분합니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <MetricCard
                label="총매출(광고특전)"
                value={money(stats.adSpecialSales)}
                icon={TrendingUp}
                tone="success"
                href="/sales"
                sub="호갱노노 + LMS"
                compact
              />
              <MetricCard
                label="연계매출(하이타겟)"
                value={money(stats.linkedHighTargetSales)}
                icon={CreditCard}
                tone="purple"
                href="/sales"
                sub="하이타겟 당월 합산"
                compact
              />
              <MetricCard
                label="분양회월회비"
                value={money(stats.bunyanghoeMonthlyFee)}
                icon={Wallet}
                tone="warning"
                href="/sales"
                sub="분양회 월회비 합산"
                compact
              />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: "var(--accent)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-5">
              <section className="premium-card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-4"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PremiumIcon icon={CalendarDays} tone="cyan" />
                    <div className="min-w-0">
                      <p className="crm-section-title">오늘의 미팅</p>
                      <p className="crm-tiny">{formatFullDate(TODAY)} 기준</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-premium badge-info">
                      총 {todayMeetings.length}명
                    </span>
                    <a href="/calendar" className="btn-premium btn-secondary">
                      전체보기
                    </a>
                  </div>
                </div>

                <div className="max-h-[365px] overflow-y-auto p-2">
                  {todayMeetings.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon="📅"
                        title="오늘 미팅이 없습니다"
                        description="캘린더 또는 고객DB에서 다음 일정을 확인하세요"
                      />
                    </div>
                  ) : (
                    todayMeetings.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        mode="meeting"
                      />
                    ))
                  )}
                </div>
              </section>

              <section className="premium-card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-4"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PremiumIcon icon={MessageCircle} tone="purple" />
                    <div className="min-w-0">
                      <p className="crm-section-title">우선 처리 업무</p>
                      <p className="crm-tiny">미완료 업무 중 우선순위 기준</p>
                    </div>
                  </div>
                  <a href="/tasks" className="btn-premium btn-secondary">
                    업무전달
                  </a>
                </div>

                <div className="max-h-[365px] overflow-y-auto p-2">
                  {importantTasks.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon="✅"
                        title="미완료 업무가 없습니다"
                        description="새로운 요청이 들어오면 이곳에 표시됩니다"
                      />
                    </div>
                  ) : (
                    importantTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="premium-card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-4"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PremiumIcon icon={LayoutDashboard} tone="info" />
                    <div>
                      <p className="crm-section-title">워크스페이스</p>
                      <p className="crm-tiny">사용자가 자주 사용하는 메뉴</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkspaceEdit((prev) => !prev)}
                    className="btn-premium btn-secondary"
                  >
                    <Settings2 size={14} /> {workspaceEdit ? "완료" : "수정"}
                  </button>
                </div>

                {workspaceEdit ? (
                  <div className="grid max-h-[365px] gap-2 overflow-y-auto p-3 sm:grid-cols-2">
                    {WORKSPACE_LINKS.map((item) => {
                      const checked = workspaceSelected.includes(item.href);
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => toggleWorkspaceLink(item.href)}
                          className="premium-card premium-card-hover flex items-center gap-3 p-3 text-left"
                          style={{
                            borderColor: checked
                              ? "var(--accent-border)"
                              : "var(--border)",
                          }}
                        >
                          <PremiumIcon
                            icon={item.icon}
                            tone={checked ? "purple" : item.tone}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="crm-row-main truncate">
                              {item.title}
                            </p>
                            <p className="crm-row-sub mt-0.5 truncate">
                              {item.desc}
                            </p>
                          </div>
                          <span
                            className={`badge-premium ${checked ? "badge-purple" : "badge-muted"}`}
                          >
                            {checked ? "사용" : "제외"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {workspaceLinks.map((item) => (
                      <WorkspaceLink key={item.href} item={item} />
                    ))}
                  </div>
                )}
              </section>

              <section className="premium-card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-4"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PremiumIcon icon={Users} tone="success" />
                    <div className="min-w-0">
                      <p className="crm-section-title">최근 고객</p>
                      <p className="crm-tiny">고객등록 기준 최근 등록 순</p>
                    </div>
                  </div>
                  <a href="/customer-register" className="btn-premium btn-secondary">
                    고객등록
                  </a>
                </div>

                <div className="max-h-[430px] overflow-y-auto p-2">
                  {recentContacts.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon="👥"
                        title="고객이 없습니다"
                        description="검색 조건을 변경해보세요"
                      />
                    </div>
                  ) : (
                    recentContacts.map((contact) => (
                      <ContactRow key={contact.id} contact={contact} />
                    ))
                  )}
                </div>
              </section>

              <section className="premium-card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-4"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PremiumIcon icon={FileText} tone="warning" />
                    <div>
                      <p className="crm-section-title">최근 활동노트</p>
                      <p className="crm-tiny">고객 상담 기록</p>
                    </div>
                  </div>
                </div>

                <div className="max-h-[430px] overflow-y-auto p-2">
                  {recentNotes.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon="📝"
                        title="활동노트가 없습니다"
                        description="고객 상세에서 상담 기록을 남겨보세요"
                      />
                    </div>
                  ) : (
                    recentNotes.map((note) => (
                      <ActivityNote
                        key={note.id}
                        note={note}
                        contact={contactById.get(String(note.contact_id))}
                      />
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
