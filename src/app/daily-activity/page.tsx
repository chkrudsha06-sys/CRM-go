"use client";

import EmptyState from "@/components/EmptyState";
import { getCurrentUser, type CRMUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Eye,
  FileCheck2,
  Flag,
  RefreshCw,
  Save,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

const EXEC_MEMBERS = [
  { name: "조계현", title: "어쏘" },
  { name: "이세호", title: "어쏘" },
  { name: "기여운", title: "어쏘" },
  { name: "최연전", title: "CX" },
];

const OPS_NAMES = ["최은정", "김재영"];
const ADMIN_NAMES = ["문시욱", "김정후", "김창완", "최웅"];

const ACTIVITY_FIELDS = [
  { key: "consultant_db", label: "컨설턴트 DB", unit: "개" },
  { key: "second_touch", label: "2차 접점", unit: "개" },
  { key: "new_tm", label: "신규 TM", unit: "개" },
  { key: "manage_tm", label: "관리 TM", unit: "개" },
  { key: "coldtalk", label: "콜드톡 발송", unit: "개" },
] as const;

type ActivityKey = (typeof ACTIVITY_FIELDS)[number]["key"];

type FormValues = Record<ActivityKey | "meeting_confirmed", number>;

type DailyActivityRow = {
  id: number;
  work_date: string;
  owner_name: string;
  owner_title: string | null;
  owner_role: string | null;
  is_outside_meeting: boolean;
  goal_consultant_db: number;
  goal_second_touch: number;
  goal_new_tm: number;
  goal_manage_tm: number;
  goal_coldtalk: number;
  goal_meeting_confirmed: number;
  result_consultant_db: number;
  result_second_touch: number;
  result_new_tm: number;
  result_manage_tm: number;
  result_coldtalk: number;
  result_meeting_confirmed: number;
  created_at: string;
  updated_at: string;
};

const EMPTY_VALUES: FormValues = {
  consultant_db: 0,
  second_touch: 0,
  new_tm: 0,
  manage_tm: 0,
  coldtalk: 0,
  meeting_confirmed: 0,
};

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function startOfWeek(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toDateInput(date);
}

function endOfWeek(dateText: string) {
  const date = new Date(`${startOfWeek(dateText)}T00:00:00`);
  date.setDate(date.getDate() + 6);
  return toDateInput(date);
}

function startOfMonth(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function endOfMonth(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatKoreanDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

function n(value: number | null | undefined) {
  return Number(value || 0);
}

function percent(result: number, goal: number) {
  if (!goal) return result > 0 ? 100 : 0;
  return Math.round((result / goal) * 100);
}

function goalValue(
  row: DailyActivityRow | undefined,
  key: ActivityKey | "meeting_confirmed",
) {
  if (!row) return 0;
  return n(row[`goal_${key}` as keyof DailyActivityRow] as number);
}

function resultValue(
  row: DailyActivityRow | undefined,
  key: ActivityKey | "meeting_confirmed",
) {
  if (!row) return 0;
  return n(row[`result_${key}` as keyof DailyActivityRow] as number);
}

function totalTmGoal(row: DailyActivityRow | undefined) {
  if (!row || row.is_outside_meeting) return 0;
  return goalValue(row, "new_tm") + goalValue(row, "manage_tm");
}

function totalTmResult(row: DailyActivityRow | undefined) {
  if (!row || row.is_outside_meeting) return 0;
  return resultValue(row, "new_tm") + resultValue(row, "manage_tm");
}

function isGoalEntered(row: DailyActivityRow | undefined) {
  if (!row) return false;
  if (row.is_outside_meeting) return true;
  return (
    ACTIVITY_FIELDS.some((field) => goalValue(row, field.key) > 0) ||
    goalValue(row, "meeting_confirmed") > 0
  );
}

function isResultEntered(row: DailyActivityRow | undefined) {
  if (!row) return false;
  if (row.is_outside_meeting) return true;
  return (
    ACTIVITY_FIELDS.some((field) => resultValue(row, field.key) > 0) ||
    resultValue(row, "meeting_confirmed") > 0
  );
}

function roleAccess(user: CRMUser | null) {
  const name = user?.name || "";
  const role = user?.role || "shared";
  const isExec =
    role === "exec" || EXEC_MEMBERS.some((member) => member.name === name);
  const isOps = role === "ops" || OPS_NAMES.includes(name);
  const isAdmin = role === "admin" || ADMIN_NAMES.includes(name);
  return {
    isExec,
    isOps,
    isAdmin,
    canViewAll: isOps || isAdmin,
    canCopy: isAdmin || isOps,
  };
}

function rowForMember(rows: DailyActivityRow[], name: string) {
  return rows.find((row) => row.owner_name === name);
}

function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text);
}

function buildGoalReport(dateText: string, rows: DailyActivityRow[]) {
  const lines = [
    `■ ${formatKoreanDate(dateText)}`,
    "대외협력팀 실행파트 당일 활동목표",
    "",
    "@all",
    "──────────────",
  ];

  EXEC_MEMBERS.forEach((member) => {
    const row = rowForMember(rows, member.name);
    lines.push(`@${member.name}`);
    lines.push(`1. 컨설턴트 DB : ${goalValue(row, "consultant_db")}개`);
    lines.push(`2. 2차 접점 : ${goalValue(row, "second_touch")}개`);
    lines.push(`3. 신규 TM : ${goalValue(row, "new_tm")}개`);
    lines.push(`4. 관리 TM : ${goalValue(row, "manage_tm")}개`);
    lines.push("");
  });

  const totalTm = EXEC_MEMBERS.reduce(
    (sum, member) => sum + totalTmGoal(rowForMember(rows, member.name)),
    0,
  );
  const totalMeeting = EXEC_MEMBERS.reduce(
    (sum, member) =>
      sum + goalValue(rowForMember(rows, member.name), "meeting_confirmed"),
    0,
  );

  lines.push("──────────");
  lines.push(`▶ 총 TM 목표 : ${totalTm}개`);
  lines.push(`▶ 미팅 확정 목표 : ${totalMeeting}건`);

  return lines.join("\n");
}

function buildResultReport(dateText: string, rows: DailyActivityRow[]) {
  const lines = [
    `■ ${formatKoreanDate(dateText)}`,
    "대외협력팀 실행파트 당일 활동결과",
    "",
    "@all",
    "──────────────",
  ];

  EXEC_MEMBERS.forEach((member, index) => {
    const row = rowForMember(rows, member.name);
    lines.push(`@${member.name}`);
    lines.push(
      `1. 컨설턴트 DB : ${resultValue(row, "consultant_db")}개 / 달성율 ${percent(resultValue(row, "consultant_db"), goalValue(row, "consultant_db"))}%`,
    );
    lines.push(
      `2. 2차 접점 : ${resultValue(row, "second_touch")}개 / 달성율 ${percent(resultValue(row, "second_touch"), goalValue(row, "second_touch"))}%`,
    );
    lines.push(
      `3. 신규 TM : ${resultValue(row, "new_tm")}개 / 달성율 ${percent(resultValue(row, "new_tm"), goalValue(row, "new_tm"))}%`,
    );
    lines.push(
      `4. 관리 TM : ${resultValue(row, "manage_tm")}개 / 달성율 ${percent(resultValue(row, "manage_tm"), goalValue(row, "manage_tm"))}%`,
    );
    lines.push("──────────");
    lines.push(
      `▶ 총 TM : ${totalTmResult(row)}개 / 달성율 ${percent(totalTmResult(row), totalTmGoal(row))}%`,
    );
    lines.push(`▶ 미팅 확정 : ${resultValue(row, "meeting_confirmed")}건`);
    if (index < EXEC_MEMBERS.length - 1) lines.push("");
  });

  return lines.join("\n");
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "info",
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "info" | "success" | "warning" | "purple" | "danger";
}) {
  const styleMap = {
    info: {
      bg: "var(--info-bg)",
      border: "var(--info-border)",
      color: "var(--info-text)",
    },
    success: {
      bg: "var(--success-bg)",
      border: "var(--success-border)",
      color: "var(--success-text)",
    },
    warning: {
      bg: "var(--warning-bg)",
      border: "var(--warning-border)",
      color: "var(--warning-text)",
    },
    purple: {
      bg: "var(--purple-bg)",
      border: "var(--purple-border)",
      color: "var(--purple-text)",
    },
    danger: {
      bg: "var(--danger-bg)",
      border: "var(--danger-border)",
      color: "var(--danger-text)",
    },
  }[tone];

  return (
    <div className="premium-card flex min-h-[104px] items-center justify-between p-4">
      <div>
        <p className="crm-tiny">{label}</p>
        <p
          className="mt-2 text-[25px] font-[820] tracking-[-0.06em]"
          style={{ color: "var(--text-strong)" }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="crm-row-sub mt-1">{sub}</p>}
      </div>
      <div
        className="flex h-11 w-11 items-center justify-center rounded-[14px] border"
        style={{
          background: styleMap.bg,
          borderColor: styleMap.border,
          color: styleMap.color,
        }}
      >
        <Icon size={20} />
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  disabled,
  unit = "건",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  unit?: string;
}) {
  return (
    <label className="block">
      <span className="crm-meta mb-2 block">{label}</span>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(Math.max(0, Number(event.target.value || 0)))
          }
          className="h-[42px] w-full rounded-[13px] border px-3 pr-10 text-[14px] font-[760] outline-none disabled:opacity-50"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold"
          style={{ color: "var(--text-faint)" }}
        >
          {unit}
        </span>
      </div>
    </label>
  );
}

