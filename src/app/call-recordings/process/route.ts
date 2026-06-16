import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
};

type ManagerFolder = {
  manager: string;
  envKey: string;
  folderId: string | undefined;
};

type ContactRow = Record<string, unknown>;

type MatchSource = "customer_db" | "vip_db";

type MatchedContact = ReturnType<typeof simplifyContact> & {
  matchSource: MatchSource;
  matchSourceLabel: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getStringField(row: ContactRow, key: string) {
  const value = row[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function getNumberField(row: ContactRow, key: string) {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getManagerFolders(): ManagerFolder[] {
  return [
    {
      manager: "기여운",
      envKey: "GOOGLE_DRIVE_FOLDER_KI_YEO_UN",
      folderId: process.env.GOOGLE_DRIVE_FOLDER_KI_YEO_UN,
    },
    {
      manager: "이세호",
      envKey: "GOOGLE_DRIVE_FOLDER_LEE_SE_HO",
      folderId: process.env.GOOGLE_DRIVE_FOLDER_LEE_SE_HO,
    },
    {
      manager: "조계현",
      envKey: "GOOGLE_DRIVE_FOLDER_CHO_GYE_HYUN",
      folderId: process.env.GOOGLE_DRIVE_FOLDER_CHO_GYE_HYUN,
    },
    {
      manager: "최연전",
      envKey: "GOOGLE_DRIVE_FOLDER_CHO_YEON_JEON",
      folderId: process.env.GOOGLE_DRIVE_FOLDER_CHO_YEON_JEON,
    },
  ];
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeGeminiMimeType(mimeType: string) {
  if (mimeType === "audio/x-m4a") return "audio/mp4";
  if (mimeType === "audio/m4a") return "audio/mp4";
  return mimeType || "audio/mp4";
}


function getSyncStartAt() {
  const raw = process.env.CALL_RECORDING_SYNC_START_AT;

  if (!raw) return null;

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid CALL_RECORDING_SYNC_START_AT value. Use ISO format, for example 2026-06-05T00:00:00+09:00. Current value: ${raw}`
    );
  }

  return parsed;
}

function isFileAfterSyncStart(file: DriveFile, syncStartAt: Date | null) {
  if (!syncStartAt) return true;

  const baseTime = file.createdTime || file.modifiedTime;
  if (!baseTime) return false;

  const fileTime = new Date(baseTime);
  if (Number.isNaN(fileTime.getTime())) return false;

  return fileTime.getTime() >= syncStartAt.getTime();
}

function extractPhoneFromFileName(fileName: string) {
  const candidates = fileName.match(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  return normalizePhone(candidates[0]);
}

function extractDateFromFileName(fileName: string) {
  const match = fileName.match(/20\d{6}/);

  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }

  const raw = match[0];

  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function getContactPhone(contact: ContactRow) {
  return (
    getStringField(contact, "phone") ||
    getStringField(contact, "mobile") ||
    getStringField(contact, "contact_phone") ||
    getStringField(contact, "customer_phone") ||
    getStringField(contact, "tel") ||
    ""
  );
}

function simplifyContact(contact: ContactRow) {
  return {
    id: getNumberField(contact, "id"),
    name:
      getStringField(contact, "name") ||
      getStringField(contact, "customer_name") ||
      null,
    title:
      getStringField(contact, "title") ||
      getStringField(contact, "position") ||
      null,
    phone: getContactPhone(contact),
    assigned_to:
      getStringField(contact, "assigned_to") ||
      getStringField(contact, "manager") ||
      null,
    consultant: getStringField(contact, "consultant") || null,
    management_stage: getStringField(contact, "management_stage") || null,
    prospect_type: getStringField(contact, "prospect_type") || null,
    meeting_result: getStringField(contact, "meeting_result") || null,
  };
}

async function getGoogleAccessToken() {
  const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = getRequiredEnv("GOOGLE_REFRESH_TOKEN");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Google token refresh failed: ${JSON.stringify(data, null, 2)}`
    );
  }

  return data.access_token as string;
}

async function listDriveFiles(accessToken: string, folderId: string) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: "20",
    orderBy: "createdTime desc",
    fields:
      "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,size)",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Google Drive files.list failed: ${JSON.stringify(data, null, 2)}`
    );
  }

  return (data.files || []) as DriveFile[];
}

async function downloadDriveFileAsBase64(accessToken: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive file download failed: ${errorText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    base64: buffer.toString("base64"),
    byteLength: buffer.byteLength,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 도메인 사전 — Gemini가 분양 CRM 도메인 용어를 정확히 인식하도록
// ═══════════════════════════════════════════════════════════════════
const DOMAIN_GLOSSARY = `
[분양의신 CRM 도메인 사전]
- 분양회: 광고인㈜의 VIP 멤버십 (월 100만원, 연 1.6억 혜택)
- 완판트럭: 분양상담사 대상 무상 도시락/간식 출장 활동
- VIP DB / 일반 DB: VIP는 분양회 가입자 또는 가망 분양상담사
- 직급 체계: 본부장, 팀장, 부장, 차장, 과장, 대리, 컨설턴트
- 채널: 호갱노노(아파트 어반티), LMS(바나나몽키즈), 사이다페이/효성CMS(분양회 회비)
- 관리 단계: 신규 → 미팅예정가망 → 즉가입가망 → 연계매출가망 → 계약/예약
- 고객등급: 브론즈, 챌린저, 마스터
- 자주 등장하는 인물:
  광고사업부 컨설턴트/본부장: 박경화 총괄, 박혜은 총괄, 박민경 본부장, 조승현 본부장, 백선중 팀장, 강아름 팀장, 전정훈 팀장, 박나라 팀장
  대외협력팀: 김창완 팀장, 조계현 부장, 이세호 과장, 기여운 과장, 최연전 과장, 김재영, 최은정
- 관용 표현:
  "B 넘버" = 분양회 입회번호
  "TM" = 텔레마케팅
  "콜드톡" = 첫 접촉 통화
  "재TM" = 재접촉 통화 (관심 보였던 가망)
  "VIP 이관" = 일반 고객DB에서 VIP활동DB로 승급
`;

// ═══════════════════════════════════════════════════════════════════
// STEP 1 — 음성 → 텍스트 전사 (Gemini 2.5 Pro)
// ═══════════════════════════════════════════════════════════════════
async function transcribeAudioWithGemini(params: {
  base64Audio: string;
  mimeType: string;
}) {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");

  const transcribePrompt = `
이 음성을 한국어로 정확히 받아쓰기 해라.
- 화자가 둘 이상이면 "[A]", "[B]"로 구분 (A는 영업/대외협력팀, B는 고객으로 가정)
- 분양 영업 통화임을 감안해서 직급/금액/지역명 표기를 정확히 적어라
- 명확히 들리지 않는 부분은 [불분명] 으로 표기하라
- 의역하지 말고 들리는 그대로 받아써라
- 불필요한 추임새("아", "어", "음")는 생략 가능

${DOMAIN_GLOSSARY}
`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: transcribePrompt },
              {
                inlineData: {
                  mimeType: normalizeGeminiMimeType(params.mimeType),
                  data: params.base64Audio,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      }),
      cache: "no-store",
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini transcription failed: ${JSON.stringify(data, null, 2)}`);
  }

  const transcript =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim() || "";

  return transcript;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2 — 고객 컨텍스트 보강 (Supabase)
// ═══════════════════════════════════════════════════════════════════
async function buildCustomerContext(contactId: number | null) {
  if (!contactId) return "";

  const [customerRes, notesRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("name,title,phone,company,intake_route,management_stage,customer_grade,memo,assigned_to,crm_db_source")
      .eq("id", contactId)
      .maybeSingle(),
    supabase
      .from("contact_notes")
      .select("note_date,content,author")
      .eq("contact_id", contactId)
      .order("note_date", { ascending: false })
      .limit(3),
  ]);

  const customer = customerRes.data;
  const recentNotes = notesRes.data || [];

  if (!customer) return "";

  const customerBlock = `
[통화 상대 정보]
- 이름: ${customer.name || "-"} (${customer.title || "-"})
- 소속: ${customer.company || "-"}
- 유입경로: ${customer.intake_route || "-"}
- 현재 관리단계: ${customer.management_stage || "-"}
- 고객등급: ${customer.customer_grade || "-"}
- DB 분류: ${customer.crm_db_source === "vip_activity" ? "VIP활동DB" : "일반 고객DB"}
- 담당자: ${customer.assigned_to || "-"}
- 기존 메모: ${customer.memo || "(없음)"}
`;

  const notesBlock = recentNotes.length > 0
    ? `
[최근 활동 이력 — 통화 맥락 이해용 (최신 ${recentNotes.length}건)]
${recentNotes.map((n) => `▸ ${n.note_date} (${n.author || "-"}): ${(n.content || "").slice(0, 200).replace(/\n/g, " ")}`).join("\n")}
`
    : "";

  return customerBlock + notesBlock;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 3 — 텍스트 + 컨텍스트 → JSON 구조화 요약 (Gemini Pro)
// ═══════════════════════════════════════════════════════════════════
type StructuredSummary = {
  통화목적: string;
  상대화자: string;
  통화요약: string[];
  고객니즈: string[];
  후속액션: string[];
  관심도: "높음" | "보통" | "낮음" | "판단불가";
  다음조치필요: boolean;
  확인필요사항: string[];
  추출키워드: string[];
};

async function summarizeTextWithGemini(params: {
  transcript: string;
  customerContext: string;
  managerName: string;
  fileName: string;
}): Promise<StructuredSummary> {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");

  const summarizePrompt = `
너는 분양의신 CRM의 통화내용 정리 담당자다.
아래 전사된 통화 내용을 활동노트용으로 구조화하라.

${DOMAIN_GLOSSARY}

${params.customerContext}

[처리 메타정보]
- 영업 담당자: ${params.managerName}
- 녹음파일명: ${params.fileName}

[통화 전사 원문]
${params.transcript}

[작성 원칙]
1. 통화목적 — 한 줄로 통화 의도 요약 (예: "분양회 가입 권유 후속 상담", "광고 집행 진행상황 확인")
2. 상대화자 — "고객(분양상담사)" / "분양상담사 본부장" / "광고사업부 컨설턴트" 등 가능한 한 구체적으로
3. 통화요약 — 핵심 흐름 3~5개 (시간순)
4. 고객니즈 — 명시적·암묵적 니즈 (가격 부담, 신뢰 확인, 결과 의심 등)
5. 후속액션 — 우리 측이 해야 할 일 (구체적인 동사로)
6. 관심도 — 통화 톤·반응 기반 판단 ("판단불가"도 가능)
7. 다음조치필요 — 별도 행동이 필요한가
8. 확인필요사항 — 전사에서 [불분명]이거나 추정한 부분
9. 추출키워드 — 검색 인덱싱용 핵심 단어 3~7개 (예: "호갱노노", "10월", "박경화", "재계약")

[주의]
- 전사 원문에 없는 내용을 추가하지 마라
- 금액·일정·이름은 들리는 그대로만 적어라
- 모르는 건 "확인 필요"로 처리
`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: summarizePrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              통화목적: { type: "string" },
              상대화자: { type: "string" },
              통화요약: { type: "array", items: { type: "string" } },
              고객니즈: { type: "array", items: { type: "string" } },
              후속액션: { type: "array", items: { type: "string" } },
              관심도: { type: "string", enum: ["높음", "보통", "낮음", "판단불가"] },
              다음조치필요: { type: "boolean" },
              확인필요사항: { type: "array", items: { type: "string" } },
              추출키워드: { type: "array", items: { type: "string" } },
            },
            required: ["통화목적", "상대화자", "통화요약", "고객니즈", "후속액션", "관심도", "다음조치필요", "추출키워드"],
          },
        },
      }),
      cache: "no-store",
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini structured summary failed: ${JSON.stringify(data, null, 2)}`);
  }

  const jsonText =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim() || "{}";

  try {
    return JSON.parse(jsonText) as StructuredSummary;
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${jsonText.slice(0, 500)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STEP 4 — 자가 검증 패스 (환각·과장 체크)
// ═══════════════════════════════════════════════════════════════════
async function validateSummaryWithGemini(params: {
  transcript: string;
  summary: StructuredSummary;
}): Promise<StructuredSummary> {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");

  const validatePrompt = `
