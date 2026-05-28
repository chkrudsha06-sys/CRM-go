"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  PackageCheck,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";

type VipMember = {
  id: number;
  name: string;
  title: string | null;
  bunyanghoe_number: string | null;
  meeting_result: string | null;
  assigned_to: string | null;
  consultant: string | null;
  phone: string | null;
};

type UploadedFile = {
  name: string;
  url: string;
  size?: number;
  uploaded_at: string;
};

type ContentStatus = {
  id?: number;
  contact_id: number;
  photo_received: boolean;
  info_received: boolean;
  tf2_delivered: boolean;
  pr_completed: boolean;
  production_impossible: boolean;
  impossible_reason: string;
  files: UploadedFile[];
  pr_name: string;
  pr_gender: string;
  pr_birth_date: string;
  pr_title_position: string;
  pr_age: string;
  pr_height: string;
  pr_body_type: string;
  pr_activity_region: string;
  pr_company: string;
  pr_site_history_1: string;
  pr_site_history_2: string;
  pr_site_history_3: string;
  pr_site_history_4: string;
  pr_site_history_5: string;
  pr_intro: string;
  pr_request: string;
  pr_video_copy_1: string;
  pr_video_performance: string;
  pr_video_copy_2: string;
  pr_site_info: string;
  pr_photo_desc: string;
  pr_feed_text: string;
  pr_career: string;
  pr_years: string;
  pr_years_base_year: number;
  pr_output_server: string;
  pr_output_url: string;
  updated_at: string | null;
};

type ContentRow = Omit<ContentStatus, "files"> & { files: unknown };
type DetailTab = "overview" | "files" | "pr" | "output";
type ToggleField = "photo_received" | "info_received" | "tf2_delivered" | "pr_completed" | "production_impossible";

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const SETUP_FILTERS = ["사진미수취", "정보미수취", "TF2미전달", "PR미완료", "제작불가", "완료"];

const EMPTY_STATUS: Omit<ContentStatus, "contact_id"> = {
  photo_received: false,
  info_received: false,
  tf2_delivered: false,
  pr_completed: false,
  production_impossible: false,
  impossible_reason: "",
  files: [],
  pr_name: "",
  pr_gender: "",
  pr_birth_date: "",
  pr_title_position: "",
  pr_age: "",
  pr_height: "",
  pr_body_type: "",
  pr_activity_region: "",
  pr_company: "",
  pr_site_history_1: "",
  pr_site_history_2: "",
  pr_site_history_3: "",
  pr_site_history_4: "",
  pr_site_history_5: "",
  pr_intro: "",
  pr_request: "",
  pr_video_copy_1: "",
  pr_video_performance: "",
  pr_video_copy_2: "",
  pr_site_info: "",
  pr_photo_desc: "",
  pr_feed_text: "",
  pr_career: "",
  pr_years: "",
  pr_years_base_year: 0,
  pr_output_server: "",
  pr_output_url: "",
  updated_at: null,
};

