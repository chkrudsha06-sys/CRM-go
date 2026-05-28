"use client";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Edit2,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers3,
  MapPin,
  Phone,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Search,
  Sparkles,
  Trash2,
  Truck,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";

interface WanpanTruck {
  id: number;
  team_size: number | null;
  agency: string | null;
  contact_point: string | null;
  contact_point_title: string | null;
  contact_phone: string | null;
  location: string | null;
  site_name: string | null;
  dispatch_date: string | null;
  is_ordered: boolean;
  is_direct_order: boolean;
  staff_count: number | null;
  staff_members: string | null;
  consultant_count: number | null;
  consultant_members: string | null;
  has_photo: boolean;
  order_qty_base: number | null;
  order_qty_extra: number | null;
  notes: string | null;
  assigned_to: string | null;
  order_confirmed_by: string | null;
  report_data: string | null;
}

type ReportCustomer = {
  name: string;
  title: string;
  phone: string;
  note: string;
};

type ReportData = {
  pre_contact: string;
  field_contact: string;
  managed_count: string;
  customers: ReportCustomer[];
};

const DAEHYUP_MEMBERS = [
  "김정후",
  "김창완",
  "최웅",
  "조계현",
  "이세호",
  "기여운",
  "최연전",
];
const CONSULTANT_MEMBERS = [
  "박경화",
  "박혜은",
  "조승현",
  "박민경",
  "백선중",
  "강아름",
  "전정훈",
  "박나라",
];
const CONFIRM_MEMBERS = ["김재영", "최은정"];

const EMPTY_FORM = {
  team_size: "",
  agency: "",
  contact_point: "",
  contact_point_title: "",
  contact_phone: "",
  location: "",
  site_name: "",
  dispatch_date: "",
  is_ordered: false,
  is_direct_order: false,
  staff_count: "",
  staff_members: [] as string[],
  consultant_count: "",
  consultant_members: [] as string[],
  has_photo: false,
  order_qty_base: "",
  order_qty_extra: "",
  notes: "",
  assigned_to: "",
  order_confirmed_by: null as string | null,
  report_data: null as string | null,
};

const EMPTY_REPORT: ReportData = {
  pre_contact: "",
  field_contact: "",
  managed_count: "",
  customers: [],
};

function parseMembers(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseReport(value: string | null): ReportData | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed || null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "ko-KR",
      {
        month: "2-digit",
        day: "2-digit",
      },
    );
  } catch {
    return value;
  }
}

function formatFullDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );
  } catch {
    return value;
  }
}

function phoneFormat(value: string) {
  let v = value.replace(/[^0-9]/g, "");
  if (v.length > 3 && v.length <= 7) v = `${v.slice(0, 3)}-${v.slice(3)}`;
  else if (v.length > 7)
    v = `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7, 11)}`;
  return v;
}

