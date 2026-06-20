import { chromium, BrowserContext, Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://www.bunyangline.com';
const IMPORT_URL = process.env.CRM_BUNYANGLINE_IMPORT_URL || '';
const IMPORT_SECRET = process.env.BUNYANGLINE_IMPORT_SECRET || '';
const REGION_ARG = process.env.BUNYANGLINE_REGION_IDS || 'all';
const SCROLL_ROUNDS = Math.max(1, Number(process.env.BUNYANGLINE_SCROLL_ROUNDS || '120') || 120);
const HEADLESS = process.env.HEADLESS !== 'false';
const SEND_TO_CRM = process.env.SEND_TO_CRM !== 'false';
const LOOKBACK_DAYS = Math.max(0, Number(process.env.BUNYANGLINE_LOOKBACK_DAYS || '5') || 5);

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

type Candidate = {
  source_url?: string;
  source_id?: string;
  title: string;
  region_name: string;
  ad_section: string;
  list_date_group?: string | null;
  raw_text?: string | null;
  origin: 'href' | 'html' | 'title-click';
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

function oneLine(value: unknown, max = 160) {
  return normalizeText(value).replace(/\s+/g, ' ').slice(0, max);
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|#%&{}$!`'@+=]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
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

function hasOlderThanCutoffDate(text: string) {
  const cutoff = cutoffKstDate();
  const matches = Array.from(text.matchAll(/20\d{2}-\d{2}-\d{2}/g)).map((item) => item[0]);
  return matches.some((date) => date < cutoff);
}

function normalizeSourceUrl(value: string) {
  const url = new URL(value, BASE_URL);
  url.hash = '';
  if (!url.searchParams.get('previousActiveNaviId')) {
    url.searchParams.set('previousActiveNaviId', 'regional');
  }
  return url.toString();
}

function extractSourceId(sourceUrl: string) {
  return sourceUrl.match(/\/recruit\/view\/(\d+)/)?.[1] || null;
}

function normalizePhone(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return '-';

  const phone = text.match(/(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0];
  if (phone) return phone.replace(/\D/g, '');

  const tel = text.match(/(?:02|0[3-6]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}/)?.[0];
  if (tel) return tel.replace(/\D/g, '');

  const digits = text.replace(/\D/g, '');
  return digits || text;
}

function isMetaLine(line: string) {
  const value = normalizeText(line);
  if (!value) return true;
  if (/^AD$/i.test(value)) return true;
  if (/^(HOME|지역현장|맞춤현장|지도현장|관심현장|서포터즈)$/.test(value)) return true;
  if (/^(유니크|슈페리어|전국 Top|전국TOP|지역 Top|지역TOP|일반 구인글|일반구인글)$/.test(value)) return true;
  if (/^(소수|신규|HOT|대박|TODAY)$/.test(value)) return true;
  if (/^\(총\s*\d+개\)$/.test(value)) return true;
  if (/^20\d{2}-\d{2}-\d{2}$/.test(value)) return true;
  if (/^(팀장\/팀원|본부\/팀장|팀원|팀장|본부장|계약 수수료|일비|경력무관|\d+개월이상|캐치뷰어)$/.test(value)) return true;
  if (/^(아파트|오피스텔|아파트\/오피스텔|아파트\/기타|기타|도시형 생활주택|지식산업센터|아파트\/상가\/쇼핑몰|오피스텔\/상가\/쇼핑몰|상가\/쇼핑몰)$/.test(value)) return true;
  return false;
}

function isLikelyCategoryLine(line: string) {
  const value = normalizeText(line);
  if (!value) return false;
  if (value.length > 30) return false;
  return /(아파트|오피스텔|상가|쇼핑몰|도시형|생활주택|지식산업센터|기타|호텔|레지던스)/.test(value);
}

function isLikelyTitleLine(line: string) {
  const value = normalizeText(line);
  if (!value) return false;
  if (value.length < 5 || value.length > 95) return false;
  if (isMetaLine(value)) return false;
  if (/^(검색어를 입력해주세요|사용자수|오늘|전체|방문회원|오늘방문|신규현장|오늘신규|홈|로그인|회원가입)/.test(value)) return false;
  return true;
}

function normalizeSection(value: string) {
  const text = normalizeText(value).replace(/\s+/g, '');
  if (text.includes('유니크')) return '유니크';
  if (text.includes('슈페리어')) return '슈페리어';
  if (text.includes('전국Top') || text.includes('전국TOP')) return '전국TOP';
  if (text.includes('지역Top') || text.includes('지역TOP')) return '지역TOP';
  if (text.includes('일반구인글')) return '일반구인글';
  return normalizeText(value) || '미지정';
}

function extractTitleCandidatesFromText(text: string, regionName: string): Candidate[] {
  const lines = text
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const today = currentKstDate();
  let section = '미지정';
  let listDateGroup: string | null = null;
  const candidates = new Map<string, Candidate>();

  const setCandidate = (title: string, index: number) => {
    const cleanTitle = normalizeText(title);
    if (!isLikelyTitleLine(cleanTitle)) return;

    if (listDateGroup && !isRecentDate(listDateGroup)) return;

    const rawText = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 8)).join(' / ');
    const key = `${regionName}|${section}|${listDateGroup || ''}|${cleanTitle}`;
    if (candidates.has(key)) return;

    candidates.set(key, {
      title: cleanTitle,
      region_name: regionName,
      ad_section: normalizeSection(section),
      list_date_group: listDateGroup,
      raw_text: rawText,
      origin: 'title-click',
    });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const compact = line.replace(/\s+/g, '');

    if (/^(유니크|슈페리어|전국 Top|전국TOP|지역 Top|지역TOP|일반 구인글|일반구인글)$/.test(line)) {
      section = normalizeSection(line);
      if (section !== '일반구인글') listDateGroup = null;
      continue;
    }

    if (line === 'TODAY') {
      section = '일반구인글';
      listDateGroup = today;
      continue;
    }

    if (/^20\d{2}-\d{2}-\d{2}$/.test(line)) {
      section = '일반구인글';
      listDateGroup = line;
      continue;
    }

    if (isLikelyCategoryLine(line) && isLikelyTitleLine(lines[i + 1] || '')) {
      setCandidate(lines[i + 1], i + 1);
      continue;
    }

    // 섹션 바로 아래에서 카테고리/배지 라인을 건너뛰고 제목이 나오는 구조 대응
    if (['유니크', '슈페리어', '전국TOP', '지역TOP', '일반구인글'].includes(section)) {
      const prev = lines[i - 1] || '';
      if (isLikelyCategoryLine(prev) && isLikelyTitleLine(line)) {
        setCandidate(line, i);
      }
    }
  }

  return Array.from(candidates.values());
}

async function getBodyText(page: Page) {
  return normalizeText(await page.locator('body').innerText({ timeout: 10000 }).catch(() => ''));
}

async function getHtml(page: Page) {
  return page.content().catch(() => '');
}

async function collectAnchorViewLinks(page: Page, regionName: string): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const anchors = page.locator('a');
  const count = await anchors.count().catch(() => 0);

  for (let index = 0; index < Math.min(count, 3000); index += 1) {
    const anchor = anchors.nth(index);
    const href = await anchor.getAttribute('href').catch(() => null);
    if (!href || !href.includes('/recruit/view/')) continue;

    const text = oneLine(await anchor.innerText({ timeout: 500 }).catch(() => '')) || `공고 ${href.match(/\/recruit\/view\/(\d+)/)?.[1] || ''}`;
    const sourceUrl = normalizeSourceUrl(href);

    candidates.push({
      source_url: sourceUrl,
      source_id: extractSourceId(sourceUrl) || undefined,
      title: text,
      region_name: regionName,
      ad_section: '일반구인글',
      list_date_group: null,
      raw_text: text,
      origin: 'href',
    });
  }

  return candidates;
}

function collectHtmlViewLinks(html: string, regionName: string): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const patterns = [
    /https?:\/\/www\.bunyangline\.com\/recruit\/view\/(\d+)\/?[^"'\s<]*/g,
    /\/recruit\/view\/(\d+)\/?[^"'\s<]*/g,
    /recruit\/view\/(\d+)\/?[^"'\s<]*/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[0].startsWith('http') ? match[0] : `/${match[0].replace(/^\//, '')}`;
      const sourceUrl = normalizeSourceUrl(raw);
      if (seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);

      candidates.push({
        source_url: sourceUrl,
        source_id: match[1],
        title: `공고 ${match[1]}`,
        region_name: regionName,
        ad_section: '일반구인글',
        list_date_group: null,
        raw_text: `html-link:${match[0]}`,
        origin: 'html',
      });
    }
  }

  return candidates;
}

function mergeCandidates(candidates: Candidate[]) {
  const byUrl = new Map<string, Candidate>();
  const noUrl: Candidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.source_url) {
      const key = `${candidate.region_name}|${candidate.ad_section}|${candidate.list_date_group || ''}|${candidate.title}`;
      if (!noUrl.some((item) => `${item.region_name}|${item.ad_section}|${item.list_date_group || ''}|${item.title}` === key)) {
        noUrl.push(candidate);
      }
      continue;
    }

    const existing = byUrl.get(candidate.source_url);
    if (!existing) {
      byUrl.set(candidate.source_url, candidate);
      continue;
    }

    byUrl.set(candidate.source_url, {
      ...existing,
      title: existing.title.startsWith('공고 ') && !candidate.title.startsWith('공고 ') ? candidate.title : existing.title,
      ad_section: existing.ad_section !== '미지정' ? existing.ad_section : candidate.ad_section,
      list_date_group: existing.list_date_group || candidate.list_date_group,
      raw_text: existing.raw_text || candidate.raw_text,
    });
  }

  return { withUrl: Array.from(byUrl.values()), noUrl };
}

