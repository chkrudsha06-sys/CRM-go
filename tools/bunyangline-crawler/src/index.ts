import { chromium, Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.bunyangline.com';

const REGION_NAMES = [
  '서울',
  '경기남부',
  '경기북부',
  '인천',
  '부산',
  '울산',
  '대구',
  '경상도',
  '대전',
  '세종',
  '충청도',
  '광주',
  '전라도',
  '강원도',
  '제주도',
] as const;

type RegionName = (typeof REGION_NAMES)[number];

type RegionTarget = {
  id: string;
  name: RegionName;
  url: string;
  source: string;
};

type LinkItem = {
  text: string;
  href: string;
};

type JsonPayload = {
  url: string;
  status: number;
  contentType: string;
  value: unknown;
  textSample: string;
};

type DisplayedRegion = {
  regionName: string;
  source: string;
  matchText: string;
};

type RecruitItem = {
  source_url: string;
  source_post_key: string;
  region_id: string;
  region_name: string;
  list_region_name: string;
  actual_region_name: string;
  actual_region_source: string;
  region_match_text: string;
  site_name: string;
  site_address: string;
  posted_at: string | null;
  posted_datetime: string | null;
  manager_name: string;
  manager_phone: string;
  agency_company: string;
  apartment_fee: string;
  detail_text: string;
  raw_text: string;
  crawled_at: string;
};

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: unknown, max = 0) {
  const text = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return max > 0 ? text.slice(0, max) : text;
}

function compactText(value: unknown, max = 300) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|#%&{}$!`'@+=]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 130);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function absolutizeUrl(value: string) {
  try {
    const url = new URL(value, BASE_URL);
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value, BASE_URL);
    url.hash = '';

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((param) => {
      url.searchParams.delete(param);
    });

    return url.toString();
  } catch {
    return value;
  }
}

function getRecruitId(url: string) {
  return url.match(/\/recruit\/view\/(\d+)/i)?.[1] || '';
}

function buildListPageUrl(regionUrl: string, pageNo: number) {
  const url = new URL(regionUrl, BASE_URL);
  url.hash = '';

  if (pageNo > 1) {
    url.searchParams.set('keyword', url.searchParams.get('keyword') || '');
    url.searchParams.set('page', String(pageNo));
  } else {
    url.searchParams.delete('page');
  }

  return url.toString();
}

function normalizePhone(value: string) {
  const phone = value.match(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0] || '';
  return phone.replace(/\D/g, '');
}

function extractAllPhones(text: string) {
  return unique(
    Array.from(text.matchAll(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/g))
      .map((match) => match[0].replace(/\D/g, ''))
      .filter(Boolean),
  );
}

function parseKoreanDate(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ');

  const iso = normalized.match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const short = normalized.match(/(?:^|\D)(\d{2})[-./](\d{1,2})[-./](\d{1,2})(?:\D|$)/);
  if (short) return `20${short[1]}-${short[2].padStart(2, '0')}-${short[3].padStart(2, '0')}`;

  const koreanShort = normalized.match(/(?:^|\D)(\d{1,2})[.월\s]+(\d{1,2})[.일\s]/);
  if (koreanShort) {
    const year = new Date().getFullYear();
    return `${year}-${koreanShort[1].padStart(2, '0')}-${koreanShort[2].padStart(2, '0')}`;
  }

  return null;
}

function pickLineAfterLabel(lines: string[], labels: string[]) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const matchedLabel = labels.find((label) => line.includes(label));
    if (!matchedLabel) continue;

    const inline = line
      .replace(new RegExp(`^.*?${matchedLabel}[:：]?\\s*`), '')
      .replace(/^[-|·•:\s]+/, '')
      .trim();

    if (inline && inline !== matchedLabel && inline.length >= 2) return inline;

    const next = lines[i + 1]?.trim();
    if (next) return next;
  }

  return '';
}

function findLines(text: string, keywords: string[], limit = 8) {
  return text
    .split('\n')
    .map((line) => compactText(line, 500))
    .filter((line) => line && keywords.some((keyword) => line.includes(keyword)))
    .slice(0, limit);
}

function cleanSiteName(value: string) {
  return compactText(value, 180)
    .replace(/^[\[【][^\]】]+[\]】]\s*/, '')
    .replace(/\s+-\s+분양라인.*$/i, '')
    .replace(/^분양라인\s*/, '')
    .trim();
}

