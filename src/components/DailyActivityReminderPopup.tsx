
"use client";

import { supabase } from "@/lib/supabase";
import type { CRMUser } from "@/lib/auth";
import { CheckCircle2, Clock3, Coffee, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const EXEC_MEMBERS = ["조계현", "이세호", "기여운", "최연전"];

const ACTIVITY_FIELDS = [
  { key: "consultant_db", label: "컨설턴트 DB", unit: "건" },
  { key: "second_touch", label: "2차 접점", unit: "건" },
  { key: "new_tm", label: "신규 TM", unit: "건" },
  { key: "manage_tm", label: "관리 TM", unit: "건" },
  { key: "coldtalk", label: "콜드톡 발송", unit: "건" },
  { key: "media_mix", label: "미디어믹스 전달", unit: "건" },
] as const;

type ActivityKey = (typeof ACTIVITY_FIELDS)[number]["key"];
type ReminderMode = "goal" | "mid" | "result";
type FormValues = Record<ActivityKey | "meeting_confirmed", number>;

type WorkItem = {
  id: string;
  text: string;
  done: boolean;
};

type DailyActivityRow = {
  id?: number;
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
  goal_media_mix: number;
  goal_meeting_confirmed: number;
  goal_work_items: WorkItem[] | null;
  result_consultant_db: number;
  result_second_touch: number;
  result_new_tm: number;
  result_manage_tm: number;
  result_coldtalk: number;
  result_media_mix: number;
  result_meeting_confirmed: number;
  created_at?: string;
  updated_at?: string;
};

const EMPTY_VALUES: FormValues = {
  consultant_db: 0,
  second_touch: 0,
  new_tm: 0,
  manage_tm: 0,
  coldtalk: 0,
  media_mix: 0,
  meeting_confirmed: 0,
};

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function createEmptyWorkItems(): WorkItem[] {
  return [1, 2, 3].map((index) => ({
    id: `task-${Date.now()}-${index}`,
    text: "",
    done: false,
  }));
}

function normalizeWorkItems(value: unknown): WorkItem[] {
  if (!Array.isArray(value)) return createEmptyWorkItems();
  const items = value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const data = item as Partial<WorkItem>;
      return {
        id: String(data.id || `task-${Date.now()}-${index}`),
        text: String(data.text || ""),
        done: Boolean(data.done),
      };
    })
    .filter(Boolean) as WorkItem[];

  return items.length > 0 ? items : createEmptyWorkItems();
}

function activeWorkItems(items: WorkItem[]) {
  return items.filter((item) => item.text.trim().length > 0);
}

function hasAnyValue(values: FormValues) {
  return Object.values(values).some((value) => Number(value || 0) > 0);
}

function isGoalEntered(row: DailyActivityRow | null) {
  if (!row) return false;
  if (row.is_outside_meeting) return true;
  return (
    Number(row.goal_consultant_db || 0) > 0 ||
    Number(row.goal_second_touch || 0) > 0 ||
    Number(row.goal_new_tm || 0) > 0 ||
    Number(row.goal_manage_tm || 0) > 0 ||
    Number(row.goal_coldtalk || 0) > 0 ||
    Number(row.goal_media_mix || 0) > 0 ||
    Number(row.goal_meeting_confirmed || 0) > 0 ||
    activeWorkItems(normalizeWorkItems(row.goal_work_items)).length > 0
  );
}

function isResultEntered(row: DailyActivityRow | null) {
  if (!row) return false;
  if (row.is_outside_meeting) return true;
  return (
    Number(row.result_consultant_db || 0) > 0 ||
    Number(row.result_second_touch || 0) > 0 ||
    Number(row.result_new_tm || 0) > 0 ||
    Number(row.result_manage_tm || 0) > 0 ||
    Number(row.result_coldtalk || 0) > 0 ||
    Number(row.result_media_mix || 0) > 0 ||
    Number(row.result_meeting_confirmed || 0) > 0 ||
    activeWorkItems(normalizeWorkItems(row.goal_work_items)).some((item) => item.done)
  );
}

