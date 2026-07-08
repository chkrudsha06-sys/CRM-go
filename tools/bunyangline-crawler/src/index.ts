import { APIRequestContext, request } from '@playwright/test';
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.bunyangline.com';
const IMPORT_URL = process.env.CRM_BUNYANGLINE_IMPORT_URL || '';
const IMPORT_SECRET = process.env.BUNYANGLINE_IMPORT_SECRET || '';
const REGION_ARG = process.env.BUNYANGLINE_REGION_IDS || '0';
const DATA_START_DATE = parseDateOnly(process.env.BUNYANGLINE_START_DATE || '2026-07-01') || '2026-07-01';
const CRAWL_MODE = process.env.BUNYANGLINE_CRAWL_MODE === 'incremental' ? 'incremental' : 'backfill';
const LOOKBACK_DAYS = Math.max(1, Number(process.env.BUNYANGLINE_LOOKBACK_DAYS || '3') || 3);
const START_DATE = CRAWL_MODE === 'incremental'
  ? [DATA_START_DATE, kstDateDaysAgo(LOOKBACK_DAYS)].sort().at(-1) || DATA_START_DATE
  : DATA_START_DATE;
const MAX_PAGES = Math.max(1, Number(process.env.BUNYANGLINE_MAX_PAGES || '500') || 500);
const MAX_DETAILS = Math.max(0, Number(process.env.BUNYANGLINE_MAX_DETAILS || '0') || 0);
const DETAIL_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.BUNYANGLINE_DETAIL_CONCURRENCY || '4') || 4));
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.BUNYANGLINE_REQUEST_DELAY_MS || '150') || 150);
const SEND_TO_CRM = process.env.SEND_TO_CRM !== 'false';

const REGIONS = [
  { id: '0', name: '모든지역' },
  { id: '1', name: '서울' },
  { id: '2', name: '경기남부' },
  { id: '16', name: '경기북부' },
  { id: '3', name: '인천' },
  { id: '10', name: '부산' },
  { id: '14', name: '울산' },
  { id: '11', name: '대구' },
  { id: '6', name: '경상도' },
  { id: '13', name: '대전' },
  { id: '15', name: '세종' },
  { id: '4', name: '충청도' },
  { id: '12', name: '광주' },
  { id: '5', name: '전라도' },
  { id: '7', name: '강원도' },
  { id: '8', name: '제주도' },
] as const;

const REGION_NAME_BY_ID = new Map<string, string>(REGIONS.map((region) => [region.id, region.name]));

const FEATURED_SECTIONS = [
  { key: 'uniques', name: '유니크' },
  { key: 'superiors', name: '슈페리어' },
  { key: 'allTopsPremium', name: '프리미엄' },
  { key: 'allTopsBasic', name: '전국TOP' },
] as const;

const SECTION_RANK: Record<string, number> = {
  유니크: 5,
  슈페리어: 4,
  프리미엄: 3,
  전국TOP: 2,
  일반구인글: 1,
};

type Region = (typeof REGIONS)[number];
type Listing = Record<string, unknown>;

type Candidate = {
  source_id: string;
  source_url: string;
  title: string;
  summary: string | null;
  list_region_name: string;
  region_name_hint: string | null;
  ad_section: string;
  list_date_group: string | null;
  registered_datetime_hint: string | null;
  listing: Listing;
};

type BunyanglineItem = {
  region_name: string;
  list_region_name: string;
  ad_section: string;
  site_name: string;
  posted_at: string;
  posted_datetime: string;
  manager_name: string;
  manager_phone: string;
  agency_company: string;
  apartment_fee: string;
  move_in_date: string;
  source_url: string;
  source_id: string;
  title: string;
  summary: string | null;
  site_address: string | null;
  work_address: string | null;
  category: string | null;
  list_date_group: string | null;
  detail_text: string;
  raw_text: string;
  crawled_at: string;
};

