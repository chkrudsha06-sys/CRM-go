import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HyosungRow = Record<string, unknown>;

type NormalizedPayment = {
  rowIndex: number;
  externalPaymentId: string;
  memberNumber: string;
  contractNumber: string;
  memberName: string;
  memberPhone: string;
  billingMonth: string;
  productName: string;
  collectionStatus: string;
  paymentStatus: string;
  paymentType: string;
  paymentMethod: string;
  promisedAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
  billingAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  refundAmount: number;
  resultMessage: string;
  memberType: string;
  managerName: string;
  rawData: HyosungRow;
  isPaid: boolean;
};

function isAuthorized(request: NextRequest, formSecret?: string | null) {
  const configuredSecret = process.env.HYOSUNG_CMS_IMPORT_SECRET;

  if (!configuredSecret) {
    return true;
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  return bearer === configuredSecret || formSecret === configuredSecret;
}

function stringifyError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const value = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [value.message, value.details, value.hint, value.code]
      .filter(Boolean)
      .join(" / ");
  }

  return String(error);
}

function toText(value: unknown) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).trim();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = toText(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePhone(value: unknown) {
  const digits = toText(value).replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return toText(value);
}

function normalizeDate(value: unknown) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const text = toText(value);
  if (!text || text === "-") return null;

  const yyyyMmDd = text.match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (yyyyMmDd) {
    const [, year, month, day] = yyyyMmDd;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return text;
}

function normalizeBillingMonth(value: unknown) {
  const text = toText(value);
  if (!text) return "";

  const match = text.match(/(20\d{2})[-./년\s]+(\d{1,2})/);
  if (!match) return text;

  return `${match[1]}/${match[2].padStart(2, "0")}`;
}

function getCell(row: HyosungRow, ...keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }

  return "";
}

function buildExternalPaymentId(payment: Omit<NormalizedPayment, "externalPaymentId">) {
  // 회원번호 + 청구월 고정 식별자 (결제일/금액/상태는 버전마다 달라질 수 있어 제외)
  return [
    "HYOSUNG_CMS",
    payment.memberNumber || "NO_MEMBER",
    payment.memberName || "NO_NAME",
    payment.billingMonth || "NO_MONTH",
  ]
    .map((value) => String(value).trim().replace(/\s+/g, "").replace(/[|]/g, ""))
    .join("_");
}

function normalizeHyosungRow(row: HyosungRow, rowIndex: number): NormalizedPayment {
  const paymentWithoutId = {
    rowIndex,
    memberNumber: toText(getCell(row, "회원번호")),
    contractNumber: toText(getCell(row, "계약번호")),
    memberName: toText(getCell(row, "회원명")),
    memberPhone: normalizePhone(getCell(row, "납부자 휴대전화", "휴대전화", "연락처")),
    billingMonth: normalizeBillingMonth(getCell(row, "청구월", "최초청구월")),
    productName: toText(getCell(row, "상품", "상품명")),
    collectionStatus: toText(getCell(row, "수납상태")),
    paymentStatus: toText(getCell(row, "결제상태")),
    paymentType: toText(getCell(row, "결제방식")),
    paymentMethod: toText(getCell(row, "결제수단")),
    promisedAt: normalizeDate(getCell(row, "약정일")),
    paidAt: normalizeDate(getCell(row, "결제일", "결제일(납부기간)", "청구완납일자")),
    completedAt: normalizeDate(getCell(row, "청구완납일자")),
    billingAmount: toNumber(getCell(row, "청구금액")),
    paidAmount: toNumber(getCell(row, "수납금액")),
    unpaidAmount: toNumber(getCell(row, "미납금액")),
    refundAmount: toNumber(getCell(row, "환불금액")),
    resultMessage: toText(getCell(row, "결제결과", "비고")),
    memberType: toText(getCell(row, "회원구분")),
    managerName: toText(getCell(row, "담당관리자")),
    rawData: row,
    isPaid: false,
  };

  const isPaid =
    paymentWithoutId.paymentStatus === "결제완료" &&
    paymentWithoutId.paidAmount > 0;

  const normalized = {
    ...paymentWithoutId,
    isPaid,
  };

  return {
    ...normalized,
    externalPaymentId: buildExternalPaymentId(normalized),
  };
}

function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("엑셀 시트를 찾지 못했습니다.");

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<HyosungRow>(sheet, {
    defval: "",
    raw: false,
  });

  return rows
    .map((row, index) => normalizeHyosungRow(row, index + 2))
    .filter((row) => row.memberName || row.memberNumber || row.memberPhone);
}


