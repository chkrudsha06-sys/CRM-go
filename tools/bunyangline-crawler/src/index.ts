import { chromium, Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.bunyangline.com';

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
];

type Region = (typeof REGIONS)[number];

type ListingCandidate = {
  sourceUrl: string;
  sourceId: string;
  regionName: string;
  regionId: string;
  adSection: string;
  listDateGroup: string | null;
};

type DetailItem = {
  source_url: string;
  source_id: string;
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
  detail_text: string;
  title: string | null;
  summary: string | null;
  site_address: string | null;
  work_address: string | null;
  category: string | null;
  list_date_group: string | null;
  raw_text: string;
  crawled_at: string;
};

type ImportResult = {
  ok?: boolean;
  insertedOrUpdated?: number;
  received?: number;
  skipped?: number;
  message?: string;
  error?: string;
};

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactText(value: unknown) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|#%&{}$!`'@+=]/g, '_').replace(/\s+/g, '_').slice(0, 120);
}

function toAbsoluteUrl(url: string) {
  try {
    const normalized = new URL(url, BASE_URL);
    normalized.hash = '';
    return normalized.toString();
  } catch {
    return url;
  }
}

function canonicalViewUrl(id: string) {
  return `${BASE_URL}/recruit/view/${id}/?previousActiveNaviId=regional`;
}

function sourceIdFromUrl(url: string) {
  const match = url.match(/\/recruit\/view\/(\d+)/);
  return match?.[1] || '';
}

function todayKst() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cutoffDateString(daysBack: number) {
  const kst = todayKst();
  kst.setHours(0, 0, 0, 0);
  kst.setDate(kst.getDate() - daysBack);
  return dateOnly(kst);
}

function todayDateString() {
  return dateOnly(todayKst());
}

function isOnOrAfter(date: string | null, cutoff: string) {
  if (!date) return false;
  return date >= cutoff;
}

