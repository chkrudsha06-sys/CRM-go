import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 푸시 구독 저장
export async function POST(req: Request) {
  try {
    const { contactId, subscription } = await req.json();
    if (!contactId || !subscription) {
      return NextResponse.json({ error: "contactId와 subscription이 필요합니다." }, { status: 400 });
    }

    // 기존 구독 업데이트 or 신규 삽입
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        contact_id: contactId,
        subscription: JSON.stringify(subscription),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 푸시 구독 삭제
export async function DELETE(req: Request) {
  try {
    const { contactId } = await req.json();
    if (!contactId) return NextResponse.json({ error: "contactId 필요" }, { status: 400 });

    await supabase.from("push_subscriptions").delete().eq("contact_id", contactId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
