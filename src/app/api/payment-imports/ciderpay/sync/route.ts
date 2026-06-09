import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CIDERPAY_PAYMENTS_URL =
  "https://my.ciderpay.com/se/regularPayment/payments?paySubMethod=BILLING_RP&orderVal=&orderAsc=false&state=COMPLETE&keyword=&startDate=&endDate=&dateRange=&minTotalPrice=&maxTotalPrice=&cardNum=";

function onlyNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getPaymentIdFromHref(href: string) {
  const match = href.match(/\/se\/payment\/view\/([^"']+)/);
  return match?.[1] || "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function GET() {
  try {
    const cookie = process.env.CIDERPAY_COOKIE;

    if (!cookie) {
      return NextResponse.json(
        { ok: false, message: "CIDERPAY_COOKIE 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const response = await fetch(CIDERPAY_PAYMENTS_URL, {
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
      return NextResponse.json(
        {
          ok: false,
          message: "사이다페이 결제내역 페이지 요청 실패",
          status: response.status,
        },
        { status: 500 }
      );
    }

    if (html.includes("로그인") && !html.includes("결제내역")) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "사이다페이 로그인이 만료되었습니다. CIDERPAY_COOKIE를 새로 넣어야 합니다.",
        },
        { status: 401 }
      );
    }

    const $ = cheerio.load(html);
    const rows = $("tr.success_tr");
    const results: Array<Record<string, unknown>> = [];

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
      const externalPaymentId = getPaymentIdFromHref(href);

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

      if (
        !externalPaymentId ||
        !buyerName ||
        !amount ||
        !statusText.includes("결제완료")
      ) {
        continue;
      }

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
          status: "duplicate",
          salesRecordId: existing.sales_record_id,
        });
        continue;
      }

      const memo = [
        "사이다페이 정기결제 실제 데이터 자동반영",
        `거래번호: ${externalPaymentId}`,
        `구매자명: ${buyerName}`,
        `상품명: ${productName}`,
        `결제금액: ${amount.toLocaleString()}원`,
        `결제완료일시: ${paidAtText}`,
      ].join("\n");

      const { data: salesRecord, error: salesError } = await supabase
        .from("ad_executions")
        .insert({
          member_name: buyerName,
          bunyanghoe_number: "",
          execution_amount: amount,
          vat_amount: amount,
          refund_amount: 0,
          channel: "사이다페이",
          contract_route: "분양회",
          payment_date: paidAtText.slice(0, 10),
          team_member: "주식회사광고인",
          consultant: "",
          hightarget_mileage: 0,
          hightarget_reward: 0,
          hogaengnono_reward: 0,
          lms_reward: 0,
          memo,
        })
        .select("*")
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
            payment_status: "결제완료",
            payment_method: "정기결제",
            paid_at: paidAtText,
            paid_amount: amount,
            billing_amount: amount,
            match_status: "matched",
            sales_record_id: Number(salesRecord.id),
            import_status: "sales_created",
            import_message:
              "사이다페이 실제 결제내역을 통합매출로 생성했습니다.",
            raw_data: {
              buyerName,
              productName,
              amount,
              paidAtText,
              externalPaymentId,
            },
          },
          { onConflict: "provider,external_payment_id" }
        );

      if (logError) throw logError;

      results.push({
        buyerName,
        productName,
        amount,
        status: "sales_created",
        salesRecordId: salesRecord.id,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "사이다페이 결제내역 동기화 완료",
      totalFound: rows.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "사이다페이 결제내역 동기화 실패",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
