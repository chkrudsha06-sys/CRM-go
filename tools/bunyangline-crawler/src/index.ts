import { chromium, Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.bunyangline.com';
const DEBUG_DIR = path.resolve(process.cwd(), 'debug-output');
const IMPORT_BATCH_SIZE = 80;
const MAX_DETAIL_TEXT_LENGTH = 5000;
const MAX_RAW_TEXT_LENGTH = 12000;

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
  url.searchParams.set('keyword', '');
  url.searchParams.set('page', String(pageNo));
  return url.toString();
}

function sourceKey(url: string) {
  const parsed = new URL(url, BASE_URL);
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

function pickAfterLabel(text: string, labels: string[], max = 160) {
  const normalized = normalizeSpace(text);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const label of labels) {
    const inline = new RegExp(`${label}\\s*[:：]\\s*([^\\n]{1,${max}})`, 'i').exec(normalized);
    if (inline?.[1]) return inline[1].trim();

    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i] === label || lines[i].replace(/\s/g, '') === label.replace(/\s/g, '')) {
        const next = lines[i + 1];
        if (next) return next.slice(0, max).trim();
      }

      if (lines[i].startsWith(label)) {
        const value = lines[i].slice(label.length).replace(/^\s*[:：-]?\s*/, '').trim();
        if (value) return value.slice(0, max);
      }
    }
  }

  return null;
}

function extractSection(text: string, labels: string[], maxLines = 25) {
  const lines = normalizeSpace(text).split('\n').map((line) => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    if (!labels.some((label) => lines[i].includes(label))) continue;
    return lines.slice(i, i + maxLines).join('\n');
  }

  return lines.slice(0, Math.min(lines.length, maxLines)).join('\n');
}

function extractApartmentFee(text: string) {
  const normalized = normalizeSpace(text);
  const labelValue = pickAfterLabel(normalized, ['수수료', '분양수수료', '지급수수료', '수당', '급여'], 120);
  if (labelValue) return labelValue;

  const match = normalized.match(/(?:수수료|수당|급여)[^\n]{0,60}/);
  return match?.[0] ?? null;
}

function extractProjectName(text: string, pageTitle: string) {
  const labelValue = pickAfterLabel(text, ['현장명', '현장 이름', '사업지명', '프로젝트명', '단지명'], 140);
  if (labelValue) return labelValue;

  const title = normalizeSpace(pageTitle)
    .replace(/분양라인/g, '')
    .replace(/[>|｜|\-]\s*$/g, '')
    .trim();

  if (title && !/지역현장|구인|로그인|회원/.test(title)) return title;

  const lines = normalizeSpace(text).split('\n').map((line) => line.trim()).filter(Boolean);
  const candidate = lines.find((line) => line.length >= 3 && line.length <= 80 && !/HOME|지역현장|맞춤현장|지도현장|관심현장|서포터즈/.test(line));
  return candidate ?? null;
}

