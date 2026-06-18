import { chromium, Page, Response } from '@playwright/test';

const BASE_URL = 'https://www.bunyangline.com';

const REGIONS = [
  { id: '1', name: '서울' },
  { id: '2', name: '경기남부' },
  { id: '3', name: '경기북부' },
  { id: '4', name: '인천' },
  { id: '5', name: '부산' },
  { id: '6', name: '울산' },
  { id: '7', name: '대구' },
  { id: '8', name: '경상도' },
  { id: '9', name: '대전' },
  { id: '10', name: '세종' },
  { id: '11', name: '충청도' },
  { id: '12', name: '광주' },
  { id: '13', name: '전라도' },
  { id: '14', name: '강원도' },
  { id: '15', name: '제주도' },
];

const DEFAULT_IMPORT_BATCH_SIZE = Number(process.env.BUNYANGLINE_IMPORT_BATCH_SIZE || '3');
const IMPORT_BATCH_SIZE = Number.isFinite(DEFAULT_IMPORT_BATCH_SIZE) && DEFAULT_IMPORT_BATCH_SIZE > 0
  ? Math.min(DEFAULT_IMPORT_BATCH_SIZE, 5)
  : 3;
const MAX_DETAIL_TEXT_LENGTH = Number(process.env.BUNYANGLINE_MAX_DETAIL_TEXT_LENGTH || '2200');
const MAX_RAW_TEXT_LENGTH = Number(process.env.BUNYANGLINE_MAX_RAW_TEXT_LENGTH || '0');

type Region = (typeof REGIONS)[number];

type CrawledRow = {
  source_url: string;
  source_post_key: string;
  region_id: string;
  region_name: string;
  site_name: string | null;
  site_address: string | null;
  posted_at: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  agency_company: string | null;
  apartment_fee: string | null;
  detail_text: string | null;
  raw_text: string | null;
  crawled_at: string;
};

type JsonCandidate = {
  value: Record<string, unknown>;
  responseUrl: string;
};

