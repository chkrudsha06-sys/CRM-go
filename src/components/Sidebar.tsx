"use client";

import { logout, type CRMUser } from "@/lib/auth";
import {
  Bell,
  Bot,
  CalendarDays,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Database,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  NotebookText,
  ReceiptText,
  Search,
  Settings2,
  Shield,
  Sun,
  Target,
  Truck,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import RealtimeChatPopup from "@/components/RealtimeChatPopup";
import { Avatar } from "@/components/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  icon: LucideIcon;
};

const EXEC_MENUS: MenuItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/daily-activity", label: "일별활동기록", icon: Target },
  { href: "/customer-register", label: "고객등록", icon: FileText },
  { href: "/customer-db", label: "고객DB", icon: Database },
  { href: "/contacts", label: "VIP활동DB", icon: Users },
  { href: "/tasks", label: "결제&업무요청", icon: MessageCircle },
  { href: "/pipeline3", label: "파이프라인3", icon: Kanban },
  { href: "/vip-members", label: "분양회 입회자", icon: UserCheck },
  { href: "/wanpan-truck", label: "완판트럭", icon: Truck },
  { href: "/calendar", label: "운영캘린더", icon: CalendarDays },
  { href: "/memo", label: "메모장", icon: NotebookText },
];

const OPS_MENUS: MenuItem[] = [
  { href: "/member-timeline", label: "회원 타임라인", icon: CalendarDays },
  { href: "/sales", label: "통합매출관리", icon: CircleDollarSign },
  { href: "/quotes", label: "견적서", icon: ReceiptText },
];