type PageSummary = {
  region: string;
  page: number;
  itemCount: number;
  detailCandidateCount: number;
  lastDateTitle: string | null;
  totalPage: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function kstDateDaysAgo(days: number) {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeMultiline(value: unknown) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseDateOnly(value: unknown) {
  const match = normalizeText(value).match(/(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function parseDateTime(value: unknown) {
  const text = normalizeText(value);
  const match = text.match(/(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})(?:[일\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return { date: null, dateTime: null };

  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const hh = (match[4] || '00').padStart(2, '0');
  const mm = (match[5] || '00').padStart(2, '0');
  const ss = (match[6] || '00').padStart(2, '0');
  return { date, dateTime: `${date} ${hh}:${mm}:${ss}` };
}

function firstText(row: Listing, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && normalizeText(value)) return normalizeText(value);
  }
  return null;
}

function normalizePhone(value: unknown) {
  const text = normalizeText(value);
  if (!text) return '';
  const match =
    text.match(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] ||
    text.match(/(?:02|0[3-6]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] ||
    text.match(/\b\d{4}[-\s.]?\d{4}\b/)?.[0];
  return (match || text).replace(/\D/g, '') || text;
}

function sourceUrlFromId(id: string) {
  return `${BASE_URL}/recruit/view/${id}/?previousActiveNaviId=regional`;
}

function registrationValue(row: Listing) {
  return firstText(row, ['registed_at', 'registered_at', 'registeredAt', 'created_at', 'createdAt']);
}

function listOrderDate(row: Listing) {
  return parseDateOnly(firstText(row, ['seq_datetime', 'jumped_at', 'date', 'updated_at', 'registed_at']));
}

function regionHintFromListing(row: Listing, fallback: string) {
  const ids = Array.isArray(row.work_address_master_ids)
    ? row.work_address_master_ids.map((value) => String(value))
    : [];
  const names = ids.map((id) => REGION_NAME_BY_ID.get(id)).filter((name): name is string => Boolean(name && name !== '모든지역'));
  return names.length === 1 ? names[0] || null : fallback === '모든지역' ? null : fallback;
}

function candidateFromListing(row: Listing, adSection: string, region: Region): Candidate | null {
  const sourceId = normalizeText(row.id).replace(/\D/g, '');
  if (!sourceId) return null;

  // 목록 API의 registed_at은 최초 작성일이고, 상세 오른쪽 상단 날짜는
  // seq_datetime(재노출 시각)과 일치하는 경우가 있습니다. 최종 기간 판정은
  // 반드시 상세페이지의 .createdAt 값으로 수행합니다.
  const displayedDateHint = parseDateTime(firstText(row, ['seq_datetime', 'jumped_at', 'registed_at', 'created_at']));

  return {
    source_id: sourceId,
    source_url: sourceUrlFromId(sourceId),
    title: firstText(row, ['title', 'field_name']) || `공고 ${sourceId}`,
    summary: firstText(row, ['word_from_field']),
    list_region_name: region.name,
    region_name_hint: regionHintFromListing(row, region.name),
    ad_section: adSection,
    list_date_group: listOrderDate(row),
    registered_datetime_hint: displayedDateHint.dateTime,
    listing: row,
  };
}

function mergeCandidates(candidates: Candidate[]) {
  const byId = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const existing = byId.get(candidate.source_id);
    if (!existing) {
      byId.set(candidate.source_id, candidate);
      continue;
    }

    const existingRank = SECTION_RANK[existing.ad_section] || 0;
    const candidateRank = SECTION_RANK[candidate.ad_section] || 0;
    const preferred = candidateRank > existingRank ? candidate : existing;
    const other = preferred === candidate ? existing : candidate;
    byId.set(candidate.source_id, {
      ...preferred,
      region_name_hint: preferred.region_name_hint || other.region_name_hint,
      list_date_group: preferred.list_date_group || other.list_date_group,
      registered_datetime_hint: preferred.registered_datetime_hint || other.registered_datetime_hint,
    });
  }
  return Array.from(byId.values());
}

async function ensureDebugDir() {
  const debugDir = path.resolve(process.cwd(), 'debug-output');
  await fs.mkdir(debugDir, { recursive: true });
  return debugDir;
}

async function saveJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function getWithRetry(client: APIRequestContext, url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await client.get(url, { timeout: 30000 });
      if (response.ok()) return response;
      throw new Error(`GET ${url} status=${response.status()}`);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

async function postListPage(client: APIRequestContext, region: Region, page: number, htmlLastDateTitle: string) {
  let lastError: unknown;
  const url = `/recruit/list/${region.id}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.post(url, {
        timeout: 30000,
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          Origin: BASE_URL,
          Referer: `${BASE_URL}/recruit/regional/${region.id}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        form: {
          page: String(page),
          html: 'Y',
          htmlLastDateTitle,
        },
      });

      if (!response.ok()) throw new Error(`POST ${url} status=${response.status()}`);
      const json = (await response.json()) as { returnCode?: number; returnMsg?: string; extra?: Record<string, any> };
      if (json.returnCode !== 200 || !json.extra) {
        throw new Error(`목록 API 오류: code=${json.returnCode} message=${json.returnMsg || '-'}`);
      }
      return json.extra;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(700 * attempt);
    }
  }

  throw lastError;
}

async function collectRegionCandidates(client: APIRequestContext, region: Region, pageSummaries: PageSummary[]) {
  const regionalUrl = `/recruit/regional/${region.id}`;
  await getWithRetry(client, regionalUrl);

  const candidates: Candidate[] = [];
  let htmlLastDateTitle = '';
  let totalPage: number | null = null;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const extra = await postListPage(client, region, page, htmlLastDateTitle);
    const recruits = Array.isArray(extra.recruits) ? (extra.recruits as Listing[]) : [];

    if (page === 1) {
      for (const section of FEATURED_SECTIONS) {
        const rows = Array.isArray(extra[section.key]) ? (extra[section.key] as Listing[]) : [];
        for (const row of rows) {
          const candidate = candidateFromListing(row, section.name, region);
          if (candidate) candidates.push(candidate);
        }
      }
    }

    let detailCandidateCount = 0;
    for (const row of recruits) {
      const candidate = candidateFromListing(row, '일반구인글', region);
      if (!candidate) continue;
      candidates.push(candidate);
      detailCandidateCount += 1;
    }

    totalPage = Number(extra.pagination?.totalPage || totalPage || 0) || null;
    const responseLastDateTitle = parseDateOnly(extra.htmlLastDateTitle);
    const orderDates = recruits.map(listOrderDate).filter((date): date is string => Boolean(date));
    const oldestOrderDate = orderDates.length ? orderDates.sort()[0] : null;
    const lastDateTitle = responseLastDateTitle || oldestOrderDate;

    pageSummaries.push({
      region: region.name,
      page,
      itemCount: recruits.length,
      detailCandidateCount,
      lastDateTitle,
      totalPage,
    });

    console.log(
      `[${region.name}] 목록 ${page}${totalPage ? `/${totalPage}` : ''}페이지 · ${recruits.length}건 · 상세검증 ${detailCandidateCount}건 · 마지막 목록일 ${lastDateTitle || '-'}`,
    );

    htmlLastDateTitle = normalizeText(extra.htmlLastDateTitle || htmlLastDateTitle);

    if (recruits.length === 0) break;
    if (lastDateTitle && lastDateTitle < START_DATE) break;
    if (totalPage && page >= totalPage) break;
    await sleep(REQUEST_DELAY_MS);
  }

  return mergeCandidates(candidates);
}

function sectionRows($: cheerio.CheerioAPI, title: string) {
  const result: Record<string, string> = {};
  const box = $('.cl_infoBoxBasic')
    .toArray()
    .find((element) => normalizeText($(element).find('.boxTitle').first().text()) === title);
  if (!box) return result;

  $(box)
    .find('table tr')
    .each((_, row) => {
      const cells = $(row)
        .children('th,td')
        .toArray()
        .map((cell) => normalizeText($(cell).text()));
      for (let index = 0; index + 1 < cells.length; index += 2) {
        if (cells[index]) result[cells[index]] = cells[index + 1] || '';
      }
    });

  return result;
}

function textWithBreaks($: cheerio.CheerioAPI, selection: cheerio.Cheerio<any>) {
  if (!selection.length) return '';
  const clone = selection.clone();
  clone.find('br').replaceWith('\n');
  clone.find('p,li').each((_, element) => {
    $(element).append('\n');
  });
  return normalizeMultiline(clone.text());
}

function inferRegionFromAddress(value: unknown) {
  const text = normalizeText(value).replace(/\s+/g, '');
  if (!text) return null;
  if (/서울특별시|서울시|서울/.test(text)) return '서울';
  if (/인천광역시|인천시|인천/.test(text)) return '인천';
  if (/부산광역시|부산시|부산/.test(text)) return '부산';
  if (/울산광역시|울산시|울산/.test(text)) return '울산';
  if (/대구광역시|대구시|대구/.test(text)) return '대구';
  if (/대전광역시|대전시|대전/.test(text)) return '대전';
  if (/세종특별자치시|세종시|세종/.test(text)) return '세종';
  if (/광주광역시|광주광역/.test(text)) return '광주';
  if (/강원특별자치도|강원도|강릉|원주|춘천|속초|동해|삼척|태백|홍천|횡성|평창|정선|영월|인제|양양|철원|화천|양구/.test(text)) return '강원도';
  if (/제주특별자치도|제주도|제주|서귀포/.test(text)) return '제주도';
  if (/충청북도|충청남도|충북|충남|천안|아산|청주|충주|제천|공주|보령|서산|논산|계룡|당진|음성|진천/.test(text)) return '충청도';
  if (/전북특별자치도|전라북도|전라남도|전북|전남|전주|군산|익산|정읍|남원|김제|목포|여수|순천|나주|광양/.test(text)) return '전라도';
  if (/경상북도|경상남도|경북|경남|포항|경주|김천|안동|구미|창원|진주|통영|사천|김해|밀양|거제|양산/.test(text)) return '경상도';
  if (/경기도|수원|용인|성남|화성|안산|안양|평택|시흥|광명|군포|오산|이천|안성|의왕|과천|여주|양평|하남|부천|고양|파주|의정부|양주|동두천|포천|연천|가평|남양주|구리|김포/.test(text)) {
    if (/고양|일산|파주|의정부|양주|동두천|포천|연천|가평|남양주|구리|김포/.test(text)) return '경기북부';
    return '경기남부';
  }
  return null;
}

async function parseDetail(client: APIRequestContext, candidate: Candidate): Promise<BunyanglineItem | null> {
  const response = await getWithRetry(client, candidate.source_url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const registered = parseDateTime($('.createdAt').first().text() || candidate.registered_datetime_hint || registrationValue(candidate.listing));
  if (!registered.date || !registered.dateTime || registered.date < START_DATE) return null;

  const work = sectionRows($, '근무지 정보');
  const company = sectionRows($, '사업자 정보');
  const project = sectionRows($, '사업지 정보');
  const basic = sectionRows($, '기본요강');
  const salary = sectionRows($, '급여정보');
  const detailSelection = $('.detailInfo').first();
  const detailText = textWithBreaks($, detailSelection) || normalizeMultiline(candidate.listing.content);
  const rawText = textWithBreaks($, $('body').first()).slice(0, 50000);
  const workAddress = normalizeText(work['근무지역 주소']) || null;
  const siteAddress = normalizeText(project['사업지 주소']) || null;
  const regionName =
    inferRegionFromAddress(workAddress) ||
    inferRegionFromAddress(siteAddress) ||
    candidate.region_name_hint ||
    candidate.list_region_name;

  return {
    region_name: regionName === '모든지역' ? '미지정' : regionName,
    list_region_name: candidate.list_region_name,
    ad_section: candidate.ad_section,
    site_name: normalizeText(project['현장명'] || candidate.listing.field_name || candidate.title) || '-',
    posted_at: registered.date,
    posted_datetime: registered.dateTime,
    manager_name: normalizeText(company['담당자 이름']) || '-',
    manager_phone: normalizePhone(company['담당자 연락처']) || '-',
    agency_company: normalizeText(company['대행사']) || '-',
    apartment_fee: normalizeText(salary['아파트 분양']) || '',
    move_in_date: normalizeText($('.jobStartDate').first().text()).replace(/^투입일\s*[:：]?\s*/, '') || '-',
    source_url: candidate.source_url,
    source_id: candidate.source_id,
    title: normalizeText($('.mediaR .topArea .tit').first().text() || candidate.title) || candidate.title,
    summary: normalizeText($('.mediaR .topArea .txt').first().text() || candidate.summary) || null,
    site_address: siteAddress,
    work_address: workAddress,
    category: normalizeText(basic['업종']) || null,
    list_date_group: candidate.list_date_group,
    detail_text: detailText,
    raw_text: rawText,
    crawled_at: new Date().toISOString(),
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

async function sendBatch(items: BunyanglineItem[], batchNo: number) {
  if (!SEND_TO_CRM) {
    console.log(`[CRM저장] SEND_TO_CRM=false → ${items.length}건 저장 생략`);
    return;
  }
  if (!IMPORT_URL) throw new Error('CRM_BUNYANGLINE_IMPORT_URL 환경변수가 없습니다.');

  const response = await fetch(IMPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-import-secret': IMPORT_SECRET,
      Authorization: IMPORT_SECRET ? `Bearer ${IMPORT_SECRET}` : '',
    },
    body: JSON.stringify({ items }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) {
    throw new Error(`[CRM저장] batch ${batchNo} 실패: status=${response.status} body=${JSON.stringify(json)}`);
  }
  console.log(`[CRM저장] batch ${batchNo}: ${items.length}건 전송 완료`);
}

async function main() {
  const debugDir = await ensureDebugDir();
  const selectedIds = REGION_ARG === 'all'
    ? new Set(REGIONS.filter((region) => region.id !== '0').map((region) => region.id))
    : new Set(REGION_ARG.split(',').map((value) => value.trim()).filter(Boolean));
  const targetRegions = REGIONS.filter((region) => selectedIds.has(region.id) || selectedIds.has(region.name));
  if (!targetRegions.length) throw new Error(`수집할 지역이 없습니다. BUNYANGLINE_REGION_IDS=${REGION_ARG}`);

  console.log('분양라인 직접 JSON 페이지 크롤러를 시작합니다.');
  console.log(`- 실행 모드: ${CRAWL_MODE}`);
  console.log(`- CRM 데이터 하한: ${DATA_START_DATE}`);
  console.log(`- 이번 실행 상세 표시일 기준: ${START_DATE} 이후`);
  console.log(`- 대상: ${targetRegions.map((region) => `${region.name}(${region.id})`).join(', ')}`);
  console.log(`- 상세 동시 처리: ${DETAIL_CONCURRENCY}개`);
  console.log(`- CRM 전송: ${SEND_TO_CRM}`);

  const client = await request.newContext({
    baseURL: BASE_URL,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7' },
  });

  const pageSummaries: PageSummary[] = [];
  const failures: Array<{ source_id: string; source_url: string; reason: string }> = [];

  try {
    const allCandidates: Candidate[] = [];
    for (const region of targetRegions) {
      const candidates = await collectRegionCandidates(client, region, pageSummaries);
      allCandidates.push(...candidates);
      console.log(`[${region.name}] 상세 날짜 검증 후보 ${candidates.length}건`);
    }

    const dedupedCandidates = mergeCandidates(allCandidates);
    const limitedCandidates = MAX_DETAILS > 0 ? dedupedCandidates.slice(0, MAX_DETAILS) : dedupedCandidates;
    console.log(`[상세] 중복 제거 후 ${dedupedCandidates.length}건${MAX_DETAILS > 0 ? ` · 테스트 제한 ${limitedCandidates.length}건` : ''}`);

    let completed = 0;
    const parsed = await mapWithConcurrency(limitedCandidates, DETAIL_CONCURRENCY, async (candidate) => {
      try {
        const item = await parseDetail(client, candidate);
        completed += 1;
        if (completed % 25 === 0 || completed === limitedCandidates.length) {
          console.log(`[상세] ${completed}/${limitedCandidates.length} 완료`);
        }
        await sleep(REQUEST_DELAY_MS);
        return item;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ source_id: candidate.source_id, source_url: candidate.source_url, reason });
        completed += 1;
        console.log(`[상세실패] ${candidate.source_id}: ${reason}`);
        return null;
      }
    });

    const items = parsed.filter((item): item is BunyanglineItem => Boolean(item));
    await saveJson(path.join(debugDir, 'page-summaries.json'), pageSummaries);
    await saveJson(path.join(debugDir, 'candidates.json'), dedupedCandidates);
    await saveJson(path.join(debugDir, 'collected-items.json'), items);
    await saveJson(path.join(debugDir, 'failures.json'), failures);

    const batchSize = 100;
    for (let start = 0, batchNo = 1; start < items.length; start += batchSize, batchNo += 1) {
      await sendBatch(items.slice(start, start + batchSize), batchNo);
    }

    const sectionCounts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.ad_section] = (acc[item.ad_section] || 0) + 1;
      return acc;
    }, {});
    console.log(`[완료] 저장대상 ${items.length}건 · 실패 ${failures.length}건 · 지면 ${JSON.stringify(sectionCounts)}`);
  } finally {
    await client.dispose();
  }
}

main().catch((error) => {
  console.error('[치명적 오류]', error);
  process.exit(1);
});
