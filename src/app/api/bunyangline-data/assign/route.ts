import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASSIGNEES = ['조계현', '이세호', '기여운', '최연전'];

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  name?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (isRecord(error)) {
    const supabaseError = error as SupabaseErrorLike;
    return {
      name: supabaseError.name ?? 'SupabaseError',
      message: supabaseError.message ?? '알 수 없는 Supabase 오류입니다.',
      details: supabaseError.details ?? null,
      hint: supabaseError.hint ?? null,
      code: supabaseError.code ?? null,
      raw: error,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Supabase 환경변수가 누락되었습니다. NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl ? '있음' : '없음'}, SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey ? '있음' : '없음'}`
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeAssignee(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!ASSIGNEES.includes(text)) {
    throw new Error('허용되지 않은 담당자입니다.');
  }
  return text;
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body?.id ?? '').trim();
    const assignedTo = normalizeAssignee(body?.assigned_to);

    if (!id) {
      return NextResponse.json({ ok: false, message: 'id가 없습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('bunyangline_data')
      .update({ assigned_to: assignedTo })
      .eq('id', id)
      .select('id, assigned_to')
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: '분양라인데이터 담당자 저장 완료',
      data,
    });
  } catch (error) {
    const errorPayload = toErrorPayload(error);
    console.error('[bunyangline-data/assign] 저장 오류:', errorPayload);

    return NextResponse.json(
      {
        ok: false,
        message: '분양라인데이터 담당자 저장 중 오류가 발생했습니다.',
        error: errorPayload.message,
        errorDetails: errorPayload,
      },
      { status: 500 }
    );
  }
}
