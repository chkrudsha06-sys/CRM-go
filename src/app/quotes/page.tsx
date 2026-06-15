"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Edit3,
  FileDown,
  FileText,
  List,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AdItem {
  id: number;
  isManual: boolean;
  media: string;
  type: string;
  targeting: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  ageGroup: string;
  sendType: string;
  region1: string;
  region2: string;
  region3: string;
}

const MEDIA_OPTS = ["LMS", "호갱노노"];
const LMS_GROUPS = [
  { label: "카드사", items: ["국민카드", "BC카드", "삼성카드", "신한카드", "롯데카드", "하나카드"] },
  { label: "통신사", items: ["SKT", "KT"] },
  { label: "멤버십사 외", items: ["롯데멤버스", "스마트스코어", "티맵", "신세계포인트", "OK캐시백"] },
];
const HOEGANGNONO_TYPES = ["호갱노노_단지마커", "호갱노노_채널톡", "직방_채널톡"];

const getUnitPrice = (media: string, type: string): string => {
  if (media === "호갱노노") {
    if (type === "호갱노노_채널톡") return "150";
    if (type === "직방_채널톡") return "100";
    return "";
  }
  if (media === "LMS") {
    if (type === "롯데멤버스") return "80";
    if (type) return "100";
  }
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
  id,
  isManual: false,
  media: "LMS",
  type: "국민카드",
  targeting: "부동산 관심자",
  quantity: "",
  unitPrice: "100",
  amount: "",
  ageGroup: "30~60대",
  sendType: buildSendType("LMS", "국민카드", property),
  region1: "",
  region2: "",
  region3: "",
});

const newManualItem = (id: number): AdItem => ({
  id,
  isManual: true,
  media: "",
  type: "",
  targeting: "",
  quantity: "",
  unitPrice: "",
  amount: "",
  ageGroup: "",
  sendType: "",
  region1: "",
  region2: "",
  region3: "",
});

const fieldClass = "w-full rounded-[10px] border px-3 py-2 text-[13px] outline-none transition focus:ring-2";
const labelClass = "mb-1.5 block text-[12px] font-semibold";
const cardClass = "rounded-[18px] border p-5 shadow-sm";
const smallBtnClass = "inline-flex items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition";

type SavedQuote = {
  id: number;
  property: string;
  quote_date: string;
  client_name: string;
  client_addr: string;
  client_biz_no: string;
  client_ceo: string;
  client_manager: string;
  client_phone: string;
  supplier_manager: string;
  supplier_phone: string;
  total_amount: number;
  total_vat: number;
  items: string;
  pdf_url: string | null;
  pdf_data: string | null;
  created_at: string;
};

