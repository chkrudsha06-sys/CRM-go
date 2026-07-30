import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyApiSession } from "@/lib/api-auth";
import { hasCrmFullAccess } from "@/lib/crm-permissions";

type DeleteMode = "managed_only" | "permanent";

type DeleteRequestBody = {
  contactId?: unknown;
  mode?: unknown;
  confirmationName?: unknown;
};

type AccessUser = {
  id: string;
  name: string;
  role: string;
};

type ManagedCustomer = {
  id: number;
  name: string;
  crm_db_source: string | null;
};

function jsonError(message: string, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(extra || {}),
    },
    { status },
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function verifyFullAccess(req: Request, supabase: SupabaseClient): Promise<AccessUser | null> {
  const auth = await verifyApiSession(req);
  if (!auth.valid || !auth.userId) return null;

  const { data, error } = await supabase
    .from("crm_users")
    .select("id,name,role")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error || !data || !hasCrmFullAccess(data)) return null;
  return data as AccessUser;
}

async function deleteRequiredChildren(supabase: SupabaseClient, contactId: number) {
  const requiredTables = [
    "customer_meetings",
    "customer_site_moves",
    "managed_customer_profiles",
  ] as const;

  for (const table of requiredTables) {
    const { error } = await supabase.from(table).delete().eq("contact_id", contactId);
    if (error) {
      throw new Error(`${table} 삭제 실패: ${error.message}`);
    }
  }
}

async function deleteOptionalChildren(supabase: SupabaseClient, contactId: number) {
  const warnings: string[] = [];
  const optionalTables = [
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
    "customer_handoffs",
    "customer_change_history",
    "tasks",
  ] as const;

  const { error: bunyanglineError } = await supabase
    .from("bunyangline_data")
    .update({
      vip_contact_id: null,
      vip_transferred_at: null,
      vip_transfer_status: null,
    })
    .eq("vip_contact_id", contactId);

  if (bunyanglineError) {
    warnings.push(`bunyangline_data 연결 해제: ${bunyanglineError.message}`);
  }

  for (const table of optionalTables) {
    const { error } = await supabase.from(table).delete().eq("contact_id", contactId);
    if (error) warnings.push(`${table}: ${error.message}`);
  }

  return warnings;
}

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return jsonError(
        "Vercel 환경변수 SUPABASE_SERVICE_ROLE_KEY가 없습니다. Vercel → Settings → Environment Variables에 등록한 뒤 다시 배포해주세요.",
        500,
      );
    }

    const accessUser = await verifyFullAccess(req, supabase);
    if (!accessUser) {
      return jsonError("관리자 또는 지정 전체권한 담당자 권한이 필요합니다. 로그아웃 후 다시 로그인해주세요.", 403);
    }

    let body: DeleteRequestBody;
    try {
      body = (await req.json()) as DeleteRequestBody;
    } catch {
      return jsonError("삭제 요청 데이터가 올바르지 않습니다.", 400);
    }

    const contactId = Number(body.contactId);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return jsonError("올바른 고객 ID가 아닙니다.", 400);
    }

    const mode: DeleteMode = body.mode === "permanent" ? "permanent" : "managed_only";
    const confirmationName = text(body.confirmationName);

    const { data: customer, error: customerError } = await supabase
      .from("contacts")
      .select("id,name,crm_db_source")
      .eq("id", contactId)
      .maybeSingle();

    if (customerError) {
      return jsonError(`고객 조회 실패: ${customerError.message}`, 500);
    }

    if (!customer) {
      return jsonError("삭제할 고객을 찾을 수 없습니다.", 404);
    }

    const managedCustomer = customer as ManagedCustomer;
    if (managedCustomer.crm_db_source !== "managed_customer") {
      return jsonError("이미 관리고객에서 제거됐거나 관리고객이 아닌 데이터입니다.", 409);
    }

    if (confirmationName !== managedCustomer.name) {
      return jsonError(`확인을 위해 고객명 '${managedCustomer.name}'을 정확히 입력해주세요.`, 400);
    }

    if (mode === "managed_only") {
      await deleteRequiredChildren(supabase, contactId);

      const { error: historyError } = await supabase.from("customer_change_history").insert({
        contact_id: contactId,
        event_type: "관리고객 제거",
        field_name: "crm_db_source",
        old_value: "managed_customer",
        new_value: "customer_db2",
        change_reason: "관리고객에서 제거하고 신규DB2 재접촉 대상으로 복원",
        source_screen: "관리고객",
        changed_by: accessUser.name,
      });

      const warnings: string[] = [];
      if (historyError) {
        warnings.push(`변경히스토리 기록 실패: ${historyError.message}`);
      }

      const { data: updated, error: updateError } = await supabase
        .from("contacts")
        .update({
          crm_db_source: "customer_db2",
          sourcing_status: "재접촉예정",
          management_status: null,
          managed_customer_grade: null,
          closing_owner: null,
          meeting_date: null,
          meeting_address: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contactId)
        .eq("crm_db_source", "managed_customer")
        .select("id,name,crm_db_source,sourcing_status")
        .maybeSingle();

      if (updateError) {
        return jsonError(`관리고객 제거 실패: ${updateError.message}`, 500, { warnings });
      }

      if (!updated) {
        return jsonError("관리고객 상태 변경 대상이 없습니다. 이미 변경됐는지 확인해주세요.", 409, { warnings });
      }

      return NextResponse.json({
        success: true,
        mode,
        message: "관리고객에서 제거하고 신규DB2 재접촉예정으로 이동했습니다.",
        warnings,
        customer: updated,
      });
    }

    await deleteRequiredChildren(supabase, contactId);
    const warnings = await deleteOptionalChildren(supabase, contactId);

    const { data: deleted, error: deleteError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contactId)
      .select("id,name")
      .maybeSingle();

    if (deleteError) {
      return jsonError(
        `고객 완전삭제 실패: ${deleteError.message}`,
        500,
        {
          warnings,
          hint: "연결된 테이블의 외래키가 남아 있을 수 있습니다. Vercel 함수 로그와 Supabase 외래키를 확인해주세요.",
        },
      );
    }

    if (!deleted) {
      return jsonError("완전삭제 대상 고객이 없습니다.", 404, { warnings });
    }

    return NextResponse.json({
      success: true,
      mode,
      message: "고객과 연결된 CRM 데이터를 완전히 삭제했습니다.",
      warnings,
      customer: deleted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 서버 오류";
    console.error("managed customer delete error:", error);
    return jsonError(`관리고객 삭제 서버 오류: ${message}`, 500);
  }
}
