"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Coins,
  Download,
  Edit2,
  History,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";

type VipContact = {
  id: number;
  name: string;
  title: string | null;
  bunyanghoe_number: string | null;
  assigned_to: string | null;
  consultant: string | null;
  meeting_result: string | null;
  bank_holder: string | null;
  bank_code: string | null;
  bank_name: string | null;
  bank_account: string | null;
};

type AdExecution = {
  id: number;
  member_name: string | null;
  bunyanghoe_number: string | null;
  hightarget_mileage: number | null;
  hightarget_reward: number | null;
  hogaengnono_reward: number | null;
  lms_reward: number | null;
  payment_date: string | null;
  contract_route: string | null;
};

type PaymentRecord = {
  id: number;
  contact_id: number;
  member_name: string | null;
  member_number: string | null;
  quarter: string;
  paid_amount: number | null;
  paid_date: string | null;
  is_paid: boolean | null;
  carried_over: number | null;
};

type MileageUsage = {
  id: number;
  contact_id: number;
  usage_date: string;
  usage_amount: number | null;
  memo: string | null;
};

type DetailTab = "overview" | "reward" | "mileage" | "history";

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const PAID_FILTERS = ["지급대상", "지급완료", "미지급", "마일리지보유"];

function fmtWon(n?: number | null) {
  const value = n || 0;
  if (!value) return "0원";
  return `${value.toLocaleString()}원`;
}

