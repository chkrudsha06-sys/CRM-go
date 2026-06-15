"use client";

import type { CRMUser } from "@/lib/auth";
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
      return "w-[min(1000px,calc(100vw-32px))] h-[min(860px,calc(100vh-80px))]";
    }
    return "w-[min(540px,calc(100vw-24px))] h-[min(800px,calc(100vh-100px))]";
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
        className={`pointer-events-auto absolute bottom-[116px] right-4 overflow-hidden rounded-[28px] shadow-2xl transition-all duration-300 ease-out md:right-6 ${panelSizeClass} ${
          open && !hidden
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[115%] opacity-0"
        }`}
        style={{
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.97), rgba(15, 23, 42, 0.93))",
          border: "1px solid rgba(125, 211, 252, 0.28)",
          boxShadow:
            "0 24px 80px rgba(15, 23, 42, 0.36), 0 0 0 1px rgba(255,255,255,0.06) inset",
          backdropFilter: "blur(22px)",
        }}
        aria-hidden={!open}
      >
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -left-16 bottom-16 h-44 w-44 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative flex h-full min-h-0 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
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
                  <h2 className="truncate text-[15px] font-black tracking-[-0.03em] text-white">
                    JARVIS
                  </h2>
                  <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[10px] font-black text-sky-200">
                    CRM AGENT
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-300">
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
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label={expanded ? "작게 보기" : "크게 보기"}
              >
                {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                onClick={resetChat}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="대화 초기화"
                title="대화 초기화"
              >
                <RefreshCw size={14} />
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="자비스 패널만 접기"
                title="패널 접기"
              >
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                onClick={hideJarvis}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="자비스 완전히 숨기기"
                title="자비스 숨기기"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          {showQuickButtons && (
            <div className="relative border-b border-white/10 px-4 py-3">
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
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-sky-300/10 ring-1 ring-sky-300/20">
                      <Bot size={15} className="text-sky-200" />
                    </div>
                  )}

                  <div
                    className={`max-w-[84%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}
                  >
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12px] font-medium leading-relaxed ${
                        message.role === "user"
                          ? "rounded-br-md bg-sky-500 text-white"
                          : "rounded-bl-md border border-white/10 bg-white/[0.08] text-slate-100"
                      }`}
                    >
                      {message.content}
                    </div>
                    <span className="mt-1 px-1 text-[10px] font-semibold text-slate-500">
                      {message.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start gap-2.5">
                  <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-sky-300/10 ring-1 ring-sky-300/20">
                    <Loader2 size={15} className="animate-spin text-sky-200" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.08] px-3.5 py-2.5 text-[12px] font-bold text-slate-300">
                    CRM 데이터를 읽고 우선순위를 계산하고 있습니다...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="border-t border-white/10 p-3">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 focus-within:border-sky-300/45">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={loading}
                  placeholder="자비스에게 CRM 업무를 물어보세요..."
                  className="max-h-24 min-h-[28px] w-full resize-none border-none bg-transparent text-[12px] font-semibold leading-relaxed text-white outline-none placeholder:text-slate-500"
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