function inferManagerName(text: string, phone: string) {
  if (!phone) return '';

  const formatted = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
  const phoneDigits = phone.replace(/\D/g, '');
  const lines = text.split('\n').map((line) => compactText(line, 500)).filter(Boolean);

  for (const line of lines) {
    const lineDigits = line.replace(/\D/g, '');
    if (!line.includes(formatted) && !lineDigits.includes(phoneDigits)) continue;

    const candidate = line
      .replace(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/g, '')
      .replace(/연락처|전화|문의|담당자|핸드폰|휴대폰|본부장|팀장|팀원|실장|님|대표|부장|이사|:/g, ' ')
      .replace(/[|·•,，]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const nameMatch = candidate.match(/[가-힣]{2,4}/);
    if (nameMatch) return nameMatch[0];
  }

  return '';
}

function fallbackRegionTargets(): RegionTarget[] {
  const pairs: Array<[RegionName, string]> = [
    ['서울', '1'],
    ['경기남부', '2'],
    ['경기북부', '16'],
    ['인천', '3'],
    ['부산', '10'],
    ['울산', '14'],
    ['대구', '11'],
    ['경상도', '6'],
    ['대전', '13'],
    ['세종', '15'],
    ['충청도', '4'],
    ['광주', '12'],
    ['전라도', '5'],
    ['강원도', '7'],
    ['제주도', '8'],
  ];

  return pairs.map(([name, id]) => ({
    id,
    name,
    url: `${BASE_URL}/recruit/regional/${id}`,
    source: 'fallback-confirmed-region-map',
  }));
}

function isRegionName(value: string): value is RegionName {
  return (REGION_NAMES as readonly string[]).includes(value);
}

async function ensureDebugDir() {
  const dir = path.resolve(process.cwd(), 'debug-output');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function saveJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function saveText(filePath: string, value: string) {
  await fs.writeFile(filePath, value, 'utf8');
}

async function autoScroll(page: Page, rounds: number) {
  let previousHeight = 0;
  let stableCount = 0;

  for (let i = 0; i < rounds; i += 1) {
    const currentHeight = await page.evaluate(() => document.body?.scrollHeight || 0).catch(() => 0);

    await page.mouse.wheel(0, 1800).catch(() => undefined);
    await page.keyboard.press('PageDown').catch(() => undefined);
    await sleep(250);

    const nextHeight = await page.evaluate(() => document.body?.scrollHeight || 0).catch(() => 0);

    if (nextHeight === previousHeight || nextHeight === currentHeight) {
      stableCount += 1;
    } else {
      stableCount = 0;
    }

    previousHeight = nextHeight;

    if (stableCount >= 8) break;
  }

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
  await sleep(300);
}

async function extractRegionLinks(page: Page): Promise<RegionTarget[]> {
  const links = await page.locator('a').evaluateAll((anchors) => {
    const normalize = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();

    return anchors.map((anchor) => {
      const a = anchor as HTMLAnchorElement;
      return {
        text: normalize(a.textContent),
        href: a.href || a.getAttribute('href') || '',
      };
    });
  }).catch(() => [] as Array<{ text: string; href: string }>);

  const byName = new Map<string, RegionTarget>();

  for (const link of links) {
    const href = absolutizeUrl(link.href);
    const id = href.match(/\/recruit\/regional\/(\d+)/i)?.[1];
    if (!id) continue;

    const name = REGION_NAMES.find((regionName) => link.text.includes(regionName));
    if (!name) continue;

    if (!byName.has(name)) {
      byName.set(name, {
        id,
        name,
        url: `${BASE_URL}/recruit/regional/${id}`,
        source: 'page-region-anchor',
      });
    }
  }

  const targets = Array.from(byName.values());

  if (!targets.length) return fallbackRegionTargets();

  const ordered: RegionTarget[] = [];
  for (const name of REGION_NAMES) {
    const found = targets.find((item) => item.name === name);
    if (found) ordered.push(found);
  }

  return ordered.length ? ordered : fallbackRegionTargets();
}

async function detectDisplayedRegion(page: Page, fallbackName: string): Promise<DisplayedRegion> {
  const activeTexts = await page.locator('a, button, li, span, div').evaluateAll((nodes) => {
    const normalize = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();

    return nodes
      .map((node) => {
        const element = node as HTMLElement;
        const text = normalize(element.textContent);
        const className = String(element.getAttribute('class') || '');
        const ariaCurrent = String(element.getAttribute('aria-current') || '');
        const style = String(element.getAttribute('style') || '');
        return { text, className, ariaCurrent, style };
      })
      .filter((item) => item.text && item.text.length <= 30)
      .slice(0, 500);
  }).catch(() => [] as Array<{ text: string; className: string; ariaCurrent: string; style: string }>);

  for (const item of activeTexts) {
    const text = item.text.replace(/모든지역/g, '').trim();
    const found = REGION_NAMES.find((regionName) => text === regionName || text.includes(regionName));
    const marker = `${item.className} ${item.ariaCurrent} ${item.style}`;
    if (found && /active|selected|on|current|blue|#00|rgb\(0/i.test(marker)) {
      return {
        regionName: found,
        source: 'active-region-element',
        matchText: `${item.text} / ${marker}`,
      };
    }
  }

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const breadcrumbMatch = bodyText.match(/지역현장\s*>\s*([가-힣]+)/);
  if (breadcrumbMatch?.[1] && isRegionName(breadcrumbMatch[1])) {
    return {
      regionName: breadcrumbMatch[1],
      source: 'breadcrumb-text',
      matchText: breadcrumbMatch[0],
    };
  }

  return {
    regionName: fallbackName,
    source: 'fallback-list-region',
    matchText: fallbackName,
  };
}


function looksLikeRecruitObject(obj: Record<string, unknown>) {
  const keys = Object.keys(obj).map((key) => key.toLowerCase());
  const joinedValues = Object.values(obj)
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value))
    .join(' ');

  const hasRecruitText = /분양|아파트|오피스텔|상가|팀장|팀원|본부장|수수료|경력무관|일비|대행|현장|모집/.test(joinedValues);
  const hasTitleKey = keys.some((key) => /title|subject|name|site|field|headline|company|agency|content/.test(key));
  const hasIdKey = keys.some((key) => /^(idx|id|no|seq)$|recruit|wr_id|post|board/.test(key));

  return hasIdKey && (hasTitleKey || hasRecruitText);
}

