"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Search, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";


interface AdSite {
  region: string; city: string; siteName: string;
  performance: string; support: string;
  totalAdBudget: number; operatingAmount: number; reservationAmount: number;
  adCount: number; customers: string[];
  suspended: boolean; suspendedDate: string;
  competition: "심화" | "적정" | "보통" | "여유";
}
interface SyncResult {
  sites: AdSite[];
  summary?: { totalSites: number; totalBudget: number; totalOperating: number; totalReservation: number; totalOutstanding: number; totalAdUsers: number };
  lastSync?: string;
  error?: string;
}

const COMP_STYLE: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  "심화": { bg: "rgba(239,68,68,0.1)", text: "#ef4444", border: "rgba(239,68,68,0.3)", dot: "#ef4444", label: "🔴 심화" },
  "적정": { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", border: "rgba(245,158,11,0.3)", dot: "#f59e0b", label: "🟡 적정" },
  "보통": { bg: "rgba(34,197,94,0.1)", text: "#22c55e", border: "rgba(34,197,94,0.3)", dot: "#22c55e", label: "🟢 보통" },
  "여유": { bg: "rgba(59,130,246,0.1)", text: "#3b82f6", border: "rgba(59,130,246,0.3)", dot: "#3b82f6", label: "🔵 여유" },
};

const fw = (n: number) => n.toLocaleString();

type SortKey = "budget" | "operating" | "reservation" | "adCount" | "name" | "region";
type SortDir = "asc" | "desc";

