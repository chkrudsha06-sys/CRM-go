"use client";

import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileText,
  Image as ImageIcon,
  Info,
  Loader2,
  Megaphone,
  Shield,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Importance = "긴급" | "높음" | "보통" | "낮음" | "정보";

type Notice = {
  id: number;
  title: string;
  content: string;
  importance: Importance;
  image_url: string | null;
  file_urls: string[] | null;
  file_names: string[] | null;
  author: string;
  start_date: string;
  end_date: string;
  tagged: string[] | null;
  created_at: string;
};

const IMP: Record<Importance, { icon: any; color: string; bg: string; border: string }> = {
  긴급: { icon: Zap, color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)" },
  높음: { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)" },
  보통: { icon: Bell, color: "var(--accent-text)", bg: "var(--accent-subtle)", border: "var(--accent-border)" },
  낮음: { icon: Info, color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)" },
  정보: { icon: Shield, color: "var(--text-muted)", bg: "var(--surface-3)", border: "var(--border-subtle)" },
};

const IMG_RE = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  if (!d) return "-";
  const s = d.slice(0, 10).split("-");
  return s.length < 3 ? d.slice(0, 10) : `${s[0]}.${s[1]}.${s[2]}`;
}

function getFileName(url: string) {
  try {
    return decodeURIComponent(url.split("/").pop() || url).replace(/^\d+_/, "");
  } catch {
    return url;
  }
}

function getNoticeFileUrls(notice: Notice) {
  return notice.file_urls || (notice.image_url ? [notice.image_url] : []);
}

function getNoticeFileName(notice: Notice, url: string, index: number) {
  const storedName = notice.file_names?.[index];
  if (storedName?.trim()) return storedName;
  return getFileName(url);
}

function FileIconC({ url }: { url: string }) {
  const e = url.toLowerCase();
  if (IMG_RE.test(e)) return <ImageIcon size={14} />;
  if (/\.pdf(\?|$)/i.test(e)) return <FileText size={14} />;
  return <File size={14} />;
}

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
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
  } catch (e: any) {
    alert("다운로드 실패: " + (e?.message || "오류"));
  }
}

