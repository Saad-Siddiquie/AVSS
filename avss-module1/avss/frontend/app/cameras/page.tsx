"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface Camera {
  id: number;
  name: string;
  camera_type: "rtsp" | "webcam" | "file";
  url: string;
  location: string | null;
  status: string;
  description: string | null;
}

const EMPTY: Partial<Camera> = { camera_type: "rtsp", status: "active", name: "", url: "", location: "", description: "" };

const TYPE_HINTS: Record<string, string> = {
  rtsp:   "rtsp://192.168.1.100:554/stream",
  webcam: "0  or  /dev/video0",
  file:   "/path/to/video.mp4",
};

const TYPE_COLOR: Record<string, string> = {
  rtsp:   "text-blue-400",
  webcam: "text-emerald-400",
  file:   "text-purple-400",
};

// ── Camera card ───────────────────────────────────────────────────────────────
function CameraCard({
  cam, isAdmin, onEdit, onDelete,
}: {
  cam: Camera;
  isAdmin: boolean;
  onEdit: (c: Camera) => void;
  onDelete: (c: Camera) => void;
}) {
  const statusDot = cam.status === "active"
    ? "bg-emerald-400"
    : cam.status === "error"
    ? "bg-rose-400"
    : "bg-slate-500";

  return (
    <div className="avss-card p-4 flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} title={cam.status} />
          <span className="font-semibold truncate">{cam.name}</span>
        </div>
        <span className={`text-xs font-semibold uppercase flex-shrink-0 ${TYPE_COLOR[cam.camera_type] ?? "text-slate-400"}`}>
          {cam.camera_type}
        </span>
      </div>

      {/* Location */}
      <div className="text-sm text-slate-400">
        📍 {cam.location || "No location set"}
      </div>

      {/* URL */}
      <div className="text-xs text-slate-500 font-mono break-all bg-slate-900/60 px-2 py-1 rounded">
        {cam.url}
      </div>

      {/* Description */}
      {cam.description && (
        <p className="text-sm text-slate-300 line-clamp-2">{cam.description}</p>
      )}

      {/* Footer: status + actions */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <StatusBadge status={cam.status || "inactive"} />
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(cam)}
              className="text-xs text-slate-400 hover:text-slate-100 border border-slate-700 px-2 py-0.5 rounded hover:border-slate-500 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(cam)}
              className="text-xs text-rose-400 hover:text-rose-300 border border-rose-800 px-2 py-0.5 rounded hover:border-rose-600 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Camera form modal ─────────────────────────────────────────────────────────
function CameraModal({
  editing, onSave, onClose, busy, error,
}: {
  editing: Partial<Camera>;
  onSave: (c: Partial<Camera>) => void;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [form, setForm] = useState<Partial<Camera>>(editing);
  const set = (k: keyof Camera, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4"
      role="dialog" aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="avss-card w-full max-w-md p-5 shadow-2xl">
        <h2 className="text-lg font-semibold font-display mb-4">
          {form.id ? "Edit Camera" : "Add Camera"}
        </h2>

        {error && (
          <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm mb-3">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm text-slate-300">
            Name *
            <input
              value={form.name ?? ""}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Front Entrance"
              className="avss-input mt-1"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Type
            <select
              value={form.camera_type ?? "rtsp"}
              onChange={e => set("camera_type", e.target.value)}
              className="avss-input mt-1"
            >
              <option value="rtsp">RTSP Stream</option>
              <option value="webcam">Webcam / USB Camera</option>
              <option value="file">Video File</option>
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            URL / Path *
            <input
              value={form.url ?? ""}
              onChange={e => set("url", e.target.value)}
              placeholder={TYPE_HINTS[form.camera_type ?? "rtsp"]}
              className="avss-input mt-1"
            />
            <span className="text-xs text-slate-500 mt-0.5 block">
              e.g. {TYPE_HINTS[form.camera_type ?? "rtsp"]}
            </span>
          </label>

          <label className="block text-sm text-slate-300">
            Location / Zone
            <input
              value={form.location ?? ""}
              onChange={e => set("location", e.target.value)}
              placeholder="e.g. Gate A, Lobby, Parking B2"
              className="avss-input mt-1"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Description
            <input
              value={form.description ?? ""}
              onChange={e => set("description", e.target.value)}
              placeholder="Optional notes"
              className="avss-input mt-1"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Status
            <select
              value={form.status ?? "active"}
              onChange={e => set("status", e.target.value)}
              className="avss-input mt-1"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button
            disabled={busy}
            onClick={() => onSave(form)}
            className={form.id ? "btn-outline" : "btn-primary"}
            style={{ background: form.id ? undefined : undefined }}
          >
            {busy ? "Saving…" : form.id ? "Save Changes" : "Add Camera"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────────
function DeleteConfirm({ cam, onConfirm, onClose }: { cam: Camera; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="avss-card w-full max-w-sm p-5 shadow-2xl">
        <h2 className="font-semibold text-lg font-display mb-3">Delete Camera</h2>
        <p className="text-sm text-slate-300 mb-5">
          Delete <strong>{cam.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={onConfirm} className="btn-danger">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CamerasPage() {
  const { authFetch, isAdmin } = useAuth();
  const [cameras,  setCameras]  = useState<Camera[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<Partial<Camera> | null>(null);
  const [deleting, setDeleting] = useState<Camera | null>(null);
  const [formErr,  setFormErr]  = useState("");
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");

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

  const saveCamera = async (form: Partial<Camera>) => {
    setFormErr("");
    if (!form.name?.trim() || !form.url?.trim()) { setFormErr("Name and URL are required."); return; }
    setBusy(true);
    try {
      const isEdit = !!form.id;
      const r = await authFetch(
        isEdit ? `${API}/cameras/${form.id}` : `${API}/cameras`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:        form.name,
            camera_type: form.camera_type ?? "rtsp",
            url:         form.url,
            location:    form.location ?? "",
            description: form.description ?? "",
            status:      form.status ?? "active",
          }),
        },
      );
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Save failed."); }
      showToast(isEdit ? "Camera updated." : "Camera added.");
      setEditing(null);
      load();
    } catch (e: any) { setFormErr(e.message); }
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

  const filtered = typeFilter === "all"
    ? cameras
    : cameras.filter(c => c.camera_type === typeFilter);

  const types    = Array.from(new Set(cameras.map(c => c.camera_type)));
  const online   = cameras.filter(c => c.status === "active").length;

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 text-sm shadow-lg bg-emerald-600 text-white rounded">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div>
          <h1 className="text-2xl font-bold font-display">Cameras</h1>
          <p className="text-sm text-slate-400">
            {online} online · {cameras.length} total
            {!isAdmin && " · Read-only view"}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditing({ ...EMPTY }); setFormErr(""); }}
            className="btn-primary"
          >
            + Add Camera
          </button>
        )}
      </div>

      {/* Type filter */}
      {cameras.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 mb-5">
          {["all", ...types].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
                typeFilter === t
                  ? "bg-emerald-600/20 border-emerald-600 text-emerald-300"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {t === "all" ? "All types" : t.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-40 avss-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="avss-card p-12 text-center">
          {/* Better empty state */}
          <div className="text-5xl mb-4">📷</div>
          <p className="font-semibold text-lg">
            {cameras.length === 0 ? "No cameras registered yet" : "No cameras match this filter"}
          </p>
          <p className="text-sm text-slate-400 mt-1 mb-5">
            {isAdmin
              ? cameras.length === 0
                ? "Add your first RTSP stream, webcam, or video file as a virtual camera."
                : "Try changing the type filter above."
              : "Ask an administrator to add cameras."}
          </p>
          {isAdmin && cameras.length === 0 && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { setEditing({ ...EMPTY, camera_type: "rtsp" }); setFormErr(""); }}
                className="btn-primary"
              >
                Add RTSP Camera
              </button>
              <button
                onClick={() => { setEditing({ ...EMPTY, camera_type: "file" }); setFormErr(""); }}
                className="btn-outline"
              >
                Use video file as virtual camera
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <CameraCard
              key={c.id}
              cam={c}
              isAdmin={isAdmin}
              onEdit={cam => { setEditing({ ...cam }); setFormErr(""); }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {editing !== null && (
        <CameraModal
          editing={editing}
          onSave={saveCamera}
          onClose={() => setEditing(null)}
          busy={busy}
          error={formErr}
        />
      )}
      {deleting && (
        <DeleteConfirm
          cam={deleting}
          onConfirm={() => deleteCamera(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </AppShell>
  );
}
