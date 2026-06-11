import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 클릭한 사람 이름 조회
async function getUserName(appKey: string, userId: number): Promise<string> {
  try {
    const res = await fetch(`${KAKAO_WORK_API_BASE}/users.info?user_id=${userId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${appKey}` },
      cache: "no-store",
    });
    const data = await res.json();
    return data?.user?.display_name || data?.user?.name || "알 수 없음";
  } catch {
    return "알 수 없음";
  }
}

// 방에 처리 결과 메시지 발송
async function sendResultMessage(appKey: string, conversationId: number, text: string) {
  try {
    await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ conversation_id: conversationId, text }),
    });
  } catch {
    // 결과 메시지 실패는 무시
  }
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const body = await request.json();

    // 버튼 클릭(submit_action) 이외의 신호는 무시하고 200 반환
    if (body?.type !== "submit_action") {
      return NextResponse.json({ ok: true });
    }

    const value = String(body?.value || "");
    const [domain, idStr, action] = value.split(":");
    const truckId = Number(idStr);

    if (domain !== "wanpan" || !truckId || !action) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabase();

    // 현재 트럭 정보 조회
    const { data: truck } = await supabase
      .from("wanpan_trucks")
      .select("id, site_name, assigned_to, is_ordered, is_direct_order, order_confirmed_by")
      .eq("id", truckId)
      .single();

    if (!truck) {
      return NextResponse.json({ ok: true });
    }

    // 액션별 업데이트
    let updatePayload: Record<string, any> = {};
    let actionLabel = "";

    if (action === "order") {
      updatePayload = { is_ordered: true };
      actionLabel = "발주 완료";
    } else if (action === "draft") {
      updatePayload = { is_direct_order: true };
      actionLabel = "시안 발주 완료";
    } else if (action === "confirm") {
      updatePayload = { order_confirmed_by: truck.assigned_to || "확인완료" };
      actionLabel = "담당자 확인 완료";
    } else {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("wanpan_trucks")
      .update(updatePayload)
      .eq("id", truckId);

    // 처리 결과 메시지 발송
    const conversationId = body?.message?.conversation_id;
    if (appKey && conversationId) {
      const clickerName = body?.react_user_id
        ? await getUserName(appKey, Number(body.react_user_id))
        : "알 수 없음";

      const text = error
        ? `⚠️ [${truck.site_name || "현장"}] ${actionLabel} 처리 실패 (CRM 오류)`
        : `✅ [${truck.site_name || "현장"}] ${actionLabel} 처리됨 (처리자: ${clickerName})`;

      await sendResultMessage(appKey, Number(conversationId), text);
    }

    return NextResponse.json({ ok: true });
  } catch {
    // 어떤 경우에도 200을 반환해야 카카오워크가 재시도하지 않음
    return NextResponse.json({ ok: true });
  }
}