export default function AdSitesPage() {
  const [data, setData] = useState<SyncResult>({ sites: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("전체");
  const [filterComp, setFilterComp] = useState("전체");
  const [filterSuspended, setFilterSuspended] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("budget");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fetch-ad-sites");
      const json = await res.json();
      setData(json);
    } catch { setData({ sites: [], error: "데이터를 불러올 수 없습니다" }); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetFilters = () => {
    setSearch(""); setFilterRegion("전체"); setFilterComp("전체");
    setFilterSuspended("all"); setSortKey("budget"); setSortDir("desc");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const regions = useMemo(() => {
    const set = new Set(data.sites.map(s => s.region));
    return ["전체", ...Array.from(set)];
  }, [data.sites]);

  const filtered = useMemo(() => {
    let list = [...data.sites];
    if (filterRegion !== "전체") list = list.filter(s => s.region === filterRegion);
    if (filterComp !== "전체") list = list.filter(s => s.competition === filterComp);
    if (filterSuspended === "active") list = list.filter(s => !s.suspended);
    if (filterSuspended === "suspended") list = list.filter(s => s.suspended);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.siteName.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.customers.some(c => c.toLowerCase().includes(q))
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "budget") list.sort((a, b) => (a.totalAdBudget - b.totalAdBudget) * dir);
    else if (sortKey === "operating") list.sort((a, b) => (a.operatingAmount - b.operatingAmount) * dir);
    else if (sortKey === "reservation") list.sort((a, b) => (a.reservationAmount - b.reservationAmount) * dir);
    else if (sortKey === "adCount") list.sort((a, b) => (a.adCount - b.adCount) * dir);
    else if (sortKey === "region") list.sort((a, b) => a.region.localeCompare(b.region) * dir);
    else list.sort((a, b) => a.siteName.localeCompare(b.siteName) * dir);
    return list;
  }, [data.sites, filterRegion, filterComp, filterSuspended, search, sortKey, sortDir]);

  const compCounts = useMemo(() => ({
    total: data.sites.length,
    심화: data.sites.filter(s => s.competition === "심화").length,
    적정: data.sites.filter(s => s.competition === "적정").length,
    보통: data.sites.filter(s => s.competition === "보통").length,
    여유: data.sites.filter(s => s.competition === "여유").length,
  }), [data.sites]);

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="inline-flex flex-col ml-1" style={{ lineHeight: 0 }}>
      <ChevronUp size={10} style={{ color: sortKey === k && sortDir === "asc" ? "var(--info)" : "var(--text-muted)", opacity: sortKey === k && sortDir === "asc" ? 1 : 0.3 }} />
      <ChevronDown size={10} style={{ color: sortKey === k && sortDir === "desc" ? "var(--info)" : "var(--text-muted)", opacity: sortKey === k && sortDir === "desc" ? 1 : 0.3, marginTop: -3 }} />
    </span>
  );

  const s = data.summary;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* 헤더 */}
      <div className="px-5 sm:px-8 py-4 sticky top-0 z-10" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-black flex items-center gap-2" style={{ color: "var(--text)" }}>
              📡 광고 현운예지
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              전국광고운영지도 · 현장 경쟁도 분석
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
            <div>
              <p className="text-sm font-bold" style={{ color: "#ef4444" }}>{data.error}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>구글시트 → 파일 → 공유 → 웹에 게시 → [영업부용] 현운예지 탭 → CSV → 게시 후 다시 동기화</p>
            </div>
          </div>
        )}

        {/* 요약 카드 */}
        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "총 현장", value: `${s.totalSites}개`, color: "var(--text)" },
              { label: "총 광고주", value: `${s.totalAdUsers}명`, color: "var(--info)" },
              { label: "총광고비", value: `${fw(s.totalBudget)}원`, color: "var(--text)" },
              { label: "운영금액", value: `${fw(s.totalOperating)}원`, color: "#22c55e" },
              { label: "예약금액", value: `${fw(s.totalReservation)}원`, color: "#3b82f6" },
              { label: "미수금액", value: `${fw(s.totalOutstanding)}원`, color: "#ef4444" },
            ].map(card => (
              <div key={card.label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>{card.label}</p>
                <p className="text-base font-black" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 경쟁도 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["전체", "심화", "적정", "보통", "여유"] as const).map(comp => {
            const active = filterComp === comp;
            const style = comp === "전체" ? null : COMP_STYLE[comp];
            const count = comp === "전체" ? compCounts.total : compCounts[comp];
            return (
              <button key={comp} onClick={() => setFilterComp(comp === filterComp ? "전체" : comp)}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  background: active ? (style ? style.bg : "var(--sidebar-active-bg)") : "var(--surface)",
                  border: active ? `2px solid ${style ? style.border : "var(--info)"}` : "1px solid var(--border)",
                }}>
                <div className="flex items-center gap-2">
                  {style ? (
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: style.dot, display: "inline-block" }} />
                  ) : (
                    <span style={{ fontSize: 14 }}>📊</span>
                  )}
                  <span className="text-sm font-bold" style={{ color: style ? style.text : "var(--text)" }}>
                    {comp}
                  </span>
                </div>
                <p className="text-xl font-black mt-1" style={{ color: "var(--text)" }}>{count}개</p>
              </button>
            );
          })}
        </div>

        {/* 필터 바 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="현장명, 도시, 고객명 검색..."
              className="pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none w-[260px]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </div>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
            className="text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterSuspended} onChange={e => setFilterSuspended(e.target.value)}
            className="text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="all">전체 상태</option>
            <option value="active">운영중</option>
            <option value="suspended">수주중단</option>
          </select>
          {(()=>{const hasFilter=!!(search||filterRegion!=="전체"||filterComp!=="전체"||filterSuspended!=="all");return(
            <button onClick={resetFilters}
              className={`text-xs px-2.5 py-2 font-semibold rounded-xl whitespace-nowrap transition-colors ${hasFilter ? "bg-red-500 text-white border border-red-500" : "text-red-400 border border-red-200 hover:bg-red-50"}`}>
              ↺ 초기화
            </button>
          );})()}
          <span className="text-sm font-bold ml-auto" style={{ color: "var(--text-muted)" }}>{filtered.length}건</span>
        </div>

        {/* 테이블 */}
        {loading && data.sites.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-3xl mb-2">📡</p>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              {data.sites.length === 0 ? "동기화 버튼을 눌러 데이터를 가져오세요" : "검색 결과가 없습니다"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "950px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 90 }}>경쟁도</th>
                    <th className="px-4 py-3 text-center text-xs font-bold cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => toggleSort("region")}>지역<SortIcon k="region" /></th>
                    <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>도시</th>
                    <th className="px-4 py-3 text-center text-xs font-bold cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => toggleSort("name")}>현장명<SortIcon k="name" /></th>
                    <th className="px-4 py-3 text-center text-xs font-bold cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => toggleSort("budget")}>총광고비<SortIcon k="budget" /></th>
                    <th className="px-4 py-3 text-center text-xs font-bold cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => toggleSort("operating")}>운영금액<SortIcon k="operating" /></th>
                    <th className="px-4 py-3 text-center text-xs font-bold cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => toggleSort("reservation")}>예약금<SortIcon k="reservation" /></th>
                    <th className="px-4 py-3 text-center text-xs font-bold cursor-pointer select-none" style={{ color: "var(--text-muted)" }} onClick={() => toggleSort("adCount")}>광고수<SortIcon k="adCount" /></th>
                    <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>광고주</th>
                    <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((site, idx) => {
                    const cs = COMP_STYLE[site.competition];
                    return (
                      <tr key={idx} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", opacity: site.suspended ? 0.45 : 1 }}>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                            style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: cs.dot, display: "inline-block", flexShrink: 0 }} />
                            {site.competition}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-semibold" style={{ color: "var(--text)" }}>{site.region}</td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--text-muted)" }}>{site.city}</td>
                        <td className="px-4 py-3 text-sm text-center font-bold" style={{ color: "var(--text)" }}>{site.siteName}</td>
                        <td className="px-4 py-3 text-sm text-center font-black" style={{ color: "var(--text)" }}>{fw(site.totalAdBudget)}</td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--text)" }}>{site.operatingAmount ? fw(site.operatingAmount) : "-"}</td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--info)" }}>{site.reservationAmount ? fw(site.reservationAmount) : "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black"
                            style={{ background: site.adCount >= 5 ? "rgba(239,68,68,0.15)" : site.adCount >= 3 ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.08)", color: site.adCount >= 5 ? "#ef4444" : site.adCount >= 3 ? "#f59e0b" : "var(--info)" }}>
                            {site.adCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {site.customers.slice(0, 3).map((c, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: "var(--sidebar-active-bg)", color: "var(--text)" }}>{c}</span>
                            ))}
                            {site.customers.length > 3 && <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>+{site.customers.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {site.suspended ? (
                            <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>중단</span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>운영</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