아래는 통화 전사 원문과 요약본이다. 요약본에서 환각·과장·오류를 점검하고 수정된 요약을 반환하라.

점검 기준:
1. 원문에 없는 내용이 요약에 추가되었는가? (환각)
2. 금액·일정·이름이 원문과 정확히 일치하는가?
3. "확인 필요"로 처리해야 할 부분을 단정하고 있지 않은가?
4. 관심도 판단이 통화 톤과 일치하는가?
5. 후속액션이 실제로 가능한 행동인가?

[전사 원문]
${params.transcript}

[현재 요약]
${JSON.stringify(params.summary, null, 2)}

수정이 필요한 부분만 반영해서 동일한 스키마로 최종 요약을 반환하라.
수정할 게 없으면 입력 그대로 반환하라.
`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: validatePrompt }] }],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              통화목적: { type: "string" },
              상대화자: { type: "string" },
              통화요약: { type: "array", items: { type: "string" } },
              고객니즈: { type: "array", items: { type: "string" } },
              후속액션: { type: "array", items: { type: "string" } },
              관심도: { type: "string", enum: ["높음", "보통", "낮음", "판단불가"] },
              다음조치필요: { type: "boolean" },
              확인필요사항: { type: "array", items: { type: "string" } },
              추출키워드: { type: "array", items: { type: "string" } },
            },
            required: ["통화목적", "상대화자", "통화요약", "고객니즈", "후속액션", "관심도", "다음조치필요", "추출키워드"],
          },
        },
      }),
      cache: "no-store",
    }
  );

  const data = await res.json();
  if (!res.ok) {
    // 검증 실패 시 원본 요약 그대로 반환 (안전망)
    return params.summary;
  }

  const jsonText =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim() || "{}";

  try {
    return JSON.parse(jsonText) as StructuredSummary;
  } catch {
    return params.summary;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 헬퍼 — StructuredSummary를 contact_notes 텍스트 양식으로 변환
// ═══════════════════════════════════════════════════════════════════
function formatStructuredSummaryAsText(params: {
  summary: StructuredSummary;
  transcript: string;
  managerName: string;
  fileName: string;
  extractedPhone: string | null;
}): string {
  const s = params.summary;
  const lines: string[] = [];
  lines.push("[AI 통화 요약]");
  lines.push("");
  lines.push(`담당자: ${params.managerName}`);
  lines.push(`파일명: ${params.fileName}`);
  lines.push(`추출 연락처: ${params.extractedPhone || "파일명에서 연락처 추출 실패"}`);
  lines.push("");
  lines.push(`통화목적: ${s.통화목적 || "-"}`);
  lines.push(`상대화자: ${s.상대화자 || "-"}`);
  lines.push("");
  lines.push("통화 요약:");
  (s.통화요약 || []).forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("고객 니즈:");
  (s.고객니즈 || []).forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("후속 액션:");
  (s.후속액션 || []).forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("AI 판단:");
  lines.push(`관심도: ${s.관심도 || "판단불가"}`);
  lines.push(`다음 조치 필요 여부: ${s.다음조치필요 ? "필요" : "불필요"}`);
  if (s.확인필요사항 && s.확인필요사항.length > 0) {
    lines.push("");
    lines.push("확인 필요사항:");
    s.확인필요사항.forEach((item) => lines.push(`- ${item}`));
  }
  if (s.추출키워드 && s.추출키워드.length > 0) {
    lines.push("");
    lines.push(`키워드: ${s.추출키워드.join(", ")}`);
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// 메인 함수 — 음성 → 전사 → 컨텍스트 → 요약 → 검증 → 텍스트 변환
// ═══════════════════════════════════════════════════════════════════
async function summarizeAudioWithGemini(params: {
  base64Audio: string;
  mimeType: string;
  fileName: string;
  managerName: string;
  extractedPhone: string | null;
  matchSourceLabel?: string | null;
  contactId?: number | null;
}) {
  // STEP 1: 음성 → 텍스트 전사
  const transcript = await transcribeAudioWithGemini({
    base64Audio: params.base64Audio,
    mimeType: params.mimeType,
  });

  // STEP 2: 고객 컨텍스트 보강
  const customerContext = await buildCustomerContext(params.contactId || null);

  // STEP 3: 구조화 요약
  const rawSummary = await summarizeTextWithGemini({
    transcript,
    customerContext,
    managerName: params.managerName,
    fileName: params.fileName,
  });

  // STEP 4: 자가 검증
  const verifiedSummary = await validateSummaryWithGemini({
    transcript,
    summary: rawSummary,
  });

  // STEP 5: contact_notes 호환 텍스트 양식으로 변환
  const summaryText = formatStructuredSummaryAsText({
    summary: verifiedSummary,
    transcript,
    managerName: params.managerName,
    fileName: params.fileName,
    extractedPhone: params.extractedPhone,
  });

  return {
    ok: true,
    model: "gemini-2.5-pro",
    summary: summaryText,
    transcript,
    structured: verifiedSummary,
  };
}


function isVipLikeContact(contact: ContactRow) {
  const meetingResult = getStringField(contact, "meeting_result");
  const managementStage = getStringField(contact, "management_stage");
  const prospectType = getStringField(contact, "prospect_type");
  const customerGrade = getStringField(contact, "customer_grade");

  return [meetingResult, managementStage, prospectType, customerGrade].some((value) =>
    ["계약완료", "예약완료", "VIP", "VIP활동DB", "리텐션", "마스터", "챌린저", "브론즈"].includes(
      String(value || "").trim()
    )
  );
}

async function loadContactsTable() {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("id", { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(`Supabase contacts query failed: ${error.message}`);
  }

  return (data || []) as ContactRow[];
}

function matchContactsByPhone(rows: ContactRow[], normalizedPhone: string) {
  return rows.filter(
    (contact) => normalizePhone(getContactPhone(contact)) === normalizedPhone
  );
}

async function findContactsByPhone(phone: string | null) {
  if (!phone) {
    return {
      status: "no_phone",
      message: "파일명에서 연락처를 추출하지 못했습니다.",
      normalizedPhone: null,
      matchedCount: 0,
      contacts: [] as MatchedContact[],
      matchSource: null as MatchSource | null,
      matchSourceLabel: null as string | null,
    };
  }

  const normalizedPhone = normalizePhone(phone);
  const rows = await loadContactsTable();
  const matchedRows = matchContactsByPhone(rows, normalizedPhone);

  const customerDbRows = matchedRows.filter((contact) => !isVipLikeContact(contact));
  const vipDbRows = matchedRows.filter((contact) => isVipLikeContact(contact));

  const toMatchedContact = (source: MatchSource, label: string) => (contact: ContactRow) => ({
    ...simplifyContact(contact),
    matchSource: source,
    matchSourceLabel: label,
  });

  if (customerDbRows.length === 1) {
    return {
      status: "matched",
      message: "고객DB에서 정확히 1명의 고객이 매칭되었습니다.",
      normalizedPhone,
      matchedCount: 1,
      contacts: customerDbRows.map(toMatchedContact("customer_db", "고객DB")),
      matchSource: "customer_db" as MatchSource,
      matchSourceLabel: "고객DB",
    };
  }

  if (customerDbRows.length > 1) {
    return {
      status: "duplicate",
      message: "고객DB에 동일한 연락처를 가진 고객이 2명 이상입니다. 자동 저장 전 검토가 필요합니다.",
      normalizedPhone,
      matchedCount: customerDbRows.length,
      contacts: customerDbRows.map(toMatchedContact("customer_db", "고객DB")),
      matchSource: "customer_db" as MatchSource,
      matchSourceLabel: "고객DB",
    };
  }

  if (vipDbRows.length === 1) {
    return {
      status: "matched",
      message: "고객DB에는 없고 VIP활동DB에서 정확히 1명의 고객이 매칭되었습니다.",
      normalizedPhone,
      matchedCount: 1,
      contacts: vipDbRows.map(toMatchedContact("vip_db", "VIP활동DB")),
      matchSource: "vip_db" as MatchSource,
      matchSourceLabel: "VIP활동DB",
    };
  }

  if (vipDbRows.length > 1) {
    return {
      status: "duplicate",
      message: "VIP활동DB에 동일한 연락처를 가진 고객이 2명 이상입니다. 자동 저장 전 검토가 필요합니다.",
      normalizedPhone,
      matchedCount: vipDbRows.length,
      contacts: vipDbRows.map(toMatchedContact("vip_db", "VIP활동DB")),
      matchSource: "vip_db" as MatchSource,
      matchSourceLabel: "VIP활동DB",
    };
  }

  return {
    status: "not_found",
    message: "고객DB와 VIP활동DB 모두에서 일치하는 연락처를 찾지 못했습니다.",
    normalizedPhone,
    matchedCount: 0,
    contacts: [] as MatchedContact[],
    matchSource: null as MatchSource | null,
    matchSourceLabel: null as string | null,
  };
}

async function getExistingLog(driveFileId: string) {
  const { data, error } = await supabase
    .from("call_recording_logs")
    .select("*")
    .eq("drive_file_id", driveFileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase log query failed: ${error.message}`);
  }

  return data;
}

