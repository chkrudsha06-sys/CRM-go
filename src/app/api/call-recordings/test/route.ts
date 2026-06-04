import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "call-recordings test route is working",
    time: new Date().toISOString(),
  });
}