function fmtCompact(n?: number | null) {
  const value = n || 0;
  if (!value) return "0원";
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value % 100_000_000 === 0 ? 0 : 1)}억`;
  if (value >= 10_000) return `${Math.floor(value / 10_000).toLocaleString()}만`;
  return `${value.toLocaleString()}원`;
}

function fmtBun(s?: string | null) {
  if (!s) return "-";
  return s.startsWith("B-") ? s : `B-${s}`;
}

function numOrd(s?: string | null) {
  return parseInt((s || "").replace(/[^0-9]/g, ""), 10) || 9999;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentQuarter() {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
}

function getQuarters() {
  const y = new Date().getFullYear();
  return [`${y}-Q1`, `${y}-Q2`, `${y}-Q3`, `${y}-Q4`];
}

function quarterOrder(q: string) {
  const [y, n] = q.split("-Q");
  return Number(y) * 10 + Number(n);
}

function quarterRange(q: string) {
  const [year, quarter] = q.split("-");
  const y = Number(year);
  const map: Record<string, { start: string; end: string }> = {
    Q1: { start: `${y}-01-01`, end: `${y}-03-31` },
    Q2: { start: `${y}-04-01`, end: `${y}-06-30` },
    Q3: { start: `${y}-07-01`, end: `${y}-09-30` },
    Q4: { start: `${y}-10-01`, end: `${y}-12-31` },
  };
  return map[quarter] || { start: "", end: "" };
}

function dueMonth(q: string) {
  const [year, quarter] = q.split("-");
  const y = Number(year);
  const map: Record<string, string> = {
    Q1: `${y}-04`,
    Q2: `${y}-07`,
    Q3: `${y}-10`,
    Q4: `${y + 1}-01`,
  };
  return map[quarter] || "-";
}

function formatDate(value?: string | null) {
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

function moneyInput(value: string) {
  const clean = value.replace(/[^0-9]/g, "");
  return clean ? Number(clean).toLocaleString() : "";
}

function parseMoney(value: string) {
  const clean = value.replace(/[^0-9]/g, "");
  return clean ? Number(clean) : 0;
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#8B7CF6,#A78BFA)",
    "linear-gradient(135deg,#60A5FA,#22D3EE)",
    "linear-gradient(135deg,#34D399,#22C55E)",
    "linear-gradient(135deg,#FBBF24,#FB7185)",
    "linear-gradient(135deg,#C084FC,#F472B6)",
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

function Badge({ children, tone = "muted", icon: Icon }: { children: ReactNode; tone?: string; icon?: ElementType }) {
  const c = toneStyle(tone);
  return (
    <span className="inline-flex h-[23px] items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-bold" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {Icon ? <Icon size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
      {children}
    </span>
  );
}

function PremiumIcon({ icon: Icon, tone = "info" }: { icon: ElementType; tone?: string }) {
  const c = toneStyle(tone);
  return (
    <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      <Icon size={18} />
    </div>
  );
}

function SelectChip({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 min-w-[122px] appearance-none rounded-full border px-3 pr-8 text-[12px] font-bold outline-none" style={{ background: value ? "var(--accent-subtle)" : "var(--surface-2)", borderColor: value ? "var(--accent-border)" : "var(--border)", color: value ? "var(--accent-text)" : "var(--text-muted)" }}>
        <option value="">{placeholder}</option>
        {options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
    </div>
  );
}

function StatCard({ label, value, icon, tone, sub }: { label: string; value: string | number; icon: ElementType; tone: string; sub?: string }) {
  return (
    <div className="premium-card flex h-[82px] items-center gap-4 px-4">
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

export default function RewardsPage() {
  const [contacts, setContacts] = useState<VipContact[]>([]);
  const [executions, setExecutions] = useState<AdExecution[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [mileageUsages, setMileageUsages] = useState<MileageUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [search, setSearch] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fPaid, setFPaid] = useState("");
  const [selected, setSelected] = useState<VipContact | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [mileageAmount, setMileageAmount] = useState("");
  const [mileageDate, setMileageDate] = useState(today());
  const [mileageMemo, setMileageMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const quarters = getQuarters();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [c, e, p, m] = await Promise.all([
      supabase
        .from("contacts")
        .select("id,name,title,bunyanghoe_number,assigned_to,consultant,meeting_result,bank_holder,bank_code,bank_name,bank_account")
        .in("meeting_result", ["계약완료", "예약완료"]),
      supabase
        .from("ad_executions")
        .select("id,member_name,bunyanghoe_number,hightarget_mileage,hightarget_reward,hogaengnono_reward,lms_reward,payment_date,contract_route")
        .eq("contract_route", "분양회"),
      supabase.from("rewards").select("*"),
      supabase.from("mileage_usages").select("*").order("usage_date", { ascending: false }),
    ]);

    if (c.error) console.error("contacts:", c.error.message);
    if (e.error) console.error("ad_executions:", e.error.message);
    if (p.error) console.error("rewards:", p.error.message);
    if (m.error) console.error("mileage_usages:", m.error.message);

    setContacts(((c.data || []) as VipContact[]).sort((a, b) => numOrd(a.bunyanghoe_number) - numOrd(b.bunyanghoe_number)));
    setExecutions((e.data || []) as AdExecution[]);
    setPayments((p.data || []) as PaymentRecord[]);
    setMileageUsages((m.data || []) as MileageUsage[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function execByQuarter(contact: VipContact, q: string) {
    const { start, end } = quarterRange(q);
    const list = executions.filter((row) => {
      if (!row.payment_date || row.payment_date < start || row.payment_date > end) return false;
      return row.member_name === contact.name || (!!contact.bunyanghoe_number && row.bunyanghoe_number === contact.bunyanghoe_number);
    });
    return {
      mileage: list.reduce((sum, row) => sum + (row.hightarget_mileage || 0), 0),
      htReward: list.reduce((sum, row) => sum + (row.hightarget_reward || 0), 0),
      hogReward: list.reduce((sum, row) => sum + (row.hogaengnono_reward || 0), 0),
      lmsReward: list.reduce((sum, row) => sum + (row.lms_reward || 0), 0),
    };
  }

  function carriedOver(contact: VipContact, targetQ: string) {
    const idx = quarters.findIndex((q) => q === targetQ);
    if (idx <= 0) return 0;
    let carried = 0;
    for (let i = 0; i < idx; i += 1) {
      const q = quarters[i];
      const exec = execByQuarter(contact, q);
      const reward = exec.htReward + exec.hogReward + exec.lmsReward;
      const tax = reward > 0 ? Math.floor(reward * 0.033) : 0;
      const payable = reward - tax + carried;
      const paid = payments
        .filter((row) => (row.contact_id === contact.id || row.member_name === contact.name) && row.quarter === q)
        .reduce((sum, row) => sum + (row.paid_amount || 0), 0);
      carried = Math.max(payable - paid, 0);
    }
    return carried;
  }

  function qData(contact: VipContact, q = quarter) {
    const exec = execByQuarter(contact, q);
    const reward = exec.htReward + exec.hogReward + exec.lmsReward;
    const tax = reward > 0 ? Math.floor(reward * 0.033) : 0;
    const carry = carriedOver(contact, q);
    const payable = reward - tax + carry;
    const paidRecords = payments.filter((row) => (row.contact_id === contact.id || row.member_name === contact.name) && row.quarter === q);
    const paid = paidRecords.reduce((sum, row) => sum + (row.paid_amount || 0), 0);
    const balance = Math.max(payable - paid, 0);
    const allQ = quarters.filter((qq) => quarterOrder(qq) <= quarterOrder(q));
    const cumMileage = allQ.reduce((sum, qq) => sum + execByQuarter(contact, qq).mileage, 0);
    const usages = mileageUsages.filter((row) => row.contact_id === contact.id);
    const usedMileage = usages.reduce((sum, row) => sum + (row.usage_amount || 0), 0);
    const mileageBalance = cumMileage - usedMileage;

    return { ...exec, reward, tax, carry, payable, paidRecords, paid, balance, cumMileage, usages, usedMileage, mileageBalance };
  }

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const d = qData(contact);
      const matchSearch = !keyword || [contact.name, contact.title, contact.bunyanghoe_number, contact.assigned_to, contact.consultant, contact.bank_name, contact.bank_account].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      const matchAssigned = !fAssigned || contact.assigned_to === fAssigned;
      const matchPaid =
        !fPaid ||
        (fPaid === "지급대상" && d.payable > 0) ||
        (fPaid === "지급완료" && d.payable > 0 && d.balance === 0) ||
        (fPaid === "미지급" && d.balance > 0) ||
        (fPaid === "마일리지보유" && d.mileageBalance > 0);
      return matchSearch && matchAssigned && matchPaid;
    });
  }, [contacts, search, fAssigned, fPaid, quarter, executions, payments, mileageUsages]);

  const stats = useMemo(() => {
    const list = filtered.map((contact) => qData(contact));
    return {
      members: filtered.length,
      reward: list.reduce((sum, d) => sum + d.reward, 0),
      tax: list.reduce((sum, d) => sum + d.tax, 0),
      payable: list.reduce((sum, d) => sum + d.payable, 0),
      paid: list.reduce((sum, d) => sum + d.paid, 0),
      balance: list.reduce((sum, d) => sum + d.balance, 0),
      mileage: list.reduce((sum, d) => sum + d.mileageBalance, 0),
    };
  }, [filtered, quarter, executions, payments, mileageUsages]);

  const activeFilters = [search, fAssigned, fPaid].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setFAssigned("");
    setFPaid("");
  };

  const openContact = (contact: VipContact, tab: DetailTab = "overview") => {
    setSelected(contact);
    setDetailTab(tab);
    const d = qData(contact);
    setPayAmount(d.balance ? d.balance.toLocaleString() : "");
    setPayDate(today());
    setMileageAmount("");
    setMileageDate(today());
    setMileageMemo("");
  };

  const savePayment = async () => {
    if (!selected) return;
    const amount = parseMoney(payAmount);
    if (!amount) return alert("지급금액을 입력하세요.");
    setSaving(true);
    const { error } = await supabase.from("rewards").insert({
      contact_id: selected.id,
      member_name: selected.name,
      member_number: selected.bunyanghoe_number || "",
      quarter,
      paid_amount: amount,
      paid_date: payDate || today(),
      is_paid: true,
      carried_over: 0,
    });
    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    await fetchAll();
    setPayAmount("");
  };

  const saveMileage = async () => {
    if (!selected) return;
    const amount = parseMoney(mileageAmount);
    if (!amount) return alert("사용 마일리지를 입력하세요.");
    setSaving(true);
    const { error } = await supabase.from("mileage_usages").insert({
      contact_id: selected.id,
      usage_date: mileageDate || today(),
      usage_amount: amount,
      memo: mileageMemo || null,
    });
    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    await fetchAll();
    setMileageAmount("");
    setMileageMemo("");
  };

  const deletePayment = async (id: number) => {
    if (!confirm("지급 기록을 삭제하시겠습니까?")) return;
    await supabase.from("rewards").delete().eq("id", id);
    fetchAll();
  };

  const deleteMileage = async (id: number) => {
    if (!confirm("마일리지 사용 기록을 삭제하시겠습니까?")) return;
    await supabase.from("mileage_usages").delete().eq("id", id);
    fetchAll();
  };

  const exportCsv = () => {
    const headers = ["넘버링", "회원명", "직급", "담당자", "분기", "누적마일리지", "사용마일리지", "잔여마일리지", "하이타겟", "호갱노노", "LMS", "리워드합계", "세금", "이월", "지급가능", "지급완료", "잔여"];
    const lines = filtered.map((contact) => {
      const d = qData(contact);
      return [fmtBun(contact.bunyanghoe_number), contact.name, contact.title || "", contact.assigned_to || "", quarter, d.cumMileage, d.usedMileage, d.mileageBalance, d.htReward, d.hogReward, d.lmsReward, d.reward, d.tax, d.carry, d.payable, d.paid, d.balance];
    });
    const csv = [headers, ...lines].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rewards-${quarter}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Coins size={20} style={{ color: "var(--accent-text)" }} />
            <h1 className="crm-title">리워드 / 마일리지</h1>
          </div>
          <p className="crm-subtitle mt-1">분기별 리워드 지급, 이월액, 마일리지 사용 내역을 관리합니다.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button type="button" onClick={fetchAll} className="btn-premium btn-secondary"><RefreshCw size={14} />새로고침</button>
          <button type="button" onClick={exportCsv} className="btn-premium btn-secondary"><Download size={14} />CSV</button>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="대상 회원" value={stats.members} icon={Users} tone="info" />
          <StatCard label="리워드 합계" value={fmtCompact(stats.reward)} icon={Coins} tone="purple" />
          <StatCard label="세금 3.3%" value={fmtCompact(stats.tax)} icon={ReceiptText} tone="warning" />
          <StatCard label="지급가능" value={fmtCompact(stats.payable)} icon={Wallet} tone="success" />
          <StatCard label="잔여지급" value={fmtCompact(stats.balance)} icon={Send} tone="danger" />
          <StatCard label="잔여마일리지" value={fmtCompact(stats.mileage)} icon={BadgeCheck} tone="cyan" />
        </div>
      </div>

      <div className="premium-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <SelectChip value={quarter} onChange={setQuarter} options={quarters} placeholder="분기" />
        <div className="relative w-full sm:w-[340px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="회원명, 넘버링, 담당자, 계좌 검색..." className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none" />
        </div>
        <SelectChip value={fAssigned} onChange={setFAssigned} options={TEAM} placeholder="담당자" />
        <SelectChip value={fPaid} onChange={setFPaid} options={PAID_FILTERS} placeholder="지급상태" />
        {activeFilters > 0 && <button type="button" onClick={resetFilters} className="btn-premium btn-danger h-8">초기화</button>}
        <span className="ml-auto hidden text-[12px] font-bold md:block" style={{ color: "var(--text-faint)" }}>{filtered.length.toLocaleString()} / {contacts.length.toLocaleString()}명 · 지급월 {dueMonth(quarter)}</span>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? (
          <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center"><div className="premium-card p-8"><EmptyState icon="🪙" title="표시할 리워드 데이터가 없습니다" description="분기 또는 필터 조건을 변경해보세요" /></div></div>
        ) : (
          <>
            <div className="crm-table-wrap hidden h-full overflow-auto xl:block">
              <table className="crm-table min-w-[1580px]">
                <thead>
                  <tr>
                    <th className="w-[270px]">회원</th>
                    <th className="w-[120px]">누적M</th>
                    <th className="w-[120px]">사용M</th>
                    <th className="w-[120px]">잔여M</th>
                    <th className="w-[130px]">하이타겟</th>
                    <th className="w-[130px]">호갱노노</th>
                    <th className="w-[130px]">LMS</th>
                    <th className="w-[140px]">리워드</th>
                    <th className="w-[120px]">세금</th>
                    <th className="w-[120px]">이월</th>
                    <th className="w-[140px]">지급가능</th>
                    <th className="w-[130px]">지급완료</th>
                    <th className="w-[130px]">잔여</th>
                    <th className="w-[90px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contact) => {
                    const d = qData(contact);
                    const rowSelected = selected?.id === contact.id;
                    return (
                      <tr key={contact.id} data-selected={rowSelected ? "true" : "false"} className="cursor-pointer" onClick={() => openContact(contact)}>
                        <td>
                          <div className="crm-row-center gap-3">
                            <div className="crm-avatar" style={{ background: avatarBg(contact.name) }}>{contact.name?.[0] || "회"}</div>
                            <div className="min-w-0">
                              <div className="crm-row-main truncate">{contact.name}</div>
                              <div className="crm-row-sub truncate">{fmtBun(contact.bunyanghoe_number)} · {contact.title || "-"} · {contact.assigned_to || "-"}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="font-bold" style={{ color: "var(--text-muted)" }}>{fmtWon(d.cumMileage)}</span></td>
                        <td><span className="font-bold" style={{ color: "var(--danger-text)" }}>{fmtWon(d.usedMileage)}</span></td>
                        <td><span className="font-bold" style={{ color: d.mileageBalance > 0 ? "var(--cyan-text)" : "var(--text-subtle)" }}>{fmtWon(d.mileageBalance)}</span></td>
                        <td><span className="crm-meta">{fmtWon(d.htReward)}</span></td>
                        <td><span className="crm-meta">{fmtWon(d.hogReward)}</span></td>
                        <td><span className="crm-meta">{fmtWon(d.lmsReward)}</span></td>
                        <td><span className="font-bold" style={{ color: "var(--purple-text)" }}>{fmtWon(d.reward)}</span></td>
                        <td><span className="crm-meta">{fmtWon(d.tax)}</span></td>
                        <td><span className="crm-meta">{fmtWon(d.carry)}</span></td>
                        <td><span className="font-bold" style={{ color: "var(--success-text)" }}>{fmtWon(d.payable)}</span></td>
                        <td><Badge tone={d.paid > 0 ? "success" : "muted"}>{fmtWon(d.paid)}</Badge></td>
                        <td><Badge tone={d.balance > 0 ? "danger" : d.payable > 0 ? "success" : "muted"}>{fmtWon(d.balance)}</Badge></td>
                        <td>
                          <button type="button" onClick={(e) => { e.stopPropagation(); openContact(contact, "reward"); }} className="btn-premium btn-secondary h-8 w-8 p-0"><Edit2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="h-full overflow-y-auto xl:hidden">
              <div className="space-y-3">
                {filtered.map((contact) => {
                  const d = qData(contact);
                  return (
                    <button key={contact.id} type="button" onClick={() => openContact(contact)} className="premium-card premium-card-hover w-full p-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="crm-avatar" style={{ background: avatarBg(contact.name) }}>{contact.name?.[0] || "회"}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2"><p className="crm-row-main truncate">{contact.name}</p><Badge tone={d.balance > 0 ? "danger" : d.payable > 0 ? "success" : "muted"}>{d.balance > 0 ? "미지급" : d.payable > 0 ? "완료" : "대상없음"}</Badge></div>
                          <p className="crm-row-sub mt-0.5 truncate">{fmtBun(contact.bunyanghoe_number)} · {contact.assigned_to || "-"}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div><p className="crm-tiny">리워드</p><p className="mt-1 text-[13px] font-bold" style={{ color: "var(--purple-text)" }}>{fmtCompact(d.reward)}</p></div>
                        <div><p className="crm-tiny">지급가능</p><p className="mt-1 text-[13px] font-bold" style={{ color: "var(--success-text)" }}>{fmtCompact(d.payable)}</p></div>
                        <div><p className="crm-tiny">잔여M</p><p className="mt-1 text-[13px] font-bold" style={{ color: "var(--cyan-text)" }}>{fmtCompact(d.mileageBalance)}</p></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {selected && (
        <>
          <div className="slide-panel-overlay" onClick={() => setSelected(null)} />
          <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
            <div className="slide-panel-header">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="crm-avatar-lg crm-avatar" style={{ background: avatarBg(selected.name) }}>{selected.name?.[0] || "회"}</div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2"><h2 className="truncate text-[22px] font-[780] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{selected.name}</h2><Badge tone="purple">{quarter}</Badge></div>
                    <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>{fmtBun(selected.bunyanghoe_number)} · {selected.title || "직급 없음"} · 담당 {selected.assigned_to || "-"}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge tone="info" icon={User}>{selected.consultant || "컨설턴트 없음"}</Badge>
                      <Badge tone={selected.bank_account ? "success" : "warning"} icon={Wallet}>{selected.bank_account ? "계좌등록" : "계좌확인"}</Badge>
                      <Badge tone="cyan" icon={CalendarDays}>지급월 {dueMonth(quarter)}</Badge>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
              </div>
              <div className="mt-5 flex gap-1.5">
                {[{ key: "overview", label: "개요" }, { key: "reward", label: "지급처리" }, { key: "mileage", label: "마일리지" }, { key: "history", label: "히스토리" }].map((item) => {
                  const active = detailTab === item.key;
                  return <button key={item.key} type="button" onClick={() => setDetailTab(item.key as DetailTab)} className="h-9 rounded-[9px] px-3 text-[12px] font-bold transition-all" style={{ background: active ? "var(--accent-subtle)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-subtle)", border: active ? "1px solid var(--accent-border)" : "1px solid transparent" }}>{item.label}</button>;
                })}
              </div>
            </div>

            <div className="slide-panel-body">
              {(() => {
                const d = qData(selected);
                return (
                  <div className="space-y-6">
                    {detailTab === "overview" && (
                      <>
                        <section className="premium-card p-4">
                          <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Coins} tone="purple" /><div><p className="crm-section-title">분기 리워드 요약</p><p className="crm-tiny">{quarter} 기준 지급 가능 금액</p></div></div>
                          <div className="rounded-[14px] p-4" style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
                            <p className="text-[12px] font-bold" style={{ color: "var(--success-text)" }}>지급가능액</p>
                            <p className="mt-1 text-[30px] font-[780] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>{fmtWon(d.payable)}</p>
                          </div>
                          <Field label="잔여지급"><Badge tone={d.balance > 0 ? "danger" : d.payable > 0 ? "success" : "muted"}>{fmtWon(d.balance)}</Badge></Field>
                          <Field label="지급완료"><Badge tone={d.paid > 0 ? "success" : "muted"}>{fmtWon(d.paid)}</Badge></Field>
                          <Field label="이월액">{fmtWon(d.carry)}</Field>
                          <Field label="세금 3.3%">{fmtWon(d.tax)}</Field>
                        </section>
                        <section className="premium-card p-4">
                          <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Wallet} tone="cyan" /><div><p className="crm-section-title">마일리지 요약</p><p className="crm-tiny">누적·사용·잔여 마일리지</p></div></div>
                          <Field label="누적">{fmtWon(d.cumMileage)}</Field>
                          <Field label="사용">{fmtWon(d.usedMileage)}</Field>
                          <Field label="잔여"><span style={{ color: "var(--cyan-text)" }}>{fmtWon(d.mileageBalance)}</span></Field>
                        </section>
                      </>
                    )}

                    {detailTab === "reward" && (
                      <section className="premium-card p-4">
                        <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Send} tone="success" /><div><p className="crm-section-title">리워드 지급처리</p><p className="crm-tiny">잔여 지급액을 기준으로 지급 기록을 추가합니다</p></div></div>
                        <Field label="지급가능">{fmtWon(d.payable)}</Field>
                        <Field label="지급완료">{fmtWon(d.paid)}</Field>
                        <Field label="잔여지급"><span style={{ color: "var(--danger-text)" }}>{fmtWon(d.balance)}</span></Field>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div><InputLabel>지급일</InputLabel><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none" /></div>
                          <div><InputLabel>지급금액</InputLabel><input value={payAmount} onChange={(e) => setPayAmount(moneyInput(e.target.value))} className="h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none" placeholder="0" /></div>
                        </div>
                        <button type="button" onClick={savePayment} disabled={saving} className="btn-premium btn-primary mt-4 w-full disabled:opacity-50"><Send size={14} />{saving ? "저장 중..." : "지급 기록 저장"}</button>
                      </section>
                    )}

                    {detailTab === "mileage" && (
                      <section className="premium-card p-4">
                        <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Wallet} tone="cyan" /><div><p className="crm-section-title">마일리지 사용처리</p><p className="crm-tiny">회원 마일리지 사용 내역을 기록합니다</p></div></div>
                        <Field label="잔여M"><span style={{ color: "var(--cyan-text)" }}>{fmtWon(d.mileageBalance)}</span></Field>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div><InputLabel>사용일</InputLabel><input type="date" value={mileageDate} onChange={(e) => setMileageDate(e.target.value)} className="h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none" /></div>
                          <div><InputLabel>사용금액</InputLabel><input value={mileageAmount} onChange={(e) => setMileageAmount(moneyInput(e.target.value))} className="h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none" placeholder="0" /></div>
                          <div className="md:col-span-2"><InputLabel>메모</InputLabel><input value={mileageMemo} onChange={(e) => setMileageMemo(e.target.value)} className="h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none" placeholder="사용처 / 비고" /></div>
                        </div>
                        <button type="button" onClick={saveMileage} disabled={saving} className="btn-premium btn-primary mt-4 w-full disabled:opacity-50"><Plus size={14} />{saving ? "저장 중..." : "마일리지 사용 저장"}</button>
                      </section>
                    )}

                    {detailTab === "history" && (
                      <>
                        <section className="premium-card p-4">
                          <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={History} tone="purple" /><div><p className="crm-section-title">지급 히스토리</p><p className="crm-tiny">분기별 지급 기록</p></div></div>
                          <div className="space-y-2">
                            {d.paidRecords.length === 0 ? <p className="crm-tiny">지급 기록이 없습니다.</p> : d.paidRecords.map((row) => (
                              <div key={row.id} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                                <Badge tone="success">{row.quarter}</Badge><span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{fmtWon(row.paid_amount)}</span><span className="crm-tiny ml-auto">{formatDate(row.paid_date)}</span><button type="button" onClick={() => deletePayment(row.id)} className="btn-premium btn-danger h-8 w-8 p-0"><Trash2 size={13} /></button>
                              </div>
                            ))}
                          </div>
                        </section>
                        <section className="premium-card p-4">
                          <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Wallet} tone="cyan" /><div><p className="crm-section-title">마일리지 히스토리</p><p className="crm-tiny">사용 기록</p></div></div>
                          <div className="space-y-2">
                            {d.usages.length === 0 ? <p className="crm-tiny">사용 기록이 없습니다.</p> : d.usages.map((row) => (
                              <div key={row.id} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                                <Badge tone="cyan">{formatDate(row.usage_date)}</Badge><span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{fmtWon(row.usage_amount)}</span><span className="crm-tiny min-w-0 flex-1 truncate">{row.memo || "-"}</span><button type="button" onClick={() => deleteMileage(row.id)} className="btn-premium btn-danger h-8 w-8 p-0"><Trash2 size={13} /></button>
                              </div>
                            ))}
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
