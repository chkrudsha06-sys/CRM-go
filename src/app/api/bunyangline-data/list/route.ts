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

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAdSection(value: unknown) {
  const text = String(value ?? '').replace(/\s+/g, '').toLowerCase();
  if (text.includes('unique') || text.includes('유니크')) return '유니크';
  if (text.includes('superior') || text.includes('슈페리어')) return '슈페리어';
  if (text.includes('전국top') || text.includes('전국탑') || text.includes('nationaltop')) return '전국TOP';
  if (text.includes('지역top') || text.includes('지역탑') || text.includes('regionaltop')) return '지역TOP';
  return '일반';
}

function normalizePhone(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const mobile = text.match(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0];
  if (mobile) return mobile.replace(/\D/g, '');

  const tel = text.match(/(?:02|0[3-6]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0];
  if (tel) return tel.replace(/\D/g, '');

  const service = text.match(/\b\d{4}[-\s.]?\d{4}\b/)?.[0];
  if (service) return service.replace(/\D/g, '');

  const digits = text.replace(/\D/g, '');
  return digits || text;
}

function firstPhoneInText(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;

  const match =
    text.match(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] ||
    text.match(/(?:02|0[3-6]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] ||
    text.match(/\b\d{4}[-\s.]?\d{4}\b/)?.[0] ||
    null;
  return match ? normalizePhone(match) : null;
}

function cleanManagerName(value: unknown) {
  let text = normalizeText(value);
  if (!text) return null;

  text = text
    .replace(/담당자\s*이름/g, ' ')
    .replace(/담당자명/g, ' ')
    .replace(/담당자\s*연락처.*$/g, ' ')
    .replace(/연락처.*$/g, ' ')
    .replace(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/g, ' ')
    .replace(/(?:02|0[3-6]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}/g, ' ')
    .replace(/\b\d{4}[-\s.]?\d{4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text || null;
}

function stripLabelNoise(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;
  return text
    .replace(/^(시행사|시공사|신탁사|대행사|담당자\s*이름|담당자\s*연락처|형태|아파트\s*분양)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function findJoinedLabelValue(joinedText: string, label: string, nextLabels: string[]) {
  const next = nextLabels.map(escapeRegExp).join('|');
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:：]?\\s*(.+?)(?=\\s*(?:${next})\\s*[:：]?|$)`);
  const match = joinedText.match(pattern);
  return match?.[1] ? normalizeText(match[1]) : null;
}

function parseBusinessValue(text: string, labels: string[], nextLabels: string[]) {
  const joined = String(text || '').replace(/\s+/g, ' ').trim();
  for (const label of labels) {
    const value = findJoinedLabelValue(joined, label, nextLabels);
    if (value) return value;
  }
  return null;
}

function parseAgencyFromText(text: string) {
  return stripLabelNoise(parseBusinessValue(text, ['대행사'], ['담당자 이름', '담당자명', '담당자 연락처', '급여정보', '급여 정보', '상세정보', '사업자 정보']) || null);
}

function parseApartmentFeeFromText(text: string) {
  const value = parseBusinessValue(text, ['아파트 분양'], ['오피스텔 분양', '상가 분양', '상세정보', '상세 정보', '근무지 정보', '사업자 정보', '접수방법']);
  if (value && /\d|만|원|%|협의|지급/.test(value)) return stripLabelNoise(value);
  return null;
}

function splitManagerFields(nameValue: unknown, phoneValue: unknown, sourceText = '') {
  const parsedName = parseBusinessValue(sourceText, ['담당자 이름', '담당자명'], ['담당자 연락처', '연락처', '전화번호', '급여정보', '급여 정보', '상세정보', '사업자 정보']);
  const parsedPhone = parseBusinessValue(sourceText, ['담당자 연락처', '담당자연락처', '연락처', '전화번호'], ['급여정보', '급여 정보', '상세정보', '상세 정보', '사업자 정보', '접수방법']);
  const combined = `${parsedName || nameValue || ''} ${parsedPhone || phoneValue || ''}`;

  return {
    manager_name: cleanManagerName(parsedName || nameValue || combined) || '-',
    manager_phone: firstPhoneInText(combined) || normalizePhone(parsedPhone || phoneValue) || '-',
  };
}

function normalizeRows(rows: any[]) {
  const fixedRows = rows.map((row) => {
    const sourceText = [row.raw_text, row.detail_text, row.summary].filter(Boolean).join('\n');
    const manager = splitManagerFields(row.manager_name, row.manager_phone, sourceText);

    return {
      ...row,
      ad_section: normalizeAdSection(row.ad_section),
      manager_name: manager.manager_name,
      manager_phone: manager.manager_phone,
      agency_company: parseAgencyFromText(sourceText) || stripLabelNoise(row.agency_company) || '-',
      apartment_fee: parseApartmentFeeFromText(sourceText) || stripLabelNoise(row.apartment_fee) || '-',
    };
  });

  const phoneCounts = fixedRows.reduce<Record<string, number>>((acc, row) => {
    const phone = String(row.manager_phone || '').replace(/\D/g, '');
    if (!phone || phone === '-') return acc;
    acc[phone] = (acc[phone] || 0) + 1;
    return acc;
  }, {});

  return fixedRows.map((row) => {
    const phone = String(row.manager_phone || '').replace(/\D/g, '');
    const count = phone ? phoneCounts[phone] || 0 : 0;
    return {
      ...row,
      manager_phone_duplicate_count: count,
      manager_phone_is_duplicate: count > 1,
    };
  });
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

    const normalizedData = normalizeRows(data ?? []);

    return NextResponse.json({
      ok: true,
      count: normalizedData.length,
      data: normalizedData,
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
