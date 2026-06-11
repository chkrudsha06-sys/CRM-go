import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const today = todayKST();
    const serverUTC = new Date().toISOString();

    const { data: rows, error } = await supabase
      .from("daily_activity_goals")
      .select("owner_name, work_date, is_outside_meeting")
      .eq("work_date", today);

    const { data: allRecent } = await supabase
      .from("daily_activity_goals")
      .select("owner_name, work_date, is_outside_meeting")
      .order("work_date", { ascending: false })
      .limit(20);

    return NextResponse.json({
      서버UTC시각: serverUTC,
      오늘KST날짜: today,
      오늘등록된기록: rows || [],
      오늘등록수: (rows || []).length,
      최근20건기록: allRecent || [],
      에러: error?.message || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message });
  }
}
