"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { Target, Save, Users, UserCircle, Truck, Lock, Calendar } from "lucide-react";

interface KpiRow {
  year: number; month: number; week: number;
  scope: "team"|"execution"|"operation";
  target_name: string;
  recruit_count: number; bunyanghoe_revenue: number; linked_revenue: number;
  special_revenue: number; wanpan_truck_count: number; ad_operation_revenue: number;
}

const EXEC_MEMBERS = ["조계현","이세호","기여운","최연전"];
const OPS_MEMBERS = ["김재영","최은정"];

const makeEmpty = (y: number, m: number, w: number, scope: KpiRow["scope"], name: string): KpiRow => ({
  year:y, month:m, week:w, scope, target_name:name,
  recruit_count:0, bunyanghoe_revenue:0, linked_revenue:0, special_revenue:0, wanpan_truck_count:0, ad_operation_revenue:0,
});

function MoneyInput({ value, onChange }: { value: number; onChange: (v:number)=>void }) {
  return (
    <div className="relative">
      <input type="text" inputMode="numeric" value={value?value.toLocaleString("ko-KR"):""}
        onChange={e=>{const r=e.target.value.replace(/[^0-9]/g,""); onChange(r?parseInt(r):0);}}
        placeholder="0" className="w-full px-3 py-2.5 pr-8 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-right"/>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">원</span>
    </div>
  );
}
function CountInput({ value, onChange, unit }: { value: number; onChange: (v:number)=>void; unit: string }) {
  return (
    <div className="relative">
      <input type="number" min={0} value={value||""} onChange={e=>onChange(parseInt(e.target.value)||0)}
        placeholder="0" className="w-full px-3 py-2.5 pr-10 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-right"/>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">{unit}</span>
    </div>
  );
}

