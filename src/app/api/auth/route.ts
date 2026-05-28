import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function generateToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  try {
    const { id, password } = await req.json();
    if (!id || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
    }

    // DB에서 사용자 조회
    const { data: user, error } = await supabase
      .from("crm_users")
      .select("id, password_hash, name, title, role")
      .eq("id", id)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    // 비밀번호 해시 검증
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    // 세션 토큰 생성 (24시간 만료)
    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24시간

    const { error: sessionError } = await supabase.from("sessions").upsert(
      {
        user_id: user.id,
        session_token: token,
        logged_in_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (sessionError) {
      console.error("Session upsert error:", sessionError);
      return NextResponse.json({ error: `세션 생성 실패: ${sessionError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        title: user.title,
        role: user.role,
        sessionToken: token,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
