import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 팀원 목록
export const TEAM_MEMBERS = ["조계현", "이세호", "기여운", "최연전"] as const;

// 역할 표시
export const MEMBER_ROLES: Record<string, string> = {
  조계현: "메인",
  이세호: "어쏘",
  기여운: "어쏘",
  최연전: "CX",
};

// 결과 색상 매핑
export const RESULT_COLORS: Record<string, string> = {
  계약완료: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  예약완료: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  서류만수취: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  미팅후가망관리: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  계약거부: "bg-red-500/20 text-red-400 border-red-500/30",
  미팅불발: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

// 가망구분 색상
export const PROSPECT_COLORS: Record<string, string> = {
  즉가입가망: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  미팅예정가망: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  연계매출가망고객: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

// TM감도 색상
export const SENSITIVITY_COLORS: Record<string, string> = {
  상: "bg-red-500/20 text-red-300",
  중: "bg-yellow-500/20 text-yellow-300",
  하: "bg-gray-500/20 text-gray-400",
};

// 숫자 포맷 (만원)
export function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}
