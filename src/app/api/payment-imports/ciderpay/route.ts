import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_PRODUCT = "분양회(얼리버드)";
const MAX_PAGES = 2;

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function onlyNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function getPaymentIdFromHref(href: string) {
  const match = href.match(/\/se\/payment\/view\/([^"']+)/);
  return match?.[1] || "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function buildPaymentsUrl(page: number) {
  const params = new URLSearchParams({
    page: String(page),
    paySubMethod: "BILLING_RP",
    orderVal: "",
    orderAsc: "false",
    state: "",
    keyword: "",
    startDate: "",
    endDate: "",
    dateRange: "",
    minTotalPrice: "",
    maxTotalPrice: "",
    cardNum: "",
  });

  return `https://my.ciderpay.com/se/regularPayment/payments?${params.toString()}`;
}

async function ciderpayLogin() {
  const id = process.env.CIDERPAY_ID;
  const password = process.env.CIDERPAY_PASSWORD;

  if (!id || !password) {
    throw new Error("CIDERPAY_ID 또는 CIDERPAY_PASSWORD 환경변수가 없습니다.");
  }

  const form = new URLSearchParams();
  form.set("user_id", id);
  form.set("user_pass", password);

  const response = await fetch("https://my.ciderpay.com/login", {
    method: "POST",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://my.ciderpay.com",
      Referer: "https://my.ciderpay.com/login",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
    },
    body: form.toString(),
    cache: "no-store",
    redirect: "manual",
  });

  const setCookie = response.headers.get("set-cookie") || "";
  const jsessionMatch = setCookie.match(/JSESSIONID=([^;]+)/);

  if (!jsessionMatch?.[1]) {
    const text = await response.text().catch(() => "");
    throw new Error(`사이다페이 로그인 실패 또는 쿠키 발급 실패: ${text.slice(0, 300)}`);
  }

  return `JSESSIONID=${jsessionMatch[1]}`;
}

async function syncCiderpay(maxPages: number) {
  const cookie = await ciderpayLogin();

  const results: Array<Record<string, unknown>> = [];
  let totalRows = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetch(buildPaymentsUrl(page), {
      method: "GET",
      headers: {
        Cookie: cookie,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    const html = await response.text();

    if (!response.ok) {
      throw new Error(`사이다페이 결제내역 페이지 요청 실패: ${response.status}`);
    }

    if (html.includes("로그인") && !html.includes("결제내역")) {
      throw new Error("사이다페이 자동 로그인 세션이 유효하지 않습니다.");
    }

    const $ = cheerio.load(html);
    const rows = $("tr.success_tr, tr.cancel_tr");
    totalRows += rows.length;

    if (rows.length === 0) break;

    for (const row of rows.toArray()) {
      const $row = $(row);

      const buyerName = cleanText(
        $row
          .find(".multiTd_Li")
          .filter((_, el) => $(el).text().includes("구매자명"))
          .find("strong")
          .first()
          .text()
      );

      const productAnchor = $row.find('a[href^="/se/payment/view/"]').first();
      const productName = cleanText(productAnchor.text());
      const href = productAnchor.attr("href") || "";
      const paymentViewId = getPaymentIdFromHref(href);

      const statusText = cleanText($row.find("td").eq(4).text());
      const amount = onlyNumber($row.find(".price_txt strong").first().text());

      const paidAtText = cleanText(
        $row
          .find(".multiTd_Li")
          .filter((_, el) => $(el).text().includes("결제완료일시"))
          .find(".multiTd_LiDd")
          .first()
          .text()
      );

      const canceledAtText = cleanText(
        $row
          .find(".multiTd_Li")
          .filter((_, el) => $(el).text().includes("취소완료일시"))
          .find(".multiTd_LiDd")
          .first()
          .text()
      );

      if (!paymentViewId || !buyerName || !amount) continue;
      if (productName !== TARGET_PRODUCT) continue;

      const isCancel = statusText.includes("결제취소");
      const isComplete = statusText.includes("결제완료");

      if (!isCancel && !isComplete) continue;

      const externalPaymentId = isCancel
        ? `${paymentViewId}_CANCEL`
        : `${paymentViewId}_COMPLETE`;

      const { data: existing, error: existingError } = await supabase
        .from("external_payment_records")
        .select("id, sales_record_id")
        .eq("provider", "CIDERPAY")
        .eq("external_payment_id", externalPaymentId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.sales_record_id) {
        results.push({
          buyerName,
          productName,
          amount,
          paymentStatus: isCancel ? "결제취소" : "결제완료",
          status: "duplicate",
          salesRecordId: existing.sales_record_id,
        });
        continue;
      }

      const paymentDate = isCancel
        ? canceledAtText.slice(0, 10)
        : paidAtText.slice(0, 10);

      const memo = [
        isCancel ? "사이다페이 정기결제 취소 자동반영" : "사이다페이 정기결제 완료 자동반영",
        `거래번호: ${paymentViewId}`,
        `구매자명: ${buyerName}`,
        `상품명: ${productName}`,
        `상태: ${isCancel ? "결제취소" : "결제완료"}`,
        `금액: ${amount.toLocaleString()}원`,
        `결제완료일시: ${paidAtText || "-"}`,
        `취소완료일시: ${canceledAtText || "-"}`,
      ].join("\n");

      const salesPayload = isCancel
        ? {
            member_name: buyerName,
            bunyanghoe_number: "",
            execution_amount: 0,
            vat_amount: 0,
            refund_amount: amount,
            channel: "사이다페이",
            contract_route: "분양회",
            payment_date: paymentDate || new Date().toISOString().slice(0, 10),
            team_member: "주식회사광고인",
            consultant: "",
            hightarget_mileage: 0,
            hightarget_reward: 0,
            hogaengnono_reward: 0,
            lms_reward: 0,
            memo,
          }
        : {
            member_name: buyerName,
            bunyanghoe_number: "",
            execution_amount: amount,
            vat_amount: amount,
            refund_amount: 0,
            channel: "사이다페이",
            contract_route: "분양회",
            payment_date: paymentDate || new Date().toISOString().slice(0, 10),
            team_member: "주식회사광고인",
            consultant: "",
            hightarget_mileage: 0,
            hightarget_reward: 0,
            hogaengnono_reward: 0,
            lms_reward: 0,
            memo,
          };

      const { data: salesRecord, error: salesError } = await supabase
        .from("ad_executions")
        .insert(salesPayload)
        .select("id")
        .single();

      if (salesError) throw salesError;

      const { error: logError } = await supabase
        .from("external_payment_records")
        .upsert(
          {
            provider: "CIDERPAY",
            external_payment_id: externalPaymentId,
            member_name: buyerName,
            member_phone: "",
            product_name: productName,
            payment_status: isCancel ? "결제취소" : "결제완료",
            payment_method: "정기결제",
            paid_at: paidAtText || null,
            completed_at: isCancel ? canceledAtText || null : paidAtText || null,
            paid_amount: isCancel ? 0 : amount,
            billing_amount: amount,
            match_status: "matched",
            sales_record_id: Number(salesRecord.id),
            import_status: isCancel ? "cancel_created" : "sales_created",
            import_message: isCancel
              ? "사이다페이 결제취소 내역을 통합매출 환불 기록으로 생성했습니다."
              : "사이다페이 결제완료 내역을 통합매출로 생성했습니다.",
            raw_data: {
              buyerName,
              productName,
              amount,
              paidAtText,
              canceledAtText,
              paymentViewId,
              externalPaymentId,
              statusText,
              page,
            },
          },
          { onConflict: "provider,external_payment_id" }
        );

      if (logError) throw logError;

      results.push({
        buyerName,
        productName,
        amount,
        paymentStatus: isCancel ? "결제취소" : "결제완료",
        status: isCancel ? "cancel_created" : "sales_created",
        salesRecordId: salesRecord.id,
      });
    }
  }

  return {
    totalRows,
    results,
  };
}

export async function GET() {
  try {
    const { totalRows, results } = await syncCiderpay(MAX_PAGES);

    const created = results.filter((item) => item.status === "sales_created").length;
    const canceled = results.filter((item) => item.status === "cancel_created").length;
    const duplicated = results.filter((item) => item.status === "duplicate").length;

    return NextResponse.json({
      ok: true,
      message: "사이다페이 동기화 완료",
      mode: "recent",
      maxPages: MAX_PAGES,
      targetProduct: TARGET_PRODUCT,
      totalFound: totalRows,
      created,
      canceled,
      duplicated,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "사이다페이 동기화 실패",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
