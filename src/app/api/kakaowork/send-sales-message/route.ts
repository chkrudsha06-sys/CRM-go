import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

function formatWon(value: unknown): string {
  return Number(value || 0).toLocaleString("ko-KR") + "원";
}

function formatMoney55(value: unknown): string {
  const n = Number(value || 0);
  if (n === 550000) return "55만(vat포함)";
  if (n % 10000 === 0) return `${n / 10000}만원`;
  return formatWon(n);
}

function getKoreanDate(dateStr?: string | null): string {
  const d = dateStr ? new Date(`${dateStr.slice(0, 10)}T00:00:00`) : new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_SALES_CONVERSATION_ID;

    if (!appKey || !conversationId) {
      return NextResponse.json(
        { ok: false, message: "APP_KEY 또는 CONVERSATION_ID 환경변수가 없습니다." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      member_name,
      member_title,
      member_phone,
      execution_amount,
      channel,
      contract_route,
      payment_date,
      team_member,
      memo,
      is_auto, // 사이다페이 자동 = true, 수기 = false
      payment_card,
      card_number,
      payment_count, // N회차
      ciderpay_detail, // 사이다페이 자동반영 세부내용
    } = body || {};

    const dateStr = getKoreanDate(payment_date);
    const amountStr = formatMoney55(execution_amount);
    const route = normalizeRoute(contract_route);
    const manager = team_member || "-";
    const nthStr = payment_count ? `분양회${payment_count} 회차` : "분양회N 회차";

    // ── 구분선 ──
    const LINE = "──────────────";
    const SHORT = "────────────────────";

    let text = "";

    if (is_auto) {
      // 사이다페이 자동반영 양식
      text = [
        `#${dateStr} 분양회매출 [대외협력팀 ${manager} 메인]`,
        `▶분양회`,
        `●결제금액(A): ${amountStr}`,
        SHORT,
        `●고객명: ${member_name || ""}`,
        `●직급: ${member_title || ""}`,
        `●연락처: ${member_phone || ""}`,
        SHORT,
        ciderpay_detail || [
          "사이다페이 정기결제 완료 자동반영",
        ].join("\n"),
        SHORT,
        `●특이사항`,
        `1. ${nthStr} 결제건 입니다.`,
      ].join("\n");
    } else {
      // 수기 등록 양식
      const channelLine = channel && channel !== "사이다페이"
        ? `●결제채널: ${channel}${payment_card ? `, ${payment_card}` : ""}`
        : `●결제채널: ${channel || ""}`;

      text = [
        `#${dateStr} 분양회매출 [대외협력팀 ${manager} 메인]`,
        `▶분양회`,
        `●결제금액(A): ${amountStr}`,
        SHORT,
        `●고객명: ${member_name || ""}`,
        `●직급: ${member_title || ""}`,
        `●연락처: ${member_phone || ""}`,
        SHORT,
        channelLine,
        SHORT,
        `●특이사항`,
        `1. ${nthStr} 결제건 입니다.`,
      ].join("\n");
    }

    const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        conversation_id: Number(conversationId),
        text,
      }),
    });

    const resText = await res.text();
    let data: any = null;
    try { data = resText ? JSON.parse(resText) : null; } catch { data = { raw: resText }; }

    if (!res.ok || data?.success === false) {
      return NextResponse.json(
        { ok: false, message: "카카오워크 발송 실패", detail: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "매출방 게시 완료" });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "알 수 없는 오류" },
      { status: 500 }
    );
  }
}

function normalizeRoute(route?: string | null): string {
  if (!route) return "분양회";
  if (route.includes("분양회")) return "분양회";
  return route;
}