const STOP_SITE_NAMES = new Set([
  '분양라인', '지역현장', '맞춤현장', '지도현장', '관심현장', '서포터즈',
  '본부/팀장', '팀장/팀원', '본부장', '팀장', '팀원', '직원', '분양대행',
  '계약 수수료', '기본급 +인센', '기본급+인센', '경력무관', '일비', '숙소비',
  'HOT', '신규', '대박', '프리미엄', '전국 Top', '지역 Top', '일반 구인글',
]);

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function decodeEscapedLineBreaks(value: string) {
  return value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function normalizeSpace(value: unknown) {
  return decodeEscapedLineBreaks(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compact(value: unknown) {
  const text = normalizeSpace(value);
  return text || null;
}

function limitText(value: unknown, maxLength: number) {
  const text = compact(value);
  if (!text) return null;
  if (!maxLength || maxLength <= 0) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceKey(url: string) {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return `bunyangline_${Math.abs(hash)}`;
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;

  // 담당자 연락처는 임의 숫자/금액과 섞이지 않도록 휴대폰 또는 국내 전화 형식만 허용합니다.
  if (/^01[016789]\d{7,8}$/.test(digits)) return digits;
  if (/^02\d{7,8}$/.test(digits)) return digits;
  if (/^0[3-6][1-4]\d{7,8}$/.test(digits)) return digits;
  return null;
}

function extractPhone(text: string) {
  const mobile = text.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
  if (mobile) return normalizePhone(mobile[0]);
  const tel = text.match(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  return normalizePhone(tel?.[0] ?? null);
}

function normalizeDate(value: unknown) {
  const text = normalizeSpace(value);
  if (!text) return null;

  const iso = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dot = text.match(/(20\d{2})\.(\d{1,2})\.(\d{1,2})/);
  if (dot) return `${dot[1]}-${dot[2].padStart(2, '0')}-${dot[3].padStart(2, '0')}`;

  const kr = text.match(/(20\d{2})[\/년\s-]+(\d{1,2})[\/월\s-]+(\d{1,2})/);
  if (kr) return `${kr[1]}-${kr[2].padStart(2, '0')}-${kr[3].padStart(2, '0')}`;

  return null;
}

function isDateOnOrAfter(value: string | null, minDate: string) {
  if (!value) return false;
  return value >= minDate;
}

function linesOf(text: string) {
  return normalizeSpace(text)
    .split('\n')
    .map((line) => normalizeSpace(line))
    .filter(Boolean);
}

function objectText(obj: Record<string, unknown>) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function getValueByExactOrNormalizedKey(obj: Record<string, unknown>, keys: string[]) {
  const exactMap = new Map(Object.entries(obj).map(([key, value]) => [key, value]));
  for (const key of keys) {
    if (exactMap.has(key)) return exactMap.get(key);
  }

  const normalizedTargets = keys.map((key) => key.toLowerCase().replace(/[_\s-]/g, ''));
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[_\s-]/g, '');
    if (normalizedTargets.includes(normalizedKey)) return value;
  }

  return null;
}

function getStringByKey(obj: Record<string, unknown>, keys: string[]) {
  const value = getValueByExactOrNormalizedKey(obj, keys);
  if (value == null) return null;
  if (Array.isArray(value) || typeof value === 'object') return null;
  return compact(value);
}

function getNestedArray(obj: Record<string, unknown>, keys: string[]) {
  const value = getValueByExactOrNormalizedKey(obj, keys);
  return Array.isArray(value) ? value : null;
}

function getId(obj: Record<string, unknown>) {
  const value = getStringByKey(obj, [
    'idx', 'id', 'seq', 'no', 'uid', 'wr_id', 'recruit_id', 'recruitId', 'post_id', 'postId', 'site_idx', 'siteIdx',
  ]);
  return value || null;
}

function isProbablyDateText(text: string | null) {
  if (!text) return false;
  return Boolean(normalizeDate(text)) && text.replace(/[^0-9]/g, '').length >= 6;
}

function isValidSiteName(value: unknown) {
  const text = compact(value);
  if (!text) return false;
  if (text.length < 4 || text.length > 160) return false;
  if (STOP_SITE_NAMES.has(text)) return false;
  if (isProbablyDateText(text)) return false;
  if (/^\d+[,.]?\d*\s*(원|만원|%)?$/.test(text)) return false;
  if (/^(AD|HOME|검색|확인|목록을 로딩중입니다)/i.test(text)) return false;
  return true;
}

function pickAfterLabel(text: string, labels: string[], maxLength = 160) {
  const lines = linesOf(text);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inline = text.match(new RegExp(`${escaped}\\s*[:：]?\\s*([^\\n]{1,${maxLength}})`, 'i'));
    if (inline?.[1]) {
      const value = normalizeSpace(inline[1].replace(label, '').replace(/^[:：]/, ''));
      if (value && value !== label) return value;
    }

    const idx = lines.findIndex((line) => line === label || line.includes(label));
    if (idx >= 0) {
      const sameLine = normalizeSpace(lines[idx].replace(label, '').replace(/^[:：]/, ''));
      if (sameLine && sameLine.length <= maxLength) return sameLine;

      for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i += 1) {
        const candidate = lines[i];
        if (!candidate) continue;
        if (labels.some((other) => candidate.includes(other))) continue;
        if (candidate.length <= maxLength) return candidate;
      }
    }
  }

  return null;
}

function extractDateFromObject(obj: Record<string, unknown>) {
  const direct = getStringByKey(obj, [
    'posted_at', 'postedAt', 'post_date', 'postDate', 'reg_date', 'regDate', 'registered_at', 'registeredAt',
    'write_date', 'writeDate', 'wdate', 'created_at', 'createdAt', 'insert_dt', 'insertDate', 'start_date', 'startDate',
  ]);
  if (direct) return normalizeDate(direct);

  const raw = objectText(obj);
  const byLabel = pickAfterLabel(raw, ['등록일', '작성일', '게시일'], 80);
  return normalizeDate(byLabel);
}

function extractApartmentFee(text: string) {
  const normalized = normalizeSpace(text);
  const lines = linesOf(normalized);
  const apartmentIndex = lines.findIndex((line) => line.includes('아파트') && line.includes('분양'));

  if (apartmentIndex >= 0) {
    const chunk = lines.slice(apartmentIndex, apartmentIndex + 10).join(' ');
    const fee = chunk.match(/(?:팀|본부|직원|각개|수수료)?\s*[0-9,]{2,}\s*(?:만\s*)?원|[0-9,]{2,}\s*만원|[0-9,]{1,3}\s*%/);
    return fee?.[0] ? normalizeSpace(fee[0]) : normalizeSpace(chunk);
  }

  const fallback = normalized.match(/(?:수수료|팀수수료|본부수수료|페이백)[^\n]{0,80}/);
  return fallback?.[0] ? normalizeSpace(fallback[0]) : null;
}

function extractApartmentFeeFromObject(obj: Record<string, unknown>) {
  const direct = getStringByKey(obj, [
    'apartment_fee', 'apartmentFee', 'apt_fee', 'aptFee', 'payroll_amount', 'payrollAmount', 'payroll_value', 'payrollValue',
    'salary_detail', 'salaryDetail', 'commission', 'commission_text', 'commissionText', 'fee_text', 'feeText',
  ]);
  if (direct) return direct;

  const payrollList = getNestedArray(obj, ['payrolls', 'payroll_list', 'payrollList', 'pays', 'pay_list', 'salary_list', 'list']);
  if (payrollList) {
    for (const item of payrollList) {
      if (!item || typeof item !== 'object') continue;
      const itemObj = item as Record<string, unknown>;
      const upjong = getStringByKey(itemObj, ['upjong_name', 'upjongName', 'name', 'type', 'category']);
      const text = objectText(itemObj);
      if (upjong?.includes('아파트') || text.includes('아파트')) {
        const fee = extractApartmentFee(text);
        if (fee) return fee;
      }
    }
  }

  return extractApartmentFee(objectText(obj));
}

function buildDetailText(obj: Record<string, unknown>) {
  const direct = getStringByKey(obj, [
    'detail_text', 'detailText', 'detail', 'content', 'contents', 'description', 'desc', 'body', 'memo', 'word_from_supporters', 'wordFromSupporters', 'summary',
  ]);

  const lines: string[] = [];
  const title = getStringByKey(obj, ['title', 'subject', 'site_name', 'siteName', 'field_name', 'fieldName']);
  const summary = getStringByKey(obj, ['word_from_supporters', 'wordFromSupporters', 'summary', 'description', 'desc']);
  const recruitPosition = getStringByKey(obj, ['jikjong_name', 'jikjongName', 'job_type_name', 'jobTypeName', 'recruit_position', 'recruitPosition']);
  const payrollType = getStringByKey(obj, ['payroll_type_name', 'payrollTypeName', 'salary_type', 'salaryType', 'pay_type', 'payType']);
  const benefits = getStringByKey(obj, ['services', 'service_names', 'serviceNames', 'benefits', 'support', 'support_text', 'supportText']);
  const company = getStringByKey(obj, ['company_name', 'companyName', 'agency_company', 'agencyCompany', 'company']);

  if (title) lines.push(`현장명: ${title}`);
  if (summary) lines.push(`요약: ${summary}`);
  if (recruitPosition) lines.push(`모집직급: ${recruitPosition}`);
  if (payrollType) lines.push(`급여형태: ${payrollType}`);
  if (benefits) lines.push(`지원조건: ${benefits}`);
  if (company) lines.push(`대행사/업체명: ${company}`);
  if (direct && !lines.includes(direct)) lines.push(`상세정보: ${direct}`);

  return lines.join('\n') || direct || null;
}

function hasContainerArray(obj: Record<string, unknown>) {
  return Object.values(obj).some((value) => Array.isArray(value));
}

function getDirectTitle(obj: Record<string, unknown>) {
  const title = getStringByKey(obj, [
    'title', 'subject', 'site_name', 'siteName', 'field_name', 'fieldName', 'project_name', 'projectName', 'recruit_title', 'recruitTitle',
  ]);
  if (isValidSiteName(title)) return title;
  return null;
}

function looksLikeRecruitObject(obj: Record<string, unknown>) {
  // name/count/result 같은 컨테이너 객체는 후보로 저장하지 않고 내부 배열만 순회합니다.
  if (hasContainerArray(obj)) return false;

  const keys = Object.keys(obj);
  const keySet = new Set(keys.map((key) => key.toLowerCase().replace(/[_\s-]/g, '')));

  if (keySet.has('color') && keySet.has('name') && keys.length <= 3) return false;
  if (keySet.has('count') && (keySet.has('result') || keySet.has('list') || keySet.has('data'))) return false;

  const title = getDirectTitle(obj);
  const id = getId(obj);
  const company = getStringByKey(obj, ['company_name', 'companyName', 'agency_company', 'agencyCompany', 'company']);
  const date = extractDateFromObject(obj);
  const text = objectText(obj);
  const hasRecruitWords = /계약 수수료|아파트|오피스텔|본부|팀장|팀원|경력무관|수수료|분양|일비|숙소비/.test(text);
  const hasNoiseWords = /이용약관|개인정보|공지사항|로그인|회원가입|회사소개/.test(text);

  if (hasNoiseWords && !title) return false;
  if (!title) return false;
  if (!id && !company && !date && !hasRecruitWords) return false;
  return true;
}

function collectObjects(value: unknown, responseUrl: string, out: JsonCandidate[], depth = 0) {
  if (depth > 10 || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, responseUrl, out, depth + 1);
    return;
  }

  if (typeof value !== 'object') return;

  const obj = value as Record<string, unknown>;

  if (looksLikeRecruitObject(obj)) {
    out.push({ value: obj, responseUrl });
    return;
  }

  for (const child of Object.values(obj)) {
    if (child && typeof child === 'object') collectObjects(child, responseUrl, out, depth + 1);
  }
}

