"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Contact { id:number; name:string; title:string; bunyanghoe_number:string; consultant:string; assigned_to:string; contract_date:string; photo_url:string; phone:string; }
interface ExecRow { id:number; member_name:string; bunyanghoe_number:string; hightarget_mileage:number; hightarget_reward:number; hogaengnono_reward:number; lms_reward:number; payment_date:string; channel:string; execution_amount:number; vat_amount:number; contract_route:string; }
interface MileUsage { id:number; contact_id:number; usage_date:string; usage_amount:number; }
interface RewardPayment { id:number; contact_id:number; member_name:string; quarter:string; paid_amount:number; paid_date:string|null; is_paid:boolean; }

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const CONSULTANT_INFO: Record<string,{title:string;phone:string}> = {"박경화":{title:"총괄본부장",phone:"010-7602-2564"},"박혜은":{title:"총괄본부장",phone:"010-7584-2564"},"박민경":{title:"본부장",phone:"010-2242-2564"},"조승현":{title:"본부장",phone:"010-7546-2564"},"백선중":{title:"팀장",phone:"010-7538-2564"},"강아름":{title:"팀장",phone:"010-8144-2564"},"전정훈":{title:"팀장",phone:"010-8449-2564"},"박나라":{title:"팀장",phone:"010-5817-2568"}};
const TEAM_INFO: Record<string,{title:string;phone:string}> = {"조계현":{title:"부장",phone:"010-3964-2564"},"이세호":{title:"과장",phone:"010-8336-2564"},"기여운":{title:"과장",phone:"010-6718-3301"},"최연전":{title:"과장",phone:"010-7760-2560"}};

const fw=(n:number)=>n.toLocaleString();
const fDate=(d:string)=>{if(!d)return"-";const dt=new Date(d+"T00:00:00");return`${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;};
const getDays=(d:string)=>{if(!d)return 0;const s=new Date(d+'T00:00:00');const n=new Date();n.setHours(0,0,0,0);return Math.floor((n.getTime()-s.getTime())/(1000*60*60*24))+1;};
const AD_CHS=["하이타겟","호갱노노_채널톡","호갱노노_단지마커","호갱노노_기타","LMS"];

function WeatherWidget({size="sm"}:{size?:"sm"|"lg"}) {
  const [weather,setWeather]=useState<any>(null);
  useEffect(()=>{
    const cities=[{name:"서울",lat:37.5665,lon:126.978},{name:"부산",lat:35.1796,lon:129.0756},{name:"대구",lat:35.8714,lon:128.6014},{name:"광주",lat:35.1595,lon:126.8526},{name:"대전",lat:36.3504,lon:127.3845},{name:"인천",lat:37.4563,lon:126.7052}];
    Promise.all(cities.map(async c=>{const res=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&timezone=Asia/Seoul`);const d=await res.json();return{name:c.name,temp:Math.round(d.current?.temperature_2m||0),code:d.current?.weather_code||0};})).then(setWeather).catch(()=>{});
  },[]);
  const getIcon=(code:number)=>code===0?"☀️":code<=3?"⛅":code<=48?"🌫️":code<=67?"🌧️":code<=77?"🌨️":code<=82?"🌧️":code<=86?"❄️":"⛈️";
  if(!weather) return null;
  const fs=size==="lg";
  return (
    <div style={{padding:fs?"18px 20px":"14px",background:"#f8fafc",borderRadius:fs?14:12,border:"1px solid #f1f1f1"}}>
      <p style={{fontSize:fs?15:12,fontWeight:700,color:"#64748b",marginBottom:fs?14:10}}>🌤️ 오늘의 전국날씨</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:fs?8:6}}>
        {weather.map((w:any)=>(<div key={w.name} style={{textAlign:"center",padding:fs?"10px 6px":"6px 4px",background:"#fff",borderRadius:fs?10:8,border:"1px solid #f1f1f1"}}>
          <span style={{fontSize:fs?20:16}}>{getIcon(w.code)}</span>
          <p style={{fontSize:fs?13:11,fontWeight:600,color:"#333",marginTop:2}}>{w.name}</p>
          <p style={{fontSize:fs?16:13,fontWeight:700,color:"#1e293b"}}>{w.temp}°</p>
        </div>))}
      </div>
    </div>
  );
}

const GUIDE_CATS=[
  {id:"start",emoji:"🚀",title:"분양회 시작하기",desc:"입회 자격, 프로세스, 회비 안내",color:"#FF6B35"},
  {id:"ad",emoji:"📢",title:"광고 특전 이용하기",desc:"하이타겟, LMS, 호갱노노, 리워드",color:"#2962FF"},
  {id:"pr",emoji:"⭐",title:"홍보 특전 이용하기",desc:"PR패키지, 매거진, 앱 노출",color:"#7C3AED"},
  {id:"network",emoji:"🤝",title:"네트워킹 특전",desc:"컨퍼런스, 세미나, 전용 네트워크",color:"#059669"},
  {id:"reward",emoji:"💰",title:"리워드 및 정산 안내",desc:"리워드 비율, 정산주기, 인센티브",color:"#D97706"},
  {id:"app",emoji:"📱",title:"분양의신 앱 이용",desc:"앱 기능 가이드",color:"#475569"},
];

