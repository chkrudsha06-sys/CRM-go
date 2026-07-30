import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyApiSession } from "@/lib/api-auth";
import { hasCrmFullAccess } from "@/lib/crm-permissions";

type SessionUser = {
  id: string;
  name: string;
  role: string;
};

type ContactRow = {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  intake_route: string | null;
  company: string | null;
  current_site: string | null;
  assigned_to: string | null;
  sourcing_owner: string | null;
  sourcing_status: string | null;
  next_contact_at: string | null;
  crm_db_source: string | null;
};

type UpdateBody = {
  contactId?: unknown;
  name?: unknown;
  title?: unknown;
  phone?: unknown;
  intakeRoute?: unknown;
  currentSite?: unknown;
  sourcingOwner?: unknown;
  sourcingStatus?: unknown;
  nextContactAt?: unknown;
};

const SOURCE = "customer_db2";
const ALLOWED_TITLES = ["총괄본부장", "본부장", "팀장"];
const ALLOWED_ROUTES = ["분양회DB", "분양라인", "완판트럭", "미관리DB", "대협팀활동"];
const ALLOWED_STATUSES = [
  "신규DB",
  "TM 진행중",
  "접점확보",
  "미팅조율",
  "미팅확정",
  "재접촉예정",
  "보류",
  "연락불가",
  "유효하지 않은 DB",
];

function getServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value?: string | null): string {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone(value: string): string | null {
  const digits = normalizePhone(value).slice(0, 11);
  if (!digits) return null;
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value.trim();
}

function parseContactId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseKoreaDateTime(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
  const date = new Date(`${withSeconds}+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function readUser(req: Request, client: SupabaseClient): Promise<SessionUser | null> {
  const auth = await verifyApiSession(req);
  if (!auth.valid || !auth.userId) return null;

  const { data, error } = await client
    .from("crm_users")
    .select("id,name,role")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SessionUser;
}

function canModify(user: SessionUser, contact: ContactRow): boolean {
  if (hasCrmFullAccess(user)) return true;
  if (user.role !== "exec") return false;
  return [contact.sourcing_owner, contact.assigned_to]
    .filter(Boolean)
    .includes(user.name);
}

async function addHistory(
  client: SupabaseClient,
  contactId: number,
  userName: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  label: string,
): Promise<string | null> {
  if ((oldValue || "") === (newValue || "")) return null;

  const { error } = await client.from("customer_change_history").insert({
    contact_id: contactId,
    event_type: "신규DB 정보 수정",
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    change_reason: `${label} 수정`,
    source_screen: "신규DB2",
    changed_by: userName,
  });

  return error ? error.message : null;
}

export async function POST(req: Request) {
  const client = getServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Vercel 환경변수 SUPABASE_SERVICE_ROLE_KEY가 없습니다." },
      { status: 500 },
    );
  }

  const user = await readUser(req, client);
  if (!user) {
    return NextResponse.json(
      { error: "로그인 세션을 확인할 수 없습니다. 로그아웃 후 다시 로그인해주세요." },
      { status: 401 },
    );
  }

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const contactId = parseContactId(body.contactId);
  if (!contactId) {
    return NextResponse.json({ error: "올바른 고객 ID가 아닙니다." }, { status: 400 });
  }

  const { data: currentData, error: currentError } = await client
    .from("contacts")
    .select("id,name,title,phone,intake_route,company,current_site,assigned_to,sourcing_owner,sourcing_status,next_contact_at,crm_db_source")
    .eq("id", contactId)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: `고객 조회 실패: ${currentError.message}` }, { status: 500 });
  }
  if (!currentData) {
    return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
  }

  const current = currentData as ContactRow;
  if (current.crm_db_source !== SOURCE) {
    return NextResponse.json(
      { error: "이미 관리고객으로 이관된 고객입니다. 관리고객 화면에서 수정해주세요." },
      { status: 409 },
    );
  }
  if (!canModify(user, current)) {
    return NextResponse.json(
      { error: "이 고객을 수정할 권한이 없습니다. 본인 담당 고객 또는 전체권한 사용자만 수정할 수 있습니다." },
      { status: 403 },
    );
  }

  const name = text(body.name);
  const title = text(body.title);
  const phone = formatPhone(text(body.phone));
  const intakeRoute = text(body.intakeRoute);
  const currentSite = text(body.currentSite);
  const sourcingStatus = text(body.sourcingStatus) || "신규DB";
  const requestedOwner = text(body.sourcingOwner);

  if (!name || !title || !phone || !intakeRoute || !currentSite) {
    return NextResponse.json(
      { error: "고객명, 직급, 연락처, 유입경로, 현재 현장을 모두 입력해주세요." },
      { status: 400 },
    );
  }
  if (!ALLOWED_TITLES.includes(title)) {
    return NextResponse.json({ error: "허용되지 않은 직급입니다." }, { status: 400 });
  }
  if (!ALLOWED_ROUTES.includes(intakeRoute)) {
    return NextResponse.json({ error: "허용되지 않은 유입경로입니다." }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.includes(sourcingStatus)) {
    return NextResponse.json({ error: "허용되지 않은 진행상태입니다." }, { status: 400 });
  }

  const nextContactAtRaw = text(body.nextContactAt);
  const nextContactAt = parseKoreaDateTime(body.nextContactAt);
  if (nextContactAtRaw && !nextContactAt) {
    return NextResponse.json({ error: "다음 연락예정 일시가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: phoneRows, error: phoneError } = await client
    .from("contacts")
    .select("id,name,phone")
    .neq("id", contactId)
    .limit(5000);

  if (phoneError) {
    return NextResponse.json({ error: `연락처 중복 확인 실패: ${phoneError.message}` }, { status: 500 });
  }

  const duplicate = (phoneRows || []).find(
    (row: { id: number; name: string; phone: string | null }) =>
      normalizePhone(row.phone) === normalizePhone(phone),
  );
  if (duplicate) {
    return NextResponse.json(
      { error: `동일 연락처 고객이 이미 존재합니다: ${duplicate.name}` },
      { status: 409 },
    );
  }

  const sourcingOwner = hasCrmFullAccess(user)
    ? requestedOwner || current.sourcing_owner || current.assigned_to || user.name
    : current.sourcing_owner || current.assigned_to || user.name;

  const updates = {
    name,
    title,
    phone,
    intake_route: intakeRoute,
    company: currentSite,
    current_site: currentSite,
    assigned_to: sourcingOwner,
    sourcing_owner: sourcingOwner,
    sourcing_status: sourcingStatus,
    next_contact_at: nextContactAt,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await client
    .from("contacts")
    .update(updates)
    .eq("id", contactId)
    .eq("crm_db_source", SOURCE)
    .select("id,name,title,phone,intake_route,company,current_site,assigned_to,sourcing_owner,sourcing_status,next_contact_at,crm_db_source,updated_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: `신규DB 수정 실패: ${updateError.message}` }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "수정 대상 고객을 찾지 못했습니다." }, { status: 404 });
  }

  const historyWarnings = (
    await Promise.all([
      addHistory(client, contactId, user.name, "name", current.name, name, "고객명"),
      addHistory(client, contactId, user.name, "title", current.title, title, "직급"),
      addHistory(client, contactId, user.name, "phone", current.phone, phone, "연락처"),
      addHistory(client, contactId, user.name, "intake_route", current.intake_route, intakeRoute, "유입경로"),
      addHistory(client, contactId, user.name, "current_site", current.current_site || current.company, currentSite, "현재 현장"),
      addHistory(client, contactId, user.name, "sourcing_owner", current.sourcing_owner || current.assigned_to, sourcingOwner, "소싱 담당자"),
      addHistory(client, contactId, user.name, "sourcing_status", current.sourcing_status, sourcingStatus, "진행상태"),
      addHistory(client, contactId, user.name, "next_contact_at", current.next_contact_at, nextContactAt, "다음 연락예정"),
    ])
  ).filter((warning): warning is string => Boolean(warning));

  return NextResponse.json({ success: true, contact: updated, warnings: historyWarnings });
}
