"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Calendar, Pencil, X, Check } from "lucide-react";

interface Note {
  id: number;
  contact_id: number;
  note_date: string;
  content: string;
  author: string | null;
}

interface Props {
  contactId: number;
  authorName?: string;
  compact?: boolean;
  refreshKey?: number;
}

export default function ContactNotes({ contactId, authorName, compact, refreshKey }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchNotes = async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from("contact_notes")
      .select("*")
      .eq("contact_id", contactId)
      .order("note_date", { ascending: false });
    setNotes((data || []) as Note[]);
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, [contactId]);
  useEffect(() => { if (refreshKey) fetchNotes(true); }, [refreshKey]);

  const getAuthor = () => {
    if (authorName) return authorName;
    try {
      const raw = localStorage.getItem("crm_user");
      if (raw) return JSON.parse(raw).name || "";
    } catch {}
    return "";
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("contact_notes").insert({
      contact_id: contactId,
      note_date: newDate,
      content: newContent.trim(),
      author: getAuthor() || null,
    });
    setSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setNewContent("");
    setNewDate(new Date().toISOString().split("T")[0]);
    setAdding(false);
    await fetchNotes();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("contact_notes").delete().eq("id", id);
    fetchNotes();
  };

  const handleEdit = async (id: number) => {
    if (!editContent.trim()) return;
    await supabase.from("contact_notes").update({ content: editContent.trim() }).eq("id", id);
    setEditingId(null);
    setEditContent("");
    fetchNotes();
  };

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

  // ── 인라인 축약 모드 (고객등록/파이프라인 행 내 1줄 표시) ──
  if (compact) {
    return (
      <span className="text-[11px] truncate block" style={{ color: "var(--text-muted)" }}>
        {loading ? null : notes.length === 0 ? (
          <span style={{ color: "var(--text-subtle)" }}>활동 노트 없음</span>
        ) : (
          <>
            <span className="font-semibold" style={{ color: "#3b82f6" }}>{formatDate(notes[0].note_date)}</span>
            <span className="mx-1" style={{ color: "var(--text)" }}>{notes[0].content}</span>
            {notes.length > 1 && (
              <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}> +{notes.length - 1}건</span>
            )}
          </>
        )}
      </span>
    );
  }

  // ── 일반 모드 ──
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--text)" }}>
          <Calendar size={14} className="text-blue-500" />
          활동 노트
          <span className="text-xs font-normal ml-1" style={{ color: "var(--text-muted)" }}>{notes.length}건</span>
        </h3>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={12} /> 노트 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {adding && (
        <div className="mb-3 rounded-xl p-3 space-y-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>날짜 선택</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:border-blue-400"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}/>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>내용</label>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
              placeholder="활동 내용을 입력하세요..." rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:border-blue-400 resize-none"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}/>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setNewContent(""); }}
              className="flex-1 py-1.5 text-xs rounded-lg" style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--bg)" }}>취소</button>
            <button onClick={handleAdd} disabled={saving || !newContent.trim()}
              className="flex-1 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 노트 목록 */}
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-6 text-xs" style={{ color: "var(--text-subtle)" }}>활동 노트가 없습니다</div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "#60a5fa" }}>
                    {new Date(note.note_date + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                  </span>
                  {note.author && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>{note.author}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                    className="hover:text-blue-500 transition-colors" style={{ color: "var(--text-subtle)" }}><Pencil size={14}/></button>
                  <button onClick={() => handleDelete(note.id)}
                    className="hover:text-red-500 transition-colors" style={{ color: "var(--text-subtle)" }}><Trash2 size={14}/></button>
                </div>
              </div>
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:border-blue-400 resize-none"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}/>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs rounded-lg" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>취소</button>
                    <button onClick={() => handleEdit(note.id)} className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg"><Check size={12} className="inline mr-1"/>저장</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{note.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
