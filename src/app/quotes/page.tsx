"use client";

import { useState, useEffect } from "react";
import { FileText, Trash2, FileDown, Edit3, Download, Clock, List, Search, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AdItem {
  id: number; isManual: boolean; media: string; type: string;
  targeting: string; quantity: string; unitPrice: string; amount: string;
  ageGroup: string; sendType: string; region1: string; region2: string; region3: string;
}

const MEDIA_OPTS = ["LMS","호갱노노"];
const LMS_GROUPS = [
  { label:"카드사", items:["국민카드","BC카드","삼성카드","신한카드","롯데카드","하나카드"] },
  { label:"통신사", items:["SKT","KT"] },
  { label:"멤버십사 외", items:["롯데멤버스","스마트스코어","티맵","신세계포인트","OK캐시백"] },
];
const HOEGANGNONO_TYPES = ["호갱노노_단지마커","호갱노노_채널톡","직방_채널톡"];

const getUnitPrice = (media: string, type: string): string => {
  if (media === "호갱노노") { if (type === "호갱노노_채널톡") return "150"; if (type === "직방_채널톡") return "100"; return ""; }
  if (media === "LMS") { if (type === "롯데멤버스") return "80"; if (type) return "100"; }
  return "";
};
const isUnitPriceFixed = (media: string, type: string): boolean => {
  if (media === "호갱노노" && type === "호갱노노_단지마커") return false;
  if (media === "호갱노노") return true;
  if (media === "LMS" && type) return true;
  return false;
};
const isAmountAuto = (media: string, type: string): boolean => {
  if (media === "호갱노노" && type === "호갱노노_단지마커") return false;
  return true;
};
const getQuantityLabel = (media: string, type: string): string =>
  media === "호갱노노" && type === "호갱노노_단지마커" ? "기간(일)" : "발송수량";
const buildSendType = (media: string, type: string, property: string): string => {
  if (!media) return "";
  return [media, type, property].filter(Boolean).join("_");
};
const newItem = (id: number, property: string = ""): AdItem => ({
  id, isManual: false, media: "LMS", type: "국민카드", targeting: "부동산 관심자",
  quantity: "", unitPrice: "100", amount: "", ageGroup: "30~60대",
  sendType: buildSendType("LMS", "국민카드", property), region1: "", region2: "", region3: "",
});
const newManualItem = (id: number): AdItem => ({
  id, isManual: true, media:"", type:"", targeting:"", quantity:"", unitPrice:"", amount:"",
  ageGroup:"", sendType:"", region1:"", region2:"", region3:"",
});

const inp = "w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400";
const inp_fixed = "w-full px-3 py-1.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed";
const lbl = "block text-xs font-semibold text-slate-500 mb-1";

type SavedQuote = {
  id: number; property: string; quote_date: string;
  client_name: string; client_addr: string; client_biz_no: string;
  client_ceo: string; client_manager: string; client_phone: string;
  supplier_manager: string; supplier_phone: string;
  total_amount: number; total_vat: number; items: string;
  pdf_url: string | null; pdf_data: string | null; created_at: string;
};

// base64 → Blob 변환 유틸
function base64ToBlob(b64: string, type = "application/pdf"): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export default function QuotePage() {
  const [property, setProperty] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientAddr, setClientAddr] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientBizNo, setClientBizNo] = useState("");
  const [clientCeo, setClientCeo] = useState("");
  const [clientMgr, setClientMgr] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [supplierMgr, setSupplierMgr] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [items, setItems] = useState<AdItem[]>([newItem(1)]);
  const [downloading, setDownloading] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [qSearch, setQSearch] = useState("");
  const [qDateFrom, setQDateFrom] = useState("");
  const [qDateTo, setQDateTo] = useState("");
  const [dlId, setDlId] = useState<number | null>(null);

  const fetchSavedQuotes = async () => {
    setLoadingQuotes(true);
    // pdf_data는 무거우니 목록에선 제외 (다운로드 시 별도 fetch)
    const { data } = await supabase.from("quotes")
      .select("id,property,quote_date,client_name,client_addr,client_biz_no,client_ceo,client_manager,client_phone,supplier_manager,supplier_phone,total_amount,total_vat,items,pdf_url,created_at")
      .order("created_at",{ascending:false}).limit(100);
    setSavedQuotes((data || []).map((d:any) => ({...d, pdf_data: null})) as SavedQuote[]);
    setLoadingQuotes(false);
  };
  useEffect(() => { fetchSavedQuotes(); }, []);

  const filteredQuotes = savedQuotes.filter(q => {
    if (qSearch.trim()) {
      const s = qSearch.trim().toLowerCase();
      const pi = (() => { try { return JSON.parse(q.items||"[]"); } catch { return []; } })();
      const searchable = [q.property, q.client_name, q.client_manager, q.supplier_manager, pi[0]?.media, pi[0]?.type].filter(Boolean).join(" ").toLowerCase();
      if (!searchable.includes(s)) return false;
    }
    if (qDateFrom && q.quote_date && q.quote_date < qDateFrom) return false;
    if (qDateTo && q.quote_date && q.quote_date > qDateTo) return false;
    return true;
  });

  const updateItem = (id: number, field: keyof AdItem, val: string) => {
    setItems(p => p.map(it => {
      if (it.id !== id) return it;
      const u = { ...it, [field]: val };
      if (field === "media") { u.type = val === "호갱노노" ? "호갱노노_단지마커" : "국민카드"; u.unitPrice = getUnitPrice(val, u.type); u.amount = ""; u.quantity = ""; u.sendType = buildSendType(val, u.type, property); }
      if (field === "type") { u.unitPrice = getUnitPrice(it.media, val); u.amount = ""; u.quantity = ""; u.sendType = buildSendType(it.media, val, property); }
      if (field === "quantity" || field === "unitPrice") { const q = Number(field === "quantity" ? val : u.quantity); const up = Number(field === "unitPrice" ? val : u.unitPrice); if (isAmountAuto(u.media, u.type)) u.amount = (q && up) ? String(q * up) : ""; }
      return u;
    }));
  };
  const handlePropertyChange = (val: string) => { setProperty(val); setItems(p => p.map(it => ({...it, sendType: it.isManual ? it.sendType : buildSendType(it.media, it.type, val)}))); };
  const addManual = () => setItems(p => [...p, newManualItem(p.length + 1)]);
  const removeItem = (id: number) => setItems(p => p.filter(it => it.id !== id));
  const total = items.reduce((s,it) => s + (Number(it.amount)||0), 0);
  const totalVat = Math.round(total * 1.1);

  // PDF 저장: PC 다운로드 + DB에 base64로 저장
  const handleDownload = async () => {
    if (!property) return alert("대상물건을 입력하세요.");
    setDownloading(true);
    try {
      const res = await fetch("/api/generate-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property, quoteDate, clientAddr, clientName, clientBizNo, clientCeo, clientMgr, clientPhone, supplierMgr, supplierPhone, items }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "오류");
      const blob = await res.blob();
      const _m = items[0]?.media||"", _t = items[0]?.type||"", _ds = quoteDate.replace(/-/g,"");
      const _v = totalVat >= 10000 ? `${Math.floor(totalVat/10000).toLocaleString()}만` : totalVat.toLocaleString();
      const fileName = `(주)광고인_${_m}_${_t}_${_ds}_${_v}(VAT포함).pdf`;

      // 1) PC 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);

      // 2) PDF → base64 → DB 저장
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = (reader.result as string).split(",")[1] || "";
        await supabase.from("quotes").insert({
          property, quote_date: quoteDate, client_addr:clientAddr, client_name:clientName,
          client_biz_no:clientBizNo, client_ceo:clientCeo, client_manager:clientMgr, client_phone:clientPhone,
          supplier_manager:supplierMgr, supplier_phone:supplierPhone,
          items:JSON.stringify(items), total_amount:total, total_vat:totalVat,
          pdf_data: b64,
        });
        fetchSavedQuotes();
      };
      reader.readAsDataURL(blob);
    } catch(e: any) { alert("PDF 생성 오류: " + e.message); }
    finally { setDownloading(false); }
  };

  // 저장된 PDF 다운로드 (DB에서 base64 가져와서 변환)
  const downloadSavedPdf = async (q: SavedQuote) => {
    setDlId(q.id);
    try {
      const { data } = await supabase.from("quotes").select("pdf_data").eq("id", q.id).maybeSingle();
      if (!data?.pdf_data) { alert("저장된 PDF가 없습니다."); return; }
      const blob = base64ToBlob(data.pdf_data);
      const pi = (() => { try { return JSON.parse(q.items||"[]"); } catch { return []; } })();
      const _m=pi[0]?.media||"",_t=pi[0]?.type||"",_ds=(q.quote_date||"").replace(/-/g,"");
      const _v=(q.total_vat||0)>=10000?`${Math.floor((q.total_vat||0)/10000).toLocaleString()}만`:(q.total_vat||0).toLocaleString();
      const fileName = `(주)광고인_${_m}_${_t}_${_ds}_${_v}(VAT포함).pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
    } catch(e: any) { alert("다운로드 오류: " + e.message); }
    finally { setDlId(null); }
  };

  const deleteSavedQuote = async (id: number) => { if (!confirm("삭제하시겠습니까?")) return; await supabase.from("quotes").delete().eq("id", id); fetchSavedQuotes(); };
  const loadQuote = (q: SavedQuote) => {
    setProperty(q.property); setQuoteDate(q.quote_date||new Date().toISOString().split("T")[0]);
    setClientAddr(q.client_addr||""); setClientName(q.client_name||""); setClientBizNo(q.client_biz_no||""); setClientCeo(q.client_ceo||"");
    setClientMgr(q.client_manager||""); setClientPhone(q.client_phone||"");
    setSupplierMgr(q.supplier_manager||""); setSupplierPhone(q.supplier_phone||"");
    try { const p = JSON.parse(q.items||"[]"); setItems(p.length>0?p:[newItem(1)]); } catch { setItems([newItem(1)]); }
  };

  const fmtV = (n: number) => n >= 10000 ? `${Math.floor(n/10000).toLocaleString()}만원` : `${n.toLocaleString()}원`;

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">📄 견적서 작성</h1>
            <p className="text-sm text-slate-500 mt-0.5">㈜ 광고인 문자광고 대행 견적서</p>
          </div>
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E3A8A] text-white text-sm font-semibold rounded-xl hover:bg-blue-800 shadow-sm disabled:opacity-50">
            <FileDown size={14}/>{downloading ? " 변환중..." : " PDF 저장"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-5 items-start">

        <div className="flex-[3] min-w-0 space-y-4">

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">기본 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>대상물건 <span className="text-red-400">*</span></label><input className={inp} value={property} onChange={e=>handlePropertyChange(e.target.value)} placeholder="예: [경산] 상방공원 호반써밋"/></div>
            <div><label className={lbl}>견적일자</label><input type="date" className={inp} value={quoteDate} onChange={e=>setQuoteDate(e.target.value)}/></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">수급인(을) 담당자 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>담당자</label><input className={inp} value={supplierMgr} onChange={e=>setSupplierMgr(e.target.value)} placeholder="예: 기여운"/></div>
            <div><label className={lbl}>HP</label><input className={inp} value={supplierPhone} onChange={e=>setSupplierPhone(e.target.value)} placeholder="010-0000-0000"/></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">위탁인(갑) 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={lbl}>주소</label><input className={inp} value={clientAddr} onChange={e=>setClientAddr(e.target.value)} placeholder="주소"/></div>
            <div><label className={lbl}>계약자</label><input className={inp} value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="계약자명"/></div>
            <div><label className={lbl}>사업자번호</label><input className={inp} value={clientBizNo} onChange={e=>setClientBizNo(e.target.value)} placeholder="000-00-00000"/></div>
            <div><label className={lbl}>대표자</label><input className={inp} value={clientCeo} onChange={e=>setClientCeo(e.target.value)} placeholder="대표자명"/></div>
            <div><label className={lbl}>담당자</label><input className={inp} value={clientMgr} onChange={e=>setClientMgr(e.target.value)} placeholder="담당자명"/></div>
            <div><label className={lbl}>HP</label><input className={inp} value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="010-0000-0000"/></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700">광고 항목</h2>
            <button onClick={addManual} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-600 rounded-lg border border-amber-200 hover:bg-amber-100"><Edit3 size={12}/> 수기입력</button>
          </div>
          <div className="space-y-4">
            {items.map((it,idx) => {
              const qtyLabel = it.isManual ? "발송수량" : getQuantityLabel(it.media, it.type);
              const fixedUnit = !it.isManual && isUnitPriceFixed(it.media, it.type);
              const autoAmt = !it.isManual && isAmountAuto(it.media, it.type);
              return (
                <div key={it.id} className={`p-4 rounded-xl border ${it.isManual ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold text-amber-600">항목 {idx+1}</span>{it.isManual && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full border border-amber-200 font-semibold">수기입력</span>}</div>
                    {items.length > 1 && <button onClick={()=>removeItem(it.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13}/></button>}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <div><label className={lbl}>매체</label>{it.isManual ? <input className={inp} value={it.media} onChange={e=>updateItem(it.id,"media",e.target.value)} placeholder="매체 입력"/> : <select className={inp} value={it.media} onChange={e=>updateItem(it.id,"media",e.target.value)}>{MEDIA_OPTS.map(m=><option key={m}>{m}</option>)}</select>}</div>
                    <div><label className={lbl}>발송/지면 유형</label>{it.isManual ? <input className={inp} value={it.type} onChange={e=>updateItem(it.id,"type",e.target.value)} placeholder="유형 입력"/> : it.media === "호갱노노" ? <select className={inp} value={it.type} onChange={e=>updateItem(it.id,"type",e.target.value)}>{HOEGANGNONO_TYPES.map(t=><option key={t}>{t}</option>)}</select> : <select className={inp} value={it.type} onChange={e=>updateItem(it.id,"type",e.target.value)}>{LMS_GROUPS.map(g=>(<optgroup key={g.label} label={g.label}>{g.items.map(t=><option key={t}>{t}</option>)}</optgroup>))}</select>}</div>
                    <div><label className={lbl}>타겟팅</label>{it.isManual ? <input className={inp} value={it.targeting} onChange={e=>updateItem(it.id,"targeting",e.target.value)} placeholder="타겟팅 입력"/> : <input className={inp_fixed} value="부동산 관심자" readOnly/>}</div>
                    <div><label className={lbl}>{qtyLabel}</label><input type="number" className={inp} value={it.quantity} onChange={e=>updateItem(it.id,"quantity",e.target.value)} placeholder={qtyLabel === "기간(일)" ? "예: 30" : "예: 100000"}/></div>
                    <div><label className={lbl}>단가(원)</label><input type="number" className={fixedUnit ? inp_fixed : inp} value={it.unitPrice} readOnly={fixedUnit} onChange={e=>!fixedUnit && updateItem(it.id,"unitPrice",e.target.value)} placeholder="단가"/></div>
                    <div><label className={lbl}>금액</label>{autoAmt && !it.isManual ? <div className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg font-bold text-blue-700">{Number(it.amount) ? Number(it.amount).toLocaleString() : "0"}원</div> : <input type="number" className={inp} value={it.amount} onChange={e=>updateItem(it.id,"amount",e.target.value)} placeholder="금액 입력"/>}</div>
                    <div><label className={lbl}>연령대</label><input className={inp} value={it.ageGroup} onChange={e=>updateItem(it.id,"ageGroup",e.target.value)}/></div>
                    <div><label className={lbl}>발송유형</label><input className={it.isManual ? inp : inp_fixed} value={it.isManual ? it.sendType : buildSendType(it.media, it.type, property)} readOnly={!it.isManual} onChange={e=>it.isManual && updateItem(it.id,"sendType",e.target.value)} placeholder="발송유형"/></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className={lbl}>지역①</label><input className={inp} value={it.region1} onChange={e=>updateItem(it.id,"region1",e.target.value)} placeholder="예: 경산"/></div>
                    <div><label className={lbl}>지역②</label><input className={inp} value={it.region2} onChange={e=>updateItem(it.id,"region2",e.target.value)} placeholder="예: 대구 동구"/></div>
                    <div><label className={lbl}>지역③</label><input className={inp} value={it.region3} onChange={e=>updateItem(it.id,"region3",e.target.value)} placeholder="예: 대구 수성구"/></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
            <span className="text-sm text-slate-600">공급가액: <b>{total.toLocaleString()}원</b></span>
            <span className="text-base font-black text-blue-700">합계 (VAT 포함): {totalVat.toLocaleString()}원</span>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
          <p className="text-sm font-semibold text-amber-700">💳 입금처</p>
          <p className="text-sm text-amber-600 mt-1">기업은행 298-122618-04-018 &nbsp;|&nbsp; 예금주: ㈜ 광고인</p>
        </div>
        </div>

        {/* ═══ 오른쪽: 저장된 견적서 ═══ */}
        <div className="flex-[2] min-w-0 self-stretch">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2"><List size={15} className="text-blue-500"/><h3 className="text-sm font-bold text-slate-700">저장된 견적서</h3></div>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 font-semibold">{filteredQuotes.length}건</span>
            </div>
            <div className="px-4 py-3 border-b border-slate-100 space-y-2 flex-shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={qSearch} onChange={e=>setQSearch(e.target.value)} placeholder="물건명, 계약자, 담당자, 매체..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"/>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="date" value={qDateFrom} onChange={e=>setQDateFrom(e.target.value)} className="flex-1 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"/>
                <span className="text-slate-300 text-xs">~</span>
                <input type="date" value={qDateTo} onChange={e=>setQDateTo(e.target.value)} className="flex-1 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"/>
                {(qDateFrom||qDateTo) && <button onClick={()=>{setQDateFrom("");setQDateTo("");}} className="text-slate-400 hover:text-red-400 text-xs px-1">✕</button>}
              </div>
            </div>
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-500">
                <span>견적일자</span><span>계약자</span><span>매체</span><span>유형</span><span className="text-right">수량</span><span className="text-right">합계(VAT)</span><span className="text-center">담당</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/></div>
              ) : filteredQuotes.length === 0 ? (
                <div className="text-center py-16 text-slate-300 text-sm"><FileText size={28} className="mx-auto mb-2 opacity-30"/><p>견적서가 없습니다</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredQuotes.map(q => {
                    let pi: any[] = []; try { pi = JSON.parse(q.items||"[]"); } catch {}
                    const it0 = pi[0] || {};
                    const isOpen = expandedId === q.id;
                    const isDl = dlId === q.id;
                    const qtyLabel = it0.media === "호갱노노" && it0.type === "호갱노노_단지마커" ? `${it0.quantity||0}일` : `${Number(it0.quantity||0).toLocaleString()}`;
                    return (
                      <div key={q.id}>
                        <button onClick={()=>setExpandedId(isOpen ? null : q.id)}
                          className={`w-full px-4 py-2.5 text-left transition-colors`} style={{background:isOpen?"var(--sidebar-active-bg)":"transparent"}}>
                          <div className="grid grid-cols-7 gap-1 items-center text-xs">
                            <span style={{color:"var(--text-muted)"}} className="font-medium">{q.quote_date?.slice(5)||"-"}</span>
                            <span style={{color:"var(--text)"}} className="font-semibold truncate">{q.client_name||q.client_manager||"-"}</span>
                            <span style={{color:"var(--info)"}} className="font-semibold truncate">{it0.media||"-"}</span>
                            <span style={{color:"var(--text-muted)"}} className="truncate">{it0.type||"-"}</span>
                            <span style={{color:"var(--text)"}} className="text-right">{qtyLabel}</span>
                            <span style={{color:"var(--info)"}} className="text-right font-black">{fmtV(q.total_vat||0)}</span>
                            <span style={{color:"var(--text-muted)"}} className="text-center truncate">{q.supplier_manager||"-"}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-3 border-t" style={{background:"var(--surface)",borderColor:"var(--border)"}}>
                            <div className="rounded-xl p-3 mt-2 space-y-1.5 text-xs" style={{background:"var(--sidebar-bg)",border:"1px solid var(--border)"}}>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>대상물건</span><span className="font-bold" style={{color:"var(--text)"}}>{q.property}</span></div>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>견적일자</span><span style={{color:"var(--text)"}}>{q.quote_date||"-"}</span></div>
                              <div className="my-1.5" style={{borderTop:"1px dashed var(--border)"}}/>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>수급인 담당자</span><span className="font-semibold" style={{color:"var(--text)"}}>{q.supplier_manager||"-"}</span></div>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>수급인 HP</span><span style={{color:"var(--text)"}}>{q.supplier_phone||"-"}</span></div>
                              <div className="my-1.5" style={{borderTop:"1px dashed var(--border)"}}/>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>위탁인 계약자</span><span className="font-semibold" style={{color:"var(--text)"}}>{q.client_name||"-"}</span></div>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>위탁인 담당자</span><span style={{color:"var(--text)"}}>{q.client_manager||"-"}</span></div>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>위탁인 HP</span><span style={{color:"var(--text)"}}>{q.client_phone||"-"}</span></div>
                              <div className="my-1.5" style={{borderTop:"1px dashed var(--border)"}}/>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>매체</span><span className="font-semibold" style={{color:"var(--info)"}}>{it0.media||"-"} / {it0.type||"-"}</span></div>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>수량</span><span style={{color:"var(--text)"}}>{qtyLabel}</span></div>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>공급가액</span><span style={{color:"var(--text)"}}>{(q.total_amount||0).toLocaleString()}원</span></div>
                              <div className="flex justify-between"><span style={{color:"var(--text-muted)"}}>합계 (VAT포함)</span><span className="font-black" style={{color:"var(--info)"}}>{(q.total_vat||0).toLocaleString()}원</span></div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <button onClick={()=>loadQuote(q)}
                                className="flex-1 text-xs py-2 rounded-lg font-semibold transition-colors text-center" style={{background:"var(--surface)",color:"var(--text)",border:"1px solid var(--border)"}}>불러오기</button>
                              <button onClick={()=>downloadSavedPdf(q)} disabled={isDl}
                                className="flex-1 text-xs py-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200 hover:bg-emerald-100 font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
                                <Download size={11}/>{isDl ? "다운중..." : "PDF 다운받기"}
                              </button>
                              <button onClick={()=>deleteSavedQuote(q.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12}/></button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}
