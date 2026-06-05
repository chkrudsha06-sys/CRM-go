import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Download, type Page } from "@playwright/test";

const loginUrl = process.env.HYOSUNG_CMS_LOGIN_URL || "https://hfs.nsok.co.kr/login";
const cmsId = process.env.HYOSUNG_CMS_ID || "";
const cmsPassword = process.env.HYOSUNG_CMS_PASSWORD || "";
const crmImportApiUrl = process.env.CRM_IMPORT_API_URL || "";
const crmImportSecret = process.env.CRM_IMPORT_SECRET || "";
const headless = process.env.HEADLESS === "true";
const slowMo = Number(process.env.SLOW_MO_MS || "150");
const downloadDir = process.env.DOWNLOAD_DIR || "downloads";
const collectionUrl = process.env.HYOSUNG_COLLECTION_URL || "";

function getDefaultDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = new Date(year, month, 1);

  return {
    from: process.env.HYOSUNG_CMS_FROM_DATE || toDateInputValue(from),
    to: process.env.HYOSUNG_CMS_TO_DATE || toDateInputValue(now),
  };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function requireEnv() {
  const missing = [];

  if (!cmsId) missing.push("HYOSUNG_CMS_ID");
  if (!cmsPassword) missing.push("HYOSUNG_CMS_PASSWORD");
  if (!crmImportApiUrl) missing.push("CRM_IMPORT_API_URL");
  if (!crmImportSecret) missing.push("CRM_IMPORT_SECRET");

  if (missing.length > 0) {
    throw new Error(`.env에 필수값이 없습니다: ${missing.join(", ")}`);
  }
}

async function clickIfVisible(page: Page, text: string) {
  const target = page.getByText(text, { exact: false }).first();

  if (await target.isVisible().catch(() => false)) {
    await target.click();
    return true;
  }

  return false;
}

async function closeSecurityPopupIfAny(page: Page) {
  const candidates = ["닫기", "확인", "오늘 하루 보지 않기"];

  for (const text of candidates) {
    await clickIfVisible(page, text).catch(() => false);
  }
}

async function login(page: Page) {
  console.log("효성CMS 로그인 페이지 접속 중...");
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await closeSecurityPopupIfAny(page);

  console.log("아이디/비밀번호 자동 입력 중...");

  const inputs = page.locator("input");
  const inputCount = await inputs.count();

  if (inputCount < 2) {
    throw new Error("로그인 입력칸을 찾지 못했습니다. 보안 팝업이 떠 있는지 확인해주세요.");
  }

  await inputs.nth(0).fill(cmsId);
  await inputs.nth(1).fill(cmsPassword);

  const loginButton = page.getByRole("button", { name: /로그인/i }).first();

  if (await loginButton.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForLoadState("networkidle").catch(() => null),
      loginButton.click(),
    ]);
  } else {
    await Promise.all([
      page.waitForLoadState("networkidle").catch(() => null),
      page.keyboard.press("Enter"),
    ]);
  }

  await page.waitForTimeout(2500);
  await closeSecurityPopupIfAny(page);

  const stillLogin = page.url().includes("/login");
  if (stillLogin) {
    console.log("로그인 화면에 머물러 있습니다. 2차 인증/보안 안내가 있으면 직접 처리해주세요.");
    console.log("처리 후 터미널에서 Enter를 누르면 계속 진행합니다.");
    await waitForEnter();
  }
}

async function waitForEnter() {
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
}

async function goToCollectionPage(page: Page) {
  if (collectionUrl) {
    console.log("수납관리 URL로 직접 이동 중...");
    await page.goto(collectionUrl, { waitUntil: "networkidle" });
    return;
  }

  console.log("수납 관리 메뉴 이동 중...");

  const clickedReceive = await clickIfVisible(page, "수납");
  if (!clickedReceive) {
    throw new Error("좌측 메뉴의 '수납'을 찾지 못했습니다. HYOSUNG_COLLECTION_URL을 .env에 지정해주세요.");
  }

  await page.waitForTimeout(700);

  const clickedCollection =
    (await clickIfVisible(page, "수납 관리")) ||
    (await clickIfVisible(page, "수납내역")) ||
    (await clickIfVisible(page, "수납 내역"));

  if (!clickedCollection) {
    throw new Error("'수납 관리' 또는 '수납내역' 메뉴를 찾지 못했습니다. HYOSUNG_COLLECTION_URL을 .env에 지정해주세요.");
  }

  await page.waitForLoadState("networkidle").catch(() => null);
  await page.waitForTimeout(1500);
}

