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

type ImportRow = {
  source_url?: unknown;
  sourceUrl?: unknown;
  source_post_key?: unknown;
  sourcePostKey?: unknown;
  region_id?: unknown;
  regionId?: unknown;
  region_name?: unknown;
  regionName?: unknown;
  list_region_name?: unknown;
  listRegionName?: unknown;
  actual_region_name?: unknown;
  actualRegionName?: unknown;
  actual_region_source?: unknown;
  actualRegionSource?: unknown;
  region_match_text?: unknown;
  regionMatchText?: unknown;
  site_name?: unknown;
  siteName?: unknown;
  site_address?: unknown;
  siteAddress?: unknown;
  posted_at?: unknown;
  postedAt?: unknown;
  posted_datetime?: unknown;
  postedDatetime?: unknown;
  manager_name?: unknown;
  managerName?: unknown;
  manager_phone?: unknown;
  managerPhone?: unknown;
  agency_company?: unknown;
  agencyCompany?: unknown;
  apartment_fee?: unknown;
  apartmentFee?: unknown;
  detail_text?: unknown;
  detailText?: unknown;
  raw_text?: unknown;
  rawText?: unknown;
  crawled_at?: unknown;
  crawledAt?: unknown;
};

type NormalizedItem = {
  sourceUrl: string;
  dbRow: Record<string, string | boolean | null>;
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
      message: supabaseError.message ?? '알 수 없는 오류입니다.',
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

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}

function normalizePhone(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  return digits;
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const iso = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const korean = text.match(/(20\d{2})[.\/년\s-]+(\d{1,2})[.\/월\s-]+(\d{1,2})/);
  if (korean) {
    return `${korean[1]}-${korean[2].padStart(2, '0')}-${korean[3].padStart(2, '0')}`;
  }

  return null;
}

