"use client";
import EmptyState from "@/components/EmptyState";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, X, Copy, ExternalLink, Trash2, Sparkles, Building2, MapPin, Calendar, FileText, Edit3 } from "lucide-react";

const inp = "w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400";
const lbl = "block text-xs font-bold text-slate-500 mb-1.5";

interface Site {
  id: number; site_name: string; work_address: string;
  developer: string; constructor: string; trustee: string; agency: string;
  business_site_name: string; business_address: string;
  property_type: string; unit_count: string; rt_fee: string;
  staff_start_date: string; model_house_date: string; grand_open_date: string;
  selling_points: string; created_at: string; created_by: string;
}

const initForm = {
  site_name:"", work_address:"", developer:"", constructor:"", trustee:"", agency:"",
  business_site_name:"", business_address:"", property_type:"", unit_count:"", rt_fee:"",
  staff_start_date:"", model_house_date:"", grand_open_date:"", selling_points:"",
};

export default function NewSitesPage() {
  const [sites,setSites]=useState<Site[]>([]);
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [editId,setEditId]=useState<number|null>(null);
  const [form,setForm]=useState(initForm);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState<string|null>(null);
  const [me,setMe]=useState("");

  useEffect(()=>{try{const u=localStorage.getItem("crm_user");if(u)setMe(JSON.parse(u).name||"");}catch{}},[]);

  const loadSites=async()=>{setLoading(true);const{data}=await supabase.from("new_sites").select("*").order("created_at",{ascending:false});setSites(data||[]);setLoading(false);};
  useEffect(()=>{loadSites();},[]);

  const openCreate=()=>{setEditId(null);setForm(initForm);setShowModal(true);};
  const openEdit=(s:Site)=>{
    setEditId(s.id);
    setForm({
      site_name:s.site_name||"", work_address:s.work_address||"",
      developer:s.developer||"", constructor:s.constructor||"", trustee:s.trustee||"", agency:s.agency||"",
      business_site_name:s.business_site_name||"", business_address:s.business_address||"",
      property_type:s.property_type||"", unit_count:s.unit_count||"", rt_fee:s.rt_fee||"",
      staff_start_date:s.staff_start_date||"", model_house_date:s.model_house_date||"", grand_open_date:s.grand_open_date||"",
      selling_points:s.selling_points||"",
    });
    setShowModal(true);
  };

  const handleSave=async()=>{
    if(!form.site_name.trim()){alert("현장명을 입력하세요");return;}
    setSaving(true);
    if(editId){
      const{error}=await supabase.from("new_sites").update({...form}).eq("id",editId);
      if(error){alert("수정 실패: "+error.message);setSaving(false);return;}
      showToast("현장 정보가 수정되었습니다");
    }else{
      const{error}=await supabase.from("new_sites").insert({...form,created_by:me});
      if(error){alert("등록 실패: "+error.message);setSaving(false);return;}
      showToast("신규현장이 등록되었습니다");
    }
    setForm(initForm);setShowModal(false);setSaving(false);setEditId(null);loadSites();
  };

  const handleDelete=async(id:number)=>{
    if(!confirm("이 현장 정보를 삭제하시겠습니까?"))return;
    await supabase.from("new_sites").delete().eq("id",id);loadSites();
  };

  const copyLink=(id:number)=>{
    const url=`${window.location.origin}/sites/${id}`;
    try{navigator.clipboard.writeText(url);}catch{const t=document.createElement("textarea");t.value=url;document.body.appendChild(t);t.select();document.execCommand("copy");document.body.removeChild(t);}
    showToast("링크가 복사되었습니다");
  };

  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),2000);};
  const isNew=(d:string)=>Date.now()-new Date(d).getTime()<2*24*60*60*1000;
  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"}):"";

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {toast&&<div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg" style={{animation:"slideIn 0.3s ease"}}>✅ {toast}</div>}
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes sparkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.15)}}.badge-sparkle{animation:sparkle 1.5s ease-in-out infinite;}`}</style>

      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">🏗️ 신규현장</h1>
            <p className="text-sm text-slate-500 mt-0.5">신규 분양현장 정보 등록 및 공유 · <b className="text-slate-700">{sites.length}건</b></p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700"><Plus size={14}/>현장 등록</button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        {loading?<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
        :sites.length===0?<EmptyState icon="🏗️" title="등록된 현장이 없습니다" description="신규현장을 등록해주세요"/>
        :(
          <div className="overflow-x-auto" style={{maxHeight:"calc(100vh - 100px)"}}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap w-8">#</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">상태</th>
                  <th className="text-left px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">현장명</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">물건구분</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">세대수</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">R/T(수수료)</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">시행사</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">시공사</th>
                  <th className="text-center px-3 py-2.5 text-blue-600 text-xs font-semibold whitespace-nowrap bg-blue-50/40">착석일</th>
                  <th className="text-center px-3 py-2.5 text-violet-600 text-xs font-semibold whitespace-nowrap bg-violet-50/40">MH오픈</th>
                  <th className="text-center px-3 py-2.5 text-emerald-600 text-xs font-semibold whitespace-nowrap bg-emerald-50/40">GR오픈</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">등록일</th>
                  <th className="text-center px-3 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sites.map((s,idx)=>(
                  <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="text-center px-3 py-3 text-xs text-slate-400">{idx+1}</td>
                    <td className="text-center px-3 py-3">
                      {isNew(s.created_at)
                        ?<span className="badge-sparkle inline-flex items-center gap-0.5 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black rounded-full"><Sparkles size={9}/>신규</span>
                        :<span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full font-semibold">등록</span>
                      }
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-slate-800 text-sm">{s.site_name}</p>
                      {s.business_address&&<p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">{s.business_address}</p>}
                    </td>
                    <td className="text-center px-3 py-3 text-xs text-slate-600">{s.property_type||"-"}</td>
                    <td className="text-center px-3 py-3 text-xs font-semibold text-slate-700">{s.unit_count||"-"}</td>
                    <td className="text-center px-3 py-3 text-xs font-bold text-blue-600">{s.rt_fee||"-"}</td>
                    <td className="text-center px-3 py-3 text-xs text-slate-600 max-w-[120px] truncate">{s.developer||"-"}</td>
                    <td className="text-center px-3 py-3 text-xs text-slate-600 max-w-[120px] truncate">{s.constructor||"-"}</td>
                    <td className="text-center px-3 py-3 text-xs font-semibold text-blue-600 bg-blue-50/20">{s.staff_start_date||"-"}</td>
                    <td className="text-center px-3 py-3 text-xs font-semibold text-violet-600 bg-violet-50/20">{s.model_house_date||"-"}</td>
                    <td className="text-center px-3 py-3 text-xs font-semibold text-emerald-600 bg-emerald-50/20">{s.grand_open_date||"-"}</td>
                    <td className="text-center px-3 py-3 text-[11px] text-slate-400">{fmtDate(s.created_at)}</td>
                    <td className="text-center px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={()=>openEdit(s)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="수정"><Edit3 size={13}/></button>
                        <button onClick={()=>copyLink(s.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="링크 복사"><Copy size={13}/></button>
                        <a href={`/sites/${s.id}`} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-50 transition-colors" title="미리보기"><ExternalLink size={13}/></a>
                        <button onClick={()=>handleDelete(s.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="삭제"><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ 등록/수정 모달 ═══ */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={()=>{setShowModal(false);setEditId(null);}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">🏗️ {editId?"현장 정보 수정":"신규현장 등록"}</h2>
              <button onClick={()=>{setShowModal(false);setEditId(null);}}><X size={18} className="text-slate-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 기본 정보 */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                <p className="text-xs font-bold text-blue-600 flex items-center gap-1"><Building2 size={13}/>기본 정보</p>
                <div><label className={lbl}>현장명 <span className="text-red-400">*</span></label><input className={inp} value={form.site_name} onChange={e=>setForm({...form,site_name:e.target.value})} placeholder="예: 덕수궁 롯데캐슬136"/></div>
                <div><label className={lbl}>근무지 주소</label><input className={inp} value={form.work_address} onChange={e=>setForm({...form,work_address:e.target.value})} placeholder="예: 서울 용산구 한강대로 23"/></div>
              </div>
              {/* 사업자 정보 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-600">🏢 사업자 정보</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>시행사</label><input className={inp} value={form.developer} onChange={e=>setForm({...form,developer:e.target.value})}/></div>
                  <div><label className={lbl}>시공사</label><input className={inp} value={form.constructor} onChange={e=>setForm({...form,constructor:e.target.value})}/></div>
                  <div><label className={lbl}>신탁사</label><input className={inp} value={form.trustee} onChange={e=>setForm({...form,trustee:e.target.value})}/></div>
                  <div><label className={lbl}>대행사</label><input className={inp} value={form.agency} onChange={e=>setForm({...form,agency:e.target.value})}/></div>
                </div>
              </div>
              {/* 사업지 정보 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-600 flex items-center gap-1"><MapPin size={13}/>사업지 정보</p>
                <div><label className={lbl}>사업지 현장명</label><input className={inp} value={form.business_site_name} onChange={e=>setForm({...form,business_site_name:e.target.value})}/></div>
                <div><label className={lbl}>사업지 주소</label><input className={inp} value={form.business_address} onChange={e=>setForm({...form,business_address:e.target.value})}/></div>
              </div>
              {/* 물건 정보 + R/T */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-600">🏠 물건 정보</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lbl}>물건구분</label><input className={inp} value={form.property_type} onChange={e=>setForm({...form,property_type:e.target.value})} placeholder="아파트 / 오피스텔"/></div>
                  <div><label className={lbl}>세대수</label><input className={inp} value={form.unit_count} onChange={e=>setForm({...form,unit_count:e.target.value})} placeholder="1,200세대"/></div>
                  <div><label className={lbl}>R/T (수수료)</label><input className={inp} value={form.rt_fee} onChange={e=>setForm({...form,rt_fee:e.target.value})} placeholder="예: 3,000만원"/></div>
                </div>
              </div>
              {/* 현장 스케줄 */}
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 space-y-3">
                <p className="text-xs font-bold text-amber-600 flex items-center gap-1"><Calendar size={13}/>현장 스케줄</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lbl}>직원착석일</label><input className={inp} value={form.staff_start_date} onChange={e=>setForm({...form,staff_start_date:e.target.value})} placeholder="2026.05.01"/></div>
                  <div><label className={lbl}>MH 오픈일</label><input className={inp} value={form.model_house_date} onChange={e=>setForm({...form,model_house_date:e.target.value})} placeholder="2026.06.15"/></div>
                  <div><label className={lbl}>그랜드오픈일</label><input className={inp} value={form.grand_open_date} onChange={e=>setForm({...form,grand_open_date:e.target.value})} placeholder="2026.07.01"/></div>
                </div>
              </div>
              {/* 현장 소구점 */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1"><FileText size={13}/>현장 소구점</p>
                <textarea className={`${inp} min-h-[120px]`} value={form.selling_points} onChange={e=>setForm({...form,selling_points:e.target.value})} placeholder="현장의 강점, 특징, 매력 포인트를 자유롭게 작성하세요..."/>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={()=>{setShowModal(false);setEditId(null);}} className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl">취소</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">{saving?"저장 중...":(editId?"수정 완료":"현장 등록")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