async function gotoList(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch((error) => {
    console.log(`[목록접속] page.goto 경고: ${error?.message || String(error)}`);
    return null;
  });

  await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => undefined);
  await sleep(2500);

  return response?.status() || null;
}

async function discoverSourceUrlByClick(page: Page, listUrl: string, candidate: Candidate): Promise<string | null> {
  const title = candidate.title;
  const locators = [
    page.getByText(title, { exact: true }).first(),
    page.getByText(title, { exact: false }).first(),
  ];

  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    if (!count) continue;

    try {
      const popupPromise = page.waitForEvent('popup', { timeout: 2500 }).catch(() => null);
      const urlPromise = page
        .waitForURL((url) => url.toString().includes('/recruit/view/'), { timeout: 4500 })
        .catch(() => null);

      await locator.click({ timeout: 4000, force: true });

      const popup = await popupPromise;
      if (popup) {
        await popup.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => undefined);
        const popupUrl = popup.url();
        await popup.close().catch(() => undefined);
        if (popupUrl.includes('/recruit/view/')) return normalizeSourceUrl(popupUrl);
      }

      await urlPromise;
      const currentUrl = page.url();
      if (currentUrl.includes('/recruit/view/')) {
        const sourceUrl = normalizeSourceUrl(currentUrl);
        await gotoList(page, listUrl);
        return sourceUrl;
      }
    } catch {
      // 다음 locator 방식 시도
    }

    if (page.url() !== listUrl && !page.url().includes('/recruit/regional/')) {
      await gotoList(page, listUrl);
    }
  }

  return null;
}