async function findMatchedMember(payment: Pick<NormalizedPayment, "memberName" | "memberNumber" | "memberPhone">) {
  const memberNumber = toText(payment.memberNumber);
  const memberName = toText(payment.memberName);
  const phoneDigits = toText(payment.memberPhone).replace(/\D/g, "");

  if (memberNumber) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,bunyanghoe_number,phone,assigned_to,consultant,meeting_result")
      .eq("bunyanghoe_number", memberNumber)
      .in("meeting_result", ["예약완료", "계약완료"])
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (memberName) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,bunyanghoe_number,phone,assigned_to,consultant,meeting_result")
      .eq("name", memberName)
      .in("meeting_result", ["예약완료", "계약완료"])
      .order("id", { ascending: false })
      .limit(5);

    if (error) throw error;

    const list = data || [];
    if (phoneDigits) {
      const phoneMatched = list.find((member) => toText(member.phone).replace(/\D/g, "") === phoneDigits);
      if (phoneMatched) return phoneMatched;
    }

    if (list[0]) return list[0];
  }

  return null;
}

async function findExistingImport(provider: string, externalPaymentId: string, payment?: NormalizedPayment) {
  // 1차: 현재 ID로 조회
  const { data, error } = await supabase
    .from("external_payment_records")
    .select("id, sales_record_id, import_status")
    .eq("provider", provider)
    .eq("external_payment_id", externalPaymentId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  // 2차: 구버전 ID 포맷으로 조회 (회원번호+이름+청구월 prefix 매칭)
  if (payment) {
    const prefix = [
      provider,
      payment.memberNumber || "NO_MEMBER",
      payment.memberName || "NO_NAME",
      payment.billingMonth || "NO_MONTH",
    ].map((v) => String(v).trim().replace(/\s+/g, "")).join("_");

    const { data: fallback } = await supabase
      .from("external_payment_records")
      .select("id, sales_record_id, import_status")
      .eq("provider", provider)
      .like("external_payment_id", `${prefix}%`)
      .not("sales_record_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallback) return fallback;
  }

  return null;
}

async function saveExternalPaymentRecord(payment: NormalizedPayment, params: {
  importStatus: string;
  importMessage: string;
  salesRecordId?: number | null;
}) {
  const { data, error } = await supabase
    .from("external_payment_records")
    .upsert(
      {
        provider: "HYOSUNG_CMS",
        external_payment_id: payment.externalPaymentId,
        member_number: payment.memberNumber,
        contract_number: payment.contractNumber,
        member_name: payment.memberName,
        member_phone: payment.memberPhone,
        billing_month: payment.billingMonth,
        product_name: payment.productName,
        collection_status: payment.collectionStatus,
        payment_status: payment.paymentStatus,
        payment_type: payment.paymentType,
        payment_method: payment.paymentMethod,
        promised_at: payment.promisedAt,
        paid_at: payment.paidAt,
        completed_at: payment.completedAt,
        billing_amount: payment.billingAmount,
        paid_amount: payment.paidAmount,
        unpaid_amount: payment.unpaidAmount,
        result_message: payment.resultMessage,
        member_type: payment.memberType,
        manager_name: payment.managerName,
        match_status: payment.memberPhone || payment.memberName ? "matched" : "pending",
        sales_record_id: params.salesRecordId || null,
        import_status: params.importStatus,
        import_message: params.importMessage,
        raw_data: payment.rawData,
      },
      {
        onConflict: "provider,external_payment_id",
      }
    )
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

async function findExistingSalesRecord(payment: NormalizedPayment) {
  if (!payment.memberNumber || !payment.memberName || !payment.paidAt) return null;

  const { data, error } = await supabase
    .from("ad_executions")
    .select("id")
    .eq("channel", "효성CMS")
    .eq("bunyanghoe_number", payment.memberNumber)
    .eq("member_name", payment.memberName)
    .eq("payment_date", payment.paidAt)
    .eq("execution_amount", payment.paidAmount)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function createSalesRecord(payment: NormalizedPayment) {
  const matchedMember = await findMatchedMember(payment);
  const matchedManagerName = toText(matchedMember?.assigned_to || "");
  const matchedBunyanghoeNumber = toText(matchedMember?.bunyanghoe_number || payment.memberNumber);
  const matchedConsultant = toText(matchedMember?.consultant || payment.memberPhone);

  const memo = [
    "효성CMS 수납내역 자동반영",
    `회원번호: ${payment.memberNumber || "-"}`,
    `계약번호: ${payment.contractNumber || "-"}`,
    `청구월: ${payment.billingMonth || "-"}`,
    `상품명: ${payment.productName || "-"}`,
    `결제수단: ${payment.paymentMethod || "-"}`,
    `결제방식: ${payment.paymentType || "-"}`,
    `결제결과: ${payment.resultMessage || "-"}`,
    `수납금액: ${payment.paidAmount.toLocaleString()}원`,
    `미납금액: ${payment.unpaidAmount.toLocaleString()}원`,
    `외부결제ID: ${payment.externalPaymentId}`,
  ].join("\n");

  const { data, error } = await supabase
    .from("ad_executions")
    .insert({
      member_name: payment.memberName,
      bunyanghoe_number: matchedBunyanghoeNumber,
      execution_amount: payment.paidAmount,
      vat_amount: payment.paidAmount,
      refund_amount: payment.refundAmount || 0,
      channel: "효성CMS",
      contract_route: "분양회",
      payment_date: payment.paidAt || payment.completedAt || new Date().toISOString().slice(0, 10),
      team_member: matchedManagerName || payment.managerName || null,
      consultant: matchedConsultant,
      hightarget_mileage: 0,
      hightarget_reward: 0,
      hogaengnono_reward: 0,
      lms_reward: 0,
      memo,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

async function importPayments(payments: NormalizedPayment[]) {
  const results = [];

  for (const payment of payments) {
    try {
      const matchedMember = await findMatchedMember(payment);
      if (matchedMember?.assigned_to) {
        payment.managerName = toText(matchedMember.assigned_to);
      }
      if (matchedMember?.bunyanghoe_number) {
        payment.memberNumber = toText(matchedMember.bunyanghoe_number);
      }
      const existing = await findExistingImport("HYOSUNG_CMS", payment.externalPaymentId, payment);

      if (existing?.sales_record_id) {
        // 실제 매출 레코드가 존재하는지 확인 (삭제된 경우 재생성 허용)
        const { data: realSales } = await supabase
          .from("ad_executions")
          .select("id")
          .eq("id", existing.sales_record_id)
          .maybeSingle();

        if (realSales?.id) {
          results.push({
            externalPaymentId: payment.externalPaymentId,
            memberName: payment.memberName,
            status: "duplicate",
            message: "이미 통합매출에 반영된 수납내역입니다.",
            salesRecordId: existing.sales_record_id,
          });
          continue;
        }

        // 매출이 삭제된 상태 → sales_record_id 초기화 후 재처리
        await supabase
          .from("external_payment_records")
          .update({ sales_record_id: null, import_status: "reset_for_reimport" })
          .eq("id", existing.id);
      }

      if (!payment.isPaid) {
        const saved = await saveExternalPaymentRecord(payment, {
          importStatus: "logged_only",
          importMessage: "결제완료 조건이 아니어서 매출로 생성하지 않고 로그만 저장했습니다.",
        });

        results.push({
          externalPaymentId: payment.externalPaymentId,
          memberName: payment.memberName,
          status: "logged_only",
          message: saved.import_message,
          salesRecordId: null,
        });
        continue;
      }

      const existingSalesRecord = await findExistingSalesRecord(payment);

      if (existingSalesRecord?.id) {
        await saveExternalPaymentRecord(payment, {
          importStatus: "duplicate",
          importMessage: "효성CMS 기준으로 이미 통합매출에 반영된 수납내역입니다.",
          salesRecordId: Number(existingSalesRecord.id),
        });

        results.push({
          externalPaymentId: payment.externalPaymentId,
          memberName: payment.memberName,
          status: "duplicate",
          message: "이미 통합매출에 반영된 수납내역입니다.",
          salesRecordId: existingSalesRecord.id,
        });
        continue;
      }

      const salesRecord = await createSalesRecord(payment);

      await saveExternalPaymentRecord(payment, {
        importStatus: "sales_created",
        importMessage: "효성CMS 수납내역을 통합매출로 생성했습니다.",
        salesRecordId: Number(salesRecord.id),
      });

      results.push({
        externalPaymentId: payment.externalPaymentId,
        memberName: payment.memberName,
        status: "sales_created",
        message: "통합매출 생성 완료",
        salesRecordId: salesRecord.id,
      });
    } catch (error) {
      results.push({
        externalPaymentId: payment.externalPaymentId,
        memberName: payment.memberName,
        status: "failed",
        message: stringifyError(error),
        salesRecordId: null,
      });
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const formSecret = typeof formData.get("secret") === "string" ? String(formData.get("secret")) : null;

    if (!isAuthorized(request, formSecret)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized Hyosung CMS import request.",
        },
        { status: 401 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "file 필드에 효성CMS 수납내역 엑셀 파일을 첨부해야 합니다.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const payments = parseWorkbook(buffer);
    const results = await importPayments(payments);

    const summary = {
      totalRows: payments.length,
      paidRows: payments.filter((item) => item.isPaid).length,
      failedOrUnpaidRows: payments.filter((item) => !item.isPaid).length,
      salesCreated: results.filter((item) => item.status === "sales_created").length,
      loggedOnly: results.filter((item) => item.status === "logged_only").length,
      duplicate: results.filter((item) => item.status === "duplicate").length,
      failed: results.filter((item) => item.status === "failed").length,
    };

    return NextResponse.json({
      ok: true,
      message: "Hyosung CMS payment import completed.",
      fileName: file.name,
      summary,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Hyosung CMS payment import failed.",
        error: stringifyError(error),
      },
      { status: 500 }
    );
  }
}
