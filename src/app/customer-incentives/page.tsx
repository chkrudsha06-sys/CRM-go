"use client";
import EmptyState from "@/components/EmptyState";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Award, CheckCircle, Clock, FileSpreadsheet, X, Copy, Check } from "lucide-react";
import * as XLSX from "xlsx";

const TIERS = [
  { min:100000000,label:"3구간",incentive:10000000,color:"bg-amber-400",text:"text-amber-700",bg:"bg-amber-50",border:"border-amber-200" },
  { min:70000000,label:"2구간",incentive:5000000,color:"bg-slate-300",text:"text-slate-700",bg:"bg-slate-50",border:"border-slate-200" },
  { min:50000000,label:"1구간",incentive:3000000,color:"bg-orange-300",text:"text-orange-700",bg:"bg-orange-50",border:"border-orange-200" },
];
const getTier=(amt:number)=>TIERS.find(t=>amt>=t.min)||null;
const fw=(n:number)=>n.toLocaleString();
const fDate=(d:string)=>d?new Date(d+"T00:00:00").toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\. /g,".").replace(/\.$/,""):"-";
function fmtBun(s:string|null){if(!s)return"-";const n=s.replace(/[^0-9]/g,"");return n?`B-${n}`:s;}
const AD_CHANNELS=["하이타겟","호갱노노_채널톡","호갱노노_단지마커","호갱노노_기타","LMS"];
const inp="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none focus:border-blue-400 text-center";

