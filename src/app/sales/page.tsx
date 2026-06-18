"use client";

import EmptyState from "@/components/EmptyState";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Copy,
  Download,
  Edit2,
  FileText,
  Filter,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  TrendingUp,
  Trash2,
  UploadCloud,
  User,
  Wallet,
  X,
} from "lucide-react";

type AdExecution = {
  id: number;
  member_name: string | null;
  execution_amount: number | null;
  vat_amount: number | null;
  refund_amount: number | null;
  channel: string | null;
  contract_route: string | null;
  payment_date: string | null;
  team_member: string | null;
  consultant: string | null;
  bunyanghoe_number?: string | null;
  memo?: string | null;
  created_at: string;
};

type FormState = {
  member_name: string;
  execution_amount: string;
  vat_amount: string;
  refund_amount: string;
  channel: string;
  contract_route: string;
  payment_date: string;
  team_member: string;
  consultant: string;
  site_name: string;
  property_name: string;
  region: string;
  agreed_marketer: string;
  ad_period: string;
  total_payment_amount: string;
  initial_recognized_sales: string;
  customer_number: string;
  customer_industry: string;
  customer_company: string;
  customer_contract_route: string;
  ad_support_amount: string;
  ad_support_company: string;
  ad_support_industry: string;
  depositor_name: string;
  payment_card: string;
  card_number: string;
  contact_phone: string;
  tax_invoice_status: string;
  cash_receipt_status: string;
  special_notes: string;
  memo: string;
};

type MemberOption = {
  id: number;
  name: string | null;
  title: string | null;
  bunyanghoe_number: string | null;
  phone: string | null;
  assigned_to?: string | null;
  consultant?: string | null;
  meeting_result?: string | null;
};

type HyosungCmsPreviewRow = {
  rowIndex: number;
  externalPaymentId: string;
  memberNumber: string;
  contractNumber: string;
  memberName: string;
  memberPhone: string;
  billingMonth: string;
  productName: string;
  collectionStatus: string;
  paymentStatus: string;
  paymentType: string;
  paymentMethod: string;
  promisedAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
  billingAmount: number;
  supplyAmount: number;
  vatAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  canceledAmount: number;
  refundAmount: number;
  resultMessage: string;
  memberType: string;
  managerName: string;
  isPaid: boolean;
  isDuplicate: boolean;
  rawData: Record<string, unknown>;
};

type HyosungImportSummary = {
  total: number;
  paid: number;
  failed: number;
  duplicate: number;
  importedLogs: number;
  createdSales: number;
};

type DetailTab = "overview" | "amount";

const EMPTY_FORM: FormState = {
  member_name: "",
  execution_amount: "",
  vat_amount: "",
  refund_amount: "",
  channel: "",
  contract_route: "",
  payment_date: "",
  team_member: "",
  consultant: "",
  site_name: "",
  property_name: "",
  region: "",
  agreed_marketer: "",
  ad_period: "",
  total_payment_amount: "",
  initial_recognized_sales: "X",
  customer_number: "",
  customer_industry: "",
  customer_company: "",
  customer_contract_route: "",
  ad_support_amount: "",
  ad_support_company: "",
  ad_support_industry: "",
  depositor_name: "",
  payment_card: "",
  card_number: "",
  contact_phone: "",
  tax_invoice_status: "",
  cash_receipt_status: "",
  special_notes: "",
  memo: "",
};

const CHANNELS = ["사이다페이", "효성CMS", "광고인입금", "카드결제"];
const CONTRACT_ROUTES = ["분양회 회비", "LMS", "호갱노노"];
const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const CONSULTANTS = ["박경화", "박혜은", "조승현", "박민경", "백선중", "강아름", "전정훈", "박나라"];
const HYOSUNG_PROVIDER = "HYOSUNG_CMS";
const TAX_INVOICE_OPTIONS = ["O(세금)", "X", "X추후발행"];
const CASH_RECEIPT_OPTIONS = ["O(현금)", "X", "X추후발행"];
const AD_ITEMS = ["LMS", "호갱노노"];
const FIXED_DEPOSIT_ACCOUNT = "298-122618-04-018";
const FIXED_DEPOSIT_BANK = "기업은행 (주)광고인";

function formatFullDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}

function money(value?: number | null) {
  const n = value || 0;
  return `${n.toLocaleString()}원`;
}

function numberInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function parseNumber(value: string) {
  const clean = numberInput(value);
  return clean ? Number(clean) : 0;
}

function formatInputAmount(value: string) {
  const clean = numberInput(value);
  return clean ? Number(clean).toLocaleString() : "";
}

function isAdPaymentItem(value?: string | null) {
  return AD_ITEMS.includes(value || "");
}

function buildAdMemo(form: FormState) {
  const item = form.contract_route || "-";
  const date = form.payment_date ? new Date(`${form.payment_date}T00:00:00`) : new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const team = form.team_member || "-";
  const paymentAmount = form.execution_amount || "";
  const totalPaymentAmount = form.total_payment_amount || form.execution_amount || "";
  const contactPhone = form.contact_phone || "-";

  return [
    `#${month}월 ${day}일 B2C매출[${team} CX]`,
    `●현장명: ${form.site_name || ""}`,
    `●물건: ${form.property_name || ""}`,
    `●지역: ${form.region || ""}`,
    `--------------------------`,
    `▶분양의신 광고`,
    `●결제금액(A):`,
    `●광고기간:`,
    ``,
    `▶턴키광고`,
    `●품목 : ${item}`,
    `●결제금액(B): ${paymentAmount}`,
    `●인정매출(C)(30%/100%): X`,
    `●협의마케터: ${form.agreed_marketer || ""}`,
    `●광고기간: ${form.ad_period || ""}`,
    ``,
    `▶총결제금액(A+B) : ${totalPaymentAmount}`,
    `▶총인정매출(A+C) : X`,
    `-------------------------`,
    `●분양회고객 : O`,
    `●고객명: ${form.member_name || ""}`,
    `●고객번호: ${form.customer_number || ""}`,
    `●업종 : ${form.customer_industry || ""}`,
    `●회사명: ${form.customer_company || ""}`,
    `●계약경로: ${form.customer_contract_route || ""}`,
    `-------------------------`,
    `●광고지원 금액 : ${form.ad_support_amount || ""}`,
    `●광고지원 회사명 : ${form.ad_support_company || ""}`,
    `●광고지원 업종 : ${form.ad_support_industry || ""}`,
    `-------------------------`,
    `●입금자명: ${form.depositor_name || ""}`,
    `●입금계좌: ${FIXED_DEPOSIT_ACCOUNT}`,
    `${FIXED_DEPOSIT_BANK}`,
    ``,
    `●결제카드: ${form.payment_card || ""}`,
    `●카드번호: ${form.card_number || ""}`,
    ``,
    `●연락처: ${contactPhone}`,
    `●세금계산서: ${form.tax_invoice_status || ""}`,
    `●현금영수증: ${form.cash_receipt_status || ""}`,
    `-------------------------`,
    `●특이사항`,
    `${form.special_notes || ""}`,
  ].join("\n");
}

function normalizeMemoLabel(label: string) {
  return label.replace(/^[#▶●\s]+/g, "").trim();
}

function parseAdMemo(memo?: string | null) {
  const parsed: Record<string, string> = {};
  const lines = (memo || "").split(/\r?\n/);
  let collectingNotes = false;
  const noteLines: string[] = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      if (collectingNotes) noteLines.push("");
      return;
    }

    if (line.includes("특이사항")) {
      collectingNotes = true;
      return;
    }

    if (collectingNotes) {
      noteLines.push(rawLine);
      return;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex > -1) {
      const label = normalizeMemoLabel(line.slice(0, separatorIndex));
      const value = line.slice(separatorIndex + 1).trim();
      parsed[label] = value;
    }
  });

  parsed["특이사항"] = noteLines.join("\n").trim();
  return parsed;
}

function buildDetailRowsFromMemo(item: AdExecution) {
  const info = parseAdMemo(item.memo);
  return [
    ["현장명", info["현장명"]],
    ["물건", info["물건"]],
    ["지역", info["지역"]],
    ["품목", info["품목"] || normalizePaymentItem(item.contract_route)],
    ["결제금액(B)", info["결제금액(B)"] || money(item.execution_amount)],
    ["인정매출(C)", info["인정매출(C)(30%/100%)"] || "X"],
    ["협의마케터", info["협의마케터"]],
    ["광고기간", info["광고기간"]],
    ["총결제금액(A+B)", info["총결제금액(A+B)"]],
    ["총인정매출(A+C)", info["총인정매출(A+C)"] || "X"],
    ["분양회고객", info["분양회고객"] || "O"],
    ["고객명", info["고객명"] || item.member_name],
    ["고객번호", info["고객번호"]],
    ["업종", info["업종"]],
    ["회사명", info["회사명"]],
    ["계약경로", info["계약경로"]],
    ["광고지원 금액", info["광고지원 금액"]],
    ["광고지원 회사명", info["광고지원 회사명"]],
    ["광고지원 업종", info["광고지원 업종"]],
    ["입금자명", info["입금자명"]],
    ["입금계좌", info["입금계좌"] || FIXED_DEPOSIT_ACCOUNT],
    ["은행/예금주", FIXED_DEPOSIT_BANK],
    ["결제카드", info["결제카드"]],
    ["카드번호", info["카드번호"]],
    ["연락처", info["연락처"]],
    ["세금계산서", info["세금계산서"]],
    ["현금영수증", info["현금영수증"]],
    ["특이사항", info["특이사항"]],
  ].map(([label, value]) => ({ label: String(label), value: value ? String(value) : "-" }));
}

function buildWorkReportText(item: AdExecution) {
  const info = parseAdMemo(item.memo);
  const date = item.payment_date ? new Date(`${item.payment_date.slice(0, 10)}T00:00:00`) : new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const itemName = info["품목"] || normalizePaymentItem(item.contract_route) || "";

  return [
    `#${month}월 ${day}일 B2C매출[${item.team_member || "-"} CX]`,
    `●현장명: ${info["현장명"] || ""}`,
    `●물건: ${info["물건"] || ""}`,
    `●지역: ${info["지역"] || ""}`,
    `--------------------------`,
    `▶분양의신 광고`,
    `●결제금액(A):`,
    `●광고기간:`,
    ``,
    `▶턴키광고`,
    `●품목 : ${itemName}`,
    `●결제금액(B): ${info["결제금액(B)"] || money(item.execution_amount)}`,
    `●인정매출(C)(30%/100%): X`,
    `●협의마케터: ${info["협의마케터"] || ""}`,
    `●광고기간: ${info["광고기간"] || ""}`,
    ``,
    `▶총결제금액(A+B) : ${info["총결제금액(A+B)"] || money(item.execution_amount)}`,
    `▶총인정매출(A+C) : X`,
    `-------------------------`,
    `●분양회고객 : O`,
    `●고객명: ${info["고객명"] || item.member_name || ""}`,
    `●고객번호: ${info["고객번호"] || ""}`,
    `●업종 : ${info["업종"] || ""}`,
    `●회사명: ${info["회사명"] || ""}`,
    `●계약경로: ${info["계약경로"] || ""}`,
    `-------------------------`,
    `●광고지원 금액 : ${info["광고지원 금액"] || ""}`,
    `●광고지원 회사명 : ${info["광고지원 회사명"] || ""}`,
    `●광고지원 업종 : ${info["광고지원 업종"] || ""}`,
    `-------------------------`,
    `●입금자명: ${info["입금자명"] || ""}`,
    `●입금계좌: ${FIXED_DEPOSIT_ACCOUNT}`,
    `${FIXED_DEPOSIT_BANK}`,
    ``,
    `●결제카드: ${info["결제카드"] || ""}`,
    `●카드번호: ${info["카드번호"] || ""}`,
    ``,
    `●연락처: ${info["연락처"] || ""}`,
    `●세금계산서: ${info["세금계산서"] || ""}`,
    `●현금영수증: ${info["현금영수증"] || ""}`,
    `-------------------------`,
    `●특이사항`,
    `${info["특이사항"] || ""}`,
  ].join("\n");
}


