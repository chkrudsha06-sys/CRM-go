"use client";

import { logout, type CRMUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  FileText,
  Gauge,
  Kanban,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Pencil,
  Moon,
  NotebookText,
  RadioTower,
  ReceiptText,
  Settings2,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Truck,
  UserCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import RealtimeChatPopup from "@/components/RealtimeChatPopup";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
} from "react";

interface NotificationItem {
  id: number;
  message: string | null;
  created_at: string;
  is_read: boolean;
  assignee_name?: string;
  title?: string;
  source_type?: string;
  source_id?: number | null;
}

interface SidebarProps {
  user: CRMUser;
  unreadCount?: number;
  notifications?: NotificationItem[];
  showPanel?: boolean;
  onBellClick?: () => void;
  onPanelClose?: () => void;
  onMarkAll?: () => Promise<void>;
  onNotificationRead?: (notificationId: number) => Promise<void>;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

type MenuItem = {
  href: string;
  label: string;
  icon: ElementType;
};

const EXEC_MENUS: MenuItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/daily-activity", label: "일별활동기록", icon: Target },
  { href: "/customer-register", label: "고객등록", icon: FileText },
  { href: "/customer-journey", label: "고객여정", icon: Sparkles },
  { href: "/tasks", label: "결제&업무요청", icon: MessageCircle },
  { href: "/contacts", label: "고객 DB", icon: Users },
  { href: "/pipeline", label: "파이프라인", icon: Kanban },
  { href: "/vip-members", label: "분양회 입회자", icon: UserCheck },
  { href: "/wanpan-truck", label: "완판트럭", icon: Truck },
  { href: "/calendar", label: "운영캘린더", icon: CalendarDays },
  { href: "/memo", label: "메모장", icon: NotebookText },
];

const OPS_MENUS: MenuItem[] = [
  { href: "/member-manage", label: "분양회 회원관리", icon: Shield },
  { href: "/content-manage", label: "회원 컨텐츠 관리", icon: Sparkles },
  { href: "/member-timeline", label: "회원 타임라인", icon: CalendarDays },
  { href: "/sales", label: "통합매출관리", icon: CircleDollarSign },
  { href: "/rewards", label: "리워드 관리", icon: WalletCards },
  { href: "/customer-incentives", label: "인센티브 관리", icon: Trophy },
  { href: "/quotes", label: "견적서", icon: ReceiptText },
];

const INFO_MENUS: MenuItem[] = [
  { href: "/new-sites", label: "신규현장", icon: Building2 },
  { href: "/ad-sites", label: "광고 현운예지", icon: RadioTower },
  { href: "/ad-history", label: "광고내역기록", icon: Gauge },
];

const ADMIN_MENUS: MenuItem[] = [
  { href: "/reports", label: "팀 성과 분석", icon: Target },
  { href: "/kpi-settings", label: "KPI 설정", icon: Settings2 },
  { href: "/incentives", label: "인센티브 관리", icon: Trophy },
  { href: "/account-manage", label: "계정관리", icon: Shield },
];

const PREFETCH_MENUS = [
  ...EXEC_MENUS,
  ...OPS_MENUS,
  ...INFO_MENUS,
  { href: "/ai-assistant", label: "AI assistant", icon: Bot },
  ...ADMIN_MENUS,
];

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  exec: "실행파트",
  ops: "운영파트",
  ad: "광고사업부",
  shared: "공용",
};

const SLOGAN_EMOJIS = [
  "🔥",
  "✨",
  "🚀",
  "💪",
  "🎯",
  "🏆",
  "🌟",
  "💡",
  "📌",
  "🧭",
  "🤝",
  "👏",
  "🙌",
  "👍",
  "😊",
  "😎",
  "🥳",
  "❤️",
  "💙",
  "💜",
  "🧡",
  "✅",
  "☑️",
  "📈",
  "📊",
  "📝",
  "📞",
  "💬",
  "⏰",
  "🌈",
  "🌱",
  "🌿",
  "🍀",
  "☀️",
  "🌙",
  "⭐",
  "⚡",
  "💎",
  "🧩",
  "🛠️",
  "🏡",
  "🏢",
  "🏙️",
  "🗓️",
  "📣",
  "🎉",
  "🥇",
  "🫡",
  "🙏",
  "🔑",
];

