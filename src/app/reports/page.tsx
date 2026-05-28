"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart3, TrendingUp, Users, Truck, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const EXEC = ["조계현","이세호","기여운","최연전"];
const CONSULTANTS = ["박경화","박혜은","조승현","박민경","백선중","강아름","전정훈","박나라"];
const HOG = ["호갱노노_채널톡","호갱노노_단지마커","호갱노노_기타"];

function fw(n: number) { return n >= 10000 ? `${(n/10000).toFixed(n%10000===0?0:1)}억원` : n > 0 ? `${(n/10000*10000/10000).toLocaleString()}만원` : "0원"; }
function fwFull(n: number) { return n ? n.toLocaleString()+"원" : "0원"; }
function pct(a: number, b: number) { return b > 0 ? Math.round(a/b*100) : 0; }

export default function ReportsPage() {
  const [month, setMonth] = useState(new Date().getMonth()+1);
  const [year] = useState(new Date().getFullYear());
  const [execs, setExecs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [wanpans, setWanpans] = useState<any[]>([]);
  const [prevExecs, setPrevExecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [month]);

  const loadData = async () => {
    setLoading(true);
    const ms = String(month).padStart(2,"0");
    const ld = new Date(year, month, 0).getDate();
    const mS = `${year}-${ms}-01`, mE = `${year}-${ms}-${ld}`;
    // 전월
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    const pms = String(pm).padStart(2,"0");
    const pld = new Date(py, pm, 0).getDate();
    const pmS = `${py}-${pms}-01`, pmE = `${py}-${pms}-${pld}`;

    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("ad_executions").select("*").gte("payment_date",mS).lte("payment_date",mE),
      supabase.from("contacts").select("*"),
      supabase.from("wanpan_trucks").select("*").gte("dispatch_date",mS).lte("dispatch_date",mE),
      supabase.from("ad_executions").select("*").gte("payment_date",pmS).lte("payment_date",pmE),
    ]);
    setExecs(r1.data||[]); setContacts(r2.data||[]); setWanpans(r3.data||[]); setPrevExecs(r4.data||[]);
    setLoading(false);
  };

  const eff = (e: any) => (e.vat_amount && e.vat_amount > 0 && e.vat_amount !== e.execution_amount) ? e.vat_amount : (e.execution_amount||0);
  const net = (e: any) => eff(e) - (e.refund_amount||0);

  // ═══ 월간 종합 ═══
  const summary = useMemo(() => {
    const totalRev = execs.reduce((s,e) => s + net(e), 0);
    const prevRev = prevExecs.reduce((s,e) => s + net(e), 0);
    const growth = prevRev > 0 ? Math.round((totalRev - prevRev) / prevRev * 100) : 0;
    const refundTotal = execs.reduce((s,e) => s + (e.refund_amount||0), 0);
    const refundRate = totalRev + refundTotal > 0 ? Math.round(refundTotal / (totalRev + refundTotal) * 100 * 10) / 10 : 0;

    // 매출구분별
    const byRoute: Record<string,number> = {};
    execs.forEach(e => { const r = e.contract_route||"기타"; byRoute[r] = (byRoute[r]||0) + net(e); });

    // 채널별
    const byCh: Record<string,number> = {};
    execs.forEach(e => { const ch = HOG.includes(e.channel) ? "호갱노노" : e.channel; byCh[ch] = (byCh[ch]||0) + net(e); });

    // 신규계약
    const ms = String(month).padStart(2,"0");
    const mS = `${year}-${ms}`;
    const newContracts = contacts.filter(c => c.contract_date?.startsWith(mS) || c.reservation_date?.startsWith(mS)).length;

    // 유입경로별
    const byIntake: Record<string,number> = {};
    contacts.filter(c => (c.contract_date?.startsWith(mS)||c.reservation_date?.startsWith(mS)) && c.intake_route)
      .forEach(c => { byIntake[c.intake_route] = (byIntake[c.intake_route]||0) + 1; });

    // 완판트럭
    const wpCount = wanpans.length;
    const wpOrg = wanpans.reduce((s,w) => s + (w.team_size||0), 0);

    // 전월 세부
    const prevNewContracts = (() => {
      const pms2 = String(month===1?12:month-1).padStart(2,"0");
      const pyr = month===1 ? year-1 : year;
      const pmS2 = `${pyr}-${pms2}`;
      return contacts.filter(c => c.contract_date?.startsWith(pmS2) || c.reservation_date?.startsWith(pmS2)).length;
    })();
    const prevRefund = prevExecs.reduce((s,e) => s + (e.refund_amount||0), 0);
    const prevRefundRate = prevRev + prevRefund > 0 ? Math.round(prevRefund / (prevRev + prevRefund) * 100 * 10) / 10 : 0;
    const prevWpCount = 0; // 전월 완판트럭은 별도 조회 필요

    const contractGrowth = prevNewContracts > 0 ? Math.round((newContracts - prevNewContracts) / prevNewContracts * 100) : 0;
    const refundDiff = refundRate - prevRefundRate;

    // 분양회 월회비 총매출
    const monthlyFeeTotal = execs.filter(e => e.channel === "분양회 월회비").reduce((s,e) => s + net(e), 0);
    const prevMonthlyFee = prevExecs.filter(e => e.channel === "분양회 월회비").reduce((s,e) => s + net(e), 0);
    const feeGrowth = prevMonthlyFee > 0 ? Math.round((monthlyFeeTotal - prevMonthlyFee) / prevMonthlyFee * 100) : 0;

    return { totalRev, prevRev, growth, refundTotal, refundRate, byRoute, byCh, newContracts, byIntake, wpCount, wpOrg,
      contractGrowth, refundDiff, prevRefundRate, monthlyFeeTotal, prevMonthlyFee, feeGrowth, prevNewContracts };
  }, [execs, prevExecs, contacts, wanpans, month, year]);

  // ═══ 개인별 성과 ═══
  const personalData = useMemo(() => {
    const ms = String(month).padStart(2,"0");
    const mS = `${year}-${ms}`;
    return EXEC.map(name => {
      const adAmt = execs.filter(e => e.team_member===name && e.channel==="하이타겟").reduce((s,e) => s+net(e), 0);
      const bhAmt = execs.filter(e => e.team_member===name && e.channel==="분양회 월회비").reduce((s,e) => s+net(e), 0);
      const totalAmt = adAmt + bhAmt;
      const myContacts = contacts.filter(c => c.assigned_to===name);
      const newContract = myContacts.filter(c => c.contract_date?.startsWith(mS)).length;
      const newReserv = myContacts.filter(c => c.reservation_date?.startsWith(mS)).length;
      const totalMeeting = myContacts.filter(c => ["계약완료","예약완료","미팅후가망관리","계약거부","미팅불발"].includes(c.meeting_result)).length;
      const converted = newContract + newReserv;
      const convRate = totalMeeting > 0 ? Math.round(converted / totalMeeting * 100) : 0;
      const wpTrips = wanpans.filter(w => { try { const m = JSON.parse(w.staff_members||"[]"); return m.includes(name); } catch { return false; } }).length;
      return { name, adAmt, bhAmt, totalAmt, newContract, newReserv, converted, convRate, wpTrips, totalMeeting };
    }).sort((a,b) => b.totalAmt - a.totalAmt);
  }, [execs, contacts, wanpans, month, year]);

  // ═══ 주차별 추이 ═══
  const weeklyData = useMemo(() => {
    const weeks: { label: string; start: number; end: number; rev: number; contracts: number; byPerson: Record<string,number> }[] = [];
    const ld = new Date(year, month, 0).getDate();
    for (let w = 0; w < 5; w++) {
      const s = w * 7 + 1, e = Math.min((w+1)*7, ld);
      if (s > ld) break;
      const ms = String(month).padStart(2,"0");
      const sD = `${year}-${ms}-${String(s).padStart(2,"0")}`;
      const eD = `${year}-${ms}-${String(e).padStart(2,"0")}`;
      const wExecs = execs.filter(ex => ex.payment_date >= sD && ex.payment_date <= eD);
      const rev = wExecs.reduce((sum,ex) => sum + net(ex), 0);
      const contracts = contacts.filter(c => (c.contract_date >= sD && c.contract_date <= eD) || (c.reservation_date >= sD && c.reservation_date <= eD)).length;
      const byPerson: Record<string,number> = {};
      EXEC.forEach(n => { byPerson[n] = wExecs.filter(ex => ex.team_member===n).reduce((sum,ex) => sum+net(ex), 0); });
      weeks.push({ label: `${w+1}주차`, start: s, end: e, rev, contracts, byPerson });
    }
    return weeks;
  }, [execs, contacts, month, year]);

  // 최대값 (바 차트 비율용)
  const maxChVal = Math.max(...Object.values(summary.byCh), 1);
  const maxWeekRev = Math.max(...weeklyData.map(w => w.rev), 1);
  const maxPersonTotal = Math.max(...personalData.map(p => p.totalAmt), 1);

  const ROUTE_COLORS: Record<string,string> = { "분양회":"bg-amber-400","완판트럭":"bg-emerald-400","대협팀활동":"bg-blue-400" };
  const CH_COLORS: Record<string,string> = { "하이타겟":"bg-indigo-400","분양회 입회비":"bg-amber-400","분양회 월회비":"bg-amber-300","호갱노노":"bg-teal-400","LMS":"bg-pink-400" };
  const PERSON_COLORS = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-rose-500"];

  if (loading) return <div className="flex items-center justify-center h-full bg-[#F1F5F9]"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">📈 팀 성과 분석</h1>
            <p className="text-xs text-slate-500 mt-0.5">{year}년 {month}월 · 실행파트 성과 종합</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={month} onChange={e=>setMonth(Number(e.target.value))}
              className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none">
              {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">

        {/* ═══ 월간 종합 카드 ═══ */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label:"총매출 (하이타겟+입회비+월회비+LMS+호갱노노)", value: fwFull(summary.totalRev), sub: `전월 ${fwFull(summary.prevRev)}`,
              badge: summary.growth, icon:"💰" },
            { label:"신규 계약+예약", value: `${summary.newContracts}건`, sub: `전월 ${summary.prevNewContracts}건`,
              badge: summary.contractGrowth, icon:"📝" },
            { label:"환불률", value: `${summary.refundRate}%`, sub: `환불 ${fwFull(summary.refundTotal)}`,
              badge: summary.refundDiff > 0 ? summary.refundDiff : -summary.refundDiff, icon:"↩️", invert: true },
            { label:"완판트럭 출장", value: `${summary.wpCount}회`, sub: `접촉 ${summary.wpOrg}개 조직`,
              badge: 0, icon:"🚚" },
            { label:"분양회 월회비 매출", value: fwFull(summary.monthlyFeeTotal), sub: `전월 ${fwFull(summary.prevMonthlyFee)}`,
              badge: summary.feeGrowth, icon:"💳" },
          ].map((c: any)=>{
            const g = c.badge;
            const inv = c.invert;
            const isUp = inv ? g < 0 : g > 0;
            const isDown = inv ? g > 0 : g < 0;
            const badgeText = g > 0 ? `+${typeof g==="number"&&g<1?g.toFixed(1):g}%` : g < 0 ? `${typeof g==="number"&&g>-1?g.toFixed(1):g}%` : "";
            const badgeColor = isUp ? "text-emerald-600 bg-emerald-50" : isDown ? "text-red-500 bg-red-50" : "";
            return (
            <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg">{c.icon}</span>
                {badgeText && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badgeColor}`}>{badgeText}</span>}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mb-1 leading-tight">{c.label}</p>
              <p className="text-xl font-black text-slate-800">{c.value}</p>
              <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
            </div>
            );
          })}
        </div>

        {/* ═══ 매출구분 + 채널별 ═══ */}
        <div className="grid grid-cols-2 gap-4">
          {/* 매출구분별 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm font-bold text-slate-700 mb-1">매출구분별 비중</p>
            <p className="text-[10px] text-slate-400 mb-3">전체 매출 합계: {fwFull(summary.totalRev)}</p>
            <div className="space-y-3">
              {Object.entries(summary.byRoute).sort((a,b)=>b[1]-a[1]).map(([route, amt])=>(
                <div key={route}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-600">{route}</span>
                    <span className="text-xs font-bold text-slate-800">{fwFull(amt)} <span className="text-slate-400">({pct(amt, summary.totalRev)}%)</span></span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ROUTE_COLORS[route]||"bg-slate-400"}`} style={{width:`${pct(amt, summary.totalRev)}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 채널별 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm font-bold text-slate-700 mb-4">광고채널별 매출</p>
            <div className="space-y-2.5">
              {Object.entries(summary.byCh).sort((a,b)=>b[1]-a[1]).map(([ch, amt])=>(
                <div key={ch} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 truncate font-medium">{ch}</span>
                  <div className="flex-1 h-5 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                    <div className={`h-full rounded-lg ${CH_COLORS[ch]||"bg-slate-300"}`} style={{width:`${Math.max(pct(amt, maxChVal),2)}%`}}/>
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-28 text-right">{fwFull(amt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ 유입경로별 계약 ═══ */}
        {Object.keys(summary.byIntake).length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm font-bold text-slate-700 mb-4">유입경로별 신규 계약</p>
            <div className="flex gap-3">
              {Object.entries(summary.byIntake).sort((a,b)=>b[1]-a[1]).map(([route, cnt])=>(
                <div key={route} className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 mb-1">{route}</p>
                  <p className="text-2xl font-black text-slate-800">{cnt}</p>
                  <p className="text-xs text-slate-400">건</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 개인별 성과 ═══ */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Users size={15} className="text-blue-500"/>개인별 성과</p>
          </div>

          {/* 개인 매출 바 차트 */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {personalData.map((p, idx) => (
              <div key={p.name} className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 ${PERSON_COLORS[idx%4]} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-xs font-black">{p.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">#{idx+1}</p>
                  </div>
                </div>
                {/* 매출 바 */}
                <div className="mb-3">
                  <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                    <div className={`h-full rounded-full ${PERSON_COLORS[idx%4]}`} style={{width:`${pct(p.totalAmt, maxPersonTotal)}%`, minWidth: p.totalAmt > 0 ? "4px" : "0"}}/>
                  </div>
                  <p className="text-right text-xs font-bold text-slate-700 mt-1">{fwFull(p.totalAmt)}</p>
                </div>
                {/* 상세 */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">하이타겟</span><span className="font-semibold text-indigo-600">{fwFull(p.adAmt)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">월회비</span><span className="font-semibold text-amber-600">{fwFull(p.bhAmt)}</span></div>
                  <div className="border-t border-slate-200 my-1"/>
                  <div className="flex justify-between"><span className="text-slate-400">계약</span><span className="font-bold text-emerald-600">{p.newContract}건</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">예약</span><span className="font-bold text-blue-600">{p.newReserv}건</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">미팅전환율</span><span className="font-bold text-slate-700">{p.convRate}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">완판트럭</span><span className="font-bold text-slate-700">{p.wpTrips}회</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* 상세 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {["순위","담당자","하이타겟 매출","월회비 매출","총매출","계약","예약","미팅전환율","완판출장"].map(h=>(
                    <th key={h} className="px-4 py-3 border border-slate-200 text-slate-500 font-semibold text-center text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personalData.map((p,idx)=>(
                  <tr key={p.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3 border border-slate-200 text-center font-black text-slate-400">{idx+1}</td>
                    <td className="px-4 py-3 border border-slate-200 text-center font-bold text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 border border-slate-200 text-center text-indigo-600 font-semibold">{fwFull(p.adAmt)}</td>
                    <td className="px-4 py-3 border border-slate-200 text-center text-amber-600 font-semibold">{fwFull(p.bhAmt)}</td>
                    <td className="px-4 py-3 border border-slate-200 text-center font-black text-slate-800">{fwFull(p.totalAmt)}</td>
                    <td className="px-4 py-3 border border-slate-200 text-center font-bold text-emerald-600">{p.newContract}건</td>
                    <td className="px-4 py-3 border border-slate-200 text-center font-bold text-blue-600">{p.newReserv}건</td>
                    <td className="px-4 py-3 border border-slate-200 text-center font-bold">{p.convRate}%</td>
                    <td className="px-4 py-3 border border-slate-200 text-center">{p.wpTrips}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ 주차별 추이 ═══ */}
        <div className="grid grid-cols-2 gap-4">
          {/* 주차별 매출 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2"><TrendingUp size={15} className="text-emerald-500"/>주차별 매출 추이</p>
            <p className="text-[10px] text-slate-400 mb-3">하이타겟 + 입회비 + 월회비 + LMS + 호갱노노 합산</p>
            <div className="space-y-3">
              {weeklyData.map(w=>(
                <div key={w.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500">{w.label} <span className="text-slate-300">({w.start}~{w.end}일)</span></span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 font-semibold">{w.contracts}건</span>
                      <span className="text-xs font-bold text-slate-700">{fwFull(w.rev)}</span>
                    </div>
                  </div>
                  <div className="w-full h-4 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                    <div className="h-full bg-blue-400 rounded-lg transition-all" style={{width:`${pct(w.rev, maxWeekRev)}%`, minWidth: w.rev > 0 ? "4px" : "0"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 주차별 × 개인별 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm font-bold text-slate-700 mb-1">주차별 개인 매출</p>
            <p className="text-[10px] text-slate-400 mb-3">담당자별 전체 채널 매출 합산 (환불 차감)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 border border-slate-200 text-slate-500 font-semibold text-center">주차</th>
                    {EXEC.map(n=><th key={n} className="px-3 py-2 border border-slate-200 text-slate-500 font-semibold text-center">{n}</th>)}
                    <th className="px-3 py-2 border border-slate-200 text-slate-500 font-semibold text-center">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.map(w=>(
                    <tr key={w.label} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 border border-slate-200 text-center font-semibold text-slate-600">{w.label}</td>
                      {EXEC.map(n=>{
                        const val = w.byPerson[n]||0;
                        const maxP = Math.max(...EXEC.map(nn=>w.byPerson[nn]||0), 1);
                        const intensity = val > 0 ? Math.max(Math.round(val/maxP*100), 20) : 0;
                        return <td key={n} className="px-3 py-2.5 border border-slate-200 text-center font-semibold" style={{background: val > 0 ? `rgba(59,130,246,${intensity/100*0.25})` : "transparent"}}>
                          {val > 0 ? fwFull(val) : <span className="text-slate-300">-</span>}
                        </td>;
                      })}
                      <td className="px-3 py-2.5 border border-slate-200 text-center font-bold text-slate-800">{fwFull(w.rev)}</td>
                    </tr>
                  ))}
                  {/* 합계 행 */}
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2.5 border border-slate-200 text-center font-bold text-slate-700">합계</td>
                    {EXEC.map(n=>{
                      const total = weeklyData.reduce((s,w)=>s+(w.byPerson[n]||0),0);
                      return <td key={n} className="px-3 py-2.5 border border-slate-200 text-center font-bold text-blue-600">{fwFull(total)}</td>;
                    })}
                    <td className="px-3 py-2.5 border border-slate-200 text-center font-black text-slate-800">{fwFull(weeklyData.reduce((s,w)=>s+w.rev,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═══ 컨설턴트별 실적 ═══ */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-700 mb-1">담당컨설턴트별 매출</p>
          <p className="text-[10px] text-slate-400 mb-3">전체 채널 합산 (하이타겟 + 입회비 + 월회비 + LMS + 호갱노노, 환불 차감)</p>
          <div className="grid grid-cols-4 gap-2">
            {CONSULTANTS.map(name => {
              const amt = execs.filter(e => e.consultant === name).reduce((s,e) => s + net(e), 0);
              const cnt = execs.filter(e => e.consultant === name).length;
              return (
                <div key={name} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">{name}</span>
                    <span className="text-xs text-slate-400">{cnt}건</span>
                  </div>
                  <p className="text-sm font-black text-blue-600">{fwFull(amt)}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
