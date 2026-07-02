"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  List,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type QuoteJson = Record<string, any> | any[] | null;

type PremiumLineItem = {
  enabled: boolean;
  type: string;
  quantity: string;
  age: string;
  region1: string;
  region2: string;
  region3: string;
  unitPrice: number;
  amount: number;
  totalVat: number;
};

type PremiumQuotePayload = {
  schema: "premium-bunyanghoe-html-v1";
  imageTemplate?: string;
  template: string;
  savedAt: string;
  recipientName: string;
  recipientPosition: string;
  region: string;
  targetItem: string;
  quoteDate: string;
  supplierManager: string;
  supplierPhone: string;
  clientCompany: string;
  clientCeo: string;
  clientManager: string;
  clientAddress: string;
  clientBizNo: string;
  clientPhone: string;
  lms: PremiumLineItem;
  hogangnono: PremiumLineItem;
  totals: {
    totalAmount: number;
    totalVat: number;
    pointAmount: number;
    netSpend: number;
  };
};

type SavedQuote = {
  id: number;
  property: string;
  quote_date: string;
  client_name: string;
  client_addr: string;
  client_biz_no: string;
  client_ceo: string;
  client_manager: string;
  client_phone: string;
  supplier_manager: string;
  supplier_phone: string;
  total_amount: number;
  total_vat: number;
  items: string;
  pdf_url: string | null;
  pdf_data?: string | null;
  created_at: string;
};

const TEMPLATE_PATH = "/quote-premium-template.html";
const IMAGE_TEMPLATE_PATH = "/quote-image-template-bg-v2.png";
const IMAGE_WIDTH = 1441;
const IMAGE_HEIGHT = 2004;

