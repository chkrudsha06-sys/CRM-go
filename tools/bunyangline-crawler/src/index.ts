
    if (isFeaturedSection(item.ad_section)) {
      keptItems.push(item);
      if (phone) featuredPhones.add(phone);
      continue;
    }

    if (!phone) {
      keptItems.push(item);
      continue;
    }

    if (featuredPhones.has(phone) || generalPhones.has(phone)) {
      skippedGeneralDuplicates.push(item);
      continue;
    }

    keptItems.push(item);
    generalPhones.add(phone);
  }

  return {
    items: keptItems.sort(compareBySectionPriority),
    skippedGeneralDuplicates,
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

    const rawItems = parsed.filter((item): item is BunyanglineItem => Boolean(item));
    const filteredItems = filterGeneralPhoneDuplicates(rawItems);
    const items = filteredItems.items;
    await saveJson(path.join(debugDir, 'page-summaries.json'), pageSummaries);
    await saveJson(path.join(debugDir, 'candidates.json'), dedupedCandidates);
    await saveJson(path.join(debugDir, 'collected-items-raw.json'), rawItems);
    await saveJson(path.join(debugDir, 'collected-items.json'), items);
    await saveJson(path.join(debugDir, 'skipped-general-duplicate-phones.json'), filteredItems.skippedGeneralDuplicates);
    await saveJson(path.join(debugDir, 'failures.json'), failures);

    const batchSize = 100;
    for (let start = 0, batchNo = 1; start < items.length; start += batchSize, batchNo += 1) {
      await sendBatch(items.slice(start, start + batchSize), batchNo);
    }

    const sectionCounts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.ad_section] = (acc[item.ad_section] || 0) + 1;
      return acc;
    }, {});
    console.log(`[완료] 원본 ${rawItems.length}건 · 일반 중복연락처 제외 ${filteredItems.skippedGeneralDuplicates.length}건 · 저장대상 ${items.length}건 · 실패 ${failures.length}건 · 지면 ${JSON.stringify(sectionCounts)}`);
  } finally {
    await client.dispose();
  }
}

main().catch((error) => {
  console.error('[치명적 오류]', error);
  process.exit(1);
});