function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      record.message,
      record.details,
      record.hint,
      record.code ? `code: ${record.code}` : null,
    ]
      .filter(Boolean)
      .map((item) => String(item));

    if (parts.length > 0) return parts.join(" / ");

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cellNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const clean = cellText(value).replace(/[^0-9.-]/g, "");
  if (!clean) return 0;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCmsDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = cellText(value);
  if (!text || text === "-" || text === "66") return null;

  const normalized = text.replace(/[./]/g, "-").replace(/년|월/g, "-").replace(/일/g, "");
  const match = normalized.match(/(20\d{2})[-\s]+(\d{1,2})[-\s]+(\d{1,2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeBillingMonth(value: unknown) {
  const text = cellText(value);
  const match = text.match(/^(20\d{2})[./-]?(\d{1,2})/);
  if (!match) return text;
  return `${match[1]}/${match[2].padStart(2, "0")}`;
}

function cleanCmsIdentityText(value: unknown) {
  const text = cellText(value);
  if (!text || text === "-" || text === "–" || text === "—") return "";
  return text;
}

function makeHyosungExternalId(row: {
  memberNumber: string;
  memberName: string;
  billingMonth: string;
  paidAt: string | null;
}) {
  return [
    HYOSUNG_PROVIDER,
    row.memberNumber || "NO_MEMBER",
    row.memberName || "NO_NAME",
    row.billingMonth || "NO_BILLING_MONTH",
    row.paidAt || "NO_PAID_DATE",
  ]
    .map((value) => String(value).trim().replace(/\s+/g, "").replace(/[|]/g, ""))
    .join("_");
}

function buildSalesMemoFromHyosung(row: HyosungCmsPreviewRow) {
  return [
    "[효성CMS 수납내역 자동반영]",
    `회원번호: ${row.memberNumber || "-"}`,
    `계약번호: ${row.contractNumber || "-"}`,
    `청구월: ${row.billingMonth || "-"}`,
    `상품: ${row.productName || "-"}`,
    `수납상태: ${row.collectionStatus || "-"}`,
    `결제상태: ${row.paymentStatus || "-"}`,
    `결제방식: ${row.paymentType || "-"}`,
    `결제수단: ${row.paymentMethod || "-"}`,
    `결제결과: ${row.resultMessage || "-"}`,
    `효성CMS 고유키: ${row.externalPaymentId}`,
  ].join("\n");
}

function parseHyosungCmsRows(rows: Record<string, unknown>[]) {
  return rows
    .map((raw, index): HyosungCmsPreviewRow | null => {
      const memberNumber = cleanCmsIdentityText(raw["회원번호"]);
      const contractNumber = cleanCmsIdentityText(raw["계약번호"]);
      const memberName = cleanCmsIdentityText(raw["회원명"]);
      const memberPhone = cleanCmsIdentityText(raw["납부자 휴대전화"] || raw["휴대전화"] || raw["연락처"]);
      const billingMonth = normalizeBillingMonth(raw["청구월"]);
      const paidAt = normalizeCmsDate(raw["결제일"] || raw["결제일(납부기간)"] || raw["청구완납일자"]);
      const paidAmount = cellNumber(raw["수납금액"]);
      const collectionStatus = cleanCmsIdentityText(raw["수납상태"]);
      const paymentStatus = cleanCmsIdentityText(raw["결제상태"]);
      const rowText = Object.values(raw).map(cellText).join(" ");
      const isSummaryRow = /합계|총계|소계|total/i.test(rowText) && !memberNumber && !memberName && !memberPhone;
      const hasMemberIdentity = Boolean(memberNumber || memberName || memberPhone || contractNumber);

      if (!hasMemberIdentity || isSummaryRow) return null;

      const rowForId = {
        memberNumber,
        contractNumber,
        memberName,
        billingMonth,
        paidAt,
        paidAmount,
      };

      return {
        rowIndex: index + 2,
        externalPaymentId: makeHyosungExternalId(rowForId),
        memberNumber,
        contractNumber,
        memberName,
        memberPhone,
        billingMonth,
        productName: cleanCmsIdentityText(raw["상품"] || raw["상품명"]),
        collectionStatus,
        paymentStatus,
        paymentType: cleanCmsIdentityText(raw["결제방식"]),
        paymentMethod: cleanCmsIdentityText(raw["결제수단"]),
        promisedAt: normalizeCmsDate(raw["약정일"]),
        paidAt,
        completedAt: normalizeCmsDate(raw["청구완납일자"]),
        billingAmount: cellNumber(raw["청구금액"]),
        supplyAmount: cellNumber(raw["공급가액"]),
        vatAmount: cellNumber(raw["부가세"]),
        paidAmount,
        unpaidAmount: cellNumber(raw["미납금액"]),
        canceledAmount: cellNumber(raw["취소금액"]),
        refundAmount: cellNumber(raw["환불금액"]),
        resultMessage: cleanCmsIdentityText(raw["결제결과"] || raw["비고"]),
        memberType: cleanCmsIdentityText(raw["회원구분"]),
        managerName: cleanCmsIdentityText(raw["담당관리자"]),
        isPaid: collectionStatus === "완납" && paymentStatus === "결제완료" && paidAmount > 0,
        isDuplicate: false,
        rawData: raw,
      };
    })
    .filter((row): row is HyosungCmsPreviewRow => Boolean(row));
}

function normalizePaymentItem(value?: string | null) {
  if (!value || value === "분양회") return "분양회 회비";
  return value;
}

function effectiveSales(row: AdExecution) {
  const execution = row.execution_amount || 0;
  const refund = row.refund_amount || 0;
  return Math.max(execution - refund, 0);
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#6366F1,#8B5CF6)",
    "linear-gradient(135deg,#3B82F6,#06B6D4)",
    "linear-gradient(135deg,#22C55E,#14B8A6)",
    "linear-gradient(135deg,#F97316,#EF4444)",
    "linear-gradient(135deg,#8B5CF6,#EC4899)",
    "linear-gradient(135deg,#06B6D4,#3B82F6)",
  ];
  if (!name) return gradients[0];
  const idx = name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % gradients.length;
  return gradients[idx];
}

function toneStyle(tone: string) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    success: { bg: "var(--success-bg)", color: "var(--success-text)", border: "var(--success-border)", dot: "var(--success)" },
    info: { bg: "var(--info-bg)", color: "var(--info-text)", border: "var(--info-border)", dot: "var(--info)" },
    cyan: { bg: "var(--cyan-bg)", color: "var(--cyan-text)", border: "var(--cyan-border)", dot: "var(--cyan)" },
    warning: { bg: "var(--warning-bg)", color: "var(--warning-text)", border: "var(--warning-border)", dot: "var(--warning)" },
    danger: { bg: "var(--danger-bg)", color: "var(--danger-text)", border: "var(--danger-border)", dot: "var(--danger)" },
    purple: { bg: "var(--purple-bg)", color: "var(--purple-text)", border: "var(--purple-border)", dot: "var(--purple)" },
    muted: { bg: "var(--surface-3)", color: "var(--text-subtle)", border: "var(--border)", dot: "var(--text-faint)" },
  };
  return map[tone] || map.muted;
}

function routeTone(value?: string | null) {
  if (value === "분양회" || value === "분양회 회비") return "success";
  if (value === "연계매출") return "cyan";
  if (value === "광고매출") return "purple";
  return "muted";
}

function channelTone(value?: string | null) {
  if (value === "사이다페이") return "info";
  if (value === "효성CMS") return "purple";
  if (value === "광고인입금") return "success";
  if (value === "카드결제") return "warning";
  return "muted";
}

