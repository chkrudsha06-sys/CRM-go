"use client";

import { useState } from "react";
import { Contact, TeamMember } from "@/types";
import { TEAM_MEMBERS } from "@/lib/supabase";
import { X, Save } from "lucide-react";

interface Props {
  contact: Contact | null;
  onSave: (data: Partial<Contact>) => Promise<void>;
  onClose: () => void;
}

export default function ContactModal({ contact, onSave, onClose }: Props) {
  const [form, setForm] = useState<Partial<Contact>>({
    name: contact?.name || "",
    phone: contact?.phone || "",
    customer_type: contact?.customer_type || "신규",
    consultant: contact?.consultant || "",
    has_tm: contact?.has_tm || false,
    tm_date: contact?.tm_date || "",
    tm_sensitivity: contact?.tm_sensitivity || undefined,
    prospect_type: contact?.prospect_type || undefined,
    meeting_date: contact?.meeting_date || "",
    meeting_address: contact?.meeting_address || "",
    memo: contact?.memo || "",
    meeting_result: contact?.meeting_result || undefined,
    contract_date: contact?.contract_date || "",
    assigned_to: contact?.assigned_to || "조계현",
  });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof Contact, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value || undefined }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return alert("고객명을 입력하세요.");
    setSaving(true);
    const cleaned = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    );
    await onSave(cleaned);
    setSaving(false);
  };

  const inputCls = "w-full px-3 py-2 text-sm bg-brand-surface border border-brand-border rounded-lg focus:outline-none focus:border-brand-gold";
  const labelCls = "block text-brand-muted text-xs mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-navy-light border border-brand-border rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <h2 className="text-brand-text font-semibold">
            {contact ? "고객 정보 수정" : "신규 고객 등록"}
          </h2>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-text">
            <X size={18} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>고객명 *</label>
              <input
                type="text"
                value={form.name || ""}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
                placeholder="이름 또는 직함"
                required
              />
            </div>
            <div>
              <label className={labelCls}>연락처</label>
              <input
                type="text"
                value={form.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
                className={inputCls}
                placeholder="010-0000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>담당팀원 *</label>
              <select
                value={form.assigned_to || "조계현"}
                onChange={(e) => set("assigned_to", e.target.value as TeamMember)}
                className={inputCls}
              >
                {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>신규/기고객</label>
              <select
                value={form.customer_type || "신규"}
                onChange={(e) => set("customer_type", e.target.value)}
                className={inputCls}
              >
                <option value="신규">신규</option>
                <option value="기고객">기고객</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>담당컨설턴트</label>
              <input
                type="text"
                value={form.consultant || ""}
                onChange={(e) => set("consultant", e.target.value)}
                className={inputCls}
                placeholder="컨설턴트명"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>TM 여부</label>
              <select
                value={form.has_tm ? "true" : "false"}
                onChange={(e) => set("has_tm", e.target.value === "true")}
                className={inputCls}
              >
                <option value="false">미진행</option>
                <option value="true">완료 (O)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>TM일</label>
              <input
                type="date"
                value={form.tm_date?.split("T")[0] || ""}
                onChange={(e) => set("tm_date", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>TM 감도</label>
              <select
                value={form.tm_sensitivity || ""}
                onChange={(e) => set("tm_sensitivity", e.target.value)}
                className={inputCls}
              >
                <option value="">선택</option>
                <option value="상">상</option>
                <option value="중">중</option>
                <option value="하">하</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>가망 구분</label>
              <select
                value={form.prospect_type || ""}
                onChange={(e) => set("prospect_type", e.target.value)}
                className={inputCls}
              >
                <option value="">없음</option>
                <option value="즉가입가망">즉가입가망</option>
                <option value="미팅예정가망">미팅예정가망</option>
                <option value="연계매출가망고객">연계매출가망고객</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>미팅 일정</label>
              <input
                type="date"
                value={form.meeting_date?.split("T")[0] || ""}
                onChange={(e) => set("meeting_date", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>미팅 주소 / 지역</label>
              <input
                type="text"
                value={form.meeting_address || ""}
                onChange={(e) => set("meeting_address", e.target.value)}
                className={inputCls}
                placeholder="현장명 또는 지역"
              />
            </div>
            <div>
              <label className={labelCls}>미팅 결과</label>
              <select
                value={form.meeting_result || ""}
                onChange={(e) => set("meeting_result", e.target.value)}
                className={inputCls}
              >
                <option value="">결과 없음</option>
                <option value="계약완료">계약완료</option>
                <option value="예약완료">예약완료</option>
                <option value="서류만수취">서류만수취</option>
                <option value="미팅후가망관리">미팅후가망관리</option>
                <option value="계약거부">계약거부</option>
                <option value="미팅불발">미팅불발</option>
              </select>
            </div>
          </div>

          {(form.meeting_result === "계약완료" || form.meeting_result === "예약완료") && (
            <div>
              <label className={labelCls}>계약 완료일</label>
              <input
                type="date"
                value={form.contract_date?.split("T")[0] || ""}
                onChange={(e) => set("contract_date", e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>메모 / 비고</label>
            <textarea
              value={form.memo || ""}
              onChange={(e) => set("memo", e.target.value)}
              className={`${inputCls} resize-none`}
              rows={3}
              placeholder="고객 특이사항, 현장 정보, 대화 내용 등"
            />
          </div>
        </form>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-brand-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-brand-muted border border-brand-border rounded-lg hover:bg-brand-surface"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-gold text-brand-navy font-semibold rounded-lg hover:bg-brand-gold-light disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "저장 중..." : contact ? "수정 완료" : "등록 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