function extractRegionFromAddress(text: string): string | null {
  const value = normalizeSpace(text);
  if (!value) return null;

  if (/서울|강남|서초|송파|강동|마포|용산|성동|광진|동대문|중랑|성북|강북|도봉|노원|은평|서대문|양천|구로|금천|영등포|동작|관악/.test(value)) return '서울';
  if (/인천|검단|청라|송도|부평|계양|남동|미추홀|연수|서구|중구|동구|강화|옹진/.test(value)) return '인천';
  if (/부산|해운대|수영|동래|기장|사하|사상|부산진|연제|금정/.test(value)) return '부산';
  if (/울산|남구|중구|동구|북구|울주/.test(value)) return '울산';
  if (/대구|수성|달서|달성|동구|서구|남구|북구|중구/.test(value)) return '대구';
  if (/대전|유성|서구|동구|중구|대덕/.test(value)) return '대전';
  if (/세종/.test(value)) return '세종';
  if (/광주|광산|동구|서구|남구|북구/.test(value)) return '광주';
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

async function ensureDebugDir() {
  await fs.mkdir(DEBUG_DIR, { recursive: true });
}

async function saveJson(fileName: string, value: unknown) {
  await ensureDebugDir();
  await fs.writeFile(path.join(DEBUG_DIR, fileName), JSON.stringify(value, null, 2), 'utf8');
}

async function discoverRegions(page: Page): Promise<RegionTarget[]> {
  const seedUrl = `${BASE_URL}/recruit/regional/1`;
  await page.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await sleep(800);

  const discovered = await page.evaluate((regionNames) => {
    const names = regionNames as string[];
    const normalize = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();

    return Array.from(document.querySelectorAll('a'))
      .map((anchor) => {
        const href = (anchor as HTMLAnchorElement).href || anchor.getAttribute('href') || '';
        const text = normalize(anchor.textContent);
        const idMatch = href.match(/\/recruit\/regional\/(\d+)/);
        return {
          id: idMatch?.[1] || '',
          name: text,
          url: href,
        };
      })
      .filter((item) => item.id && names.includes(item.name));
  }, REGION_NAMES);

  const byName = new Map<string, RegionTarget>();
  for (const item of discovered) {
    if (!isRegionName(item.name)) continue;
    if (byName.has(item.name)) continue;
    byName.set(item.name, {
      id: item.id,
      name: item.name,
      url: buildAbsoluteUrl(item.url),
      source: 'discovered-link',
    });
  }

  const regions = Array.from(byName.values());

  if (regions.length === 0) {
    throw new Error('분양라인 페이지에서 지역 링크를 발견하지 못했습니다. 사이트 구조 또는 접근 차단 여부를 확인하세요.');
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
  const detected = await page.evaluate((regionNames) => {
    const names = regionNames as string[];
    const normalize = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();
    const currentPath = window.location.pathname.replace(/\/$/, '');

    const anchors = Array.from(document.querySelectorAll('a')).map((anchor) => ({
      text: normalize(anchor.textContent),
      href: (anchor as HTMLAnchorElement).href || anchor.getAttribute('href') || '',
      path: (() => {
        try {
          return new URL((anchor as HTMLAnchorElement).href || anchor.getAttribute('href') || '', window.location.origin).pathname.replace(/\/$/, '');
        } catch {
          return '';
        }
      })(),
      className: String((anchor as HTMLElement).className || ''),
      ariaCurrent: anchor.getAttribute('aria-current') || '',
    }));

    const sameUrlAnchor = anchors.find((anchor) => names.includes(anchor.text) && anchor.path === currentPath);
    if (sameUrlAnchor) {
      return { actualRegionName: sameUrlAnchor.text, source: 'current-url-anchor', matchText: sameUrlAnchor.href };
    }

    const activeAnchor = anchors.find((anchor) =>
      names.includes(anchor.text) && /(active|on|selected|current)/i.test(`${anchor.className} ${anchor.ariaCurrent}`)
    );
    if (activeAnchor) {
      return { actualRegionName: activeAnchor.text, source: 'active-anchor', matchText: activeAnchor.href || activeAnchor.className };
    }

    const bodyText = normalize(document.body?.innerText || '');
    for (const name of names) {
      if (new RegExp(`지역현장\\s*[>›]\\s*${name}`).test(bodyText)) {
        return { actualRegionName: name, source: 'breadcrumb', matchText: `지역현장 > ${name}` };
      }
    }

    return null;
  }, REGION_NAMES);

  if (detected?.actualRegionName && isRegionName(detected.actualRegionName)) {
    return detected;
  }

  return {
    actualRegionName: fallback.name,
    source: fallback.source,
    matchText: `${fallback.url}`,
  };
}

async function collectDetailUrls(page: Page) {
  const urls = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('a')).map((anchor) => {
      const href = (anchor as HTMLAnchorElement).href || anchor.getAttribute('href') || '';
      const text = String(anchor.textContent || '').replace(/\s+/g, ' ').trim();
      return { href, text };
    });

    return items
      .filter((item) => /\/recruit\/(list|view|detail)\//i.test(item.href) || /\/recruit\/list/i.test(item.href))
      .map((item) => item.href)
      .filter(Boolean);
  });

  const unique = new Set<string>();
  for (const url of urls) {
    try {
      unique.add(normalizeSourceUrl(url));
    } catch {
      // ignore malformed link
    }
  }

  return Array.from(unique);
}

