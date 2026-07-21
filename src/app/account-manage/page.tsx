"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import {
  Shield, UserPlus, Key, Trash2, Eye, EyeOff, Check, X,
  AlertTriangle, Lock, Loader2,
} from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  title: string;
  role: string;
  created_at: string;
}

const ROLE_LABEL: Record<string, { label: string; tone: "warning" | "info" | "success" | "purple" | "muted" }> = {
  admin: { label: "관리자", tone: "warning" },
  exec: { label: "소싱팀", tone: "info" },
  ops: { label: "운영파트", tone: "success" },
  ad: { label: "광고사업부", tone: "purple" },
  shared: { label: "공용", tone: "muted" },
};

const ROLE_TONE_STYLE = {
  warning: { bg: "var(--warning-bg)", text: "var(--warning-text)", border: "var(--warning-border)" },
  info: { bg: "var(--info-bg)", text: "var(--info-text)", border: "var(--info-border)" },
  success: { bg: "var(--success-bg)", text: "var(--success-text)", border: "var(--success-border)" },
  purple: { bg: "var(--purple-bg)", text: "var(--purple-text)", border: "var(--purple-border)" },
  muted: { bg: "var(--surface-3)", text: "var(--text-subtle)", border: "var(--border)" },
};

export default function AccountManagePage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const [editingPw, setEditingPw] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [editingInfo, setEditingInfo] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editRole, setEditRole] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ id: "", password: "", name: "", title: "", role: "exec" });
  const [addingUser, setAddingUser] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const showErr = (msg: string) => { setError(msg); setTimeout(() => setError(""), 5000); };

  const fetchUsers = async () => {
    const { data } = await supabase.from("crm_users").select("id, name, title, role, created_at").order("id");
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const u = getCurrentUser();
    setIsAdmin(u?.role === "admin");
    fetchUsers();
  }, []);

  const handleChangePw = async (targetId: string) => {
    if (!newPw || newPw.length < 6) { showErr("비밀번호는 6자 이상이어야 합니다."); return; }
    setSavingPw(true);
    const res = await authFetch("/api/auth/update-user", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, newPassword: newPw }),
    });
    const data = await res.json();
    setSavingPw(false);
    if (data.success) {
      showToast(`${targetId} 비밀번호 변경 완료`);
      setEditingPw(null); setNewPw(""); setShowPw(false);
    } else showErr(data.error || "변경 실패");
  };

  const handleUpdateInfo = async (targetId: string) => {
    setSavingInfo(true);
    const res = await authFetch("/api/auth/update-user", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, name: editName, title: editTitle, role: editRole }),
    });
    const data = await res.json();
    setSavingInfo(false);
    if (data.success) {
      showToast(`${targetId} 정보 수정 완료`);
      setEditingInfo(null);
      fetchUsers();
    } else showErr(data.error || "수정 실패");
  };

  const handleAddUser = async () => {
    if (!addForm.id || !addForm.password || !addForm.name || !addForm.title) { showErr("모든 필드를 입력해주세요."); return; }
    setAddingUser(true);
    const res = await authFetch("/api/auth/update-user", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    setAddingUser(false);
    if (data.success) {
      showToast(`${addForm.id} 계정 생성 완료`);
      setShowAdd(false); setAddForm({ id: "", password: "", name: "", title: "", role: "exec" });
      fetchUsers();
    } else showErr(data.error || "생성 실패");
  };

  const handleDelete = async (targetId: string, name: string) => {
    if (!confirm(`${name} (${targetId}) 계정을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    const res = await authFetch("/api/auth/update-user", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    });
    const data = await res.json();
    if (data.success) { showToast(`${name} 계정 삭제 완료`); fetchUsers(); }
    else showErr(data.error || "삭제 실패");
  };

  if (!isAdmin) {
    return (
      <div className="premium-page flex h-full flex-col items-center justify-center">
        <Lock size={40} className="mb-3" style={{ color: "var(--text-faint)", opacity: 0.5 }} />
        <p className="text-[16px] font-bold" style={{ color: "var(--text-strong)" }}>관리자 전용 페이지</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-subtle)" }}>접근 권한이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="premium-page mx-auto w-full max-w-[1920px] px-4 pb-12 pt-6 md:px-6 2xl:px-8">

      {/* 토스트 */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-[13px] font-semibold shadow-lg"
          style={{ background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" }}>
          <Check size={14} /> {toast}
        </div>
      )}
      {error && (
        <div className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-[13px] font-semibold shadow-lg"
          style={{ background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border"
            style={{ background: "var(--purple-bg)", borderColor: "var(--purple-border)", color: "var(--purple-text)" }}>
            <Shield size={16} />
          </div>
          <div>
            <h1 className="crm-title">계정관리</h1>
            <p className="crm-subtitle mt-0.5">CRM 사용자 계정 및 비밀번호 관리 · 관리자 전용</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-premium btn-primary h-10">
          <UserPlus size={14} /> {showAdd ? "닫기" : "신규 계정"}
        </button>
      </div>

      {/* 신규 계정 추가 폼 */}
      {showAdd && (
        <div className="premium-card mb-5 rounded-[22px] p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus size={14} style={{ color: "var(--accent-text)" }} />
            <p className="text-[13px] font-bold" style={{ color: "var(--text-strong)" }}>신규 계정 추가</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(140px,1fr)_minmax(160px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)_auto]">
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">아이디</span>
              <input value={addForm.id} onChange={(e) => setAddForm({ ...addForm, id: e.target.value })}
                placeholder="아이디" className="crm-search h-11 w-full px-3 font-normal" />
            </label>
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">비밀번호</span>
              <input value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                placeholder="6자 이상" type="password" className="crm-search h-11 w-full px-3 font-normal" />
            </label>
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">이름</span>
              <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="이름" className="crm-search h-11 w-full px-3 font-normal" />
            </label>
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">직급</span>
              <input value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                placeholder="직급" className="crm-search h-11 w-full px-3 font-normal" />
            </label>
            <label className="block min-w-0">
              <span className="crm-meta mb-2 block pl-3 font-normal">역할</span>
              <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                className="crm-search h-11 w-full px-3 font-normal">
                <option value="admin">관리자</option>
                <option value="exec">소싱팀</option>
                <option value="ops">운영파트</option>
                <option value="ad">광고사업부</option>
                <option value="shared">공용</option>
              </select>
            </label>
            <div className="flex flex-col items-start gap-1.5">
              <span className="crm-meta block text-[11px] font-normal" style={{ color: "transparent", userSelect: "none" }}>저장</span>
              <button onClick={handleAddUser} disabled={addingUser} className="btn-premium btn-primary h-11 whitespace-nowrap px-4">
                {addingUser ? "..." : "계정 추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 계정 목록 */}
      <section className="premium-card overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin" size={28} style={{ color: "var(--accent-text)" }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="crm-table w-full min-w-[1080px]">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>ID</th>
                  <th style={{ width: 120 }}>이름</th>
                  <th style={{ width: 120 }}>직급</th>
                  <th style={{ width: 130 }}>역할</th>
                  <th style={{ width: 280 }}>비밀번호</th>
                  <th style={{ width: 120 }}>정보 수정</th>
                  <th style={{ width: 80 }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const rl = ROLE_LABEL[u.role] || { label: u.role, tone: "muted" as const };
                  const rt = ROLE_TONE_STYLE[rl.tone];
                  const isPwEdit = editingPw === u.id;
                  const isInfoEdit = editingInfo === u.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{u.id}</span>
                      </td>
                      <td>
                        {isInfoEdit ? (
                          <input value={editName} onChange={(e) => setEditName(e.target.value)}
                            className="crm-search h-9 w-24 px-2 text-center font-normal" />
                        ) : (
                          <span className="text-[13px]" style={{ color: "var(--text)" }}>{u.name}</span>
                        )}
                      </td>
                      <td>
                        {isInfoEdit ? (
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                            className="crm-search h-9 w-24 px-2 text-center font-normal" />
                        ) : (
                          <span className="text-[13px]" style={{ color: "var(--text-subtle)" }}>{u.title}</span>
                        )}
                      </td>
                      <td>
                        {isInfoEdit ? (
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                            className="crm-search h-9 w-28 px-2 font-normal">
                            <option value="admin">관리자</option>
                            <option value="exec">소싱팀</option>
                            <option value="ops">운영파트</option>
                            <option value="ad">광고사업부</option>
                            <option value="shared">공용</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ background: rt.bg, color: rt.text, borderColor: rt.border }}>
                            {rl.label}
                          </span>
                        )}
                      </td>
                      <td>
                        {isPwEdit ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="relative">
                              <input
                                type={showPw ? "text" : "password"}
                                value={newPw}
                                onChange={(e) => setNewPw(e.target.value)}
                                placeholder="새 비밀번호"
                                className="crm-search h-9 w-40 pl-2 pr-7 font-normal"
                                onKeyDown={(e) => e.key === "Enter" && handleChangePw(u.id)}
                              />
                              <button onClick={() => setShowPw(!showPw)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-subtle)" }}>
                                {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                            <button onClick={() => handleChangePw(u.id)} disabled={savingPw}
                              className="flex h-9 w-9 items-center justify-center rounded-[10px] border transition-all disabled:opacity-50"
                              style={{ background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" }}>
                              <Check size={13} />
                            </button>
                            <button onClick={() => { setEditingPw(null); setNewPw(""); setShowPw(false); }}
                              className="flex h-9 w-9 items-center justify-center rounded-[10px] border"
                              style={{ background: "var(--surface-2)", color: "var(--text-subtle)", borderColor: "var(--border)" }}>
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingPw(u.id); setNewPw(""); setEditingInfo(null); }}
                            className="inline-flex items-center gap-1 rounded-[10px] border px-3 py-1.5 text-[12px] font-normal transition-all"
                            style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" }}>
                            <Key size={12} /> 변경
                          </button>
                        )}
                      </td>
                      <td>
                        {isInfoEdit ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleUpdateInfo(u.id)} disabled={savingInfo}
                              className="flex h-9 w-9 items-center justify-center rounded-[10px] border disabled:opacity-50"
                              style={{ background: "var(--info-bg)", color: "var(--info-text)", borderColor: "var(--info-border)" }}>
                              <Check size={13} />
                            </button>
                            <button onClick={() => setEditingInfo(null)}
                              className="flex h-9 w-9 items-center justify-center rounded-[10px] border"
                              style={{ background: "var(--surface-2)", color: "var(--text-subtle)", borderColor: "var(--border)" }}>
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingInfo(u.id);
                              setEditName(u.name); setEditTitle(u.title); setEditRole(u.role);
                              setEditingPw(null);
                            }}
                            className="inline-flex items-center rounded-[10px] border px-3 py-1.5 text-[12px] font-normal transition-all"
                            style={{ background: "var(--info-bg)", color: "var(--info-text)", borderColor: "var(--info-border)" }}>
                            수정
                          </button>
                        )}
                      </td>
                      <td>
                        <button onClick={() => handleDelete(u.id, u.name)}
                          className="flex h-9 w-9 items-center justify-center rounded-[10px] border transition-all"
                          style={{ background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 보안 안내 */}
      <div className="mt-5 rounded-[14px] border p-4"
        style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Lock size={13} style={{ color: "var(--warning-text)" }} />
          <p className="text-[12px] font-bold" style={{ color: "var(--warning-text)" }}>보안 안내</p>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text)" }}>
          비밀번호는 bcrypt 해시로 암호화되어 저장됩니다. 관리자도 기존 비밀번호를 확인할 수 없으며, 새 비밀번호로만 변경 가능합니다.
          비밀번호 변경 시 해당 사용자의 기존 세션이 즉시 만료됩니다.
        </p>
      </div>
    </div>
  );
}
