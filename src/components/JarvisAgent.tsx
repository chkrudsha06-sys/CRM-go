"use client";

import type { CRMUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trash2,
  Truck,
  UsersRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent,
} from "react";

type JarvisStatus = "idle" | "talk" | "thinking";

type JarvisMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type JarvisAgentProps = {
  user: CRMUser;
};

type JarvisAction = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: ElementType;
};

const JARVIS_ACTIONS: JarvisAction[] = [
  {
    id: "today_briefing",
    label: "오늘 브리핑",
    description: "일정·고객·매출·업무요청 요약",
    icon: Sparkles,
    prompt:
      "자비스, 오늘 CRM 기준으로 내가 확인해야 할 일정, 고객관리 포인트, 이번달 매출 흐름, 최근 업무요청, 완판트럭 일정을 한 번에 브리핑해줘. 마지막에는 오늘 우선순위 TOP 5를 정리해줘.",
  },
  {
    id: "inactive_customers",
    label: "관리 누락 고객",
    description: "최근 활동노트가 뜸한 고객 추출",
    icon: UsersRound,
    prompt:
      "자비스, CRM 고객 중 최근 활동이 뜸하거나 관리 누락 가능성이 높은 고객을 담당자별로 정리해줘. 최근 활동일, 미팅결과, 가망구분, 후속조치까지 함께 알려줘.",
  },
  {
    id: "sales_analysis",
    label: "이번달 매출 분석",
    description: "담당자·채널별 매출 흐름 분석",
    icon: BarChart3,
    prompt:
      "자비스, 이번달 통합매출관리 기준으로 매출 현황을 담당자별, 채널별로 정리해줘. 특이사항, 부족한 부분, 추가로 챙겨야 할 매출 포인트도 알려줘.",
  },
  {
    id: "task_summary",
    label: "최근 업무요청",
    description: "업무요청 미처리·진행사항 정리",
    icon: ClipboardList,
    prompt:
      "자비스, 최근 업무요청을 요청자, 담당자, 상태별로 정리해줘. 미처리 또는 확인이 필요한 항목을 우선순위로 알려줘.",
  },
  {
    id: "wanpan_schedule",
    label: "완판트럭 일정",
    description: "이번주 출동·발주 상태 확인",
    icon: Truck,
    prompt:
      "자비스, 이번주와 최근 완판트럭 일정을 정리해줘. 현장명, 위치, 대행사, 인원, 발주 여부 기준으로 확인해야 할 내용을 알려줘.",
  },
  {
    id: "calendar_review",
    label: "일정 점검",
    description: "캘린더·미팅 일정 확인",
    icon: CalendarDays,
    prompt:
      "자비스, 이번주 CRM 캘린더와 고객 미팅 일정을 정리해줘. 오늘 확인할 일정과 담당자별 체크포인트를 알려줘.",
  },
  {
    id: "priority_actions",
    label: "우선순위 추천",
    description: "지금 바로 해야 할 일 추천",
    icon: Target,
    prompt:
      "자비스, 현재 CRM 데이터를 기준으로 지금 바로 해야 할 업무 우선순위를 추천해줘. 고객관리, 매출, 일정, 업무요청으로 구분해서 실행 순서대로 알려줘.",
  },
];

const STATUS_IMAGE: Record<JarvisStatus, string> = {
  idle: "/jarvis/jarvis-idle.png",
  talk: "/jarvis/jarvis-talk.png",
  thinking: "/jarvis/jarvis-thinking.png",
};

function getNowLabel() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "알 수 없는 오류가 발생했습니다.";
}

function buildWelcomeMessage(user: CRMUser) {
  return `${user.name}님, 자비스 대기 중입니다.\n오늘 브리핑, 관리 누락 고객, 매출 분석, 업무요청 정리를 바로 도와드릴 수 있습니다.`;
}

