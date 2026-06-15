"use client";

import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Bell,
  Check,
  Download,
  Eye,
  File,
  FileText,
  Image,
  Info,
  Loader2,
  Megaphone,
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
  id: number;
  title: string;
  content: string;
  importance: Importance;
  image_url: string | null;
  file_urls: string[] | null;
  author: string;
  start_date: string;
  end_date: string;
  tagged: string[];
  created_at: string;
};

type NoticeRead = { notice_id: number; user_name: string; };

// ━━━ 상수 ━━━
const IMPORTANCE_LIST: Importance[] = ["긴급", "높음", "보통", "낮음", "정보"];

const IMP: Record<Importance, { icon: any; color: string; bg: string; border: string; label: string }> = {
  긴급: { icon: Zap,           color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  label: "🔴 긴급" },
  높음: { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", label: "🟠 높음" },
  보통: { icon: Bell,          color: "var(--accent-text)", bg: "var(--accent-subtle)", border: "var(--accent-border)", label: "🔵 보통" },
  낮음: { icon: Info,          color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)", label: "🟢 낮음" },
  정보: { icon: Shield,        color: "var(--text-muted)", bg: "var(--surface-3)", border: "var(--border-subtle)", label: "⚫ 정보" },
};

const TEAM = ["김정후","김창완","최웅","조계현","이세호","기여운","최연전","김재영","최은정"];
const ADMIN_NAMES = ["문시욱","김정후","김창완","최웅"];

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
  if (s.length < 3) return d.slice(0,10);
  return `${s[0]}.${s[1]}.${s[2]}`;
}

function isActive(n: Notice) {
  const t = today();
  return n.start_date <= t && n.end_date >= t;
}

function getFileName(url: string) {
  try { return decodeURIComponent(url.split("/").pop()!).replace(/^\d+_/, ""); } catch { return url; }
}

function FileIcon({ url }: { url: string }) {
  const ext = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(ext)) return <Image size={13} />;
  if (/\.pdf/.test(ext)) return <FileText size={13} />;
  return <File size={13} />;
}

