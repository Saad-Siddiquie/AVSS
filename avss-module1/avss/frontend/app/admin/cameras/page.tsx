"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface Camera {
  id: number;
  name: string;
  camera_type: string;
  url: string;
  location: string | null;
  status: string;
  description: string | null;
}

const EMPTY: Partial<Camera> = { camera_type: "rtsp", status: "active" };

export default function AdminCamerasPage() {
  const { authFetch } = useAuth();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Camera> | null>(null);
  const [deleting, setDeleting] = useState<Camera | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    const r = await authFetch(`${API}/cameras`);
    if (r.ok) {
      const d = await r.json();
      setCameras(d?.cameras ?? (Array.isArray(d) ? d : []));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveCamera = async () => {
    setFormError("");
    if (!editing?.name?.trim() || !editing?.url?.trim()) {
      setFormError("Name and URL are required."); return;
    }
    setBusy(true);
    try {
      const isEdit = !!editing.id;
      const r = await authFetch(
        isEdit ? `${API}/cameras/${editing.id}` : `${API}/cameras`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:        editing.name,
            camera_type: editing.camera_type ?? "rtsp",
            url:         editing.url,
            location:    editing.location ?? "",
            description: editing.description ?? "",
            status:      editing.status ?? "active",
          }),
        },
      );
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Save failed."); }
      showToast("Camera saved.");
      setEditing(null);
      load();
    } catch (e: any) { setFormError(e.message); }
    finally { setBusy(false); }
  };

  const deleteCamera = async (id: number) => {
    try {
      const r = await authFetch(`${API}/cameras/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Delete failed."); }
      showToast("Camera deleted.");
      setDeleting(null);
      load();
    } catch (e: any) { showToast(e.message); setDeleting(null); }
  };

  return (
    <AppShell adminOnly>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 text-sm shadow-lg bg-emerald-600 text-white rounded">
          {toast}
        </div>
      )}

      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold font-display">Cameras</h1>
        <button onClick={() => { setEditing({ ...EMPTY }); setFormError(""); }} className="btn-admin">
          + Add Camera
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-40 avss-card" />)}
        </div>
      ) : cameras.length === 0 ? (
        <div className="avss-card p-10 text-center">
          <p className="font-medium">No cameras registered</p>
          <p className="text-sm text-slate-400 mt-1">Add the first camera to get started.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cameras.map(c => (
            <div key={c.id} className="avss-card p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold">{c.name}</div>
                <StatusBadge status={c.camera_type} />
              </div>
              <div className="text-sm text-slate-400">{c.location || "No location"}</div>
              <div className="text-xs text-slate-500 break-all mt-1">{c.url}</div>
              {c.description && <p className="text-sm mt-2 text-slate-300">{c.description}</p>}
              <div className="mt-2"><StatusBadge status={c.status || "active"} /></div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setEditing({ ...c }); setFormError(""); }}
                  className="btn-outline text-xs py-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleting(c)}
                  className="btn-outline-danger text-xs py-1"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      {editing !== null && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="avss-card w-full max-w-md p-5 shadow-2xl">
            <h2 className="font-semibold text-lg font-display mb-4">
              {editing.id ? "Edit camera" : "Add camera"}
            </h2>

            {formError && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm mb-3">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm text-slate-300">
                Name *
                <input
                  value={editing.name ?? ""}
                  onChange={e => setEditing(v => ({ ...v!, name: e.target.value }))}
                  className="avss-input mt-1"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Type
                <select
                  value={editing.camera_type ?? "rtsp"}
                  onChange={e => setEditing(v => ({ ...v!, camera_type: e.target.value }))}
                  className="avss-input mt-1"
                >
                  <option value="rtsp">rtsp</option>
                  <option value="webcam">webcam</option>
                  <option value="file">file</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                URL *
                <input
                  value={editing.url ?? ""}
                  onChange={e => setEditing(v => ({ ...v!, url: e.target.value }))}
                  className="avss-input mt-1"
                  placeholder="rtsp://… or /path/to/file.mp4"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Location
                <input
                  value={editing.location ?? ""}
                  onChange={e => setEditing(v => ({ ...v!, location: e.target.value }))}
                  className="avss-input mt-1"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Description
                <input
                  value={editing.description ?? ""}
                  onChange={e => setEditing(v => ({ ...v!, description: e.target.value }))}
                  className="avss-input mt-1"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
              <button onClick={saveCamera} disabled={busy} className="btn-admin">
                {busy ? "Saving…" : "Save camera"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleting && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="avss-card w-full max-w-sm p-5 shadow-2xl">
            <h2 className="font-semibold text-lg font-display mb-3">Delete Camera</h2>
            <p className="text-sm text-slate-300 mb-5">
              Delete <strong>{deleting.name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="btn-outline">Cancel</button>
              <button onClick={() => deleteCamera(deleting.id)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
