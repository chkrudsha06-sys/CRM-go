import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

const EXEC_MEMBERS: Record<string, string> = {
  조계현: "메인",
  이세호: "어쏘",
  기여운: "어쏘",
  최연전: "CX",
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

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

async function sendResultMessage(appKey: string, conversationId: number, text: string) {
  try {
    await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${appKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ conversation_id: conversationId, text }),
    });
  } catch {}
}

export async function POST(request: Request) {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const body = await request.json();

    if (body?.type !== "submit_action") {
      return NextResponse.json({ ok: true });
    }

    const value = String(body?.value || "");
    const [domain, param1, action] = value.split(":");

    const supabase = getSupabase();
    const conversationId = body?.message?.conversation_id;
    const clickerName = body?.react_user_id && appKey
      ? await getUserName(appKey, Number(body.react_user_id))
      : "알 수 없음";

    // ===== 완판트럭 버튼 =====
    if (domain === "wanpan") {
      const truckId = Number(param1);
      if (!truckId || !action) return NextResponse.json({ ok: true });

      const { data: truck } = await supabase
        .from("wanpan_trucks")
        .select("id, site_name, assigned_to, is_ordered, is_direct_order, order_confirmed_by")
        .eq("id", truckId)
        .single();

      if (!truck) return NextResponse.json({ ok: true });

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

      const { error } = await supabase.from("wanpan_trucks").update(updatePayload).eq("id", truckId);

      if (appKey && conversationId) {
        const text = error
          ? `⚠️ [${truck.site_name || "현장"}] ${actionLabel} 처리 실패`
          : `✅ [${truck.site_name || "현장"}] ${actionLabel} 처리됨 (처리자: ${clickerName})`;
        await sendResultMessage(appKey, Number(conversationId), text);
      }

      return NextResponse.json({ ok: true });
    }

    // ===== 일별활동 외근(미팅) 버튼 =====
    if (domain === "daily") {
      const memberName = param1;
      if (action !== "outside" || !memberName) return NextResponse.json({ ok: true });

      const title = EXEC_MEMBERS[memberName] || "";
      const today = todayKST();

      // 이미 등록된 기록이 있는지 확인
      const { data: existing } = await supabase
        .from("daily_activity_goals")
        .select("id")
        .eq("work_date", today)
        .eq("owner_name", memberName)
        .maybeSingle();

      let error: any = null;

      if (existing) {
        // 기존 기록이 있으면 외근으로 업데이트
        const res = await supabase
          .from("daily_activity_goals")
          .update({ is_outside_meeting: true })
          .eq("id", existing.id);
        error = res.error;
      } else {
        // 기록이 없으면 외근으로 신규 생성
        const res = await supabase.from("daily_activity_goals").insert({
          work_date: today,
          owner_name: memberName,
          owner_title: title,
          owner_role: "exec",
          is_outside_meeting: true,
          goal_consultant_db: 0,
          goal_second_touch: 0,
          goal_new_tm: 0,
          goal_manage_tm: 0,
          goal_coldtalk: 0,
          goal_media_mix: 0,
          goal_meeting_confirmed: 0,
          goal_work_items: [],
          result_consultant_db: 0,
          result_second_touch: 0,
          result_new_tm: 0,
          result_manage_tm: 0,
          result_coldtalk: 0,
          result_media_mix: 0,
          result_meeting_confirmed: 0,
        });
        error = res.error;
      }

      if (appKey && conversationId) {
        const text = error
          ? `⚠️ ${memberName} ${title} 외근(미팅) 처리 실패`
          : `📌 ${memberName} ${title} — 금일 외근(미팅)으로 처리되었습니다. (처리자: ${clickerName})`;
        await sendResultMessage(appKey, Number(conversationId), text);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
