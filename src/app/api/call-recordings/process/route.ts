import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function mask(value?: string | null) {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function getAuthValue(request: NextRequest) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const queryToken = url.searchParams.get("token");
  const headerSecret = request.headers.get("x-process-secret");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "").trim()
    : null;

  return querySecret || queryToken || headerSecret || bearerToken || "";
}

async function handler(request: NextRequest) {
  const expected = process.env.CALL_RECORDINGS_PROCESS_SECRET || "";
  const received = getAuthValue(request);
  const url = new URL(request.url);

  return NextResponse.json({
    ok: Boolean(expected && received && expected === received),
    route: "/api/call-recordings/process",
    method: request.method,
    env: {
      CALL_RECORDINGS_PROCESS_SECRET_exists: Boolean(expected),
      CALL_RECORDINGS_PROCESS_SECRET_masked: mask(expected),
    },
    received: {
      has_secret_query: url.searchParams.has("secret"),
      has_token_query: url.searchParams.has("token"),
      has_x_process_secret_header: Boolean(request.headers.get("x-process-secret")),
      has_authorization_header: Boolean(request.headers.get("authorization")),
      value_masked: mask(received),
    },
    next: expected
      ? received
        ? expected === received
          ? "인증 성공입니다. 이제 실제 처리 코드로 되돌리면 됩니다."
          : "Vercel 환경변수 Value와 URL에 넣은 secret 값이 서로 다릅니다."
        : "URL에 ?secret=값 을 붙이지 않았습니다."
      : "Vercel에 CALL_RECORDINGS_PROCESS_SECRET 환경변수가 적용되지 않았습니다. 저장 후 Redeploy가 필요합니다.",
    time: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