export default function CustomerDashboard() {
  const {code}=useParams();
  const [contact,setContact]=useState<Contact|null>(null);
  const [execs,setExecs]=useState<ExecRow[]>([]);
  const [usages,setUsages]=useState<MileUsage[]>([]);
  const [rewardPayments,setRewardPayments]=useState<RewardPayment[]>([]);
  const [loading,setLoading]=useState(true);
  const [notFound,setNotFound]=useState(false);
  const [tab,setTab]=useState("전체");
  const [guideOpen,setGuideOpen]=useState(false);
  const [helpPopup,setHelpPopup]=useState<string|null>(null);
  const [guideSection,setGuideSection]=useState("");
  const [sitesList,setSitesList]=useState<any[]>([]);
  const [pushEnabled,setPushEnabled]=useState(false);
  const [pushLoading,setPushLoading]=useState(false);

  // 푸시 알림 구독 상태 확인
  useEffect(()=>{
    if(!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration("/sw-push.js").then(reg=>{
      if(reg) reg.pushManager.getSubscription().then(sub=>{ if(sub) setPushEnabled(true); });
    });
  },[]);

  const togglePush = async () => {
    if (!contact) return;
    // 카카오톡 인앱 브라우저 감지
    const ua = navigator.userAgent || "";
    if (ua.includes("KAKAOTALK") || ua.includes("NAVER") || ua.includes("FBAN") || ua.includes("Line")) {
      alert("카카오톡(인앱 브라우저)에서는 알림을 설정할 수 없습니다.\n\n아래 방법으로 설정해주세요:\n① 우측 상단 ⋮ 메뉴 클릭\n② '다른 브라우저로 열기' 선택\n③ 삼성 인터넷 또는 Chrome에서 알림 설정");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("이 브라우저는 푸시 알림을 지원하지 않습니다.\niPhone의 경우 홈 화면에 추가 후 이용해주세요.");
      return;
    }
    if (!("Notification" in window)) {
      alert("이 브라우저는 알림 기능을 지원하지 않습니다.");
      return;
    }
    setPushLoading(true);
    try {
      if (pushEnabled) {
        const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
        if (reg) { const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); }
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id }) });
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { alert("알림 권한이 거부되었습니다.\n브라우저 설정에서 알림을 허용해주세요."); setPushLoading(false); return; }
        const reg = await navigator.serviceWorker.register("/sw-push.js");
        await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) { alert("푸시 알림 설정이 아직 완료되지 않았습니다.\n관리자에게 문의해주세요."); setPushLoading(false); return; }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
        await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id, subscription: sub.toJSON() }) });
        setPushEnabled(true);
      }
    } catch (e: any) {
      alert("알림 설정 중 오류가 발생했습니다.\n" + (e?.message || ""));
    }
    setPushLoading(false);
  };

  useEffect(()=>{(async()=>{const{data}=await supabase.from("new_sites").select("id,site_name,property_type,unit_count,rt_fee,business_address,staff_start_date,grand_open_date,created_at").order("created_at",{ascending:false}).limit(10);setSitesList(data||[]);})();},[]);

  useEffect(()=>{if(!code)return;(async()=>{setLoading(true);const{data:c}=await supabase.from("contacts").select("id,name,title,bunyanghoe_number,consultant,assigned_to,contract_date,photo_url,phone").eq("dashboard_code",code).maybeSingle();if(!c){setNotFound(true);setLoading(false);return;}setContact(c as Contact);const[r1,r2,r3]=await Promise.all([supabase.from("ad_executions").select("id,member_name,bunyanghoe_number,hightarget_mileage,hightarget_reward,hogaengnono_reward,lms_reward,payment_date,channel,execution_amount,vat_amount,contract_route").or(`member_name.eq.${c.name},bunyanghoe_number.eq.${c.bunyanghoe_number}`).order("payment_date",{ascending:false}),supabase.from("mileage_usages").select("*").eq("contact_id",c.id).order("usage_date",{ascending:false}),supabase.from("rewards").select("id,contact_id,member_name,quarter,paid_amount,paid_date,is_paid").or(`contact_id.eq.${c.id},member_name.eq.${c.name}`).eq("is_paid",true).order("paid_date",{ascending:false})]);setExecs((r1.data||[]) as ExecRow[]);setUsages((r2.data||[]) as MileUsage[]);setRewardPayments((r3.data||[]) as RewardPayment[]);setLoading(false);})();
  },[code]);

  const stats=useMemo(()=>{const totalMileage=execs.reduce((s,e)=>s+(e.hightarget_mileage||0),0);const htReward=execs.reduce((s,e)=>s+(e.hightarget_reward||0),0);const hogReward=execs.reduce((s,e)=>s+(e.hogaengnono_reward||0),0);const lmsReward=execs.reduce((s,e)=>s+(e.lms_reward||0),0);const totalReward=htReward+hogReward+lmsReward;const totalUsed=usages.reduce((s,u)=>s+(u.usage_amount||0),0);const totalPaid=rewardPayments.reduce((s,p)=>s+(p.paid_amount||0),0);return{totalMileage,htReward,hogReward,lmsReward,totalReward,totalUsed,totalPaid,remainMileage:totalMileage-totalUsed};},[execs,usages,rewardPayments]);

  const incData=useMemo(()=>{if(!contact?.contract_date)return null;const cDate=new Date(contact.contract_date+"T00:00:00");const now=new Date();let qNum=1;let qStart=new Date(cDate);let cur=null;while(qStart<now){const qEnd=new Date(qStart);qEnd.setDate(qEnd.getDate()+89);const sStr=qStart.toISOString().split("T")[0];const eStr=qEnd.toISOString().split("T")[0];const adStartDate=qNum===1?"2026-01-01":sStr;const adT=execs.filter(e=>AD_CHS.includes(e.channel)&&e.payment_date>=adStartDate&&e.payment_date<=eStr).reduce((s,e)=>s+(e.execution_amount||0),0);const diff=Math.ceil((qEnd.getTime()-now.getTime())/(1000*60*60*24));cur={qNum,sStr,eStr,adTotal:adT,daysLeft:diff<0?0:diff};qStart=new Date(qEnd);qStart.setDate(qStart.getDate()+1);qNum++;}return cur;},[contact,execs]);
  const incTier=incData?(incData.adTotal>=100000000?{label:"3구간",amt:10000000}:incData.adTotal>=70000000?{label:"2구간",amt:5000000}:incData.adTotal>=50000000?{label:"1구간",amt:3000000}:null):null;
  const incNext=incData?(incData.adTotal<50000000?50000000:incData.adTotal<70000000?70000000:incData.adTotal<100000000?100000000:100000000):50000000;
  const incPct=incData?Math.min(Math.round(incData.adTotal/incNext*100),100):0;

  const history=useMemo(()=>{const items:any[]=[];execs.forEach(e=>{if(e.channel==="분양회 월회비"||e.channel==="분양회 입회비")return;if((e.hightarget_mileage||0)>0)items.push({date:e.payment_date,type:"마일리지 적립",channel:e.channel||"하이타겟",mileage:e.hightarget_mileage,reward:0,sign:"+",category:"적립"});const rwd=(e.hightarget_reward||0)+(e.hogaengnono_reward||0)+(e.lms_reward||0);if(rwd>0)items.push({date:e.payment_date,type:"리워드 적립",channel:e.channel||"기타",mileage:0,reward:rwd,sign:"+",category:"리워드적립"});});usages.forEach(u=>{items.push({date:u.usage_date,type:"마일리지 사용",channel:"",mileage:u.usage_amount,reward:0,sign:"-",category:"마일리지사용"});});rewardPayments.forEach(p=>{if(p.paid_amount>0)items.push({date:p.paid_date||"",type:"리워드 지급",channel:p.quarter||"",mileage:0,reward:p.paid_amount,sign:"✓",category:"리워드지급"});});return items.sort((a,b)=>b.date.localeCompare(a.date));},[execs,usages,rewardPayments]);
  const filtered=tab==="전체"?history:tab==="적립"?history.filter(h=>h.category==="적립"):tab==="마일리지사용"?history.filter(h=>h.category==="마일리지사용"):tab==="리워드적립"?history.filter(h=>h.category==="리워드적립"):history.filter(h=>h.category==="리워드지급");

  const photoUrl=contact?.photo_url?`https://rlpdhufcsuewvwluydky.supabase.co/storage/v1/object/public/customer-photos/${contact.photo_url}`:null;
  const cInfo=contact?.consultant?CONSULTANT_INFO[contact.consultant]:null;
  const tInfo=contact?.assigned_to?TEAM_INFO[contact.assigned_to]:null;

  const rewardDetails=[
    {icon:"🎯",label:"하이타겟 마일리지",value:`${fw(stats.totalMileage)}P`,detail:execs.filter(e=>(e.hightarget_mileage||0)>0).map(e=>({date:e.payment_date,ch:e.channel,amt:e.hightarget_mileage,unit:"P"}))},
    {icon:"🎯",label:"하이타겟 리워드",value:`${fw(stats.htReward)}원`,detail:execs.filter(e=>(e.hightarget_reward||0)>0).map(e=>({date:e.payment_date,ch:e.channel,amt:e.hightarget_reward,unit:"원"}))},
    {icon:"📱",label:"호갱노노 리워드",value:`${fw(stats.hogReward)}원`,detail:execs.filter(e=>(e.hogaengnono_reward||0)>0).map(e=>({date:e.payment_date,ch:e.channel,amt:e.hogaengnono_reward,unit:"원"}))},
    {icon:"💬",label:"LMS 리워드",value:`${fw(stats.lmsReward)}원`,detail:execs.filter(e=>(e.lms_reward||0)>0).map(e=>({date:e.payment_date,ch:e.channel,amt:e.lms_reward,unit:"원"}))},
  ];

  if(loading)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff"}}><div style={{width:28,height:28,border:"3px solid #1E3A8A",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  if(notFound)return<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#fff"}}><div style={{fontSize:48,marginBottom:16}}>🔒</div><h1 style={{fontSize:20,fontWeight:700,color:"#334155"}}>접근할 수 없는 페이지입니다</h1></div>;

  // ═══ 공통 컴포넌트 ═══
  const HELP_TEXTS: Record<string,{title:string;text:string}>={
    mileage:{title:"하이타겟 마일리지 안내",text:"분양의신 하이타겟 광고 운영시에 마일리지를 사용할 수 있습니다."},
    reward:{title:"리워드 안내",text:"리워드는 각 분기별 3개월 간 광고 매체별로 적립된 리워드를 분기가 끝나는 익월 15일 이내 지급됩니다."},
    incentive:{title:"누적리워드 인센티브 안내",text:"누적리워드 인센티브는 분양회 입회일 기준으로 3개월 단위로 사용된 총 광고비에 따라 그레이드별 달성 구간 인센티브를 지급해 드립니다.\n인센티브는 각 분기가 마감되는 익월 15일 이내 일괄 지급됩니다."},
  };
  const HelpIcon=({type,size=16}:{type:string;size?:number})=>(<button onClick={(e)=>{e.stopPropagation();setHelpPopup(type);}} style={{width:size+4,height:size+4,borderRadius:"50%",background:"rgba(0,0,0,0.06)",border:"none",display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:size-4,fontWeight:700,color:"#999",flexShrink:0}}>?</button>);
  const HelpPopup=()=>{if(!helpPopup||!HELP_TEXTS[helpPopup])return null;const h=HELP_TEXTS[helpPopup];return(<div onClick={()=>setHelpPopup(null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:"24px 20px",maxWidth:380,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}><p style={{fontSize:16,fontWeight:700,color:"#222",marginBottom:12}}>{h.title}</p><p style={{fontSize:14,color:"#555",lineHeight:1.7,whiteSpace:"pre-line"}}>{h.text}</p><button onClick={()=>setHelpPopup(null)} style={{marginTop:16,width:"100%",padding:"10px",background:"#f1f5f9",border:"none",borderRadius:10,fontSize:14,fontWeight:600,color:"#475569",cursor:"pointer"}}>확인</button></div></div>);};
  const NumBadge=({n,color,sz=16}:{n:number;color:string;sz?:number})=>(<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:sz,height:sz,borderRadius:"50%",background:color,color:"#fff",fontSize:sz-7,fontWeight:700,flexShrink:0}}>{n}</span>);

  const ContactCard=({label,name,title,phone,sz}:{label:string;name:string;title:string;phone:string;sz:"sm"|"lg"})=>{
    const lg=sz==="lg";
    return(<div style={{padding:lg?"18px 20px":"12px 14px",background:"#f8fafc",borderRadius:lg?14:10,border:"1px solid #f1f1f1",marginBottom:lg?10:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div><p style={{fontSize:lg?14:12,color:"#94a3b8",fontWeight:600,marginBottom:4}}>{label}</p><p style={{fontSize:lg?17:14,fontWeight:700,color:"#222"}}>{name} {title}</p></div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>{alert(name+" "+title+"\n"+phone);}} style={{width:lg?46:36,height:lg?46:36,borderRadius:lg?13:10,background:"#f8fafc",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:lg?20:15,fontFamily:"inherit"}}>👤</button>
        <a href={`tel:${phone}`} style={{width:lg?46:36,height:lg?46:36,borderRadius:lg?13:10,background:"#eff6ff",border:"1px solid #dbeafe",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",fontSize:lg?22:16}}>📞</a>
        <a href={`sms:${phone}`} style={{width:lg?46:36,height:lg?46:36,borderRadius:lg?13:10,background:"#f0fdf4",border:"1px solid #dcfce7",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",fontSize:lg?22:16}}>💬</a>
      </div>
    </div>);
  };

  const IncentiveBlock=({sz}:{sz:"sm"|"lg"})=>{
    if(!incData)return null;const lg=sz==="lg";
    return(<div style={{background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",borderRadius:lg?16:14,padding:lg?"24px":"18px 16px",border:"1px solid #ddd6fe"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:lg?14:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><NumBadge n={3} color="#7c3aed" sz={lg?20:14}/><span style={{fontSize:lg?17:13,fontWeight:700,color:"#5b21b6"}}>누적 리워드</span><span style={{fontSize:lg?12:10,padding:"2px 8px",background:"#7c3aed",color:"#fff",borderRadius:12,fontWeight:700}}>인센티브</span></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:lg?13:11,fontWeight:700,color:"#7c3aed"}}>잔여기간 D-{incData.daysLeft}</span><HelpIcon type="incentive" size={lg?18:15}/></div>
      </div>
      <p style={{fontSize:lg?13:11,color:"#8b5cf6",marginBottom:lg?14:12}}>{fDate(incData.sStr)} ~ {fDate(incData.eStr)} 누적 집행액 기준</p>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <div><p style={{fontSize:lg?13:11,color:"#94a3b8"}}>현재 누적 집행</p><p style={{fontSize:lg?30:22,fontWeight:800,color:"#1e293b"}}>{fw(incData.adTotal)}<span style={{fontSize:lg?13:11,color:"#94a3b8"}}>원</span></p></div>
        <div style={{textAlign:"right"}}><p style={{fontSize:lg?13:11,color:"#94a3b8"}}>다음 티어까지</p><p style={{fontSize:lg?20:16,fontWeight:700,color:"#7c3aed"}}>{fw(Math.max(incNext-incData.adTotal,0))}<span style={{fontSize:lg?11:10,color:"#94a3b8"}}>원</span></p></div>
      </div>
      <div style={{width:"100%",height:lg?10:8,background:"rgba(255,255,255,0.6)",borderRadius:10,overflow:"hidden",marginBottom:lg?16:14}}>
        <div style={{height:"100%",borderRadius:10,background:"linear-gradient(90deg,#7c3aed,#a78bfa)",width:`${Math.max(incPct,2)}%`}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:lg?8:6}}>
        {[{l:"5천만~",a:"300만",ok:incData.adTotal>=50000000,c:"#ea580c"},{l:"7천만~",a:"500만",ok:incData.adTotal>=70000000,c:"#64748b"},{l:"1억~",a:"1,000만",ok:incData.adTotal>=100000000,c:"#d97706"}].map(t=>(<div key={t.l} style={{padding:lg?"14px 10px":"10px 8px",borderRadius:lg?12:10,background:t.ok?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.4)",border:t.ok?`2px solid ${t.c}`:"1px solid rgba(0,0,0,0.05)",textAlign:"center",opacity:t.ok?1:0.6}}>
          <p style={{fontSize:lg?12:10,color:"#64748b"}}>{t.l}</p><p style={{fontSize:lg?22:16,fontWeight:800,color:t.ok?t.c:"#94a3b8"}}>{t.a}</p>
        </div>))}
      </div>
    </div>);
  };

  const HistoryList=({maxH}:{maxH?:string})=>(<div style={{maxHeight:maxH,overflow:maxH?"auto":undefined}}>
    {filtered.length===0?<div style={{textAlign:"center",padding:"40px 0",color:"#ccc",fontSize:14}}>내역이 없습니다</div>:filtered.map((h:any,i:number)=>(
      <div key={i} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"16px 0",borderBottom:"1px solid #f8f8f8"}}>
        <div style={{width:42,height:42,borderRadius:12,flexShrink:0,background:h.sign==="+"?"#f0f7ff":h.sign==="✓"?"#f0fdf4":"#fff5f5",display:"flex",alignItems:"center",justifyContent:"center",border:h.sign==="+"?"1px solid #dbeafe":h.sign==="✓"?"1px solid #dcfce7":"1px solid #fee2e2"}}><span style={{fontSize:16}}>{h.sign==="+"?"📥":h.sign==="✓"?"💸":"📤"}</span></div>
        <div style={{flex:1}}>
          <span style={{fontSize:14,fontWeight:600,color:"#222"}}>{h.type}</span>
          {h.channel&&<p style={{fontSize:13,color:"#999",marginTop:2}}>{h.channel}</p>}
          <p style={{fontSize:12,color:"#bbb",marginTop:4}}>{fDate(h.date)}</p>
          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
            {h.mileage>0&&<span style={{fontSize:11,fontWeight:600,color:h.sign==="+"?"#2563eb":"#ef4444",padding:"3px 10px",background:h.sign==="+"?"#eff6ff":"#fef2f2",borderRadius:20,border:h.sign==="+"?"1px solid #dbeafe":"1px solid #fee2e2"}}>{h.sign==="+"?"마일리지 +":"마일리지 -"}{fw(h.mileage)}P</span>}
            {h.reward>0&&<span style={{fontSize:11,fontWeight:600,color:h.sign==="✓"?"#7c3aed":"#16a34a",padding:"3px 10px",background:h.sign==="✓"?"#f5f3ff":"#f0fdf4",borderRadius:20,border:h.sign==="✓"?"1px solid #e9d5ff":"1px solid #dcfce7"}}>{h.sign==="✓"?"지급완료 ":"리워드 +"}{fw(h.reward)}원</span>}
          </div>
        </div>
      </div>
    ))}
  </div>);

  const TabBar=()=>(<div style={{display:"flex",alignItems:"center",gap:20,borderBottom:"1px solid #f1f1f1",position:"sticky",top:0,background:"#fff",zIndex:10,padding:"16px 0"}}>
    {["전체","적립","리워드적립","마일리지사용","리워드지급"].map(t=>(<button key={t} onClick={()=>setTab(t)} style={{fontSize:15,fontWeight:tab===t?700:400,color:tab===t?"#222":"#999",background:"none",border:"none",cursor:"pointer",padding:"4px 0",borderBottom:tab===t?"2px solid #222":"2px solid transparent"}}>{t}</button>))}
    <span style={{fontSize:13,color:"#bbb",marginLeft:"auto"}}>{filtered.length}건</span>
  </div>);

  const RewardDetails=({sz}:{sz:"sm"|"lg"})=>{const lg=sz==="lg";return(<div>{rewardDetails.map(row=>(<details key={row.label} style={{borderBottom:"1px solid #f8f8f8"}}><summary style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:lg?"12px 0":"10px 0",cursor:"pointer",listStyle:"none"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:lg?18:14}}>{row.icon}</span><span style={{fontSize:lg?15:13,color:"#666"}}>{row.label}</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:lg?15:13,fontWeight:600,color:"#333"}}>{row.value}</span><span style={{fontSize:10,color:"#ccc"}}>▼</span></div></summary>{row.detail.length>0?(<div style={{padding:"4px 0 12px 28px"}}>{row.detail.map((d:any,i:number)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:lg?13:12}}><span style={{color:"#999"}}>{fDate(d.date)} · {d.ch}</span><span style={{fontWeight:600,color:"#2563eb"}}>+{fw(d.amt)}{d.unit}</span></div>))}</div>):<p style={{padding:"8px 0 12px 28px",fontSize:12,color:"#ccc"}}>내역 없음</p>}</details>))}</div>);};

  const GuideButtons=({sz}:{sz:"sm"|"lg"})=>{const lg=sz==="lg";return(<div style={{display:"grid",gridTemplateColumns:lg?"1fr 1fr":"1fr",gap:8}}>{GUIDE_CATS.map(cat=>(<button key={cat.id} onClick={()=>{setGuideOpen(true);setGuideSection(cat.id);}} style={{display:"flex",alignItems:"center",gap:12,padding:lg?"16px":"14px",borderRadius:lg?12:10,border:"1px solid #f1f1f1",background:"#fafafa",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}><div style={{width:lg?40:36,height:lg?40:36,borderRadius:lg?12:10,background:cat.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:lg?22:18,flexShrink:0}}>{cat.emoji}</div><div style={{flex:1}}><p style={{fontSize:lg?14:13,fontWeight:600,color:"#333"}}>{cat.title}</p><p style={{fontSize:lg?12:11,color:"#999",marginTop:1}}>{cat.desc}</p></div><span style={{fontSize:14,color:"#ccc"}}>›</span></button>))}</div>);};

  return (
    <div style={{minHeight:"100vh",background:"#fff",fontFamily:"'Pretendard','Noto Sans KR',sans-serif"}}>
      <HelpPopup/>
      <style>{`@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css');*{box-sizing:border-box;margin:0;padding:0}
        .pc-view{display:block}.mob-view{display:none}
        @media(max-width:768px){.pc-view{display:none}.mob-view{display:block}}
      `}</style>

      {/* ════════════════ PC 레이아웃 ════════════════ */}
      <div className="pc-view">
        {/* 히어로 */}
        <div style={{background:"linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 40%,#2d2318 100%)",padding:"48px 0",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,right:0,width:"40%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.05))"}}/>
          <div style={{maxWidth:1600,margin:"0 auto",padding:"0 56px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:32}}>
              <div style={{width:140,height:170,borderRadius:16,overflow:"hidden",border:"3px solid #D4A843",boxShadow:"0 8px 32px rgba(0,0,0,0.5)",flexShrink:0}}>
                {photoUrl?<img src={photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 15%"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#222"}}><span style={{fontSize:44,fontWeight:800,color:"#D4A843"}}>{contact?.name?.[0]}</span></div>}
              </div>
              <div>
                <h1 style={{fontSize:36,fontWeight:800,color:"#fff",marginBottom:8}}>{contact?.name} <span style={{fontSize:20,fontWeight:500,color:"rgba(255,255,255,0.5)"}}>{contact?.title}</span></h1>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:12,padding:"4px 12px",background:"#D4A843",color:"#1a1a1a",borderRadius:6,fontWeight:800}}>VIP</span>
                  <span style={{fontSize:15,color:"#D4A843",fontWeight:600,flex:1}}>분양회 프리미엄 멤버십</span>
                  {"serviceWorker" in (typeof navigator!=="undefined"?navigator:{}) && <button onClick={togglePush} disabled={pushLoading} style={{fontSize:12,padding:"5px 14px",background:pushEnabled?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.1)",color:pushEnabled?"#22c55e":"#999",border:`1px solid ${pushEnabled?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.15)"}`,borderRadius:8,fontWeight:700,cursor:"pointer"}}>{pushLoading?"...":pushEnabled?"🔔 알림 ON":"🔕 알림 OFF"}</button>}
                </div>
              </div>
            </div>
            <img src="/bunyanghoe-logo.png" alt="" style={{width:200,height:220,objectFit:"contain",opacity:0.9}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none"}}/>
          </div>
        </div>

        {/* 그리드 */}
        <div style={{padding:"32px 0",maxWidth:1600,margin:"0 auto",paddingLeft:56,paddingRight:56}}>
          {/* 1행: 내정보 + 담당자 + 날씨 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20,marginBottom:20}}>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #f1f1f1",padding:"24px"}}>
              <p style={{fontSize:16,fontWeight:700,color:"#222",marginBottom:16}}>내 정보</p>
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f8f8f8"}}><span style={{fontSize:15,color:"#666"}}>성명 / 직급</span><span style={{fontSize:15,fontWeight:600,color:"#333"}}>{contact?.name} {contact?.title}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f8f8f8"}}><span style={{fontSize:15,color:"#666"}}>가입일</span><span style={{fontSize:15,fontWeight:600,color:"#333"}}>{fDate(contact?.contract_date||"")}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0"}}><span style={{fontSize:15,color:"#666"}}>가입</span><span style={{fontSize:15,fontWeight:600,color:"#7c3aed"}}>{getDays(contact?.contract_date||"")}일차</span></div>
            </div>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #f1f1f1",padding:"24px"}}>
              <p style={{fontSize:16,fontWeight:700,color:"#222",marginBottom:16}}>분양회 담당자</p>
              {contact?.assigned_to&&tInfo&&<ContactCard label="대외협력팀 담당자" name={contact.assigned_to} title={tInfo.title} phone={tInfo.phone} sz="lg"/>}
              {contact?.consultant&&cInfo&&<ContactCard label="광고사업부 담당자" name={contact.consultant} title={cInfo.title} phone={cInfo.phone} sz="lg"/>}
            </div>
            <WeatherWidget size="lg"/>
          </div>

          {/* 2행: 마일리지 + 리워드 + 인센티브 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:20,marginBottom:20}}>
            <div style={{background:"#eff6ff",borderRadius:16,padding:"28px 24px",border:"1px solid #bfdbfe"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:6}}><NumBadge n={1} color="#3b82f6" sz={20}/><span style={{fontSize:14,fontWeight:600,color:"#3b82f6"}}>하이타겟 마일리지</span></div><HelpIcon type="mileage" size={18}/></div>
              <p style={{fontSize:36,fontWeight:800,color:"#1e293b"}}>{fw(stats.remainMileage)}<span style={{fontSize:14,color:"#94a3b8",marginLeft:4}}>P</span></p>
            </div>
            <div style={{background:"#fff7ed",borderRadius:16,padding:"28px 24px",border:"1px solid #fed7aa"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:6}}><NumBadge n={2} color="#ea580c" sz={20}/><span style={{fontSize:14,fontWeight:600,color:"#ea580c"}}>리워드</span></div><HelpIcon type="reward" size={18}/></div>
              <p style={{fontSize:36,fontWeight:800,color:"#1e293b"}}>{fw(stats.totalReward)}<span style={{fontSize:14,color:"#94a3b8",marginLeft:4}}>원</span></p>
            </div>
            <IncentiveBlock sz="lg"/>
          </div>

          {/* 3행: 리워드 상세 + 가이드 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #f1f1f1",padding:"24px"}}>
              <p style={{fontSize:16,fontWeight:700,color:"#222",marginBottom:16}}>마일리지 및 리워드 상세</p>
              <RewardDetails sz="lg"/>
              <div style={{borderTop:"1px solid #f1f1f1",paddingTop:16,marginTop:16}}>
                <p style={{fontSize:15,fontWeight:700,color:"#222",marginBottom:12}}>마일리지 및 리워드 사용·지급현황</p>
                <details style={{borderBottom:"1px solid #f8f8f8"}}>
                  <summary style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",cursor:"pointer",listStyle:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>📤</span><span style={{fontSize:15,color:"#666"}}>하이타겟 마일리지 사용</span></div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:15,fontWeight:600,color:"#ef4444"}}>{fw(stats.totalUsed)}P</span><span style={{fontSize:10,color:"#ccc"}}>▼</span></div>
                  </summary>
                  {usages.length>0?(<div style={{padding:"4px 0 12px 28px"}}>{usages.map((u:any)=>(<div key={u.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}><span style={{color:"#999"}}>{fDate(u.usage_date)}</span><span style={{fontWeight:600,color:"#ef4444"}}>-{fw(u.usage_amount)}P</span></div>))}</div>):<p style={{padding:"8px 0 12px 28px",fontSize:13,color:"#ccc"}}>사용 내역 없음</p>}
                </details>
                <details style={{borderBottom:"1px solid #f8f8f8"}}>
                  <summary style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",cursor:"pointer",listStyle:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>💸</span><span style={{fontSize:15,color:"#666"}}>리워드 지급내역</span></div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:15,fontWeight:600,color:stats.totalPaid>0?"#7c3aed":"#16a34a"}}>{stats.totalPaid>0?`${fw(stats.totalPaid)}원`:"내역 확인"}</span><span style={{fontSize:10,color:"#ccc"}}>▼</span></div>
                  </summary>
                  {rewardPayments.length>0?(<div style={{padding:"4px 0 12px 28px"}}>{rewardPayments.filter(p=>p.paid_amount>0).map((p:any)=>(<div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}><span style={{color:"#999"}}>{fDate(p.paid_date)} · {p.quarter}</span><span style={{fontWeight:600,color:"#7c3aed"}}>지급 {fw(p.paid_amount)}원</span></div>))}</div>):<p style={{padding:"8px 0 12px 28px",fontSize:13,color:"#ccc"}}>리워드 지급은 분기별 정산 후 진행됩니다</p>}
                </details>
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #f1f1f1",padding:"24px"}}>
              <p style={{fontSize:16,fontWeight:700,color:"#222",marginBottom:16}}>🏗️ 신규현장 정보</p>
              {sitesList.length===0?<p style={{fontSize:13,color:"#ccc",textAlign:"center",padding:"20px 0"}}>등록된 현장이 없습니다</p>:(
                <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:360,overflowY:"auto"}}>
                  {sitesList.map(s=>{const isN=Date.now()-new Date(s.created_at).getTime()<2*24*60*60*1000;return(
                    <a key={s.id} href={`/sites/${s.id}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"#f8fafc",borderRadius:10,border:"1px solid #f1f1f1",textDecoration:"none",cursor:"pointer"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          {s.property_type&&<span style={{fontSize:10,padding:"2px 6px",background:"#eff6ff",color:"#2563eb",borderRadius:4,fontWeight:700}}>{s.property_type}</span>}
                          <span style={{fontSize:14,fontWeight:700,color:"#222"}}>{s.site_name}</span>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {s.unit_count&&<span style={{fontSize:10,color:"#666"}}>{s.unit_count}세대</span>}
                          {s.rt_fee&&<span style={{fontSize:10,color:"#d97706",fontWeight:600}}>R/T {s.rt_fee}</span>}
                          {s.business_address&&<span style={{fontSize:10,color:"#999"}}>{s.business_address}</span>}
                        </div>
                      </div>
                      {isN&&<span style={{fontSize:10,padding:"3px 8px",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",borderRadius:20,fontWeight:800,whiteSpace:"nowrap",flexShrink:0}}>✨ 신규</span>}
                    </a>
                  );})}
                </div>
              )}
              <a href="/sites" target="_blank" rel="noopener noreferrer" style={{display:"block",textAlign:"center",marginTop:12,fontSize:13,color:"#3b82f6",fontWeight:600,textDecoration:"none"}}>전체 현장정보 보기 →</a>
            </div>
          </div>

          {/* 이용가이드 (전체 폭) */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #f1f1f1",padding:"24px",marginBottom:20}}>
            <p style={{fontSize:16,fontWeight:700,color:"#222",marginBottom:16}}>분양회 VIP 이용가이드</p>
            <GuideButtons sz="lg"/>
          </div>

          {/* 4행: 거래 내역 */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #f1f1f1",padding:"24px 32px"}}>
            <TabBar/>
            <HistoryList maxH="400px"/>
          </div>

          <div style={{textAlign:"center",padding:"32px 0 16px",color:"#ccc",fontSize:12}}>© 2026 광고인㈜ · 분양의신</div>
        </div>
      </div>

      {/* ════════════════ 모바일 레이아웃 (기존 그대로) ════════════════ */}
      <div className="mob-view">

        {/* 프로필 */}
        <div style={{padding:"24px 20px"}}>
          <div style={{background:"#111",borderRadius:16,padding:"20px",marginBottom:20,display:"flex",gap:16}}>
            <div style={{width:130,height:210,borderRadius:12,overflow:"hidden",border:"2px solid #D4A843",flexShrink:0}}>
              {photoUrl?<img src={photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 15%"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#222"}}><span style={{fontSize:36,fontWeight:800,color:"#D4A843"}}>{contact?.name?.[0]}</span></div>}
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
              <img src="/bunyanghoe-logo.png" alt="" style={{width:"100%",height:170,objectFit:"contain",marginBottom:6}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none"}}/>
              <h2 style={{fontSize:24,fontWeight:800,color:"#fff",textAlign:"center"}}>{contact?.name} <span style={{fontSize:16,fontWeight:500,color:"rgba(255,255,255,0.5)"}}>{contact?.title}</span></h2>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"10px 14px",background:"linear-gradient(90deg,#1a1a1a,#2d2318)",borderRadius:10}}><span style={{fontSize:10,padding:"2px 8px",background:"#D4A843",color:"#1a1a1a",borderRadius:4,fontWeight:800}}>VIP</span><span style={{fontSize:12,color:"#D4A843",fontWeight:600,flex:1}}>분양회 프리미엄 멤버십</span>
            {"serviceWorker" in (typeof navigator!=="undefined"?navigator:{}) && <button onClick={togglePush} disabled={pushLoading} style={{fontSize:10,padding:"4px 10px",background:pushEnabled?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.1)",color:pushEnabled?"#22c55e":"#999",border:`1px solid ${pushEnabled?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.15)"}`,borderRadius:8,fontWeight:700,cursor:"pointer"}}>{pushLoading?"...":pushEnabled?"🔔 알림 ON":"🔕 알림 OFF"}</button>}
          </div>
          <p style={{fontSize:13,fontWeight:700,color:"#222",marginBottom:10}}>내 정보</p>
          <div style={{padding:"8px 0",borderBottom:"1px solid #f8f8f8",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:"#666"}}>성명 / 직급</span><span style={{fontSize:13,fontWeight:600,color:"#333"}}>{contact?.name} {contact?.title}</span></div>
          <div style={{padding:"8px 0",borderBottom:"1px solid #f8f8f8",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:"#666"}}>가입일</span><span style={{fontSize:13,fontWeight:600,color:"#333"}}>{fDate(contact?.contract_date||"")}</span></div>
            <div style={{padding:"8px 0",borderBottom:"1px solid #f8f8f8",display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{fontSize:13,color:"#666"}}>가입</span><span style={{fontSize:13,fontWeight:600,color:"#7c3aed"}}>{getDays(contact?.contract_date||"")}일차</span></div>
          <p style={{fontSize:13,fontWeight:700,color:"#222",marginBottom:8}}>분양회 담당자</p>
          {contact?.assigned_to&&tInfo&&<ContactCard label="대외협력팀 담당자" name={contact.assigned_to} title={tInfo.title} phone={tInfo.phone} sz="sm"/>}
          {contact?.consultant&&cInfo&&<ContactCard label="광고사업부 담당자" name={contact.consultant} title={cInfo.title} phone={cInfo.phone} sz="sm"/>}
          <div style={{marginTop:12,marginBottom:12}}><WeatherWidget size="sm"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:"#eff6ff",borderRadius:14,padding:"18px 16px",border:"1px solid #bfdbfe"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:5}}><NumBadge n={1} color="#3b82f6" sz={14}/><span style={{fontSize:11,fontWeight:600,color:"#3b82f6"}}>하이타겟 마일리지</span></div><HelpIcon type="mileage" size={15}/></div><p style={{fontSize:18,fontWeight:800,color:"#1e293b",whiteSpace:"nowrap"}}>{fw(stats.remainMileage)}<span style={{fontSize:12,color:"#94a3b8",marginLeft:2}}>P</span></p></div>
            <div style={{background:"#fff7ed",borderRadius:14,padding:"18px 16px",border:"1px solid #fed7aa"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:5}}><NumBadge n={2} color="#ea580c" sz={14}/><span style={{fontSize:11,fontWeight:600,color:"#ea580c"}}>리워드</span></div><HelpIcon type="reward" size={15}/></div><p style={{fontSize:18,fontWeight:800,color:"#1e293b",whiteSpace:"nowrap"}}>{fw(stats.totalReward)}<span style={{fontSize:12,color:"#94a3b8",marginLeft:2}}>원</span></p></div>
          </div>
          <div style={{marginBottom:16}}><IncentiveBlock sz="sm"/></div>
          <div style={{borderTop:"1px solid #f1f1f1",paddingTop:16,marginBottom:16}}><p style={{fontSize:13,fontWeight:700,color:"#222",marginBottom:12}}>마일리지 및 리워드 상세</p><RewardDetails sz="sm"/></div>
          <div style={{borderTop:"1px solid #f1f1f1",paddingTop:16,marginBottom:16}}>
            <p style={{fontSize:13,fontWeight:700,color:"#222",marginBottom:12}}>마일리지 및 리워드 사용·지급현황</p>
            <details style={{borderBottom:"1px solid #f8f8f8"}}>
              <summary style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",cursor:"pointer",listStyle:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>📤</span><span style={{fontSize:13,color:"#666"}}>하이타겟 마일리지 사용</span></div>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:"#ef4444"}}>{fw(stats.totalUsed)}P</span><span style={{fontSize:10,color:"#ccc"}}>▼</span></div>
              </summary>
              {usages.length>0?(<div style={{padding:"4px 0 12px 28px"}}>{usages.map((u:any)=>(<div key={u.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12}}><span style={{color:"#999"}}>{fDate(u.usage_date)}</span><span style={{fontWeight:600,color:"#ef4444"}}>-{fw(u.usage_amount)}P</span></div>))}</div>):<p style={{padding:"8px 0 12px 28px",fontSize:12,color:"#ccc"}}>사용 내역 없음</p>}
            </details>
            <details style={{borderBottom:"1px solid #f8f8f8"}}>
              <summary style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",cursor:"pointer",listStyle:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>💸</span><span style={{fontSize:13,color:"#666"}}>리워드 지급내역</span></div>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:stats.totalPaid>0?"#7c3aed":"#16a34a"}}>{stats.totalPaid>0?`${fw(stats.totalPaid)}원`:"내역 확인"}</span><span style={{fontSize:10,color:"#ccc"}}>▼</span></div>
              </summary>
              {rewardPayments.length>0?(<div style={{padding:"4px 0 12px 28px"}}>{rewardPayments.filter(p=>p.paid_amount>0).map((p:any)=>(<div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12}}><span style={{color:"#999"}}>{fDate(p.paid_date)} · {p.quarter}</span><span style={{fontWeight:600,color:"#7c3aed"}}>지급 {fw(p.paid_amount)}원</span></div>))}</div>):<p style={{padding:"8px 0 12px 28px",fontSize:12,color:"#ccc"}}>리워드 지급은 분기별 정산 후 진행됩니다</p>}
            </details>
          </div>
          <div style={{borderTop:"1px solid #f1f1f1",paddingTop:16,marginBottom:16}}>
            <p style={{fontSize:13,fontWeight:700,color:"#222",marginBottom:12}}>🏗️ 신규현장 정보</p>
            {sitesList.length===0?<p style={{fontSize:12,color:"#ccc",textAlign:"center",padding:"12px 0"}}>등록된 현장이 없습니다</p>:(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {sitesList.slice(0,5).map(s=>{const isN=Date.now()-new Date(s.created_at).getTime()<2*24*60*60*1000;return(
                  <a key={s.id} href={`/sites/${s.id}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #f1f1f1",textDecoration:"none"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                        {s.property_type&&<span style={{fontSize:9,padding:"1px 5px",background:"#eff6ff",color:"#2563eb",borderRadius:3,fontWeight:700}}>{s.property_type}</span>}
                        <span style={{fontSize:13,fontWeight:700,color:"#222"}}>{s.site_name}</span>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        {s.unit_count&&<span style={{fontSize:10,color:"#666"}}>{s.unit_count}세대</span>}
                        {s.rt_fee&&<span style={{fontSize:10,color:"#d97706",fontWeight:600}}>R/T {s.rt_fee}</span>}
                      </div>
                    </div>
                    {isN&&<span style={{fontSize:9,padding:"2px 6px",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",borderRadius:20,fontWeight:800,flexShrink:0}}>✨ 신규</span>}
                  </a>
                );})}
                <a href="/sites" target="_blank" rel="noopener noreferrer" style={{display:"block",textAlign:"center",marginTop:6,fontSize:12,color:"#3b82f6",fontWeight:600,textDecoration:"none"}}>전체 현장정보 보기 →</a>
              </div>
            )}
          </div>
          <div style={{borderTop:"1px solid #f1f1f1",paddingTop:16,marginBottom:16}}><p style={{fontSize:13,fontWeight:700,color:"#222",marginBottom:12}}>분양회 VIP 이용가이드</p><GuideButtons sz="sm"/></div>
          <div style={{paddingTop:16,borderTop:"1px solid #f1f1f1",textAlign:"center"}}><p style={{fontSize:11,color:"#ccc"}}>© 2026 광고인㈜ · 분양의신</p></div>
        </div>
      </div>

      {/* ═══ VIP 가이드 모달 (공통) ═══ */}
      {guideOpen&&(<div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setGuideOpen(false)}>
        <div style={{background:"#fff",borderRadius:20,width:"92%",maxWidth:600,maxHeight:"85vh",overflow:"auto",padding:"24px 16px",WebkitOverflowScrolling:"touch" as any}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}><h2 style={{fontSize:18,fontWeight:800,color:"#222"}}>{GUIDE_CATS.find(c=>c.id===guideSection)?.title}</h2><button onClick={()=>setGuideOpen(false)} style={{background:"none",border:"none",fontSize:20,color:"#999",cursor:"pointer"}}>✕</button></div>
          {guideSection==="start"&&(<div><p style={{fontSize:14,color:"#555",lineHeight:1.8,marginBottom:16}}>분양회는 분양업계 상위 3%, 리더 100인만을 위한 프라이빗 멤버십입니다.</p><p style={{fontSize:14,color:"#555",lineHeight:1.8,marginBottom:16}}>전체 분양상담사 약 45,000명 중 상위권 팀장 900명, 상위권 본부장 450명, 그 중 분양회 100명이 선발됩니다.</p><div style={{display:"flex",flexDirection:"column",gap:8}}>{[{t:"광고 특전",d:"광고 잘하는 리더",v:"~1억원"},{t:"홍보 특전",d:"팀원이 먼저 찾는 리더",v:"~1,000만원"},{t:"네트워킹 특전",d:"좋은 현장 가져오는 리더",v:"~1,000만원"}].map(row=>(<div key={row.t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",background:"#f8fafc",borderRadius:10,border:"1px solid #f1f1f1"}}><div><p style={{fontSize:14,fontWeight:700,color:"#222"}}>{row.t}</p><p style={{fontSize:12,color:"#888",marginTop:2}}>{row.d}</p></div><span style={{fontSize:15,fontWeight:800,color:"#2563eb",whiteSpace:"nowrap",marginLeft:12}}>{row.v}</span></div>))}</div></div>)}
          {guideSection==="ad"&&(<div style={{fontSize:14,color:"#555",lineHeight:1.8}}><p style={{marginBottom:12}}>분양회 VIP 멤버십의 광고 특전 안내입니다.</p><div style={{display:"flex",flexDirection:"column",gap:8}}>{[{t:"횡보기간 단독 콜보장",d:"정체기 현장 하이타겟 광고 독점 집행, 150% 효과 보장"},{t:"LMS 광고 이용 및 리워드",d:"장문 문자 광고, 마일리지 15% + 리워드 5%"},{t:"호갱노노 광고 이용 및 리워드",d:"부동산 플랫폼 광고, 마일리지 5% + 리워드 5%"},{t:"분양의신 광고 이용 및 리워드",d:"마일리지 10% 또는 리워드 5% 택1"},{t:"본부 광고비 지원 제안서",d:"현장 맞춤형 브리핑용 제안서 무료 제작"},{t:"PC+모바일 홈페이지",d:"팀원 수만큼 퍼포먼스형 홈페이지 무료 제공"}].map(item=>(<div key={item.t} style={{padding:"14px",background:"#f8fafc",borderRadius:10,border:"1px solid #f1f1f1"}}><p style={{fontSize:14,fontWeight:700,color:"#222"}}>{item.t}</p><p style={{fontSize:13,color:"#666",marginTop:2}}>{item.d}</p></div>))}</div></div>)}
          {guideSection==="pr"&&(<div style={{fontSize:14,color:"#555",lineHeight:1.8}}><p style={{marginBottom:12}}>퍼스널 브랜딩을 위한 홍보 특전 안내입니다.</p>{[{t:"PR패키지 3종",d:"프로필 촬영(50만원) + 아티클 작성(50만원) + 플랫폼 노출"},{t:"분신 매거진 게재",d:"연 2회 발행 매거진 VIP 전용 섹션"},{t:"앱 내 프리미엄 노출",d:"45,000명 대상 VIP 전용 영역 무료 노출"},{t:"VIP 이모티콘 및 인증서",d:"분기 1회 이모티콘 + 공식 인증서 제공"}].map(item=>(<div key={item.t} style={{padding:"14px",background:"#f8fafc",borderRadius:10,border:"1px solid #f1f1f1",marginBottom:8}}><p style={{fontSize:14,fontWeight:700,color:"#222"}}>{item.t}</p><p style={{fontSize:13,color:"#666",marginTop:2}}>{item.d}</p></div>))}</div>)}
          {guideSection==="network"&&(<div style={{fontSize:14,color:"#555",lineHeight:1.8}}><p style={{marginBottom:12}}>네트워킹 특전 안내입니다.</p>{[{t:"분신 컨퍼런스 VIP 초청",d:"연 2회, VIP 좌석 배정 + 공식 포지션 노출"},{t:"교육/세미나 VIP 우선 초청",d:"연 4회 세미나·워크샵 우선 등록"},{t:"전용 네트워크 라운지",d:"VIP 100인 전용 프라이빗 커뮤니티"}].map(item=>(<div key={item.t} style={{padding:"14px",background:"#f8fafc",borderRadius:10,border:"1px solid #f1f1f1",marginBottom:8}}><p style={{fontSize:14,fontWeight:700,color:"#222"}}>{item.t}</p><p style={{fontSize:13,color:"#666",marginTop:2}}>{item.d}</p></div>))}</div>)}
          {guideSection==="reward"&&(<div><p style={{fontSize:14,color:"#555",lineHeight:1.8,marginBottom:16}}>분양회 VIP 멤버십의 리워드 및 마일리지 적립률 안내입니다.</p><div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>{[{ch:"분양의신 하이타겟",m:"10%",r:"5%"},{ch:"호갱노노",m:"5%",r:"5%"},{ch:"LMS",m:"15%",r:"5%"}].map(row=>(<div key={row.ch} style={{padding:"14px 16px",background:"#f8fafc",borderRadius:10,border:"1px solid #f1f1f1"}}><p style={{fontSize:14,fontWeight:700,color:"#222",marginBottom:8}}>{row.ch}</p><div style={{display:"flex",gap:10}}><span style={{fontSize:13,padding:"4px 12px",background:"#eff6ff",color:"#2563eb",borderRadius:8,fontWeight:600,border:"1px solid #dbeafe"}}>마일리지 {row.m}</span><span style={{fontSize:13,padding:"4px 12px",background:"#f0fdf4",color:"#16a34a",borderRadius:8,fontWeight:600,border:"1px solid #dcfce7"}}>리워드 {row.r}</span></div></div>))}</div><p style={{fontSize:12,color:"#999",lineHeight:1.6}}>※ 마일리지는 자사 광고 집행 시 적립됩니다.<br/>※ 리워드는 분기별 정산 후 현금 지급됩니다. (원천징수 3.3% 차감)</p></div>)}
          {guideSection==="app"&&<div style={{fontSize:14,color:"#555",lineHeight:1.8}}><p>분양의신 앱 가이드는 앱 출시 후 업데이트 예정입니다.</p></div>}
          <div style={{marginTop:24,padding:"16px",background:"#f8fafc",borderRadius:12,border:"1px solid #e2e8f0",fontSize:13,color:"#666"}}><p style={{fontWeight:700,color:"#333",marginBottom:8}}>문의</p>{contact?.assigned_to&&tInfo&&<p>대외협력팀 {contact.assigned_to} {tInfo.title} <a href={`tel:${tInfo.phone}`} style={{color:"#3b82f6"}}>{tInfo.phone}</a></p>}</div>
        </div>
      </div>)}
    </div>
  );
}
