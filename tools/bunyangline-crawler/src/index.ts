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

type LinkItem = {
  text: string;
  href: string;
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

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value, BASE_URL);
    url.hash = '';
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_medium');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('utm_term');
    url.searchParams.delete('utm_content');
    return url.toString();
  } catch {
    return value;
  }
}

function getRecruitId(url: string) {
  const match = url.match(/\/recruit\/view\/(\d+)/i);
  return match?.[1] || '';
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

function findLines(text: string, keywords: string[], limit = 6) {
  return text
    .split('\n')
    .map((line) => compactText(line, 500))
    .filter((line) => line && keywords.some((keyword) => line.includes(keyword)))
    .slice(0, limit);
}

function cleanSiteName(value: string) {
  return compactText(value, 160)
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s+-\s+분양라인.*$/i, '')
    .trim();
}

function inferManagerName(text: string, phone: string) {
  if (!phone) return '';
  const plainPhone = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
  const phoneVariants = [phone, plainPhone];
  const lines = text.split('\n').map((line) => compactText(line, 500)).filter(Boolean);

  for (const line of lines) {
    if (!phoneVariants.some((item) => line.replace(/\D/g, '').includes(item.replace(/\D/g, '')))) continue;

    const labelCandidate = line
      .replace(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/g, '')
      .replace(/연락처|전화|문의|담당자|핸드폰|휴대폰|본부장|팀장|팀원|실장|님|:/g, ' ')
      .replace(/[|·•,，]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const nameMatch = labelCandidate.match(/[가-힣]{2,4}/);
    if (nameMatch) return nameMatch[0];
  }

  return '';
}

function getCategoryFromText(text: string) {
  const categories = ['유니크', '슈페리어', '전국TOP', '지역TOP', '일반 구인글', '일반구인글'];
  for (const category of categories) {
    if (text.includes(category)) return category.replace('일반 구인글', '일반구인글');
  }
  return '';
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

// page.evaluate 문자열 실행은 GitHub Actions/tsx 환경에서 문법 오류가 발생할 수 있어 사용하지 않습니다.
// 아래 크롤러는 모두 locator.evaluateAll 또는 page.evaluate(function) 방식으로 실행합니다.

async function autoScroll(page: Page, rounds: number) {
  let previousHeight = 0;
  let sameHeightCount = 0;

  for (let i = 0; i < rounds; i += 1) {
    const state = await page.evaluate(() => {
    const normalize = (value: string | null | undefined) => String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      title: normalize(document.title),
      h1: normalize(document.querySelector('h1')?.textContent),
      h2: normalize(document.querySelector('h2')?.textContent),
      h3: normalize(document.querySelector('h3')?.textContent),
      bodyText: normalize(document.body?.innerText || ''),
      htmlText: normalize(document.documentElement?.outerHTML || '').slice(0, 3000),
    };
  });

  const sourceUrl = normalizeSourceUrl(link.href);
    if (!byUrl.has(sourceUrl)) byUrl.set(sourceUrl, { text: link.text, href: sourceUrl });
  }

  return Array.from(byUrl.values());
}

async function parseDetailPage(page: Page, detailUrl: string, region: RegionTarget, actualRegion: Awaited<ReturnType<typeof detectDisplayedRegion>>): Promise<RecruitItem> {
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
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      title: normalize(document.title),
      h1: normalize(document.querySelector('h1')?.textContent),
      h2: normalize(document.querySelector('h2')?.textContent),
      h3: normalize(document.querySelector('h3')?.textContent),
      bodyText: normalize(document.body?.innerText || ''),
      htmlText: normalize(document.documentElement?.outerHTML || '').slice(0, 3000),
    };
  });

  const sourceUrl = normalizeSourceUrl(response?.url() || detailUrl);
  const bodyText = normalizeText(state.bodyText);
  const lines = bodyText.split('\n').map((line) => compactText(line, 500)).filter(Boolean);
  const phones = extractAllPhones(bodyText);
  const managerPhone = phones[0] || '';

  const titleCandidates = [state.h1, state.h2, state.h3, state.title, lines.find((line) => /분양|아파트|오피스텔|생활형|상가|모집|채용|팀장|팀원|본부장/.test(line)) || ''];
  const siteName = cleanSiteName(titleCandidates.find((item) => compactText(item, 10)) || `분양라인 공고 ${getRecruitId(sourceUrl)}`);

  const siteAddress = pickLineAfterLabel(lines, ['현장주소', '현장 주소', '주소', '위치', '근무지']);
  const managerName = pickLineAfterLabel(lines, ['담당자명', '담당자', '문의']) || inferManagerName(bodyText, managerPhone);
  const agencyCompany = pickLineAfterLabel(lines, ['대행사', '분양대행사', '시행사', '시공사', '소속회사', '회사명']);
  const feeLines = findLines(bodyText, ['수수료', '급여', '계약금', '지원', '만원', '%', '월급', '일비', '경력무관'], 8);
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
    // keep text
  }

  if (!response.ok) {
    throw new Error(`[CRM저장실패] status=${response.status} body=${compactText(text, 1000)}`);
  }

  console.log(`[CRM저장] ${rows.length}건 전송 완료 / status=${response.status}`);
  console.log(`[CRM저장] 응답: ${compactText(JSON.stringify(json), 1000)}`);
  return json;
}

