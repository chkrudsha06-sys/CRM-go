"use client";

import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Bell,
  BarChart3,
  Check,
  Download,
  Eye,
  File,
  FileText,
  Filter,
  Image,
  Info,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ━━━ 타입 ━━━
type Importance = "긴급" | "높음" | "보통" | "낮음" | "정보";
type Notice = {
  id: number; title: string; content: string; importance: Importance;
  image_url: string | null; file_urls: string[] | null; file_names: string[] | null;
  author: string; start_date: string; end_date: string;
  tagged: string[]; created_at: string;
};
type NoticeRead = { notice_id: number; user_name: string; };
type ExistingFile = { url: string; name: string };

// ━━━ 상수 ━━━
const IMPORTANCE_LIST: Importance[] = ["긴급", "높음", "보통", "낮음", "정보"];
const IMP: Record<Importance, { icon: any; color: string; bg: string; border: string }> = {
  긴급: { icon: Zap,           color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)" },
  높음: { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)" },
  보통: { icon: Bell,          color: "var(--accent-text)", bg: "var(--accent-subtle)", border: "var(--accent-border)" },
  낮음: { icon: Info,          color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)" },
  정보: { icon: Shield,        color: "var(--text-muted)", bg: "var(--surface-3)", border: "var(--border-subtle)" },
};
const TEAM = ["김정후","김창완","최웅","조계현","이세호","기여운","최연전","김재영","최은정"];
const ADMIN_NAMES = ["문시욱","김정후","김창완","최웅"];
const IMG_RE = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i;

function getUser() {
  try {
    const raw = localStorage.getItem("crm_user");
    if (raw) {
      const u = JSON.parse(raw);
      const name = String(u?.name || "");
      return { name, isAdmin: String(u?.role||"").toLowerCase()==="admin" || ADMIN_NAMES.includes(name) };
    }
  } catch {}
  return { name: "", isAdmin: false };
}
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d: string) {
  if (!d) return "-";
  const s = d.slice(0,10).split("-");
  return s.length < 3 ? d.slice(0,10) : `${s[0]}.${s[1]}.${s[2]}`;
}
function isActive(n: Notice) { const t = today(); return n.start_date <= t && n.end_date >= t; }
function getFileName(url: string) {
  try { return decodeURIComponent(url.split("/").pop()!).replace(/^\d+_[a-z0-9]+\./, ".").replace(/^\d+_/, ""); } catch { return url; }
}

// ━━━ 업로드 유틸 ━━━
// Supabase Storage 키는 한글/특수문자를 허용하지 않으므로 안전한 영문 키로 변환한다.
// 원본 파일명(한글 포함)은 file_names 컬럼에 따로 저장해 표시용으로 사용한다.
function safeKey(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  const rand = Math.random().toString(36).slice(2, 10);
  return `notices/${Date.now()}_${rand}${ext ? "." + ext : ""}`;
}
// cross-origin 파일 진짜 다운로드 (새 탭이 아닌 저장 다이얼로그)
async function downloadNoticeFile(url: string, displayName: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("파일을 찾을 수 없습니다.");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  } catch (e: any) { alert("다운로드 실패: " + (e?.message || "오류")); }
}

async function uploadFiles(files: File[]): Promise<{ urls: string[]; names: string[]; failed: string[] }> {
  const urls: string[] = [];
  const names: string[] = [];
  const failed: string[] = [];
  for (const f of files) {
    const path = safeKey(f.name);
    const { error: upErr } = await supabase.storage
      .from("notice-images")
      .upload(path, f, { upsert: true, contentType: f.type || undefined });
    if (upErr) { console.error("파일 업로드 실패:", f.name, upErr); failed.push(`${f.name} (${upErr.message})`); continue; }
    const { data } = supabase.storage.from("notice-images").getPublicUrl(path);
    if (data?.publicUrl) { urls.push(data.publicUrl); names.push(f.name); }
  }
  return { urls, names, failed };
}

