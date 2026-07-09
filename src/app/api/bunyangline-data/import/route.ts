
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

function normalizeAssignedTo(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const allowed = ['조계현', '이세호', '기여운', '최연전'];
  return allowed.includes(text) ? text : null;
}

function buildDbRow(row: ImportItem, existingAssignedTo?: string | null) {
  const sourceUrl = normalizeSourceUrl(firstValue(row, ['source_url', 'sourceUrl', 'source']));
  if (!sourceUrl) return null;

  const postedDatetime = normalizeDateTime(firstValue(row, ['posted_datetime', 'postedDatetime', 'registered_datetime', 'registeredDatetime']));
  const postedAt =
    normalizeDate(firstValue(row, ['posted_at', 'postedAt', 'registered_date', 'registeredDate'])) ||
    (postedDatetime ? postedDatetime.slice(0, 10) : null);

  const managerFields = splitManagerFields(
    firstValue(row, ['manager_name', 'managerName', 'contact_name', 'contactName']),
    firstValue(row, ['manager_phone', 'managerPhone', 'contact_phone', 'contactPhone'])
  );
  const rawTextForSection = firstValue(row, ['raw_text', 'rawText']) || firstValue(row, ['detail_text', 'detailText', 'details']);
  const scopedAgency = extractAgencyFromRawText(rawTextForSection);
  const scopedApartmentFee = extractApartmentFeeFromRawText(rawTextForSection);
  const listRegionName = normalizeText(firstValue(row, ['list_region_name', 'listRegionName', 'region_name', 'regionName', 'region'])) || '미지정';
  const siteAddress = normalizeText(firstValue(row, ['site_address', 'siteAddress', 'business_address', 'businessAddress'])) || null;
  const workAddress = normalizeText(firstValue(row, ['work_address', 'workAddress', 'address'])) || null;
  const actualRegionName = inferActualRegionName({
    listRegionName,
    workAddress,
    siteAddress,
    rawText: rawTextForSection,
  });

  return {
    source_url: sourceUrl,
    source_id: normalizeText(firstValue(row, ['source_id', 'sourceId', 'post_id', 'postId'])) || null,
    region_name: actualRegionName,
    ad_section: normalizeAdSection(firstValue(row, ['ad_section', 'adSection', 'section', 'listing_section', 'listingSection'])),
    site_name: normalizeText(firstValue(row, ['site_name', 'siteName', 'field_name', 'fieldName'])) || '-',
    posted_at: postedAt,
    posted_datetime: postedDatetime,
    manager_name: managerFields.managerName,
    manager_phone: managerFields.managerPhone,
    agency_company: scopedAgency || stripLabelNoise(firstValue(row, ['agency_company', 'agencyCompany', 'agency'])) || '-',
    apartment_fee: scopedApartmentFee || stripLabelNoise(firstValue(row, ['apartment_fee', 'apartmentFee', 'commission', 'fee'])) || null,
    move_in_date: normalizeText(firstValue(row, ['move_in_date', 'moveInDate', 'start_date', 'startDate'])) || '-',
    assigned_to: existingAssignedTo || normalizeAssignedTo(firstValue(row, ['assigned_to', 'assignedTo'])) || null,
    detail_text: normalizeText(firstValue(row, ['detail_text', 'detailText', 'details'])) || null,
    title: normalizeText(firstValue(row, ['title', 'post_title', 'postTitle'])) || null,
    summary: normalizeText(firstValue(row, ['summary', 'subtitle', 'description'])) || null,
    site_address: siteAddress,
    work_address: workAddress,
    category: normalizeText(firstValue(row, ['category', 'product_type', 'productType'])) || null,
    list_date_group: normalizeText(firstValue(row, ['list_date_group', 'listDateGroup'])) || null,
    raw_text: normalizeText(firstValue(row, ['raw_text', 'rawText'])) || null,
    crawled_at: normalizeDateTime(firstValue(row, ['crawled_at', 'crawledAt'])) || new Date().toISOString(),
  };
}

