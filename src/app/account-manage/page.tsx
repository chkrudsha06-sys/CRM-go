"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { authFetch } from "@/lib/auth-fetch";
import { Shield, UserPlus, Key, Trash2, Eye, EyeOff, Check, X, AlertTriangle } from "lucide-react";

interface UserRow { id: string; name: string; title: string; role: string; created_at: string; }

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  admin: { label: "관리자", color: "#f59e0b" },
  exec: { label: "실행파트", color: "#3b82f6" },
  ops: { label: "운영파트", color: "#22c55e" },
  ad: { label: "광고사업부", color: "#a855f7" },
  shared: { label: "공용", color: "#6b7280" },
};

export default function AccountManagePage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // 비밀번호 변경 상태
  const [editingPw, setEditingPw] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // 사용자 정보 수정 상태
  const [editingInfo, setEditingInfo] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editRole, setEditRole] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  // 신규 계정 추가
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ id: "", password: "", name: "", title: "", role: "exec" });
  const [addingUser, setAddingUser] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(""), 5000); };

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

  // 비밀번호 변경
  const handleChangePw = async (targetId: string) => {
    if (!newPw || newPw.length < 6) { showError("비밀번호는 6자 이상이어야 합니다."); return; }
    setSavingPw(true);
    const res = await authFetch("/api/auth/update-user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, newPassword: newPw }),
    });
    const data = await res.json();
    setSavingPw(false);
    if (data.success) {
      showToast(`${targetId} 비밀번호 변경 완료`);
      setEditingPw(null); setNewPw(""); setShowPw(false);
    } else {
      showError(data.error || "변경 실패");
    }
  };

  // 사용자 정보 수정
  const handleUpdateInfo = async (targetId: string) => {
    setSavingInfo(true);
    const res = await authFetch("/api/auth/update-user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, name: editName, title: editTitle, role: editRole }),
    });
    const data = await res.json();
    setSavingInfo(false);
    if (data.success) {
      showToast(`${targetId} 정보 수정 완료`);
      setEditingInfo(null);
      fetchUsers();
    } else {
      showError(data.error || "수정 실패");
    }
  };

  // 신규 계정
  const handleAddUser = async () => {
    if (!addForm.id || !addForm.password || !addForm.name || !addForm.title) { showError("모든 필드를 입력해주세요."); return; }
    setAddingUser(true);
    const res = await authFetch("/api/auth/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    setAddingUser(false);
    if (data.success) {
      showToast(`${addForm.id} 계정 생성 완료`);
      setShowAdd(false); setAddForm({ id: "", password: "", name: "", title: "", role: "exec" });
      fetchUsers();
    } else {
      showError(data.error || "생성 실패");
    }
  };

  // 계정 삭제
  const handleDelete = async (targetId: string, name: string) => {
    if (!confirm(`${name} (${targetId}) 계정을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    const res = await authFetch("/api/auth/update-user", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    });
    const data = await res.json();
    if (data.success) { showToast(`${name} 계정 삭제 완료`); fetchUsers(); }
    else showError(data.error || "삭제 실패");
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Shield size={48} className="mx-auto mb-4 opacity-20" style={{ color: "var(--text-muted)" }} />
        <p className="text-lg font-bold" style={{ color: "var(--text)" }}>관리자 전용 페이지</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>접근 권한이 없습니다</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">🔐 계정관리</h1>
            <p className="text-xs text-slate-500 mt-0.5">CRM 사용자 계정 및 비밀번호 관리 · 관리자 전용</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl transition-all"
            style={{ background: "var(--info)", color: "#fff" }}>
            <UserPlus size={14} />{showAdd ? "닫기" : "신규 계정"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* 토스트/에러 */}
        {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 shadow-lg flex items-center gap-2"><Check size={14} />{toast}</div>}
        {error && <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 shadow-lg flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}

        {/* 신규 계정 추가 폼 */}
        {showAdd && (
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "2px solid var(--info)" }}>
            <p className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>신규 계정 추가</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <input value={addForm.id} onChange={e => setAddForm({ ...addForm, id: e.target.value })}
                placeholder="아이디" className="px-3 py-2 text-sm rounded-xl outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
              <input value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                placeholder="비밀번호 (6자 이상)" className="px-3 py-2 text-sm rounded-xl outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
              <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="이름" className="px-3 py-2 text-sm rounded-xl outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
              <input value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })}
                placeholder="직급" className="px-3 py-2 text-sm rounded-xl outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
              <div className="flex gap-2">
                <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm rounded-xl outline-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <option value="admin">관리자</option>
                  <option value="exec">실행파트</option>
                  <option value="ops">운영파트</option>
                  <option value="ad">광고사업부</option>
                  <option value="shared">공용</option>
                </select>
                <button onClick={handleAddUser} disabled={addingUser}
                  className="px-4 py-2 text-sm font-bold rounded-xl text-white disabled:opacity-50"
                  style={{ background: "var(--info)" }}>
                  {addingUser ? "..." : "추가"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 계정 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 140 }}>ID</th>
                  <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 100 }}>이름</th>
                  <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 80 }}>직급</th>
                  <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 100 }}>역할</th>
                  <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 200 }}>비밀번호</th>
                  <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 100 }}>정보수정</th>
                  <th className="px-4 py-3 text-center text-xs font-bold" style={{ color: "var(--text-muted)", width: 60 }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rl = ROLE_LABEL[u.role] || { label: u.role, color: "#999" };
                  const isPwEdit = editingPw === u.id;
                  const isInfoEdit = editingInfo === u.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 text-center text-sm font-mono font-bold" style={{ color: "var(--text)" }}>{u.id}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold" style={{ color: "var(--text)" }}>
                        {isInfoEdit ? (
                          <input value={editName} onChange={e => setEditName(e.target.value)}
                            className="w-20 px-2 py-1 text-sm text-center rounded-lg outline-none"
                            style={{ background: "var(--bg)", border: "1px solid var(--info)", color: "var(--text)" }} />
                        ) : u.name}
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                        {isInfoEdit ? (
                          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                            className="w-20 px-2 py-1 text-sm text-center rounded-lg outline-none"
                            style={{ background: "var(--bg)", border: "1px solid var(--info)", color: "var(--text)" }} />
                        ) : u.title}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isInfoEdit ? (
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg outline-none"
                            style={{ background: "var(--bg)", border: "1px solid var(--info)", color: "var(--text)" }}>
                            <option value="admin">관리자</option>
                            <option value="exec">실행파트</option>
                            <option value="ops">운영파트</option>
                            <option value="ad">광고사업부</option>
                            <option value="shared">공용</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: `${rl.color}15`, color: rl.color, border: `1px solid ${rl.color}30` }}>
                            {rl.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isPwEdit ? (
                          <div className="flex items-center justify-center gap-1">
                            <div className="relative">
                              <input type={showPw ? "text" : "password"} value={newPw}
                                onChange={e => setNewPw(e.target.value)}
                                placeholder="새 비밀번호"
                                className="w-32 pl-2 pr-7 py-1 text-sm rounded-lg outline-none"
                                style={{ background: "var(--bg)", border: "1px solid var(--info)", color: "var(--text)" }}
                                onKeyDown={e => e.key === "Enter" && handleChangePw(u.id)} />
                              <button onClick={() => setShowPw(!showPw)} className="absolute right-1.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                                {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                            <button onClick={() => handleChangePw(u.id)} disabled={savingPw}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50">
                              <Check size={12} />
                            </button>
                            <button onClick={() => { setEditingPw(null); setNewPw(""); setShowPw(false); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50" style={{ color: "var(--text-muted)" }}>
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingPw(u.id); setNewPw(""); setEditingInfo(null); }}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                            style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                            <Key size={11} className="inline mr-1" />변경
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isInfoEdit ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleUpdateInfo(u.id)} disabled={savingInfo}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50">
                              <Check size={12} />
                            </button>
                            <button onClick={() => setEditingInfo(null)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50" style={{ color: "var(--text-muted)" }}>
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingInfo(u.id); setEditName(u.name); setEditTitle(u.title); setEditRole(u.role); setEditingPw(null); }}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                            style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
                            수정
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(u.id, u.name)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                          style={{ color: "var(--text-muted)" }}>
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

        {/* 보안 안내 */}
        <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "#f59e0b" }}>🔒 보안 안내</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            비밀번호는 bcrypt 해시로 암호화되어 저장됩니다. 관리자도 기존 비밀번호를 확인할 수 없으며, 새 비밀번호로만 변경 가능합니다.
            비밀번호 변경 시 해당 사용자의 기존 세션이 즉시 만료됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