function parseDateTimeFromText(text: string): { postedAt: string | null; postedDatetime: string | null; raw: string | null } {
  const normalized = compactText(text);
  const match = normalized.match(/(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return { postedAt: null, postedDatetime: null, raw: null };

  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const time = `${match[4].padStart(2, '0')}:${match[5]}:${(match[6] || '00').padStart(2, '0')}`;
  return { postedAt: date, postedDatetime: `${date}T${time}+09:00`, raw: `${date} ${time}` };
}

function lineList(text: string) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function findLineIndex(lines: string[], predicate: (line: string) => boolean) {
  for (let index = 0; index < lines.length; index += 1) {
    if (predicate(lines[index])) return index;
  }
  return -1;
}

function valueAfterLabel(lines: string[], label: string): string | null {
  const labelNoSpace = label.replace(/\s+/g, '');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = line.replace(/\s+/g, '');

    if (normalizedLine === labelNoSpace) {
      for (let next = index + 1; next < Math.min(lines.length, index + 5); next += 1) {
        const candidate = lines[next].trim();
        if (!candidate) continue;
        if (isSectionHeading(candidate)) break;
        if (candidate.replace(/\s+/g, '') === labelNoSpace) continue;
        return candidate;
      }
    }

    if (normalizedLine.startsWith(labelNoSpace)) {
      const regex = new RegExp(`${escapeRegex(label)}\\s*[:：]?\\s*(.+)$`);
      const match = line.match(regex);
      if (match?.[1]?.trim()) return match[1].trim();

      const rest = line.replace(label, '').replace(/^\s*[:：]\s*/, '').trim();
      if (rest && rest !== line) return rest;
    }
  }

  return null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSectionHeading(value: string) {
  return [
    '근무지 정보',
    '사업자 정보',
    '사업지 정보',
    '급여정보',
    '상세정보',
    '모집요강',
    '구인글 상세보기',
  ].some((heading) => value.includes(heading));
}

function extractSection(lines: string[], heading: string) {
  const start = findLineIndex(lines, (line) => line.replace(/\s+/g, '').includes(heading.replace(/\s+/g, '')));
  if (start < 0) return null;

  const result: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (result.length > 0 && isSectionHeading(line)) break;
    result.push(line);
  }

  return result.join('\n').trim() || null;
}

function extractMoveInDate(lines: string[], text: string) {
  const fromLabel = valueAfterLabel(lines, '투입일');
  if (fromLabel) return fromLabel;

  const match = compactText(text).match(/투입일\s*[:：]?\s*([^|\n]{2,30})/);
  return match?.[1]?.trim() || '-';
}

function extractFee(lines: string[]) {
  const labels = ['아파트 분양', '오피스텔 분양', '상가 분양', '호텔 분양', '레지던스 분양', '토지 분양'];

  for (const label of labels) {
    const value = valueAfterLabel(lines, label);
    if (value) return `${label} ${value}`.trim();

    const line = lines.find((item) => item.includes(label) && /원|만원|억|수수료|%/.test(item));
    if (line) return line;
  }

  const section = extractSection(lines, '급여정보');
  if (section) return compactText(section).slice(0, 500);

  const fallback = lines.find((item) => /수수료|일비|만원|억/.test(item) && item.length < 120);
  return fallback || '-';
}

function extractTitle(lines: string[], postedRaw: string | null, html: string) {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogTitle && !ogTitle.includes('분양라인')) return compactText(decodeHtml(ogTitle));

  const dateIndex = postedRaw ? findLineIndex(lines, (line) => line.includes(postedRaw.slice(0, 16))) : -1;
  const banned = /구인글 상세보기|소수|신규|HOT|대박|관심|공유|투입일|지역현장/;

  for (let index = Math.max(0, dateIndex + 1); index < Math.min(lines.length, dateIndex + 12); index += 1) {
    const line = lines[index];
    if (line.length >= 4 && !banned.test(line)) return line;
  }

  return lines.find((line) => line.length >= 6 && !banned.test(line)) || null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function extractCategory(lines: string[]) {
  const known = ['아파트/오피스텔', '아파트/상가/쇼핑몰', '아파트/도시형 생활주택', '오피스텔/상가/쇼핑몰', '도시형 생활주택', '지식산업센터', '오피스텔', '아파트', '기타'];
  return lines.find((line) => known.some((item) => line.includes(item))) || null;
}

function extractDetailText(lines: string[]) {
  const section = extractSection(lines, '상세정보');
  if (section) return section;

  const start = findLineIndex(lines, (line) => /상세|내용|모집/.test(line));
  if (start >= 0) return lines.slice(start + 1, start + 40).join('\n').trim() || '-';

  return '-';
}

function lastIndexOfAny(text: string, keywords: string[]) {
  let bestIndex = -1;
  let bestKeyword = '';

  for (const keyword of keywords) {
    const index = text.lastIndexOf(keyword);
    if (index > bestIndex) {
      bestIndex = index;
      bestKeyword = keyword;
    }
  }

  return { index: bestIndex, keyword: bestKeyword };
}

function normalizeSection(section: string | null) {
  const text = compactText(section || '');
  if (/유니크/.test(text)) return '유니크';
  if (/슈페리어/.test(text)) return '슈페리어';
  if (/전국\s*Top|전국\s*TOP|전국Top|전국TOP/.test(text)) return '전국TOP';
  if (/지역\s*Top|지역\s*TOP|지역Top|지역TOP/.test(text)) return '지역TOP';
  if (/일반\s*구인글|TODAY|20\d{2}-\d{2}-\d{2}/.test(text)) return '일반구인글';
  return '미지정';
}

function extractListDateGroup(prefixText: string) {
  const dateMatches = Array.from(prefixText.matchAll(/(TODAY|20\d{2}-\d{2}-\d{2})/g));
  const last = dateMatches.length > 0 ? dateMatches[dateMatches.length - 1][1] : null;
  if (!last) return null;
  if (last === 'TODAY') return todayDateString();
  return last;
}

function extractCandidatesFromHtml(html: string, region: Region): ListingCandidate[] {
  const candidates = new Map<string, ListingCandidate>();
  const sectionKeywords = ['유니크', '슈페리어', '전국 Top', '전국 TOP', '전국Top', '전국TOP', '지역 Top', '지역 TOP', '지역Top', '지역TOP', '일반 구인글', 'TODAY'];
  const viewRegex = /\/recruit\/view\/(\d+)\/?(?:\?[^"'\s<>)]*)?/g;

  for (const match of html.matchAll(viewRegex)) {
    const sourceId = match[1];
    const sourceUrl = canonicalViewUrl(sourceId);
    const index = typeof match.index === 'number' ? match.index : 0;
    const prefix = stripTags(html.slice(Math.max(0, index - 12000), index));
    const section = normalizeSection(lastIndexOfAny(prefix, sectionKeywords).keyword);
    const listDateGroup = extractListDateGroup(prefix);

    candidates.set(sourceUrl, {
      sourceUrl,
      sourceId,
      regionName: region.name,
      regionId: region.id,
      adSection: section,
      listDateGroup,
    });
  }

  // 일부 데이터가 JSON/템플릿에 idx로만 존재할 때 보조 추출
  const idxRegexes = [
    /["']idx["']\s*:\s*["']?(\d{4,})["']?/g,
    /["']recruit_id["']\s*:\s*["']?(\d{4,})["']?/g,
    /["']post_id["']\s*:\s*["']?(\d{4,})["']?/g,
  ];

  for (const regex of idxRegexes) {
    for (const match of html.matchAll(regex)) {
      const sourceId = match[1];
      const sourceUrl = canonicalViewUrl(sourceId);
      if (candidates.has(sourceUrl)) continue;

      candidates.set(sourceUrl, {
        sourceUrl,
        sourceId,
        regionName: region.name,
        regionId: region.id,
        adSection: '미지정',
        listDateGroup: null,
      });
    }
  }

  return Array.from(candidates.values());
}

function stripTags(html: string) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
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


type VisibleCardCandidate = {
  key: string;
  title: string;
  text: string;
  section: string;
  listDateGroup: string | null;
  href: string | null;
};

async function collectVisibleCards(page: Page): Promise<VisibleCardCandidate[]> {
  const bodyText = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
  const html = await page.content().catch(() => '');

  const lines = bodyText
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const candidates: VisibleCardCandidate[] = [];
  const seen = new Set<string>();

  let currentSection = '미지정';
  let currentDateGroup: string | null = null;

  const normalizeSectionLine = (line: string) => {
    if (/^유니크$/.test(line)) return '유니크';
    if (/^슈페리어$/.test(line)) return '슈페리어';
    if (/^전국\s*Top$/i.test(line) || /^전국\s*TOP$/.test(line)) return '전국TOP';
    if (/^지역\s*Top$/i.test(line) || /^지역\s*TOP$/.test(line)) return '지역TOP';
    if (/^일반\s*구인글$/.test(line)) return '일반구인글';
    return null;
  };

  const isDateGroup = (line: string) => line === 'TODAY' || /^20\d{2}-\d{2}-\d{2}/.test(line);
  const isBadge = (line: string) => /^(AD|소수|신규|HOT|대박|급구|TODAY|♡|♥)$/.test(line);
  const isCategory = (line: string) => /^(아파트|오피스텔|기타|도시형 생활주택|지식산업센터|상가|쇼핑몰|타운하우스|토지|생활형숙박|아파트\/|오피스텔\/|아파트\/오피스텔|아파트\/상가\/쇼핑몰|아파트\/도시형 생활주택|오피스텔\/상가\/쇼핑몰)/.test(line);
  const isTagOrMeta = (line: string) => /^(팀장\/팀원|본부\/팀장|팀원|본부장|계약 수수료|기본급|인센|일비|숙소비|경력무관|\d+개월이상|캐치뷰어|전화문의|지승|BN|TAEONE|휴머니글로벌|\(주\)|<주>)/.test(line);
  const isUiText = (line: string) => /^(분양라인|지역현장|모든지역|서울|경기남부|경기북부|인천|부산|울산|대구|경상도|대전|세종|충청도|광주|전라도|강원도|제주도|검색|검색어|HOME|맞춤현장|지도현장|관심현장|서포터즈|글쓰기|TOP|목록을 로딩중입니다|회사명|개인정보|이용약관)/.test(line);
  const looksLikeTitle = (line: string) => {
    if (!line || line.length < 5 || line.length > 95) return false;
    if (isBadge(line) || isCategory(line) || isTagOrMeta(line) || isUiText(line)) return false;
    if (/^\d{4}-\d{2}-\d{2}/.test(line)) return false;
    if (/원$/.test(line) && line.length < 12) return false;
    return /(아파트|오피스텔|팀|본부|모집|수수료|분양|현장|조건|신규|서울|강남|서초|노원|역|파트너|센터|상가|호텔|레지던스|민간임대|도시형|주택|입주|계약|광고|파격|프라이빗|갤러리)/.test(line);
  };

  const pushCandidate = (title: string, index: number, sectionOverride?: string | null, dateOverride?: string | null) => {
    const cleanTitle = normalizeText(title);
    if (!looksLikeTitle(cleanTitle)) return;

    const key = `${sectionOverride || currentSection}|${dateOverride || currentDateGroup || ''}|${cleanTitle}`;
    if (seen.has(key)) return;
    seen.add(key);

    const context = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 8)).join(' / ');
    candidates.push({
      key,
      title: cleanTitle,
      text: context,
      section: sectionOverride || currentSection,
      listDateGroup: dateOverride || (currentDateGroup === 'TODAY' ? todayDateString() : currentDateGroup),
      href: null,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = normalizeSectionLine(line);
    if (section) {
      currentSection = section;
      continue;
    }

    if (isDateGroup(line)) {
      currentSection = '일반구인글';
      currentDateGroup = line === 'TODAY' ? todayDateString() : line.match(/20\d{2}-\d{2}-\d{2}/)?.[0] || currentDateGroup;
      continue;
    }

    // 가장 안정적인 규칙: 카테고리 다음 줄이 공고 제목인 구조
    if (isCategory(line)) {
      for (let next = index + 1; next < Math.min(lines.length, index + 5); next += 1) {
        const nextLine = lines[next];
        if (!nextLine || isBadge(nextLine)) continue;
        pushCandidate(nextLine, next);
        break;
      }
      continue;
    }

    // 일반구인글은 이미지가 없는 카드도 있어서 제목형 문구를 보조로 수집
    if (currentSection === '일반구인글' && looksLikeTitle(line)) {
      const nextFew = lines.slice(index + 1, index + 6).join(' ');
      if (/(팀장\/팀원|본부\/팀장|팀원|계약 수수료|경력무관|일비|캐치뷰어)/.test(nextFew)) {
        pushCandidate(line, index);
      }
    }
  }

  // 서버 HTML 안에 onclick/data 속성으로 id가 숨어있는 경우 보조 추출
  const idRegexes = [
    /recruit\/view\/(\d{4,})/g,
    /go\w*\((\d{4,})\)/g,
    /["']idx["']\s*[:=]\s*["']?(\d{4,})["']?/g,
    /data-(?:idx|id|no)=['"](\d{4,})['"]/g,
  ];

  for (const regex of idRegexes) {
    for (const match of html.matchAll(regex)) {
      const sourceId = match[1];
      const sourceUrl = canonicalViewUrl(sourceId);
      const key = `html-id|${sourceUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        key,
        title: `공고 ${sourceId}`,
        text: `HTML에서 발견된 공고ID ${sourceId}`,
        section: currentSection || '미지정',
        listDateGroup: currentDateGroup === 'TODAY' ? todayDateString() : currentDateGroup,
        href: sourceUrl,
      });
    }
  }

  await saveText(path.resolve(process.cwd(), 'debug-output', `visible-text-${Date.now()}.txt`), lines.slice(0, 500).join('\n')).catch(() => undefined);
  await saveJson(path.resolve(process.cwd(), 'debug-output', `title-candidates-${Date.now()}.json`), candidates.slice(0, 200)).catch(() => undefined);

  return candidates.slice(0, 200);
}

async function tryClickCardForUrl(page: Page, card: VisibleCardCandidate): Promise<string | null> {
  if (card.href && sourceIdFromUrl(card.href)) return canonicalViewUrl(sourceIdFromUrl(card.href) || '');

  const beforeUrl = page.url();
  const beforeScrollY = await page.evaluate(() => window.scrollY).catch(() => 0);

  const clickAndReadUrl = async (locator: ReturnType<Page['locator']>) => {
    const count = Math.min(await locator.count().catch(() => 0), 8);

    for (let index = 0; index < count; index += 1) {
      const target = locator.nth(index);
      const visible = await target.isVisible().catch(() => false);
      if (!visible) continue;

      await target.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(150);

      const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
      await target.click({ timeout: 5000 }).catch(() => undefined);
      const popup = await popupPromise;

      if (popup) {
        await popup.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
        const popupUrl = popup.url();
        await popup.close().catch(() => undefined);
        const popupId = sourceIdFromUrl(popupUrl);
        if (popupId) return canonicalViewUrl(popupId);
      }

      await page.waitForTimeout(900);
      const afterUrl = page.url();
      const id = sourceIdFromUrl(afterUrl);
      if (id) {
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
          await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
        });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
        await page.evaluate((y) => window.scrollTo(0, y), beforeScrollY).catch(() => undefined);
        await page.waitForTimeout(400);
        return canonicalViewUrl(id);
      }

      if (afterUrl !== beforeUrl) {
        await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
        await page.evaluate((y) => window.scrollTo(0, y), beforeScrollY).catch(() => undefined);
        await page.waitForTimeout(400);
      }
    }

    return null;
  };

  // 1순위: 제목 텍스트 자체 클릭
  const exactText = page.getByText(card.title, { exact: true });
  const exactResult = await clickAndReadUrl(exactText).catch(() => null);
  if (exactResult) return exactResult;

  // 2순위: 제목 일부 텍스트 클릭. 말줄임/공백 차이 대응
  const shortTitle = card.title.length > 24 ? card.title.slice(0, 24) : card.title;
  if (shortTitle && shortTitle !== card.title) {
    const partialResult = await clickAndReadUrl(page.getByText(shortTitle, { exact: false })).catch(() => null);
    if (partialResult) return partialResult;
  }

  return null;
}

async function scrollAndCollectCandidates(page: Page, region: Region, scrollRounds: number, debugDir: string) {
  const listUrl = `${BASE_URL}/recruit/regional/${region.id}`;
  const collected = new Map<string, ListingCandidate>();
  const attemptedCardKeys = new Set<string>();

  console.log('='.repeat(90));
  console.log(`[${region.name}] 목록 접속: ${listUrl}`);

  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await sleep(1500);

  let noNewRounds = 0;

  for (let round = 0; round <= scrollRounds; round += 1) {
    const html = await page.content();
    const fromHtml = extractCandidatesFromHtml(html, region);
    const beforeHtml = collected.size;
    fromHtml.forEach((candidate) => collected.set(candidate.sourceUrl, candidate));
    const htmlAdded = collected.size - beforeHtml;

    const visibleCards = await collectVisibleCards(page).catch(() => [] as VisibleCardCandidate[]);
    let clickAdded = 0;
    let clickTried = 0;

    for (const card of visibleCards) {
      const hrefId = card.href ? sourceIdFromUrl(card.href) : '';
      if (hrefId) {
        const sourceUrl = canonicalViewUrl(hrefId);
        if (!collected.has(sourceUrl)) {
          collected.set(sourceUrl, {
            sourceUrl,
            sourceId: hrefId,
            regionName: region.name,
            regionId: region.id,
            adSection: normalizeSection(card.section),
            listDateGroup: card.listDateGroup === 'TODAY' ? todayDateString() : card.listDateGroup,
          });
          clickAdded += 1;
        }
        continue;
      }

      if (attemptedCardKeys.has(card.key)) continue;
      attemptedCardKeys.add(card.key);
      clickTried += 1;

      const clickedUrl = await tryClickCardForUrl(page, card).catch(() => null);
      const sourceId = clickedUrl ? sourceIdFromUrl(clickedUrl) : '';
      if (!clickedUrl || !sourceId) continue;

      if (!collected.has(clickedUrl)) {
        collected.set(clickedUrl, {
          sourceUrl: clickedUrl,
          sourceId,
          regionName: region.name,
          regionId: region.id,
          adSection: normalizeSection(card.section),
          listDateGroup: card.listDateGroup === 'TODAY' ? todayDateString() : card.listDateGroup,
        });
        clickAdded += 1;
      }
    }

    const added = htmlAdded + clickAdded;
    if (round === 0) {
      console.log(`[${region.name}] 초기 상세공고 후보: ${collected.size}건 / 화면카드 ${visibleCards.length}건 / 클릭시도 ${clickTried}건`);
    } else if (round % 5 === 0 || added > 0) {
      console.log(`[${region.name}] 스크롤 ${round}/${scrollRounds}: 상세공고 후보 ${collected.size}건 (+${added}) / 화면카드 ${visibleCards.length}건 / 클릭시도 ${clickTried}건`);
    }

    if (added === 0) noNewRounds += 1;
    else noNewRounds = 0;

    if (round >= 20 && noNewRounds >= 15) break;

    await page.mouse.wheel(0, 1700);
    await sleep(700);
  }

  const finalHtml = await page.content();
  const prefix = safeFileName(`${region.id}_${region.name}_list`);
  await saveText(path.join(debugDir, `${prefix}_html_sample.html`), finalHtml.slice(0, 250000));
  await saveJson(path.join(debugDir, `${prefix}_candidates.json`), Array.from(collected.values()));

  console.log(`[${region.name}] 최종 상세공고 후보: ${collected.size}건`);
  return Array.from(collected.values());
}

async function parseDetail(page: Page, candidate: ListingCandidate, cutoff: string, debugDir: string): Promise<DetailItem | null> {
  await page.goto(candidate.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  await sleep(700);

  const html = await page.content();
  const bodyText = await page.locator('body').innerText({ timeout: 12000 }).catch(() => stripTags(html));
  const lines = lineList(bodyText);
  const dateResult = parseDateTimeFromText(bodyText);
  const postedAt = dateResult.postedAt || candidate.listDateGroup;

  if (!isOnOrAfter(postedAt, cutoff)) {
    return null;
  }

  const sourceId = sourceIdFromUrl(candidate.sourceUrl) || candidate.sourceId;
  const title = extractTitle(lines, dateResult.raw, html);
  const siteName = valueAfterLabel(lines, '현장명') || title || '-';
  const siteAddress = valueAfterLabel(lines, '사업지 주소') || valueAfterLabel(lines, '현장주소') || null;
  const workAddress = valueAfterLabel(lines, '근무지역 주소') || valueAfterLabel(lines, '근무지 주소') || null;
  const agency = valueAfterLabel(lines, '대행사') || valueAfterLabel(lines, '회사명') || '-';
  const managerName = valueAfterLabel(lines, '담당자 이름') || valueAfterLabel(lines, '담당자명') || valueAfterLabel(lines, '담당자') || '-';
  const managerPhone = valueAfterLabel(lines, '담당자 연락처') || valueAfterLabel(lines, '연락처') || valueAfterLabel(lines, '전화번호') || '-';
  const fee = extractFee(lines);
  const moveInDate = extractMoveInDate(lines, bodyText);
  const detailText = extractDetailText(lines);
  const summary = lines.find((line) => title && line !== title && line.length >= 8 && line.length <= 120 && !isSectionHeading(line)) || null;
  const category = extractCategory(lines);

  const item: DetailItem = {
    source_url: candidate.sourceUrl,
    source_id: sourceId,
    region_name: candidate.regionName,
    ad_section: candidate.adSection,
    site_name: siteName,
    posted_at: postedAt,
    posted_datetime: dateResult.postedDatetime,
    manager_name: managerName,
    manager_phone: managerPhone,
    agency_company: agency,
    apartment_fee: fee,
    move_in_date: moveInDate,
    detail_text: detailText,
    title,
    summary,
    site_address: siteAddress,
    work_address: workAddress,
    category,
    list_date_group: candidate.listDateGroup,
    raw_text: normalizeText(bodyText).slice(0, 20000),
    crawled_at: new Date().toISOString(),
  };

  const prefix = safeFileName(`${candidate.regionName}_${sourceId}`);
  await saveJson(path.join(debugDir, `${prefix}_detail.json`), item);

  return item;
}

async function sendToCrm(items: DetailItem[]) {
  const importUrl = env('CRM_BUNYANGLINE_IMPORT_URL');
  const secret = env('BUNYANGLINE_IMPORT_SECRET');

  if (!importUrl) {
    console.log('[CRM저장] CRM_BUNYANGLINE_IMPORT_URL이 없어 저장을 건너뜁니다.');
    return { ok: false, message: 'missing import url' } satisfies ImportResult;
  }

  if (items.length === 0) {
    console.log('[CRM저장] 저장할 항목이 없습니다.');
    return { ok: true, received: 0, insertedOrUpdated: 0 } satisfies ImportResult;
  }

  let totalSaved = 0;
  const chunkSize = 50;

  for (let start = 0; start < items.length; start += chunkSize) {
    const chunk = items.slice(start, start + chunkSize);
    const response = await fetch(importUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-import-secret': secret } : {}),
      },
      body: JSON.stringify({ items: chunk }),
    });

    const result = (await response.json().catch(() => null)) as ImportResult | null;

    if (!response.ok || !result?.ok) {
      throw new Error(`[CRM저장] 실패 status=${response.status} result=${JSON.stringify(result)}`);
    }

    totalSaved += result.insertedOrUpdated || chunk.length;
    console.log(`[CRM저장] ${Math.min(start + chunk.length, items.length)}/${items.length} 전송 완료`);
  }

  return { ok: true, insertedOrUpdated: totalSaved, received: items.length } satisfies ImportResult;
}

async function main() {
  const regionArg = env('BUNYANGLINE_REGION_IDS', 'all');
  const scrollRounds = Math.max(10, Number(env('BUNYANGLINE_SCROLL_ROUNDS', '120')) || 120);
  const daysBack = Math.max(0, Number(env('BUNYANGLINE_DAYS_BACK', '5')) || 5);
  const headless = env('HEADLESS', 'true') !== 'false';
  const sendToCrmEnabled = env('SEND_TO_CRM', 'true') !== 'false';
  const cutoff = cutoffDateString(daysBack);

  const targetRegions =
    regionArg === 'all'
      ? REGIONS
      : REGIONS.filter((region) => regionArg.split(',').map((item) => item.trim()).includes(region.id));

  if (targetRegions.length === 0) throw new Error(`수집할 지역이 없습니다. BUNYANGLINE_REGION_IDS=${regionArg}`);

  const debugDir = await ensureDebugDir();

  console.log('분양라인 상세페이지 기준 크롤러를 시작합니다.');
  console.log(`- 수집 기준: /recruit/view/{공고ID} 상세페이지`);
  console.log(`- 출력 기준: 지역/게재지면/현장명/등록일/담당자/연락처/대행사/수수료/투입일/상세정보`);
  console.log(`- 중복 기준: source_url 단독`);
  console.log(`- 수집 기간: ${cutoff} 이후 등록 공고`);
  console.log(`- regionArg: ${regionArg}`);
  console.log(`- scrollRounds: ${scrollRounds}`);
  console.log(`- headless: ${headless}`);
  console.log(`- sendToCrm: ${sendToCrmEnabled}`);
  console.log(`[지역목록] ${targetRegions.map((region) => `${region.name}(${region.id})`).join(', ')}`);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  });

  const listPage = await context.newPage();
  const detailPage = await context.newPage();
  const allItems: DetailItem[] = [];
  const failures: Array<{ url: string; error: string }> = [];

  try {
    for (const region of targetRegions) {
      const candidates = await scrollAndCollectCandidates(listPage, region, scrollRounds, debugDir);
      let parsedCount = 0;
      let skippedOldCount = 0;

      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        try {
          console.log(`[${region.name}] 상세 파싱 ${index + 1}/${candidates.length}: ${candidate.sourceUrl}`);
          const item = await parseDetail(detailPage, candidate, cutoff, debugDir);
          if (!item) {
            skippedOldCount += 1;
            continue;
          }

          allItems.push(item);
          parsedCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push({ url: candidate.sourceUrl, error: message });
          console.log(`[${region.name}] 상세 파싱 실패: ${candidate.sourceUrl} / ${message}`);
        }
      }

      console.log(`[${region.name}] 완료: 후보 ${candidates.length}건 / 최근 ${daysBack}일 저장대상 ${parsedCount}건 / 기간제외 ${skippedOldCount}건 / 실패 누적 ${failures.length}건`);
    }

    await saveJson(path.join(debugDir, 'final-items.json'), allItems);
    await saveJson(path.join(debugDir, 'failures.json'), failures);

    if (sendToCrmEnabled) {
      await sendToCrm(allItems);
    } else {
      console.log('[CRM저장] SEND_TO_CRM=false 이므로 저장하지 않았습니다.');
    }

    console.log('='.repeat(90));
    console.log(`[완료] 최종 저장대상 ${allItems.length}건 / 실패 ${failures.length}건`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[치명적 오류]', error);
  process.exit(1);
});