function extractRecruitIdFromObject(obj: Record<string, unknown>) {
  const priorityKeys = [
    'idx',
    'recruit_idx',
    'recruitIdx',
    'recruit_id',
    'recruitId',
    'id',
    'wr_id',
    'wrId',
    'no',
    'seq',
    'post_id',
    'postId',
  ];

  for (const key of priorityKeys) {
    const value = obj[key];
    const match = String(value ?? '').match(/^\d{4,}$/);
    if (match) return match[0];
  }

  for (const [key, value] of Object.entries(obj)) {
    if (!/idx|id|no|seq|recruit|wr|post|board/i.test(key)) continue;
    const match = String(value ?? '').match(/\d{4,}/);
    if (match) return match[0];
  }

  return '';
}

function extractTitleFromObject(obj: Record<string, unknown>) {
  const priorityKeys = [
    'title',
    'subject',
    'site_name',
    'siteName',
    'name',
    'company_name',
    'companyName',
    'field_name',
    'fieldName',
  ];

  for (const key of priorityKeys) {
    const value = compactText(obj[key], 160);
    if (value && !/^\d+$/.test(value)) return value;
  }

  for (const value of Object.values(obj)) {
    const text = compactText(value, 160);
    if (/분양|아파트|오피스텔|상가|팀장|팀원|본부장|모집|수수료/.test(text)) return text;
  }

  return '';
}

