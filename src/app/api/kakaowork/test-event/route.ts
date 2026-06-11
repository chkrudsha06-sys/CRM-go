import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_WORK_API_BASE = "https://api.kakaowork.com/v1";

function desc(term: string, value: string) {
  return {
    type: "description",
    term,
    content: { type: "text", text: value || "-" },
    accent: true,
  };
}

async function sendBlocks(appKey: string, conversationId: string, label: string, blocks: any[]) {
  const res = await fetch(`${KAKAO_WORK_API_BASE}/messages.send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      conversation_id: Number(conversationId),
      text: `[진단] ${label}`,
      blocks,
    }),
  });
  const raw = await res.text();
  let result: any = null;
  try {
    result = raw ? JSON.parse(raw) : null;
  } catch {
    result = { raw };
  }
  return {
    label,
    ok: res.ok && result?.success !== false,
    error: result?.error || null,
  };
}

async function findUserIdByEmail(appKey: string, email: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${KAKAO_WORK_API_BASE}/users.find_by_email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers: { Authorization: `Bearer ${appKey}` }, cache: "no-store" }
    );
    const data = await res.json();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function getMentionEmail(name: string): string | null {
  const map = process.env.KAKAO_WORK_MENTION_MAP || "";
  for (const pair of map.split(",")) {
    const [n, email] = pair.split(":").map((s) => s.trim());
    if (n === name && email) return email;
  }
  return null;
}

export async function GET() {
  try {
    const appKey = process.env.KAKAO_WORK_APP_KEY;
    const conversationId = process.env.KAKAO_WORK_EVENT_CONVERSATION_ID;

    if (!appKey || !conversationId) {
      return NextResponse.json({ ok: false, message: "환경변수 누락" });
    }

    const results: any[] = [];

    // 진단 1: 항목 블록 전체 (실제와 동일한 항목명)
    results.push(
      await sendBlocks(appKey, conversationId, "진단1-항목블록", [
        { type: "header", text: "진단1: 항목 블록", style: "blue" },
        desc("출동일", "2026-06-19"),
        desc("지역", "인천 송도"),
        desc("대행사", "테스트대행사"),
        desc("컨택포인트", "최두식 본부장"),
        desc("연락처", "010-5555-5555"),
        desc("조직규모", "100명"),
        desc("발주수량", "200 + 100"),
        desc("비고", "테스트 비고입니다"),
      ])
    );

    // 진단 2: 멘션 블록
    const email = getMentionEmail("김재영");
    const uid = email ? await findUserIdByEmail(appKey, email) : null;
    if (uid) {
      results.push(
        await sendBlocks(appKey, conversationId, "진단2-멘션블록", [
          { type: "header", text: "진단2: 멘션", style: "blue" },
          {
            type: "text",
            text: "👤 담당자 확인 요청 : @김재영",
            inlines: [
              { type: "styled", text: "👤 담당자 확인 요청 : ", bold: true },
              { type: "mention", text: "@김재영", ref: { type: "kw", value: uid } },
            ],
          },
        ])
      );
    } else {
      results.push({ label: "진단2-멘션블록", ok: false, error: "user_id 조회 실패 (MENTION_MAP 또는 이메일 확인)" });
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || "알 수 없는 오류" });
  }
}
