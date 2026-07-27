import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyApiSession } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseContactId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function readUser(
  req: Request,
  client: SupabaseClient,
): Promise<SessionUser | null> {
  const auth = await verifyApiSession(req);

  if (!auth.valid || !auth.userId) {
    return null;
  }

  const { data, error } = await client
    .from("crm_users")
    .select("id,name,role")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as SessionUser;
}

function canDelete(user: SessionUser, contact: ContactRow): boolean {
  if (user.role === "admin") {
    return true;
  }

  if (user.role !== "exec") {
    return false;
  }

  return [contact.sourcing_owner, contact.assigned_to]
    .filter(Boolean)
    .includes(user.name);
}

/**
 * 브라우저에서 이 주소를 직접 열었을 때 API 배포 여부를 확인하기 위한 점검 응답입니다.
 *
 * /api/customer-db2/delete
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/customer-db2/delete",
    message: "신규DB2 삭제 API가 정상 배포되어 있습니다.",
  });
}

export async function POST(req: Request) {
  try {
    const client = getServerClient();

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Vercel 환경변수 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
          hint:
            "Vercel Settings → Environment Variables에서 값을 등록한 뒤 Redeploy 해주세요.",
        },
        { status: 500 },
      );
    }

    const user = await readUser(req, client);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "로그인 세션을 확인할 수 없습니다. 로그아웃한 뒤 다시 로그인해주세요.",
        },
        { status: 401 },
      );
    }

    let body: DeleteBody;

    try {
      body = (await req.json()) as DeleteBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "삭제 요청 데이터가 올바른 JSON 형식이 아닙니다.",
        },
        { status: 400 },
      );
    }

    const contactId = parseContactId(body.contactId);

    if (!contactId) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 고객 ID가 아닙니다.",
        },
        { status: 400 },
      );
    }

    const { data: contactData, error: contactError } = await client
      .from("contacts")
      .select("id,name,assigned_to,sourcing_owner,crm_db_source")
      .eq("id", contactId)
      .maybeSingle();

    if (contactError) {
      return NextResponse.json(
        {
          success: false,
          error: `고객 조회 실패: ${contactError.message}`,
        },
        { status: 500 },
      );
    }

    if (!contactData) {
      return NextResponse.json(
        {
          success: false,
          error: "삭제할 고객을 찾을 수 없습니다.",
        },
        { status: 404 },
      );
    }

    const contact = contactData as ContactRow;

    if (contact.crm_db_source !== SOURCE) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이 고객은 현재 신규DB2 고객이 아닙니다. 관리고객 또는 해당 CRM 화면에서 삭제해주세요.",
          currentSource: contact.crm_db_source,
        },
        { status: 409 },
      );
    }

    if (!canDelete(user, contact)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이 고객을 삭제할 권한이 없습니다. 본인 담당 고객 또는 관리자만 삭제할 수 있습니다.",
        },
        { status: 403 },
      );
    }

    const confirmationName = normalizeText(body.confirmationName);

    if (confirmationName !== contact.name) {
      return NextResponse.json(
        {
          success: false,
          error: `확인을 위해 고객명 '${contact.name}'을 정확히 입력해주세요.`,
        },
        { status: 400 },
      );
    }

    const warnings: string[] = [];

    // 분양라인 원본 데이터는 삭제하지 않고 신규DB 연결만 해제합니다.
    const { error: unlinkError } = await client
      .from("bunyangline_data")
      .update({
        vip_contact_id: null,
        vip_transferred_at: null,
        vip_transfer_status: null,
      })
      .eq("vip_contact_id", contactId);

    if (unlinkError) {
      warnings.push(`bunyangline_data 연결 해제: ${unlinkError.message}`);
    }

    // 고객 ID를 참조할 가능성이 있는 자식 테이블을 먼저 정리합니다.
    // 프로젝트에 존재하지 않는 선택 테이블은 경고만 남기고 계속 진행합니다.
    for (const table of CHILD_TABLES) {
      const { error } = await client
        .from(table)
        .delete()
        .eq("contact_id", contactId);

      if (error) {
        warnings.push(`${table}: ${error.message}`);
      }
    }

    const { data: deletedContact, error: deleteError } = await client
      .from("contacts")
      .delete()
      .eq("id", contactId)
      .eq("crm_db_source", SOURCE)
      .select("id,name")
      .maybeSingle();

    if (deleteError) {
      return NextResponse.json(
        {
          success: false,
          error: `신규DB 삭제 실패: ${deleteError.message}`,
          warnings,
          hint:
            "오류 내용에 foreign key 또는 constraint가 나오면 해당 고객 ID를 참조하는 테이블을 먼저 삭제해야 합니다.",
        },
        { status: 500 },
      );
    }

    if (!deletedContact) {
      return NextResponse.json(
        {
          success: false,
          error:
            "삭제 조건과 일치하는 신규DB 고객이 없습니다. 고객 구분이 변경됐는지 확인해주세요.",
          warnings,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      deletedContactId: deletedContact.id,
      deletedCustomerName: deletedContact.name,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `삭제 API 내부 오류: ${error.message}`
            : "삭제 API에서 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