function goalFromRow(row: DailyActivityRow | null): FormValues {
  if (!row) return { ...EMPTY_VALUES };
  return {
    consultant_db: Number(row.goal_consultant_db || 0),
    second_touch: Number(row.goal_second_touch || 0),
    new_tm: Number(row.goal_new_tm || 0),
    manage_tm: Number(row.goal_manage_tm || 0),
    coldtalk: Number(row.goal_coldtalk || 0),
    media_mix: Number(row.goal_media_mix || 0),
    meeting_confirmed: Number(row.goal_meeting_confirmed || 0),
  };
}

function resultFromRow(row: DailyActivityRow | null): FormValues {
  if (!row) return { ...EMPTY_VALUES };
  return {
    consultant_db: Number(row.result_consultant_db || 0),
    second_touch: Number(row.result_second_touch || 0),
    new_tm: Number(row.result_new_tm || 0),
    manage_tm: Number(row.result_manage_tm || 0),
    coldtalk: Number(row.result_coldtalk || 0),
    media_mix: Number(row.result_media_mix || 0),
    meeting_confirmed: Number(row.result_meeting_confirmed || 0),
  };
}

function reminderKey(ownerName: string, mode: ReminderMode) {
  return `daily-activity-global-reminder-${ownerName}-${todayString()}-${mode}`;
}

function NumberField({
  label,
  value,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-[820] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
          className="h-[44px] w-full rounded-[14px] border px-3 pr-10 text-[14px] font-[760] outline-none transition disabled:opacity-45"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-[800]" style={{ color: "var(--text-faint)" }}>
          {unit}
        </span>
      </div>
    </label>
  );
}