function ProgressBar({ result, goal }: { result: number; goal: number }) {
  const rate = percent(result, goal);
  const width = Math.min(100, Math.max(3, rate));
  const color =
    rate >= 100
      ? "var(--success)"
      : rate >= 70
        ? "var(--info)"
        : rate >= 40
          ? "var(--warning)"
          : "var(--danger)";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
        <span style={{ color: "var(--text-subtle)" }}>
          {result.toLocaleString()} / {goal.toLocaleString()}
        </span>
        <span style={{ color }}>{rate}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

function MemberDayCard({
  member,
  row,
}: {
  member: { name: string; title: string };
  row?: DailyActivityRow;
}) {
  const excluded = row?.is_outside_meeting;
  return (
    <article className="premium-card overflow-hidden p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="crm-avatar"
            style={{ background: "linear-gradient(135deg,#8b7cf6,#60a5fa)" }}
          >
            {member.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="crm-row-main">
              {member.name} <span className="crm-row-sub">{member.title}</span>
            </p>
            <p className="crm-tiny mt-1">
              {excluded
                ? "외근(미팅) 기록대상 제외"
                : row
                  ? "일별 활동기록 입력됨"
                  : "미입력"}
            </p>
          </div>
        </div>
        <span
          className={`badge-premium ${excluded ? "badge-warning" : isResultEntered(row) ? "badge-success" : isGoalEntered(row) ? "badge-info" : "badge-muted"}`}
        >
          {excluded
            ? "외근"
            : isResultEntered(row)
              ? "결과입력"
              : isGoalEntered(row)
                ? "목표입력"
                : "대기"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ACTIVITY_FIELDS.map((field) => (
          <div
            key={field.key}
            className="rounded-[13px] border p-3"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="crm-tiny">{field.label}</p>
              <p
                className="text-[12px] font-[780]"
                style={{ color: "var(--text)" }}
              >
                {resultValue(row, field.key)} / {goalValue(row, field.key)}
                {field.unit}
              </p>
            </div>
            <ProgressBar
              result={resultValue(row, field.key)}
              goal={goalValue(row, field.key)}
            />
          </div>
        ))}
        <div
          className="rounded-[13px] border p-3"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="crm-tiny">미팅 확정</p>
            <p
              className="text-[12px] font-[780]"
              style={{ color: "var(--text)" }}
            >
              {resultValue(row, "meeting_confirmed")} /{" "}
              {goalValue(row, "meeting_confirmed")}건
            </p>
          </div>
          <ProgressBar
            result={resultValue(row, "meeting_confirmed")}
            goal={goalValue(row, "meeting_confirmed")}
          />
        </div>
      </div>
    </article>
  );
}

function PeriodSummary({
  title,
  rows,
}: {
  title: string;
  rows: DailyActivityRow[];
}) {
  const included = rows.filter((row) => !row.is_outside_meeting);
  const goals = ACTIVITY_FIELDS.reduce(
    (sum, field) =>
      sum + included.reduce((s, row) => s + goalValue(row, field.key), 0),
    0,
  );
  const results = ACTIVITY_FIELDS.reduce(
    (sum, field) =>
      sum + included.reduce((s, row) => s + resultValue(row, field.key), 0),
    0,
  );
  const meetings = included.reduce(
    (sum, row) => sum + resultValue(row, "meeting_confirmed"),
    0,
  );
  const excluded = rows.length - included.length;

  return (
    <div className="premium-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="crm-card-title">{title}</p>
          <p className="crm-tiny mt-1">외근 제외 {included.length}건 기준</p>
        </div>
        {excluded > 0 && (
          <span className="badge-premium badge-warning">
            외근 제외 {excluded}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="crm-tiny">활동목표</p>
          <p className="crm-row-main mt-1">{goals.toLocaleString()}개</p>
        </div>
        <div>
          <p className="crm-tiny">활동결과</p>
          <p className="crm-row-main mt-1">{results.toLocaleString()}개</p>
        </div>
        <div>
          <p className="crm-tiny">미팅확정</p>
          <p className="crm-row-main mt-1">{meetings.toLocaleString()}건</p>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar result={results} goal={goals} />
      </div>
    </div>
  );
}

function GuideBox({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-[16px] border px-4 py-3 text-[13px] font-[650] leading-relaxed"
      style={{
        background: "var(--accent-subtle)",
        borderColor: "var(--accent-border)",
        color: "var(--accent-text)",
      }}
    >
      {children}
    </div>
  );
}

export default function DailyActivityPage() {
  const [user, setUser] = useState<CRMUser | null>(null);
  const [date, setDate] = useState(todayString());
  const [dailyRows, setDailyRows] = useState<DailyActivityRow[]>([]);
  const [periodRows, setPeriodRows] = useState<DailyActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [isOutsideMeeting, setIsOutsideMeeting] = useState(false);
  const [goal, setGoal] = useState<FormValues>({ ...EMPTY_VALUES });
  const [result, setResult] = useState<FormValues>({ ...EMPTY_VALUES });
  const [selectedOwner, setSelectedOwner] = useState(EXEC_MEMBERS[0].name);

  const access = useMemo(() => roleAccess(user), [user]);
  const currentMember = useMemo(
    () => EXEC_MEMBERS.find((member) => member.name === user?.name),
    [user?.name],
  );
  const dailyMemberRows = useMemo(
    () =>
      EXEC_MEMBERS.map((member) => ({
        member,
        row: rowForMember(dailyRows, member.name),
      })),
    [dailyRows],
  );
  const myRow = useMemo(
    () => (user?.name ? rowForMember(dailyRows, user.name) : undefined),
    [dailyRows, user?.name],
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const loginUser = getCurrentUser();
    setUser(loginUser);

    const weekStart = startOfWeek(date);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const [dailyRes, periodRes] = await Promise.all([
      supabase.from("daily_activity_goals").select("*").eq("work_date", date),
      supabase
        .from("daily_activity_goals")
        .select("*")
        .gte("work_date", monthStart)
        .lte("work_date", monthEnd)
        .order("work_date", { ascending: false }),
    ]);

    if (dailyRes.error) {
      alert(`일별 활동기록을 불러오지 못했습니다.\n${dailyRes.error.message}`);
      setDailyRows([]);
    } else {
      setDailyRows((dailyRes.data || []) as DailyActivityRow[]);
    }

    if (periodRes.error) {
      setPeriodRows([]);
    } else {
      setPeriodRows((periodRes.data || []) as DailyActivityRow[]);
    }

    const row = loginUser?.name
      ? ((dailyRes.data || []).find(
          (item) => item.owner_name === loginUser.name,
        ) as DailyActivityRow | undefined)
      : undefined;
    if (row) {
      setIsOutsideMeeting(row.is_outside_meeting);
      setGoal({
        consultant_db: row.goal_consultant_db || 0,
        second_touch: row.goal_second_touch || 0,
        new_tm: row.goal_new_tm || 0,
        manage_tm: row.goal_manage_tm || 0,
        coldtalk: row.goal_coldtalk || 0,
        meeting_confirmed: row.goal_meeting_confirmed || 0,
      });
      setResult({
        consultant_db: row.result_consultant_db || 0,
        second_touch: row.result_second_touch || 0,
        new_tm: row.result_new_tm || 0,
        manage_tm: row.result_manage_tm || 0,
        coldtalk: row.result_coldtalk || 0,
        meeting_confirmed: row.result_meeting_confirmed || 0,
      });
    } else {
      setIsOutsideMeeting(false);
      setGoal({ ...EMPTY_VALUES });
      setResult({ ...EMPTY_VALUES });
    }

    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!user) return;
    if (access.canViewAll) {
      setSelectedOwner((prev) => prev || EXEC_MEMBERS[0].name);
      return;
    }
    if (currentMember) setSelectedOwner(currentMember.name);
  }, [access.canViewAll, currentMember, user]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const handleSave = async () => {
    if (!user || !currentMember) {
      alert("실행파트 인원만 활동기록을 입력할 수 있습니다.");
      return;
    }

    setSaving(true);
    const payload = {
      work_date: date,
      owner_name: currentMember.name,
      owner_title: currentMember.title,
      owner_role: "exec",
      is_outside_meeting: isOutsideMeeting,
      goal_consultant_db: isOutsideMeeting ? 0 : goal.consultant_db,
      goal_second_touch: isOutsideMeeting ? 0 : goal.second_touch,
      goal_new_tm: isOutsideMeeting ? 0 : goal.new_tm,
      goal_manage_tm: isOutsideMeeting ? 0 : goal.manage_tm,
      goal_coldtalk: isOutsideMeeting ? 0 : goal.coldtalk,
      goal_meeting_confirmed: isOutsideMeeting ? 0 : goal.meeting_confirmed,
      result_consultant_db: isOutsideMeeting ? 0 : result.consultant_db,
      result_second_touch: isOutsideMeeting ? 0 : result.second_touch,
      result_new_tm: isOutsideMeeting ? 0 : result.new_tm,
      result_manage_tm: isOutsideMeeting ? 0 : result.manage_tm,
      result_coldtalk: isOutsideMeeting ? 0 : result.coldtalk,
      result_meeting_confirmed: isOutsideMeeting ? 0 : result.meeting_confirmed,
    };

    const { error } = await supabase
      .from("daily_activity_goals")
      .upsert(payload, { onConflict: "work_date,owner_name" });
    setSaving(false);

    if (error) {
      alert(`저장 실패\n${error.message}`);
      return;
    }

    showToast("일별 활동기록이 저장되었습니다");
    fetchRows();
  };

  const copyGoalReport = async () => {
    await copyToClipboard(buildGoalReport(date, dailyRows));
    showToast("카카오워크 활동목표 양식이 복사되었습니다");
  };

  const copyResultReport = async () => {
    await copyToClipboard(buildResultReport(date, dailyRows));
    showToast("카카오워크 활동결과 양식이 복사되었습니다");
  };

  const weekRows = useMemo(() => {
    const s = startOfWeek(date);
    const e = endOfWeek(date);
    return periodRows.filter((row) => row.work_date >= s && row.work_date <= e);
  }, [date, periodRows]);

  const monthRows = useMemo(() => periodRows, [periodRows]);
  const personalRows = useMemo(
    () =>
      user?.name
        ? periodRows.filter((row) => row.owner_name === user.name)
        : [],
    [periodRows, user?.name],
  );
  const personalWeekRows = useMemo(() => {
    const s = startOfWeek(date);
    const e = endOfWeek(date);
    return personalRows.filter(
      (row) => row.work_date >= s && row.work_date <= e,
    );
  }, [date, personalRows]);

  const selectedMember = useMemo(
    () =>
      EXEC_MEMBERS.find((member) => member.name === selectedOwner) ||
      EXEC_MEMBERS[0],
    [selectedOwner],
  );
  const selectedDailyRow = useMemo(
    () => rowForMember(dailyRows, selectedMember.name),
    [dailyRows, selectedMember.name],
  );
  const selectedPeriodRows = useMemo(
    () => periodRows.filter((row) => row.owner_name === selectedMember.name),
    [periodRows, selectedMember.name],
  );
  const selectedWeekRows = useMemo(() => {
    const s = startOfWeek(date);
    const e = endOfWeek(date);
    return selectedPeriodRows.filter(
      (row) => row.work_date >= s && row.work_date <= e,
    );
  }, [date, selectedPeriodRows]);

  const visibleDetailRows = access.canViewAll
    ? selectedPeriodRows
    : personalRows;
  const visibleWeekRows = access.canViewAll
    ? selectedWeekRows
    : personalWeekRows;
  const visibleMonthRows = access.canViewAll
    ? selectedPeriodRows
    : personalRows;

  const enteredGoals = dailyMemberRows.filter(({ row }) =>
    isGoalEntered(row),
  ).length;
  const enteredResults = dailyMemberRows.filter(({ row }) =>
    isResultEntered(row),
  ).length;
  const totalGoalTm = dailyMemberRows.reduce(
    (sum, item) => sum + totalTmGoal(item.row),
    0,
  );
  const totalResultTm = dailyMemberRows.reduce(
    (sum, item) => sum + totalTmResult(item.row),
    0,
  );
  const totalGoalMeeting = dailyMemberRows.reduce(
    (sum, item) => sum + goalValue(item.row, "meeting_confirmed"),
    0,
  );
  const totalResultMeeting = dailyMemberRows.reduce(
    (sum, item) => sum + resultValue(item.row, "meeting_confirmed"),
    0,
  );

  return (
    <div className="premium-page h-full overflow-y-auto">
      <div className="premium-shell px-5 py-5 md:px-7 md:py-6">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="badge-premium badge-purple">
                <Target size={13} /> 일별활동기록
              </span>
              <span className="badge-premium badge-muted">
                {formatKoreanDate(date)} 기준
              </span>
              {access.canViewAll ? (
                <span className="badge-premium badge-info">
                  <Eye size={13} /> 전체 보기
                </span>
              ) : (
                <span className="badge-premium badge-success">
                  <UserCheck size={13} /> 개인 입력
                </span>
              )}
            </div>
            <h1 className="crm-title">일별활동기록</h1>
            <p className="crm-subtitle mt-2">
              대시보드는 핵심 지표 중심으로 유지하고, 개인별 활동목표와 결과
              기록은 이 메뉴에서 일·주·월 단위로 관리합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-[38px] rounded-full border px-3 text-[13px] font-[740] outline-none"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
            <button
              type="button"
              onClick={fetchRows}
              className="btn-premium btn-secondary"
            >
              <RefreshCw size={14} /> 최신화
            </button>
            {access.canCopy && (
              <>
                <button
                  type="button"
                  onClick={copyGoalReport}
                  className="btn-premium btn-primary"
                >
                  <ClipboardCopy size={14} /> 목표복사
                </button>
                <button
                  type="button"
                  onClick={copyResultReport}
                  className="btn-premium btn-primary"
                >
                  <FileCheck2 size={14} /> 결과보고 복사
                </button>
              </>
            )}
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="목표 입력"
            value={`4/${enteredGoals}`}
            sub="실행파트 기준"
            tone="info"
          />
          <StatCard
            icon={CheckCircle2}
            label="결과 입력"
            value={`4/${enteredResults}`}
            sub="퇴근 전 입력 기준"
            tone="success"
          />
          <StatCard
            icon={Clock3}
            label="총 TM"
            value={`${totalGoalTm}/${totalResultTm}`}
            sub={`달성율 ${percent(totalResultTm, totalGoalTm)}%`}
            tone="warning"
          />
          <StatCard
            icon={CalendarDays}
            label="미팅 확정"
            value={`${totalGoalMeeting}/${totalResultMeeting}`}
            sub="목표 대비 결과"
            tone="purple"
          />
        </section>

        {access.canCopy && (
          <div className="mb-5 grid gap-3 xl:grid-cols-2">
            <GuideBox>
              운영파트와 관리자 기준에서 카카오워크 목표복사와 결과보고 복사 버튼이
              노출됩니다. 미입력 인원은 자동으로 0개 기준으로 양식에 포함됩니다.
            </GuideBox>
            <GuideBox>
              외근(미팅)을 체크한 실행파트 인원은 해당 일자의 기록대상에서
              제외되며, 주·월 통계에서도 활동량 집계에서 제외됩니다.
            </GuideBox>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: "var(--accent)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {access.isExec && !access.canViewAll && currentMember && (
              <section className="premium-card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 border-b px-5 py-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="crm-avatar"
                      style={{
                        background: "linear-gradient(135deg,#8b7cf6,#60a5fa)",
                      }}
                    >
                      {currentMember.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className="crm-section-title">
                        {currentMember.name} {currentMember.title} 당일 활동
                        입력
                      </p>
                      <p className="crm-tiny mt-1">
                        본인 기록만 입력 가능하며, 다른 실행파트 인원의 기록은
                        표시되지 않습니다.
                      </p>
                    </div>
                  </div>
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-[780]"
                    style={{
                      borderColor: isOutsideMeeting
                        ? "var(--warning-border)"
                        : "var(--border)",
                      background: isOutsideMeeting
                        ? "var(--warning-bg)"
                        : "var(--surface-2)",
                      color: isOutsideMeeting
                        ? "var(--warning-text)"
                        : "var(--text-muted)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isOutsideMeeting}
                      onChange={(event) =>
                        setIsOutsideMeeting(event.target.checked)
                      }
                    />
                    외근(미팅) 기록대상 제외
                  </label>
                </div>

                <div className="grid gap-5 p-5 xl:grid-cols-2">
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <Flag size={17} style={{ color: "var(--info-text)" }} />
                      <p className="crm-section-title">당일 활동목표</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ACTIVITY_FIELDS.map((field) => (
                        <NumberInput
                          key={field.key}
                          label={field.label}
                          value={goal[field.key]}
                          unit={field.unit}
                          disabled={isOutsideMeeting}
                          onChange={(value) =>
                            setGoal((prev) => ({ ...prev, [field.key]: value }))
                          }
                        />
                      ))}
                      <NumberInput
                        label="미팅 확정 목표"
                        value={goal.meeting_confirmed}
                        unit="건"
                        disabled={isOutsideMeeting}
                        onChange={(value) =>
                          setGoal((prev) => ({
                            ...prev,
                            meeting_confirmed: value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <TrendingUp
                        size={17}
                        style={{ color: "var(--success-text)" }}
                      />
                      <p className="crm-section-title">퇴근 전 활동결과</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ACTIVITY_FIELDS.map((field) => (
                        <NumberInput
                          key={field.key}
                          label={field.label}
                          value={result[field.key]}
                          unit={field.unit}
                          disabled={isOutsideMeeting}
                          onChange={(value) =>
                            setResult((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                          }
                        />
                      ))}
                      <NumberInput
                        label="미팅 확정 결과"
                        value={result.meeting_confirmed}
                        unit="건"
                        disabled={isOutsideMeeting}
                        onChange={(value) =>
                          setResult((prev) => ({
                            ...prev,
                            meeting_confirmed: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center justify-end gap-2 border-t px-5 py-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-premium btn-primary"
                  >
                    <Save size={14} /> {saving ? "저장 중..." : "활동기록 저장"}
                  </button>
                </div>
              </section>
            )}

            {access.canViewAll && (
              <section className="premium-card overflow-hidden">
                <div
                  className="flex flex-col gap-3 border-b px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <p className="crm-section-title">
                      실행파트 개인별 일별 활동 현황
                    </p>
                    <p className="crm-tiny mt-1">
                      운영파트/관리자는 드롭다운으로 인원을 선택해 개인별
                      데이터만 확인합니다. 입력창은 노출되지 않습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedOwner}
                      onChange={(event) => setSelectedOwner(event.target.value)}
                      className="h-[38px] min-w-[150px] rounded-full border px-3 text-[13px] font-[760] outline-none"
                      style={{
                        background: "var(--surface-2)",
                        borderColor: "var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      {EXEC_MEMBERS.map((member) => (
                        <option key={member.name} value={member.name}>
                          {member.name} {member.title}
                        </option>
                      ))}
                    </select>
                    <span className="badge-premium badge-muted">
                      {formatKoreanDate(date)}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <MemberDayCard
                    member={selectedMember}
                    row={selectedDailyRow}
                  />
                </div>
              </section>
            )}

            {!access.isExec && !access.canViewAll && (
              <section className="premium-card p-8">
                <EmptyState
                  icon="🔒"
                  title="접근 가능한 활동기록이 없습니다"
                  description="실행파트는 본인 기록 입력, 운영파트/관리자는 전체 현황 확인이 가능합니다."
                />
              </section>
            )}

            <section className="grid gap-4 xl:grid-cols-2">
              {access.canViewAll ? (
                <>
                  <PeriodSummary
                    title={`${selectedMember.name} 주간 통계`}
                    rows={visibleWeekRows}
                  />
                  <PeriodSummary
                    title={`${selectedMember.name} 월간 통계`}
                    rows={visibleMonthRows}
                  />
                </>
              ) : (
                <>
                  <PeriodSummary
                    title="나의 주간 통계"
                    rows={visibleWeekRows}
                  />
                  <PeriodSummary
                    title="나의 월간 통계"
                    rows={visibleMonthRows}
                  />
                </>
              )}
            </section>

            <section className="premium-card overflow-hidden">
              <div
                className="flex items-center gap-3 border-b px-5 py-4"
                style={{ borderColor: "var(--border)" }}
              >
                <BarChart3 size={18} style={{ color: "var(--accent-text)" }} />
                <div>
                  <p className="crm-section-title">
                    {access.canViewAll
                      ? `${selectedMember.name} 월간 상세 기록`
                      : "나의 월간 상세 기록"}
                  </p>
                  <p className="crm-tiny mt-1">
                    선택한 날짜가 포함된 월 기준 기록입니다. 최대 10개 행
                    높이까지만 보이고, 추가 기록은 박스 안에서 스크롤됩니다.
                  </p>
                </div>
              </div>
              <div className="max-h-[620px] overflow-auto">
                <table className="crm-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>일자</th>
                      <th>담당자</th>
                      <th>상태</th>
                      <th>목표 TM</th>
                      <th>결과 TM</th>
                      <th>TM 달성율</th>
                      <th>미팅확정</th>
                      <th>수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDetailRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center">
                          기록이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      visibleDetailRows.map((row) => (
                        <tr key={row.id}>
                          <td>{formatKoreanDate(row.work_date)}</td>
                          <td>
                            <span className="crm-row-main">
                              {row.owner_name}
                            </span>{" "}
                            <span className="crm-row-sub">
                              {row.owner_title || ""}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge-premium ${row.is_outside_meeting ? "badge-warning" : "badge-success"}`}
                            >
                              {row.is_outside_meeting
                                ? "외근 제외"
                                : "기록대상"}
                            </span>
                          </td>
                          <td>{totalTmGoal(row).toLocaleString()}개</td>
                          <td>{totalTmResult(row).toLocaleString()}개</td>
                          <td>
                            {percent(totalTmResult(row), totalTmGoal(row))}%
                          </td>
                          <td>
                            {resultValue(
                              row,
                              "meeting_confirmed",
                            ).toLocaleString()}
                            건
                          </td>
                          <td>
                            {new Date(row.updated_at).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[14px] px-5 py-3 text-[13px] font-[780] text-white shadow-lg"
          style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
