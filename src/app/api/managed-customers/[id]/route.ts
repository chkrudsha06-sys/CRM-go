import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyApiSession } from "@/lib/api-auth";
import { hasCrmFullAccess } from "@/lib/crm-permissions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type AccessUser = {
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
  sourcing_owner: string | null;
  closing_owner: string | null;
  management_status: string | null;
  crm_db_source: string | null;
};

type UpdatePayload = {
  name?: unknown;
  title?: unknown;
  phone?: unknown;
  intakeRoute?: unknown;
  company?: unknown;
  currentSite?: unknown;
  sourcingOwner?: unknown;
  closingOwner?: unknown;
  managementStatus?: unknown;
};

type DeletePayload = {
  mode?: unknown;
  confirmationName?: unknown;
};

const EDITABLE_FIELDS = [
  "name",
  "title",
  "phone",
  "intake_route",
  "company",
  "current_site",
  "sourcing_owner",
  "closing_owner",
  "management_status",
] as const;

const FIELD_LABELS: Record<(typeof EDITABLE_FIELDS)[number], string> = {
  name: "고객명",
  title: "직급",
  phone: "연락처",
  intake_route: "유입경로",
  company: "회사·현장",
  current_site: "현재 현장",
  sourcing_owner: "소싱 담당자",
  closing_owner: "클로징 담당자",
  management_status: "관리상태",
};

const DELETE_TABLES = [
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

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  const text = asTrimmedString(value);
  return text || null;
}