async function upsertLog(params: {
  driveFileId: string;
  driveFileName: string;
  driveFileUrl?: string;
  driveMimeType?: string;
  driveFileSize?: string;
  managerName?: string;
  extractedPhone?: string | null;
  contactId?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  summaryText?: string | null;
  transcriptText?: string | null;
  structuredSummary?: Record<string, unknown> | null;
  noteId?: number | null;
  status: string;
  errorMessage?: string | null;
}) {
  const { data, error } = await supabase
    .from("call_recording_logs")
    .upsert(
      {
        drive_file_id: params.driveFileId,
        drive_file_name: params.driveFileName,
        drive_file_url: params.driveFileUrl || null,
        drive_mime_type: params.driveMimeType || null,
        drive_file_size: params.driveFileSize
          ? Number(params.driveFileSize)
          : null,
        manager_name: params.managerName || null,
        extracted_phone: params.extractedPhone || null,
        contact_id: params.contactId || null,
        contact_name: params.contactName || null,
        contact_phone: params.contactPhone || null,
        summary_text: params.summaryText || null,
        transcript_text: params.transcriptText || null,
        structured_summary: params.structuredSummary || null,
        note_id: params.noteId || null,
        status: params.status,
        error_message: params.errorMessage || null,
        processed_at:
          params.status === "processed" ||
          params.status === "duplicate" ||
          params.status === "needs_review" ||
          params.status === "failed"
            ? new Date().toISOString()
            : null,
      },
      {
        onConflict: "drive_file_id",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase log upsert failed: ${error.message}`);
  }

  return data;
}

async function saveAiSummaryToContactNote(params: {
  contactId: number | null;
  noteDate: string;
  summary: string;
  driveFileId: string;
  driveFileName: string;
  driveFileUrl?: string;
  managerName: string;
  extractedPhone: string | null;
  matchSourceLabel?: string | null;
}) {
  if (!params.contactId) {
    return {
      ok: false,
      status: "no_contact_id",
      message: "저장할 고객 ID가 없습니다.",
      inserted: false,
      note: null,
    };
  }

  const duplicateMarker = `[Drive File ID: ${params.driveFileId}]`;

  const { data: existingNotes, error: existingError } = await supabase
    .from("contact_notes")
    .select("id,contact_id,note_date,content,author")
    .eq("contact_id", params.contactId)
    .ilike("content", `%${params.driveFileId}%`)
    .limit(1);

  if (existingError) {
    throw new Error(
      `Supabase duplicate note query failed: ${existingError.message}`
    );
  }

  if (existingNotes && existingNotes.length > 0) {
    return {
      ok: true,
      status: "already_exists",
      message:
        "이미 같은 Drive 파일 ID로 저장된 활동노트가 있어 중복 저장하지 않았습니다.",
      inserted: false,
      note: existingNotes[0],
    };
  }

  const content = `${params.summary}

---

[AI 처리 정보]
담당자: ${params.managerName}
매칭 메뉴: ${params.matchSourceLabel || "확인 필요"}
추출 연락처: ${params.extractedPhone || "없음"}
녹음파일명: ${params.driveFileName}
녹음파일 링크: ${params.driveFileUrl || "없음"}
${duplicateMarker}`;

  const { data: inserted, error: insertError } = await supabase
    .from("contact_notes")
    .insert({
      contact_id: params.contactId,
      note_date: params.noteDate,
      content,
      author: "AI 통화요약",
    })
    .select("id,contact_id,note_date,content,author")
    .single();

  if (insertError) {
    throw new Error(
      `Supabase contact_notes insert failed: ${insertError.message}`
    );
  }

  return {
    ok: true,
    status: "inserted",
    message: "AI 통화요약이 고객 활동노트에 저장되었습니다.",
    inserted: true,
    note: inserted,
  };
}

async function processAudioFile(params: {
  accessToken: string;
  file: DriveFile & { manager: string; extractedPhone: string | null };
}) {
  const { accessToken, file } = params;
  const existingLog = await getExistingLog(file.id);

  if (existingLog?.status === "processed") {
    return {
      driveFileId: file.id,
      fileName: file.name,
      manager: file.manager,
      status: "skipped",
      message: "이미 처리 완료된 녹음파일입니다.",
      log: existingLog,
    };
  }

  if (existingLog?.status === "duplicate") {
    return {
      driveFileId: file.id,
      fileName: file.name,
      manager: file.manager,
      status: "skipped_duplicate",
      message: "이미 중복 처리된 녹음파일입니다.",
      log: existingLog,
    };
  }

  await upsertLog({
    driveFileId: file.id,
    driveFileName: file.name,
    driveFileUrl: file.webViewLink,
    driveMimeType: file.mimeType,
    driveFileSize: file.size,
    managerName: file.manager,
    extractedPhone: file.extractedPhone,
    status: "pending",
  });

  const customerMatch = await findContactsByPhone(file.extractedPhone);

  if (
    customerMatch.status !== "matched" ||
    customerMatch.contacts.length !== 1
  ) {
    const log = await upsertLog({
      driveFileId: file.id,
      driveFileName: file.name,
      driveFileUrl: file.webViewLink,
      driveMimeType: file.mimeType,
      driveFileSize: file.size,
      managerName: file.manager,
      extractedPhone: file.extractedPhone,
      status: "needs_review",
      errorMessage: customerMatch.message,
    });

    return {
      driveFileId: file.id,
      fileName: file.name,
      manager: file.manager,
      status: "needs_review",
      message: customerMatch.message,
      customerMatch,
      log,
    };
  }

  const matchedContact = customerMatch.contacts[0];

  const downloaded = await downloadDriveFileAsBase64(accessToken, file.id);

  const audioSummary = await summarizeAudioWithGemini({
    base64Audio: downloaded.base64,
    mimeType: file.mimeType,
    fileName: file.name,
    managerName: file.manager,
    extractedPhone: file.extractedPhone,
    matchSourceLabel: customerMatch.matchSourceLabel,
    contactId: matchedContact.id,
  });

  const noteSave = await saveAiSummaryToContactNote({
    contactId: matchedContact.id,
    noteDate: extractDateFromFileName(file.name),
    summary: audioSummary.summary,
    driveFileId: file.id,
    driveFileName: file.name,
    driveFileUrl: file.webViewLink,
    managerName: file.manager,
    extractedPhone: file.extractedPhone,
    matchSourceLabel: customerMatch.matchSourceLabel,
  });

  const finalStatus =
    noteSave.status === "already_exists" ? "duplicate" : "processed";

  const log = await upsertLog({
    driveFileId: file.id,
    driveFileName: file.name,
    driveFileUrl: file.webViewLink,
    driveMimeType: file.mimeType,
    driveFileSize: file.size,
    managerName: file.manager,
    extractedPhone: file.extractedPhone,
    contactId: matchedContact.id,
    contactName: matchedContact.name,
    contactPhone: matchedContact.phone,
    summaryText: audioSummary.summary,
    transcriptText: audioSummary.transcript || null,
    structuredSummary: (audioSummary.structured as unknown as Record<string, unknown>) || null,
    noteId:
      noteSave.note &&
      typeof noteSave.note === "object" &&
      "id" in noteSave.note
        ? Number((noteSave.note as { id?: number }).id)
        : null,
    status: finalStatus,
  });

  return {
    driveFileId: file.id,
    fileName: file.name,
    manager: file.manager,
    status: finalStatus,
    message:
      finalStatus === "processed"
        ? `AI 통화요약이 ${customerMatch.matchSourceLabel || "고객"} 활동노트에 저장되었습니다.`
        : "이미 저장된 활동노트가 있어 중복 저장하지 않았습니다.",
    customerMatch,
    audioSummary,
    noteSave,
    log,
  };
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "CRON_SECRET is not configured.",
      },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized call recording process request.",
      },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const limit = Math.max(
      1,
      Math.min(Number(url.searchParams.get("limit") || "1"), 5)
    );

    const accessToken = await getGoogleAccessToken();
    const folders = getManagerFolders();

    const folderResults = await Promise.all(
      folders.map(async (folder) => {
        if (!folder.folderId) {
          return {
            manager: folder.manager,
            envKey: folder.envKey,
            ok: false,
            fileCount: 0,
            files: [],
            error: "Folder ID environment variable is missing.",
          };
        }

        const files = await listDriveFiles(accessToken, folder.folderId);

        return {
          manager: folder.manager,
          envKey: folder.envKey,
          ok: true,
          fileCount: files.length,
          files: files.map((file) => ({
            ...file,
            manager: folder.manager,
            extractedPhone: extractPhoneFromFileName(file.name),
          })),
        };
      })
    );

    const syncStartAt = getSyncStartAt();

    const audioFiles = folderResults
      .flatMap((result) => result.files)
      .filter((file) => file.mimeType?.startsWith("audio/"))
      .filter((file) => isFileAfterSyncStart(file, syncStartAt));

    const skippedOldFileCount = folderResults
      .flatMap((result) => result.files)
      .filter((file) => file.mimeType?.startsWith("audio/"))
      .filter((file) => !isFileAfterSyncStart(file, syncStartAt)).length;

    const processTargets = [];

    for (const file of audioFiles) {
      const existingLog = await getExistingLog(file.id);

      if (
        existingLog?.status === "processed" ||
        existingLog?.status === "duplicate"
      ) {
        continue;
      }

      processTargets.push(file);

      if (processTargets.length >= limit) {
        break;
      }
    }

    const results = [];

    for (const file of processTargets) {
      try {
        const result = await processAudioFile({
          accessToken,
          file,
        });

        results.push(result);
      } catch (error) {
        const failedLog = await upsertLog({
          driveFileId: file.id,
          driveFileName: file.name,
          driveFileUrl: file.webViewLink,
          driveMimeType: file.mimeType,
          driveFileSize: file.size,
          managerName: file.manager,
          extractedPhone: file.extractedPhone,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        results.push({
          driveFileId: file.id,
          fileName: file.name,
          manager: file.manager,
          status: "failed",
          message: "녹음파일 처리 중 오류가 발생했습니다.",
          error: error instanceof Error ? error.message : String(error),
          log: failedLog,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Call recording process completed.",
      limit,
      syncStartAt: syncStartAt?.toISOString() || null,
      foundAudioFileCount: audioFiles.length,
      skippedOldFileCount,
      processedCount: results.length,
      results,
      folderResults: folderResults.map((folder) => ({
        manager: folder.manager,
        ok: folder.ok,
        fileCount: folder.fileCount,
        files: folder.files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          extractedPhone: file.extractedPhone,
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Call recording process failed.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
