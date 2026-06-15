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
  Shield,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

type NoticeRead = {
  notice_id: number;
  user_name: string;
};

const IMPORTANCE_LIST: Importance[] = ["긴급", "높음", "보통", "낮음", "정보"];

const IMPORTANCE_CONFIG: Record<Importance, { icon: any; color: string; bg: string; border: string }> = {
  긴급: { icon: Zap,           color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)" },
  높음: { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)" },
  보통: { icon: Bell,          color: "var(--accent-text)", bg: "var(--accent-subtle)", border: "var(--accent-border)" },
  낮음: { icon: Info,          color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)" },
  정보: { icon: Shield,        color: "var(--text-subtle)", bg: "var(--surface-2)", border: "var(--border-subtle)" },
};

const TEAM = ["김정후","김창완","최웅","조계현","이세호","기여운","최연전","김재영","최은정"];
const ADMIN_NAMES = ["문시욱","김정후","김창완","최웅"];

function getUser(): { name: string; isAdmin: boolean } {
  try {
    const raw = localStorage.getItem("crm_user");
    if (raw) {
      const u = JSON.parse(raw);
      const name = String(u?.name || "");
      const role = String(u?.role || "").toLowerCase();
      return { name, isAdmin: role === "admin" || ADMIN_NAMES.includes(name) };
    }
  } catch {}
  return { name: "", isAdmin: false };
}

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d: string) {
  if (!d) return "-";
  const raw = d.slice(0, 10);
  const [y, m, dd] = raw.split("-");
  if (!y || !m || !dd) return raw;
  return `${y}.${m}.${dd}`;
}

function isActive(notice: Notice) {
  const t = today();
  return notice.start_date <= t && notice.end_date >= t;
}

function getFileName(url: string) {
  try {
    const parts = url.split("/");
    const name = parts[parts.length - 1];
    // 타임스탬프_ 제거
    return name.replace(/^\d+_/, "");
  } catch { return url; }
}

function getFileIcon(url: string) {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(lower)) return Image;
  if (/\.(pdf)/.test(lower)) return FileText;
  return File;
}

