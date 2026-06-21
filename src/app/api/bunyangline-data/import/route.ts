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


function collectRegexMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const safePattern = new RegExp(pattern.source, flags);
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = safePattern.exec(text)) !== null) {
    matches.push(match);
    if (match[0] === '') safePattern.lastIndex += 1;
  }

  return matches;
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


function normalizeRegionByAddress(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const compact = text.replace(/\s+/g, '');

  if (/서울특별시|서울시|서울/.test(compact)) return '서울';
  if (/인천광역시|인천시|인천/.test(compact)) return '인천';
  if (/부산광역시|부산시|부산/.test(compact)) return '부산';
  if (/울산광역시|울산시|울산/.test(compact)) return '울산';
  if (/대구광역시|대구시|대구/.test(compact)) return '대구';
  if (/대전광역시|대전시|대전/.test(compact)) return '대전';
  if (/세종특별자치시|세종시|세종/.test(compact)) return '세종';
  if (/광주광역시|광주광역/.test(compact)) return '광주';
  if (/강원특별자치도|강원도|강원|강릉|원주|춘천|속초|동해|삼척|태백|홍천|횡성|평창|정선|영월|인제|고성|양양|철원|화천|양구/.test(compact)) return '강원도';
  if (/제주특별자치도|제주도|제주|서귀포/.test(compact)) return '제주도';
  if (/충청북도|충청남도|충북|충남|충청|천안|아산|청주|충주|제천|공주|보령|서산|논산|계룡|당진|금산|부여|서천|청양|홍성|예산|태안|음성|진천|괴산|단양|옥천|영동|증평|보은/.test(compact)) return '충청도';
  if (/전북특별자치도|전라북도|전라남도|전북|전남|전라|전주|군산|익산|정읍|남원|김제|완주|진안|무주|장수|임실|순창|고창|부안|목포|여수|순천|나주|광양|담양|곡성|구례|고흥|보성|화순|장흥|강진|해남|영암|무안|함평|영광|장성|완도|진도|신안/.test(compact)) return '전라도';
  if (/경상북도|경상남도|경북|경남|경상|포항|경주|김천|안동|구미|영주|영천|상주|문경|경산|군위|의성|청송|영양|영덕|청도|고령|성주|칠곡|예천|봉화|울진|울릉|창원|진주|통영|사천|김해|밀양|거제|양산|의령|함안|창녕|고성|남해|하동|산청|함양|거창|합천/.test(compact)) return '경상도';

  if (/경기도|경기|수원|용인|성남|화성|안산|안양|평택|시흥|광명|군포|오산|이천|안성|의왕|과천|여주|양평|하남|광주시|부천|고양|파주|의정부|양주|동두천|포천|연천|가평|남양주|구리|김포/.test(compact)) {
    if (/고양|일산|파주|의정부|양주|동두천|포천|연천|가평|남양주|구리|김포/.test(compact)) return '경기북부';
    return '경기남부';
  }

  if (/광주/.test(compact)) return '광주';
  return null;
}

function extractAddressCandidatesFromText(value: unknown): string[] {
  const text = normalizeText(value);
  if (!text) return [];

  const candidates = new Set<string>();
  const lines = text.split('\n').map((line) => normalizeText(line)).filter((line): line is string => Boolean(line));

  const patterns = [
    /(?:근무지\s*정보|근무지정보)[\s\S]{0,700}/g,
    /(?:근무지\s*지역\s*주소|근무지역\s*주소|근무지\s*주소|근무주소|근무지역)\s*[:：]?\s*([^\n]{3,160})/g,
    /(?:사업지\s*정보|사업지정보|현장\s*정보|현장정보)[\s\S]{0,700}/g,
    /(?:사업지\s*주소|현장\s*주소|주소)\s*[:：]?\s*([^\n]{3,160})/g,
  ];

  for (const pattern of patterns) {
    for (const match of collectRegexMatches(text, pattern)) {
      const found = normalizeText(match[1] || match[0]);
      if (found) candidates.add(found.slice(0, 300));
    }
  }

  const regionAddressLine = /(서울특별시|서울시|인천광역시|인천시|부산광역시|부산시|울산광역시|울산시|대구광역시|대구시|대전광역시|대전시|세종특별자치시|세종시|광주광역시|강원특별자치도|강원도|제주특별자치도|제주도|충청북도|충청남도|충북|충남|전북특별자치도|전라북도|전라남도|전북|전남|경상북도|경상남도|경북|경남|경기도)\s*[^\n]{0,120}/g;
  for (const line of lines) {
    for (const match of collectRegexMatches(line, regionAddressLine)) {
      const found = normalizeText(match[0]);
      if (found) candidates.add(found.slice(0, 300));
    }
  }

  return Array.from(candidates).filter((candidate) => {
    const compact = candidate.replace(/\s+/g, '');
    if (compact.length < 3) return false;
    if (/서울경기|경기인천|부산대구|광주대전|전국|지역현장|맞춤현장|지도현장|관심현장|서포터즈/.test(compact)) return false;
    return true;
  });
}

function inferRegionFromAddressText(value: unknown): string | null {
  const direct = normalizeRegionByAddress(value);
  if (direct) return direct;

  for (const candidate of extractAddressCandidatesFromText(value)) {
    const region = normalizeRegionByAddress(candidate);
    if (region) return region;
  }

  return null;
}

