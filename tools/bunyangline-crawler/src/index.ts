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

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function normalizeSpace(value: unknown) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compact(value: unknown) {
  const text = normalizeSpace(value);
  return text || null;
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
  if (digits.length < 9 || digits.length > 11) return digits;
  return digits;
}

function extractPhone(text: string) {
  const match = text.match(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  return normalizePhone(match?.[0] ?? null);
}

function normalizeDate(value: unknown) {
  const text = normalizeSpace(value);
  if (!text) return null;

  const iso = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const kr = text.match(/(20\d{2})[.\/년\s-]+(\d{1,2})[.\/월\s-]+(\d{1,2})/);
  if (kr) return `${kr[1]}-${kr[2].padStart(2, '0')}-${kr[3].padStart(2, '0')}`;

  const yy = text.match(/(^|\D)(\d{2})[.\/년\s-]+(\d{1,2})[.\/월\s-]+(\d{1,2})(\D|$)/);
  if (yy) {
    const year = Number(yy[2]) >= 70 ? `19${yy[2]}` : `20${yy[2]}`;
    return `${year}-${yy[3].padStart(2, '0')}-${yy[4].padStart(2, '0')}`;
  }

  return null;
}

function isDateOnOrAfter(value: string | null, minDate: string) {
  if (!value) return false;
  return value >= minDate;
}

function linesOf(text: string) {
  return text
    .split('\n')
    .map((line) => normalizeSpace(line))
    .filter(Boolean);
}

function pickAfterLabel(text: string, labels: string[], maxLength = 160) {
  const lines = linesOf(text);

  for (const label of labels) {
    const inline = text.match(new RegExp(`${escapeRegExp(label)}\\s*[:：]?\\s*([^\\n]{1,${maxLength}})`, 'i'));
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(text: string, labels: string[], maxLines = 120) {
  const lines = linesOf(text);

  for (const label of labels) {
    const idx = lines.findIndex((line) => line.includes(label));
    if (idx >= 0) {
      return lines.slice(idx, idx + maxLines).join('\n');
    }
  }

  return lines.slice(0, maxLines).join('\n');
}

function extractApartmentFee(text: string) {
  const lines = linesOf(text);
  const apartmentIndex = lines.findIndex((line) => line.includes('아파트') && line.includes('분양'));

  if (apartmentIndex >= 0) {
    const chunk = lines.slice(apartmentIndex, apartmentIndex + 12).join(' ');
    const fee = chunk.match(/(?:팀|본부|직원|수수료)?\s*[0-9,]{2,}\s*(?:만\s*)?원|[0-9,]{2,}\s*만원|[0-9,]{2,}\s*%/);
    return fee?.[0] ? normalizeSpace(fee[0]) : normalizeSpace(chunk);
  }

  const fallback = text.match(/(?:수수료|팀수수료|본부수수료)[^\n]{0,50}/);
  return fallback?.[0] ? normalizeSpace(fallback[0]) : null;
}

function extractProjectName(text: string, pageTitle: string | null) {
  const byLabel = pickAfterLabel(text, ['현장명', '사업지명', '사업지 정보', '사업지정보', '프로젝트명'], 180);
  if (byLabel) return byLabel;

  if (pageTitle) {
    return pageTitle
      .replace(/분양라인/g, '')
      .replace(/지역현장/g, '')
      .replace(/구인\/구직/g, '')
      .replace(/[|｜]/g, '')
      .trim();
  }

  const lines = linesOf(text);
  return lines.find((line) => line.length >= 4 && line.length <= 80) ?? null;
}

function extractPageTitle(text: string) {
  const lines = linesOf(text);
  const skip = new Set(['HOME', '지역현장', '맞춤현장', '지도현장', '관심현장', '서포터즈', '로그인', '회원가입']);
  return lines.find((line) => !skip.has(line) && line.length >= 5 && line.length <= 100) ?? null;
}

function getByKey(obj: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(obj);
  const normalized = keys.map((key) => key.toLowerCase());

  for (const [key, value] of entries) {
    const lower = key.toLowerCase();
    if (normalized.includes(lower)) return value;
  }

  for (const [key, value] of entries) {
    const lower = key.toLowerCase();
    if (normalized.some((item) => lower.includes(item))) return value;
  }

  return null;
}

function getStringByKey(obj: Record<string, unknown>, keys: string[]) {
  const value = getByKey(obj, keys);
  if (value == null) return null;
  if (Array.isArray(value) || typeof value === 'object') return null;
  return compact(value);
}

function getId(obj: Record<string, unknown>) {
  const value = getByKey(obj, ['id', 'idx', 'seq', 'no', 'uid', 'wr_id', 'recruit_id', 'post_id', 'site_idx', 'recruitIdx']);
  const text = normalizeSpace(value);
  return text || null;
}

function getUrlFromObj(obj: Record<string, unknown>, region: Region) {
  const raw = getStringByKey(obj, ['url', 'href', 'link', 'source_url', 'view_url', 'detail_url', 'recruit_url']);
  if (raw) {
    try {
      return new URL(raw, BASE_URL).toString();
    } catch {
      // 아래 id 기반 URL로 대체합니다.
    }
  }

  const id = getId(obj);
  if (id) return `${BASE_URL}/recruit/regional/${region.id}?idx=${encodeURIComponent(id)}`;

  const title = getStringByKey(obj, ['title', 'subject', 'site_name', 'siteName', 'field_name', 'name']) || 'unknown';
  return `${BASE_URL}/recruit/regional/${region.id}?virtual=${encodeURIComponent(title)}`;
}

function objectText(obj: Record<string, unknown>) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function extractDateFromObject(obj: Record<string, unknown>) {
  const raw = getStringByKey(obj, [
    'posted_at',
    'post_date',
    'created_at',
    'createdAt',
    'reg_date',
    'regDate',
    'registered_at',
    'registeredAt',
    'write_date',
    'writeDate',
    'wdate',
    'date',
    'insert_dt',
    'insertDate',
    'updated_at',
  ]);

  return normalizeDate(raw || objectText(obj));
}

function extractApartmentFeeFromObject(obj: Record<string, unknown>) {
  const direct = getStringByKey(obj, [
    'apartment_fee',
    'apartmentFee',
    'apt_fee',
    'fee',
    'pay',
    'payroll',
    'payroll_text',
    'salary',
    'salary_detail',
    'commission',
    '수수료',
  ]);

  if (direct) return direct;
  return extractApartmentFee(objectText(obj));
}

function looksLikeRecruitObject(obj: Record<string, unknown>) {
  const text = objectText(obj);
  const title = getStringByKey(obj, ['title', 'subject', 'site_name', 'siteName', 'field_name', 'fieldName', 'name']);
  const company = getStringByKey(obj, ['company_name', 'companyName', 'agency_company', 'agencyCompany', 'company', '대행사']);
  const id = getId(obj);
  const hasRecruitWords = /계약 수수료|아파트|오피스텔|본부|팀장|팀원|경력무관|수수료|분양/.test(text);
  const hasNoiseWords = /이용약관|개인정보|공지사항|로그인|회원가입/.test(text);

  if (hasNoiseWords && !title) return false;
  if (title && title.length >= 4 && hasRecruitWords) return true;
  if (id && company && hasRecruitWords) return true;
  return false;
}

function collectObjects(value: unknown, responseUrl: string, out: JsonCandidate[], depth = 0) {
  if (depth > 8 || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, responseUrl, out, depth + 1);
    return;
  }

  if (typeof value !== 'object') return;

  const obj = value as Record<string, unknown>;
  if (looksLikeRecruitObject(obj)) out.push({ value: obj, responseUrl });

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
      if (sample) console.log(`JSON 후보 샘플 키: ${Object.keys(sample).slice(0, 30).join(', ')}`);
    }
  } catch {
    // JSON이 아니거나 CORS/본문 재사용 문제면 무시합니다.
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

function rowFromJsonCandidate(candidate: JsonCandidate, region: Region): CrawledRow {
  const obj = candidate.value;
  const rawText = objectText(obj);
  const sourceUrl = getUrlFromObj(obj, region);

  const siteName =
    getStringByKey(obj, ['site_name', 'siteName', 'field_name', 'fieldName', 'project_name', 'projectName', 'title', 'subject', 'name']) ||
    extractProjectName(rawText, null);

  const siteAddress =
    getStringByKey(obj, ['site_address', 'siteAddress', 'address', 'addr', 'field_address', 'work_address', 'location_address']) ||
    pickAfterLabel(rawText, ['사업지주소', '사업지 주소', '현장주소', '현장 주소', '주소', '근무지 주소'], 220);

  const postedAt = extractDateFromObject(obj);

  const managerName =
    getStringByKey(obj, ['manager_name', 'managerName', 'manager', 'contact_name', 'contactName', 'person_name', 'personName', '담당자']) ||
    pickAfterLabel(rawText, ['담당자 이름', '담당자이름', '담당자명', '담당자'], 80);

  const managerPhone =
    normalizePhone(getStringByKey(obj, ['manager_phone', 'managerPhone', 'phone', 'tel', 'mobile', 'contact_phone', 'contactPhone', '담당자연락처'])) ||
    extractPhone(rawText);

  const agencyCompany =
    getStringByKey(obj, ['agency_company', 'agencyCompany', 'company_name', 'companyName', 'company', '대행사', 'corp_name']) ||
    pickAfterLabel(rawText, ['대행사', '분양대행사', '분양 대행사', '업체명', '회사명'], 120);

  const apartmentFee = extractApartmentFeeFromObject(obj);

  const detailText =
    getStringByKey(obj, ['detail_text', 'detailText', 'content', 'contents', 'description', 'desc', 'memo', 'body']) ||
    extractSection(rawText, ['상세정보', '상세 정보', '상세요강', '모집내용', '급여정보'], 180);

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
    detail_text: compact(detailText),
    raw_text: compact(rawText),
    crawled_at: new Date().toISOString(),
  };
}

async function parseListFallback(page: Page, listUrl: string, region: Region): Promise<CrawledRow[]> {
  const text = normalizeSpace(await page.locator('body').innerText({ timeout: 15000 }).catch(() => ''));
  if (!text) return [];

  // 상세 URL/JSON 후보가 없는 경우, 화면에 보이는 리스트값이라도 임시 저장할 수 있도록 하는 보조 파서입니다.
  // 등록일이 없는 행은 날짜 필터 때문에 최종 저장에서 제외됩니다.
  const lines = linesOf(text);
  const productTypes = new Set(['아파트', '오피스텔', '상가', '쇼핑몰', '오피스', '아파트/오피스텔', '오피스텔/상가/쇼핑몰/오피스']);
  const rows: CrawledRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!productTypes.has(line)) continue;

    const title = lines[i + 1] || null;
    const summary = lines[i + 2] || null;
    const company = lines.slice(i + 3, i + 10).find((item) => {
      if (/팀장|팀원|본부|계약 수수료|기본급|일비|숙소비|경력/.test(item)) return false;
      if (productTypes.has(item)) return false;
      return item.length >= 2 && item.length <= 40;
    }) || null;

    if (!title || title.length < 4) continue;

    const sourceUrl = `${listUrl}#${encodeURIComponent(title)}`;
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
      apartment_fee: extractApartmentFee([line, title, summary, ...lines.slice(i + 3, i + 10)].filter(Boolean).join('\n')),
      detail_text: compact(summary),
      raw_text: compact(lines.slice(i, i + 10).join('\n')),
      crawled_at: new Date().toISOString(),
    });
  }

  console.log(`[${region.name}] 화면 리스트 보조 파싱 후보: ${rows.length}건`);
  return rows;
}