const ADMIN_MENUS: MenuItem[] = [
  { href: "/reports", label: "팀 성과 분석", icon: Target },
  { href: "/kpi-settings", label: "KPI 설정", icon: Settings2 },
  { href: "/account-manage", label: "계정관리", icon: Shield },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  exec: "실행파트",
  ops: "운영파트",
  ad: "광고사업부",
  shared: "공용",
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SectionTitle({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="my-3 h-px bg-[var(--border)]" />;
  return <div className="crm-sidebar-section-title">{children}</div>;
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user.role === "admin";

  const menus = useMemo(() => {
    const items = [...EXEC_MENUS, ...OPS_MENUS, { href: "/ai-assistant", label: "AI 어시스턴트", icon: Bot }];
    if (isAdmin) items.push(...ADMIN_MENUS);
    return items;
  }, [isAdmin]);

  useEffect(() => {
    const savedCollapsed = localStorage.getItem("crm_sidebar_collapsed");
    if (savedCollapsed === "true") setCollapsed(true);

    const savedDark = localStorage.getItem("crm_dark_mode");
    if (savedDark === "false") {
      setDarkMode(false);
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      setDarkMode(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      menus.forEach((menu) => router.prefetch(menu.href));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [menus, router]);

  useEffect(() => {
    if (!showPanel) return;
    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onPanelClose?.();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onPanelClose, showPanel]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("crm_sidebar_collapsed", String(next));
  };

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
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
    ) {
      router.push("/tasks");
    } else if (notification.source_type === "완판트럭") {
      router.push("/wanpan-truck");
    }
    onPanelClose?.();
    onMobileClose?.();
  };

  const NavItem = ({ href, label, icon: Icon }: MenuItem) => {
    const active = isActivePath(pathname, href);
    return (
      <Link
        href={href}
        data-active={active}
        title={collapsed ? label : undefined}
        onClick={() => onMobileClose?.()}
        onMouseEnter={() => router.prefetch(href)}
        className={`crm-sidebar-item ${collapsed ? "justify-center px-0" : ""}`}
      >
        <span className="crm-sidebar-icon">
          <Icon size={16} strokeWidth={2.25} />
        </span>
        {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
        {!collapsed && active && <ChevronRight size={14} className="text-[var(--accent-text)]" />}
      </Link>
    );
  };

  const notificationPanel = showPanel ? (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-50 mt-3 w-[360px] overflow-hidden rounded-[22px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border-2)", boxShadow: "var(--shadow-xl)" }}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-[14px] font-[820] tracking-[-0.03em] text-[var(--text)]">알림센터</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-faint)]">최근 업무 요청과 시스템 알림</p>
        </div>
        <div className="flex items-center gap-1.5">
          {notifications.some((item) => !item.is_read) && (
            <button type="button" onClick={() => void onMarkAll?.()} className="rounded-full px-3 py-1.5 text-[11px] font-bold text-[var(--accent-text)] hover:bg-[var(--accent-subtle)]">
              모두 읽음
            </button>
          )}
          <button type="button" onClick={() => onPanelClose?.()} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-hover)]">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="max-h-[430px] overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell size={22} className="text-[var(--text-faint)]" />
            <p className="mt-3 text-[13px] font-bold text-[var(--text-muted)]">새 알림이 없습니다.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void goNotification(notification)}
              className="mb-1.5 w-full rounded-[16px] px-3 py-3 text-left transition hover:bg-[var(--surface-hover)]"
              style={{ border: notification.is_read ? "1px solid transparent" : "1px solid var(--accent-border)", background: notification.is_read ? "transparent" : "var(--accent-subtle)" }}
            >
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] bg-[var(--surface-2)] text-[var(--accent-text)] ring-1 ring-[var(--border)]">
                  <Bell size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-[780] tracking-[-0.02em] text-[var(--text)]">
                    {notification.title || notification.source_type || "CRM 알림"}
                  </span>
                  {notification.message && (
                    <span className="mt-1 line-clamp-2 block text-[12px] font-medium leading-relaxed text-[var(--text-subtle)]">
                      {notification.message}
                    </span>
                  )}
                  <span className="mt-2 block text-[10px] font-bold text-[var(--text-faint)]">{formatDateTime(notification.created_at)}</span>
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="모바일 메뉴 닫기"
          onClick={() => onMobileClose?.()}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`crm-sidebar-shell fixed bottom-0 top-0 z-50 flex flex-col transition-all duration-300 md:sticky md:z-20 ${mobileOpen ? "left-0" : "-left-full md:left-0"}`}
        style={{ width: collapsed ? "var(--crm-sidebar-collapsed-width)" : "var(--crm-sidebar-width)" }}
      >
        <div className="flex h-full min-h-0 flex-col p-3">
          <div className={`crm-sidebar-logo-card flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-3"} h-[64px] rounded-[20px]`}>
            <Link href="/" onClick={() => onMobileClose?.()} className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-white shadow-sm ring-1 ring-[var(--border)]">
                <Image src="/icon-logo.png" alt="CRM" fill sizes="40px" className="object-contain p-1.5" />
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-[880] tracking-[-0.045em] text-[var(--text)]">분양회 CRM</span>
                  <span className="block truncate text-[11px] font-bold text-[var(--text-faint)]">Attio style operating system</span>
                </span>
              )}
            </Link>

            {!collapsed && (
              <button type="button" onClick={toggleCollapsed} className="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-hover)] md:flex" aria-label="사이드바 접기">
                <ChevronsLeft size={16} />
              </button>
            )}
          </div>

          {collapsed && (
            <button type="button" onClick={toggleCollapsed} className="mx-auto mt-3 hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] hover:bg-[var(--surface-hover)] md:flex" aria-label="사이드바 펼치기">
              <ChevronsRight size={16} />
            </button>
          )}

          <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
            <Search size={14} className="text-[var(--text-faint)]" />
            {!collapsed && <span className="text-[12px] font-bold text-[var(--text-faint)]">메뉴, 고객, 업무 검색</span>}
          </div>

          <nav className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <SectionTitle collapsed={collapsed}>Execution</SectionTitle>
            <div className="space-y-1.5">{EXEC_MENUS.map((menu) => <NavItem key={menu.href} {...menu} />)}</div>

            <SectionTitle collapsed={collapsed}>Operation</SectionTitle>
            <div className="space-y-1.5">{OPS_MENUS.map((menu) => <NavItem key={menu.href} {...menu} />)}</div>

            <SectionTitle collapsed={collapsed}>Intelligence</SectionTitle>
            <div className="space-y-1.5"><NavItem href="/ai-assistant" label="AI 어시스턴트" icon={Bot} /></div>

            {isAdmin && (
              <>
                <SectionTitle collapsed={collapsed}>Admin</SectionTitle>
                <div className="space-y-1.5">{ADMIN_MENUS.map((menu) => <NavItem key={menu.href} {...menu} />)}</div>
              </>
            )}
          </nav>

          <div className="mt-3 space-y-2">
            <div className={`crm-user-card flex items-center ${collapsed ? "justify-center p-2" : "gap-3 p-3"} rounded-[20px]`}>
              <Avatar name={user.name} size={collapsed ? "sm" : "md"} />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-[820] tracking-[-0.025em] text-[var(--text)]">{user.name}</p>
                  <p className="truncate text-[11px] font-bold text-[var(--text-faint)]">{ROLE_LABEL[user.role] || user.role} · {user.title}</p>
                </div>
              )}
            </div>

            <div className={`grid gap-2 ${collapsed ? "grid-cols-1" : "grid-cols-4"}`}>
              <div className="relative">
                <button type="button" onClick={onBellClick} className="relative flex h-10 w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)]" aria-label="알림">
                  <Bell size={16} />
                  {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </button>
                {!collapsed && notificationPanel}
              </div>

              <button type="button" onClick={() => setChatOpen(true)} className="relative flex h-10 w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)]" aria-label="채팅">
                <MessageCircle size={16} />
                {chatUnreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">{chatUnreadCount > 99 ? "99+" : chatUnreadCount}</span>}
              </button>

              <button type="button" onClick={toggleDark} className="flex h-10 w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)]" aria-label="테마 변경">
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <button type="button" onClick={handleLogout} className="flex h-10 w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]" aria-label="로그아웃">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {collapsed && showPanel && (
        <div className="fixed bottom-4 left-[92px] z-50 md:block hidden">{notificationPanel}</div>
      )}

      {chatOpen && (
        <RealtimeChatPopup
          user={user}
          onClose={() => setChatOpen(false)}
          onUnreadChange={() => setChatUnreadCount(0)}
        />
      )}
    </>
  );
}
