import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

async function kakaoWorkRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const appKey = process.env.KAKAO_WORK_APP_KEY;

  if (!appKey) {
    throw new Error("KAKAO_WORK_APP_KEY 환경변수가 없습니다.");
  }

  const response = await fetch(`${KAKAO_WORK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${appKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data?.success === false) {
    throw new Error(
      `카카오워크 API 오류: ${JSON.stringify(data || text)}`
    );
  }

  return data as T;
}

export async function GET() {
  try {
    const email = process.env.KAKAO_WORK_ROOM_OWNER_EMAIL;

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          message: "KAKAO_WORK_ROOM_OWNER_EMAIL 환경변수가 없습니다.",
          next: "Vercel 환경변수에 카카오워크 로그인 이메일을 등록해주세요.",
        },
        { status: 400 }
      );
    }

    const userResult = await kakaoWorkRequest<{
      success: boolean;
      user: {
        id: number;
        name?: string;
        email?: string;
      };
    }>(`/users.find_by_email?email=${encodeURIComponent(email)}`, {
      method: "GET",
    });

    const userId = userResult.user?.id;

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          message: "카카오워크 user_id를 찾지 못했습니다.",
          userResult,
        },
        { status: 404 }
      );
    }

    const roomName =
      process.env.KAKAO_WORK_SALES_ROOM_NAME || "CRM 매출방";

    const conversationResult = await kakaoWorkRequest<{
      success: boolean;
      conversation: {
        id: number | string;
        name?: string;
        type?: string;
        users_count?: number;
      };
    }>("/conversations.open", {
      method: "POST",
      body: JSON.stringify({
        user_ids: [userId],
        conversation_name: roomName,
      }),
    });

    const conversationId = conversationResult.conversation?.id;

    return NextResponse.json({
      ok: true,
      message: "카카오워크 CRM 매출방 생성 완료",
      ownerEmail: email,
      ownerUserId: userId,
      conversationId,
      roomName,
      envValueToSave: `KAKAO_WORK_SALES_CONVERSATION_ID=${conversationId}`,
      guide:
        "위 conversationId 값을 Vercel 환경변수 KAKAO_WORK_SALES_CONVERSATION_ID에 등록하세요.",
      raw: conversationResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "카카오워크 매출방 생성 실패",
      },
      { status: 500 }
    );
  }
}
