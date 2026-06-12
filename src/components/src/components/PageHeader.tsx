"use client";

import type { ElementType, ReactNode } from "react";

/* ── 타입 ── */
export type StatPill = {
  label: string;
  value: number | string;
  icon?: ElementType;
  tone?: "default" | "success" | "warning" | "danger" | "purple" | "cyan" | "accent";
};

type PageHeaderProps = {
  icon?: ElementType;
  badge?: string;
  title: string;
  description?: string;
  stats?: StatPill[];
  actions?: ReactNode;
  filters?: ReactNode;
  children?: ReactNode;
};

/* ── 톤 컬러 매핑 ── */
const TONE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: "var(--surface-3)", text: "var(--text-strong)", border: "var(--border)" },
  success: { bg: "var(--success-bg)", text: "var(--success-text)", border: "var(--success-border)" },
  warning: { bg: "var(--warning-bg)", text: "var(--warning-text)", border: "var(--warning-border)" },
  danger: { bg: "var(--danger-bg)", text: "var(--danger-text)", border: "var(--danger-border)" },
  purple: { bg: "var(--purple-bg)", text: "var(--purple-text)", border: "var(--purple-border)" },
  cyan: { bg: "var(--cyan-bg)", text: "var(--cyan-text)", border: "var(--cyan-border)" },
  accent: { bg: "var(--accent-subtle)", text: "var(--accent-text)", border: "var(--accent-border)" },
};

export default function PageHeader({ icon: Icon, badge, title, description, stats, actions, filters, children }: PageHeaderProps) {
  return (
    <div className="shrink-0 border-b px-5 pb-4 pt-5 md:px-7" style={{ borderColor: "var(--border-subtle)" }}>
      {/* Row 1: 배지 + 타이틀 + 설명 + 액션 */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {badge && (
            <span
              className="mb-2 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11px]"
              style={{ background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}
            >
              {Icon && <Icon size={12} />}
              {badge}
            </span>
          )}
          <h1
            className="text-[22px] leading-tight tracking-[-0.04em]"
            style={{ color: "var(--text-strong)", fontWeight: 700 }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed tracking-[-0.01em]" style={{ color: "var(--text-subtle)" }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {/* Row 2: 스탯 필 (선택) */}
      {stats && stats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.map((stat) => {
            const tone = TONE_MAP[stat.tone || "default"];
            const StatIcon = stat.icon;
            return (
              <div
                key={stat.label}
                className="inline-flex items-center gap-2 rounded-[10px] border px-3 py-2"
                style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
              >
                {StatIcon && (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                    style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}
                  >
                    <StatIcon size={13} />
                  </div>
                )}
                <div>
                  <p className="text-[11px] leading-tight" style={{ color: "var(--text-subtle)" }}>{stat.label}</p>
                  <p className="text-[16px] leading-tight tracking-[-0.03em]" style={{ color: tone.text, fontWeight: 600 }}>{typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Row 3: 필터 바 (선택) */}
      {filters && <div className="mt-3 flex flex-wrap items-center gap-2">{filters}</div>}

      {/* 추가 콘텐츠 (탭 등) */}
      {children}
    </div>
  );
}