function walkJsonForRecruitLinks(value: unknown, byUrl: Map<string, LinkItem>, depth = 0) {
  if (depth > 10 || value == null) return;

  if (Array.isArray(value)) {
    for (const child of value) walkJsonForRecruitLinks(child, byUrl, depth + 1);
    return;
  }

  if (typeof value === 'string') {
    const viewMatches = Array.from(value.matchAll(/\/recruit\/view\/(\d+)\/?[^\s"'<)]*/gi));
    for (const match of viewMatches) {
      const id = match[1];
      const url = normalizeSourceUrl(`${BASE_URL}/recruit/view/${id}/?previousActiveNaviId=regional`);
      if (!byUrl.has(url)) byUrl.set(url, { text: '', href: url });
    }
    return;
  }

  if (typeof value !== 'object') return;

  const obj = value as Record<string, unknown>;

  for (const [key, child] of Object.entries(obj)) {
    if (/url|href|link|path/i.test(key)) {
      const text = String(child ?? '');
      const match = text.match(/\/recruit\/view\/(\d+)/i);
      if (match) {
        const url = normalizeSourceUrl(text.startsWith('http') ? text : `${BASE_URL}${text.startsWith('/') ? '' : '/'}${text}`);
        if (!byUrl.has(url)) byUrl.set(url, { text: extractTitleFromObject(obj), href: url });
      }
    }
  }

  if (looksLikeRecruitObject(obj)) {
    const id = extractRecruitIdFromObject(obj);
    if (id) {
      const url = normalizeSourceUrl(`${BASE_URL}/recruit/view/${id}/?previousActiveNaviId=regional`);
      if (!byUrl.has(url)) byUrl.set(url, { text: extractTitleFromObject(obj), href: url });
    }
  }

  for (const child of Object.values(obj)) walkJsonForRecruitLinks(child, byUrl, depth + 1);
}

async function captureListJsonResponses(page: Page, bucket: JsonPayload[], jobs: Promise<void>[]) {
  const handler = (response: any) => {
    const url = String(response.url?.() || '');
    if (!url.includes('bunyangline.com')) return;

    const job = (async () => {
      const headers = response.headers?.() || {};
      const contentType = String(headers['content-type'] || '');
      const likelyData =
        contentType.includes('application/json') ||
        /api|ajax|list|recruit|regional|json|load|more|search/i.test(url);

      if (!likelyData) return;

      try {
        const text = await response.text();
        const trimmed = text.trim();
        if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
          bucket.push({
            url,
            status: response.status?.() || 0,
            contentType,
            value: null,
            textSample: compactText(text, 1000),
          });
          return;
        }

        bucket.push({
          url,
          status: response.status?.() || 0,
          contentType,
          value: JSON.parse(trimmed),
          textSample: compactText(text, 1000),
        });
      } catch (error: any) {
        bucket.push({
          url,
          status: response.status?.() || 0,
          contentType,
          value: null,
          textSample: `read failed: ${error?.message || String(error)}`,
        });
      }
    })();

    jobs.push(job);
  };

  page.on('response', handler);

  return () => {
    page.off('response', handler);
  };
}

async function extractViewLinks(page: Page, jsonPayloads: JsonPayload[] = []): Promise<LinkItem[]> {
  const anchorLinks = await page.locator('a').evaluateAll((anchors) => {
    const normalize = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();

    return anchors.map((anchor) => {
      const a = anchor as HTMLAnchorElement;
      const attrs = Array.from(a.attributes).map((attr) => `${attr.name}=${attr.value}`).join(' ');
      return {
        text: normalize(a.textContent),
        href: a.href || a.getAttribute('href') || '',
        attrs,
      };
    });
  }).catch(() => [] as Array<{ text: string; href: string; attrs: string }>);

  const html = await page.content().catch(() => '');
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const byUrl = new Map<string, LinkItem>();

  const pushId = (id: string, text = '') => {
    if (!/^\d{4,}$/.test(id)) return;
    const url = normalizeSourceUrl(`${BASE_URL}/recruit/view/${id}/?previousActiveNaviId=regional`);
    if (!byUrl.has(url)) byUrl.set(url, { text: compactText(text, 160), href: url });
  };

  const pushHref = (href: string, text = '') => {
    if (!href) return;
    const match = href.match(/\/recruit\/view\/(\d+)/i);
    if (match) {
      pushId(match[1], text);
      return;
    }

    const full = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
    const fullMatch = full.match(/\/recruit\/view\/(\d+)/i);
    if (fullMatch) pushId(fullMatch[1], text);
  };

  for (const link of anchorLinks) {
    pushHref(link.href, link.text);
    pushHref(link.attrs, link.text);
  }

  const htmlPatterns = [
    /\/recruit\/view\/(\d+)\/?[^\s"'<)]*/gi,
    /recruit\/view\/(\d+)/gi,
    /["']idx["']\s*:\s*["']?(\d{4,})["']?/gi,
    /\bidx\s*[:=]\s*["']?(\d{4,})["']?/gi,
    /["']recruit[_-]?idx["']\s*:\s*["']?(\d{4,})["']?/gi,
    /["']recruit[_-]?id["']\s*:\s*["']?(\d{4,})["']?/gi,
  ];

  for (const pattern of htmlPatterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1];
      const offset = Math.max(0, (match.index || 0) - 250);
      const context = html.slice(offset, (match.index || 0) + 250);
      if (/recruit|분양|아파트|오피스텔|상가|팀장|팀원|본부장|모집|title|subject|name|현장/i.test(context)) {
        pushId(id, compactText(context.replace(/<[^>]+>/g, ' '), 160));
      }
    }
  }

  for (const payload of jsonPayloads) {
    if (payload.value !== null) {
      walkJsonForRecruitLinks(payload.value, byUrl);
      continue;
    }

    for (const match of payload.textSample.matchAll(/\/recruit\/view\/(\d+)/gi)) {
      pushId(match[1]);
    }
  }

  if (!byUrl.size) {
    console.log(`[링크진단] DOM/HTML/JSON에서 /recruit/view 후보 0건`);
    console.log(`[링크진단] JSON/API 후보 응답 ${jsonPayloads.length}건`);
    jsonPayloads.slice(0, 5).forEach((payload, index) => {
      console.log(`  JSON ${index + 1}. status=${payload.status} url=${payload.url}`);
      console.log(`  sample=${compactText(JSON.stringify(payload.value ?? payload.textSample), 500)}`);
    });
    console.log(`[링크진단] body sample=${compactText(bodyText, 700)}`);
  }

  return Array.from(byUrl.values());
}

async function parseDetailPage(page: Page, detailUrl: string, region: RegionTarget, actualRegion: DisplayedRegion): Promise<RecruitItem> {
  const response = await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((error) => {
    console.log(`[${region.name}] 상세 접속 실패: ${detailUrl} / ${error?.message || String(error)}`);
    return null;
  });

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await sleep(800);

  const state = await page.evaluate(() => {
    const normalize = (value: string | null | undefined) => String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

    return {
      title: normalize(document.title),
      h1: normalize(document.querySelector('h1')?.textContent),
      h2: normalize(document.querySelector('h2')?.textContent),
      h3: normalize(document.querySelector('h3')?.textContent),
      metaDescription: normalize(metaDescription),
      ogTitle: normalize(ogTitle),
      ogDescription: normalize(ogDescription),
      bodyText: normalize(document.body?.innerText || ''),
    };
  });

  const sourceUrl = normalizeSourceUrl(response?.url() || detailUrl);
  const bodyText = normalizeText([state.ogTitle, state.ogDescription, state.metaDescription, state.bodyText].filter(Boolean).join('\n'));
  const lines = bodyText.split('\n').map((line) => compactText(line, 600)).filter(Boolean);
  const phones = extractAllPhones(bodyText);
  const managerPhone = phones[0] || '';

  const titleCandidates = [
    state.h1,
    state.h2,
    state.h3,
    state.ogTitle,
    state.title,
    lines.find((line) => /분양|아파트|오피스텔|생활형|상가|모집|채용|팀장|팀원|본부장|수수료/.test(line)) || '',
  ];

  const siteName = cleanSiteName(titleCandidates.find((item) => compactText(item, 10)) || `분양라인 공고 ${getRecruitId(sourceUrl)}`);

  const siteAddress = pickLineAfterLabel(lines, ['현장주소', '현장 주소', '주소', '위치', '근무지', '현장위치']);
  const managerName = pickLineAfterLabel(lines, ['담당자명', '담당자', '문의', '연락 담당']) || inferManagerName(bodyText, managerPhone);
  const agencyCompany = pickLineAfterLabel(lines, ['대행사', '분양대행사', '시행사', '시공사', '소속회사', '회사명', '대행']);
  const feeLines = findLines(bodyText, ['수수료', '급여', '계약금', '지원', '만원', '%', '월급', '일비', '경력무관', '팀장', '팀원'], 12);
  const apartmentFee = feeLines.join(' / ');
  const postedAt = parseKoreanDate(pickLineAfterLabel(lines, ['등록일', '작성일', '게시일']) || bodyText);

  return {
    source_url: sourceUrl,
    source_post_key: getRecruitId(sourceUrl) || sourceUrl,
    region_id: region.id,
    region_name: actualRegion.regionName,
    list_region_name: region.name,
    actual_region_name: actualRegion.regionName,
    actual_region_source: actualRegion.source,
    region_match_text: actualRegion.matchText,
    site_name: siteName,
    site_address: siteAddress,
    posted_at: postedAt,
    posted_datetime: null,
    manager_name: managerName,
    manager_phone: managerPhone,
    agency_company: agencyCompany,
    apartment_fee: apartmentFee,
    detail_text: bodyText.slice(0, 6000),
    raw_text: bodyText.slice(0, 12000),
    crawled_at: new Date().toISOString(),
  };
}

async function sendToCrm(rows: RecruitItem[]) {
  const importUrl = env('CRM_BUNYANGLINE_IMPORT_URL');
  const secret = env('BUNYANGLINE_IMPORT_SECRET');

  if (!importUrl || !secret) {
    console.log(`[CRM저장] 환경변수 없음 - 저장 생략 / CRM_BUNYANGLINE_IMPORT_URL=${importUrl ? '있음' : '없음'} / BUNYANGLINE_IMPORT_SECRET=${secret ? '있음' : '없음'}`);
    return { ok: false, skipped: true, message: 'CRM import env missing' };
  }

  if (!rows.length) {
    return { ok: true, skipped: true, message: '저장할 rows 없음' };
  }

  const response = await fetch(importUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-import-secret': secret,
    },
    body: JSON.stringify({ rows }),
  });

  const text = await response.text();
  let json: unknown = text;

  try {
    json = JSON.parse(text);
  } catch {
    // keep original text
  }

  if (!response.ok) {
    throw new Error(`[CRM저장실패] status=${response.status} body=${compactText(text, 1200)}`);
  }

  console.log(`[CRM저장] ${rows.length}건 전송 완료 / status=${response.status}`);
  console.log(`[CRM저장] 응답: ${compactText(JSON.stringify(json), 1200)}`);
  return json;
}

async function main() {
  const regionArg = env('BUNYANGLINE_REGION_IDS', 'all');
  const maxPages = Math.max(1, Number(env('BUNYANGLINE_MAX_PAGES', '1')) || 1);
  const scrollRounds = Math.max(5, Number(env('BUNYANGLINE_SCROLL_ROUNDS', '120')) || 120);
  const headless = env('HEADLESS', 'true') !== 'false';
  const sendToCrmEnabled = env('BUNYANGLINE_SEND_TO_CRM', 'true') !== 'false';
  const batchSize = Math.max(10, Number(env('BUNYANGLINE_IMPORT_BATCH_SIZE', '50')) || 50);
  const debugDir = await ensureDebugDir();

  console.log('분양라인 상세페이지 기준 크롤러를 시작합니다.');
  console.log('- 수집 기준: /recruit/view/{공고ID} 상세페이지');
  console.log('- 중복 기준: source_url 단독');
  console.log('- 지역 기준: 지역 탭 링크 자동 발견 + 실제 표시 지역 보정');
  console.log(`- regionArg: ${regionArg}`);
  console.log(`- maxPages: ${maxPages}`);
  console.log(`- scrollRounds: ${scrollRounds}`);
  console.log(`- headless: ${headless}`);
  console.log(`- sendToCrm: ${sendToCrmEnabled}`);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  const listPage = await context.newPage();
  const detailPage = await context.newPage();

  try {
    await listPage.goto(`${BASE_URL}/recruit/regional/1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await listPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    await sleep(1000);

    let regionTargets = await extractRegionLinks(listPage);

    if (regionArg !== 'all') {
      const requested = regionArg.split(',').map((item) => item.trim()).filter(Boolean);
      regionTargets = regionTargets.filter((region) => requested.includes(region.id) || requested.includes(region.name));
    }

    if (!regionTargets.length) {
      throw new Error(`수집할 지역이 없습니다. BUNYANGLINE_REGION_IDS=${regionArg}`);
    }

    await saveJson(path.join(debugDir, 'discovered-regions.json'), regionTargets);
    console.log(`[지역발견] ${regionTargets.map((region) => `${region.name}(${region.id})`).join(', ')}`);

    const allRows: RecruitItem[] = [];
    const seenUrls = new Set<string>();
    const regionSummaries: Array<Record<string, unknown>> = [];

    for (const region of regionTargets) {
      const regionRows: RecruitItem[] = [];
      let lastViewLinks: LinkItem[] = [];

      for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
        const pageUrl = buildListPageUrl(region.url, pageNo);
        console.log('');
        console.log('='.repeat(90));
        console.log(`[${region.name}] 목록 접속: ${pageUrl}`);

        const jsonPayloads: JsonPayload[] = [];
        const jsonJobs: Promise<void>[] = [];
        const detachJsonCapture = await captureListJsonResponses(listPage, jsonPayloads, jsonJobs);

        await listPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((error) => {
          console.log(`[${region.name}] 목록 접속 실패: ${error?.message || String(error)}`);
        });
        await listPage.waitForLoadState('networkidle', { timeout: 18000 }).catch(() => undefined);
        await sleep(1800);

        const actualRegion = await detectDisplayedRegion(listPage, region.name);
        console.log(`[${region.name}] 실제 표시 지역: ${actualRegion.regionName} / source=${actualRegion.source}`);

        await Promise.allSettled(jsonJobs);
        const initialLinks = await extractViewLinks(listPage, jsonPayloads);
        console.log(`[${region.name}] 초기 상세공고 후보: ${initialLinks.length}건 / JSON/API=${jsonPayloads.length}건`);

        await autoScroll(listPage, scrollRounds);
        await listPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
        await sleep(1200);
        await Promise.allSettled(jsonJobs);
        detachJsonCapture();

        const viewLinks = await extractViewLinks(listPage, jsonPayloads);
        lastViewLinks = viewLinks;

        console.log(`[${region.name}] 스크롤 후 상세공고 후보: ${viewLinks.length}건 / JSON/API=${jsonPayloads.length}건`);

        const debugPrefix = `${safeFileName(region.name)}_page_${pageNo}`;
        await saveJson(path.join(debugDir, `${debugPrefix}_view_links.json`), viewLinks);
        await saveJson(path.join(debugDir, `${debugPrefix}_json_payloads_summary.json`), jsonPayloads.map((payload) => ({
          url: payload.url,
          status: payload.status,
          contentType: payload.contentType,
          sample: compactText(JSON.stringify(payload.value ?? payload.textSample), 1200),
        })));
        await saveText(path.join(debugDir, `${debugPrefix}_body.txt`), await listPage.locator('body').innerText().catch(() => ''));
        await saveText(path.join(debugDir, `${debugPrefix}_html_sample.txt`), (await listPage.content().catch(() => '')).slice(0, 120000));
        await listPage.screenshot({ path: path.join(debugDir, `${debugPrefix}_screenshot.png`), fullPage: true }).catch(() => undefined);

        for (let i = 0; i < viewLinks.length; i += 1) {
          const link = viewLinks[i];
          const sourceUrl = normalizeSourceUrl(link.href);

          if (seenUrls.has(sourceUrl)) continue;
          seenUrls.add(sourceUrl);

          console.log(`[${region.name}] 상세 파싱 ${i + 1}/${viewLinks.length}: ${sourceUrl}`);

          try {
            const item = await parseDetailPage(detailPage, sourceUrl, region, actualRegion);
            regionRows.push(item);
            allRows.push(item);

            if (sendToCrmEnabled && regionRows.length % batchSize === 0) {
              const batch = regionRows.slice(regionRows.length - batchSize);
              await sendToCrm(batch);
            }
          } catch (error: any) {
            console.log(`[${region.name}] 상세 파싱 실패: ${sourceUrl} / ${error?.message || String(error)}`);
          }
        }
      }

      if (sendToCrmEnabled && regionRows.length % batchSize !== 0) {
        const remain = regionRows.slice(Math.floor(regionRows.length / batchSize) * batchSize);
        if (remain.length) await sendToCrm(remain);
      }

      regionSummaries.push({
        region: region.name,
        regionId: region.id,
        regionUrl: region.url,
        viewLinkCount: lastViewLinks.length,
        parsedCount: regionRows.length,
      });

      await saveJson(path.join(debugDir, `${safeFileName(region.name)}_rows.json`), regionRows);
      console.log(`[${region.name}] 완료: 상세후보 ${lastViewLinks.length}건 / 파싱 ${regionRows.length}건`);
    }

    await saveJson(path.join(debugDir, 'summary.json'), {
      collectedAt: new Date().toISOString(),
      total: allRows.length,
      regionSummaries,
    });
    await saveJson(path.join(debugDir, 'all_rows.json'), allRows);

    console.log('');
    console.log('='.repeat(90));
    console.log(`[완료] 전체 상세 파싱: ${allRows.length}건`);
    console.log('[완료] debug-output의 summary.json / all_rows.json / 지역별 rows 파일을 확인하세요.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[치명적 오류]', error);
  process.exit(1);
});
