import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function escapeSearch(value: string) {
  return value.replace(/[,%]/g, '').trim();
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const region = url.searchParams.get('region')?.trim() || '모든지역';
    const keyword = escapeSearch(url.searchParams.get('keyword') || '');
    const onlyNew = url.searchParams.get('onlyNew') === 'true';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 5000);

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('bunyangline_data')
      .select('*')
      .order('posted_datetime', { ascending: false, nullsFirst: false })
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (region !== '모든지역') {
      query = query.eq('region_name', region);
    }

    if (onlyNew) {
      query = query.eq('is_new', true);
    }

    if (keyword) {
      query = query.or(
        [
          `site_name.ilike.%${keyword}%`,
          `site_address.ilike.%${keyword}%`,
          `manager_name.ilike.%${keyword}%`,
          `manager_phone.ilike.%${keyword}%`,
          `agency_company.ilike.%${keyword}%`,
          `apartment_fee.ilike.%${keyword}%`,
          `ad_section.ilike.%${keyword}%`,
          `assigned_to.ilike.%${keyword}%`,
        ].join(',')
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      count: data?.length ?? 0,
      data: data ?? [],
    });
  } catch (error) {
    const errorPayload = toErrorPayload(error);

    console.error('[bunyangline-data/list] 조회 오류:', errorPayload);

    return NextResponse.json(
      {
        ok: false,
        message: '분양라인데이터 조회 중 오류가 발생했습니다.',
        error: errorPayload.message,
        errorDetails: errorPayload,
      },
      { status: 500 }
    );
  }
}
