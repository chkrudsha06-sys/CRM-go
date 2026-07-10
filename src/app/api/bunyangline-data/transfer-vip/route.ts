import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASSIGNEES = ['조계현', '이세호', '기여운', '최연전'];
const INTAKE_ROUTES = ['분양의신DB', '컨설턴트VIP DB', '완판트럭', '분양라인', '분양회MGM', '채널톡', '대협팀활동'];
const MANAGEMENT_STAGES = ['리드', '프로스펙팅', '딜클로징', '리텐션'];
const CUSTOMER_GRADES = ['마스터', '챌린저', '추가 심사 후보', '브론즈', '심사미진행', '판정 보류'];
const DEFAULT_ASSIGNED_TO = '조계현';
const VIP_DB_SOURCE = 'vip_activity';
const VIP_SELECT_FIELDS =
  'id,name,title,phone,intake_route,company,management_stage,customer_grade,memo,created_at,updated_at,crm_db_source,vip_transferred_at,assigned_to';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase 환경변수가 누락되었습니다.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function text(value: unknown) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function multilineText(value: unknown) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizePhone(value: unknown) {
  const raw = text(value);
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function pickAllowed(value: unknown, allowed: string[], fallback: string) {
  const picked = text(value);
  return allowed.includes(picked) ? picked : fallback;
}

function errorPayload(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (typeof error === 'object' && error !== null) return error;
  return { message: String(error) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rowId = text(body?.row_id ?? body?.rowId ?? body?.id);
    const contact = body?.contact ?? {};

    if (!rowId) {
      return NextResponse.json({ ok: false, message: '분양라인 데이터 id가 필요합니다.' }, { status: 400 });
    }

    const name = text(contact?.name);
    const phone = normalizePhone(contact?.phone);

    if (!name) {
      return NextResponse.json({ ok: false, message: '고객명을 입력해주세요.' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ ok: false, message: '연락처를 입력해주세요.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();

    const { data: sourceRow, error: sourceError } = await supabase
      .from('bunyangline_data')
      .select('id, site_name, region_name, ad_section, manager_name, manager_phone, agency_company, assigned_to, source_url, vip_contact_id, vip_transferred_at')
      .eq('id', rowId)
      .single();

    if (sourceError) throw sourceError;

    const assignedTo = pickAllowed(contact?.assigned_to || sourceRow?.assigned_to, ASSIGNEES, DEFAULT_ASSIGNED_TO);
    const intakeRoute = pickAllowed(contact?.intake_route, INTAKE_ROUTES, '분양라인');
    const managementStage = pickAllowed(contact?.management_stage, MANAGEMENT_STAGES, '리드');
    const customerGrade = pickAllowed(contact?.customer_grade, CUSTOMER_GRADES, '심사미진행');
    const title = text(contact?.title);
    const company = text(contact?.company) || text(sourceRow?.agency_company) || '-';
    const memo = multilineText(contact?.memo);

    const contactPayload = {
      name,
      title,
      phone,
      intake_route: intakeRoute,
      management_stage: managementStage,
      company,
      customer_grade: customerGrade,
      memo,
      crm_db_source: VIP_DB_SOURCE,
      vip_transferred_at: now,
      assigned_to: assignedTo,
      created_at: now,
      updated_at: now,
    };

    const { data: savedContact, error: contactError } = await supabase
      .from('contacts')
      .insert(contactPayload)
      .select(VIP_SELECT_FIELDS)
      .single();

    if (contactError) throw contactError;

    const { data: savedBunyangline, error: bunyanglineError } = await supabase
      .from('bunyangline_data')
      .update({
        assigned_to: assignedTo,
        vip_contact_id: savedContact?.id ?? null,
        vip_transferred_at: now,
        vip_transfer_status: 'transferred',
      })
      .eq('id', rowId)
      .select('id, assigned_to, vip_contact_id, vip_transferred_at, vip_transfer_status')
      .single();

    if (bunyanglineError) throw bunyanglineError;

    return NextResponse.json({
      ok: true,
      contact: savedContact,
      bunyangline: savedBunyangline,
    });
  } catch (error) {
    const payload = errorPayload(error);
    console.error('[bunyangline-data/transfer-vip] 오류:', payload);

    return NextResponse.json(
      {
        ok: false,
        message: 'VIP활동DB 이관 중 오류가 발생했습니다.',
        error: typeof payload === 'object' && payload && 'message' in payload ? (payload as any).message : String(payload),
        errorDetails: payload,
      },
      { status: 500 },
    );
  }
}
