"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Award, TrendingUp } from "lucide-react";

// ── 인센티브 테이블 데이터 ──────────────────────────────
// 실행파트 광고연계매출 (하이타겟)
const EXEC_AD_TIERS = [
  { grade: 1500, incentive: 45, rate: "3.0%" },
  { grade: 2000, incentive: 60, rate: "" },
  { grade: 3000, incentive: 90, rate: "" },
  { grade: 4000, incentive: 120, rate: "" },
  { grade: 5000, incentive: 150, rate: "3.5%" },
  { grade: 6000, incentive: 180, rate: "" },
  { grade: 8000, incentive: 320, rate: "4.0%" },
  { grade: 10000, incentive: 450, rate: "4.5%" },
  { grade: 13000, incentive: 650, rate: "5.0%" },
];

// 실행파트 분양회
const EXEC_BH_TIERS = [
  { grade: 250, incentive: 25, rate: "5.0%" },
  { grade: 500, incentive: 50, rate: "" },
  { grade: 750, incentive: 90, rate: "6.0%" },
  { grade: 1000, incentive: 140, rate: "7.0%" },
  { grade: 1250, incentive: 200, rate: "8.0%" },
  { grade: 1500, incentive: 300, rate: "10.0%" },
];

// 운영파트 광고운영 (LMS/호갱노노)
const OPS_AD_TIERS = [
  { grade: 1500, incentive: 15, rate: "" },
  { grade: 2000, incentive: 20, rate: "" },
  { grade: 3000, incentive: 30, rate: "1.0%" },
  { grade: 4000, incentive: 40, rate: "" },
  { grade: 5000, incentive: 50, rate: "" },
  { grade: 6000, incentive: 60, rate: "" },
  { grade: 8000, incentive: 100, rate: "1.25%" },
  { grade: 10000, incentive: 150, rate: "1.5%" },
  { grade: 13000, incentive: 195, rate: "" },
];

// 파트장(최웅) 광고연계매출 (팀 전체)
const MGR_AD_TIERS = [
  { grade: 6000, incentive: 60, rate: "1.0%" },
  { grade: 9000, incentive: 90, rate: "" },
  { grade: 12000, incentive: 180, rate: "1.5%" },
  { grade: 15000, incentive: 225, rate: "" },
  { grade: 20000, incentive: 350, rate: "1.75%" },
  { grade: 25000, incentive: 438, rate: "" },
  { grade: 30000, incentive: 600, rate: "2.0%" },
  { grade: 40000, incentive: 1000, rate: "2.5%" },
  { grade: 50000, incentive: 1500, rate: "3.0%" },
];

// 파트장(최웅) 분양회
const MGR_BH_TIERS = [
  { grade: 500, incentive: 25, rate: "" },
  { grade: 750, incentive: 38, rate: "" },
  { grade: 1000, incentive: 50, rate: "2.5%" },
  { grade: 1500, incentive: 75, rate: "" },
  { grade: 2000, incentive: 100, rate: "" },
  { grade: 2500, incentive: 125, rate: "3.0%" },
  { grade: 3000, incentive: 180, rate: "" },
  { grade: 4000, incentive: 280, rate: "3.5%" },
  { grade: 5000, incentive: 400, rate: "4.0%" },
];

const EXEC_TEAM = ["조계현","이세호","기여운","최연전"];
const OPS_TEAM = ["김재영","최은정"];
const OPS_EXEC_MAP: Record<string,string[]> = { "김재영":["이세호","기여운"], "최은정":["조계현","최연전"] };
const HOG_CHS = ["호갱노노_채널톡","호갱노노_단지마커","호갱노노_기타"];

function findTier(tiers: typeof EXEC_AD_TIERS, amountMan: number): { incentive: number; grade: number } | null {
  let matched: typeof EXEC_AD_TIERS[0] | null = null;
  for (const t of tiers) {
    if (amountMan >= t.grade) matched = t;
    else break;
  }
  return matched;
}

