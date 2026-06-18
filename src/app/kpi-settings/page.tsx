"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Target,
  UserCircle,
  Users,
  WalletCards,
} from "lucide-react";

interface KpiRow {
  id?: number;
  year: number;
  month: number;
  week: number;
  scope: "team" | "execution" | "operation";
  target_name: string;
  recruit_count: number;
  master_count: number;
  challenger_count: number;
  bronze_count: number;
  bunyanghoe_revenue: number;
  linked_revenue: number;
  special_revenue: number;
  wanpan_truck_count: number;
  ad_operation_revenue: number;
}

type SectionTone = "warning" | "info" | "success" | "purple";

const EXEC_MEMBERS = ["조계현", "이세호", "기여운", "최연전"];
const OPS_MEMBERS = ["김재영", "최은정"];

function makeEmpty(
  year: number,
  month: number,
  scope: KpiRow["scope"],
  targetName: string,
): KpiRow {
  return {
    year,
    month,
    week: 0,
    scope,
    target_name: targetName,
    recruit_count: 0,
    master_count: 0,
    challenger_count: 0,
    bronze_count: 0,
    bunyanghoe_revenue: 0,
    linked_revenue: 0,
    special_revenue: 0,
    wanpan_truck_count: 0,
    ad_operation_revenue: 0,
  };
}

function buildInitialMaps(year: number, month: number) {
  const exec: Record<string, KpiRow> = {};
  EXEC_MEMBERS.forEach((name) => {
    exec[name] = makeEmpty(year, month, "execution", name);
  });

  const ops: Record<string, KpiRow> = {};
  OPS_MEMBERS.forEach((name) => {
    ops[name] = makeEmpty(year, month, "operation", name);
  });

  return { exec, ops };
}

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(
  row: Partial<KpiRow> | null | undefined,
  year: number,
  month: number,
  scope: KpiRow["scope"],
  targetName: string,
): KpiRow {
  const base = makeEmpty(year, month, scope, targetName);
  const merged = { ...base, ...(row || {}) } as KpiRow;

  return {
    ...merged,
    year,
    month,
    week: 0,
    scope,
    target_name: targetName,
    recruit_count: toNumber(merged.recruit_count),
    master_count: toNumber(merged.master_count),
    challenger_count: toNumber(merged.challenger_count),
    bronze_count: toNumber(merged.bronze_count),
    bunyanghoe_revenue: toNumber(merged.bunyanghoe_revenue),
    linked_revenue: toNumber(merged.linked_revenue),
    special_revenue: toNumber(merged.special_revenue),
    wanpan_truck_count: toNumber(merged.wanpan_truck_count),
    ad_operation_revenue: toNumber(merged.ad_operation_revenue),
  };
}

function toneCfg(tone: SectionTone) {
  const map: Record<SectionTone, { bg: string; text: string; border: string }> = {
    warning: {
      bg: "var(--warning-bg)",
      text: "var(--warning-text)",
      border: "var(--warning-border)",
    },
    info: {
      bg: "var(--info-bg)",
      text: "var(--info-text)",
      border: "var(--info-border)",
    },
    success: {
      bg: "var(--success-bg)",
      text: "var(--success-text)",
      border: "var(--success-border)",
    },
    purple: {
      bg: "var(--purple-bg)",
      text: "var(--purple-text)",
      border: "var(--purple-border)",
    },
  };

  return map[tone];
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value ? value.toLocaleString("ko-KR") : ""}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^0-9]/g, "");
          onChange(raw ? Number(raw) : 0);
        }}
        placeholder="0"
        className="crm-search h-11 w-full px-3 pr-9 text-right font-normal tabular-nums"
      />
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium"
        style={{ color: "var(--text-faint)" }}
      >
        원
      </span>
    </div>
  );
}

function CountInput({
  value,
  onChange,
  unit = "명",
}: {
  value: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        value={value || ""}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        placeholder="0"
        className="crm-search h-11 w-full px-3 pr-10 text-right font-normal tabular-nums"
      />
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium"
        style={{ color: "var(--text-faint)" }}
      >
        {unit}
      </span>
    </div>
  );
}

