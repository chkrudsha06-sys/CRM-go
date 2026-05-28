"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Search, ChevronDown, ChevronRight, Phone, Heart, AlertTriangle } from "lucide-react";

interface Campaign {
  물건: string; 광고기간: string; 지역: string; 현장명원본: string;
  현장명: string; 캠페인번호: string; 광고주: string; 광고비: number;
  광고비텍스트: string; 담당자: string; 분류: string; 물건분류: string;
  콜: number; 관심: number; 연도: string;
}
interface SiteGroup {
  현장명: string; 지역: string; 캠페인수: number; 총콜: number; 총관심: number;
  총광고비: number; 물건: string; 물건분류: string; 캠페인: Campaign[];
}
interface SyncResult {
  sites: SiteGroup[];
  summary?: { totalSites: number; totalCampaigns: number; totalCalls: number; totalInterest: number; totalBudget: number };
  lastSync?: string; error?: string;
}

const fw = (n: number) => n.toLocaleString();

export default function AdHistoryPage() {
  const [data, setData] = useState<SyncResult>({ sites: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("전체");
  const [filterType, setFilterType] = useState("전체");
  const [filterYear, setFilterYear] = useState("전체");
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"campaigns" | "calls" | "interest" | "budget">("campaigns");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fetch-ad-history?year=all");
      const json = await res.json();
      setData(json);
    } catch { setData({ sites: [], error: "데이터를 불러올 수 없습니다" }); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetFilters = () => { setSearch(""); setFilterRegion("전체"); setFilterType("전체"); setFilterYear("전체"); setSortBy("campaigns"); };
  const hasFilter = !!(search || filterRegion !== "전체" || filterType !== "전체" || filterYear !== "전체");

  const regions = useMemo(() => {
    const set = new Set(data.sites.map(s => s.지역.split(", ")[0]));
    return ["전체", ...Array.from(set).sort()];
  }, [data.sites]);

  const filtered = useMemo(() => {
    let list = [...data.sites];
    // 연도 필터: 캠페인 수준에서 필터 후 사이트 재구성
    if (filterYear !== "전체") {
      list = list.map(s => {
        const fc = s.캠페인.filter(c => c.연도 === filterYear);
        if (fc.length === 0) return null;
        return {
          ...s,
          캠페인: fc, 캠페인수: fc.length,
          총콜: fc.reduce((sum, c) => sum + c.콜, 0),
          총관심: fc.reduce((sum, c) => sum + c.관심, 0),
          총광고비: fc.reduce((sum, c) => sum + c.광고비, 0),
        };
      }).filter(Boolean) as SiteGroup[];
    }
    if (filterRegion !== "전체") list = list.filter(s => s.지역.includes(filterRegion));
    if (filterType !== "전체") list = list.filter(s => s.물건분류 === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.현장명.toLowerCase().includes(q) ||
        s.지역.toLowerCase().includes(q) ||
        s.캠페인.some(c => c.광고주.toLowerCase().includes(q) || c.담당자.toLowerCase().includes(q))
      );
    }
    if (sortBy === "campaigns") list.sort((a, b) => b.캠페인수 - a.캠페인수);
    else if (sortBy === "calls") list.sort((a, b) => b.총콜 - a.총콜);
    else if (sortBy === "interest") list.sort((a, b) => b.총관심 - a.총관심);
    else list.sort((a, b) => b.총광고비 - a.총광고비);
    return list;
  }, [data.sites, filterRegion, filterType, filterYear, search, sortBy]);

  const s = data.summary;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* 헤더 */}
      <div className="px-5 sm:px-8 py-4 sticky top-0 z-10" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>📊 광고내역기록</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              현장별 캠페인 운영 내역 · 콜/관심 수치 분석
              {data.lastSync && <span className="ml-2 opacity-60">마지막 동기화: {new Date(data.lastSync).toLocaleString("ko-KR")}</span>}
            </p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
            style={{ background: "var(--info)", color: "#fff" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "동기화 중..." : "시트 동기화"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 sm:px-8 py-5 space-y-5">
        {/* 에러 */}
        {data.error && (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm font-bold" style={{ color: "#ef4444" }}>{data.error}</p>
          </div>
        )}

        {/* 요약 카드 */}
        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "총 현장", value: `${s.totalSites}개`, color: "var(--text)" },
              { label: "총 캠페인", value: `${s.totalCampaigns}건`, color: "var(--info)" },
              { label: "총 콜", value: `${fw(s.totalCalls)}건`, color: "#f59e0b" },
              { label: "총 관심", value: `${fw(s.totalInterest)}건`, color: "#ef4444" },
              { label: "총 광고비", value: `${fw(s.totalBudget)}원`, color: "#22c55e" },
            ].map(card => (
              <div key={card.label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>{card.label}</p>
                <p className="text-base font-black" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="현장명, 지역, 광고주, 담당자 검색..."
              className="pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none w-[280px]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </div>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
            className="text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="전체">전체 분류</option>
            <option value="미분양">미분양</option>
            <option value="지주택">지주택</option>
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="전체">전체 연도</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="campaigns">캠페인수순</option>
            <option value="calls">콜수순</option>
            <option value="interest">관심수순</option>
            <option value="budget">광고비순</option>
          </select>
          <button onClick={resetFilters}
            className={`text-xs px-2.5 py-2 font-semibold rounded-xl whitespace-nowrap transition-colors ${hasFilter ? "bg-red-500 text-white border border-red-500" : "text-red-400 border border-red-200 hover:bg-red-50"}`}>
            ↺ 초기화
          </button>
          <span className="text-sm font-bold ml-auto" style={{ color: "var(--text-muted)" }}>{filtered.length}개 현장</span>
        </div>

        {/* 현장 목록 */}
        {loading && data.sites.length === 0 ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              {data.sites.length === 0 ? "동기화 버튼을 눌러 데이터를 가져오세요" : "검색 결과가 없습니다"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(site => {
              const isOpen = expandedSite === site.현장명;
              return (
                <div key={site.현장명} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: `1px solid ${isOpen ? "var(--info)" : "var(--border)"}` }}>
                  {/* 현장 헤더 */}
                  <button onClick={() => setExpandedSite(isOpen ? null : site.현장명)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left transition-colors"
                    style={{ background: isOpen ? "rgba(59,130,246,0.05)" : "transparent" }}>
                    {isOpen ? <ChevronDown size={16} style={{ color: "var(--info)", flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black" style={{ color: "var(--text)" }}>{site.현장명}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(59,130,246,0.1)", color: "var(--info)" }}>{site.캠페인수}회 캠페인</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>{site.지역}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: site.물건분류 === "지주택" ? "rgba(139,92,246,0.1)" : "rgba(245,158,11,0.1)", color: site.물건분류 === "지주택" ? "#8b5cf6" : "#f59e0b" }}>{site.물건분류}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>콜</p>
                        <p className="text-sm font-black" style={{ color: "#f59e0b" }}>{fw(site.총콜)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>관심</p>
                        <p className="text-sm font-black" style={{ color: "#ef4444" }}>{fw(site.총관심)}</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>광고비</p>
                        <p className="text-sm font-black" style={{ color: "#22c55e" }}>{fw(site.총광고비)}</p>
                      </div>
                    </div>
                  </button>

                  {/* 캠페인 상세 */}
                  {isOpen && (
                    <div className="px-5 pb-4">
                      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        <table className="w-full text-sm" style={{ minWidth: "700px" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 50 }}>#</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>광고기간</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>광고주</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>광고비</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>담당자</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>분류</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>물건</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>콜</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>관심</th>
                            </tr>
                          </thead>
                          <tbody>
                            {site.캠페인.map((c, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td className="px-3 py-2.5 text-center font-bold" style={{ color: "var(--info)" }}>{c.캠페인번호}</td>
                                <td className="px-3 py-2.5 text-center" style={{ color: "var(--text)" }}>{c.광고기간}</td>
                                <td className="px-3 py-2.5 text-center font-semibold" style={{ color: "var(--text)" }}>{c.광고주}</td>
                                <td className="px-3 py-2.5 text-center font-bold" style={{ color: "#22c55e" }}>{fw(c.광고비)}</td>
                                <td className="px-3 py-2.5 text-center" style={{ color: "var(--text)" }}>{c.담당자}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{
                                    background: c.분류 === "본부광고" ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.06)",
                                    color: c.분류 === "본부광고" ? "#3b82f6" : "var(--text-muted)"
                                  }}>{c.분류}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{
                                    background: c.물건분류 === "지주택" ? "rgba(139,92,246,0.1)" : "rgba(245,158,11,0.1)",
                                    color: c.물건분류 === "지주택" ? "#8b5cf6" : "#f59e0b"
                                  }}>{c.물건분류}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="font-black" style={{ color: "#f59e0b" }}>{fw(c.콜)}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="font-black" style={{ color: "#ef4444" }}>{fw(c.관심)}</span>
                                </td>
                              </tr>
                            ))}
                            {/* 소계 */}
                            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                              <td colSpan={3} className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>합계 ({site.캠페인수}회)</td>
                              <td className="px-3 py-2.5 text-center font-black text-sm" style={{ color: "#22c55e" }}>{fw(site.총광고비)}</td>
                              <td colSpan={3}></td>
                              <td className="px-3 py-2.5 text-center font-black text-sm" style={{ color: "#f59e0b" }}>{fw(site.총콜)}</td>
                              <td className="px-3 py-2.5 text-center font-black text-sm" style={{ color: "#ef4444" }}>{fw(site.총관심)}</td>
                            </tr>
                          </tbody>
                        </table>
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
  );
}