// ━━━ 등록/수정 모달 ━━━
function NoticeModal({ me, editing, onClose, onSaved }:
  { me: string; editing: Notice | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing;
  const [title, setTitle]       = useState(editing?.title || "");
  const [content, setContent]   = useState(editing?.content || "");
  const [importance, setImp]    = useState<Importance>(editing?.importance || "보통");
  const [startDate, setStart]   = useState(editing?.start_date?.slice(0,10) || today());
  const [endDate, setEnd]       = useState(editing?.end_date?.slice(0,10) || (() => { const d=new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10); })());
  const [tagged, setTagged]     = useState<string[]>(editing?.tagged || []);
  const [files, setFiles]       = useState<File[]>([]);
  const [existing, setExisting] = useState<ExistingFile[]>(
    (editing?.file_urls || []).map((url, i) => ({ url, name: editing?.file_names?.[i] || getFileName(url) }))
  );
  const [saving, setSaving]     = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef                 = useRef<HTMLInputElement>(null);

  // 태그 대상은 작성자 본인을 제외 (수정 시에는 원작성자 기준)
  const authorName = editing?.author || me;
  const others = TEAM.filter(n => n !== authorName);
  const allSel = tagged.length === others.length && others.length > 0;
  const toggleAll = () => setTagged(allSel ? [] : others);
  const toggleTag = (n: string) => setTagged(p => p.includes(n) ? p.filter(t=>t!==n) : [...p,n]);
  const addFiles = (fl: FileList|null) => { if (fl) setFiles(p => [...p, ...Array.from(fl)]); };

  const handleSave = async () => {
    if (!title.trim()) { alert("제목을 입력하세요."); return; }
    if (!content.trim()) { alert("내용을 입력하세요."); return; }
    if (startDate > endDate) { alert("종료일이 시작일보다 앞설 수 없습니다."); return; }
    setSaving(true);
    try {
      const { urls: newUrls, names: newNames, failed } = await uploadFiles(files);

      if (failed.length > 0) {
        const ok = confirm(`다음 파일 업로드에 실패했습니다:\n\n${failed.join("\n")}\n\nSupabase Storage 권한 확인이 필요합니다.\n실패한 파일 없이 저장할까요?`);
        if (!ok) { setSaving(false); return; }
      }

      const combinedUrls  = [...existing.map(e=>e.url),  ...newUrls];
      const combinedNames = [...existing.map(e=>e.name), ...newNames];
      const imageUrl = combinedUrls.find(u => IMG_RE.test(u)) || null;

      const base = {
        title: title.trim(), content: content.trim(), importance,
        image_url: imageUrl,
        file_urls: combinedUrls.length ? combinedUrls : null,
        start_date: startDate, end_date: endDate, tagged,
      };
      const withNames = { ...base, file_names: combinedNames.length ? combinedNames : null };
      const colMissing = (msg: string) => /file_names|column/i.test(msg || "");

      if (isEdit) {
        let res = await supabase.from("notices").update(withNames).eq("id", editing!.id);
        if (res.error && colMissing(res.error.message)) res = await supabase.from("notices").update(base).eq("id", editing!.id);
        if (res.error) throw res.error;
      } else {
        let res = await supabase.from("notices").insert({ ...withNames, author: me });
        if (res.error && colMissing(res.error.message)) res = await supabase.from("notices").insert({ ...base, author: me });
        if (res.error) throw res.error;
      }
      onSaved();
    } catch (e: any) { alert("저장 실패: " + (e?.message||"오류")); }
    finally { setSaving(false); }
  };

  const IS = { background:"var(--surface-2)", borderColor:"var(--border)", color:"var(--text-strong)" };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px]"
        style={{ background:"var(--surface)", border:"1px solid var(--border-subtle)" }}>
        <div className="flex shrink-0 items-center justify-between px-6 py-4" style={{ borderBottom:"1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <Megaphone size={17} style={{ color:"var(--accent-text)" }} />
            <h2 className="crm-section-title">{isEdit ? "공지사항 수정" : "공지사항 등록"}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-8 w-8 p-0"><X size={14}/></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <p className="crm-tiny mb-1">제목 *</p>
            <input className="h-10 w-full rounded-[8px] border px-3 text-[14px] font-bold outline-none" style={IS}
              value={title} onChange={e=>setTitle(e.target.value)} placeholder="공지사항 제목" />
          </div>
          <div>
            <p className="crm-tiny mb-2">중요도</p>
            <div className="flex flex-wrap gap-2">
              {IMPORTANCE_LIST.map(imp => {
                const cfg=IMP[imp]; const active=importance===imp; const Icon=cfg.icon;
                return (
                  <button key={imp} type="button" onClick={()=>setImp(imp)}
                    className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-bold transition"
                    style={{ background:active?cfg.bg:"var(--surface-2)", borderColor:active?cfg.border:"var(--border)", color:active?cfg.color:"var(--text-muted)" }}>
                    <Icon size={12}/>{imp}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="crm-tiny mb-2">게시 기간 *</p>
            <div className="flex items-center gap-2">
              <input type="date" className="h-9 flex-1 rounded-[8px] border px-3 text-[13px] font-semibold outline-none" style={IS}
                value={startDate} onChange={e=>setStart(e.target.value)} />
              <span className="crm-tiny">~</span>
              <input type="date" className="h-9 flex-1 rounded-[8px] border px-3 text-[13px] font-semibold outline-none" style={IS}
                value={endDate} onChange={e=>setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="crm-tiny mb-2">태그자 (알림 대상)</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={toggleAll}
                className="rounded-[8px] border px-2.5 py-1 text-[12px] font-bold transition"
                style={{ background:allSel?"var(--accent-subtle)":"var(--surface-2)", borderColor:allSel?"var(--accent-border)":"var(--border)", color:allSel?"var(--accent-text)":"var(--text-muted)" }}>
                모두
              </button>
              {others.map(name => {
                const active=tagged.includes(name);
                return (
                  <button key={name} type="button" onClick={()=>toggleTag(name)}
                    className="rounded-[8px] border px-2.5 py-1 text-[12px] font-bold transition"
                    style={{ background:active?"var(--accent-subtle)":"var(--surface-2)", borderColor:active?"var(--accent-border)":"var(--border)", color:active?"var(--accent-text)":"var(--text-muted)" }}>
                    @{name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="crm-tiny mb-2">파일 첨부</p>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e=>{addFiles(e.target.files); if(fileRef.current) fileRef.current.value="";}} />
            <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
              onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files);}}
              onClick={()=>fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[10px] border-2 border-dashed py-5 transition"
              style={{ borderColor:dragging?"var(--accent)":"var(--border-2)", background:dragging?"var(--accent-subtle)":"var(--surface-2)" }}>
              <File size={20} style={{ color:"var(--text-faint)" }} />
              <p className="text-[13px] font-semibold" style={{ color:"var(--text-muted)" }}>파일 첨부 (선택)</p>
              <p className="crm-tiny">클릭하거나 드래그하여 파일을 업로드하세요</p>
            </div>
            {/* 기존 첨부파일 (수정 모드) */}
            {existing.length > 0 && (
              <div className="mt-2 space-y-1">
                {existing.map((e,i)=>(
                  <div key={`ex-${i}`} className="flex items-center gap-2 rounded-[8px] px-3 py-2"
                    style={{ background:"var(--surface-2)", border:"1px solid var(--border)" }}>
                    <File size={13} style={{ color:"var(--accent-text)" }} />
                    <span className="flex-1 truncate text-[12px] font-semibold" style={{ color:"var(--text)" }}>{e.name}</span>
                    <span className="crm-tiny" style={{ color:"var(--text-faint)" }}>기존</span>
                    <button type="button" onClick={()=>setExisting(p=>p.filter((_,j)=>j!==i))} style={{ color:"var(--text-faint)" }}><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}
            {/* 새로 추가한 파일 */}
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f,i)=>(
                  <div key={`new-${i}`} className="flex items-center gap-2 rounded-[8px] px-3 py-2"
                    style={{ background:"var(--surface-2)", border:"1px solid var(--border)" }}>
                    <File size={13} style={{ color:"var(--accent-text)" }} />
                    <span className="flex-1 truncate text-[12px] font-semibold" style={{ color:"var(--text)" }}>{f.name}</span>
                    <button type="button" onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} style={{ color:"var(--text-faint)" }}><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="crm-tiny mb-1">내용 *</p>
            <textarea className="min-h-[480px] w-full resize-none rounded-[8px] border px-3 py-3 text-[13px] font-semibold leading-relaxed outline-none"
              style={IS} value={content} onChange={e=>setContent(e.target.value)} placeholder="공지사항 내용을 입력하세요" />
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 px-6 py-4" style={{ borderTop:"1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary">취소</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary">
            {saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}{isEdit ? "수정" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━ 메인 페이지 ━━━
export default function NoticesPage() {
  const [notices, setNotices]   = useState<Notice[]>([]);
  const [reads, setReads]       = useState<NoticeRead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setCreate] = useState(false);
  const [editTarget, setEdit]   = useState<Notice|null>(null);
  const [selected, setSelected] = useState<Notice|null>(null);
  const [panelIn, setPanelIn]   = useState(false);
  const [me, setMe]             = useState("");
  const [isAdmin, setIsAdmin]   = useState(false);

  useEffect(() => {
    const { name, isAdmin: a } = getUser();
    setMe(name); setIsAdmin(a);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [nr, rr] = await Promise.all([
      supabase.from("notices").select("*").order("created_at", { ascending: false }),
      supabase.from("notice_reads").select("notice_id,user_name"),
    ]);
    setNotices((nr.data||[]) as Notice[]);
    setReads((rr.data||[]) as NoticeRead[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNotice = (n: Notice) => { setSelected(n); setTimeout(()=>setPanelIn(true), 10); };
  const closePanel = () => { setPanelIn(false); setTimeout(()=>setSelected(null), 300); };
  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("notices").delete().eq("id", id);
    closePanel(); load();
  };

  const handleToggleRead = async (noticeId: number, userName: string) => {
    // 본인만 토글 가능
    if (userName !== me) return;
    const isAlreadyRead = reads.some(r => r.notice_id === noticeId && r.user_name === userName);
    if (isAlreadyRead) {
      await supabase.from("notice_reads")
        .delete()
        .eq("notice_id", noticeId)
        .eq("user_name", userName);
    } else {
      await supabase.from("notice_reads")
        .upsert({ notice_id: noticeId, user_name: userName }, { onConflict: "notice_id,user_name" });
    }
    load();
  };

  const readCount = (id: number) => reads.filter(r=>r.notice_id===id).length;
  const readUsers = (id: number) => reads.filter(r=>r.notice_id===id).map(r=>r.user_name);

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="premium-header flex shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Megaphone size={20} style={{ color:"var(--accent-text)" }} />
            <h1 className="crm-title">공지사항</h1>
          </div>
          <p className="crm-subtitle mt-1">팀 공지 등록 및 확인</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={load} className="btn-premium btn-secondary"><RefreshCw size={14}/>새로고침</button>
          <button type="button" onClick={()=>setCreate(true)} className="btn-premium btn-primary"><Plus size={14}/>공지 등록</button>
        </div>
      </div>

      {/* 카드 컨테이너 */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-5 pb-5 md:px-7">
        <div className="flex h-full flex-col overflow-hidden rounded-[16px]"
          style={{ background:"var(--surface)", border:"1px solid var(--border-subtle)" }}>

          {/* 카드 상단 타이틀 바 — VIP활동DB 스타일 */}
          <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4"
            style={{ borderBottom:"1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <div className="premium-icon"><BarChart3 className="h-5 w-5"/></div>
              <div>
                <h2 className="crm-card-title text-[17px] font-[900]">공지사항 목록</h2>
                <p className="crm-tiny mt-0.5">전체 {notices.length}건</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-[850] badge-muted">
              <Filter className="h-4 w-4 flex-none"/>
              <span>공지사항명 · 작성자 · 작성일 · 게시기간 · 중요도 · 태그자 · 확인자 기준</span>
            </div>
          </div>

          {/* 테이블 */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1100px] border-collapse text-center">
              <thead>
                <tr className="text-xs font-[900] uppercase tracking-[0.08em]"
                  style={{ background:"var(--surface-2)", color:"var(--text-faint)", borderBottom:"1px solid var(--border-subtle)" }}>
                  <th className="px-5 py-4 text-left">공지사항명</th>
                  <th className="px-4 py-4">작성자</th>
                  <th className="px-4 py-4">작성일</th>
                  <th className="px-4 py-4">게시기간</th>
                  <th className="px-4 py-4">중요도</th>
                  <th className="px-4 py-4">태그자</th>
                  <th className="px-4 py-4">확인자</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-20">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" style={{ color:"var(--text-faint)" }}/>
                      <span className="crm-tiny">로딩 중...</span>
                    </div>
                  </td></tr>
                ) : notices.length === 0 ? (
                  <tr><td colSpan={7} className="py-20">
                    <p className="crm-tiny">등록된 공지사항이 없습니다</p>
                  </td></tr>
                ) : notices.map(notice => {
                  const cfg = IMP[notice.importance as Importance] || IMP["정보"];
                  const Icon = cfg.icon;
                  const active = isActive(notice);
                  const sel = selected?.id === notice.id;
                  const rc = readCount(notice.id);

                  return (
                    <tr key={notice.id} onClick={()=>openNotice(notice)}
                      className="cursor-pointer text-sm font-[680] transition hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                      style={{ color:"var(--text-muted)", borderBottom:"1px solid var(--border-subtle)", background: sel?"var(--surface-selected)":"transparent" }}>

                      {/* 공지사항명 */}
                      <td className="px-5 py-4 text-left">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {!active && (
                                <span className="inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold"
                                  style={{ background:"var(--surface-3)", color:"var(--text-faint)" }}>만료</span>
                              )}
                              <p className="truncate font-[900] max-w-[320px]" style={{ color:"var(--text-strong)" }}>
                                {notice.title}
                              </p>
                            </div>
                        </div>
                      </td>

                      {/* 작성자 */}
                      <td className="px-4 py-4">
                        <span className="text-[13px] font-[760]" style={{ color:"var(--text)" }}>{notice.author}</span>
                      </td>

                      {/* 작성일 */}
                      <td className="px-4 py-4">
                        <span className="text-[13px]">{fmtDate(notice.created_at)}</span>
                      </td>

                      {/* 게시기간 — 가로 배열 */}
                      <td className="px-4 py-4">
                        <span className="whitespace-nowrap text-[13px]">
                          {fmtDate(notice.start_date)} ~ {fmtDate(notice.end_date)}
                        </span>
                      </td>

                      {/* 중요도 */}
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
                          style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color }}>
                          <Icon size={11}/>{notice.importance}
                        </span>
                      </td>

                      {/* 태그자 */}
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                          style={{ background:"var(--surface-2)", border:"1px solid var(--border-subtle)" }}>
                          <Tag size={11} style={{ color:"var(--text-faint)" }}/>
                          <span className="text-[13px] font-[760]" style={{ color:"var(--text-muted)" }}>
                            {notice.tagged?.length || 0}명
                          </span>
                        </div>
                      </td>

                      {/* 확인자 */}
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                          style={{ background: rc > 0 ? "var(--success-bg)" : "var(--surface-2)", border:`1px solid ${rc > 0 ? "var(--success-border)" : "var(--border-subtle)"}` }}>
                          <Eye size={11} style={{ color: rc > 0 ? "var(--success-text)" : "var(--text-faint)" }}/>
                          <span className="text-[13px] font-[760]" style={{ color: rc > 0 ? "var(--success-text)" : "var(--text-muted)" }}>
                            {rc}명
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 슬라이드 패널 */}
        {selected && (
          <>
            <div className="absolute inset-0 z-10"
              style={{ background:"rgba(0,0,0,0.3)", opacity:panelIn?1:0, transition:"opacity 0.3s ease" }}
              onClick={closePanel}/>
            <div className="absolute bottom-0 right-0 top-0 z-20 flex flex-col overflow-hidden"
              style={{ width:"500px", background:"var(--surface)", borderLeft:"1px solid var(--border-subtle)", borderRadius:"0 16px 16px 0", transform:panelIn?"translateX(0)":"translateX(100%)", transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
              {(() => {
                const n = selected;
                const cfg = IMP[n.importance as Importance] || IMP["정보"];
                const Icon = cfg.icon;
                const ru = readUsers(n.id);
                const fileUrls = n.file_urls || (n.image_url ? [n.image_url] : []);
                const canEdit = isAdmin || n.author === me;
                const fileLabel = (url: string, i: number) => n.file_names?.[i] || getFileName(url);
                return (
                  <>
                    <div className="flex shrink-0 items-center gap-2 px-5 py-3"
                      style={{ background:cfg.bg, borderBottom:`1px solid ${cfg.border}` }}>
                      <Icon size={14} style={{ color:cfg.color }}/>
                      <span className="text-[12px] font-black" style={{ color:cfg.color }}>{n.importance}</span>
                      <span className="ml-auto crm-tiny">{fmtDate(n.start_date)} ~ {fmtDate(n.end_date)}</span>
                      {canEdit && (
                        <button type="button" onClick={()=>setEdit(n)}
                          className="flex h-7 w-7 items-center justify-center rounded-[6px]"
                          style={{ background:"var(--accent-subtle)", color:"var(--accent-text)" }} title="수정">
                          <Pencil size={13}/>
                        </button>
                      )}
                      {canEdit && (
                        <button type="button" onClick={()=>handleDelete(n.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-[6px]"
                          style={{ background:"rgba(239,68,68,0.15)", color:"#ef4444" }} title="삭제">
                          <Trash2 size={13}/>
                        </button>
                      )}
                      <button type="button" onClick={closePanel}
                        className="flex h-7 w-7 items-center justify-center rounded-[6px]"
                        style={{ color:"var(--text-subtle)", background:"var(--surface-3)" }}>
                        <X size={14}/>
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {n.image_url && IMG_RE.test(n.image_url) && (
                        <div style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                          <img src={n.image_url} alt="공지 이미지" className="max-h-[200px] w-full object-contain"
                            style={{ background:"var(--surface-2)" }}/>
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="mb-1 text-[18px] font-[900]" style={{ color:"var(--text-strong)" }}>{n.title}</h3>
                        <div className="mb-4 flex flex-wrap gap-3">
                          <span className="crm-tiny">작성자: {n.author}</span>
                          <span className="crm-tiny">등록일: {fmtDate(n.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-[13px] font-[600] leading-relaxed" style={{ color:"var(--text)" }}>
                          {n.content}
                        </p>
                        {n.tagged?.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {n.tagged.map(t=>(
                              <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                                style={{ background:"var(--accent-subtle)", color:"var(--accent-text)", border:"1px solid var(--accent-border)" }}>
                                @{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {fileUrls.length > 0 && (
                        <div className="px-5 pb-4" style={{ borderTop:"1px solid var(--border-subtle)" }}>
                          <p className="crm-tiny mb-2 mt-4">첨부파일 ({fileUrls.length}개)</p>
                          <div className="space-y-1.5">
                            {fileUrls.map((url,i)=>(
                              <button key={i} type="button"
                                onClick={(e)=>{ e.stopPropagation(); downloadNoticeFile(url, fileLabel(url,i)); }}
                                className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left transition hover:opacity-80"
                                style={{ background:"var(--surface-2)", border:"1px solid var(--border)" }}>
                                <File size={13} style={{ color:"var(--accent-text)" }}/>
                                <span className="flex-1 truncate text-[12px] font-semibold" style={{ color:"var(--text)" }}>{fileLabel(url,i)}</span>
                                <Download size={12} style={{ color:"var(--text-faint)" }}/>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-5" style={{ borderTop:"1px solid var(--border-subtle)" }}>
                        <div className="mb-3 flex items-center gap-2">
                          <Eye size={14} style={{ color:"var(--accent-text)" }}/>
                          <span className="text-[13px] font-[900]" style={{ color:"var(--text-strong)" }}>확인 현황</span>
                          <span className="crm-tiny ml-1">{ru.length}/{TEAM.length}명</span>
                        </div>
                        <p className="crm-tiny mb-2">본인 이름을 클릭하여 확인 처리할 수 있습니다</p>
                        <div className="flex flex-wrap gap-1.5">
                          {TEAM.map(name=>{
                            const done=ru.includes(name);
                            const isMe=name===me;
                            return (
                              <button key={name} type="button"
                                onClick={() => isMe && handleToggleRead(n.id, name)}
                                disabled={!isMe}
                                title={isMe ? (done ? "클릭하여 확인 취소" : "클릭하여 확인 완료") : ""}
                                className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold transition"
                                style={{
                                  background: done ? "var(--success-bg)" : "var(--surface-2)",
                                  border: `1px solid ${done ? "var(--success-border)" : "var(--border-subtle)"}`,
                                  color: done ? "var(--success-text)" : "var(--text-muted)",
                                  cursor: isMe ? "pointer" : "default",
                                  outline: isMe ? `2px solid var(--accent-border)` : "none",
                                  outlineOffset: isMe ? "1px" : "0",
                                }}>
                                {done?<Check size={10}/>:<X size={10}/>}{name}{isMe && " (나)"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* 등록 모달 */}
      {showCreate && (
        <NoticeModal me={me} editing={null}
          onClose={()=>setCreate(false)}
          onSaved={()=>{ setCreate(false); load(); }}/>
      )}
      {/* 수정 모달 */}
      {editTarget && (
        <NoticeModal me={me} editing={editTarget}
          onClose={()=>setEdit(null)}
          onSaved={()=>{ setEdit(null); closePanel(); load(); }}/>
      )}
    </div>
  );
}
