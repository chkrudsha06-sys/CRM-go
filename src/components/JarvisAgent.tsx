"use client";

import type { CRMUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Cpu,
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
  isStreaming?: boolean;
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
      "코어, 오늘 CRM 기준으로 내가 확인해야 할 일정, 고객관리 포인트, 이번달 매출 흐름, 최근 업무요청, 완판트럭 일정을 한 번에 브리핑해줘. 마지막에는 오늘 우선순위 TOP 5를 정리해줘.",
  },
  {
    id: "inactive_customers",
    label: "관리 누락 고객",
    description: "최근 활동노트가 뜸한 고객 추출",
    icon: UsersRound,
    prompt:
      "코어, CRM 고객 중 최근 활동이 뜸하거나 관리 누락 가능성이 높은 고객을 담당자별로 정리해줘. 최근 활동일, 미팅결과, 가망구분, 후속조치까지 함께 알려줘.",
  },
  {
    id: "sales_analysis",
    label: "이번달 매출 분석",
    description: "담당자·채널별 매출 흐름 분석",
    icon: BarChart3,
    prompt:
      "코어, 이번달 통합매출관리 기준으로 매출 현황을 담당자별, 채널별로 정리해줘. 특이사항, 부족한 부분, 추가로 챙겨야 할 매출 포인트도 알려줘.",
  },
  {
    id: "task_summary",
    label: "최근 업무요청",
    description: "업무요청 미처리·진행사항 정리",
    icon: ClipboardList,
    prompt:
      "코어, 최근 업무요청을 요청자, 담당자, 상태별로 정리해줘. 미처리 또는 확인이 필요한 항목을 우선순위로 알려줘.",
  },
  {
    id: "wanpan_schedule",
    label: "완판트럭 일정",
    description: "이번주 출동·발주 상태 확인",
    icon: Truck,
    prompt:
      "코어, 이번주와 최근 완판트럭 일정을 정리해줘. 현장명, 위치, 대행사, 인원, 발주 여부 기준으로 확인해야 할 내용을 알려줘.",
  },
  {
    id: "calendar_review",
    label: "일정 점검",
    description: "캘린더·미팅 일정 확인",
    icon: CalendarDays,
    prompt:
      "코어, 이번주 CRM 캘린더와 고객 미팅 일정을 정리해줘. 오늘 확인할 일정과 담당자별 체크포인트를 알려줘.",
  },
  {
    id: "priority_actions",
    label: "우선순위 추천",
    description: "지금 바로 해야 할 일 추천",
    icon: Target,
    prompt:
      "코어, 현재 CRM 데이터를 기준으로 지금 바로 해야 할 업무 우선순위를 추천해줘. 고객관리, 매출, 일정, 업무요청으로 구분해서 실행 순서대로 알려줘.",
  },
];

