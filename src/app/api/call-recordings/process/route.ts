import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const normalizedFileName = fileName.replace(/[^0-9]/g, " ");

  const candidates = [
    ...fileName.matchAll(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g),
    ...fileName.matchAll(/0\d{1,3}[-\s]?\d{3,4}[-\s]?\d{4}/g),
    ...normalizedFileName.matchAll(/0\d{8,10}/g),
  ]
    .map((match) => normalizePhone(match[0]))
    .filter((value) => value.length >= 10 && value.length <= 11);

  if (candidates.length === 0) {
    return null;
  }

  const mobile = candidates.find((value) => /^01[016789]\d{7,8}$/.test(value));
  if (mobile) return mobile;

  return candidates[0];
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

async function summarizeAudioWithGemini(params: {
  base64Audio: string;
  mimeType: string;
  fileName: string;
  managerName: string;
  extractedPhone: string | null;
  matchSourceLabel?: string | null;
}) {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");

  const prompt = `
너는 분양 CRM의 통화내용 정리 담당자다.
아래 녹음파일을 듣고 CRM 고객 파이프라인의 활동노트에 바로 넣을 수 있도록 한국어로 정리해라.

반드시 아래 형식으로만 작성해라.

[AI 통화 요약]

담당자:
${params.managerName}

파일명:
${params.fileName}

추출 연락처:
${params.extractedPhone || "파일명에서 연락처 추출 실패"}

통화 요약:
- 

고객 니즈:
- 

후속 액션:
- 

AI 판단:
관심도: 높음 / 보통 / 낮음 중 하나
다음 조치 필요 여부: 필요 / 불필요 중 하나

주의사항:
- 녹음에서 확실히 들리지 않는 내용은 추정하지 말고 "확인 필요"라고 적어라.
- 개인정보나 금액, 일정은 들리는 내용만 적어라.
- 너무 길게 쓰지 말고 CRM 활동노트용으로 간결하게 정리해라.
`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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
              {
                text: prompt,
              },
              {
                inlineData: {
                  mimeType: normalizeGeminiMimeType(params.mimeType),
                  data: params.base64Audio,
                },
              },
            ],
          },
        ],
      }),
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Gemini audio summary failed: ${JSON.stringify(data, null, 2)}`
    );
  }

  const summary =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim() || "";

  return {
    ok: true,
    model: "gemini-2.5-flash",
    summary,
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

function isAuthorizedCallRecordingRequest(request: NextRequest) {
  const url = new URL(request.url);
  const configuredSecret =
    process.env.CALL_RECORDINGS_PROCESS_SECRET || process.env.CRON_SECRET || "";

  const querySecret =
    url.searchParams.get("secret") || url.searchParams.get("token") || "";
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!configuredSecret) {
    return {
      ok: false,
      status: 500,
      message:
        "CALL_RECORDINGS_PROCESS_SECRET or CRON_SECRET is not configured.",
    };
  }

  if (querySecret === configuredSecret || bearerToken === configuredSecret) {
    return { ok: true, status: 200, message: "Authorized" };
  }

  return {
    ok: false,
    status: 401,
    message: "Unauthorized call recording process request.",
  };
}

export async function GET(request: NextRequest) {
  const auth = isAuthorizedCallRecordingRequest(request);

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
        hint: "Use ?secret=YOUR_SECRET or Authorization: Bearer YOUR_SECRET",
      },
      { status: auth.status }
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


export async function POST(request: NextRequest) {
  return GET(request);
}
