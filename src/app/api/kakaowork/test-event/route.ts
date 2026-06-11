import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;

    // 1단계: 환경변수 확인
    if (!appKey) {
      return NextResponse.json({
        ok: false,
        step: "환경변수 확인",
        message: "KAKAO_WORK_APP_KEY가 등록되어 있지 않습니다.",
      });
    }
    if (!conversationId) {
      return NextResponse.json({
        ok: false,
        step: "환경변수 확인",
        message: "KAKAO_WORK_EVENT_CONVERSATION_ID가 등록되어 있지 않습니다. (재배포 했는지도 확인)",
      });
    }

    // 2단계: 테스트 메시지 발송
    const res = await fetch("https://api.kakaowork.com/v1/messages.send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        conversation_id: Number(conversationId),
        text: "✅ 테스트 메시지입니다. 이 메시지가 보이면 연동 성공!",
      }),
    });

    const raw = await res.text();
    let result: any = null;
    try {
      result = raw ? JSON.parse(raw) : null;
    } catch {
      result = { raw };
    }

    if (!res.ok || result?.success === false) {
      return NextResponse.json({
        ok: false,
        step: "카카오워크 발송",
        message: "발송 실패. 아래 detail의 error 내용을 확인하세요.",
        usedConversationId: conversationId,
        httpStatus: res.status,
        detail: result,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "발송 성공! 카카오워크 방을 확인하세요.",
      usedConversationId: conversationId,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      step: "예외 발생",
      message: error?.message || "알 수 없는 오류",
    });
  }
}
