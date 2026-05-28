// src/lib/auth.ts
export type UserRole = "admin" | "exec" | "ops" | "ad" | "shared";

export interface CRMUser {
  name: string;
  title: string;
  role: UserRole;
  id: string;
  sessionToken?: string;
}

// 팀원 정보 (비밀번호 미포함 — 이름/역할만)
export const TEAM_MEMBERS = ["조계현", "이세호", "기여운", "최연전"] as const;
export const TEAM_MEMBER_ROLES: Record<string, string> = {
  조계현: "어쏘", 이세호: "어쏘", 기여운: "어쏘", 최연전: "CX",
};

// 역할 매핑 (비밀번호 미포함)
const USER_META: Record<string, { name: string; title: string; role: UserRole }> = {
  adperson1: { name: "김정후", title: "본부장", role: "admin" },
  adperson2: { name: "김창완", title: "팀장", role: "admin" },
  adperson3: { name: "최웅", title: "파트장", role: "admin" },
  adperson4: { name: "조계현", title: "어쏘", role: "exec" },
  adperson5: { name: "이세호", title: "어쏘", role: "exec" },
  adperson6: { name: "기여운", title: "어쏘", role: "exec" },
  adperson7: { name: "최연전", title: "CX", role: "exec" },
  adperson8: { name: "김재영", title: "어시", role: "ops" },
  adperson9: { name: "최은정", title: "어시", role: "ops" },
};

// 서버 사이드 로그인 (API 호출)
export async function login(id: string, password: string): Promise<CRMUser | null> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.user) return null;

    const user: CRMUser = data.user;
    if (typeof window !== "undefined") {
      localStorage.setItem("crm_user", JSON.stringify(user));
    }
    return user;
  } catch {
    return null;
  }
}

// 하위 호환
export async function loginAdmin(id: string, password: string): Promise<CRMUser | null> {
  return login(id, password);
}
export function loginMember(name: string): CRMUser {
  const entry = Object.entries(USER_META).find(([, v]) => v.name === name);
  const user: CRMUser = entry
    ? { name: entry[1].name, title: entry[1].title, role: entry[1].role, id: entry[0] }
    : { name, title: "", role: "exec", id: "" };
  if (typeof window !== "undefined") localStorage.setItem("crm_user", JSON.stringify(user));
  return user;
}

export function getCurrentUser(): CRMUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("crm_user");
  if (!raw) return null;
  try { return JSON.parse(raw) as CRMUser; } catch { return null; }
}

// 세션 유효성 검증 (서버 API 호출)
export async function validateSession(): Promise<boolean> {
  const user = getCurrentUser();
  if (!user || !user.id) return false;

  // 세션 토큰이 없는 경우 → 이전 버전 호환: 유효로 간주
  if (!user.sessionToken) return true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

    const res = await fetch("/api/auth/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, sessionToken: user.sessionToken }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // API 호출 실패 → 유효로 간주
    if (!res.ok) return true;

    const data = await res.json();

    // 명확히 "다른 기기 로그인"인 경우만 false
    if (data.valid === false && data.reason) return false;

    // 그 외 모든 경우 유효로 간주
    return data.valid !== false;
  } catch {
    // 네트워크/타임아웃 에러 → 유효로 간주
    return true;
  }
}

export async function logoutWithSession(): Promise<void> {
  const user = getCurrentUser();
  if (user?.id) {
    // Supabase 직접 호출 대신 간단히 localStorage만 삭제
    // 서버에서 세션 정리는 다음 로그인 시 upsert로 자동 처리
    try {
      const { supabase } = await import("@/lib/supabase");
      await supabase.from("sessions").delete().eq("user_id", user.id);
    } catch {}
  }
  if (typeof window !== "undefined") localStorage.removeItem("crm_user");
}

export function logout(): void {
  const user = getCurrentUser();
  if (user?.id) {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("sessions").delete().eq("user_id", user.id).then(() => {});
    }).catch(() => {});
  }
  if (typeof window !== "undefined") localStorage.removeItem("crm_user");
}

export function isAdmin(): boolean {
  return getCurrentUser()?.role === "admin";
}
