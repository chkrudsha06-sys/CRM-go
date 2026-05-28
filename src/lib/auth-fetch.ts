// 인증 헤더가 포함된 fetch 래퍼
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let userId = "";
  let sessionToken = "";

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const user = JSON.parse(raw);
        userId = user.id || "";
        sessionToken = user.sessionToken || "";
      }
    } catch {}
  }

  const headers = new Headers(options.headers || {});
  headers.set("x-user-id", userId);
  headers.set("x-session-token", sessionToken);

  return fetch(url, { ...options, headers });
}