function SectionHeader({
  title,
  desc,
  tone,
  icon: Icon,
}: {
  title: string;
  desc: string;
  tone: SectionTone;
  icon: LucideIcon;
}) {
  const c = toneCfg(tone);

  return (
    <div
      className="flex items-start gap-3 border-b px-4 py-3"
      style={{ borderColor: "var(--border-subtle)", background: c.bg }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-[11px] border"
        style={{
          borderColor: c.border,
          color: c.text,
          background: "var(--surface)",
        }}
      >
        <Icon size={16} />
      </div>
      <div>
        <p
          className="text-[15px] font-semibold tracking-[-0.02em]"
          style={{ color: c.text }}
        >
          {title}
        </p>
        <p
          className="mt-0.5 text-[12px] font-medium leading-relaxed"
          style={{ color: "var(--text-subtle)" }}
        >
          {desc}
        </p>
      </div>
    </div>
  );
}

function TeamGoalSection({
  row,
  onUpdate,
}: {
  row: KpiRow;
  onUpdate: (patch: Partial<KpiRow>) => void;
}) {
  return (
    <section className="premium-card overflow-hidden">
      <SectionHeader
        title="대협팀 전체"
        desc="월간 전체 목표만 설정합니다. 주간 목표는 사용하지 않습니다."
        tone="warning"
        icon={Users}
      />
      <div className="grid gap-3 p-4 md:grid-cols-3">
        <div>
          <label className="crm-meta mb-1.5 block pl-1 font-normal">
            분양회 모집
          </label>
          <CountInput
            value={row.recruit_count || 0}
            onChange={(value) => onUpdate({ recruit_count: value })}
          />
        </div>
        <div>
          <label className="crm-meta mb-1.5 block pl-1 font-normal">
            분양회 매출(회비)
          </label>
          <MoneyInput
            value={row.bunyanghoe_revenue || 0}
            onChange={(value) => onUpdate({ bunyanghoe_revenue: value })}
          />
        </div>
        <div>
          <label className="crm-meta mb-1.5 block pl-1 font-normal">
            광고특전운영매출
          </label>
          <MoneyInput
            value={row.ad_operation_revenue || 0}
            onChange={(value) => onUpdate({ ad_operation_revenue: value })}
          />
        </div>
      </div>
    </section>
  );
}

function ExecGoalCard({
  name,
  row,
  onUpdate,
}: {
  name: string;
  row: KpiRow;
  onUpdate: (patch: Partial<KpiRow>) => void;
}) {
  const safeRow = row || makeEmpty(new Date().getFullYear(), new Date().getMonth() + 1, "execution", name);
  const gradeTotal =
    (safeRow.master_count || 0) +
    (safeRow.challenger_count || 0) +
    (safeRow.bronze_count || 0);

  return (
    <div
      className="rounded-[14px] border p-3"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{
              background: "var(--info-bg)",
              color: "var(--info-text)",
              border: "1px solid var(--info-border)",
            }}
          >
            {name[0]}
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ color: "var(--text-strong)" }}
            >
              {name}
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--text-faint)" }}
            >
              분양회 모집 합계 {gradeTotal.toLocaleString()}명
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background: "var(--surface)",
            color: "var(--text-subtle)",
            border: "1px solid var(--border)",
          }}
        >
          실행파트
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="crm-meta mb-1.5 block pl-1 font-normal">
            챌린저
          </label>
          <CountInput
            value={safeRow.challenger_count || 0}
            onChange={(value) => onUpdate({ challenger_count: value })}
          />
        </div>
        <div>
          <label className="crm-meta mb-1.5 block pl-1 font-normal">
            마스터
          </label>
          <CountInput
            value={safeRow.master_count || 0}
            onChange={(value) => onUpdate({ master_count: value })}
          />
        </div>
        <div>
          <label className="crm-meta mb-1.5 block pl-1 font-normal">
            브론즈
          </label>
          <CountInput
            value={safeRow.bronze_count || 0}
            onChange={(value) => onUpdate({ bronze_count: value })}
          />
        </div>
        <div>
          <label className="crm-meta mb-1.5 block pl-1 font-normal">
            분양회매출(월회비)
          </label>
          <MoneyInput
            value={safeRow.bunyanghoe_revenue || 0}
            onChange={(value) => onUpdate({ bunyanghoe_revenue: value })}
          />
        </div>
      </div>
    </div>
  );
}

