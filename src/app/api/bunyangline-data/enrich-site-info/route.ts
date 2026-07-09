import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUNYANGLINE_START_DATE = process.env.BUNYANGLINE_START_DATE || '2026-07-01';

type BunyanglineEnrichRow = {
  id: number | string;
  source_url: string | null;
  site_name: string | null;
  title: string | null;
  summary: string | null;
  detail_text: string | null;
  raw_text: string | null;
  site_address: string | null;
  work_address: string | null;
  posted_at: string | null;
  resolved_site_name?: string | null;
  unit_count?: string | null;
  complex_count?: string | null;
  unit_count_checked_at?: string | null;
};

type SiteNameCandidate = {
  name: string;
  score: number;
  source: string;
};

type UnitCandidate = {
  unitCount: string | null;
  complexCount: string | null;
  source: string | null;
  confidence: number | null;
};

const GENERIC_SITE_NAME_PATTERNS = [
  /현장\s*사무실/,
  /분양\s*사무실/,
  /모델\s*하우스/,
  /홍보관/,
  /상담\s*사무실/,
  /분양\s*홍보관/,
  /^현장$/,
  /^사무실$/,
  /^본부$/,
  /^모집$/,
  /팀장\s*모집/,
  /팀원\s*모집/,
  /직원\s*모집/,
  /사이드\s*모집/,
  /분양\s*영업\s*팀/,
];

