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
] as const;

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

type RecruitIdCandidate = {
  id: string;
  source: string;
  title?: string | null;
};

const DEFAULT_IMPORT_BATCH_SIZE = Number(process.env.BUNYANGLINE_IMPORT_BATCH_SIZE || '2');
const IMPORT_BATCH_SIZE = Number.isFinite(DEFAULT_IMPORT_BATCH_SIZE) && DEFAULT_IMPORT_BATCH_SIZE > 0
  ? Math.min(DEFAULT_IMPORT_BATCH_SIZE, 5)
  : 2;
const MAX_DETAIL_TEXT_LENGTH = Number(process.env.BUNYANGLINE_MAX_DETAIL_TEXT_LENGTH || '7000');
const MAX_RAW_TEXT_LENGTH = Number(process.env.BUNYANGLINE_MAX_RAW_TEXT_LENGTH || '0');

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSpace(value: unknown) {
  return String(value ?? '')
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
}

function compact(value: unknown) {
  const text = normalizeSpace(value);
  return text || null;
}

function limitText(value: unknown, maxLength: number) {
  const text = compact(value);
  if (!text) return null;
  if (!maxLength || maxLength <= 0) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...(상세정보 길이 제한으로 일부 생략)` : text;
}

function sourceKey(url: string) {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return `bunyangline_${Math.abs(hash)}`;
}

function linesOf(text: string) {
  return normalizeSpace(text)
    .split('\n')
    .map((line) => normalizeSpace(line))
    .filter(Boolean);
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

function normalizePhone(value: unknown) {
  const text = normalizeSpace(value);
  if (!text) return null;

  const raw = text.match(/0\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{4}/)?.[0] || text;
  const digits = raw.replace(/\D/g, '');

  if (!digits) return null;
  if (digits.length < 8 || digits.length > 11) return null;
  return digits;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickAfterLabel(text: string, labels: string[], options?: { maxLength?: number; stopLabels?: string[] }) {
  const maxLength = options?.maxLength ?? 180;
  const stopLabels = options?.stopLabels ?? [];
  const normalizedText = normalizeSpace(text);
  const lines = linesOf(normalizedText);

  for (const label of labels) {
    const stopPattern = stopLabels.length > 0 ? `(?=\\s+(?:${stopLabels.map(escapeRegExp).join('|')})|$)` : '$';
    const inline = normalizedText.match(new RegExp(`${escapeRegExp(label)}\\s*[:：]?\\s*([^\\n]{1,${maxLength}}?)${stopPattern}`, 'i'));
    if (inline?.[1]) {
      const value = normalizeSpace(inline[1]);
      if (value && value !== label) return value;
    }

    const idx = lines.findIndex((line) => line === label || line.startsWith(label) || line.includes(label));
    if (idx >= 0) {
      const sameLine = normalizeSpace(lines[idx].replace(label, '').replace(/^[:：]/, ''));
      if (sameLine && sameLine.length <= maxLength) return sameLine;

      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i += 1) {
        const candidate = lines[i];
        if (!candidate) continue;
        if (stopLabels.some((stop) => candidate.includes(stop))) break;
        if (labels.some((other) => candidate.includes(other))) continue;
        if (candidate.length <= maxLength) return candidate;
      }
    }
  }

  return null;
}

function sectionBetween(text: string, startLabels: string[], endLabels: string[]) {
  const lines = linesOf(text);
  const startIndex = lines.findIndex((line) => startLabels.some((label) => line.includes(label)));
  if (startIndex < 0) return null;

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (endLabels.some((label) => lines[i].includes(label))) {
      endIndex = i;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex).join('\n');
}

function extractPostedAtFromDetail(text: string) {
  const afterDetailTitle = sectionBetween(text, ['구인글 상세보기'], ['근무지 정보', '사업자 정보', '사업지 정보']) || text;
  return normalizeDate(afterDetailTitle);
}

function extractSiteName(text: string) {
  const businessSection = sectionBetween(text, ['사업지 정보'], ['기본요강', '급여정보', '근무후생', '상세정보']) || text;

  const byLabel = pickAfterLabel(businessSection, ['현장명', '사업지명'], {
    maxLength: 160,
    stopLabels: ['사업지 주소', '사업지주소', '기본요강', '급여정보'],
  });

  if (byLabel) {
    return byLabel
      .replace(/\s*사업지\s*주소.*$/g, '')
      .trim();
  }

  return null;
}

function extractSiteAddress(text: string) {
  const businessSection = sectionBetween(text, ['사업지 정보'], ['기본요강', '급여정보', '근무후생', '상세정보']) || text;
  const address = pickAfterLabel(businessSection, ['사업지 주소', '사업지주소', '현장주소', '현장 주소', '근무지역 주소'], {
    maxLength: 260,
    stopLabels: ['기본요강', '급여정보', '근무후생', '상세정보'],
  });

  return address ? address.replace(/※.*$/g, '').trim() : null;
}

function extractManagerInfo(text: string) {
  const businessInfo = sectionBetween(text, ['사업자 정보'], ['사업지 정보', '기본요강', '급여정보', '상세정보']) || text;
  const inline = businessInfo.match(/담당자\s*이름\s*([^\n]+?)\s*담당자\s*연락처\s*([0-9\-\.\s]{8,20})/);

  if (inline) {
    return {
      managerName: compact(inline[1]),
      managerPhone: normalizePhone(inline[2]),
    };
  }

  const managerName = pickAfterLabel(businessInfo, ['담당자 이름', '담당자이름', '담당자명'], {
    maxLength: 80,
    stopLabels: ['담당자 연락처', '담당자연락처', '사업지 정보'],
  });
  const managerPhone = normalizePhone(
    pickAfterLabel(businessInfo, ['담당자 연락처', '담당자연락처', '연락처'], {
      maxLength: 80,
      stopLabels: ['사업지 정보', '사업지정보'],
    }),
  );

  return { managerName: compact(managerName), managerPhone };
}

function extractAgencyCompany(text: string) {
  const businessInfo = sectionBetween(text, ['사업자 정보'], ['사업지 정보', '기본요강', '급여정보', '상세정보']) || text;

  const inline = businessInfo.match(/대행사\s*([^\n]+?)(?=\s*담당자\s*이름|\s*담당자\s*연락처|\n|$)/);
  if (inline?.[1]) return compact(inline[1]);

  return compact(
    pickAfterLabel(businessInfo, ['대행사', '분양대행사', '분양 대행사'], {
      maxLength: 120,
      stopLabels: ['담당자 이름', '담당자 연락처', '사업지 정보'],
    }),
  );
}

function extractApartmentFee(text: string) {
  const payrollSection = sectionBetween(text, ['급여정보'], ['근무후생', '상세정보', '사이트 주소', '관심 현장']) || text;
  const lines = linesOf(payrollSection);
  const line = lines.find((item) => /아파트\s*분양/.test(item));

  if (line) {
    const value = line.replace(/.*?아파트\s*분양\s*/g, '').trim();
    return compact(value || line);
  }

  const match = payrollSection.match(/아파트\s*분양\s*([0-9,]+\s*원|[0-9,]+\s*만원|[0-9.]+\s*%)/);
  if (match?.[1]) return compact(match[1]);

  return null;
}

function extractDetailText(text: string) {
  const detail = sectionBetween(text, ['상세정보'], ['사이트 주소', '관심 현장', '현장 공유하기', '목록', '회사소개']);
  return compact(detail || '');
}

function cleanDetailPageText(text: string) {
  const normalized = normalizeSpace(text);
  const start = normalized.indexOf('구인글 상세보기');
  if (start >= 0) return normalized.slice(start);
  return normalized;
}

function parseDetailPageText(text: string, sourceUrl: string, region: Region): CrawledRow | null {
  const detailText = cleanDetailPageText(text);

  if (!detailText.includes('구인글 상세보기') && !detailText.includes('사업자 정보') && !detailText.includes('사업지 정보')) {
    return null;
  }

  const postedAt = extractPostedAtFromDetail(detailText);
  const siteName = extractSiteName(detailText);
  const siteAddress = extractSiteAddress(detailText);
  const { managerName, managerPhone } = extractManagerInfo(detailText);
  const agencyCompany = extractAgencyCompany(detailText);
  const apartmentFee = extractApartmentFee(detailText);
  const onlyDetail = extractDetailText(detailText);

  if (!siteName && !siteAddress) {
    return null;
  }

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
    detail_text: limitText(onlyDetail, MAX_DETAIL_TEXT_LENGTH),
    raw_text: limitText(detailText, MAX_RAW_TEXT_LENGTH),
    crawled_at: new Date().toISOString(),
  };
}

function getStringByKey(obj: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (!normalizedKeys.includes(lower) && !normalizedKeys.some((item) => lower.includes(item))) continue;
    if (value == null || typeof value === 'object') continue;
    const text = normalizeSpace(value);
    if (text) return text;
  }
  return null;
}

function objectText(obj: unknown) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj ?? '');
  }
}

function looksLikeRecruitListObject(obj: Record<string, unknown>) {
  const text = objectText(obj);
  const id = getStringByKey(obj, ['idx', 'id', 'recruit_id', 'post_id', 'seq']);
  const title = getStringByKey(obj, ['title', 'subject', 'name', 'site_name', 'field_name']);

  if (!id || !/^\d{3,}$/.test(id)) return false;
  if (title && /로그인|회원가입|공지사항|개인정보|이용약관/.test(title)) return false;

  return /분양|수수료|아파트|오피스텔|본부|팀장|팀원|현장|company_name|word_from_supporters|payroll/i.test(text);
}

function collectIdsFromJson(value: unknown, responseUrl: string, out: RecruitIdCandidate[], depth = 0) {
  if (depth > 10 || value == null) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectIdsFromJson(item, responseUrl, out, depth + 1));
    return;
  }

  if (typeof value !== 'object') return;

  const obj = value as Record<string, unknown>;
  if (looksLikeRecruitListObject(obj)) {
    const id = getStringByKey(obj, ['idx', 'id', 'recruit_id', 'post_id', 'seq']);
    const title = getStringByKey(obj, ['title', 'subject', 'name', 'site_name', 'field_name']);
    if (id) out.push({ id, source: responseUrl, title });
  }

  Object.values(obj).forEach((child) => collectIdsFromJson(child, responseUrl, out, depth + 1));
}

async function handleJsonResponse(response: Response, out: RecruitIdCandidate[]) {
  const url = response.url();
  if (!url.includes('bunyangline.com')) return;

  const contentType = response.headers()['content-type'] || '';
  const likelyJson = contentType.includes('application/json') || /api|ajax|list|recruit|regional/i.test(url);
  if (!likelyJson) return;

  try {
    const parsed = await response.json();
    const before = out.length;
    collectIdsFromJson(parsed, url, out);
    const added = out.length - before;
    if (added > 0) {
      const sample = out[out.length - 1];
      console.log(`상세 ID 후보 감지: ${added}건 / ${url} / 샘플 ${sample.id} ${sample.title || ''}`);
    }
  } catch {
    // JSON이 아니면 무시합니다.
  }
}

async function collectViewIdsFromList(page: Page, listUrl: string, region: Region) {
  const ids: RecruitIdCandidate[] = [];
  const jobs: Promise<void>[] = [];

  const listener = (response: Response) => {
    jobs.push(handleJsonResponse(response, ids));
  };

  page.on('response', listener);

  try {
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await sleep(1500);
    await Promise.allSettled(jobs);

    const hrefs = await page.locator('a').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href).filter(Boolean));
    for (const href of hrefs) {
      const match = href.match(/\/recruit\/view\/(\d+)/);
      if (match?.[1]) ids.push({ id: match[1], source: href });
    }

    const html = await page.content().catch(() => '');
    const regexes = [
      /\/recruit\/view\/(\d+)/g,
      /["']idx["']\s*:\s*["']?(\d{3,})["']?/g,
      /["']recruit_id["']\s*:\s*["']?(\d{3,})["']?/g,
    ];

    for (const regex of regexes) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html))) {
        ids.push({ id: match[1], source: 'html' });
      }
    }
  } finally {
    page.off('response', listener);
  }

  const deduped = Array.from(new Map(ids.map((item) => [item.id, item])).values());
  console.log(`[${region.name}] 상세 ID 후보: ${deduped.length}건`);
  return deduped;
}

async function crawlDetailPage(page: Page, id: string, region: Region) {
  const sourceUrl = `${BASE_URL}/recruit/view/${id}/?previousActiveNaviId=regional`;

  try {
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await sleep(800);

    const bodyText = await page.locator('body').innerText({ timeout: 15000 });
    const row = parseDetailPageText(bodyText, sourceUrl, region);

    if (!row) {
      console.log(`[${region.name}] 상세 파싱 제외: ${id} / 상세 구조 확인 실패`);
      return null;
    }

    console.log(`[${region.name}] 상세 파싱 완료: ${id} / ${row.site_name || '-'} / ${row.posted_at || '등록일 없음'}`);
    return row;
  } catch (error) {
    console.log(`[${region.name}] 상세 접속 실패: ${id} / ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
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
  console.log('수집 방식: 지역 리스트에서 공고 ID 추출 → /recruit/view/{id}/ 상세페이지 접속 → 상세페이지 기준 파싱');
  console.log(`CRM 저장 배치 크기: ${IMPORT_BATCH_SIZE}건`);
  console.log(`상세정보 최대 길이: ${MAX_DETAIL_TEXT_LENGTH}자 / raw_text 최대 길이: ${MAX_RAW_TEXT_LENGTH}자`);

  const browser = await chromium.launch({ headless });
  const listPage = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 CRM Bunyangline Detail Collector',
  });
  const detailPage = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 CRM Bunyangline Detail Collector',
  });

  const allRows: CrawledRow[] = [];
  const seenDetailIds = new Set<string>();
  const seenSourceUrls = new Set<string>();

  try {
    for (const region of targetRegions) {
      const regionIds: RecruitIdCandidate[] = [];

      for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
        const listUrl = `${BASE_URL}/recruit/regional/${region.id}/?keyword=&page=${pageNo}`;
        console.log(`[${region.name}] 리스트 접근: ${listUrl}`);
        const ids = await collectViewIdsFromList(listPage, listUrl, region);
        regionIds.push(...ids);
      }

      const uniqueIds = Array.from(new Map(regionIds.map((item) => [item.id, item])).values())
        .filter((item) => !seenDetailIds.has(item.id))
        .slice(0, maxDetailsPerRegion);

      console.log(`[${region.name}] 상세 수집 대상 ID: ${uniqueIds.length}건`);

      const regionRows: CrawledRow[] = [];
      for (const candidate of uniqueIds) {
        seenDetailIds.add(candidate.id);
        const row = await crawlDetailPage(detailPage, candidate.id, region);
        if (!row) continue;

        const dateOk = isDateOnOrAfter(row.posted_at, minPostedAt);
        if (!dateOk) {
          console.log(`등록일 필터 제외: ${region.name} / ${row.site_name || '-'} / 등록일 ${row.posted_at || '없음'}`);
          continue;
        }

        if (seenSourceUrls.has(row.source_url)) continue;
        seenSourceUrls.add(row.source_url);
        regionRows.push(row);
        await sleep(500);
      }

      console.log(`[${region.name}] 최종 저장 대상: ${regionRows.length}건`);
      allRows.push(...regionRows);
    }

    if (allRows.length === 0) {
      throw new Error(`${minPostedAt} 이후 저장 대상이 0건입니다. 상세 ID 추출 또는 상세페이지 파싱 로그를 확인해야 합니다.`);
    }

    console.log(`CRM 저장 요청: ${allRows.length}건`);
    const result = await sendToCrm(allRows);
    console.log('CRM 저장 완료:', JSON.stringify(result, null, 2));
  } finally {
    await detailPage.close().catch(() => undefined);
    await listPage.close().catch(() => undefined);
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