async function sendToCrm(rows: CrawledRow[]) {
  const url = env('CRM_BUNYANGLINE_IMPORT_URL');
  const secret = env('BUNYANGLINE_IMPORT_SECRET');

  if (!url) throw new Error('CRM_BUNYANGLINE_IMPORT_URL 환경변수가 없습니다.');
  if (!secret) throw new Error('BUNYANGLINE_IMPORT_SECRET 환경변수가 없습니다.');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ rows }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(`CRM 저장 실패: ${response.status} ${JSON.stringify(result)}`);
  }

  return result;
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
  console.log('수집 방식: 상세 URL 추출이 아니라 네트워크 JSON 응답 우선 수집 방식으로 실행합니다.');

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

        const jsonRows = candidates.map((candidate) => rowFromJsonCandidate(candidate, region));
        regionRows.push(...jsonRows);

        if (jsonRows.length === 0) {
          const fallbackRows = await parseListFallback(page, listUrl, region);
          regionRows.push(...fallbackRows);
        }
      }

      const deduped = regionRows.filter((row) => {
        if (seen.has(row.source_url)) return false;
        seen.add(row.source_url);
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
      throw new Error(
        `${minPostedAt} 이후 저장 대상이 0건입니다. 네트워크 JSON 후보가 없거나 등록일 필드명이 다를 수 있습니다. 로그의 'JSON 후보 샘플 키'를 확인해야 합니다.`,
      );
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
