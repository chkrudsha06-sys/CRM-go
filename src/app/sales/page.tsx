"use client";

import EmptyState from "@/components/EmptyState";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
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
  memo: string;
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

type DetailTab = "overview" | "amount" | "memo";

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
  memo: "",
};

const CHANNELS = ["사이다페이", "효성CMS", "LMS", "호갱노노", "네이버", "카카오", "구글", "메타", "유튜브", "기타"];
const CONTRACT_ROUTES = ["분양회", "연계매출", "광고매출", "기타"];
const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const CONSULTANTS = ["박경화", "박혜은", "조승현", "박민경", "백선중", "강아름", "전정훈", "박나라"];
const HYOSUNG_PROVIDER = "HYOSUNG_CMS";

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
  if (!n) return "0원";
  if (n >= 100_000_000) {
    const v = n / 100_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}억`;
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`;
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
  const text = cellText(value);
  if (!text || text === "-" || text === "66") return null;
  const normalized = text.replace(/[./]/g, "-");
  const match = normalized.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})/);
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

function makeHyosungExternalId(row: {
  memberNumber: string;
  contractNumber: string;
  billingMonth: string;
  paidAt: string | null;
  paidAmount: number;
  paymentStatus: string;
}) {
  return [
    HYOSUNG_PROVIDER,
    row.memberNumber || "NO_MEMBER",
    row.contractNumber || "NO_CONTRACT",
    row.billingMonth || "NO_BILLING_MONTH",
    row.paidAt || "NO_PAID_DATE",
    row.paidAmount || 0,
    row.paymentStatus || "NO_STATUS",
  ]
    .join("_")
    .replace(/\s+/g, "");
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
    .map((raw, index): HyosungCmsPreviewRow => {
      const memberNumber = cellText(raw["회원번호"]);
      const contractNumber = cellText(raw["계약번호"]);
      const billingMonth = normalizeBillingMonth(raw["청구월"]);
      const paidAt = normalizeCmsDate(raw["결제일(납부기간)"]);
      const paidAmount = cellNumber(raw["수납금액"]);
      const collectionStatus = cellText(raw["수납상태"]);
      const paymentStatus = cellText(raw["결제상태"]);
      const rowForId = {
        memberNumber,
        contractNumber,
        billingMonth,
        paidAt,
        paidAmount,
        paymentStatus,
      };

      return {
        rowIndex: index + 2,
        externalPaymentId: makeHyosungExternalId(rowForId),
        memberNumber,
        contractNumber,
        memberName: cellText(raw["회원명"]),
        memberPhone: cellText(raw["납부자 휴대전화"]),
        billingMonth,
        productName: cellText(raw["상품"]),
        collectionStatus,
        paymentStatus,
        paymentType: cellText(raw["결제방식"]),
        paymentMethod: cellText(raw["결제수단"]),
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
        resultMessage: cellText(raw["결제결과"]),
        memberType: cellText(raw["회원구분"]),
        managerName: cellText(raw["담당관리자"]),
        isPaid: collectionStatus === "완납" && paymentStatus === "결제완료" && paidAmount > 0,
        isDuplicate: false,
        rawData: raw,
      };
    })
    .filter((row) => row.memberName || row.memberPhone || row.memberNumber || row.paidAmount > 0);
}

function effectiveSales(row: AdExecution) {
  const execution = row.execution_amount || 0;
  const vat = row.vat_amount || 0;
  const refund = row.refund_amount || 0;
  const base = vat && vat !== execution ? vat : execution;
  return Math.max(base - refund, 0);
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
  if (value === "분양회") return "success";
  if (value === "연계매출") return "cyan";
  if (value === "광고매출") return "purple";
  return "muted";
}

