"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type { ElementType, ReactNode } from "react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Database,
  FileDown,
  FileText,
  Filter,
  LineChart,
  Loader2,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";

type CRMUserLite = {
  name?: string;
  title?: string;
  role?: string;
  id?: string;
};

type ContactRow = Record<string, any> & {
  id: number;
  name?: string | null;
  title?: string | null;
  phone?: string | null;
  bunyanghoe_number?: string | null;
  intake_route?: string | null;
  activity_type?: string | null;
  has_tm?: boolean | null;
  tm_date?: string | null;
  meeting_result?: string | null;
  management_stage?: string | null;
  customer_grade?: string | null;
  crm_db_source?: string | null;
  vip_transferred_at?: string | null;
  assigned_to?: string | null;
  consultant?: string | null;
  contract_date?: string | null;
  reservation_date?: string | null;
  churn_date?: string | null;
  regular_payment_date?: string | null;
  payment_channel?: string | null;
  memo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type NoteRow = Record<string, any> & {
  id: number;
  contact_id: number;
  note_date?: string | null;
  content?: string | null;
  author?: string | null;
  created_at?: string | null;
};

type SalesRow = Record<string, any> & {
  id: number;
  member_name?: string | null;
  execution_amount?: number | null;
  vat_amount?: number | null;
  refund_amount?: number | null;
  channel?: string | null;
  contract_route?: string | null;
  payment_date?: string | null;
  team_member?: string | null;
  consultant?: string | null;
  bunyanghoe_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type KpiRow = Record<string, any> & {
  year: number;
  month: number;
  week: number;
  scope: "team" | "execution" | "operation";
  target_name: string;
  recruit_count?: number | null;
  master_count?: number | null;
  challenger_count?: number | null;
  bronze_count?: number | null;
  bunyanghoe_revenue?: number | null;
  linked_revenue?: number | null;
  special_revenue?: number | null;
  wanpan_truck_count?: number | null;
  ad_operation_revenue?: number | null;
};

type ActionItem = {
  key: string;
  type: string;
  tone: ToneName;
  title: string;
  desc: string;
  href: string;
  priority: number;
};

type ToneName = "info" | "success" | "warning" | "danger" | "purple" | "cyan" | "muted";

type FunnelRow = {
  label: string;
  value: number;
  sub: string;
  tone: ToneName;
};

const EXECUTION_PART_NAMES = ["조계현", "이세호", "기여운", "최연전"];
const OPERATION_PART_NAMES = ["김재영", "최은정"];
const OPERATION_EXECUTION_OWNER_MAP: Record<string, string[]> = {
  김재영: ["이세호", "기여운"],
  최은정: ["조계현", "최연전"],
};
const ADMIN_NAMES = ["문시욱", "김정후", "김창완", "최웅"];
const PIPELINE_STAGES = ["리드", "프로스펙팅", "딜클로징", "리텐션", "이탈/탈퇴"];
const HIGH_VALUE_GRADES = ["마스터", "챌린저", "1%", "상위"];
const CORE_VIP_GRADES = ["마스터", "챌린저", "브론즈"];
const PAYMENT_CHANNEL_OPTIONS = ["자동이체 (효성CMS)", "카드 (사이다페이)", "기타 (별도입금)"];
const PAYMENT_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit" });
const TODAY = new Date();

function normalizePersonName(value?: string | null) {
  return String(value || "")
    .replace(/님|팀장|파트장|본부장|대표|메인|어쏘|CX|어시|관리자/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeText(value?: string | null) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function getOperationManagedExecutionOwners(operationOwner?: string | null) {
  const target = normalizePersonName(operationOwner);
  const entry = Object.entries(OPERATION_EXECUTION_OWNER_MAP).find(
    ([name]) => normalizePersonName(name) === target
  );
  return entry?.[1] || [];
}

function getAllOperationManagedExecutionOwners() {
  return Array.from(new Set(Object.values(OPERATION_EXECUTION_OWNER_MAP).flat()));
}

function readUserFromStorage(): CRMUserLite | null {
  try {
    const current = getCurrentUser();
    if (current) return current;
    const raw = localStorage.getItem("crm_user");
    if (!raw) return null;
    return JSON.parse(raw) as CRMUserLite;
  } catch {
    return null;
  }
}

function isExecutionUser(user?: CRMUserLite | null) {
  const role = String(user?.role || "").toLowerCase();
  const name = normalizePersonName(user?.name);
  return role === "exec" || role.includes("실행") || EXECUTION_PART_NAMES.some((item) => normalizePersonName(item) === name);
}

function isOperationUser(user?: CRMUserLite | null) {
  const role = String(user?.role || "").toLowerCase();
  const name = normalizePersonName(user?.name);
  return role === "ops" || role.includes("운영") || OPERATION_PART_NAMES.some((item) => normalizePersonName(item) === name);
}

function isAdminUser(user?: CRMUserLite | null) {
  const role = String(user?.role || "").toLowerCase();
  const name = normalizePersonName(user?.name);
  return role === "admin" || ADMIN_NAMES.some((item) => normalizePersonName(item) === name);
}

function contactOwner(row: Pick<ContactRow, "assigned_to" | "consultant">) {
  return row.assigned_to || row.consultant || "미지정";
}

function rowMatchesOwner(row: Pick<ContactRow, "assigned_to" | "consultant">, owner: string) {
  if (!owner || owner === "전체") return true;
  const target = normalizePersonName(owner);
  return normalizePersonName(row.assigned_to) === target || normalizePersonName(row.consultant) === target;
}

type SalesOwnerLookup = {
  byName: Map<string, string>;
  byNumber: Map<string, string>;
};

function isCompanyManagerName(value?: string | null) {
  const text = normalizeText(value);
  return text === "주식회사광고인" || text === "광고인" || text.includes("주식회사광고인");
}

function buildSalesOwnerLookup(contacts: ContactRow[]): SalesOwnerLookup {
  const byName = new Map<string, string>();
  const byNumber = new Map<string, string>();

  contacts.forEach((contact) => {
    const owner = (contact.assigned_to || contact.consultant || "").trim();
    if (!owner) return;

    const nameKey = normalizeText(contact.name);
    const numberKey = normalizeText(contact.bunyanghoe_number);

    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, owner);
    if (numberKey && !byNumber.has(numberKey)) byNumber.set(numberKey, owner);
  });

  return { byName, byNumber };
}

function resolveSalesOwner(row: SalesRow, lookup?: SalesOwnerLookup) {
  const directOwner = String(row.team_member || "").trim();

  // 통합매출관리와 동일하게, 담당자가 실제 담당자명으로 들어온 경우에는 그 값을 우선 사용합니다.
  if (directOwner && !isCompanyManagerName(directOwner)) return directOwner;

  // 사이다페이/효성CMS에서 담당자가 "주식회사 광고인"으로 들어온 경우,
  // 분양회 입회자/contacts의 회원번호 또는 고객명으로 실제 assigned_to 담당자를 매칭합니다.
  const numberOwner = lookup?.byNumber.get(normalizeText(row.bunyanghoe_number));
  if (numberOwner) return numberOwner;

  const nameOwner = lookup?.byName.get(normalizeText(row.member_name));
  if (nameOwner) return nameOwner;

  const fallbackOwner = String(row.consultant || "").trim();
  if (fallbackOwner && !/^\d{7,}$/.test(normalizeText(fallbackOwner))) return fallbackOwner;

  return directOwner || fallbackOwner || "미지정";
}

function salesMatchesOwner(row: SalesRow, owner: string, lookup?: SalesOwnerLookup) {
  if (!owner || owner === "전체") return true;
  const target = normalizePersonName(owner);
  return normalizePersonName(resolveSalesOwner(row, lookup)) === target;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = String(value).length === 10 ? `${value}T00:00:00` : String(value);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthWindow(key: string) {
  const [year, month] = key.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end, year, month };
}

function isInMonth(value: string | null | undefined, selectedMonth: string) {
  const date = parseDate(value);
  if (!date) return false;
  const { start, end } = getMonthWindow(selectedMonth);
  return date >= start && date < end;
}

type FilterMode = "daily" | "weekly" | "monthly";

function getMonthWeeks(year: number, month: number): { week: number; start: Date; end: Date; label: string }[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks: { week: number; start: Date; end: Date; label: string }[] = [];
  let weekStart = new Date(firstDay);
  let weekNum = 1;

  while (weekStart <= lastDay) {
    const dow = weekStart.getDay();
    const daysToSun = dow === 0 ? 0 : 7 - dow;
    let weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + daysToSun);
    if (weekEnd > lastDay) weekEnd = new Date(lastDay);
    weekEnd.setHours(23, 59, 59, 999);

    const s = new Date(weekStart); s.setHours(0, 0, 0, 0);
    weeks.push({
      week: weekNum,
      start: s,
      end: weekEnd,
      label: `${weekNum}주차 (${s.getDate()}일~${weekEnd.getDate()}일)`,
    });

    weekNum++;
    const nextMon = new Date(weekEnd);
    nextMon.setDate(weekEnd.getDate() + 1);
    nextMon.setHours(0, 0, 0, 0);
    weekStart = nextMon;
  }
  return weeks;
}

function getCurrentWeekNum(year: number, month: number): number {
  const weeks = getMonthWeeks(year, month);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  for (const w of weeks) {
    if (today >= w.start && today <= w.end) return w.week;
  }
  return weeks.length;
}

function getFilterRange(mode: FilterMode, monthNum: number, year: number, weekNum?: number): { start: Date; end: Date } {
  if (mode === "daily") {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const e = new Date(d); e.setHours(23, 59, 59, 999);
    return { start: d, end: e };
  }
  if (mode === "weekly") {
    const weeks = getMonthWeeks(year, monthNum);
    const target = weeks.find((w) => w.week === (weekNum || 1)) || weeks[0];
    return { start: target.start, end: target.end };
  }
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { start, end };
}

function isInRange(value: string | null | undefined, start: Date, end: Date) {
  const date = parseDate(value);
  if (!date) return false;
  return date >= start && date <= end;
}

const FILTER_MODE_LABELS: Record<FilterMode, string> = { daily: "당일", weekly: "주간", monthly: "월간" };
const MONTH_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function daysBetween(from?: string | null, to = new Date()) {
  const date = parseDate(from);
  if (!date) return null;
  return Math.floor((to.getTime() - date.getTime()) / 86_400_000);
}

function money(value?: number | null) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 1)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

function moneyFull(value?: number | null) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(date);
}

function formatDateTime(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function timeAgo(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "-";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 30) return `${day}일 전`;
  return formatDate(value);
}

function effectiveSales(row: SalesRow) {
  // 통합매출관리 기준과 동일하게 집행금액에서 환불금액을 그대로 차감합니다.
  // 환불 행은 execution_amount=0, refund_amount=금액 형태로 들어올 수 있으므로 Math.max(..., 0)을 사용하지 않습니다.
  const execution = Number(row.execution_amount || 0);
  const refund = Number(row.refund_amount || 0);
  return execution - refund;
}

function refundSales(row: SalesRow) {
  return Number(row.refund_amount || 0);
}

function salesCategory(row: SalesRow): "membership" | "lms" | "hogang" | "linked" | "other" {
  const channel = normalizeText(row.channel);
  const route = normalizeText(row.contract_route);
  const item = normalizeText(row.payment_item || row.payment_type || row.item_name || row.memo);

  if (route.includes("연계매출") || route.includes("하이타겟")) return "linked";
  if (route.includes("LMS") || channel.includes("LMS") || item.includes("LMS")) return "lms";
  if (route.includes("호갱노노") || channel.includes("호갱노노") || item.includes("호갱노노")) return "hogang";
  if (
    route.includes("분양회") ||
    channel.includes("효성CMS") ||
    channel.includes("사이다페이") ||
    item.includes("분양회") ||
    item.includes("월회비") ||
    item.includes("회비")
  ) {
    return "membership";
  }
  return "other";
}

function normalizePaymentItem(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw || normalizeText(raw) === normalizeText("분양회")) return "분양회 회비";
  return raw;
}

function isMembershipFeeSales(row: SalesRow) {
  const route = normalizeText(normalizePaymentItem(row.contract_route));
  const item = normalizeText(normalizePaymentItem(row.payment_item || row.payment_type || row.item_name || row.memo));
  const target = normalizeText("분양회 회비");

  // 통합매출관리의 결제항목이 '분양회 회비'인 데이터만 담당자별 파이프라인 매출에 반영합니다.
  // 기존 데이터가 '분양회'로 저장된 경우도 통합매출관리 화면과 동일하게 '분양회 회비'로 간주합니다.
  return route === target || item === target;
}

function pipelineMembershipSalesAmount(row: SalesRow) {
  // 당월 담당자별 파이프라인 현황의 매출은 통합매출관리 화면 기준으로 맞춥니다.
  // 담당자 + 결제일 + 결제항목(분양회 회비) + 집행금액 - 환불금액입니다.
  // 환불 행은 execution_amount=0, refund_amount=금액 형태로 들어올 수 있으므로 마이너스 차감해야 합니다.
  return Number(row.execution_amount || 0) - Number(row.refund_amount || 0);
}

const VIP_DB_SOURCE = "vip_activity";
const CUSTOMER_DB_SOURCE = "customer_db";

function isVipContact(contact: ContactRow) {
  return normalizeText(contact.crm_db_source) === "vip_activity";
}

function isHighValueContact(contact: ContactRow) {
  const grade = normalizeText(contact.customer_grade);
  return HIGH_VALUE_GRADES.some((token) => grade.includes(normalizeText(token)));
}

function isCoreVipGrade(contact: ContactRow) {
  const grade = normalizeText(contact.customer_grade);
  return CORE_VIP_GRADES.some((token) => grade.includes(normalizeText(token)));
}

function isGradeContact(contact: ContactRow, gradeName: string) {
  return normalizeText(contact.customer_grade).includes(normalizeText(gradeName));
}