const cardClass = "rounded-[18px] border p-4 shadow-sm";
const smallBtnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function parseMoney(value: unknown) {
  return Number(onlyDigits(value)) || 0;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function fmtWon(n: number) {
  return `${Number(n || 0).toLocaleString()}원`;
}

function fmtShortWon(n: number) {
  const value = Number(n || 0);
  if (value >= 10000) return `${Math.floor(value / 10000).toLocaleString()}만원`;
  return fmtWon(value);
}

function safeParseItems(raw: string | null | undefined): QuoteJson {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emptyLineItem(): PremiumLineItem {
  return {
    enabled: false,
    type: "",
    quantity: "0",
    age: "",
    region1: "",
    region2: "",
    region3: "",
    unitPrice: 0,
    amount: 0,
    totalVat: 0,
  };
}

function isPremiumPayload(value: QuoteJson): value is PremiumQuotePayload {
  return Boolean(value && !Array.isArray(value) && (value as any).schema === "premium-bunyanghoe-html-v1");
}

function legacyToPremiumPayload(q: SavedQuote): PremiumQuotePayload {
  const items = safeParseItems(q.items);
  const first = Array.isArray(items) ? items[0] || {} : {};
  const isHn = String(first?.media || "").includes("호갱노노") || String(first?.type || "").includes("호갱노노");
  const baseLine = {
    enabled: true,
    type: String(first?.type || ""),
    quantity: String(first?.quantity || "0"),
    age: String(first?.ageGroup || "30~60대"),
    region1: String(first?.region1 || ""),
    region2: String(first?.region2 || ""),
    region3: String(first?.region3 || ""),
    unitPrice: Number(first?.unitPrice || 0),
    amount: Number(first?.amount || q.total_amount || 0),
    totalVat: Number(q.total_vat || 0),
  };

  return {
    schema: "premium-bunyanghoe-html-v1",
    imageTemplate: IMAGE_TEMPLATE_PATH,
    template: TEMPLATE_PATH,
    savedAt: q.created_at || new Date().toISOString(),
    recipientName: q.client_manager || q.client_name || "",
    recipientPosition: "",
    region: "",
    targetItem: q.property || "",
    quoteDate: q.quote_date || today(),
    supplierManager: q.supplier_manager || "",
    supplierPhone: q.supplier_phone || "",
    clientCompany: q.client_name || "",
    clientCeo: q.client_ceo || "",
    clientManager: q.client_manager || "",
    clientAddress: q.client_addr || "",
    clientBizNo: q.client_biz_no || "",
    clientPhone: q.client_phone || "",
    lms: isHn ? emptyLineItem() : baseLine,
    hogangnono: isHn ? baseLine : emptyLineItem(),
    totals: {
      totalAmount: Number(q.total_amount || 0),
      totalVat: Number(q.total_vat || 0),
      pointAmount: 0,
      netSpend: Number(q.total_amount || 0),
    },
  };
}

function getPayload(q: SavedQuote): PremiumQuotePayload {
  const parsed = safeParseItems(q.items);
  if (isPremiumPayload(parsed)) return parsed;
  return legacyToPremiumPayload(q);
}

function makeQuoteFileName(payload: PremiumQuotePayload) {
  const media = [payload.lms.enabled ? "LMS" : "", payload.hogangnono.enabled ? payload.hogangnono.type || "호갱노노" : ""]
    .filter(Boolean)
    .join("_");
  const dateText = (payload.quoteDate || today()).replace(/-/g, "");
  const priceText = payload.totals.totalVat >= 10000
    ? `${Math.floor(payload.totals.totalVat / 10000).toLocaleString()}만`
    : `${payload.totals.totalVat.toLocaleString()}`;
  return `(주)광고인_${media || "견적서"}_${dateText}_${priceText}(VAT포함)`;
}


function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactText(value: unknown, max = 28) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function formatKoreanDate(value: string) {
  if (!value) return "";
  const [yyyy, mm, dd] = value.split("-");
  if (!yyyy || !mm || !dd) return value;
  return `${Number(yyyy)}년 ${Number(mm)}월 ${Number(dd)}일`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function quoteMediaLabel(payload: PremiumQuotePayload) {
  const labels = [payload.lms.enabled ? "LMS 문자광고" : "", payload.hogangnono.enabled ? String(payload.hogangnono.type || "호갱노노").replace(/_/g, " ") : ""]
    .filter(Boolean);
  return labels.length ? labels.join(" · ") : "광고";
}

function quoteDetailMedia(payload: PremiumQuotePayload) {
  const labels = [payload.lms.enabled ? "LMS" : "", payload.hogangnono.enabled ? "호갱노노" : ""].filter(Boolean);
  return labels.join(" / ") || "-";
}

function quoteDetailType(payload: PremiumQuotePayload) {
  const labels = [payload.lms.enabled ? payload.lms.type : "", payload.hogangnono.enabled ? payload.hogangnono.type : ""].filter(Boolean);
  return labels.join(" / ") || "-";
}

function quoteDetailQty(payload: PremiumQuotePayload) {
  const total = (payload.lms.enabled ? parseMoney(payload.lms.quantity) : 0) + (payload.hogangnono.enabled ? parseMoney(payload.hogangnono.quantity) : 0);
  return total ? formatNumber(total) : "0";
}

function quoteDetailUnit(payload: PremiumQuotePayload) {
  const units = [payload.lms.enabled ? payload.lms.unitPrice : 0, payload.hogangnono.enabled ? payload.hogangnono.unitPrice : 0].filter(Boolean);
  if (units.length === 1) return formatNumber(units[0]);
  return units.length ? "상이" : "-";
}

function getPrimaryLine(payload: PremiumQuotePayload) {
  if (payload.lms.enabled) return payload.lms;
  if (payload.hogangnono.enabled) return payload.hogangnono;
  return emptyLineItem();
}

function getDetailSendType(payload: PremiumQuotePayload) {
  const project = payload.targetItem || "현장명";
  const values = [];
  if (payload.lms.enabled) values.push(`LMS_${payload.lms.type}_${project}`);
  if (payload.hogangnono.enabled) values.push(`${payload.hogangnono.type}_${project}`);
  return values.join(" / ");
}

function getDetailTargeting(payload: PremiumQuotePayload) {
  if (payload.lms.enabled && payload.hogangnono.enabled) return "부동산관심자 외";
  if (payload.lms.enabled) return "부동산관심자";
  if (payload.hogangnono.enabled) {
    const type = payload.hogangnono.type || "";
    if (type.includes("채널톡")) return "부동산 관심자";
    if (type.includes("단지")) return "단지 노출형";
  }
  return "별도 협의";
}

function getEffectivePointAmount(payload: PremiumQuotePayload) {
  if (payload.totals.pointAmount) return payload.totals.pointAmount;
  const lmsPoint = payload.lms.enabled ? Math.round(Number(payload.lms.amount || 0) * 0.15) : 0;
  const hnPoint = payload.hogangnono.enabled ? Math.round(Number(payload.hogangnono.amount || 0) * 0.05) : 0;
  return lmsPoint + hnPoint;
}

function getEffectiveNetSpend(payload: PremiumQuotePayload) {
  const point = getEffectivePointAmount(payload);
  if (payload.totals.netSpend) return payload.totals.netSpend;
  return Math.max(Number(payload.totals.totalAmount || 0) - point, 0);
}

function makeQuoteImageSvg(payload: PremiumQuotePayload, origin = "") {
  const bg = `${origin}${IMAGE_TEMPLATE_PATH}`;
  const totalAmount = Number(payload.totals.totalAmount || 0);
  const vat = Math.round(totalAmount * 0.1);
  const totalVat = Number(payload.totals.totalVat || totalAmount + vat);
  const pointAmount = getEffectivePointAmount(payload);
  const netSpend = getEffectiveNetSpend(payload);
  const primary = getPrimaryLine(payload);
  const media = quoteDetailMedia(payload);
  const type = quoteDetailType(payload);
  const managerLine = `담당자: ${payload.supplierManager || "문시욱"}${payload.supplierPhone ? ` (${payload.supplierPhone})` : ""} ,sales@ad-person.net`;
  const quoteTitle = `분양의신 타겟 ${quoteMediaLabel(payload)} 견적`;

  const text = (
    x: number,
    y: number,
    value: unknown,
    size = 18,
    weight = 700,
    fill = "#111",
    anchor: "start" | "middle" | "end" = "start"
  ) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif">${xmlEscape(value)}</text>`;
  const multiline = (
    x: number,
    y: number,
    lines: string[],
    size = 18,
    weight = 700,
    fill = "#111",
    anchor: "start" | "middle" | "end" = "start",
    lineHeight = 1.25
  ) => {
    const firstDy = 0;
    return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif">${lines.map((line, idx) => `<tspan x="${x}" dy="${idx === 0 ? firstDy : size * lineHeight}">${xmlEscape(line)}</tspan>`).join("")}</text>`;
  };
  const cover = (x: number, y: number, w: number, h: number, fill = "#ffffff") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  const rect = (x: number, y: number, w: number, h: number, fill = "#ffffff", stroke = "none", strokeWidth = 0, radius = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="compareCardGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff4055"/>
      <stop offset="52%" stop-color="#8b4acb"/>
      <stop offset="100%" stop-color="#2e7fff"/>
    </linearGradient>
  </defs>
  <image href="${xmlEscape(bg)}" x="0" y="0" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" preserveAspectRatio="none"/>

  ${cover(180, 218, 190, 44)}
  ${text(190, 248, formatKoreanDate(payload.quoteDate), 18, 500)}
  ${cover(455, 218, 660, 44)}
  ${text(468, 248, compactText(managerLine, 62), 18, 600)}

  ${cover(78, 327, 420, 230)}
  ${text(86, 364, "(주)광고인X분양의신", 18, 800)}
  ${text(158, 408, "268-88-01715", 18, 500)}
  ${text(158, 451, "문시욱", 18, 500)}
  ${text(153, 495, "partners@ad-person.net", 18, 500, "#1d4ed8")}
  ${text(158, 538, compactText("광주광역시 북구 군왕로51번길118(두암동)", 28), 18, 500)}

  ${cover(852, 333, 388, 228)}
  ${text(890, 370, compactText(payload.clientCompany || payload.clientManager || payload.recipientName, 20), 18, 800)}
  ${text(890, 413, compactText(payload.clientBizNo, 20), 18, 500)}
  ${text(890, 456, compactText(payload.clientCeo, 18), 18, 500)}
  ${text(890, 499, compactText(payload.clientPhone, 20), 18, 500)}
  ${text(890, 542, compactText(payload.clientAddress, 26), 18, 500)}

  ${cover(87, 468, 560, 42, "#5c8ff0")}
  ${text(95, 497, compactText(quoteTitle, 30), 20, 800, "#ffffff")}

  ${cover(93, 571, 109, 48)}
  ${text(147, 603, "1", 18, 800, "#111", "middle")}
  ${cover(203, 571, 164, 48)}
  ${text(285, 603, compactText(media, 10), 18, 800, "#111", "middle")}
  ${cover(368, 571, 167, 48)}
  ${text(452, 603, compactText(type, 10), 18, 800, "#111", "middle")}
  ${cover(536, 571, 155, 48)}
  ${text(613, 603, compactText(getDetailTargeting(payload), 12), 18, 800, "#111", "middle")}
  ${cover(692, 571, 180, 48)}
  ${text(782, 603, quoteDetailQty(payload), 18, 800, "#111", "middle")}
  ${cover(873, 571, 145, 48)}
  ${text(946, 603, quoteDetailUnit(payload), 18, 800, "#111", "middle")}
  ${cover(1019, 571, 283, 48)}
  ${text(1160, 603, formatNumber(totalAmount), 18, 900, "#111", "middle")}

  ${cover(286, 620, 165, 48, "#fffbe7")}
  ${text(368, 652, compactText(primary.age || "-", 11), 18, 800, "#111", "middle")}
  ${cover(592, 620, 680, 48)}
  ${text(607, 652, compactText(getDetailSendType(payload), 44), 17, 500)}
  ${cover(286, 670, 1017, 34)}
  ${text(302, 693, compactText(primary.region1 || payload.region || "-", 50), 17, 500)}
  ${cover(286, 705, 1017, 34)}
  ${text(302, 728, compactText(primary.region2 || "", 50), 17, 500)}
  ${cover(286, 741, 1017, 34)}
  ${text(302, 764, compactText(primary.region3 || "", 50), 17, 500)}

  ${cover(445, 804, 758, 56)}
  ${text(824, 842, formatNumber(totalVat), 22, 900, "#111", "middle")}

  ${cover(300, 915, 995, 56)}
  ${text(520, 953, "기업은행 298-122618-04-018 / 예금주 (주)광고인", 18, 700)}

  ${cover(390, 1706, 480, 83)}
  ${text(630, 1760, `${formatNumber(totalAmount)} 원`, 25, 800, "#111", "middle")}
  ${cover(390, 1791, 480, 90)}
  ${multiline(630, 1833, [formatNumber(pointAmount), "원"], 25, 800, "#111", "middle", 0.95)}

  ${rect(390, 1882, 480, 154, "url(#compareCardGrad)")}
  ${rect(391, 1883, 478, 152, "none", "#ffffff", 2)}
  ${rect(623, 1891, 4, 136, "#ffffff")}
  ${rect(605, 1950, 40, 40, "#ffffff", "#cccccc", 1, 20)}
  ${text(625, 1975, "VS", 18, 900, "#6b21a8", "middle")}
  ${multiline(515, 1942, ["일반회원", `${formatNumber(totalVat)}원`], 18, 900, "#ffffff", "middle", 1.35)}
  ${multiline(743, 1942, ["분양회 회원", `${formatNumber(netSpend)}원`], 18, 900, "#fff033", "middle", 1.35)}
  <line x1="646" y1="2005" x2="700" y2="2005" stroke="#fff033" stroke-width="3"/>
  <polygon points="700,2001 714,2005 700,2009" fill="#fff033"/>
</svg>`;
}

function openQuoteImagePrintWindow(payload: PremiumQuotePayload) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const svg = makeQuoteImageSvg(payload, origin);
  const title = makeQuoteFileName(payload);
  const printWindow = window.open("", "_blank", "width=980,height=1200");
  if (!printWindow) {
    alert("팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도하세요.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${xmlEscape(title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 210mm; min-height: 297mm; background: #fff; }
  body { display: flex; align-items: stretch; justify-content: center; }
  .sheet { width: 210mm; height: 297mm; overflow: hidden; background: #fff; }
  svg { display: block; width: 210mm; height: 297mm; }
  @media print {
    html, body, .sheet { width: 210mm !important; height: 297mm !important; margin: 0 !important; }
    svg { width: 210mm !important; height: 297mm !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
  <div class="sheet">${svg}</div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 450);
    });
  <\/script>
</body>
</html>`);
  printWindow.document.close();
}

export default function QuotePage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [qSearch, setQSearch] = useState("");
  const [qDateFrom, setQDateFrom] = useState("");
  const [qDateTo, setQDateTo] = useState("");
  const [activeQuoteId, setActiveQuoteId] = useState<number | null>(null);

  const surfaceStyle = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };
  const surface2Style = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const surface3Style = { background: "var(--surface-3)", borderColor: "var(--border)", color: "var(--text-muted)" };
  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const subtleText = { color: "var(--text-subtle)" };
  const mutedText = { color: "var(--text-muted)" };

  const getFrameWindow = useCallback(() => iframeRef.current?.contentWindow || null, []);
  const getFrameDocument = useCallback(() => iframeRef.current?.contentWindow?.document || null, []);

  const readFramePayload = useCallback((): PremiumQuotePayload | null => {
    const doc = getFrameDocument();
    if (!doc) return null;

    const value = (id: string) => {
      const el = doc.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      return String(el?.value ?? "").trim();
    };
    const checked = (id: string) => {
      const el = doc.getElementById(id) as HTMLInputElement | null;
      return Boolean(el?.checked);
    };
    const text = (id: string) => String(doc.getElementById(id)?.textContent ?? "").trim();

    const lmsAmount = parseMoney(text("lmsAmount"));
    const lmsTotalVat = parseMoney(text("lmsTotalVat"));
    const hnAmount = parseMoney(text("hnAmount"));
    const hnTotalVat = parseMoney(text("hnTotalVat"));
    const totalVat = parseMoney(text("grandTotalVat")) || lmsTotalVat + hnTotalVat;
    const totalAmount = lmsAmount + hnAmount;
    const pointAmount = parseMoney(text("quotePointAmountText"));
    const netSpend = parseMoney(text("compareNetSpendText"));

    return {
      schema: "premium-bunyanghoe-html-v1",
      imageTemplate: IMAGE_TEMPLATE_PATH,
      template: TEMPLATE_PATH,
      savedAt: new Date().toISOString(),
      recipientName: value("inputMemberName"),
      recipientPosition: value("inputMemberPosition"),
      region: value("inputRegion"),
      targetItem: value("inputTargetItem"),
      quoteDate: value("inputQuoteDate") || today(),
      supplierManager: value("inputSupplierManager"),
      supplierPhone: value("inputSupplierPhone"),
      clientCompany: value("inputClientCompany"),
      clientCeo: value("inputClientCeo"),
      clientManager: value("inputClientManager"),
      clientAddress: value("inputClientAddress"),
      clientBizNo: value("inputClientBizNo"),
      clientPhone: value("inputClientPhone"),
      lms: {
        enabled: checked("inputLmsEnabled"),
        type: value("inputLmsType"),
        quantity: value("inputLmsQty"),
        age: value("inputLmsAge"),
        region1: value("inputLmsRegion1"),
        region2: value("inputLmsRegion2"),
        region3: value("inputLmsRegion3"),
        unitPrice: parseMoney(text("lmsUnitPrice")),
        amount: lmsAmount,
        totalVat: lmsTotalVat,
      },
      hogangnono: {
        enabled: checked("inputHnEnabled"),
        type: value("inputHnType"),
        quantity: value("inputHnQty"),
        age: value("inputHnAge"),
        region1: value("inputHnRegion1"),
        region2: value("inputHnRegion2"),
        region3: value("inputHnRegion3"),
        unitPrice: parseMoney(text("hnUnitPrice")),
        amount: hnAmount,
        totalVat: hnTotalVat,
      },
      totals: {
        totalAmount,
        totalVat,
        pointAmount,
        netSpend,
      },
    };
  }, [getFrameDocument]);

  const fetchSavedQuotes = useCallback(async () => {
    setLoadingQuotes(true);
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("id,property,quote_date,client_name,client_addr,client_biz_no,client_ceo,client_manager,client_phone,supplier_manager,supplier_phone,total_amount,total_vat,items,pdf_url,pdf_data,created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setSavedQuotes((data || []) as SavedQuote[]);
    } catch (e: any) {
      alert(`견적서 히스토리 조회 오류: ${e?.message || e}`);
    } finally {
      setLoadingQuotes(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedQuotes();
  }, [fetchSavedQuotes]);

  const applyPayloadToFrame = useCallback((payload: PremiumQuotePayload) => {
    const win = getFrameWindow() as any;
    if (!win) return false;

    if (typeof win.setPremiumQuoteData === "function") {
      win.setPremiumQuoteData({
        region: payload.region,
        targetItem: payload.targetItem,
        quoteDate: payload.quoteDate,
        supplierManager: payload.supplierManager,
        supplierPhone: payload.supplierPhone,
        recipientName: payload.recipientName,
        recipientPosition: payload.recipientPosition,
        clientCompany: payload.clientCompany,
        clientCeo: payload.clientCeo,
        clientManager: payload.clientManager,
        clientAddress: payload.clientAddress,
        clientBizNo: payload.clientBizNo,
        clientPhone: payload.clientPhone,
        lms: {
          enabled: payload.lms.enabled,
          type: payload.lms.type,
          quantity: payload.lms.quantity,
          age: payload.lms.age,
          region1: payload.lms.region1,
          region2: payload.lms.region2,
          region3: payload.lms.region3,
        },
        hogangnono: {
          enabled: payload.hogangnono.enabled,
          type: payload.hogangnono.type,
          quantity: payload.hogangnono.quantity,
          age: payload.hogangnono.age,
          region1: payload.hogangnono.region1,
          region2: payload.hogangnono.region2,
          region3: payload.hogangnono.region3,
        },
      });
      return true;
    }

    return false;
  }, [getFrameWindow]);

  const printFrame = useCallback((payload?: PremiumQuotePayload | null) => {
    const win = getFrameWindow();
    const doc = getFrameDocument();
    if (!win || !doc) {
      alert("견적서 양식이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.");
      return;
    }

    if (payload) {
      doc.title = makeQuoteFileName(payload);
    }

    win.focus();
    setTimeout(() => win.print(), 80);
  }, [getFrameDocument, getFrameWindow]);

  const printQuoteImage = useCallback((payload?: PremiumQuotePayload | null) => {
    const data = payload || readFramePayload();
    if (!data) {
      alert("견적서 양식을 읽지 못했습니다. 새로고침 후 다시 시도하세요.");
      return;
    }
    openQuoteImagePrintWindow(data);
  }, [readFramePayload]);

  const handleSaveAndPrint = async () => {
    const payload = readFramePayload();
    if (!payload) return alert("견적서 양식을 읽지 못했습니다. 새로고침 후 다시 시도하세요.");
    if (!payload.targetItem.trim()) return alert("대상물건 / 현장명을 입력하세요.");
    if (!payload.quoteDate.trim()) return alert("견적일자를 입력하세요.");
    if (!payload.lms.enabled && !payload.hogangnono.enabled) return alert("LMS 또는 호갱노노 견적 중 하나 이상을 선택하세요.");

    setSaving(true);
    try {
      const { error } = await supabase.from("quotes").insert({
        property: [payload.region, payload.targetItem].filter(Boolean).join(" ").trim() || payload.targetItem,
        quote_date: payload.quoteDate,
        client_addr: payload.clientAddress,
        client_name: payload.clientCompany || payload.clientManager || payload.recipientName,
        client_biz_no: payload.clientBizNo,
        client_ceo: payload.clientCeo,
        client_manager: payload.clientManager || payload.recipientName,
        client_phone: payload.clientPhone,
        supplier_manager: payload.supplierManager,
        supplier_phone: payload.supplierPhone,
        items: JSON.stringify(payload),
        total_amount: payload.totals.totalAmount,
        total_vat: payload.totals.totalVat,
        pdf_url: null,
        pdf_data: JSON.stringify({ type: "quote-image-template-v1", template: IMAGE_TEMPLATE_PATH, savedAt: new Date().toISOString() }),
      });

      if (error) throw error;
      await fetchSavedQuotes();
      printQuoteImage(payload);
    } catch (e: any) {
      alert(`견적서 저장 오류: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const loadQuote = (q: SavedQuote, printAfterLoad = false) => {
    const payload = getPayload(q);
    setActiveQuoteId(q.id);
    const applied = applyPayloadToFrame(payload);
    if (!applied) {
      alert("견적서 양식이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.");
      return;
    }
    if (printAfterLoad) {
      setTimeout(() => printQuoteImage(payload), 180);
    }
  };

  const deleteSavedQuote = async (id: number) => {
    if (!confirm("해당 견적서 히스토리를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) {
      alert(`삭제 오류: ${error.message}`);
      return;
    }
    if (activeQuoteId === id) setActiveQuoteId(null);
    fetchSavedQuotes();
  };

  const reloadTemplate = () => {
    setIframeReady(false);
    if (iframeRef.current) {
      iframeRef.current.src = `${TEMPLATE_PATH}?t=${Date.now()}`;
    }
  };

  const filteredQuotes = useMemo(() => {
    const search = qSearch.trim().toLowerCase();
    return savedQuotes.filter((q) => {
      const payload = getPayload(q);
      if (qDateFrom && payload.quoteDate && payload.quoteDate < qDateFrom) return false;
      if (qDateTo && payload.quoteDate && payload.quoteDate > qDateTo) return false;
      if (!search) return true;

      const searchable = [
        payload.recipientName,
        payload.recipientPosition,
        payload.region,
        payload.targetItem,
        payload.clientCompany,
        payload.clientManager,
        payload.supplierManager,
        payload.lms.enabled ? "LMS" : "",
        payload.lms.type,
        payload.hogangnono.enabled ? "호갱노노" : "",
        payload.hogangnono.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });
  }, [qDateFrom, qDateTo, qSearch, savedQuotes]);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div
        className="sticky top-0 z-20 border-b px-5 py-4 sm:px-8"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}
      >
        <div className="mx-auto flex w-full max-w-[var(--page-max)] items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border"
                style={{ background: "var(--accent-bg)", borderColor: "var(--accent-border)", color: "var(--accent-text)" }}
              >
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-[780] tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                  견적서 작성
                </h1>
                <p className="mt-0.5 text-[13px]" style={subtleText}>
                  HTML 양식 입력값 기반 → PDF 양식 이미지로 저장 → 히스토리 저장
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={reloadTemplate}
              className={smallBtnClass}
              style={surface2Style}
              title="견적서 양식 새로고침"
            >
              <RefreshCw size={14} /> 양식 새로고침
            </button>
            <button
              onClick={() => printFrame(readFramePayload())}
              disabled={!iframeReady}
              className={smallBtnClass}
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              <Printer size={14} /> HTML 양식 인쇄
            </button>
            <button
              onClick={() => printQuoteImage(readFramePayload())}
              disabled={!iframeReady}
              className={smallBtnClass}
              style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
            >
              <Printer size={14} /> 이미지형 PDF 미리보기
            </button>
            <button
              onClick={handleSaveAndPrint}
              disabled={!iframeReady || saving}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-[13px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))", boxShadow: "var(--shadow-sm)" }}
            >
              <Save size={15} />
              {saving ? "저장중..." : "이미지형 PDF 저장 / 히스토리 저장"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-5 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto grid h-full w-full max-w-[var(--page-max)] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-h-0 overflow-hidden rounded-[22px] border shadow-sm" style={surfaceStyle}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>
                  HTML 견적서 양식
                </h2>
                <p className="mt-0.5 text-[12px]" style={subtleText}>
왼쪽 입력 패널의 값은 HTML 미리보기와 이미지형 PDF 양식에 함께 반영됩니다.
                </p>
              </div>
              <a
                href={TEMPLATE_PATH}
                target="_blank"
                rel="noreferrer"
                className={smallBtnClass}
                style={surface2Style}
              >
                <ExternalLink size={13} /> 새 탭 열기
              </a>
            </div>

            <div className="h-[calc(100%-57px)] min-h-0 bg-black/10">
              <iframe
                ref={iframeRef}
                src={TEMPLATE_PATH}
                title="견적서 HTML 양식"
                className="h-full w-full border-0"
                onLoad={() => setIframeReady(true)}
              />
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border shadow-sm" style={surfaceStyle}>
            <div className="shrink-0 border-b px-4 py-4" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <List size={18} style={{ color: "var(--accent-text)" }} />
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>
                    견적서 히스토리
                  </h2>
                </div>
                <span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}>
                  {filteredQuotes.length}건
                </span>
              </div>
              <p className="mt-1 text-[12px]" style={subtleText}>
저장한 견적서는 입력값 그대로 다시 불러오거나 이미지형 PDF로 다시 저장할 수 있습니다.
              </p>
            </div>

            <div className="shrink-0 space-y-2 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
                <input
                  value={qSearch}
                  onChange={(e) => setQSearch(e.target.value)}
                  placeholder="회원명, 현장명, 계약자, 매체..."
                  className="w-full rounded-[10px] border py-2 pl-9 pr-3 text-[12px] outline-none transition focus:ring-2"
                  style={inputStyle}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={qDateFrom}
                  onChange={(e) => setQDateFrom(e.target.value)}
                  className="min-w-0 flex-1 rounded-[10px] border px-2 py-2 text-[12px] outline-none"
                  style={inputStyle}
                />
                <span className="text-[12px]" style={subtleText}>~</span>
                <input
                  type="date"
                  value={qDateTo}
                  onChange={(e) => setQDateTo(e.target.value)}
                  className="min-w-0 flex-1 rounded-[10px] border px-2 py-2 text-[12px] outline-none"
                  style={inputStyle}
                />
                {(qDateFrom || qDateTo) && (
                  <button
                    onClick={() => {
                      setQDateFrom("");
                      setQDateTo("");
                    }}
                    className="rounded-[8px] px-2 py-1 text-[12px] font-bold"
                    style={{ color: "var(--danger-text)" }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="shrink-0 border-b px-4 py-2" style={{ ...surface3Style, borderColor: "var(--border)" }}>
              <div className="grid grid-cols-[62px_minmax(0,1fr)_82px] gap-2 text-[10.5px] font-bold" style={subtleText}>
                <span>견적일자</span>
                <span>견적내용</span>
                <span className="text-right">합계</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-16">
                  <div
                    className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
                  />
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="py-16 text-center text-[13px]" style={subtleText}>
                  <FileText size={30} className="mx-auto mb-2 opacity-40" />
                  <p>저장된 견적서가 없습니다</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                  {filteredQuotes.map((q) => {
                    const payload = getPayload(q);
                    const isOpen = expandedId === q.id;
                    const isActive = activeQuoteId === q.id;
                    const mediaLabel = [
                      payload.lms.enabled ? `LMS ${payload.lms.type}` : "",
                      payload.hogangnono.enabled ? payload.hogangnono.type : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div key={q.id}>
                        <button
                          onClick={() => setExpandedId(isOpen ? null : q.id)}
                          className="w-full px-4 py-3 text-left transition"
                          style={{ background: isOpen || isActive ? "var(--surface-selected)" : "transparent" }}
                        >
                          <div className="grid grid-cols-[62px_minmax(0,1fr)_82px] items-start gap-2 text-[12px]">
                            <span className="font-medium" style={subtleText}>
                              {payload.quoteDate?.slice(5) || "-"}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-bold" style={{ color: "var(--text)" }}>
                                {[payload.region, payload.targetItem].filter(Boolean).join(" ") || "-"}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px]" style={subtleText}>
                                {payload.recipientName || payload.clientManager || payload.clientCompany || "-"} · {mediaLabel || "매체 없음"}
                              </span>
                            </span>
                            <span className="text-right font-black" style={{ color: "var(--info-text)" }}>
                              {fmtShortWon(payload.totals.totalVat || q.total_vat || 0)}
                            </span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t px-4 pb-3" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                            <div className="mt-2 space-y-1.5 rounded-[14px] border p-3 text-[12px]" style={surface2Style}>
                              <div className="flex justify-between gap-3"><span style={subtleText}>회원</span><span className="text-right font-bold" style={{ color: "var(--text)" }}>{payload.recipientName || "-"} {payload.recipientPosition || ""}</span></div>
                              <div className="flex justify-between gap-3"><span style={subtleText}>대상물건</span><span className="text-right font-bold" style={{ color: "var(--text)" }}>{[payload.region, payload.targetItem].filter(Boolean).join(" ") || "-"}</span></div>
                              <div className="flex justify-between gap-3"><span style={subtleText}>견적일자</span><span style={{ color: "var(--text)" }}>{payload.quoteDate || "-"}</span></div>
                              <div className="my-1.5 border-t border-dashed" style={{ borderColor: "var(--border)" }} />
                              <div className="flex justify-between gap-3"><span style={subtleText}>공급자 담당</span><span className="font-semibold" style={{ color: "var(--text)" }}>{payload.supplierManager || "-"}</span></div>
                              <div className="flex justify-between gap-3"><span style={subtleText}>계약자 상호</span><span className="text-right font-semibold" style={{ color: "var(--text)" }}>{payload.clientCompany || "-"}</span></div>
                              <div className="flex justify-between gap-3"><span style={subtleText}>계약자</span><span style={{ color: "var(--text)" }}>{payload.clientManager || "-"}</span></div>
                              <div className="my-1.5 border-t border-dashed" style={{ borderColor: "var(--border)" }} />
                              <div className="flex justify-between gap-3"><span style={subtleText}>LMS</span><span className="text-right" style={{ color: payload.lms.enabled ? "var(--info-text)" : "var(--text-subtle)" }}>{payload.lms.enabled ? `${payload.lms.type} / ${payload.lms.quantity}` : "미사용"}</span></div>
                              <div className="flex justify-between gap-3"><span style={subtleText}>호갱노노</span><span className="text-right" style={{ color: payload.hogangnono.enabled ? "var(--info-text)" : "var(--text-subtle)" }}>{payload.hogangnono.enabled ? `${payload.hogangnono.type} / ${payload.hogangnono.quantity}` : "미사용"}</span></div>
                              <div className="flex justify-between gap-3"><span style={subtleText}>공급가액</span><span style={{ color: "var(--text)" }}>{fmtWon(payload.totals.totalAmount || q.total_amount || 0)}</span></div>
                              <div className="flex justify-between gap-3"><span style={subtleText}>합계 VAT포함</span><span className="font-black" style={{ color: "var(--info-text)" }}>{fmtWon(payload.totals.totalVat || q.total_vat || 0)}</span></div>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => loadQuote(q, false)}
                                disabled={!iframeReady}
                                className="flex-1 rounded-[10px] border py-2 text-center text-[12px] font-semibold transition disabled:opacity-50"
                                style={surface2Style}
                              >
                                불러오기
                              </button>
                              <button
                                onClick={() => loadQuote(q, true)}
                                disabled={!iframeReady}
                                className="flex flex-1 items-center justify-center gap-1 rounded-[10px] border py-2 text-[12px] font-semibold transition disabled:opacity-50"
                                style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
                              >
                                <Printer size={12} /> 이미지 PDF 저장
                              </button>
                              <button
                                onClick={() => deleteSavedQuote(q.id)}
                                className="rounded-[10px] p-2 transition"
                                style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
                                title="히스토리 삭제"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
