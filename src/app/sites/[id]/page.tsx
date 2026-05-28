"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { ArrowLeft, MapPin, Share2 } from "lucide-react";

declare global { interface Window { kakao: any; } }

interface Site {
  id: number; site_name: string; work_address: string;
  developer: string; constructor: string; trustee: string; agency: string;
  business_site_name: string; business_address: string;
  property_type: string; unit_count: string; rt_fee: string;
  staff_start_date: string; model_house_date: string; grand_open_date: string;
  selling_points: string; created_at: string;
}

/* ═══ 카카오맵 컴포넌트 ═══ */
function KakaoMap({ address, mapId }: { address: string; mapId: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);

  // SDK 로드 — LatLng 존재 여부로 완전 로드 확인
  useEffect(() => {
    try {
      if (!address || typeof window === "undefined") return;
      const isFullyLoaded = () => !!window.kakao?.maps?.LatLng;

      if (isFullyLoaded()) { setSdkReady(true); return; }

      // 이미 스크립트 태그가 있으면 로드 완료 대기
      const exists = document.getElementById("kakao-sdk");
      if (exists) {
        // maps 네임스페이스는 있지만 load() 안 된 경우 → load() 호출
        if (window.kakao?.maps?.load && !isFullyLoaded()) {
          try { window.kakao.maps.load(() => setSdkReady(true)); } catch {}
        }
        // 폴링으로 대기
        const check = setInterval(() => { if (isFullyLoaded()) { setSdkReady(true); clearInterval(check); } }, 200);
        setTimeout(() => clearInterval(check), 10000);
        return;
      }

      const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
      if (!key) return;
      const s = document.createElement("script");
      s.id = "kakao-sdk";
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
      s.onload = () => { try { if (window.kakao) window.kakao.maps.load(() => setSdkReady(true)); } catch {} };
      s.onerror = () => {};
      document.head.appendChild(s);
    } catch {}
  }, [address]);

  // 지도 렌더
  useEffect(() => {
    try {
      if (!sdkReady || !mapRef.current || !address || !window.kakao?.maps?.LatLng) return;
      const renderMap = (lat: string, lng: string) => {
        try {
          const coords = new window.kakao.maps.LatLng(lat, lng);
          const map = new window.kakao.maps.Map(mapRef.current, { center: coords, level: 4 });
          new window.kakao.maps.Marker({ map, position: coords });
        } catch {}
      };
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result: any[], status: string) => {
        try {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            renderMap(result[0].y, result[0].x);
          } else {
            const ps = new window.kakao.maps.services.Places();
            ps.keywordSearch(address, (data: any[], st: string) => {
              try { if (st === window.kakao.maps.services.Status.OK && data.length > 0) renderMap(data[0].y, data[0].x); } catch {}
            });
          }
        } catch {}
      });
    } catch {}
  }, [sdkReady, address]);

  const kakaoUrl = `https://map.kakao.com/?q=${encodeURIComponent(address)}`;
  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
  const hasKey = !!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  if (!address) return null;

  return (
    <div className="mt-3">
      {hasKey ? (
        <div ref={mapRef} id={mapId} className="w-full h-[250px] sm:h-[300px] rounded-xl border border-slate-200" />
      ) : (
        <div className="w-full h-[180px] rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2">
          <MapPin size={28} className="text-slate-300" />
          <p className="text-xs text-slate-500 font-semibold px-4 text-center">{address}</p>
          <p className="text-[10px] text-slate-300">아래 버튼으로 지도를 확인하세요</p>
        </div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <a href={kakaoUrl} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold bg-[#FEE500] text-[#3C1E1E] rounded-lg hover:brightness-95 transition-all">
          카카오맵에서 보기
        </a>
        <a href={naverUrl} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold bg-[#03C75A] text-white rounded-lg hover:brightness-95 transition-all">
          네이버지도에서 보기
        </a>
      </div>
    </div>
  );
}

/* ═══ 메인 페이지 ═══ */
export default function SiteDetailPage() {
  const params = useParams();
  const [site, setSite] = useState<Site|null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(()=>{
    try { document.documentElement.removeAttribute("data-theme"); } catch {}
    return()=>{try{const s=localStorage.getItem("crm_dark_mode");if(s!=="false")document.documentElement.setAttribute("data-theme","dark");}catch{}};
  },[]);

  useEffect(()=>{
    (async()=>{
      const{data,error}=await supabase.from("new_sites").select("*").eq("id",params.id).maybeSingle();
      if(error||!data) setNotFound(true); else setSite(data);
      setLoading(false);
    })();
  },[params.id]);

  const handleShare=()=>{try{navigator.clipboard.writeText(window.location.href);}catch{const t=document.createElement("textarea");t.value=window.location.href;document.body.appendChild(t);t.select();document.execCommand("copy");document.body.removeChild(t);}setCopied(true);setTimeout(()=>setCopied(false),2000);};

  if(loading) return <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>;
  if(notFound||!site) return <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center"><div className="text-center"><p className="text-5xl mb-3">🏗️</p><p className="text-lg font-bold text-slate-700">현장 정보를 찾을 수 없습니다</p><a href="/sites" className="text-sm text-blue-500 mt-2 inline-block hover:underline">← 목록으로</a></div></div>;

  const fmtDate = (d:string) => d ? new Date(d).toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"}) : "";

  const InfoRow = ({label,value}:{label:string;value:string}) => (
    <div className="flex border-b border-slate-100 last:border-b-0">
      <div className="w-28 sm:w-32 flex-shrink-0 px-3 sm:px-4 py-3 bg-slate-50 text-xs font-bold text-slate-500 flex items-center">{label}</div>
      <div className="flex-1 px-3 sm:px-4 py-3 text-sm text-slate-800">{value||"-"}</div>
    </div>
  );
  const InfoRow2 = ({l1,v1,l2,v2}:{l1:string;v1:string;l2:string;v2:string}) => (
    <>
      {/* 모바일: 세로 배치 */}
      <div className="sm:hidden">
        <div className="flex border-b border-slate-100">
          <div className="w-28 flex-shrink-0 px-3 py-3 bg-slate-50 text-xs font-bold text-slate-500 flex items-center">{l1}</div>
          <div className="flex-1 px-3 py-3 text-sm text-slate-800">{v1||"-"}</div>
        </div>
        {l2 && <div className="flex border-b border-slate-100 last:border-b-0">
          <div className="w-28 flex-shrink-0 px-3 py-3 bg-slate-50 text-xs font-bold text-slate-500 flex items-center">{l2}</div>
          <div className="flex-1 px-3 py-3 text-sm text-slate-800">{v2||"-"}</div>
        </div>}
      </div>
      {/* PC: 가로 배치 */}
      <div className="hidden sm:flex border-b border-slate-100 last:border-b-0">
        <div className="w-28 flex-shrink-0 px-4 py-3 bg-slate-50 text-xs font-bold text-slate-500 flex items-center">{l1}</div>
        <div className="flex-1 px-4 py-3 text-sm text-slate-800 border-r border-slate-100">{v1||"-"}</div>
        <div className="w-28 flex-shrink-0 px-4 py-3 bg-slate-50 text-xs font-bold text-slate-500 flex items-center">{l2}</div>
        <div className="flex-1 px-4 py-3 text-sm text-slate-800">{v2||"-"}</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* 헤더 */}
      <header className="bg-[#1a1a2e]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <a href="/sites" className="flex items-center gap-3">
            <Image src="/company-logo.png" alt="분양의신" width={120} height={58} className="h-7 sm:h-9 w-auto"/>
            <p className="text-[10px] sm:text-[11px] text-white/40">현장정보 · 광고인㈜ 대외협력팀 제공</p>
          </a>
          <div className="flex items-center gap-2">
            <a href="/sites" className="text-xs text-white/50 hover:text-white font-semibold hidden sm:inline">지역현장</a>
            <button onClick={handleShare} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-white/20 rounded-lg hover:bg-white/10 text-white/70">
              <Share2 size={12}/>{copied?"복사됨!":"공유"}
            </button>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <a href="/sites" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500 mb-4"><ArrowLeft size={14}/>지역현장 목록</a>

        {/* 타이틀 카드 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-2">{fmtDate(site.created_at)}</p>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 mb-3">{site.site_name}</h1>
              {(site.business_address||site.work_address)&&<p className="text-sm text-slate-500 flex items-center gap-1 mb-3"><MapPin size={14}/>{site.business_address||site.work_address}</p>}
              <div className="flex flex-wrap gap-2">
                {site.property_type&&<span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-200">{site.property_type}</span>}
                {site.unit_count&&<span className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold">{site.unit_count}세대</span>}
                {site.rt_fee&&<span className="text-xs px-3 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold border border-amber-200">R/T {site.rt_fee}</span>}
              </div>
            </div>
            {(site.staff_start_date||site.model_house_date||site.grand_open_date)&&(
              <div className="flex sm:flex-col gap-2 flex-shrink-0">
                {site.staff_start_date&&<div className="flex-1 sm:w-36 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-center"><p className="text-[10px] text-blue-400 font-bold">직원착석일</p><p className="text-sm font-black text-blue-700">{site.staff_start_date}</p></div>}
                {site.model_house_date&&<div className="flex-1 sm:w-36 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-center"><p className="text-[10px] text-violet-400 font-bold">모델하우스 오픈</p><p className="text-sm font-black text-violet-700">{site.model_house_date}</p></div>}
                {site.grand_open_date&&<div className="flex-1 sm:w-36 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-center"><p className="text-[10px] text-emerald-400 font-bold">그랜드오픈</p><p className="text-sm font-black text-emerald-700">{site.grand_open_date}</p></div>}
              </div>
            )}
          </div>
        </div>

        {/* 근무지 정보 + 지도 */}
        {site.work_address&&(
          <section className="mb-6">
            <h2 className="text-base sm:text-lg font-black text-slate-800 mb-3 pb-2 border-b-2 border-slate-800">근무지 정보</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden"><InfoRow label="근무지역 주소" value={site.work_address}/></div>
            <KakaoMap address={site.work_address} mapId="map-work"/>
          </section>
        )}

        {/* 사업자 정보 */}
        <section className="mb-6">
          <h2 className="text-base sm:text-lg font-black text-slate-800 mb-3 pb-2 border-b-2 border-slate-800">사업자 정보</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <InfoRow2 l1="시행사" v1={site.developer} l2="시공사" v2={site.constructor}/>
            <InfoRow2 l1="신탁사" v1={site.trustee} l2="대행사" v2={site.agency}/>
          </div>
        </section>

        {/* 사업지 정보 + 지도 */}
        <section className="mb-6">
          <h2 className="text-base sm:text-lg font-black text-slate-800 mb-3 pb-2 border-b-2 border-slate-800">사업지 정보</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <InfoRow label="현장명" value={site.business_site_name||site.site_name}/>
            <InfoRow label="사업지 주소" value={site.business_address}/>
          </div>
          {site.business_address&&(
            <KakaoMap address={site.business_address} mapId="map-biz"/>
          )}
        </section>

        {/* 물건 정보 */}
        <section className="mb-6">
          <h2 className="text-base sm:text-lg font-black text-slate-800 mb-3 pb-2 border-b-2 border-slate-800">물건 정보</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <InfoRow2 l1="물건구분" v1={site.property_type} l2="세대수" v2={site.unit_count}/>
            {site.rt_fee&&<InfoRow2 l1="R/T (수수료)" v1={site.rt_fee} l2="" v2=""/>}
          </div>
        </section>

        {/* 상세정보 */}
        {site.selling_points&&(
          <section className="mb-6">
            <h2 className="text-base sm:text-lg font-black text-slate-800 mb-3 pb-2 border-b-2 border-slate-800">상세정보</h2>
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{site.selling_points}</div>
            </div>
          </section>
        )}
      </main>

      {/* 하단 */}
      <footer className="max-w-4xl mx-auto px-6 pb-10">
        <div className="text-center pt-8 border-t border-slate-200">
          <div className="flex items-center justify-center mb-2">
            <Image src="/icon-logo.png" alt="분양의신" width={48} height={48} className="h-10 sm:h-12 w-auto opacity-60"/>
          </div>
          <p className="text-xs text-slate-400 mt-1">본 정보는 광고인㈜ 대외협력팀에서 제공합니다</p>
        </div>
      </footer>
    </div>
  );
}