function TierTable({ title, tiers, color }: { title: string; tiers: typeof EXEC_AD_TIERS; color: string }) {
  // 지급률 병합 그룹 계산
  const rateGroups: { rate: string; span: number }[] = [];
  let i = 0;
  while (i < tiers.length) {
    if (tiers[i].rate) {
      // 이 rate가 다음 rate까지 몇 칸을 커버하는지
      let span = 1;
      let j = i + 1;
      while (j < tiers.length && !tiers[j].rate) { span++; j++; }
      rateGroups.push({ rate: tiers[i].rate, span });
      i = j;
    } else {
      // rate 없는 칸 (맨 앞에 rate 없는 구간)
      let span = 1;
      let j = i + 1;
      while (j < tiers.length && !tiers[j].rate) { span++; j++; }
      rateGroups.push({ rate: "", span });
      i = j;
    }
  }

  return (
    <div>
      <p className="text-sm font-bold text-slate-700 mb-2">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr><th className={`px-3 py-2 border border-slate-200 ${color} text-white font-bold text-center`}></th>
              {tiers.map(t=><th key={t.grade} className={`px-3 py-2 border border-slate-200 ${color} text-white font-bold text-center`}>{t.grade.toLocaleString()}만</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><td className="px-3 py-2 border border-slate-200 font-bold text-slate-600 bg-slate-50 text-center">인센티브</td>
              {tiers.map(t=><td key={t.grade} className="px-3 py-2 border border-slate-200 text-center text-slate-700">{t.incentive}만</td>)}
            </tr>
            <tr><td className="px-3 py-2 border border-slate-200 font-bold text-red-500 bg-slate-50 text-center">지급률</td>
              {rateGroups.map((g,idx)=>(
                <td key={idx} colSpan={g.span} className="px-3 py-2 border border-slate-200 text-center text-red-500 font-bold">{g.rate}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fW(n: number) { return n ? n.toLocaleString() + "만원" : "0원"; }

export default function IncentivesPage() {
  const [loading, setLoading] = useState(true);
  const [execData, setExecData] = useState<any[]>([]);
  const [opsData, setOpsData] = useState<any[]>([]);
  const [mgrData, setMgrData] = useState<any>(null);
  const [filter, setFilter] = useState("전체");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
  });

  // 월 옵션 생성 (2026-02 ~ 현재 월)
  const monthOptions = (() => {
    const opts: string[] = [];
    const start = new Date(2026, 1, 1); // 2026-02
    const now = new Date();
    let cur = new Date(start);
    while (cur <= now) {
      opts.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return opts.reverse();
  })();

  useEffect(() => { loadData(selectedMonth); }, [selectedMonth]);

  const loadData = async (month: string) => {
    setLoading(true);
    const [yStr, mStr] = month.split("-");
    const y = parseInt(yStr), m = parseInt(mStr);
    const ms = String(m).padStart(2,"0");
    const ld = new Date(y, m, 0).getDate();
    const mS = `${y}-${ms}-01`, mE = `${y}-${ms}-${String(ld).padStart(2,"0")}`;

    const { data: execs = [] } = await supabase.from("ad_executions").select("*").gte("payment_date",mS).lte("payment_date",mE);
    const me = execs || [];
    const eff = (e: any): number => (e.vat_amount && e.vat_amount > 0 && e.vat_amount !== e.execution_amount) ? e.vat_amount : (e.execution_amount||0);

    // 실행파트 계산
    const execResults = EXEC_TEAM.map(name => {
      // 하이타겟 매출 (환불 차감)
      const adAmt = me.filter((e:any)=>e.team_member===name&&e.channel==="하이타겟")
        .reduce((s:number,e:any)=>s+eff(e)-(e.refund_amount||0),0);
      // 분양회 매출 (입회비+월회비, 환불 차감)
      const bhAmt = me.filter((e:any)=>e.team_member===name&&e.contract_route==="분양회"&&(e.channel==="분양회 입회비"||e.channel==="분양회 월회비"))
        .reduce((s:number,e:any)=>s+eff(e)-(e.refund_amount||0),0);

      const adMan = Math.floor(adAmt / 10000);
      const bhMan = Math.floor(bhAmt / 10000);
      const adTier = findTier(EXEC_AD_TIERS, adMan);
      const bhTier = findTier(EXEC_BH_TIERS, bhMan);

      return { name, adAmt, bhAmt, adMan, bhMan, adTier, bhTier,
        adIncentive: adTier?.incentive || 0, bhIncentive: bhTier?.incentive || 0,
        totalIncentive: (adTier?.incentive||0) + (bhTier?.incentive||0) };
    });
    setExecData(execResults);

    // 운영파트 계산
    const opsResults = OPS_TEAM.map(name => {
      const members = OPS_EXEC_MAP[name] || [];
      const lmsAmt = me.filter((e:any)=>members.includes(e.team_member)&&e.contract_route==="분양회"&&e.channel==="LMS")
        .reduce((s:number,e:any)=>s+eff(e)-(e.refund_amount||0),0);
      const hogAmt = me.filter((e:any)=>members.includes(e.team_member)&&e.contract_route==="분양회"&&HOG_CHS.includes(e.channel))
        .reduce((s:number,e:any)=>s+eff(e)-(e.refund_amount||0),0);
      const totalAmt = lmsAmt + hogAmt;
      const totalMan = Math.floor(totalAmt / 10000);
      const tier = findTier(OPS_AD_TIERS, totalMan);

      return { name, lmsAmt, hogAmt, totalAmt, totalMan, tier, incentive: tier?.incentive || 0 };
    });
    setOpsData(opsResults);

    // 파트장(최웅) 계산 - 팀 전체 매출
    const teamAdTotal = me.filter((e:any)=>EXEC_TEAM.includes(e.team_member)&&e.channel==="하이타겟")
      .reduce((s:number,e:any)=>s+eff(e)-(e.refund_amount||0),0);
    const teamBhTotal = me.filter((e:any)=>EXEC_TEAM.includes(e.team_member)&&e.contract_route==="분양회"&&(e.channel==="분양회 입회비"||e.channel==="분양회 월회비"))
      .reduce((s:number,e:any)=>s+eff(e)-(e.refund_amount||0),0);

    const mgrAdMan = Math.floor(teamAdTotal / 10000);
    const mgrBhMan = Math.floor(teamBhTotal / 10000);
    const mgrAdTier = findTier(MGR_AD_TIERS, mgrAdMan);
    const mgrBhTier = findTier(MGR_BH_TIERS, mgrBhMan);

    setMgrData({
      adAmt: teamAdTotal, bhAmt: teamBhTotal, adMan: mgrAdMan, bhMan: mgrBhMan,
      adTier: mgrAdTier, bhTier: mgrBhTier,
      adIncentive: mgrAdTier?.incentive || 0, bhIncentive: mgrBhTier?.incentive || 0,
      totalIncentive: (mgrAdTier?.incentive||0) + (mgrBhTier?.incentive||0),
    });

    setLoading(false);
  };

  const ALL_MEMBERS = ["전체", ...EXEC_TEAM, ...OPS_TEAM, "최웅"];
  const isExec = EXEC_TEAM.includes(filter);
  const isOps = OPS_TEAM.includes(filter);
  const isMgr = filter === "최웅";
  const showAll = filter === "전체";

  const [yy, mm] = selectedMonth.split("-");
  const monthLabel = `${yy}년 ${parseInt(mm)}월`;

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">🏅 인센티브 관리</h1>
            <p className="text-xs text-slate-500 mt-0.5">대외협력팀 매출 인센티브 · {monthLabel} 기준 · 적용기간: 26.02.01 ~ 26.06.30</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
              className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
              {monthOptions.map(m=><option key={m} value={m}>{m.replace("-","년 ")}월</option>)}
            </select>
            <select value={filter} onChange={e=>setFilter(e.target.value)}
              className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
              {ALL_MEMBERS.map(m=>(
                <option key={m} value={m}>{m === "전체" ? "👥 전체" : m === "최웅" ? "⭐ 최웅 (파트장)" : EXEC_TEAM.includes(m) ? `🔵 ${m}` : `🟢 ${m}`}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400 hidden lg:block">목표 미달성 75% | 달성 100% | 6월까지 125%+100만</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>
        ) : (
          <>
            {/* ═══ 실행파트 인센티브 표 ═══ */}
            {(showAll || isExec) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-base font-black text-slate-800 mb-1">실행파트 인센티브 {isExec ? `(${filter})` : "(팀원)"}</h2>
              <p className="text-xs text-slate-400 mb-5">{isExec ? `${filter} 개인 인센티브 기준표` : "조계현 · 이세호 · 기여운 · 최연전"}</p>
              <div className="space-y-4">
                <TierTable title="광고연계매출 (하이타겟)" tiers={EXEC_AD_TIERS} color="bg-[#1E3A8A]"/>
                <TierTable title="분양회" tiers={EXEC_BH_TIERS} color="bg-[#1E3A8A]"/>
              </div>
            </div>
            )}

            {/* 실행파트 실시간 계산 */}
            {(showAll || isExec) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500"/>실행파트 당월 인센티브 현황 {isExec && `— ${filter}`}
              </h2>
              <p className="text-xs text-slate-400 mb-4">{monthLabel} · 환불 차감 반영</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">담당자</th>
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">하이타겟 매출</th>
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">광고 인센티브</th>
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">분양회 매출</th>
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">분양회 인센티브</th>
                      <th className="px-4 py-3 border border-slate-200 text-amber-600 font-black text-center bg-amber-50">합계 인센티브</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execData.filter(d=>showAll||d.name===filter).map(d=>(
                      <tr key={d.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3 border border-slate-200 text-center font-bold text-slate-800">{d.name}</td>
                        <td className="px-4 py-3 border border-slate-200 text-center text-blue-600 font-semibold">{d.adAmt.toLocaleString()}원</td>
                        <td className="px-4 py-3 border border-slate-200 text-center font-bold text-emerald-600">{d.adIncentive ? `${d.adIncentive}만원` : "-"}</td>
                        <td className="px-4 py-3 border border-slate-200 text-center text-blue-600 font-semibold">{d.bhAmt.toLocaleString()}원</td>
                        <td className="px-4 py-3 border border-slate-200 text-center font-bold text-emerald-600">{d.bhIncentive ? `${d.bhIncentive}만원` : "-"}</td>
                        <td className="px-4 py-3 border border-slate-200 text-center font-black text-amber-600 bg-amber-50 text-base">{d.totalIncentive ? `${d.totalIncentive}만원` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* ═══ 운영파트 인센티브 표 ═══ */}
            {(showAll || isOps) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-base font-black text-slate-800 mb-1">운영파트 인센티브 {isOps ? `(${filter})` : "(광고운영)"}</h2>
              <p className="text-xs text-slate-400 mb-5">{isOps ? `${filter} 개인 인센티브 기준표` : "김재영 · 최은정 · LMS/호갱노노 매출 기준"}</p>
              <TierTable title="광고운영 (LMS / 호갱노노)" tiers={OPS_AD_TIERS} color="bg-emerald-700"/>
              <p className="text-xs text-blue-500 mt-3 bg-blue-50 p-2 rounded-lg border border-blue-100">※ 기타광고 발굴 및 설계 시 해당 광고 인센티브 신설 추가 제공</p>
            </div>
            )}

            {/* 운영파트 실시간 계산 */}
            {(showAll || isOps) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500"/>운영파트 당월 인센티브 현황 {isOps && `— ${filter}`}
              </h2>
              <p className="text-xs text-slate-400 mb-4">{monthLabel} · 환불 차감 반영</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">담당자</th>
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">LMS 매출</th>
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">호갱노노 매출</th>
                      <th className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-center">합산 매출</th>
                      <th className="px-4 py-3 border border-slate-200 text-amber-600 font-black text-center bg-amber-50">인센티브</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsData.filter(d=>showAll||d.name===filter).map(d=>(
                      <tr key={d.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3 border border-slate-200 text-center font-bold text-slate-800">{d.name}</td>
                        <td className="px-4 py-3 border border-slate-200 text-center text-blue-600 font-semibold">{d.lmsAmt.toLocaleString()}원</td>
                        <td className="px-4 py-3 border border-slate-200 text-center text-blue-600 font-semibold">{d.hogAmt.toLocaleString()}원</td>
                        <td className="px-4 py-3 border border-slate-200 text-center font-bold text-slate-800">{d.totalAmt.toLocaleString()}원</td>
                        <td className="px-4 py-3 border border-slate-200 text-center font-black text-amber-600 bg-amber-50 text-base">{d.incentive ? `${d.incentive}만원` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* ═══ 파트장(최웅) 인센티브 표 ═══ */}
            {(showAll || isMgr) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-base font-black text-slate-800 mb-1">파트장 인센티브 (최웅)</h2>
              <p className="text-xs text-slate-400 mb-5">대외협력팀 전체 매출 기준</p>
              <div className="space-y-4">
                <TierTable title="광고연계매출 (팀 전체)" tiers={MGR_AD_TIERS} color="bg-violet-700"/>
                <TierTable title="분양회 (팀 전체)" tiers={MGR_BH_TIERS} color="bg-violet-700"/>
              </div>
            </div>
            )}

            {/* 파트장 실시간 계산 */}
            {(showAll || isMgr) && mgrData && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
                  <TrendingUp size={16} className="text-violet-500"/>파트장(최웅) 당월 인센티브 현황
                </h2>
                <p className="text-xs text-slate-400 mb-4">{monthLabel} · 팀 전체 매출 기준 · 환불 차감 반영</p>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                    <p className="text-[10px] text-blue-400 mb-1">팀 전체 하이타겟 매출</p>
                    <p className="text-lg font-black text-blue-700">{mgrData.adAmt.toLocaleString()}원</p>
                    <p className="text-xs text-blue-500 mt-1">광고 인센티브: <b>{mgrData.adIncentive ? `${mgrData.adIncentive}만원` : "-"}</b></p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                    <p className="text-[10px] text-emerald-400 mb-1">팀 전체 분양회 매출</p>
                    <p className="text-lg font-black text-emerald-700">{mgrData.bhAmt.toLocaleString()}원</p>
                    <p className="text-xs text-emerald-500 mt-1">분양회 인센티브: <b>{mgrData.bhIncentive ? `${mgrData.bhIncentive}만원` : "-"}</b></p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                    <p className="text-[10px] text-amber-400 mb-1">합계 인센티브</p>
                    <p className="text-2xl font-black text-amber-600">{mgrData.totalIncentive ? `${mgrData.totalIncentive}만원` : "-"}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
