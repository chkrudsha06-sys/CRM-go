"use client";

import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Image,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Shield,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// 타입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
type Importance = "긴급" | "높음" | "보통" | "낮음" | "정보";

type Notice = {
  id: number;
  title: string;
  content: string;
  importance: Importance;
  image_url: string | null;
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// 상수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
const IMPORTANCE_LIST: Importance[] = ["긴급", "높음", "보통", "낮음", "정보"];

const IMPORTANCE_CONFIG: Record<Importance, { icon: any; color: string; bg: string; border: string; badge: string }> = {
  긴급: { icon: Zap,           color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   badge: "bg-red-500" },
  높음: { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)",  badge: "bg-orange-500" },
  보통: { icon: Bell,          color: "var(--accent-text)", bg: "var(--accent-subtle)", border: "var(--accent-border)", badge: "bg-blue-500" },
  낮음: { icon: Info,          color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)", badge: "bg-green-500" },
  정보: { icon: Shield,        color: "var(--text-subtle)", bg: "var(--surface-2)", border: "var(--border-subtle)", badge: "bg-gray-400" },
};

const TEAM = [
  "김정후","김창완","최웅","조계현","이세호","기여운","최연전","김재영","최은정",
];

const ADMIN_NAMES = ["문시욱","김정후","김창완","최웅"];

function getUser(): { name: string; isAdmin: boolean } {
  try {
    const raw = localStorage.getItem("crm_user");
    if (raw) {
      const u = JSON.parse(raw);
      const name = String(u?.name || "");
      const role = String(u?.role || "").toLowerCase();
      return {
        name,
        isAdmin: role === "admin" || ADMIN_NAMES.includes(name),
      };
    }
  } catch {}
  return { name: "", isAdmin: false };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
}

function isActive(notice: Notice) {
  const t = today();
  return notice.start_date <= t && notice.end_date >= t;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// 공지사항 등록 모달
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
function NoticeCreateModal({
  onClose,
  onSaved,
  me,
}: {
  onClose: () => void;
  onSaved: () => void;
  me: string;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState<Importance>("보통");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [tagged, setTagged] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const toggleTag = (name: string) =>
    setTagged((prev) => prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]);

  const handleSave = async () => {
    if (!title.trim()) { alert("제목을 입력하세요."); return; }
    if (!content.trim()) { alert("내용을 입력하세요."); return; }
    if (startDate > endDate) { alert("게시 종료일이 시작일보다 앞설 수 없습니다."); return; }
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (imageFile) {
        const fileName = `notices/${Date.now()}_${imageFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("notice-images")
          .upload(fileName, imageFile, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from("notice-images").getPublicUrl(fileName);
          image_url = data?.publicUrl || null;
        }
      }
      const { error } = await supabase.from("notices").insert({
        title: title.trim(),
        content: content.trim(),
        importance,
        image_url,
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

  const ic = IMPORTANCE_CONFIG[importance];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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
              value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지사항 제목을 입력하세요" />
          </div>

          {/* 중요도 */}
          <div>
            <label className="mb-2 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>중요도</label>
            <div className="flex flex-wrap gap-2">
              {IMPORTANCE_LIST.map((imp) => {
                const cfg = IMPORTANCE_CONFIG[imp];
                const Icon = cfg.icon;
                const active = importance === imp;
                return (
                  <button key={imp} type="button" onClick={() => setImportance(imp)}
                    className="flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12px] font-bold transition"
                    style={{ background: active ? cfg.bg : "var(--surface-2)", borderColor: active ? cfg.border : "var(--border)", color: active ? cfg.color : "var(--text-muted)" }}>
                    <Icon size={13} />
                    {imp}
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
                value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--text-subtle)" }}>~</span>
              <input type="date" className="h-9 flex-1 rounded-[10px] border px-3 text-[13px] font-semibold outline-none"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
                value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* 태그자 */}
          <div>
            <label className="mb-2 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>태그자 (알림 대상)</label>
            <div className="flex flex-wrap gap-1.5">
              {TEAM.filter((n) => n !== me).map((name) => {
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

          {/* 이미지 */}
          <div>
            <label className="mb-2 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>이미지 첨부</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            {imagePreview ? (
              <div className="relative w-full">
                <img src={imagePreview} alt="미리보기" className="max-h-48 w-full rounded-[10px] object-contain"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed py-6 text-[13px] font-semibold transition hover:opacity-80"
                style={{ borderColor: "var(--border-2)", color: "var(--text-muted)", background: "var(--surface-2)" }}>
                <Image size={16} />
                이미지 업로드 (선택)
              </button>
            )}
          </div>

          {/* 내용 */}
          <div>
            <label className="mb-1 block text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>내용 *</label>
            <textarea className="min-h-[160px] w-full resize-none rounded-[10px] border px-3 py-3 text-[13px] font-semibold leading-relaxed outline-none"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-strong)" }}
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="공지사항 내용을 입력하세요" />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} className="btn-premium btn-secondary">취소</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            등록
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// 공지사항 팝업 (로그인 시)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
export function NoticePopup({ me, onClose }: { me: string; onClose: () => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const t = today();
      const { data } = await supabase
        .from("notices")
        .select("*")
        .lte("start_date", t)
        .gte("end_date", t)
        .order("importance", { ascending: true })
        .order("created_at", { ascending: false });
      setNotices((data || []) as Notice[]);

      const { data: readData } = await supabase
        .from("notice_reads")
        .select("notice_id")
        .eq("user_name", me);
      setReads(new Set((readData || []).map((r: any) => r.notice_id)));
    })();
  }, [me]);

  if (!notices.length) return null;

  const notice = notices[current];
  if (!notice) return null;

  const ic = IMPORTANCE_CONFIG[notice.importance as Importance] || IMPORTANCE_CONFIG["정보"];
  const Icon = ic.icon;
  const isRead = reads.has(notice.id);

  const handleRead = async () => {
    if (isRead) return;
    setSaving(true);
    await supabase.from("notice_reads").upsert({ notice_id: notice.id, user_name: me }, { onConflict: "notice_id,user_name" });
    setReads((prev) => new Set([...prev, notice.id]));
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
        {/* 상단 중요도 배너 */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ background: ic.bg, borderBottom: `1px solid ${ic.border}` }}>
          <Icon size={16} style={{ color: ic.color }} />
          <span className="text-[12px] font-black" style={{ color: ic.color }}>{notice.importance} 공지사항</span>
          <span className="ml-auto text-[11px]" style={{ color: "var(--text-subtle)" }}>
            {current + 1} / {notices.length}
          </span>
        </div>

        {/* 콘텐츠 */}
        <div className="flex gap-0">
          {/* 왼쪽 이미지 */}
          {notice.image_url && (
            <div className="w-[280px] shrink-0" style={{ borderRight: "1px solid var(--border-subtle)" }}>
              <img src={notice.image_url} alt="공지 이미지" className="h-full max-h-[360px] w-full object-cover" />
            </div>
          )}

          {/* 오른쪽 텍스트 */}
          <div className="flex min-h-[240px] flex-1 flex-col p-5">
            <h3 className="mb-3 text-[16px] font-black leading-snug" style={{ color: "var(--text-strong)" }}>
              {notice.title}
            </h3>
            <p className="flex-1 whitespace-pre-wrap text-[13px] font-medium leading-relaxed" style={{ color: "var(--text)" }}>
              {notice.content}
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-subtle)" }}>
              <span>작성자: {notice.author}</span>
              <span>·</span>
              <span>게시: {fmtDate(notice.start_date)} ~ {fmtDate(notice.end_date)}</span>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {/* 이전/다음 */}
          <div className="flex gap-1">
            <button type="button" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
              className="btn-premium btn-secondary h-8 w-8 p-0 disabled:opacity-40"><ChevronUp size={14} /></button>
            <button type="button" onClick={() => setCurrent((c) => Math.min(notices.length - 1, c + 1))} disabled={current === notices.length - 1}
              className="btn-premium btn-secondary h-8 w-8 p-0 disabled:opacity-40"><ChevronDown size={14} /></button>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleRead} disabled={isRead || saving}
              className="btn-premium btn-primary h-9 px-4 text-[13px] disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {isRead ? "확인 완료" : "확인했습니다"}
            </button>
            <button type="button" onClick={onClose} className="btn-premium btn-secondary h-9 px-4 text-[13px]">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 페이지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads] = useState<NoticeRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
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

  const handleDelete = async (id: number) => {
    if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;
    await supabase.from("notices").delete().eq("id", id);
    if (selectedNotice?.id === id) setSelectedNotice(null);
    load();
  };

  const getReadCount = (noticeId: number) =>
    reads.filter((r) => r.notice_id === noticeId).length;

  const getReadUsers = (noticeId: number) =>
    reads.filter((r) => r.notice_id === noticeId).map((r) => r.user_name);

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="premium-header flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7">
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

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-5 pb-5 md:px-7">
        {/* 목록 */}
        <div className="flex w-full flex-col overflow-hidden rounded-[16px] xl:w-[520px]"
          style={{ border: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[1fr_72px_72px_56px] gap-2 border-b px-4 py-2.5 text-[11px] font-black"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-subtle)", background: "var(--surface-2)" }}>
            <span>공지사항명 / 작성자</span>
            <span className="text-center">게시기간</span>
            <span className="text-center">중요도</span>
            <span className="text-center">확인</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-faint)" }} />
              </div>
            ) : notices.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <p className="text-[13px]" style={{ color: "var(--text-faint)" }}>등록된 공지사항이 없습니다</p>
              </div>
            ) : (
              notices.map((notice) => {
                const ic = IMPORTANCE_CONFIG[notice.importance as Importance] || IMPORTANCE_CONFIG["정보"];
                const Icon = ic.icon;
                const active = isActive(notice);
                const readCount = getReadCount(notice.id);
                const selected = selectedNotice?.id === notice.id;

                return (
                  <button key={notice.id} type="button"
                    onClick={() => setSelectedNotice(selected ? null : notice)}
                    className="grid w-full grid-cols-[1fr_72px_72px_56px] items-center gap-2 border-b px-4 py-3 text-left transition hover:opacity-80"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: selected ? "var(--surface-selected)" : "transparent",
                    }}>
                    {/* 제목/작성자 */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!active && (
                          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>만료</span>
                        )}
                        <span className="truncate text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>
                          {notice.title}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
                        {notice.author} · {fmtDate(notice.created_at)}
                      </span>
                    </div>
                    {/* 게시기간 */}
                    <div className="text-center text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      <div>{fmtDate(notice.start_date)}</div>
                      <div>~{fmtDate(notice.end_date)}</div>
                    </div>
                    {/* 중요도 */}
                    <div className="flex justify-center">
                      <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold"
                        style={{ background: ic.bg, border: `1px solid ${ic.border}`, color: ic.color }}>
                        <Icon size={11} />
                        {notice.importance}
                      </span>
                    </div>
                    {/* 확인 수 */}
                    <div className="text-center text-[12px] font-bold" style={{ color: "var(--text-subtle)" }}>
                      {readCount}명
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 상세 패널 */}
        {selectedNotice && (() => {
          const notice = selectedNotice;
          const ic = IMPORTANCE_CONFIG[notice.importance as Importance] || IMPORTANCE_CONFIG["정보"];
          const Icon = ic.icon;
          const readUsers = getReadUsers(notice.id);

          return (
            <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] xl:flex"
              style={{ border: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
              {/* 상단 배너 */}
              <div className="flex items-center gap-2 px-5 py-3 shrink-0"
                style={{ background: ic.bg, borderBottom: `1px solid ${ic.border}` }}>
                <Icon size={15} style={{ color: ic.color }} />
                <span className="text-[12px] font-black" style={{ color: ic.color }}>{notice.importance}</span>
                <span className="ml-auto text-[11px]" style={{ color: "var(--text-subtle)" }}>
                  {fmtDate(notice.start_date)} ~ {fmtDate(notice.end_date)}
                </span>
                {(isAdmin || notice.author === me) && (
                  <button type="button" onClick={() => handleDelete(notice.id)}
                    className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg transition hover:opacity-80"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* 이미지 + 내용 */}
                <div className="flex gap-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {notice.image_url && (
                    <div className="w-[280px] shrink-0" style={{ borderRight: "1px solid var(--border-subtle)" }}>
                      <img src={notice.image_url} alt="공지 이미지"
                        className="max-h-[300px] w-full object-contain"
                        style={{ background: "var(--surface-2)" }} />
                    </div>
                  )}
                  <div className="flex-1 p-5">
                    <h3 className="mb-3 text-[17px] font-black" style={{ color: "var(--text-strong)" }}>
                      {notice.title}
                    </h3>
                    <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed" style={{ color: "var(--text)" }}>
                      {notice.content}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3 text-[12px]" style={{ color: "var(--text-subtle)" }}>
                      <span>작성자: {notice.author}</span>
                      <span>등록일: {fmtDate(notice.created_at)}</span>
                    </div>
                    {notice.tagged.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {notice.tagged.map((t) => (
                          <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent-border)" }}>
                            @{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 확인 현황 */}
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Eye size={15} style={{ color: "var(--accent-text)" }} />
                    <span className="text-[13px] font-black" style={{ color: "var(--text-strong)" }}>
                      확인 현황 ({readUsers.length}명)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TEAM.map((name) => {
                      const confirmed = readUsers.includes(name);
                      return (
                        <div key={name}
                          className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
                          style={{
                            background: confirmed ? "var(--success-bg)" : "var(--surface-2)",
                            border: `1px solid ${confirmed ? "var(--success-border)" : "var(--border-subtle)"}`,
                            color: confirmed ? "var(--success-text)" : "var(--text-muted)",
                          }}>
                          {confirmed ? <Check size={11} /> : <X size={11} />}
                          {name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 등록 모달 */}
      {showCreate && (
        <NoticeCreateModal
          me={me}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