export default function CustomerIncentivesPage() {
  const [contacts,setContacts]=useState<any[]>([]);
  const [execs,setExecs]=useState<any[]>([]);
  const [payments,setPayments]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterPaid,setFilterPaid]=useState("");
  const [filterMonth,setFilterMonth]=useState("");
  const [filterAssigned,setFilterAssigned]=useState("");
  const [payInline,setPayInline]=useState<Record<string,{date:string;amt:string}>>({});
  const [copiedId,setCopiedId]=useState<string|null>(null);
  const [historyModal,setHistoryModal]=useState<any>(null);
  const today=new Date().toISOString().split("T")[0];

  useEffect(()=>{loadData();},[]);
  const loadData=async()=>{
    setLoading(true);
    const [r1,r2,r3]=await Promise.all([
      supabase.from("contacts").select("id,name,title,bunyanghoe_number,consultant,assigned_to,contract_date,bank_holder,bank_code,bank_name,bank_account").eq("meeting_result","계약완료").not("contract_date","is",null).order("contract_date",{ascending:true}),
      supabase.from("ad_executions").select("id,member_name,bunyanghoe_number,execution_amount,channel,payment_date").in("channel",AD_CHANNELS),
      supabase.from("incentive_payments").select("*").order("created_at",{ascending:false}),
    ]);
    setContacts(r1.data||[]);setExecs(r2.data||[]);setPayments(r3.data||[]);setLoading(false);
  };

  const customerData=useMemo(()=>{
    return contacts.map(c=>{
      const cDate=new Date(c.contract_date+"T00:00:00");
      const now=new Date();
      const quarters:any[]=[];
      let qNum=1;let qStart=new Date(cDate);
      while(qStart<now){
        const qEnd=new Date(qStart);qEnd.setDate(qEnd.getDate()+89);
        const sStr=qStart.toISOString().split("T")[0];
        const eStr=qEnd.toISOString().split("T")[0];
        // 1기만 올해 시작 기준으로 전체 매출 반영
        const adStartDate=qNum===1?"2026-01-01":sStr;
        const adTotal=execs.filter(e=>(e.member_name===c.name||e.bunyanghoe_number===c.bunyanghoe_number)&&e.payment_date>=adStartDate&&e.payment_date<=eStr).reduce((s:number,e:any)=>s+(e.execution_amount||0),0);
        const tier=getTier(adTotal);
        const isEnded=qEnd<now;
        const paidRecords=payments.filter((p:any)=>p.contact_id===c.id&&p.quarter_num===qNum&&p.is_paid);
        const totalPaid=paidRecords.reduce((s:number,p:any)=>s+(p.incentive_amount||0),0);
        const incentiveAmt=tier?.incentive||0;
        const remaining=incentiveAmt-totalPaid;
        // 이전 기수 이월금액 계산
        const prevQ = quarters.length > 0 ? quarters[quarters.length-1] : null;
        const carryOver = prevQ ? Math.max(prevQ.incentiveAmt - prevQ.totalPaid, 0) : 0;
        // 지급예정월: 분기 종료 익월
        const payMonth = new Date(qEnd); payMonth.setMonth(payMonth.getMonth()+1);
        const payDueLabel = `${payMonth.getFullYear()}.${String(payMonth.getMonth()+1).padStart(2,"0")}`;
        quarters.push({qNum,start:qStart,end:qEnd,sStr,eStr,adTotal,tier,isEnded,paidRecords,totalPaid,incentiveAmt,remaining,carryOver,payDueLabel});
        qStart=new Date(qEnd);qStart.setDate(qStart.getDate()+1);qNum++;
      }
      return {...c,quarters};
    });
  },[contacts,execs,payments]);

  const allRows=useMemo(()=>{
    const rows:any[]=[];
    customerData.forEach(c=>c.quarters.forEach((q:any)=>{
      if(search.trim()){const s=search.trim().toLowerCase();if(!c.name.includes(s)&&!fmtBun(c.bunyanghoe_number).toLowerCase().includes(s)&&!(c.assigned_to||"").includes(s))return;}
      if(filterPaid==="paid"&&q.totalPaid<=0)return;
      if(filterPaid==="unpaid"&&(q.totalPaid>0||!q.tier))return;
      if(filterAssigned&&c.assigned_to!==filterAssigned)return;
      if(filterMonth){
        const qStartM=q.sStr.substring(0,7);
        const qEndM=q.eStr.substring(0,7);
        if(filterMonth<qStartM||filterMonth>qEndM)return;
      }
      rows.push({...q,contact:c});
    }));
    return rows;
  },[customerData,search,filterPaid,filterMonth,filterAssigned]);

  // 월 옵션 생성
  const monthOptions=useMemo(()=>{
    const months=new Set<string>();
    customerData.forEach(c=>c.quarters.forEach((q:any)=>{
      const s=new Date(q.sStr+"T00:00:00"); const e=new Date(q.eStr+"T00:00:00");
      let cur=new Date(s.getFullYear(),s.getMonth(),1);
      while(cur<=e){ months.add(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`); cur.setMonth(cur.getMonth()+1); }
    }));
    return Array.from(months).sort().reverse();
  },[customerData]);

  // 담당자 목록
  const assignedList=useMemo(()=>{
    return Array.from(new Set(contacts.map(c=>c.assigned_to).filter(Boolean))).sort();
  },[contacts]);

  const summary=useMemo(()=>{
    let total=0,t1=0,t2=0,t3=0,paid=0,unpaid=0,paidAmt=0;
    customerData.forEach(c=>c.quarters.forEach((q:any)=>{
      if(!q.tier)return;total++;
      if(q.tier.label==="1구간")t1++;if(q.tier.label==="2구간")t2++;if(q.tier.label==="3구간")t3++;
      if(q.totalPaid>0){paid++;paidAmt+=q.totalPaid;}else unpaid++;
    }));
    return {total,t1,t2,t3,paid,unpaid,paidAmt};
  },[customerData]);

  const handlePaySave=async(c:any,q:any)=>{
    const key=`${c.id}-${q.qNum}`;
    const pi=payInline[key];if(!pi)return;
    const amt=Number((pi.amt||"0").replace(/,/g,""))||0;
    if(amt<=0){alert("지급금액을 입력하세요");return;}
    const payload={contact_id:c.id,quarter_num:q.qNum,incentive_amount:amt,is_paid:true,paid_date:pi.date};
    console.log("인센티브 지급 payload:", payload);
    const {data,error}=await supabase.from("incentive_payments").insert(payload).select();
    console.log("인센티브 지급 결과:", {data,error});
    if(error){
      alert("지급 저장 실패:\n"+error.message+"\n\n코드: "+(error.code||"-")+"\n상세: "+(error.details||"-")+"\n힌트: "+(error.hint||"-"));
      return;
    }
    alert("지급 완료: "+amt.toLocaleString()+"원");
    setPayInline(p=>{const n={...p};delete n[key];return n;});
    loadData();
  };

  const handleDelete=async(payId:number)=>{
    if(!confirm("지급내역을 삭제하시겠습니까?"))return;
    await supabase.from("incentive_payments").delete().eq("id",payId);
    loadData();
  };

  const downloadDataXLS=()=>{
    const rows:any[]=[];
    customerData.forEach(c=>c.quarters.forEach((q:any)=>{
      rows.push({"넘버링":fmtBun(c.bunyanghoe_number),"고객명":c.name,"직급":c.title||"","대협팀":c.assigned_to||"","컨설턴트":c.consultant||"","분기":`${q.qNum}기`,"기간시작":q.sStr,"기간종료":q.eStr,"누적광고비":q.adTotal,"구간":q.tier?.label||"미달","인센티브":q.incentiveAmt,"지급완료액":q.totalPaid,"잔액":q.remaining});
    }));
    const ws=XLSX.utils.json_to_sheet(rows);
    const range=XLSX.utils.decode_range(ws["!ref"]||"A1");
    for(let R=range.s.r+1;R<=range.e.r;R++){for(const C of [8,10,11]){const addr=XLSX.utils.encode_cell({r:R,c:C});if(ws[addr]&&typeof ws[addr].v==="number")ws[addr].z="#,##0";}}
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"인센티브데이터");XLSX.writeFile(wb,"인센티브_데이터.xls");
  };

  const downloadPaymentXLS=()=>{
    const rows:any[][]=[];
    customerData.forEach(c=>c.quarters.forEach((q:any)=>{
      q.paidRecords.forEach((p:any)=>{
        const pMonth=p.paid_date?new Date(p.paid_date+"T00:00:00").getMonth()+1:0;rows.push([c.bank_code||"",c.bank_account||"",c.bank_holder||c.name,p.incentive_amount||0,`${pMonth}월프리이화원`,"(주)광고인"]);
      });
    }));
    const ws=XLSX.utils.aoa_to_sheet(rows);
    const range=XLSX.utils.decode_range(ws["!ref"]||"A1");
    for(let R=range.s.r;R<=range.e.r;R++){const addr=XLSX.utils.encode_cell({r:R,c:3});if(ws[addr]&&typeof ws[addr].v==="number")ws[addr].z="#,##0";}
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"입력정보");XLSX.writeFile(wb,"인센티브_지급정보.xls");
  };

  if(loading)return<div className="flex items-center justify-center h-full bg-[#F1F5F9]"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">🏆 인센티브 관리</h1>
            <p className="text-xs text-slate-500 mt-0.5">계약완료 고객 · 90일 누적 광고비 구간별 인센티브 (집행금액 기준)</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        {/* 요약 */}
        <div className="grid grid-cols-7 gap-3">
          {[{label:"인센티브 대상",value:`${summary.total}건`,color:"text-slate-700",bg:"bg-white"},{label:"1구간 (300만)",value:`${summary.t1}건`,color:"text-orange-600",bg:"bg-orange-50"},{label:"2구간 (500만)",value:`${summary.t2}건`,color:"text-slate-600",bg:"bg-slate-100"},{label:"3구간 (1,000만)",value:`${summary.t3}건`,color:"text-amber-600",bg:"bg-amber-50"},{label:"지급완료",value:`${summary.paid}건`,color:"text-emerald-600",bg:"bg-emerald-50"},{label:"지급금액",value:`${fw(summary.paidAmt)}원`,color:"text-blue-600",bg:"bg-blue-50"},{label:"미지급",value:`${summary.unpaid}건`,color:"text-red-500",bg:"bg-red-50"}].map(c=>(
            <div key={c.label} className={`${c.bg} rounded-xl border border-slate-100 shadow-sm p-3`}>
              <p className="text-[10px] text-slate-400 font-semibold mb-1">{c.label}</p>
              <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* 구간 안내 */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">구간별 인센티브 <span className="text-xs text-slate-400 font-normal ml-2">계약일 기준 90일 · 하이타겟+호갱노노+LMS 집행금액</span></p>
          <div className="grid grid-cols-3 gap-3">
            {[{label:"1구간",range:"5,000만 ~ 7,000만 미만",amt:"300만원",grad:"from-orange-100 to-orange-50",border:"border-orange-200",badge:"bg-orange-400"},{label:"2구간",range:"7,000만 ~ 1억 미만",amt:"500만원",grad:"from-slate-100 to-slate-50",border:"border-slate-200",badge:"bg-slate-400"},{label:"3구간",range:"1억 이상",amt:"1,000만원",grad:"from-amber-100 to-amber-50",border:"border-amber-200",badge:"bg-amber-400"}].map(t=>(
              <div key={t.label} className={`bg-gradient-to-br ${t.grad} rounded-xl border ${t.border} p-4 text-center`}>
                <span className={`text-xs px-2 py-0.5 ${t.badge} text-white rounded-full font-bold`}>{t.label}</span>
                <p className="text-sm font-semibold text-slate-700 mt-3">{t.range}</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{t.amt}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 검색+필터+다운로드 (테이블 바로 위) */}
        <div className="flex items-center gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="넘버링, 고객명..."
            className="pl-3 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl w-44 outline-none focus:border-blue-400"/>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <option value="">전체 월</option>
            {monthOptions.map(m=><option key={m} value={m}>{m.replace("-","년 ")}월</option>)}
          </select>
          <select value={filterAssigned} onChange={e=>setFilterAssigned(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <option value="">전체 담당자</option>
            {assignedList.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterPaid} onChange={e=>setFilterPaid(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <option value="">지급여부</option><option value="unpaid">미지급</option><option value="paid">지급완료</option>
          </select>
          <button onClick={()=>{setSearch("");setFilterPaid("");setFilterMonth("");setFilterAssigned("");}}
            className={`text-xs px-2.5 py-2 font-semibold rounded-xl whitespace-nowrap transition-colors ${(search||filterPaid||filterMonth||filterAssigned)?"bg-red-500 text-white border border-red-500":"text-red-400 border border-red-200 hover:bg-red-50"}`}>↺ 초기화</button>
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={downloadDataXLS} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100"><FileSpreadsheet size={13}/>데이터다운(XLS)</button>
            <button onClick={downloadPaymentXLS} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100"><FileSpreadsheet size={13}/>지급정보(XLS)</button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-auto" style={{maxHeight:"calc(100vh - 460px)"}}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
              <tr>
                {["넘버링","고객명","직급","계약일","분기","기간","잔여기간","누적 광고비","진행률","구간","인센티브","이월금액","지급예정월","지급처리","지급추전액(이월)","지급내역"].map(h=>(
                  <th key={h} className="text-center px-2 py-2.5 text-slate-500 text-xs font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((r:any,i:number)=>{
                const c=r.contact;
                const key=`${c.id}-${r.qNum}`;
                const pI=payInline[key];
                const pct=Math.min(Math.round(r.adTotal/50000000*100),100);
                return (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-3 text-center"><span className="text-sm font-black text-amber-600">{fmtBun(c.bunyanghoe_number)}</span></td>
                    <td className="px-2 py-3 text-center font-bold text-slate-800">{c.name}</td>
                    <td className="px-2 py-3 text-center text-slate-500 text-xs">{c.title||"-"}</td>
                    <td className="px-2 py-3 text-center text-slate-600 text-xs">{fDate(c.contract_date)}</td>
                    <td className="px-2 py-3 text-center"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold border border-blue-100">{r.qNum}기</span></td>
                    <td className="px-2 py-3 text-center text-xs text-slate-500 whitespace-nowrap">{fDate(r.sStr)}~{fDate(r.eStr)}</td>
                    <td className="px-2 py-3 text-center">
                      {(()=>{
                        const endDate=new Date(r.eStr+"T00:00:00");
                        const now=new Date(); now.setHours(0,0,0,0);
                        const diff=Math.ceil((endDate.getTime()-now.getTime())/(1000*60*60*24));
                        if(diff<0) return <span className="text-xs text-slate-300">종료</span>;
                        if(diff<=7) return <span className="text-xs font-bold text-red-500">D-{diff}</span>;
                        if(diff<=30) return <span className="text-xs font-bold text-amber-500">D-{diff}</span>;
                        return <span className="text-xs font-semibold text-blue-500">D-{diff}</span>;
                      })()}
                    </td>
                    <td className="px-2 py-3 text-center font-bold text-slate-800 text-xs">{fw(r.adTotal)}원</td>
                    <td className="px-2 py-3 text-center" style={{minWidth:70}}>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r.tier?r.tier.color:r.adTotal>0?"bg-blue-300":"bg-slate-200"}`} style={{width:`${Math.max(pct,2)}%`}}/>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      {r.tier?<span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.tier.bg} ${r.tier.text} border ${r.tier.border}`}>{r.tier.label}</span>:<span className="text-xs text-slate-300">미달</span>}
                    </td>
                    <td className="px-2 py-3 text-center font-black text-slate-800 text-xs">{r.tier?`${fw(r.incentiveAmt)}원`:"-"}</td>

                    {/* 이월금액 */}
                    <td className="px-2 py-3 text-center">
                      {r.carryOver > 0 ? (
                        <span className="text-xs font-bold text-amber-500">{fw(r.carryOver)}원</span>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>

                    {/* 지급예정월 */}
                    <td className="px-2 py-3 text-center">
                      <span className="text-xs font-semibold text-slate-600">{r.payDueLabel}</span>
                    </td>

                    {/* 지급처리 인라인 */}
                    <td className="px-2 py-3 text-center">
                      {r.tier ? (
                        pI ? (
                          <div className="flex flex-col gap-1 min-w-[130px]">
                            <input type="date" value={pI.date} onChange={e=>setPayInline(p=>({...p,[key]:{...p[key],date:e.target.value}}))} className={inp}/>
                            <input value={pI.amt} placeholder="지급금액" onChange={e=>setPayInline(p=>({...p,[key]:{...p[key],amt:e.target.value.replace(/[^0-9]/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",")}}))} className={inp}/>
                            {(c.bank_holder||c.bank_account)&&(
                              <div className="bg-slate-50 rounded px-2 py-1 border border-slate-200 text-[10px] text-slate-500 text-center">
                                {c.bank_holder&&<p>예금주: <span className="font-semibold text-slate-700">{c.bank_holder}</span></p>}
                                {c.bank_name&&<p>은행: <span className="font-semibold text-slate-700">{c.bank_name}</span></p>}
                                {c.bank_account&&(
                                  <div className="flex items-center justify-center gap-1">
                                    <p>계좌: <span className="font-semibold text-slate-700">{c.bank_account}</span></p>
                                    <button onClick={()=>{navigator.clipboard.writeText(c.bank_account||"");setCopiedId(key);setTimeout(()=>setCopiedId(null),1500);}}
                                      className={`p-0.5 rounded ${copiedId===key?"text-emerald-500":"text-slate-400 hover:text-blue-500"}`}>
                                      {copiedId===key?<Check size={10}/>:<Copy size={10}/>}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex gap-1">
                              <button onClick={()=>handlePaySave(c,r)} className="flex-1 py-1 text-xs bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">지급확정</button>
                              <button onClick={()=>setPayInline(p=>{const n={...p};delete n[key];return n;})} className="px-2 py-1 text-xs bg-slate-100 text-slate-500 rounded">✕</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={()=>setPayInline(p=>({...p,[key]:{date:today,amt:r.remaining>0?fw(r.remaining):""}}))}
                            className={`text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap ${r.totalPaid>0?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-[#1E3A8A] text-white hover:bg-blue-800"}`}>
                            {r.totalPaid>0?"추가지급":"지급처리"}
                          </button>
                        )
                      ) : r.tier ? (
                        <span className="text-xs text-slate-400">진행중</span>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>

                    {/* 지급추전액(이월) */}
                    <td className="px-2 py-3 text-center">
                      {r.tier ? (()=>{
                        const remain=r.remaining;
                        if(pI){const inputAmt=Number((pI.amt||"0").replace(/,/g,""))||0;const nr=r.incentiveAmt-r.totalPaid-inputAmt;
                          return <span className={`text-xs font-bold ${nr>0?"text-amber-500":nr===0?"text-slate-400":"text-red-400"}`}>{fw(nr)}원</span>;}
                        return (<div className="flex flex-col items-center">
                          <span className={`text-xs font-bold ${remain>0?"text-amber-500":"text-slate-400"}`}>{fw(remain)}원</span>
                          {remain>0&&<span className="text-[9px] text-sky-500 font-medium mt-0.5">→다음분기이월</span>}
                        </div>);
                      })() : <span className="text-xs text-slate-300">-</span>}
                    </td>

                    {/* 지급내역 */}
                    <td className="px-2 py-3 text-center">
                      {r.paidRecords.length>0 ? (
                        <button onClick={()=>setHistoryModal({contact:c,quarter:r})}
                          className="text-xs px-2 py-1 bg-emerald-50 text-emerald-600 rounded border border-emerald-200 hover:bg-emerald-100">
                          {r.paidRecords.length}건
                        </button>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 지급내역 모달 */}
      {historyModal&&(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={()=>setHistoryModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">지급내역 — {historyModal.contact.name} ({historyModal.quarter.qNum}기)</h2>
              <button onClick={()=>setHistoryModal(null)}><X size={18} className="text-slate-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {historyModal.quarter.paidRecords.length===0
                ? <p className="text-center py-8 text-slate-300 text-sm">지급 내역이 없습니다</p>
                : historyModal.quarter.paidRecords.map((p:any)=>(
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-sm font-medium text-slate-600">{fDate(p.paid_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600">{fw(p.incentive_amount)}원</span>
                      <button onClick={()=>{handleDelete(p.id);setHistoryModal(null);}} className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50">삭제</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