function base64ToBlob(b64: string, type = "application/pdf"): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("PDF 데이터를 읽는 중 오류가 발생했습니다."));
    reader.readAsDataURL(blob);
  });
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

  const surfaceStyle = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };
  const surface2Style = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const surface3Style = { background: "var(--surface-3)", borderColor: "var(--border)", color: "var(--text-muted)" };
  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const fixedInputStyle = { background: "var(--surface-3)", borderColor: "var(--border-subtle)", color: "var(--text-subtle)" };
  const mutedText = { color: "var(--text-muted)" };
  const subtleText = { color: "var(--text-subtle)" };
  const accentText = { color: "var(--accent-text)" };

  const fetchSavedQuotes = async () => {
    setLoadingQuotes(true);
    const { data } = await supabase
      .from("quotes")
      .select("id,property,quote_date,client_name,client_addr,client_biz_no,client_ceo,client_manager,client_phone,supplier_manager,supplier_phone,total_amount,total_vat,items,pdf_url,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setSavedQuotes((data || []).map((d: any) => ({ ...d, pdf_data: null })) as SavedQuote[]);
    setLoadingQuotes(false);
  };

  useEffect(() => {
    fetchSavedQuotes();
  }, []);

  const filteredQuotes = savedQuotes.filter((q) => {
    if (qSearch.trim()) {
      const s = qSearch.trim().toLowerCase();
      const pi = (() => {
        try {
          return JSON.parse(q.items || "[]");
        } catch {
          return [];
        }
      })();
      const searchable = [q.property, q.client_name, q.client_manager, q.supplier_manager, pi[0]?.media, pi[0]?.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(s)) return false;
    }
    if (qDateFrom && q.quote_date && q.quote_date < qDateFrom) return false;
    if (qDateTo && q.quote_date && q.quote_date > qDateTo) return false;
    return true;
  });

  const updateItem = (id: number, field: keyof AdItem, val: string) => {
    setItems((p) =>
      p.map((it) => {
        if (it.id !== id) return it;
        const u = { ...it, [field]: val };
        if (field === "media") {
          u.type = val === "호갱노노" ? "호갱노노_단지마커" : "국민카드";
          u.unitPrice = getUnitPrice(val, u.type);
          u.amount = "";
          u.quantity = "";
          u.sendType = buildSendType(val, u.type, property);
        }
        if (field === "type") {
          u.unitPrice = getUnitPrice(it.media, val);
          u.amount = "";
          u.quantity = "";
          u.sendType = buildSendType(it.media, val, property);
        }
        if (field === "quantity" || field === "unitPrice") {
          const q = Number(field === "quantity" ? val : u.quantity);
          const up = Number(field === "unitPrice" ? val : u.unitPrice);
          if (isAmountAuto(u.media, u.type)) u.amount = q && up ? String(q * up) : "";
        }
        return u;
      }),
    );
  };

  const handlePropertyChange = (val: string) => {
    setProperty(val);
    setItems((p) => p.map((it) => ({ ...it, sendType: it.isManual ? it.sendType : buildSendType(it.media, it.type, val) })));
  };

  const addManual = () => setItems((p) => [...p, newManualItem(p.length + 1)]);
  const removeItem = (id: number) => setItems((p) => p.filter((it) => it.id !== id));
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalVat = Math.round(total * 1.1);

  const handleDownload = async () => {
    if (!property.trim()) return alert("대상물건을 입력하세요.");
    setDownloading(true);
    try {
      const res = await fetch("/api/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property,
          quoteDate,
          clientAddr,
          clientName,
          clientBizNo,
          clientCeo,
          clientMgr,
          clientPhone,
          supplierMgr,
          supplierPhone,
          items,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "PDF 생성에 실패했습니다.");
      }

      const blob = await res.blob();
      const media = items[0]?.media || "";
      const type = items[0]?.type || "";
      const quoteDateText = quoteDate.replace(/-/g, "");
      const priceText = totalVat >= 10000 ? `${Math.floor(totalVat / 10000).toLocaleString()}만` : totalVat.toLocaleString();
      const fileName = `(주)광고인_${media}_${type}_${quoteDateText}_${priceText}(VAT포함).pdf`;
      const pdfBase64 = await blobToBase64(blob);

      const { error } = await supabase.from("quotes").insert({
        property: property.trim(),
        quote_date: quoteDate,
        client_addr: clientAddr,
        client_name: clientName,
        client_biz_no: clientBizNo,
        client_ceo: clientCeo,
        client_manager: clientMgr,
        client_phone: clientPhone,
        supplier_manager: supplierMgr,
        supplier_phone: supplierPhone,
        items: JSON.stringify(items),
        total_amount: total,
        total_vat: totalVat,
        pdf_data: pdfBase64,
      });

      if (error) {
        throw new Error(`PDF는 생성됐지만 저장에 실패했습니다. Supabase 오류: ${error.message}`);
      }

      await fetchSavedQuotes();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("PDF 저장 오류: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const downloadSavedPdf = async (q: SavedQuote) => {
    setDlId(q.id);
    try {
      const { data } = await supabase.from("quotes").select("pdf_data").eq("id", q.id).maybeSingle();
      if (!data?.pdf_data) {
        alert("저장된 PDF가 없습니다.");
        return;
      }
      const blob = base64ToBlob(data.pdf_data);
      const pi = (() => {
        try {
          return JSON.parse(q.items || "[]");
        } catch {
          return [];
        }
      })();
      const media = pi[0]?.media || "";
      const type = pi[0]?.type || "";
      const quoteDateText = (q.quote_date || "").replace(/-/g, "");
      const priceText =
        (q.total_vat || 0) >= 10000 ? `${Math.floor((q.total_vat || 0) / 10000).toLocaleString()}만` : (q.total_vat || 0).toLocaleString();
      const fileName = `(주)광고인_${media}_${type}_${quoteDateText}_${priceText}(VAT포함).pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("다운로드 오류: " + e.message);
    } finally {
      setDlId(null);
    }
  };

  const deleteSavedQuote = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("quotes").delete().eq("id", id);
    fetchSavedQuotes();
  };

  const loadQuote = (q: SavedQuote) => {
    setProperty(q.property);
    setQuoteDate(q.quote_date || new Date().toISOString().split("T")[0]);
    setClientAddr(q.client_addr || "");
    setClientName(q.client_name || "");
    setClientBizNo(q.client_biz_no || "");
    setClientCeo(q.client_ceo || "");
    setClientMgr(q.client_manager || "");
    setClientPhone(q.client_phone || "");
    setSupplierMgr(q.supplier_manager || "");
    setSupplierPhone(q.supplier_phone || "");
    try {
      const p = JSON.parse(q.items || "[]");
      setItems(p.length > 0 ? p : [newItem(1)]);
    } catch {
      setItems([newItem(1)]);
    }
  };

  const fmtV = (n: number) => (n >= 10000 ? `${Math.floor(n / 10000).toLocaleString()}만원` : `${n.toLocaleString()}원`);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div
        className="sticky top-0 z-10 border-b px-5 py-4 sm:px-8"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}
      >
        <div className="mx-auto flex w-full max-w-[var(--page-max)] items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border"
                style={{ background: "var(--accent-bg)", borderColor: "var(--accent-border)", color: "var(--accent-text)" }}
              >
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-[780] tracking-[-0.02em]" style={{ color: "var(--text-strong)" }}>
                  견적서 작성
                </h1>
                <p className="mt-0.5 text-[13px]" style={subtleText}>
                  ㈜ 광고인 문자광고 대행 견적서
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-[13px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-3))", boxShadow: "var(--shadow-sm)" }}
          >
            <FileDown size={15} />
            {downloading ? "변환중..." : "PDF 저장"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto grid w-full max-w-[var(--page-max)] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(520px,0.9fr)]">
          <div className="min-w-0 space-y-4">
            <section className={cardClass} style={surfaceStyle}>
              <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div>
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>
                    기본 정보
                  </h2>
                  <p className="mt-0.5 text-[12px]" style={subtleText}>
                    견적서의 기준이 되는 물건명과 작성일자를 입력합니다.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass} style={mutedText}>
                    대상물건 <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    className={fieldClass}
                    style={inputStyle}
                    value={property}
                    onChange={(e) => handlePropertyChange(e.target.value)}
                    placeholder="예: [경산] 상방공원 호반써밋"
                  />
                </div>
                <div>
                  <label className={labelClass} style={mutedText}>
                    견적일자
                  </label>
                  <input type="date" className={fieldClass} style={inputStyle} value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
                </div>
              </div>
            </section>

            <section className={cardClass} style={surfaceStyle}>
              <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div>
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>
                    수급인(을) 담당자 정보
                  </h2>
                  <p className="mt-0.5 text-[12px]" style={subtleText}>
                    광고인 내부 담당자 정보를 입력합니다.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass} style={mutedText}>
                    담당자
                  </label>
                  <input className={fieldClass} style={inputStyle} value={supplierMgr} onChange={(e) => setSupplierMgr(e.target.value)} placeholder="예: 기여운" />
                </div>
                <div>
                  <label className={labelClass} style={mutedText}>
                    HP
                  </label>
                  <input className={fieldClass} style={inputStyle} value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="010-0000-0000" />
                </div>
              </div>
            </section>

            <section className={cardClass} style={surfaceStyle}>
              <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div>
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>
                    위탁인(갑) 정보
                  </h2>
                  <p className="mt-0.5 text-[12px]" style={subtleText}>
                    계약자 및 사업자 정보를 입력합니다.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass} style={mutedText}>
                    주소
                  </label>
                  <input className={fieldClass} style={inputStyle} value={clientAddr} onChange={(e) => setClientAddr(e.target.value)} placeholder="주소" />
                </div>
                <div>
                  <label className={labelClass} style={mutedText}>
                    계약자
                  </label>
                  <input className={fieldClass} style={inputStyle} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="계약자명" />
                </div>
                <div>
                  <label className={labelClass} style={mutedText}>
                    사업자번호
                  </label>
                  <input className={fieldClass} style={inputStyle} value={clientBizNo} onChange={(e) => setClientBizNo(e.target.value)} placeholder="000-00-00000" />
                </div>
                <div>
                  <label className={labelClass} style={mutedText}>
                    대표자
                  </label>
                  <input className={fieldClass} style={inputStyle} value={clientCeo} onChange={(e) => setClientCeo(e.target.value)} placeholder="대표자명" />
                </div>
                <div>
                  <label className={labelClass} style={mutedText}>
                    담당자
                  </label>
                  <input className={fieldClass} style={inputStyle} value={clientMgr} onChange={(e) => setClientMgr(e.target.value)} placeholder="담당자명" />
                </div>
                <div>
                  <label className={labelClass} style={mutedText}>
                    HP
                  </label>
                  <input className={fieldClass} style={inputStyle} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="010-0000-0000" />
                </div>
              </div>
            </section>

            <section className={cardClass} style={surfaceStyle}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div>
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>
                    광고 항목
                  </h2>
                  <p className="mt-0.5 text-[12px]" style={subtleText}>
                    매체, 발송유형, 지역 조건을 입력합니다.
                  </p>
                </div>
                <button
                  onClick={addManual}
                  className={smallBtnClass}
                  style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}
                >
                  <Edit3 size={13} /> 수기입력
                </button>
              </div>

              <div className="space-y-4">
                {items.map((it, idx) => {
                  const qtyLabel = it.isManual ? "발송수량" : getQuantityLabel(it.media, it.type);
                  const fixedUnit = !it.isManual && isUnitPriceFixed(it.media, it.type);
                  const autoAmt = !it.isManual && isAmountAuto(it.media, it.type);
                  return (
                    <div
                      key={it.id}
                      className="rounded-[16px] border p-4"
                      style={
                        it.isManual
                          ? { background: "var(--warning-bg)", borderColor: "var(--warning-border)" }
                          : { background: "var(--surface-2)", borderColor: "var(--border-subtle)" }
                      }
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold" style={it.isManual ? { color: "var(--warning-text)" } : accentText}>
                            항목 {idx + 1}
                          </span>
                          {it.isManual && (
                            <span
                              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                              style={{ background: "var(--surface)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}
                            >
                              수기입력
                            </span>
                          )}
                        </div>
                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(it.id)}
                            className="rounded-[9px] p-2 transition hover:opacity-80"
                            style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 2xl:grid-cols-4">
                        <div>
                          <label className={labelClass} style={mutedText}>
                            매체
                          </label>
                          {it.isManual ? (
                            <input className={fieldClass} style={inputStyle} value={it.media} onChange={(e) => updateItem(it.id, "media", e.target.value)} placeholder="매체 입력" />
                          ) : (
                            <select className={fieldClass} style={inputStyle} value={it.media} onChange={(e) => updateItem(it.id, "media", e.target.value)}>
                              {MEDIA_OPTS.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            발송/지면 유형
                          </label>
                          {it.isManual ? (
                            <input className={fieldClass} style={inputStyle} value={it.type} onChange={(e) => updateItem(it.id, "type", e.target.value)} placeholder="유형 입력" />
                          ) : it.media === "호갱노노" ? (
                            <select className={fieldClass} style={inputStyle} value={it.type} onChange={(e) => updateItem(it.id, "type", e.target.value)}>
                              {HOEGANGNONO_TYPES.map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          ) : (
                            <select className={fieldClass} style={inputStyle} value={it.type} onChange={(e) => updateItem(it.id, "type", e.target.value)}>
                              {LMS_GROUPS.map((g) => (
                                <optgroup key={g.label} label={g.label}>
                                  {g.items.map((t) => (
                                    <option key={t}>{t}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            타겟팅
                          </label>
                          {it.isManual ? (
                            <input className={fieldClass} style={inputStyle} value={it.targeting} onChange={(e) => updateItem(it.id, "targeting", e.target.value)} placeholder="타겟팅 입력" />
                          ) : (
                            <input className={fieldClass} style={fixedInputStyle} value="부동산 관심자" readOnly />
                          )}
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            {qtyLabel}
                          </label>
                          <input
                            type="number"
                            className={fieldClass}
                            style={inputStyle}
                            value={it.quantity}
                            onChange={(e) => updateItem(it.id, "quantity", e.target.value)}
                            placeholder={qtyLabel === "기간(일)" ? "예: 30" : "예: 100000"}
                          />
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            단가(원)
                          </label>
                          <input
                            type="number"
                            className={fieldClass}
                            style={fixedUnit ? fixedInputStyle : inputStyle}
                            value={it.unitPrice}
                            readOnly={fixedUnit}
                            onChange={(e) => !fixedUnit && updateItem(it.id, "unitPrice", e.target.value)}
                            placeholder="단가"
                          />
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            금액
                          </label>
                          {autoAmt && !it.isManual ? (
                            <div className="rounded-[10px] border px-3 py-2 text-[13px] font-bold" style={{ background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--info-text)" }}>
                              {Number(it.amount) ? Number(it.amount).toLocaleString() : "0"}원
                            </div>
                          ) : (
                            <input type="number" className={fieldClass} style={inputStyle} value={it.amount} onChange={(e) => updateItem(it.id, "amount", e.target.value)} placeholder="금액 입력" />
                          )}
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            연령대
                          </label>
                          <input className={fieldClass} style={inputStyle} value={it.ageGroup} onChange={(e) => updateItem(it.id, "ageGroup", e.target.value)} />
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            발송유형
                          </label>
                          <input
                            className={fieldClass}
                            style={it.isManual ? inputStyle : fixedInputStyle}
                            value={it.isManual ? it.sendType : buildSendType(it.media, it.type, property)}
                            readOnly={!it.isManual}
                            onChange={(e) => it.isManual && updateItem(it.id, "sendType", e.target.value)}
                            placeholder="발송유형"
                          />
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                        <div>
                          <label className={labelClass} style={mutedText}>
                            지역①
                          </label>
                          <input className={fieldClass} style={inputStyle} value={it.region1} onChange={(e) => updateItem(it.id, "region1", e.target.value)} placeholder="예: 경산" />
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            지역②
                          </label>
                          <input className={fieldClass} style={inputStyle} value={it.region2} onChange={(e) => updateItem(it.id, "region2", e.target.value)} placeholder="예: 대구 동구" />
                        </div>
                        <div>
                          <label className={labelClass} style={mutedText}>
                            지역③
                          </label>
                          <input className={fieldClass} style={inputStyle} value={it.region3} onChange={(e) => updateItem(it.id, "region3", e.target.value)} placeholder="예: 대구 수성구" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className="mt-4 flex flex-col gap-3 rounded-[16px] border p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}
              >
                <span className="text-[13px]" style={mutedText}>
                  공급가액: <b style={{ color: "var(--text-strong)" }}>{total.toLocaleString()}원</b>
                </span>
                <span className="text-[17px] font-black" style={{ color: "var(--info-text)" }}>
                  합계 (VAT 포함): {totalVat.toLocaleString()}원
                </span>
              </div>
            </section>

            <section className="rounded-[18px] border p-4" style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}>
              <p className="text-[13px] font-bold" style={{ color: "var(--warning-text)" }}>
                💳 입금처
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--warning-text)" }}>
                기업은행 298-122618-04-018 &nbsp;|&nbsp; 예금주: ㈜ 광고인
              </p>
            </section>
          </div>

          <aside className="min-w-0 self-start xl:sticky xl:top-0 xl:h-[calc(100vh-104px)]">
            <div className="flex h-full min-h-[560px] flex-col rounded-[18px] border shadow-sm" style={surfaceStyle}>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "var(--info-bg)", color: "var(--info-text)" }}>
                    <List size={16} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold" style={{ color: "var(--text-strong)" }}>
                      저장된 견적서
                    </h3>
                    <p className="text-[11px]" style={subtleText}>
                      최근 100건 기준
                    </p>
                  </div>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={surface2Style}>
                  {filteredQuotes.length}건
                </span>
              </div>

              <div className="shrink-0 space-y-2 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
                  <input
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                    placeholder="물건명, 계약자, 담당자, 매체..."
                    className="w-full rounded-[10px] border py-2 pl-9 pr-3 text-[12px] outline-none transition focus:ring-2"
                    style={inputStyle}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={qDateFrom} onChange={(e) => setQDateFrom(e.target.value)} className="min-w-0 flex-1 rounded-[10px] border px-2 py-2 text-[12px] outline-none" style={inputStyle} />
                  <span className="text-[12px]" style={subtleText}>
                    ~
                  </span>
                  <input type="date" value={qDateTo} onChange={(e) => setQDateTo(e.target.value)} className="min-w-0 flex-1 rounded-[10px] border px-2 py-2 text-[12px] outline-none" style={inputStyle} />
                  {(qDateFrom || qDateTo) && (
                    <button onClick={() => { setQDateFrom(""); setQDateTo(""); }} className="rounded-[8px] px-2 py-1 text-[12px] font-bold" style={{ color: "var(--danger-text)" }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-b px-4 py-2" style={{ ...surface3Style, borderColor: "var(--border)" }}>
                <div className="grid grid-cols-7 gap-1 text-[10.5px] font-bold" style={subtleText}>
                  <span>견적일자</span>
                  <span>계약자</span>
                  <span>매체</span>
                  <span>유형</span>
                  <span className="text-right">수량</span>
                  <span className="text-right">합계(VAT)</span>
                  <span className="text-center">담당</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingQuotes ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                  </div>
                ) : filteredQuotes.length === 0 ? (
                  <div className="py-16 text-center text-[13px]" style={subtleText}>
                    <FileText size={30} className="mx-auto mb-2 opacity-40" />
                    <p>견적서가 없습니다</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                    {filteredQuotes.map((q) => {
                      let pi: any[] = [];
                      try {
                        pi = JSON.parse(q.items || "[]");
                      } catch {}
                      const it0 = pi[0] || {};
                      const isOpen = expandedId === q.id;
                      const isDl = dlId === q.id;
                      const qtyLabel = it0.media === "호갱노노" && it0.type === "호갱노노_단지마커" ? `${it0.quantity || 0}일` : `${Number(it0.quantity || 0).toLocaleString()}`;
                      return (
                        <div key={q.id}>
                          <button
                            onClick={() => setExpandedId(isOpen ? null : q.id)}
                            className="w-full px-4 py-2.5 text-left transition"
                            style={{ background: isOpen ? "var(--surface-selected)" : "transparent" }}
                          >
                            <div className="grid grid-cols-7 items-center gap-1 text-[12px]">
                              <span className="font-medium" style={subtleText}>
                                {q.quote_date?.slice(5) || "-"}
                              </span>
                              <span className="truncate font-semibold" style={{ color: "var(--text)" }}>
                                {q.client_name || q.client_manager || "-"}
                              </span>
                              <span className="truncate font-semibold" style={{ color: "var(--info-text)" }}>
                                {it0.media || "-"}
                              </span>
                              <span className="truncate" style={subtleText}>
                                {it0.type || "-"}
                              </span>
                              <span className="text-right" style={{ color: "var(--text)" }}>
                                {qtyLabel}
                              </span>
                              <span className="text-right font-black" style={{ color: "var(--info-text)" }}>
                                {fmtV(q.total_vat || 0)}
                              </span>
                              <span className="truncate text-center" style={subtleText}>
                                {q.supplier_manager || "-"}
                              </span>
                            </div>
                          </button>
                          {isOpen && (
                            <div className="border-t px-4 pb-3" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                              <div className="mt-2 space-y-1.5 rounded-[14px] border p-3 text-[12px]" style={surface2Style}>
                                <div className="flex justify-between gap-3"><span style={subtleText}>대상물건</span><span className="text-right font-bold" style={{ color: "var(--text)" }}>{q.property}</span></div>
                                <div className="flex justify-between gap-3"><span style={subtleText}>견적일자</span><span style={{ color: "var(--text)" }}>{q.quote_date || "-"}</span></div>
                                <div className="my-1.5 border-t border-dashed" style={{ borderColor: "var(--border)" }} />
                                <div className="flex justify-between gap-3"><span style={subtleText}>수급인 담당자</span><span className="font-semibold" style={{ color: "var(--text)" }}>{q.supplier_manager || "-"}</span></div>
                                <div className="flex justify-between gap-3"><span style={subtleText}>수급인 HP</span><span style={{ color: "var(--text)" }}>{q.supplier_phone || "-"}</span></div>
                                <div className="my-1.5 border-t border-dashed" style={{ borderColor: "var(--border)" }} />
                                <div className="flex justify-between gap-3"><span style={subtleText}>위탁인 계약자</span><span className="font-semibold" style={{ color: "var(--text)" }}>{q.client_name || "-"}</span></div>
                                <div className="flex justify-between gap-3"><span style={subtleText}>위탁인 담당자</span><span style={{ color: "var(--text)" }}>{q.client_manager || "-"}</span></div>
                                <div className="flex justify-between gap-3"><span style={subtleText}>위탁인 HP</span><span style={{ color: "var(--text)" }}>{q.client_phone || "-"}</span></div>
                                <div className="my-1.5 border-t border-dashed" style={{ borderColor: "var(--border)" }} />
                                <div className="flex justify-between gap-3"><span style={subtleText}>매체</span><span className="text-right font-semibold" style={{ color: "var(--info-text)" }}>{it0.media || "-"} / {it0.type || "-"}</span></div>
                                <div className="flex justify-between gap-3"><span style={subtleText}>수량</span><span style={{ color: "var(--text)" }}>{qtyLabel}</span></div>
                                <div className="flex justify-between gap-3"><span style={subtleText}>공급가액</span><span style={{ color: "var(--text)" }}>{(q.total_amount || 0).toLocaleString()}원</span></div>
                                <div className="flex justify-between gap-3"><span style={subtleText}>합계 (VAT포함)</span><span className="font-black" style={{ color: "var(--info-text)" }}>{(q.total_vat || 0).toLocaleString()}원</span></div>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <button onClick={() => loadQuote(q)} className="flex-1 rounded-[10px] border py-2 text-center text-[12px] font-semibold transition" style={surface2Style}>
                                  불러오기
                                </button>
                                <button
                                  onClick={() => downloadSavedPdf(q)}
                                  disabled={isDl}
                                  className="flex flex-1 items-center justify-center gap-1 rounded-[10px] border py-2 text-[12px] font-semibold transition disabled:opacity-50"
                                  style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
                                >
                                  <Download size={12} />{isDl ? "다운중..." : "PDF 다운받기"}
                                </button>
                                <button onClick={() => deleteSavedQuote(q.id)} className="rounded-[10px] p-2 transition" style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
                                  <Trash2 size={13} />
                                </button>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
