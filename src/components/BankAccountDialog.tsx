"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Check, RotateCcw } from "lucide-react";
import { BANK_LIST, GROUP_LABELS, searchBanks, findBankByCode, findBankByName, Bank } from "@/lib/banks";
import { supabase } from "@/lib/supabase";

interface BankAccountDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: number;
  initial: {
    bank_holder: string | null;
    bank_code: string | null;
    bank_name: string | null;
    bank_account: string | null;
  };
  onSaved: () => void;
}

export default function BankAccountDialog({
  open, onClose, contactId, initial, onSaved,
}: BankAccountDialogProps) {
  const [holder, setHolder]       = useState("");
  const [bankCode, setBankCode]   = useState("");
  const [bankName, setBankName]   = useState("");
  const [account, setAccount]     = useState("");
  const [query, setQuery]         = useState("");
  const [showList, setShowList]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [resetting, setResetting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setHolder(initial.bank_holder || "");
      setBankCode(initial.bank_code || "");
      setBankName(initial.bank_name || "");
      setAccount(initial.bank_account || "");
      setQuery(initial.bank_name || "");
      setShowList(false);
    }
  }, [open, initial]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setShowList(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!open) return null;

  const filtered = searchBanks(query);

  const grouped: Record<string, Bank[]> = {};
  filtered.forEach(b => {
    if (!grouped[b.group]) grouped[b.group] = [];
    grouped[b.group].push(b);
  });

  const pickBank = (b: Bank) => {
    setBankCode(b.code);
    setBankName(b.name);
    setQuery(b.name);
    setShowList(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("contacts").update({
      bank_holder: holder || null,
      bank_code:   bankCode || null,
      bank_name:   bankName || null,
      bank_account: account || null,
    }).eq("id", contactId);
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleReset = async () => {
    if (!confirm("계좌정보를 모두 삭제하시겠습니까?")) return;
    setResetting(true);
    await supabase.from("contacts").update({
      bank_holder: null,
      bank_code:   null,
      bank_name:   null,
      bank_account: null,
    }).eq("id", contactId);
    setResetting(false);
    onSaved();
    onClose();
  };

  const groupOrder: Bank["group"][] = ["major","local","foreign","saving","securities"];

  const inputStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>계좌정보 입력</h3>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--text-muted)" }}>
            <X size={20}/>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* 예금주 */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>예금주</label>
            <input value={holder} onChange={e=>setHolder(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-1 focus:ring-blue-400"
              style={inputStyle}/>
          </div>

          {/* 은행코드 + 은행명 검색 */}
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>은행코드</label>
              <input value={bankCode} readOnly
                placeholder="자동"
                className="w-full px-3 py-2.5 text-sm rounded-xl cursor-not-allowed text-center outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}/>
            </div>
            <div className="col-span-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>은행명 검색</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}/>
                <input
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    const match = findBankByName(e.target.value);
                    if (match) { setBankCode(match.code); setBankName(match.name); }
                    else { setBankCode(""); setBankName(""); }
                  }}
                  placeholder="은행명 또는 코드로 검색"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl outline-none focus:ring-1 focus:ring-blue-400"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* 은행 리스트 */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
              은행 선택 {filtered.length > 0 && <span style={{ color: "var(--text-subtle)" }}>({filtered.length}개)</span>}
            </label>
            <div ref={listRef} className="rounded-xl h-[280px] overflow-y-auto"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-muted)" }}>검색 결과 없음</div>
              ) : (
                groupOrder.map(g => {
                  const list = grouped[g];
                  if (!list || list.length === 0) return null;
                  return (
                    <div key={g}>
                      <div className="px-3 py-2 text-sm font-bold sticky top-0 z-10"
                        style={{ color: "var(--text)", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                        {GROUP_LABELS[g]}
                      </div>
                      <div className="grid grid-cols-2 gap-0">
                        {list.map(b => (
                          <button key={b.code}
                            onClick={() => pickBank(b)}
                            className="flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors"
                            style={{
                              borderBottom: "1px solid var(--border)",
                              background: bankCode === b.code ? "rgba(59,130,246,0.1)" : "transparent",
                              color: bankCode === b.code ? "#3b82f6" : "var(--text)",
                              fontWeight: bankCode === b.code ? 600 : 400,
                            }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] w-8" style={{ color: "var(--text-muted)" }}>{b.code}</span>
                              <span>{b.name}</span>
                            </div>
                            {bankCode === b.code && <Check size={14} className="text-blue-500 flex-shrink-0"/>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 계좌번호 */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>계좌번호</label>
            <input value={account} onChange={e=>setAccount(e.target.value)}
              placeholder="예: 123-456-789012"
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-1 focus:ring-blue-400"
              style={inputStyle}/>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
          <button onClick={handleReset} disabled={resetting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            style={{ color: "#ef4444", background: "var(--surface)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <RotateCcw size={13}/> {resetting ? "삭제 중..." : "초기화"}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-5 py-2 text-sm font-semibold rounded-xl transition-colors"
              style={{ color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)" }}>
              취소
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {saving ? "저장 중..." : "완료"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