function normalizeDateTime(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

function normalizeSourceUrl(value: unknown): string {
  const raw = normalizeText(value) || '';
  if (!raw) return '';

  try {
    const url = new URL(raw, 'https://www.bunyangline.com');
    url.hash = '';

    const removableParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    removableParams.forEach((param) => url.searchParams.delete(param));

    return url.toString();
  } catch {
    return raw;
  }
}

function hashSourceUrl(url: string) {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return `bunyangline_${Math.abs(hash)}`;
}

function parseSecret(request: NextRequest, body: any) {
  const auth = request.headers.get('authorization') ?? '';
  const bearerSecret = auth.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = request.headers.get('x-import-secret') ?? '';
  const querySecret = new URL(request.url).searchParams.get('secret') ?? '';
  const bodySecret = typeof body?.secret === 'string' ? body.secret : '';

  return bearerSecret || headerSecret || querySecret || bodySecret;
}

function getFirst(row: ImportRow, keys: Array<keyof ImportRow>) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function normalizeItem(row: ImportRow): NormalizedItem {
  const sourceUrl = normalizeSourceUrl(getFirst(row, ['source_url', 'sourceUrl']));
  const regionId = normalizeText(getFirst(row, ['region_id', 'regionId']));

  const listRegionName =
    normalizeText(getFirst(row, ['list_region_name', 'listRegionName'])) ||
    normalizeText(getFirst(row, ['region_name', 'regionName'])) ||
    '미지정';

  const actualRegionName =
    normalizeText(getFirst(row, ['actual_region_name', 'actualRegionName'])) ||
    normalizeText(getFirst(row, ['region_name', 'regionName'])) ||
    listRegionName;

  const regionName = actualRegionName || listRegionName || '미지정';
  const postedDatetime = normalizeDateTime(getFirst(row, ['posted_datetime', 'postedDatetime']));
  const postedAt = normalizeDate(getFirst(row, ['posted_at', 'postedAt'])) || (postedDatetime ? postedDatetime.slice(0, 10) : null);

  const dbRow: Record<string, string | boolean | null> = {
    source: 'bunyangline',
    source_url: sourceUrl,
    source_post_key: normalizeText(getFirst(row, ['source_post_key', 'sourcePostKey'])) || hashSourceUrl(sourceUrl),
    region_id: regionId,
    region_name: regionName,
    list_region_name: listRegionName,
    actual_region_name: actualRegionName,
    actual_region_source: normalizeText(getFirst(row, ['actual_region_source', 'actualRegionSource'])) || 'crawler-page-region',
    region_match_text: normalizeText(getFirst(row, ['region_match_text', 'regionMatchText'])),
    site_name: normalizeText(getFirst(row, ['site_name', 'siteName'])),
    site_address: normalizeText(getFirst(row, ['site_address', 'siteAddress'])),
    posted_at: postedAt,
    posted_datetime: postedDatetime,
    manager_name: normalizeText(getFirst(row, ['manager_name', 'managerName'])),
    manager_phone: normalizePhone(getFirst(row, ['manager_phone', 'managerPhone'])),
    agency_company: normalizeText(getFirst(row, ['agency_company', 'agencyCompany'])),
    apartment_fee: normalizeText(getFirst(row, ['apartment_fee', 'apartmentFee'])),
    detail_text: normalizeText(getFirst(row, ['detail_text', 'detailText'])),
    raw_text: normalizeText(getFirst(row, ['raw_text', 'rawText'])),
    crawled_at: normalizeDateTime(getFirst(row, ['crawled_at', 'crawledAt'])) || new Date().toISOString(),
  };

  return {
    sourceUrl,
    dbRow,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const expectedSecret = process.env.BUNYANGLINE_IMPORT_SECRET;
    const receivedSecret = parseSecret(request, body);

    if (!expectedSecret) {
      return NextResponse.json({ ok: false, message: 'BUNYANGLINE_IMPORT_SECRET 환경변수가 설정되지 않았습니다.' }, { status: 500 });
    }

    if (receivedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, message: '분양라인 가져오기 secret이 일치하지 않습니다.' }, { status: 401 });
    }

    const rawItems = Array.isArray(body?.rows) ? body.rows : Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
    if (!rawItems.length) {
      return NextResponse.json({ ok: false, message: '가져올 분양라인 데이터가 없습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const seenSourceUrls = new Set<string>();
    const results: Array<{ source_url: string; status: string; id?: string; reason?: string }> = [];

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let requestDuplicateCount = 0;

    for (const raw of rawItems) {
      const item = normalizeItem(raw as ImportRow);

      if (!item.sourceUrl) {
        skippedCount += 1;
        results.push({ source_url: '', status: 'skipped', reason: 'source_url 없음' });
        continue;
      }

      if (seenSourceUrls.has(item.sourceUrl)) {
        requestDuplicateCount += 1;
        results.push({ source_url: item.sourceUrl, status: 'duplicate_in_request', reason: '같은 요청 안의 동일 source_url' });
        continue;
      }
      seenSourceUrls.add(item.sourceUrl);

      const { data: existing, error: findError } = await supabase
        .from('bunyangline_data')
        .select('id, assigned_to, is_new')
        .eq('source_url', item.sourceUrl)
        .maybeSingle();

      if (findError) throw findError;

      if (existing?.id) {
        const { data, error } = await supabase
          .from('bunyangline_data')
          .update(item.dbRow)
          .eq('id', existing.id)
          .select('id')
          .single();

        if (error) throw error;
        updatedCount += 1;
        results.push({ source_url: item.sourceUrl, status: 'updated', id: String(data.id) });
      } else {
        const { data, error } = await supabase
          .from('bunyangline_data')
          .insert({ ...item.dbRow, is_new: true })
          .select('id')
          .single();

        if (error) throw error;
        insertedCount += 1;
        results.push({ source_url: item.sourceUrl, status: 'inserted', id: String(data.id) });
      }
    }

    return NextResponse.json({
      ok: true,
      message: '분양라인 데이터 가져오기 완료',
      duplicateRule: 'source_url 단독 기준',
      total: rawItems.length,
      insertedCount,
      updatedCount,
      skippedCount,
      requestDuplicateCount,
      results,
    });
  } catch (error) {
    const errorPayload = toErrorPayload(error);
    console.error('[bunyangline-data/import] 오류:', errorPayload);

    return NextResponse.json(
      {
        ok: false,
        message: '분양라인 데이터 가져오기 중 오류가 발생했습니다.',
        error: errorPayload.message,
        errorDetails: errorPayload,
      },
      { status: 500 }
    );
  }
}
