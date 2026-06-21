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

function inferDisplayRegion(row: any) {
  return (
    normalizeRegionByAddress(row.work_address) ||
    normalizeRegionByAddress(row.site_address) ||
    normalizeRegionByAddress(row.raw_text) ||
    normalizeText(row.region_name) ||
    '미지정'
  );
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

function escapeLabelPart(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        const labelPattern = label.split(/\s+/).map(escapeLabelPart).join('\\s*');
        const inline = line.replace(new RegExp(`^${labelPattern}\\s*[:：]?\\s*`), '').trim();
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

function parseAgencyFromText(text: string) {
  const businessLines = sliceSectionLinesFromText(text, ['사업자 정보', '사업자정보'], ['급여정보', '급여 정보', '사업지 정보', '사업지정보', '상세정보', '상세 정보', '접수방법', '접수 방법']);
  return stripLabelNoise(extractScopedLabelValue(businessLines, ['대행사'], ['시행사', '시공사', '신탁사', '대행사', '담당자 이름', '담당자명', '담당자 연락처', '담당자연락처', '연락처', '전화번호']));
}

function parseApartmentFeeFromText(text: string) {
  const salaryLines = sliceSectionLinesFromText(text, ['급여정보', '급여 정보'], ['상세정보', '상세 정보', '근무지 정보', '근무지정보', '접수방법', '접수 방법', '기업정보', '사업자 정보', '사업자정보', '사업지 정보', '사업지정보']);
  const value = extractScopedLabelValue(salaryLines, ['아파트 분양', '아파트분양'], ['형태', '계약 수수료', '계약수수료', '아파트 분양', '아파트분양', '오피스텔 분양', '오피스텔분양', '상가 분양', '상가분양', '수수료']);
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
      region_name: inferDisplayRegion(row),
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