function isContractedInMonth(contact: ContactRow, start: Date, end: Date) {
  // 대시보드 계약 건수는 파이프라인 리텐션 구간 + 고객 상세패널의 계약완료일 기준으로만 집계합니다.
  // vip_transferred_at, updated_at, created_at 기준으로 대체 집계하지 않습니다.
  return normalizeText(contact.management_stage) === normalizeText("리텐션") && isInRange(contact.contract_date, start, end);
}

function touchedInMonth(contact: ContactRow, start: Date, end: Date) {
  return isInRange(contact.vip_transferred_at, start, end) || isInRange(contact.updated_at, start, end) || isInRange(contact.created_at, start, end);
}

function isContracted(contact: ContactRow) {
  return normalizeText(contact.meeting_result) === normalizeText("계약완료") || normalizeText(contact.management_stage) === normalizeText("리텐션");
}

function isChurned(contact: ContactRow) {
  const stage = normalizeText(contact.management_stage);
  const result = normalizeText(contact.meeting_result);
  return stage.includes("이탈") || stage.includes("탈퇴") || result === normalizeText("계약거부") || result === normalizeText("미팅불발");
}

function latestActivityDate(contact: ContactRow, notesByContact: Map<string, NoteRow[]>) {
  const notes = notesByContact.get(String(contact.id)) || [];
  const latestNote = notes
    .map((note) => note.created_at || note.note_date)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0];
  // 활동노트가 있으면 노트 기준, 없으면 VIP 이관일 → 등록일 순으로 fallback
  // (updated_at은 DB 수정 시 갱신되므로 제외)
  return latestNote || contact.vip_transferred_at || contact.created_at || null;
}

function hasFirstTouch(contact: ContactRow, notesByContact: Map<string, NoteRow[]>, start: Date, end: Date) {
  const activity = normalizeText(contact.activity_type);
  const notes = notesByContact.get(String(contact.id)) || [];
  const hasTypedNote = notes.some((note) => {
    const content = normalizeText(note.content);
    const inMonth = isInRange(note.created_at || note.note_date, start, end);
    return inMonth && (content.includes("TM") || content.includes("콜드톡") || content.includes("활동완료") || content.includes("녹취"));
  });
  return (
    activity.includes("TM") ||
    activity.includes("콜드톡") ||
    Boolean(contact.has_tm) ||
    isInRange(contact.tm_date, start, end) ||
    hasTypedNote
  );
}

function parsePaymentDay(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/\d+/);
  if (!match) return null;
  const day = Number(match[0]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return day;
}

function getNextPaymentInfo(day: number, now = TODAY) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  let due = new Date(year, month, Math.min(day, lastDayThisMonth), 0, 0, 0, 0);

  const todayOnly = new Date(year, month, now.getDate(), 0, 0, 0, 0);
  if (due < todayOnly) {
    const nextLast = new Date(year, month + 2, 0).getDate();
    due = new Date(year, month + 1, Math.min(day, nextLast), 0, 0, 0, 0);
  }

  const diff = Math.round((due.getTime() - todayOnly.getTime()) / 86_400_000);
  return { due, diff };
}

function ddayLabel(diff: number) {
  if (diff === 0) return "D-DAY";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function paymentLabel(contact: ContactRow) {
  const channel = contact.payment_channel || "결제채널 미입력";
  const day = parsePaymentDay(contact.regular_payment_date);
  return `${channel} · ${day ? `매월 ${day}일` : "결제일 미입력"}`;
}

function monthOptions() {
  const base = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - 4 + index, 1);
    return { key: monthKey(date), label: MONTH_LABEL_FORMAT.format(date) };
  }).reverse();
}

function toneStyle(tone: ToneName) {
  const map: Record<ToneName, { bg: string; text: string; border: string; dot: string; bar: string }> = {
    info: { bg: "var(--info-bg)", text: "var(--info-text)", border: "var(--info-border)", dot: "var(--info)", bar: "linear-gradient(90deg,#60A5FA,#22D3EE)" },
    success: { bg: "var(--success-bg)", text: "var(--success-text)", border: "var(--success-border)", dot: "var(--success)", bar: "linear-gradient(90deg,#34D399,#22D3EE)" },
    warning: { bg: "var(--warning-bg)", text: "var(--warning-text)", border: "var(--warning-border)", dot: "var(--warning)", bar: "linear-gradient(90deg,#FBBF24,#FB7185)" },
    danger: { bg: "var(--danger-bg)", text: "var(--danger-text)", border: "var(--danger-border)", dot: "var(--danger)", bar: "linear-gradient(90deg,#FB7185,#F43F5E)" },
    purple: { bg: "var(--purple-bg)", text: "var(--purple-text)", border: "var(--purple-border)", dot: "var(--purple)", bar: "linear-gradient(90deg,#8B7CF6,#60A5FA)" },
    cyan: { bg: "var(--cyan-bg)", text: "var(--cyan-text)", border: "var(--cyan-border)", dot: "var(--cyan)", bar: "linear-gradient(90deg,#22D3EE,#34D399)" },
    muted: { bg: "var(--surface-3)", text: "var(--text-subtle)", border: "var(--border)", dot: "var(--text-faint)", bar: "linear-gradient(90deg,var(--text-faint),var(--border))" },
  };
  return map[tone];
}

/* ─────────────────────────────────────────────────────────────
 * 통일 디자인 시스템 (전 카드 공통 규격)
 *  - 카드 헤더: px-4 py-3 / 타이틀 14px tracking-[-0.01em] / 설명 12px
 *  - 메인 숫자: 20~22px tracking-[-0.02em] / 라벨 11px · 서브 12px
 *  - 서브카드: rounded-[12px] p-3 surface-2 / 그리드 갭: 외부 gap-4 · 내부 gap-2.5
 * ───────────────────────────────────────────────────────────── */

type DashboardActionItem = ActionItem & { contactId: number };

function Badge({ children, tone = "muted", icon: Icon }: { children: ReactNode; tone?: ToneName; icon?: ElementType }) {
  const c = toneStyle(tone);
  return (
    <span
      className="inline-flex min-h-[22px] items-center gap-1 rounded-[7px] px-2 text-[12px] font-normal tracking-[-0.01em]"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {Icon ? <Icon size={11} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
      {children}
    </span>
  );
}

function IconBox({ icon: Icon, tone = "info", size = "md" }: { icon: ElementType; tone?: ToneName; size?: "sm" | "md" }) {
  const c = toneStyle(tone);
  const cls = size === "sm" ? "h-7 w-7 rounded-[9px]" : "h-9 w-9 rounded-[11px]";
  return (
    <div className={`inline-flex shrink-0 items-center justify-center ${cls}`} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <Icon size={size === "sm" ? 13 : 16} />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`premium-card overflow-hidden ${className}`}>{children}</section>;
}

function PanelTitle({ icon, tone, title, desc, right }: { icon: ElementType; tone: ToneName; title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <IconBox icon={icon} tone={tone} size="sm" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{title}</p>
          {desc && <p className="mt-0.5 truncate text-[13px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function StatBox({ label, value, sub, tone = "muted" }: { label: string; value: number | string; sub?: string; tone?: ToneName }) {
  const c = toneStyle(tone);
  return (
    <div className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
      <p className="truncate text-[12px] font-normal tracking-[-0.01em]" style={{ color: c.text }}>{label}</p>
      <p className="mt-1.5 truncate text-[22px] font-semibold leading-none tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-1 truncate text-[13px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, total, tone = "info" }: { value: number; total: number; tone?: ToneName }) {
  const c = toneStyle(tone);
  const width = Math.min(100, percent(value, total || value || 1));
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: c.bar }} />
    </div>
  );
}

function EmptyBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center p-5 text-center">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>
        <FileText size={15} />
      </div>
      <p className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{title}</p>
      <p className="mt-1 text-[13px] font-medium leading-relaxed whitespace-nowrap" style={{ color: "var(--text-subtle)" }}>{desc}</p>
    </div>
  );
}