export default function DailyActivityReminderPopup({ user }: { user: CRMUser | null }) {
  const today = useMemo(() => todayString(), []);
  const isExec = Boolean(user?.name && EXEC_MEMBERS.includes(user.name));

  const [row, setRow] = useState<DailyActivityRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ReminderMode | null>(null);
  const [intro, setIntro] = useState(false);
  const [outside, setOutside] = useState(false);
  const [goal, setGoal] = useState<FormValues>({ ...EMPTY_VALUES });
  const [result, setResult] = useState<FormValues>({ ...EMPTY_VALUES });
  const [workItems, setWorkItems] = useState<WorkItem[]>(createEmptyWorkItems());
  const [errorText, setErrorText] = useState("");

  const canSaveGoal = outside || hasAnyValue(goal) || activeWorkItems(workItems).length > 0;
  const isOutsideSaved = Boolean(row?.is_outside_meeting);

  const loadTodayRow = useCallback(async () => {
    if (!user?.name || !isExec) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("daily_activity_goals")
      .select("*")
      .eq("work_date", today)
      .eq("owner_name", user.name)
      .maybeSingle();

    setLoading(false);
    if (error) {
      setErrorText(error.message);
      return;
    }

    const current = (data || null) as DailyActivityRow | null;
    setRow(current);
    setOutside(Boolean(current?.is_outside_meeting));
    setGoal(goalFromRow(current));
    setResult(resultFromRow(current));
    setWorkItems(normalizeWorkItems(current?.goal_work_items));
  }, [isExec, today, user?.name]);

  useEffect(() => {
    loadTodayRow();
  }, [loadTodayRow]);

  useEffect(() => {
    if (!mode) return;
    setIntro(true);
    const timer = window.setTimeout(() => setIntro(false), 1250);
    return () => window.clearTimeout(timer);
  }, [mode]);

  const decideMode = useCallback(() => {
    if (!user?.name || !isExec || loading) return;
    if (isOutsideSaved) {
      setMode(null);
      return;
    }

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const afterWorkStart = minutes >= 7 * 60;
    const afterMidCheck = minutes >= 15 * 60;
    const afterResultTime = minutes >= 17 * 60 + 30;

    if (afterWorkStart && !isGoalEntered(row)) {
      setMode("goal");
      return;
    }

    if (afterResultTime && !isResultEntered(row)) {
      setMode("result");
      return;
    }

    if (
      afterMidCheck &&
      minutes < 17 * 60 + 30 &&
      isGoalEntered(row) &&
      !window.localStorage.getItem(reminderKey(user.name, "mid"))
    ) {
      setMode("mid");
      return;
    }

    setMode(null);
  }, [isExec, isOutsideSaved, loading, row, user?.name]);

  useEffect(() => {
    if (!isExec) return;
    decideMode();
    const timer = window.setInterval(decideMode, 60_000);
    return () => window.clearInterval(timer);
  }, [decideMode, isExec]);

  const saveRecord = async (target: "goal" | "result") => {
    if (!user?.name || !isExec) return;

    if (target === "goal" && !canSaveGoal) {
      setErrorText("목표를 입력하거나 금일 출장 및 외부활동을 체크해야 팝업을 닫을 수 있습니다.");
      return;
    }

    setSaving(true);
    setErrorText("");

    const payload = {
      work_date: today,
      owner_name: user.name,
      owner_title: user.title || null,
      owner_role: "exec",
      is_outside_meeting: outside,
      goal_consultant_db: outside ? 0 : goal.consultant_db,
      goal_second_touch: outside ? 0 : goal.second_touch,
      goal_new_tm: outside ? 0 : goal.new_tm,
      goal_manage_tm: outside ? 0 : goal.manage_tm,
      goal_coldtalk: outside ? 0 : goal.coldtalk,
      goal_media_mix: outside ? 0 : goal.media_mix,
      goal_meeting_confirmed: outside ? 0 : goal.meeting_confirmed,
      goal_work_items: outside ? [] : workItems,
      result_consultant_db: outside ? 0 : result.consultant_db,
      result_second_touch: outside ? 0 : result.second_touch,
      result_new_tm: outside ? 0 : result.new_tm,
      result_manage_tm: outside ? 0 : result.manage_tm,
      result_coldtalk: outside ? 0 : result.coldtalk,
      result_media_mix: outside ? 0 : result.media_mix,
      result_meeting_confirmed: outside ? 0 : result.meeting_confirmed,
    };

    const { error } = await supabase
      .from("daily_activity_goals")
      .upsert(payload, { onConflict: "work_date,owner_name" });

    setSaving(false);
    if (error) {
      setErrorText(error.message);
      return;
    }

    await loadTodayRow();
    if (target === "goal") window.localStorage.setItem(reminderKey(user.name, "goal"), "1");
    if (target === "result") window.localStorage.setItem(reminderKey(user.name, "result"), "1");
    setMode(null);
  };

  const closeSoftReminder = () => {
    if (!user?.name || !mode) return;
    if (mode === "goal" && !canSaveGoal) {
      setErrorText("목표를 입력하거나 금일 출장 및 외부활동을 체크해야 팝업을 닫을 수 있습니다.");
      return;
    }
    window.localStorage.setItem(reminderKey(user.name, mode), "1");
    setMode(null);
  };

  const updateWorkItemText = (id: string, text: string) => {
    setWorkItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  const toggleWorkItemDone = (id: string) => {
    setWorkItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const addWorkItem = () => {
    setWorkItems((prev) => [...prev, { id: `task-${Date.now()}-${prev.length + 1}`, text: "", done: false }]);
  };

  const removeWorkItem = (id: string) => {
    setWorkItems((prev) => (prev.length <= 1 ? createEmptyWorkItems() : prev.filter((item) => item.id !== id)));
  };

  if (!isExec || !mode) return null;

  const isGoalMode = mode === "goal";
  const isMidMode = mode === "mid";
  const isResultMode = mode === "result";

  const title = isGoalMode ? "오늘의 목표를 세워볼까요?" : isMidMode ? "오후 중간 체크 시간입니다" : "결과값을 입력할 시간입니다!";
  const message = isGoalMode
    ? "금일의 목표를 정하고, 시간을 잘 분배하여 하루를 알차게 운영해보세요. 오늘의 일과가 끝나면 활동 결과 입력하는 것도 잊지 마시구요!"
    : isMidMode
      ? "금일 계획한 목표를 잘 이루고 계시나요? 결과 입력시간은 17시30분 입니다. 꼭 잊지 말고 다시한번 체크해보세요!"
      : "금일 계획한 업무를 모두 처리했는지 확인하시고 기록해주세요!";

  const mascot = isGoalMode ? "🦊" : isMidMode ? "🐥" : "🦝";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="max-h-[92vh] w-full max-w-[980px] overflow-hidden rounded-[28px] border shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--border-2)", boxShadow: "var(--shadow-lg)" }}
      >
        {intro ? (
          <div className="flex min-h-[430px] flex-col items-center justify-center px-8 py-10 text-center">
            <div
              className="mb-5 flex h-28 w-28 items-center justify-center rounded-[36px] text-[56px] shadow-xl"
              style={{ background: "linear-gradient(135deg,#fef3c7,#f0abfc,#93c5fd)" }}
            >
              {mascot}
            </div>
            <p className="text-[28px] font-[900] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>
              {title}
            </p>
            <p className="mt-3 max-w-[560px] text-[15px] font-[760] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              잠깐 웃고 시작해요. 오늘도 무리하지 말고, 해야 할 일을 하나씩 정리해봅시다.
            </p>
          </div>
        ) : (
          <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] text-[30px]" style={{ background: "var(--accent-subtle)" }}>
                  {mascot}
                </div>
                <div className="min-w-0">
                  <p className="text-[24px] font-[900] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>
                    {title}
                  </p>
                  <p className="mt-2 max-w-[760px] text-[14px] font-[760] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {message}
                  </p>
                </div>
              </div>
              {!isGoalMode && (
                <button
                  type="button"
                  onClick={closeSoftReminder}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {errorText && (
              <div className="mb-4 rounded-[16px] border px-4 py-3 text-[13px] font-[760]" style={{ borderColor: "var(--danger-border)", background: "var(--danger-bg)", color: "var(--danger-text)" }}>
                {errorText}
              </div>
            )}

            {isMidMode ? (
              <div className="space-y-4">
                <div className="rounded-[20px] border p-5" style={{ borderColor: "var(--accent-border)", background: "var(--accent-subtle)" }}>
                  <p className="text-[16px] font-[860]" style={{ color: "var(--accent-text)" }}>
                    남은 시간 체크포인트
                  </p>
                  <p className="mt-2 text-[14px] font-[700] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    오전에 세운 목표를 다시 확인하고, 아직 남은 업무는 우선순위를 다시 잡아보세요.
                  </p>
                </div>
                <div className="rounded-[20px] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <p className="mb-3 text-[13px] font-[860]" style={{ color: "var(--text-strong)" }}>금일 당일활동목표</p>
                  <div className="space-y-2">
                    {activeWorkItems(workItems).length > 0 ? (
                      activeWorkItems(workItems).map((item, index) => (
                        <div key={item.id} className="rounded-[14px] border px-3 py-3 text-[14px] font-[760]" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                          {index + 1}. {item.text}
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] font-[700]" style={{ color: "var(--text-muted)" }}>등록된 텍스트 목표가 없습니다.</p>
                    )}
                  </div>
                </div>
                <button type="button" onClick={closeSoftReminder} className="btn-premium btn-primary w-full justify-center">
                  확인했습니다
                </button>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="space-y-4">
                  {isGoalMode && (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-[18px] border px-4 py-4"
                      style={{ borderColor: outside ? "var(--warning-border)" : "var(--border)", background: outside ? "var(--warning-bg)" : "var(--surface-2)" }}
                    >
                      <input type="checkbox" checked={outside} onChange={(event) => setOutside(event.target.checked)} />
                      <div>
                        <p className="text-[14px] font-[860]" style={{ color: outside ? "var(--warning-text)" : "var(--text)" }}>
                          금일 출장 및 외부활동
                        </p>
                        <p className="mt-1 text-[12px] font-[700]" style={{ color: "var(--text-muted)" }}>
                          체크 후 저장하면 오늘은 외부제외 처리되고 오후 확인/결과입력 팝업이 뜨지 않습니다.
                        </p>
                      </div>
                    </label>
                  )}

                  <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <div className="mb-4 flex items-center gap-2">
                      {isGoalMode ? <Sparkles size={17} /> : <Coffee size={17} />}
                      <p className="text-[14px] font-[860]" style={{ color: "var(--text-strong)" }}>
                        {isGoalMode ? "당일 활동목표 입력" : "퇴근 전 활동결과 입력"}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ACTIVITY_FIELDS.map((field) => (
                        <NumberField
                          key={field.key}
                          label={field.label}
                          value={isGoalMode ? goal[field.key] : result[field.key]}
                          unit={field.unit}
                          disabled={outside}
                          onChange={(value) =>
                            isGoalMode
                              ? setGoal((prev) => ({ ...prev, [field.key]: value }))
                              : setResult((prev) => ({ ...prev, [field.key]: value }))
                          }
                        />
                      ))}
                      <NumberField
                        label={isGoalMode ? "미팅 확정 목표" : "미팅 확정 결과"}
                        value={isGoalMode ? goal.meeting_confirmed : result.meeting_confirmed}
                        unit="건"
                        disabled={outside}
                        onChange={(value) =>
                          isGoalMode
                            ? setGoal((prev) => ({ ...prev, meeting_confirmed: value }))
                            : setResult((prev) => ({ ...prev, meeting_confirmed: value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-[860]" style={{ color: "var(--text-strong)" }}>
                        {isGoalMode ? "당일활동목표" : "당일활동목표 완료체크"}
                      </p>
                      <p className="mt-1 text-[12px] font-[700]" style={{ color: "var(--text-muted)" }}>
                        {isGoalMode ? "처리해야 할 업무를 텍스트로 작성하세요." : "완료 체크 시 텍스트 중간에 선이 표시됩니다."}
                      </p>
                    </div>
                    {isGoalMode && (
                      <button type="button" onClick={addWorkItem} disabled={outside} className="btn-premium btn-secondary h-9 px-3 text-[12px]">
                        <Plus size={14} /> 칸추가
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {workItems.map((item, index) => {
                      const hasText = item.text.trim().length > 0;
                      return (
                        <div key={item.id} className="flex items-center gap-2 rounded-[14px] border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                          <span className="w-5 shrink-0 text-[13px] font-[860]" style={{ color: "var(--text-muted)" }}>{index + 1}.</span>
                          {isGoalMode ? (
                            <input
                              value={item.text}
                              disabled={outside}
                              onChange={(event) => updateWorkItemText(item.id, event.target.value)}
                              placeholder="오늘 처리할 업무를 입력하세요"
                              className="min-w-0 flex-1 bg-transparent text-[14px] font-[740] outline-none disabled:opacity-45"
                              style={{ color: "var(--text)" }}
                            />
                          ) : (
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                              <input type="checkbox" checked={item.done} disabled={!hasText || outside} onChange={() => toggleWorkItemDone(item.id)} />
                              <span className={`min-w-0 flex-1 text-[14px] font-[760] ${item.done ? "line-through" : ""}`} style={{ color: item.done ? "var(--text-faint)" : "var(--text)" }}>
                                {hasText ? item.text : "입력된 업무가 없습니다"}
                              </span>
                            </label>
                          )}
                          {isGoalMode && (
                            <button type="button" onClick={() => removeWorkItem(item.id)} disabled={outside || workItems.length <= 1} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border disabled:opacity-35" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="xl:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {isResultMode && (
                    <button type="button" onClick={closeSoftReminder} className="btn-premium btn-secondary justify-center">
                      잠시 후 입력
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => saveRecord(isGoalMode ? "goal" : "result")}
                    disabled={saving || (isGoalMode && !canSaveGoal)}
                    className="btn-premium btn-primary justify-center disabled:opacity-45"
                  >
                    {saving ? <Clock3 size={16} className="animate-spin" /> : isGoalMode ? <Save size={16} /> : <CheckCircle2 size={16} />}
                    {isGoalMode ? (outside ? "외부제외 저장" : "목표 저장하고 시작하기") : "결과 저장하기"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
