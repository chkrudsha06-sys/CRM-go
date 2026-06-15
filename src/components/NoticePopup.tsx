"use client";

import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
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
  author: string;
  start_date: string;
  end_date: string;
  tagged: string[];
  created_at: string;
};

const IMPORTANCE_CONFIG: Record<Importance, { icon: any; color: string; bg: string; border: string }> = {
  긴급: { icon: Zap,           color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)" },
  높음: { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)" },
  보통: { icon: Bell,          color: "var(--accent-text)", bg: "var(--accent-subtle)", border: "var(--accent-border)" },
  낮음: { icon: Info,          color: "var(--success-text)", bg: "var(--success-bg)", border: "var(--success-border)" },
  정보: { icon: Shield,        color: "var(--text-subtle)", bg: "var(--surface-2)", border: "var(--border-subtle)" },
};

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d: string) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
}

export default function NoticePopup({ me, onClose }: { me: string; onClose: () => void }) {
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
        .order("created_at", { ascending: false });
      setNotices((data || []) as Notice[]);
      const { data: readData } = await supabase
        .from("notice_reads")
        .select("notice_id")
        .eq("user_name", me);
      setReads(new Set(Array.from((readData || []).map((r: any) => Number(r.notice_id)))));
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
    await supabase.from("notice_reads").upsert(
      { notice_id: notice.id, user_name: me },
      { onConflict: "notice_id,user_name" }
    );
    setReads((prev) => { const next = new Set(Array.from(prev)); next.add(notice.id); return next; });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2 px-5 py-3"
          style={{ background: ic.bg, borderBottom: `1px solid ${ic.border}` }}>
          <Icon size={16} style={{ color: ic.color }} />
          <span className="text-[12px] font-black" style={{ color: ic.color }}>{notice.importance} 공지사항</span>
          <span className="ml-auto text-[11px]" style={{ color: "var(--text-subtle)" }}>
            {current + 1} / {notices.length}
          </span>
        </div>
        <div className="flex gap-0">
          {notice.image_url && (
            <div className="w-[280px] shrink-0" style={{ borderRight: "1px solid var(--border-subtle)" }}>
              <img src={notice.image_url} alt="공지 이미지" className="h-full max-h-[360px] w-full object-cover" />
            </div>
          )}
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
        <div className="flex items-center justify-between gap-3 px-5 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}>
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