function initials(name: string) {
  return name?.slice(0, 1) || "U";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function chatRoomKeyForMessage(
  message: {
    sender_name: string | null;
    receiver_name: string | null;
    room_type?: string | null;
  },
  myName: string,
) {
  if (!message.receiver_name || message.room_type === "public") return "public";
  const names = [message.sender_name || "", message.receiver_name || ""]
    .filter(Boolean)
    .sort();
  return `direct:${names.join("|")}`;
}

async function upsertPresence(user: CRMUser) {
  if (!user?.name) return;
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-2 pb-1.5 pt-3 text-[10px] font-[760] uppercase tracking-[0.13em]"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </div>
  );
}

export default function Sidebar({
  user,
  unreadCount = 0,
  notifications = [],
  showPanel = false,
  onBellClick,
  onPanelClose,
  onMarkAll,
  onNotificationRead,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const [darkMode, setDarkMode] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [slogan, setSlogan] = useState("");
  const [sloganDraft, setSloganDraft] = useState("");
  const [sloganEditing, setSloganEditing] = useState(false);
  const [sloganSaving, setSloganSaving] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCollapsed = localStorage.getItem("crm_sidebar_collapsed");
    if (savedCollapsed === "true") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const uniqueHrefs = Array.from(
        new Set(PREFETCH_MENUS.map((menu) => menu.href)),
      );
      uniqueHrefs.forEach((href) => router.prefetch(href));
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  const loadSlogan = useCallback(async () => {
    if (!user?.name) return;
    const storageKey = `crm_user_slogan_${user.name}`;
    const local = localStorage.getItem(storageKey) || "";
    if (local) {
      setSlogan(local);
      setSloganDraft(local);
    }

    const { data, error } = await supabase
      .from("crm_user_slogans")
      .select("slogan")
      .eq("user_name", user.name)
      .maybeSingle();

    if (!error && data?.slogan !== undefined && data?.slogan !== null) {
      const next = String(data.slogan || "");
      setSlogan(next);
      setSloganDraft(next);
      localStorage.setItem(storageKey, next);
    }
  }, [user?.name]);

  useEffect(() => {
    void loadSlogan();
  }, [loadSlogan]);

  const saveSlogan = async () => {
    const next = sloganDraft.trim();
    const storageKey = `crm_user_slogan_${user.name}`;
    setSloganSaving(true);
    localStorage.setItem(storageKey, next);
    setSlogan(next);

    await supabase.from("crm_user_slogans").upsert(
      {
        user_name: user.name,
        user_title: user.title || null,
        role: user.role || null,
        slogan: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_name" },
    );

    setSloganSaving(false);
    setSloganEditing(false);
  };

  const toggleSidebarCollapsed = () => {
    setChatOpen(false);
    onPanelClose?.();
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("crm_sidebar_collapsed", String(next));
      return next;
    });
  };

  const refreshChatUnread = useCallback(async () => {
    if (!user?.name) return;

    const [{ data: messagesData, error: messagesError }, { data: readsData }] =
      await Promise.all([
        supabase
          .from("crm_chat_messages")
          .select("id,sender_name,receiver_name,room_type,created_at")
          .or(
            `receiver_name.is.null,receiver_name.eq.${user.name},sender_name.eq.${user.name}`,
          )
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("crm_chat_reads")
          .select("room_key,last_read_at")
          .eq("user_name", user.name),
      ]);

    if (messagesError) {
      setChatUnreadCount(0);
      return;
    }

    const readMap = new Map<string, number>();
    (
      (readsData || []) as unknown as {
        room_key: string;
        last_read_at: string | null;
      }[]
    ).forEach((read) => {
      readMap.set(
        read.room_key,
        read.last_read_at ? new Date(read.last_read_at).getTime() : 0,
      );
    });

    const messages = (messagesData || []) as unknown as {
      sender_name: string | null;
      receiver_name: string | null;
      room_type?: string | null;
      created_at: string;
    }[];
    const unread = messages.filter((message) => {
      if (message.sender_name === user.name) return false;
      if (message.receiver_name && message.receiver_name !== user.name)
        return false;
      const roomKey = chatRoomKeyForMessage(message, user.name);
      const lastReadAt = readMap.get(roomKey) || 0;
      return new Date(message.created_at).getTime() > lastReadAt;
    }).length;

    setChatUnreadCount(unread);
  }, [user.name, user.role, user.title]);

  useEffect(() => {
    void upsertPresence(user);
    const heartbeat = window.setInterval(
      () => void upsertPresence(user),
      20000,
    );

    const syncOnFocus = () => void upsertPresence(user);
    const syncOnVisibility = () => {
      if (!document.hidden) void upsertPresence(user);
    };

    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", syncOnVisibility);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", syncOnVisibility);
    };
  }, [user]);

  useEffect(() => {
    void refreshChatUnread();

    const channel = supabase
      .channel(`crm-chat-sidebar-${user.name}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_chat_messages" },
        () => void refreshChatUnread(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_chat_reads" },
        () => void refreshChatUnread(),
      )
      .subscribe();

    const timer = window.setInterval(refreshChatUnread, 15000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [refreshChatUnread, user.name]);

  useEffect(() => {
    const saved = localStorage.getItem("crm_dark_mode");
    if (saved === "false") {
      setDarkMode(false);
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      setDarkMode(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  useEffect(() => {
    if (!showPanel && !chatOpen) return;

    const handler = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        onPanelClose?.();
        setChatOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPanel, chatOpen, onPanelClose]);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);

    if (next) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.setAttribute("data-theme", "light");

    localStorage.setItem("crm_dark_mode", String(next));
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const goNotification = async (notification: NotificationItem) => {
    if (!notification.is_read) await onNotificationRead?.(notification.id);
    if (
      notification.source_type === "결제&업무요청" ||
      notification.source_type === "업무전달" ||
      notification.source_type === "결제요청"
    )
      router.push("/tasks");
    else if (notification.source_type === "완판트럭")
      router.push("/wanpan-truck");
    onPanelClose?.();
    onMobileClose?.();
  };

  const NavItem = ({ href, label, icon: Icon }: MenuItem) => {
    const active = isActivePath(pathname, href);

    return (
      <Link
        href={href}
        onClick={() => onMobileClose?.()}
        className="group flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-[650] tracking-[-0.018em] transition-all"
        style={{
          background: active ? "var(--accent-subtle)" : "transparent",
          border: active
            ? "1px solid var(--accent-border)"
            : "1px solid transparent",
          color: active ? "var(--text)" : "var(--text-subtle)",
        }}
        onMouseEnter={(event) => {
          router.prefetch(href);
          if (!active)
            event.currentTarget.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(event) => {
          if (!active) event.currentTarget.style.background = "transparent";
        }}
      >
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[8px] transition-colors"
          style={{
            background: active ? "var(--accent-bg)" : "transparent",
            color: active ? "var(--accent-text)" : "var(--text-faint)",
          }}
        >
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {active && (
          <ChevronRight size={13} style={{ color: "var(--accent-text)" }} />
        )}
      </Link>
    );
  };

  const notificationPanel = (
    <div
      className="absolute left-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-[18px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        boxShadow: "var(--shadow-xl)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <Bell size={14} style={{ color: "var(--accent-text)" }} />
          <span
            className="text-[13px] font-[760] tracking-[-0.025em]"
            style={{ color: "var(--text)" }}
          >
            알림
          </span>
          {unreadCount > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ background: "var(--danger)" }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAll}
              className="rounded-[8px] px-2 py-1 text-[11px] font-bold"
              style={{ color: "var(--accent-text)" }}
            >
              전체 읽음
            </button>
          )}
          <button
            type="button"
            onClick={onPanelClose}
            className="flex h-7 w-7 items-center justify-center rounded-[8px]"
            style={{ color: "var(--text-faint)" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-11">
            <Bell size={24} style={{ color: "var(--text-disabled)" }} />
            <p
              className="text-[12px] font-semibold"
              style={{ color: "var(--text-faint)" }}
            >
              알림이 없습니다
            </p>
          </div>
        ) : (
          notifications.slice(0, 20).map((notification) => {
            const isTask =
              notification.source_type === "결제&업무요청" ||
              notification.source_type === "업무전달" ||
              notification.source_type === "결제요청";
            const isWanpan = notification.source_type === "완판트럭";
            const color = isTask
              ? "var(--purple-text)"
              : isWanpan
                ? "var(--warning-text)"
                : "var(--info-text)";
            const bg = isTask
              ? "var(--purple-bg)"
              : isWanpan
                ? "var(--warning-bg)"
                : "var(--info-bg)";
            const border = isTask
              ? "var(--purple-border)"
              : isWanpan
                ? "var(--warning-border)"
                : "var(--info-border)";

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => goNotification(notification)}
                className="flex w-full gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  background: notification.is_read
                    ? "transparent"
                    : "var(--surface-selected)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    color,
                  }}
                >
                  {isTask ? (
                    <MessageCircle size={14} />
                  ) : isWanpan ? (
                    <Truck size={14} />
                  ) : (
                    <Bell size={14} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="line-clamp-1 text-[12px] font-[740] tracking-[-0.02em]"
                      style={{
                        color: notification.is_read
                          ? "var(--text-subtle)"
                          : "var(--text)",
                      }}
                    >
                      {notification.title || notification.source_type}
                    </span>
                    {!notification.is_read && (
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: "var(--danger)" }}
                      />
                    )}
                  </span>

                  {notification.message && (
                    <span
                      className="mt-1 line-clamp-2 text-[11px] font-medium leading-relaxed"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {notification.message}
                    </span>
                  )}

                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="crm-tiny">
                      {new Date(notification.created_at).toLocaleString(
                        "ko-KR",
                        {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        background: bg,
                        color,
                        border: `1px solid ${border}`,
                      }}
                    >
                      {notification.source_type}
                    </span>
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderSidebarInner = () => (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--surface)" }}
    >
      <div
        className="px-4 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px]"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <Image
              src="/icon-logo.png"
              alt="로고"
              width={30}
              height={30}
              style={{ objectFit: "contain" }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="line-clamp-1 text-[14px] font-[780] tracking-[-0.04em]"
              style={{ color: "var(--text-strong)" }}
            >
              분양회 CRM
            </p>
            <p className="crm-tiny mt-0.5">광고인㈜ 대외협력팀</p>
          </div>

          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] md:flex"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-subtle)",
            }}
            aria-label="사이드바 숨기기"
            title="사이드바 숨기기"
          >
            <ChevronsLeft size={15} />
          </button>
        </div>
      </div>

      <div
        className="px-4 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="crm-avatar flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] text-[17px] font-[860]"
            style={{ background: "linear-gradient(135deg,#8b7cf6,#60a5fa)" }}
          >
            {initials(user.name)}
          </div>

          <div className="flex min-h-12 min-w-0 flex-1 items-center">
            <div className="flex min-w-0 items-center gap-2 leading-none">
              <p
                className="line-clamp-1 text-[22px] font-[900] tracking-[-0.045em]"
                style={{ color: "var(--text-strong)" }}
              >
                {user.name}
              </p>
              <span
                className="line-clamp-1 text-[16px] font-[820] tracking-[-0.025em]"
                style={{ color: "var(--text-subtle)" }}
              >
                {user.title}
              </span>
            </div>
          </div>
        </div>

        <div
          className="mt-3 rounded-[14px] p-3"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[11px] font-[780]"
              style={{ color: "var(--text-faint)" }}
            >
              나의 슬로건
            </span>
            {!sloganEditing && (
              <button
                type="button"
                onClick={() => {
                  setSloganDraft(slogan);
                  setSloganEditing(true);
                }}
                className="flex h-6 items-center gap-1 rounded-[8px] px-2 text-[10px] font-bold"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--accent-text)",
                }}
              >
                <Pencil size={11} /> 수정
              </button>
            )}
          </div>

          {sloganEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={sloganDraft}
                onChange={(event) => setSloganDraft(event.target.value)}
                placeholder="나만의 슬로건을 입력하세요."
                rows={3}
                maxLength={140}
                className="w-full resize-none rounded-[12px] px-3 py-2 text-[12px] font-[760] leading-relaxed outline-none"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-2)",
                  color: "var(--text-strong)",
                }}
              />
              <div
                className="rounded-[12px] p-2"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-[800] tracking-[-0.01em]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    이모티콘 빠른 입력
                  </span>
                  <span
                    className="text-[10px] font-[700]"
                    style={{ color: "var(--text-disabled)" }}
                  >
                    클릭하면 추가
                  </span>
                </div>
                <div className="grid max-h-[112px] grid-cols-10 gap-1 overflow-y-auto pr-1">
                  {SLOGAN_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() =>
                        setSloganDraft((prev) =>
                          `${prev}${emoji}`.slice(0, 140),
                        )
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-[8px] text-[15px] transition-transform hover:scale-110"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-subtle)",
                      }}
                      aria-label={`${emoji} 추가`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSloganDraft(slogan);
                    setSloganEditing(false);
                  }}
                  className="rounded-[9px] px-2.5 py-1.5 text-[11px] font-bold"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-subtle)",
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveSlogan}
                  disabled={sloganSaving}
                  className="inline-flex items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                  style={{ background: "var(--accent)" }}
                >
                  <Check size={12} /> {sloganSaving ? "저장중" : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <p
              className="mt-2 whitespace-pre-wrap break-words text-[12px] font-[820] leading-[1.55] tracking-[-0.02em]"
              style={{ color: "var(--text-strong)" }}
            >
              {slogan || "슬로건을 입력해보세요."}
            </p>
          )}
        </div>
      </div>

      <div
        className="relative px-4 py-3"
        ref={bellRef}
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onPanelClose?.();
              setChatOpen((prev) => !prev);
              window.setTimeout(() => void refreshChatUnread(), 450);
            }}
            className="relative flex h-10 items-center justify-center gap-2 rounded-[12px] text-[12px] font-[760]"
            style={{
              background: chatOpen
                ? "var(--accent-subtle)"
                : "var(--surface-2)",
              border: `1px solid ${chatOpen ? "var(--accent-border)" : "var(--border)"}`,
              color:
                chatUnreadCount > 0
                  ? "var(--warning-text)"
                  : chatOpen
                    ? "var(--accent-text)"
                    : "var(--text-subtle)",
            }}
            aria-label="채팅"
            title="채팅"
          >
            <MessageCircle size={16} /> 채팅
            {chatUnreadCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: "var(--danger)" }}
              >
                {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setChatOpen(false);
              onBellClick?.();
            }}
            className="relative flex h-10 items-center justify-center gap-2 rounded-[12px] text-[12px] font-[760]"
            style={{
              background: showPanel
                ? "var(--accent-subtle)"
                : "var(--surface-2)",
              border: `1px solid ${showPanel ? "var(--accent-border)" : "var(--border)"}`,
              color:
                unreadCount > 0 ? "var(--warning-text)" : "var(--text-subtle)",
            }}
            aria-label="알림"
          >
            <Bell size={16} /> 알림
            {unreadCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: "var(--danger)" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {chatOpen && (
            <RealtimeChatPopup
              user={user}
              onClose={() => setChatOpen(false)}
              onUnreadChange={refreshChatUnread}
            />
          )}
          {showPanel && notificationPanel}
        </div>
      </div>

      <nav className="crm-sidebar-scroll min-h-0 flex-1 overflow-y-auto py-2 pl-3 pr-0">
        <SectionTitle>Execution</SectionTitle>
        <div className="space-y-0.5">
          {EXEC_MENUS.map((menu) => (
            <NavItem key={menu.href} {...menu} />
          ))}
        </div>

        <div
          className="my-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        />
        <SectionTitle>Operation</SectionTitle>
        <div className="space-y-0.5">
          {OPS_MENUS.map((menu) => (
            <NavItem key={menu.href} {...menu} />
          ))}
        </div>

        <div
          className="my-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        />
        <SectionTitle>Information</SectionTitle>
        <div className="space-y-0.5">
          {INFO_MENUS.map((menu) => (
            <NavItem key={menu.href} {...menu} />
          ))}
        </div>

        <div
          className="my-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        />
        <SectionTitle>AI</SectionTitle>
        <div className="space-y-0.5">
          <NavItem href="/ai-assistant" label="AI 어시스턴트" icon={Bot} />
        </div>

        {isAdmin && (
          <>
            <div
              className="my-3"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            />
            <SectionTitle>Admin</SectionTitle>
            <div className="space-y-0.5">
              {ADMIN_MENUS.map((menu) => (
                <NavItem key={menu.href} {...menu} />
              ))}
            </div>
          </>
        )}
      </nav>

      <div
        className="space-y-1 px-3 pb-4 pt-2"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <button
          type="button"
          onClick={toggleDark}
          className="flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-[650] transition-colors"
          style={{ color: "var(--text-subtle)" }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[8px]"
            style={{
              color: darkMode ? "var(--warning-text)" : "var(--accent-text)",
            }}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </span>
          {darkMode ? "라이트 모드" : "다크 모드"}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-[650] transition-colors"
          style={{ color: "var(--text-subtle)" }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[8px]"
            style={{ color: "var(--danger-text)" }}
          >
            <LogOut size={15} />
          </span>
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden flex-shrink-0 transition-[width] duration-300 md:flex ${sidebarCollapsed ? "w-[32px]" : "w-[248px]"}`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border-subtle)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.015)",
        }}
      >
        {sidebarCollapsed ? (
          <div className="flex h-full w-full flex-col items-center py-4">
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-[10px]"
              style={{
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent-text)",
              }}
              aria-label="사이드바 펼치기"
              title="사이드바 펼치기"
            >
              <ChevronsRight size={15} />
            </button>
            <div
              className="mt-4 h-px w-5"
              style={{ background: "var(--border-subtle)" }}
            />
          </div>
        ) : (
          renderSidebarInner()
        )}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 w-full"
            style={{
              background: "var(--overlay)",
              backdropFilter: "blur(4px)",
            }}
            onClick={onMobileClose}
            aria-label="메뉴 닫기"
          />

          <div
            className="absolute bottom-0 left-0 top-0 w-[290px] overflow-hidden"
            style={{
              background: "var(--surface)",
              borderRight: "1px solid var(--border-2)",
              boxShadow: "var(--shadow-xl)",
              animation: "drawerIn 220ms var(--ease-soft) both",
            }}
          >
            {renderSidebarInner()}
          </div>
        </div>
      )}

      <style>{`
        .crm-sidebar-scroll {
          direction: rtl;
          scrollbar-gutter: stable;
          padding-right: 0 !important;
        }
        .crm-sidebar-scroll > * {
          direction: ltr;
        }
        .crm-sidebar-scroll > div,
        .crm-sidebar-scroll > a {
          margin-left: 0;
          margin-right: 10px;
        }
        .crm-sidebar-scroll::-webkit-scrollbar {
          width: 10px;
        }
        @keyframes drawerIn {
          from { transform: translateX(-28px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