/** 퍼널 박스 (전체 폭 균등 분배 · 세로 확장 · 텍스트 확대) */
function FunnelBox({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: ToneName }) {
  const c = toneStyle(tone);
  return (
    <div className="min-w-0 flex-1 rounded-[12px] border px-4 py-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.dot }} />
        <p className="truncate text-[13px] font-normal tracking-[-0.01em]" style={{ color: c.text }}>{label}</p>
      </div>
      <p className="mt-2.5 text-[26px] font-semibold leading-none tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
        {value.toLocaleString()}<span className="ml-0.5 text-[14px] font-semibold" style={{ color: "var(--text-subtle)" }}>건</span>
      </p>
      <p className="mt-2 truncate text-[13px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

/** 퍼널 커넥터 (고정 폭 + 양쪽 마진으로 박스와 간격 확보) */
function FunnelConnector({ rate }: { rate: number | null | undefined }) {
  return (
    <div className="mx-3 flex w-[66px] shrink-0 items-center justify-center">
      {rate !== null && rate !== undefined ? (
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold tabular-nums tracking-[-0.01em]"
          style={{ background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}
        >
          {rate}%<ArrowRight size={12} />
        </span>
      ) : (
        <ArrowRight size={14} style={{ color: "var(--text-faint)" }} />
      )}
    </div>
  );
}

export default function HomePage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [me, setMe] = useState<CRMUserLite | null>(() => {
    // 초기 렌더 시점에 localStorage에서 바로 읽어 fixedOwner/activeOwner가 즉시 올바르게 계산됨
    try { return readUserFromStorage(); } catch { return null; }
  });
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [filterMode, setFilterMode] = useState<FilterMode>("monthly");
  const [filterMonthNum, setFilterMonthNum] = useState(new Date().getMonth() + 1);
  const [filterWeekNum, setFilterWeekNum] = useState(() => getCurrentWeekNum(new Date().getFullYear(), new Date().getMonth() + 1));
  const [filterYear] = useState(new Date().getFullYear());
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    // 실행파트/운영파트 담당자면 초기 렌더부터 본인 이름으로 고정
    try {
      const u = readUserFromStorage();
      if (isExecutionUser(u) || isOperationUser(u)) return u?.name || "전체";
    } catch {}
    return "전체";
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /* 일별활동기록 (당일 목표/달성 + 특발성활동목표) */
  type DailyGoalRow = {
    id: number;
    owner_name: string;
    goal_new_tm: number; result_new_tm: number;
    goal_coldtalk: number; result_coldtalk: number;
    goal_consultant_db: number; result_consultant_db: number;
    goal_second_touch: number; result_second_touch: number;
    goal_work_items: { id: string; text: string; done: boolean }[] | null;
    is_outside_meeting?: boolean | null;
  };
  const [dailyGoal, setDailyGoal] = useState<DailyGoalRow | null>(null);
  const [allDailyGoals, setAllDailyGoals] = useState<(DailyGoalRow & { owner_name: string })[]>([]);
  const [expandedDailyMember, setExpandedDailyMember] = useState<string | null>(null);

  /* 고객 즉시수정 팝업 상태 (파이프라인3 contacts 테이블과 동일 소스 → 자동 연동) */
  const [editTarget, setEditTarget] = useState<ContactRow | null>(null);
  const [editIssue, setEditIssue] = useState("");
  const [editForm, setEditForm] = useState({ name: "", title: "", phone: "", management_stage: "", payment_channel: "", regular_payment_date: "", memo: "", sensitivity: "" });
  const [quickNote, setQuickNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [popupMode, setPopupMode] = useState<"payment_missing" | "inactive" | "closing" | "db_inactive" | "view_only">("view_only");
  const [showVipTransfer, setShowVipTransfer] = useState(false); // 고객DB 팝업 VIP이관 섹션 토글

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const currentUser = readUserFromStorage();
    setMe(currentUser);

    if (isExecutionUser(currentUser)) {
      setOwnerFilter(currentUser?.name || "전체");
    }

    const { year, month } = getMonthWindow(selectedMonth);

    // 실행파트/운영파트 담당자면 Supabase 쿼리 자체에 본인 필터 적용
    const isPersonalUser = (isExecutionUser(currentUser) || isOperationUser(currentUser)) && !isAdminUser(currentUser);
    const personalName = isPersonalUser ? (currentUser?.name || "") : null;

    try {
      let customerDbQuery = supabase.from("contacts").select("*").eq("crm_db_source", "customer_db").order("created_at", { ascending: false });
      let vipQuery = supabase.from("contacts").select("*").eq("crm_db_source", "vip_activity").order("created_at", { ascending: false });
      let salesQuery = supabase.from("ad_executions").select("*").order("created_at", { ascending: false }).limit(5000);

      if (personalName) {
        // 실행파트/운영파트 본인 계정에서도 「당월 담당자별 파이프라인 현황」은
        // 관리자 뷰처럼 전체 실행파트 데이터를 보여줘야 합니다.
        // 그래서 contacts/ad_executions는 Supabase에서 전체 로드하고,
        // 개인 대시보드용 카드/퍼널/알림은 아래 visibleContacts/visibleSales에서
        // activeOwner 기준으로 다시 필터링합니다.
      }

      const [customerDbRes, vipRes, noteRes, salesRes, kpiRes] = await Promise.all([
        customerDbQuery,
        vipQuery,
        supabase.from("contact_notes").select("*").order("created_at", { ascending: false }).limit(5000),
        salesQuery,
        supabase.from("kpi_settings").select("*").eq("year", year).eq("month", month).eq("week", 0),
      ]);

      if (customerDbRes.error) throw customerDbRes.error;
      if (vipRes.error) throw vipRes.error;
      if (noteRes.error) console.warn("contact_notes:", noteRes.error.message);
      if (salesRes.error) console.warn("ad_executions:", salesRes.error.message);
      if (kpiRes.error) console.warn("kpi_settings:", kpiRes.error.message);

      const allContacts = [...((customerDbRes.data || []) as unknown as ContactRow[]), ...((vipRes.data || []) as unknown as ContactRow[])];
      setContacts(allContacts);

      /* 당일 일별활동 목표/달성 */
      const _now = new Date();
      const todayKey = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
      const dagUserName = currentUser?.name || "";
      try {
        const { data: dagRows, error: dagError } = await supabase
          .from("daily_activity_goals")
          .select("*")
          .eq("work_date", todayKey);
        if (dagError) {
          console.warn("daily_activity_goals 조회 실패:", dagError.message);
        } else {
          const myRow = (dagRows || []).find((r: any) => r.owner_name === dagUserName);
          setDailyGoal((myRow as DailyGoalRow) || null);
          if (!myRow && dagUserName) {
            console.info(`[대시보드] ${todayKey} / ${dagUserName} 일별활동 데이터 없음. 전체 ${(dagRows || []).length}건 조회됨.`);
          }
          if (isAdminUser(currentUser)) {
            const execRows = (dagRows || []).filter((r: any) =>
              EXECUTION_PART_NAMES.some((name) => normalizePersonName(name) === normalizePersonName(r.owner_name))
            );
            setAllDailyGoals(execRows);
          }
        }
      } catch (dagErr) {
        console.warn("daily_activity_goals 예외:", dagErr);
      }
      setNotes(((noteRes.data || []) as unknown) as NoteRow[]);
      setSales(((salesRes.data || []) as unknown) as SalesRow[]);
      setKpis(((kpiRes.data || []) as unknown) as KpiRow[]);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "대시보드 데이터를 불러오지 못했습니다.");
      setContacts([]);
      setNotes([]);
      setSales([]);
      setKpis([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* 필터 범위 계산 */
  const filterRange = useMemo(() => getFilterRange(filterMode, filterMonthNum, filterYear, filterWeekNum), [filterMode, filterMonthNum, filterYear, filterWeekNum]);
  const monthWeeks = useMemo(() => getMonthWeeks(filterYear, filterMonthNum), [filterYear, filterMonthNum]);
  const rangeStart = filterRange.start;
  const rangeEnd = filterRange.end;

  useEffect(() => {
    if (filterMode === "monthly") {
      setSelectedMonth(`${filterYear}-${String(filterMonthNum).padStart(2, "0")}`);
    } else {
      setSelectedMonth(monthKey(new Date()));
    }
  }, [filterMode, filterMonthNum, filterYear]);

  const openCustomerEdit = useCallback((contactId: number, issue: string) => {
    const target = contacts.find((row) => Number(row.id) === Number(contactId));
    if (!target) return;
    setEditTarget(target);
    setEditIssue(issue);
    setQuickNote("");
    setEditForm({
      name: target.name || "",
      title: target.title || "",
      phone: target.phone || "",
      management_stage: target.management_stage || "",
      payment_channel: target.payment_channel || "",
      regular_payment_date: target.regular_payment_date || "",
      memo: target.memo || "",
      sensitivity: "",
    });
    // 팝업 모드 결정
    if (issue.includes("결제") && issue.includes("D")) {
      setPopupMode("view_only"); // 결제임박: 알림만
    } else if (issue.includes("결제정보 누락") || issue.includes("결제누락")) {
      setPopupMode("payment_missing"); // 결제정보 입력 팝업
    } else if (issue.includes("재TM") || issue.includes("고객DB")) {
      setPopupMode("db_inactive"); // 고객DB 장기미활동 → 활동노트 + 감도
    } else if (issue.includes("클로징")) {
      setPopupMode("closing"); // 클로징지연 → 활동노트 + 단계전환
    } else {
      setPopupMode("inactive"); // 장기미활동(VIP) → 활동노트 + 단계전환 + 계약전환
    }
  }, [contacts]);

  const saveCustomerEdit = useCallback(async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const now = new Date().toISOString();
      const payload: Record<string, any> = {
        updated_at: now,
      };

      // 결제정보 누락 팝업: 결제정보만 저장
      if (popupMode === "payment_missing") {
        payload.payment_channel = editForm.payment_channel.trim() || null;
        payload.regular_payment_date = editForm.regular_payment_date.trim() || null;
      }
      // VIP이관 처리 (고객DB → VIP활동DB)
      if (popupMode === "db_inactive" && showVipTransfer) {
        const now2 = new Date().toISOString();
        payload.crm_db_source = "vip_activity";
        payload.vip_transferred_at = now2;
        payload.management_stage = "리드";
        payload.customer_grade = "심사미진행";
        // 활동노트도 함께 저장 (아래 공통 처리에서)
      }
      // 활동노트 팝업 (장기미활동/클로징지연): 관리구간 + 결제정보 저장
      else if (popupMode === "inactive" || popupMode === "closing" || popupMode === "db_inactive") {
        if (editForm.management_stage) payload.management_stage = editForm.management_stage;
        if (editForm.payment_channel) payload.payment_channel = editForm.payment_channel.trim();
        if (editForm.regular_payment_date) payload.regular_payment_date = editForm.regular_payment_date.trim();
        // 고객DB 감도: memo에 태그 형태로 저장
        if (popupMode === "db_inactive" && editForm.sensitivity) {
          const baseMemo = (editForm.memo || "")
            .replace(/\[고객감도:.*?\]/g, "")
            .replace(/\[재TM일:.*?\]/g, "")
            .trim();
          const today = toDateKey(new Date());
          let newMemo = baseMemo;
          newMemo += `
[고객감도: ${editForm.sensitivity}]`;
          if (editForm.sensitivity === "재TM진행") newMemo += `
[재TM일: ${today}]`;
          payload.memo = newMemo.trim();
        }
      }

      const { error } = await supabase.from("contacts").update(payload).eq("id", editTarget.id);
      if (error) throw error;

      // 계약전환 시 결제정보 함께 저장
      if (editForm.management_stage === "리텐션") {
        const contractPayload: Record<string, any> = {
          meeting_result: "계약완료",
          contract_date: toDateKey(new Date()),
          updated_at: now,
        };
        if (editForm.payment_channel) contractPayload.payment_channel = editForm.payment_channel;
        if (editForm.regular_payment_date) contractPayload.regular_payment_date = editForm.regular_payment_date;
        await supabase.from("contacts").update(contractPayload).eq("id", editTarget.id);
      }

      // 활동노트 저장
      if (quickNote.trim()) {
        const { error: noteError } = await supabase.from("contact_notes").insert({
          contact_id: editTarget.id,
          content: quickNote.trim(),
          note_date: toDateKey(new Date()),
          author: me?.name || null,
        });
        if (noteError) console.warn("contact_notes insert:", noteError.message);
      }

      setEditTarget(null);
      setQuickNote("");
      setShowVipTransfer(false);
      await fetchDashboard();
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "고객 정보를 저장하지 못했습니다.");
    } finally {
      setSavingEdit(false);
    }
  }, [editForm, editTarget, fetchDashboard, me?.name, popupMode, quickNote]);

  const fixedOwner = isExecutionUser(me) || isOperationUser(me);
  const activeOwner = fixedOwner ? me?.name || "전체" : ownerFilter;

  const notesByContact = useMemo(() => {
    const map = new Map<string, NoteRow[]>();
    // visibleContacts id 기준으로만 노트 매핑 (다른 담당자 노트 배제)
    const visibleIds = new Set(contacts.map((c) => String(c.id)));
    notes.forEach((note) => {
      const key = String(note.contact_id);
      if (!visibleIds.has(key)) return; // 본인 담당 contacts에 속하지 않는 노트 제외
      const list = map.get(key) || [];
      list.push(note);
      map.set(key, list);
    });
    map.forEach((list) => {
      list.sort((a, b) => new Date(String(b.created_at || b.note_date || 0)).getTime() - new Date(String(a.created_at || a.note_date || 0)).getTime());
    });
    return map;
  }, [notes, contacts]);

  const visibleContacts = useMemo(() => {
    return contacts.filter((contact) => rowMatchesOwner(contact, activeOwner));
  }, [contacts, activeOwner]);

  const salesOwnerLookup = useMemo(() => buildSalesOwnerLookup(contacts), [contacts]);

  const customerDbContacts = useMemo(() => {
    return visibleContacts.filter((contact) => normalizeText(contact.crm_db_source) === "customer_db");
  }, [visibleContacts]);

  const monthCustomerDb = useMemo(() => {
    return customerDbContacts.filter((contact) => isInRange(contact.created_at, rangeStart, rangeEnd));
  }, [customerDbContacts, rangeStart, rangeEnd]);

  const visibleSales = useMemo(() => {
    return sales.filter((row) => salesMatchesOwner(row, activeOwner, salesOwnerLookup));
  }, [sales, activeOwner, salesOwnerLookup]);

  const monthContacts = useMemo(() => {
    return visibleContacts.filter((contact) => isInRange(contact.created_at, rangeStart, rangeEnd));
  }, [visibleContacts, rangeStart, rangeEnd]);

  const monthSales = useMemo(() => {
    // 통합매출관리 기준과 동일하게 결제일(payment_date)만으로 기간 매칭합니다.
    return visibleSales.filter((row) => isInRange(row.payment_date, rangeStart, rangeEnd));
  }, [visibleSales, rangeStart, rangeEnd]);

  const monthNotes = useMemo(() => {
    const visibleIds = new Set(visibleContacts.map((contact) => String(contact.id)));
    return notes.filter((note) => visibleIds.has(String(note.contact_id)) && isInRange(note.created_at || note.note_date, rangeStart, rangeEnd));
  }, [notes, visibleContacts, rangeStart, rangeEnd]);

  // 누적 전체 VIP (오늘 챙겨야 할 고객, 정기결제 D-DAY, 담당자별 파이프라인용)
  const vipContacts = useMemo(() => visibleContacts.filter(isVipContact), [visibleContacts]);

  // 기간 내 이관된 VIP (vip_transferred_at 기준 — 퍼널 통계용)
  const periodVipContacts = useMemo(() => {
    return vipContacts.filter((contact) => isInRange(contact.vip_transferred_at, rangeStart, rangeEnd));
  }, [vipContacts, rangeStart, rangeEnd]);

  const stats = useMemo(() => {
    /* 고객DB 기반 (기간 내 신규 업로드) */
    const firstTouch = monthCustomerDb.filter((contact) => hasFirstTouch(contact, notesByContact, rangeStart, rangeEnd)).length;
    const tmCount = monthCustomerDb.filter((contact) => {
      const activity = normalizeText(contact.activity_type);
      return activity.includes("TM") || Boolean(contact.has_tm) || isInRange(contact.tm_date, rangeStart, rangeEnd);
    }).length;
    const coldTalkCount = monthCustomerDb.filter((contact) => normalizeText(contact.activity_type).includes("콜드톡")).length;

    /* VIP 기반 — 기간 내 이관 기준 (vip_transferred_at) */
    const vipTransferred = periodVipContacts.length;
    const master = periodVipContacts.filter((contact) => isGradeContact(contact, "마스터")).length;
    const challenger = periodVipContacts.filter((contact) => isGradeContact(contact, "챌린저")).length;
    const bronze = periodVipContacts.filter((contact) => isGradeContact(contact, "브론즈")).length;
    const graded = master + challenger + bronze;
    const masterThisMonth = master;
    const challengerThisMonth = challenger;
    const bronzeThisMonth = bronze;
    // 계약·리텐션은 VIP 이관일이 아니라 파이프라인 리텐션 구간 + 계약완료일 기준으로 집계합니다.
    const periodContractedRetention = vipContacts.filter((contact) => isContractedInMonth(contact, rangeStart, rangeEnd));
    const contracts = periodContractedRetention.length;

    /* 매출 (기간 내) */
    const membershipSales = monthSales.filter((row) => salesCategory(row) === "membership").reduce((sum, row) => sum + effectiveSales(row), 0);
    const lmsSales = monthSales.filter((row) => salesCategory(row) === "lms").reduce((sum, row) => sum + effectiveSales(row), 0);
    const hogangSales = monthSales.filter((row) => salesCategory(row) === "hogang").reduce((sum, row) => sum + effectiveSales(row), 0);
    const refund = monthSales.reduce((sum, row) => sum + refundSales(row), 0);
    const totalSales = monthSales.reduce((sum, row) => sum + effectiveSales(row), 0);

    /* 파이프라인 단계별 — 누적 기준 (전체 vipContacts) */
    const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = vipContacts.filter((contact) => normalizeText(contact.management_stage) === normalizeText(stage)).length;
      return acc;
    }, {} as Record<string, number>);

    // 계약·리텐션 — 파이프라인 리텐션 구간 + 고객 상세패널 계약완료일 기준
    const retention = periodContractedRetention.length;
    const churnCount = periodVipContacts.filter((contact) =>
      normalizeText(contact.management_stage).includes("이탈") ||
      normalizeText(contact.management_stage).includes("탈퇴")
    ).length;
    const churnRate = percent(churnCount, Math.max(periodVipContacts.length, 1));
    const activePipeline = (stageCounts["리드"] || 0) + (stageCounts["프로스펙팅"] || 0) + (stageCounts["딜클로징"] || 0);
    const contractRate = percent(retention, Math.max(periodVipContacts.length, 1));

    return {
      firstTouch, tmCount, coldTalkCount, vipTransferred, graded,
      master, challenger, bronze,
      masterThisMonth, challengerThisMonth, bronzeThisMonth,
      contracts, churnCount, churnRate,
      membershipSales, lmsSales, hogangSales, refund, totalSales,
      stageCounts, retention, activePipeline, contractRate,
      vipTotal: periodVipContacts.length,
    };
  }, [monthCustomerDb, monthSales, notesByContact, periodVipContacts, rangeStart, rangeEnd, vipContacts]);

  /* 당월 영업 퍼널: 4단계 */
  const funnelStages = useMemo(() => {
    return [
      { label: "고객DB 신규", value: monthCustomerDb.length, sub: "기간 내 업로드 DB", tone: "info" as ToneName, rate: percent(stats.firstTouch, monthCustomerDb.length) },
      { label: "첫접촉 완료", value: stats.firstTouch, sub: `TM ${stats.tmCount} · 콜드톡 ${stats.coldTalkCount}`, tone: "cyan" as ToneName, rate: percent(stats.vipTransferred, Math.max(stats.firstTouch, 1)) },
      { label: "VIP 전체", value: stats.vipTotal, sub: `마스터 ${stats.master} · 챌린저 ${stats.challenger} · 브론즈 ${stats.bronze}`, tone: "purple" as ToneName, rate: percent(stats.graded, Math.max(stats.vipTotal, 1)) },
      { label: "계약 · 리텐션", value: stats.retention, sub: `기간 내 신규계약 ${stats.contracts}건`, tone: "success" as ToneName, rate: null, isLast: true },
    ];
  }, [monthCustomerDb.length, stats]);

  /* 오늘 챙겨야 할 고객 (크리티컬 통합 리스트) */
  const { actionItems, criticalCounts } = useMemo(() => {
    const items: DashboardActionItem[] = [];
    const counts = { payment: 0, missing: 0, inactive: 0, closing: 0 };

    // ── 1. 결제임박: 파이프라인(vipContacts) 중 결제일 등록 + D-4 이내 ──
    vipContacts.forEach((contact) => {
      const contactId = Number(contact.id);
      const day = parsePaymentDay(contact.regular_payment_date);
      if (isContracted(contact) && day) {
        const { diff } = getNextPaymentInfo(day);
        if (diff >= 0 && diff <= 4) {
          counts.payment += 1;
          items.push({
            key: `pay-${contact.id}`,
            type: `결제 ${ddayLabel(diff)}`,
            tone: diff === 0 ? "danger" : "warning",
            title: contact.name || "고객명 없음",
            desc: paymentLabel(contact),
            href: "/pipeline3",
            priority: diff,
            contactId,
          });
        }
      }
    });

    // ── 2. 결제누락: 파이프라인(vipContacts) 중 계약완료인데 결제정보 없는 고객 ──
    vipContacts.forEach((contact) => {
      const contactId = Number(contact.id);
      if (isContracted(contact) && (!contact.payment_channel || !parsePaymentDay(contact.regular_payment_date))) {
        counts.missing += 1;
        items.push({
          key: `missing-payment-${contact.id}`,
          type: "결제정보 누락",
          tone: "danger",
          title: contact.name || "고객명 없음",
          desc: "결제채널 또는 결제일이 비어 있습니다. 클릭해 바로 입력하세요.",
          href: "/pipeline3",
          priority: 100,
          contactId,
        });
      }
    });

    // ── 3. 장기미활동 (고객DB): 재TM 예정일(등록일+영업일3일)이 오늘 이하인 고객 ──
    // [재TM일: YYYY-MM-DD] = 재TM 등록일 → 여기에 영업일 3일을 더한 날이 오늘 이상이면 표시
    const addBizDays = (startStr: string, days: number): Date => {
      const d = new Date(startStr + "T00:00:00");
      let count = 0;
      while (count < days) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) count++; // 주말 제외 (공휴일은 단순화)
      }
      return d;
    };

    customerDbContacts.forEach((contact) => {
      const contactId = Number(contact.id);
      const memo = String(contact.memo || "");
      // [재TM일: YYYY-MM-DD] = 재TM 감도를 설정한 날짜
      const reTmMatch = memo.match(/\[재TM일:\s*(\d{4}-\d{2}-\d{2})\]/);
      if (reTmMatch) {
        // 등록일 + 영업일 3일 = 실제 재TM 예정일
        const retmScheduled = addBizDays(reTmMatch[1], 3);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (retmScheduled <= today) {
          const overdueDays = Math.floor((today.getTime() - retmScheduled.getTime()) / 86400000);
          const scheduledStr = retmScheduled.toISOString().slice(0, 10);
          counts.inactive += 1;
          items.push({
            key: `db-retm-${contact.id}`,
            type: "재TM 예정",
            tone: overdueDays === 0 ? "info" : "warning",
            title: contact.name || "고객명 없음",
            desc: `고객DB · 재TM 예정일 ${scheduledStr}${overdueDays > 0 ? ` (${overdueDays}일 초과)` : " (오늘)"}`,
            href: "/customer-db",
            priority: 200 - overdueDays,
            contactId,
          });
        }
      }
    });

    // ── 4. 장기미활동 (VIP활동DB): 리드/프로스펙팅 중 활동노트 3일 이상 없는 고객 ──
    vipContacts.forEach((contact) => {
      const contactId = Number(contact.id);
      const stage = normalizeText(contact.management_stage);
      if (!["리드", "프로스펙팅"].some((s) => stage === normalizeText(s))) return;
      const latest = latestActivityDate(contact, notesByContact);
      const inactiveDays = daysBetween(latest);
      if (inactiveDays !== null && inactiveDays >= 3) {
        counts.inactive += 1;
        items.push({
          key: `vip-inactive-${contact.id}`,
          type: "장기 미활동",
          tone: "warning",
          title: contact.name || "고객명 없음",
          desc: `VIP·${contact.management_stage || "관리구간"} · 최근 활동 ${inactiveDays}일 전`,
          href: "/pipeline3",
          priority: 300 + inactiveDays,
          contactId,
        });
      }
    });

    // ── 5. 클로징지연: 파이프라인 딜클로징 중 활동노트 3일 이상 없는 고객 ──
    vipContacts.forEach((contact) => {
      const contactId = Number(contact.id);
      const stage = normalizeText(contact.management_stage);
      if (stage !== normalizeText("딜클로징")) return;
      const latest = latestActivityDate(contact, notesByContact);
      const inactiveDays = daysBetween(latest);
      if (inactiveDays !== null && inactiveDays >= 3) {
        counts.closing += 1;
        items.push({
          key: `closing-${contact.id}`,
          type: "클로징 지연",
          tone: "danger",
          title: contact.name || "고객명 없음",
          desc: `딜클로징 · 활동노트 ${inactiveDays}일 전`,
          href: "/pipeline3",
          priority: 400 + inactiveDays,
          contactId,
        });
      }
    });

    const unique = new Map<string, DashboardActionItem>();
    items
      .sort((a, b) => a.priority - b.priority)
      .forEach((item) => {
        if (!unique.has(item.key)) unique.set(item.key, item);
      });
    return { actionItems: Array.from(unique.values()).slice(0, 20), criticalCounts: counts };
  }, [customerDbContacts, notesByContact, vipContacts]);

  const paymentDdays = useMemo(() => {
    return vipContacts
      .filter((contact) => isContracted(contact) && parsePaymentDay(contact.regular_payment_date))
      .map((contact) => {
        const day = parsePaymentDay(contact.regular_payment_date) || 1;
        const info = getNextPaymentInfo(day);
        return { contact, day, ...info };
      })
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 12);
  }, [vipContacts]);

  const paymentDueSoonCount = useMemo(() => paymentDdays.filter((row) => row.diff >= 0 && row.diff <= 4).length, [paymentDdays]);

  const teamRows = useMemo(() => {
    return EXECUTION_PART_NAMES.map((owner) => {
      const ownerAll = contacts.filter((contact) => rowMatchesOwner(contact, owner));
      const ownerCustomerDb = ownerAll.filter((contact) => normalizeText(contact.crm_db_source) === "customer_db");
      const ownerVip = ownerAll.filter(isVipContact);
      // 기간 내 이관된 VIP (vip_transferred_at 기준)
      const ownerPeriodVip = ownerVip.filter((contact) => isInRange(contact.vip_transferred_at, rangeStart, rangeEnd));
      const ownerMonthDb = ownerCustomerDb.filter((contact) => isInRange(contact.created_at, rangeStart, rangeEnd));
      const ownerMembershipSales = sales.filter((row) =>
        salesMatchesOwner(row, owner, salesOwnerLookup) &&
        isInRange(row.payment_date, rangeStart, rangeEnd) &&
        isMembershipFeeSales(row)
      );
      const ownerContracts = ownerVip.filter((contact) => isContractedInMonth(contact, rangeStart, rangeEnd));
      // 파이프라인 단계별: 기간 내 이관 VIP 기준
      const ownerStage = (stage: string) => ownerPeriodVip.filter((contact) => normalizeText(contact.management_stage) === normalizeText(stage)).length;
      return {
        owner,
        db: ownerMonthDb.length,
        masterChallenger: ownerPeriodVip.filter((contact) => isGradeContact(contact, "마스터") || isGradeContact(contact, "챌린저")).length,
        bronze: ownerPeriodVip.filter((contact) => isGradeContact(contact, "브론즈")).length,
        lead: ownerStage("리드"),
        prospect: ownerStage("프로스펙팅"),
        closing: ownerStage("딜클로징"),
        contracts: ownerContracts.length,
        churn: ownerStage("이탈/탈퇴"),
        sales: ownerMembershipSales.reduce((sum, row) => sum + pipelineMembershipSalesAmount(row), 0),
      };
    });
  }, [contacts, sales, salesOwnerLookup, rangeStart, rangeEnd]);

  /* 유입경로별 성과: DB → 접촉 → VIP 확보 흐름이 핵심 */
  const intakeRows = useMemo(() => {
    // 기간 내 고객DB 신규등록 contacts 기준으로 집계
    const periodContacts = visibleContacts.filter((contact) =>
      isInRange(contact.created_at, rangeStart, rangeEnd)
    );
    const groups = new Map<string, ContactRow[]>();
    periodContacts.forEach((contact) => {
      const key = contact.intake_route || "유입경로 미지정";
      const list = groups.get(key) || [];
      list.push(contact);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .map(([route, rows]) => {
        // 기간 내 VIP 이관된 건 (vip_transferred_at 기준)
        const vip = rows.filter((contact) =>
          isVipContact(contact) && isInRange(contact.vip_transferred_at, rangeStart, rangeEnd)
        ).length;
        // 기간 내 계약 전환된 건 (contract_date 기준)
        const contract = rows.filter((contact) =>
          isContractedInMonth(contact, rangeStart, rangeEnd)
        ).length;
        const firstTouch = rows.filter((row) =>
          hasFirstTouch(row, notesByContact, rangeStart, rangeEnd)
        ).length;
        return {
          route,
          total: rows.length,
          firstTouch,
          vip,
          contract,
          touchRate: percent(firstTouch, rows.length),
          vipRate: percent(vip, Math.max(rows.length, 1)),
        };
      })
      .sort((a, b) => b.vip - a.vip || b.vipRate - a.vipRate || b.total - a.total)
      .slice(0, 7);
  }, [notesByContact, rangeStart, rangeEnd, visibleContacts]);

  /* 등급별 계약전환율: 마스터·챌린저·브론즈 계약건수 + 계약 유입경로 */
  const gradeContractRows = useMemo(() => {
    return CORE_VIP_GRADES.map((grade) => {
      // 기간 내 VIP 이관된 해당 등급 고객 (vip_transferred_at 기준)
      const rows = vipContacts.filter((contact) =>
        isGradeContact(contact, grade) &&
        isInRange(contact.vip_transferred_at, rangeStart, rangeEnd)
      );
      // 기간 내 계약 전환된 건 (contract_date 기준)
      const contracted = rows.filter((contact) =>
        isContractedInMonth(contact, rangeStart, rangeEnd)
      );
      const routeCounts = new Map<string, number>();
      contracted.forEach((contact) => {
        const key = contact.intake_route || "경로 미지정";
        routeCounts.set(key, (routeCounts.get(key) || 0) + 1);
      });
      const routes = Array.from(routeCounts.entries()).sort((a, b) => b[1] - a[1]);
      return {
        grade,
        count: rows.length,
        contracts: contracted.length,
        rate: percent(contracted.length, Math.max(rows.length, 1)),
        routes,
        tone: (grade === "마스터" ? "warning" : grade === "챌린저" ? "purple" : "success") as ToneName,
      };
    });
  }, [vipContacts, rangeStart, rangeEnd]);

  const kpiPanelDesc = useMemo(() => {
    if (isAdminUser(me)) return "실행파트 전체목표 · 운영파트 전체목표";
    if (isOperationUser(me)) return "광고특전운영매출";
    if (isExecutionUser(me)) return "등급별 분양회 모집 · 분양회 회비";
    return "분양회 모집 · 분양회 회비 · 광고특전운영매출";
  }, [me]);

  const kpiRows = useMemo(() => {
    const isOwnerIn = (row: Pick<ContactRow, "assigned_to" | "consultant">, owners: string[]) =>
      owners.some((owner) => rowMatchesOwner(row, owner));
    const salesOwnerIn = (row: SalesRow, owners: string[]) =>
      owners.some((owner) => salesMatchesOwner(row, owner, salesOwnerLookup));

    const contractedMembers = (sourceContacts: ContactRow[]) =>
      sourceContacts.filter((contact) =>
        isVipContact(contact) &&
        isContracted(contact) &&
        isInRange(contact.contract_date, rangeStart, rangeEnd)
      );

    const salesAmount = (sourceSales: SalesRow[], category: "membership" | "lms" | "hogang") =>
      sourceSales
        .filter((row) => salesCategory(row) === category && isInRange(row.payment_date, rangeStart, rangeEnd))
        .reduce((sum, row) => sum + effectiveSales(row), 0);

    const teamTarget = kpis.find((row) => row.scope === "team" && row.target_name === "team") || null;
    const execTargets = kpis.filter((row) => row.scope === "execution");
    const opsTargets = kpis.filter((row) => row.scope === "operation");
    const execRecruitTarget = execTargets.reduce(
      (sum, row) => sum + Number(row.master_count || 0) + Number(row.challenger_count || 0) + Number(row.bronze_count || 0),
      0
    );
    const execMembershipRevenueTarget = execTargets.reduce((sum, row) => sum + Number(row.bunyanghoe_revenue || 0), 0);
    const opsAdOperationRevenueTarget = opsTargets.reduce((sum, row) => sum + Number(row.ad_operation_revenue || 0), 0);

    // 관리자 화면은 대협팀 전체 목표를 우선 사용하되,
    // 전체 목표 금액이 비어 있으면 개인별 목표 합계를 자동으로 대체합니다.
    // KPI 설정에서 전체 목표와 개인별 목표 중 어느 쪽에 입력해도 대시보드 목표가 비어 보이지 않게 하기 위한 보정입니다.
    const adminRecruitGoal = Number(teamTarget?.recruit_count || 0) || execRecruitTarget;
    const adminMembershipGoal = Number(teamTarget?.bunyanghoe_revenue || 0) || execMembershipRevenueTarget;
    const adminAdOperationGoal = Number(teamTarget?.ad_operation_revenue || 0) || opsAdOperationRevenueTarget;

    const operationAdOperationSalesByExecutionOwners = (owners: string[]) => {
      const targetSales = sales.filter((row) => salesOwnerIn(row, owners));
      return salesAmount(targetSales, "lms") + salesAmount(targetSales, "hogang");
    };

    if (isAdminUser(me)) {
      const execContacts = contacts.filter((contact) => isOwnerIn(contact, EXECUTION_PART_NAMES));
      const execSales = sales.filter((row) => salesOwnerIn(row, EXECUTION_PART_NAMES));
      const operationManagedExecutionOwners = getAllOperationManagedExecutionOwners();
      const execContracts = contractedMembers(execContacts);
      const execMembershipSales = salesAmount(execSales, "membership");
      const opsAdOperationSales = operationAdOperationSalesByExecutionOwners(operationManagedExecutionOwners);

      return [
        { label: "실행파트 분양회 모집", value: execContracts.length, goal: adminRecruitGoal, unit: "명", tone: "success" as ToneName, money: false },
        { label: "실행파트 분양회 매출(회비)", value: execMembershipSales, goal: adminMembershipGoal, unit: "원", tone: "warning" as ToneName, money: true },
        { label: "운영파트 광고특전운영매출", value: opsAdOperationSales, goal: adminAdOperationGoal, unit: "원", tone: "purple" as ToneName, money: true },
      ];
    }

    if (isOperationUser(me)) {
      const target = kpis.find((row) =>
        row.scope === "operation" && normalizePersonName(row.target_name) === normalizePersonName(me?.name)
      ) || null;
      const managedExecutionOwners = getOperationManagedExecutionOwners(me?.name);
      const adOperationSales = operationAdOperationSalesByExecutionOwners(managedExecutionOwners);
      const managedLabel = managedExecutionOwners.length ? ` · ${managedExecutionOwners.join(", ")} 담당 매출` : "";
      return [
        { label: `광고특전운영매출${managedLabel}`, value: adOperationSales, goal: Number(target?.ad_operation_revenue || 0), unit: "원", tone: "purple" as ToneName, money: true },
      ];
    }

    const target = kpis.find((row) =>
      row.scope === "execution" && normalizePersonName(row.target_name) === normalizePersonName(activeOwner)
    ) || null;
    const periodContracts = contractedMembers(visibleContacts);
    const masterContracts = periodContracts.filter((contact) => isGradeContact(contact, "마스터")).length;
    const challengerContracts = periodContracts.filter((contact) => isGradeContact(contact, "챌린저")).length;
    const bronzeContracts = periodContracts.filter((contact) => isGradeContact(contact, "브론즈")).length;

    return [
      { label: "마스터 모집", value: masterContracts, goal: Number(target?.master_count || 0), unit: "명", tone: "warning" as ToneName, money: false },
      { label: "챌린저 모집", value: challengerContracts, goal: Number(target?.challenger_count || 0), unit: "명", tone: "purple" as ToneName, money: false },
      { label: "브론즈 모집", value: bronzeContracts, goal: Number(target?.bronze_count || 0), unit: "명", tone: "success" as ToneName, money: false },
      { label: "분양회 매출(회비)", value: stats.membershipSales, goal: Number(target?.bunyanghoe_revenue || 0), unit: "원", tone: "info" as ToneName, money: true },
    ];
  }, [activeOwner, contacts, kpis, me, rangeEnd, rangeStart, sales, salesOwnerLookup, stats.hogangSales, stats.lmsSales, stats.membershipSales, visibleContacts]);

  /* 매출 구성: 분양회 월회비 · LMS · 호갱노노 3종만 */
  const salesBreakdown = useMemo(() => ([
    { label: "분양회 월회비", value: stats.membershipSales, tone: "warning" as ToneName },
    { label: "LMS", value: stats.lmsSales, tone: "info" as ToneName },
    { label: "호갱노노", value: stats.hogangSales, tone: "purple" as ToneName },
  ]), [stats.hogangSales, stats.lmsSales, stats.membershipSales]);

  const coreSalesTotal = stats.membershipSales + stats.lmsSales + stats.hogangSales;

  const periodPrefix = filterMode === "daily" ? "당일" : filterMode === "weekly" ? "주간" : "당월";
  const filterLabel = filterMode === "daily"
    ? `${filterYear}.${String(rangeStart.getMonth() + 1).padStart(2, "0")}.${String(rangeStart.getDate()).padStart(2, "0")} (당일)`
    : filterMode === "weekly"
      ? `${filterYear}.${String(filterMonthNum).padStart(2, "0")} ${filterWeekNum}주차 (${String(rangeStart.getDate()).padStart(2, "0")}~${String(rangeEnd.getDate()).padStart(2, "0")}일)`
      : `${filterYear}.${String(filterMonthNum).padStart(2, "0")} (월간)`;
  const dashboardScopeLabel = activeOwner === "전체" ? "팀 전체" : `${activeOwner} 담당자`;
  const totalCritical = criticalCounts.payment + criticalCounts.missing + criticalCounts.inactive + criticalCounts.closing;

  const gradeJoinRows = [
    { label: "마스터", value: stats.masterThisMonth, tone: "warning" as ToneName },
    { label: "챌린저", value: stats.challengerThisMonth, tone: "purple" as ToneName },
    { label: "브론즈", value: stats.bronzeThisMonth, tone: "success" as ToneName },
  ];

  const toggleWorkItem = useCallback(async (itemId: string) => {
    if (!dailyGoal) return;
    const items = (dailyGoal.goal_work_items || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setDailyGoal((prev) => prev ? { ...prev, goal_work_items: items } : prev);
    try {
      await supabase.from("daily_activity_goals").update({ goal_work_items: items }).eq("id", dailyGoal.id);
    } catch (e) { console.warn("work item toggle 실패", e); }
  }, [dailyGoal]);

  const toggleMemberWorkItem = useCallback(async (memberName: string, itemId: string) => {
    const memberGoal = allDailyGoals.find((r) => normalizePersonName(r.owner_name) === normalizePersonName(memberName));
    if (!memberGoal) return;
    const items = (memberGoal.goal_work_items || []).map((item: { id: string; text: string; done: boolean }) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setAllDailyGoals((prev) => prev.map((r) =>
      normalizePersonName(r.owner_name) === normalizePersonName(memberName)
        ? { ...r, goal_work_items: items }
        : r
    ));
    try {
      await supabase.from("daily_activity_goals").update({ goal_work_items: items }).eq("id", memberGoal.id);
    } catch (e) { console.warn("멤버 work item toggle 실패", e); }
  }, [allDailyGoals]);

  const dailyActivityFields = useMemo(() => {
    if (!dailyGoal) return [];
    return [
      { label: "당일 TM", goal: dailyGoal.goal_new_tm, result: dailyGoal.result_new_tm, unit: "건" },
      { label: "당일 콜드톡", goal: dailyGoal.goal_coldtalk, result: dailyGoal.result_coldtalk, unit: "건" },
      { label: "브론즈 DB 확보", goal: dailyGoal.goal_consultant_db, result: dailyGoal.result_consultant_db, unit: "개" },
      { label: "1% DB 확보", goal: dailyGoal.goal_second_touch, result: dailyGoal.result_second_touch, unit: "개" },
    ];
  }, [dailyGoal]);

  const dailyWorkItems = useMemo(() => {
    return (dailyGoal?.goal_work_items || []).filter((item) => item.text.trim().length > 0);
  }, [dailyGoal]);

  const handlePdfSave = useCallback(() => {
    const d = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const printDate = `${now.getFullYear()}.${d(now.getMonth() + 1)}.${d(now.getDate())} ${d(now.getHours())}:${d(now.getMinutes())}`;

    const funnelHtml = funnelStages.map((s, i) => {
      const arrow = !s.isLast && s.rate !== null && s.rate !== undefined ? `<td style="text-align:center;color:#6b21a8;font-weight:600;font-size:13px;width:60px;">${s.rate}% →</td>` : (!s.isLast ? `<td style="text-align:center;color:#94a3b8;width:40px;">→</td>` : "");
      return `<td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;vertical-align:top;">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px;">${s.label}</div>
        <div style="font-size:24px;font-weight:600;color:#0f172a;">${s.value.toLocaleString()}<span style="font-size:13px;color:#64748b;margin-left:2px;">건</span></div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${s.sub}</div>
      </td>${arrow}`;
    }).join("");

    const gradeJoinHtml = gradeJoinRows.map((g) => `<span style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 14px;margin-right:8px;font-size:13px;"><strong>${g.label}</strong> ${g.value}건</span>`).join("");

    const teamHeader = ["담당자","DB입력","마스터·챌린저DB","브론즈DB","리드","프로스펙팅","클로징","계약","이탈","매출"];
    const teamTh = teamHeader.map((h, i) => {
      const borderR = i === 3 ? "border-right:2px solid #cbd5e1;" : "";
      const color = h === "계약" ? "#047857" : h === "이탈" ? "#be123c" : h === "매출" ? "#0e7490" : "#64748b";
      return `<th style="padding:8px 6px;font-size:11px;font-weight:400;color:${color};text-align:center;border-bottom:1px solid #e2e8f0;${borderR}">${h}</th>`;
    }).join("");
    const teamTr = teamRows.map((r) => {
      const vals = [r.db, r.masterChallenger, r.bronze, r.lead, r.prospect, r.closing, r.contracts, r.churn, money(r.sales)];
      const tds = vals.map((v, i) => {
        const borderR = i === 2 ? "border-right:2px solid #e2e8f0;" : "";
        const color = i === 6 ? "#047857" : i === 7 && Number(v) > 0 ? "#be123c" : i === 8 ? "#0e7490" : "#1e293b";
        return `<td style="padding:10px 6px;text-align:center;font-size:13px;color:${color};${borderR}">${v}</td>`;
      }).join("");
      return `<tr><td style="padding:10px 6px;font-size:12px;font-weight:500;color:#0f172a;">${r.owner}</td>${tds}</tr>`;
    }).join("");

    const intakeHtml = intakeRows.map((r) => `<tr>
      <td style="padding:8px 6px;font-size:13px;color:#0f172a;">${r.route}</td>
      <td style="padding:8px 6px;text-align:center;font-size:13px;">${r.total}건</td>
      <td style="padding:8px 6px;text-align:center;font-size:13px;color:#6b21a8;">${r.vip}건</td>
      <td style="padding:8px 6px;text-align:center;font-size:13px;font-weight:600;color:#047857;">${r.vipRate}%</td>
    </tr>`).join("");

    const gradeHtml = gradeContractRows.map((r) => {
      const routes = r.routes.length ? r.routes.map(([route, count]) => `${route} ${count}건`).join(", ") : "—";
      return `<tr>
        <td style="padding:8px 6px;font-size:13px;font-weight:500;color:#0f172a;">${r.grade}</td>
        <td style="padding:8px 6px;text-align:center;font-size:13px;">${r.count}건</td>
        <td style="padding:8px 6px;text-align:center;font-size:13px;font-weight:600;color:#047857;">${r.contracts}건</td>
        <td style="padding:8px 6px;text-align:center;font-size:13px;font-weight:600;">${r.rate}%</td>
        <td style="padding:8px 6px;font-size:11px;color:#64748b;">${routes}</td>
      </tr>`;
    }).join("");

    const criticalHtml = actionItems.length === 0
      ? `<p style="text-align:center;color:#94a3b8;padding:16px 0;">긴급 관리 대상 고객 없음</p>`
      : actionItems.slice(0, 12).map((item) => {
          const target = contacts.find((c) => Number(c.id) === item.contactId);
          return `<tr>
            <td style="padding:6px;font-size:12px;color:#be123c;font-weight:500;">${item.type}</td>
            <td style="padding:6px;font-size:12px;color:#0f172a;">${item.title}${target?.title ? ` · ${target.title}` : ""}</td>
            <td style="padding:6px;font-size:11px;color:#64748b;">${item.desc}</td>
          </tr>`;
        }).join("");

    const kpiHtml = kpiRows.map((r) => {
      const hasGoal = r.goal > 0;
      return `<tr>
        <td style="padding:8px 6px;font-size:13px;">${r.label}</td>
        <td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:600;">${r.money ? moneyFull(r.value) : `${r.value.toLocaleString()}${r.unit}`}</td>
        <td style="padding:8px 6px;text-align:right;font-size:13px;color:#64748b;">${hasGoal ? (r.money ? moneyFull(r.goal) : `${r.goal.toLocaleString()}${r.unit}`) : "—"}</td>
        <td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:600;color:#047857;">${hasGoal ? `${percent(r.value, r.goal)}%` : "—"}</td>
      </tr>`;
    }).join("");

    const salesHtml = salesBreakdown.map((s) => `<tr>
      <td style="padding:8px 6px;font-size:13px;">${s.label}</td>
      <td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:600;">${moneyFull(s.value)}</td>
      <td style="padding:8px 6px;text-align:right;font-size:13px;color:#64748b;">${percent(s.value, Math.max(coreSalesTotal, 1))}%</td>
    </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
    <title>분양회 CRM 대시보드 리포트</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"/>
    <style>
      @page { size: A4; margin: 12mm 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', sans-serif; }
      body { padding: 0; color: #1e293b; font-size: 13px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.04em; color: #0f172a; }
      h2 { font-size: 14px; font-weight: 600; color: #0f172a; margin: 20px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #0f172a; letter-spacing: -0.02em; }
      table { width: 100%; border-collapse: collapse; }
      .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
      .header-right { text-align: right; font-size: 12px; color: #64748b; }
      .section { margin-bottom: 14px; page-break-inside: avoid; }
      .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
    </style></head><body>

    <div class="header">
      <div>
        <h1>분양회 CRM 대시보드 리포트</h1>
        <p style="margin-top:4px;font-size:12px;color:#64748b;">광고인㈜ 대외협력팀 · ${dashboardScopeLabel}</p>
      </div>
      <div class="header-right">
        <p><strong>조회 기간:</strong> ${filterLabel}</p>
        <p><strong>출력 일시:</strong> ${printDate}</p>
      </div>
    </div>

    <div class="section">
      <h2>영업 퍼널</h2>
      <table style="table-layout:auto;"><tr>${funnelHtml}</tr></table>
      <div style="margin-top:8px;">${gradeJoinHtml}</div>
    </div>

    <div class="section">
      <h2>담당자별 파이프라인 현황</h2>
      <table><thead><tr>${teamTh}</tr></thead><tbody>${teamTr}</tbody></table>
    </div>

    <div class="section" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h2>유입경로별 성과</h2>
        <table>
          <thead><tr><th style="text-align:left;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">유입경로</th><th style="text-align:center;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">DB입력</th><th style="text-align:center;padding:6px;font-size:11px;color:#6b21a8;border-bottom:1px solid #e2e8f0;">VIP전환</th><th style="text-align:center;padding:6px;font-size:11px;color:#047857;border-bottom:1px solid #e2e8f0;">전환율</th></tr></thead>
          <tbody>${intakeHtml}</tbody>
        </table>
      </div>
      <div>
        <h2>등급별 계약전환율</h2>
        <table>
          <thead><tr><th style="text-align:left;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">등급</th><th style="text-align:center;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">보유</th><th style="text-align:center;padding:6px;font-size:11px;color:#047857;border-bottom:1px solid #e2e8f0;">계약</th><th style="text-align:center;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">전환율</th><th style="text-align:left;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">계약 유입경로</th></tr></thead>
          <tbody>${gradeHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="section" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h2>KPI 달성률</h2>
        <table>
          <thead><tr><th style="text-align:left;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">항목</th><th style="text-align:right;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">실적</th><th style="text-align:right;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">목표</th><th style="text-align:right;padding:6px;font-size:11px;color:#047857;border-bottom:1px solid #e2e8f0;">달성률</th></tr></thead>
          <tbody>${kpiHtml}</tbody>
        </table>
      </div>
      <div>
        <h2>매출 구성</h2>
        <table>
          <thead><tr><th style="text-align:left;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">항목</th><th style="text-align:right;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">금액</th><th style="text-align:right;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">비중</th></tr></thead>
          <tbody>${salesHtml}</tbody>
          <tfoot><tr style="border-top:1px solid #e2e8f0;"><td style="padding:8px 6px;font-size:13px;font-weight:600;">합계</td><td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:600;">${moneyFull(coreSalesTotal)}</td><td></td></tr></tfoot>
        </table>
      </div>
    </div>

    ${actionItems.length > 0 ? `<div class="section">
      <h2>긴급 관리 대상 (${actionItems.length}건)</h2>
      <table>
        <thead><tr><th style="text-align:left;padding:6px;font-size:11px;color:#be123c;border-bottom:1px solid #e2e8f0;width:90px;">유형</th><th style="text-align:left;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;width:140px;">고객</th><th style="text-align:left;padding:6px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">상세</th></tr></thead>
        <tbody>${criticalHtml}</tbody>
      </table>
    </div>` : ""}

    <div class="footer">분양회 CRM · 광고인㈜ 대외협력팀 · ${printDate} 출력</div>

    <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); }<\/script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }, [actionItems, contacts, coreSalesTotal, dashboardScopeLabel, filterLabel, funnelStages, gradeContractRows, gradeJoinRows, intakeRows, kpiRows, salesBreakdown, teamRows]);

  return (
    <div className="premium-page h-full overflow-y-auto">
      <div className="premium-shell px-5 py-5 md:px-7 md:py-6">

        {/* ── 헤더 ── */}
        <header className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between print:mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="crm-title">대시보드</h1>
              <Badge tone={fixedOwner ? "success" : "info"} icon={UserCheck}>{dashboardScopeLabel}</Badge>
              <Badge tone="muted" icon={CalendarDays}>{filterLabel}</Badge>
            </div>
            <p className="crm-subtitle mt-1">고객DB → 첫접촉 → VIP 이관·등급심사 → 계약·리텐션 → 매출까지 영업 흐름을 한 화면에서 봅니다.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* 당일 · 주간 · 월간 토글 */}
            <div className="inline-flex overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--border)" }}>
              {(["daily", "weekly", "monthly"] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className="px-3 py-2 text-[13px] transition-colors"
                  style={{
                    background: filterMode === mode ? "var(--accent-subtle)" : "var(--surface-2)",
                    color: filterMode === mode ? "var(--accent-text)" : "var(--text-subtle)",
                    fontWeight: filterMode === mode ? 600 : 400,
                  }}
                >
                  {FILTER_MODE_LABELS[mode]}
                </button>
              ))}
            </div>

            {/* 월 드롭다운 (월간·주간 모드에서 표시) */}
            {(filterMode === "monthly" || filterMode === "weekly") && (
              <select
                value={filterMonthNum}
                onChange={(event) => { setFilterMonthNum(Number(event.target.value)); setFilterWeekNum(1); }}
                className="crm-search w-[100px] px-3"
              >
                {MONTH_NUMS.map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            )}

            {/* 주차 드롭다운 (주간 모드에서만 표시) */}
            {filterMode === "weekly" && (
              <select
                value={filterWeekNum}
                onChange={(event) => setFilterWeekNum(Number(event.target.value))}
                className="crm-search w-[160px] px-3"
              >
                {monthWeeks.map((w) => (
                  <option key={w.week} value={w.week}>{w.label}</option>
                ))}
              </select>
            )}

            <select
              value={activeOwner}
              disabled={fixedOwner}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="crm-search w-[130px] px-3 disabled:opacity-70"
            >
              <option value="전체">전체 담당자</option>
              {EXECUTION_PART_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
              {OPERATION_PART_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>

            <button type="button" onClick={handlePdfSave} className="btn-premium btn-primary">
              <FileDown size={14} /> PDF 저장
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="mb-4 rounded-[12px] border px-4 py-3 text-[13px] font-normal" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-text)" }}>
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center">
            <Loader2 className="animate-spin" size={32} style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── ① 최상단: 당월 영업 퍼널(좌) + 당월 등급 가입 현황(우) ── */}
            <div className="grid items-stretch gap-4 2xl:grid-cols-[1fr_300px]">
              <Panel className="h-full">
                <PanelTitle
                  icon={LineChart}
                  tone="info"
                  title={`${periodPrefix} 영업 퍼널`}
                  desc="고객DB → 첫접촉 → VIP 이관·등급심사 → 계약·리텐션"
                  right={<Badge tone="danger" icon={TrendingDown}>이탈 {stats.churnCount}건 · {stats.churnRate}%</Badge>}
                />
                <div className="p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0">
                    {funnelStages.map((stage) => (
                      <Fragment key={stage.label}>
                        <FunnelBox label={stage.label} value={stage.value} sub={stage.sub} tone={stage.tone} />
                        {!stage.isLast && <FunnelConnector rate={stage.rate} />}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel className="flex h-full flex-col">
                <PanelTitle icon={BadgeCheck} tone="warning" title={`${periodPrefix} 등급별 가입현황`} desc="등급별 가입현황 실시간 집계" right={<Badge tone="muted">{filterLabel}</Badge>} />
                <div className="flex flex-1 flex-col justify-center gap-2 p-4">
                  {gradeJoinRows.map((row) => {
                    const c = toneStyle(row.tone);
                    return (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                        <Badge tone={row.tone}>{row.label}</Badge>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-[20px] font-semibold leading-none tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{row.value.toLocaleString()}<span className="ml-0.5 text-[13px]" style={{ color: "var(--text-subtle)" }}>건</span></p>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            {/* ── ② 본문 그리드 ── */}
            <div className="grid gap-4 2xl:grid-cols-[1.25fr_.75fr]">
              {/* 좌측 */}
              <div className="space-y-4">

                {/* 담당자별 파이프라인 현황 */}
                <Panel>
                  <PanelTitle icon={Users} tone="purple" title={`${periodPrefix} 담당자별 파이프라인 현황`} desc="DB입력 · 등급DB → 파이프라인 → 계약 · 이탈 · 매출" right={<Badge tone="info" icon={Filter}>관리자 뷰</Badge>} />
                  <div className="overflow-x-auto p-2">
                    <table className="w-full border-separate" style={{ borderSpacing: "0 4px", tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: "7%" }} />{/* 담당자 */}
                        <col style={{ width: "5.5%" }} />{/* DB입력 */}
                        <col style={{ width: "10%" }} />{/* 마스터·챌린저DB */}
                        <col style={{ width: "6.5%" }} />{/* 브론즈DB */}
                        <col style={{ width: "11%" }} />{/* 리드 */}
                        <col style={{ width: "13%" }} />{/* 프로스펙팅 */}
                        <col style={{ width: "11%" }} />{/* 클로징 */}
                        <col style={{ width: "11%" }} />{/* 계약 */}
                        <col style={{ width: "11%" }} />{/* 이탈 */}
                        <col style={{ width: "14%" }} />{/* 매출 */}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>담당자</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>DB입력</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>마스터·챌린저DB</th>
                          <th className="border-r px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)", borderColor: "var(--border)" }}>브론즈DB</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>리드</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>프로스펙팅</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>클로징</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--success-text)" }}>계약</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--danger-text)" }}>이탈</th>
                          <th className="px-1.5 pb-1 text-center text-[12px] font-normal tracking-[-0.01em]" style={{ color: "var(--cyan-text)" }}>매출</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamRows.map((row) => {
                          const isMine = normalizePersonName(row.owner) === normalizePersonName(activeOwner);
                          const cellCls = "px-1.5 py-2.5 text-center text-[13px] font-semibold tabular-nums tracking-[-0.01em]";
                          return (
                            <tr key={row.owner} style={{ background: isMine ? "var(--surface-selected)" : "var(--surface-2)" }}>
                              <td className="rounded-l-[10px] px-1.5 py-2.5 text-center text-[13px] font-semibold tracking-[-0.01em]" style={{ color: isMine ? "var(--accent-text)" : "var(--text-strong)" }}>{row.owner}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.db}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.masterChallenger}</td>
                              <td className={`${cellCls} border-r`} style={{ color: "var(--text)", borderColor: "var(--border)" }}>{row.bronze}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.lead}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.prospect}</td>
                              <td className={cellCls} style={{ color: "var(--text)" }}>{row.closing}</td>
                              <td className={cellCls} style={{ color: "var(--success-text)" }}>{row.contracts}</td>
                              <td className={cellCls} style={{ color: row.churn > 0 ? "var(--danger-text)" : "var(--text-faint)" }}>{row.churn}</td>
                              <td className={`${cellCls} rounded-r-[10px]`} style={{ color: "var(--cyan-text)" }}>{money(row.sales)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>


                {/* 유입경로별 성과 + 등급별 계약전환율 */}
                <div className="grid items-stretch gap-4 xl:grid-cols-2">
                  <Panel className="h-full">
                    <PanelTitle icon={TrendingUp} tone="success" title={`${periodPrefix} 유입경로별 성과`} desc="DB 입력 대비 VIP 전환 현황" />
                    <div className="p-4">
                      {intakeRows.length === 0 ? <EmptyBlock title="유입경로 데이터가 없습니다" desc="고객DB에 유입경로가 입력되면 자동 집계됩니다." /> : (
                        <div className="space-y-2">
                          {intakeRows.map((row) => (
                            <div key={row.route} className="rounded-[12px] border px-3 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                              <div className="flex items-center gap-3">
                                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{row.route}</p>
                                <p className="shrink-0 text-[13px] tabular-nums tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>
                                  DB입력 <strong style={{ color: "var(--text-strong)" }}>{row.total}건</strong>
                                </p>
                                <ArrowRight size={13} style={{ color: "var(--text-faint)" }} />
                                <p className="shrink-0 text-[13px] tabular-nums tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>
                                  VIP전환 <strong style={{ color: "var(--purple-text)" }}>{row.vip}건</strong>
                                </p>
                                <Badge tone={row.vipRate >= 60 ? "success" : row.vipRate >= 30 ? "warning" : "muted"}>{row.vipRate}%</Badge>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.vipRate)}%`, background: toneStyle("purple").bar }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Panel>

                  <Panel className="h-full">
                    <PanelTitle icon={Activity} tone="purple" title={`${periodPrefix} 등급별 계약전환율`} desc="마스터 · 챌린저 · 브론즈 계약건수와 계약 유입경로" />
                    <div className="space-y-2.5 p-4">
                      {gradeContractRows.map((row) => (
                        <div key={row.grade} className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Badge tone={row.tone}>{row.grade}</Badge>
                              <p className="text-[13px] font-semibold tabular-nums tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>
                                계약 {row.contracts}건 <span className="text-[12px] font-medium" style={{ color: "var(--text-faint)" }}>/ 보유 {row.count}건</span>
                              </p>
                            </div>
                            <p className="shrink-0 text-[18px] font-semibold leading-none tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{row.rate}<span className="text-[13px]">%</span></p>
                          </div>
                          <div className="mt-2.5"><ProgressBar value={row.contracts} total={Math.max(row.count, 1)} tone={row.tone} /></div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-normal" style={{ color: "var(--text-faint)" }}>계약 유입경로</span>
                            {row.routes.length === 0 ? (
                              <span className="text-[12px] font-medium" style={{ color: "var(--text-faint)" }}>아직 계약이 없습니다</span>
                            ) : row.routes.map(([route, count]) => (
                              <span key={route} className="rounded-[7px] px-1.5 py-0.5 text-[12px] font-normal" style={{ background: "var(--surface-1)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>
                                {route} {count}건
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                {/* KPI 2종 + 매출 구성 3종 (높이 통일) */}
                <div className="grid items-stretch gap-4 xl:grid-cols-2">
                  <Panel className="flex h-full flex-col">
                    <PanelTitle icon={Target} tone="warning" title="당월 KPI 목표 대비 달성률" desc={kpiPanelDesc} right={<a href="/kpi-settings" className="btn-premium btn-secondary">KPI 설정</a>} />
                    <div className="flex flex-1 flex-col justify-center gap-2.5 p-4">
                      {kpiRows.map((row) => {
                        const hasGoal = row.goal > 0;
                        return (
                          <div key={row.label} className="rounded-[12px] border p-3.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-normal tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>{row.label}</p>
                              <Badge tone={row.tone}>{hasGoal ? `달성 ${percent(row.value, row.goal)}%` : "목표 미설정"}</Badge>
                            </div>
                            <div className="mt-2 flex items-baseline justify-between gap-3">
                              <p className="truncate text-[22px] font-semibold leading-none tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>{row.money ? moneyFull(row.value) : `${row.value.toLocaleString()}${row.unit}`}</p>
                              <p className="shrink-0 text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>목표 {hasGoal ? (row.money ? moneyFull(row.goal) : `${row.goal.toLocaleString()}${row.unit}`) : "—"}</p>
                            </div>
                            <div className="mt-3"><ProgressBar value={row.value} total={hasGoal ? row.goal : Math.max(row.value, 1)} tone={row.tone} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>

                  <Panel className="flex h-full flex-col">
                    <PanelTitle icon={BarChart3} tone="cyan" title={`${periodPrefix} 매출 구성`} desc={`분양회 월회비 · LMS · 호갱노노 합계 ${money(coreSalesTotal)}`} right={<a href="/sales" className="btn-premium btn-secondary">매출관리</a>} />
                    <div className="flex flex-1 flex-col justify-center gap-3 p-4">
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                        {salesBreakdown.filter((item) => item.value > 0).map((item) => (
                          <div key={item.label} style={{ width: `${percent(item.value, Math.max(coreSalesTotal, 1))}%`, background: toneStyle(item.tone).bar }} />
                        ))}
                      </div>
                      {salesBreakdown.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toneStyle(item.tone).dot }} />
                            <span className="truncate text-[13px] font-normal tracking-[-0.01em]" style={{ color: "var(--text)" }}>{item.label}</span>
                          </div>
                          <div className="flex shrink-0 items-baseline gap-2.5">
                            <span className="text-[14px] font-semibold tabular-nums tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{moneyFull(item.value)}</span>
                            <span className="w-9 text-right text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-subtle)" }}>{percent(item.value, Math.max(coreSalesTotal, 1))}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                {/* 당일 활동목표 달성현황 (KPI + 매출 전체 폭) */}
                <Panel>
                  <PanelTitle icon={Target} tone="info" title="당일 활동목표 달성현황" desc="일별활동기록 목표 대비 실시간 자동집계 결과" right={<a href="/daily-activity" className="btn-premium btn-secondary">일별활동기록</a>} />
                  {isAdminUser(me) ? (
                    allDailyGoals.length === 0 ? (
                      <EmptyBlock title="오늘 등록된 활동목표가 없습니다" desc="실행파트 담당자들이 일별활동기록을 입력하면 여기에 표시됩니다." />
                    ) : (
                      <div className="p-4 space-y-2">
                        <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
                          {EXECUTION_PART_NAMES.map((memberName) => {
                            const memberGoal = allDailyGoals.find((r) => normalizePersonName(r.owner_name) === normalizePersonName(memberName));
                            const isExpanded = expandedDailyMember === memberName;
                            const isOutsideMeeting = Boolean(memberGoal?.is_outside_meeting);
                            const totalGoal = memberGoal && !isOutsideMeeting ? (memberGoal.goal_new_tm + memberGoal.goal_coldtalk + memberGoal.goal_consultant_db + memberGoal.goal_second_touch) : 0;
                            const totalResult = memberGoal && !isOutsideMeeting ? (memberGoal.result_new_tm + memberGoal.result_coldtalk + memberGoal.result_consultant_db + memberGoal.result_second_touch) : 0;
                            const totalRate = totalGoal > 0 ? percent(totalResult, totalGoal) : 0;
                            return (
                              <button
                                key={memberName}
                                type="button"
                                onClick={() => setExpandedDailyMember(isExpanded ? null : memberName)}
                                className="rounded-[12px] border p-3 text-left transition-all"
                                style={{
                                  borderColor: isExpanded ? "var(--accent-border)" : "var(--border-subtle)",
                                  background: isExpanded ? "var(--accent-subtle)" : "var(--surface-2)",
                                  outline: "none",
                                }}
                              >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: "linear-gradient(135deg,#8b7cf6,#60a5fa)", color: "#fff" }}>
                                      {memberName.slice(0, 1)}
                                    </div>
                                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>{memberName}</p>
                                  </div>
                                  <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{isExpanded ? "▲" : "▼"}</span>
                                </div>
                                {!memberGoal ? (
                                  <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>목표 미입력</p>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <p className="text-[12px]" style={{ color: "var(--text-subtle)" }}>전체 달성률</p>
                                      <span className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: isOutsideMeeting ? "var(--warning-bg)" : totalRate >= 100 ? "var(--success-bg)" : totalRate >= 50 ? "var(--warning-bg)" : "var(--surface-3)", color: isOutsideMeeting ? "var(--warning-text)" : totalRate >= 100 ? "var(--success-text)" : totalRate >= 50 ? "var(--warning-text)" : "var(--text-subtle)", border: isOutsideMeeting ? "1px solid var(--warning-border)" : "1px solid transparent" }}>
                                        {isOutsideMeeting ? "외근" : `${totalRate}%`}
                                      </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                                      <div className="h-full rounded-full transition-all" style={{ width: isOutsideMeeting ? "100%" : `${Math.min(100, totalRate)}%`, background: isOutsideMeeting ? "var(--warning-border)" : totalRate >= 100 ? "var(--success-border)" : "var(--accent-border)" }} />
                                    </div>
                                    {isOutsideMeeting && (
                                      <p className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--warning-text)" }}>외근(미팅) 체크 · 당일 목표 집계 제외</p>
                                    )}
                                  </>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {expandedDailyMember && (() => {
                          const memberGoal = allDailyGoals.find((r) => normalizePersonName(r.owner_name) === normalizePersonName(expandedDailyMember));
                          const fields = memberGoal ? [
                            { label: "당일 TM", goal: memberGoal.goal_new_tm, result: memberGoal.result_new_tm, unit: "건" },
                            { label: "당일 콜드톡", goal: memberGoal.goal_coldtalk, result: memberGoal.result_coldtalk, unit: "건" },
                            { label: "브론즈 DB 확보", goal: memberGoal.goal_consultant_db, result: memberGoal.result_consultant_db, unit: "개" },
                            { label: "1% DB 확보", goal: memberGoal.goal_second_touch, result: memberGoal.result_second_touch, unit: "개" },
                          ] : [];
                          const memberWorkItems = memberGoal ? (memberGoal.goal_work_items || []).filter((item: { id: string; text: string; done: boolean }) => item.text.trim().length > 0) : [];
                          return (
                            <div className="rounded-[12px] border p-3" style={{ borderColor: "var(--accent-border)", background: "var(--surface-2)" }}>
                              <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--accent-text)" }}>{expandedDailyMember} 세부내역</p>
                              {!memberGoal ? (
                                <p className="text-[13px]" style={{ color: "var(--text-faint)" }}>오늘 활동목표 미입력</p>
                              ) : memberGoal.is_outside_meeting ? (
                                <div className="rounded-[12px] border p-4" style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}>
                                  <p className="text-[13px] font-semibold">외근(미팅) 체크</p>
                                  <p className="mt-1 text-[12px] font-medium">해당 담당자는 오늘 활동목표 집계 대상에서 제외됩니다.</p>
                                </div>
                              ) : (
                                <>
                                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                    {fields.map((f) => {
                                      const rate = f.goal > 0 ? percent(f.result, f.goal) : 0;
                                      return (
                                        <div key={f.label} className="rounded-[12px] border p-3" style={{ background: "var(--surface-3)", borderColor: "var(--border-subtle)" }}>
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-[12px]" style={{ color: "var(--text-subtle)" }}>{f.label}</p>
                                            <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: rate >= 100 ? "var(--success-bg)" : rate >= 50 ? "var(--warning-bg)" : "var(--surface-3)", color: rate >= 100 ? "var(--success-text)" : rate >= 50 ? "var(--warning-text)" : "var(--text-subtle)" }}>
                                              {f.goal > 0 ? `${rate}%` : "미설정"}
                                            </span>
                                          </div>
                                          <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                                            목표 {f.goal}{f.unit} <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>/ 달성 {f.result}{f.unit}</span>
                                          </p>
                                          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate)}%`, background: rate >= 100 ? "var(--success-border)" : "var(--accent-border)" }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {memberWorkItems.length > 0 && (
                                    <div className="mt-3 rounded-[12px] border p-3" style={{ background: "var(--surface-3)", borderColor: "var(--border-subtle)" }}>
                                      <p className="mb-2 text-[13px]" style={{ color: "var(--text-subtle)", fontWeight: 600 }}>특발성 활동목표</p>
                                      <div className="space-y-1">
                                        {memberWorkItems.map((item: { id: string; text: string; done: boolean }) => (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => toggleMemberWorkItem(expandedDailyMember!, item.id)}
                                            className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-white/[.04]"
                                            style={{ background: "var(--surface-2)" }}
                                          >
                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border" style={{ background: item.done ? "var(--success-bg)" : "var(--surface)", borderColor: item.done ? "var(--success-border)" : "var(--border)", color: "var(--success-text)" }}>
                                              {item.done && <CheckCircle2 size={13} />}
                                            </div>
                                            <span className="text-[13px]" style={{ color: item.done ? "var(--text-faint)" : "var(--text-strong)", textDecoration: item.done ? "line-through" : "none" }}>
                                              {item.text}
                                            </span>
                                            {item.done && <span className="ml-auto text-[12px]" style={{ color: "var(--success-text)" }}>달성</span>}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )
                  ) : (
                    !dailyGoal ? (
                      <EmptyBlock title="오늘 등록된 활동목표가 없습니다" desc="일별활동기록에서 당일 목표를 입력하면 여기에 실시간 반영됩니다." />
                    ) : dailyGoal.is_outside_meeting ? (
                      <div className="p-4">
                        <div className="rounded-[14px] border p-4" style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}>
                          <p className="text-[15px] font-semibold">오늘은 외근(미팅)으로 체크되어 있습니다.</p>
                          <p className="mt-1 text-[13px] font-medium">당일 활동목표 달성률은 외근으로 표시되며 목표 집계에서 제외됩니다.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {dailyActivityFields.map((f) => {
                            const rate = f.goal > 0 ? percent(f.result, f.goal) : 0;
                            return (
                              <div key={f.label} className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[12px]" style={{ color: "var(--text-subtle)" }}>{f.label}</p>
                                  <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: rate >= 100 ? "var(--success-bg)" : rate >= 50 ? "var(--warning-bg)" : "var(--surface-3)", color: rate >= 100 ? "var(--success-text)" : rate >= 50 ? "var(--warning-text)" : "var(--text-subtle)" }}>
                                    {f.goal > 0 ? `${rate}%` : "미설정"}
                                  </span>
                                </div>
                                <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                                  {f.result}{f.unit} <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>/ 목표 {f.goal}{f.unit}</span>
                                </p>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate)}%`, background: rate >= 100 ? "var(--success-border)" : "var(--accent-border)" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {dailyWorkItems.length > 0 && (
                          <div className="mt-3 rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                            <p className="mb-2 text-[13px]" style={{ color: "var(--text-subtle)", fontWeight: 600 }}>특발성 활동목표</p>
                            <div className="space-y-1">
                              {dailyWorkItems.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => toggleWorkItem(item.id)}
                                  className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-white/[.04]"
                                >
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border" style={{ background: item.done ? "var(--success-bg)" : "var(--surface)", borderColor: item.done ? "var(--success-border)" : "var(--border)", color: "var(--success-text)" }}>
                                    {item.done && <CheckCircle2 size={13} />}
                                  </div>
                                  <span className="text-[13px]" style={{ color: item.done ? "var(--text-faint)" : "var(--text-strong)", textDecoration: item.done ? "line-through" : "none" }}>
                                    {item.text}
                                  </span>
                                  {item.done && <span className="ml-auto text-[12px]" style={{ color: "var(--success-text)" }}>달성</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </Panel>
              </div>

              {/* 우측 */}
              <div className="space-y-4">

                {/* 오늘 챙겨야 할 고객: 크리티컬 4종 통합 + 클릭 시 즉시수정 팝업 */}
                <Panel>
                  <PanelTitle icon={AlertTriangle} tone="danger" title="오늘 챙겨야 할 고객" desc="클릭하면 팝업에서 바로 수정 · 파이프라인3 자동 연동" right={<Badge tone={totalCritical > 0 ? "danger" : "muted"}>{totalCritical}건</Badge>} />
                  <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                    <Badge tone={criticalCounts.payment > 0 ? "warning" : "muted"}>결제임박 {criticalCounts.payment}</Badge>
                    <Badge tone={criticalCounts.missing > 0 ? "danger" : "muted"}>결제누락 {criticalCounts.missing}</Badge>
                    <Badge tone={criticalCounts.inactive > 0 ? "warning" : "muted"}>장기미활동 {criticalCounts.inactive}</Badge>
                    <Badge tone={criticalCounts.closing > 0 ? "danger" : "muted"}>클로징지연 {criticalCounts.closing}</Badge>
                  </div>
                  <div className="max-h-[440px] overflow-y-auto p-2">
                    {actionItems.length === 0 ? <EmptyBlock title="오늘 긴급 관리 고객이 없습니다" desc="결제 D-DAY 또는 장기미활동 고객이 생기면 이곳에 표시됩니다." /> : actionItems.map((item) => {
                      const target = contacts.find((row) => Number(row.id) === item.contactId);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => openCustomerEdit(item.contactId, item.type)}
                          className="flex w-full items-start gap-2.5 rounded-[12px] p-2.5 text-left transition-colors hover:bg-white/[.04]"
                        >
                          <IconBox icon={item.tone === "danger" ? AlertTriangle : CalendarClock} tone={item.tone} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge tone={item.tone}>{item.type}</Badge>
                              <p className="truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>
                                {item.title}
                                {target?.title ? <span className="ml-1 text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>· {target.title}</span> : null}
                              </p>
                            </div>
                            <p className="mt-1 line-clamp-1 text-[13px] font-medium" style={{ color: "var(--text-subtle)" }}>{item.desc}</p>
                          </div>
                          <ChevronRight size={13} className="mt-1.5 shrink-0" style={{ color: "var(--text-faint)" }} />
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                {/* 정기결제 D-DAY */}
                <Panel>
                  <PanelTitle icon={CreditCard} tone="warning" title="정기결제 D-DAY" desc={`D-4 이내 ${paymentDueSoonCount}건 · 계약/리텐션 고객 기준`} right={<a href="/pipeline3" className="btn-premium btn-secondary">파이프라인</a>} />
                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {paymentDdays.length === 0 ? <EmptyBlock title="결제일 등록 고객이 없습니다" desc="계약전환 시 결제채널과 결제일을 입력하면 자동으로 계산됩니다." /> : paymentDdays.map(({ contact, day, diff, due }) => (
                      <button key={contact.id} type="button" onClick={() => openCustomerEdit(Number(contact.id), `결제 ${ddayLabel(diff)}`)} className="flex w-full items-center gap-2.5 rounded-[12px] p-2.5 text-left transition-colors hover:bg-white/[.04]">
                        <div className="flex h-10 w-[52px] shrink-0 flex-col items-center justify-center rounded-[10px]" style={{ background: diff === 0 ? "var(--danger-bg)" : diff <= 4 ? "var(--warning-bg)" : "var(--surface-3)", color: diff === 0 ? "var(--danger-text)" : diff <= 4 ? "var(--warning-text)" : "var(--text-subtle)", border: `1px solid ${diff === 0 ? "var(--danger-border)" : diff <= 4 ? "var(--warning-border)" : "var(--border)"}` }}>
                          <span className="text-[12px] font-semibold leading-none">{ddayLabel(diff)}</span>
                          <span className="mt-0.5 text-[11px] font-medium leading-none">{formatDate(toDateKey(due))}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>
                            {contact.name || "고객명 없음"}
                            {contact.title ? <span className="ml-1 text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>· {contact.title}</span> : null}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] font-medium" style={{ color: "var(--text-subtle)" }}>{contact.payment_channel || "결제채널 미입력"} · 매월 {day}일</p>
                        </div>
                        <Badge tone={diff <= 4 ? "warning" : "muted"}>{contactOwner(contact)}</Badge>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 활동량 요약 */}
                <Panel>
                  <PanelTitle icon={PhoneCall} tone="info" title={`${periodPrefix} 활동량 요약`} desc="당월 첫 접촉과 활동노트 기준" />
                  <div className="space-y-2.5 p-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      <StatBox label="첫 접촉 완료" value={`${stats.firstTouch}건`} sub={`TM ${stats.tmCount} · 콜드톡 ${stats.coldTalkCount}`} tone="info" />
                      <StatBox label="활동노트" value={`${monthNotes.length}건`} sub="녹취 요약 · 수동 기록" tone="purple" />
                    </div>
                    <div className="rounded-[12px] border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[13px] font-normal tracking-[-0.01em]" style={{ color: "var(--text)" }}>첫 접촉률</p>
                        <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{percent(stats.firstTouch, monthCustomerDb.length)}%</p>
                      </div>
                      <ProgressBar value={stats.firstTouch} total={monthCustomerDb.length} tone="cyan" />
                    </div>
                  </div>
                </Panel>

                {/* 최근 활동노트 */}
                <Panel>
                  <PanelTitle icon={Clock3} tone="muted" title={`${periodPrefix} 활동노트`} desc="녹취 요약 및 수동 기록" />
                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {monthNotes.length === 0 ? <EmptyBlock title="당월 활동노트가 없습니다" desc="고객 상세 또는 녹취 요약을 통해 활동노트가 쌓이면 표시됩니다." /> : monthNotes.slice(0, 8).map((note) => {
                      const contact = visibleContacts.find((row) => String(row.id) === String(note.contact_id));
                      return (
                        <a key={note.id} href="/contacts" className="flex gap-2.5 rounded-[12px] p-2.5 transition-colors hover:bg-white/[.04]">
                          <IconBox icon={Activity} tone="purple" size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-strong)" }}>{contact?.name || `고객 #${note.contact_id}`}</p>
                              <span className="shrink-0 text-[12px] font-normal" style={{ color: "var(--text-subtle)" }}>{timeAgo(note.created_at || note.note_date)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-relaxed" style={{ color: "var(--text-subtle)" }}>{note.content || "활동노트 내용 없음"}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        )}

        {/* ── 고객 즉시수정 팝업 (파이프라인3 contacts 테이블 직접 갱신 → 상호 연동) ── */}
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="팝업 닫기"
              onClick={() => !savingEdit && setEditTarget(null)}
              className="absolute inset-0 cursor-default backdrop-blur-[2px]"
              style={{ background: "var(--overlay)", animation: "overlayIn 160ms ease-out" }}
            />
            <div
              className="relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] border"
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)", animation: "modalIn 200ms ease-out" }}
            >
              {/* 팝업 헤더 */}
              <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="danger">{editIssue}</Badge>
                    {editTarget.customer_grade ? <Badge tone={isHighValueContact(editTarget) ? "warning" : "success"}>{editTarget.customer_grade}</Badge> : null}
                    {editTarget.intake_route ? <Badge tone="muted">{editTarget.intake_route}</Badge> : null}
                  </div>
                  <h2 className="truncate text-[19px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                    {editTarget.name || "고객명 없음"}
                    {editTarget.title ? <span className="ml-1.5 text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>{editTarget.title}</span> : null}
                  </h2>
                  <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-subtle)" }}>ID {editTarget.id} · {editTarget.phone || "연락처 미입력"} · 담당 {contactOwner(editTarget)}</p>
                </div>
                <button type="button" onClick={() => !savingEdit && setEditTarget(null)} className="btn-premium btn-secondary h-9 w-9 shrink-0 p-0">
                  <X size={15} />
                </button>
              </div>

              {/* 팝업 본문: 모드별 분기 */}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">

                {/* ── 결제임박: 알림 뷰만 ── */}
                {popupMode === "view_only" && (
                  <div className="rounded-[12px] border p-4" style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--warning-text)" }}>결제 예정 알림</p>
                    <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>{paymentLabel(editTarget)}</p>
                    <p className="mt-2 text-[12px]" style={{ color: "var(--text-subtle)" }}>결제채널 또는 결제일 수정이 필요하다면 파이프라인에서 직접 수정하세요.</p>
                  </div>
                )}

                {/* ── 결제누락: 결제정보 입력 팝업 ── */}
                {popupMode === "payment_missing" && (
                  <>
                    <div className="rounded-[12px] border p-3" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)" }}>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--danger-text)" }}>결제채널과 정기결제일을 입력하면 알림이 해제됩니다.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-normal" style={{ color: "var(--text-subtle)" }}>결제채널</span>
                        <select value={editForm.payment_channel} onChange={(e) => setEditForm((prev) => ({ ...prev, payment_channel: e.target.value }))} className="crm-search w-full px-3">
                          <option value="">선택해주세요</option>
                          {PAYMENT_CHANNEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-normal" style={{ color: "var(--text-subtle)" }}>정기결제일</span>
                        <select value={editForm.regular_payment_date} onChange={(e) => setEditForm((prev) => ({ ...prev, regular_payment_date: e.target.value }))} className="crm-search w-full px-3">
                          <option value="">선택해주세요</option>
                          {PAYMENT_DAY_OPTIONS.map((d) => <option key={d} value={String(d)}>매월 {d}일</option>)}
                        </select>
                      </label>
                    </div>
                  </>
                )}

                {/* ── 고객DB 재TM: 활동노트 + 고객감도 + VIP이관 ── */}
                {popupMode === "db_inactive" && (
                  <>
                    {/* 활동노트 */}
                    <label className="block">
                      <span className="mb-1 block text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>활동노트 작성</span>
                      <textarea value={quickNote} onChange={(e) => setQuickNote(e.target.value)} rows={3} placeholder="TM 내용, 고객 반응 등을 기록하세요..." className="crm-search w-full resize-none px-3 py-2" />
                    </label>

                    {/* 고객감도 */}
                    <div>
                      <span className="mb-2 block text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>고객감도</span>
                      <div className="grid grid-cols-3 gap-2">
                        {["재TM진행", "미팅진행", "감도없음"].map((s) => (
                          <button key={s} type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, sensitivity: prev.sensitivity === s ? "" : s }))}
                            className="rounded-[10px] border py-2 text-[13px] font-semibold transition-all"
                            style={{
                              background: editForm.sensitivity === s ? "var(--accent-subtle)" : "var(--surface-2)",
                              borderColor: editForm.sensitivity === s ? "var(--accent-border)" : "var(--border-subtle)",
                              color: editForm.sensitivity === s ? "var(--accent-text)" : "var(--text-muted)",
                            }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* VIP활동DB 이관 섹션 */}
                    <div className="rounded-[14px] border p-3.5" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent-border)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold" style={{ color: "var(--accent-text)" }}>VIP활동DB 이관</p>
                          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-subtle)" }}>고객DB → VIP활동DB로 이관 후 심사를 진행합니다</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowVipTransfer((prev) => !prev)}
                          className="shrink-0 rounded-[10px] border px-3 py-1.5 text-[13px] font-bold transition-all"
                          style={{
                            background: showVipTransfer ? "var(--accent)" : "var(--surface-2)",
                            borderColor: showVipTransfer ? "var(--accent)" : "var(--border-subtle)",
                            color: showVipTransfer ? "#fff" : "var(--text-muted)",
                          }}>
                          {showVipTransfer ? "이관 취소" : "이관 활성화"}
                        </button>
                      </div>

                      {showVipTransfer && (
                        <div className="mt-3 space-y-2 rounded-[10px] border p-3" style={{ background: "var(--surface)", borderColor: "var(--accent-border)" }}>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--accent)", color: "#fff" }}>1</span>
                            <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>저장 시 VIP활동DB로 이관</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--accent)", color: "#fff" }}>2</span>
                            <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                              심사는&nbsp;
                              <a href="/customer-db" className="underline" style={{ color: "var(--accent-text)" }}>고객DB 메뉴</a>
                              &nbsp;→ VIP이관 버튼에서 진행
                            </p>
                          </div>
                          <div className="mt-2 rounded-[8px] p-2.5 text-[12px] font-semibold leading-relaxed" style={{ background: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" }}>
                            이관 후 관리구간: 리드 / 자동등급: 심사미진행
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── 장기미활동(VIP) / 클로징지연: 활동노트 + 단계전환 + 계약전환 ── */}
                {(popupMode === "inactive" || popupMode === "closing") && (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>활동노트 작성</span>
                      <textarea value={quickNote} onChange={(e) => setQuickNote(e.target.value)} rows={4} placeholder="활동 내용, 다음 단계 계획을 기록하세요..." className="crm-search w-full resize-none px-3 py-2" />
                    </label>

                    <div>
                      <span className="mb-2 block text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>관리구간 전환</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {["리드", "프로스펙팅", "딜클로징", "리텐션"].map((stage) => (
                          <button key={stage} type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, management_stage: prev.management_stage === stage ? "" : stage }))}
                            className="rounded-[10px] border py-2 text-[13px] font-semibold transition-all"
                            style={{
                              background: editForm.management_stage === stage ? "var(--accent-subtle)" : "var(--surface-2)",
                              borderColor: editForm.management_stage === stage
                                ? "var(--accent-border)"
                                : stage === "리텐션" ? "var(--success-border)" : "var(--border-subtle)",
                              color: editForm.management_stage === stage
                                ? "var(--accent-text)"
                                : stage === "리텐션" ? "var(--success-text)" : "var(--text-muted)",
                            }}>
                            {stage === "리텐션" ? "계약전환" : stage}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 계약전환 시 결제정보 입력 */}
                    {editForm.management_stage === "리텐션" && (
                      <div className="rounded-[12px] border p-3 space-y-2.5" style={{ background: "var(--success-bg)", borderColor: "var(--success-border)" }}>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--success-text)" }}>계약전환 — 결제정보 입력</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="block">
                            <span className="mb-1 block text-[12px] font-normal" style={{ color: "var(--text-subtle)" }}>결제채널</span>
                            <select value={editForm.payment_channel} onChange={(e) => setEditForm((prev) => ({ ...prev, payment_channel: e.target.value }))} className="crm-search w-full px-3">
                              <option value="">선택해주세요</option>
                              {PAYMENT_CHANNEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[12px] font-normal" style={{ color: "var(--text-subtle)" }}>정기결제일</span>
                            <select value={editForm.regular_payment_date} onChange={(e) => setEditForm((prev) => ({ ...prev, regular_payment_date: e.target.value }))} className="crm-search w-full px-3">
                              <option value="">선택해주세요</option>
                              {PAYMENT_DAY_OPTIONS.map((d) => <option key={d} value={String(d)}>매월 {d}일</option>)}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 팝업 푸터 */}
              <div className="flex items-center justify-between gap-3 border-t px-5 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
                <a href={popupMode === "db_inactive" ? "/customer-db" : "/pipeline3"} className="text-[13px] font-normal" style={{ color: "var(--accent-text)" }}>
                  {popupMode === "db_inactive" ? "고객DB에서 전체보기 →" : "파이프라인에서 전체 상세보기 →"}
                </a>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={savingEdit} onClick={() => setEditTarget(null)} className="btn-premium btn-secondary">닫기</button>
                  {popupMode !== "view_only" && (
                    <button type="button" disabled={savingEdit || (!quickNote.trim() && popupMode === "db_inactive" && !editForm.sensitivity)} onClick={saveCustomerEdit} className="btn-premium btn-primary">
                      {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} 저장
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
