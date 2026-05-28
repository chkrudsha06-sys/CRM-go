import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { verifyApiSession } from "@/lib/api-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 관리자 권한 확인
async function verifyAdmin(req: Request): Promise<{ valid: boolean; userId?: string; reason?: string }> {
  const auth = await verifyApiSession(req);
  if (!auth.valid || !auth.userId) return { valid: false, reason: "세션 인증 실패 (로그아웃 후 재로그인 필요)" };

  const { data } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", auth.userId)
    .maybeSingle();

  if (!data) return { valid: false, reason: `사용자 '${auth.userId}'가 crm_users 테이블에 없음` };
  if (data.role !== "admin") return { valid: false, reason: `현재 역할: '${data.role}' (admin 필요)` };
  return { valid: true, userId: auth.userId };
}

// 비밀번호 변경 / 사용자 정보 수정
export async function PUT(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin.valid) {
    return NextResponse.json({ error: `관리자 권한이 필요합니다. (${admin.reason})` }, { status: 403 });
  }

  try {
    const { targetId, newPassword, name, title, role } = await req.json();
    if (!targetId) {
      return NextResponse.json({ error: "대상 사용자 ID가 필요합니다." }, { status: 400 });
    }

    const updates: Record<string, string> = {};

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
      }
      updates.password_hash = await bcrypt.hash(newPassword, 10);
    }
    if (name) updates.name = name;
    if (title) updates.title = title;
    if (role && ["admin", "exec", "ops", "ad", "shared"].includes(role)) updates.role = role;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
    }

    const { error } = await supabase
      .from("crm_users")
      .update(updates)
      .eq("id", targetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 비밀번호 변경 시 해당 사용자 세션 무효화
    if (newPassword) {
      await supabase.from("sessions").delete().eq("user_id", targetId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

// 신규 계정 생성
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin.valid) {
    return NextResponse.json({ error: `관리자 권한이 필요합니다. (${admin.reason})` }, { status: 403 });
  }

  try {
    const { id, password, name, title, role } = await req.json();
    if (!id || !password || !name || !title || !role) {
      return NextResponse.json({ error: "모든 필드를 입력해주세요." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from("crm_users").insert({
      id, password_hash: hash, name, title, role,
    });

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "이미 존재하는 ID입니다." }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

// 계정 삭제
export async function DELETE(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin.valid) {
    return NextResponse.json({ error: `관리자 권한이 필요합니다. (${admin.reason})` }, { status: 403 });
  }

  try {
    const { targetId } = await req.json();
    if (!targetId) {
      return NextResponse.json({ error: "대상 사용자 ID가 필요합니다." }, { status: 400 });
    }
    if (targetId === admin.userId) {
      return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 });
    }

    await supabase.from("sessions").delete().eq("user_id", targetId);
    const { error } = await supabase.from("crm_users").delete().eq("id", targetId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}