function channelTone(value?: string | null) {
  if (value === "LMS") return "info";
  if (value === "호갱노노") return "purple";
  if (value === "네이버" || value === "카카오") return "success";
  if (value === "구글" || value === "메타" || value === "유튜브") return "warning";
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
            <Badge tone={routeTone(item.contract_route)}>{item.contract_route || "-"}</Badge>
          </div>
          <p className="crm-row-sub mt-0.5 truncate">{item.channel || "-"} · {formatFullDate(item.payment_date)}</p>
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
  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />
      <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-panel-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="crm-avatar-lg crm-avatar" style={{ background: avatarBg(item.member_name) }}>{item.member_name?.[0] || "매"}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-[22px] font-[780] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{item.member_name || "고객명 없음"}</h2>
                  <Badge tone={routeTone(item.contract_route)}>{item.contract_route || "-"}</Badge>
                </div>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>ID {item.id} · {item.channel || "채널 없음"} · {formatFullDate(item.payment_date)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={channelTone(item.channel)} icon={CreditCard}>{item.channel || "채널 없음"}</Badge>
                  <Badge tone="info" icon={User}>{item.team_member || "-"}</Badge>
                  <Badge tone="purple">{item.consultant || "-"}</Badge>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
          </div>
          <div className="mt-5 flex gap-1.5">
            {[{ key: "overview", label: "개요" }, { key: "amount", label: "금액상세" }, { key: "memo", label: "메모" }].map((menu) => {
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
                <Field label="채널"><Badge tone={channelTone(item.channel)}>{item.channel || "-"}</Badge></Field>
                <Field label="계약경로"><Badge tone={routeTone(item.contract_route)}>{item.contract_route || "-"}</Badge></Field>
                <Field label="담당자"><Badge tone="info" icon={User}>{item.team_member || "-"}</Badge></Field>
                <Field label="컨설턴트"><Badge tone="purple">{item.consultant || "-"}</Badge></Field>
              </section>
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={TrendingUp} tone="cyan" /><div><p className="crm-section-title">실매출 요약</p><p className="crm-tiny">집행금액, VAT, 환불 반영 기준</p></div></div>
                <div className="rounded-[14px] p-4" style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
                  <p className="text-[12px] font-bold" style={{ color: "var(--success-text)" }}>실매출</p>
                  <p className="mt-1 text-[30px] font-[780] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{money(effectiveSales(item))}</p>
                </div>
              </section>
            </div>
          )}
          {tab === "amount" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Wallet} tone="warning" /><div><p className="crm-section-title">금액 상세</p><p className="crm-tiny">매출 계산에 사용되는 금액 구조</p></div></div>
              <Field label="집행금액">{money(item.execution_amount)}</Field>
              <Field label="VAT금액">{money(item.vat_amount)}</Field>
              <Field label="환불금액"><span style={{ color: item.refund_amount ? "var(--danger-text)" : "var(--text)" }}>{money(item.refund_amount)}</span></Field>
              <Field label="실매출"><span className="text-[15px] font-[760]" style={{ color: "var(--success-text)" }}>{money(effectiveSales(item))}</span></Field>
              <div className="mt-4 rounded-[12px] p-4 text-[13px] font-semibold leading-relaxed" style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", color: "var(--info-text)" }}>VAT 금액이 있고 집행금액과 다른 경우 VAT 금액을 기준으로 계산하며, 환불금액을 차감해 실매출을 산정합니다.</div>
            </section>
          )}
          {tab === "memo" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={FileText} tone="purple" /><div><p className="crm-section-title">메모</p><p className="crm-tiny">매출 건 관련 특이사항</p></div></div>
              <div className="min-h-[180px] whitespace-pre-wrap rounded-[12px] p-4 text-[13px] font-medium leading-relaxed" style={{ background: "var(--surface-2)", color: item.memo ? "var(--text-muted)" : "var(--text-faint)", border: "1px solid var(--border-subtle)" }}>{item.memo || "등록된 메모가 없습니다."}</div>
            </section>
          )}
        </div>
        <div className="slide-panel-footer">
          <div className="grid grid-cols-2 gap-2">
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
  const importableCount = rows.filter((row) => !row.isDuplicate).length;
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
        className="crm-modal flex h-[calc(100vh-56px)] w-[min(1360px,calc(100vw-48px))] max-w-none flex-col overflow-hidden rounded-[22px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex flex-shrink-0 items-start justify-between gap-4 px-7 py-5"
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

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <section
            className="rounded-[18px] border p-4"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-center">
              <div>
                <InputLabel>효성CMS 수납내역 엑셀 파일</InputLabel>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFile(file);
                  }}
                  className="block h-12 w-full rounded-[14px] border px-4 text-[14px] font-[800]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                />
                <p className="mt-2 text-[12.5px] font-[750] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  수납상태가 <b>완납</b>이고 결제상태가 <b>결제완료</b>이며 수납금액이 0원보다 큰 건만 매출로 생성됩니다.
                  결제실패·미납 건은 매출로 잡지 않고 수집 로그에만 보관합니다.
                </p>
              </div>

              <div className="rounded-[16px] border px-4 py-3" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                <p className="text-[12px] font-[900]" style={{ color: "var(--text-subtle)" }}>반영 기준</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[12px] px-2 py-2" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                    <p className="text-[11px] font-[900]">완납</p>
                  </div>
                  <div className="rounded-[12px] px-2 py-2" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                    <p className="text-[11px] font-[900]">결제완료</p>
                  </div>
                  <div className="rounded-[12px] px-2 py-2" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                    <p className="text-[11px] font-[900]">수납금액 0원 초과</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {statItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[16px] border px-4 py-3" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <PremiumIcon icon={Icon} tone={item.tone} />
                    <p className="text-[22px] font-[950] leading-none tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>{item.value.toLocaleString()}</p>
                  </div>
                  <div className="mt-3 min-w-0">
                    <p className="truncate text-[12px] font-[900]" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                    <p className="mt-0.5 truncate text-[11px] font-[750]" style={{ color: "var(--text-faint)" }}>{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="mt-4 overflow-hidden rounded-[18px] border" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <p className="text-[17px] font-[950] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>업로드 미리보기</p>
                <p className="mt-1 text-[12px] font-[750]" style={{ color: "var(--text-muted)" }}>최대 80건까지 표시됩니다. 좌우 스크롤로 모든 항목을 확인할 수 있습니다.</p>
              </div>
              <Badge tone={importableCount > 0 ? "success" : "muted"}>{importableCount.toLocaleString()}건 반영 가능</Badge>
            </div>

            <div className="max-h-[470px] overflow-auto">
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
                    {rows.slice(0, 80).map((row) => (
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

        <div className="flex flex-shrink-0 items-center justify-between gap-3 px-7 py-4" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
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
  const [ciderpaySyncing, setCiderpaySyncing] = useState(false);
  const [editItem, setEditItem] = useState<AdExecution | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [fRoute, setFRoute] = useState("");
  const [fChannel, setFChannel] = useState("");
  const [fTeam, setFTeam] = useState("");
  const [fConsultant, setFConsultant] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const inputClass = "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";
  const textareaClass = "min-h-[96px] w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] font-semibold outline-none";

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

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchSearch = !keyword || [row.member_name, row.channel, row.contract_route, row.team_member, row.consultant, row.memo].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      return matchSearch && (!fRoute || row.contract_route === fRoute) && (!fChannel || row.channel === fChannel) && (!fTeam || row.team_member === fTeam) && (!fConsultant || row.consultant === fConsultant);
    });
  }, [rows, search, fRoute, fChannel, fTeam, fConsultant]);

  const stats = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + effectiveSales(row), 0);
    const execution = filteredRows.reduce((sum, row) => sum + (row.execution_amount || 0), 0);
    const vat = filteredRows.reduce((sum, row) => sum + (row.vat_amount || 0), 0);
    const refund = filteredRows.reduce((sum, row) => sum + (row.refund_amount || 0), 0);
    const bunyanghoe = filteredRows.filter((row) => row.contract_route === "분양회").reduce((sum, row) => sum + effectiveSales(row), 0);
    const linked = filteredRows.filter((row) => row.contract_route === "연계매출").reduce((sum, row) => sum + effectiveSales(row), 0);
    return { count: filteredRows.length, total, execution, vat, refund, bunyanghoe, linked };
  }, [filteredRows]);

  const routeStats = useMemo(() => CONTRACT_ROUTES.map((route) => {
    const list = filteredRows.filter((row) => row.contract_route === route);
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

  const activeFilters = [search, fRoute, fChannel, fTeam, fConsultant].filter(Boolean).length;
  const resetFilters = () => { setSearch(""); setFRoute(""); setFChannel(""); setFTeam(""); setFConsultant(""); };
  const setFormValue = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openAdd = () => { setEditItem(null); setForm({ ...EMPTY_FORM, payment_date: new Date().toISOString().slice(0, 10) }); setShowModal(true); };
  const openEdit = (item: AdExecution) => {
    setEditItem(item);
    setForm({
      member_name: item.member_name || "",
      execution_amount: item.execution_amount ? item.execution_amount.toLocaleString() : "",
      vat_amount: item.vat_amount ? item.vat_amount.toLocaleString() : "",
      refund_amount: item.refund_amount ? item.refund_amount.toLocaleString() : "",
      channel: item.channel || "",
      contract_route: item.contract_route || "",
      payment_date: item.payment_date?.slice(0, 10) || "",
      team_member: item.team_member || "",
      consultant: item.consultant || "",
      memo: item.memo || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.member_name.trim()) return alert("고객명을 입력하세요.");
    if (!form.payment_date) return alert("결제일을 선택하세요.");
    const payload = {
      member_name: form.member_name || null,
      execution_amount: parseNumber(form.execution_amount),
      vat_amount: parseNumber(form.vat_amount),
      refund_amount: parseNumber(form.refund_amount),
      channel: form.channel || null,
      contract_route: form.contract_route || null,
      payment_date: form.payment_date || null,
      team_member: form.team_member || null,
      consultant: form.consultant || null,
      memo: form.memo || null,
    };
    setSaving(true);
    const { error } = editItem ? await supabase.from("ad_executions").update(payload).eq("id", editItem.id) : await supabase.from("ad_executions").insert(payload);
    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    setShowModal(false);
    setEditItem(null);
    fetchRows();
    if (selectedItem && editItem?.id === selectedItem.id) setSelectedItem({ ...selectedItem, ...payload } as AdExecution);
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
      const ids = parsedRows.map((row) => row.externalPaymentId);
      let duplicateIds = new Set<string>();

      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("external_payment_records")
          .select("external_payment_id")
          .eq("provider", HYOSUNG_PROVIDER)
          .in("external_payment_id", ids);

        if (error) throw new Error(`중복 수납내역 조회 실패: ${getErrorMessage(error)}`);
        duplicateIds = new Set((data || []).map((row) => String(row.external_payment_id)));
      }

      const nextRows = parsedRows.map((row) => ({ ...row, isDuplicate: duplicateIds.has(row.externalPaymentId) }));
      setHyosungRows(nextRows);
      updateHyosungSummary(nextRows);
    } catch (error) {
      console.error("효성CMS 엑셀 파싱 실패:", error);
      alert(`효성CMS 엑셀 파싱 실패: ${getErrorMessage(error)}`);
    }
  };

  const handleHyosungImport = async () => {
    const importTargets = hyosungRows.filter((row) => !row.isDuplicate);
    if (importTargets.length === 0) return alert("반영할 신규 수납내역이 없습니다.");

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
          import_status: row.isPaid ? "paid" : "failed",
          import_message: row.isPaid ? "통합매출 반영 대상" : row.resultMessage || "결제실패 또는 미납",
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
          continue;
        }

        if (!row.isPaid) continue;

        const salesPayload = {
          member_name: row.memberName || null,
          execution_amount: row.paidAmount || 0,
          vat_amount: row.paidAmount || 0,
          refund_amount: row.refundAmount || 0,
          channel: "효성CMS",
          contract_route: "분양회",
          payment_date: row.paidAt || new Date().toISOString().slice(0, 10),
          team_member: null,
          consultant: null,
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

      const nextRows = hyosungRows.map((row) => (row.isDuplicate ? row : { ...row, isDuplicate: true }));
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

  const handleCiderpaySync = async () => {
    if (ciderpaySyncing) return;

    const ok = window.confirm("사이다페이 결제내역을 동기화하시겠습니까?");
    if (!ok) return;

    setCiderpaySyncing(true);

    try {
      const response = await fetch("/api/payment-imports/ciderpay/sync", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || "사이다페이 동기화 실패");
      }

      const results = Array.isArray(data.results) ? data.results : [];
      const created = results.filter((item: Record<string, unknown>) => item.status === "sales_created").length;
      const duplicated = results.filter((item: Record<string, unknown>) => item.status === "duplicate").length;

      alert(
        [
          "사이다페이 결제내역 동기화 완료",
          `조회된 결제완료: ${Number(data.totalFound || 0).toLocaleString()}건`,
          `신규 매출 생성: ${created.toLocaleString()}건`,
          `중복 제외: ${duplicated.toLocaleString()}건`,
        ].join("\n")
      );

      await fetchRows();
    } catch (error) {
      console.error("사이다페이 동기화 실패:", error);
      alert(`사이다페이 동기화 실패: ${getErrorMessage(error)}`);
    } finally {
      setCiderpaySyncing(false);
    }
  };

  const exportCsv = () => {
    const headers = ["ID", "고객명", "결제일", "채널", "계약경로", "집행금액", "VAT금액", "환불금액", "실매출", "담당자", "컨설턴트", "메모"];
    const lines = filteredRows.map((row) => [row.id, row.member_name || "", row.payment_date || "", row.channel || "", row.contract_route || "", row.execution_amount || 0, row.vat_amount || 0, row.refund_amount || 0, effectiveSales(row), row.team_member || "", row.consultant || "", row.memo || ""]);
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
            onClick={handleCiderpaySync}
            disabled={ciderpaySyncing}
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="실매출" value={money(stats.total)} icon={TrendingUp} tone="success" sub={`${stats.count}건`} />
          <StatCard label="집행금액" value={money(stats.execution)} icon={CreditCard} tone="info" />
          <StatCard label="VAT금액" value={money(stats.vat)} icon={ReceiptText} tone="cyan" />
          <StatCard label="환불금액" value={money(stats.refund)} icon={ArrowDownRight} tone="danger" />
          <StatCard label="분양회" value={money(stats.bunyanghoe)} icon={BadgeCheck} tone="purple" />
          <StatCard label="연계매출" value={money(stats.linked)} icon={ArrowUpRight} tone="warning" />
        </div>
      </div>

      <div className="premium-filterbar sales-modern-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-full border px-3 text-[13px] font-bold outline-none" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="relative w-full sm:w-[340px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명, 채널, 담당자, 메모 검색..." className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none" /></div>
        <SelectChip value={fRoute} onChange={setFRoute} options={CONTRACT_ROUTES} placeholder="계약경로" />
        <SelectChip value={fChannel} onChange={setFChannel} options={CHANNELS} placeholder="채널" />
        <SelectChip value={fTeam} onChange={setFTeam} options={TEAM} placeholder="담당자" />
        <SelectChip value={fConsultant} onChange={setFConsultant} options={CONSULTANTS} placeholder="컨설턴트" />
        {activeFilters > 0 && <button type="button" onClick={resetFilters} className="btn-premium btn-danger h-8">초기화</button>}
        <span className="ml-auto hidden text-[12px] font-bold md:block" style={{ color: "var(--text-faint)" }}>{filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()}건</span>
      </div>

      <main className="sales-modern-main min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div> : filteredRows.length === 0 ? <div className="flex h-full items-center justify-center"><div className="premium-card p-8"><EmptyState icon="💳" title="표시할 매출 데이터가 없습니다" description="월 또는 필터 조건을 변경하거나 새 매출을 등록하세요" actionLabel="매출 등록" onAction={openAdd} /></div></div> : (
          <div className="grid h-full gap-5 xl:grid-cols-[1fr_310px]">
            <section className="min-h-0 overflow-hidden">
              <div className="crm-table-wrap sales-modern-table hidden h-full overflow-auto xl:block">
                <table className="crm-table min-w-[1480px]"><thead><tr><th className="w-[270px]">고객명</th><th className="w-[120px]">결제일</th><th className="w-[120px]">채널</th><th className="w-[120px]">계약경로</th><th className="w-[150px]">집행금액</th><th className="w-[150px]">VAT금액</th><th className="w-[140px]">환불금액</th><th className="w-[160px]">실매출</th><th className="w-[120px]">담당자</th><th className="w-[120px]">컨설턴트</th><th className="w-[170px]">관리</th></tr></thead><tbody>
                  {filteredRows.map((row) => <tr key={row.id} data-selected={selectedItem?.id === row.id ? "true" : "false"} className="cursor-pointer" onClick={() => { setSelectedItem(row); setDetailTab("overview"); }}>
                    <td><div className="crm-row-center gap-3"><div className="crm-avatar" style={{ background: avatarBg(row.member_name) }}>{row.member_name?.[0] || "매"}</div><div className="min-w-0"><div className="crm-row-main truncate">{row.member_name || "고객명 없음"}</div><div className="crm-row-sub truncate">ID {row.id}</div></div></div></td>
                    <td><span className="crm-meta">{formatFullDate(row.payment_date)}</span></td>
                    <td><Badge tone={channelTone(row.channel)}>{row.channel || "-"}</Badge></td>
                    <td><Badge tone={routeTone(row.contract_route)}>{row.contract_route || "-"}</Badge></td>
                    <td><span className="font-bold" style={{ color: "var(--text-muted)" }}>{money(row.execution_amount)}</span></td>
                    <td><span className="font-bold" style={{ color: "var(--text-muted)" }}>{money(row.vat_amount)}</span></td>
                    <td><span className="font-bold" style={{ color: row.refund_amount ? "var(--danger-text)" : "var(--text-muted)" }}>{money(row.refund_amount)}</span></td>
                    <td><span className="text-[14px] font-[760]" style={{ color: "var(--success-text)" }}>{money(effectiveSales(row))}</span></td>
                    <td><Badge tone="info">{row.team_member || "-"}</Badge></td>
                    <td><Badge tone="purple">{row.consultant || "-"}</Badge></td>
                    <td>
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
              <div className="h-full overflow-y-auto xl:hidden"><div className="space-y-3">{filteredRows.map((row) => <SalesMobileCard key={row.id} item={row} selected={selectedItem?.id === row.id} onClick={() => { setSelectedItem(row); setDetailTab("overview"); }} onDelete={handleDeleteSalesRecord} />)}</div></div>
            </section>
            <aside className="hidden min-h-0 xl:block"><div className="space-y-4"><section className="premium-card p-4"><div className="mb-4 flex items-center gap-2"><PremiumIcon icon={BarChart3} tone="success" /><div><p className="crm-section-title">계약경로별</p><p className="crm-tiny">현재 필터 기준</p></div></div><div className="space-y-2">{routeStats.length === 0 ? <p className="crm-tiny">데이터 없음</p> : routeStats.map((item) => { const max = Math.max(...routeStats.map((x) => x.amount), 1); const width = Math.max((item.amount / max) * 100, 4); return <div key={item.route}><div className="mb-1 flex items-center justify-between gap-2"><Badge tone={routeTone(item.route)}>{item.route}</Badge><span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{money(item.amount)}</span></div><div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}><div className="h-full rounded-full" style={{ width: `${width}%`, background: toneStyle(routeTone(item.route)).dot }} /></div></div>; })}</div></section><section className="premium-card p-4"><div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Filter} tone="purple" /><div><p className="crm-section-title">채널별 매출</p><p className="crm-tiny">상위 채널</p></div></div><div className="space-y-2">{channelStats.length === 0 ? <p className="crm-tiny">데이터 없음</p> : channelStats.map((item) => <div key={item.channel} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}><Badge tone={channelTone(item.channel)}>{item.channel}</Badge><span className="crm-tiny">{item.count}건</span><span className="ml-auto text-[13px] font-bold" style={{ color: "var(--text)" }}>{money(item.amount)}</span></div>)}</div></section></div></aside>
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
          <div className="crm-modal flex max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}><div><h2 className="crm-section-title">{editItem ? "매출 정보 수정" : "매출 등록"}</h2><p className="crm-subtitle mt-1">광고 집행 및 매출 금액 정보를 입력합니다.</p></div><button type="button" onClick={() => setShowModal(false)} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><InputLabel>고객명 *</InputLabel><input className={inputClass} value={form.member_name} onChange={(e) => setFormValue("member_name", e.target.value)} placeholder="고객명" /></div>
              <div><InputLabel>결제일 *</InputLabel><input type="date" className={inputClass} value={form.payment_date} onChange={(e) => setFormValue("payment_date", e.target.value)} /></div>
              <div><InputLabel>채널</InputLabel><select className={inputClass} value={form.channel} onChange={(e) => setFormValue("channel", e.target.value)}><option value="">선택</option>{CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><InputLabel>계약경로</InputLabel><select className={inputClass} value={form.contract_route} onChange={(e) => setFormValue("contract_route", e.target.value)}><option value="">선택</option>{CONTRACT_ROUTES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><InputLabel>집행금액</InputLabel><input className={inputClass} value={form.execution_amount} onChange={(e) => setFormValue("execution_amount", formatInputAmount(e.target.value))} placeholder="0" /></div>
              <div><InputLabel>VAT금액</InputLabel><input className={inputClass} value={form.vat_amount} onChange={(e) => setFormValue("vat_amount", formatInputAmount(e.target.value))} placeholder="0" /></div>
              <div><InputLabel>환불금액</InputLabel><input className={inputClass} value={form.refund_amount} onChange={(e) => setFormValue("refund_amount", formatInputAmount(e.target.value))} placeholder="0" /></div>
              <div><InputLabel>담당자</InputLabel><select className={inputClass} value={form.team_member} onChange={(e) => setFormValue("team_member", e.target.value)}><option value="">선택</option>{TEAM.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><InputLabel>컨설턴트</InputLabel><select className={inputClass} value={form.consultant} onChange={(e) => setFormValue("consultant", e.target.value)}><option value="">선택</option>{CONSULTANTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div className="md:col-span-2"><InputLabel>메모</InputLabel><textarea className={textareaClass} value={form.memo} onChange={(e) => setFormValue("memo", e.target.value)} placeholder="매출 관련 특이사항을 입력하세요" /></div>
            </div></div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}><button type="button" onClick={() => setShowModal(false)} className="btn-premium btn-secondary">취소</button><button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary disabled:opacity-50"><ReceiptText size={14} />{saving ? "저장 중..." : editItem ? "수정 완료" : "등록"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