async function main() {
  const regionArg = env('BUNYANGLINE_REGION_IDS', 'all');
  const maxPages = Math.max(1, Number(env('BUNYANGLINE_MAX_PAGES', '1')) || 1);
  const scrollRounds = Math.max(5, Number(env('BUNYANGLINE_SCROLL_ROUNDS', '80')) || 80);
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
    const seedUrl = `${BASE_URL}/recruit/regional/1`;
    await listPage.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await listPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    await sleep(1000);

    let regionTargets = await extractRegionLinks(listPage);
    if (!regionTargets.length) {
      console.log('[지역발견] 지역 링크 자동 발견 실패 - fallback 지역 URL을 사용합니다.');
      regionTargets = fallbackRegionTargets();
    }

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
      let regionRows: RecruitItem[] = [];
      let regionViewLinks: LinkItem[] = [];

      for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
        const pageUrl = buildListPageUrl(region.url, pageNo);
        console.log('');
        console.log('='.repeat(90));
        console.log(`[${region.name}] 목록 접속: ${pageUrl}`);

        await listPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(async (error) => {
          console.log(`[${region.name}] 목록 접속 실패: ${error?.message || String(error)}`);
        });
        await listPage.waitForLoadState('networkidle', { timeout: 18000 }).catch(() => undefined);
        await sleep(1200);

        const actualRegion = await detectDisplayedRegion(listPage, region.name);
        console.log(`[${region.name}] 실제 표시 지역: ${actualRegion.regionName} / source=${actualRegion.source}`);

        const initialLinks = await extractViewLinks(listPage);
        console.log(`[${region.name}] 초기 상세공고 후보: ${initialLinks.length}건`);

        await autoScroll(listPage, scrollRounds);
        const viewLinks = await extractViewLinks(listPage);
        console.log(`[${region.name}] 스크롤 후 상세공고 후보: ${viewLinks.length}건`);

        regionViewLinks = viewLinks;
        await saveJson(path.join(debugDir, `${safeFileName(region.name)}_view_links.json`), viewLinks);
        await listPage.screenshot({ path: path.join(debugDir, `${safeFileName(region.name)}_list_screenshot.png`), fullPage: true }).catch(() => undefined);

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
              await sendToCrmFunc(batch);
            }
          } catch (error: any) {
            console.log(`[${region.name}] 상세 파싱 실패: ${sourceUrl} / ${error?.message || String(error)}`);
          }
        }
      }

      if (sendToCrmEnabled && regionRows.length % batchSize !== 0) {
        const remain = regionRows.slice(Math.floor(regionRows.length / batchSize) * batchSize);
        if (remain.length) await sendToCrmFunc(remain);
      }

      regionSummaries.push({
        region: region.name,
        regionId: region.id,
        regionUrl: region.url,
        viewLinkCount: regionViewLinks.length,
        parsedCount: regionRows.length,
      });

      await saveJson(path.join(debugDir, `${safeFileName(region.name)}_rows.json`), regionRows);
      console.log(`[${region.name}] 완료: 상세후보 ${regionViewLinks.length}건 / 파싱 ${regionRows.length}건`);
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

  async function sendToCrmFunc(rows: RecruitItem[]) {
    return sendToCrm(rows);
  }
}

main().catch((error) => {
  console.error('[치명적 오류]', error);
  process.exit(1);
});