function inferActualRegionName(params: {
  listRegionName: string;
  workAddress: unknown;
  siteAddress: unknown;
  rawText: unknown;
}) {
  return (
    inferRegionFromAddressText(params.workAddress) ||
    inferRegionFromAddressText(params.siteAddress) ||
    inferRegionFromAddressText(params.rawText) ||
    params.listRegionName ||
    '미지정'
  );
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

function compactLabel(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

function sliceSectionLinesFromText(textValue: unknown, startLabels: string[], endLabels: string[]) {
  const text = normalizeText(textValue);
  if (!text) return [];

  const lines = text.split('\n').map((line) => normalizeText(line)).filter(Boolean) as string[];
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const compact = compactLabel(lines[index]);
    if (startLabels.some((label) => compact === compactLabel(label) || compact.includes(compactLabel(label)))) {
      start = index + 1;
      break;
    }
  }
  if (start < 0) return [];

  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    const compact = compactLabel(lines[index]);
    if (endLabels.some((label) => compact === compactLabel(label) || compact.includes(compactLabel(label)))) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end);
}

function extractScopedLabelValue(sectionLines: string[], labels: string[], allLabels: string[]) {
  if (!sectionLines.length) return null;

  for (let index = 0; index < sectionLines.length; index += 1) {
    const line = normalizeText(sectionLines[index]);
    if (!line) continue;
    const compact = compactLabel(line);

    for (const label of labels) {
      const labelCompact = compactLabel(label);
      if (compact === labelCompact || compact.startsWith(labelCompact)) {
        const inline = line.replace(new RegExp(`^${label.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')}\\s*[:：]?\\s*`), '').trim();
        if (inline && compactLabel(inline) !== labelCompact && !allLabels.some((item) => compactLabel(inline) === compactLabel(item))) return inline;

        for (let cursor = index + 1; cursor < Math.min(index + 6, sectionLines.length); cursor += 1) {
          const next = normalizeText(sectionLines[cursor]);
          if (!next) continue;
          if (allLabels.some((item) => compactLabel(next) === compactLabel(item) || compactLabel(next).startsWith(compactLabel(item)))) break;
          return next;
        }
      }
    }
  }

  return null;
}

function extractAgencyFromRawText(textValue: unknown) {
  const lines = sliceSectionLinesFromText(textValue, ['사업자 정보', '사업자정보'], ['급여정보', '급여 정보', '사업지 정보', '사업지정보', '상세정보', '상세 정보', '접수방법', '접수 방법']);
  return stripLabelNoise(extractScopedLabelValue(lines, ['대행사'], ['시행사', '시공사', '신탁사', '대행사', '담당자 이름', '담당자명', '담당자 연락처', '담당자연락처', '연락처', '전화번호']));
}

function extractApartmentFeeFromRawText(textValue: unknown) {
  const lines = sliceSectionLinesFromText(textValue, ['급여정보', '급여 정보'], ['상세정보', '상세 정보', '근무지 정보', '근무지정보', '접수방법', '접수 방법', '기업정보', '사업자 정보', '사업자정보', '사업지 정보', '사업지정보']);
  const value = extractScopedLabelValue(lines, ['아파트 분양', '아파트분양'], ['형태', '계약 수수료', '계약수수료', '아파트 분양', '아파트분양', '오피스텔 분양', '오피스텔분양', '상가 분양', '상가분양', '수수료']);
  if (value && /\d|만|원|%|협의|지급/.test(value)) return stripLabelNoise(value);
  return null;
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
  const rawTextForSection = firstValue(row, ['raw_text', 'rawText']) || firstValue(row, ['detail_text', 'detailText', 'details']);
  const scopedAgency = extractAgencyFromRawText(rawTextForSection);
  const scopedApartmentFee = extractApartmentFeeFromRawText(rawTextForSection);
  const listRegionName = normalizeText(firstValue(row, ['list_region_name', 'listRegionName', 'region_name', 'regionName', 'region'])) || '미지정';
  const siteAddress = normalizeText(firstValue(row, ['site_address', 'siteAddress', 'business_address', 'businessAddress'])) || null;
  const workAddress = normalizeText(firstValue(row, ['work_address', 'workAddress', 'address'])) || null;
  const actualRegionName = inferActualRegionName({
    listRegionName,
    workAddress,
    siteAddress,
    rawText: rawTextForSection,
  });

  return {
    source_url: sourceUrl,
    source_id: normalizeText(firstValue(row, ['source_id', 'sourceId', 'post_id', 'postId'])) || null,
    region_name: actualRegionName,
    ad_section: normalizeAdSection(firstValue(row, ['ad_section', 'adSection', 'section', 'listing_section', 'listingSection'])),
    site_name: normalizeText(firstValue(row, ['site_name', 'siteName', 'field_name', 'fieldName'])) || '-',
    posted_at: postedAt,
    posted_datetime: postedDatetime,
    manager_name: managerFields.managerName,
    manager_phone: managerFields.managerPhone,
    agency_company: scopedAgency || stripLabelNoise(firstValue(row, ['agency_company', 'agencyCompany', 'agency'])) || '-',
    apartment_fee: scopedApartmentFee || stripLabelNoise(firstValue(row, ['apartment_fee', 'apartmentFee', 'commission', 'fee'])) || '-',
    move_in_date: normalizeText(firstValue(row, ['move_in_date', 'moveInDate', 'start_date', 'startDate'])) || '-',
    assigned_to: existingAssignedTo || normalizeAssignedTo(firstValue(row, ['assigned_to', 'assignedTo'])) || null,
    detail_text: normalizeText(firstValue(row, ['detail_text', 'detailText', 'details'])) || '-',
    title: normalizeText(firstValue(row, ['title', 'post_title', 'postTitle'])) || null,
    summary: normalizeText(firstValue(row, ['summary', 'subtitle', 'description'])) || null,
    site_address: siteAddress,
    work_address: workAddress,
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