async function handleJsonResponse(response: Response, out: JsonCandidate[]) {
  const url = response.url();
  if (!url.includes('bunyangline.com')) return;

  const headers = response.headers();
  const contentType = headers['content-type'] || '';
  const likelyJson = contentType.includes('application/json') || /api|ajax|list|recruit|regional/i.test(url);
  if (!likelyJson) return;

  try {
    const parsed = await response.json();
    const before = out.length;
    collectObjects(parsed, url, out);
    const added = out.length - before;
    if (added > 0) {
      console.log(`JSON 후보 감지: ${added}건 / ${url}`);
      const sample = out[out.length - 1]?.value;
      if (sample) {
        console.log(`JSON 후보 샘플 키: ${Object.keys(sample).slice(0, 40).join(', ')}`);
        const sampleTitle = getDirectTitle(sample);
        const sampleDate = extractDateFromObject(sample);
        const sampleCompany = getStringByKey(sample, ['company_name', 'companyName', 'agency_company', 'agencyCompany', 'company']);
        console.log(`JSON 후보 샘플 값: title=${sampleTitle || '-'} / date=${sampleDate || '-'} / company=${sampleCompany || '-'}`);
      }
    }
  } catch {
    // JSON이 아니거나 본문 재사용 문제면 무시합니다.
  }
}