export default function NoticePopup({ me, onClose }: { me: string; onClose: () => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const t = today();
      const [{ data: noticeData, error: noticeError }, { data: readData, error: readError }] = await Promise.all([
        supabase
          .from("notices")
          .select("*")
          .lte("start_date", t)
          .gte("end_date", t)
          .order("created_at", { ascending: false }),
        supabase.from("notice_reads").select("notice_id").eq("user_name", me),
      ]);

      if (!mounted) return;

      if (noticeError) {
        console.error("공지사항 조회 실패:", noticeError);
        setLoaded(true);
        return;
      }
      if (readError) console.error("공지 확인 내역 조회 실패:", readError);

      const readIds = new Set(Array.from(readData || []).map((r: any) => Number(r.notice_id)));
      const unread = ((noticeData || []) as Notice[]).filter((notice) => !readIds.has(Number(notice.id)));

      setReads(readIds);
      setNotices(unread);
      setCurrent(0);
      setLoaded(true);
    })();

    return () => {
      mounted = false;
    };
  }, [me]);

  const notice = notices[current];
  const fileUrls = useMemo(() => (notice ? getNoticeFileUrls(notice) : []), [notice]);

  if (!loaded || !notices.length || !notice) return null;

  const cfg = IMP[notice.importance as Importance] || IMP["정보"];
  const Icon = cfg.icon;
  const hasMultiple = notices.length > 1;

  const handleRead = async () => {
    if (saving) return;
    setSaving(true);

    const { error } = await supabase.from("notice_reads").upsert(
      { notice_id: notice.id, user_name: me },
      { onConflict: "notice_id,user_name" }
    );

    if (error) {
      alert("확인 처리 실패: " + error.message);
      setSaving(false);
      return;
    }

    setReads((prev) => {
      const next = new Set(Array.from(prev));
      next.add(notice.id);
      return next;
    });

    const remaining = notices.filter((item) => item.id !== notice.id);
    if (remaining.length === 0) {
      setSaving(false);
      onClose();
      return;
    }

    setNotices(remaining);
    setCurrent((prev) => Math.min(prev, remaining.length - 1));
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
      >
        {/* ━━━ 헤더: 중요도 + 카운터 ━━━ */}
        <div
          className="flex shrink-0 items-center gap-2 px-5 py-3"
          style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}
        >
          <Icon size={16} style={{ color: cfg.color }} />
          <span className="text-[13px] font-black" style={{ color: cfg.color }}>
            {notice.importance} 공지사항
          </span>
          {hasMultiple && (
            <span
              className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-black"
              style={{ background: "var(--surface)", color: cfg.color, border: `1px solid ${cfg.border}` }}
            >
              {current + 1} / {notices.length}
            </span>
          )}
        </div>

        {/* ━━━ 본문 (스크롤) ━━━ */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* 공지사항명 콜아웃 */}
          <div className="px-6 pb-4 pt-6">
            <p className="crm-tiny mb-2">공지사항명</p>
            <div
              className="rounded-[12px] px-4 py-3"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            >
              <h2 className="text-[17px] font-[900] leading-snug" style={{ color: "var(--text-strong)" }}>
                {notice.title}
              </h2>
            </div>
          </div>

          {/* 메타정보: 작성자/게시기간 */}
          <div className="grid grid-cols-2 gap-3 px-6 pb-4">
            <div
              className="rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="crm-tiny mb-1">작성자</p>
              <p className="text-[13px] font-[800]" style={{ color: "var(--text-strong)" }}>
                {notice.author}
              </p>
            </div>
            <div
              className="rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="crm-tiny mb-1">게시 기간</p>
              <p className="text-[13px] font-[800]" style={{ color: "var(--text-strong)" }}>
                {fmtDate(notice.start_date)} ~ {fmtDate(notice.end_date)}
              </p>
            </div>
          </div>

          {/* 공지내용 콜아웃 */}
          <div className="px-6 pb-4">
            <p className="crm-tiny mb-2">공지 내용</p>
            <div
              className="rounded-[12px] px-4 py-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="whitespace-pre-wrap text-[14px] font-[600] leading-relaxed" style={{ color: "var(--text)" }}>
                {notice.content}
              </p>
            </div>
          </div>

          {/* 이미지 미리보기 */}
          {notice.image_url && IMG_RE.test(notice.image_url) && (
            <div className="px-6 pb-4">
              <p className="crm-tiny mb-2">이미지</p>
              <img
                src={notice.image_url}
                alt="공지 이미지"
                className="max-h-[280px] w-full rounded-[12px] object-contain"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
              />
            </div>
          )}

          {/* 첨부파일 */}
          {fileUrls.length > 0 && (
            <div className="px-6 pb-5">
              <p className="crm-tiny mb-2">첨부파일 ({fileUrls.length}개)</p>
              <div className="space-y-1.5">
                {fileUrls.map((url, i) => {
                  const fileName = getNoticeFileName(notice, url, i);
                  return (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      onClick={() => downloadNoticeFile(url, fileName)}
                      className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition hover:opacity-80"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <span style={{ color: "var(--accent-text)" }}>
                        <FileIconC url={url} />
                      </span>
                      <span className="flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                        {fileName}
                      </span>
                      <Download size={13} style={{ color: "var(--text-faint)" }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ━━━ 푸터 ━━━ */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-2)" }}
        >
          {/* 이전/다음 */}
          {hasMultiple ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
                className="btn-premium btn-secondary h-8 px-2 text-[12px] disabled:opacity-40"
              >
                <ChevronLeft size={14} /> 이전
              </button>
              <button
                type="button"
                onClick={() => setCurrent((c) => Math.min(notices.length - 1, c + 1))}
                disabled={current === notices.length - 1}
                className="btn-premium btn-secondary h-8 px-2 text-[12px] disabled:opacity-40"
              >
                다음 <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRead}
              disabled={saving}
              className="btn-premium btn-primary h-9 px-4 text-[13px] disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              확인완료
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
