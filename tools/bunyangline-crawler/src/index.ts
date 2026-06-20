import { chromium, BrowserContext, Page, Response } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.bunyangline.com';
const IMPORT_URL = process.env.CRM_BUNYANGLINE_IMPORT_URL || '';
const IMPORT_SECRET = process.env.BUNYANGLINE_IMPORT_SECRET || '';
const REGION_ARG = process.env.BUNYANGLINE_REGION_IDS || 'all';
const SCROLL_ROUNDS = Math.max(1, Number(process.env.BUNYANGLINE_SCROLL_ROUNDS || '10') || 10);
const HEADLESS = process.env.HEADLESS !== 'false';
const SEND_TO_CRM = process.env.SEND_TO_CRM !== 'false';
const LOOKBACK_DAYS = Math.max(0, Number(process.env.BUNYANGLINE_LOOKBACK_DAYS || process.env.BUNYANGLINE_DAYS_BACK || '5') || 5);

const REGIONS = [
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

type Region = (typeof REGIONS)[number];

type CandidateOrigin = 'api-json' | 'api-text' | 'html-link' | 'html-json' | 'static-ad-click';

type Candidate = {
  source_url: string;
  source_id: string;
  title: string;
  region_name: string;
  ad_section: string;
  list_date_group: string | null;
  posted_at_hint: string | null;
  posted_datetime_hint: string | null;
  raw_text: string | null;
  origin: CandidateOrigin;
  confidence: number;
};

type NetworkRecord = {
  url: string;
  status: number;
  contentType: string;
  bodyLength: number;
  kind: string;
  candidateCount: number;
  sample: string;
};

type BunyanglineItem = {
  region_name: string;
  ad_section: string;
  site_name: string;
  posted_at: string | null;
  posted_datetime: string | null;
  manager_name: string;
  manager_phone: string;
  agency_company: string;
  apartment_fee: string;
  move_in_date: string;
  source_url: string;
  source_id: string | null;
  title: string | null;
  summary: string | null;
  site_address: string | null;
  work_address: string | null;
  category: string | null;
  list_date_group: string | null;
  detail_text: string;
  raw_text: string;
  crawled_at: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactText(value: unknown, max = 200) {
  return normalizeText(value).replace(/\s+/g, ' ').slice(0, max);
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|#%&{}$!`'@+=]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 140);
}

async function ensureDebugDir() {
  const debugDir = path.resolve(process.cwd(), 'debug-output');
  await fs.mkdir(debugDir, { recursive: true });
  return debugDir;
}

async function saveJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function saveText(filePath: string, value: string) {
  await fs.writeFile(filePath, value, 'utf8');
}

function currentKstDate() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cutoffKstDate() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const cutoff = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - LOOKBACK_DAYS));
  const y = cutoff.getUTCFullYear();
  const m = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateOnly(value: string | null | undefined) {
  const text = normalizeText(value);
  const match = text.match(/(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function parseDateTime(value: string | null | undefined) {
  const text = normalizeText(value);
  const match = text.match(/(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})(?:[일\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return { postedAt: null, postedDatetime: null };

  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  const hh = (match[4] || '00').padStart(2, '0');
  const mm = (match[5] || '00').padStart(2, '0');
  const ss = (match[6] || '00').padStart(2, '0');

  return {
    postedAt: `${y}-${m}-${d}`,
    postedDatetime: `${y}-${m}-${d} ${hh}:${mm}:${ss}`,
  };
}

function isRecentDate(dateText: string | null | undefined) {
  const date = parseDateOnly(dateText);
  if (!date) return false;
  return date >= cutoffKstDate() && date <= currentKstDate();
}

function isOlderThanCutoff(dateText: string | null | undefined) {
  const date = parseDateOnly(dateText);
  if (!date) return false;
  return date < cutoffKstDate();
}

function hasOlderThanCutoffDate(text: string) {
  const matches = Array.from(text.matchAll(/20\d{2}-\d{2}-\d{2}/g)).map((item) => item[0]);
  return matches.some((date) => date < cutoffKstDate());
}

function normalizeSourceUrl(value: string) {
  const url = new URL(value, BASE_URL);
  url.hash = '';
  if (!url.searchParams.get('previousActiveNaviId')) {
    url.searchParams.set('previousActiveNaviId', 'regional');
  }
  return url.toString();
}

function sourceUrlFromId(id: string | number) {
  const clean = String(id).replace(/\D/g, '');
  return normalizeSourceUrl(`${BASE_URL}/recruit/view/${clean}/?previousActiveNaviId=regional`);
}

function extractSourceId(sourceUrl: string | null | undefined) {
  return String(sourceUrl || '').match(/\/recruit\/view\/(\d+)/)?.[1] || null;
}

function normalizePhone(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return '-';

  const phone = text.match(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0];
  if (phone) return phone.replace(/\D/g, '');

  const tel = text.match(/(?:02|0[3-6]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0];
  if (tel) return tel.replace(/\D/g, '');

  const digits = text.replace(/\D/g, '');
  return digits || text || '-';
}

function normalizeSection(value: unknown) {
  const text = normalizeText(value).replace(/\s+/g, '').toLowerCase();
  if (text.includes('unique') || text.includes('유니크')) return '유니크';
  if (text.includes('superior') || text.includes('슈페리어')) return '슈페리어';
  if (text.includes('전국top') || text.includes('전국탑') || text.includes('nationaltop')) return '전국TOP';
  if (text.includes('지역top') || text.includes('지역탑') || text.includes('regionaltop')) return '지역TOP';
  if (text.includes('일반구인글') || text.includes('normal') || text.includes('basic')) return '일반구인글';
  return normalizeText(value) || '일반구인글';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function firstText(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const text = normalizeText(value);
      if (text) return text;
    }
  }
  return null;
}

function firstDateValue(obj: Record<string, unknown>) {
  return firstText(obj, [
    'created_at',
    'createdAt',
    'reg_date',
    'regDate',
    'registered_at',
    'write_date',
    'wdate',
    'insert_date',
    'posted_at',
    'post_date',
    'display_date',
    'date',
  ]);
}

function firstIdValue(obj: Record<string, unknown>) {
  for (const key of ['idx', 'recruit_idx', 'recruit_id', 'site_idx', 'post_id', 'board_id', 'wr_id', 'id', 'seq', 'no']) {
    const value = obj[key];
    if (typeof value === 'number' || typeof value === 'string') {
      const digits = String(value).match(/\d{4,}/)?.[0];
      if (digits) return digits;
    }
  }
  return null;
}

function findAnySourceUrl(obj: Record<string, unknown>) {
  for (const key of ['source_url', 'url', 'href', 'link', 'view_url', 'viewUrl']) {
    const value = obj[key];
    if (typeof value === 'string' && value.includes('/recruit/view/')) {
      return normalizeSourceUrl(value);
    }
  }
  return null;
}

function inferSectionFromObject(obj: Record<string, unknown>, pathText: string) {
  const direct = firstText(obj, [
    'ad_section',
    'section',
    'section_name',
    'service_name',
    'serviceName',
    'product_name',
    'productName',
    'goods_name',
    'goodsName',
    'display_type',
    'displayType',
    'grade_name',
    'type_name',
  ]);
  const fromDirect = normalizeSection(direct || '');
  if (fromDirect !== '일반구인글' || (direct && /일반|normal|basic/i.test(direct))) return fromDirect;
  return normalizeSection(pathText) || '일반구인글';
}

function candidateFromObject(obj: Record<string, unknown>, regionName: string, origin: CandidateOrigin, pathText: string): Candidate | null {
  const sourceUrl = findAnySourceUrl(obj);
  const id = extractSourceId(sourceUrl || '') || firstIdValue(obj);
  if (!id) return null;

  const title =
    firstText(obj, [
      'title',
      'subject',
      'name',
      'site_name',
      'siteName',
      'field_name',
      'fieldName',
      'recruit_title',
      'article_title',
      'workplace_name',
      'company_name',
    ]) || `공고 ${id}`;

  // 너무 짧은 이름 또는 시스템 id 객체를 공고로 오인하는 것을 줄입니다.
  const compactTitle = compactText(title, 160);
  const textBlob = compactText(JSON.stringify(obj), 1000);
  if (!/분양|아파트|오피스텔|상가|팀장|팀원|본부|수수료|계약|모집|현장|대행|부동산|레지던스|생활주택|지식산업/i.test(`${compactTitle} ${textBlob}`)) {
    return null;
  }

  const dateText = firstDateValue(obj);
  const dateInfo = parseDateTime(dateText || '');
  const source = sourceUrl || sourceUrlFromId(id);

  return {
    source_url: source,
    source_id: extractSourceId(source) || String(id),
    title: compactTitle,
    region_name: regionName,
    ad_section: inferSectionFromObject(obj, pathText),
    list_date_group: dateInfo.postedAt,
    posted_at_hint: dateInfo.postedAt,
    posted_datetime_hint: dateInfo.postedDatetime,
    raw_text: textBlob,
    origin,
    confidence: compactTitle.startsWith('공고 ') ? 60 : 90,
  };
}

function extractCandidatesFromJson(value: unknown, regionName: string, origin: CandidateOrigin, pathParts: string[] = [], out: Candidate[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => extractCandidatesFromJson(item, regionName, origin, [...pathParts, String(index)], out));
    return out;
  }

  if (!isPlainObject(value)) return out;

  const pathText = pathParts.join('/');
  const candidate = candidateFromObject(value, regionName, origin, pathText);
  if (candidate) out.push(candidate);

  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') {
      extractCandidatesFromJson(child, regionName, origin, [...pathParts, key], out);
    } else if (typeof child === 'string' && child.includes('/recruit/view/')) {
      out.push(...extractCandidatesFromText(child, regionName, origin));
    }
  }

  return out;
}

function extractCandidatesFromText(text: string, regionName: string, origin: CandidateOrigin): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const sourcePatterns = [
    /https?:\/\/www\.bunyangline\.com\/recruit\/view\/(\d+)\/?[^"'\s<]*/g,
    /\/recruit\/view\/(\d+)\/?[^"'\s<]*/g,
  ];

  for (const pattern of sourcePatterns) {
    for (const match of text.matchAll(pattern)) {
      const sourceUrl = normalizeSourceUrl(match[0].startsWith('http') ? match[0] : `${BASE_URL}${match[0]}`);
      if (seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);
      out.push({
        source_url: sourceUrl,
        source_id: match[1],
        title: `공고 ${match[1]}`,
        region_name: regionName,
        ad_section: '일반구인글',
        list_date_group: null,
        posted_at_hint: null,
        posted_datetime_hint: null,
        raw_text: `text-link:${match[0]}`,
        origin,
        confidence: 70,
      });
    }
  }

  // JSON 안에 문자열로만 포함된 idx 값 대응
  for (const match of text.matchAll(/['"](?:idx|recruit_idx|recruit_id|post_id|id)['"]\s*:\s*['"]?(\d{4,})['"]?/g)) {
    const id = match[1];
    const sourceUrl = sourceUrlFromId(id);
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    out.push({
      source_url: sourceUrl,
      source_id: id,
      title: `공고 ${id}`,
      region_name: regionName,
      ad_section: '일반구인글',
      list_date_group: null,
      posted_at_hint: null,
      posted_datetime_hint: null,
      raw_text: `text-idx:${id}`,
      origin,
      confidence: 40,
    });
  }

  return out;
}

function mergeCandidates(candidates: Candidate[]) {
  const byUrl = new Map<string, Candidate>();

  for (const candidate of candidates) {
    if (!candidate.source_url) continue;
    const existing = byUrl.get(candidate.source_url);
    if (!existing) {
      byUrl.set(candidate.source_url, candidate);
      continue;
    }

    const betterTitle = existing.title.startsWith('공고 ') && !candidate.title.startsWith('공고 ') ? candidate.title : existing.title;
    byUrl.set(candidate.source_url, {
      ...existing,
      ...candidate,
      title: betterTitle,
      ad_section: existing.ad_section !== '일반구인글' ? existing.ad_section : candidate.ad_section,
      list_date_group: existing.list_date_group || candidate.list_date_group,
      posted_at_hint: existing.posted_at_hint || candidate.posted_at_hint,
      posted_datetime_hint: existing.posted_datetime_hint || candidate.posted_datetime_hint,
      raw_text: existing.raw_text || candidate.raw_text,
      confidence: Math.max(existing.confidence, candidate.confidence),
    });
  }

  return Array.from(byUrl.values());
}

async function getBodyText(page: Page) {
  return normalizeText(await page.locator('body').innerText({ timeout: 10000 }).catch(() => ''));
}

async function getHtml(page: Page) {
  return page.content().catch(() => '');
}

async function gotoList(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch((error) => {
    console.log(`[목록접속] page.goto 경고: ${error?.message || String(error)}`);
    return null;
  });

  await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => undefined);
  await sleep(1800);

  return response?.status() || null;
}

async function maybeCollectResponse(response: Response, regionName: string): Promise<{ record: NetworkRecord; candidates: Candidate[] } | null> {
  const url = response.url();
  if (!url.includes('bunyangline.com')) return null;

  const headers = response.headers();
  const contentType = headers['content-type'] || '';
  const likelyUseful =
    contentType.includes('application/json') ||
    /ajax|api|recruit|regional|list|view|supporters|search|load|more/i.test(url);

  if (!likelyUseful) return null;

  let text = '';
  try {
    text = await response.text();
  } catch (error: any) {
    return {
      record: {
        url,
        status: response.status(),
        contentType,
        bodyLength: 0,
        kind: 'read-failed',
        candidateCount: 0,
        sample: error?.message || String(error),
      },
      candidates: [],
    };
  }

  if (!text || text.length > 3_000_000) {
    return {
      record: {
        url,
        status: response.status(),
        contentType,
        bodyLength: text.length,
        kind: 'too-large-or-empty',
        candidateCount: 0,
        sample: text.slice(0, 300),
      },
      candidates: [],
    };
  }

  let candidates: Candidate[] = [];
  let kind = 'text';
  const trimmed = text.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      kind = 'json';
      candidates = extractCandidatesFromJson(json, regionName, 'api-json');
    } catch {
      kind = 'json-parse-failed';
    }
  }

  candidates.push(...extractCandidatesFromText(text, regionName, kind === 'json' ? 'api-json' : 'api-text'));
  candidates = mergeCandidates(candidates);

  return {
    record: {
      url,
      status: response.status(),
      contentType,
      bodyLength: text.length,
      kind,
      candidateCount: candidates.length,
      sample: compactText(text, 700),
    },
    candidates,
  };
}

async function collectRegionApiCandidates(page: Page, region: Region, debugDir: string) {
  const listUrl = `${BASE_URL}/recruit/regional/${region.id}`;
  const prefix = safeFileName(`${region.id}_${region.name}_${Date.now()}`);
  const candidates: Candidate[] = [];
  const networkRecords: NetworkRecord[] = [];
  const responseJobs: Promise<void>[] = [];

  const onResponse = (response: Response) => {
    const job = maybeCollectResponse(response, region.name)
      .then((result) => {
        if (!result) return;
        networkRecords.push(result.record);
        if (result.candidates.length > 0) {
          candidates.push(...result.candidates);
          console.log(`[${region.name}] API 후보 ${result.candidates.length}건: ${result.record.url}`);
        }
      })
      .catch(() => undefined);
    responseJobs.push(job);
  };

  page.on('response', onResponse);

  console.log('');
  console.log('='.repeat(90));
  console.log(`[${region.name}] 목록 접속: ${listUrl}`);

  const status = await gotoList(page, listUrl);
  console.log(`[${region.name}] 응답 status: ${status ?? '-'}`);

  let lastCount = 0;
  let stagnant = 0;
  let olderSeen = false;

  for (let round = 0; round <= SCROLL_ROUNDS; round += 1) {
    await Promise.allSettled(responseJobs.splice(0));

    const bodyText = await getBodyText(page);
    const html = await getHtml(page);
    olderSeen = olderSeen || hasOlderThanCutoffDate(bodyText);

    // HTML 안에 포함된 API/템플릿/링크 후보도 함께 수집
    candidates.push(...extractCandidatesFromText(html, region.name, 'html-link'));

    const merged = mergeCandidates(candidates);
    const currentCount = merged.length;

    if (round === 0) {
      console.log(`[${region.name}] body text 길이: ${bodyText.length.toLocaleString()}`);
      console.log(`[${region.name}] 초기 API/HTML 후보: ${currentCount}건`);
      await saveText(path.join(debugDir, `${prefix}_visible_text_initial.txt`), bodyText);
      await saveText(path.join(debugDir, `${prefix}_html_initial.html`), html.slice(0, 500000));
      await page.screenshot({ path: path.join(debugDir, `${prefix}_initial.png`), fullPage: true }).catch(() => undefined);
    }

    if (round > 0 && round % 5 === 0) {
      const delta = currentCount - lastCount;
      console.log(
        `[${region.name}] 스크롤 ${round}/${SCROLL_ROUNDS}: API/URL 후보 ${currentCount}건 / 증가 ${delta >= 0 ? '+' : ''}${delta} / 오래된날짜 ${olderSeen ? 'Y' : 'N'}`,
      );

      if (olderSeen && delta <= 0) stagnant += 1;
      else if (delta > 0) stagnant = 0;
      lastCount = currentCount;

      if (round >= 10 && olderSeen && stagnant >= 3) {
        console.log(`[${region.name}] 최근 ${LOOKBACK_DAYS}일 이전 날짜 확인 + API 후보 증가 없음 ${stagnant}회 → 스크롤 종료`);
        break;
      }
    }

    if (round === SCROLL_ROUNDS) break;
    await page.mouse.wheel(0, 2600).catch(() => undefined);
    await sleep(500);
  }

  await Promise.allSettled(responseJobs);
  page.off('response', onResponse);

  const finalText = await getBodyText(page);
  const finalHtml = await getHtml(page);
  candidates.push(...extractCandidatesFromText(finalHtml, region.name, 'html-link'));

  const finalCandidates = mergeCandidates(candidates).filter((candidate) => {
    // API에 등록일 힌트가 있는 경우 여기서 1차 필터링합니다. 등록일이 없으면 상세페이지에서 최종 필터링합니다.
    if (candidate.posted_at_hint) return isRecentDate(candidate.posted_at_hint);
    if (candidate.list_date_group) return isRecentDate(candidate.list_date_group);
    return true;
  });

  await saveText(path.join(debugDir, `${prefix}_visible_text_final.txt`), finalText);
  await saveText(path.join(debugDir, `${prefix}_html_final.html`), finalHtml.slice(0, 800000));
  await saveJson(path.join(debugDir, `${prefix}_network_records.json`), networkRecords);
  await saveJson(path.join(debugDir, `${prefix}_api_candidates.json`), finalCandidates);
  await page.screenshot({ path: path.join(debugDir, `${prefix}_final.png`), fullPage: true }).catch(() => undefined);

  const usefulResponses = networkRecords.filter((record) => record.candidateCount > 0);
  console.log(`[${region.name}] JSON/API 응답 ${networkRecords.length}개 감지 / 후보 포함 응답 ${usefulResponses.length}개`);
  console.log(`[${region.name}] 상세 URL 후보 최종 ${finalCandidates.length}건`);

  if (finalCandidates.length === 0) {
    console.log(`[${region.name}] 후보 0건입니다. debug-output의 ${prefix}_network_records.json / html_final.html을 확인하세요.`);
  }

  return finalCandidates;
}

function findLabelValue(lines: string[], labels: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeText(lines[index]);
    if (!line) continue;

    for (const label of labels) {
      if (line === label) {
        return normalizeText(lines[index + 1] || '') || null;
      }

      const direct = line.match(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：]?\\s*(.+)$`));
      if (direct?.[1]) return normalizeText(direct[1]);
    }
  }

  return null;
}

function extractDetailSection(lines: string[], startLabels: string[], endLabels: string[]) {
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (startLabels.includes(lines[index])) {
      start = index + 1;
      break;
    }
  }
  if (start < 0) return null;

  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    if (endLabels.includes(lines[index])) {
      end = index;
      break;
    }
  }

  return normalizeText(lines.slice(start, end).join('\n')) || null;
}

function extractApartmentFee(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeText(lines[index]);
    if (/아파트\s*분양/.test(line)) {
      const next = normalizeText(lines[index + 1] || '');
      if (next && /\d|만|원|%|수수료/.test(next)) return `${line} ${next}`;
      return line;
    }
  }

  const salarySection = extractDetailSection(lines, ['급여정보', '급여 정보'], ['상세정보', '상세 정보', '근무지 정보', '사업자 정보']);
  if (salarySection) {
    const useful = salarySection
      .split('\n')
      .map((line) => normalizeText(line))
      .filter((line) => /분양|수수료|만원|원|%/.test(line))
      .slice(0, 6)
      .join(' / ');
    return useful || salarySection.slice(0, 250);
  }

  return '-';
}

function extractMoveInDate(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeText(lines[index]);
    if (!line.includes('투입일')) continue;

    const direct = line.match(/투입일\s*[:：]?\s*(.+)$/)?.[1];
    if (direct && normalizeText(direct) !== '투입일') return normalizeText(direct);

    const next = normalizeText(lines[index + 1] || '');
    if (next) return next;
  }

  return '-';
}

async function bestTitleFromPage(page: Page, fallback: string) {
  const selectors = ['h1', 'h2', 'h3', '.title', '.subject', '.view-title'];
  for (const selector of selectors) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 8); index += 1) {
      const text = compactText(await loc.nth(index).innerText({ timeout: 500 }).catch(() => ''), 160);
      if (text && text.length >= 5 && !/구인글 상세보기|지역현장|분양라인/.test(text)) return text;
    }
  }
  return fallback;
}

async function parseDetail(context: BrowserContext, candidate: Candidate): Promise<BunyanglineItem | null> {
  const page = await context.newPage();
  try {
    await page.goto(candidate.source_url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch((error) => {
      console.log(`[상세] page.goto 경고: ${candidate.source_url} / ${error?.message || String(error)}`);
      return null;
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => undefined);
    await sleep(900);

    const rawText = await getBodyText(page);
    const lines = rawText.split('\n').map((line) => normalizeText(line)).filter(Boolean);

    // 상세페이지 오른쪽 상단 등록일시를 최우선으로 사용합니다.
    const firstDateTime = rawText.match(/20\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2}\s+\d{1,2}:\d{2}:\d{2}/)?.[0] || candidate.posted_datetime_hint;
    const dateInfo = parseDateTime(firstDateTime || candidate.posted_at_hint || candidate.list_date_group || '');

    if (!dateInfo.postedAt || !isRecentDate(dateInfo.postedAt)) {
      return null;
    }

    const title = await bestTitleFromPage(page, candidate.title);
    const siteName = findLabelValue(lines, ['현장명', '사업지명', '현장 이름']) || title || '-';
    const siteAddress = findLabelValue(lines, ['사업지 주소', '사업지주소', '현장 주소', '현장주소']);
    const workAddress = findLabelValue(lines, ['근무지역 주소', '근무지 주소', '근무주소', '근무지역']);
    const managerName = findLabelValue(lines, ['담당자 이름', '담당자명', '담당자']) || '-';
    const managerPhoneRaw = findLabelValue(lines, ['담당자 연락처', '담당자연락처', '연락처', '전화번호']) || '-';
    const agencyCompany = findLabelValue(lines, ['대행사', '회사명', '상호명']) || '-';
    const category = findLabelValue(lines, ['업종', '상품유형', '분류', '카테고리']);
    const detailText = extractDetailSection(lines, ['상세정보', '상세 정보'], ['접수방법', '접수 방법', '기업정보', '사업자 정보']) || rawText.slice(0, 3000) || '-';
    const summary = lines.find((line) => line !== title && line.length >= 10 && line.length <= 140 && !line.includes('지역현장')) || candidate.raw_text || null;

    return {
      region_name: candidate.region_name,
      ad_section: candidate.ad_section || '미지정',
      site_name: siteName,
      posted_at: dateInfo.postedAt,
      posted_datetime: dateInfo.postedDatetime,
      manager_name: managerName,
      manager_phone: normalizePhone(managerPhoneRaw),
      agency_company: agencyCompany,
      apartment_fee: extractApartmentFee(lines),
      move_in_date: extractMoveInDate(lines),
      source_url: normalizeSourceUrl(candidate.source_url),
      source_id: extractSourceId(candidate.source_url),
      title,
      summary,
      site_address: siteAddress,
      work_address: workAddress,
      category,
      list_date_group: candidate.list_date_group || null,
      detail_text: detailText,
      raw_text: rawText.slice(0, 12000),
      crawled_at: new Date().toISOString(),
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function sendBatch(items: BunyanglineItem[], batchNo: number) {
  if (!SEND_TO_CRM) {
    console.log(`[CRM저장] SEND_TO_CRM=false → ${items.length}건 저장 생략`);
    return { ok: true, skipped: true };
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

  console.log(`[CRM저장] batch ${batchNo}: ${items.length}건 전송 완료 / insertedOrUpdated=${json.insertedOrUpdated ?? '-'}`);
  return json;
}

async function main() {
  const debugDir = await ensureDebugDir();
  const regionIds = REGION_ARG === 'all' ? null : new Set(REGION_ARG.split(',').map((item) => item.trim()).filter(Boolean));
  const targetRegions = regionIds ? REGIONS.filter((region) => regionIds.has(region.id) || regionIds.has(region.name)) : REGIONS;

  if (targetRegions.length === 0) {
    throw new Error(`수집할 지역이 없습니다. BUNYANGLINE_REGION_IDS=${REGION_ARG}`);
  }

  console.log('분양라인 JSON/API 우선 크롤러를 시작합니다.');
  console.log('- 수집 방식: 목록 JSON/API 응답에서 공고 idx 추출 → 상세페이지 직접 접근');
  console.log('- 클릭 방식: 사용하지 않음');
  console.log('- 중복 기준: source_url 단독');
  console.log(`- 수집 기간: ${cutoffKstDate()} 이후 등록 공고`);
  console.log(`- regionArg: ${REGION_ARG}`);
  console.log(`- scrollRounds: ${SCROLL_ROUNDS}`);
  console.log(`- headless: ${HEADLESS}`);
  console.log(`- sendToCrm: ${SEND_TO_CRM}`);
  console.log(`[지역목록] ${targetRegions.map((region) => `${region.name}(${region.id})`).join(', ')}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const listPage = await context.newPage();
  const allItems: BunyanglineItem[] = [];
  const failures: Array<{ region: string; source_url?: string; title: string; reason: string }> = [];
  let globalBatchNo = 1;
  let totalSavedToCrm = 0;

  try {
    for (const region of targetRegions) {
      const candidates = await collectRegionApiCandidates(listPage, region, debugDir);
      console.log(`[${region.name}] 상세 파싱 시작: ${candidates.length}건`);

      let regionSaved = 0;
      const regionItems: BunyanglineItem[] = [];

      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        if (index > 0 && index % 30 === 0) {
          console.log(`[${region.name}] 상세 파싱 진행 ${index}/${candidates.length} / 저장대상 ${regionSaved}건`);
        }

        try {
          const item = await parseDetail(context, candidate);
          if (!item) continue;
          regionItems.push(item);
          allItems.push(item);
          regionSaved += 1;
        } catch (error: any) {
          const reason = error?.message || String(error);
          failures.push({ region: region.name, source_url: candidate.source_url, title: candidate.title, reason });
          console.log(`[${region.name}] 상세 파싱 실패: ${candidate.source_url} / ${reason}`);
        }
      }

      const regionDeduped = Array.from(new Map(regionItems.map((item) => [item.source_url, item])).values());
      await saveJson(path.join(debugDir, `collected-items-${safeFileName(region.name)}.json`), regionDeduped);

      console.log(`[${region.name}] 완료: 후보 ${candidates.length}건 / 최근 ${LOOKBACK_DAYS}일 저장대상 ${regionSaved}건 / 지역 중복제거 후 ${regionDeduped.length}건 / 실패 누적 ${failures.length}건`);

      if (regionDeduped.length > 0) {
        console.log(`[${region.name}] CRM 지역별 즉시 저장 시작: ${regionDeduped.length}건`);
        const batchSize = 50;
        for (let start = 0; start < regionDeduped.length; start += batchSize) {
          const batch = regionDeduped.slice(start, start + batchSize);
          await sendBatch(batch, globalBatchNo);
          globalBatchNo += 1;
          totalSavedToCrm += batch.length;
        }
        console.log(`[${region.name}] CRM 지역별 즉시 저장 완료: ${regionDeduped.length}건`);
      } else {
        console.log(`[${region.name}] CRM 저장 대상 없음`);
      }
    }

    const deduped = Array.from(new Map(allItems.map((item) => [item.source_url, item])).values());
    await saveJson(path.join(debugDir, 'collected-items.json'), deduped);
    await saveJson(path.join(debugDir, 'failures.json'), failures);

    console.log('');
    console.log('='.repeat(90));
    console.log(`[최종] 수집 대상: ${deduped.length}건 / CRM 전송 누적: ${totalSavedToCrm}건 / 실패: ${failures.length}건`);
    console.log('[완료] 분양라인 크롤링이 완료되었습니다.');
  } finally {
    await listPage.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[치명적 오류]', error);
  process.exit(1);
});