async function setDateRange(page: Page, from: string, to: string) {
  console.log(`조회 기간 설정 시도: ${from} ~ ${to}`);

  const dateInputs = page.locator("input").filter({ hasText: /./ }).or(page.locator("input"));
  const count = await dateInputs.count();

  const visibleInputs = [];
  for (let index = 0; index < count; index += 1) {
    const input = dateInputs.nth(index);
    const isVisible = await input.isVisible().catch(() => false);
    if (isVisible) visibleInputs.push(input);
  }

  // 효성CMS 화면의 기간 입력칸 구조는 계정/브라우저 상태에 따라 달라질 수 있어
  // 우선 날짜처럼 보이는 입력칸을 뒤쪽부터 채우고, 실패하면 현재 화면 기본 기간으로 진행합니다.
  let filled = 0;
  for (const input of visibleInputs.reverse()) {
    const value = await input.inputValue().catch(() => "");
    const placeholder = await input.getAttribute("placeholder").catch(() => "");
    const type = await input.getAttribute("type").catch(() => "");
    const looksDate = /date|년|월|일|yyyy|기간|청구/i.test(`${value} ${placeholder} ${type}`);

    if (!looksDate && filled < 2) continue;

    try {
      await input.click({ clickCount: 3 });
      await input.fill(filled === 0 ? to : from);
      filled += 1;
      if (filled >= 2) break;
    } catch {
      // ignored
    }
  }

  if (filled < 2) {
    console.log("날짜 입력칸 자동 설정을 확정하지 못했습니다. 현재 화면의 기본 조회 기간으로 진행합니다.");
  }
}

async function clickSearchIfAny(page: Page) {
  const clicked =
    (await clickIfVisible(page, "검색")) ||
    (await clickIfVisible(page, "조회"));

  if (clicked) {
    await page.waitForLoadState("networkidle").catch(() => null);
    await page.waitForTimeout(1500);
  }
}

async function downloadExcel(page: Page) {
  console.log("엑셀 다운로드 버튼 탐색 중...");

  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

  const clicked = await tryClickExcelButton(page);
  if (!clicked) {
    throw new Error("엑셀 다운로드 버튼을 찾지 못했습니다. 화면 우측 상단의 엑셀 아이콘 selector를 보정해야 합니다.");
  }

  const download = await downloadPromise;
  return saveDownload(download);
}

async function tryClickExcelButton(page: Page) {
  const candidates = [
    page.getByRole("button", { name: /엑셀|excel/i }).first(),
    page.getByText(/엑셀|Excel|EXCEL/i).first(),
    page.locator("button:has(svg)").first(),
    page.locator("button").filter({ hasText: /엑셀|Excel|EXCEL/ }).first(),
    page.locator("img[alt*=엑셀], img[alt*=Excel], img[src*=excel], img[src*=xls]").first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }

  // 캡처 기준 우측 상단에 작은 초록 엑셀 아이콘이 있어서 마지막 fallback으로
  // viewport 우측 상단 근처 버튼들을 뒤에서부터 시도합니다.
  const buttons = page.locator("button");
  const count = await buttons.count();

  for (let index = count - 1; index >= 0; index -= 1) {
    const button = buttons.nth(index);
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;

    const box = await button.boundingBox().catch(() => null);
    if (!box) continue;

    if (box.x > 1200 && box.y < 260) {
      await button.click();
      return true;
    }
  }

  return false;
}

async function saveDownload(download: Download) {
  await fs.mkdir(downloadDir, { recursive: true });

  const suggested = download.suggestedFilename();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = suggested || `hyosung-cms-${timestamp}.xlsx`;
  const filePath = path.resolve(downloadDir, fileName);

  await download.saveAs(filePath);
  console.log(`엑셀 다운로드 완료: ${filePath}`);

  return filePath;
}

async function uploadToCrm(filePath: string) {
  console.log("CRM 업로드 API로 전송 중...");

  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const formData = new FormData();

  formData.append(
    "file",
    new Blob([fileBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName,
  );

  const response = await fetch(crmImportApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${crmImportSecret}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`CRM 업로드 실패: ${response.status} ${JSON.stringify(data, null, 2)}`);
  }

  console.log("CRM 업로드 완료");
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  requireEnv();

  const { from, to } = getDefaultDateRange();
  const browser = await chromium.launch({
    headless,
    slowMo,
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: {
      width: 1600,
      height: 950,
    },
  });

  const page = await context.newPage();

  try {
    await login(page);
    await goToCollectionPage(page);
    await setDateRange(page, from, to);
    await clickSearchIfAny(page);

    const downloadedFilePath = await downloadExcel(page);
    await uploadToCrm(downloadedFilePath);

    console.log("효성CMS 자동 수납내역 반영 완료");
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