function normalizePhone(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone(value: string): string | null {
  const digits = normalizePhone(value);
  if (!digits) return null;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.trim();
}

async function verifyFullAccess(req: Request): Promise<AccessUser | null> {
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

async function readManagedCustomer(id: number): Promise<ContactRow | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id,name,title,phone,intake_route,company,current_site,sourcing_owner,closing_owner,management_status,crm_db_source")
    .eq("id", id)
    .maybeSingle();

  if (error || !data || data.crm_db_source !== "managed_customer") return null;
  return data as ContactRow;
}

async function insertHistory(
  client: SupabaseClient,
  contactId: number,
  adminName: string,
  eventType: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  reason: string,
) {
  const { error } = await client.from("customer_change_history").insert({
    contact_id: contactId,
    event_type: eventType,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    change_reason: reason,
    source_screen: "관리고객",
    changed_by: adminName,
  });
  if (error) console.warn("customer_change_history insert warning:", error.message);
}

async function deleteContactChildren(contactId: number) {
  const warnings: string[] = [];

  // 분양라인 원본은 삭제하지 않고 VIP 고객 연결만 해제합니다.
  const { error: bunyanglineError } = await supabase
    .from("bunyangline_data")
    .update({
      vip_contact_id: null,
      vip_transferred_at: null,
      vip_transfer_status: null,
    })
    .eq("vip_contact_id", contactId);
  if (bunyanglineError) {
    warnings.push(`bunyangline_data 연결해제: ${bunyanglineError.message}`);
  }

  for (const table of DELETE_TABLES) {
    const { error } = await supabase.from(table).delete().eq("contact_id", contactId);
    if (error) {
      // 배포 환경별로 존재하지 않는 선택 테이블은 경고만 남기고 계속합니다.
      warnings.push(`${table}: ${error.message}`);
    }
  }
  return warnings;
}

export async function PUT(req: Request, context: { params: { id: string } }) {
  const accessUser = await verifyFullAccess(req);
  if (!accessUser) {
    return NextResponse.json({ error: "관리자 또는 지정 전체권한 담당자 권한이 필요합니다. 로그아웃 후 다시 로그인해주세요." }, { status: 403 });
  }

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "올바른 고객 ID가 아닙니다." }, { status: 400 });
  }

  const current = await readManagedCustomer(id);
  if (!current) {
    return NextResponse.json({ error: "관리고객을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: UpdatePayload;
  try {
    body = (await req.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const name = asTrimmedString(body.name);
  if (!name) {
    return NextResponse.json({ error: "고객명은 필수입니다." }, { status: 400 });
  }

  const formattedPhone = formatPhone(asTrimmedString(body.phone));
  if (formattedPhone) {
    const { data: phoneRows, error: phoneError } = await supabase
      .from("contacts")
      .select("id,name,phone")
      .neq("id", id)
      .limit(5000);

    if (phoneError) {
      return NextResponse.json({ error: `연락처 중복 확인 실패: ${phoneError.message}` }, { status: 500 });
    }

    const duplicate = (phoneRows || []).find((row: { id: number; name: string; phone: string | null }) => normalizePhone(row.phone) === normalizePhone(formattedPhone));
    if (duplicate) {
      return NextResponse.json(
        { error: `동일 연락처 고객이 이미 존재합니다: ${duplicate.name}` },
        { status: 409 },
      );
    }
  }

  const updates = {
    name,
    title: nullableString(body.title),
    phone: formattedPhone,
    intake_route: nullableString(body.intakeRoute),
    company: nullableString(body.company),
    current_site: nullableString(body.currentSite),
    sourcing_owner: nullableString(body.sourcingOwner),
    closing_owner: nullableString(body.closingOwner),
    management_status: nullableString(body.managementStatus) || "미팅예정",
    updated_at: new Date().toISOString(),
  };

  const { error: contactError } = await supabase
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .eq("crm_db_source", "managed_customer");

  if (contactError) {
    return NextResponse.json({ error: `고객정보 수정 실패: ${contactError.message}` }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("managed_customer_profiles")
    .upsert(
      {
        contact_id: id,
        management_status: updates.management_status,
        updated_by: accessUser.name,
      },
      { onConflict: "contact_id" },
    );

  if (profileError) {
    return NextResponse.json({ error: `상세정보 상태 동기화 실패: ${profileError.message}` }, { status: 500 });
  }

  const oldValues: Record<(typeof EDITABLE_FIELDS)[number], string | null> = {
    name: current.name,
    title: current.title,
    phone: current.phone,
    intake_route: current.intake_route,
    company: current.company,
    current_site: current.current_site,
    sourcing_owner: current.sourcing_owner,
    closing_owner: current.closing_owner,
    management_status: current.management_status,
  };

  const newValues: Record<(typeof EDITABLE_FIELDS)[number], string | null> = {
    name: updates.name,
    title: updates.title,
    phone: updates.phone,
    intake_route: updates.intake_route,
    company: updates.company,
    current_site: updates.current_site,
    sourcing_owner: updates.sourcing_owner,
    closing_owner: updates.closing_owner,
    management_status: updates.management_status,
  };

  for (const field of EDITABLE_FIELDS) {
    if ((oldValues[field] || "") !== (newValues[field] || "")) {
      await insertHistory(
        supabase,
        id,
        accessUser.name,
        "고객정보 수정",
        field,
        oldValues[field],
        newValues[field],
        `${FIELD_LABELS[field]} 수정`,
      );
    }
  }

  return NextResponse.json({ success: true, contactId: id });
}

export async function DELETE(req: Request, context: { params: { id: string } }) {
  const accessUser = await verifyFullAccess(req);
  if (!accessUser) {
    return NextResponse.json({ error: "관리자 또는 지정 전체권한 담당자 권한이 필요합니다. 로그아웃 후 다시 로그인해주세요." }, { status: 403 });
  }

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "올바른 고객 ID가 아닙니다." }, { status: 400 });
  }

  const current = await readManagedCustomer(id);
  if (!current) {
    return NextResponse.json({ error: "관리고객을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: DeletePayload;
  try {
    body = (await req.json()) as DeletePayload;
  } catch {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const mode = body.mode === "permanent" ? "permanent" : "managed_only";
  const confirmationName = asTrimmedString(body.confirmationName);
  if (confirmationName !== current.name) {
    return NextResponse.json({ error: `확인을 위해 고객명 '${current.name}'을 정확히 입력해주세요.` }, { status: 400 });
  }

  if (mode === "managed_only") {
    // 관리고객 전용 데이터만 제거하고 신규DB2로 되돌립니다.
    const managedTables = ["customer_meetings", "customer_site_moves", "managed_customer_profiles"] as const;
    const warnings: string[] = [];
    for (const table of managedTables) {
      const { error } = await supabase.from(table).delete().eq("contact_id", id);
      if (error) {
        return NextResponse.json(
          { error: `${table} 삭제 실패: ${error.message}`, warnings },
          { status: 500 },
        );
      }
    }

    await insertHistory(
      supabase,
      id,
      accessUser.name,
      "관리고객 제거",
      "crm_db_source",
      "managed_customer",
      "customer_db2",
      "관리고객에서 제거하고 신규DB2 재접촉 대상으로 복원",
    );

    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        crm_db_source: "customer_db2",
        sourcing_status: "재접촉예정",
        management_status: null,
        managed_customer_grade: null,
        closing_owner: null,
        handoff_at: null,
        meeting_date: null,
        meeting_date_text: null,
        meeting_address: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("crm_db_source", "managed_customer");

    if (updateError) {
      return NextResponse.json({ error: `관리고객 제거 실패: ${updateError.message}`, warnings }, { status: 500 });
    }

    return NextResponse.json({ success: true, mode, warnings });
  }

  const warnings = await deleteContactChildren(id);
  const { error: deleteError } = await supabase.from("contacts").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json(
      {
        error: `고객 완전삭제 실패: ${deleteError.message}`,
        warnings,
        hint: "연결된 다른 테이블의 외래키 제약이 남아 있는지 확인해주세요.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, mode, warnings });
}