function ExecGoalSection({
  year,
  month,
  rows,
  onUpdate,
}: {
  year: number;
  month: number;
  rows: Record<string, KpiRow>;
  onUpdate: (name: string, patch: Partial<KpiRow>) => void;
}) {
  return (
    <section className="premium-card overflow-hidden">
      <SectionHeader
        title="실행파트 개인별"
        desc="개인별 분양회 모집 등급 목표와 월회비 매출 목표를 설정합니다."
        tone="info"
        icon={UserCircle}
      />
      <div className="space-y-3 p-4">
        {EXEC_MEMBERS.map((name) => (
          <ExecGoalCard
            key={name}
            name={name}
            row={rows[name] || makeEmpty(year, month, "execution", name)}
            onUpdate={(patch) => onUpdate(name, patch)}
          />
        ))}
      </div>
    </section>
  );
}

function OpsGoalCard({
  name,
  row,
  onUpdate,
}: {
  name: string;
  row: KpiRow;
  onUpdate: (patch: Partial<KpiRow>) => void;
}) {
  const safeRow = row || makeEmpty(new Date().getFullYear(), new Date().getMonth() + 1, "operation", name);

  return (
    <div
      className="rounded-[14px] border p-3"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{
              background: "var(--success-bg)",
              color: "var(--success-text)",
              border: "1px solid var(--success-border)",
            }}
          >
            {name[0]}
          </div>
          <p
            className="text-[14px] font-semibold"
            style={{ color: "var(--text-strong)" }}
          >
            {name}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background: "var(--surface)",
            color: "var(--text-subtle)",
            border: "1px solid var(--border)",
          }}
        >
          운영파트
        </span>
      </div>
      <div>
        <label className="crm-meta mb-1.5 block pl-1 font-normal">
          광고특전운영매출
        </label>
        <MoneyInput
          value={safeRow.ad_operation_revenue || 0}
          onChange={(value) => onUpdate({ ad_operation_revenue: value })}
        />
      </div>
    </div>
  );
}

function OpsGoalSection({
  year,
  month,
  rows,
  onUpdate,
}: {
  year: number;
  month: number;
  rows: Record<string, KpiRow>;
  onUpdate: (name: string, patch: Partial<KpiRow>) => void;
}) {
  return (
    <section className="premium-card overflow-hidden">
      <SectionHeader
        title="운영파트 개인별"
        desc="광고특전 운영매출 목표를 개인별로 설정합니다."
        tone="success"
        icon={WalletCards}
      />
      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {OPS_MEMBERS.map((name) => (
          <OpsGoalCard
            key={name}
            name={name}
            row={rows[name] || makeEmpty(year, month, "operation", name)}
            onUpdate={(patch) => onUpdate(name, patch)}
          />
        ))}
      </div>
    </section>
  );
}