// ── 등록 모달 ──
function NoticeCreateModal({ onClose, onSaved, me }: { onClose: () => void; onSaved: () => void; me: string }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState<Importance>("보통");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [tagged, setTagged] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allSelected = tagged.length === TEAM.filter(n => n !== me).length;
  const toggleAll = () => {
    const others = TEAM.filter(n => n !== me);
    setTagged(allSelected ? [] : others);
  };
  const toggleTag = (name: string) =>
    setTagged(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles(prev => [...prev, ...Array.from(newFiles)]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSave = async () => {
    if (!title.trim()) { alert("제목을 입력하세요."); return; }
    if (!content.trim()) { alert("내용을 입력하세요."); return; }
    if (startDate > endDate) { alert("종료일이 시작일보다 앞설 수 없습니다."); return; }
    setSaving(true);
    try {
      const fileUrls: string[] = [];
      for (const file of files) {
        const fileName = `notices/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("notice-images").upload(fileName, file, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from("notice-images").getPublicUrl(fileName);
          if (data?.publicUrl) fileUrls.push(data.publicUrl);
        }
      }
      const { error } = await supabase.from("notices").insert({
        title: title.trim(),
        content: content.trim(),
        importance,
        image_url: fileUrls.length > 0 ? fileUrls[0] : null,
        file_urls: fileUrls.length > 0 ? fileUrls : null,
        author: me,
        start_date: startDate,
        end_date: endDate,
        tagged,
      });
      if (error) throw error;
      onSaved();
    } catch (err: any) {
      alert("저장 실패: " + (err?.message || "오류"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <Megaphone size={18} style={{ color: "var(--accent-text)" }} />
            <h2 className="crm-section-title">공지사항 등록</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary h-8 w-8 p-0"><X size={15} /></button>
        </div>

        {/* 본문 */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* 제목 */}
          <div>
            <label className="mb-1 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>제목 *</label>
            <input className="h-10 w-full rounded-[10px] border px-3 text-[14px] font-semibold outline-none"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
              value={title} onChange={e => setTitle(e.target.value)} placeholder="공지사항 제목" />
          </div>

          {/* 중요도 */}
          <div>
            <label className="mb-2 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>중요도</label>
            <div className="flex flex-wrap gap-2">
              {IMPORTANCE_LIST.map(imp => {
                const cfg = IMPORTANCE_CONFIG[imp];
                const Icon = cfg.icon;
                const active = importance === imp;
                return (
                  <button key={imp} type="button" onClick={() => setImportance(imp)}
                    className="flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12px] font-bold transition"
                    style={{ background: active ? cfg.bg : "var(--surface-2)", borderColor: active ? cfg.border : "var(--border)", color: active ? cfg.color : "var(--text-muted)" }}>
                    <Icon size={13} />{imp}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 게시 기간 */}
          <div>
            <label className="mb-2 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>게시 기간 *</label>
            <div className="flex items-center gap-3">
              <input type="date" className="h-9 flex-1 rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
                value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-[13px]" style={{ color: "var(--text-subtle)" }}>~</span>
              <input type="date" className="h-9 flex-1 rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
                value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* 태그자 */}
          <div>
            <label className="mb-2 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>태그자 (알림 대상)</label>
            <div className="flex flex-wrap gap-1.5">
              {/* 모두 버튼 */}
              <button type="button" onClick={toggleAll}
                className="rounded-[8px] border px-2.5 py-1 text-[12px] font-bold transition"
                style={{ background: allSelected ? "var(--accent-subtle)" : "var(--surface-2)", borderColor: allSelected ? "var(--accent-border)" : "var(--border)", color: allSelected ? "var(--accent-text)" : "var(--text-muted)" }}>
                모두
              </button>
              {TEAM.filter(n => n !== me).map(name => {
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
            <label className="mb-2 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>파일 첨부</label>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed py-6 transition"
              style={{ borderColor: dragging ? "var(--accent)" : "var(--border-2)", background: dragging ? "var(--accent-subtle)" : "var(--surface-2)", color: "var(--text-muted)" }}>
              <File size={22} style={{ color: dragging ? "var(--accent-text)" : "var(--text-faint)" }} />
              <p className="text-[13px] font-semibold">파일 첨부 (선택)</p>
              <p className="text-[11px]">클릭하거나 파일을 여기로 드래그하세요</p>
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((f, i) => {
                  const FileIcon = getFileIcon(f.name);
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-[8px] px-3 py-2"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <FileIcon size={14} style={{ color: "var(--accent-text)" }} />
                      <span className="flex-1 truncate text-[12px] font-semibold" style={{ color: "var(--text)" }}>{f.name}</span>
                      <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="shrink-0" style={{ color: "var(--text-faint)" }}><X size={13} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 내용 — 3배 크기 */}
          <div>
            <label className="mb-1 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>내용 *</label>
            <textarea className="min-h-[480px] w-full resize-none rounded-[10px] border px-3 py-3 text-[13px] font-semibold leading-relaxed outline-none"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="공지사항 내용을 입력하세요" />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex shrink-0 items-center justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary">취소</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}등록
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──
export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads] = useState<NoticeRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [me, setMe] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { name, isAdmin: admin } = getUser();
    setMe(name);
    setIsAdmin(admin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [noticeRes, readRes] = await Promise.all([
      supabase.from("notices").select("*").order("created_at", { ascending: false }),
      supabase.from("notice_reads").select("notice_id,user_name"),
    ]);
    setNotices((noticeRes.data || []) as Notice[]);
    setReads((readRes.data || []) as NoticeRead[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNotice = (notice: Notice) => {
    setSelectedNotice(notice);
    setTimeout(() => setPanelVisible(true), 10);
  };

  const closePanel = () => {
    setPanelVisible(false);
    setTimeout(() => setSelectedNotice(null), 300);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;
    await supabase.from("notices").delete().eq("id", id);
    closePanel();
    load();
  };

  const getReadCount = (noticeId: number) => reads.filter(r => r.notice_id === noticeId).length;
  const getReadUsers = (noticeId: number) => reads.filter(r => r.notice_id === noticeId).map(r => r.user_name);

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
        <button type="button" onClick={() => setShowCreate(true)} className="btn-premium btn-primary h-9 px-4 text-[13px]">
          <Plus size={14} /> 공지 등록
        </button>
      </div>

      {/* 목록 전체화면 */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-5 pb-5 md:px-7">
        <div className="h-full overflow-hidden rounded-[16px]"
          style={{ border: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[1fr_140px_100px_64px] gap-2 border-b px-5 py-3 text-[11px] font-black"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-subtle)", background: "var(--surface-2)" }}>
            <span>공지사항명 / 작성자</span>
            <span className="text-center">게시기간</span>
            <span className="text-center">중요도</span>
            <span className="text-center">확인</span>
          </div>

          <div className="min-h-0 overflow-y-auto" style={{ height: "calc(100% - 42px)" }}>
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-faint)" }} />
              </div>
            ) : notices.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <p className="text-[13px]" style={{ color: "var(--text-faint)" }}>등록된 공지사항이 없습니다</p>
              </div>
            ) : notices.map(notice => {
              const ic = IMPORTANCE_CONFIG[notice.importance as Importance] || IMPORTANCE_CONFIG["정보"];
              const Icon = ic.icon;
              const active = isActive(notice);
              const selected = selectedNotice?.id === notice.id;

              return (
                <button key={notice.id} type="button" onClick={() => openNotice(notice)}
                  className="grid w-full grid-cols-[1fr_140px_100px_64px] items-center gap-2 border-b px-5 py-3.5 text-left transition hover:opacity-80"
                  style={{ borderColor: "var(--border-subtle)", background: selected ? "var(--surface-selected)" : "transparent" }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!active && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>만료</span>}
                      <span className="truncate text-[14px] font-bold" style={{ color: "var(--text-strong)" }}>{notice.title}</span>
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{notice.author} · {fmtDate(notice.created_at)}</span>
                  </div>
                  <div className="text-center text-[11px]" style={{ color: "var(--text-subtle)" }}>
                    <div>{fmtDate(notice.start_date)}</div>
                    <div>~{fmtDate(notice.end_date)}</div>
                  </div>
                  <div className="flex justify-center">
                    <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: ic.bg, border: `1px solid ${ic.border}`, color: ic.color }}>
                      <Icon size={11} />{notice.importance}
                    </span>
                  </div>
                  <div className="text-center text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>
                    {getReadCount(notice.id)}명
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 슬라이드 패널 (오른쪽→왼쪽) */}
        {selectedNotice && (
          <>
            {/* 오버레이 */}
            <div
              className="absolute inset-0 z-10"
              style={{ background: "rgba(0,0,0,0.3)", opacity: panelVisible ? 1 : 0, transition: "opacity 0.3s ease" }}
              onClick={closePanel}
            />
            {/* 패널 */}
            <div
              className="absolute bottom-0 right-0 top-0 z-20 flex flex-col overflow-hidden rounded-r-[16px]"
              style={{
                width: "480px",
                background: "var(--surface)",
                borderLeft: "1px solid var(--border-subtle)",
                transform: panelVisible ? "translateX(0)" : "translateX(100%)",
                transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
              }}>
              {(() => {
                const notice = selectedNotice;
                const ic = IMPORTANCE_CONFIG[notice.importance as Importance] || IMPORTANCE_CONFIG["정보"];
                const Icon = ic.icon;
                const readUsers = getReadUsers(notice.id);
                const fileUrls = notice.file_urls || (notice.image_url ? [notice.image_url] : []);

                return (
                  <>
                    {/* 상단 배너 */}
                    <div className="flex shrink-0 items-center gap-2 px-5 py-3"
                      style={{ background: ic.bg, borderBottom: `1px solid ${ic.border}` }}>
                      <Icon size={15} style={{ color: ic.color }} />
                      <span className="text-[12px] font-black" style={{ color: ic.color }}>{notice.importance}</span>
                      <span className="ml-auto text-[11px]" style={{ color: "var(--text-subtle)" }}>
                        {fmtDate(notice.start_date)} ~ {fmtDate(notice.end_date)}
                      </span>
                      {(isAdmin || notice.author === me) && (
                        <button type="button" onClick={() => handleDelete(notice.id)}
                          className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button type="button" onClick={closePanel}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:opacity-70"
                        style={{ color: "var(--text-subtle)" }}>
                        <X size={15} />
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {/* 이미지 */}
                      {notice.image_url && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(notice.image_url) && (
                        <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <img src={notice.image_url} alt="공지 이미지"
                            className="max-h-[220px] w-full object-contain"
                            style={{ background: "var(--surface-2)" }} />
                        </div>
                      )}

                      {/* 본문 */}
                      <div className="p-5">
                        <h3 className="mb-3 text-[18px] font-black" style={{ color: "var(--text-strong)" }}>
                          {notice.title}
                        </h3>
                        <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed" style={{ color: "var(--text)" }}>
                          {notice.content}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>
                          <span>작성자: {notice.author}</span>
                          <span>등록일: {fmtDate(notice.created_at)}</span>
                        </div>
                        {notice.tagged?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {notice.tagged.map(t => (
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
                          <p className="mb-2 mt-4 text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>첨부파일</p>
                          <div className="space-y-2">
                            {fileUrls.map((url, i) => {
                              const FileIcon = getFileIcon(url);
                              const fname = getFileName(url);
                              return (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" download={fname}
                                  className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 transition hover:opacity-80"
                                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                                  <FileIcon size={15} style={{ color: "var(--accent-text)" }} />
                                  <span className="flex-1 truncate text-[12px] font-semibold" style={{ color: "var(--text)" }}>{fname}</span>
                                  <Download size={13} style={{ color: "var(--text-faint)" }} />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 확인 현황 */}
                      <div className="p-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <div className="mb-3 flex items-center gap-2">
                          <Eye size={14} style={{ color: "var(--accent-text)" }} />
                          <span className="text-[13px] font-black" style={{ color: "var(--text-strong)" }}>
                            확인 현황 ({readUsers.length}/{TEAM.length}명)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {TEAM.map(name => {
                            const confirmed = readUsers.includes(name);
                            return (
                              <div key={name} className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
                                style={{ background: confirmed ? "var(--success-bg)" : "var(--surface-2)", border: `1px solid ${confirmed ? "var(--success-border)" : "var(--border-subtle)"}`, color: confirmed ? "var(--success-text)" : "var(--text-muted)" }}>
                                {confirmed ? <Check size={11} /> : <X size={11} />}{name}
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
        <NoticeCreateModal me={me} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}
