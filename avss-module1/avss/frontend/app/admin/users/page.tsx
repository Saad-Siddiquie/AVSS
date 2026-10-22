"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface User {
  id: number;
  full_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
}

interface ModalState {
  type: "create" | "delete";
  user?: User;
}

export default function AdminUsersPage() {
  const { user: me, authFetch } = useAuth();
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<ModalState | null>(null);
  const [toast,   setToast]   = useState("");

  // Create form state
  const [cfName,  setCfName]  = useState("");
  const [cfEmail, setCfEmail] = useState("");
  const [cfPw,    setCfPw]    = useState("");
  const [cfRole,  setCfRole]  = useState<"user" | "admin">("user");
  const [cfError, setCfError] = useState("");
  const [cfBusy,  setCfBusy]  = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    const r = await authFetch(`${API}/admin/users`);
    if (r.ok) setUsers(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patchUser = async (id: number, body: Record<string, unknown>) => {
    try {
      const r = await authFetch(`${API}/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Update failed."); }
      showToast("User updated.");
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const deleteUser = async (id: number) => {
    try {
      const r = await authFetch(`${API}/admin/users/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Delete failed."); }
      showToast("User deleted.");
      setModal(null);
      load();
    } catch (e: any) { showToast(e.message); setModal(null); }
  };

  const createUser = async () => {
    setCfError("");
    if (!cfName.trim())                        { setCfError("Enter full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(cfEmail))      { setCfError("Enter a valid email."); return; }
    if (cfPw.length < 8)                       { setCfError("Password must be 8+ characters."); return; }
    setCfBusy(true);
    try {
      const r = await authFetch(`${API}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: cfName, email: cfEmail, password: cfPw, role: cfRole }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Create failed."); }
      showToast("User created.");
      setModal(null);
      setCfName(""); setCfEmail(""); setCfPw(""); setCfRole("user");
      load();
    } catch (e: any) { setCfError(e.message); }
    finally { setCfBusy(false); }
  };

  return (
    <AppShell adminOnly>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 text-sm shadow-lg bg-emerald-600 text-white rounded">
          {toast}
        </div>
      )}

      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold font-display">Users</h1>
        <button onClick={() => setModal({ type: "create" })} className="btn-admin">
          + Create User
        </button>
      </div>

      {loading ? (
        <div className="avss-card animate-pulse h-48" />
      ) : (
        <div className="avss-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left">
              <tr>
                {["ID","Name","Email","Role","Status","Actions"].map(h => (
                  <th key={h} className="p-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-t border-slate-700">
                    <td className="p-3">{u.id}</td>
                    <td className="p-3">
                      {u.full_name || "—"}
                      {isMe && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                    </td>
                    <td className="p-3">{u.email}</td>

                    {/* Role selector */}
                    <td className="p-3">
                      <select
                        className="avss-input !w-auto !py-1 text-xs"
                        value={u.role}
                        aria-label="Role"
                        disabled={isMe}
                        onChange={e => patchUser(u.id, { role: e.target.value })}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    <td className="p-3">
                      {u.is_active
                        ? <span className="text-emerald-300">Active</span>
                        : <span className="text-slate-400">Inactive</span>}
                    </td>

                    <td className="p-3 space-x-2 whitespace-nowrap">
                      <button
                        disabled={isMe}
                        onClick={() => patchUser(u.id, { is_active: !u.is_active })}
                        className={isMe ? "btn-outline opacity-40 cursor-not-allowed" : "btn-outline text-xs py-1"}
                        title={isMe ? "Cannot modify yourself" : undefined}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        disabled={isMe}
                        onClick={() => !isMe && setModal({ type: "delete", user: u })}
                        className={isMe ? "btn-outline-danger opacity-40 cursor-not-allowed text-xs py-1" : "btn-outline-danger text-xs py-1"}
                        title={isMe ? "Cannot delete yourself" : undefined}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create user modal ── */}
      {modal?.type === "create" && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="avss-card w-full max-w-md p-5 shadow-2xl">
            <h2 className="font-semibold text-lg font-display mb-4">Create User</h2>

            {cfError && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm mb-3">
                {cfError}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm text-slate-300">
                Full name
                <input value={cfName} onChange={e => setCfName(e.target.value)} className="avss-input mt-1" />
              </label>
              <label className="block text-sm text-slate-300">
                Email
                <input type="email" value={cfEmail} onChange={e => setCfEmail(e.target.value)} className="avss-input mt-1" />
              </label>
              <label className="block text-sm text-slate-300">
                Password
                <input type="password" value={cfPw} onChange={e => setCfPw(e.target.value)} className="avss-input mt-1" />
              </label>
              <label className="block text-sm text-slate-300">
                Role
                <select value={cfRole} onChange={e => setCfRole(e.target.value as "user"|"admin")} className="avss-input mt-1">
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setModal(null); setCfError(""); }} className="btn-outline">Cancel</button>
              <button onClick={createUser} disabled={cfBusy} className="btn-admin">
                {cfBusy ? "Creating…" : "Create user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {modal?.type === "delete" && modal.user && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="avss-card w-full max-w-sm p-5 shadow-2xl">
            <h2 className="font-semibold text-lg font-display mb-3">Delete User</h2>
            <p className="text-sm text-slate-300 mb-5">
              Delete <strong>{modal.user.email}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="btn-outline">Cancel</button>
              <button onClick={() => deleteUser(modal.user!.id)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