function getSecretFromRequest(request: NextRequest, body: any) {
  const auth = request.headers.get('authorization') ?? '';
  const bearerSecret = auth.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = request.headers.get('x-import-secret') ?? '';
  const querySecret = new URL(request.url).searchParams.get('secret') ?? '';
  const bodySecret = typeof body?.secret === 'string' ? body.secret : '';

  return bearerSecret || headerSecret || querySecret || bodySecret;
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
          message: '분양라인 가져오기 비밀키가 일치하지 않습니다.',
        },
        { status: 401 }
      );
    }

    const rawItems = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ ok: true, received: 0, insertedOrUpdated: 0, skipped: 0, message: '저장할 항목이 없습니다.' });
    }

    const supabase = getSupabaseAdmin();
    const incomingSourceUrls = rawItems
      .map((item: ImportItem) => normalizeSourceUrl(firstValue(item, ['source_url', 'sourceUrl', 'source'])))
      .filter((value: string | null): value is string => Boolean(value));

    const existingAssignedMap = new Map<string, string | null>();

    if (incomingSourceUrls.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from('bunyangline_data')
        .select('id, source_url, assigned_to')
        .in('source_url', Array.from(new Set(incomingSourceUrls)));

      if (existingError) throw existingError;

      (existingRows as ExistingRow[] | null)?.forEach((row) => {
        if (row.source_url) existingAssignedMap.set(row.source_url, row.assigned_to || null);
      });
    }

    const normalizedRows = rawItems
      .map((item: ImportItem) => {
        const sourceUrl = normalizeSourceUrl(firstValue(item, ['source_url', 'sourceUrl', 'source']));
        return buildDbRow(item, sourceUrl ? existingAssignedMap.get(sourceUrl) : null);
      })
      .filter(
        (row: ReturnType<typeof buildDbRow>): row is NonNullable<ReturnType<typeof buildDbRow>> =>
          Boolean(row?.posted_at && row.posted_at >= BUNYANGLINE_START_DATE)
      );

    if (normalizedRows.length === 0) {
      return NextResponse.json({ ok: true, received: rawItems.length, insertedOrUpdated: 0, skipped: rawItems.length, message: '유효한 source_url 항목이 없습니다.' });
    }

    const incomingPhones = Array.from(
      new Set<string>(
        normalizedRows
          .map((row: NonNullable<ReturnType<typeof buildDbRow>>) => phoneKey(row.manager_phone))
          .filter((value: string | null): value is string => Boolean(value))
      )
    );
    let existingPhoneRows: ExistingPhoneRow[] = [];

    if (incomingPhones.length > 0) {
      const { data: phoneRows, error: phoneRowsError } = await supabase
        .from('bunyangline_data')
        .select('source_url, manager_phone, ad_section, posted_at, posted_datetime, created_at')
        .gte('posted_at', BUNYANGLINE_START_DATE)
        .in('manager_phone', incomingPhones);

      if (phoneRowsError) throw phoneRowsError;
      existingPhoneRows = (phoneRows as ExistingPhoneRow[] | null) || [];
    }

    const filtered = filterGeneralPhoneDuplicates(normalizedRows, existingPhoneRows);
    const rows = filtered.rows;

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        received: rawItems.length,
        insertedOrUpdated: 0,
        skipped: rawItems.length,
        skippedGeneralDuplicateCount: filtered.skippedGeneralDuplicateCount,
        message: '상위 지면 또는 기존 일반구인글과 연락처가 중복된 일반구인글만 있어 저장하지 않았습니다.',
      });
    }

    const { data, error } = await supabase
      .from('bunyangline_data')
      .upsert(rows, { onConflict: 'source_url' })
      .select('id, source_url');

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      received: rawItems.length,
      insertedOrUpdated: data?.length ?? rows.length,
      skipped: rawItems.length - rows.length,
      skippedGeneralDuplicateCount: filtered.skippedGeneralDuplicateCount,
      preservedAssignedCount: Array.from(existingAssignedMap.values()).filter(Boolean).length,
    });
  } catch (error) {
    const payload = errorPayload(error);
    console.error('[bunyangline-data/import] 오류:', payload);

    return NextResponse.json(
      {
        ok: false,
        message: '분양라인 데이터 저장 중 오류가 발생했습니다.',
        error: typeof payload === 'object' && payload && 'message' in payload ? (payload as any).message : String(payload),
        errorDetails: payload,
      },
      { status: 500 }
    );
  }
}
