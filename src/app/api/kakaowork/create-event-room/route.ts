import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

async function kakaoWorkRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const appKey = process.env.KAKAO_WORK_APP_KEY;
  if (!appKey) throw new Error("KAKAO_WORK_APP_KEY 환경변수가 없습니다.");

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
    throw new Error(`카카오워크 API 오류: ${JSON.stringify(data || text)}`);
  }
  return data as T;
}

// 이메일 → user_id 조회
async function findUserIdByEmail(email: string): Promise<number | null> {
  try {
    const result = await kakaoWorkRequest<{ user?: { id: number } }>(
      `/users.find_by_email?email=${encodeURIComponent(email)}`,
      { method: "GET" }
    );
    return result.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const ownerEmail = process.env.KAKAO_WORK_EVENT_ROOM_OWNER_EMAIL;
    if (!ownerEmail) {
      return NextResponse.json(
        { ok: false, message: "KAKAO_WORK_EVENT_ROOM_OWNER_EMAIL 환경변수가 없습니다." },
        { status: 400 }
      );
    }

    // 1. 방장 user_id 조회
    const ownerId = await findUserIdByEmail(ownerEmail);
    if (!ownerId) {
      return NextResponse.json(
        { ok: false, message: `방장 user_id를 찾지 못했습니다: ${ownerEmail}` },
        { status: 404 }
      );
    }

    // 2. 방 생성
    const roomName = process.env.KAKAO_WORK_EVENT_ROOM_NAME || "CRM 이벤트 알림방";
    const conversationResult = await kakaoWorkRequest<{
      conversation: { id: number | string; name?: string };
    }>("/conversations.open", {
      method: "POST",
      body: JSON.stringify({ user_ids: [ownerId], conversation_name: roomName }),
    });

    const conversationId = conversationResult.conversation?.id;
    if (!conversationId) {
      return NextResponse.json(
        { ok: false, message: "방 생성 실패", raw: conversationResult },
        { status: 500 }
      );
    }

    // 3. 팀원 초대
    const memberEmails = (process.env.KAKAO_WORK_EVENT_MEMBER_EMAILS || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const inviteResults: { email: string; status: string }[] = [];

    for (const email of memberEmails) {
      const uid = await findUserIdByEmail(email);
      if (!uid) {
        inviteResults.push({ email, status: "user_id 없음 (이메일 확인 필요)" });
        continue;
      }
      try {
        await kakaoWorkRequest(`/conversations/${conversationId}/invite`, {
          method: "POST",
          body: JSON.stringify({ user_ids: [uid] }),
        });
        inviteResults.push({ email, status: "초대 완료" });
      } catch (e: any) {
        inviteResults.push({ email, status: `초대 실패: ${e?.message}` });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "카카오워크 이벤트 알림방 생성 및 팀원 초대 완료",
      roomName,
      conversationId,
      ownerEmail,
      inviteResults,
      envValueToSave: `KAKAO_WORK_EVENT_CONVERSATION_ID=${conversationId}`,
      guide: "위 conversationId 값을 Vercel 환경변수 KAKAO_WORK_EVENT_CONVERSATION_ID에 등록하세요.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "이벤트 알림방 생성 실패" },
      { status: 500 }
    );
  }
}