const SITE_NAME_KEYWORDS = [
  '힐스테이트',
  '자이',
  '푸르지오',
  '롯데캐슬',
  '래미안',
  '아이파크',
  '더샵',
  '포레나',
  '디에트르',
  '우미린',
  '중흥',
  'S클래스',
  'e편한세상',
  '이편한세상',
  '월드메르디앙',
  '센트럴',
  '파크',
  '시티',
  '레이크',
  '타워',
  '리버',
  '스카이',
  '프라자',
  '오피스텔',
  '아파트',
  '지식산업센터',
  '생활숙박',
  '빌리지',
  '레지던스',
  '더하이브',
  '브릿지',
];

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Supabase 환경변수가 누락되었습니다. NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl ? '있음' : '없음'}, SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey ? '있음' : '없음'}`
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}

function collectRegexMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const safePattern = new RegExp(pattern.source, flags);
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = safePattern.exec(text)) !== null) {
    matches.push(match);
    if (match[0] === '') safePattern.lastIndex += 1;
  }

  return matches;
}

function getSecretFromRequest(request: NextRequest, body: any) {
  const auth = request.headers.get('authorization') ?? '';
  const bearerSecret = auth.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = request.headers.get('x-import-secret') ?? '';
  const querySecret = new URL(request.url).searchParams.get('secret') ?? '';
  const bodySecret = typeof body?.secret === 'string' ? body.secret : '';

  return bearerSecret || headerSecret || querySecret || bodySecret;
}

function normalizeSourceUrl(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  try {
    const url = new URL(raw, 'https://www.bunyangline.com');
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}

function compactForCompare(value: unknown) {
  return String(value ?? '').replace(/[\s·ㆍ\-_()[\]{}'"“”‘’《》〈〉<>]/g, '').toLowerCase();
}

function isGenericSiteName(value: unknown) {
  const text = normalizeText(value);
  if (!text) return true;
  const compact = text.replace(/\s+/g, '');
  return GENERIC_SITE_NAME_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(compact));
}

function stripSiteNameDecorations(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;

  const cleaned = text
    .replace(/^[\s■◆◇●○★☆▶▷▸※ㆍ·\-[\]【】《》〈〉<>"'“”‘’]+/g, '')
    .replace(/[\s■◆◇●○★☆▶▷▸※ㆍ·\-[\]【】《》〈〉<>"'“”‘’]+$/g, '')
    .replace(/^(현장명|사업지명|사업지|현장)\s*[:：]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || null;
}

function isLikelySiteName(value: unknown) {
  const text = stripSiteNameDecorations(value);
  if (!text) return false;
  if (text.length < 3 || text.length > 42) return false;
  if (isGenericSiteName(text)) return false;
  if (/(010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}/.test(text)) return false;
  if (/\d+\s*(만|만원|억|%|평|개월|월|일|호선)/.test(text)) return false;
  if (/(계약|수수료|광고|지원|모집|팀장|팀원|직원|담당자|연락처|조건|변경|내용|급구|채용|문의|상담)/.test(text) && !SITE_NAME_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return false;
  }
  return /[가-힣A-Za-z]/.test(text);
}

function pushSiteNameCandidate(candidates: SiteNameCandidate[], value: unknown, score: number, source: string) {
  const name = stripSiteNameDecorations(value);
  if (!isLikelySiteName(name)) return;

  const keywordBonus = SITE_NAME_KEYWORDS.some((keyword) => String(name).includes(keyword)) ? 16 : 0;
  const existing = candidates.find((candidate) => compactForCompare(candidate.name) === compactForCompare(name));
  if (existing) {
    existing.score = Math.max(existing.score, score + keywordBonus);
    existing.source = `${existing.source},${source}`;
    return;
  }

  candidates.push({ name: name as string, score: score + keywordBonus, source });
}

function extractBracketedSiteNameCandidates(textValue: unknown) {
  const text = normalizeText(textValue);
  if (!text) return [];

  const candidates: string[] = [];
  const patterns = [
    /[■◆◇●○★☆▶▷▸]\s*([^■◆◇●○★☆▶▷▸\n]{3,42})\s*[■◆◇●○★☆▶▷▸]/g,
    /[【\[]\s*([^\]】\n]{3,42})\s*[\]】]/g,
    /[《〈]\s*([^》〉\n]{3,42})\s*[》〉]/g,
    /["“']\s*([^"”'\n]{3,42})\s*["”']/g,
  ];

  for (const pattern of patterns) {
    for (const match of collectRegexMatches(text, pattern)) {
      if (match[1]) candidates.push(match[1]);
    }
  }

  return candidates;
}

function extractLabeledSiteNameCandidates(textValue: unknown) {
  const text = normalizeText(textValue);
  if (!text) return [];

  const candidates: string[] = [];
  const patterns = [
    /(?:현장명|사업지명|사업지\s*현장명|사업지|프로젝트명)\s*[:：]\s*([^\n]{3,60})/g,
    /(?:현장명|사업지명|프로젝트명)\s+([^\n]{3,60})/g,
  ];

  for (const pattern of patterns) {
    for (const match of collectRegexMatches(text, pattern)) {
      if (match[1]) candidates.push(match[1]);
    }
  }

  return candidates;
}

function extractProminentLineSiteCandidates(textValue: unknown) {
  const text = normalizeText(textValue);
  if (!text) return [];

  return text
    .split('\n')
    .slice(0, 35)
    .map((line) => stripSiteNameDecorations(line))
    .filter((line): line is string => Boolean(line && SITE_NAME_KEYWORDS.some((keyword) => line.includes(keyword))));
}

function resolveSiteName(row: BunyanglineEnrichRow) {
  const candidates: SiteNameCandidate[] = [];

  for (const value of extractBracketedSiteNameCandidates(row.detail_text)) pushSiteNameCandidate(candidates, value, 70, 'detail_bracket');
  for (const value of extractLabeledSiteNameCandidates(row.detail_text)) pushSiteNameCandidate(candidates, value, 68, 'detail_label');
  for (const value of extractProminentLineSiteCandidates(row.detail_text)) pushSiteNameCandidate(candidates, value, 55, 'detail_line');
  for (const value of extractBracketedSiteNameCandidates(row.raw_text)) pushSiteNameCandidate(candidates, value, 48, 'raw_bracket');
  for (const value of extractLabeledSiteNameCandidates(row.raw_text)) pushSiteNameCandidate(candidates, value, 45, 'raw_label');
  pushSiteNameCandidate(candidates, row.title, 38, 'title');
  pushSiteNameCandidate(candidates, row.summary, 28, 'summary');
  pushSiteNameCandidate(candidates, row.site_name, isGenericSiteName(row.site_name) ? 8 : 42, 'site_name');

  const sorted = candidates.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  const best = sorted[0];
  if (best && best.score >= 42) return { value: best.name, confidence: Math.min(best.score, 99), source: best.source };

  const fallback = stripSiteNameDecorations(row.site_name);
  if (fallback && !isGenericSiteName(fallback)) return { value: fallback, confidence: 35, source: 'site_name_fallback' };

  return { value: null, confidence: 0, source: null };
}

function formatUnitCount(value: number, suffix = '세대') {
  return `${value.toLocaleString('ko-KR')}${suffix}`;
}

function parseCountNumber(value: string) {
  const number = Number(value.replace(/[^\d]/g, ''));
  if (!Number.isFinite(number)) return null;
  return number;
}

function extractUnitCountFromText(textValue: unknown, source: string): UnitCandidate {
  const text = normalizeText(textValue);
  if (!text) return { unitCount: null, complexCount: null, source: null, confidence: null };

  let unitCount: string | null = null;
  let complexCount: string | null = null;
  let confidence = 0;

  const unitPatterns = [
    /(?:총|전체|규모|세대수|공급규모|공급\s*세대)\s*[:：]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,5})\s*(세대|가구)/g,
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,5})\s*(세대|가구)/g,
  ];

  for (const pattern of unitPatterns) {
    for (const match of collectRegexMatches(text, pattern)) {
      const count = parseCountNumber(match[1]);
      if (!count || count < 20 || count > 30000) continue;

      const start = Math.max(0, match.index - 18);
      const end = Math.min(text.length, match.index + match[0].length + 18);
      const context = text.slice(start, end);
      if (/(만원|억|%|평|개월|호선|년|월|일)/.test(context.replace(match[0], ''))) continue;

      const candidateConfidence =
        (source === 'detail_text' ? 86 : source === 'raw_text' ? 78 : 70) +
        (/총|전체|규모|세대수|공급/.test(match[0]) ? 8 : 0);

      if (candidateConfidence > confidence) {
        unitCount = formatUnitCount(count, match[2] === '가구' ? '가구' : '세대');
        confidence = candidateConfidence;
      }
    }
  }

  const complexPatterns = [
    /(?:총|전체|규모)?\s*([0-9]{1,2})\s*개\s*단지/g,
    /([0-9]{1,2})\s*개\s*블록/g,
  ];

  for (const pattern of complexPatterns) {
    for (const match of collectRegexMatches(text, pattern)) {
      const count = parseCountNumber(match[1]);
      if (!count || count < 1 || count > 50) continue;
      complexCount = pattern.source.includes('블록') ? `${count}개 블록` : `${count}개 단지`;
      break;
    }
    if (complexCount) break;
  }

  return {
    unitCount,
    complexCount,
    source: unitCount || complexCount ? source : null,
    confidence: unitCount ? Math.min(confidence, 99) : complexCount ? 62 : null,
  };
}

function pickBestUnitCandidate(candidates: UnitCandidate[]) {
  const found = candidates
    .filter((candidate) => candidate.unitCount || candidate.complexCount)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  const best = found[0] || { unitCount: null, complexCount: null, source: null, confidence: null };
  const complex = best.complexCount || found.find((candidate) => candidate.complexCount)?.complexCount || null;

  return {
    ...best,
    complexCount: complex,
  };
}

function enrichRow(row: BunyanglineEnrichRow) {
  const resolved = resolveSiteName(row);
  const bestCount = pickBestUnitCandidate([
    extractUnitCountFromText(row.detail_text, 'detail_text'),
    extractUnitCountFromText(`${row.title ?? ''}\n${row.summary ?? ''}`, 'title_summary'),
    extractUnitCountFromText(row.raw_text, 'raw_text'),
  ]);

  return {
    resolved_site_name: resolved.value,
    unit_count: bestCount.unitCount,
    complex_count: bestCount.complexCount,
    unit_count_source: bestCount.source,
    unit_count_source_url: bestCount.source ? normalizeSourceUrl(row.source_url) : null,
    unit_count_confidence: bestCount.confidence,
    unit_count_checked_at: new Date().toISOString(),
  };
}

function errorPayload(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (typeof error === 'object' && error !== null) return error;
  return { message: String(error) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const expectedSecret = process.env.BUNYANGLINE_IMPORT_SECRET;
    const incomingSecret = getSecretFromRequest(request, body);

    if (expectedSecret && incomingSecret !== expectedSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: '분양라인 보강 비밀키가 일치하지 않습니다.',
        },
        { status: 401 }
      );
    }

    const limit = Math.min(Math.max(Number(body?.limit || 500), 1), 2000);
    const force = body?.force === true || body?.force === 'true';
    const dryRun = body?.dryRun === true || body?.dryRun === 'true';
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('bunyangline_data')
      .select('id, source_url, site_name, title, summary, detail_text, raw_text, site_address, work_address, posted_at, resolved_site_name, unit_count, complex_count, unit_count_checked_at')
      .gte('posted_at', BUNYANGLINE_START_DATE)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!force) {
      query = query.is('unit_count_checked_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as BunyanglineEnrichRow[];
    const updates = rows.map((row) => ({
      id: row.id,
      source_url: row.source_url,
      site_name: row.site_name,
      ...enrichRow(row),
    }));

    if (!dryRun) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('bunyangline_data')
          .update({
            resolved_site_name: update.resolved_site_name,
            unit_count: update.unit_count,
            complex_count: update.complex_count,
            unit_count_source: update.unit_count_source,
            unit_count_source_url: update.unit_count_source_url,
            unit_count_confidence: update.unit_count_confidence,
            unit_count_checked_at: update.unit_count_checked_at,
          })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }
    }

    const foundUnitCount = updates.filter((row) => row.unit_count).length;
    const foundComplexCount = updates.filter((row) => row.complex_count).length;
    const resolvedSiteNameCount = updates.filter((row) => row.resolved_site_name).length;

    return NextResponse.json({
      ok: true,
      dryRun,
      force,
      scanned: rows.length,
      updated: dryRun ? 0 : updates.length,
      resolvedSiteNameCount,
      foundUnitCount,
      foundComplexCount,
      samples: updates
        .filter((row) => row.resolved_site_name || row.unit_count || row.complex_count)
        .slice(0, 20)
        .map((row) => ({
          id: row.id,
          original_site_name: row.site_name,
          resolved_site_name: row.resolved_site_name,
          unit_count: row.unit_count,
          complex_count: row.complex_count,
          confidence: row.unit_count_confidence,
          source: row.unit_count_source,
          source_url: row.unit_count_source_url,
        })),
    });
  } catch (error) {
    const payload = errorPayload(error);
    console.error('[bunyangline-data/enrich-site-info] 오류:', payload);

    return NextResponse.json(
      {
        ok: false,
        message: '분양라인 현장정보 보강 중 오류가 발생했습니다.',
        error: typeof payload === 'object' && payload && 'message' in payload ? (payload as any).message : String(payload),
        errorDetails: payload,
      },
      { status: 500 }
    );
  }
}
