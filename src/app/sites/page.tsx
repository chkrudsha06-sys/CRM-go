"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Sparkles, MapPin, Calendar, ChevronRight, Search } from "lucide-react";

interface Site {
  id: number; site_name: string; work_address: string;
  developer: string; constructor: string; trustee: string; agency: string;
  business_site_name: string; business_address: string;
  property_type: string; unit_count: string; rt_fee: string;
  staff_start_date: string; model_house_date: string; grand_open_date: string;
  selling_points: string; created_at: string;
}

const REGIONS = ["모든지역","서울","경기남부","경기북부","인천","부산","울산","대구","경상도","대전","세종","충청도","광주","전라도","강원도","제주도"];

const REGION_RULES: [string, string[]][] = [
  ["서울",["서울"]],["인천",["인천"]],["부산",["부산"]],["울산",["울산"]],["대구",["대구"]],["대전",["대전"]],["세종",["세종"]],["광주",["광주"]],["제주도",["제주"]],
  ["경기남부",["수원","용인","성남","안양","안산","화성","평택","시흥","광명","군포","의왕","과천","오산","하남","이천","여주","양평"]],
  ["경기북부",["고양","파주","의정부","양주","동두천","포천","연천","구리","남양주","가평","김포"]],
  ["경상도",["경남","경북","창원","진주","김해","양산","거제","통영","포항","경주","구미","김천","안동","경산"]],
  ["충청도",["충남","충북","천안","아산","서산","당진","청주","충주","제천","논산","공주"]],
  ["전라도",["전남","전북","목포","여수","순천","전주","익산","군산","나주","광양"]],
  ["강원도",["강원","춘천","원주","강릉","속초","동해","삼척","태백","홍천","횡성","영월","평창"]],
];

function classifyRegion(addr: string): string {
  if (!addr) return "기타";
  for (const [region, keywords] of REGION_RULES) {
    for (const kw of keywords) { if (addr.includes(kw)) return region; }
  }
  if (addr.includes("경기")) return "경기남부";
  return "기타";
}
function isNew(d: string) { return Date.now() - new Date(d).getTime() < 2*24*60*60*1000; }

export default function SitesListPage() {
  const router = useRouter();
  const [sites,setSites] = useState<Site[]>([]);
  const [loading,setLoading] = useState(true);
  const [region,setRegion] = useState("모든지역");
  const [search,setSearch] = useState("");

  useEffect(()=>{
    try { document.documentElement.removeAttribute("data-theme"); } catch {}
    return()=>{try{const s=localStorage.getItem("crm_dark_mode");if(s!=="false")document.documentElement.setAttribute("data-theme","dark");}catch{}};
  },[]);

  useEffect(()=>{
    (async()=>{const{data}=await supabase.from("new_sites").select("*").order("created_at",{ascending:false});setSites(data||[]);setLoading(false);})();
  },[]);

  const mapped = sites.map(s=>({...s,region:classifyRegion(s.business_address||s.work_address)}));
  const filtered = mapped.filter(s=>{
    if(region!=="모든지역"&&s.region!==region) return false;
    if(search.trim()){const q=search.toLowerCase();if(!(s.site_name||"").toLowerCase().includes(q)&&!(s.business_address||"").toLowerCase().includes(q)&&!(s.developer||"").toLowerCase().includes(q)) return false;}
    return true;
  });
  const counts = REGIONS.map(r=>({name:r,count:r==="모든지역"?sites.length:mapped.filter(s=>s.region===r).length}));

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <style>{`@keyframes sparkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.1)}}.badge-new{animation:sparkle 1.5s ease-in-out infinite;}
.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none;}`}</style>

      {/* ═══ 헤더 ═══ */}
      <header className="bg-[#1a1a2e]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/company-logo.png" alt="분양의신" width={120} height={58} className="h-8 sm:h-10 w-auto" />
            <div>
              <p className="text-[10px] sm:text-[11px] text-white/40">현장정보 · 광고인㈜ 대외협력팀 제공</p>
            </div>
          </div>
          {/* 검색 */}
          <div className="relative hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="현장명, 주소, 시행사 검색..."
              className="pl-9 pr-4 py-2 text-sm border border-white/10 rounded-full w-64 focus:outline-none focus:border-blue-400 bg-white/10 text-white placeholder-white/40"/>
          </div>
        </div>
      </header>

      {/* ═══ 지역 탭 ═══ */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {counts.map(r=>(
              <button key={r.name} onClick={()=>setRegion(r.name)}
                className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                  region===r.name?"text-blue-600 border-blue-600":"text-slate-400 border-transparent hover:text-slate-600"}`}>
                {r.name}{r.count>0&&<span className="ml-0.5 text-[10px]">({r.count})</span>}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* 모바일 검색 */}
      <div className="sm:hidden px-4 pt-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="현장명, 주소 검색..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white"/>
        </div>
      </div>

      {/* ═══ 현장 목록 ═══ */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-4">
          {region==="모든지역"?"전체 현장":region}
          <span className="text-sm font-normal text-slate-400 ml-2">{filtered.length}건</span>
        </h2>

        {loading?(
          <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
        ):filtered.length===0?(
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-300 text-sm">등록된 현장이 없습니다</p>
          </div>
        ):(
          <div className="space-y-3">
            {filtered.map(s=>(
              <div key={s.id} onClick={()=>router.push(`/sites/${s.id}`)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    {/* 왼쪽 정보 */}
                    <div className="flex-1 min-w-0">
                      {/* 현장명 */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {s.property_type&&<span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">{s.property_type}</span>}
                        <h3 className="text-base sm:text-lg font-black text-slate-800">{s.site_name}</h3>
                      </div>
                      {/* 주소 */}
                      {(s.business_address||s.work_address)&&(
                        <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1 mb-2.5">
                          <MapPin size={12} className="flex-shrink-0"/><span className="truncate">{s.business_address||s.work_address}</span>
                        </p>
                      )}
                      {/* 태그들 */}
                      <div className="flex flex-wrap gap-1.5">
                        {s.unit_count&&<span className="text-[10px] sm:text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">{s.unit_count}세대</span>}
                        {s.rt_fee&&<span className="text-[10px] sm:text-[11px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-semibold">R/T {s.rt_fee}</span>}
                        {s.developer&&<span className="text-[10px] sm:text-[11px] px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full">{s.developer}</span>}
                        {s.staff_start_date&&<span className="text-[10px] sm:text-[11px] px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full flex items-center gap-0.5"><Calendar size={9}/>착석 {s.staff_start_date}</span>}
                        {s.grand_open_date&&<span className="text-[10px] sm:text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-0.5"><Calendar size={9}/>GR {s.grand_open_date}</span>}
                      </div>
                    </div>
                    {/* 오른쪽: 뱃지 + 화살표 */}
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      {isNew(s.created_at)&&(
                        <span className="badge-new inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] sm:text-xs font-black rounded-full shadow-sm">
                          <Sparkles size={11}/>신규현장
                        </span>
                      )}
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors hidden sm:block"/>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 하단 */}
      <footer className="max-w-5xl mx-auto px-6 pb-10">
        <div className="text-center pt-8 border-t border-slate-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image src="/icon-logo.png" alt="분양의신" width={48} height={48} className="h-10 sm:h-12 w-auto opacity-60"/>
          </div>
          <p className="text-xs text-slate-400 mt-1">본 정보는 광고인㈜ 대외협력팀에서 제공합니다</p>
        </div>
      </footer>
    </div>
  );
}