async function parseDetailPage(page: Page, sourceUrl: string, region: RegionTarget, detection: RegionDetection): Promise<CrawledRow | null> {
  try {
    console.log(`[${region.name}] 상세 파싱 시작: ${sourceUrl}`);
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await sleep(700);

    const text = normalizeSpace(await page.locator('body').innerText({ timeout: 15000 }));
    const pageTitle = normalizeSpace(await page.title().catch(() => ''));
    const finalUrl = normalizeSourceUrl(page.url() || sourceUrl);

    if (!text || /로그인\s*필요|권한이 없습니다|페이지를 찾을 수 없습니다/.test(text)) {
      console.log(`[${region.name}] 상세 파싱 제외: 접근 제한 또는 빈 본문 / ${sourceUrl}`);
      return null;
    }

    const siteName = extractProjectName(text, pageTitle);
    const siteAddress = pickAfterLabel(text, ['사업지주소', '사업지 주소', '현장주소', '현장 주소', '근무지주소', '근무지 주소', '주소'], 240);
    const postedSource = pickAfterLabel(text, ['등록일', '작성일', '게시일', '최초등록일'], 100) || text;
    const postedAt = normalizeDate(postedSource);
    const postedDatetime = normalizeDateTime(postedSource);
    const managerName = pickAfterLabel(text, ['담당자 이름', '담당자이름', '담당자명', '담당자', '연락 담당자'], 100);
    const managerPhone = normalizePhone(pickAfterLabel(text, ['담당자 연락처', '담당자연락처', '연락처', '휴대폰', '전화번호'], 140) || text);
    const agencyCompany = pickAfterLabel(text, ['대행사', '분양대행사', '분양 대행사', '회사명', '업체명'], 160);
    const apartmentFee = extractApartmentFee(text);
    const detailText = extractSection(text, ['상세정보', '상세 정보', '상세요강', '모집내용', '급여정보', '채용정보'], 30);

    const addressRegion = extractRegionFromAddress(`${siteAddress || ''}\n${text.slice(0, 1200)}`);
    const actualRegionName = detection.actualRegionName || addressRegion || region.name;
    const actualRegionSource = detection.actualRegionName ? detection.source : addressRegion ? 'address-fallback' : region.source;
    const regionMatchText = detection.matchText || siteAddress || region.url;

    return {
      source_url: finalUrl,
      source_post_key: sourceKey(finalUrl),
      region_id: region.id,
      region_name: actualRegionName,
      list_region_name: region.name,
      actual_region_name: actualRegionName,
      actual_region_source: actualRegionSource,
      region_match_text: regionMatchText,
      site_name: compact(siteName, 180),
      site_address: compact(siteAddress, 240),
      posted_at: postedAt,
      posted_datetime: postedDatetime,
      manager_name: compact(managerName, 120),
      manager_phone: compact(managerPhone, 40),
      agency_company: compact(agencyCompany, 160),
      apartment_fee: compact(apartmentFee, 180),
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

async function crawlRegion(browserPage: Page, detailPage: Page, region: RegionTarget, maxPages: number, maxDetailsPerRegion: number) {
  const rows: CrawledRow[] = [];
  const seenUrls = new Set<string>();

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const listUrl = buildListUrl(region, pageNo);
    console.log(`\n[${region.name}] 목록 접속: ${listUrl}`);

    await browserPage.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await browserPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await sleep(1000);
    await browserPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => null);
    await sleep(800);

    const detection = await detectActualRegion(browserPage, region);
    console.log(`[${region.name}] 실제 표시 지역: ${detection.actualRegionName} / source=${detection.source}`);

    const detailUrls = await collectDetailUrls(browserPage);
    const remainingSlots = Math.max(maxDetailsPerRegion - rows.length, 0);
    const targets = detailUrls.filter((url) => !seenUrls.has(url)).slice(0, remainingSlots);

    console.log(`[${region.name}] ${pageNo}페이지 상세 후보: ${detailUrls.length}건 / 처리: ${targets.length}건`);

    await saveJson(`${safeFileName(region.name)}-${pageNo}-links.json`, {
      region,
      listUrl,
      detection,
      detailUrls,
      targets,
    });

    for (const url of targets) {
      seenUrls.add(url);
      const row = await parseDetailPage(detailPage, url, region, detection);
      if (row) rows.push(row);
      await sleep(500);
    }

    if (rows.length >= maxDetailsPerRegion) break;
  }

  return rows;
}

async function main() {
  const regionArg = env('BUNYANGLINE_REGION_IDS', 'all');
  const maxPages = Math.max(Number(env('BUNYANGLINE_MAX_PAGES', '1')), 1);
  const maxDetailsPerRegion = Math.max(Number(env('BUNYANGLINE_MAX_DETAILS_PER_REGION', '30')), 1);
  const headless = env('HEADLESS', 'true') !== 'false';
  const shouldSendToCrm = env('BUNYANGLINE_SEND_TO_CRM', 'true') !== 'false';

  console.log('분양라인 크롤러 시작');
  console.log(`- regionArg: ${regionArg}`);
  console.log(`- maxPages: ${maxPages}`);
  console.log(`- maxDetailsPerRegion: ${maxDetailsPerRegion}`);
  console.log(`- headless: ${headless}`);
  console.log(`- sendToCrm: ${shouldSendToCrm}`);

  await ensureDebugDir();

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  const detailPage = await context.newPage();

  try {
    const discoveredRegions = await discoverRegions(page);
    const regions = filterRegions(discoveredRegions, regionArg);
    const allRows: CrawledRow[] = [];
    const seenSourceUrls = new Set<string>();

    for (const region of regions) {
      const rows = await crawlRegion(page, detailPage, region, maxPages, maxDetailsPerRegion);

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
      regions,
      sample: allRows.slice(0, 10),
    });

    console.log(`\n분양라인 크롤링 수집 완료: ${allRows.length}건`);

    if (shouldSendToCrm && allRows.length > 0) {
      const result = await sendToCrm(allRows);
      await saveJson('crm-import-result.json', result);
    }

    if (allRows.length === 0) {
      console.log('수집된 데이터가 없습니다. debug-output의 links.json과 screenshot을 확인하세요.');
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