function baseStatus(contactId: number): ContentStatus {
  return { ...EMPTY_STATUS, contact_id: contactId };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function parseFiles(value: unknown): UploadedFile[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as UploadedFile[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as UploadedFile[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function avatarBg(name?: string | null) {
  const gradients = [
    "linear-gradient(135deg,#8B7CF6,#60A5FA)",
    "linear-gradient(135deg,#60A5FA,#22D3EE)",
    "linear-gradient(135deg,#34D399,#22D3EE)",
    "linear-gradient(135deg,#FBBF24,#FB7185)",
    "linear-gradient(135deg,#C084FC,#FB7185)",
    "linear-gradient(135deg,#8B7CF6,#C084FC)",
  ];
  if (!name) return gradients[0];
  const idx = name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % gradients.length;
  return gradients[idx];
}

function completionScore(status: ContentStatus) {
  let score = 0;
  if (status.photo_received) score += 25;
  if (status.info_received) score += 25;
  if (status.tf2_delivered) score += 25;
  if (status.pr_completed) score += 25;
  return score;
}

function calcYears(baseYear: number, storedYears: string) {
  if (!baseYear || !storedYears) return storedYears || "";
  const num = parseInt(storedYears.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(num)) return storedYears;
  const diff = new Date().getFullYear() - baseYear;
  return `${num + diff}년차`;
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

function resultTone(value?: string | null) {
  if (value === "계약완료") return "success";
  if (value === "예약완료") return "purple";
  return "muted";
}

function doneTone(done?: boolean) {
  return done ? "success" : "muted";
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
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02)), ${c.bg}`,
        border: `1px solid ${c.border}`,
        color: c.color,
      }}
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
        className="h-8 min-w-[124px] appearance-none rounded-full border px-3 pr-8 text-[12px] font-bold outline-none"
        style={{
          background: value ? "var(--accent-subtle)" : "var(--surface-2)",
          borderColor: value ? "var(--accent-border)" : "var(--border)",
          color: value ? "var(--accent-text)" : "var(--text-muted)",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ElementType; tone: string }) {
  return (
    <div className="premium-card flex h-[82px] items-center gap-4 px-4">
      <PremiumIcon icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p className="mt-1 text-[22px] font-[760] leading-none tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[116px_1fr] gap-3 py-3">
      <div className="text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>{label}</div>
      <div className="min-w-0 text-[13px] font-semibold" style={{ color: "var(--text)" }}>{children || <span style={{ color: "var(--text-faint)" }}>-</span>}</div>
    </div>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{children}</label>;
}

function compressImage(file: File, maxSize = 900, quality = 0.64): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve("");
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

function MemberMobileCard({ member, status, onClick }: { member: VipMember; status: ContentStatus; onClick: () => void }) {
  const score = completionScore(status);
  return (
    <button type="button" onClick={onClick} className="premium-card premium-card-hover w-full p-4 text-left">
      <div className="flex items-center gap-3">
        <div className="crm-avatar" style={{ background: avatarBg(member.name) }}>{member.name?.[0] || "콘"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="crm-row-main truncate">{member.name}</p>
            <Badge tone={resultTone(member.meeting_result)}>{member.meeting_result || "-"}</Badge>
          </div>
          <p className="crm-row-sub mt-0.5 truncate">{member.bunyanghoe_number || "넘버링 없음"} · {member.title || "-"} · 담당 {member.assigned_to || "-"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone={doneTone(status.photo_received)} icon={Camera}>사진</Badge>
        <Badge tone={doneTone(status.info_received)} icon={Info}>정보</Badge>
        <Badge tone={doneTone(status.tf2_delivered)} icon={Send}>TF2</Badge>
        <Badge tone={doneTone(status.pr_completed)} icon={PackageCheck}>PR</Badge>
        {status.production_impossible && <Badge tone="danger" icon={X}>제작불가</Badge>}
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
          <span style={{ color: "var(--text-subtle)" }}>진행률</span>
          <span style={{ color: score === 100 ? "var(--success-text)" : "var(--warning-text)" }}>{score}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: score === 100 ? "var(--success)" : "var(--warning)" }} />
        </div>
      </div>
    </button>
  );
}

function DetailSlidePanel({
  member,
  status,
  tab,
  onTab,
  onClose,
  onToggle,
  onChange,
  onSave,
  onFileUpload,
  onFileDelete,
  onFileDownload,
  saving,
  uploading,
}: {
  member: VipMember;
  status: ContentStatus;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onClose: () => void;
  onToggle: (field: ToggleField) => void;
  onChange: <K extends keyof ContentStatus>(field: K, value: ContentStatus[K]) => void;
  onSave: () => void;
  onFileUpload: (files: FileList | File[]) => void;
  onFileDelete: (index: number, fileName: string) => void;
  onFileDownload: (file: UploadedFile) => void;
  saving: boolean;
  uploading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const score = completionScore(status);
  const inputClass = "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";
  const textareaClass = "min-h-[88px] w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] font-semibold outline-none";

  const prTop: Array<{ key: keyof ContentStatus; label: string; placeholder?: string }> = [
    { key: "pr_name", label: "성명", placeholder: member.name },
    { key: "pr_gender", label: "성별", placeholder: "남 / 여" },
    { key: "pr_birth_date", label: "생년월일", placeholder: "예: 88.11.26" },
    { key: "pr_title_position", label: "직함", placeholder: member.title || "대표" },
    { key: "pr_age", label: "나이", placeholder: "예: 38세" },
    { key: "pr_height", label: "키", placeholder: "예: 178cm" },
    { key: "pr_body_type", label: "체형", placeholder: "예: 보통" },
    { key: "pr_activity_region", label: "활동지역", placeholder: "예: 서울/경기" },
    { key: "pr_company", label: "소속/회사", placeholder: "회사명" },
  ];

  const histories: Array<{ key: keyof ContentStatus; label: string }> = [
    { key: "pr_site_history_1", label: "현장 이력 1" },
    { key: "pr_site_history_2", label: "현장 이력 2" },
    { key: "pr_site_history_3", label: "현장 이력 3" },
    { key: "pr_site_history_4", label: "현장 이력 4" },
    { key: "pr_site_history_5", label: "현장 이력 5" },
  ];

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />
      <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-panel-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="crm-avatar-lg crm-avatar" style={{ background: avatarBg(member.name) }}>{member.name?.[0] || "콘"}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-[22px] font-[780] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>{member.name}</h2>
                  <Badge tone={resultTone(member.meeting_result)}>{member.meeting_result || "-"}</Badge>
                </div>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>{member.bunyanghoe_number || "넘버링 없음"} · {member.title || "직급 없음"} · 담당 {member.assigned_to || "-"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={doneTone(status.photo_received)} icon={Camera}>사진</Badge>
                  <Badge tone={doneTone(status.info_received)} icon={Info}>정보</Badge>
                  <Badge tone={doneTone(status.tf2_delivered)} icon={Send}>TF2</Badge>
                  <Badge tone={doneTone(status.pr_completed)} icon={PackageCheck}>PR</Badge>
                  {status.production_impossible && <Badge tone="danger" icon={X}>제작불가</Badge>}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 w-9 p-0"><X size={16} /></button>
          </div>
          <div className="mt-5 flex gap-1.5">
            {[
              { key: "overview", label: "개요" },
              { key: "files", label: `파일 ${status.files.length}` },
              { key: "pr", label: "PR정보" },
              { key: "output", label: "산출물" },
            ].map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTab(item.key as DetailTab)}
                  className="h-9 rounded-[9px] px-3 text-[12px] font-bold transition-all"
                  style={{
                    background: active ? "var(--accent-subtle)" : "transparent",
                    color: active ? "var(--accent-text)" : "var(--text-subtle)",
                    border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="slide-panel-body">
          {tab === "overview" && (
            <div className="space-y-6">
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <PremiumIcon icon={PackageCheck} tone={score === 100 ? "success" : "warning"} />
                  <div><p className="crm-section-title">컨텐츠 제작 진행률</p><p className="crm-tiny">사진, 기본정보, TF2 전달, PR 완료 기준</p></div>
                </div>
                <div className="mb-2 flex items-center justify-between text-[12px] font-bold">
                  <span style={{ color: "var(--text-subtle)" }}>진행률</span>
                  <span style={{ color: score === 100 ? "var(--success-text)" : "var(--warning-text)" }}>{score}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: score === 100 ? "var(--success)" : "var(--warning)" }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    { field: "photo_received", label: "사진 수취", icon: Camera },
                    { field: "info_received", label: "기본정보 수취", icon: Info },
                    { field: "tf2_delivered", label: "TF2팀 전달", icon: Send },
                    { field: "pr_completed", label: "PR패키지 완료", icon: CheckCircle2 },
                    { field: "production_impossible", label: "제작불가", icon: X },
                  ].map((item) => {
                    const field = item.field as ToggleField;
                    const checked = status[field];
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.field}
                        type="button"
                        onClick={() => onToggle(field)}
                        className="flex items-center gap-2 rounded-[12px] border px-3 py-2.5 text-left text-[12px] font-bold"
                        style={{
                          background: checked ? item.field === "production_impossible" ? "var(--danger-bg)" : "var(--success-bg)" : "var(--surface-2)",
                          borderColor: checked ? item.field === "production_impossible" ? "var(--danger-border)" : "var(--success-border)" : "var(--border)",
                          color: checked ? item.field === "production_impossible" ? "var(--danger-text)" : "var(--success-text)" : "var(--text-muted)",
                        }}
                      >
                        <Icon size={14} />{item.label}
                      </button>
                    );
                  })}
                </div>
                {status.production_impossible && (
                  <div className="mt-4">
                    <InputLabel>제작불가 사유</InputLabel>
                    <textarea className={textareaClass} value={status.impossible_reason} onChange={(e) => onChange("impossible_reason", e.target.value)} placeholder="제작불가 사유를 입력하세요." />
                  </div>
                )}
              </section>

              <section className="premium-card p-4">
                <div className="mb-3 flex items-center gap-2"><PremiumIcon icon={User} tone="info" /><div><p className="crm-section-title">회원 정보</p><p className="crm-tiny">컨텐츠 제작 대상 회원</p></div></div>
                <Field label="회원명">{member.name}</Field>
                <Field label="넘버링"><Badge tone={member.bunyanghoe_number ? "warning" : "muted"}>{member.bunyanghoe_number || "-"}</Badge></Field>
                <Field label="직급">{member.title || "-"}</Field>
                <Field label="담당자"><Badge tone="purple" icon={User}>{member.assigned_to || "-"}</Badge></Field>
                <Field label="업데이트">{formatDateTime(status.updated_at)}</Field>
              </section>
            </div>
          )}

          {tab === "files" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Camera} tone="purple" /><div><p className="crm-section-title">파일 관리</p><p className="crm-tiny">사진 및 제작 참고자료 업로드/다운로드</p></div></div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onFileUpload(e.target.files); e.target.value = ""; }} />
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent-border)"; }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border-2)"; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border-2)"; if (e.dataTransfer.files.length) onFileUpload(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className="mb-4 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed p-5 text-center transition-all"
                style={{ background: "var(--surface-2)", borderColor: "var(--border-2)", color: "var(--text-muted)" }}
              >
                {uploading ? <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /> : <><Upload size={24} style={{ color: "var(--accent-text)" }} /><p className="mt-3 text-[13px] font-bold" style={{ color: "var(--text)" }}>클릭 또는 드래그로 파일 업로드</p><p className="mt-1 crm-tiny">이미지는 자동 압축됩니다. 파일당 최대 50MB</p></>}
              </div>
              <div className="space-y-2">
                {status.files.length === 0 ? (
                  <div className="flex h-28 items-center justify-center rounded-[12px] text-[12px] font-bold" style={{ background: "var(--surface-2)", color: "var(--text-faint)", border: "1px dashed var(--border)" }}>업로드된 파일이 없습니다.</div>
                ) : status.files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                    {file.url.startsWith("data:image") ? <img src={file.url} alt="" className="h-12 w-12 rounded-[10px] object-cover" /> : <PremiumIcon icon={FileText} tone="info" size="sm" />}
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>{file.name}</p><p className="crm-tiny">{fmtSize(file.size)} · {formatDateTime(file.uploaded_at)}</p></div>
                    <button type="button" onClick={() => onFileDownload(file)} className="btn-premium btn-secondary h-8 w-8 p-0"><Download size={13} /></button>
                    <button type="button" onClick={() => onFileDelete(index, file.name)} className="btn-premium btn-danger h-8 w-8 p-0"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "pr" && (
            <div className="space-y-6">
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={Info} tone="info" /><div><p className="crm-section-title">PR패키지 기본정보</p><p className="crm-tiny">프로필 제작에 필요한 기본 데이터</p></div></div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {prTop.map((field) => (
                    <div key={String(field.key)}><InputLabel>{field.label}</InputLabel><input className={inputClass} value={String(status[field.key] || "")} onChange={(e) => onChange(field.key, e.target.value as never)} placeholder={field.placeholder} /></div>
                  ))}
                  <div><InputLabel>경력</InputLabel><input className={inputClass} value={status.pr_career} onChange={(e) => onChange("pr_career", e.target.value)} placeholder="예: 분양 경력" /></div>
                  <div><InputLabel>연차</InputLabel><input className={inputClass} value={calcYears(status.pr_years_base_year, status.pr_years)} onChange={(e) => { onChange("pr_years", e.target.value); if (!status.pr_years_base_year) onChange("pr_years_base_year", new Date().getFullYear()); }} placeholder="예: 8년차" /></div>
                </div>
              </section>
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={FileText} tone="purple" /><div><p className="crm-section-title">현장 이력</p><p className="crm-tiny">대표 현장 이력을 순서대로 입력</p></div></div>
                <div className="space-y-3">{histories.map((field) => <div key={String(field.key)}><InputLabel>{field.label}</InputLabel><input className={inputClass} value={String(status[field.key] || "")} onChange={(e) => onChange(field.key, e.target.value as never)} placeholder="현장명 / 역할 / 성과" /></div>)}</div>
              </section>
              <section className="premium-card p-4">
                <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={FileText} tone="cyan" /><div><p className="crm-section-title">문구 / 요청사항</p><p className="crm-tiny">소개문구, 영상 카피, 피드 문구</p></div></div>
                <div className="space-y-4">
                  {[
                    { key: "pr_intro", label: "소개문구", placeholder: "회원 소개문구" },
                    { key: "pr_request", label: "요청사항", placeholder: "제작 요청사항" },
                    { key: "pr_video_copy_1", label: "영상 카피 1", placeholder: "영상 첫 번째 카피" },
                    { key: "pr_video_performance", label: "영상 성과 문구", placeholder: "성과/강점 문구" },
                    { key: "pr_video_copy_2", label: "영상 카피 2", placeholder: "영상 두 번째 카피" },
                    { key: "pr_site_info", label: "현장정보", placeholder: "현장 관련 정보" },
                    { key: "pr_photo_desc", label: "사진 설명", placeholder: "사진 선택/설명" },
                    { key: "pr_feed_text", label: "피드 문구", placeholder: "SNS 피드 문구" },
                  ].map((field) => <div key={field.key}><InputLabel>{field.label}</InputLabel><textarea className={textareaClass} value={String(status[field.key as keyof ContentStatus] || "")} onChange={(e) => onChange(field.key as keyof ContentStatus, e.target.value as never)} placeholder={field.placeholder} /></div>)}
                </div>
              </section>
            </div>
          )}

          {tab === "output" && (
            <section className="premium-card p-4">
              <div className="mb-4 flex items-center gap-2"><PremiumIcon icon={PackageCheck} tone="success" /><div><p className="crm-section-title">산출물 정보</p><p className="crm-tiny">완료된 PR패키지 산출물 위치</p></div></div>
              <div className="space-y-4">
                <div><InputLabel>산출물 서버/폴더</InputLabel><input className={inputClass} value={status.pr_output_server} onChange={(e) => onChange("pr_output_server", e.target.value)} placeholder="예: NAS / Google Drive / TF2 서버" /></div>
                <div><InputLabel>산출물 URL</InputLabel><input className={inputClass} value={status.pr_output_url} onChange={(e) => onChange("pr_output_url", e.target.value)} placeholder="https://..." /></div>
                {status.pr_output_url && <a href={status.pr_output_url} target="_blank" rel="noopener noreferrer" className="btn-premium btn-primary w-full"><ExternalLink size={14} />산출물 열기</a>}
                <div className="rounded-[12px] p-4 text-[13px] font-semibold leading-relaxed" style={{ background: status.pr_completed ? "var(--success-bg)" : "var(--warning-bg)", border: `1px solid ${status.pr_completed ? "var(--success-border)" : "var(--warning-border)"}`, color: status.pr_completed ? "var(--success-text)" : "var(--warning-text)" }}>
                  {status.pr_completed ? "PR패키지가 완료 상태입니다. 산출물 위치와 최종 파일을 확인하세요." : "PR패키지가 아직 완료되지 않았습니다. TF2 전달 후 산출물 정보를 업데이트하세요."}
                </div>
              </div>
            </section>
          )}
        </div>
        <div className="slide-panel-footer">
          <button type="button" onClick={onSave} disabled={saving} className="btn-premium btn-primary w-full disabled:opacity-50"><Save size={14} />{saving ? "저장 중..." : "현재 정보 저장"}</button>
        </div>
      </aside>
    </>
  );
}

export default function ContentManagePage() {
  const [members, setMembers] = useState<VipMember[]>([]);
  const [statuses, setStatuses] = useState<Record<number, ContentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<VipMember | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [fAssigned, setFAssigned] = useState("");
  const [fStatus, setFStatus] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  };

  const getStatus = useCallback((contactId: number): ContentStatus => statuses[contactId] || baseStatus(contactId), [statuses]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let execName = "";
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) {
        const u = JSON.parse(raw) as { role?: string; name?: string };
        if (u.role === "exec") execName = u.name || "";
      }
    } catch {}

    let contactQuery = supabase
      .from("contacts")
      .select("id,name,title,bunyanghoe_number,meeting_result,assigned_to,consultant,phone")
      .in("meeting_result", ["계약완료", "예약완료"]);

    if (execName) contactQuery = contactQuery.eq("assigned_to", execName);

    const [{ data: contactRows, error: contactsError }, { data: contentRows, error: contentError }] = await Promise.all([
      contactQuery,
      supabase.from("content_statuses").select("*"),
    ]);

    if (contactsError) console.error("contacts:", contactsError.message);
    if (contentError) console.error("content_statuses:", contentError.message);

    const sorted = ((contactRows || []) as VipMember[]).sort((a, b) => {
      const numA = parseInt((a.bunyanghoe_number || "").replace(/[^0-9]/g, ""), 10) || 9999;
      const numB = parseInt((b.bunyanghoe_number || "").replace(/[^0-9]/g, ""), 10) || 9999;
      return numA - numB;
    });

    const map: Record<number, ContentStatus> = {};
    ((contentRows || []) as ContentRow[]).forEach((row) => {
      map[row.contact_id] = { ...EMPTY_STATUS, ...row, contact_id: row.contact_id, files: parseFiles(row.files) };
    });

    setMembers(sorted);
    setStatuses(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatusField = <K extends keyof ContentStatus>(contactId: number, field: K, value: ContentStatus[K]) => {
    setStatuses((prev) => {
      const current = prev[contactId] || baseStatus(contactId);
      return { ...prev, [contactId]: { ...current, contact_id: contactId, [field]: value } };
    });
  };

  const saveStatus = async (contactId: number, override?: Partial<ContentStatus>) => {
    setSavingId(contactId);
    const current = { ...getStatus(contactId), ...(override || {}), contact_id: contactId, updated_at: new Date().toISOString() };
    const payload = {
      contact_id: current.contact_id,
      photo_received: current.photo_received,
      info_received: current.info_received,
      tf2_delivered: current.tf2_delivered,
      pr_completed: current.pr_completed,
      production_impossible: current.production_impossible,
      impossible_reason: current.impossible_reason,
      files: current.files,
      pr_name: current.pr_name,
      pr_gender: current.pr_gender,
      pr_birth_date: current.pr_birth_date,
      pr_title_position: current.pr_title_position,
      pr_age: current.pr_age,
      pr_height: current.pr_height,
      pr_body_type: current.pr_body_type,
      pr_activity_region: current.pr_activity_region,
      pr_company: current.pr_company,
      pr_site_history_1: current.pr_site_history_1,
      pr_site_history_2: current.pr_site_history_2,
      pr_site_history_3: current.pr_site_history_3,
      pr_site_history_4: current.pr_site_history_4,
      pr_site_history_5: current.pr_site_history_5,
      pr_intro: current.pr_intro,
      pr_request: current.pr_request,
      pr_video_copy_1: current.pr_video_copy_1,
      pr_video_performance: current.pr_video_performance,
      pr_video_copy_2: current.pr_video_copy_2,
      pr_site_info: current.pr_site_info,
      pr_photo_desc: current.pr_photo_desc,
      pr_feed_text: current.pr_feed_text,
      pr_career: current.pr_career,
      pr_years: current.pr_years,
      pr_years_base_year: current.pr_years_base_year || new Date().getFullYear(),
      pr_output_server: current.pr_output_server,
      pr_output_url: current.pr_output_url,
      updated_at: current.updated_at,
    };

    let error;
    let id = current.id;
    if (current.id) {
      const res = await supabase.from("content_statuses").update(payload).eq("id", current.id);
      error = res.error;
    } else {
      const res = await supabase.from("content_statuses").insert(payload).select().single();
      error = res.error;
      id = res.data?.id;
    }
    setSavingId(null);
    if (error) {
      showToast(`저장 실패: ${error.message}`);
      return;
    }
    setStatuses((prev) => ({ ...prev, [contactId]: { ...current, id } }));
    showToast("저장 완료");
  };

  const toggleCheckbox = async (contactId: number, field: ToggleField) => {
    const current = getStatus(contactId);
    const value = !current[field];
    updateStatusField(contactId, field, value);
    await saveStatus(contactId, { [field]: value } as Partial<ContentStatus>);
  };

  const handleFileUpload = async (contactId: number, fileList: FileList | File[]) => {
    setUploadingId(contactId);
    const current = getStatus(contactId);
    const nextFiles = [...current.files];

    for (const file of Array.from(fileList)) {
      if (file.size > 50 * 1024 * 1024) {
        showToast(`${file.name}: 50MB 이하 파일만 업로드 가능합니다`);
        continue;
      }
      const compressed = await compressImage(file);
      nextFiles.push({ name: file.name, url: compressed, size: file.size, uploaded_at: new Date().toISOString() });
    }

    setStatuses((prev) => ({ ...prev, [contactId]: { ...getStatus(contactId), contact_id: contactId, files: nextFiles, photo_received: nextFiles.length > 0 } }));
    await saveStatus(contactId, { files: nextFiles, photo_received: nextFiles.length > 0 });
    setUploadingId(null);
  };

  const deleteFile = async (contactId: number, fileIndex: number, fileName: string) => {
    const current = getStatus(contactId);
    const nextFiles = current.files.filter((_, index) => index !== fileIndex);
    setStatuses((prev) => ({ ...prev, [contactId]: { ...current, files: nextFiles, photo_received: nextFiles.length > 0 } }));
    await saveStatus(contactId, { files: nextFiles, photo_received: nextFiles.length > 0 });
    showToast(`${fileName} 삭제 완료`);
  };

  const downloadFile = (file: UploadedFile) => {
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return members.filter((member) => {
      const status = getStatus(member.id);
      const matchSearch =
        !keyword ||
        [member.name, member.title, member.bunyanghoe_number, member.assigned_to, member.consultant, member.phone, status.pr_name, status.pr_company, status.pr_activity_region, status.pr_output_url]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchAssigned = !fAssigned || member.assigned_to === fAssigned;
      const matchStatus =
        !fStatus ||
        (fStatus === "사진미수취" && !status.photo_received) ||
        (fStatus === "정보미수취" && !status.info_received) ||
        (fStatus === "TF2미전달" && !status.tf2_delivered) ||
        (fStatus === "PR미완료" && !status.pr_completed) ||
        (fStatus === "제작불가" && status.production_impossible) ||
        (fStatus === "완료" && status.photo_received && status.info_received && status.tf2_delivered && status.pr_completed);
      return matchSearch && matchAssigned && matchStatus;
    });
  }, [members, search, fAssigned, fStatus, getStatus]);

  const stats = useMemo(() => {
    const values = members.map((member) => getStatus(member.id));
    return {
      total: members.length,
      photo: values.filter((s) => s.photo_received).length,
      info: values.filter((s) => s.info_received).length,
      tf2: values.filter((s) => s.tf2_delivered).length,
      pr: values.filter((s) => s.pr_completed).length,
      impossible: values.filter((s) => s.production_impossible).length,
    };
  }, [members, getStatus]);

  const activeFilters = [search, fAssigned, fStatus].filter(Boolean).length;
  const resetFilters = () => {
    setSearch("");
    setFAssigned("");
    setFStatus("");
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><PackageCheck size={20} style={{ color: "var(--accent-text)" }} /><h1 className="crm-title">컨텐츠관리</h1></div>
          <p className="crm-subtitle mt-1">PR패키지 제작을 위한 사진, 기본정보, TF2 전달, 산출물 완료 상태를 관리합니다.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button type="button" onClick={fetchData} className="btn-premium btn-secondary"><RefreshCw size={14} />새로고침</button>
          <a href="/member-manage" className="btn-premium btn-primary"><Users size={14} />회원관리</a>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="전체 회원" value={stats.total} icon={Users} tone="info" />
          <StatCard label="사진 수취" value={stats.photo} icon={Camera} tone="purple" />
          <StatCard label="정보 수취" value={stats.info} icon={Info} tone="warning" />
          <StatCard label="TF2 전달" value={stats.tf2} icon={Send} tone="cyan" />
          <StatCard label="PR 완료" value={stats.pr} icon={PackageCheck} tone="success" />
          <StatCard label="제작불가" value={stats.impossible} icon={X} tone="danger" />
        </div>
      </div>

      <div className="premium-filterbar flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 md:px-7">
        <div className="relative w-full sm:w-[360px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="회원명, 넘버링, 회사, 산출물 URL 검색..." className="h-9 w-full rounded-full border pl-9 pr-3 text-[13px] font-semibold outline-none" />
        </div>
        <SelectChip value={fAssigned} onChange={setFAssigned} options={TEAM} placeholder="담당자" />
        <SelectChip value={fStatus} onChange={setFStatus} options={SETUP_FILTERS} placeholder="진행상태" />
        {activeFilters > 0 && <button type="button" onClick={resetFilters} className="btn-premium btn-danger h-8">초기화</button>}
        <span className="ml-auto hidden text-[12px] font-bold md:block" style={{ color: "var(--text-faint)" }}>{filteredMembers.length.toLocaleString()} / {members.length.toLocaleString()}명</span>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4 md:px-7">
        {loading ? (
          <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex h-full items-center justify-center"><div className="premium-card p-8"><EmptyState icon="🎬" title="표시할 컨텐츠 대상이 없습니다" description="계약완료 또는 예약완료 회원이 있으면 이곳에 표시됩니다" /></div></div>
        ) : (
          <>
            <div className="crm-table-wrap hidden h-full overflow-auto xl:block">
              <table className="crm-table min-w-[1450px]">
                <thead>
                  <tr><th className="w-[290px]">회원</th><th className="w-[120px]">전환상태</th><th className="w-[120px]">사진</th><th className="w-[120px]">정보</th><th className="w-[120px]">TF2</th><th className="w-[130px]">PR패키지</th><th className="w-[120px]">제작불가</th><th className="w-[140px]">파일</th><th className="w-[130px]">담당자</th><th className="w-[140px]">진행률</th><th className="w-[150px]">업데이트</th><th className="w-[80px]"></th></tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const status = getStatus(member.id);
                    const selected = selectedMember?.id === member.id;
                    const score = completionScore(status);
                    return (
                      <tr key={member.id} data-selected={selected ? "true" : "false"} className="cursor-pointer" onClick={() => { setSelectedMember(member); setDetailTab("overview"); }}>
                        <td><div className="crm-row-center gap-3"><div className="crm-avatar" style={{ background: avatarBg(member.name) }}>{member.name?.[0] || "콘"}</div><div className="min-w-0"><div className="crm-row-main truncate">{member.name}</div><div className="crm-row-sub truncate">{member.bunyanghoe_number || "넘버링 없음"} · {member.title || "-"}</div></div></div></td>
                        <td><Badge tone={resultTone(member.meeting_result)}>{member.meeting_result || "-"}</Badge></td>
                        <td><Badge tone={doneTone(status.photo_received)} icon={Camera}>{status.photo_received ? "수취" : "미수취"}</Badge></td>
                        <td><Badge tone={doneTone(status.info_received)} icon={Info}>{status.info_received ? "수취" : "미수취"}</Badge></td>
                        <td><Badge tone={doneTone(status.tf2_delivered)} icon={Send}>{status.tf2_delivered ? "전달" : "미전달"}</Badge></td>
                        <td><Badge tone={doneTone(status.pr_completed)} icon={PackageCheck}>{status.pr_completed ? "완료" : "미완료"}</Badge></td>
                        <td><Badge tone={status.production_impossible ? "danger" : "muted"} icon={X}>{status.production_impossible ? "제작불가" : "-"}</Badge></td>
                        <td><Badge tone={status.files.length ? "purple" : "muted"} icon={ImageIcon}>{status.files.length}개</Badge></td>
                        <td><Badge tone="purple" icon={User}>{member.assigned_to || "-"}</Badge></td>
                        <td><div className="flex min-w-[110px] items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}><div className="h-full rounded-full" style={{ width: `${score}%`, background: score === 100 ? "var(--success)" : "var(--warning)" }} /></div><span className="text-[11px] font-bold" style={{ color: score === 100 ? "var(--success-text)" : "var(--warning-text)" }}>{score}%</span></div></td>
                        <td><span className="crm-meta">{formatDateTime(status.updated_at)}</span></td>
                        <td><button type="button" onClick={(e) => { e.stopPropagation(); setSelectedMember(member); setDetailTab("pr"); }} className="btn-premium btn-secondary h-8 w-8 p-0"><FileText size={13} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="h-full overflow-y-auto xl:hidden"><div className="space-y-3">{filteredMembers.map((member) => <MemberMobileCard key={member.id} member={member} status={getStatus(member.id)} onClick={() => { setSelectedMember(member); setDetailTab("overview"); }} />)}</div></div>
          </>
        )}
      </main>

      {selectedMember && (
        <DetailSlidePanel
          member={selectedMember}
          status={getStatus(selectedMember.id)}
          tab={detailTab}
          onTab={setDetailTab}
          onClose={() => setSelectedMember(null)}
          onToggle={(field) => toggleCheckbox(selectedMember.id, field)}
          onChange={(field, value) => updateStatusField(selectedMember.id, field, value)}
          onSave={() => saveStatus(selectedMember.id)}
          onFileUpload={(files) => handleFileUpload(selectedMember.id, files)}
          onFileDelete={(index, fileName) => deleteFile(selectedMember.id, index, fileName)}
          onFileDownload={downloadFile}
          saving={savingId === selectedMember.id}
          uploading={uploadingId === selectedMember.id}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90]">
          <div className="rounded-[14px] px-4 py-3 text-[13px] font-bold" style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xl)" }}>{toast}</div>
        </div>
      )}
    </div>
  );
}
