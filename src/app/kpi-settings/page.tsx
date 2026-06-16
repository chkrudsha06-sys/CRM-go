"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  Target, Save, Users, UserCircle, Lock, Calendar,
  RefreshCw, Loader2, CheckCircle2,
} from "lucide-react";

interface KpiRow {
  year: number; month: number; week: number;
  scope: "team" | "execution" | "operation";
  target_name: string;
  recruit_count: number; bunyanghoe_revenue: number; linked_revenue: number;
  special_revenue: number; wanpan_truck_count: number; ad_operation_revenue: number;
}

const EXEC_MEMBERS = ["조계현", "이세호", "기여운", "최연전"];
const OPS_MEMBERS = ["김재영", "최은정"];

const makeEmpty = (
  y: number, m: number, w: number,
  scope: KpiRow["scope"], name: string
): KpiRow => ({
  year: y, month: m, week: w, scope, target_name: name,
  recruit_count: 0, bunyanghoe_revenue: 0, linked_revenue: 0,
  special_revenue: 0, wanpan_truck_count: 0, ad_operation_revenue: 0,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 공통 input
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <input
        type="text" inputMode="numeric"
        value={value ? value.toLocaleString("ko-KR") : ""}
        onChange={(e) => {
          const r = e.target.value.replace(/[^0-9]/g, "");
          onChange(r ? parseInt(r) : 0);
        }}
        placeholder="0"
        className="crm-search h-11 w-full px-3 pr-8 text-right font-normal tabular-nums"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium"
        style={{ color: "var(--text-faint)" }}>원</span>
    </div>
  );
}

