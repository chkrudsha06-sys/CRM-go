import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: unknown) {
  const cleaned = toText(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: unknown) {
  const text = toText(value);
  if (!text) return new Date().toISOString().slice(0, 10);

  const match = text.match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  return new Date().toISOString().slice(0, 10);
}

function normalizePhone(value: unknown) {
  const digits = toText(value).replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return toText(value);
}

function getValue(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") return body[key];
  }
  return "";
}

function stringifyError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "CiderPay webhook endpoint is ready.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const secret = request.headers.get("x-ciderpay-secret") || toText(body.secret);
    const configuredSecret = process.env.CIDERPAY_WEBHOOK_SECRET;

    if (configuredSecret && secret !== configuredSecret) {
      return NextResponse.json({ ok: false, message: "Unauthorized CiderPay request." }, { status: 401 });
    }

    const externalPaymentId = toText(
      getValue(body, ["transactionId", "tid", "paymentId", "payId", "orderNo", "ordNo", "moid"])
    );

    const memberName = toText(
      getValue(body, ["memberName", "buyerName", "customerName", "name", "userName"])
    );

    const memberPhone = normalizePhone(
      getValue(body, ["memberPhone", "buyerPhone", "customerPhone", "phone", "mobile", "tel"])
    );

    const productName = toText(
      getValue(body, ["productName", "goodsName", "itemName", "serviceName"])
    ) || "분양회 월회비";

    const paymentStatus = toText(
      getValue(body, ["status", "paymentStatus", "resultStatus", "payStatus"])
    );

    const paymentMethod = toText(
      getValue(body, ["paymentMethod", "payMethod", "method", "cardName"])
    ) || "신용카드";

    const paidAmount = toNumber(
      getValue(body, ["amount", "payAmount", "paidAmount", "totalAmount", "amt"])
    );

    const paidAt = normalizeDate(
      getValue(body, ["paidAt", "paymentDate", "payDate", "approvedAt", "approvalDate"])
    );

    if (!externalPaymentId) {
      return NextResponse.json({ ok: false, message: "거래번호가 없습니다." }, { status: 400 });
    }

    if (!paidAmount || paidAmount <= 0) {
      return NextResponse.json({ ok: false, message: "결제금액이 없습니다." }, { status: 400 });
    }

    const paidStatusWords = ["PAID", "SUCCESS", "DONE", "결제완료", "승인", "완료"];
    const isPaid = paidStatusWords.some((word) => paymentStatus.toUpperCase().includes(word)) || !paymentStatus;

    const { data: existing, error: existingError } = await supabase
      .from("external_payment_records")
      .select("id, sales_record_id")
      .eq("provider", "CIDERPAY")
      .eq("external_payment_id", externalPaymentId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.sales_record_id) {
      return NextResponse.json({
        ok: true,
        status: "duplicate",
        message: "이미 통합매출관리로 반영된 사이다페이 결제건입니다.",
        salesRecordId: existing.sales_record_id,
      });
    }

    if (!isPaid) {
      const { error: logError } = await supabase.from("external_payment_records").upsert(
        {
          provider: "CIDERPAY",
          external_payment_id: externalPaymentId,
          member_name: memberName,
          member_phone: memberPhone,
          product_name: productName,
          payment_status: paymentStatus || "UNKNOWN",
          payment_method: paymentMethod,
          paid_at: paidAt,
          paid_amount: paidAmount,
          billing_amount: paidAmount,
          match_status: memberPhone || memberName ? "matched" : "pending",
          import_status: "logged_only",
          import_message: "결제완료 상태가 아니어서 매출로 생성하지 않고 로그만 저장했습니다.",
          raw_data: body,
        },
        { onConflict: "provider,external_payment_id" }
      );

      if (logError) throw logError;

      return NextResponse.json({
        ok: true,
        status: "logged_only",
        message: "결제완료 상태가 아니어서 로그만 저장했습니다.",
      });
    }

    const memo = [
      "사이다페이 정기결제 자동반영",
      `거래번호: ${externalPaymentId}`,
      `회원명: ${memberName || "-"}`,
      `연락처: ${memberPhone || "-"}`,
      `상품명: ${productName}`,
      `결제수단: ${paymentMethod}`,
      `결제상태: ${paymentStatus || "결제완료"}`,
      `결제금액: ${paidAmount.toLocaleString()}원`,
    ].join("\n");

    const { data: salesRecord, error: salesError } = await supabase
      .from("ad_executions")
      .insert({
        member_name: memberName,
        bunyanghoe_number: "",
        execution_amount: paidAmount,
        vat_amount: paidAmount,
        refund_amount: 0,
        channel: "사이다페이",
        contract_route: "분양회",
        payment_date: paidAt,
        team_member: "주식회사광고인",
        consultant: memberPhone,
        hightarget_mileage: 0,
        hightarget_reward: 0,
        hogaengnono_reward: 0,
        lms_reward: 0,
        memo,
      })
      .select("*")
      .single();

    if (salesError) throw salesError;

    const { error: logError } = await supabase.from("external_payment_records").upsert(
      {
        provider: "CIDERPAY",
        external_payment_id: externalPaymentId,
        member_name: memberName,
        member_phone: memberPhone,
        product_name: productName,
        payment_status: paymentStatus || "결제완료",
        payment_method: paymentMethod,
        paid_at: paidAt,
        paid_amount: paidAmount,
        billing_amount: paidAmount,
        match_status: memberPhone || memberName ? "matched" : "pending",
        sales_record_id: Number(salesRecord.id),
        import_status: "sales_created",
        import_message: "사이다페이 결제내역을 통합매출로 생성했습니다.",
        raw_data: body,
      },
      { onConflict: "provider,external_payment_id" }
    );

    if (logError) throw logError;

    return NextResponse.json({
      ok: true,
      status: "sales_created",
      message: "사이다페이 결제가 통합매출관리로 자동 반영되었습니다.",
      salesRecordId: salesRecord.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "CiderPay webhook failed.",
        error: stringifyError(error),
      },
      { status: 500 }
    );
  }
}
