"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, Calendar, MapPin, User, Edit2, Save, X, ChevronDown, Check } from "lucide-react";
import ContactNotes from "@/components/ContactNotes";

interface Contact {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  customer_type: string | null;
  tm_sensitivity: string | null;
  prospect_type: string | null;
  meeting_date: string | null;
  meeting_date_text: string | null;
  meeting_address: string | null;
  meeting_result: string | null;
  management_stage: string | null;
  assigned_to: string | null;
  memo: string | null;
  created_at: string;
}

const BADGE: Record<string, string> = {
  계약완료: "bg-emerald-100 text-emerald-700 border-emerald-200",
  예약완료: "bg-blue-100 text-blue-700 border-blue-200",
  서류만수취: "bg-purple-100 text-purple-700 border-purple-200",
  미팅후가망관리: "bg-amber-100 text-amber-700 border-amber-200",
  계약거부: "bg-red-100 text-red-700 border-red-200",
  미팅불발: "bg-slate-100 text-slate-500 border-slate-200",
  즉가입가망: "bg-red-100 text-red-600 border-red-200",
  미팅예정가망: "bg-amber-100 text-amber-700 border-amber-200",
  연계매출가망: "bg-slate-100 text-slate-600 border-slate-200",
  신규: "bg-sky-100 text-sky-700 border-sky-200",
  기고객: "bg-violet-100 text-violet-700 border-violet-200",
  리드: "bg-pink-100 text-pink-600 border-pink-200",
  프로스펙팅: "bg-orange-100 text-orange-500 border-orange-200",
  딜크로징: "bg-sky-100 text-sky-600 border-sky-200",
  리텐션: "bg-purple-100 text-purple-500 border-purple-200",
};

const OPT = {
  customer_type: ["신규", "기고객"],
  prospect_type: ["즉가입가망", "미팅예정가망", "연계매출가망"],
  meeting_result: ["계약완료", "예약완료", "서류만수취", "미팅후가망관리", "계약거부", "미팅불발"],
  management_stage: ["리드", "프로스펙팅", "딜크로징", "리텐션"],
};

