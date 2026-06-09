import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CiderpayBody = Record<string, unknown>;

function stringifyError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const value = error as { message?: string; details?: string; hint?: string; code?: string };
    return [value.message, value.details, value.hint, value.code].filter(Boolean).join(" / ");
  }

  return String(error);
}

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
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
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return toText(value);
}

function normalizeDate(value: unknown) {
  const text = toText(value);
  if (!text) return new Date().toISOString().slice(0, 10);

  const match = text.match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return new Date().toISOString().slice(0, 10);
}

function getValue(body: CiderpayBody, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function isAuthorized(request: NextRequest, body: CiderpayBody) {
  const configuredSecret = process.env.CIDERPAY_WEBHOOK_SECRET;
  if (!configuredSecret) return true;

  const headerSecret = request.headers.get("x-ciderpay-secret") || "";
  const bodySecret = toText(getValue(body, ["secret", "webhookSecret", "ciderpaySecret"]));

  return headerSecret === configuredSecret || bodySecret === configuredSecret;
}

function isPaidStatus(status: string) {
  if (!status) return true;
  const upper = status.toUpperCase();
  return ["PAID", "SUCCESS", "DONE", "APPROVED", "COMPLETE", "COMPLETED", "결제완료", "승인", "완료"].some((word) =>
    upper.includes(word)
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "CiderPay payment endpoint is ready.",
    endpoint: "/api/payment-imports/ciderpay",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CiderpayBody;

    if (!isAuthorized(request, body)) {
      return NextResponse.json({ ok: false, message: "Unauthorized CiderPay request." }, { status: 401 });
    }

    const externalPaymentId = toText(
      getValue(body, ["transactionId", "tid", "paymentId", "payId", "orderNo", "ordNo", "moid", "approvalNo"])
    );
    const memberName = toText(getValue(body, ["memberName", "buyerName", "customerName", "name", "userName"]));
    const memberPhone = normalizePhone(getValue(body, ["memberPhone", "buyerPhone", "customerPhone", "phone", "mobile", "tel"]));
    const productName = toText(getValue(body, ["productName", "goodsName", "itemName", "serviceName"])) || "분양회 월회비";
    const paymentStatus = toText(getValue(body, ["status", "paymentStatus", "resultStatus", "payStatus"])) || "결제완료";
    const paymentMethod = toText(getValue(body, ["paymentMethod", "payMethod", "method", "cardName"])) || "신용카드";
    const paidAmount = toNumber(getValue(body, ["amount", "payAmount", "paidAmount", "totalAmount", "amt", "price"]));
    const paidAt = normalizeDate(getValue(body, ["paidAt", "paymentDate", "payDate", "approvedAt", "approvalDate"]));

    if (!externalPaymentId) {
      return NextResponse.json({ ok: false, message: "사이다페이 거래번호가 없습니다." }, { status: 400 });
    }

    if (!paidAmount || paidAmount <= 0) {
      return NextResponse.json({ ok: false, message: "사이다페이 결제금액이 없습니다." }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("external_payment_records")
      .select("id,sales_record_id,import_status")
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

    const baseLogPayload = {
      provider: "CIDERPAY",
      external_payment_id: externalPaymentId,
      member_number: null,
      contract_number: null,
      member_name: memberName || null,
      member_phone: memberPhone || null,
      billing_month: null,
      product_name: productName || null,
      collection_status: isPaidStatus(paymentStatus) ? "완납" : null,
      payment_status: paymentStatus || null,
      payment_type: "정기결제",
      payment_method: paymentMethod || null,
      promised_at: null,
      paid_at: paidAt,
      completed_at: paidAt,
      billing_amount: paidAmount,
      paid_amount: paidAmount,
      unpaid_amount: 0,
      result_message: paymentStatus || null,
      member_type: "분양회",
      manager_name: "주식회사광고인",
      match_status: memberPhone || memberName ? "matched" : "pending",
      raw_data: body,
    };

    if (!isPaidStatus(paymentStatus)) {
      const { data: paymentLog, error: logError } = await supabase
        .from("external_payment_records")
        .upsert(
          {
            ...baseLogPayload,
            import_status: "logged_only",
            import_message: "결제완료 상태가 아니어서 매출로 생성하지 않고 로그만 저장했습니다.",
          },
          { onConflict: "provider,external_payment_id" }
        )
        .select("id")
        .single();

      if (logError) throw logError;

      return NextResponse.json({
        ok: true,
        status: "logged_only",
        message: "결제완료 상태가 아니어서 로그만 저장했습니다.",
        paymentLogId: paymentLog?.id,
      });
    }

    const memo = [
      "사이다페이 정기결제 자동반영",
      `거래번호: ${externalPaymentId}`,
      `회원명: ${memberName || "-"}`,
      `연락처: ${memberPhone || "-"}`,
      `상품명: ${productName || "-"}`,
      `결제수단: ${paymentMethod || "-"}`,
      `결제상태: ${paymentStatus || "-"}`,
      `결제금액: ${paidAmount.toLocaleString()}원`,
    ].join("\n");

    const { data: salesRow, error: salesError } = await supabase
      .from("ad_executions")
      .insert({
        member_name: memberName || null,
        bunyanghoe_number: null,
        execution_amount: paidAmount,
        vat_amount: paidAmount,
        refund_amount: 0,
        channel: "사이다페이",
        contract_route: "분양회",
        payment_date: paidAt,
        team_member: "주식회사광고인",
        consultant: memberPhone || null,
        hightarget_mileage: 0,
        hightarget_reward: 0,
        hogaengnono_reward: 0,
        lms_reward: 0,
        memo,
      })
      .select("id")
      .single();

    if (salesError) throw salesError;

    const { data: paymentLog, error: logError } = await supabase
      .from("external_payment_records")
      .upsert(
        {
          ...baseLogPayload,
          sales_record_id: Number(salesRow.id),
          import_status: "sales_created",
          import_message: "사이다페이 결제내역을 통합매출관리로 자동 반영했습니다.",
        },
        { onConflict: "provider,external_payment_id" }
      )
      .select("id")
      .single();

    if (logError) throw logError;

    return NextResponse.json({
      ok: true,
      status: "sales_created",
      message: "사이다페이 결제가 통합매출관리로 자동 반영되었습니다.",
      paymentLogId: paymentLog?.id,
      salesRecordId: salesRow.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "CiderPay payment import failed.",
        error: stringifyError(error),
      },
      { status: 500 }
    );
  }
}
