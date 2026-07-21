"use client";

import { supabase } from "@/lib/supabase";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, MapPin, RefreshCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SiteMove = {
  id: number;
  contact_id: number;
  current_site: string | null;
  destination_site: string;
  destination_region: string | null;
  planned_move_date: string;
  move_status: string;
  is_confirmed: boolean;
  memo: string | null;
  created_by: string | null;
  created_at: string;
};

type Contact = {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  closing_owner: string | null;
  sourcing_owner: string | null;
  assigned_to: string | null;
  managed_customer_grade: string | null;
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date: Date) {
  return dateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthEnd(date: Date) {
  return dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`premium-card ${className}`}>{children}</div>;
}

function Pill({ children, confirmed = false }: { children: React.ReactNode; confirmed?: boolean }) {
  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ background: confirmed ? "var(--success-bg)" : "var(--warning-bg)", color: confirmed ? "var(--success-text)" : "var(--warning-text)", borderColor: confirmed ? "var(--success-border)" : "var(--warning-border)" }}>
      {children}
    </span>
  );
}

export default function SiteCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [moves, setMoves] = useState<SiteMove[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const moveRes = await supabase
      .from("customer_site_moves")
      .select("*")
      .gte("planned_move_date", monthStart(currentMonth))
      .lte("planned_move_date", monthEnd(currentMonth))
      .order("planned_move_date", { ascending: true })
      .limit(5000);
    const moveRows = (moveRes.data || []) as SiteMove[];
    const ids = Array.from(new Set(moveRows.map((row) => row.contact_id)));
    const contactRes = ids.length
      ? await supabase.from("contacts").select("id,name,title,phone,closing_owner,sourcing_owner,assigned_to,managed_customer_grade").in("id", ids)
      : { data: [], error: null };
    if (moveRes.error) console.error(moveRes.error);
    setMoves(moveRows);
    setContacts((contactRes.data || []) as Contact[]);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    void fetchData();
    const channel = supabase.channel("site-calendar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_site_moves" }, () => void fetchData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchData]);

  const contactMap = useMemo(() => new Map(contacts.map((row) => [row.id, row])), [contacts]);
  const owners = useMemo(() => Array.from(new Set(contacts.map((row) => row.closing_owner).filter(Boolean) as string[])).sort(), [contacts]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return moves.filter((move) => {
      const contact = contactMap.get(move.contact_id);
      const keywordMatch = !keyword || [contact?.name, contact?.title, move.current_site, move.destination_site, move.destination_region, contact?.closing_owner].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      const statusMatch = !statusFilter || move.move_status === statusFilter;
      const ownerMatch = !ownerFilter || contact?.closing_owner === ownerFilter;
      return keywordMatch && statusMatch && ownerMatch;
    });
  }, [contactMap, moves, ownerFilter, search, statusFilter]);

  const days = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const last = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const result: Array<{ key: string; date: Date; inMonth: boolean }> = [];
    const cursor = new Date(first);
    cursor.setDate(cursor.getDate() - first.getDay());
    while (result.length < 42) {
      result.push({ key: dateKey(cursor), date: new Date(cursor), inMonth: cursor.getMonth() === currentMonth.getMonth() });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (result[35].date > last && result.slice(35).every((item) => !item.inMonth)) return result.slice(0, 35);
    return result;
  }, [currentMonth]);

  const selectedMoves = filtered.filter((row) => row.planned_move_date === selectedDate);

  return (
    <main className="space-y-5 p-4 md:p-6 xl:p-8">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div><div className="mb-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--purple-bg)", color: "var(--purple-text)", borderColor: "var(--purple-border)" }}>MANAGED CUSTOMER MOVE</div><h1 className="text-[28px] font-[820] tracking-[-0.045em]" style={{ color: "var(--text-strong)" }}>현장캘린더</h1><p className="crm-subtitle mt-1">관리고객의 현장이동 예정일과 이동 현장을 월간 기준으로 확인합니다.</p></div>
        <div className="flex gap-2"><a href="/managed-customers" className="btn-premium btn-secondary h-10">관리고객</a><button onClick={() => void fetchData()} className="btn-premium btn-secondary h-10"><RefreshCcw size={15} /> 새로고침</button></div>
      </section>

      <Card className="p-4"><div className="grid gap-3 xl:grid-cols-[1fr_150px_170px]"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명, 이동현장, 지역 검색" className="h-10 w-full rounded-[10px] border pl-9 pr-3 text-[13px] font-semibold outline-none" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }} /></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-[10px] border px-3 text-[13px] font-semibold outline-none" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}><option value="">상태 전체</option>{["계획", "조율중", "확정", "이동완료", "취소", "연기"].map((v) => <option key={v}>{v}</option>)}</select><select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="h-10 rounded-[10px] border px-3 text-[13px] font-semibold outline-none" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-strong)" }}><option value="">담당자 전체</option>{owners.map((v) => <option key={v}>{v}</option>)}</select></div></Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}><button onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="btn-premium btn-secondary h-9 w-9 p-0"><ChevronLeft size={16} /></button><div className="flex items-center gap-2"><CalendarDays size={17} style={{ color: "var(--accent-text)" }} /><h2 className="text-[16px] font-[820]" style={{ color: "var(--text-strong)" }}>{monthLabel(currentMonth)}</h2></div><button onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="btn-premium btn-secondary h-9 w-9 p-0"><ChevronRight size={16} /></button></div>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border-subtle)" }}>{["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day} className="py-2 text-center text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{day}</div>)}</div>
          {loading ? <div className="flex h-[520px] items-center justify-center"><Loader2 className="animate-spin" /></div> : <div className="grid grid-cols-7">{days.map((day) => {
            const dayMoves = filtered.filter((move) => move.planned_move_date === day.key);
            return <button key={day.key} type="button" onClick={() => setSelectedDate(day.key)} className="min-h-[112px] border-b border-r p-2 text-left transition hover:brightness-110" style={{ borderColor: "var(--border-subtle)", background: selectedDate === day.key ? "var(--accent-subtle)" : "transparent", opacity: day.inMonth ? 1 : 0.42 }}><div className="flex items-center justify-between"><span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{day.date.getDate()}</span>{dayMoves.length > 0 && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}>{dayMoves.length}</span>}</div><div className="mt-2 space-y-1">{dayMoves.slice(0, 3).map((move) => { const contact = contactMap.get(move.contact_id); return <div key={move.id} className="truncate rounded-[7px] px-2 py-1 text-[10px] font-bold" style={{ background: move.is_confirmed ? "var(--success-bg)" : "var(--warning-bg)", color: move.is_confirmed ? "var(--success-text)" : "var(--warning-text)" }}>{contact?.name || "고객"} → {move.destination_site}</div>; })}{dayMoves.length > 3 && <p className="text-[9px]" style={{ color: "var(--text-faint)" }}>+{dayMoves.length - 3}건</p>}</div></button>;
          })}</div>}
        </Card>

        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="crm-tiny">선택일</p><h3 className="mt-1 text-[18px] font-[820]" style={{ color: "var(--text-strong)" }}>{selectedDate}</h3></div><Pill confirmed>{selectedMoves.length}건</Pill></div><div className="mt-4 space-y-3">{selectedMoves.length === 0 ? <div className="py-16 text-center"><MapPin className="mx-auto mb-3" style={{ color: "var(--text-faint)" }} /><p className="text-[12px]" style={{ color: "var(--text-faint)" }}>등록된 현장이동 일정이 없습니다.</p></div> : selectedMoves.map((move) => { const contact = contactMap.get(move.contact_id); return <a key={move.id} href={`/managed-customers?contact=${move.contact_id}`} className="block rounded-[14px] border p-4 transition hover:brightness-110" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)" }}><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Pill confirmed={move.is_confirmed}>{move.move_status}</Pill><span className="text-[12px] font-bold" style={{ color: "var(--text-strong)" }}>{contact?.name || "고객"}</span></div><span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{contact?.closing_owner || "담당자 미정"}</span></div><p className="mt-3 text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{move.current_site || "현재현장 미입력"} → {move.destination_site}</p><p className="mt-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>{contact?.title || "직급 미입력"} · {move.destination_region || "지역 미입력"}</p>{move.memo && <p className="mt-2 line-clamp-2 text-[11px]" style={{ color: "var(--text-faint)" }}>{move.memo}</p>}</a>; })}</div></Card>
      </div>
    </main>
  );
}
