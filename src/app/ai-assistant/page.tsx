"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Trash2, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SUGGESTIONS = [
  "이번주 미팅 일정 알려줘",
  "이번달 분양회 월회비 집계는?",
  "계약완료 고객 몇 명이야?",
  "조계현 메인의 이번주 스케줄은?",
  "이번달 매출 담당자별로 정리해줘",
  "분양회 입회자 현황 알려줘",
  "최근 업무요청 뭐가 있어?",
  "이번달 완판트럭 일정은?",
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (u) setUserName(u.name);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg, timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        role: "assistant",
        content: data.reply || data.error || "응답을 받을 수 없습니다.",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([...newMessages, aiMsg]);
    } catch {
      setMessages([...newMessages, {
        role: "assistant",
        content: "⚠️ 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (messages.length > 0 && confirm("대화 내용을 모두 삭제하시겠습니까?")) {
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* 헤더 */}
      <div className="px-6 py-4 flex-shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
                분양의신 AI
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>CRM 데이터 기반 AI 어시스턴트 (개발중)</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              <Trash2 size={12} /> 대화 초기화
            </button>
          )}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Sparkles size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-black mb-2" style={{ color: "var(--text)" }}>
              안녕하세요, {userName || ""}님!
            </h2>
            <p className="text-sm mb-8 text-center" style={{ color: "var(--text-muted)" }}>
              CRM 데이터를 기반으로 일정, 매출, 고객 정보 등을 자연어로 질문할 수 있습니다.
            </p>

            {/* 추천 질문 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="text-left px-4 py-3 text-sm rounded-xl transition-all"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <span style={{ color: "var(--info)" }}>→</span> {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
                  <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={msg.role === "user"
                      ? { background: "#3b82f6", color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 4 }
                    }>
                    {msg.content}
                  </div>
                  <p className={`text-[10px] mt-1 px-1 ${msg.role === "user" ? "text-right" : "text-left"}`}
                    style={{ color: "var(--text-subtle)" }}>{msg.timestamp}</p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: "rgba(59,130,246,0.15)" }}>
                    <User size={16} style={{ color: "#3b82f6" }} />
                  </div>
                )}
              </div>
            ))}

            {/* 로딩 */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  <Bot size={16} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  CRM 데이터를 분석하고 있습니다...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="px-4 sm:px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto flex gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="일정, 매출, 고객 등 무엇이든 물어보세요..."
              rows={1}
              className="w-full px-4 py-3 pr-12 text-sm rounded-xl resize-none outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", maxHeight: 120 }}
              disabled={loading}
            />
          </div>
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="w-11 h-11 flex items-center justify-center rounded-xl transition-all disabled:opacity-30 flex-shrink-0"
            style={{ background: input.trim() ? "#3b82f6" : "var(--surface)", color: input.trim() ? "#fff" : "var(--text-muted)", border: input.trim() ? "none" : "1px solid var(--border)" }}>
            <Send size={16} />
          </button>
        </div>
        <p className="text-center text-[10px] mt-2" style={{ color: "var(--text-subtle)" }}>
          AI는 CRM 데이터를 기반으로 답변하며, 정확하지 않을 수 있습니다.
        </p>
      </div>
    </div>
  );
}
