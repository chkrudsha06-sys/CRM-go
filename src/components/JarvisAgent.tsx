"use client";

import type { CRMUser } from "@/lib/auth";
import { Bot, ChevronRight, Loader2, Maximize2, MessageCircle, Minimize2, Send, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type JarvisStatus = "idle" | "talk" | "thinking";

type JarvisMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type JarvisAgentProps = {
  user: CRMUser;
};

const QUICK_COMMANDS = [
  "자비스, 오늘 내가 봐야 할 것 정리해줘",
  "자비스, 최근 관리가 필요한 고객 알려줘",
  "자비스, 이번달 매출 담당자별로 정리해줘",
  "자비스, 최근 업무요청 정리해줘",
  "자비스, 이번주 완판트럭 일정 알려줘",
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

export default function JarvisAgent({ user }: JarvisAgentProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<JarvisStatus>("idle");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<JarvisMessage[]>([
    {
      role: "assistant",
      content: "안녕하세요. 저는 CRM 운영 에이전트 자비스입니다. 오늘 브리핑, 고객관리, 매출분석, 업무요청 정리를 도와드릴게요.",
      timestamp: getNowLabel(),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const talkTimerRef = useRef<number | null>(null);

  const currentImage = STATUS_IMAGE[status];

  const panelSizeClass = useMemo(() => {
    if (expanded) {
      return "w-[min(860px,calc(100vw-32px))] h-[min(760px,calc(100vh-92px))]";
    }
    return "w-[min(430px,calc(100vw-32px))] h-[min(660px,calc(100vh-116px))]";
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
    }, 2600);
  };

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;

    setOpen(true);
    setInput("");

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
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        content: "대화 내용을 초기화했습니다. 다시 필요한 내용을 말씀해주세요.",
        timestamp: getNowLabel(),
      },
    ]);
    setStatus("idle");
  };

  const closePanel = () => {
    setOpen(false);
    setExpanded(false);
    setStatus("idle");
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <section
        className={`pointer-events-auto absolute bottom-[116px] right-4 overflow-hidden rounded-[26px] shadow-2xl transition-all duration-300 ease-out md:right-6 ${panelSizeClass} ${
          open ? "translate-x-0 opacity-100" : "translate-x-[115%] opacity-0"
        }`}
        style={{
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.92))",
          border: "1px solid rgba(125, 211, 252, 0.28)",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.36), 0 0 0 1px rgba(255,255,255,0.06) inset",
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
                <img src={currentImage} alt="JARVIS" className="h-12 w-12 object-contain drop-shadow-[0_0_16px_rgba(56,189,248,0.45)]" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[15px] font-black tracking-[-0.03em] text-white">JARVIS</h2>
                  <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[10px] font-black text-sky-200">CRM AGENT</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-300">{user.name}님 전용 CRM 운영 에이전트</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
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
                onClick={closePanel}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="자비스 접기"
                title="접기"
              >
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="자비스 닫기"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          <div className="relative border-b border-white/10 px-4 py-3">
            <div className="flex items-start gap-3 rounded-2xl border border-sky-300/15 bg-white/[0.06] p-3">
              <Sparkles className="mt-0.5 flex-shrink-0 text-sky-300" size={16} />
              <div className="min-w-0">
                <p className="text-[12px] font-black text-white">자비스 빠른 명령</p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-300">
                  CRM 데이터를 기준으로 오늘 브리핑, 고객관리, 매출, 업무요청을 분석합니다.
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 jarvis-scrollbar">
              {QUICK_COMMANDS.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => void sendMessage(command)}
                  disabled={loading}
                  className="flex-shrink-0 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:border-sky-300/35 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {command.replace("자비스, ", "")}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 jarvis-scrollbar">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div key={`${message.timestamp}-${index}`} className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-sky-300/10 ring-1 ring-sky-300/20">
                      <Bot size={15} className="text-sky-200" />
                    </div>
                  )}

                  <div className={`max-w-[84%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12px] font-medium leading-relaxed ${
                        message.role === "user" ? "rounded-br-md bg-sky-500 text-white" : "rounded-bl-md border border-white/10 bg-white/[0.08] text-slate-100"
                      }`}
                    >
                      {message.content}
                    </div>
                    <span className="mt-1 px-1 text-[10px] font-semibold text-slate-500">{message.timestamp}</span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start gap-2.5">
                  <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-sky-300/10 ring-1 ring-sky-300/20">
                    <Loader2 size={15} className="animate-spin text-sky-200" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.08] px-3.5 py-2.5 text-[12px] font-bold text-slate-300">
                    CRM 데이터를 분석하고 있습니다...
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
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] font-medium text-slate-500">Enter 전송 · Shift+Enter 줄바꿈</p>
              <button type="button" onClick={resetChat} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 transition hover:text-slate-200">
                <Trash2 size={11} /> 초기화
              </button>
            </div>
          </footer>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-center gap-1 outline-none transition hover:-translate-y-1 md:right-6 jarvis-floating-button"
        aria-label="자비스 열기"
        title="JARVIS 자비스"
      >
        <div
          className="relative flex h-[92px] w-[92px] items-center justify-center rounded-[28px] border border-sky-300/25 bg-slate-950/80 shadow-2xl transition md:h-[104px] md:w-[104px]"
          style={{
            boxShadow: "0 16px 55px rgba(2, 132, 199, 0.28), 0 0 0 1px rgba(255,255,255,0.08) inset",
            backdropFilter: "blur(18px)",
          }}
        >
          <span className="absolute inset-2 rounded-[22px] bg-sky-400/10 blur-xl" />
          <img src={currentImage} alt="JARVIS" className="relative h-[94px] w-[94px] object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.55)] md:h-[110px] md:w-[110px]" />
          {loading && <span className="absolute right-2 top-2 h-3 w-3 animate-pulse rounded-full bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.9)]" />}
        </div>

        <div className="hidden rounded-full border border-sky-300/25 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-sky-100 shadow-lg backdrop-blur md:flex">
          <MessageCircle size={12} className="mr-1.5" /> JARVIS
        </div>
      </button>

      <style jsx>{`
        @keyframes jarvisFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
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
