"use client";

import Sidebar from "@/components/Sidebar";
import { logout, validateSession, getCurrentUser, type CRMUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Bell, Menu, Send, Truck, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const MOBILE_TITLES: Record<string, string> = {
  "/": "대시보드",
  "/tasks": "결제&업무요청",
  "/contacts": "고객 DB",
  "/pipeline": "파이프라인",
  "/vip-members": "분양회 입회자",
  "/wanpan-truck": "완판트럭",
  "/calendar": "운영캘린더",
  "/member-manage": "분양회 회원관리",
  "/sales": "통합매출관리",
  "/rewards": "리워드 관리",
  "/customer-incentives": "인센티브 관리",
  "/quotes": "견적서",
  "/new-sites": "신규현장",
  "/ad-sites": "광고 현운예지",
  "/ad-history": "광고내역기록",
  "/ai-assistant": "AI 어시스턴트",
  "/memo": "메모장",
  "/content-manage": "회원 컨텐츠 관리",
  "/customer-register": "고객등록",
  "/customer-journey": "고객여정",
  "/reports": "팀 성과 분석",
  "/kpi-settings": "KPI 설정",
  "/incentives": "인센티브 관리",
  "/account-manage": "계정관리",
};

interface Notification {
  id: number;
  assignee_name: string;
  title: string;
  message: string | null;
  source_type: string;
  source_id: number | null;
  is_read: boolean;
  created_at: string;
}

function getMobileTitle(path: string) {
  return MOBILE_TITLES[path] || "분양회 CRM";
}

function NotifToast({ notif, onClose }: { notif: Notification; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(onClose, 12000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    onClose();
    if (notif.source_type === "완판트럭") router.push("/wanpan-truck");
    if ((notif.source_type === "결제&업무요청" || notif.source_type === "업무전달" || notif.source_type === "결제요청")) router.push("/tasks");
  };

  return (
    <div
      onClick={handleClick}
      className="w-[330px] cursor-pointer overflow-hidden rounded-[18px] p-4 shadow-2xl transition-transform hover:-translate-y-0.5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        boxShadow: "var(--shadow-lg)",
        animation: "toastIn 260ms var(--ease-soft) both",
      }}
      title="클릭하면 관련 페이지로 이동"
    >
      <div className="flex gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px]"
          style={{
            background: notif.source_type === "완판트럭" ? "var(--warning-bg)" : "var(--purple-bg)",
            border: `1px solid ${notif.source_type === "완판트럭" ? "var(--warning-border)" : "var(--purple-border)"}`,
            color: notif.source_type === "완판트럭" ? "var(--warning-text)" : "var(--purple-text)",
          }}
        >
          {notif.source_type === "완판트럭" ? <Truck size={15} /> : <Send size={15} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-[13px] font-[740] tracking-[-0.025em]" style={{ color: "var(--text)" }}>
              {notif.title}
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[8px]"
              style={{ color: "var(--text-faint)" }}
            >
              <X size={13} />
            </button>
          </div>

          {notif.message && (
            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>
              {notif.message}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="crm-tiny">
              {new Date(notif.created_at).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent-text)",
              }}
            >
              {notif.source_type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CRMUser | null>(null);
  const [checked, setChecked] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastQueue, setToastQueue] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [taskToasts, setTaskToasts] = useState<{ id: number; requester: string; category: string; content: string }[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);

  const knownIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser && pathname !== "/login" && !pathname.startsWith("/my") && !pathname.startsWith("/sites")) {
      router.push("/login");
      return;
    }

    setUser(currentUser);
    setChecked(true);
  }, [pathname, router]);

  const pushNewToasts = useCallback((data: Notification[]) => {
    const fresh = data.filter((notification) => !notification.is_read && !knownIds.current.has(notification.id));

    if (fresh.length > 0) {
      fresh.forEach((notification) => knownIds.current.add(notification.id));
      setToastQueue((prev) => [...prev, ...fresh]);
    }

    setNotifications(data);
    data.forEach((notification) => knownIds.current.add(notification.id));
  }, []);

  const fetchNotifications = useCallback(
    async (userName: string, showToast = false) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("assignee_name", userName)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error || !data) return;

      if (showToast) {
        pushNewToasts(data as Notification[]);
      } else {
        (data as Notification[]).forEach((notification) => knownIds.current.add(notification.id));
        setNotifications(data as Notification[]);
      }
    },
    [pushNewToasts]
  );

  useEffect(() => {
    if (!user || pathname === "/login") return;

    let failCount = 0;
    let intervalId: NodeJS.Timeout | null = null;

    const checkSession = async () => {
      try {
        const valid = await validateSession();
        if (!valid) {
          failCount += 1;
          if (failCount >= 3) {
            logout();
            alert("세션이 만료되었습니다. 다시 로그인해주세요.");
            router.push("/login");
          }
        } else {
          failCount = 0;
        }
      } catch {
        // 세션 검사 실패는 일시적인 네트워크 문제일 수 있으므로 즉시 로그아웃하지 않습니다.
      }
    };

    const timeoutId = setTimeout(() => {
      checkSession();
      intervalId = setInterval(checkSession, 300000);
    }, 120000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, pathname, router]);

  useEffect(() => {
    if (!user || pathname === "/login") return;

    fetchNotifications(user.name, false);

    const notificationChannel = supabase
      .channel(`notif-${user.name}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `assignee_name=eq.${user.name}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          if (!knownIds.current.has(notification.id)) {
            knownIds.current.add(notification.id);
            setNotifications((prev) => [notification, ...prev]);
            setToastQueue((prev) => [...prev, notification]);
          }
        }
      )
      .subscribe();

    const pollTimer = setInterval(() => {
      fetchNotifications(user.name, true);
    }, 10000);

    const taskChannel = supabase
      .channel(`tasks-${user.name}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          const task = payload.new as {
            id: number;
            requester: string;
            category: string;
            content: string;
            assignee?: string;
            tagged?: string[] | null;
          };

          if (task.assignee === user.name || task.tagged?.includes(user.name)) {
            setTaskToasts((prev) => [
              ...prev,
              {
                id: task.id,
                requester: task.requester,
                category: task.category,
                content: task.content,
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(taskChannel);
      clearInterval(pollTimer);
    };
  }, [user, pathname, fetchNotifications]);

  const markAllRead = async () => {
    if (!user) return;

    await supabase.from("notifications").update({ is_read: true }).eq("assignee_name", user.name).eq("is_read", false);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
  };

  const markNotificationRead = async (notificationId: number) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === notificationId ? { ...notification, is_read: true } : notification))
    );
  };

  const closeToast = async (notificationId: number) => {
    setToastQueue((prev) => prev.filter((notification) => notification.id !== notificationId));
    await markNotificationRead(notificationId);
  };

  useEffect(() => {
    if (taskToasts.length === 0) return;

    const timers = taskToasts.map((toast) =>
      setTimeout(() => setTaskToasts((prev) => prev.filter((item) => item.id !== toast.id)), 12000)
    );

    return () => timers.forEach(clearTimeout);
  }, [taskToasts]);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  if (pathname === "/login" || pathname.startsWith("/my") || pathname.startsWith("/sites")) {
    return <>{children}</>;
  }

  if (!checked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Sidebar
        user={user}
        unreadCount={unreadCount}
        notifications={notifications}
        showPanel={showPanel}
        onBellClick={async () => {
          setShowPanel((prev) => {
            const next = !prev;
            if (next) void markAllRead();
            return next;
          });
        }}
        onPanelClose={() => setShowPanel(false)}
        onMarkAll={markAllRead}
        onNotificationRead={markNotificationRead}
        mobileOpen={mobileMenu}
        onMobileClose={() => setMobileMenu(false)}
      />

      <div
        className="fixed left-0 right-0 top-0 z-30 flex h-[54px] items-center justify-between px-3 md:hidden"
        style={{
          background: "var(--glass)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenu(true)}
            className="btn-premium btn-secondary h-9 w-9 p-0"
            aria-label="메뉴 열기"
          >
            <Menu size={16} />
          </button>
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-[760] tracking-[-0.03em]" style={{ color: "var(--text)" }}>
              {getMobileTitle(pathname)}
            </p>
            <p className="crm-tiny">{user.name} · {user.title}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            setShowPanel((prev) => {
              const next = !prev;
              if (next) void markAllRead();
              return next;
            });
          }}
          className="btn-premium btn-secondary relative h-9 w-9 p-0"
          style={{ color: unreadCount > 0 ? "var(--warning-text)" : "var(--text-muted)" }}
          aria-label="알림"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--danger)" }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      <main className="min-w-0 flex-1 overflow-auto pt-[54px] md:pt-0">
        {children}
      </main>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-3">
        {toastQueue.slice(0, 3).map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotifToast notif={notification} onClose={() => closeToast(notification.id)} />
          </div>
        ))}

        {taskToasts.slice(0, 2).map((toast) => (
          <div key={`task-${toast.id}`} className="pointer-events-auto">
            <div
              onClick={() => {
                setTaskToasts((prev) => prev.filter((item) => item.id !== toast.id));
                router.push("/tasks");
              }}
              className="w-[330px] cursor-pointer overflow-hidden rounded-[18px] p-4 shadow-2xl transition-transform hover:-translate-y-0.5"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
                boxShadow: "var(--shadow-lg)",
                animation: "toastIn 260ms var(--ease-soft) both",
              }}
            >
              <div className="flex gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px]"
                  style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)", color: "var(--purple-text)" }}
                >
                  <Send size={15} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-[13px] font-[740] tracking-[-0.025em]" style={{ color: "var(--text)" }}>
                      {toast.requester}님의 업무 요청
                    </p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setTaskToasts((prev) => prev.filter((item) => item.id !== toast.id));
                      }}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[8px]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>
                    {toast.category} — {toast.content.slice(0, 70)}
                  </p>
                  <span
                    className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)", color: "var(--purple-text)" }}
                  >
                    결제&업무요청
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastIn {
          from { transform: translateX(32px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