const JARVIS_CHIP_VIDEO = "/jarvis/jarvis-chip.mp4";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 마크다운 + 구조화 카드 렌더러
// **굵게**, ###헤더, 리스트, 출처링크, 키-값 카드, 금액 강조, 구분선
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 금액(1,650,000원)을 강조 색으로
function highlightAmount(text: string, baseKey: number): { node: React.ReactNode; key: number } {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = baseKey;
  const amountRe = /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*원/;
  while (remaining.length > 0) {
    const m = remaining.match(amountRe);
    if (!m) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    const idx = remaining.indexOf(m[0]);
    if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    parts.push(
      <span key={key++} style={{ color: "var(--cyan-text)", fontWeight: 600 }}>{m[0]}</span>
    );
    remaining = remaining.slice(idx + m[0].length);
  }
  return { node: <>{parts}</>, key };
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const codeIdx = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;

    if (boldIdx === -1 && codeIdx === -1) {
      const hl = highlightAmount(remaining, key);
      parts.push(<span key={key++}>{hl.node}</span>);
      break;
    }

    const useBold = boldIdx !== -1 && (codeIdx === -1 || boldIdx < codeIdx);

    if (useBold && boldMatch) {
      if (boldIdx > 0) {
        const hl = highlightAmount(remaining.slice(0, boldIdx), key);
        parts.push(<span key={key++}>{hl.node}</span>);
      }
      parts.push(
        <strong key={key++} style={{ fontWeight: 600, color: "var(--text-strong)" }}>
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else if (codeMatch) {
      if (codeIdx > 0) {
        const hl = highlightAmount(remaining.slice(0, codeIdx), key);
        parts.push(<span key={key++}>{hl.node}</span>);
      }
      parts.push(
        <code
          key={key++}
          style={{
            fontSize: "0.9em",
            padding: "1px 5px",
            borderRadius: 5,
            background: "var(--surface-3)",
            color: "var(--cyan-text)",
            fontFamily: "monospace",
          }}
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeIdx + codeMatch[0].length);
    }
  }
  return <>{parts}</>;
}

// "키: 값" 형태 라인 판별 (담당: 조계현 등)
function parseKeyValue(line: string): { key: string; value: string } | null {
  // 글머리표/번호 제거
  const cleaned = line.replace(/^\s*[-*·▸•]\s*/, "").trim();
  const m = cleaned.match(/^([가-힣A-Za-z][가-힣A-Za-z0-9 ()]{0,14})\s*[:：]\s*(.+)$/);
  if (!m) return null;
  // 값이 너무 길면 (문장형) 카드로 안 만듦
  if (m[2].length > 40) return null;
  return { key: m[1].trim(), value: m[2].trim() };
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let kvBuffer: { key: string; value: string }[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    const items = [...listBuffer];
    listBuffer = [];
    blocks.push(
      <ul key={key} style={{ margin: "4px 0", paddingLeft: 2, listStyle: "none" }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", gap: 7, marginBottom: 3, lineHeight: 1.6 }}>
            <span style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>•</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
  };

  // 키-값 묶음을 카드로
  const flushKV = (key: string) => {
    if (kvBuffer.length === 0) return;
    const items = [...kvBuffer];
    kvBuffer = [];
    // 2개 이상 모였을 때만 카드 (단발성은 일반 텍스트가 자연스러움)
    if (items.length < 2) {
      items.forEach((kv, i) => {
        blocks.push(
          <div key={`${key}-s${i}`} style={{ lineHeight: 1.65, marginBottom: 2 }}>
            <span style={{ color: "var(--text-subtle)" }}>{kv.key}</span>
            <span style={{ margin: "0 6px", color: "var(--text-faint)" }}>·</span>
            {renderInline(kv.value)}
          </div>
        );
      });
      return;
    }
    blocks.push(
      <div
        key={key}
        style={{
          margin: "6px 0",
          padding: "9px 12px",
          background: "var(--surface-3)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        {items.map((kv, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              padding: "3px 0",
              borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <span style={{ color: "var(--text-subtle)", fontSize: 12, flexShrink: 0 }}>{kv.key}</span>
            <span style={{ color: "var(--text)", fontWeight: 500, textAlign: "right" }}>{renderInline(kv.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const flushAll = (key: string) => {
    flushList(`${key}-l`);
    flushKV(`${key}-kv`);
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.replace(/\r$/, "");
    const key = `b-${idx}`;

    // 구분선 (───, ===, --- 3개 이상)
    if (/^\s*[─—=-]{3,}\s*$/.test(line)) {
      flushAll(`fa-${idx}`);
      blocks.push(<div key={key} style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />);
      return;
    }

    // ### 헤더 또는 ■/▶ 섹션 제목
    const headerMatch = line.match(/^#{1,4}\s+(.*)$/);
    const sectionMatch = line.match(/^\s*[■▶◆●]\s*(.+)$/) || line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (headerMatch || sectionMatch) {
      flushAll(`fa-${idx}`);
      const titleText = headerMatch ? headerMatch[1] : sectionMatch![1];
      blocks.push(
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--accent-2)",
            margin: "10px 0 5px",
          }}
        >
          <span style={{ width: 3, height: 13, borderRadius: 2, background: "var(--accent-2)", flexShrink: 0 }} />
          {renderInline(titleText)}
        </div>
      );
      return;
    }

    // 출처 링크 (→ ... ↗)
    if (/^\s*[→▸]\s*/.test(line) && /↗\s*$/.test(line)) {
      flushAll(`fa-${idx}`);
      const clean = line.replace(/^\s*[→▸]\s*/, "").replace(/\s*↗\s*$/, "");
      blocks.push(
        <div
          key={key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            margin: "3px 6px 3px 0",
            padding: "3px 9px",
            fontSize: 10.5,
            color: "var(--accent-3)",
            background: "rgba(96,165,250,0.1)",
            border: "1px solid var(--accent-border)",
            borderRadius: 999,
          }}
        >
          {clean} <span style={{ fontSize: 10 }}>↗</span>
        </div>
      );
      return;
    }

    // 키-값 라인 (담당: 조계현)
    const kv = parseKeyValue(line);
    if (kv) {
      flushList(`fl-${idx}`);
      kvBuffer.push(kv);
      return;
    }

    // 번호 리스트
    const numberMatch = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numberMatch) {
      flushAll(`fa-${idx}`);
      blocks.push(
        <div key={key} style={{ display: "flex", gap: 7, marginBottom: 3, lineHeight: 1.6 }}>
          <span style={{ color: "var(--cyan)", flexShrink: 0, fontWeight: 600 }}>{numberMatch[1]}.</span>
          <span>{renderInline(numberMatch[2])}</span>
        </div>
      );
      return;
    }

    // 글머리표
    const bulletMatch = line.match(/^\s*[-*·]\s+(.*)$/);
    if (bulletMatch) {
      flushKV(`fkv-${idx}`);
      listBuffer.push(bulletMatch[1]);
      return;
    }

    // 빈 줄
    if (line.trim() === "") {
      flushAll(`fa-${idx}`);
      blocks.push(<div key={key} style={{ height: 6 }} />);
      return;
    }

    // 일반 문단
    flushAll(`fa-${idx}`);
    blocks.push(
      <div key={key} style={{ lineHeight: 1.65, marginBottom: 2 }}>
        {renderInline(line)}
      </div>
    );
  });

  flushAll("fa-end");
  return <>{blocks}</>;
}


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
  return `${user.name}님, 코어 대기 중입니다.\n오늘 브리핑, 관리 누락 고객, 매출 분석, 업무요청 정리를 바로 도와드릴 수 있습니다.`;
}

export default function JarvisAgent({ user }: JarvisAgentProps) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showQuickButtons, setShowQuickButtons] = useState(false);
  const [agentMode, setAgentMode] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState<Record<string, string>>({});
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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("jarvis-hidden");
      if (saved === "true") {
        setHidden(true);
        setOpen(false);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("jarvis-hidden", hidden ? "true" : "false");
    } catch {
      // noop
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

    const noteNameMatch = text.match(/(.{2,6})\s*(활동노트|노트|메모)\s*(입력|작성|쓸게|쓰자|할게|해줘|남길게|등록)/);
    const isNoteInput = !!(noteNameMatch || (
      (lowerText.includes("활동노트") || lowerText.includes("노트 입력") || lowerText.includes("노트입력")) &&
      (lowerText.includes("입력") || lowerText.includes("작성") || lowerText.includes("할게") || lowerText.includes("해줘") || lowerText.includes("남길게"))
    ));

    if (isNoteInput) {
      const nameFromMatch = noteNameMatch?.[1]?.trim() || "";
      const nameKeywords = ["활동노트", "노트", "메모", "입력", "작성", "할게", "해줘", "남길게", "등록", "의", "이"];
      let extractedName = nameFromMatch;
      if (!extractedName) {
        const words = text.split(/\s+/);
        extractedName = words.find((w) => w.length >= 2 && !nameKeywords.some((k) => w.includes(k))) || "";
      }

      const userMsg: JarvisMessage = { role: "user", content: text, timestamp: getNowLabel() };

      if (!extractedName || extractedName.length < 2) {
        setMessages((prev) => [...prev, userMsg, {
          role: "assistant",
          content: "활동노트를 입력할 고객 이름을 알려주세요.",
          timestamp: getNowLabel(),
        }]);
        updateTalkState();
        return;
      }

      const agentMsg: JarvisMessage = {
        role: "assistant",
        content: `__AGENT_NOTE_SEARCH__:${extractedName}`,
        timestamp: getNowLabel(),
      };
      setMessages((prev) => [...prev, userMsg, agentMsg]);
      setAgentMode("note_search");
      setAgentForm({ searchName: extractedName, contactId: "", contactName: "", contactSource: "", noteContent: "" });
      updateTalkState();
      return;
    }

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
      setAgentForm({ tm: "", meeting: "", special1: "", special2: "", special3: "" });
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
        throw new Error(data?.error || "코어 응답 생성에 실패했습니다.");
      }

      const fullText = data?.reply || "응답을 받을 수 없습니다.";
      const assistantMessage: JarvisMessage = {
        role: "assistant",
        content: "",
        timestamp: getNowLabel(),
        isStreaming: true,
      };

      setMessages([...nextMessages, assistantMessage]);
      updateTalkState();

      const CHAR_INTERVAL = 18;
      let charIndex = 0;
      const total = fullText.length;
      const typeNext = () => {
        const chunkSize = total > 400 ? 3 : total > 150 ? 2 : 1;
        charIndex = Math.min(charIndex + chunkSize, total);
        const partial = fullText.slice(0, charIndex);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.role !== "assistant") return prev;
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            content: partial,
            isStreaming: charIndex < total,
          };
          return updated;
        });
        if (charIndex < total) {
          window.setTimeout(typeNext, CHAR_INTERVAL);
        }
      };
      window.setTimeout(typeNext, 80);
    } catch (error) {
      const assistantMessage: JarvisMessage = {
        role: "assistant",
        content: `⚠️ 코어 연결 중 문제가 발생했습니다.\n${normalizeErrorMessage(error)}`,
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
    if (!confirm("코어 대화 내용을 초기화할까요?")) return;
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
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ border: "1px solid var(--accent-border)", background: "#0d0f13" }}>
                {imageFailed ? (
                  <Cpu size={22} style={{ color: "var(--accent-3)" }} />
                ) : (
                  <video
                    src={JARVIS_CHIP_VIDEO}
                    autoPlay
                    muted
                    loop
                    playsInline
                    onError={() => setImageFailed(true)}
                    className="h-full w-full object-cover"
                  />
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 ${loading ? "animate-pulse" : ""}`}
                  style={{ borderColor: "var(--surface)", background: loading ? "var(--accent-3)" : "var(--success)" }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[15px] font-black tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>
                    CORE
                  </h2>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: "var(--cyan-text)", background: "var(--cyan-bg)", border: "1px solid var(--cyan-border)" }}>
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
                className={`flex h-8 items-center gap-1 rounded-xl px-2 text-[11px] font-bold transition ${showQuickButtons ? "ring-1" : "hover:bg-white/10"}`}
                style={showQuickButtons ? { background: "var(--accent-bg)", color: "var(--accent-text)", boxShadow: "0 0 0 1px var(--accent-border)" } : { color: "var(--text-muted)" }}
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
                aria-label="코어 패널만 접기"
                title="패널 접기"
              >
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                onClick={hideJarvis}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10" style={{ color: "var(--text-muted)" }}
                aria-label="코어 완전히 숨기기"
                title="코어 숨기기"
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
                      className="group min-w-0 rounded-2xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
                      style={active
                        ? { borderColor: "var(--accent-border)", background: "var(--accent-bg)" }
                        : { borderColor: "var(--border)", background: "var(--surface-2)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-subtle)", color: "var(--accent-3)", boxShadow: "0 0 0 1px var(--accent-border)" }}>
                          {active ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Icon size={14} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-black" style={{ color: "var(--text-strong)" }}>
                          {action.label}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[10.5px] font-semibold leading-relaxed" style={{ color: "var(--text-subtle)" }}>
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
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: "#0d0f13", border: "1px solid var(--accent-border)" }}>
                      <Cpu size={15} style={{ color: "var(--accent-3)" }} />
                    </div>
                  )}

                  <div
                    className={`max-w-[84%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}
                  >
                    {message.content.startsWith("__AGENT_DAILY_GOAL__") ? (
                      <div className="rounded-2xl rounded-bl-md p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--accent-border)", minWidth: 260 }}>
                        <p className="mb-3 text-[13px] font-black" style={{ color: "var(--accent-text)" }}>일별활동 목표 등록</p>
                        <p className="mb-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>{message.content.split(":")[1]} 기준으로 저장됩니다.</p>
                        <div className="space-y-2.5">
                          {[
                            { key: "tm", label: "당일 TM 목표", unit: "건" },
                            { key: "meeting", label: "미팅확정 목표", unit: "건" },
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
                                    goal_coldtalk: 0,
                                    goal_consultant_db: 0,
                                    goal_second_touch: 0,
                                    goal_manage_tm: 0,
                                    goal_media_mix: 0,
                                    goal_meeting_confirmed: Number(agentForm.meeting) || 0,
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

TM ${agentForm.tm || 0}건 / 미팅확정 ${agentForm.meeting || 0}건

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
                              style={{ background: agentSaving ? "var(--accent-subtle)" : "var(--accent)" }}
                            >
                              {agentSaving ? "저장 중..." : "저장"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAgentMode(null); setAgentForm({}); }}
                              className="rounded-xl px-3 py-2 text-[12px] font-semibold transition"
                              style={{ background: "var(--surface)", color: "var(--text-muted)" }}
                            >
                              취소
                            </button>
                        </div>
                      </div>
                    ) : message.content.startsWith("__AGENT_NOTE_SEARCH__") ? (
                      (() => {
                        const searchName = message.content.split(":")[1] || "";
                        return (
                          <NoteSearchCard
                            searchName={searchName}
                            agentMode={agentMode}
                            agentForm={agentForm}
                            agentSaving={agentSaving}
                            setAgentForm={setAgentForm}
                            setAgentMode={setAgentMode}
                            setAgentSaving={setAgentSaving}
                            setMessages={setMessages}
                            user={user}
                            getNowLabel={getNowLabel}
                          />
                        );
                      })()
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
                              {["본부장", "팀장", "팀원"].map((t) => (
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
                              {["분양의신DB", "컨설턴트VIP DB", "완판트럭", "분양라인", "분양회MGM", "대협팀활동"].map((r) => (
                                <button key={r} type="button" onClick={() => setAgentForm((p) => ({ ...p, intakeRoute: r }))} className="rounded-lg px-2 py-1 text-[11px] font-bold transition" style={{ background: agentForm.intakeRoute === r ? "var(--accent-subtle)" : "var(--surface)", border: "1px solid " + (agentForm.intakeRoute === r ? "var(--accent-border)" : "var(--border)"), color: agentForm.intakeRoute === r ? "var(--accent-text)" : "var(--text-muted)" }}>{r}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-[76px] shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>활동항목 *</span>
                            <div className="flex gap-1.5">
                              {["TM", "콜드톡"].map((t) => (
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
                                      (c.phone || "").replace(/[^0-9]/g, "") === phoneDigits ||
                                      (c.customer_phone || "").replace(/[^0-9]/g, "") === phoneDigits
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
                        className={`rounded-2xl px-4 py-3 text-[13.5px] leading-[1.65] ${
                          message.role === "user"
                            ? "rounded-br-md font-medium text-white whitespace-pre-wrap"
                            : "rounded-bl-md font-normal"
                        }`}
                        style={
                          message.role === "user"
                            ? { letterSpacing: "-0.01em", background: "linear-gradient(135deg,#8b7cf6,#4f8df7)" }
                            : { color: "var(--text)", letterSpacing: "-0.01em", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }
                        }
                      >
                        {message.role === "assistant" ? renderMarkdown(message.content) : message.content}
                        {message.isStreaming && (
                          <span
                            className="jarvis-cursor ml-0.5 inline-block"
                            style={{
                              width: "2px",
                              height: "1em",
                              background: "var(--accent-text)",
                              verticalAlign: "text-bottom",
                              animation: "jarvisBlink 0.8s steps(2, start) infinite",
                            }}
                          />
                        )}
                      </div>
                    )}
                    <span className="mt-1.5 px-1 text-[11px] font-medium" style={{ color: "var(--text-subtle)" }}>
                      {message.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start gap-2.5">
                  <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
                    <Loader2 size={15} className="animate-spin" style={{ color: "var(--accent-3)" }} />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 text-[13px] font-medium leading-relaxed" style={{ border: "1px solid var(--border-subtle)", background: "var(--surface-2)", color: "var(--text-muted)", letterSpacing: "-0.01em" }}>
                    <span className="jarvis-thinking-dots">CRM 데이터를 읽고 우선순위를 계산하고 있습니다</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="p-3" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 rounded-2xl px-3 py-2" style={{ border: "1px solid var(--border-2)", background: "var(--surface-2)" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={loading}
                  placeholder="코어에게 CRM 업무를 물어보세요..."
                  className="jarvis-input max-h-24 min-h-[28px] w-full resize-none text-[12px] font-semibold leading-relaxed"
                  style={{ color: "var(--text-strong)", background: "transparent", border: "none", outline: "none", boxShadow: "none" }}
                />
              </div>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || loading}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                style={{ background: "linear-gradient(135deg,#8b7cf6,#4f8df7)" }}
                aria-label="코어에게 보내기"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>
                Enter 전송 · Shift+Enter 줄바꿈
              </p>
              <button
                type="button"
                onClick={resetChat}
                className="flex items-center gap-1 text-[10px] font-bold transition" style={{ color: "var(--text-faint)" }}
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
            aria-label="코어 열기"
            title="CORE 코어"
          >
            <div
              className="relative flex h-[92px] w-[92px] items-center justify-center rounded-[28px] md:h-[104px] md:w-[104px]"
              style={{
                border: "1px solid var(--accent-border)",
                background: "#0d0f13",
                boxShadow:
                  "0 16px 55px rgba(79, 141, 247, 0.28), 0 0 0 1px rgba(255,255,255,0.08) inset",
              }}
            >
              <span className="absolute inset-2 rounded-[22px]" style={{ background: "var(--accent-subtle)" }} />
              {imageFailed ? (
                <Cpu size={44} className="relative" style={{ color: "var(--accent-3)" }} />
              ) : (
                <video
                  src={JARVIS_CHIP_VIDEO}
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={() => setImageFailed(true)}
                  className="relative h-[78px] w-[78px] rounded-[20px] object-cover md:h-[88px] md:w-[88px]"
                />
              )}
              {loading && (
                <span className="absolute right-2 top-2 h-3 w-3 animate-pulse rounded-full" style={{ background: "var(--accent-3)", boxShadow: "0 0 18px rgba(96,165,250,0.9)" }} />
              )}
            </div>

            <div className="hidden rounded-full px-3 py-1 text-[11px] font-black md:flex" style={{ border: "1px solid var(--accent-border)", background: "var(--surface)", color: "var(--accent)" }}>
              <MessageCircle size={12} className="mr-1.5" /> CORE
            </div>
          </button>

          <button
            type="button"
            onClick={hideJarvis}
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg transition hover:translate-x-0.5"
            style={{ border: "1px solid var(--accent-border)", background: "#0d0f13", color: "var(--accent-text)" }}
            aria-label="코어를 오른쪽으로 숨기기"
            title="코어 숨기기"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {hidden && (
        <button
          type="button"
          onClick={showJarvis}
          className="pointer-events-auto absolute bottom-8 right-0 flex h-16 w-8 translate-x-1 items-center justify-center rounded-l-2xl shadow-2xl transition hover:translate-x-0 md:bottom-10"
          style={{ border: "1px solid var(--accent-border)", borderRight: "none", background: "#0d0f13", color: "var(--accent-text)" }}
          aria-label="숨긴 코어 다시 열기"
          title="코어 다시 열기"
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
          /* 위아래 움직임 제거 — 정적 표시 */
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

        .jarvis-input,
        .jarvis-input:focus {
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NoteSearchCard — 활동노트 에이전트 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type NoteSearchCardProps = {
  searchName: string;
  agentMode: string | null;
  agentForm: Record<string, string>;
  agentSaving: boolean;
  setAgentForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setAgentMode: React.Dispatch<React.SetStateAction<string | null>>;
  setAgentSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<JarvisMessage[]>>;
  user: CRMUser;
  getNowLabel: () => string;
};

function NoteSearchCard({
  searchName,
  agentMode,
  agentForm,
  agentSaving,
  setAgentForm,
  setAgentMode,
  setAgentSaving,
  setMessages,
  user,
  getNowLabel,
}: NoteSearchCardProps) {
  const [searchResult, setSearchResult] = useState<{
    id: number;
    name: string;
    title: string;
    source: string;
    stage: string;
    grade: string;
    phone: string;
    assigned_to: string;
  } | null | "not_found">(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("contacts")
          .select("id,name,title,crm_db_source,management_stage,customer_grade,phone,assigned_to,meeting_result")
          .ilike("name", `%${searchName}%`)
          .limit(5);

        if (!alive) return;

        if (!data || data.length === 0) {
          setSearchResult("not_found");
          return;
        }

        const matched = (data as any[]).find((c) => c.assigned_to === user.name) || data[0] as any;
        const getStageLabel = (c: any) => {
          if (c.management_stage) return c.management_stage;
          if (c.meeting_result === "계약완료") return "리텐션";
          if (c.meeting_result === "예약완료") return "딜클로징";
          return "리드";
        };

        setSearchResult({
          id: matched.id,
          name: matched.name,
          title: matched.title || "",
          source: matched.crm_db_source === "vip_activity" ? "VIP활동DB(파이프라인)" : "고객DB",
          stage: getStageLabel(matched),
          grade: matched.customer_grade || "심사미진행",
          phone: matched.phone || "-",
          assigned_to: matched.assigned_to || "-",
        });
      } catch {
        if (alive) setSearchResult("not_found");
      }
    })();
    return () => { alive = false; };
  }, [searchName, user.name]);

  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--accent-border)",
    background: "var(--surface-2)",
    minWidth: 270,
  };

  if (searchResult === null) {
    return (
      <div className="rounded-2xl rounded-bl-md p-4" style={cardStyle}>
        <p className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>
          {searchName} 고객을 조회 중입니다...
        </p>
      </div>
    );
  }

  if (searchResult === "not_found") {
    return (
      <div className="rounded-2xl rounded-bl-md p-4" style={cardStyle}>
        <p className="text-[12px] font-bold" style={{ color: "var(--danger-text)" }}>
          {searchName} 고객을 CRM에서 찾지 못했습니다.
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>
          고객DB 또는 파이프라인에 등록된 고객인지 확인해주세요.
        </p>
      </div>
    );
  }

  if (!confirmed) {
    return (
      <div className="rounded-2xl rounded-bl-md p-4 space-y-3" style={cardStyle}>
        <p className="text-[13px] font-black" style={{ color: "var(--accent-text)" }}>
          고객 확인
        </p>
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "var(--text-muted)" }}>고객명</span>
            <span className="font-bold" style={{ color: "var(--text-strong)" }}>{searchResult.name} {searchResult.title}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "var(--text-muted)" }}>DB 구분</span>
            <span className="font-semibold" style={{ color: "var(--accent-text)" }}>{searchResult.source}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "var(--text-muted)" }}>관리구간</span>
            <span className="font-semibold" style={{ color: "var(--text)" }}>{searchResult.stage}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "var(--text-muted)" }}>담당자</span>
            <span className="font-semibold" style={{ color: "var(--text)" }}>{searchResult.assigned_to}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "var(--text-muted)" }}>연락처</span>
            <span className="font-semibold" style={{ color: "var(--text)" }}>{searchResult.phone}</span>
          </div>
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-subtle)" }}>
          이 고객의 활동노트를 입력하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmed(true);
              setAgentForm((p) => ({
                ...p,
                contactId: String(searchResult!.id),
                contactName: searchResult!.name,
                contactSource: searchResult!.source,
                noteContent: "",
              }));
            }}
            className="flex-1 rounded-xl py-2 text-[12px] font-black text-white"
            style={{ background: "var(--accent)" }}
          >
            활동노트 입력
          </button>
          <button
            type="button"
            onClick={() => setAgentMode(null)}
            className="rounded-xl px-3 py-2 text-[12px] font-semibold"
            style={{ background: "var(--surface)", color: "var(--text-muted)" }}
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl rounded-bl-md p-4 space-y-3" style={cardStyle}>
      <div>
        <p className="text-[13px] font-black" style={{ color: "var(--accent-text)" }}>
          활동노트 입력
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-subtle)" }}>
          {searchResult.name} {searchResult.title} · {searchResult.source}
        </p>
      </div>
      <div className="flex gap-1.5">
        {["TM", "콜드톡", "미팅", "기타"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAgentForm((p) => ({ ...p, activityType: t }))}
            className="rounded-lg px-2.5 py-1 text-[11px] font-bold transition"
            style={{
              background: (agentForm.activityType || "TM") === t ? "var(--accent-subtle)" : "var(--surface)",
              border: "1px solid " + ((agentForm.activityType || "TM") === t ? "var(--accent-border)" : "var(--border)"),
              color: (agentForm.activityType || "TM") === t ? "var(--accent-text)" : "var(--text-muted)",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <textarea
        value={agentForm.noteContent || ""}
        onChange={(e) => setAgentForm((p) => ({ ...p, noteContent: e.target.value }))}
        rows={4}
        placeholder="활동 내용을 입력하세요..."
        className="w-full resize-none rounded-xl px-3 py-2.5 text-[12px] font-semibold outline-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-strong)" }}
      />
      {agentMode === "note_search" && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={agentSaving || !agentForm.noteContent?.trim()}
            onClick={async () => {
              if (!agentForm.noteContent?.trim()) return;
              setAgentSaving(true);
              try {
                const today = new Date().toISOString().slice(0, 10);
                const actType = agentForm.activityType || "TM";
                const content = `[${actType}] ${agentForm.noteContent.trim()}`;
                const { error } = await supabase.from("contact_notes").insert({
                  contact_id: Number(agentForm.contactId),
                  note_date: today,
                  content,
                  author: user.name,
                });
                if (error) throw error;
                setMessages((prev) => [...prev, {
                  role: "assistant" as const,
                  content: `활동노트를 저장했습니다.

고객: ${searchResult?.name} ${searchResult?.title || ""}
유형: ${actType}
내용: ${agentForm.noteContent.trim()}

파이프라인 또는 고객DB 메뉴에서 확인하실 수 있습니다.`,
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
            style={{ background: agentSaving ? "var(--accent-subtle)" : "var(--accent)" }}
          >
            {agentSaving ? "저장 중..." : "노트 저장"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmed(false)}
            className="rounded-xl px-3 py-2 text-[12px] font-semibold"
            style={{ background: "var(--surface)", color: "var(--text-muted)" }}
          >
            뒤로
          </button>
        </div>
      )}
    </div>
  );
}
