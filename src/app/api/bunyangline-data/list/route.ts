import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function escapeSearch(value: string) {
  return value.replace(/[,%]/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const region = url.searchParams.get('region')?.trim() || '모든지역';
    const keyword = escapeSearch(url.searchParams.get('keyword')?.trim() || '');
    const onlyNew = url.searchParams.get('onlyNew') === 'true';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('bunyangline_data')
      .select('*')
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
        ].join(',')
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      count: data?.length ?? 0,
      data: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: '분양라인데이터 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
