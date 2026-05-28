// 분양회 CRM 푸시 알림 Service Worker
self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "분양회 알림";
    const options = {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "default",
      data: { url: data.url || "/" },
      vibrate: [200, 100, 200],
      image: data.image || undefined,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error("Push event error:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/";
  // 전체 URL 구성 (상대 경로 → 절대 URL)
  const url = path.startsWith("http") ? path : self.location.origin + path;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of list) {
        if (client.url.includes(path) && "focus" in client) return client.focus();
      }
      // 없으면 새 창 열기
      return clients.openWindow(url);
    })
  );
});