async function collectNetworkCandidatesForList(page: Page, listUrl: string) {
  const candidates: JsonCandidate[] = [];
  const jobs: Promise<void>[] = [];

  const listener = (response: Response) => {
    jobs.push(handleJsonResponse(response, candidates));
  };

  page.on('response', listener);

  try {
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await sleep(1500);
    await Promise.allSettled(jobs);
  } finally {
    page.off('response', listener);
  }

  return candidates;
}

function getUrlFromObj(obj: Record<string, unknown>, region: Region, responseUrl: string) {
  const raw = getStringByKey(obj, ['url', 'href', 'link', 'source_url', 'sourceUrl', 'view_url', 'viewUrl', 'detail_url', 'detailUrl', 'recruit_url', 'recruitUrl']);
  if (raw) {
    try {
      return new URL(raw, BASE_URL).toString();
    } catch {
      // id 기반 URL로 대체합니다.
    }
  }

  const id = getId(obj);
  if (id) return `${BASE_URL}/recruit/list/${region.id}#idx=${encodeURIComponent(id)}`;

  const title = getDirectTitle(obj) || 'unknown';
  return `${responseUrl}#${encodeURIComponent(title)}`;
}

function rowFromJsonCandidate(candidate: JsonCandidate, region: Region): CrawledRow | null {
  const obj = candidate.value;
  const sourceUrl = getUrlFromObj(obj, region, candidate.responseUrl);

  const siteName = getDirectTitle(obj);
  if (!isValidSiteName(siteName)) return null;

  const siteAddress =
    getStringByKey(obj, ['site_address', 'siteAddress', 'address', 'addr', 'field_address', 'fieldAddress', 'work_address', 'workAddress', 'location_address', 'locationAddress']) ||
    pickAfterLabel(objectText(obj), ['사업지주소', '사업지 주소', '현장주소', '현장 주소', '주소', '근무지 주소'], 220);

  const postedAt = extractDateFromObject(obj);

  const managerName =
    getStringByKey(obj, ['manager_name', 'managerName', 'manager_nm', 'managerNm', 'contact_name', 'contactName', 'person_name', 'personName', 'charge_name', 'chargeName']);

  const directPhone = getStringByKey(obj, ['manager_phone', 'managerPhone', 'manager_tel', 'managerTel', 'contact_phone', 'contactPhone', 'phone', 'mobile', 'tel', 'hp']);
  const managerPhone = normalizePhone(directPhone) || null;

  const agencyCompany =
    getStringByKey(obj, ['agency_company', 'agencyCompany', 'company_name', 'companyName', 'company', 'corp_name', 'corpName', 'office_name', 'officeName']);

  const apartmentFee = extractApartmentFeeFromObject(obj);
  const detailText = buildDetailText(obj);
  const rawText = objectText(obj);

  return {
    source_url: sourceUrl,
    source_post_key: sourceKey(sourceUrl),
    region_id: region.id,
    region_name: region.name,
    site_name: compact(siteName),
    site_address: compact(siteAddress),
    posted_at: postedAt,
    manager_name: compact(managerName),
    manager_phone: compact(managerPhone),
    agency_company: compact(agencyCompany),
    apartment_fee: compact(apartmentFee),
    detail_text: limitText(detailText, MAX_DETAIL_TEXT_LENGTH),
    raw_text: limitText(rawText, MAX_RAW_TEXT_LENGTH),
    crawled_at: new Date().toISOString(),
  };
}

