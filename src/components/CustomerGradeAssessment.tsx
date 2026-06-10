"use client";

import { Award, BarChart3, ShieldCheck } from "lucide-react";
import {
  calculateCustomerGrade,
  GRADE_SELECT_OPTIONS,
  MANAGEMENT_STAGE_OPTIONS,
  hasGradeAssessmentInput,
  type GradeAssessmentForm,
} from "@/lib/customerGrade";

type Props = {
  value: GradeAssessmentForm;
  title: string;
  onChange: (value: GradeAssessmentForm) => void;
  managementStage?: string;
  onManagementStageChange?: (value: string) => void;
  managementStageOptions?: readonly string[];
};

function update(
  value: GradeAssessmentForm,
  key: keyof GradeAssessmentForm,
  next: string,
) {
  return { ...value, [key]: next };
}

function NumericInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="crm-meta mb-2 block">{label}</span>
      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/[^0-9]/g, ""))
        }
        placeholder={placeholder || "숫자 입력"}
        inputMode="numeric"
        className="h-[42px] w-full rounded-[13px] border px-3 text-[13px] font-[700] outline-none"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="crm-meta mb-2 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[42px] w-full rounded-[13px] border px-3 text-[13px] font-[700] outline-none"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <option value="">선택</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScorePill({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = max ? Math.round((value / max) * 100) : 0;

  return (
    <div
      className="rounded-[14px] border px-3 py-3"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="truncate text-[11px] font-[800]"
          style={{ color: "var(--text-subtle)" }}
        >
          {label}
        </p>
        <p
          className="text-[12px] font-[900]"
          style={{ color: "var(--text-strong)" }}
        >
          {value}/{max}
        </p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent-3))",
          }}
        />
      </div>
    </div>
  );
}

export default function CustomerGradeAssessment({
  value,
  title,
  onChange,
  managementStage,
  onManagementStageChange,
  managementStageOptions = MANAGEMENT_STAGE_OPTIONS,
}: Props) {
  const result = calculateCustomerGrade(value, title);
  const hasInput = hasGradeAssessmentInput(value);
  const displayGrade = hasInput ? result.customerGrade : "입력 대기";
  const displayBasis = title ? `${result.roleBasis} 기준` : "직급 선택 전";

  return (
    <section
      className="rounded-[18px] border p-4"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div
            className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-[900]"
            style={{
              color: "var(--accent-text)",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
            }}
          >
            <ShieldCheck size={14} /> 고객등급 자동판정
          </div>
          <p className="crm-card-title">
            입력값 기준으로 고객등급이 자동 설정됩니다.
          </p>
          <p className="crm-tiny mt-1">
            직급에 본부/대표/이사/지사장이 포함되면 본부장 기준, 그 외는
            팀장 기준으로 계산합니다.
          </p>
        </div>

        <div
          className="min-w-[220px] rounded-[18px] border px-4 py-3"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award size={17} style={{ color: "var(--accent)" }} />
              <p
                className="text-[12px] font-[850]"
                style={{ color: "var(--text-subtle)" }}
              >
                자동 고객등급
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-[900]"
              style={{
                color: "var(--accent-text)",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              {displayBasis}
            </span>
          </div>

          <p
            className="mt-3 text-[28px] font-[950] tracking-[-0.06em]"
            style={{ color: "var(--text-strong)" }}
          >
            {displayGrade}
          </p>
          <p
            className="mt-1 text-[13px] font-[850]"
            style={{ color: "var(--text-subtle)" }}
          >
            {hasInput
              ? `총점 ${result.totalScore}/120점`
              : "하단 판정 항목 입력 후 자동 계산"}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <ScorePill
          label="현장운영력"
          value={result.categoryScores.siteOperation}
          max={30}
        />
        <ScorePill
          label="조직운영력"
          value={result.categoryScores.organization}
          max={40}
        />
        <ScorePill
          label="브랜딩/네트워킹"
          value={result.categoryScores.branding}
          max={20}
        />
        <ScorePill
          label="광고 집행력"
          value={result.categoryScores.advertising}
          max={30}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <NumericInput
          label="1년간 진행 현장 수"
          value={value.annual_site_count}
          onChange={(next) =>
            onChange(update(value, "annual_site_count", next))
          }
          placeholder="예: 3"
        />
        <SelectInput
          label="주 운영 물건 종류"
          value={value.property_type}
          options={GRADE_SELECT_OPTIONS.property_type}
          onChange={(next) => onChange(update(value, "property_type", next))}
        />
        <NumericInput
          label="직접 양성 상담사 수"
          value={value.trained_consultants}
          onChange={(next) =>
            onChange(update(value, "trained_consultants", next))
          }
          placeholder="예: 20"
        />
        <NumericInput
          label="현장 셋팅 가능 인원수"
          value={value.setup_people}
          onChange={(next) => onChange(update(value, "setup_people", next))}
          placeholder="예: 10"
        />
        <NumericInput
          label="지속 운영 팀원수"
          value={value.steady_team_members}
          onChange={(next) =>
            onChange(update(value, "steady_team_members", next))
          }
          placeholder="예: 5"
        />
        <SelectInput
          label="소속회사 규모"
          value={value.company_scale}
          options={GRADE_SELECT_OPTIONS.company_scale}
          onChange={(next) => onChange(update(value, "company_scale", next))}
        />
        <SelectInput
          label="본인 PR 플랫폼"
          value={value.pr_platform}
          options={GRADE_SELECT_OPTIONS.pr_platform}
          onChange={(next) => onChange(update(value, "pr_platform", next))}
        />
        <SelectInput
          label="네트워킹 활동"
          value={value.networking}
          options={GRADE_SELECT_OPTIONS.networking}
          onChange={(next) => onChange(update(value, "networking", next))}
        />
        <NumericInput
          label="월 평균 광고비(만원)"
          value={value.monthly_ad_budget}
          onChange={(next) =>
            onChange(update(value, "monthly_ad_budget", next))
          }
          placeholder="예: 1500"
        />
        <SelectInput
          label="광고 셋팅 운영"
          value={value.ad_operation}
          options={GRADE_SELECT_OPTIONS.ad_operation}
          onChange={(next) => onChange(update(value, "ad_operation", next))}
        />
        <SelectInput
          label="광고비 지원 가능 여부"
          value={value.ad_budget_support}
          options={GRADE_SELECT_OPTIONS.ad_budget_support}
          onChange={(next) =>
            onChange(update(value, "ad_budget_support", next))
          }
        />
        {typeof managementStage === "string" && onManagementStageChange ? (
          <SelectInput
            label="관리구간"
            value={managementStage}
            options={[...managementStageOptions]}
            onChange={onManagementStageChange}
          />
        ) : null}
      </div>

      <div
        className="mt-4 flex gap-2 rounded-[14px] border px-3 py-3"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
        }}
      >
        <BarChart3
          size={16}
          className="mt-0.5 flex-shrink-0"
          style={{ color: "var(--accent)" }}
        />
        <p
          className="text-[12.5px] font-[700] leading-6"
          style={{ color: "var(--text-subtle)" }}
        >
          {result.decisionMessage}
        </p>
      </div>
    </section>
  );
}
