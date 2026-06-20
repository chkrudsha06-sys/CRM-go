import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ImportItem = Record<string, unknown>;

type ExistingRow = {
  id: number | string;
  source_url: string | null;
  assigned_to: string | null;
};

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

function firstValue(row: ImportItem, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function normalizeSourceUrl(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  try {
    const url = new URL(raw, 'https://www.bunyangline.com');
    url.hash = '';
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_medium');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('utm_term');
    url.searchParams.delete('utm_content');
    return url.toString();
  } catch {
    return raw;
  }
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

function normalizeAdSection(value: unknown): string {
  const text = String(value ?? '').replace(/\s+/g, '').toLowerCase();
  if (text.includes('unique') || text.includes('유니크')) return '유니크';
  if (text.includes('superior') || text.includes('슈페리어')) return '슈페리어';
  if (text.includes('전국top') || text.includes('전국탑') || text.includes('nationaltop')) return '전국TOP';
  if (text.includes('지역top') || text.includes('지역탑') || text.includes('regionaltop')) return '지역TOP';
  return '일반';
}

function firstPhoneInText(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const match =
    text.match(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] ||
    text.match(/(?:02|0[3-6]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] ||
    text.match(/\b\d{4}[-\s.]?\d{4}\b/)?.[0] ||
    null;

  return match ? normalizePhone(match) : null;
}

function cleanManagerName(value: unknown): string | null {
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

function stripLabelNoise(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  return text
    .replace(/^(시행사|시공사|신탁사|대행사|담당자\s*이름|담당자\s*연락처|형태|아파트\s*분양)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function splitManagerFields(nameValue: unknown, phoneValue: unknown) {
  const combined = normalizeText(`${nameValue ?? ''} ${phoneValue ?? ''}`);
  return {
    managerName: cleanManagerName(nameValue) || cleanManagerName(combined) || '-',
    managerPhone: firstPhoneInText(combined) || normalizePhone(phoneValue) || '-',
  };
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const iso = text.match(/(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})/);
  if (!iso) return null;

  return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
}

function normalizeDateTime(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const match = text.match(/(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})(?:[일\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  const year = match[1];
  const month = match[2].padStart(2, '0');
  const day = match[3].padStart(2, '0');
  const hour = (match[4] || '00').padStart(2, '0');
  const minute = (match[5] || '00').padStart(2, '0');
  const second = (match[6] || '00').padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

function normalizeAssignedTo(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const allowed = ['조계현', '이세호', '기여운', '최연전'];
  return allowed.includes(text) ? text : null;
}

function buildDbRow(row: ImportItem, existingAssignedTo?: string | null) {
  const sourceUrl = normalizeSourceUrl(firstValue(row, ['source_url', 'sourceUrl', 'source']));
  if (!sourceUrl) return null;

  const postedDatetime = normalizeDateTime(firstValue(row, ['posted_datetime', 'postedDatetime', 'registered_datetime', 'registeredDatetime']));
  const postedAt =
    normalizeDate(firstValue(row, ['posted_at', 'postedAt', 'registered_date', 'registeredDate'])) ||
    (postedDatetime ? postedDatetime.slice(0, 10) : null);

  const managerFields = splitManagerFields(
    firstValue(row, ['manager_name', 'managerName', 'contact_name', 'contactName']),
    firstValue(row, ['manager_phone', 'managerPhone', 'contact_phone', 'contactPhone'])
  );

  return {
    source_url: sourceUrl,
    source_id: normalizeText(firstValue(row, ['source_id', 'sourceId', 'post_id', 'postId'])) || null,
    region_name: normalizeText(firstValue(row, ['region_name', 'regionName', 'region'])) || '미지정',
    ad_section: normalizeAdSection(firstValue(row, ['ad_section', 'adSection', 'section', 'listing_section', 'listingSection'])),
    site_name: normalizeText(firstValue(row, ['site_name', 'siteName', 'field_name', 'fieldName'])) || '-',
    posted_at: postedAt,
    posted_datetime: postedDatetime,
    manager_name: managerFields.managerName,
    manager_phone: managerFields.managerPhone,
    agency_company: stripLabelNoise(firstValue(row, ['agency_company', 'agencyCompany', 'agency'])) || '-',
    apartment_fee: stripLabelNoise(firstValue(row, ['apartment_fee', 'apartmentFee', 'commission', 'fee'])) || '-',
    move_in_date: normalizeText(firstValue(row, ['move_in_date', 'moveInDate', 'start_date', 'startDate'])) || '-',
    assigned_to: existingAssignedTo || normalizeAssignedTo(firstValue(row, ['assigned_to', 'assignedTo'])) || null,
    detail_text: normalizeText(firstValue(row, ['detail_text', 'detailText', 'details'])) || '-',
    title: normalizeText(firstValue(row, ['title', 'post_title', 'postTitle'])) || null,
    summary: normalizeText(firstValue(row, ['summary', 'subtitle', 'description'])) || null,
    site_address: normalizeText(firstValue(row, ['site_address', 'siteAddress', 'business_address', 'businessAddress'])) || null,
    work_address: normalizeText(firstValue(row, ['work_address', 'workAddress', 'address'])) || null,
    category: normalizeText(firstValue(row, ['category', 'product_type', 'productType'])) || null,
    list_date_group: normalizeText(firstValue(row, ['list_date_group', 'listDateGroup'])) || null,
    raw_text: normalizeText(firstValue(row, ['raw_text', 'rawText'])) || null,
    crawled_at: normalizeDateTime(firstValue(row, ['crawled_at', 'crawledAt'])) || new Date().toISOString(),
  };
}

function getSecretFromRequest(request: NextRequest, body: any) {
  const auth = request.headers.get('authorization') ?? '';
  const bearerSecret = auth.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = request.headers.get('x-import-secret') ?? '';
  const querySecret = new URL(request.url).searchParams.get('secret') ?? '';
  const bodySecret = typeof body?.secret === 'string' ? body.secret : '';

  return bearerSecret || headerSecret || querySecret || bodySecret;
}

function errorPayload(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (typeof error === 'object' && error !== null) return error;
  return { message: String(error) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const expectedSecret = process.env.BUNYANGLINE_IMPORT_SECRET;
    const incomingSecret = getSecretFromRequest(request, body);

    if (expectedSecret && incomingSecret !== expectedSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: '분양라인 가져오기 비밀키가 일치하지 않습니다.',
        },
        { status: 401 }
      );
    }

    const rawItems = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ ok: true, received: 0, insertedOrUpdated: 0, skipped: 0, message: '저장할 항목이 없습니다.' });
    }

    const supabase = getSupabaseAdmin();
    const incomingSourceUrls = rawItems
      .map((item: ImportItem) => normalizeSourceUrl(firstValue(item, ['source_url', 'sourceUrl', 'source'])))
      .filter((value: string | null): value is string => Boolean(value));

    const existingAssignedMap = new Map<string, string | null>();

    if (incomingSourceUrls.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from('bunyangline_data')
        .select('id, source_url, assigned_to')
        .in('source_url', Array.from(new Set(incomingSourceUrls)));

      if (existingError) throw existingError;

      (existingRows as ExistingRow[] | null)?.forEach((row) => {
        if (row.source_url) existingAssignedMap.set(row.source_url, row.assigned_to || null);
      });
    }

    const rows = rawItems
      .map((item: ImportItem) => {
        const sourceUrl = normalizeSourceUrl(firstValue(item, ['source_url', 'sourceUrl', 'source']));
        return buildDbRow(item, sourceUrl ? existingAssignedMap.get(sourceUrl) : null);
      })
      .filter((row: ReturnType<typeof buildDbRow>): row is NonNullable<ReturnType<typeof buildDbRow>> => Boolean(row));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, received: rawItems.length, insertedOrUpdated: 0, skipped: rawItems.length, message: '유효한 source_url 항목이 없습니다.' });
    }

    const { data, error } = await supabase
      .from('bunyangline_data')
      .upsert(rows, { onConflict: 'source_url' })
      .select('id, source_url');

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      received: rawItems.length,
      insertedOrUpdated: data?.length ?? rows.length,
      skipped: rawItems.length - rows.length,
      preservedAssignedCount: Array.from(existingAssignedMap.values()).filter(Boolean).length,
    });
  } catch (error) {
    const payload = errorPayload(error);
    console.error('[bunyangline-data/import] 오류:', payload);

    return NextResponse.json(
      {
        ok: false,
        message: '분양라인 데이터 저장 중 오류가 발생했습니다.',
        error: typeof payload === 'object' && payload && 'message' in payload ? (payload as any).message : String(payload),
        errorDetails: payload,
      },
      { status: 500 }
    );
  }
}