async function parseListFallback(page: Page, listUrl: string, region: Region): Promise<CrawledRow[]> {
  const text = normalizeSpace(await page.locator('body').innerText({ timeout: 15000 }).catch(() => ''));
  if (!text) return [];

  const lines = linesOf(text);
  const productTypes = new Set(['아파트', '오피스텔', '상가', '쇼핑몰', '오피스', '아파트/오피스텔', '오피스텔/상가/쇼핑몰/오피스']);
  const badgeWords = new Set(['신규', 'HOT', '대박', '프리미엄', '전국 Top', '지역 Top', '급구', '대박환영', '슈페리어']);
  const rows: CrawledRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!productTypes.has(line)) continue;

    const title = lines[i + 1] || null;
    if (!isValidSiteName(title)) continue;

    const summary = lines[i + 2] || null;
    const recruitPosition = lines[i + 3] || null;
    const salaryType = lines[i + 4] || null;
    let cursor = i + 5;
    const optionValues: string[] = [];

    while (cursor < Math.min(lines.length, i + 10)) {
      const candidate = lines[cursor];
      if (!candidate) break;
      if (productTypes.has(candidate)) break;
      if (badgeWords.has(candidate)) {
        cursor += 1;
        continue;
      }
      if (/경력무관|개월이상|년이상|일비|숙소비/.test(candidate)) {
        optionValues.push(candidate);
        cursor += 1;
        continue;
      }
      break;
    }

    const company = lines[cursor] && !productTypes.has(lines[cursor]) && !badgeWords.has(lines[cursor])
      ? lines[cursor]
      : null;

    const sourceUrl = `${listUrl}#${encodeURIComponent(title)}`;
    const detail = [
      `현장유형: ${line}`,
      `현장명: ${title}`,
      summary ? `요약: ${summary}` : null,
      recruitPosition ? `모집직급: ${recruitPosition}` : null,
      salaryType ? `급여형태: ${salaryType}` : null,
      optionValues.length ? `지원조건: ${optionValues.join(' / ')}` : null,
      company ? `대행사/업체명: ${company}` : null,
    ].filter(Boolean).join('\n');

    rows.push({
      source_url: sourceUrl,
      source_post_key: sourceKey(sourceUrl),
      region_id: region.id,
      region_name: region.name,
      site_name: compact(title),
      site_address: null,
      posted_at: null,
      manager_name: null,
      manager_phone: null,
      agency_company: compact(company),
      apartment_fee: extractApartmentFee([line, title, summary, recruitPosition, salaryType, ...optionValues].filter(Boolean).join('\n')),
      detail_text: limitText(detail, MAX_DETAIL_TEXT_LENGTH),
      raw_text: limitText(lines.slice(i, cursor + 1).join('\n'), MAX_RAW_TEXT_LENGTH),
      crawled_at: new Date().toISOString(),
    });
  }

  console.log(`[${region.name}] 화면 리스트 보조 파싱 후보: ${rows.length}건`);
  return rows;
}

