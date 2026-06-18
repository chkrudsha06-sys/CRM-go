import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IncomingBunyanglineRow = {
  source_url: string;
  source_post_key?: string;
  region_id?: string | null;
  region_name: string;
  site_name?: string | null;
  site_address?: string | null;
  posted_at?: string | null;
  posted_datetime?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  agency_company?: string | null;
  apartment_fee?: string | null;
  detail_text?: string | null;
  raw_text?: string | null;
  crawled_at?: string | null;
};

type CleanBunyanglineRow = {
  source: 'bunyangline';
  source_url: string;
  source_post_key: string;
  region_id: string | null;
  region_name: string;
  site_name: string | null;
  site_address: string | null;
  posted_at: string | null;
  posted_datetime: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  agency_company: string | null;
  apartment_fee: string | null;
  detail_text: string | null;
  raw_text: string | null;
  crawled_at: string;
};

type ExistingBunyanglineRow = {
  source_url: string;
  site_name: string | null;
  site_address: string | null;
  is_new: boolean;
};

type BunyanglineRowWithNewFlag = CleanBunyanglineRow & {
  is_new: boolean;
};

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
    throw new Error('Supabase 환경변수가 누락되었습니다. NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
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
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}

function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 8 || digits.length > 11) return digits;
  return digits;
}

function normalizeDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const match = text.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!match) return null;

  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeDateTime(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  if (/^20\d{2}-\d{2}-\d{2}T/.test(text)) {
    return text;
  }

  const match = text.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(?:[일\sT]+(\d{1,2})[:시\s]+(\d{1,2})(?:[:분\s]+(\d{1,2}))?)?/);
  if (!match) return null;

  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  const hh = (match[4] || '00').padStart(2, '0');
  const mm = (match[5] || '00').padStart(2, '0');
  const ss = (match[6] || '00').padStart(2, '0');

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
}

function hashSourceUrl(url: string): string {
  let hash = 0;

  for (let i = 0; i < url.length; i += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }

  return `bunyangline_${Math.abs(hash)}`;
}

function requireImportSecret(request: NextRequest): boolean {
  const expected = process.env.BUNYANGLINE_IMPORT_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  const provided = auth.replace(/^Bearer\s+/i, '').trim() || request.headers.get('x-import-secret') || '';

  if (!expected) {
    throw new Error('BUNYANGLINE_IMPORT_SECRET 환경변수가 설정되지 않았습니다.');
  }

  return provided === expected;
}

function toCleanRow(row: IncomingBunyanglineRow): CleanBunyanglineRow {
  const sourceUrl = normalizeText(row.source_url);
  const regionName = normalizeText(row.region_name);
  const postedDateTime = normalizeDateTime(row.posted_datetime) || normalizeDateTime(row.posted_at);

  if (!sourceUrl) throw new Error('source_url이 비어있는 데이터가 있습니다.');
  if (!regionName) throw new Error('region_name이 비어있는 데이터가 있습니다.');

  return {
    source: 'bunyangline',
    source_url: sourceUrl,
    source_post_key: normalizeText(row.source_post_key) || hashSourceUrl(sourceUrl),
    region_id: normalizeText(row.region_id),
    region_name: regionName,
    site_name: normalizeText(row.site_name),
    site_address: normalizeText(row.site_address),
    posted_at: normalizeDate(row.posted_at) || normalizeDate(postedDateTime),
    posted_datetime: postedDateTime,
    manager_name: normalizeText(row.manager_name),
    manager_phone: normalizePhone(row.manager_phone),
    agency_company: normalizeText(row.agency_company),
    apartment_fee: normalizeText(row.apartment_fee),
    detail_text: normalizeText(row.detail_text),
    raw_text: normalizeText(row.raw_text),
    crawled_at: normalizeText(row.crawled_at) || new Date().toISOString(),
  };
}

function sameValue(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeText(a)?.replace(/\s/g, '') ?? '';
  const right = normalizeText(b)?.replace(/\s/g, '') ?? '';
  return Boolean(left && right && left === right);
}

export async function POST(request: NextRequest) {
  try {
    if (!requireImportSecret(request)) {
      return NextResponse.json({ ok: false, message: '인증키가 올바르지 않습니다.' }, { status: 401 });
    }

    const body = await request.json();
    const incomingRows: IncomingBunyanglineRow[] = Array.isArray(body?.rows) ? body.rows : [];

    if (incomingRows.length === 0) {
      return NextResponse.json({ ok: false, message: '저장할 rows가 없습니다.' }, { status: 400 });
    }

    const rows: CleanBunyanglineRow[] = incomingRows.map((row: IncomingBunyanglineRow) => toCleanRow(row));
    const supabase = getSupabaseAdmin();

    const { data: existingRows, error: existingError } = await supabase
      .from('bunyangline_data')
      .select('source_url, site_name, site_address, is_new');

    if (existingError) throw existingError;

    const existing: ExistingBunyanglineRow[] = (existingRows ?? []) as ExistingBunyanglineRow[];
    const existingByUrl = new Map<string, ExistingBunyanglineRow>(
      existing.map((row: ExistingBunyanglineRow) => [row.source_url, row])
    );

    const rowsWithNewFlag: BunyanglineRowWithNewFlag[] = rows.map((row: CleanBunyanglineRow) => {
      const existingSameUrl = existingByUrl.get(row.source_url);

      if (existingSameUrl) {
        return {
          ...row,
          is_new: existingSameUrl.is_new,
        };
      }

      const duplicatedProject = existing.some((oldRow: ExistingBunyanglineRow) => {
        const siteDuplicated = sameValue(oldRow.site_name, row.site_name);
        const addressDuplicated = sameValue(oldRow.site_address, row.site_address);
        return siteDuplicated || addressDuplicated;
      });

      return {
        ...row,
        is_new: !duplicatedProject,
      };
    });

    const { data, error } = await supabase
      .from('bunyangline_data')
      .upsert(rowsWithNewFlag, {
        onConflict: 'source_url',
        ignoreDuplicates: false,
      })
      .select('id, region_name, site_name, posted_at, posted_datetime, manager_name, manager_phone, agency_company, apartment_fee, is_new, source_url');

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: '분양라인데이터 저장 완료',
      receivedCount: incomingRows.length,
      savedCount: data?.length ?? 0,
      data,
    });
  } catch (error) {
    const errorPayload = toErrorPayload(error);
    console.error('[bunyangline-data/import] 저장 오류:', errorPayload);

    return NextResponse.json(
      {
        ok: false,
        message: '분양라인데이터 저장 중 오류가 발생했습니다.',
        error: errorPayload.message,
        errorDetails: errorPayload,
      },
      { status: 500 }
    );
  }
}
