"use client";
import { useEffect, useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface User { id: number; full_name: string|null; email: string; role: string; is_active: boolean; is_superuser: boolean }

const roleBadge = (r: string) => r === "admin"
  ? "bg-warn/15 text-warn"
  : "bg-accent/15 text-accent";

export default function AdminUsersPage() {
  const { user: me, authFetch } = useAuth();
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<"create"|"delete"|null>(null);
  const [target,  setTarget]  = useState<User|null>(null);
  const [toast,   setToast]   = useState("");

  // Create form
  const [cfName,  setCfName]  = useState("");
  const [cfEmail, setCfEmail] = useState("");
  const [cfPw,    setCfPw]    = useState("");
  const [cfRole,  setCfRole]  = useState<"user"|"admin">("user");
  const [cfErr,   setCfErr]   = useState("");
  const [cfBusy,  setCfBusy]  = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(()=>setToast(""),3000); };

  const load = async () => {
    const r = await authFetch(`${API}/admin/users`);
    if (r.ok) setUsers(await r.json());
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const patch = async (id: number, body: Record<string,unknown>) => {
    const r = await authFetch(`${API}/admin/users/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
    });
    if(!r.ok){const d=await r.json();showToast(d?.detail||"Update failed.");return;}
    showToast("User updated."); load();
  };

  const del = async (id: number) => {
    const r = await authFetch(`${API}/admin/users/${id}`, {method:"DELETE"});
    if(!r.ok){const d=await r.json();showToast(d?.detail||"Delete failed.");}
    else { showToast("User deleted."); }
    setModal(null); setTarget(null); load();
  };

  const create = async () => {
    setCfErr("");
    if(!cfName.trim())                        {setCfErr("Enter full name.");return;}
    if(!/^\S+@\S+\.\S+$/.test(cfEmail))       {setCfErr("Enter a valid email.");return;}
    if(cfPw.length<8)                          {setCfErr("Password must be 8+ characters.");return;}
    setCfBusy(true);
    try {
      const r = await authFetch(`${API}/admin/users`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({full_name:cfName,email:cfEmail,password:cfPw,role:cfRole}),
      });
      if(!r.ok){const d=await r.json();throw new Error(d?.detail||"Create failed.");}
      showToast("User created."); setModal(null);
      setCfName(""); setCfEmail(""); setCfPw(""); setCfRole("user");
      load();
    } catch(e:any){setCfErr(e.message);}
    finally{setCfBusy(false);}
  };

  return (
    <AppShell adminOnly>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 glass px-4 py-2 text-sm flex items-center gap-2 text-ok">
          <Check className="size-4"/> {toast}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Users & Roles</h1>
            <p className="text-sm text-mute">{users.length} account{users.length!==1?"s":""}</p>
          </div>
          <button onClick={()=>{setModal("create");setCfErr("");}} className="btn-primary">
            <UserPlus className="size-4"/> Create User
          </button>
        </div>

        {loading ? (
          <div className="glass animate-pulse h-48 rounded-xl"/>
        ) : (
          <div className="glass overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-mute text-left text-xs uppercase tracking-wide">
                <tr>
                  {["ID","Name","Email","Role","Status","Actions"].map(h=>(
                    <th key={h} className="p-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className="border-t border-edge/40 hover:bg-panel-2/40 transition-colors">
                      <td className="p-3 font-mono text-xs text-mute">{u.id}</td>
                      <td className="p-3 font-medium">
                        {u.full_name||"—"}
                        {isMe&&<span className="ml-1 text-xs text-mute">(you)</span>}
                      </td>
                      <td className="p-3 text-mute">{u.email}</td>
                      <td className="p-3">
                        <select
                          className="field !w-auto !py-1 text-xs"
                          value={u.role}
                          disabled={isMe}
                          onChange={e=>patch(u.id,{role:e.target.value})}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs font-medium ${u.is_active?"text-ok":"text-mute"}`}>
                          {u.is_active?"Active":"Inactive"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isMe}
                            onClick={()=>!isMe&&patch(u.id,{is_active:!u.is_active})}
                            className={`text-xs border rounded-lg px-2.5 py-1 transition-colors ${
                              isMe
                                ? "border-edge/30 text-mute cursor-not-allowed opacity-40"
                                : "border-edge/70 text-mute hover:border-accent hover:text-white"
                            }`}
                          >
                            {u.is_active?"Deactivate":"Activate"}
                          </button>
                          <button
                            disabled={isMe}
                            onClick={()=>!isMe&&(setTarget(u),setModal("delete"))}
                            className={`text-xs border rounded-lg px-2.5 py-1 transition-colors ${
                              isMe
                                ? "border-edge/30 text-mute cursor-not-allowed opacity-40"
                                : "border-danger/50 text-danger hover:bg-danger/10"
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create user modal */}
      {modal==="create" && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-md p-5 shadow-2xl">
            <h2 className="font-display text-lg font-semibold mb-4">Create User</h2>
            {cfErr&&<div className="rounded-lg bg-danger/10 border border-danger/30 text-danger px-3 py-2 text-sm mb-3">{cfErr}</div>}
            <div className="space-y-3">
              <label className="block text-sm text-mute">Full name<input value={cfName} onChange={e=>setCfName(e.target.value)} className="field mt-1"/></label>
              <label className="block text-sm text-mute">Email<input type="email" value={cfEmail} onChange={e=>setCfEmail(e.target.value)} className="field mt-1"/></label>
              <label className="block text-sm text-mute">Password<input type="password" value={cfPw} onChange={e=>setCfPw(e.target.value)} className="field mt-1"/></label>
              <label className="block text-sm text-mute">
                Role
                <select value={cfRole} onChange={e=>setCfRole(e.target.value as "user"|"admin")} className="field mt-1">
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
              <button onClick={create} disabled={cfBusy} className="btn-primary">
                {cfBusy?"Creating…":"Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {modal==="delete" && target && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-sm p-5 shadow-2xl">
            <h2 className="font-display text-lg font-semibold mb-3">Delete User</h2>
            <p className="text-sm text-mute mb-5">Delete <strong className="text-white">{target.email}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>{setModal(null);setTarget(null);}} className="btn-ghost">Cancel</button>
              <button onClick={()=>del(target.id)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