async function postRowsToCrm(rows: CrawledRow[]) {
  const url = env('CRM_BUNYANGLINE_IMPORT_URL');
  const secret = env('BUNYANGLINE_IMPORT_SECRET');

  if (!url) throw new Error('CRM_BUNYANGLINE_IMPORT_URL 환경변수가 없습니다.');
  if (!secret) throw new Error('BUNYANGLINE_IMPORT_SECRET 환경변수가 없습니다.');

  const body = JSON.stringify({ rows });
  const bodySizeKb = Math.ceil(Buffer.byteLength(body, 'utf8') / 1024);
  console.log(`CRM 저장 배치 전송: ${rows.length}건 / 약 ${bodySizeKb}KB`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body,
  });

  const responseText = await response.text();
  let result: any = null;

  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.ok) {
    throw new Error(`CRM 저장 실패: ${response.status} ${responseText || '응답 본문 없음'}`);
  }

  return result;
}

async function sendToCrm(rows: CrawledRow[]) {
  const results: unknown[] = [];

  for (let startIndex = 0; startIndex < rows.length; startIndex += IMPORT_BATCH_SIZE) {
    const batch = rows.slice(startIndex, startIndex + IMPORT_BATCH_SIZE);
    const batchNo = Math.floor(startIndex / IMPORT_BATCH_SIZE) + 1;
    const totalBatchCount = Math.ceil(rows.length / IMPORT_BATCH_SIZE);
    console.log(`CRM 저장 배치 ${batchNo}/${totalBatchCount} 시작`);
    const result = await postRowsToCrm(batch);
    results.push(result);
    await sleep(700);
  }

  return {
    ok: true,
    batchCount: results.length,
    savedCount: rows.length,
    results,
  };
}