export default function KpiSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const now = useMemo(() => new Date(), []);
  const initialYear = now.getFullYear();
  const initialMonth = now.getMonth() + 1;
  const initialMaps = useMemo(
    () => buildInitialMaps(initialYear, initialMonth),
    [initialYear, initialMonth],
  );

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [teamRow, setTeamRow] = useState<KpiRow>(
    makeEmpty(initialYear, initialMonth, "team", "team"),
  );
  const [execRows, setExecRows] = useState<Record<string, KpiRow>>(
    initialMaps.exec,
  );
  const [opsRows, setOpsRows] = useState<Record<string, KpiRow>>(
    initialMaps.ops,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setAuthChecked(true);

    if (!currentUser || currentUser.role !== "admin") {
      setTimeout(() => router.push("/"), 1500);
    }
  }, [router]);

  const buildEmptyMaps = useCallback((targetYear: number, targetMonth: number) => {
    return buildInitialMaps(targetYear, targetMonth);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const empty = buildEmptyMaps(year, month);

    setTeamRow(makeEmpty(year, month, "team", "team"));
    setExecRows(empty.exec);
    setOpsRows(empty.ops);

    try {
      const { data, error } = await supabase
        .from("kpi_settings")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", 0);

      if (error) throw error;

      const rows = (data || []) as Partial<KpiRow>[];
      const team = rows.find(
        (row) => row.scope === "team" && row.target_name === "team",
      );

      setTeamRow(normalizeRow(team, year, month, "team", "team"));

      const exec: Record<string, KpiRow> = { ...empty.exec };
      EXEC_MEMBERS.forEach((name) => {
        const found = rows.find(
          (row) => row.scope === "execution" && row.target_name === name,
        );
        exec[name] = normalizeRow(found, year, month, "execution", name);
      });
      setExecRows(exec);

      const ops: Record<string, KpiRow> = { ...empty.ops };
      OPS_MEMBERS.forEach((name) => {
        const found = rows.find(
          (row) => row.scope === "operation" && row.target_name === name,
        );
        ops[name] = normalizeRow(found, year, month, "operation", name);
      });
      setOpsRows(ops);
    } catch (error: any) {
      console.error("KPI 설정 조회 실패:", error);
      setTeamRow(makeEmpty(year, month, "team", "team"));
      setExecRows(empty.exec);
      setOpsRows(empty.ops);
      alert(
        `KPI 설정을 불러오지 못했습니다.\n${
          error?.message || "알 수 없는 오류"
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, [buildEmptyMaps, month, year]);

  useEffect(() => {
    if (user?.role === "admin") void loadData();
  }, [user, loadData]);

  const resetMonthly = () => {
    const empty = buildEmptyMaps(year, month);
    setTeamRow(makeEmpty(year, month, "team", "team"));
    setExecRows(empty.exec);
    setOpsRows(empty.ops);
  };

  const savePayloadRow = (row: KpiRow): Record<string, any> => {
    const recruitCount =
      row.scope === "execution"
        ? toNumber(row.master_count) +
          toNumber(row.challenger_count) +
          toNumber(row.bronze_count)
        : toNumber(row.recruit_count);

    return {
      year,
      month,
      week: 0,
      scope: row.scope,
      target_name: row.target_name,
      recruit_count: recruitCount,
      master_count: toNumber(row.master_count),
      challenger_count: toNumber(row.challenger_count),
      bronze_count: toNumber(row.bronze_count),
      bunyanghoe_revenue: toNumber(row.bunyanghoe_revenue),
      linked_revenue: 0,
      special_revenue: 0,
      wanpan_truck_count: 0,
      ad_operation_revenue: toNumber(row.ad_operation_revenue),
    };
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const safeExecRows = { ...buildEmptyMaps(year, month).exec, ...execRows };
      const safeOpsRows = { ...buildEmptyMaps(year, month).ops, ...opsRows };

      const rows = [
        savePayloadRow({ ...teamRow, scope: "team", target_name: "team" }),
        ...EXEC_MEMBERS.map((name) =>
          savePayloadRow({
            ...safeExecRows[name],
            scope: "execution",
            target_name: name,
          }),
        ),
        ...OPS_MEMBERS.map((name) =>
          savePayloadRow({
            ...safeOpsRows[name],
            scope: "operation",
            target_name: name,
          }),
        ),
      ];

      const { error } = await supabase
        .from("kpi_settings")
        .upsert(rows, { onConflict: "year,month,week,scope,target_name" });

      if (error) throw error;

      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      setTimeout(() => setSavedAt(""), 3000);
      await loadData();
    } catch (error: any) {
      console.error("KPI 저장 실패:", error);
      alert(`저장 실패: ${error?.message || "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="premium-page flex h-full items-center justify-center">
        <Loader2
          className="animate-spin"
          size={32}
          style={{ color: "var(--accent-text)" }}
        />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="premium-page flex h-full flex-col items-center justify-center">
        <Lock
          size={40}
          className="mb-3"
          style={{ color: "var(--text-faint)", opacity: 0.5 }}
        />
        <p
          className="text-[14px] font-semibold"
          style={{ color: "var(--text-strong)" }}
        >
          관리자만 접근 가능
        </p>
      </div>
    );
  }

  const safeExecRows = { ...buildEmptyMaps(year, month).exec, ...execRows };
  const safeOpsRows = { ...buildEmptyMaps(year, month).ops, ...opsRows };

  const teamRecruitTotal = teamRow.recruit_count || 0;
  const execRecruitTotal = EXEC_MEMBERS.reduce((sum, name) => {
    const row = safeExecRows[name];
    return (
      sum +
      toNumber(row?.master_count) +
      toNumber(row?.challenger_count) +
      toNumber(row?.bronze_count)
    );
  }, 0);
  const opsRevenueTotal = OPS_MEMBERS.reduce((sum, name) => {
    return sum + toNumber(safeOpsRows[name]?.ad_operation_revenue);
  }, 0);

  return (
    <div className="premium-page mx-auto w-full max-w-[1920px] px-4 pb-12 pt-6 md:px-6 2xl:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[11px] border"
            style={{
              background: "var(--warning-bg)",
              borderColor: "var(--warning-border)",
              color: "var(--warning-text)",
            }}
          >
            <Target size={16} />
          </div>
          <div>
            <h1 className="crm-title">KPI 설정</h1>
            <p className="crm-subtitle mt-0.5">
              {year}년 {month}월 · 월간 전체 목표 관리 · 관리자 전용
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="crm-search h-10 w-[90px] px-3 font-normal"
          >
            {[2025, 2026, 2027, 2028].map((item) => (
              <option key={item} value={item}>
                {item}년
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="crm-search h-10 w-[90px] px-3 font-normal"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
              <option key={item} value={item}>
                {item}월
              </option>
            ))}
          </select>
          {savedAt && (
            <span
              className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: "var(--success-bg)",
                color: "var(--success-text)",
                border: "1px solid var(--success-border)",
              }}
            >
              <CheckCircle2 size={12} /> {savedAt} 저장됨
            </span>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={loading || saving}
            className="btn-premium btn-secondary h-10"
          >
            <RefreshCw size={14} /> 다시 불러오기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="btn-premium btn-primary h-10"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Save size={14} />
            )}
            {saving ? "저장 중..." : "전체 저장"}
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        <div className="premium-card p-4">
          <div className="flex items-center gap-2">
            <BadgeCheck size={15} style={{ color: "var(--warning-text)" }} />
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-strong)" }}
            >
              대협팀 전체 모집 목표
            </p>
          </div>
          <p
            className="mt-2 text-[24px] font-semibold tracking-[-0.03em]"
            style={{ color: "var(--text-strong)" }}
          >
            {teamRecruitTotal.toLocaleString()}명
          </p>
        </div>
        <div className="premium-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} style={{ color: "var(--info-text)" }} />
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-strong)" }}
            >
              실행파트 개인 목표 합계
            </p>
          </div>
          <p
            className="mt-2 text-[24px] font-semibold tracking-[-0.03em]"
            style={{ color: "var(--text-strong)" }}
          >
            {execRecruitTotal.toLocaleString()}명
          </p>
        </div>
        <div className="premium-card p-4">
          <div className="flex items-center gap-2">
            <WalletCards size={15} style={{ color: "var(--success-text)" }} />
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-strong)" }}
            >
              운영파트 광고특전 목표 합계
            </p>
          </div>
          <p
            className="mt-2 text-[24px] font-semibold tracking-[-0.03em]"
            style={{ color: "var(--text-strong)" }}
          >
            {opsRevenueTotal.toLocaleString()}원
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2
            className="animate-spin"
            size={28}
            style={{ color: "var(--accent-text)" }}
          />
        </div>
      ) : (
        <div className="space-y-5">
          <div
            className="flex items-center justify-between border-b pb-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-2">
              <Calendar size={15} style={{ color: "var(--warning-text)" }} />
              <h2
                className="text-[15px] font-semibold"
                style={{ color: "var(--text-strong)" }}
              >
                월간 전체 목표 설정
              </h2>
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--text-faint)" }}
              >
                {year}년 {month}월
              </span>
            </div>
            <button
              type="button"
              onClick={resetMonthly}
              className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[11px] font-normal transition-all"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text-subtle)",
              }}
            >
              <RefreshCw size={11} /> 초기화
            </button>
          </div>

          <TeamGoalSection
            row={teamRow}
            onUpdate={(patch) =>
              setTeamRow((prev) => ({ ...prev, ...patch }))
            }
          />
          <ExecGoalSection
            year={year}
            month={month}
            rows={safeExecRows}
            onUpdate={(name, patch) =>
              setExecRows((prev) => ({
                ...prev,
                [name]: {
                  ...(prev[name] ||
                    makeEmpty(year, month, "execution", name)),
                  ...patch,
                },
              }))
            }
          />
          <OpsGoalSection
            year={year}
            month={month}
            rows={safeOpsRows}
            onUpdate={(name, patch) =>
              setOpsRows((prev) => ({
                ...prev,
                [name]: {
                  ...(prev[name] ||
                    makeEmpty(year, month, "operation", name)),
                  ...patch,
                },
              }))
            }
          />
        </div>
      )}
    </div>
  );
}
