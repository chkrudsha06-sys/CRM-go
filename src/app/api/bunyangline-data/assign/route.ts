import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASSIGNEES = ['조계현', '이세호', '기여운', '최연전'];

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase 환경변수가 누락되었습니다.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body?.id ?? '').trim();
    const assignedTo = String(body?.assigned_to ?? body?.assignedTo ?? '').trim();

    if (!id) {
      return NextResponse.json({ ok: false, message: 'id가 필요합니다.' }, { status: 400 });
    }

    if (assignedTo && !ASSIGNEES.includes(assignedTo)) {
      return NextResponse.json({ ok: false, message: '허용되지 않은 담당자입니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('bunyangline_data')
      .update({ assigned_to: assignedTo || null })
      .eq('id', id)
      .select('id, assigned_to')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[bunyangline-data/assign] 오류:', error);
    return NextResponse.json(
      {
        ok: false,
        message: '담당자 저장 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