// ━━━ 등록 모달 ━━━
function CreateModal({ me, onClose, onSaved }: { me: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle]         = useState("");
  const [content, setContent]     = useState("");
  const [importance, setImp]      = useState<Importance>("보통");
  const [startDate, setStart]     = useState(today());
  const [endDate, setEnd]         = useState(() => { const d=new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10); });
  const [tagged, setTagged]       = useState<string[]>([]);
  const [files, setFiles]         = useState<File[]>([]);
  const [saving, setSaving]       = useState(false);
  const [dragging, setDragging]   = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);

  const others = TEAM.filter(n => n !== me);
  const allSelected = tagged.length === others.length && others.length > 0;
  const toggleAll = () => setTagged(allSelected ? [] : others);
  const toggleTag = (n: string) => setTagged(p => p.includes(n) ? p.filter(t => t!==n) : [...p,n]);
  const addFiles  = (fl: FileList|null) => { if (fl) setFiles(p => [...p, ...Array.from(fl)]); };

  const handleSave = async () => {
    if (!title.trim()) { alert("제목을 입력하세요."); return; }
    if (!content.trim()) { alert("내용을 입력하세요."); return; }
    if (startDate > endDate) { alert("종료일이 시작일보다 앞설 수 없습니다."); return; }
    setSaving(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const path = `notices/${Date.now()}_${f.name}`;
        const { error } = await supabase.storage.from("notice-images").upload(path, f, { upsert: true });
        if (!error) {
          const { data } = supabase.storage.from("notice-images").getPublicUrl(path);
          if (data?.publicUrl) urls.push(data.publicUrl);
        }
      }
      const { error } = await supabase.from("notices").insert({
        title: title.trim(), content: content.trim(), importance,
        image_url: urls[0] || null, file_urls: urls.length ? urls : null,
        author: me, start_date: startDate, end_date: endDate, tagged,
      });
      if (error) throw error;
      onSaved();
    } catch (e: any) { alert("저장 실패: " + (e?.message || "오류")); }
    finally { setSaving(false); }
  };

  const inputCls = "h-9 w-full rounded-[8px] border px-3 text-[13px] font-semibold outline-none";
  const inputSt  = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <Megaphone size={17} style={{ color: "var(--accent-text)" }} />
            <h2 className="crm-section-title">공지사항 등록</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-8 w-8 p-0"><X size={14} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* 제목 */}
          <div>
            <p className="crm-tiny mb-1">제목 *</p>
            <input className={`h-10 w-full rounded-[8px] border px-3 text-[14px] font-bold outline-none`}
              style={inputSt} value={title} onChange={e => setTitle(e.target.value)} placeholder="공지사항 제목" />
          </div>

          {/* 중요도 */}
          <div>
            <p className="crm-tiny mb-2">중요도</p>
            <div className="flex flex-wrap gap-2">
              {IMPORTANCE_LIST.map(imp => {
                const cfg = IMP[imp]; const active = importance === imp; const Icon = cfg.icon;
                return (
                  <button key={imp} type="button" onClick={() => setImp(imp)}
                    className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-bold transition"
                    style={{ background: active ? cfg.bg : "var(--surface-2)", borderColor: active ? cfg.border : "var(--border)", color: active ? cfg.color : "var(--text-muted)" }}>
                    <Icon size={12} />{imp}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 게시기간 */}
          <div>
            <p className="crm-tiny mb-2">게시 기간 *</p>
            <div className="flex items-center gap-2">
              <input type="date" className={inputCls} style={inputSt} value={startDate} onChange={e => setStart(e.target.value)} />
              <span className="crm-tiny">~</span>
              <input type="date" className={inputCls} style={inputSt} value={endDate} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>

          {/* 태그자 */}
          <div>
            <p className="crm-tiny mb-2">태그자 (알림 대상)</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={toggleAll}
                className="rounded-[8px] border px-2.5 py-1 text-[12px] font-bold transition"
                style={{ background: allSelected ? "var(--accent-subtle)" : "var(--surface-2)", borderColor: allSelected ? "var(--accent-border)" : "var(--border)", color: allSelected ? "var(--accent-text)" : "var(--text-muted)" }}>
                모두
              </button>
              {others.map(name => {
                const active = tagged.includes(name);
                return (
                  <button key={name} type="button" onClick={() => toggleTag(name)}
                    className="rounded-[8px] border px-2.5 py-1 text-[12px] font-bold transition"
                    style={{ background: active ? "var(--accent-subtle)" : "var(--surface-2)", borderColor: active ? "var(--accent-border)" : "var(--border)", color: active ? "var(--accent-text)" : "var(--text-muted)" }}>
                    @{name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 파일첨부 */}
          <div>
            <p className="crm-tiny mb-2">파일 첨부</p>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
            <div onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[10px] border-2 border-dashed py-5 transition"
              style={{ borderColor: dragging ? "var(--accent)" : "var(--border-2)", background: dragging ? "var(--accent-subtle)" : "var(--surface-2)" }}>
              <File size={20} style={{ color: "var(--text-faint)" }} />
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>파일 첨부 (선택)</p>
              <p className="crm-tiny">클릭하거나 드래그하여 파일을 업로드하세요</p>
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-[8px] px-3 py-2"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <File size={13} style={{ color: "var(--accent-text)" }} />
                    <span className="flex-1 truncate text-[12px] font-semibold" style={{ color: "var(--text)" }}>{f.name}</span>
                    <button type="button" onClick={() => setFiles(p => p.filter((_,j)=>j!==i))} style={{ color: "var(--text-faint)" }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 내용 */}
          <div>
            <p className="crm-tiny mb-1">내용 *</p>
            <textarea className="min-h-[480px] w-full resize-none rounded-[8px] border px-3 py-3 text-[13px] font-semibold leading-relaxed outline-none"
              style={inputSt} value={content} onChange={e => setContent(e.target.value)} placeholder="공지사항 내용을 입력하세요" />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary">취소</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}등록
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
  const [selected, setSelected] = useState<Notice | null>(null);
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

  const openNotice = (n: Notice) => { setSelected(n); setTimeout(() => setPanelIn(true), 10); };
  const closePanel = () => { setPanelIn(false); setTimeout(() => setSelected(null), 300); };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("notices").delete().eq("id", id);
    closePanel(); load();
  };

  const readCount = (id: number) => reads.filter(r => r.notice_id === id).length;
  const readUsers = (id: number) => reads.filter(r => r.notice_id === id).map(r => r.user_name);

  // 테이블 컬럼 정의 (공지사항명/작성자 | 작성일 | 게시기간 | 중요도 | 태그자 | 확인자)
  const COL = "grid-cols-[1fr_90px_140px_90px_70px_70px]";

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="premium-header flex shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Megaphone size={20} style={{ color: "var(--accent-text)" }} />
            <h1 className="crm-title">공지사항</h1>
          </div>
          <p className="crm-subtitle mt-1">팀 공지 등록 및 확인</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={load} className="btn-premium btn-secondary">
            <RefreshCw size={14} />새로고침
          </button>
          <button type="button" onClick={() => setCreate(true)} className="btn-premium btn-primary">
            <Plus size={14} />공지 등록
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-5 pb-5 md:px-7">
        <div className="flex h-full flex-col overflow-hidden rounded-[16px] premium-card">

          {/* 테이블 헤더 */}
          <div className={`grid ${COL} shrink-0 gap-3 border-b px-5 py-3`}
            style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)" }}>
            {["공지사항명 / 작성자","작성일","게시기간","중요도","태그자","확인자"].map(h => (
              <span key={h} className="crm-tiny text-center first:text-left">{h}</span>
            ))}
          </div>

          {/* 목록 */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-faint)" }} />
              </div>
            ) : notices.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <p className="crm-tiny">등록된 공지사항이 없습니다</p>
              </div>
            ) : notices.map(notice => {
              const cfg = IMP[notice.importance as Importance] || IMP["정보"];
              const Icon = cfg.icon;
              const active = isActive(notice);
              const sel = selected?.id === notice.id;

              return (
                <button key={notice.id} type="button" onClick={() => openNotice(notice)}
                  className={`grid w-full ${COL} items-center gap-3 border-b px-5 py-3.5 text-left transition hover:opacity-80`}
                  style={{ borderColor: "var(--border-subtle)", background: sel ? "var(--surface-selected)" : "transparent" }}>

                  {/* 공지사항명 / 작성자 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!active && (
                        <span className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>만료</span>
                      )}
                      <span className="truncate text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>
                        {notice.title}
                      </span>
                    </div>
                    <span className="crm-tiny">{notice.author}</span>
                  </div>

                  {/* 작성일 */}
                  <span className="text-center text-[12px] font-semibold" style={{ color: "var(--text-subtle)" }}>
                    {fmtDate(notice.created_at)}
                  </span>

                  {/* 게시기간 */}
                  <div className="text-center">
                    <span className="text-[11px] font-semibold" style={{ color: "var(--text-subtle)" }}>
                      {fmtDate(notice.start_date)}<br />~{fmtDate(notice.end_date)}
                    </span>
                  </div>

                  {/* 중요도 */}
                  <div className="flex justify-center">
                    <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                      <Icon size={10} />{notice.importance}
                    </span>
                  </div>

                  {/* 태그자 */}
                  <div className="flex items-center justify-center gap-1">
                    <Tag size={11} style={{ color: "var(--text-faint)" }} />
                    <span className="text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>
                      {notice.tagged?.length || 0}명
                    </span>
                  </div>

                  {/* 확인자 */}
                  <div className="flex items-center justify-center gap-1">
                    <Eye size={11} style={{ color: "var(--text-faint)" }} />
                    <span className="text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>
                      {readCount(notice.id)}명
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 슬라이드 패널 */}
        {selected && (
          <>
            <div className="absolute inset-0 z-10"
              style={{ background: "rgba(0,0,0,0.3)", opacity: panelIn ? 1 : 0, transition: "opacity 0.3s ease" }}
              onClick={closePanel} />
            <div className="absolute bottom-0 right-0 top-0 z-20 flex flex-col overflow-hidden"
              style={{
                width: "520px",
                background: "var(--surface)",
                borderLeft: "1px solid var(--border-subtle)",
                borderRadius: "0 16px 16px 0",
                transform: panelIn ? "translateX(0)" : "translateX(100%)",
                transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
              }}>
              {(() => {
                const n = selected;
                const cfg = IMP[n.importance as Importance] || IMP["정보"];
                const Icon = cfg.icon;
                const ru = readUsers(n.id);
                const fileUrls = n.file_urls || (n.image_url ? [n.image_url] : []);

                return (
                  <>
                    {/* 상단 배너 */}
                    <div className="flex shrink-0 items-center gap-2 px-5 py-3"
                      style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
                      <Icon size={14} style={{ color: cfg.color }} />
                      <span className="text-[12px] font-black" style={{ color: cfg.color }}>{n.importance}</span>
                      <span className="ml-auto crm-tiny">{fmtDate(n.start_date)} ~ {fmtDate(n.end_date)}</span>
                      {(isAdmin || n.author === me) && (
                        <button type="button" onClick={() => handleDelete(n.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-[6px] transition hover:opacity-80"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button type="button" onClick={closePanel}
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] transition hover:opacity-70"
                        style={{ color: "var(--text-subtle)", background: "var(--surface-3)" }}>
                        <X size={14} />
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {/* 이미지 */}
                      {n.image_url && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(n.image_url) && (
                        <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <img src={n.image_url} alt="공지 이미지"
                            className="max-h-[200px] w-full object-contain"
                            style={{ background: "var(--surface-2)" }} />
                        </div>
                      )}

                      {/* 본문 */}
                      <div className="p-5">
                        <h3 className="mb-1 text-[17px] font-black" style={{ color: "var(--text-strong)" }}>{n.title}</h3>
                        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="crm-tiny">작성자: {n.author}</span>
                          <span className="crm-tiny">등록일: {fmtDate(n.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed" style={{ color: "var(--text)" }}>
                          {n.content}
                        </p>
                        {n.tagged?.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {n.tagged.map(t => (
                              <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                                style={{ background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}>
                                @{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 첨부파일 */}
                      {fileUrls.length > 0 && (
                        <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          <p className="crm-tiny mb-2 mt-4">첨부파일 ({fileUrls.length}개)</p>
                          <div className="space-y-1.5">
                            {fileUrls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" download={getFileName(url)}
                                className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 transition hover:opacity-80"
                                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                                <span style={{ color: "var(--accent-text)" }}><FileIcon url={url} /></span>
                                <span className="flex-1 truncate text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                                  {getFileName(url)}
                                </span>
                                <Download size={12} style={{ color: "var(--text-faint)" }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 확인 현황 */}
                      <div className="p-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <div className="mb-3 flex items-center gap-2">
                          <Eye size={14} style={{ color: "var(--accent-text)" }} />
                          <span className="text-[13px] font-black" style={{ color: "var(--text-strong)" }}>
                            확인 현황
                          </span>
                          <span className="crm-tiny ml-1">{ru.length}/{TEAM.length}명</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {TEAM.map(name => {
                            const done = ru.includes(name);
                            return (
                              <div key={name}
                                className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
                                style={{ background: done ? "var(--success-bg)" : "var(--surface-2)", border: `1px solid ${done ? "var(--success-border)" : "var(--border-subtle)"}`, color: done ? "var(--success-text)" : "var(--text-muted)" }}>
                                {done ? <Check size={10} /> : <X size={10} />}{name}
                              </div>
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

      {showCreate && (
        <CreateModal me={me} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); }} />
      )}
    </div>
  );
}