const TEAM = ["조계현", "이세호", "기여운", "최연전"];
const AVATAR_COLORS = ["bg-blue-500","bg-violet-500","bg-amber-500","bg-emerald-500","bg-rose-500","bg-cyan-500"];
function getAvatarColor(name: string) {
  let s = 0; for (const c of name) s += c.charCodeAt(0);
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

function Badge({ value }: { value: string }) {
  return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${BADGE[value] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{value}</span>;
}

// ─── 인라인 셀렉트 컴포넌트 ───────────────────────────────────────
// 클릭하면 드롭다운 → 선택 즉시 Supabase 저장
function InlineSelect({
  value,
  options,
  onSave,
}: {
  value: string | null;
  options: string[];
  onSave: (val: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = async (val: string) => {
    setSaving(true);
    await onSave(val);
    setSaving(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      {/* 현재 값 표시 — 클릭하면 드롭다운 열림 */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 group transition-all ${saving ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        disabled={saving}
        title="클릭해서 바로 변경"
      >
        {value ? (
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${BADGE[value] || "bg-slate-100 text-slate-600 border-slate-200"} group-hover:shadow-sm transition-shadow`}>
            {value}
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold border border-dashed border-slate-300 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-400 transition-colors">
            선택하기
          </span>
        )}
        <ChevronDown
          size={11}
          className={`text-slate-400 transition-transform group-hover:text-blue-500 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 min-w-[140px]">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
            >
              <span className={`px-2 py-0.5 rounded-full font-semibold border ${BADGE[opt] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {opt}
              </span>
              {value === opt && <Check size={12} className="text-blue-500 ml-2 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────

function InfoRow({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-50 last:border-0">
      <span className="text-xs font-semibold text-slate-400 w-28 flex-shrink-0 mt-0.5">{label}</span>
      <div className="flex-1">
        {children || (value ? <span className="text-sm text-slate-700">{value}</span> : <span className="text-sm text-slate-300">-</span>)}
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from("contacts").select("*").eq("id", id).single();
      setContact(data as Contact);
      setForm(data || {});
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("contacts").update(form).eq("id", id);
    if (error) { alert(`저장 실패: ${error.message}`); setSaving(false); return; }
    setContact({ ...contact!, ...form });
    setEditing(false);
    setSaving(false);
  };

  // ─── 인라인 즉시 저장 함수 ──────────────────────────────────────
  const updateFieldInline = async (field: string, value: string) => {
    const { error } = await supabase.from("contacts").update({ [field]: value }).eq("id", id);
    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
    // 로컬 상태 즉시 반영
    setContact((prev) => prev ? { ...prev, [field]: value } : prev);
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };
  // ────────────────────────────────────────────────────────────────

  const inp = "w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400";

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  if (!contact) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <p>고객 정보를 찾을 수 없습니다</p>
      <button onClick={() => router.back()} className="mt-3 text-sm text-blue-600 underline">돌아가기</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
              <ArrowLeft size={16}/>
            </button>
            <div className={`w-10 h-10 ${getAvatarColor(contact.name)} rounded-xl flex items-center justify-center text-white font-black text-lg`}>
              {contact.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-800">{contact.name}</h1>
                {contact.title && <span className="text-sm text-slate-400">{contact.title}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {contact.customer_type && <Badge value={contact.customer_type}/>}
                {contact.management_stage && <Badge value={contact.management_stage}/>}
                {contact.meeting_result && <Badge value={contact.meeting_result}/>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                  <X size={14}/> 취소
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1E3A8A] text-white font-bold rounded-xl hover:bg-blue-800 disabled:opacity-50">
                  <Save size={14}/> {saving ? "저장 중..." : "저장"}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200">
                <Edit2 size={14}/> 수정
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">

          {/* 기본 정보 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <User size={14} className="text-blue-500"/> 기본 정보
            </h2>
            {editing ? (
              <div className="space-y-3">
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">고객명</label>
                  <input className={inp} value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})}/></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">직급</label>
                  <input className={inp} value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">연락처</label>
                  <input className={inp} value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">고객유형</label>
                  <select className={inp} value={form.customer_type||""} onChange={e=>setForm({...form,customer_type:e.target.value})}>
                    <option value="">선택</option>{OPT.customer_type.map(o=><option key={o}>{o}</option>)}
                  </select></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">담당자</label>
                  <select className={inp} value={form.assigned_to||""} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
                    <option value="">선택</option>{TEAM.map(o=><option key={o}>{o}</option>)}
                  </select></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">담당컨설턴트</label>
                  <input className={inp} value={form.consultant||""} onChange={e=>setForm({...form,consultant:e.target.value})} placeholder="담당 컨설턴트명"/></div>
              </div>
            ) : (
              <div>
                <InfoRow label="고객명"><span className="text-sm font-bold text-slate-800">{contact.name||"-"}</span></InfoRow>
                <InfoRow label="직급"><span className="text-sm text-slate-700">{contact.title||"-"}</span></InfoRow>
                <InfoRow label="연락처"><div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400"/><span className="text-sm text-slate-700">{contact.phone||"-"}</span></div></InfoRow>
                <InfoRow label="고객유형">{contact.customer_type ? <Badge value={contact.customer_type}/> : <span className="text-sm text-slate-300">-</span>}</InfoRow>
                <InfoRow label="담당자"><span className="text-sm text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">{contact.assigned_to||"-"}</span></InfoRow>
                <InfoRow label="담당컨설턴트"><span className="text-sm text-slate-700">{(contact as any).consultant||"-"}</span></InfoRow>
                <InfoRow label="등록일"><span className="text-sm text-slate-500">{new Date(contact.created_at).toLocaleDateString("ko-KR")}</span></InfoRow>
              </div>
            )}
          </div>

          {/* 미팅 정보 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-blue-500"/> 미팅 정보
            </h2>
            {editing ? (
              <div className="space-y-3">
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">미팅일정 (날짜)</label>
                  <input type="date" className={inp} value={form.meeting_date?.split("T")[0]||""} onChange={e=>setForm({...form,meeting_date:e.target.value})}/></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">미팅일정 (텍스트)</label>
                  <input className={inp} value={form.meeting_date_text||""} onChange={e=>setForm({...form,meeting_date_text:e.target.value})} placeholder="예: 4월 셋째주"/></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">미팅지역</label>
                  <input className={inp} value={form.meeting_address||""} onChange={e=>setForm({...form,meeting_address:e.target.value})}/></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">미팅결과</label>
                  <select className={inp} value={form.meeting_result||""} onChange={e=>setForm({...form,meeting_result:e.target.value})}>
                    <option value="">선택</option>{OPT.meeting_result.map(o=><option key={o}>{o}</option>)}
                  </select></div>
                {form.meeting_result === "계약완료" && (
                  <div><label className="text-xs font-semibold text-slate-400 mb-1 block">계약완료일 <span className="text-blue-400">★</span></label>
                    <input type="date" className={inp} value={form.contract_date?.split("T")[0]||""} onChange={e=>setForm({...form,contract_date:e.target.value})}/></div>
                )}
                {form.meeting_result === "예약완료" && (
                  <div><label className="text-xs font-semibold text-slate-400 mb-1 block">예약완료일 <span className="text-blue-400">★</span></label>
                    <input type="date" className={inp} value={form.reservation_date?.split("T")[0]||""} onChange={e=>setForm({...form,reservation_date:e.target.value})}/></div>
                )}
              </div>
            ) : (
              <div>
                <InfoRow label="미팅일정">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-blue-400"/>
                    <span className="text-sm text-slate-700">
                      {contact.meeting_date ? new Date(contact.meeting_date+"T00:00:00").toLocaleDateString("ko-KR") : contact.meeting_date_text || "-"}
                    </span>
                  </div>
                </InfoRow>
                <InfoRow label="미팅지역"><div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400"/><span className="text-sm text-slate-700">{contact.meeting_address||"-"}</span></div></InfoRow>
                <InfoRow label="미팅결과">{contact.meeting_result ? <Badge value={contact.meeting_result}/> : <span className="text-sm text-slate-300">-</span>}</InfoRow>
                {contact.meeting_result === "계약완료" && <InfoRow label="계약완료일"><span className="text-sm text-slate-700">{(contact as any).contract_date ? new Date((contact as any).contract_date).toLocaleDateString("ko-KR") : "-"}</span></InfoRow>}
                {contact.meeting_result === "예약완료" && <InfoRow label="예약완료일"><span className="text-sm text-slate-700">{(contact as any).reservation_date ? new Date((contact as any).reservation_date).toLocaleDateString("ko-KR") : "-"}</span></InfoRow>}
              </div>
            )}
          </div>

          {/* 영업 정보 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              📊 영업 정보
              <span className="text-[10px] font-normal text-blue-400 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                관리구간 바로 수정 가능
              </span>
            </h2>
            {editing ? (
              <div className="space-y-3">
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block">고객관리구간</label>
                  <select className={inp} value={form.management_stage||""} onChange={e=>setForm({...form,management_stage:e.target.value})}>
                    <option value="">선택</option>{OPT.management_stage.map(o=><option key={o}>{o}</option>)}
                  </select></div>
              </div>
            ) : (
              <div>
                {/* ── 고객관리구간: 인라인 즉시 수정 ── */}
                <InfoRow label="고객관리구간">
                  <InlineSelect
                    value={contact.management_stage}
                    options={OPT.management_stage}
                    onSave={(val) => updateFieldInline("management_stage", val)}
                  />
                </InfoRow>
              </div>
            )}
          </div>

          {/* 비고 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3">📝 비고</h2>
            {editing ? (
              <textarea className={`${inp} resize-none`} rows={4}
                value={form.memo||""} onChange={e=>setForm({...form,memo:e.target.value})}
                placeholder="메모를 입력하세요"/>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-h-[80px]">
                {contact.memo ? (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{contact.memo}</p>
                ) : (
                  <p className="text-sm text-slate-300">비고 내용 없음</p>
                )}
              </div>
            )}
          </div>

          {/* 활동 노트 히스토리 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <ContactNotes contactId={contact.id} />
          </div>

        </div>
      </div>
    </div>
  );
}