async function discoverRegionCandidates(page: Page, region: Region, debugDir: string) {
  const listUrl = `${BASE_URL}/recruit/regional/${region.id}`;
  console.log('');
  console.log('='.repeat(90));
  console.log(`[${region.name}] 목록 접속: ${listUrl}`);

  const responseStatus = await gotoList(page, listUrl);
  const prefix = safeFileName(`${region.id}_${region.name}_${Date.now()}`);

  let previousTextLength = 0;
  let stableRounds = 0;
  let olderDateSeen = false;
  let lastCandidateCount = 0;

  for (let round = 0; round <= SCROLL_ROUNDS; round += 1) {
    const bodyText = await getBodyText(page);
    const html = await getHtml(page);
    olderDateSeen = olderDateSeen || hasOlderThanCutoffDate(bodyText);

    const merged = mergeCandidates([
      ...collectHtmlViewLinks(html, region.name),
      ...(await collectAnchorViewLinks(page, region.name)),
      ...extractTitleCandidatesFromText(bodyText, region.name),
    ]);

    const totalCandidates = merged.withUrl.length + merged.noUrl.length;

    if (round === 0) {
      console.log(`[${region.name}] 응답 status: ${responseStatus ?? '-'}`);
      console.log(`[${region.name}] body text 길이: ${bodyText.length.toLocaleString()}`);
      console.log(`[${region.name}] 초기 후보: URL ${merged.withUrl.length}건 / 제목클릭 ${merged.noUrl.length}건`);
      await saveText(path.join(debugDir, `${prefix}_visible_text_initial.txt`), bodyText);
      await saveText(path.join(debugDir, `${prefix}_html_initial.html`), html.slice(0, 300000));
      await saveJson(path.join(debugDir, `${prefix}_candidates_initial.json`), merged);
      await page.screenshot({ path: path.join(debugDir, `${prefix}_initial.png`), fullPage: true }).catch(() => undefined);
    }

    if (round > 0 && round % 5 === 0) {
      const delta = totalCandidates - lastCandidateCount;
      console.log(
        `[${region.name}] 스크롤 ${round}/${SCROLL_ROUNDS}: URL ${merged.withUrl.length}건 / 제목클릭 ${merged.noUrl.length}건 / 후보증가 ${delta >= 0 ? '+' : ''}${delta} / 오래된날짜 ${olderDateSeen ? 'Y' : 'N'}`,
      );
      lastCandidateCount = totalCandidates;
    }

    if (bodyText.length === previousTextLength) stableRounds += 1;
    else stableRounds = 0;
    previousTextLength = bodyText.length;

    if (round >= 12 && stableRounds >= 8 && olderDateSeen) {
      console.log(`[${region.name}] 최근 ${LOOKBACK_DAYS}일 이전 날짜 확인 + 화면 변화 없음 → 스크롤 종료`);
      break;
    }

    if (round === SCROLL_ROUNDS) break;

    await page.mouse.wheel(0, 2600).catch(() => undefined);
    await sleep(450);
  }

  const finalText = await getBodyText(page);
  const finalHtml = await getHtml(page);
  const finalMerged = mergeCandidates([
    ...collectHtmlViewLinks(finalHtml, region.name),
    ...(await collectAnchorViewLinks(page, region.name)),
    ...extractTitleCandidatesFromText(finalText, region.name),
  ]);

  await saveText(path.join(debugDir, `${prefix}_visible_text_final.txt`), finalText);
  await saveText(path.join(debugDir, `${prefix}_html_final.html`), finalHtml.slice(0, 500000));
  await saveJson(path.join(debugDir, `${prefix}_candidates_final_before_click.json`), finalMerged);
  await page.screenshot({ path: path.join(debugDir, `${prefix}_final.png`), fullPage: true }).catch(() => undefined);

  console.log(`[${region.name}] 스크롤 완료 후보: URL ${finalMerged.withUrl.length}건 / 제목클릭 ${finalMerged.noUrl.length}건`);

  // URL이 없는 광고/상단지면/최근 일반 공고는 제목 클릭으로 상세 URL 확보
  const clicked: Candidate[] = [];
  const clickTargets = finalMerged.noUrl.filter((candidate) => {
    if (candidate.list_date_group && !isRecentDate(candidate.list_date_group)) return false;
    return ['유니크', '슈페리어', '전국TOP', '지역TOP', '일반구인글'].includes(candidate.ad_section);
  });

  if (clickTargets.length > 0) {
    await gotoList(page, listUrl);
    await sleep(1000);
    console.log(`[${region.name}] 제목 클릭으로 상세 URL 확인 시작: ${clickTargets.length}건`);
  }

  for (let index = 0; index < clickTargets.length; index += 1) {
    const target = clickTargets[index];
    if (index > 0 && index % 10 === 0) {
      console.log(`[${region.name}] 제목 클릭 진행 ${index}/${clickTargets.length}`);
    }

    const sourceUrl = await discoverSourceUrlByClick(page, listUrl, target);
    if (!sourceUrl) continue;

    clicked.push({
      ...target,
      source_url: sourceUrl,
      source_id: extractSourceId(sourceUrl) || undefined,
    });
  }

  const final = mergeCandidates([...finalMerged.withUrl, ...clicked]);
  await saveJson(path.join(debugDir, `${prefix}_candidates_final_after_click.json`), final);

  console.log(`[${region.name}] 최종 상세 URL 후보: ${final.withUrl.length}건 / 클릭성공 ${clicked.length}건`);
  return final.withUrl;
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
      .slice(0, 4)
      .join(' / ');
    return useful || salarySection.slice(0, 200);
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
    for (let index = 0; index < Math.min(count, 6); index += 1) {
      const text = oneLine(await loc.nth(index).innerText({ timeout: 500 }).catch(() => ''));
      if (text && !isMetaLine(text) && text.length >= 5) return text;
    }
  }
  return fallback;
}