function Badge({ children, tone = "muted", icon: Icon }: { children: ReactNode; tone?: string; icon?: ElementType }) {
  const c = toneStyle(tone);
  return (
    <span
      className="inline-flex h-[23px] items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-bold"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {Icon ? <Icon size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
      {children}
    </span>
  );
}

function PremiumIcon({ icon: Icon, tone = "info", size = "md" }: { icon: ElementType; tone?: string; size?: "sm" | "md" | "lg" }) {
  const c = toneStyle(tone);
  const cls = size === "lg" ? "h-12 w-12 rounded-[15px]" : size === "sm" ? "h-8 w-8 rounded-[10px]" : "h-10 w-10 rounded-[12px]";
  return (
    <div
      className={`inline-flex flex-shrink-0 items-center justify-center ${cls}`}
      style={{ background: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02)), ${c.bg}`, border: `1px solid ${c.border}`, color: c.color, boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}
    >
      <Icon size={size === "lg" ? 22 : size === "sm" ? 14 : 18} />
    </div>
  );
}

function SelectChip({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[122px] appearance-none rounded-full border px-3 pr-8 text-[12px] font-bold outline-none"
        style={{ background: value ? "var(--accent-subtle)" : "var(--surface-2)", borderColor: value ? "var(--accent-border)" : "var(--border)", color: value ? "var(--accent-text)" : "var(--text-muted)" }}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
    </div>
  );
}

function StatCard({ label, value, icon, tone, sub }: { label: string; value: string | number; icon: ElementType; tone: string; sub?: string }) {
  return (
    <div className="premium-card flex h-[88px] items-center gap-4 px-4">
      <PremiumIcon icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p className="mt-1 text-[22px] font-[760] leading-none tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="crm-tiny mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 py-3">
      <div className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{label}</div>
      <div className="min-w-0 text-[13px] font-semibold" style={{ color: "var(--text)" }}>{children || <span style={{ color: "var(--text-faint)" }}>-</span>}</div>
    </div>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{children}</label>;
}

function SalesMobileCard({ item, selected, onClick, onDelete }: { item: AdExecution; selected: boolean; onClick: () => void; onDelete: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="premium-card premium-card-hover w-full p-4 text-left"
      style={{ background: selected ? "linear-gradient(90deg, rgba(99,102,241,.20), rgba(99,102,241,.07)), var(--surface-selected)" : undefined, borderColor: selected ? "var(--accent-border)" : undefined }}
    >
      <div className="flex items-center gap-3">
        <div className="crm-avatar" style={{ background: avatarBg(item.member_name) }}>{item.member_name?.[0] || "매"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="crm-row-main truncate">{item.member_name || "고객명 없음"}</p>
            <Badge tone={routeTone(normalizePaymentItem(item.contract_route))}>{normalizePaymentItem(item.contract_route) || "-"}</Badge>
          </div>
          
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div><p className="crm-tiny">집행금액</p><p className="mt-1 text-[13px] font-bold" style={{ color: "var(--text)" }}>{money(item.execution_amount)}</p></div>
        <div><p className="crm-tiny">환불</p><p className="mt-1 text-[13px] font-bold" style={{ color: item.refund_amount ? "var(--danger-text)" : "var(--text)" }}>{money(item.refund_amount)}</p></div>
        <div><p className="crm-tiny">실매출</p><p className="mt-1 text-[13px] font-bold" style={{ color: "var(--success-text)" }}>{money(effectiveSales(item))}</p></div>
      </div>
      <div className="mt-3 flex justify-end">
        <span
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item.id);
          }}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-black"
          style={{
            color: "var(--danger-text)",
            background: "var(--danger-bg)",
            borderColor: "var(--danger-border)",
          }}
        >
          <Trash2 size={13} />
          삭제
        </span>
      </div>
    </button>
  );
}

function DetailSlidePanel({ item, tab, onTab, onClose, onEdit, onDelete }: { item: AdExecution; tab: DetailTab; onTab: (tab: DetailTab) => void; onClose: () => void; onEdit: (item: AdExecution) => void; onDelete: (id: number) => void }) {
  const isAdDetail = isAdPaymentItem(normalizePaymentItem(item.contract_route));
  const detailRows = buildDetailRowsFromMemo(item);
  const workReportText = buildWorkReportText(item);

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(workReportText);
      alert("워크 양식이 복사되었습니다.");
    } catch {
      alert("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  };

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />
      <aside
        className="slide-panel"
        style={{ "--panel-width": (tab === "amount" && isAdDetail) ? "1100px" : "580px" } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="slide-panel-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="crm-avatar-lg crm-avatar" style={{ background: avatarBg(item.member_name) }}>{item.member_name?.[0] || "매"}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-[22px] font-[780] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{item.member_name || "고객명 없음"}</h2>
                  <Badge tone={routeTone(normalizePaymentItem(item.contract_route))}>{normalizePaymentItem(item.contract_route) || "-"}</Badge>
                </div>
                
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={channelTone(item.channel)} icon={CreditCard}>{item.channel || "채널 없음"}</Badge>
                  <Badge tone="info" icon={User}>{item.team_member || "-"}</Badge>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
          </div>
          <div className="mt-5 flex gap-1.5">
            {[{ key: "overview", label: "개요" }, { key: "amount", label: "세부정보" }].map((menu) => {
              const active = tab === menu.key;
              return <button key={menu.key} type="button" onClick={() => onTab(menu.key as DetailTab)} className="h-9 rounded-[9px] px-3 text-[12px] font-bold transition-all" style={{ background: active ? "var(--accent-subtle)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-subtle)", border: active ? "1px solid var(--accent-border)" : "1px solid transparent" }}>{menu.label}</button>;
            })}
          </div>
        </div>
        <div className="slide-panel-body">
          {tab === "overview" && (
            <div className="space-y-6">
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={ReceiptText} tone="success" /><div><p className="crm-section-title">매출 기본정보</p><p className="crm-tiny">거래 경로와 결제 기준 정보</p></div></div>
                <Field label="고객명">{item.member_name || "-"}</Field>
                <Field label="결제일">{formatFullDate(item.payment_date)}</Field>
                <Field label="결제채널"><Badge tone={channelTone(item.channel)}>{item.channel || "-"}</Badge></Field>
                <Field label="결제항목"><Badge tone={routeTone(normalizePaymentItem(item.contract_route))}>{normalizePaymentItem(item.contract_route) || "-"}</Badge></Field>
                <Field label="담당자"><Badge tone="info" icon={User}>{item.team_member || "-"}</Badge></Field>
              </section>
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={TrendingUp} tone="cyan" /><div><p className="crm-section-title">실매출 요약</p><p className="crm-tiny">집행금액과 환불 반영 기준</p></div></div>
                <div className="rounded-[14px] p-4" style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
                  <p className="text-[12px] font-bold" style={{ color: "var(--success-text)" }}>실매출</p>
                  <p className="mt-1 text-[30px] font-[780] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{money(effectiveSales(item))}</p>
                </div>
                {/* 수기 등록 메모 — 사이다페이/효성CMS 외 채널 */}
                {item.memo && item.channel !== "사이다페이" && item.channel !== "효성CMS" && (
                  <div className="mt-4 rounded-[14px] p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                    <p className="mb-2 text-[11px] font-bold" style={{ color: "var(--text-faint)" }}>메모</p>
                    <p className="whitespace-pre-wrap text-[13px] font-semibold leading-relaxed" style={{ color: "var(--text)" }}>{item.memo}</p>
                  </div>
                )}
              </section>
              {item.memo && (item.channel === "사이다페이" || item.channel === "효성CMS") && (
                <section className="premium-card p-4">
                  <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={ReceiptText} tone="purple" /><div><p className="crm-section-title">결제원 데이터</p><p className="crm-tiny">{item.channel} 자동연동 기록</p></div></div>
                  <pre className="whitespace-pre-wrap rounded-[14px] p-4 text-[12.5px] font-[700] leading-relaxed" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>{item.memo}</pre>
                </section>
              )}
            </div>
          )}
          {tab === "amount" && (
            isAdDetail ? (
              <div className="grid min-h-[calc(100vh-280px)] gap-4 lg:grid-cols-[1fr_1fr]">
                <section className="premium-card p-4">
                  <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Wallet} tone="warning" /><div><p className="crm-section-title">세부정보</p><p className="crm-tiny">등록 시 입력한 광고특전 상세값</p></div></div>
                  <div className="max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
                    {detailRows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[132px_1fr] gap-3 border-b py-2.5 text-[12.5px]" style={{ borderColor: "var(--border-subtle)" }}>
                        <div className="font-[900]" style={{ color: "var(--text-subtle)" }}>{row.label}</div>
                        <div className="whitespace-pre-wrap font-[750]" style={{ color: "var(--text)" }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="premium-card p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><PremiumIcon icon={FileText} tone="purple" /><div><p className="crm-section-title">워크 공유 양식</p><p className="crm-tiny">카카오워크 매출방에 붙여넣는 양식</p></div></div>
                    <button type="button" onClick={handleCopyReport} className="btn-premium btn-primary h-9 px-3 text-[12px]"><Copy size={13} />양식복사</button>
                  </div>
                  <pre className="max-h-[calc(100vh-340px)] overflow-auto whitespace-pre-wrap rounded-[14px] p-4 text-[12.5px] font-[700] leading-relaxed" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>{workReportText}</pre>
                </section>
              </div>
            ) : (
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Wallet} tone="warning" /><div><p className="crm-section-title">세부정보</p><p className="crm-tiny">매출 계산에 사용되는 금액 구조</p></div></div>
                <Field label="집행금액">{money(item.execution_amount)}</Field>
                <Field label="환불금액"><span style={{ color: item.refund_amount ? "var(--danger-text)" : "var(--text)" }}>{money(item.refund_amount)}</span></Field>
                <Field label="실매출"><span className="text-[15px] font-[760]" style={{ color: "var(--success-text)" }}>{money(effectiveSales(item))}</span></Field>
              </section>
            )
          )}
        </div>
        <div className="slide-panel-footer">
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={() => onEdit(item)} className="btn-premium btn-primary w-full"><Edit2 size={14} />매출 정보 수정</button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="btn-premium w-full"
              style={{
                color: "var(--danger-text)",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
              }}
            >
              <Trash2 size={14} />삭제
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}


function HyosungUploadModal({
  rows,
  summary,
  saving,
  onFile,
  onImport,
  onClose,
}: {
  rows: HyosungCmsPreviewRow[];
  summary: HyosungImportSummary;
  saving: boolean;
  onFile: (file: File) => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleSelectedFile = useCallback((file?: File | null) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
      alert("효성CMS 엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.");
      return;
    }
    onFile(file);
  }, [onFile]);

  const importableCount = rows.filter((row) => row.isPaid && !row.isDuplicate).length;
  const paidAmount = rows
    .filter((row) => row.isPaid && !row.isDuplicate)
    .reduce((sum, row) => sum + row.paidAmount, 0);
  const failedAmount = rows
    .filter((row) => !row.isPaid)
    .reduce((sum, row) => sum + row.unpaidAmount, 0);

  const statItems = [
    { label: "전체 행", value: summary.total, sub: "업로드 파일 기준", icon: FileText, tone: "info" as const },
    { label: "결제완료", value: summary.paid, sub: money(paidAmount), icon: BadgeCheck, tone: "success" as const },
    { label: "실패/미납", value: summary.failed, sub: money(failedAmount), icon: ArrowDownRight, tone: "danger" as const },
    { label: "중복 제외", value: summary.duplicate, sub: "재업로드 방지", icon: RefreshCw, tone: "warning" as const },
    { label: "수집 로그", value: summary.importedLogs, sub: "원본 저장", icon: ReceiptText, tone: "purple" as const },
    { label: "매출 생성", value: summary.createdSales, sub: "통합매출 반영", icon: TrendingUp, tone: "success" as const },
  ];

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div
        className="crm-modal flex h-[calc(100vh-10px)] w-[calc(100vw-24px)] max-w-none flex-col overflow-hidden rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "none", width: "min(1920px, calc(100vw - 24px))" }}
      >
        <div
          className="flex flex-shrink-0 items-start justify-between gap-4 px-8 py-6"
          style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface)" }}
        >
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-[900]" style={{ color: "var(--accent-text)", background: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}>
              <UploadCloud size={13} /> 효성CMS 자동반영
            </div>
            <h2 className="text-[22px] font-[950] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>효성CMS 수납내역 업로드</h2>
            <p className="mt-1 text-[13px] font-[700]" style={{ color: "var(--text-muted)" }}>
              효성CMS에서 다운로드한 수납내역 엑셀을 결제완료·실패·중복으로 분류해 통합매출관리로 반영합니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-10 w-10 flex-shrink-0 p-0">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5 2xl:px-10">
          <section
            className="rounded-[20px] border p-4 2xl:p-5"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <div className="mb-4 rounded-[18px] border px-5 py-4" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-[950] tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>반영 기준</p>
                  <p className="mt-1 text-[12px] font-[750]" style={{ color: "var(--text-muted)" }}>아래 3가지 조건을 모두 만족하는 건만 통합매출로 생성됩니다.</p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                  <div className="rounded-[12px] px-4 py-2 text-center" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                    <p className="text-[11px] font-[950]">완납</p>
                  </div>
                  <div className="rounded-[12px] px-4 py-2 text-center" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                    <p className="text-[11px] font-[950]">결제완료</p>
                  </div>
                  <div className="rounded-[12px] px-4 py-2 text-center" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                    <p className="text-[11px] font-[950]">수납금액 0원 초과</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
              <div className="min-w-0">
                <InputLabel>효성CMS 수납내역 엑셀 파일</InputLabel>
                <label
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDraggingFile(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDraggingFile(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDraggingFile(false);
                    handleSelectedFile(event.dataTransfer.files?.[0]);
                  }}
                  className="group flex min-h-[132px] w-full cursor-pointer flex-col justify-center rounded-[18px] border-2 border-dashed px-7 py-5 transition"
                  style={{
                    background: isDraggingFile ? "var(--accent-bg)" : "var(--surface)",
                    borderColor: isDraggingFile ? "var(--accent-border)" : "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => handleSelectedFile(event.target.files?.[0])}
                    className="sr-only"
                  />
                  <div className="flex min-w-0 items-center gap-5">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: "var(--accent-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}>
                      <UploadCloud size={25} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-[950] tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                        파일 선택 또는 드래그앤드롭
                      </p>
                      <p className="mt-1 text-[12px] font-[750] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        .xlsx / .xls 형식만 가능하며, 효성CMS 수납내역 원본 파일을 그대로 업로드해주세요.
                      </p>
                    </div>
                  </div>
                </label>
                <p className="mt-2 text-[12px] font-[750] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  결제실패·미납 건과 합계 행은 매출로 잡지 않고 업로드 대상에서 제외합니다.
                </p>
              </div>

              <div className="min-w-0 rounded-[18px] border px-4 py-3" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[13px] font-[950] tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>업로드 집계</p>
                  <Badge tone={importableCount > 0 ? "success" : "muted"}>{importableCount.toLocaleString()}건 반영 가능</Badge>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {statItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-[13px] border px-3 py-2" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[11px]" style={{ background: toneStyle(item.tone).bg, color: toneStyle(item.tone).color, border: `1px solid ${toneStyle(item.tone).border}` }}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-baseline justify-between gap-2">
                            <p className="truncate text-[11px] font-[900]" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                            <p className="max-w-[112px] truncate text-right text-[16px] font-[950] tabular-nums tracking-[-0.04em]" title={item.value.toLocaleString()} style={{ color: "var(--text-strong)" }}>{item.value.toLocaleString()}</p>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] font-[750]" title={String(item.sub)} style={{ color: "var(--text-faint)" }}>{item.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-[18px] border" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <p className="text-[17px] font-[950] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>업로드 미리보기</p>
                <p className="mt-1 text-[12px] font-[750]" style={{ color: "var(--text-muted)" }}>최대 80건까지 표시됩니다. 좌우 스크롤로 모든 항목을 확인할 수 있습니다.</p>
              </div>
              <Badge tone={importableCount > 0 ? "success" : "muted"}>{importableCount.toLocaleString()}건 반영 가능</Badge>
            </div>

            <div className="max-h-[620px] overflow-auto">
              {rows.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px]" style={{ background: "var(--surface-2)", color: "var(--text-subtle)", border: "1px solid var(--border)" }}>
                    <FileText size={22} />
                  </div>
                  <div>
                    <p className="text-[14px] font-[900]" style={{ color: "var(--text-muted)" }}>엑셀 파일을 선택하면 미리보기가 표시됩니다.</p>
                    <p className="mt-1 text-[12px] font-[700]" style={{ color: "var(--text-faint)" }}>효성CMS 수납내역 엑셀 파일을 그대로 업로드해주세요.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full min-w-[1180px] border-collapse text-left text-[13px]">
                  <thead className="sticky top-0 z-10" style={{ background: "var(--surface-2)", color: "var(--text-subtle)" }}>
                    <tr>
                      <th className="w-[92px] px-4 py-3 font-[900]">상태</th>
                      <th className="w-[130px] px-4 py-3 font-[900]">회원번호</th>
                      <th className="w-[140px] px-4 py-3 font-[900]">회원명</th>
                      <th className="w-[150px] px-4 py-3 font-[900]">연락처</th>
                      <th className="w-[100px] px-4 py-3 font-[900]">청구월</th>
                      <th className="w-[130px] px-4 py-3 font-[900]">결제일</th>
                      <th className="w-[120px] px-4 py-3 font-[900]">수납상태</th>
                      <th className="w-[120px] px-4 py-3 font-[900]">결제상태</th>
                      <th className="w-[130px] px-4 py-3 text-right font-[900]">수납금액</th>
                      <th className="w-[180px] px-4 py-3 font-[900]">결제결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 15).map((row) => (
                      <tr key={`${row.externalPaymentId}-${row.rowIndex}`} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td className="px-4 py-3">
                          {row.isDuplicate ? <Badge tone="warning">중복</Badge> : row.isPaid ? <Badge tone="success">매출</Badge> : <Badge tone="danger">실패</Badge>}
                        </td>
                        <td className="px-4 py-3"><span className="font-[850]" style={{ color: "var(--text-muted)" }}>{row.memberNumber || "-"}</span></td>
                        <td className="px-4 py-3"><span className="font-[900]" style={{ color: "var(--text-strong)" }}>{row.memberName || "-"}</span></td>
                        <td className="px-4 py-3"><span className="font-[750]" style={{ color: "var(--text-muted)" }}>{row.memberPhone || "-"}</span></td>
                        <td className="px-4 py-3"><span className="font-[750]" style={{ color: "var(--text-muted)" }}>{row.billingMonth || "-"}</span></td>
                        <td className="px-4 py-3"><span className="font-[750]" style={{ color: "var(--text-muted)" }}>{formatFullDate(row.paidAt)}</span></td>
                        <td className="px-4 py-3"><Badge tone={row.collectionStatus === "완납" ? "success" : "danger"}>{row.collectionStatus || "-"}</Badge></td>
                        <td className="px-4 py-3"><Badge tone={row.paymentStatus === "결제완료" ? "success" : "danger"}>{row.paymentStatus || "-"}</Badge></td>
                        <td className="px-4 py-3 text-right"><span className="font-[950]" style={{ color: "var(--text-strong)" }}>{money(row.paidAmount)}</span></td>
                        <td className="px-4 py-3"><span className="font-[750]" style={{ color: "var(--text-muted)" }}>{row.resultMessage || "-"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-3 px-8 py-5" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
          <p className="text-[12px] font-[750]" style={{ color: "var(--text-muted)" }}>
            같은 파일을 다시 업로드해도 중복건은 자동 제외됩니다.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-premium btn-secondary">닫기</button>
            <button type="button" onClick={onImport} disabled={saving || importableCount === 0} className="btn-premium btn-primary disabled:opacity-50">
              <UploadCloud size={14} />{saving ? "반영 중..." : "통합매출 반영"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function SalesPage() {
  const [rows, setRows] = useState<AdExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AdExecution | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [showModal, setShowModal] = useState(false);
  const [showHyosungModal, setShowHyosungModal] = useState(false);
  const [hyosungRows, setHyosungRows] = useState<HyosungCmsPreviewRow[]>([]);
  const [hyosungSummary, setHyosungSummary] = useState<HyosungImportSummary>({ total: 0, paid: 0, failed: 0, duplicate: 0, importedLogs: 0, createdSales: 0 });
  const [hyosungSaving, setHyosungSaving] = useState(false);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  // 직급 매칭용 — 담당자 필터 무관하게 전체 분양회 입회자
  const [allMembersForTitle, setAllMembersForTitle] = useState<MemberOption[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [ciderpaySyncing, setCiderpaySyncing] = useState(false);
  const [ciderpayFullSyncing, setCiderpayFullSyncing] = useState(false);
  const [editItem, setEditItem] = useState<AdExecution | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [fRoute, setFRoute] = useState("");
  const [fChannel, setFChannel] = useState("");
  const [fTeam, setFTeam] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const inputClass = "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";
  const textareaClass = "min-h-[180px] w-full resize-y rounded-[8px] border px-3 py-2 text-[13px] font-semibold outline-none";

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const endDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
    const start = `${month}-01`;
    const end = `${month}-${String(endDate.getDate()).padStart(2, "0")}`;
    const { data, error } = await supabase.from("ad_executions").select("*").gte("payment_date", start).lte("payment_date", end).order("payment_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
    if (error) {
      console.error("매출 조회 실패:", error.message);
      setRows([]);
    } else {
      setRows((data || []) as AdExecution[]);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const fetchMemberOptions = useCallback(async () => {
    // 실행파트 로그인 시 본인 담당 고객만 조회
    let execName: string | null = null;
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const u = JSON.parse(raw);
        const adminNames = ["문시욱", "김정후", "김창완", "최웅"];
        const execNames = ["조계현", "이세호", "기여운", "최연전"];
        const name = String(u?.name || "").trim();
        const role = String(u?.role || "").toLowerCase();
        const isAdmin = role === "admin" || adminNames.includes(name);
        const isExec = role === "exec" || role.includes("실행") || execNames.includes(name);
        if (isExec && !isAdmin) execName = name;
      }
    } catch {}

    let q = supabase
      .from("contacts")
      .select("id,name,title,bunyanghoe_number,phone,assigned_to,consultant,meeting_result")
      .in("meeting_result", ["예약완료", "계약완료"])
      .not("name", "is", null)
      .order("name", { ascending: true })
      .limit(2000);

    if (execName) {
      q = q.eq("assigned_to", execName) as typeof q;
    }

    const { data, error } = await q;

    if (error) {
      console.error("분양회 입회자 조회 실패:", error.message);
      setMemberOptions([]);
      return;
    }

    setMemberOptions((data || []) as MemberOption[]);

    // 직급/담당자 매칭용 — 담당자 필터 없이 전체 분양회 입회자 조회
    // 효성CMS는 담당자가 "주식회사광고인"으로 들어오는 경우가 있어,
    // 분양회 입회자 contacts의 고객명/회원번호 기준으로 assigned_to를 다시 매칭합니다.
    const { data: allMembers } = await supabase
      .from("contacts")
      .select("id,name,title,bunyanghoe_number,phone,assigned_to,consultant,meeting_result")
      .in("meeting_result", ["예약완료", "계약완료"])
      .not("name", "is", null)
      .limit(5000);
    setAllMembersForTitle((allMembers || []) as MemberOption[]);
  }, []);

  useEffect(() => { fetchMemberOptions(); }, [fetchMemberOptions]);

  // 로그인 사용자
  const [crmUser, setCrmUser] = useState<{ name: string; title: string; role: string } | null>(null);
  useEffect(() => {
    const u = getCurrentUser();
    if (u) setCrmUser(u);
  }, []);


  const stats = useMemo(() => {
    const isMembership = (row: AdExecution) => normalizePaymentItem(row.contract_route) === "분양회 회비";
    const isAdBenefit = (row: AdExecution) => ["LMS", "호갱노노"].includes(normalizePaymentItem(row.contract_route));
    const membershipGross = rows.filter(isMembership).reduce((sum, row) => sum + (row.execution_amount || 0), 0);
    const adBenefitGross = rows.filter(isAdBenefit).reduce((sum, row) => sum + (row.execution_amount || 0), 0);
    const membershipRefund = rows.filter(isMembership).reduce((sum, row) => sum + (row.refund_amount || 0), 0);
    const adBenefitRefund = rows.filter(isAdBenefit).reduce((sum, row) => sum + (row.refund_amount || 0), 0);
    const refund = membershipRefund + adBenefitRefund;
    const total = membershipGross + adBenefitGross - refund;
    return {
      count: rows.length,
      total,
      membershipGross,
      adBenefitGross,
      refund,
      membershipRefund,
      adBenefitRefund,
    };
  }, [rows]);

  const normalizeMemberKey = useCallback((value?: string | null) => {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/[()\[\]{}\-_.·•]/g, "")
      .toLowerCase();
  }, []);

  const memberTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    // 이름 정규화: 모든 공백·특수문자 제거하고 소문자화
    const normalize = normalizeMemberKey;
    // 전체 분양회 입회자 기준 (담당자 필터 무관)
    allMembersForTitle.forEach((member) => {
      const rawName = (member.name || "").trim();
      const key = normalize(rawName);
      if (key && member.title) map.set(key, member.title);
    });
    // 본인 담당 옵션도 포함 (혹시 누락된 케이스 보완)
    memberOptions.forEach((member) => {
      const rawName = (member.name || "").trim();
      const key = normalize(rawName);
      if (key && member.title && !map.has(key)) map.set(key, member.title);
    });
    return map;
  }, [allMembersForTitle, memberOptions, normalizeMemberKey]);

  // 정규화된 이름으로 직급 조회 헬퍼
  const getTitleByName = (name: string | null | undefined): string => {
    if (!name) return "-";
    return memberTitleMap.get(normalizeMemberKey(name)) || "-";
  };

  const memberManagerByNameMap = useMemo(() => {
    const map = new Map<string, string>();
    [...allMembersForTitle, ...memberOptions].forEach((member) => {
      const nameKey = normalizeMemberKey(member.name);
      const manager = (member.assigned_to || "").trim();
      if (nameKey && manager && !map.has(nameKey)) map.set(nameKey, manager);
    });
    return map;
  }, [allMembersForTitle, memberOptions, normalizeMemberKey]);

  const memberManagerByNumberMap = useMemo(() => {
    const map = new Map<string, string>();
    [...allMembersForTitle, ...memberOptions].forEach((member) => {
      const numberKey = normalizeMemberKey(member.bunyanghoe_number);
      const manager = (member.assigned_to || "").trim();
      if (numberKey && manager && !map.has(numberKey)) map.set(numberKey, manager);
    });
    return map;
  }, [allMembersForTitle, memberOptions, normalizeMemberKey]);

  const getMatchedMemberManager = useCallback(
    (memberName?: string | null, bunyanghoeNumber?: string | null) => {
      return (
        memberManagerByNumberMap.get(normalizeMemberKey(bunyanghoeNumber)) ||
        memberManagerByNameMap.get(normalizeMemberKey(memberName)) ||
        ""
      );
    },
    [memberManagerByNameMap, memberManagerByNumberMap, normalizeMemberKey],
  );

  const shouldReplaceCompanyManager = useCallback((manager?: string | null) => {
    const value = normalizeMemberKey(manager);
    return !value || value === normalizeMemberKey("주식회사광고인") || value === normalizeMemberKey("주식회사 광고인");
  }, [normalizeMemberKey]);

  const displayRows = useMemo(() => {
    return rows.map((row) => {
      const currentManager = (row.team_member || "").trim();
      const matchedManager = getMatchedMemberManager(row.member_name, row.bunyanghoe_number);

      // 효성CMS 자동반영 또는 담당자가 회사명으로 들어온 매출은
      // 분양회 입회자 contacts 기준 담당자로 화면 출력값을 보정합니다.
      if ((row.channel === "효성CMS" || shouldReplaceCompanyManager(currentManager)) && matchedManager) {
        return { ...row, team_member: matchedManager };
      }

      return row;
    });
  }, [rows, getMatchedMemberManager, shouldReplaceCompanyManager]);


  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return displayRows.filter((row) => {
      const matchSearch = !keyword || [row.member_name, row.channel, row.contract_route, row.team_member, row.consultant, row.memo].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      return matchSearch && (!fRoute || normalizePaymentItem(row.contract_route) === fRoute) && (!fChannel || row.channel === fChannel) && (!fTeam || row.team_member === fTeam);
    });
  }, [displayRows, search, fRoute, fChannel, fTeam]);

  useEffect(() => {
    setPage(1);
  }, [month, search, fRoute, fChannel, fTeam]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  const routeStats = useMemo(() => CONTRACT_ROUTES.map((route) => {
    const list = filteredRows.filter((row) => normalizePaymentItem(row.contract_route) === route);
    return { route, count: list.length, amount: list.reduce((sum, row) => sum + effectiveSales(row), 0) };
  }).filter((item) => item.count > 0 || item.amount > 0), [filteredRows]);

  const channelStats = useMemo(() => {
    const map: Record<string, { channel: string; count: number; amount: number }> = {};
    filteredRows.forEach((row) => {
      const key = row.channel || "기타";
      if (!map[key]) map[key] = { channel: key, count: 0, amount: 0 };
      map[key].count += 1;
      map[key].amount += effectiveSales(row);
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [filteredRows]);

  const activeFilters = [search, fRoute, fChannel, fTeam].filter(Boolean).length;
  const resetFilters = () => { setSearch(""); setFRoute(""); setFChannel(""); setFTeam(""); };
  const selectedMember = useMemo(() => memberOptions.find((member) => (member.name || "") === form.member_name) || null, [memberOptions, form.member_name]);
  const shouldShowAdForm = isAdPaymentItem(form.contract_route);
  const setFormValue = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openAdd = () => { setEditItem(null); setMemberSearch(""); setForm({ ...EMPTY_FORM, payment_date: new Date().toISOString().slice(0, 10) }); setShowModal(true); };
  const openEdit = (item: AdExecution) => {
    const info = parseAdMemo(item.memo);
    const paymentItem = normalizePaymentItem(item.contract_route) || "";
    setEditItem(item);
    setMemberSearch(item.member_name || "");
    setForm({
      member_name: item.member_name || "",
      execution_amount: item.execution_amount ? item.execution_amount.toLocaleString() : "",
      vat_amount: item.vat_amount ? item.vat_amount.toLocaleString() : "",
      refund_amount: item.refund_amount ? item.refund_amount.toLocaleString() : "",
      channel: item.channel || "",
      contract_route: paymentItem,
      payment_date: item.payment_date?.slice(0, 10) || "",
      team_member: item.team_member || "",
      consultant: item.consultant || "",
      site_name: info["현장명"] || "",
      property_name: info["물건"] || "",
      region: info["지역"] || "",
      agreed_marketer: info["협의마케터"] || "",
      ad_period: info["광고기간"] || "",
      total_payment_amount: info["총결제금액(A+B)"] || (item.execution_amount ? item.execution_amount.toLocaleString() : ""),
      initial_recognized_sales: "X",
      customer_number: info["고객번호"] || "",
      customer_industry: info["업종"] || "",
      customer_company: info["회사명"] || "",
      customer_contract_route: info["계약경로"] || "",
      ad_support_amount: info["광고지원 금액"] || "",
      ad_support_company: info["광고지원 회사명"] || "",
      ad_support_industry: info["광고지원 업종"] || "",
      depositor_name: info["입금자명"] || "",
      payment_card: info["결제카드"] || "",
      card_number: info["카드번호"] || "",
      contact_phone: info["연락처"] || "",
      tax_invoice_status: info["세금계산서"] || "",
      cash_receipt_status: info["현금영수증"] || "",
      special_notes: info["특이사항"] || "",
      memo: isAdPaymentItem(paymentItem) ? "" : item.memo || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.member_name.trim()) return alert("고객명을 입력하세요.");
    if (!form.payment_date) return alert("결제일을 선택하세요.");
    const memo = shouldShowAdForm ? buildAdMemo({ ...form, contact_phone: form.contact_phone || selectedMember?.phone || "" }) : form.memo;
    const payload = {
      member_name: form.member_name || null,
      execution_amount: parseNumber(form.execution_amount),
      vat_amount: parseNumber(form.execution_amount),
      refund_amount: parseNumber(form.refund_amount),
      channel: form.channel || null,
      contract_route: form.contract_route || null,
      payment_date: form.payment_date || null,
      team_member: form.team_member || null,
      consultant: null,
      memo: memo || null,
    };
    setSaving(true);
    const { data: savedData, error } = editItem
      ? await supabase.from("ad_executions").update(payload).eq("id", editItem.id).select("id").single()
      : await supabase.from("ad_executions").insert(payload).select("id").single();
    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    setShowModal(false);
    setEditItem(null);
    fetchRows();
    if (selectedItem && editItem?.id === selectedItem.id) setSelectedItem({ ...selectedItem, ...payload } as AdExecution);

    // ── 신규 등록 + 분양회 결제건이면 카카오워크 알림 ──
    if (!editItem && payload.contract_route?.includes("분양회")) {
      try {
        // N회차 계산: 고객명 기준 월별 유니크 결제 건수 (동월 중복 제외)
        const { data: allPayments } = await supabase
          .from("ad_executions")
          .select("payment_date")
          .eq("member_name", payload.member_name || "")
          .eq("contract_route", payload.contract_route)
          .gt("execution_amount", 0)
          .order("payment_date", { ascending: true });

        // 월별 유니크 카운트 (YYYY-MM 기준)
        const uniqueMonths = new Set(
          (allPayments || [])
            .map((r: any) => (r.payment_date || "").slice(0, 7))
            .filter(Boolean)
        );
        const nth = uniqueMonths.size || 1;

        // 고객 직급/연락처 조회
        const { data: memberInfo } = await supabase
          .from("contacts")
          .select("title, phone")
          .eq("name", payload.member_name || "")
          .maybeSingle();

        // 메모 값 (특이사항 하단에 추가)
        const memoNote = form.memo?.trim() || "";

        await fetch("/api/kakaowork/send-sales-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_name: payload.member_name,
            member_title: memberInfo?.title || "",
            member_phone: memberInfo?.phone || form.contact_phone || "",
            execution_amount: payload.execution_amount,
            channel: payload.channel,
            contract_route: payload.contract_route,
            payment_date: payload.payment_date,
            team_member: payload.team_member,
            payment_card: form.payment_card || "",
            is_auto: false,
            payment_count: nth,
            extra_note: memoNote,
          }),
        });
      } catch (kakaoErr) {
        console.warn("카카오워크 알림 실패 (무시):", kakaoErr);
      }
    }
  };


  const handleDeleteSalesRecord = async (recordId: number) => {
    const ok = window.confirm("해당 매출 기록을 삭제하시겠습니까?");
    if (!ok) return;

    const target = rows.find((row) => row.id === recordId);

    const { error } = await supabase
      .from("ad_executions")
      .delete()
      .eq("id", recordId);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }

    setRows((prev) => prev.filter((row) => row.id !== recordId));

    if (selectedItem?.id === recordId) {
      setSelectedItem(null);
    }

    if (editItem?.id === recordId) {
      setEditItem(null);
      setShowModal(false);
    }

    alert(`${target?.member_name || "매출 기록"} 삭제가 완료되었습니다.`);
  };


  const updateHyosungSummary = (nextRows: HyosungCmsPreviewRow[], extra?: Partial<HyosungImportSummary>) => {
    const total = nextRows.length;
    const paid = nextRows.filter((row) => row.isPaid).length;
    const failed = nextRows.filter((row) => !row.isPaid).length;
    const duplicate = nextRows.filter((row) => row.isDuplicate).length;
    setHyosungSummary({
      total,
      paid,
      failed,
      duplicate,
      importedLogs: extra?.importedLogs || 0,
      createdSales: extra?.createdSales || 0,
    });
  };

  const handleHyosungFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsedRows = parseHyosungCmsRows(jsonRows);
      const ids = Array.from(new Set(parsedRows.map((row) => row.externalPaymentId).filter(Boolean)));
      const duplicateIds = new Set<string>();
      const seenInFile = new Set<string>();

      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("external_payment_records")
          .select("external_payment_id,sales_record_id,import_status")
          .eq("provider", HYOSUNG_PROVIDER)
          .in("external_payment_id", ids);

        if (error) throw new Error(`중복 수납내역 조회 실패: ${getErrorMessage(error)}`);

        const logRows = data || [];
        const linkedSalesIds = Array.from(
          new Set(
            logRows
              .map((row) => Number(row.sales_record_id))
              .filter((id) => Number.isFinite(id) && id > 0)
          )
        );
        const aliveSalesIds = new Set<number>();

        if (linkedSalesIds.length > 0) {
          const { data: aliveSales, error: aliveSalesError } = await supabase
            .from("ad_executions")
            .select("id")
            .in("id", linkedSalesIds);

          if (aliveSalesError) throw new Error(`기존 매출 확인 실패: ${getErrorMessage(aliveSalesError)}`);
          (aliveSales || []).forEach((row) => aliveSalesIds.add(Number(row.id)));
        }

        logRows.forEach((row) => {
          const salesId = Number(row.sales_record_id);
          if (Number.isFinite(salesId) && aliveSalesIds.has(salesId)) {
            duplicateIds.add(String(row.external_payment_id));
          }
        });
      }

      const paidRows = parsedRows.filter((row) => row.isPaid && row.memberNumber && row.memberName && row.paidAt);
      const memberNumbers = Array.from(new Set(paidRows.map((row) => row.memberNumber)));
      const paymentDates = Array.from(new Set(paidRows.map((row) => row.paidAt).filter(Boolean))) as string[];

      if (memberNumbers.length > 0 && paymentDates.length > 0) {
        const { data: salesRows, error: salesError } = await supabase
          .from("ad_executions")
          .select("member_name,bunyanghoe_number,payment_date,execution_amount,channel")
          .eq("channel", "효성CMS")
          .in("bunyanghoe_number", memberNumbers)
          .in("payment_date", paymentDates);

        if (salesError) throw new Error(`통합매출 중복 조회 실패: ${getErrorMessage(salesError)}`);

        const salesKeys = new Set(
          (salesRows || []).map((item) =>
            [
              cellText(item.bunyanghoe_number),
              cellText(item.member_name),
              cellText(item.payment_date),
              cellNumber(item.execution_amount),
            ].join("|")
          )
        );

        paidRows.forEach((row) => {
          const salesKey = [row.memberNumber, row.memberName, row.paidAt, row.paidAmount].join("|");
          if (salesKeys.has(salesKey)) duplicateIds.add(row.externalPaymentId);
        });
      }

      const nextRows = parsedRows.map((row) => {
        const alreadySeen = seenInFile.has(row.externalPaymentId);
        seenInFile.add(row.externalPaymentId);
        return { ...row, isDuplicate: alreadySeen || duplicateIds.has(row.externalPaymentId) };
      });
      setHyosungRows(nextRows);
      updateHyosungSummary(nextRows);
    } catch (error) {
      console.error("효성CMS 엑셀 파싱 실패:", error);
      alert(`효성CMS 엑셀 파싱 실패: ${getErrorMessage(error)}`);
    }
  };

  const handleHyosungImport = async () => {
    const importTargets = hyosungRows.filter((row) => row.isPaid && !row.isDuplicate);
    if (importTargets.length === 0) return alert("통합매출로 반영할 결제완료 수납내역이 없습니다.");

    setHyosungSaving(true);
    let importedLogs = 0;
    let createdSales = 0;

    try {
      for (const row of importTargets) {
        const baseLogPayload = {
          provider: HYOSUNG_PROVIDER,
          external_payment_id: row.externalPaymentId,
          member_number: row.memberNumber || null,
          contract_number: row.contractNumber || null,
          member_name: row.memberName || null,
          member_phone: row.memberPhone || null,
          billing_month: row.billingMonth || null,
          product_name: row.productName || null,
          collection_status: row.collectionStatus || null,
          payment_status: row.paymentStatus || null,
          payment_type: row.paymentType || null,
          payment_method: row.paymentMethod || null,
          promised_at: row.promisedAt,
          paid_at: row.paidAt,
          completed_at: row.completedAt,
          billing_amount: row.billingAmount || 0,
          paid_amount: row.paidAmount || 0,
          unpaid_amount: row.unpaidAmount || 0,
          result_message: row.resultMessage || null,
          member_type: row.memberType || null,
          manager_name: row.managerName || null,
          match_status: "pending",
          import_status: "paid",
          import_message: "통합매출 반영 대상",
          raw_data: row.rawData,
        };

        const { data: paymentLog, error: logError } = await supabase
          .from("external_payment_records")
          .upsert(baseLogPayload, {
            onConflict: "provider,external_payment_id",
          })
          .select("id,sales_record_id")
          .single();

        if (logError) throw new Error(`수집 로그 저장 실패: ${getErrorMessage(logError)}`);
        importedLogs += 1;

        if (paymentLog?.sales_record_id) {
          const { data: aliveSales, error: aliveSalesError } = await supabase
            .from("ad_executions")
            .select("id")
            .eq("id", paymentLog.sales_record_id)
            .maybeSingle();

          if (aliveSalesError) throw new Error(`기존 매출 확인 실패: ${getErrorMessage(aliveSalesError)}`);

          if (aliveSales?.id) {
            continue;
          }

          const { error: resetLogError } = await supabase
            .from("external_payment_records")
            .update({ sales_record_id: null, import_status: "reset_for_reimport", import_message: "연결된 통합매출이 없어 재반영 허용" })
            .eq("id", paymentLog.id);

          if (resetLogError) throw new Error(`기존 수집 로그 초기화 실패: ${getErrorMessage(resetLogError)}`);
        }

        if (row.memberNumber && row.memberName && row.paidAt) {
          const { data: existingSales, error: existingSalesError } = await supabase
            .from("ad_executions")
            .select("id")
            .eq("channel", "효성CMS")
            .eq("bunyanghoe_number", row.memberNumber)
            .eq("member_name", row.memberName)
            .eq("payment_date", row.paidAt)
            .eq("execution_amount", row.paidAmount)
            .maybeSingle();

          if (existingSalesError) throw new Error(`통합매출 중복 최종확인 실패: ${getErrorMessage(existingSalesError)}`);

          if (existingSales?.id) {
            if (paymentLog?.id) {
              const { error: duplicateUpdateError } = await supabase
                .from("external_payment_records")
                .update({ sales_record_id: existingSales.id, import_status: "duplicate", import_message: "이미 통합매출관리 반영 완료" })
                .eq("id", paymentLog.id);
              if (duplicateUpdateError) throw new Error(`중복 수집 로그 업데이트 실패: ${getErrorMessage(duplicateUpdateError)}`);
            }
            continue;
          }
        }

        const matchedManager = getMatchedMemberManager(row.memberName, row.memberNumber);
        const salesPayload = {
          member_name: row.memberName || null,
          bunyanghoe_number: row.memberNumber || null,
          execution_amount: row.paidAmount || 0,
          vat_amount: row.paidAmount || 0,
          refund_amount: row.refundAmount || 0,
          channel: "효성CMS",
          contract_route: "분양회",
          payment_date: row.paidAt || new Date().toISOString().slice(0, 10),
          team_member: matchedManager || row.managerName || null,
          consultant: row.memberPhone || null,
          memo: buildSalesMemoFromHyosung(row),
        };

        const { data: salesRow, error: salesError } = await supabase
          .from("ad_executions")
          .insert(salesPayload)
          .select("id")
          .single();

        if (salesError) throw new Error(`통합매출 생성 실패: ${getErrorMessage(salesError)}`);
        createdSales += 1;

        if (paymentLog?.id && salesRow?.id) {
          const { error: updateError } = await supabase
            .from("external_payment_records")
            .update({ sales_record_id: salesRow.id, import_status: "sales_created", import_message: "통합매출관리 자동 반영 완료" })
            .eq("id", paymentLog.id);
          if (updateError) throw new Error(`수집 로그 업데이트 실패: ${getErrorMessage(updateError)}`);
        }
      }

      const importedIds = new Set(importTargets.map((row) => row.externalPaymentId));
      const nextRows = hyosungRows.map((row) => (importedIds.has(row.externalPaymentId) ? { ...row, isDuplicate: true } : row));
      setHyosungRows(nextRows);
      updateHyosungSummary(nextRows, { importedLogs, createdSales });
      alert(`효성CMS 수납내역 반영 완료\n수집 로그: ${importedLogs.toLocaleString()}건\n통합매출 생성: ${createdSales.toLocaleString()}건`);
      fetchRows();
    } catch (error) {
      console.error("효성CMS 수납내역 반영 실패:", error);
      alert(`효성CMS 수납내역 반영 실패: ${getErrorMessage(error)}`);
    } finally {
      setHyosungSaving(false);
    }
  };

  const openHyosungModal = () => {
    setHyosungRows([]);
    setHyosungSummary({ total: 0, paid: 0, failed: 0, duplicate: 0, importedLogs: 0, createdSales: 0 });
    setShowHyosungModal(true);
  };

  const runCiderpaySync = async ({
    endpoint,
    label,
    full = false,
  }: {
    endpoint: string;
    label: string;
    full?: boolean;
  }) => {
    if (ciderpaySyncing || ciderpayFullSyncing) return;

    const ok = window.confirm(`${label}를 실행하시겠습니까?`);
    if (!ok) return;

    if (full) setCiderpayFullSyncing(true);
    else setCiderpaySyncing(true);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || `${label} 실패`);
      }

      const created = Number(data.created || 0);
      const canceled = Number(data.canceled || 0);
      const duplicated = Number(data.duplicated || 0);
      const skipped = Number(data.skipped || 0);
      const totalFound = Number(data.totalFound || 0);
      const pagesFetched = Number(data.pagesFetched || 0);

      alert(
        [
          `${label} 완료`,
          `조회 페이지: ${pagesFetched.toLocaleString()}페이지`,
          `조회된 결제 행: ${totalFound.toLocaleString()}건`,
          `신규 매출 생성: ${created.toLocaleString()}건`,
          `취소/환불 생성: ${canceled.toLocaleString()}건`,
          `중복 제외: ${duplicated.toLocaleString()}건`,
          `대상 외 제외: ${skipped.toLocaleString()}건`,
        ].join("\n")
      );

      await fetchRows();
    } catch (error) {
      console.error(`${label} 실패:`, error);
      alert(`${label} 실패: ${getErrorMessage(error)}`);
    } finally {
      if (full) setCiderpayFullSyncing(false);
      else setCiderpaySyncing(false);
    }
  };

  const handleCiderpayFullSync = () => {
    runCiderpaySync({
      endpoint: "/api/payment-imports/ciderpay/sync-all",
      label: "사이다페이 전체동기화",
      full: true,
    });
  };

  const handleCiderpaySync = () => {
    runCiderpaySync({
      endpoint: "/api/payment-imports/ciderpay/sync",
      label: "사이다페이 동기화",
    });
  };

  const exportCsv = () => {
    const headers = ["ID", "고객명", "결제일", "결제채널", "결제항목", "집행금액", "환불금액", "담당자", "메모"];
    const lines = filteredRows.map((row) => [row.id, row.member_name || "", row.payment_date || "", row.channel || "", normalizePaymentItem(row.contract_route), row.execution_amount || 0, row.refund_amount || 0, row.team_member || "", row.memo || ""]);
    const csv = [headers, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sales-${month}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="premium-page sales-modern-page flex h-full flex-col overflow-hidden">
      <div className="premium-header sales-modern-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0"><div className="flex items-center gap-2"><CreditCard size={20} style={{ color: "var(--accent-text)" }} /><h1 className="crm-title">통합매출관리</h1></div><p className="crm-subtitle mt-1">광고 집행, 분양회 매출, 연계매출, 환불 반영 실매출을 통합 관리합니다.</p></div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={fetchRows} className="btn-premium btn-secondary">
            <RefreshCw size={14} />새로고침
          </button>
          <button
            type="button"
            onClick={handleCiderpayFullSync}
            disabled={ciderpaySyncing || ciderpayFullSyncing}
            className="btn-premium btn-secondary disabled:opacity-60"
          >
            <CreditCard size={14} />{ciderpayFullSyncing ? "전체동기화 중..." : "사이다페이 전체동기화"}
          </button>
          <button
            type="button"
            onClick={handleCiderpaySync}
            disabled={ciderpaySyncing || ciderpayFullSyncing}
            className="btn-premium btn-secondary disabled:opacity-60"
          >
            <CreditCard size={14} />{ciderpaySyncing ? "동기화 중..." : "사이다페이 동기화"}
          </button>
          <button type="button" onClick={openHyosungModal} className="btn-premium btn-secondary">
            <UploadCloud size={14} />효성CMS 업로드
          </button>
          <button type="button" onClick={exportCsv} className="btn-premium btn-secondary">
            <Download size={14} />CSV
          </button>
          <button type="button" onClick={openAdd} className="btn-premium btn-primary">
            <Plus size={14} />매출 등록
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="총매출" value={money(stats.total)} icon={TrendingUp} tone="success" sub={`${stats.count}건 · 환불 차감`} />
          <StatCard label="분양회 월회비" value={money(stats.membershipGross)} icon={BadgeCheck} tone="purple" sub="분양회 회비 합산" />
          <StatCard label="광고특전" value={money(stats.adBenefitGross)} icon={ReceiptText} tone="cyan" sub="LMS + 호갱노노" />
          <StatCard label="환불금액" value={money(stats.refund)} icon={ArrowDownRight} tone="danger" sub={`월회비 ${money(stats.membershipRefund)} · 광고특전 ${money(stats.adBenefitRefund)}`} />
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-3 md:px-7">
        <div className="premium-card rounded-[22px] p-4">
          <div className="grid gap-3 xl:grid-cols-[auto_minmax(260px,1.4fr)_minmax(140px,0.65fr)_minmax(140px,0.65fr)_minmax(140px,0.65fr)_auto]" style={{ justifyContent: "start" }}>

            {/* 월 선택 */}
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">월 선택</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="crm-search h-12 w-[160px] px-3 font-normal"
              />
            </label>

            {/* 검색 */}
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-10 font-normal">통합 검색</span>
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="고객명, 결제채널, 담당자, 메모 검색"
                  className="crm-search h-12 w-full pl-10 pr-3 font-normal"
                />
              </div>
            </label>

            {/* 결제채널 필터 */}
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">결제채널 필터</span>
              <select
                className="crm-search h-12 w-full px-3 font-normal"
                value={fChannel}
                onChange={(e) => setFChannel(e.target.value)}
              >
                <option value="">전체 결제채널</option>
                {CHANNELS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>

            {/* 결제항목 필터 */}
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">결제항목 필터</span>
              <select
                className="crm-search h-12 w-full px-3 font-normal"
                value={fRoute}
                onChange={(e) => setFRoute(e.target.value)}
              >
                <option value="">전체 결제항목</option>
                {CONTRACT_ROUTES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>

            {/* 담당자 필터 */}
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">담당자 필터</span>
              <select
                className="crm-search h-12 w-full px-3 font-normal"
                value={fTeam}
                onChange={(e) => setFTeam(e.target.value)}
              >
                <option value="">전체 담당자</option>
                {TEAM.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>

            {/* 필터 초기화 */}
            <div className="flex flex-col items-start gap-1.5">
              <span
                className="crm-meta block text-[11px] font-normal transition-colors"
                style={{ color: activeFilters > 0 ? "var(--accent-text)" : "transparent", userSelect: "none" }}
              >
                필터 적용중
              </span>
              <button
                type="button"
                className="h-12 whitespace-nowrap rounded-[12px] px-4 text-[13px] font-normal transition-all"
                style={{
                  background: activeFilters > 0 ? "var(--accent-subtle)" : "var(--surface-2)",
                  border: `1px solid ${activeFilters > 0 ? "var(--accent-border)" : "var(--border)"}`,
                  color: activeFilters > 0 ? "var(--accent-text)" : "var(--text-subtle)",
                }}
                onClick={resetFilters}
                disabled={activeFilters === 0}
              >
                <RefreshCw className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
                필터 초기화
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="sales-modern-main min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div> : filteredRows.length === 0 ? <div className="flex h-full items-center justify-center"><div className="premium-card p-8"><EmptyState icon="💳" title="표시할 매출 데이터가 없습니다" description="월 또는 필터 조건을 변경하거나 새 매출을 등록하세요" actionLabel="매출 등록" onAction={openAdd} /></div></div> : (
          <div className="grid h-full gap-5 xl:grid-cols-[1fr_310px]">
            <section className="min-h-0 overflow-hidden">
              <div className="crm-table-wrap sales-modern-table hidden h-full overflow-auto xl:block">
                <table className="crm-table min-w-[1380px] text-center" style={{ textAlign: "center" }}><thead><tr><th className="w-[250px] text-center">고객명</th><th className="w-[110px] text-center">직급</th><th className="w-[120px] text-center">결제일</th><th className="w-[130px] text-center">결제채널</th><th className="w-[130px] text-center">결제항목</th><th className="w-[150px] text-center">집행금액</th><th className="w-[140px] text-center">환불금액</th><th className="w-[130px] text-center">담당자</th><th className="w-[170px] text-center">관리</th></tr></thead><tbody>
                  {pagedRows.map((row) => <tr key={row.id} data-selected={selectedItem?.id === row.id ? "true" : "false"} className="cursor-pointer" onClick={() => { setSelectedItem(row); setDetailTab("overview"); }}>
                    <td className="text-center"><div className="crm-row-center justify-center gap-3"><div className="crm-avatar" style={{ background: avatarBg(row.member_name) }}>{row.member_name?.[0] || "매"}</div><div className="min-w-0 text-center"><div className="crm-row-main truncate text-center">{row.member_name || "고객명 없음"}</div></div></div></td>
                    <td className="text-center"><span className="font-bold" style={{ color: "var(--text-muted)" }}>{getTitleByName(row.member_name)}</span></td>
                    <td className="text-center"><span className="crm-meta">{formatFullDate(row.payment_date)}</span></td>
                    <td className="text-center"><Badge tone={channelTone(row.channel)}>{row.channel || "-"}</Badge></td>
                    <td className="text-center"><Badge tone={routeTone(normalizePaymentItem(row.contract_route))}>{normalizePaymentItem(row.contract_route) || "-"}</Badge></td>
                    <td className="text-center"><span className="font-bold" style={{ color: "var(--text-muted)" }}>{money(row.execution_amount)}</span></td>
                    <td className="text-center"><span className="font-bold" style={{ color: row.refund_amount ? "var(--danger-text)" : "var(--text-muted)" }}>{money(row.refund_amount)}</span></td>
                    <td className="text-center"><Badge tone="info">{row.team_member || "-"}</Badge></td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="btn-premium btn-secondary h-8 px-2.5 text-[12px]"><Edit2 size={13} />수정</button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSalesRecord(row.id);
                          }}
                          className="btn-premium h-8 px-2.5 text-[12px]"
                          style={{
                            color: "var(--danger-text)",
                            background: "var(--danger-bg)",
                            border: "1px solid var(--danger-border)",
                          }}
                        >
                          <Trash2 size={13} />삭제
                        </button>
                      </div>
                    </td>
                  </tr>)}
                </tbody></table>
              </div>
              <div className="h-full overflow-y-auto xl:hidden"><div className="space-y-3">{pagedRows.map((row) => <SalesMobileCard key={row.id} item={row} selected={selectedItem?.id === row.id} onClick={() => { setSelectedItem(row); setDetailTab("overview"); }} onDelete={handleDeleteSalesRecord} />)}</div></div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1} className="btn-premium btn-secondary h-8 px-3 text-[12px] disabled:opacity-40">이전</button>
                <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{currentPage.toLocaleString()} / {totalPages.toLocaleString()} 페이지 · {filteredRows.length.toLocaleString()}건</span>
                <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="btn-premium btn-secondary h-8 px-3 text-[12px] disabled:opacity-40">다음</button>
              </div>
            </section>
            <aside className="hidden min-h-0 xl:block"><div className="space-y-4"><section className="premium-card p-4"><div className="mb-4 flex items-center gap-2"><PremiumIcon icon={BarChart3} tone="success" /><div><p className="crm-section-title">결제항목별</p><p className="crm-tiny">현재 필터 기준</p></div></div><div className="space-y-2">{routeStats.length === 0 ? <p className="crm-tiny">데이터 없음</p> : routeStats.map((item) => { const max = Math.max(...routeStats.map((x) => x.amount), 1); const width = Math.max((item.amount / max) * 100, 4); return <div key={item.route}><div className="mb-1 flex items-center justify-between gap-2"><Badge tone={routeTone(item.route)}>{item.route}</Badge><span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{money(item.amount)}</span></div><div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}><div className="h-full rounded-full" style={{ width: `${width}%`, background: toneStyle(routeTone(item.route)).dot }} /></div></div>; })}</div></section><section className="premium-card p-4"><div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Filter} tone="purple" /><div><p className="crm-section-title">채널별 매출</p><p className="crm-tiny">상위 채널</p></div></div><div className="space-y-2">{channelStats.length === 0 ? <p className="crm-tiny">데이터 없음</p> : channelStats.map((item) => <div key={item.channel} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}><Badge tone={channelTone(item.channel)}>{item.channel}</Badge><span className="crm-tiny">{item.count}건</span><span className="ml-auto text-[13px] font-bold" style={{ color: "var(--text)" }}>{money(item.amount)}</span></div>)}</div></section></div></aside>
          </div>
        )}
      </main>

      {selectedItem && <DetailSlidePanel item={selectedItem} tab={detailTab} onTab={setDetailTab} onClose={() => setSelectedItem(null)} onEdit={openEdit} onDelete={handleDeleteSalesRecord} />}

      {showHyosungModal && (
        <HyosungUploadModal
          rows={hyosungRows}
          summary={hyosungSummary}
          saving={hyosungSaving}
          onFile={handleHyosungFile}
          onImport={handleHyosungImport}
          onClose={() => setShowHyosungModal(false)}
        />
      )}

      {showModal && (
        <div className="crm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="crm-modal flex max-h-[calc(100vh-40px)] w-[min(1360px,calc(100vw-40px))] max-w-none flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}><div><h2 className="crm-section-title">{editItem ? "매출 정보 수정" : "매출 등록"}</h2><p className="crm-subtitle mt-1">분양회 입회자 기준으로 매출 금액 정보를 입력합니다.</p></div><button type="button" onClick={() => setShowModal(false)} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><InputLabel>고객명 / 직급 *</InputLabel><input className={inputClass} value={memberSearch} onChange={(e) => { setMemberSearch(e.target.value); setFormValue("member_name", e.target.value); }} placeholder="예약완료·계약완료 입회자 이름/직급 검색" />
                <div className="mt-2 max-h-[390px] overflow-y-auto rounded-[12px] border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  {memberOptions
                    .filter((member) => {
                      const keyword = memberSearch.trim().toLowerCase();
                      const matchKeyword = !keyword || [member.name, member.title, member.bunyanghoe_number, member.phone, member.meeting_result].filter(Boolean).join(" ").toLowerCase().includes(keyword);
                      return matchKeyword;
                    })
                    .slice(0, 15)
                    .map((member) => (
                      <button key={member.id} type="button" onClick={() => { setMemberSearch(member.name || ""); setForm((prev) => ({ ...prev, member_name: member.name || "", customer_number: member.bunyanghoe_number || "", contact_phone: member.phone || "" })); }} className="grid w-full grid-cols-[1.2fr_.8fr_.8fr] items-center gap-3 px-3 py-2 text-left text-[13px] font-bold hover:opacity-80" style={{ color: "var(--text)", borderBottom: "1px solid var(--border-subtle)" }}>
                        <span className="truncate text-center">{member.name || "이름 없음"}</span>
                        <span className="truncate text-center text-[12px]" style={{ color: "var(--text-muted)" }}>{member.title || "직급 없음"}</span>
                        <span className="truncate text-center text-[11px] font-semibold" style={{ color: "var(--text-faint)" }}>{member.meeting_result || member.bunyanghoe_number || "-"}</span>
                      </button>
                    ))}
                </div>
              </div>
              <div><InputLabel>결제일 *</InputLabel><input type="date" className={inputClass} value={form.payment_date} onChange={(e) => setFormValue("payment_date", e.target.value)} /></div>
              <div><InputLabel>결제채널</InputLabel><select className={inputClass} value={form.channel} onChange={(e) => setFormValue("channel", e.target.value)}><option value="">선택</option>{CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><InputLabel>결제항목</InputLabel><select className={inputClass} value={form.contract_route} onChange={(e) => { const next = e.target.value; setForm((prev) => ({ ...prev, contract_route: next, total_payment_amount: isAdPaymentItem(next) && !prev.total_payment_amount ? prev.execution_amount : prev.total_payment_amount, initial_recognized_sales: isAdPaymentItem(next) ? "X" : prev.initial_recognized_sales, contact_phone: prev.contact_phone || selectedMember?.phone || "", customer_number: prev.customer_number || selectedMember?.bunyanghoe_number || "" })); }}><option value="">선택</option>{CONTRACT_ROUTES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><InputLabel>집행금액</InputLabel><input className={inputClass} value={form.execution_amount} onChange={(e) => { const next = formatInputAmount(e.target.value); setForm((prev) => ({ ...prev, execution_amount: next, total_payment_amount: isAdPaymentItem(prev.contract_route) && (!prev.total_payment_amount || prev.total_payment_amount === prev.execution_amount) ? next : prev.total_payment_amount })); }} placeholder="0" /></div>
              <div><InputLabel>환불금액</InputLabel><input className={inputClass} value={form.refund_amount} onChange={(e) => setFormValue("refund_amount", formatInputAmount(e.target.value))} placeholder="0" /></div>
              <div><InputLabel>담당자</InputLabel><select className={inputClass} value={form.team_member} onChange={(e) => setFormValue("team_member", e.target.value)}><option value="">선택</option>{TEAM.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>

              {shouldShowAdForm ? (
                <div className="md:col-span-2 rounded-[18px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <div className="mb-4">
                    <p className="text-[15px] font-[950] tracking-[-0.03em]" style={{ color: "var(--text-strong)" }}>광고특전 상세 입력</p>
                    <p className="mt-1 text-[12px] font-[750]" style={{ color: "var(--text-muted)" }}>LMS 또는 호갱노노 선택 시 아래 양식이 메모에 자동 저장됩니다.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div><InputLabel>현장명</InputLabel><input className={inputClass} value={form.site_name} onChange={(e) => setFormValue("site_name", e.target.value)} /></div>
                    <div><InputLabel>물건</InputLabel><input className={inputClass} value={form.property_name} onChange={(e) => setFormValue("property_name", e.target.value)} /></div>
                    <div><InputLabel>지역</InputLabel><input className={inputClass} value={form.region} onChange={(e) => setFormValue("region", e.target.value)} /></div>
                    <div><InputLabel>품목</InputLabel><input className={inputClass} value={form.contract_route || ""} readOnly /></div>
                    <div><InputLabel>결제금액</InputLabel><input className={inputClass} value={form.execution_amount} readOnly /></div>
                    <div><InputLabel>인정매출</InputLabel><input className={inputClass} value="X" readOnly /></div>
                    <div><InputLabel>협의마케터</InputLabel><input className={inputClass} value={form.agreed_marketer} onChange={(e) => setFormValue("agreed_marketer", e.target.value)} /></div>
                    <div className="md:col-span-2"><InputLabel>광고기간</InputLabel><input className={inputClass} value={form.ad_period} onChange={(e) => setFormValue("ad_period", e.target.value)} placeholder="예: 2026-06-10 ~ 2026-07-09" /></div>
                    <div><InputLabel>총결제금액</InputLabel><input className={inputClass} value={form.total_payment_amount} onChange={(e) => setFormValue("total_payment_amount", formatInputAmount(e.target.value))} /></div>
                    <div><InputLabel>총인정매출</InputLabel><input className={inputClass} value="X" readOnly /></div>
                    <div><InputLabel>분양회고객</InputLabel><input className={inputClass} value="O" readOnly /></div>
                    <div><InputLabel>고객명</InputLabel><input className={inputClass} value={form.member_name} readOnly /></div>
                    <div><InputLabel>고객번호</InputLabel><input className={inputClass} value={form.customer_number} onChange={(e) => setFormValue("customer_number", e.target.value)} /></div>
                    <div><InputLabel>업종</InputLabel><input className={inputClass} value={form.customer_industry} onChange={(e) => setFormValue("customer_industry", e.target.value)} /></div>
                    <div><InputLabel>회사명</InputLabel><input className={inputClass} value={form.customer_company} onChange={(e) => setFormValue("customer_company", e.target.value)} /></div>
                    <div><InputLabel>계약경로</InputLabel><input className={inputClass} value={form.customer_contract_route} onChange={(e) => setFormValue("customer_contract_route", e.target.value)} /></div>
                    <div><InputLabel>광고지원금액</InputLabel><input className={inputClass} value={form.ad_support_amount} onChange={(e) => setFormValue("ad_support_amount", formatInputAmount(e.target.value))} /></div>
                    <div><InputLabel>광고지원 회사명</InputLabel><input className={inputClass} value={form.ad_support_company} onChange={(e) => setFormValue("ad_support_company", e.target.value)} /></div>
                    <div><InputLabel>광고지원 업종</InputLabel><input className={inputClass} value={form.ad_support_industry} onChange={(e) => setFormValue("ad_support_industry", e.target.value)} /></div>
                    <div><InputLabel>입금자명</InputLabel><input className={inputClass} value={form.depositor_name} onChange={(e) => setFormValue("depositor_name", e.target.value)} /></div>
                    <div><InputLabel>입금계좌</InputLabel><input className={inputClass} value={FIXED_DEPOSIT_ACCOUNT} readOnly /></div>
                    <div><InputLabel>은행/예금주</InputLabel><input className={inputClass} value={FIXED_DEPOSIT_BANK} readOnly /></div>
                    <div><InputLabel>결제카드</InputLabel><input className={inputClass} value={form.payment_card} onChange={(e) => setFormValue("payment_card", e.target.value)} /></div>
                    <div><InputLabel>카드번호</InputLabel><input className={inputClass} value={form.card_number} onChange={(e) => setFormValue("card_number", e.target.value)} /></div>
                    <div><InputLabel>연락처</InputLabel><input className={inputClass} value={form.contact_phone || selectedMember?.phone || ""} onChange={(e) => setFormValue("contact_phone", e.target.value)} /></div>
                    <div><InputLabel>세금계산서</InputLabel><select className={inputClass} value={form.tax_invoice_status} onChange={(e) => setFormValue("tax_invoice_status", e.target.value)}><option value="">선택</option>{TAX_INVOICE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    <div><InputLabel>현금영수증</InputLabel><select className={inputClass} value={form.cash_receipt_status} onChange={(e) => setFormValue("cash_receipt_status", e.target.value)}><option value="">선택</option>{CASH_RECEIPT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    <div className="md:col-span-3"><InputLabel>특이사항</InputLabel><textarea className={`${textareaClass} min-h-[240px]`} value={form.special_notes} onChange={(e) => setFormValue("special_notes", e.target.value)} placeholder="특이사항을 입력하세요" /></div>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2"><InputLabel>메모</InputLabel><textarea className={textareaClass} value={form.memo} onChange={(e) => setFormValue("memo", e.target.value)} placeholder="매출 관련 특이사항을 입력하세요" /></div>
              )}
            </div></div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}><button type="button" onClick={() => setShowModal(false)} className="btn-premium btn-secondary">취소</button><button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary disabled:opacity-50"><ReceiptText size={14} />{saving ? "저장 중..." : editItem ? "수정 완료" : "등록"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
