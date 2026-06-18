import { chromium, Page } from '@playwright/test';

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

function normalizePhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

function extractPhone(text: string) {
  const match = text.match(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  return normalizePhone(match?.[0] ?? null);
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
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

  const fallback = text.match(/(?:수수료|팀수수료|본부수수료)[^\n]{0,40}/);
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

async function extractDetailUrls(page: Page) {
  const urls = await page.evaluate((baseUrl) => {
    const out = new Set<string>();
    const ignored = [
      '/recruit/regional',
      '/recruit/custom',
      '/recruit/map',
      '/recruit/favorite',
      '/recruit/supporters',
      '/login',
      '/register',
    ];

    function add(raw: string | null) {
      if (!raw) return;
      if (raw.startsWith('javascript:') || raw.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(raw, baseUrl);
      } catch {
        return;
      }

      const path = url.pathname;
      if (!path.includes('/recruit')) return;
      if (ignored.some((item) => path.includes(item))) return;
      if (!/\d/.test(path + url.search)) return;

      url.hash = '';
      out.add(url.toString());
    }

    document.querySelectorAll('a[href]').forEach((anchor) => {
      add(anchor.getAttribute('href'));
    });

    document.querySelectorAll('[onclick]').forEach((node) => {
      const onclick = node.getAttribute('onclick') || '';
      const matches = onclick.match(/['"]([^'"]*recruit[^'"]*)['"]/g) || [];
      matches.forEach((match) => add(match.slice(1, -1)));

      const numberMatch = onclick.match(/(?:idx|id|seq|no)[^0-9]{0,8}(\d{2,})/i) || onclick.match(/\((\d{2,})\)/);
      if (numberMatch?.[1]) {
        add(`/recruit/view/${numberMatch[1]}`);
        add(`/recruit/detail/${numberMatch[1]}`);
        add(`/recruit/${numberMatch[1]}`);
      }
    });

    document.querySelectorAll('*').forEach((node) => {
      for (const attr of Array.from(node.attributes)) {
        if (!/^data-/i.test(attr.name)) continue;
        if (/recruit/i.test(attr.value)) add(attr.value);
        if (/^\d{2,}$/.test(attr.value)) {
          add(`/recruit/view/${attr.value}`);
          add(`/recruit/detail/${attr.value}`);
          add(`/recruit/${attr.value}`);
        }
      }
    });

    return Array.from(out);
  }, BASE_URL);

  return urls;
}

async function parseDetailPage(page: Page, url: string, region: { id: string; name: string }): Promise<CrawledRow> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await sleep(500);

  const text = normalizeSpace(await page.locator('body').innerText({ timeout: 15000 }));
  const pageTitle = normalizeSpace(await page.title().catch(() => '')) || extractPageTitle(text);

  const siteName = extractProjectName(text, pageTitle);
  const siteAddress = pickAfterLabel(text, ['사업지주소', '사업지 주소', '현장주소', '현장 주소', '주소', '근무지 주소'], 220);
  const postedAt = normalizeDate(pickAfterLabel(text, ['등록일', '작성일', '게시일'], 80) || text);
  const managerName = pickAfterLabel(text, ['담당자 이름', '담당자이름', '담당자명', '담당자'], 80);
  const managerPhone = extractPhone(pickAfterLabel(text, ['담당자 연락처', '담당자연락처', '연락처', '휴대폰'], 100) || text);
  const agencyCompany = pickAfterLabel(text, ['대행사', '분양대행사', '분양 대행사'], 120);
  const apartmentFee = extractApartmentFee(text);
  const detailText = extractSection(text, ['상세정보', '상세 정보', '상세요강', '모집내용', '급여정보'], 180);

  return {
    source_url: url,
    source_post_key: sourceKey(url),
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
    raw_text: compact(text),
    crawled_at: new Date().toISOString(),
  };
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
  const headless = env('HEADLESS', 'true') !== 'false';

  const targetRegions = regionArg === 'all'
    ? REGIONS
    : REGIONS.filter((region) => regionArg.split(',').map((item) => item.trim()).includes(region.id));

  if (targetRegions.length === 0) {
    throw new Error(`수집할 지역이 없습니다. BUNYANGLINE_REGION_IDS=${regionArg}`);
  }

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 CRM Bunyangline Data Collector',
  });

  const allRows: CrawledRow[] = [];
  const errors: Array<{ url: string; message: string }> = [];

  try {
    for (const region of targetRegions) {
      const detailUrls = new Set<string>();

      for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
        const listUrl = `${BASE_URL}/recruit/regional/${region.id}/?keyword=&page=${pageNo}`;
        console.log(`[${region.name}] 리스트 접근: ${listUrl}`);
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
        await sleep(1000);

        const urls = await extractDetailUrls(page);
        urls.forEach((url) => detailUrls.add(url));
        console.log(`[${region.name}] ${pageNo}페이지 상세 URL 후보: ${urls.length}개`);
      }

      const selectedUrls = Array.from(detailUrls).slice(0, maxDetailsPerRegion);
      console.log(`[${region.name}] 상세 수집 시작: ${selectedUrls.length}개`);

      for (const url of selectedUrls) {
        try {
          const row = await parseDetailPage(page, url, region);
          allRows.push(row);
          console.log(`수집 완료: ${region.name} / ${row.site_name || '-'} / ${url}`);
        } catch (error) {
          errors.push({ url, message: error instanceof Error ? error.message : String(error) });
          console.error(`수집 실패: ${url}`, error);
        }

        await sleep(900);
      }
    }

    if (allRows.length === 0) {
      throw new Error('수집된 데이터가 없습니다. 상세 URL 추출 패턴 보완이 필요합니다.');
    }

    console.log(`CRM 저장 요청: ${allRows.length}건`);
    const result = await sendToCrm(allRows);
    console.log('CRM 저장 완료:', JSON.stringify(result, null, 2));

    if (errors.length > 0) {
      console.warn('일부 수집 실패:', JSON.stringify(errors, null, 2));
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
