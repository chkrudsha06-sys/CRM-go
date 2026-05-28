import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:tftteam.adperson@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
}

// 특정 고객에게 푸시 알림 발송
export async function POST(req: Request) {
  try {
    const { contactId, contactName, title, body, url, tag } = await req.json();

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ error: "VAPID 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // contactId 또는 contactName으로 구독 조회
    let query = supabase.from("push_subscriptions").select("contact_id, subscription");
    let dashboardUrl = url || "";

    if (contactId) {
      query = query.eq("contact_id", contactId);
      // dashboard_code 조회
      if (!dashboardUrl) {
        const { data: c } = await supabase.from("contacts").select("dashboard_code").eq("id", contactId).maybeSingle();
        if (c?.dashboard_code) dashboardUrl = `/my/${c.dashboard_code}`;
      }
    } else if (contactName) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, dashboard_code")
        .eq("name", contactName);
      if (!contacts || contacts.length === 0) {
        return NextResponse.json({ sent: 0, message: "해당 고객을 찾을 수 없습니다." });
      }
      if (!dashboardUrl && contacts[0]?.dashboard_code) dashboardUrl = `/my/${contacts[0].dashboard_code}`;
      const ids = contacts.map(c => c.id);
      query = query.in("contact_id", ids);
    } else {
      return NextResponse.json({ error: "contactId 또는 contactName이 필요합니다." }, { status: 400 });
    }

    const { data: subs } = await query;
    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: "푸시 구독이 없습니다." });
    }

    const payload = JSON.stringify({ title, body, url: dashboardUrl, tag });
    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        const subscription = JSON.parse(sub.subscription);
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (err: any) {
        // 구독 만료/해제된 경우 삭제
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("contact_id", sub.contact_id);
        }
        failed++;
      }
    }

    // 알림 로그 저장
    await supabase.from("push_logs").insert({
      contact_id: contactId || null,
      contact_name: contactName || null,
      title, body, sent_count: sent, failed_count: failed,
      created_at: new Date().toISOString(),
    }).then(() => {});

    return NextResponse.json({ sent, failed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
