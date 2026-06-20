import { chromium, Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.bunyangline.com';
const DEBUG_DIR = path.resolve(process.cwd(), 'debug-output');
const IMPORT_BATCH_SIZE = 80;
const MAX_DETAIL_TEXT_LENGTH = 7000;
const MAX_RAW_TEXT_LENGTH = 16000;

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
  source: 'discovered-link' | 'fallback';
};

type RegionDetection = {
  actualRegionName: string;
  source: string;
  matchText: string;
};

type DetailTarget = {
  url: string;
  listPreviewText: string | null;
  source: 'anchor' | 'html-regex';
};

type CrawledRow = {
  source_url: string;
  source_post_key: string;
  region_id: string | null;
  region_name: string;
  list_region_name: string;
  actual_region_name: string;
  actual_region_source: string;
  region_match_text: string;
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

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSpace(value: unknown) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compact(value: unknown, max = 800) {
  const text = normalizeSpace(value);
  if (!text) return null;
  return text.slice(0, max).trim() || null;
}

function limitText(value: unknown, max: number) {
  const text = normalizeSpace(value);
  if (!text) return null;
  return text.slice(0, max).trim() || null;
}

function isRegionName(value: string): value is RegionName {
  return (REGION_NAMES as readonly string[]).includes(value);
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|#%&{}$!`'@+=]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 140);
}

function buildAbsoluteUrl(value: string) {
  return new URL(value, BASE_URL).toString();
}

function normalizeSourceUrl(value: string) {
  const url = new URL(value, BASE_URL);
  url.hash = '';

  const removableParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  removableParams.forEach((param) => url.searchParams.delete(param));

  return url.toString();
}

function buildListUrl(region: RegionTarget, pageNo: number) {
  const url = new URL(region.url, BASE_URL);
  url.hash = '';

  if (pageNo > 1) {
    url.searchParams.set('page', String(pageNo));
  } else {
    url.searchParams.delete('page');
    url.searchParams.delete('keyword');
  }

  return url.toString();
}

function sourceKey(url: string) {
  const parsed = new URL(url, BASE_URL);
  const idMatch = parsed.pathname.match(/\/recruit\/view\/(\d+)/i);
  if (idMatch?.[1]) return `bunyangline_view_${idMatch[1]}`;

  const pathname = parsed.pathname.replace(/\/$/, '');
  const keySource = `${pathname}${parsed.search}` || url;
  let hash = 0;
  for (let i = 0; i < keySource.length; i += 1) {
    hash = (hash << 5) - hash + keySource.charCodeAt(i);
    hash |= 0;
  }
  return `bunyangline_${Math.abs(hash)}`;
}

function normalizePhone(value: unknown) {
  const text = normalizeSpace(value);
  const candidates = Array.from(
    text.matchAll(/(?:\+?82[-\s.]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|(?:0\d{1,2})[-\s.]?\d{3,4}[-\s.]?\d{4}/g)
  ).map((match) => match[0]);

  const raw = candidates[0] || text;
  const digits = raw.replace(/\D/g, '');

  if (!digits) return null;
  if (digits.startsWith('82') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function normalizeDate(value: unknown) {
  const text = normalizeSpace(value);
  if (!text) return null;

  const iso = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const korean = text.match(/(20\d{2})[.\/년\s-]+(\d{1,2})[.\/월\s-]+(\d{1,2})/);
  if (korean) return `${korean[1]}-${korean[2].padStart(2, '0')}-${korean[3].padStart(2, '0')}`;

  const short = text.match(/(?:^|\D)(\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})(?:\D|$)/);
  if (short) return `20${short[1]}-${short[2].padStart(2, '0')}-${short[3].padStart(2, '0')}`;

  const monthDay = text.match(/(?:^|\D)(\d{1,2})[.\/월\s-]+(\d{1,2})(?:일)?(?:\D|$)/);
  if (monthDay) {
    const year = new Date().getFullYear();
    return `${year}-${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`;
  }

  return null;
}

function normalizeDateTime(value: unknown) {
  const text = normalizeSpace(value);
  const date = normalizeDate(text);
  if (!date) return null;

  const timeMatch = text.match(/(\d{1,2})[:시](\d{1,2})(?:[:분](\d{1,2}))?/);
  const time = timeMatch
    ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}:${(timeMatch[3] || '00').padStart(2, '0')}`
    : '00:00:00';

  return `${date}T${time}+09:00`;
}

function pickAfterLabel(text: string, labels: string[], max = 180) {
  const normalized = normalizeSpace(text);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const label of labels) {
    const inline = new RegExp(`${label}\\s*[:：]\\s*([^\\n]{1,${max}})`, 'i').exec(normalized);
    if (inline?.[1]) return inline[1].trim();

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lineWithoutSpaces = line.replace(/\s/g, '');
      const labelWithoutSpaces = label.replace(/\s/g, '');

      if (line === label || lineWithoutSpaces === labelWithoutSpaces) {
        const next = lines[i + 1];
        if (next) return next.slice(0, max).trim();
      }

      if (line.startsWith(label) || lineWithoutSpaces.startsWith(labelWithoutSpaces)) {
        const value = line
          .replace(new RegExp(`^${label}\\s*[:：-]?\\s*`, 'i'), '')
          .replace(new RegExp(`^${labelWithoutSpaces}\\s*[:：-]?\\s*`, 'i'), '')
          .trim();
        if (value && value !== line) return value.slice(0, max);
      }
    }
  }

  return null;
}

function extractSection(text: string, labels: string[], maxLines = 35) {
  const lines = normalizeSpace(text).split('\n').map((line) => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    if (!labels.some((label) => lines[i].includes(label))) continue;
    return lines.slice(i, i + maxLines).join('\n');
  }

  return lines.slice(0, Math.min(lines.length, maxLines)).join('\n');
}

function extractApartmentFee(text: string) {
  const normalized = normalizeSpace(text);
  const labelValue = pickAfterLabel(normalized, ['계약 수수료', '계약수수료', '수수료', '분양수수료', '지급수수료', '수당', '급여', '일비', '조건'], 160);
  if (labelValue) return labelValue;

  const match = normalized.match(/(?:계약\s*수수료|수수료|수당|급여|일비|조건)[^\n]{0,90}/);
  return match?.[0] ?? null;
}

function cleanTitle(text: string) {
  return normalizeSpace(text)
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/\s*[-|｜>].*분양라인.*$/g, '')
    .replace(/분양라인/g, '')
    .trim();
}

async function getFirstText(page: Page, selectors: string[], timeout = 900) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    const text = normalizeSpace(await locator.innerText({ timeout }).catch(() => ''));
    if (text) return text;
  }
  return null;
}

async function getMetaContent(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    const value = normalizeSpace(await locator.getAttribute('content').catch(() => ''));
    if (value) return value;
  }
  return null;
}

async function extractProjectName(page: Page, text: string, pageTitle: string) {
  const labelValue = pickAfterLabel(text, ['현장명', '현장 이름', '사업지명', '프로젝트명', '단지명', '제목'], 180);
  if (labelValue) return labelValue;

  const heading = await getFirstText(page, ['h1', 'h2', 'h3', '.title', '.subject', '.view-title', '.recruit-title', '.board-title']);
  if (heading && !/분양라인|지역현장|HOME|로그인|회원가입/.test(heading)) return heading;

  const ogTitle = await getMetaContent(page, ['meta[property="og:title"]', 'meta[name="title"]']);
  if (ogTitle && !/분양라인|지역현장|HOME|로그인|회원가입/.test(ogTitle)) return cleanTitle(ogTitle);

  const title = cleanTitle(pageTitle);
  if (title && !/지역현장|구인|로그인|회원|분양라인/.test(title)) return title;

  const lines = normalizeSpace(text).split('\n').map((line) => line.trim()).filter(Boolean);
  const candidate = lines.find((line) => {
    if (line.length < 3 || line.length > 90) return false;
    if (/HOME|지역현장|맞춤현장|지도현장|관심현장|서포터즈|로그인|회원가입|공지사항|고객센터|상품안내/.test(line)) return false;
    if (REGION_NAMES.includes(line as RegionName)) return false;
    return /분양|아파트|오피스텔|상가|모집|현장|파격|팀장|팀원|수수료|입주|조건|프리미엄|센트럴|더|시티|파크|힐|자이|래미안|푸르지오|롯데|데시앙/i.test(line);
  });

  return candidate ?? null;
}

function extractRegionFromAddress(text: string): string | null {
  const value = normalizeSpace(text);
  if (!value) return null;

  if (/서울|강남|서초|송파|강동|마포|용산|성동|광진|동대문|중랑|성북|강북|도봉|노원|은평|서대문|양천|구로|금천|영등포|동작|관악/.test(value)) return '서울';
  if (/인천|검단|청라|송도|부평|계양|남동|미추홀|연수|서구|강화|옹진/.test(value)) return '인천';
  if (/부산|해운대|수영|동래|기장|사하|사상|부산진|연제|금정/.test(value)) return '부산';
  if (/울산|울주/.test(value)) return '울산';
  if (/대구|수성|달서|달성/.test(value)) return '대구';
  if (/대전|유성|대덕/.test(value)) return '대전';
  if (/세종/.test(value)) return '세종';
  if (/광주|광산/.test(value)) return '광주';
  if (/제주|서귀포/.test(value)) return '제주도';
  if (/강원|춘천|원주|강릉|동해|속초|삼척|홍천|횡성|평창|정선|철원|화천|양구|인제|고성|양양/.test(value)) return '강원도';
  if (/충북|충남|청주|충주|제천|천안|아산|공주|보령|서산|논산|계룡|당진|증평|진천|괴산|음성|단양|금산|부여|서천|청양|홍성|예산|태안/.test(value)) return '충청도';
  if (/전북|전남|전주|군산|익산|정읍|남원|김제|목포|여수|순천|나주|광양|담양|곡성|구례|고흥|보성|화순|장흥|강진|해남|영암|무안|함평|영광|장성|완도|진도|신안/.test(value)) return '전라도';
  if (/경북|경남|포항|경주|김천|안동|구미|영주|영천|상주|문경|경산|창원|진주|통영|사천|김해|밀양|거제|양산|의령|함안|창녕|고성|남해|하동|산청|함양|거창|합천/.test(value)) return '경상도';
  if (/고양|파주|의정부|양주|동두천|구리|남양주|포천|가평|연천/.test(value)) return '경기북부';
  if (/수원|성남|용인|화성|평택|안산|안양|부천|광명|시흥|군포|의왕|과천|하남|광주|이천|여주|안성|오산|김포/.test(value)) return '경기남부';
  if (/경기|경기도/.test(value)) return '경기남부';

  return null;
}

function extractManagerName(text: string, phone: string | null) {
  const labelValue = pickAfterLabel(text, ['담당자 이름', '담당자이름', '담당자명', '담당자', '연락 담당자', '본부장', '팀장'], 120);
  if (labelValue) {
    const cleaned = labelValue
      .replace(/(?:\+?82[-\s.]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, '')
      .replace(/연락처|휴대폰|전화번호|문의|상담/g, '')
      .trim();
    if (cleaned && cleaned.length <= 30) return cleaned;
  }

  if (phone) {
    const rawPhonePattern = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1[-\\s.]?$2[-\\s.]?$3');
    const nearPhone = new RegExp(`([가-힣]{2,5})\\s*(?:대표|본부장|팀장|실장|부장|차장|과장|대리|담당자)?\\s*${rawPhonePattern}`).exec(text);
    if (nearPhone?.[1]) return nearPhone[1];
  }

  const rolePattern = /([가-힣]{2,5})\s*(대표|본부장|팀장|실장|부장|차장|과장|대리|담당자)/.exec(text);
  if (rolePattern?.[0]) return rolePattern[0];

  return null;
}

async function ensureDebugDir() {
  await fs.mkdir(DEBUG_DIR, { recursive: true });
}

async function saveJson(fileName: string, value: unknown) {
  await ensureDebugDir();
  await fs.writeFile(path.join(DEBUG_DIR, fileName), JSON.stringify(value, null, 2), 'utf8');
}

async function saveText(fileName: string, value: string) {
  await ensureDebugDir();
  await fs.writeFile(path.join(DEBUG_DIR, fileName), value, 'utf8');
}

async function getAnchorSnapshots(page: Page) {
  const anchors = page.locator('a');
  const count = await anchors.count().catch(() => 0);
  const items: Array<{ text: string; href: string; className: string; ariaCurrent: string }> = [];

  for (let i = 0; i < count; i += 1) {
    const anchor = anchors.nth(i);
    const text = normalizeSpace(await anchor.innerText({ timeout: 1000 }).catch(() => ''));
    const href = normalizeSpace(await anchor.getAttribute('href').catch(() => ''));
    const className = normalizeSpace(await anchor.getAttribute('class').catch(() => ''));
    const ariaCurrent = normalizeSpace(await anchor.getAttribute('aria-current').catch(() => ''));

    if (!href && !text) continue;
    items.push({ text, href, className, ariaCurrent });
  }

  return items;
}

async function clickPossibleMoreButtons(page: Page) {
  const labels = ['더보기', 'MORE', 'more', '다음', 'Next'];
  let clicked = false;

  for (const label of labels) {
    const locator = page.getByText(label, { exact: false }).first();
    const count = await locator.count().catch(() => 0);
    if (!count) continue;

    const visible = await locator.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) continue;

    await locator.click({ timeout: 1500 }).catch(() => null);
    clicked = true;
    await sleep(1000);
  }

  return clicked;
}

async function scrollListPage(page: Page, rounds: number) {
  let previousViewCount = 0;
  let stableRounds = 0;

  for (let i = 0; i < rounds; i += 1) {
    const htmlBefore = await page.content().catch(() => '');
    previousViewCount = (htmlBefore.match(/\/recruit\/view\//g) || []).length;

    await page.keyboard.press('End').catch(() => null);
    await page.mouse.wheel(0, 2600).catch(() => null);
    await clickPossibleMoreButtons(page);
    await sleep(1200);

    const htmlAfter = await page.content().catch(() => '');
    const nextViewCount = (htmlAfter.match(/\/recruit\/view\//g) || []).length;

    if (nextViewCount <= previousViewCount) stableRounds += 1;
    else stableRounds = 0;

    if (stableRounds >= 3) break;
  }
}

async function discoverRegions(page: Page): Promise<RegionTarget[]> {
  const seedUrl = `${BASE_URL}/recruit/regional/1`;
  await page.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await sleep(1200);

  const anchors = await getAnchorSnapshots(page);
  const byName = new Map<string, RegionTarget>();

  for (const anchor of anchors) {
    const idMatch = anchor.href.match(/\/recruit\/regional\/(\d+)/);
    if (!idMatch?.[1]) continue;
    if (!isRegionName(anchor.text)) continue;
    if (byName.has(anchor.text)) continue;

    byName.set(anchor.text, {
      id: idMatch[1],
      name: anchor.text,
      url: buildAbsoluteUrl(anchor.href),
      source: 'discovered-link',
    });
  }

  const regions = Array.from(byName.values());

  if (regions.length === 0) {
    const fallback: RegionTarget[] = [
      { id: '1', name: '서울', url: `${BASE_URL}/recruit/regional/1`, source: 'fallback' },
      { id: '2', name: '경기남부', url: `${BASE_URL}/recruit/regional/2`, source: 'fallback' },
      { id: '9', name: '경기북부', url: `${BASE_URL}/recruit/regional/9`, source: 'fallback' },
      { id: '3', name: '인천', url: `${BASE_URL}/recruit/regional/3`, source: 'fallback' },
      { id: '10', name: '부산', url: `${BASE_URL}/recruit/regional/10`, source: 'fallback' },
      { id: '14', name: '울산', url: `${BASE_URL}/recruit/regional/14`, source: 'fallback' },
      { id: '11', name: '대구', url: `${BASE_URL}/recruit/regional/11`, source: 'fallback' },
      { id: '6', name: '경상도', url: `${BASE_URL}/recruit/regional/6`, source: 'fallback' },
      { id: '13', name: '대전', url: `${BASE_URL}/recruit/regional/13`, source: 'fallback' },
      { id: '15', name: '세종', url: `${BASE_URL}/recruit/regional/15`, source: 'fallback' },
      { id: '4', name: '충청도', url: `${BASE_URL}/recruit/regional/4`, source: 'fallback' },
      { id: '12', name: '광주', url: `${BASE_URL}/recruit/regional/12`, source: 'fallback' },
      { id: '5', name: '전라도', url: `${BASE_URL}/recruit/regional/5`, source: 'fallback' },
      { id: '7', name: '강원도', url: `${BASE_URL}/recruit/regional/7`, source: 'fallback' },
      { id: '8', name: '제주도', url: `${BASE_URL}/recruit/regional/8`, source: 'fallback' },
    ];

    console.log('분양라인 지역 링크 자동 발견 실패 → 확인된 fallback 매핑 사용');
    await saveJson('discovered-regions.json', fallback);
    return fallback;
  }

  console.log('분양라인 실제 지역 링크 발견:');
  for (const region of regions) {
    console.log(`- ${region.name}: regional/${region.id}`);
  }

  await saveJson('discovered-regions.json', regions);
  return regions;
}

function filterRegions(regions: RegionTarget[], regionArg: string) {
  const value = regionArg.trim();
  if (!value || value === 'all') return regions;

  const tokens = value.split(',').map((token) => token.trim()).filter(Boolean);
  const selected = regions.filter((region) => tokens.includes(region.id) || tokens.includes(region.name));

  if (selected.length === 0) {
    throw new Error(`BUNYANGLINE_REGION_IDS=${value} 조건에 맞는 지역이 없습니다. 사용 가능: ${regions.map((r) => `${r.name}(${r.id})`).join(', ')}`);
  }

  return selected;
}

async function detectActualRegion(page: Page, fallback: RegionTarget): Promise<RegionDetection> {
  const anchors = await getAnchorSnapshots(page);
  const currentUrl = new URL(page.url() || fallback.url, BASE_URL);
  const currentPath = currentUrl.pathname.replace(/\/$/, '');

  for (const anchor of anchors) {
    if (!isRegionName(anchor.text)) continue;

    try {
      const anchorPath = new URL(anchor.href, BASE_URL).pathname.replace(/\/$/, '');
      if (anchorPath === currentPath) {
        return {
          actualRegionName: anchor.text,
          source: 'current-url-anchor',
          matchText: buildAbsoluteUrl(anchor.href),
        };
      }
    } catch {
      // ignore malformed href
    }
  }

  for (const anchor of anchors) {
    if (!isRegionName(anchor.text)) continue;
    if (/(active|on|selected|current)/i.test(`${anchor.className} ${anchor.ariaCurrent}`)) {
      return {
        actualRegionName: anchor.text,
        source: 'active-anchor',
        matchText: anchor.href || anchor.className,
      };
    }
  }

  const bodyText = normalizeSpace(await page.locator('body').innerText({ timeout: 5000 }).catch(() => ''));
  for (const name of REGION_NAMES) {
    if (new RegExp(`지역현장\\s*[>›]\\s*${name}`).test(bodyText)) {
      return {
        actualRegionName: name,
        source: 'breadcrumb',
        matchText: `지역현장 > ${name}`,
      };
    }
  }

  return {
    actualRegionName: fallback.name,
    source: fallback.source,
    matchText: `${fallback.url}`,
  };
}

function extractViewUrlsFromHtml(html: string): DetailTarget[] {
  const decoded = html
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/')
    .replace(/%2F/gi, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

  const patterns = [
    /https?:\/\/www\.bunyangline\.com\/recruit\/view\/\d+\/?(?:\?[^"'<>\s)]*)?/gi,
    /\/recruit\/view\/\d+\/?(?:\?[^"'<>\s)]*)?/gi,
  ];

  const urls = new Set<string>();

  for (const pattern of patterns) {
    const matches = decoded.matchAll(pattern);
    for (const match of matches) {
      const raw = match[0]
        .replace(/["'<>)]*$/g, '')
        .replace(/amp;/g, '')
        .trim();
      if (!raw) continue;
      urls.add(normalizeSourceUrl(buildAbsoluteUrl(raw)));
    }
  }

  return Array.from(urls).map((url) => ({
    url,
    listPreviewText: null,
    source: 'html-regex' as const,
  }));
}

async function collectDetailUrls(page: Page) {
  const result = new Map<string, DetailTarget>();
  const anchors = await getAnchorSnapshots(page);

  for (const anchor of anchors) {
    if (!anchor.href) continue;

    try {
      const absoluteUrl = buildAbsoluteUrl(anchor.href);
      if (!/\/recruit\/view\/\d+/i.test(absoluteUrl)) continue;
      const normalized = normalizeSourceUrl(absoluteUrl);
      result.set(normalized, {
        url: normalized,
        listPreviewText: anchor.text || null,
        source: 'anchor',
      });
    } catch {
      // ignore malformed link
    }
  }

  const html = await page.content().catch(() => '');
  for (const item of extractViewUrlsFromHtml(html)) {
    if (!result.has(item.url)) result.set(item.url, item);
  }

  return Array.from(result.values());
}

async function gotoListAndCollect(page: Page, region: RegionTarget, pageNo: number, scrollRounds: number) {
  const listUrl = buildListUrl(region, pageNo);
  console.log(`\n[${region.name}] 목록 접속: ${listUrl}`);

  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await sleep(1500);

  const detection = await detectActualRegion(page, region);
  console.log(`[${region.name}] 실제 표시 지역: ${detection.actualRegionName} / source=${detection.source}`);

  let targets = await collectDetailUrls(page);
  console.log(`[${region.name}] 초기 상세공고 후보: ${targets.length}건`);

  await scrollListPage(page, scrollRounds);
  targets = await collectDetailUrls(page);
  console.log(`[${region.name}] 스크롤 후 상세공고 후보: ${targets.length}건`);

  const bodyText = normalizeSpace(await page.locator('body').innerText({ timeout: 5000 }).catch(() => ''));
  const html = await page.content().catch(() => '');
  await saveText(`${safeFileName(region.name)}-${pageNo}-body.txt`, bodyText.slice(0, 20000));
  await saveText(`${safeFileName(region.name)}-${pageNo}-html.txt`, html.slice(0, 30000));

  return { listUrl, detection, targets };
}

async function parseDetailPage(page: Page, target: DetailTarget, region: RegionTarget, detection: RegionDetection): Promise<CrawledRow | null> {
  const sourceUrl = target.url;

  try {
    console.log(`[${region.name}] 상세 파싱 시작: ${sourceUrl}`);
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await sleep(1200);

    const text = normalizeSpace(await page.locator('body').innerText({ timeout: 15000 }));
    const pageTitle = normalizeSpace(await page.title().catch(() => ''));
    const finalUrl = normalizeSourceUrl(page.url() || sourceUrl);

    if (!text || /로그인\s*필요|권한이 없습니다|페이지를 찾을 수 없습니다|삭제되었거나/.test(text)) {
      console.log(`[${region.name}] 상세 파싱 제외: 접근 제한 또는 빈 본문 / ${sourceUrl}`);
      return null;
    }

    const siteName = await extractProjectName(page, text, pageTitle);
    const siteAddress =
      pickAfterLabel(text, ['사업지주소', '사업지 주소', '현장주소', '현장 주소', '근무지주소', '근무지 주소', '주소', '위치'], 260) ||
      null;
    const postedSource = pickAfterLabel(text, ['등록일', '작성일', '게시일', '최초등록일', '업데이트'], 120) || text;
    const postedAt = normalizeDate(postedSource);
    const postedDatetime = normalizeDateTime(postedSource);
    const managerPhone = normalizePhone(pickAfterLabel(text, ['담당자 연락처', '담당자연락처', '연락처', '휴대폰', '전화번호', '문의전화', '문의'], 160) || text);
    const managerName = extractManagerName(text, managerPhone);
    const agencyCompany = pickAfterLabel(text, ['대행사', '분양대행사', '분양 대행사', '회사명', '업체명', '소속', '상호'], 180);
    const apartmentFee = extractApartmentFee(text);
    const detailText = extractSection(text, ['상세정보', '상세 정보', '상세요강', '모집내용', '급여정보', '채용정보', '현장정보', '공고내용'], 40);

    const addressRegion = extractRegionFromAddress(`${siteAddress || ''}\n${text.slice(0, 1500)}`);
    const actualRegionName = detection.actualRegionName || addressRegion || region.name;
    const actualRegionSource = detection.actualRegionName ? detection.source : addressRegion ? 'address-fallback' : region.source;
    const regionMatchText = detection.matchText || siteAddress || region.url;

    if (!siteName && !managerPhone && !detailText) {
      console.log(`[${region.name}] 상세 파싱 제외: 유효 데이터 부족 / ${sourceUrl}`);
      return null;
    }

    return {
      source_url: finalUrl,
      source_post_key: sourceKey(finalUrl),
      region_id: region.id,
      region_name: actualRegionName,
      list_region_name: region.name,
      actual_region_name: actualRegionName,
      actual_region_source: actualRegionSource,
      region_match_text: regionMatchText,
      site_name: compact(siteName, 220),
      site_address: compact(siteAddress, 280),
      posted_at: postedAt,
      posted_datetime: postedDatetime,
      manager_name: compact(managerName, 120),
      manager_phone: compact(managerPhone, 40),
      agency_company: compact(agencyCompany, 180),
      apartment_fee: compact(apartmentFee, 220),
      detail_text: limitText(detailText, MAX_DETAIL_TEXT_LENGTH),
      raw_text: limitText(text, MAX_RAW_TEXT_LENGTH),
      crawled_at: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`[${region.name}] 상세 파싱 실패: ${sourceUrl} / ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function postRowsToCrm(rows: CrawledRow[]) {
  const url = env('CRM_BUNYANGLINE_IMPORT_URL');
  const secret = env('BUNYANGLINE_IMPORT_SECRET');

  if (!url) throw new Error('CRM_BUNYANGLINE_IMPORT_URL 환경변수가 없습니다. 예: https://crm-go-roan.vercel.app/api/bunyangline-data/import');
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

  console.log(`CRM 저장 완료: inserted=${result.insertedCount ?? '-'} updated=${result.updatedCount ?? '-'} skipped=${result.skippedCount ?? '-'}`);
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

async function crawlRegion(browserPage: Page, detailPage: Page, region: RegionTarget, maxPages: number, maxDetailsPerRegion: number, scrollRounds: number) {
  const rows: CrawledRow[] = [];
  const seenUrls = new Set<string>();

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const remainingSlots = Math.max(maxDetailsPerRegion - rows.length, 0);
    if (remainingSlots <= 0) break;

    const { listUrl, detection, targets } = await gotoListAndCollect(browserPage, region, pageNo, scrollRounds);
    const freshTargets = targets.filter((target) => !seenUrls.has(target.url)).slice(0, remainingSlots);

    console.log(`[${region.name}] ${pageNo}페이지 상세공고 처리 대상: ${freshTargets.length}건`);

    await saveJson(`${safeFileName(region.name)}-${pageNo}-view-links.json`, {
      region,
      listUrl,
      detection,
      candidateCount: targets.length,
      processCount: freshTargets.length,
      sampleTargets: freshTargets.slice(0, 30),
      mode: 'detail-view-url',
    });

    for (const target of freshTargets) {
      seenUrls.add(target.url);
      const row = await parseDetailPage(detailPage, target, region, detection);
      if (row) rows.push(row);
      await sleep(600);
    }

    if (freshTargets.length === 0 && pageNo === 1) {
      console.log(`[${region.name}] 상세공고 URL을 찾지 못했습니다. debug-output/${safeFileName(region.name)}-${pageNo}-html.txt에서 /recruit/view/ 존재 여부를 확인하세요.`);
    }

    if (rows.length >= maxDetailsPerRegion) break;
  }

  return rows;
}

async function main() {
  const regionArg = env('BUNYANGLINE_REGION_IDS', 'all');
  const maxPages = Math.max(Number(env('BUNYANGLINE_MAX_PAGES', '1')), 1);
  const maxDetailsPerRegion = Math.max(Number(env('BUNYANGLINE_MAX_DETAILS_PER_REGION', '30')), 1);
  const scrollRounds = Math.max(Number(env('BUNYANGLINE_SCROLL_ROUNDS', '12')), 1);
  const headless = env('HEADLESS', 'true') !== 'false';
  const shouldSendToCrm = env('BUNYANGLINE_SEND_TO_CRM', 'true') !== 'false';

  console.log('분양라인 크롤러 시작');
  console.log(`- regionArg: ${regionArg}`);
  console.log(`- maxPages: ${maxPages}`);
  console.log(`- maxDetailsPerRegion: ${maxDetailsPerRegion}`);
  console.log(`- scrollRounds: ${scrollRounds}`);
  console.log(`- headless: ${headless}`);
  console.log(`- sendToCrm: ${shouldSendToCrm}`);

  await ensureDebugDir();

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  const page = await context.newPage();
  const detailPage = await context.newPage();

  try {
    const discoveredRegions = await discoverRegions(page);
    const regions = filterRegions(discoveredRegions, regionArg);
    const allRows: CrawledRow[] = [];
    const seenSourceUrls = new Set<string>();

    for (const region of regions) {
      const rows = await crawlRegion(page, detailPage, region, maxPages, maxDetailsPerRegion, scrollRounds);

      for (const row of rows) {
        if (seenSourceUrls.has(row.source_url)) {
          console.log(`[중복제외] 같은 source_url 공고 제외: ${row.source_url}`);
          continue;
        }
        seenSourceUrls.add(row.source_url);
        allRows.push(row);
      }
    }

    allRows.sort((a, b) => {
      const regionCompare = a.region_name.localeCompare(b.region_name, 'ko');
      if (regionCompare !== 0) return regionCompare;
      return String(b.posted_datetime || b.posted_at || '').localeCompare(String(a.posted_datetime || a.posted_at || ''));
    });

    await saveJson('summary.json', {
      ok: true,
      regionCount: regions.length,
      collectedCount: allRows.length,
      duplicateRule: 'source_url 단독 기준',
      collectionMode: 'regional-list -> recruit/view detail page',
      regions,
      sample: allRows.slice(0, 10),
    });

    console.log(`\n분양라인 크롤링 수집 완료: ${allRows.length}건`);

    if (shouldSendToCrm && allRows.length > 0) {
      const result = await sendToCrm(allRows);
      await saveJson('crm-import-result.json', result);
    }

    if (allRows.length === 0) {
      console.log('수집된 데이터가 없습니다. debug-output의 *-view-links.json, *-html.txt, screenshot을 확인하세요.');
    }
  } finally {
    await browser.close();
  }
}

main().catch(async (error) => {
  console.error('분양라인 크롤러 실패:', error);
  await saveJson('fatal-error.json', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  }).catch(() => null);
  process.exit(1);
});
