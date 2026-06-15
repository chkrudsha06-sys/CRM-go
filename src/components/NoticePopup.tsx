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
import { useEffect, useState } from "react";

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

const IMP: Record<Importance, { icon: any; color: string; bg: string; border: string }> = {
  긴급: { icon: Zap,           color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)" },
  높음: { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)" },
  보통: { icon: Bell,          color: "var(--accent-text)", bg: "var(--accent-subtle)", border: "var(--accent-border)" },
  낮음: { icon: Info,          color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)" },
  정보: { icon: Shield,        color: "var(--text-muted)", bg: "var(--surface-3)", border: "var(--border-subtle)" },
};

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d: string) {
  if (!d) return "-";
  const s = d.slice(0,10).split("-");
  return s.length < 3 ? d.slice(0,10) : `${s[0]}.${s[1]}.${s[2]}`;
}

function getFileName(url: string) {
  try { return decodeURIComponent(url.split("/").pop()!).replace(/^\d+_/, ""); } catch { return url; }
}

function FileIconC({ url }: { url: string }) {
  const e = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(e)) return <ImageIcon size={14} />;
  if (/\.pdf/.test(e)) return <FileText size={14} />;
  return <File size={14} />;
}

export default function NoticePopup({ me, onClose }: { me: string; onClose: () => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads]     = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      const t = today();
      const { data } = await supabase
        .from("notices")
        .select("*")
        .lte("start_date", t)
        .gte("end_date", t)
        .order("created_at", { ascending: false });
      setNotices((data || []) as Notice[]);
      const { data: rd } = await supabase
        .from("notice_reads")
        .select("notice_id")
        .eq("user_name", me);
      setReads(new Set(Array.from((rd || []).map((r: any) => Number(r.notice_id)))));
    })();
  }, [me]);

  if (!notices.length) return null;
  const notice = notices[current];
  if (!notice) return null;

  const cfg = IMP[notice.importance as Importance] || IMP["정보"];
  const Icon = cfg.icon;
  const isRead = reads.has(notice.id);
  const fileUrls = notice.file_urls || (notice.image_url ? [notice.image_url] : []);
  const hasMultiple = notices.length > 1;

  const handleRead = async () => {
    if (isRead) return;
    setSaving(true);
    await supabase.from("notice_reads").upsert(
      { notice_id: notice.id, user_name: me },
      { onConflict: "notice_id,user_name" }
    );
    setReads((prev) => {
      const next = new Set(Array.from(prev));
      next.add(notice.id);
      return next;
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>

        {/* ━━━ 헤더: 중요도 + 카운터 ━━━ */}
        <div className="flex shrink-0 items-center gap-2 px-5 py-3"
          style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
          <Icon size={16} style={{ color: cfg.color }} />
          <span className="text-[13px] font-black" style={{ color: cfg.color }}>
            {notice.importance} 공지사항
          </span>
          {hasMultiple && (
            <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-black"
              style={{ background: "var(--surface)", color: cfg.color, border: `1px solid ${cfg.border}` }}>
              {current + 1} / {notices.length}
            </span>
          )}
        </div>

        {/* ━━━ 본문 (스크롤) ━━━ */}
        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* 공지사항명 콜아웃 */}
          <div className="px-6 pt-6 pb-4">
            <p className="crm-tiny mb-2">공지사항명</p>
            <div className="rounded-[12px] px-4 py-3"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
              <h2 className="text-[17px] font-[900] leading-snug" style={{ color: "var(--text-strong)" }}>
                {notice.title}
              </h2>
            </div>
          </div>

          {/* 메타정보: 작성자/게시기간 */}
          <div className="grid grid-cols-2 gap-3 px-6 pb-4">
            <div className="rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
              <p className="crm-tiny mb-1">작성자</p>
              <p className="text-[13px] font-[800]" style={{ color: "var(--text-strong)" }}>{notice.author}</p>
            </div>
            <div className="rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
              <p className="crm-tiny mb-1">게시 기간</p>
              <p className="text-[13px] font-[800]" style={{ color: "var(--text-strong)" }}>
                {fmtDate(notice.start_date)} ~ {fmtDate(notice.end_date)}
              </p>
            </div>
          </div>

          {/* 공지내용 콜아웃 */}
          <div className="px-6 pb-4">
            <p className="crm-tiny mb-2">공지 내용</p>
            <div className="rounded-[12px] px-4 py-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
              <p className="whitespace-pre-wrap text-[14px] font-[600] leading-relaxed" style={{ color: "var(--text)" }}>
                {notice.content}
              </p>
            </div>
          </div>

          {/* 이미지 미리보기 */}
          {notice.image_url && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(notice.image_url) && (
            <div className="px-6 pb-4">
              <p className="crm-tiny mb-2">이미지</p>
              <img src={notice.image_url} alt="공지 이미지"
                className="max-h-[280px] w-full rounded-[12px] object-contain"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }} />
            </div>
          )}

          {/* 첨부파일 */}
          {fileUrls.length > 0 && (
            <div className="px-6 pb-5">
              <p className="crm-tiny mb-2">첨부파일 ({fileUrls.length}개)</p>
              <div className="space-y-1.5">
                {fileUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" download={getFileName(url)}
                    className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 transition hover:opacity-80"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--accent-text)" }}><FileIconC url={url} /></span>
                    <span className="flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                      {getFileName(url)}
                    </span>
                    <Download size={13} style={{ color: "var(--text-faint)" }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ━━━ 푸터 ━━━ */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-2)" }}>
          {/* 이전/다음 */}
          {hasMultiple ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
                className="btn-premium btn-secondary h-8 px-2 text-[12px] disabled:opacity-40">
                <ChevronLeft size={14} /> 이전
              </button>
              <button type="button" onClick={() => setCurrent((c) => Math.min(notices.length - 1, c + 1))} disabled={current === notices.length - 1}
                className="btn-premium btn-secondary h-8 px-2 text-[12px] disabled:opacity-40">
                다음 <ChevronRight size={14} />
              </button>
            </div>
          ) : <div />}

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
