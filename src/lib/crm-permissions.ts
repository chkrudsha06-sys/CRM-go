export type CrmPermissionUser = {
  name?: string | null;
  role?: string | null;
};

export const CRM_FULL_ACCESS_USER_NAMES = [
  "최연전",
  "이세호",
  "기여운",
] as const;

const CRM_FULL_ACCESS_USER_NAME_SET = new Set(
  CRM_FULL_ACCESS_USER_NAMES.map((name) => normalizeCrmPermissionName(name)),
);

export function normalizeCrmPermissionName(value?: string | null): string {
  return String(value || "").replace(/\s+/g, "").trim();
}

export function hasCrmFullAccess(user?: CrmPermissionUser | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return CRM_FULL_ACCESS_USER_NAME_SET.has(normalizeCrmPermissionName(user.name));
}
