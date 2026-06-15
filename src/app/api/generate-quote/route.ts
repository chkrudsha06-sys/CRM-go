import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

type CloudConvertTask = {
  id?: string;
  name?: string;
  operation?: string;
  status?: string;
  message?: string;
  code?: string;
  result?: {
    files?: Array<{ url?: string; filename?: string } | string>;
    url?: string;
  };
};

const jsonError = (message: string, status = 500, detail?: unknown) => {
  const suffix = detail ? ` / 상세: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 800)}` : "";
  return NextResponse.json({ error: `${message}${suffix}` }, { status });
};

const safeString = (value: unknown) => String(value ?? "").trim();

const extractTasks = (job: any): CloudConvertTask[] => {
  const raw = job?.data?.tasks || job?.tasks || [];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
};

const extractPdfUrl = (job: any): string | null => {
  const tasks = extractTasks(job);
  const exportTask = tasks.find((task) => task.name === "export-file" || task.operation === "export/url");
  const firstFile = exportTask?.result?.files?.[0];

  if (typeof firstFile === "string") return firstFile;
  if (firstFile?.url) return firstFile.url;
  if (exportTask?.result?.url) return exportTask.result.url;

  return null;
};

const getCloudConvertError = (job: any): string => {
  const tasks = extractTasks(job);
  const failed = tasks.find((task) => task.status === "error");
  if (failed) {
    return [failed.name || failed.operation || "task", failed.code, failed.message].filter(Boolean).join(" - ");
  }
  return job?.data?.message || job?.message || "CloudConvert 변환 작업이 실패했습니다.";
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      property,
      quoteDate,
      clientAddr,
      clientName,
      clientBizNo,
      clientCeo,
      clientMgr,
      clientPhone,
      supplierMgr,
      supplierPhone,
      items,
    } = body;

    const apiKey = process.env.CLOUDCONVERT_API_KEY;
    if (!apiKey) {
      return jsonError("Vercel 환경변수 CLOUDCONVERT_API_KEY가 설정되어 있지 않습니다.");
    }

    const templatePath = path.join(process.cwd(), "public", "quote_template.xlsx");
    if (!fs.existsSync(templatePath)) {
      return jsonError("public/quote_template.xlsx 템플릿 파일을 찾을 수 없습니다.");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.worksheets[0];

    const set = (row: number, col: number, val: unknown) => {
      ws.getCell(row, col).value = val as any;
    };

    set(3, 3, safeString(property));
    set(4, 3, safeString(clientAddr));
    set(4, 7, safeString(clientBizNo));
    set(5, 3, safeString(clientName));
    set(5, 7, safeString(clientCeo));
    set(6, 3, safeString(clientMgr));
    set(6, 7, safeString(clientPhone));

    if (safeString(supplierMgr)) set(9, 3, safeString(supplierMgr));
    if (safeString(supplierPhone)) set(9, 7, safeString(supplierPhone));

    set(10, 7, safeString(quoteDate));

    if (items && Array.isArray(items) && items.length > 0) {
      const it = items[0];
      set(12, 2, safeString(it.media));
      set(12, 3, safeString(it.type));
      set(12, 4, safeString(it.targeting));
      set(12, 5, Number(it.quantity) || 0);
      set(12, 6, Number(it.unitPrice) || 0);

      const amount = Number(it.amount) || (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      set(12, 7, amount);
      set(13, 3, safeString(it.ageGroup));
      set(13, 6, safeString(it.sendType));
      set(14, 3, safeString(it.region1));
      set(15, 2, "지역②");
      set(15, 3, safeString(it.region2));
      set(16, 2, "지역③");
      set(16, 3, safeString(it.region3));

      const totalAmount = items.reduce((sum: number, item: any) => {
        const itemAmount = Number(item.amount) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        return sum + itemAmount;
      }, 0);
      set(17, 7, Math.round(totalAmount * 1.1));
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const excelBase64 = Buffer.from(excelBuffer).toString("base64");

    const tasks: Record<string, any> = {
      "upload-file": {
        operation: "import/base64",
        file: excelBase64,
        filename: "quote.xlsx",
      },
      "convert-file": {
        operation: "convert",
        input: "upload-file",
        input_format: "xlsx",
        output_format: "pdf",
        engine: "libreoffice",
      },
      "export-file": {
        operation: "export/url",
        input: "convert-file",
        inline: false,
      },
    };

    const jobRes = await fetch("https://sync.api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tasks }),
    });

    const jobText = await jobRes.text();
    let job: any = null;
    try {
      job = jobText ? JSON.parse(jobText) : null;
    } catch {
      job = null;
    }

    if (!jobRes.ok) {
      return jsonError("CloudConvert API 호출에 실패했습니다. API Key, task.write 권한, 잔여 크레딧을 확인하세요.", 500, job || jobText);
    }

    if (!job) {
      return jsonError("CloudConvert 응답을 JSON으로 해석하지 못했습니다.", 500, jobText);
    }

    if (job?.data?.status === "error" || job?.status === "error" || extractTasks(job).some((task) => task.status === "error")) {
      return jsonError(getCloudConvertError(job), 500);
    }

    const pdfUrl = extractPdfUrl(job);
    if (!pdfUrl) {
      return jsonError("CloudConvert 변환은 완료됐지만 PDF 다운로드 URL을 찾지 못했습니다.", 500, job);
    }

    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      const pdfErr = await pdfRes.text().catch(() => "");
      return jsonError("CloudConvert 결과 PDF 다운로드에 실패했습니다.", 500, pdfErr);
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const filename = `광고인_견적서_${safeString(property) || "대상물건"}_${safeString(quoteDate) || "견적일자"}.pdf`;
    const encoded = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("견적서 생성 오류:", e);
    return jsonError(e?.message || "견적서 생성 중 알 수 없는 오류가 발생했습니다.");
  }
}
