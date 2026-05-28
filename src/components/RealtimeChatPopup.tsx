"use client";

import { supabase } from "@/lib/supabase";
import type { CRMUser } from "@/lib/auth";
import {
  CheckCheck,
  Circle,
  Hash,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ChatMessage = {
  id: number;
  sender_name: string | null;
  sender_title?: string | null;
  receiver_name: string | null;
  message: string | null;
  room_type?: string | null;
  created_at: string;
};

type ChatPresence = {
  user_name: string;
  user_title?: string | null;
  role?: string | null;
  last_seen_at: string | null;
};

type ChatTarget = {
  name: string;
  title: string;
  type: "public" | "direct";
  group: "team" | "member";
};

type ChatRead = {
  room_key: string;
  last_read_at: string | null;
};

const MEMBERS: ChatTarget[] = [
  {
    name: "전체 채팅",
    title: "전체 공용 채팅방",
    type: "public",
    group: "team",
  },
  { name: "문시욱", title: "대표님", type: "direct", group: "member" },
  { name: "김정후", title: "본부장님", type: "direct", group: "member" },
  { name: "김창완", title: "팀장님", type: "direct", group: "member" },
  { name: "최웅", title: "파트장님", type: "direct", group: "member" },
  { name: "조계현", title: "메인님", type: "direct", group: "member" },
  { name: "이세호", title: "어쏘님", type: "direct", group: "member" },
  { name: "기여운", title: "어쏘님", type: "direct", group: "member" },
  { name: "최연전", title: "CX님", type: "direct", group: "member" },
  { name: "김재영", title: "어시님", type: "direct", group: "member" },
  { name: "최은정", title: "어시님", type: "direct", group: "member" },
];

function safeWindowStorageGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWindowStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

function getStoredSelectedName(myName: string) {
  const stored = safeWindowStorageGet(`crm-chat-selected-room:${myName}`);
  if (
    stored &&
    MEMBERS.some((member) => member.name === stored && member.name !== myName)
  )
    return stored;
  return MEMBERS[0].name;
}

function getStoredRoomScroll(myName: string) {
  const raw = safeWindowStorageGet(`crm-chat-room-list-scroll:${myName}`);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function draftStorageKey(myName: string, roomName: string) {
  return `crm-chat-draft:${myName}:${roomName}`;
}

function getStoredDraft(myName: string, roomName: string) {
  return safeWindowStorageGet(draftStorageKey(myName, roomName)) || "";
}

function sameDirectRoom(message: ChatMessage, me: string, other: string) {
  return (
    (message.sender_name === me && message.receiver_name === other) ||
    (message.sender_name === other && message.receiver_name === me)
  );
}

function makeRoomKey(target: ChatTarget, me: string) {
  if (target.type === "public") return "public";
  return `direct:${[me, target.name].sort().join("|")}`;
}

function roomKeyForMessage(message: ChatMessage, me: string) {
  if (!message.receiver_name || message.room_type === "public") return "public";
  return `direct:${[message.sender_name || "", message.receiver_name || ""].filter(Boolean).sort().join("|")}`;
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsed(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date
    .toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

function initial(name: string | null | undefined) {
  return name?.slice(0, 1) || "?";
}

function isOnline(presence?: ChatPresence) {
  if (!presence?.last_seen_at) return false;
  const lastSeen = new Date(presence.last_seen_at).getTime();
  if (Number.isNaN(lastSeen)) return false;
  return Date.now() - lastSeen <= 90000;
}

function sameMessages(a: ChatMessage[], b: ChatMessage[]) {
  if (a.length !== b.length) return false;
  if (!a.length && !b.length) return true;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  return lastA?.id === lastB?.id && lastA?.created_at === lastB?.created_at;
}

function roomMessages(messages: ChatMessage[], target: ChatTarget, me: string) {
  if (target.type === "public") {
    return messages.filter(
      (message) => !message.receiver_name || message.room_type === "public",
    );
  }
  return messages.filter((message) => sameDirectRoom(message, me, target.name));
}

function roomPreview(messages: ChatMessage[], target: ChatTarget, me: string) {
  const items = roomMessages(messages, target, me);
  const last = items[items.length - 1];
  return (
    last?.message ||
    (target.type === "public"
      ? "전체 구성원이 함께 보는 공용 대화방"
      : "아직 대화가 없습니다")
  );
}

function roomLastTime(messages: ChatMessage[], target: ChatTarget, me: string) {
  const items = roomMessages(messages, target, me);
  return elapsed(items[items.length - 1]?.created_at);
}

function unreadCount(
  messages: ChatMessage[],
  reads: ChatRead[],
  target: ChatTarget,
  me: string,
) {
  const roomKey = makeRoomKey(target, me);
  const lastRead = reads.find(
    (read) => read.room_key === roomKey,
  )?.last_read_at;
  const lastReadAt = lastRead ? new Date(lastRead).getTime() : 0;

  return roomMessages(messages, target, me).filter((message) => {
    if (message.sender_name === me) return false;
    return new Date(message.created_at).getTime() > lastReadAt;
  }).length;
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const d = date.toDateString();
  if (d === today.toDateString()) return "오늘";
  if (d === yesterday.toDateString()) return "어제";
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

async function upsertPresence(user: CRMUser) {
  await supabase.from("crm_chat_presence").upsert(
    {
      user_name: user.name,
      user_title: user.title || null,
      role: user.role || null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_name" },
  );
}

export default function RealtimeChatPopup({
  user,
  onClose,
  onUnreadChange,
}: {
  user: CRMUser;
  onClose: () => void;
  onUnreadChange?: () => void | Promise<void>;
}) {
  const [selectedName, setSelectedName] = useState(() =>
    getStoredSelectedName(user.name),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<ChatRead[]>([]);
  const [presences, setPresences] = useState<ChatPresence[]>([]);
  const [draft, setDraft] = useState(() =>
    getStoredDraft(user.name, getStoredSelectedName(user.name)),
  );
  const [keyword, setKeyword] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const roomListRef = useRef<HTMLDivElement>(null);
  const roomListScrollTopRef = useRef(getStoredRoomScroll(user.name));
  const hasLoadedMessagesRef = useRef(false);
  const selected = useMemo(
    () =>
      MEMBERS.find(
        (member) => member.name === selectedName && member.name !== user.name,
      ) || MEMBERS[0],
    [selectedName, user.name],
  );
  const selectedRef = useRef(selected);
  const draftHydratedRoomRef = useRef(selected.name);
  const userNameRef = useRef(user.name);

  useEffect(() => {
    selectedRef.current = selected;
    safeWindowStorageSet(`crm-chat-selected-room:${user.name}`, selected.name);
  }, [selected, user.name]);

  useEffect(() => {
    safeWindowStorageSet(draftStorageKey(user.name, selected.name), draft);
  }, [draft, selected.name, user.name]);

  useEffect(() => {
    if (draftHydratedRoomRef.current === selected.name) return;
    draftHydratedRoomRef.current = selected.name;
    setDraft(getStoredDraft(user.name, selected.name));
  }, [selected.name, user.name]);

  useEffect(() => {
    userNameRef.current = user.name;
    const stored = getStoredSelectedName(user.name);
    setSelectedName((prev) => {
      if (
        prev &&
        prev !== user.name &&
        MEMBERS.some((member) => member.name === prev)
      )
        return prev;
      return stored;
    });
    roomListScrollTopRef.current = getStoredRoomScroll(user.name);
  }, [user.name]);

  const presenceMap = useMemo(() => {
    const map = new Map<string, ChatPresence>();
    presences.forEach((presence) => map.set(presence.user_name, presence));
    return map;
  }, [presences]);

  const targets = useMemo(() => {
    const base = MEMBERS.filter(
      (member) => member.type === "public" || member.name !== user.name,
    );
    const q = keyword.trim();
    if (!q) return base;
    return base.filter((member) =>
      `${member.name} ${member.title}`.includes(q),
    );
  }, [keyword, user.name]);

  const publicRooms = targets.filter((target) => target.group === "team");
  const memberRooms = targets.filter((target) => target.group === "member");
  const visibleMessages = useMemo(
    () => roomMessages(messages, selected, user.name),
    [messages, selected, user.name],
  );

  const fetchReads = useCallback(async () => {
    const { data } = await supabase
      .from("crm_chat_reads")
      .select("room_key,last_read_at")
      .eq("user_name", user.name);
    setReads((data || []) as unknown as ChatRead[]);
  }, [user.name]);

  const fetchPresences = useCallback(async () => {
    const { data, error } = await supabase
      .from("crm_chat_presence")
      .select("user_name,user_title,role,last_seen_at")
      .order("last_seen_at", { ascending: false });

    if (error) {
      setPresences([]);
      return;
    }

    setPresences((data || []) as unknown as ChatPresence[]);
  }, []);

  const fetchMessages = useCallback(async (silent = false) => {
    const showLoading = !silent && !hasLoadedMessagesRef.current;
    if (showLoading) setInitialLoading(true);
    setErrorText("");

    const { data, error } = await supabase
      .from("crm_chat_messages")
      .select(
        "id,sender_name,sender_title,receiver_name,message,room_type,created_at",
      )
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      setErrorText(
        "채팅 테이블을 확인해주세요. crm_chat_messages / crm_chat_reads / crm_chat_presence SQL 실행이 필요합니다.",
      );
      if (showLoading) setMessages([]);
    } else {
      const nextMessages = (data || []) as unknown as ChatMessage[];
      setMessages((prev) =>
        sameMessages(prev, nextMessages) ? prev : nextMessages,
      );
      hasLoadedMessagesRef.current = true;
    }

    if (showLoading) setInitialLoading(false);
  }, []);

  const markRoomRead = useCallback(
    async (target: ChatTarget) => {
      const roomKey = makeRoomKey(target, user.name);
      await supabase.from("crm_chat_reads").upsert(
        {
          user_name: user.name,
          room_key: roomKey,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_name,room_key" },
      );
      await fetchReads();
      await onUnreadChange?.();
    },
    [fetchReads, onUnreadChange, user.name],
  );

  useEffect(() => {
    void upsertPresence(user);
    void fetchMessages(false);
    void fetchReads();
    void fetchPresences();

    const channel = supabase
      .channel(`crm-chat-popup-${user.name}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_chat_messages" },
        (payload) => {
          const next = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.some((message) => message.id === next.id)
              ? prev
              : [...prev, next],
          );
          window.setTimeout(() => {
            const current = selectedRef.current;
            if (
              roomKeyForMessage(next, user.name) ===
              makeRoomKey(current, user.name)
            )
              void markRoomRead(current);
            void onUnreadChange?.();
          }, 200);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_chat_presence" },
        () => void fetchPresences(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crm_chat_presence" },
        () => void fetchPresences(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_chat_reads" },
        () => void fetchReads(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crm_chat_reads" },
        () => void fetchReads(),
      )
      .subscribe();

    const heartbeat = window.setInterval(
      () => void upsertPresence(user),
      20000,
    );
    const quietSync = window.setInterval(() => {
      void fetchPresences();
      void fetchReads();
    }, 30000);

    const syncOnFocus = () => {
      void upsertPresence(user);
      void fetchPresences();
      void fetchReads();
    };
    const syncOnVisibility = () => {
      if (!document.hidden) syncOnFocus();
    };

    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", syncOnVisibility);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(heartbeat);
      window.clearInterval(quietSync);
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", syncOnVisibility);
    };
  }, [
    fetchMessages,
    fetchPresences,
    fetchReads,
    markRoomRead,
    onUnreadChange,
    user.name,
    user.role,
    user.title,
  ]);

  useEffect(() => {
    void markRoomRead(selected);
  }, [markRoomRead, selected]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleMessages.length, selected.name]);

  useLayoutEffect(() => {
    const element = roomListRef.current;
    if (!element) return;
    const restore = () => {
      const targetTop = roomListScrollTopRef.current;
      if (Math.abs(element.scrollTop - targetTop) > 2)
        element.scrollTop = targetTop;
    };
    restore();
    const id = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(id);
  });

  const handleSelectRoom = useCallback((targetName: string) => {
    if (targetName === userNameRef.current) return;
    const element = roomListRef.current;
    if (element) {
      roomListScrollTopRef.current = element.scrollTop;
      safeWindowStorageSet(
        `crm-chat-room-list-scroll:${userNameRef.current}`,
        String(element.scrollTop),
      );
    }
    setSelectedName(targetName);
    safeWindowStorageSet(
      `crm-chat-selected-room:${userNameRef.current}`,
      targetName,
    );
  }, []);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    safeWindowStorageSet(draftStorageKey(user.name, selected.name), "");
    setErrorText("");

    const payload = {
      sender_name: user.name,
      sender_title: user.title || null,
      receiver_name: selected.type === "public" ? null : selected.name,
      room_type: selected.type === "public" ? "public" : "direct",
      message: text,
    };

    const { error } = await supabase.from("crm_chat_messages").insert(payload);
    if (error) {
      setErrorText(
        "메시지 저장에 실패했습니다. 채팅 SQL 또는 RLS 정책을 확인해주세요.",
      );
      setDraft(text);
      return;
    }
    await markRoomRead(selected);
  };

  const renderRoomButton = (target: ChatTarget) => {
    const active = selected.name === target.name;
    const preview = roomPreview(messages, target, user.name);
    const time = roomLastTime(messages, target, user.name);
    const unread = active ? 0 : unreadCount(messages, reads, target, user.name);
    const targetPresence = presenceMap.get(target.name);
    const online = target.type === "public" || isOnline(targetPresence);

    return (
      <button
        key={target.name}
        type="button"
        onClick={() => handleSelectRoom(target.name)}
        className="group mb-2 flex w-full items-center gap-3 rounded-[22px] px-3 py-3 text-left transition-all duration-200"
        style={{
          background: active
            ? "linear-gradient(135deg, color-mix(in srgb, var(--accent-bg) 90%, transparent), color-mix(in srgb, var(--purple-bg) 55%, transparent))"
            : "transparent",
          border: `1px solid ${active ? "var(--accent-border)" : "transparent"}`,
          boxShadow: active
            ? "0 16px 34px color-mix(in srgb, var(--accent-bg) 22%, transparent)"
            : "none",
        }}
      >
        <span
          className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] text-[14px] font-[900]"
          style={{
            background:
              target.type === "public"
                ? "linear-gradient(135deg, var(--accent-bg), var(--purple-bg))"
                : "linear-gradient(135deg, var(--surface-3), var(--surface))",
            border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
            color:
              target.type === "public" ? "var(--accent-text)" : "var(--text)",
          }}
        >
          {target.type === "public" ? (
            <Users size={18} />
          ) : (
            initial(target.name)
          )}
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full"
            style={{
              background: online ? "#22c55e" : "var(--text-disabled)",
              border: "2px solid var(--surface-2)",
            }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className="truncate text-[14px] font-[880]"
              style={{ color: "var(--text)" }}
            >
              {target.name}{" "}
              <span
                className="text-[11px] font-[720]"
                style={{ color: "var(--text-faint)" }}
              >
                {target.type === "public" ? "" : target.title}
              </span>
            </span>
            <span
              className="shrink-0 text-[10px] font-[760]"
              style={{ color: "var(--text-faint)" }}
            >
              {time}
            </span>
          </span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <span
              className="truncate text-[11px] font-[680] leading-normal"
              style={{
                color: active ? "var(--text-subtle)" : "var(--text-faint)",
              }}
            >
              {target.type === "public"
                ? preview
                : `${online ? "온라인" : "오프라인"} · ${target.title} · ${preview}`}
            </span>
            {unread > 0 && (
              <span
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-[900]"
                style={{
                  background: "var(--danger-bg)",
                  color: "var(--danger-text)",
                  border: "1px solid var(--danger-border)",
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
        </span>
      </button>
    );
  };

  const selectedPresence = presenceMap.get(selected.name);
  const selectedOnline =
    selected.type === "public" || isOnline(selectedPresence);

  return (
    <div
      className="fixed inset-2 z-50 flex h-[calc(100dvh-16px)] w-[calc(100vw-16px)] min-w-0 flex-col overflow-hidden rounded-[22px] sm:inset-3 sm:h-[calc(100dvh-24px)] sm:w-[calc(100vw-24px)] md:inset-y-4 md:left-[272px] md:right-4 md:h-auto md:w-auto md:min-w-0 md:flex-row md:rounded-[30px] xl:left-[292px] 2xl:left-[308px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        boxShadow: "0 30px 90px rgba(0,0,0,.34)",
      }}
    >
      <aside
        className="flex h-[38dvh] min-h-[220px] w-full flex-shrink-0 flex-col sm:h-[34dvh] md:h-auto md:w-[clamp(300px,30vw,395px)]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 94%, transparent), var(--surface))",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="px-4 pb-3 pt-4 md:px-5 md:pb-4 md:pt-5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="mb-3 flex items-start justify-between gap-3 md:mb-4">
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[14px]"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                  color: "var(--accent-text)",
                }}
              >
                <MessageCircle size={17} />
              </span>
              <div>
                <p
                  className="text-[18px] font-[900] tracking-[-0.01em]"
                  style={{ color: "var(--text)" }}
                >
                  Messages
                </p>
                <p
                  className="mt-0.5 text-[11px] font-[700]"
                  style={{ color: "var(--text-faint)" }}
                >
                  CRM 실시간 업무 채팅
                </p>
              </div>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[14px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-subtle)",
              }}
              title="새 채팅"
            >
              <Plus size={17} />
            </button>
          </div>

          <label
            className="flex h-10 items-center gap-2 rounded-[16px] px-3.5 md:h-11"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
            }}
          >
            <Search size={15} style={{ color: "var(--text-faint)" }} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="이름, 직책, 채팅방 검색"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-[700] outline-none"
              style={{ color: "var(--text)" }}
            />
          </label>
        </div>

        <div
          ref={roomListRef}
          onScroll={(event) => {
            roomListScrollTopRef.current = event.currentTarget.scrollTop;
            safeWindowStorageSet(
              `crm-chat-room-list-scroll:${user.name}`,
              String(event.currentTarget.scrollTop),
            );
          }}
          className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-2.5 py-3 md:px-3 md:py-4"
        >
          <div
            className="mb-4 rounded-[22px] p-2"
            style={{
              background:
                "color-mix(in srgb, var(--accent-bg) 10%, transparent)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <p
                className="text-[11px] font-[900] uppercase tracking-[0.12em]"
                style={{ color: "var(--text-faint)" }}
              >
                Team channel
              </p>
              <Hash size={13} style={{ color: "var(--text-disabled)" }} />
            </div>
            {publicRooms.map(renderRoomButton)}
          </div>

          <div className="mb-2 flex items-center justify-between px-3">
            <p
              className="text-[11px] font-[900] uppercase tracking-[0.12em]"
              style={{ color: "var(--text-faint)" }}
            >
              Direct messages
            </p>
            <span
              className="rounded-full px-2 py-1 text-[10px] font-[850]"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-faint)",
                border: "1px solid var(--border)",
              }}
            >
              {memberRooms.length}
            </span>
          </div>
          {memberRooms.map(renderRoomButton)}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col">
        <div
          className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 0%, color-mix(in srgb, var(--accent-bg) 22%, transparent), transparent 52%), radial-gradient(circle at 90% 15%, color-mix(in srgb, var(--purple-bg) 20%, transparent), transparent 42%)",
          }}
        />

        <header
          className="relative z-10 flex h-[68px] shrink-0 items-center justify-between px-3.5 md:h-[78px] md:px-5 lg:h-[84px] lg:px-6"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="relative flex h-12 w-12 items-center justify-center rounded-[18px] text-[15px] font-[900]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              {selected.type === "public" ? (
                <Users size={19} />
              ) : (
                initial(selected.name)
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full"
                style={{
                  background: selectedOnline
                    ? "#22c55e"
                    : "var(--text-disabled)",
                  border: "2px solid var(--surface)",
                }}
              />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="truncate text-[18px] font-[930] tracking-[-0.01em]"
                  style={{ color: "var(--text)" }}
                >
                  {selected.name}{" "}
                  <span
                    className="text-[12px] font-[720]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {selected.type === "public" ? "" : selected.title}
                  </span>
                </p>
                <span
                  className="rounded-full px-2 py-1 text-[10px] font-[850]"
                  style={{
                    background: "var(--accent-subtle)",
                    color: "var(--accent-text)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  {selected.type === "public" ? "공용" : "1:1"}
                </span>
              </div>
              <p
                className="mt-1 flex items-center gap-1.5 text-[12px] font-[720]"
                style={{ color: "var(--text-faint)" }}
              >
                {selected.type === "public" ? (
                  <Users size={13} />
                ) : selectedOnline ? (
                  <Wifi size={13} />
                ) : (
                  <WifiOff size={13} />
                )}
                {selected.type === "public"
                  ? "전체 구성원 공용 채팅방"
                  : `${selected.title} · ${selectedOnline ? "온라인" : `오프라인${selectedPresence?.last_seen_at ? ` · ${elapsed(selectedPresence.last_seen_at)}` : ""}`}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-[14px]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-subtle)",
              }}
            >
              <MoreHorizontal size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-[14px]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-faint)",
              }}
            >
              <X size={17} />
            </button>
          </div>
        </header>

        <div
          ref={listRef}
          className="relative z-10 min-h-0 flex-1 overscroll-contain overflow-y-auto px-3.5 py-3 md:px-6 md:py-5 lg:px-7 lg:py-6"
        >
          {initialLoading && visibleMessages.length === 0 ? (
            <div
              className="flex h-full items-center justify-center text-[13px] font-[750]"
              style={{ color: "var(--text-faint)" }}
            >
              채팅을 불러오는 중입니다
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-[24px]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-disabled)",
                }}
              >
                <MessageCircle size={30} />
              </span>
              <div>
                <p
                  className="text-[16px] font-[900]"
                  style={{ color: "var(--text)" }}
                >
                  아직 메시지가 없습니다
                </p>
                <p
                  className="mt-1 text-[12px] font-[700]"
                  style={{ color: "var(--text-faint)" }}
                >
                  첫 메시지를 남겨 대화를 시작하세요.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {visibleMessages.map((message, index) => {
                const mine = message.sender_name === user.name;
                const prev = visibleMessages[index - 1];
                const showDay =
                  !prev ||
                  dayLabel(prev.created_at) !== dayLabel(message.created_at);
                return (
                  <div key={message.id}>
                    {showDay && (
                      <div className="my-5 flex items-center gap-3">
                        <span
                          className="h-px flex-1"
                          style={{ background: "var(--border-subtle)" }}
                        />
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-[850]"
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            color: "var(--text-faint)",
                          }}
                        >
                          {dayLabel(message.created_at)}
                        </span>
                        <span
                          className="h-px flex-1"
                          style={{ background: "var(--border-subtle)" }}
                        />
                      </div>
                    )}
                    <div
                      className={`flex items-end gap-3 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {!mine && (
                        <span
                          className="mb-5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] text-[12px] font-[900]"
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            color: "var(--text-subtle)",
                          }}
                        >
                          {initial(message.sender_name)}
                        </span>
                      )}
                      <div
                        className={`max-w-[82%] md:max-w-[68%] ${mine ? "text-right" : "text-left"}`}
                      >
                        {!mine && (
                          <p
                            className="mb-1.5 text-[11px] font-[850]"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {message.sender_name || "알 수 없음"}{" "}
                            {message.sender_title
                              ? `· ${message.sender_title}`
                              : ""}
                          </p>
                        )}
                        <div
                          className="whitespace-pre-wrap rounded-[24px] px-4 py-3 text-[14px] font-[700] leading-[1.65]"
                          style={{
                            background: mine
                              ? "linear-gradient(135deg, var(--accent-bg), color-mix(in srgb, var(--accent-bg) 72%, var(--purple-bg)))"
                              : "var(--surface-2)",
                            border: `1px solid ${mine ? "var(--accent-border)" : "var(--border)"}`,
                            color: mine ? "var(--accent-text)" : "var(--text)",
                            borderBottomRightRadius: mine ? 8 : 24,
                            borderBottomLeftRadius: mine ? 24 : 8,
                            boxShadow: mine
                              ? "0 14px 34px color-mix(in srgb, var(--accent-bg) 20%, transparent)"
                              : "0 12px 26px rgba(0,0,0,.08)",
                          }}
                        >
                          {message.message}
                        </div>
                        <p
                          className="mt-1.5 flex items-center gap-1 text-[10px] font-[780]"
                          style={{
                            color: "var(--text-faint)",
                            justifyContent: mine ? "flex-end" : "flex-start",
                          }}
                        >
                          {mine && <CheckCheck size={12} />}{" "}
                          {formatChatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {errorText && (
          <div
            className="mx-6 mb-3 rounded-[16px] px-4 py-3 text-[12px] font-[760]"
            style={{
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              color: "var(--danger-text)",
            }}
          >
            {errorText}
          </div>
        )}

        <footer
          className="relative z-10 px-5 pb-5 pt-3"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--surface)",
          }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-[820]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-subtle)",
              }}
            >
              <Sparkles size={12} /> 빠른 업무 공유
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-[820]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-subtle)",
              }}
            >
              <Circle size={9} />{" "}
              {selected.type === "public" ? "전체 공개" : "1:1 대화"}
            </span>
          </div>
          <div
            className="flex items-end gap-3 rounded-[22px] p-3"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-2)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
            }}
          >
            <button
              type="button"
              className="mb-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-faint)",
              }}
            >
              <Paperclip size={17} />
            </button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="메시지를 입력하세요. Enter 전송, Shift+Enter 줄바꿈"
              className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-3 text-[14px] font-[700] leading-relaxed outline-none"
              style={{ color: "var(--text)" }}
            />
            <button
              type="button"
              onClick={sendMessage}
              className="btn-premium btn-primary h-[46px] rounded-[16px] px-5 text-[13px] font-[900]"
            >
              <Send size={16} />
              전송
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