async function main() {
  const regionArg = env('BUNYANGLINE_REGION_IDS', 'all');
  const maxPages = Number(env('BUNYANGLINE_MAX_PAGES', '1'));
  const maxDetailsPerRegion = Number(env('BUNYANGLINE_MAX_DETAILS_PER_REGION', '30'));
  const minPostedAt = normalizeDate(env('BUNYANGLINE_MIN_POSTED_AT', '2026-05-01')) || '2026-05-01';
  const headless = env('HEADLESS', 'true') !== 'false';

  const targetRegions = regionArg === 'all'
    ? REGIONS
    : REGIONS.filter((region) => regionArg.split(',').map((item) => item.trim()).includes(region.id));

  if (targetRegions.length === 0) {
    throw new Error(`수집할 지역이 없습니다. BUNYANGLINE_REGION_IDS=${regionArg}`);
  }

  console.log(`등록일 필터: ${minPostedAt} 이후 공고만 저장합니다.`);
  console.log('수집 방식: 네트워크 JSON 응답 우선 + 화면 리스트 보조 파싱 방식으로 실행합니다.');
  console.log('안전 매핑 모드: 키가 불명확한 값은 임의 매칭하지 않고 빈값으로 저장합니다.');
  console.log(`CRM 저장 배치 크기: ${IMPORT_BATCH_SIZE}건`);
  console.log(`상세정보 최대 길이: ${MAX_DETAIL_TEXT_LENGTH}자 / raw_text 최대 길이: ${MAX_RAW_TEXT_LENGTH}자`);

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 CRM Bunyangline Data Collector',
  });

  const allRows: CrawledRow[] = [];
  const seen = new Set<string>();

  try {
    for (const region of targetRegions) {
      const regionRows: CrawledRow[] = [];

      for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
        const listUrl = `${BASE_URL}/recruit/regional/${region.id}/?keyword=&page=${pageNo}`;
        console.log(`[${region.name}] 리스트 접근: ${listUrl}`);

        const candidates = await collectNetworkCandidatesForList(page, listUrl);
        console.log(`[${region.name}] 네트워크 JSON 후보: ${candidates.length}건`);

        const jsonRows = candidates
          .map((candidate) => rowFromJsonCandidate(candidate, region))
          .filter((row): row is CrawledRow => Boolean(row));
        regionRows.push(...jsonRows);

        if (jsonRows.length === 0) {
          const fallbackRows = await parseListFallback(page, listUrl, region);
          regionRows.push(...fallbackRows);
        }
      }

      const deduped = regionRows.filter((row) => {
        if (!row.site_name || !isValidSiteName(row.site_name)) return false;
        const dedupeKey = row.source_url || `${row.region_id}:${row.site_name}:${row.posted_at || ''}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });

      const filtered = deduped
        .filter((row) => {
          const ok = isDateOnOrAfter(row.posted_at, minPostedAt);
          if (!ok) {
            console.log(`등록일 필터 제외: ${region.name} / ${row.site_name || '-'} / 등록일 ${row.posted_at || '없음'}`);
          }
          return ok;
        })
        .slice(0, maxDetailsPerRegion);

      console.log(`[${region.name}] 최종 저장 대상: ${filtered.length}건`);
      allRows.push(...filtered);
    }

    if (allRows.length === 0) {
      throw new Error(`${minPostedAt} 이후 저장 대상이 0건입니다. JSON 후보 샘플 키/값 로그를 확인해야 합니다.`);
    }

    console.log(`CRM 저장 요청: ${allRows.length}건`);
    const result = await sendToCrm(allRows);
    console.log('CRM 저장 완료:', JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
