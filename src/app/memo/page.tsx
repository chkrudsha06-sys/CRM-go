"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Grid3X3,
  Minus,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

interface Memo {
  id: number;
  title: string;
  content: string;
  memo_type: "text" | "sheet";
  sheet_data: string[][] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

type MemoTab = "text" | "sheet" | "history";

const DEFAULT_ROWS = 12;
const DEFAULT_COLS = 8;

function createSheet(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countFilledCells(data: string[][] | null) {
  if (!data) return 0;
  return data.flat().filter((cell) => cell.trim()).length;
}

function colLabel(index: number) {
  let n = index;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function SheetEditor({ data, onChange }: { data: string[][]; onChange: (data: string[][]) => void }) {
  const [editCell, setEditCell] = useState<[number, number] | null>(null);
  const [editVal, setEditVal] = useState("");
  const [colWidths, setColWidths] = useState<number[]>([]);
  const resizeRef = useRef<{ col: number; startX: number; startW: number } | null>(null);

  const rows = data.length;
  const cols = data[0]?.length || DEFAULT_COLS;

  useEffect(() => {
    if (colWidths.length !== cols) {
      setColWidths(Array(cols).fill(136));
    }
  }, [cols, colWidths.length]);

  const startResize = (col: number, event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { col, startX: event.clientX, startW: colWidths[col] || 136 };

    const onMove = (moveEvent: globalThis.MouseEvent) => {
      if (!resizeRef.current) return;
      const diff = moveEvent.clientX - resizeRef.current.startX;
      const nextWidth = Math.max(72, resizeRef.current.startW + diff);
      setColWidths((prev) => {
        const next = [...prev];
        next[resizeRef.current!.col] = nextWidth;
        return next;
      });
    };

    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startEdit = (row: number, col: number) => {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    setEditCell([row, col]);
    setEditVal(data[row]?.[col] || "");
  };

  const commit = (moveRow = 0, moveCol = 0) => {
    if (!editCell) return;
    const [row, col] = editCell;
    const next = data.map((line, ri) => line.map((cell, ci) => (ri === row && ci === col ? editVal : cell)));
    onChange(next);

    const nextRow = row + moveRow;
    const nextCol = col + moveCol;
    if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
      setEditCell([nextRow, nextCol]);
      setEditVal(next[nextRow]?.[nextCol] || "");
    } else {
      setEditCell(null);
    }
  };

  const commitOnly = () => {
    if (!editCell) return;
    const [row, col] = editCell;
    const next = data.map((line, ri) => line.map((cell, ci) => (ri === row && ci === col ? editVal : cell)));
    onChange(next);
    setEditCell(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit(1, 0);
    } else if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      commit(-1, 0);
    } else if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      commit(0, 1);
    } else if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      commit(0, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      commit(1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      commit(-1, 0);
    } else if (event.key === "ArrowRight" && atEnd) {
      event.preventDefault();
      commit(0, 1);
    } else if (event.key === "ArrowLeft" && atStart) {
      event.preventDefault();
      commit(0, -1);
    } else if (event.key === "Escape") {
      setEditCell(null);
    }
  };

  const addRow = () => onChange([...data, Array(cols).fill("")]);
  const addCol = () => {
    onChange(data.map((row) => [...row, ""]));
    setColWidths((prev) => [...prev, 136]);
  };
  const removeRow = () => {
    if (rows <= 1) return;
    onChange(data.slice(0, -1));
    if (editCell && editCell[0] >= rows - 1) setEditCell(null);
  };
  const removeCol = () => {
    if (cols <= 1) return;
    onChange(data.map((row) => row.slice(0, -1)));
    setColWidths((prev) => prev.slice(0, -1));
    if (editCell && editCell[1] >= cols - 1) setEditCell(null);
  };

  const tableWidth = 48 + colWidths.reduce((sum, width) => sum + width, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-2">
        <button type="button" onClick={addRow} className="btn-premium btn-secondary h-8 px-3">
          <Plus size={13} /> 행 추가
        </button>
        <button type="button" onClick={addCol} className="btn-premium btn-secondary h-8 px-3">
          <Plus size={13} /> 열 추가
        </button>
        <button type="button" onClick={removeRow} disabled={rows <= 1} className="btn-premium btn-danger h-8 px-3">
          <Minus size={13} /> 행 삭제
        </button>
        <button type="button" onClick={removeCol} disabled={cols <= 1} className="btn-premium btn-danger h-8 px-3">
          <Minus size={13} /> 열 삭제
        </button>

        <span className="badge-premium badge-muted ml-0 xl:ml-2">
          {rows}행 × {cols}열 · 입력 {countFilledCells(data)}칸
        </span>
        <span className="crm-tiny ml-auto hidden xl:inline">
          Enter↓ · Tab→ · 방향키 이동 · Esc 취소 · 열 헤더 경계선 드래그
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[18px] border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <table
          className="text-sm"
          style={{
            tableLayout: "fixed",
            width: tableWidth,
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <colgroup>
            <col style={{ width: 48 }} />
            {colWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className="sticky top-0 z-10 h-10 border-b border-r text-center text-[11px] font-[800]"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-faint)" }}
              >
                #
              </th>
              {Array.from({ length: cols }, (_, index) => (
                <th
                  key={index}
                  className="sticky top-0 z-10 h-10 select-none border-b border-r text-center text-[11px] font-[800]"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-faint)", position: "sticky" }}
                >
                  <span>{colLabel(index)}</span>
                  <div
                    onMouseDown={(event) => startResize(index, event)}
                    className="absolute bottom-0 right-[-2px] top-0 z-20 w-[6px] cursor-col-resize transition-colors hover:bg-blue-400/60"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td
                  className="h-9 border-b border-r text-center text-[11px] font-[760]"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-faint)" }}
                >
                  {rowIndex + 1}
                </td>
                {row.map((cell, colIndex) => {
                  const isEditing = editCell?.[0] === rowIndex && editCell?.[1] === colIndex;
                  return (
                    <td
                      key={colIndex}
                      onClick={() => startEdit(rowIndex, colIndex)}
                      className="h-9 cursor-cell border-b border-r p-0 align-middle transition-colors hover:bg-white/[0.04]"
                      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editVal}
                          onChange={(event) => setEditVal(event.target.value)}
                          onBlur={commitOnly}
                          onKeyDown={handleKeyDown}
                          className="h-9 w-full rounded-none border-0 px-2 text-[13px] font-[680] outline-none"
                          style={{ background: "var(--accent-subtle)", color: "var(--text-strong)", boxShadow: "inset 0 0 0 2px var(--accent)" }}
                        />
                      ) : (
                        <div className="min-h-9 truncate px-2 py-2 text-[13px] font-[620]" style={{ color: cell ? "var(--text)" : "transparent" }}>
                          {cell || "."}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabButton({ active, label, icon, count, onClick }: { active: boolean; label: string; icon: ReactNode; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-premium h-10 px-4"
      style={{
        background: active ? "var(--accent-bg)" : "var(--surface-2)",
        border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
        color: active ? "var(--accent-text)" : "var(--text-muted)",
      }}
    >
      {icon}
      {label}
      {typeof count === "number" && count > 0 && <span className="badge-premium h-5 px-1.5 text-[10.5px]">{count}</span>}
    </button>
  );
}

function StatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string | number; tone: "info" | "success" | "purple" }) {
  const toneMap = {
    info: { bg: "var(--info-bg)", border: "var(--info-border)", text: "var(--info-text)" },
    success: { bg: "var(--success-bg)", border: "var(--success-border)", text: "var(--success-text)" },
    purple: { bg: "var(--purple-bg)", border: "var(--purple-border)", text: "var(--purple-text)" },
  }[tone];

  return (
    <div className="premium-card flex items-center gap-3 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[13px] border" style={{ background: toneMap.bg, borderColor: toneMap.border, color: toneMap.text }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="crm-tiny">{label}</p>
        <p className="mt-0.5 text-[22px] font-[830] tracking-[-0.055em]" style={{ color: "var(--text-strong)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function PreviewSheet({ data }: { data: string[][] }) {
  const preview = data.slice(0, 8).map((row) => row.slice(0, 6));
  return (
    <div className="mt-3 max-h-[300px] overflow-auto rounded-[14px] border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <table className="w-full border-collapse text-xs">
        <tbody>
          {preview.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  className="min-w-[76px] border-b border-r px-2 py-2 text-[12px] font-[610]"
                  style={{ borderColor: "var(--border-subtle)", color: cell ? "var(--text)" : "var(--text-faint)" }}
                >
                  {cell || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MemoPage() {
  const [tab, setTab] = useState<MemoTab>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sheetData, setSheetData] = useState<string[][]>(createSheet());
  const [memos, setMemos] = useState<Memo[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setUserName(user.name);
    fetchMemos();
  }, []);

  const textCount = memos.filter((memo) => memo.memo_type === "text").length;
  const sheetCount = memos.filter((memo) => memo.memo_type === "sheet").length;

  const filteredMemos = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return memos;
    return memos.filter((memo) => `${memo.title || ""} ${memo.content || ""} ${memo.created_by || ""}`.toLowerCase().includes(keyword));
  }, [memos, search]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  };

  const fetchMemos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("memos").select("*").order("updated_at", { ascending: false }).limit(80);
    if (error) {
      showToast(`불러오기 실패: ${error.message}`);
      setMemos([]);
      setLoading(false);
      return;
    }
    setMemos((data || []) as Memo[]);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSheetData(createSheet());
    setEditId(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast("제목을 입력해주세요");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      content: tab === "text" ? content : "",
      memo_type: tab === "text" ? "text" : "sheet",
      sheet_data: tab === "sheet" ? sheetData : null,
      created_by: userName,
      updated_at: new Date().toISOString(),
    };

    const { error } = editId
      ? await supabase.from("memos").update(payload).eq("id", editId)
      : await supabase.from("memos").insert({ ...payload, created_at: new Date().toISOString() });

    setSaving(false);

    if (error) {
      showToast(`저장 실패: ${error.message}`);
      return;
    }

    showToast(editId ? "수정 완료" : "저장 완료");
    resetForm();
    fetchMemos();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("메모를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("memos").delete().eq("id", id);
    if (error) {
      showToast(`삭제 실패: ${error.message}`);
      return;
    }
    showToast("삭제 완료");
    if (editId === id) resetForm();
    fetchMemos();
  };

  const handleLoad = (memo: Memo) => {
    setTitle(memo.title);
    setEditId(memo.id);
    if (memo.memo_type === "text") {
      setTab("text");
      setContent(memo.content || "");
    } else {
      setTab("sheet");
      setSheetData(memo.sheet_data || createSheet());
    }
    showToast("편집 모드로 불러왔습니다");
  };

  return (
    <div className="premium-page flex h-full flex-col overflow-hidden">
      <header className="premium-header flex-shrink-0 px-5 py-4 lg:px-7">
        <div className="premium-shell flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="badge-premium badge-purple">
                  <FileText size={13} /> 메모장
                </span>
                <span className="badge-premium badge-muted">텍스트 · 스프레드시트 · 기록관리</span>
              </div>
              <h1 className="crm-title">메모장</h1>
              <p className="crm-subtitle mt-2">텍스트 메모와 간단한 스프레드시트를 저장하고, 이전 기록을 빠르게 불러와 수정합니다.</p>
            </div>

            <div className="grid grid-cols-3 gap-2 xl:min-w-[560px]">
              <StatCard icon={<FileText size={17} />} label="텍스트 메모" value={textCount} tone="info" />
              <StatCard icon={<Grid3X3 size={17} />} label="스프레드시트" value={sheetCount} tone="success" />
              <StatCard icon={<Clock size={17} />} label="전체 기록" value={memos.length} tone="purple" />
            </div>
          </div>

          <div className="premium-filterbar rounded-[18px] px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <TabButton active={tab === "text"} label="메모" icon={<FileText size={15} />} onClick={() => setTab("text")} />
                <TabButton active={tab === "sheet"} label="스프레드시트" icon={<Grid3X3 size={15} />} onClick={() => setTab("sheet")} />
                <TabButton active={tab === "history"} label="저장 기록" icon={<Clock size={15} />} count={memos.length} onClick={() => setTab("history")} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {tab === "history" && (
                  <div className="relative min-w-[240px] flex-1 xl:w-[340px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="제목, 내용, 작성자 검색"
                      className="crm-search w-full pl-9 pr-3"
                    />
                  </div>
                )}
                <button type="button" onClick={fetchMemos} className="btn-premium btn-secondary">
                  <RefreshCcw size={14} /> 최신화
                </button>
                {editId && (
                  <button type="button" onClick={resetForm} className="btn-premium btn-secondary">
                    <X size={14} /> 새로 작성
                  </button>
                )}
                {(tab === "text" || tab === "sheet") && (
                  <button type="button" onClick={handleSave} disabled={saving} className="btn-premium btn-primary">
                    <Save size={15} /> {saving ? "저장 중..." : editId ? "수정 저장" : "저장"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-5 py-5 lg:px-7">
        <div className="premium-shell flex h-full min-h-[720px] flex-col gap-4">
          {(tab === "text" || tab === "sheet") && (
            <section className="premium-card flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex flex-shrink-0 flex-col gap-3 border-b px-4 py-4 xl:flex-row xl:items-center" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0 flex-1">
                  <label className="crm-tiny mb-2 block">{tab === "text" ? "메모 제목" : "스프레드시트 제목"}</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="제목을 입력하세요"
                    className="h-[42px] w-full rounded-[14px] border px-4 text-[14px] font-[740] outline-none"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:pt-6">
                  {editId ? <span className="badge-premium badge-warning">수정 모드</span> : <span className="badge-premium badge-success">신규 작성</span>}
                  <span className="badge-premium badge-muted">작성자 {userName || "-"}</span>
                  <span className="badge-premium badge-purple">
                    <Sparkles size={13} /> 자동 저장 아님
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 p-4">
                {tab === "text" ? (
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="메모 내용을 입력하세요. 상담 메모, 업무 정리, 아이디어, 체크리스트 등을 자유롭게 작성할 수 있습니다."
                    className="h-full min-h-[560px] w-full resize-none rounded-[18px] border px-5 py-4 text-[14px] font-[610] leading-[1.75] outline-none"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                ) : (
                  <SheetEditor data={sheetData} onChange={setSheetData} />
                )}
              </div>
            </section>
          )}

          {tab === "history" && (
            <section className="premium-card min-h-0 flex-1 overflow-hidden">
              <div className="flex min-h-[58px] items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <div>
                  <p className="crm-section-title">저장 기록</p>
                  <p className="crm-tiny mt-1">총 {filteredMemos.length}개의 기록이 표시됩니다.</p>
                </div>
                <span className="badge-premium badge-muted">최근 수정순</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                  </div>
                ) : filteredMemos.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center">
                    <div className="premium-icon-lg mb-4">
                      <FileText size={22} />
                    </div>
                    <p className="crm-card-title">저장된 메모가 없습니다</p>
                    <p className="crm-subtitle mt-2">새 메모를 작성하거나 검색어를 초기화해 주세요.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMemos.map((memo) => {
                      const isExpanded = expandedId === memo.id;
                      const isSheet = memo.memo_type === "sheet";
                      return (
                        <article key={memo.id} className="premium-card premium-card-hover overflow-hidden">
                          <div className="flex cursor-pointer items-center gap-3 px-4 py-3" onClick={() => setExpandedId(isExpanded ? null : memo.id)}>
                            <div
                              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] border"
                              style={{
                                background: isSheet ? "var(--success-bg)" : "var(--info-bg)",
                                borderColor: isSheet ? "var(--success-border)" : "var(--info-border)",
                                color: isSheet ? "var(--success-text)" : "var(--info-text)",
                              }}
                            >
                              {isSheet ? <Grid3X3 size={17} /> : <FileText size={17} />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="crm-row-main truncate">{memo.title}</p>
                                <span className={`badge-premium ${isSheet ? "badge-success" : "badge-info"}`}>{isSheet ? "스프레드시트" : "텍스트"}</span>
                                {editId === memo.id && <span className="badge-premium badge-warning">현재 편집 중</span>}
                              </div>
                              <p className="crm-row-sub mt-1">
                                {memo.created_by || "-"} · {fmtDate(memo.updated_at || memo.created_at)}
                                {isSheet ? ` · 입력 ${countFilledCells(memo.sheet_data)}칸` : ` · ${memo.content?.length || 0}자`}
                              </p>
                            </div>

                            <div className="flex flex-shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleLoad(memo);
                                }}
                                className="btn-premium btn-secondary h-9 px-3"
                              >
                                <FileText size={14} /> 편집
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(memo.id);
                                }}
                                className="btn-premium btn-danger h-9 px-3"
                              >
                                <Trash2 size={14} /> 삭제
                              </button>
                              <span style={{ color: "var(--text-faint)" }}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}>
                              {isSheet && memo.sheet_data ? (
                                <PreviewSheet data={memo.sheet_data} />
                              ) : (
                                <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap rounded-[14px] border p-4 text-[13px] font-[590] leading-[1.75]" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
                                  {memo.content || "(내용 없음)"}
                                </pre>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[14px] px-5 py-3 text-[13px] font-[780] text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
