import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, sessionToken } = await req.json();
    if (!userId || !sessionToken) {
      return NextResponse.json({ valid: true }); // 정보 없으면 유효로 간주
    }

    const { data, error } = await supabase
      .from("sessions")
      .select("session_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    // DB 에러 또는 세션 데이터 없음 → 유효로 간주 (호환성)
    if (error || !data) {
      return NextResponse.json({ valid: true });
    }

    // 공용 계정은 동시접속 허용 (토큰 체크 안 함)
    const { data: userData } = await supabase
      .from("crm_users").select("role").eq("id", userId).maybeSingle();
    if (userData?.role === "shared") {
      return NextResponse.json({ valid: true });
    }

    // 토큰 불일치 = 다른 기기에서 같은 계정 로그인 (유일하게 false 반환하는 사유)
    if (data.session_token !== sessionToken) {
      return NextResponse.json({ valid: false, reason: "다른 기기에서 로그인되었습니다." });
    }

    // 세션 유효 → 만료시간 24시간 연장 (슬라이딩 윈도우)
    // 만료됐더라도 토큰 일치하면 활동 중이므로 자동 갱신
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    supabase.from("sessions").update({ expires_at: newExpiry }).eq("user_id", userId).then(() => {});

    return NextResponse.json({ valid: true });
  } catch {
    // 모든 에러 → 유효로 간주 (서버 오류로 인한 로그아웃 방지)
    return NextResponse.json({ valid: true });
  }
}
