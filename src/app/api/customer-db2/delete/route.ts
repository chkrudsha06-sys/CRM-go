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
  assigned_to: string | null;
  sourcing_owner: string | null;
  crm_db_source: string | null;
};

type DeleteBody = {
  contactId?: unknown;
  confirmationName?: unknown;
};

const SOURCE = "customer_db2";
const CHILD_TABLES = [
  "activity_logs",
  "rewards",
  "mileage_usages",
  "incentive_payments",
  "notifications",
  "push_logs",
  "push_subscriptions",
  "content_statuses",
  "site_info_history",
  "member_timeline",
  "call_recording_logs",
  "contact_field_histories",
  "contact_notes",
  "customer_meetings",
  "customer_site_moves",
  "managed_customer_profiles",
  "customer_handoffs",
  "customer_change_history",
  "tasks",
] as const;

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

function parseContactId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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

function canDelete(user: SessionUser, contact: ContactRow): boolean {
  if (hasCrmFullAccess(user)) return true;
  if (user.role !== "exec") return false;
  return [contact.sourcing_owner, contact.assigned_to]
    .filter(Boolean)
    .includes(user.name);
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

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const contactId = parseContactId(body.contactId);
  if (!contactId) {
    return NextResponse.json({ error: "올바른 고객 ID가 아닙니다." }, { status: 400 });
  }

  const { data: contactData, error: contactError } = await client
    .from("contacts")
    .select("id,name,assigned_to,sourcing_owner,crm_db_source")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError) {
    return NextResponse.json({ error: `고객 조회 실패: ${contactError.message}` }, { status: 500 });
  }
  if (!contactData) {
    return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
  }

  const contact = contactData as ContactRow;
  if (contact.crm_db_source !== SOURCE) {
    return NextResponse.json(
      { error: "이미 관리고객으로 이관된 고객입니다. 관리고객 화면에서 삭제해주세요." },
      { status: 409 },
    );
  }
  if (!canDelete(user, contact)) {
    return NextResponse.json(
      { error: "이 고객을 삭제할 권한이 없습니다. 본인 담당 고객 또는 전체권한 사용자만 삭제할 수 있습니다." },
      { status: 403 },
    );
  }

  const confirmationName = text(body.confirmationName);
  if (confirmationName !== contact.name) {
    return NextResponse.json(
      { error: `확인을 위해 고객명 '${contact.name}'을 정확히 입력해주세요.` },
      { status: 400 },
    );
  }

  const warnings: string[] = [];

  const { error: unlinkError } = await client
    .from("bunyangline_data")
    .update({
      vip_contact_id: null,
      vip_transferred_at: null,
      vip_transfer_status: null,
    })
    .eq("vip_contact_id", contactId);
  if (unlinkError) warnings.push(`분양라인 연결 해제: ${unlinkError.message}`);

  for (const table of CHILD_TABLES) {
    const { error } = await client.from(table).delete().eq("contact_id", contactId);
    if (error) warnings.push(`${table}: ${error.message}`);
  }

  const { error: deleteError } = await client
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("crm_db_source", SOURCE);

  if (deleteError) {
    return NextResponse.json(
      {
        error: `신규DB 삭제 실패: ${deleteError.message}`,
        warnings,
        hint: "삭제되지 않은 외래키 연결 테이블이 있는지 Supabase에서 확인해주세요.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, deletedContactId: contactId, warnings });
}
