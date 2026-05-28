"use client";

import EmptyState from "@/components/EmptyState";
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

const CHANNELS = ["LMS", "호갱노노", "네이버", "카카오", "구글", "메타", "유튜브", "기타"];
const CONTRACT_ROUTES = ["분양회", "연계매출", "광고매출", "기타"];
const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const CONSULTANTS = ["박경화", "박혜은", "조승현", "박민경", "백선중", "강아름", "전정훈", "박나라"];

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

function SalesMobileCard({ item, selected, onClick }: { item: AdExecution; selected: boolean; onClick: () => void }) {
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
    </button>
  );
}

function DetailSlidePanel({ item, tab, onTab, onClose, onEdit }: { item: AdExecution; tab: DetailTab; onTab: (tab: DetailTab) => void; onClose: () => void; onEdit: (item: AdExecution) => void }) {
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
        <div className="slide-panel-footer"><button type="button" onClick={() => onEdit(item)} className="btn-premium btn-primary w-full"><Edit2 size={14} />매출 정보 수정</button></div>
      </aside>
    </>
  );
}

export default function SalesPage() {
  const [rows, setRows] = useState<AdExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AdExecution | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [showModal, setShowModal] = useState(false);
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
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0"><div className="flex items-center gap-2"><CreditCard size={20} style={{ color: "var(--accent-text)" }} /><h1 className="crm-title">통합매출관리</h1></div><p className="crm-subtitle mt-1">광고 집행, 분양회 매출, 연계매출, 환불 반영 실매출을 통합 관리합니다.</p></div>
        <div className="flex flex-shrink-0 items-center gap-2"><button type="button" onClick={fetchRows} className="btn-premium btn-secondary"><RefreshCw size={14} />새로고침</button><button type="button" onClick={exportCsv} className="btn-premium btn-secondary"><Download size={14} />CSV</button><button type="button" onClick={openAdd} className="btn-premium btn-primary"><Plus size={14} />매출 등록</button></div>
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

      <div className="premium-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-full border px-3 text-[13px] font-bold outline-none" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="relative w-full sm:w-[340px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명, 채널, 담당자, 메모 검색..." className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none" /></div>
        <SelectChip value={fRoute} onChange={setFRoute} options={CONTRACT_ROUTES} placeholder="계약경로" />
        <SelectChip value={fChannel} onChange={setFChannel} options={CHANNELS} placeholder="채널" />
        <SelectChip value={fTeam} onChange={setFTeam} options={TEAM} placeholder="담당자" />
        <SelectChip value={fConsultant} onChange={setFConsultant} options={CONSULTANTS} placeholder="컨설턴트" />
        {activeFilters > 0 && <button type="button" onClick={resetFilters} className="btn-premium btn-danger h-8">초기화</button>}
        <span className="ml-auto hidden text-[12px] font-bold md:block" style={{ color: "var(--text-faint)" }}>{filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()}건</span>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div> : filteredRows.length === 0 ? <div className="flex h-full items-center justify-center"><div className="premium-card p-8"><EmptyState icon="💳" title="표시할 매출 데이터가 없습니다" description="월 또는 필터 조건을 변경하거나 새 매출을 등록하세요" actionLabel="매출 등록" onAction={openAdd} /></div></div> : (
          <div className="grid h-full gap-5 xl:grid-cols-[1fr_310px]">
            <section className="min-h-0 overflow-hidden">
              <div className="crm-table-wrap hidden h-full overflow-auto xl:block">
                <table className="crm-table min-w-[1380px]"><thead><tr><th className="w-[270px]">고객명</th><th className="w-[120px]">결제일</th><th className="w-[120px]">채널</th><th className="w-[120px]">계약경로</th><th className="w-[150px]">집행금액</th><th className="w-[150px]">VAT금액</th><th className="w-[140px]">환불금액</th><th className="w-[160px]">실매출</th><th className="w-[120px]">담당자</th><th className="w-[120px]">컨설턴트</th><th className="w-[80px]"></th></tr></thead><tbody>
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
                    <td><button type="button" onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="btn-premium btn-secondary h-8 w-8 p-0"><Edit2 size={13} /></button></td>
                  </tr>)}
                </tbody></table>
              </div>
              <div className="h-full overflow-y-auto xl:hidden"><div className="space-y-3">{filteredRows.map((row) => <SalesMobileCard key={row.id} item={row} selected={selectedItem?.id === row.id} onClick={() => { setSelectedItem(row); setDetailTab("overview"); }} />)}</div></div>
            </section>
            <aside className="hidden min-h-0 xl:block"><div className="space-y-4"><section className="premium-card p-4"><div className="mb-4 flex items-center gap-2"><PremiumIcon icon={BarChart3} tone="success" /><div><p className="crm-section-title">계약경로별</p><p className="crm-tiny">현재 필터 기준</p></div></div><div className="space-y-2">{routeStats.length === 0 ? <p className="crm-tiny">데이터 없음</p> : routeStats.map((item) => { const max = Math.max(...routeStats.map((x) => x.amount), 1); const width = Math.max((item.amount / max) * 100, 4); return <div key={item.route}><div className="mb-1 flex items-center justify-between gap-2"><Badge tone={routeTone(item.route)}>{item.route}</Badge><span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{money(item.amount)}</span></div><div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}><div className="h-full rounded-full" style={{ width: `${width}%`, background: toneStyle(routeTone(item.route)).dot }} /></div></div>; })}</div></section><section className="premium-card p-4"><div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Filter} tone="purple" /><div><p className="crm-section-title">채널별 매출</p><p className="crm-tiny">상위 채널</p></div></div><div className="space-y-2">{channelStats.length === 0 ? <p className="crm-tiny">데이터 없음</p> : channelStats.map((item) => <div key={item.channel} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}><Badge tone={channelTone(item.channel)}>{item.channel}</Badge><span className="crm-tiny">{item.count}건</span><span className="ml-auto text-[13px] font-bold" style={{ color: "var(--text)" }}>{money(item.amount)}</span></div>)}</div></section></div></aside>
          </div>
        )}
      </main>

      {selectedItem && <DetailSlidePanel item={selectedItem} tab={detailTab} onTab={setDetailTab} onClose={() => setSelectedItem(null)} onEdit={openEdit} />}

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