function safe(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function toneStyle(tone: string) {
  const map: Record<
    string,
    {
      bg: string;
      color: string;
      dot: string;
      border: string;
      badgeClass: string;
    }
  > = {
    success: {
      bg: "var(--success-bg)",
      color: "var(--success-text)",
      dot: "var(--success)",
      border: "var(--success-border)",
      badgeClass: "badge-success",
    },
    info: {
      bg: "var(--info-bg)",
      color: "var(--info-text)",
      dot: "var(--info)",
      border: "var(--info-border)",
      badgeClass: "badge-info",
    },
    warning: {
      bg: "var(--warning-bg)",
      color: "var(--warning-text)",
      dot: "var(--warning)",
      border: "var(--warning-border)",
      badgeClass: "badge-warning",
    },
    danger: {
      bg: "var(--danger-bg)",
      color: "var(--danger-text)",
      dot: "var(--danger)",
      border: "var(--danger-border)",
      badgeClass: "badge-danger",
    },
    purple: {
      bg: "var(--purple-bg)",
      color: "var(--purple-text)",
      dot: "var(--purple)",
      border: "var(--purple-border)",
      badgeClass: "badge-purple",
    },
    muted: {
      bg: "var(--surface-3)",
      color: "var(--text-muted)",
      dot: "var(--text-subtle)",
      border: "var(--border)",
      badgeClass: "badge-muted",
    },
  };
  return map[tone] || map.muted;
}

function orderTone(truck: WanpanTruck) {
  if (truck.is_ordered && truck.order_confirmed_by) return "success";
  if (truck.is_ordered) return "info";
  if (truck.is_direct_order) return "purple";
  return "muted";
}

function Badge({
  children,
  tone = "muted",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: string;
  icon?: React.ElementType;
}) {
  const c = toneStyle(tone);
  return (
    <span className={`badge-premium ${c.badgeClass}`}>
      {Icon ? (
        <Icon size={12} />
      ) : (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: c.dot }}
        />
      )}
      {children}
    </span>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return <label className="crm-meta mb-2 block">{children}</label>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="crm-section-title mb-3">{children}</p>;
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone: string;
}) {
  const c = toneStyle(tone);
  return (
    <div className="premium-card flex items-center justify-between px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] border"
          style={{ background: c.bg, borderColor: c.border, color: c.color }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="crm-tiny">{label}</p>
          <p
            className="mt-0.5 text-[22px] font-[830] tracking-[-0.055em]"
            style={{ color: "var(--text-strong)" }}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}

function selectOptionLabel(option: string) {
  const labels: Record<string, string> = {
    ordered: "발주완료",
    not_ordered: "미발주",
    direct: "직발주",
    confirmed: "확인완료",
    photo: "촬영",
    no_photo: "미촬영",
  };
  if (/^\d+$/.test(option)) return `${option}월`;
  return labels[option] || option;
}

function SelectFilter({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[38px] min-w-[112px] appearance-none rounded-full border px-3 pr-8 text-[12.5px] font-[740] outline-none transition-colors"
        style={{
          background: value ? "var(--accent-subtle)" : "var(--surface-2)",
          borderColor: value ? "var(--accent-border)" : "var(--border)",
          color: value ? "var(--accent-text)" : "var(--text-muted)",
        }}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {selectOptionLabel(option)}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--text-faint)" }}
      />
    </div>
  );
}

function MemberSelector({
  count,
  selected,
  options,
  onChange,
  label,
  tone = "info",
}: {
  count: number;
  selected: string[];
  options: string[];
  onChange: (value: string[]) => void;
  label: string;
  tone?: string;
}) {
  if (count <= 0) return null;
  const c = toneStyle(tone);
  const toggle = (name: string) => {
    if (selected.includes(name))
      onChange(selected.filter((item) => item !== name));
    else if (selected.length < count) onChange([...selected, name]);
  };

  return (
    <div
      className="rounded-[16px] border p-4 md:col-span-2"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p
          className="text-[13px] font-[800] tracking-[-0.03em]"
          style={{ color: c.color }}
        >
          {label}
        </p>
        <span
          className="badge-premium"
          style={{
            background: "var(--surface)",
            borderColor: c.border,
            color: c.color,
          }}
        >
          {selected.length}/{count}명
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((name) => {
          const active = selected.includes(name);
          const disabled = !active && selected.length >= count;
          return (
            <button
              key={name}
              type="button"
              disabled={disabled}
              onClick={() => toggle(name)}
              className="rounded-[10px] border px-3 py-2 text-[12.5px] font-[760] transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: active ? c.color : "var(--surface)",
                borderColor: active ? c.color : "var(--border)",
                color: active ? "#fff" : "var(--text-muted)",
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string | number | null | undefined;
  tone?: string;
}) {
  const c = toneStyle(tone);
  return (
    <div
      className="rounded-[14px] border px-3 py-2"
      style={{
        borderColor: c.border,
        background: tone === "muted" ? "var(--surface-2)" : c.bg,
      }}
    >
      <p className="crm-tiny">{label}</p>
      <p
        className="crm-row-sub mt-1 truncate"
        style={{ color: tone === "muted" ? "var(--text)" : c.color }}
      >
        {safe(value)}
      </p>
    </div>
  );
}

function IconButton({
  children,
  label,
  tone = "info",
  onClick,
}: {
  children: ReactNode;
  label: string;
  tone?: string;
  onClick: () => void;
}) {
  const c = toneStyle(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-[10px] border transition-all hover:-translate-y-0.5"
      style={{ background: c.bg, borderColor: c.border, color: c.color }}
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

function ReportModal({
  truck,
  onClose,
  onSaved,
}: {
  truck: WanpanTruck;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = parseReport(truck.report_data);
  const [mode, setMode] = useState<"view" | "edit">(existing ? "view" : "edit");
  const [data, setData] = useState<ReportData>(existing || { ...EMPTY_REPORT });
  const [saving, setSaving] = useState(false);

  const inputClass =
    "h-[40px] w-full rounded-[13px] border px-3 text-[13px] font-[640] outline-none";

  const updateCustomer = (
    index: number,
    field: keyof ReportCustomer,
    value: string,
  ) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.map((customer, i) =>
        i === index ? { ...customer, [field]: value } : customer,
      ),
    }));
  };

  const syncManagedCount = (value: string) => {
    const count = Number(value) || 0;
    let customers = [...data.customers];
    if (count > customers.length) {
      for (let i = customers.length; i < count; i += 1)
        customers.push({ name: "", title: "", phone: "", note: "" });
    } else {
      customers = customers.slice(0, count);
    }
    setData({ ...data, managed_count: value, customers });
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("wanpan_trucks")
      .update({ report_data: JSON.stringify(data) })
      .eq("id", truck.id);
    setSaving(false);
    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
    onSaved();
    setMode("view");
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div
        className="crm-modal flex max-h-[88vh] max-w-4xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="slide-panel-header flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="badge-premium badge-warning">
                <FileText size={13} /> 완판트럭 리포트
              </span>
              <span className="badge-premium badge-muted">
                {formatFullDate(truck.dispatch_date)}
              </span>
            </div>
            <h2 className="crm-title text-[22px]">
              {truck.site_name || "현장 미입력"}
            </h2>
            <p className="crm-subtitle mt-1">
              {truck.location || "-"} · {truck.agency || "-"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === "view" && (
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="btn-premium btn-secondary"
              >
                <Edit2 size={14} /> 수정
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-premium btn-secondary h-10 w-10 p-0"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {mode === "view" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <StatCard
                  icon={<Phone size={17} />}
                  label="출장전 접촉"
                  value={`${data.pre_contact || 0}명`}
                  tone="info"
                />
                <StatCard
                  icon={<Users size={17} />}
                  label="현장 접촉"
                  value={`${data.field_contact || 0}명`}
                  tone="success"
                />
                <StatCard
                  icon={<ClipboardList size={17} />}
                  label="관리고객"
                  value={`${data.managed_count || 0}명`}
                  tone="warning"
                />
              </div>

              <section className="premium-card overflow-hidden">
                <div
                  className="flex items-center justify-between border-b px-4 py-3"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  <SectionTitle>관리고객 리스트</SectionTitle>
                  <span className="badge-premium badge-muted">
                    {data.customers.length}명
                  </span>
                </div>
                {data.customers.length === 0 ? (
                  <div
                    className="flex h-32 items-center justify-center text-[13px] font-[650]"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    등록된 관리고객이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="crm-table min-w-[760px]">
                      <thead>
                        <tr>
                          {["고객명", "직급", "연락처", "비고"].map(
                            (header) => (
                              <th key={header}>{header}</th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {data.customers.map((customer, index) => (
                          <tr key={index}>
                            <td>
                              <p className="crm-row-main">
                                {customer.name || "-"}
                              </p>
                            </td>
                            <td>
                              <p className="crm-row-sub">
                                {customer.title || "-"}
                              </p>
                            </td>
                            <td>
                              <p className="crm-row-sub">
                                {customer.phone || "-"}
                              </p>
                            </td>
                            <td>
                              <p className="crm-row-sub">
                                {customer.note || "-"}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <InputLabel>출장전 접촉인원</InputLabel>
                  <input
                    type="number"
                    className={inputClass}
                    value={data.pre_contact}
                    onChange={(e) =>
                      setData({ ...data, pre_contact: e.target.value })
                    }
                  />
                </div>
                <div>
                  <InputLabel>현장 접촉인원</InputLabel>
                  <input
                    type="number"
                    className={inputClass}
                    value={data.field_contact}
                    onChange={(e) =>
                      setData({ ...data, field_contact: e.target.value })
                    }
                  />
                </div>
                <div>
                  <InputLabel>관리고객</InputLabel>
                  <input
                    type="number"
                    className={inputClass}
                    value={data.managed_count}
                    onChange={(e) => syncManagedCount(e.target.value)}
                  />
                </div>
              </div>

              {data.customers.length > 0 && (
                <section className="premium-card p-4">
                  <SectionTitle>관리고객 리스트</SectionTitle>
                  <div className="space-y-3">
                    {data.customers.map((customer, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-2 rounded-[14px] border p-3 md:grid-cols-4"
                        style={{
                          background: "var(--surface-2)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <input
                          className={inputClass}
                          value={customer.name}
                          onChange={(e) =>
                            updateCustomer(index, "name", e.target.value)
                          }
                          placeholder="고객명"
                        />
                        <input
                          className={inputClass}
                          value={customer.title}
                          onChange={(e) =>
                            updateCustomer(index, "title", e.target.value)
                          }
                          placeholder="직급"
                        />
                        <input
                          className={inputClass}
                          value={customer.phone}
                          onChange={(e) =>
                            updateCustomer(
                              index,
                              "phone",
                              phoneFormat(e.target.value),
                            )
                          }
                          placeholder="연락처"
                        />
                        <input
                          className={inputClass}
                          value={customer.note}
                          onChange={(e) =>
                            updateCustomer(index, "note", e.target.value)
                          }
                          placeholder="비고"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {mode === "edit" && (
          <div className="slide-panel-footer flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-premium btn-secondary"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-premium btn-primary"
            >
              <Save size={15} /> {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TruckModal({
  editItem,
  form,
  saving,
  setForm,
  onClose,
  onSave,
}: {
  editItem: WanpanTruck | null;
  form: typeof EMPTY_FORM;
  saving: boolean;
  setForm: (value: typeof EMPTY_FORM) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const inputClass =
    "h-[40px] w-full rounded-[13px] border px-3 text-[13px] font-[640] outline-none";
  const textareaClass =
    "min-h-[82px] w-full resize-none rounded-[13px] border px-3 py-3 text-[13px] font-[640] outline-none";

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div
        className="crm-modal flex max-h-[90vh] max-w-4xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="slide-panel-header flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="badge-premium badge-warning">
                <Truck size={13} /> 완판트럭
              </span>
              <span className="badge-premium badge-muted">
                {editItem ? "수정 모드" : "신규 등록"}
              </span>
            </div>
            <h2 className="crm-title text-[22px]">
              {editItem ? "완판트럭 수정" : "완판트럭 신규 등록"}
            </h2>
            <p className="crm-subtitle mt-1">
              발송 일정, 현장 정보, 출장 인원, 발주 상태를 입력합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary h-10 w-10 p-0"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <InputLabel>발송일</InputLabel>
              <input
                type="date"
                className={inputClass}
                value={form.dispatch_date}
                onChange={(e) =>
                  setForm({ ...form, dispatch_date: e.target.value })
                }
              />
            </div>
            <div>
              <InputLabel>현장위치</InputLabel>
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="예: 인천 송도"
              />
            </div>
            <div>
              <InputLabel>현장명</InputLabel>
              <input
                className={inputClass}
                value={form.site_name}
                onChange={(e) =>
                  setForm({ ...form, site_name: e.target.value })
                }
                placeholder="예: 더샵 센트럴파크"
              />
            </div>
            <div>
              <InputLabel>대행사</InputLabel>
              <input
                className={inputClass}
                value={form.agency}
                onChange={(e) => setForm({ ...form, agency: e.target.value })}
              />
            </div>
            <div>
              <InputLabel>접점</InputLabel>
              <input
                className={inputClass}
                value={form.contact_point}
                onChange={(e) =>
                  setForm({ ...form, contact_point: e.target.value })
                }
                placeholder="소통자 이름"
              />
            </div>
            <div>
              <InputLabel>직급</InputLabel>
              <input
                className={inputClass}
                value={form.contact_point_title}
                onChange={(e) =>
                  setForm({ ...form, contact_point_title: e.target.value })
                }
                placeholder="소통자 직급"
              />
            </div>
            <div>
              <InputLabel>연락처</InputLabel>
              <input
                className={inputClass}
                value={form.contact_phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    contact_phone: phoneFormat(e.target.value),
                  })
                }
                maxLength={13}
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <InputLabel>조직수</InputLabel>
              <input
                type="number"
                className={inputClass}
                value={form.team_size}
                onChange={(e) =>
                  setForm({ ...form, team_size: e.target.value })
                }
              />
            </div>
            <div>
              <InputLabel>대협팀 출장인원</InputLabel>
              <input
                type="number"
                className={inputClass}
                value={form.staff_count}
                onChange={(e) => {
                  const count = Number(e.target.value) || 0;
                  setForm({
                    ...form,
                    staff_count: e.target.value,
                    staff_members: form.staff_members.slice(0, count),
                  });
                }}
              />
            </div>
            <div>
              <InputLabel>컨설턴트 출장인원</InputLabel>
              <input
                type="number"
                className={inputClass}
                value={form.consultant_count}
                onChange={(e) => {
                  const count = Number(e.target.value) || 0;
                  setForm({
                    ...form,
                    consultant_count: e.target.value,
                    consultant_members: form.consultant_members.slice(0, count),
                  });
                }}
              />
            </div>

            <MemberSelector
              count={Number(form.staff_count) || 0}
              selected={form.staff_members || []}
              options={DAEHYUP_MEMBERS}
              onChange={(value) => setForm({ ...form, staff_members: value })}
              label="대협팀 선택"
              tone="info"
            />
            <MemberSelector
              count={Number(form.consultant_count) || 0}
              selected={form.consultant_members || []}
              options={CONSULTANT_MEMBERS}
              onChange={(value) =>
                setForm({ ...form, consultant_members: value })
              }
              label="컨설턴트 선택"
              tone="purple"
            />

            <div>
              <InputLabel>담당자 확인</InputLabel>
              <select
                className={inputClass}
                value={form.assigned_to}
                onChange={(e) =>
                  setForm({ ...form, assigned_to: e.target.value })
                }
              >
                <option value="">선택</option>
                {CONFIRM_MEMBERS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <InputLabel>촬영여부</InputLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, has_photo: true })}
                  className="h-[40px] rounded-[13px] border text-[13px] font-[780]"
                  style={{
                    background: form.has_photo
                      ? "var(--success-bg)"
                      : "var(--surface-2)",
                    borderColor: form.has_photo
                      ? "var(--success-border)"
                      : "var(--border)",
                    color: form.has_photo
                      ? "var(--success-text)"
                      : "var(--text-muted)",
                  }}
                >
                  촬영
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, has_photo: false })}
                  className="h-[40px] rounded-[13px] border text-[13px] font-[780]"
                  style={{
                    background: !form.has_photo
                      ? "var(--surface-3)"
                      : "var(--surface-2)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  미촬영
                </button>
              </div>
            </div>

            <div>
              <InputLabel>발주수량 기본</InputLabel>
              <input
                type="number"
                className={inputClass}
                value={form.order_qty_base}
                onChange={(e) =>
                  setForm({ ...form, order_qty_base: e.target.value })
                }
              />
            </div>
            <div>
              <InputLabel>발주수량 추가</InputLabel>
              <input
                type="number"
                className={inputClass}
                value={form.order_qty_extra}
                onChange={(e) =>
                  setForm({ ...form, order_qty_extra: e.target.value })
                }
              />
            </div>

            <div className="md:col-span-2">
              <InputLabel>비고</InputLabel>
              <textarea
                className={textareaClass}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="특이사항, 요청사항, 발주 메모 등을 입력하세요."
              />
            </div>
          </div>
        </div>

        <div className="slide-panel-footer flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-premium btn-primary"
          >
            <Save size={15} /> {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WanpanTruckPage() {
  const [trucks, setTrucks] = useState<WanpanTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<WanpanTruck | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterOrder, setFilterOrder] = useState("");
  const [filterPhoto, setFilterPhoto] = useState("");
  const [search, setSearch] = useState("");
  const [reportTruck, setReportTruck] = useState<WanpanTruck | null>(null);

  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("wanpan_trucks")
      .select("*")
      .order("dispatch_date", { ascending: false, nullsFirst: false });

    if (filterMonth) {
      const year = new Date().getFullYear();
      const month = filterMonth.padStart(2, "0");
      const lastDay = new Date(year, Number(filterMonth), 0).getDate();
      q = q
        .gte("dispatch_date", `${year}-${month}-01`)
        .lte("dispatch_date", `${year}-${month}-${lastDay}`);
    }

    const { data, error } = await q;
    if (error) {
      console.error("완판트럭 조회 실패:", error.message);
      setTrucks([]);
    } else {
      setTrucks((data || []) as WanpanTruck[]);
    }
    setLoading(false);
  }, [filterMonth]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  const filteredTrucks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return trucks.filter((truck) => {
      if (keyword) {
        const target = [
          truck.site_name,
          truck.location,
          truck.agency,
          truck.contact_point,
          truck.contact_phone,
          truck.assigned_to,
          truck.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!target.includes(keyword)) return false;
      }
      if (filterOrder === "ordered" && !truck.is_ordered) return false;
      if (filterOrder === "not_ordered" && truck.is_ordered) return false;
      if (filterOrder === "direct" && !truck.is_direct_order) return false;
      if (filterOrder === "confirmed" && !truck.order_confirmed_by)
        return false;
      if (filterPhoto === "photo" && !truck.has_photo) return false;
      if (filterPhoto === "no_photo" && truck.has_photo) return false;
      return true;
    });
  }, [filterOrder, filterPhoto, search, trucks]);

  const summary = useMemo(
    () => ({
      total: filteredTrucks.length,
      ordered: filteredTrucks.filter((item) => item.is_ordered).length,
      direct: filteredTrucks.filter((item) => item.is_direct_order).length,
      confirmed: filteredTrucks.filter((item) => !!item.order_confirmed_by)
        .length,
      reported: filteredTrucks.filter((item) => !!item.report_data).length,
    }),
    [filteredTrucks],
  );

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (truck: WanpanTruck) => {
    setEditItem(truck);
    setForm({
      team_size: truck.team_size ? String(truck.team_size) : "",
      agency: truck.agency || "",
      contact_point: truck.contact_point || "",
      contact_point_title: truck.contact_point_title || "",
      contact_phone: truck.contact_phone || "",
      location: truck.location || "",
      site_name: truck.site_name || "",
      dispatch_date: truck.dispatch_date?.split("T")[0] || "",
      is_ordered: truck.is_ordered,
      is_direct_order: truck.is_direct_order || false,
      assigned_to: truck.assigned_to || "",
      order_confirmed_by: truck.order_confirmed_by || null,
      staff_count: truck.staff_count ? String(truck.staff_count) : "",
      staff_members: parseMembers(truck.staff_members),
      consultant_count: truck.consultant_count
        ? String(truck.consultant_count)
        : "",
      consultant_members: parseMembers(truck.consultant_members),
      has_photo: truck.has_photo || false,
      order_qty_base: truck.order_qty_base ? String(truck.order_qty_base) : "",
      order_qty_extra: truck.order_qty_extra
        ? String(truck.order_qty_extra)
        : "",
      notes: truck.notes || "",
      report_data: truck.report_data || null,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      team_size: Number(form.team_size) || null,
      agency: form.agency || null,
      contact_point: form.contact_point || null,
      contact_point_title: form.contact_point_title || null,
      contact_phone: form.contact_phone || null,
      location: form.location || null,
      site_name: form.site_name || null,
      dispatch_date: form.dispatch_date || null,
      is_ordered: !!form.is_ordered,
      is_direct_order: !!form.is_direct_order,
      assigned_to: form.assigned_to || null,
      order_confirmed_by: form.order_confirmed_by || null,
      staff_count: Number(form.staff_count) || null,
      staff_members:
        form.staff_members?.length > 0
          ? JSON.stringify(form.staff_members)
          : null,
      consultant_count: Number(form.consultant_count) || null,
      consultant_members:
        form.consultant_members?.length > 0
          ? JSON.stringify(form.consultant_members)
          : null,
      has_photo: !!form.has_photo,
      order_qty_base: Number(form.order_qty_base) || null,
      order_qty_extra: Number(form.order_qty_extra) || null,
      notes: form.notes || null,
    };

    const res = editItem
      ? await supabase
          .from("wanpan_trucks")
          .update(payload)
          .eq("id", editItem.id)
      : await supabase.from("wanpan_trucks").insert(payload);

    setSaving(false);
    if (res.error) {
      alert(`저장 실패: ${res.error.message}`);
      return;
    }
    setShowModal(false);
    fetchTrucks();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase
      .from("wanpan_trucks")
      .delete()
      .eq("id", id);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    fetchTrucks();
  };

  const toggleOrder = async (id: number, current: boolean) => {
    await supabase
      .from("wanpan_trucks")
      .update({ is_ordered: !current })
      .eq("id", id);
    fetchTrucks();
  };

  const toggleDirectOrder = async (id: number, current: boolean) => {
    await supabase
      .from("wanpan_trucks")
      .update({ is_direct_order: !current })
      .eq("id", id);
    fetchTrucks();
  };

  const toggleConfirm = async (
    id: number,
    current: string | null,
    assignedTo: string | null,
  ) => {
    await supabase
      .from("wanpan_trucks")
      .update({ order_confirmed_by: current ? null : assignedTo })
      .eq("id", id);
    fetchTrucks();
  };

  const resetFilters = () => {
    setSearch("");
    setFilterMonth("");
    setFilterOrder("");
    setFilterPhoto("");
  };

  const activeFilters =
    [filterMonth, filterOrder, filterPhoto].filter(Boolean).length +
    (search ? 1 : 0);

  return (
    <div data-wanpan-page className="premium-page flex h-full flex-col overflow-hidden">
      <style jsx global>{`
        [data-wanpan-page] .crm-table-wrap {
          border-color: color-mix(in srgb, var(--border) 42%, transparent) !important;
          background: var(--surface);
        }

        [data-theme="dark"] [data-wanpan-page] .crm-table-wrap {
          border-color: color-mix(in srgb, var(--border) 28%, transparent) !important;
          box-shadow: inset 0 1px 0 color-mix(in srgb, white 3%, transparent);
        }

        [data-theme="dark"] [data-wanpan-page] .crm-table-wrap > div > div:first-child {
          border-bottom-color: color-mix(in srgb, var(--border) 30%, transparent) !important;
          background: color-mix(in srgb, var(--surface-2) 72%, #0b0f17 28%) !important;
        }

        [data-theme="dark"] [data-wanpan-page] .wanpan-row {
          border-top-color: color-mix(in srgb, var(--border) 24%, transparent) !important;
        }

        [data-theme="dark"] [data-wanpan-page] .wanpan-row:hover {
          background: color-mix(in srgb, var(--surface-2) 58%, transparent) !important;
        }

        [data-wanpan-page] .wanpan-row {
          border-top-color: color-mix(in srgb, var(--border) 58%, transparent) !important;
        }
      `}</style>
      <header className="premium-header flex-shrink-0 px-5 py-4 lg:px-7">
        <div className="premium-shell flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="badge-premium badge-warning">
                  <Truck size={13} /> 완판트럭
                </span>
                <span className="badge-premium badge-muted">
                  일정 · 발주 · 리포트 통합관리
                </span>
              </div>
              <h1 className="crm-title">완판트럭</h1>
              <p className="crm-subtitle mt-2">
                완판트럭 일정, 출장 인원, 발주 상태, 촬영 여부, 리포트까지 한
                화면에서 관리합니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:min-w-[760px]">
              <StatCard
                icon={<Route size={17} />}
                label="전체 회차"
                value={summary.total}
                tone="purple"
              />
              <StatCard
                icon={<CheckCircle2 size={17} />}
                label="발주 완료"
                value={summary.ordered}
                tone="success"
              />
              <StatCard
                icon={<Sparkles size={17} />}
                label="직발주"
                value={summary.direct}
                tone="purple"
              />
              <StatCard
                icon={<User size={17} />}
                label="확인 완료"
                value={summary.confirmed}
                tone="info"
              />
              <StatCard
                icon={<FileText size={17} />}
                label="리포트"
                value={summary.reported}
                tone="warning"
              />
            </div>
          </div>

          <div className="premium-filterbar rounded-[18px] px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[260px] flex-1 xl:max-w-[420px]">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-faint)" }}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="현장, 위치, 대행사, 접점, 담당자 검색"
                    className="crm-search w-full pl-9 pr-3"
                  />
                </div>
                <SelectFilter
                  value={filterMonth}
                  onChange={setFilterMonth}
                  options={Array.from(
                    { length: 12 },
                    (_, index) => `${index + 1}`,
                  )}
                  label="전체 월"
                />
                <SelectFilter
                  value={filterOrder}
                  onChange={setFilterOrder}
                  options={["ordered", "not_ordered", "direct", "confirmed"]}
                  label="발주 상태"
                />
                <SelectFilter
                  value={filterPhoto}
                  onChange={setFilterPhoto}
                  options={["photo", "no_photo"]}
                  label="촬영여부"
                />
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn-premium btn-secondary"
                >
                  <RefreshCcw size={14} /> 초기화
                  {activeFilters > 0 ? ` ${activeFilters}` : ""}
                </button>
                <button
                  type="button"
                  onClick={fetchTrucks}
                  className="btn-premium btn-secondary"
                >
                  <Filter size={14} /> 최신화
                </button>
                <button
                  type="button"
                  onClick={openAdd}
                  className="btn-premium btn-primary"
                >
                  <Plus size={15} /> 신규 등록
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-5 py-5 lg:px-7">
        <div className="premium-shell space-y-4">
          {loading ? (
            <section className="premium-card">
              <LoadingState />
            </section>
          ) : filteredTrucks.length === 0 ? (
            <section className="premium-card flex h-64 items-center justify-center">
              <EmptyState
                icon="🚚"
                title="완판트럭 데이터가 없습니다"
                description="첫 번째 회차를 등록해보세요"
                actionLabel="회차 등록하기"
                onAction={openAdd}
              />
            </section>
          ) : (
            <section className="crm-table-wrap overflow-hidden">
              <div className="hidden min-w-[1560px] xl:block">
                <div
                  className="grid h-12 items-center gap-2 border-b px-4 text-[11.5px] font-[800] tracking-[-0.02em]"
                  style={{
                    gridTemplateColumns:
                      "54px 96px 210px 126px 190px 96px 168px 168px 86px 96px 100px 96px 96px 122px minmax(170px,1fr) 88px",
                    borderColor: "color-mix(in srgb, var(--border) 44%, transparent)",
                    color: "var(--text-faint)",
                    background: "var(--surface-2)",
                  }}
                >
                  {[
                    "No",
                    "발송일",
                    "현장",
                    "대행사",
                    "접점",
                    "조직수",
                    "대협팀",
                    "컨설턴트",
                    "리포트",
                    "촬영",
                    "발주수량",
                    "발주",
                    "시안",
                    "담당확인",
                    "비고",
                    "관리",
                  ].map((header) => (
                    <span
                      key={header}
                      className={
                        header === "No" || header === "관리"
                          ? "text-center"
                          : ""
                      }
                    >
                      {header}
                    </span>
                  ))}
                </div>

                <div
                  className=""
                  style={{ borderColor: "color-mix(in srgb, var(--border) 30%, transparent)" }}
                >
                  {filteredTrucks.map((truck, index) => {
                    const staff = parseMembers(truck.staff_members);
                    const consultants = parseMembers(truck.consultant_members);
                    const hasReport = !!truck.report_data;
                    const tone = orderTone(truck);

                    return (
                      <div
                        key={truck.id}
                        className="wanpan-row grid min-h-[76px] items-center gap-2 border-t px-4 transition-colors hover:bg-white/[0.025]"
                        style={{
                          gridTemplateColumns:
                            "54px 96px 210px 126px 190px 96px 168px 168px 86px 96px 100px 96px 96px 122px minmax(170px,1fr) 88px",
                          borderLeft: `3px solid ${toneStyle(tone).dot}`,
                        }}
                      >
                        <span className="crm-meta text-center">
                          {index + 1}
                        </span>

                        <span className="crm-row-sub flex items-center gap-1.5">
                          <CalendarDays size={13} />{" "}
                          {formatDate(truck.dispatch_date)}
                        </span>

                        <div className="min-w-0">
                          <p className="crm-row-main truncate">
                            {truck.site_name || "-"}
                          </p>
                          <p className="crm-row-sub mt-0.5 flex items-center gap-1.5 truncate">
                            <MapPin size={12} /> {truck.location || "-"}
                          </p>
                        </div>

                        <span className="crm-row-sub truncate">
                          {truck.agency || "-"}
                        </span>

                        <div className="min-w-0">
                          <p
                            className="crm-row-sub truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {truck.contact_point || "-"}
                          </p>
                          <p className="crm-tiny mt-0.5 flex items-center gap-1 truncate">
                            {truck.contact_point_title || "-"}
                            {truck.contact_phone ? (
                              <>
                                {" "}
                                · <Phone size={11} /> {truck.contact_phone}
                              </>
                            ) : null}
                          </p>
                        </div>

                        <Badge tone="muted">
                          <Users size={12} />{" "}
                          {truck.team_size ? `${truck.team_size}명` : "-"}
                        </Badge>

                        <div className="flex max-w-[168px] flex-wrap gap-1">
                          {staff.length > 0 ? (
                            staff.map((name) => (
                              <Badge key={name} tone="info">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="crm-tiny">-</span>
                          )}
                        </div>

                        <div className="flex max-w-[168px] flex-wrap gap-1">
                          {consultants.length > 0 ? (
                            consultants.map((name) => (
                              <Badge key={name} tone="purple">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="crm-tiny">-</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setReportTruck(truck)}
                          className="flex h-9 w-9 items-center justify-center rounded-[11px] border"
                          style={{
                            background: hasReport
                              ? "var(--success-bg)"
                              : "var(--surface-2)",
                            borderColor: hasReport
                              ? "var(--success-border)"
                              : "var(--border)",
                            color: hasReport
                              ? "var(--success-text)"
                              : "var(--text-subtle)",
                          }}
                          title={hasReport ? "리포트 보기" : "리포트 작성"}
                        >
                          <FileText size={15} />
                        </button>

                        <Badge
                          tone={truck.has_photo ? "success" : "muted"}
                          icon={ImageIcon}
                        >
                          {truck.has_photo ? "촬영" : "미촬영"}
                        </Badge>

                        <p
                          className="crm-row-sub"
                          style={{ color: "var(--text)" }}
                        >
                          {truck.order_qty_base || "-"}
                          {truck.order_qty_extra ? (
                            <span style={{ color: "var(--accent-text)" }}>
                              {" "}
                              + {truck.order_qty_extra}
                            </span>
                          ) : null}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            toggleOrder(truck.id, truck.is_ordered)
                          }
                        >
                          <Badge
                            tone={truck.is_ordered ? "success" : "muted"}
                            icon={truck.is_ordered ? CheckCircle2 : XCircle}
                          >
                            {truck.is_ordered ? "완료" : "미발주"}
                          </Badge>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleDirectOrder(truck.id, truck.is_direct_order)
                          }
                        >
                          <Badge
                            tone={truck.is_direct_order ? "purple" : "muted"}
                          >
                            {truck.is_direct_order ? "직발주" : "미발주"}
                          </Badge>
                        </button>

                        {truck.assigned_to ? (
                          <div className="space-y-1">
                            <Badge tone="info" icon={User}>
                              {truck.assigned_to}
                            </Badge>
                            <button
                              type="button"
                              onClick={() =>
                                toggleConfirm(
                                  truck.id,
                                  truck.order_confirmed_by,
                                  truck.assigned_to,
                                )
                              }
                            >
                              <Badge
                                tone={
                                  truck.order_confirmed_by
                                    ? "success"
                                    : "warning"
                                }
                              >
                                {truck.order_confirmed_by
                                  ? "확인완료"
                                  : "담당자확인"}
                              </Badge>
                            </button>
                          </div>
                        ) : (
                          <span className="crm-tiny">-</span>
                        )}

                        <p
                          className="crm-row-sub truncate"
                          title={truck.notes || ""}
                        >
                          {truck.notes || "-"}
                        </p>

                        <div className="flex justify-center gap-1">
                          <IconButton
                            label="수정"
                            tone="info"
                            onClick={() => openEdit(truck)}
                          >
                            <Edit2 size={14} />
                          </IconButton>
                          <IconButton
                            label="삭제"
                            tone="danger"
                            onClick={() => handleDelete(truck.id)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 p-3 xl:hidden">
                {filteredTrucks.map((truck, index) => {
                  const staff = parseMembers(truck.staff_members);
                  const consultants = parseMembers(truck.consultant_members);
                  const tone = orderTone(truck);
                  return (
                    <article
                      key={truck.id}
                      className="premium-card premium-card-hover overflow-hidden p-4"
                      style={{ borderLeft: `3px solid ${toneStyle(tone).dot}` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="badge-premium badge-muted">
                              #{index + 1}
                            </span>
                            <Badge
                              tone={truck.is_ordered ? "success" : "muted"}
                            >
                              {truck.is_ordered ? "발주완료" : "미발주"}
                            </Badge>
                            <Badge tone={truck.has_photo ? "success" : "muted"}>
                              {truck.has_photo ? "촬영" : "미촬영"}
                            </Badge>
                          </div>
                          <p className="crm-row-main truncate">
                            {truck.site_name || "-"}
                          </p>
                          <p className="crm-row-sub mt-1 flex items-center gap-1.5">
                            <MapPin size={13} /> {truck.location || "-"} ·{" "}
                            {formatDate(truck.dispatch_date)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 gap-1">
                          <IconButton
                            label="리포트"
                            tone={truck.report_data ? "success" : "warning"}
                            onClick={() => setReportTruck(truck)}
                          >
                            <FileText size={14} />
                          </IconButton>
                          <IconButton
                            label="수정"
                            tone="info"
                            onClick={() => openEdit(truck)}
                          >
                            <Edit2 size={14} />
                          </IconButton>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniInfo label="대행사" value={truck.agency} />
                        <MiniInfo
                          label="접점"
                          value={`${safe(truck.contact_point)} / ${safe(truck.contact_point_title)}`}
                        />
                        <MiniInfo
                          label="대협팀"
                          value={staff.length ? staff.join(", ") : "-"}
                          tone="info"
                        />
                        <MiniInfo
                          label="컨설턴트"
                          value={
                            consultants.length ? consultants.join(", ") : "-"
                          }
                          tone="purple"
                        />
                        <MiniInfo
                          label="조직수"
                          value={truck.team_size ? `${truck.team_size}명` : "-"}
                        />
                        <MiniInfo
                          label="발주수량"
                          value={`${safe(truck.order_qty_base)}${truck.order_qty_extra ? ` + ${truck.order_qty_extra}` : ""}`}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            toggleOrder(truck.id, truck.is_ordered)
                          }
                          className="btn-premium btn-secondary"
                        >
                          {truck.is_ordered ? "발주완료" : "미발주"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            toggleDirectOrder(truck.id, truck.is_direct_order)
                          }
                          className="btn-premium btn-secondary"
                        >
                          {truck.is_direct_order ? "직발주" : "시안미발주"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(truck.id)}
                          className="btn-premium btn-danger"
                        >
                          <Trash2 size={14} /> 삭제
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {reportTruck && (
        <ReportModal
          truck={reportTruck}
          onClose={() => setReportTruck(null)}
          onSaved={() => {
            fetchTrucks();
            setReportTruck(null);
          }}
        />
      )}

      {showModal && (
        <TruckModal
          editItem={editItem}
          form={form}
          saving={saving}
          setForm={setForm}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