function GoalSection({ title, color, borderColor, bgGradient, rows, members, scope, onUpdate }: {
  title: string; color: string; borderColor: string; bgGradient: string;
  rows: Record<string,KpiRow>; members: string[]; scope: string;
  onUpdate: (name: string, patch: Partial<KpiRow>) => void;
}) {
  const isTeam = scope === "team";
  const isOps = scope === "operation";
  return (
    <div className={`bg-white rounded-xl border ${borderColor} shadow-sm overflow-hidden`}>
      <div className={`${bgGradient} px-4 py-2.5 border-b ${borderColor} flex items-center gap-2`}>
        {isTeam ? <Users size={14} className={color}/> : <UserCircle size={14} className={color}/>}
        <h3 className={`text-sm font-bold ${color}`}>{title}</h3>
      </div>
      <div className="p-3 space-y-3">
        {members.map(name => {
          const row = rows[name] || {} as KpiRow;
          return (
            <div key={name} className={`${isTeam?"":"p-3 bg-slate-50 rounded-lg border border-slate-200"}`}>
              {!isTeam && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`w-5 h-5 rounded-full ${scope==="execution"?"bg-blue-500":"bg-emerald-500"} flex items-center justify-center`}>
                    <span className="text-white text-[10px] font-bold">{name[0]}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{name}</span>
                </div>
              )}
              <div className={`grid ${isOps?"grid-cols-1":"grid-cols-3"} gap-2`}>
                {!isOps && <>
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1.5">분양회 모집</label>
                    <CountInput value={row.recruit_count||0} onChange={v=>onUpdate(name,{recruit_count:v})} unit="명"/></div>
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1.5">분양회 매출(회비)</label>
                    <MoneyInput value={row.bunyanghoe_revenue||0} onChange={v=>onUpdate(name,{bunyanghoe_revenue:v})}/></div>
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1.5">{isTeam?"연계매출(하이타겟)":"연계매출"}</label>
                    <MoneyInput value={row.linked_revenue||0} onChange={v=>onUpdate(name,{linked_revenue:v})}/></div>
                  {isTeam && <div><label className="block text-xs font-semibold text-slate-500 mb-1.5">특전매출목표</label>
                    <MoneyInput value={row.special_revenue||0} onChange={v=>onUpdate(name,{special_revenue:v})}/></div>}
                  {isTeam && <div><label className="block text-xs font-semibold text-slate-500 mb-1.5">완판트럭</label>
                    <CountInput value={row.wanpan_truck_count||0} onChange={v=>onUpdate(name,{wanpan_truck_count:v})} unit="건"/></div>}
                </>}
                {isOps && <div><label className="block text-xs font-semibold text-slate-500 mb-1.5">광고특전운영매출</label>
                  <MoneyInput value={row.ad_operation_revenue||0} onChange={v=>onUpdate(name,{ad_operation_revenue:v})}/></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KpiSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [selWeek, setSelWeek] = useState(1);

  // 월간
  const [mTeam, setMTeam] = useState<Record<string,KpiRow>>({});
  const [mExec, setMExec] = useState<Record<string,KpiRow>>({});
  const [mOps, setMOps] = useState<Record<string,KpiRow>>({});
  // 주간
  const [wTeam, setWTeam] = useState<Record<string,KpiRow>>({});
  const [wExec, setWExec] = useState<Record<string,KpiRow>>({});
  const [wOps, setWOps] = useState<Record<string,KpiRow>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    const u = getCurrentUser(); setUser(u); setAuthChecked(true);
    if (!u || u.role !== "admin") setTimeout(()=>router.push("/"),1500);
  }, [router]);

  useEffect(() => { if (user?.role==="admin") loadData(); }, [year, month, selWeek, user]);

  const loadData = async () => {
    setLoading(true);
    // 월간 (week=0)
    const { data: mData } = await supabase.from("kpi_settings").select("*").eq("year",year).eq("month",month).eq("week",0);
    const mRows = (mData||[]) as KpiRow[];
    const mt: Record<string,KpiRow> = {}; mt["team"] = mRows.find(r=>r.scope==="team") || makeEmpty(year,month,0,"team","team");
    setMTeam(mt);
    const me: Record<string,KpiRow> = {}; EXEC_MEMBERS.forEach(n=>{ me[n] = mRows.find(r=>r.scope==="execution"&&r.target_name===n) || makeEmpty(year,month,0,"execution",n); });
    setMExec(me);
    const mo: Record<string,KpiRow> = {}; OPS_MEMBERS.forEach(n=>{ mo[n] = mRows.find(r=>r.scope==="operation"&&r.target_name===n) || makeEmpty(year,month,0,"operation",n); });
    setMOps(mo);

    // 주간
    const { data: wData } = await supabase.from("kpi_settings").select("*").eq("year",year).eq("month",month).eq("week",selWeek);
    const wRows = (wData||[]) as KpiRow[];
    const wt: Record<string,KpiRow> = {}; wt["team"] = wRows.find(r=>r.scope==="team") || makeEmpty(year,month,selWeek,"team","team");
    setWTeam(wt);
    const we: Record<string,KpiRow> = {}; EXEC_MEMBERS.forEach(n=>{ we[n] = wRows.find(r=>r.scope==="execution"&&r.target_name===n) || makeEmpty(year,month,selWeek,"execution",n); });
    setWExec(we);
    const wo: Record<string,KpiRow> = {}; OPS_MEMBERS.forEach(n=>{ wo[n] = wRows.find(r=>r.scope==="operation"&&r.target_name===n) || makeEmpty(year,month,selWeek,"operation",n); });
    setWOps(wo);

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const strip = (row: any, y: number, m: number, w: number, s: string, tn: string) => {
      const { id, ...rest } = row;
      return { ...rest, year:y, month:m, week:w, scope:s, target_name:tn };
    };
    const allRows: any[] = [
      // 월간
      strip(mTeam["team"], year, month, 0, "team", "team"),
      ...EXEC_MEMBERS.map(n=>strip(mExec[n], year, month, 0, "execution", n)),
      ...OPS_MEMBERS.map(n=>strip(mOps[n], year, month, 0, "operation", n)),
      // 주간
      strip(wTeam["team"], year, month, selWeek, "team", "team"),
      ...EXEC_MEMBERS.map(n=>strip(wExec[n], year, month, selWeek, "execution", n)),
      ...OPS_MEMBERS.map(n=>strip(wOps[n], year, month, selWeek, "operation", n)),
    ];
    const { error } = await supabase.from("kpi_settings").upsert(allRows, { onConflict: "year,month,week,scope,target_name" });
    setSaving(false);
    if (error) alert("저장 실패: "+error.message);
    else { setSavedAt(new Date().toLocaleTimeString("ko-KR")); setTimeout(()=>setSavedAt(""),3000); }
  };

  if (!authChecked) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;
  if (!user || user.role !== "admin") return <div className="flex flex-col items-center justify-center h-full text-slate-400"><Lock size={40} className="mb-3 opacity-40"/><p className="text-sm font-semibold">관리자만 접근 가능</p></div>;

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">🎯 KPI 설정</h1>
            <p className="text-xs text-slate-500 mt-0.5">월간 · 주간 목표 설정 ({year}년 {month}월)</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={year} onChange={e=>setYear(parseInt(e.target.value))} className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none">
              {[2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none">
              {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}
            </select>
            {savedAt && <span className="text-xs text-emerald-600 font-semibold">✓ {savedAt} 저장됨</span>}
            <button onClick={handleSave} disabled={saving||loading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-50">
              <Save size={14}/>{saving?"저장 중...":"전체 저장"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading ? <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div> : (
          <div className="grid grid-cols-2 gap-5">
            {/* ═══ 좌측: 월간 목표 ═══ */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-amber-500"/>
                  <h2 className="text-base font-black text-slate-800">월간 목표</h2>
                  <span className="text-xs text-slate-400">{year}년 {month}월</span>
                </div>
                <button onClick={()=>{
                  setMTeam({"team":makeEmpty(year,month,0,"team","team")});
                  const me: Record<string,KpiRow>={}; EXEC_MEMBERS.forEach(n=>{me[n]=makeEmpty(year,month,0,"execution",n);}); setMExec(me);
                  const mo: Record<string,KpiRow>={}; OPS_MEMBERS.forEach(n=>{mo[n]=makeEmpty(year,month,0,"operation",n);}); setMOps(mo);
                }} className="text-xs px-3 py-1.5 text-red-400 border border-red-200 rounded-lg hover:bg-red-50 font-semibold">↺ 초기화</button>
              </div>
              <GoalSection title="대협팀 전체" color="text-amber-700" borderColor="border-amber-100" bgGradient="bg-gradient-to-r from-amber-50 to-orange-50"
                rows={mTeam} members={["team"]} scope="team"
                onUpdate={(_,p)=>setMTeam({...mTeam, team:{...mTeam["team"],...p}})}/>
              <GoalSection title="실행파트 개인별" color="text-blue-700" borderColor="border-blue-100" bgGradient="bg-gradient-to-r from-blue-50 to-indigo-50"
                rows={mExec} members={EXEC_MEMBERS} scope="execution"
                onUpdate={(n,p)=>setMExec({...mExec,[n]:{...mExec[n],...p}})}/>
              <GoalSection title="운영파트 개인별" color="text-emerald-700" borderColor="border-emerald-100" bgGradient="bg-gradient-to-r from-emerald-50 to-teal-50"
                rows={mOps} members={OPS_MEMBERS} scope="operation"
                onUpdate={(n,p)=>setMOps({...mOps,[n]:{...mOps[n],...p}})}/>
            </div>

            {/* ═══ 우측: 주간 목표 ═══ */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-blue-500"/>
                  <h2 className="text-base font-black text-slate-800">주간 목표</h2>
                  <div className="flex gap-1 ml-1">
                  {[1,2,3,4,5].map(w=>(
                    <button key={w} onClick={()=>setSelWeek(w)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${selWeek===w?"bg-blue-600 text-white border-blue-600":"bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300"}`}>
                      {w}주차
                    </button>
                  ))}
                  </div>
                  <span className="text-xs text-blue-500 font-semibold ml-2">
                    {(()=>{
                      const ld = new Date(year,month,0).getDate();
                      const s = (selWeek-1)*7+1;
                      const e = Math.min(selWeek*7, ld);
                      return `${month}/${s}일 ~ ${month}/${e}일`;
                    })()}
                  </span>
                </div>
                <button onClick={()=>{
                  setWTeam({"team":makeEmpty(year,month,selWeek,"team","team")});
                  const we: Record<string,KpiRow>={}; EXEC_MEMBERS.forEach(n=>{we[n]=makeEmpty(year,month,selWeek,"execution",n);}); setWExec(we);
                  const wo: Record<string,KpiRow>={}; OPS_MEMBERS.forEach(n=>{wo[n]=makeEmpty(year,month,selWeek,"operation",n);}); setWOps(wo);
                }} className="text-xs px-3 py-1.5 text-red-400 border border-red-200 rounded-lg hover:bg-red-50 font-semibold">↺ 초기화</button>
              </div>
              <GoalSection title={`대협팀 전체 (${selWeek}주차)`} color="text-amber-700" borderColor="border-amber-100" bgGradient="bg-gradient-to-r from-amber-50 to-orange-50"
                rows={wTeam} members={["team"]} scope="team"
                onUpdate={(_,p)=>setWTeam({...wTeam, team:{...wTeam["team"],...p}})}/>
              <GoalSection title={`실행파트 (${selWeek}주차)`} color="text-blue-700" borderColor="border-blue-100" bgGradient="bg-gradient-to-r from-blue-50 to-indigo-50"
                rows={wExec} members={EXEC_MEMBERS} scope="execution"
                onUpdate={(n,p)=>setWExec({...wExec,[n]:{...wExec[n],...p}})}/>
              <GoalSection title={`운영파트 (${selWeek}주차)`} color="text-emerald-700" borderColor="border-emerald-100" bgGradient="bg-gradient-to-r from-emerald-50 to-teal-50"
                rows={wOps} members={OPS_MEMBERS} scope="operation"
                onUpdate={(n,p)=>setWOps({...wOps,[n]:{...wOps[n],...p}})}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
