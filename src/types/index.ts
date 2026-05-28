export type MeetingResult =
  | "계약완료"
  | "예약완료"
  | "서류만수취"
  | "미팅후가망관리"
  | "계약거부"
  | "미팅불발";

export type ProspectType =
  | "미팅예정가망"
  | "즉가입가망"
  | "연계매출가망고객";

export type TmSensitivity = "상" | "중" | "하";

export type TeamMember = "조계현" | "이세호" | "기여운" | "최연전";

export interface Contact {
  id: number;
  name: string;
  phone: string | null;
  customer_type: "신규" | "기고객";
  consultant: string | null;
  has_tm: boolean;
  tm_date: string | null;
  tm_sensitivity: TmSensitivity | null;
  prospect_type: ProspectType | null;
  meeting_date: string | null;
  meeting_address: string | null;
  memo: string | null;
  meeting_result: MeetingResult | null;
  contract_date: string | null;
  assigned_to: TeamMember;
  created_at: string;
  updated_at: string;
}

export interface MonthlyGoal {
  id: number;
  year: number;
  month: number;
  member_name: TeamMember;
  target_contracts: number;
  target_revenue: number;
}

export interface MemberStats {
  name: TeamMember;
  totalTm: number;
  newTm: number;
  existingTm: number;
  prospects: number;
  contracts: number;
  reservations: number;
  goal: MonthlyGoal | null;
}
