import { NextResponse } from "next/server";

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

async function testGemini() {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");

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
                text:
                  "아래 통화 메모를 CRM 활동노트 형식으로 짧게 요약해줘. 통화 메모: 고객은 분양회 가입 기준과 광고비 지원 가능 여부를 문의했고, 다음 주 추가 상담을 희망했다.",
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
      `Gemini API test failed: ${JSON.stringify(data, null, 2)}`
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim() || "";

  return {
    ok: true,
    model: "gemini-2.5-flash",
    sampleSummary: text,
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
            ok: false,
            error: "Folder ID environment variable is missing.",
            files: [],
          };
        }

        const files = await listDriveFiles(accessToken, folder.folderId);

        return {
          manager: folder.manager,
          envKey: folder.envKey,
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
          })),
        };
      })
    );

    const gemini = await testGemini();

    return NextResponse.json({
      ok: true,
      message: "Google Drive OAuth + Gemini API test completed.",
      envStatus,
      driveResults,
      gemini,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Call recording test failed.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
