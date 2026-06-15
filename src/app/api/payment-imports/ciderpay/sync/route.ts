import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_PRODUCT = "분양회(얼리버드)";
const MAX_PAGES = 2;
const PAGE_SIZE = 20;

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

async function salesRecordExists(id: unknown) {
  const numericId = Number(id);
  if (!numericId) return false;

  const { data, error } = await supabase
    .from("ad_executions")
    .select("id")
    .eq("id", numericId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}


async function findMatchedMemberByName(memberName: string) {
  const name = cleanText(memberName || "");
  if (!name) return null;

  const { data, error } = await supabase
    .from("contacts")
    .select("id,name,title,bunyanghoe_number,phone,assigned_to,consultant,meeting_result")
    .eq("name", name)
    .in("meeting_result", ["예약완료", "계약완료"])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchCiderpayPage(page: number, cookie: string) {
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
    throw new Error(`사이다페이 결제내역 페이지 요청 실패: HTTP ${response.status}`);
  }

  if (html.includes("로그인") && !html.includes("결제내역")) {
    throw new Error("사이다페이 자동 로그인 세션이 유효하지 않습니다.");
  }

  return html;
}

async function processPaymentRow($: cheerio.CheerioAPI, row: any) {
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

  if (!paymentViewId || !buyerName || !amount) {
    return { status: "skipped", reason: "필수값 없음" };
  }

  if (productName !== TARGET_PRODUCT) {
    return { status: "skipped", reason: "대상 상품 아님", productName };
  }

  const isCancel = statusText.includes("결제취소");
  const isComplete = statusText.includes("결제완료");

  if (!isCancel && !isComplete) {
    return { status: "skipped", reason: "대상 상태 아님", statusText };
  }

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

  if (existing?.sales_record_id && (await salesRecordExists(existing.sales_record_id))) {
    return {
      buyerName,
      productName,
      amount,
      paymentStatus: isCancel ? "결제취소" : "결제완료",
      status: "duplicate",
      salesRecordId: existing.sales_record_id,
    };
  }

  // 당일 취소 기록은 이미 skip 처리됨 → 재처리 방지
  if (existing && !existing.sales_record_id) {
    return {
      buyerName,
      productName,
      amount,
      paymentStatus: isCancel ? "결제취소" : "결제완료",
      status: "duplicate",
      reason: "이미 처리된 기록 (당일취소 skip 포함)",
    };
  }

  // ===== 당일 결제+취소 → CRM 반영 제외 =====
  if (isCancel) {
    const paidDate = paidAtText.slice(0, 10);
    const cancelDate = canceledAtText.slice(0, 10);

    if (paidDate && cancelDate && paidDate === cancelDate) {
      // 1) 같은 거래의 결제완료 매출이 이미 생성됐다면 삭제 (매출 과대계상 방지)
      const completeId = `${paymentViewId}_COMPLETE`;
      const { data: completeRec } = await supabase
        .from("external_payment_records")
        .select("id, sales_record_id")
        .eq("provider", "CIDERPAY")
        .eq("external_payment_id", completeId)
        .maybeSingle();

      if (completeRec?.sales_record_id) {
        await supabase
          .from("ad_executions")
          .delete()
          .eq("id", completeRec.sales_record_id);
        await supabase
          .from("external_payment_records")
          .update({
            sales_record_id: null,
            import_status: "same_day_cancel_removed",
            import_message: "당일 결제+취소 건으로 기존 매출 기록을 삭제했습니다.",
          })
          .eq("id", completeRec.id);
      }

      // 2) 취소 기록은 매출/환불 생성 없이 skip 마킹만
      await supabase.from("external_payment_records").upsert(
        {
          provider: "CIDERPAY",
          external_payment_id: externalPaymentId,
          member_name: buyerName,
          member_phone: "",
          member_number: "",
          manager_name: null,
          product_name: productName,
          payment_status: "결제취소",
          payment_method: "정기결제",
          paid_at: paidAtText || null,
          completed_at: canceledAtText || null,
          paid_amount: 0,
          billing_amount: amount,
          match_status: "matched",
          sales_record_id: null,
          import_status: "same_day_cancel_skipped",
          import_message: "당일 결제+취소 건으로 CRM 반영을 제외했습니다.",
          raw_data: {
            buyerName,
            productName,
            amount,
            paidAtText,
            canceledAtText,
            paymentViewId,
            externalPaymentId,
            statusText,
          },
        },
        { onConflict: "provider,external_payment_id" }
      );

      return {
        buyerName,
        productName,
        amount,
        paymentStatus: "결제취소",
        status: "same_day_cancel_skipped",
        reason: "당일 결제+취소 → CRM 반영 제외",
      };
    }
  }

  const paymentDate = isCancel
    ? canceledAtText.slice(0, 10)
    : paidAtText.slice(0, 10);

  const memo = [
    isCancel
      ? "사이다페이 정기결제 취소 자동반영"
      : "사이다페이 정기결제 완료 자동반영",
    `거래번호: ${paymentViewId}`,
    `구매자명: ${buyerName}`,
    `상품명: ${productName}`,
    `상태: ${isCancel ? "결제취소" : "결제완료"}`,
    `금액: ${amount.toLocaleString()}원`,
    `결제완료일시: ${paidAtText || "-"}`,
    `취소완료일시: ${canceledAtText || "-"}`,
  ].join("\n");

  const matchedMember = await findMatchedMemberByName(buyerName);
  const matchedManagerName = cleanText(matchedMember?.assigned_to || "");
  const matchedBunyanghoeNumber = cleanText(matchedMember?.bunyanghoe_number || "");
  const matchedConsultant = cleanText(matchedMember?.consultant || matchedMember?.phone || "");

  const salesPayload = isCancel
    ? {
        member_name: buyerName,
        bunyanghoe_number: matchedBunyanghoeNumber,
        execution_amount: 0,
        vat_amount: 0,
        refund_amount: amount,
        channel: "사이다페이",
        contract_route: "분양회",
        payment_date: paymentDate || new Date().toISOString().slice(0, 10),
        team_member: matchedManagerName || null,
        consultant: matchedConsultant,
        hightarget_mileage: 0,
        hightarget_reward: 0,
        hogaengnono_reward: 0,
        lms_reward: 0,
        memo,
      }
    : {
        member_name: buyerName,
        bunyanghoe_number: matchedBunyanghoeNumber,
        execution_amount: amount,
        vat_amount: amount,
        refund_amount: 0,
        channel: "사이다페이",
        contract_route: "분양회",
        payment_date: paymentDate || new Date().toISOString().slice(0, 10),
        team_member: matchedManagerName || null,
        consultant: matchedConsultant,
        hightarget_mileage: 0,
        hightarget_reward: 0,
        hogaengnono_reward: 0,
        lms_reward: 0,
        memo,
      };

  // ===== 중복 안전망: 동일 회원/일자/금액/채널 매출이 이미 있으면 생성하지 않고 연결만 =====
  const dupDate = paymentDate || new Date().toISOString().slice(0, 10);
  let dupQuery = supabase
    .from("ad_executions")
    .select("id")
    .eq("member_name", buyerName)
    .eq("channel", "사이다페이")
    .eq("payment_date", dupDate);

  dupQuery = isCancel
    ? dupQuery.eq("refund_amount", amount)
    : dupQuery.eq("execution_amount", amount);

  const { data: dupSales } = await dupQuery
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (dupSales?.id) {
    await supabase.from("external_payment_records").upsert(
      {
        provider: "CIDERPAY",
        external_payment_id: externalPaymentId,
        member_name: buyerName,
        member_phone: matchedMember?.phone || "",
        member_number: matchedBunyanghoeNumber,
        manager_name: matchedManagerName || null,
        product_name: productName,
        payment_status: isCancel ? "결제취소" : "결제완료",
        payment_method: "정기결제",
        paid_at: paidAtText || null,
        completed_at: isCancel ? canceledAtText || null : paidAtText || null,
        paid_amount: isCancel ? 0 : amount,
        billing_amount: amount,
        match_status: "matched",
        sales_record_id: Number(dupSales.id),
        import_status: "linked_existing",
        import_message: "동일 매출 기록이 이미 존재하여 신규 생성 없이 연결만 수행했습니다.",
        raw_data: { buyerName, productName, amount, paidAtText, canceledAtText, paymentViewId, externalPaymentId, statusText },
      },
      { onConflict: "provider,external_payment_id" }
    );

    return {
      buyerName,
      productName,
      amount,
      paymentStatus: isCancel ? "결제취소" : "결제완료",
      status: "duplicate",
      reason: "동일 매출 존재 → 연결만 수행",
      salesRecordId: dupSales.id,
    };
  }

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
        member_phone: matchedMember?.phone || "",
        member_number: matchedBunyanghoeNumber,
        manager_name: matchedManagerName || null,
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
        },
      },
      { onConflict: "provider,external_payment_id" }
    );

  if (logError) throw logError;

  // ── 카카오워크 매출방 알림 (결제완료 건만) ──
  if (!isCancel) {
    try {
      // N회차 계산: 해당 고객의 분양회 결제 누적 건수
      const { count: paymentCount } = await supabase
        .from("ad_executions")
        .select("id", { count: "exact", head: true })
        .eq("member_name", buyerName)
        .eq("contract_route", "분양회")
        .gt("execution_amount", 0);

      const nth = paymentCount || 1;

      // 사이다페이 세부내용 구성
      const ciderpayDetail = [
        "사이다페이 정기결제 완료 자동반영",
        `●거래번호: ${externalPaymentId}`,
        `●구매자명: ${buyerName}`,
        `●상품명: ${productName}`,
        `●상태: 결제완료`,
        `●금액: ${amount.toLocaleString()}원`,
        `●결제완료일시: ${paidAtText}`,
        `●취소완료일시: -`,
      ].join("\n");

      const baseUrl = process.env.CRM_BASE_URL || "https://crm-go-roan.vercel.app";
      await fetch(`${baseUrl}/api/kakaowork/send-sales-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_name: buyerName,
          member_title: matchedMember?.title || "",
          member_phone: matchedMember?.phone || "",
          execution_amount: amount,
          channel: "사이다페이",
          contract_route: "분양회",
          payment_date: paymentDate,
          team_member: matchedManagerName,
          is_auto: true,
          payment_count: nth,
          ciderpay_detail: ciderpayDetail,
        }),
      });
    } catch (kakaoErr) {
      console.warn("카카오워크 매출 알림 실패 (무시):", kakaoErr);
    }
  }

  return {
    buyerName,
    productName,
    amount,
    paymentStatus: isCancel ? "결제취소" : "결제완료",
    status: isCancel ? "cancel_created" : "sales_created",
    salesRecordId: salesRecord.id,
  };
}

export async function GET() {
  try {
    const cookie = await ciderpayLogin();

    const results: Array<Record<string, unknown>> = [];
    let totalFound = 0;
    let pagesFetched = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const html = await fetchCiderpayPage(page, cookie);
      const $ = cheerio.load(html);
      const rows = $("tr.success_tr, tr.cancel_tr");
      const rowCount = rows.length;

      if (rowCount === 0) break;

      pagesFetched += 1;
      totalFound += rowCount;

      for (const row of rows.toArray()) {
        const result = await processPaymentRow($, row);
        if (result.status !== "skipped") results.push(result);
      }

      if (rowCount < PAGE_SIZE) break;
    }

    const created = results.filter((item) => item.status === "sales_created").length;
    const canceled = results.filter((item) => item.status === "cancel_created").length;
    const duplicated = results.filter((item) => item.status === "duplicate").length;
    const sameDaySkipped = results.filter((item) => item.status === "same_day_cancel_skipped").length;
    const skipped = totalFound - results.length;

    return NextResponse.json({
      ok: true,
      message: "사이다페이 최근 결제내역 동기화 완료",
      mode: "recent",
      maxPages: MAX_PAGES,
      pagesFetched,
      targetProduct: TARGET_PRODUCT,
      totalFound,
      created,
      canceled,
      duplicated,
      sameDaySkipped,
      skipped,
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
