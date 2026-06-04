import { NextResponse } from "next/server";
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

type ContactRow = {
  id: number;
  name: string | null;
  title: string | null;
  phone: string | null;
  assigned_to: string | null;
  consultant: string | null;
  management_stage: string | null;
  prospect_type: string | null;
  meeting_result: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
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

function extractPhoneFromFileName(fileName: string) {
  const candidates = fileName.match(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  return normalizePhone(candidates[0]);
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
    pageSize: "10",
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

async function findContactsByPhone(phone: string | null) {
  if (!phone) {
    return {
      status: "no_phone",
      message: "파일명에서 연락처를 추출하지 못했습니다.",
      normalizedPhone: null,
      matchedCount: 0,
      contacts: [],
    };
  }

  const normalizedPhone = normalizePhone(phone);

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id,name,title,phone,assigned_to,consultant,management_stage,prospect_type,meeting_result"
    )
    .order("id", { ascending: false })
    .limit(5000);

  if (error) {
    throw new Error(`Supabase contacts query failed: ${error.message}`);
  }

  const contacts = ((data || []) as ContactRow[]).filter((contact) => {
    return normalizePhone(contact.phone) === normalizedPhone;
  });

  let status = "not_found";
  let message = "CRM 고객DB에서 일치하는 연락처를 찾지 못했습니다.";

  if (contacts.length === 1) {
    status = "matched";
    message = "CRM 고객DB에서 정확히 1명의 고객이 매칭되었습니다.";
  }

  if (contacts.length > 1) {
    status = "duplicate";
    message =
      "동일한 연락처를 가진 고객이 2명 이상입니다. 자동 저장 전 검토가 필요합니다.";
  }

  return {
    status,
    message,
    normalizedPhone,
    matchedCount: contacts.length,
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      phone: contact.phone,
      assigned_to: contact.assigned_to,
      consultant: contact.consultant,
      management_stage: contact.management_stage,
      prospect_type: contact.prospect_type,
      meeting_result: contact.meeting_result,
    })),
  };
}

export async function GET() {
  try {
    const envStatus = {
      GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      GOOGLE_REFRESH_TOKEN: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
      GOOGLE_REDIRECT_URI: Boolean(process.env.GOOGLE_REDIRECT_URI),
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      GOOGLE_DRIVE_FOLDER_KI_YEO_UN: Boolean(
        process.env.GOOGLE_DRIVE_FOLDER_KI_YEO_UN
      ),
      GOOGLE_DRIVE_FOLDER_LEE_SE_HO: Boolean(
        process.env.GOOGLE_DRIVE_FOLDER_LEE_SE_HO
      ),
      GOOGLE_DRIVE_FOLDER_CHO_GYE_HYUN: Boolean(
        process.env.GOOGLE_DRIVE_FOLDER_CHO_GYE_HYUN
      ),
      GOOGLE_DRIVE_FOLDER_CHO_YEON_JEON: Boolean(
        process.env.GOOGLE_DRIVE_FOLDER_CHO_YEON_JEON
      ),
    };

    const accessToken = await getGoogleAccessToken();
    const folders = getManagerFolders();

    const driveResults = await Promise.all(
      folders.map(async (folder) => {
        if (!folder.folderId) {
          return {
            manager: folder.manager,
            envKey: folder.envKey,
            folderId: null,
            ok: false,
            error: "Folder ID environment variable is missing.",
            fileCount: 0,
            files: [],
          };
        }

        const files = await listDriveFiles(accessToken, folder.folderId);

        return {
          manager: folder.manager,
          envKey: folder.envKey,
          folderId: folder.folderId,
          ok: true,
          fileCount: files.length,
          files: files.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            size: file.size,
            extractedPhone: extractPhoneFromFileName(file.name),
          })),
        };
      })
    );

    const allAudioFiles = driveResults
      .flatMap((result) =>
        result.files.map((file) => ({
          ...file,
          manager: result.manager,
        }))
      )
      .filter((file) => file.mimeType?.startsWith("audio/"));

    if (allAudioFiles.length === 0) {
      return NextResponse.json({
        ok: true,
        message:
          "Google Drive connected, but no audio file was found in manager folders.",
        envStatus,
        driveResults,
        pickedFile: null,
        customerMatch: null,
        audioSummaryTest: null,
      });
    }

    const pickedFile = allAudioFiles[0];

    const downloaded = await downloadDriveFileAsBase64(
      accessToken,
      pickedFile.id
    );

    const audioSummary = await summarizeAudioWithGemini({
      base64Audio: downloaded.base64,
      mimeType: pickedFile.mimeType,
      fileName: pickedFile.name,
      managerName: pickedFile.manager,
      extractedPhone: pickedFile.extractedPhone,
    });

    const customerMatch = await findContactsByPhone(pickedFile.extractedPhone);

    return NextResponse.json({
      ok: true,
      message:
        "Google Drive audio file + Gemini summary + CRM customer match test completed.",
      envStatus,
      pickedFile: {
        manager: pickedFile.manager,
        id: pickedFile.id,
        name: pickedFile.name,
        mimeType: pickedFile.mimeType,
        size: pickedFile.size,
        downloadedBytes: downloaded.byteLength,
        extractedPhone: pickedFile.extractedPhone,
        webViewLink: pickedFile.webViewLink,
      },
      customerMatch,
      audioSummaryTest: audioSummary,
      driveResults,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Call recording customer match test failed.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