function CountInput({ value, onChange, unit }: { value: number; onChange: (v: number) => void; unit: string }) {
  return (
    <div className="relative">
      <input
        type="number" min={0}
        value={value || ""}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        placeholder="0"
        className="crm-search h-11 w-full px-3 pr-10 text-right font-normal tabular-nums"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium"
        style={{ color: "var(--text-faint)" }}>{unit}</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GoalSection — 통일 양식
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type SectionTone = "warning" | "info" | "success";

function GoalSection({
  title, tone, rows, members, scope, onUpdate,
}: {
  title: string;
  tone: SectionTone;
  rows: Record<string, KpiRow>;
  members: string[];
  scope: string;
  onUpdate: (name: string, patch: Partial<KpiRow>) => void;
}) {
  const isTeam = scope === "team";
  const isOps = scope === "operation";

  const toneCfg = {
    warning: { bg: "var(--warning-bg)", text: "var(--warning-text)", border: "var(--warning-border)" },
    info: { bg: "var(--info-bg)", text: "var(--info-text)", border: "var(--info-border)" },
    success: { bg: "var(--success-bg)", text: "var(--success-text)", border: "var(--success-border)" },
  }[tone];

  return (
    <div className="premium-card overflow-hidden">
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--border-subtle)", background: toneCfg.bg }}
      >
        {isTeam ? (
          <Users size={14} style={{ color: toneCfg.text }} />
        ) : (
          <UserCircle size={14} style={{ color: toneCfg.text }} />
        )}
        <p className="text-[13px] font-bold tracking-[-0.01em]" style={{ color: toneCfg.text }}>
          {title}
        </p>
      </div>
      <div className="space-y-3 p-4">
        {members.map((name) => {
          const row = rows[name] || ({} as KpiRow);
          return (
            <div
              key={name}
              className={isTeam ? "" : "rounded-[12px] border p-3"}
              style={isTeam ? {} : { background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
            >
              {!isTeam && (
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ background: toneCfg.bg, color: toneCfg.text, border: `1px solid ${toneCfg.border}` }}
                  >
                    {name[0]}
                  </div>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>{name}</span>
                </div>
              )}
              <div className={`grid ${isOps ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"} gap-3`}>
                {!isOps && (
                  <>
                    <div>
                      <label className="crm-meta mb-1.5 block pl-1 font-normal">분양회 모집</label>
                      <CountInput value={row.recruit_count || 0} onChange={(v) => onUpdate(name, { recruit_count: v })} unit="명" />
                    </div>
                    <div>
                      <label className="crm-meta mb-1.5 block pl-1 font-normal">분양회 매출(회비)</label>
                      <MoneyInput value={row.bunyanghoe_revenue || 0} onChange={(v) => onUpdate(name, { bunyanghoe_revenue: v })} />
                    </div>
                    <div>
                      <label className="crm-meta mb-1.5 block pl-1 font-normal">
                        {isTeam ? "연계매출(하이타겟)" : "연계매출"}
                      </label>
                      <MoneyInput value={row.linked_revenue || 0} onChange={(v) => onUpdate(name, { linked_revenue: v })} />
                    </div>
                    {isTeam && (
                      <>
                        <div>
                          <label className="crm-meta mb-1.5 block pl-1 font-normal">특전매출목표</label>
                          <MoneyInput value={row.special_revenue || 0} onChange={(v) => onUpdate(name, { special_revenue: v })} />
                        </div>
                        <div>
                          <label className="crm-meta mb-1.5 block pl-1 font-normal">완판트럭</label>
                          <CountInput value={row.wanpan_truck_count || 0} onChange={(v) => onUpdate(name, { wanpan_truck_count: v })} unit="건" />
                        </div>
                      </>
                    )}
                  </>
                )}
                {isOps && (
                  <div>
                    <label className="crm-meta mb-1.5 block pl-1 font-normal">광고특전운영매출</label>
                    <MoneyInput value={row.ad_operation_revenue || 0} onChange={(v) => onUpdate(name, { ad_operation_revenue: v })} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 페이지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function KpiSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selWeek, setSelWeek] = useState(1);

  const [mTeam, setMTeam] = useState<Record<string, KpiRow>>({});
  const [mExec, setMExec] = useState<Record<string, KpiRow>>({});
  const [mOps, setMOps] = useState<Record<string, KpiRow>>({});
  const [wTeam, setWTeam] = useState<Record<string, KpiRow>>({});
  const [wExec, setWExec] = useState<Record<string, KpiRow>>({});
  const [wOps, setWOps] = useState<Record<string, KpiRow>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    setAuthChecked(true);
    if (!u || u.role !== "admin") setTimeout(() => router.push("/"), 1500);
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: mData } = await supabase.from("kpi_settings").select("*").eq("year", year).eq("month", month).eq("week", 0);
    const mRows = (mData || []) as KpiRow[];
    const mt: Record<string, KpiRow> = {};
    mt["team"] = mRows.find((r) => r.scope === "team") || makeEmpty(year, month, 0, "team", "team");
    setMTeam(mt);
    const me: Record<string, KpiRow> = {};
    EXEC_MEMBERS.forEach((n) => { me[n] = mRows.find((r) => r.scope === "execution" && r.target_name === n) || makeEmpty(year, month, 0, "execution", n); });
    setMExec(me);
    const mo: Record<string, KpiRow> = {};
    OPS_MEMBERS.forEach((n) => { mo[n] = mRows.find((r) => r.scope === "operation" && r.target_name === n) || makeEmpty(year, month, 0, "operation", n); });
    setMOps(mo);

    const { data: wData } = await supabase.from("kpi_settings").select("*").eq("year", year).eq("month", month).eq("week", selWeek);
    const wRows = (wData || []) as KpiRow[];
    const wt: Record<string, KpiRow> = {};
    wt["team"] = wRows.find((r) => r.scope === "team") || makeEmpty(year, month, selWeek, "team", "team");
    setWTeam(wt);
    const we: Record<string, KpiRow> = {};
    EXEC_MEMBERS.forEach((n) => { we[n] = wRows.find((r) => r.scope === "execution" && r.target_name === n) || makeEmpty(year, month, selWeek, "execution", n); });
    setWExec(we);
    const wo: Record<string, KpiRow> = {};
    OPS_MEMBERS.forEach((n) => { wo[n] = wRows.find((r) => r.scope === "operation" && r.target_name === n) || makeEmpty(year, month, selWeek, "operation", n); });
    setWOps(wo);

    setLoading(false);
  }, [year, month, selWeek]);

  useEffect(() => {
    if (user?.role === "admin") loadData();
  }, [user, loadData]);

  const handleSave = async () => {
    setSaving(true);
    const strip = (row: any, y: number, m: number, w: number, s: string, tn: string) => {
      const { id, ...rest } = row;
      return { ...rest, year: y, month: m, week: w, scope: s, target_name: tn };
    };
    const allRows: any[] = [
      strip(mTeam["team"], year, month, 0, "team", "team"),
      ...EXEC_MEMBERS.map((n) => strip(mExec[n], year, month, 0, "execution", n)),
      ...OPS_MEMBERS.map((n) => strip(mOps[n], year, month, 0, "operation", n)),
      strip(wTeam["team"], year, month, selWeek, "team", "team"),
      ...EXEC_MEMBERS.map((n) => strip(wExec[n], year, month, selWeek, "execution", n)),
      ...OPS_MEMBERS.map((n) => strip(wOps[n], year, month, selWeek, "operation", n)),
    ];
    const { error } = await supabase.from("kpi_settings").upsert(allRows, { onConflict: "year,month,week,scope,target_name" });
    setSaving(false);
    if (error) {
      alert("저장 실패: " + error.message);
    } else {
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      setTimeout(() => setSavedAt(""), 3000);
    }
  };

  if (!authChecked) {
    return (
      <div className="premium-page flex h-full items-center justify-center">
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--accent-text)" }} />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="premium-page flex h-full flex-col items-center justify-center">
        <Lock size={40} className="mb-3" style={{ color: "var(--text-faint)", opacity: 0.5 }} />
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>관리자만 접근 가능</p>
      </div>
    );
  }

  const weekRangeText = (() => {
    const ld = new Date(year, month, 0).getDate();
    const s = (selWeek - 1) * 7 + 1;
    const e = Math.min(selWeek * 7, ld);
    return `${month}/${s}일 ~ ${month}/${e}일`;
  })();

  return (
    <div className="premium-page mx-auto w-full max-w-[1920px] px-4 pb-12 pt-6 md:px-6 2xl:px-8">

      {/* ─── 헤더 ─── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border"
            style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}>
            <Target size={16} />
          </div>
          <div>
            <h1 className="crm-title">KPI 설정</h1>
            <p className="crm-subtitle mt-0.5">{year}년 {month}월 · 월간 및 주간 목표 관리 · 관리자 전용</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
            className="crm-search h-10 w-[90px] px-3 font-normal">
            {[2025, 2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
            className="crm-search h-10 w-[90px] px-3 font-normal">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
          {savedAt && (
            <span className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" }}>
              <CheckCircle2 size={12} /> {savedAt} 저장됨
            </span>
          )}
          <button onClick={handleSave} disabled={saving || loading}
            className="btn-premium btn-primary h-10">
            <Save size={14} />
            {saving ? "저장 중..." : "전체 저장"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin" size={28} style={{ color: "var(--accent-text)" }} />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">

          {/* ═══ 좌측: 월간 목표 ═══ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <Calendar size={15} style={{ color: "var(--warning-text)" }} />
                <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>월간 목표</h2>
                <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{year}년 {month}월</span>
              </div>
              <button
                onClick={() => {
                  setMTeam({ "team": makeEmpty(year, month, 0, "team", "team") });
                  const me: Record<string, KpiRow> = {};
                  EXEC_MEMBERS.forEach((n) => { me[n] = makeEmpty(year, month, 0, "execution", n); });
                  setMExec(me);
                  const mo: Record<string, KpiRow> = {};
                  OPS_MEMBERS.forEach((n) => { mo[n] = makeEmpty(year, month, 0, "operation", n); });
                  setMOps(mo);
                }}
                className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[11px] font-normal transition-all"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-subtle)" }}
              >
                <RefreshCw size={11} /> 초기화
              </button>
            </div>

            <GoalSection title="대협팀 전체" tone="warning"
              rows={mTeam} members={["team"]} scope="team"
              onUpdate={(_, p) => setMTeam({ ...mTeam, team: { ...mTeam["team"], ...p } })} />

            <GoalSection title="실행파트 개인별" tone="info"
              rows={mExec} members={EXEC_MEMBERS} scope="execution"
              onUpdate={(n, p) => setMExec({ ...mExec, [n]: { ...mExec[n], ...p } })} />

            <GoalSection title="운영파트 개인별" tone="success"
              rows={mOps} members={OPS_MEMBERS} scope="operation"
              onUpdate={(n, p) => setMOps({ ...mOps, [n]: { ...mOps[n], ...p } })} />
          </div>

          {/* ═══ 우측: 주간 목표 ═══ */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <Calendar size={15} style={{ color: "var(--info-text)" }} />
                <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>주간 목표</h2>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((w) => {
                    const active = selWeek === w;
                    return (
                      <button key={w} onClick={() => setSelWeek(w)}
                        className="rounded-[8px] border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                        style={{
                          background: active ? "var(--accent-subtle)" : "var(--surface-2)",
                          borderColor: active ? "var(--accent-border)" : "var(--border)",
                          color: active ? "var(--accent-text)" : "var(--text-subtle)",
                        }}>
                        {w}주차
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] font-semibold" style={{ color: "var(--info-text)" }}>{weekRangeText}</span>
              </div>
              <button
                onClick={() => {
                  setWTeam({ "team": makeEmpty(year, month, selWeek, "team", "team") });
                  const we: Record<string, KpiRow> = {};
                  EXEC_MEMBERS.forEach((n) => { we[n] = makeEmpty(year, month, selWeek, "execution", n); });
                  setWExec(we);
                  const wo: Record<string, KpiRow> = {};
                  OPS_MEMBERS.forEach((n) => { wo[n] = makeEmpty(year, month, selWeek, "operation", n); });
                  setWOps(wo);
                }}
                className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[11px] font-normal transition-all"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-subtle)" }}
              >
                <RefreshCw size={11} /> 초기화
              </button>
            </div>

            <GoalSection title={`대협팀 전체 (${selWeek}주차)`} tone="warning"
              rows={wTeam} members={["team"]} scope="team"
              onUpdate={(_, p) => setWTeam({ ...wTeam, team: { ...wTeam["team"], ...p } })} />

            <GoalSection title={`실행파트 (${selWeek}주차)`} tone="info"
              rows={wExec} members={EXEC_MEMBERS} scope="execution"
              onUpdate={(n, p) => setWExec({ ...wExec, [n]: { ...wExec[n], ...p } })} />

            <GoalSection title={`운영파트 (${selWeek}주차)`} tone="success"
              rows={wOps} members={OPS_MEMBERS} scope="operation"
              onUpdate={(n, p) => setWOps({ ...wOps, [n]: { ...wOps[n], ...p } })} />
          </div>
        </div>
      )}
    </div>
  );
}