export default function JarvisAgent({ user }: JarvisAgentProps) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showQuickButtons, setShowQuickButtons] = useState(false);
  const [agentMode, setAgentMode] = useState<string | null>(null); // 현재 에이전트 작업 모드
  const [agentForm, setAgentForm] = useState<Record<string, string>>({}); // 에이전트 양식 값
  const [agentSaving, setAgentSaving] = useState(false);
  const [status, setStatus] = useState<JarvisStatus>("idle");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastActionId, setLastActionId] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [messages, setMessages] = useState<JarvisMessage[]>([
    {
      role: "assistant",
      content: buildWelcomeMessage(user),
      timestamp: getNowLabel(),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const talkTimerRef = useRef<number | null>(null);

  const currentImage = STATUS_IMAGE[status];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("jarvis-hidden");
      if (saved === "true") {
        setHidden(true);
        setOpen(false);
      }
    } catch {
      // localStorage 접근이 제한된 환경에서는 기본 표시 상태를 유지합니다.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("jarvis-hidden", hidden ? "true" : "false");
    } catch {
      // localStorage 접근이 제한된 환경에서는 현재 세션 상태만 사용합니다.
    }
  }, [hidden]);

  const panelSizeClass = useMemo(() => {
    if (expanded) {
      return "w-[min(1000px,calc(100vw-32px))] h-[calc(100vh-80px)]";
    }
    return "w-[min(540px,calc(100vw-24px))] h-[calc(100vh-100px)] max-h-[860px]";
  }, [expanded]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    return () => {
      if (talkTimerRef.current) window.clearTimeout(talkTimerRef.current);
    };
  }, []);

  const updateTalkState = () => {
    setStatus("talk");
    if (talkTimerRef.current) window.clearTimeout(talkTimerRef.current);
    talkTimerRef.current = window.setTimeout(() => {
      setStatus("idle");
    }, 3200);
  };

  const sendMessage = async (preset?: string, actionId?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;

    setHidden(false);
    setOpen(true);
    setInput("");
    setLastActionId(actionId || null);

    // ── 에이전트 모드 키워드 감지 (유연하게) ──
    const lowerText = text.toLowerCase();
    const isDailyGoal =
      lowerText.includes("일별활동") ||
      lowerText.includes("활동목표") ||
      lowerText.includes("활동 목표") ||
      lowerText.includes("목표 등록") ||
      lowerText.includes("목표등록") ||
      lowerText.includes("오늘 목표") ||
      lowerText.includes("오늘목표") ||
      lowerText.includes("tm 목표") ||
      lowerText.includes("tm목표") ||
      lowerText.includes("콜드톡 목표") ||
      lowerText.includes("브론즈 목표") ||
      (lowerText.includes("목표") && (lowerText.includes("넣") || lowerText.includes("등록") || lowerText.includes("입력") || lowerText.includes("설정") || lowerText.includes("할게") || lowerText.includes("하자") || lowerText.includes("해줘")));
    const isCustomerDbAdd =
      lowerText.includes("고객db") ||
      lowerText.includes("고객 db") ||
      lowerText.includes("고객디비") ||
      lowerText.includes("고객 디비") ||
      lowerText.includes("고객등록") ||
      lowerText.includes("고객 등록") ||
      lowerText.includes("db 입력") ||
      lowerText.includes("db입력") ||
      lowerText.includes("디비 입력") ||
      lowerText.includes("디비입력") ||
      lowerText.includes("신규 고객") ||
      lowerText.includes("신규고객") ||
      lowerText.includes("tm 등록") ||
      lowerText.includes("tm등록") ||
      lowerText.includes("콜드톡 등록") ||
      lowerText.includes("콜드톡등록") ||
      (lowerText.includes("고객") && (lowerText.includes("추가") || lowerText.includes("넣") || lowerText.includes("입력") || lowerText.includes("올려") || lowerText.includes("저장")));

    if (isCustomerDbAdd && !isDailyGoal) {
      const userMsg: JarvisMessage = { role: "user", content: text, timestamp: getNowLabel() };
      const agentMsg: JarvisMessage = {
        role: "assistant",
        content: `__AGENT_CUSTOMER_DB__`,
        timestamp: getNowLabel(),
      };
      setMessages((prev) => [...prev, userMsg, agentMsg]);
      setAgentMode("customer_db");
      setAgentForm({ name: "", title: "", phone: "", intakeRoute: "", activityType: "TM", memo: "", firstNote: "" });
      updateTalkState();
      return;
    }

    if (isDailyGoal) {
      const today = new Date().toISOString().slice(0, 10);
      const userMsg: JarvisMessage = { role: "user", content: text, timestamp: getNowLabel() };
      const agentMsg: JarvisMessage = {
        role: "assistant",
        content: `__AGENT_DAILY_GOAL__:${today}`,
        timestamp: getNowLabel(),
      };
      setMessages((prev) => [...prev, userMsg, agentMsg]);
      setAgentMode("daily_goal");
      setAgentForm({ tm: "", coldtalk: "", bronze: "", onePercent: "", special1: "", special2: "", special3: "" });
      updateTalkState();
      return;
    }

    const userMessage: JarvisMessage = {
      role: "user",
      content: text,
      timestamp: getNowLabel(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);
    setStatus("thinking");

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          task: actionId || null,
          user: {
            name: user.name,
            title: user.title,
            role: user.role,
          },
          history: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "자비스 응답 생성에 실패했습니다.");
      }

      const assistantMessage: JarvisMessage = {
        role: "assistant",
        content: data?.reply || "응답을 받을 수 없습니다.",
        timestamp: getNowLabel(),
      };

      setMessages([...nextMessages, assistantMessage]);
      updateTalkState();
    } catch (error) {
      const assistantMessage: JarvisMessage = {
        role: "assistant",
        content: `⚠️ 자비스 연결 중 문제가 발생했습니다.\n${normalizeErrorMessage(error)}`,
        timestamp: getNowLabel(),
      };
      setMessages([...nextMessages, assistantMessage]);
      setStatus("idle");
    } finally {
      setLoading(false);
      setLastActionId(null);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const resetChat = () => {
    if (!confirm("자비스 대화 내용을 초기화할까요?")) return;
    setMessages([
      {
        role: "assistant",
        content: buildWelcomeMessage(user),
        timestamp: getNowLabel(),
      },
    ]);
    setStatus("idle");
    setLastActionId(null);
  };

  const closePanel = () => {
    setOpen(false);
    setExpanded(false);
    setStatus("idle");
  };

  const hideJarvis = () => {
    setOpen(false);
    setExpanded(false);
    setStatus("idle");
    setHidden(true);
  };

  const showJarvis = () => {
    setHidden(false);
    window.setTimeout(() => setOpen(true), 80);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <section
        className={`pointer-events-auto absolute bottom-[80px] right-4 overflow-hidden rounded-[28px] shadow-2xl transition-all duration-300 ease-out md:right-6 ${panelSizeClass} ${
          open && !hidden
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[115%] opacity-0"
        }`}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.22), inset -1px 0 0 rgba(255,255,255,0.015)",
        }}
        aria-hidden={!open}
      >


        <div className="relative flex h-full min-h-0 flex-col">
          <header className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                {imageFailed ? (
                  <Bot size={24} className="text-sky-200" />
                ) : (
                  <img
                    src={currentImage}
                    alt="JARVIS"
                    onError={() => setImageFailed(true)}
                    className="h-12 w-12 object-contain drop-shadow-[0_0_16px_rgba(56,189,248,0.45)]"
                  />
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${loading ? "animate-pulse bg-sky-300" : "bg-emerald-400"}`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[15px] font-black tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>
                    JARVIS
                  </h2>
                  <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[10px] font-black text-sky-200">
                    CRM AGENT
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>
                  {user.name}님 전용 CRM 운영 에이전트
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowQuickButtons((prev) => !prev)}
                className={`flex h-8 items-center gap-1 rounded-xl px-2 text-[11px] font-bold transition ${showQuickButtons ? "bg-sky-400/20 text-sky-200 ring-1 ring-sky-300/30" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                aria-label="퀵버튼 토글"
                title="업무 퀵버튼"
              >
                <Sparkles size={13} />
                퀵버튼
              </button>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10" style={{ color: "var(--text-muted)" }}
                aria-label={expanded ? "작게 보기" : "크게 보기"}
              >
                {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                onClick={resetChat}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10" style={{ color: "var(--text-muted)" }}
                aria-label="대화 초기화"
                title="대화 초기화"
              >
                <RefreshCw size={14} />
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10" style={{ color: "var(--text-muted)" }}
                aria-label="자비스 패널만 접기"
                title="패널 접기"
              >
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                onClick={hideJarvis}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10" style={{ color: "var(--text-muted)" }}
                aria-label="자비스 완전히 숨기기"
                title="자비스 숨기기"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          {showQuickButtons && (
            <div className="relative px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div
                className={`grid gap-2 ${expanded ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2"}`}
              >
                {JARVIS_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const active = loading && lastActionId === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => { void sendMessage(action.prompt, action.id); setShowQuickButtons(false); }}
                      disabled={loading}
                      className={`group min-w-0 rounded-2xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                        active
                          ? "border-sky-300/45 bg-sky-300/15"
                          : "border-white/10 bg-white/[0.07] hover:border-sky-300/35 hover:bg-sky-300/10"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200 ring-1 ring-sky-300/15">
                          {active ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Icon size={14} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-black text-slate-100">
                          {action.label}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[10.5px] font-semibold leading-relaxed text-slate-400">
                        {action.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 jarvis-scrollbar">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
                      <Bot size={15} className="text-sky-200" />
                    </div>
                  )}

                  <div
                    className={`max-w-[84%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}
                  >
                    {/* 에이전트 양식: 일별활동 목표 */}
                    {message.content.startsWith("__AGENT_DAILY_GOAL__") ? (
                      <div className="rounded-2xl rounded-bl-md border border-sky-300/30 p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--accent-border)", minWidth: 260 }}>
                        <p className="mb-3 text-[13px] font-black text-sky-200">일별활동 목표 등록</p>
                        <p className="mb-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>{message.content.split(":")[1]} 기준으로 저장됩니다.</p>
                        <div className="space-y-2.5">
                          {[
                            { key: "tm", label: "당일 TM 목표", unit: "건" },
                            { key: "coldtalk", label: "콜드톡 목표", unit: "건" },
                            { key: "bronze", label: "브론즈DB 확보 목표", unit: "개" },
                            { key: "onePercent", label: "1% DB 확보 목표", unit: "개" },
                          ].map((field) => (
                            <div key={field.key} className="flex items-center gap-2">
                              <span className="w-[130px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{field.label}</span>
                              <input
                                type="number"
                                min="0"
                                value={agentForm[field.key] || ""}
                                onChange={(e) => setAgentForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                className="w-16 rounded-lg px-2 py-1.5 text-center text-[13px] font-bold outline-none"
                                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-strong)" }}
                                placeholder="0"
                              />
                              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{field.unit}</span>
                            </div>
                          ))}
                        </div>

                        {/* 특발성 활동목표 */}
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[11px] font-bold" style={{ color: "var(--text-subtle)" }}>특발성 활동목표 (텍스트 입력)</p>
                          {["special1", "special2", "special3"].map((key, i) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="w-4 shrink-0 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>{i + 1}</span>
                              <input
                                type="text"
                                value={agentForm[key] || ""}
                                onChange={(e) => setAgentForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                className="flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold outline-none"
                                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-strong)" }}
                                placeholder={`오늘 처리할 과업 ${i + 1}`}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              disabled={agentSaving}
                              onClick={async () => {
                                if (!user?.name) { alert("로그인 정보가 없습니다."); return; }
                                const today = message.content.split(":")[1];
                                setAgentSaving(true);
                                try {
                                  const { error } = await supabase.from("daily_activity_goals").upsert({
                                    work_date: today,
                                    owner_name: user.name,
                                    owner_title: user.title || "",
                                    owner_role: "exec",
                                    goal_new_tm: Number(agentForm.tm) || 0,
                                    goal_coldtalk: Number(agentForm.coldtalk) || 0,
                                    goal_consultant_db: Number(agentForm.bronze) || 0,
                                    goal_second_touch: Number(agentForm.onePercent) || 0,
                                    goal_manage_tm: 0,
                                    goal_media_mix: 0,
                                    goal_meeting_confirmed: 0,
                                    is_outside_meeting: false,
                                    goal_work_items: [
                                      { id: `task-${Date.now()}-1`, text: agentForm.special1 || "", done: false },
                                      { id: `task-${Date.now()}-2`, text: agentForm.special2 || "", done: false },
                                      { id: `task-${Date.now()}-3`, text: agentForm.special3 || "", done: false },
                                    ],
                                  }, { onConflict: "work_date,owner_name" });
                                  if (error) throw error;
                                  setMessages((prev) => [...prev, {
                                    role: "assistant",
                                    content: `${today} 일별활동 목표가 저장됐습니다.

TM ${agentForm.tm || 0}건 / 콜드톡 ${agentForm.coldtalk || 0}건 / 브론즈DB ${agentForm.bronze || 0}개 / 1%DB ${agentForm.onePercent || 0}개

특발성: ${[agentForm.special1, agentForm.special2, agentForm.special3].filter(Boolean).join(" / ") || "없음"}

일별활동기록 메뉴에서 확인하실 수 있습니다.`,
                                    timestamp: getNowLabel(),
                                  }]);
                                  setAgentMode(null);
                                  setAgentForm({});
                                } catch (err: any) {
                                  alert("저장 실패: " + (err?.message || "오류 발생"));
                                } finally {
                                  setAgentSaving(false);
                                }
                              }}
                              className="flex-1 rounded-xl py-2 text-[12px] font-black text-white transition"
                              style={{ background: agentSaving ? "rgba(56,189,248,0.3)" : "rgba(56,189,248,0.7)" }}
                            >
                              {agentSaving ? "저장 중..." : "저장"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAgentMode(null); setAgentForm({}); }}
                              className="rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-400 transition hover:text-white"
                              style={{ background: "rgba(255,255,255,0.05)" }}
                            >
                              취소
                            </button>
                        </div>
                      </div>
                    ) : message.content === "__AGENT_CUSTOMER_DB__" ? (
                      <div className="rounded-2xl rounded-bl-md p-4" style={{ border: "1px solid var(--accent-border)", background: "var(--surface-2)", minWidth: 280 }}>
                        <p className="mb-1 text-[13px] font-black" style={{ color: "var(--accent-text)" }}>고객DB 신규 등록</p>
                        <p className="mb-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>* 표시는 필수 항목입니다</p>
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>고객명 *</span>
                            <input type="text" value={agentForm.name || ""} onChange={(e) => setAgentForm((p) => ({ ...p, name: e.target.value }))} className="flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-strong)" }} placeholder="홍길동" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>직급</span>
                            <div className="flex gap-1.5">
                              {["본부장","팀장","팀원"].map((t) => (
                                <button key={t} type="button" onClick={() => setAgentForm((p) => ({ ...p, title: t }))} className="rounded-lg px-2.5 py-1 text-[11px] font-bold transition" style={{ background: agentForm.title === t ? "var(--accent-subtle)" : "var(--surface)", border: "1px solid " + (agentForm.title === t ? "var(--accent-border)" : "var(--border)"), color: agentForm.title === t ? "var(--accent-text)" : "var(--text-muted)" }}>{t}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>연락처 *</span>
                            <input type="tel" value={agentForm.phone || ""} onChange={(e) => setAgentForm((p) => ({ ...p, phone: e.target.value }))} className="flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-strong)" }} placeholder="010-0000-0000" />
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-1 w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>유입경로 *</span>
                            <div className="flex flex-wrap gap-1.5">
                              {["분양의신DB","컨설턴트VIP DB","완판트럭","분양라인","분양회MGM","대협팀활동"].map((r) => (
                                <button key={r} type="button" onClick={() => setAgentForm((p) => ({ ...p, intakeRoute: r }))} className="rounded-lg px-2 py-1 text-[11px] font-bold transition" style={{ background: agentForm.intakeRoute === r ? "var(--accent-subtle)" : "var(--surface)", border: "1px solid " + (agentForm.intakeRoute === r ? "var(--accent-border)" : "var(--border)"), color: agentForm.intakeRoute === r ? "var(--accent-text)" : "var(--text-muted)" }}>{r}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>활동항목 *</span>
                            <div className="flex gap-1.5">
                              {["TM","콜드톡"].map((t) => (
                                <button key={t} type="button" onClick={() => setAgentForm((p) => ({ ...p, activityType: t }))} className="rounded-lg px-3 py-1 text-[11px] font-bold transition" style={{ background: (agentForm.activityType || "TM") === t ? "var(--accent-subtle)" : "var(--surface)", border: "1px solid " + ((agentForm.activityType || "TM") === t ? "var(--accent-border)" : "var(--border)"), color: (agentForm.activityType || "TM") === t ? "var(--accent-text)" : "var(--text-muted)" }}>{t}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-1 w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>활동내용</span>
                            <textarea value={agentForm.firstNote || ""} onChange={(e) => setAgentForm((p) => ({ ...p, firstNote: e.target.value }))} rows={2} className="flex-1 resize-none rounded-lg px-2.5 py-1.5 text-[12px] font-semibold outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-strong)" }} placeholder="TM 통화 내용 (선택)" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>메모</span>
                            <input type="text" value={agentForm.memo || ""} onChange={(e) => setAgentForm((p) => ({ ...p, memo: e.target.value }))} className="flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-strong)" }} placeholder="특이사항 (선택)" />
                          </div>
                        </div>
                        {agentMode === "customer_db" && (
                          <div className="mt-4 flex gap-2">
                            <button type="button" disabled={agentSaving}
                              onClick={async () => {
                                if (!agentForm.name?.trim()) { alert("고객명을 입력해주세요."); return; }
                                if (!agentForm.phone?.trim()) { alert("연락처를 입력해주세요."); return; }
                                if (!agentForm.intakeRoute) { alert("유입경로를 선택해주세요."); return; }
                                setAgentSaving(true);
                                try {
                                  const now = new Date().toISOString();
                                  const todayStr = now.slice(0, 10);
                                  const phoneDigits = agentForm.phone.replace(/[^0-9]/g, "");
                                  const { data: allContacts } = await supabase.from("contacts").select("id,phone,customer_phone").limit(3000);
                                  let existingId: number | null = null;
                                  if (allContacts) {
                                    const found = (allContacts as any[]).find((c: any) =>
                                      (c.phone || "").replace(/[^0-9]/g,"") === phoneDigits ||
                                      (c.customer_phone || "").replace(/[^0-9]/g,"") === phoneDigits
                                    );
                                    existingId = found?.id || null;
                                  }
                                  const payload = {
                                    name: agentForm.name.trim(),
                                    title: agentForm.title || "",
                                    phone: agentForm.phone.trim(),
                                    customer_phone: agentForm.phone.trim(),
                                    intake_route: agentForm.intakeRoute,
                                    management_stage: "리드",
                                    customer_grade: "심사미진행",
                                    memo: agentForm.memo?.trim() || "",
                                    activity_type: agentForm.activityType || "TM",
                                    crm_db_source: "customer_db",
                                    assigned_to: user.name,
                                    updated_at: now,
                                  };
                                  let contactId: number | null = null;
                                  if (existingId) {
                                    await supabase.from("contacts").update(payload).eq("id", existingId);
                                    contactId = existingId;
                                  } else {
                                    const { data: newContact } = await supabase.from("contacts").insert({ ...payload, created_at: now }).select("id").single();
                                    contactId = (newContact as any)?.id || null;
                                  }
                                  if (contactId && agentForm.firstNote?.trim()) {
                                    const noteContent = `[${agentForm.activityType || "TM"}] ${agentForm.firstNote.trim()}`;
                                    await supabase.from("contact_notes").insert({ contact_id: contactId, note_date: todayStr, content: noteContent, author: user.name });
                                  }
                                  setMessages((prev) => [...prev, {
                                    role: "assistant" as const,
                                    content: `고객DB 등록 완료\n\n${agentForm.name} ${agentForm.title || ""} | ${agentForm.phone}\n유입경로: ${agentForm.intakeRoute} | 활동항목: ${agentForm.activityType || "TM"}\n${agentForm.firstNote?.trim() ? "활동내용: " + agentForm.firstNote.trim() : ""}\n\n고객DB 메뉴에서 확인하실 수 있습니다.`,
                                    timestamp: getNowLabel(),
                                  }]);
                                  setAgentMode(null);
                                  setAgentForm({});
                                } catch (err: any) {
                                  alert("저장 실패: " + (err?.message || "오류"));
                                } finally {
                                  setAgentSaving(false);
                                }
                              }}
                              className="flex-1 rounded-xl py-2 text-[12px] font-black text-white transition"
                              style={{ background: agentSaving ? "var(--accent-subtle)" : "var(--accent)" }}>
                              {agentSaving ? "저장 중..." : "고객DB 등록"}
                            </button>
                            <button type="button" onClick={() => { setAgentMode(null); setAgentForm({}); }} className="rounded-xl px-3 py-2 text-[12px] font-semibold transition" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>취소</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12px] font-medium leading-relaxed ${
                          message.role === "user"
                            ? "rounded-br-md bg-sky-500 text-white"
                            : "rounded-bl-md"
                        }`}
                      >
                        {message.content}
                      </div>
                    )}
                    <span className="mt-1 px-1 text-[10px] font-semibold" style={{ color: "var(--text-faint)" }}>
                      {message.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start gap-2.5">
                  <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
                    <Loader2 size={15} className="animate-spin text-sky-200" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[12px] font-bold" style={{ border: "1px solid var(--border-subtle)", background: "var(--surface-2)", color: "var(--text-subtle)" }}>
                    CRM 데이터를 읽고 우선순위를 계산하고 있습니다...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="p-3" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 rounded-2xl px-3 py-2" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={loading}
                  placeholder="자비스에게 CRM 업무를 물어보세요..."
                  className="max-h-24 min-h-[28px] w-full resize-none border-none bg-transparent text-[12px] font-semibold leading-relaxed outline-none" style={{ color: "var(--text-strong)" }}
                />
              </div>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || loading}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-950/30 transition hover:-translate-y-0.5 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                aria-label="자비스에게 보내기"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] font-medium text-slate-500">
                Enter 전송 · Shift+Enter 줄바꿈
              </p>
              <button
                type="button"
                onClick={resetChat}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-500 transition hover:text-slate-200"
              >
                <Trash2 size={11} /> 초기화
              </button>
            </div>
          </footer>
        </div>
      </section>

      <div
        className={`pointer-events-auto absolute bottom-5 right-4 flex flex-col items-center gap-1 outline-none transition-all duration-500 ease-out md:right-6 ${
          hidden
            ? "pointer-events-none translate-x-[150%] opacity-0"
            : "translate-x-0 opacity-100"
        }`}
        aria-hidden={hidden}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex flex-col items-center gap-1 outline-none transition hover:-translate-y-1 jarvis-floating-button"
            aria-label="자비스 열기"
            title="JARVIS 자비스"
          >
            <div
              className="relative flex h-[92px] w-[92px] items-center justify-center rounded-[28px] border border-sky-300/25 bg-slate-950/80 shadow-2xl transition md:h-[104px] md:w-[104px]"
              style={{
                boxShadow:
                  "0 16px 55px rgba(2, 132, 199, 0.28), 0 0 0 1px rgba(255,255,255,0.08) inset",
                backdropFilter: "blur(18px)",
              }}
            >
              <span className="absolute inset-2 rounded-[22px] bg-sky-400/10 blur-xl" />
              {imageFailed ? (
                <Bot
                  size={44}
                  className="relative text-sky-200 drop-shadow-[0_0_20px_rgba(56,189,248,0.55)]"
                />
              ) : (
                <img
                  src={currentImage}
                  alt="JARVIS"
                  onError={() => setImageFailed(true)}
                  className="relative h-[94px] w-[94px] object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.55)] md:h-[110px] md:w-[110px]"
                />
              )}
              {loading && (
                <span className="absolute right-2 top-2 h-3 w-3 animate-pulse rounded-full bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.9)]" />
              )}
            </div>

            <div className="hidden rounded-full border border-sky-300/25 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-sky-100 shadow-lg backdrop-blur md:flex">
              <MessageCircle size={12} className="mr-1.5" /> JARVIS
            </div>
          </button>

          <button
            type="button"
            onClick={hideJarvis}
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-sky-300/25 bg-slate-950/90 text-sky-100 shadow-lg backdrop-blur transition hover:translate-x-0.5 hover:bg-sky-500 hover:text-white"
            aria-label="자비스를 오른쪽으로 숨기기"
            title="자비스 숨기기"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {hidden && (
        <button
          type="button"
          onClick={showJarvis}
          className="pointer-events-auto absolute bottom-8 right-0 flex h-16 w-8 translate-x-1 items-center justify-center rounded-l-2xl border border-r-0 border-sky-300/25 bg-slate-950/90 text-sky-100 shadow-2xl backdrop-blur transition hover:translate-x-0 hover:bg-sky-500 hover:text-white md:bottom-10"
          aria-label="숨긴 자비스 다시 열기"
          title="자비스 다시 열기"
        >
          <ChevronRight size={15} className="rotate-180" />
        </button>
      )}

      <style jsx>{`
        @keyframes jarvisFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        .jarvis-floating-button > div:first-child {
          animation: jarvisFloat 3.8s ease-in-out infinite;
        }

        .jarvis-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .jarvis-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(125, 211, 252, 0.22);
          border-radius: 999px;
        }

        .jarvis-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