async function parseDetail(context: BrowserContext, candidate: Candidate): Promise<BunyanglineItem | null> {
  if (!candidate.source_url) return null;

  const page = await context.newPage();
  try {
    await page.goto(candidate.source_url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch((error) => {
      console.log(`[상세] page.goto 경고: ${candidate.source_url} / ${error?.message || String(error)}`);
      return null;
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => undefined);
    await sleep(1200);

    const rawText = await getBodyText(page);
    const lines = rawText.split('\n').map((line) => normalizeText(line)).filter(Boolean);
    const firstDateTime = rawText.match(/20\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2}\s+\d{1,2}:\d{2}:\d{2}/)?.[0] || null;
    const dateInfo = parseDateTime(firstDateTime || candidate.list_date_group || '');

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
    const summary = lines.find((line) => line !== title && line.length >= 10 && line.length <= 120 && !line.includes('지역현장')) || candidate.raw_text || null;
    const detailText = extractDetailSection(lines, ['상세정보', '상세 정보'], ['접수방법', '접수 방법', '기업정보', '사업자 정보']) || rawText.slice(0, 3000) || '-';

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

  console.log('분양라인 상세페이지 기준 크롤러를 시작합니다.');
  console.log(`- 수집 기준: /recruit/view/{공고ID} 상세페이지`);
  console.log(`- 출력 기준: 지역/게재지면/현장명/등록일/담당자/연락처/대행사/수수료/투입일/상세정보`);
  console.log(`- 중복 기준: source_url 단독`);
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

  try {
    for (const region of targetRegions) {
      const candidates = await discoverRegionCandidates(listPage, region, debugDir);
      const uniqueCandidates = mergeCandidates(candidates).withUrl;

      console.log(`[${region.name}] 상세 파싱 시작: ${uniqueCandidates.length}건`);
      let regionSaved = 0;

      for (let index = 0; index < uniqueCandidates.length; index += 1) {
        const candidate = uniqueCandidates[index];
        if (!candidate.source_url) continue;

        if (index > 0 && index % 20 === 0) {
          console.log(`[${region.name}] 상세 파싱 진행 ${index}/${uniqueCandidates.length} / 저장대상 ${regionSaved}건`);
        }

        try {
          const item = await parseDetail(context, candidate);
          if (!item) continue;
          allItems.push(item);
          regionSaved += 1;
        } catch (error: any) {
          const reason = error?.message || String(error);
          failures.push({ region: region.name, source_url: candidate.source_url, title: candidate.title, reason });
          console.log(`[${region.name}] 상세 파싱 실패: ${candidate.source_url} / ${reason}`);
        }
      }

      console.log(`[${region.name}] 완료: 후보 ${uniqueCandidates.length}건 / 최근 ${LOOKBACK_DAYS}일 저장대상 ${regionSaved}건 / 실패 누적 ${failures.length}건`);
    }

    const deduped = Array.from(new Map(allItems.map((item) => [item.source_url, item])).values());
    await saveJson(path.join(debugDir, 'collected-items.json'), deduped);
    await saveJson(path.join(debugDir, 'failures.json'), failures);

    console.log('');
    console.log('='.repeat(90));
    console.log(`[최종] 수집 대상: ${deduped.length}건 / 실패: ${failures.length}건`);

    const batchSize = 50;
    for (let start = 0; start < deduped.length; start += batchSize) {
      const batch = deduped.slice(start, start + batchSize);
      await sendBatch(batch, Math.floor(start / batchSize) + 1);
    }

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
