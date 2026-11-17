"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera, Check, Play, Square, Maximize2,
  Wifi, WifiOff, X, Edit2, Trash2, Plus, RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import CctvScene from "@/components/art/CctvScene";

const API = "/api/backend";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8002";

interface Camera {
  id: number;
  name: string;
  camera_type: "rtsp" | "webcam" | "file";
  url: string;
  location: string | null;
  status: string;
  description: string | null;
}

const EMPTY: Partial<Camera> = {
  camera_type: "rtsp", status: "active",
  name: "", url: "", location: "", description: "",
};

// ── Helpers: auto-detect IP Webcam URLs ───────────────────────────────────────
function detectCameraType(url: string): Camera["camera_type"] {
  const u = url.trim().toLowerCase();
  if (!u) return "rtsp";
  if (u.startsWith("rtsp://")) return "rtsp";
  if (u.match(/^https?:\/\/.*:\d+/) || u.includes("/video") || u.includes("shot.jpg")) return "ip_webcam";
  if (u.startsWith("http://") || u.startsWith("https://")) return "ip_webcam";
  if (u === "0" || u.startsWith("/dev/") || u.match(/^\d+$/)) return "webcam";
  if (u.endsWith(".mp4") || u.endsWith(".avi") || u.endsWith(".mkv") || u.endsWith(".mov")) return "file";
  return "rtsp";
}

const TYPE_HINTS: Record<string, string> = {
  rtsp:      "rtsp://user:pass@192.168.1.100:554/stream1",
  webcam:    "0  or  /dev/video0",
  file:      "/path/to/recording.mp4",
  ip_webcam: "http://192.168.x.x:8080  (IP Webcam Android app)",
  http:      "http://192.168.x.x:8080/video  (HTTP MJPEG)",
};

// ── Live stream viewer modal ────────────────────────────────────────────────
// Browsers cannot play RTSP natively.
// Backend proxies RTSP → MJPEG via /api/v1/cameras/{id}/stream
// No auth on stream endpoint — <img> tags cannot send Authorization headers.
function LiveViewer({
  cam, onClose,
}: {
  cam: Camera;
  onClose: () => void;
}) {
  const [streamKey, setStreamKey] = useState(0);  // bump to reconnect
  const [full,      setFull]      = useState(false);
  const [errored,   setErrored]   = useState(false);
  const [loading,   setLoading]   = useState(true);

  const mjpegUrl = `${BACKEND}/api/v1/cameras/${cam.id}/stream/live`;

  const reload = () => { setErrored(false); setLoading(true); setStreamKey(k => k + 1); };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/95 flex flex-col ${full ? "" : "items-center justify-center p-4"}`}
      role="dialog" aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-panel flex flex-col overflow-hidden ${
        full ? "w-full h-full" : "w-full max-w-5xl rounded-xl shadow-2xl"
      }`}>

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge/50 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-bold text-danger">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse"/>
            LIVE
          </span>
          <div className="min-w-0 flex-1">
            <span className="font-display font-semibold text-white">{cam.name}</span>
            {cam.location && <span className="text-xs text-mute ml-2">— {cam.location}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={reload}
              className="btn-ghost px-2 py-1.5 text-xs" title="Reconnect stream">
              <RefreshCw className="size-3.5"/>
            </button>
            <button onClick={() => setFull(f => !f)}
              className="btn-ghost px-2 py-1.5" aria-label="Fullscreen">
              <Maximize2 className="size-4"/>
            </button>
            <button onClick={onClose}
              className="btn-ghost px-2 py-1.5" aria-label="Close">
              <X className="size-4"/>
            </button>
          </div>
        </div>

        {/* ── Stream area ───────────────────────────────────── */}
        <div className="flex-1 relative bg-black min-h-[300px] flex items-center justify-center">

          {/* MJPEG <img> — primary stream display */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={streamKey}
            src={mjpegUrl}
            alt={`Live: ${cam.name}`}
            className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${
              loading || errored ? "opacity-0 absolute" : "opacity-100"
            }`}
            onLoad={() => { setLoading(false); setErrored(false); }}
            onError={() => { setLoading(false); setErrored(true); }}
            style={{ display: "block" }}
          />

          {/* Loading state */}
          {loading && !errored && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
              <div className="size-12 rounded-full border-2 border-accent border-t-transparent animate-spin"/>
              <div>
                <p className="font-semibold">Connecting to stream…</p>
                <p className="text-xs text-mute mt-1">
                  Backend is opening the RTSP connection via FFmpeg
                </p>
              </div>
              <div className="text-[10px] font-mono text-mute bg-panel-2 px-3 py-2 rounded max-w-sm truncate">
                {cam.url.length > 70 ? cam.url.slice(0, 70) + "…" : cam.url}
              </div>
            </div>
          )}

          {/* Error state */}
          {errored && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
              <WifiOff className="size-14 text-danger opacity-50"/>
              <div>
                <p className="font-semibold text-danger">Stream unavailable</p>
                <p className="text-sm text-mute mt-1 max-w-sm">
                  Cannot reach the camera. Check that the RTSP URL is valid and the camera is online.
                </p>
              </div>
              <button onClick={reload} className="btn-primary">
                <RefreshCw className="size-4"/> Retry connection
              </button>
              <div className="text-[10px] font-mono text-mute bg-panel-2 px-3 py-1.5 rounded max-w-sm break-all">
                {cam.url}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer info ───────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 px-4 py-2.5 border-t border-edge/40 text-xs text-mute flex-shrink-0">
          <span>Type: <strong className="text-white">{cam.camera_type.toUpperCase()}</strong></span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cam.status === "active" ? "bg-ok" : "bg-danger"}`}/>
            {cam.status === "active" ? "Active" : "Inactive"}
          </span>
          {cam.description && <span>{cam.description}</span>}
          <span className="ml-auto text-[10px] font-mono truncate max-w-xs" title={cam.url}>
            {cam.url.length > 55 ? cam.url.slice(0, 55) + "…" : cam.url}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Add/Edit modal ──────────────────────────────────────────────────────────
function CameraModal({
  editing, onSave, onClose, busy, error,
}: {
  editing: Partial<Camera>;
  onSave: (c: Partial<Camera>) => void;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [form,    setForm]    = useState<Partial<Camera>>(editing);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof Camera, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setTestMsg(null);
  };

  // Quick-fill from the RTSP URL
  const quickFill = (url: string) => {
    setForm(p => ({ ...p, url, camera_type: "rtsp", status: "active" }));
    setTestMsg(null);
  };

  // Test connection via backend
  const testConnection = async () => {
    if (!form.url?.trim()) { setTestMsg({ ok: false, text: "Enter a URL first." }); return; }
    setTesting(true); setTestMsg(null);
    try {
      const res = await fetch(`${BACKEND}/api/v1/cameras/test-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.url }),
      });
      const d = await res.json();
      if (res.ok && d.reachable) {
        setTestMsg({ ok: true, text: `✓ Connected — ${d.width}×${d.height} @ ${d.fps?.toFixed(1)} fps` });
      } else {
        setTestMsg({ ok: false, text: d.detail || "Cannot connect. Check the URL and network." });
      }
    } catch {
      setTestMsg({ ok: false, text: "Test failed. Backend may not be running." });
    } finally { setTesting(false); }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
      role="dialog" aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="glass w-full max-w-lg p-6 shadow-2xl">
        <h2 className="font-display text-xl font-semibold mb-1">
          {form.id ? "Edit Camera" : "Add Camera"}
        </h2>
        <p className="text-sm text-mute mb-5">
          {form.id ? "Update camera settings." : "Register an RTSP stream, webcam, or video file."}
        </p>

        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 text-danger px-3 py-2 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Quick-fill from known URL */}
        {!form.id && (
          <div className="mb-4 p-3 rounded-xl bg-panel-2 border border-edge/50">
            <p className="text-xs text-mute mb-2 font-medium">Quick fill — paste a known RTSP URL:</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="rtsp://… or paste your camera URL here"
                className="field flex-1 text-xs"
                onBlur={e => e.target.value.trim() && quickFill(e.target.value.trim())}
                onKeyDown={e => { if (e.key === "Enter") { quickFill((e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = ""; } }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Name */}
          <label className="block text-sm text-mute">
            Camera Name *
            <input
              value={form.name ?? ""}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Retail Entrance, Gate A"
              className="field mt-1"
              autoFocus={!form.id}
            />
          </label>

          {/* Type */}
          <label className="block text-sm text-mute">
            Stream Type
            <select
              value={form.camera_type ?? "rtsp"}
              onChange={e => set("camera_type", e.target.value)}
              className="field mt-1"
            >
              <option value="rtsp">RTSP Stream (IP Camera / CCTV)</option>
              <option value="ip_webcam">IP Webcam Android App</option>
              <option value="webcam">Webcam / USB Camera</option>
              <option value="file">Video File (MP4, AVI, MKV)</option>
              <option value="http">HTTP MJPEG Stream</option>
            </select>
          </label>

          {/* URL with test button */}
          <div>
            <label className="block text-sm text-mute">
              URL / Path *
              <input
                value={form.url ?? ""}
                onChange={e => {
                  const url = e.target.value;
                  const detectedType = detectCameraType(url);
                  setForm(p => ({ ...p!, url, camera_type: detectedType as Camera["camera_type"] }));
                  setTestMsg(null);
                }}
                placeholder={TYPE_HINTS[form.camera_type ?? "rtsp"]}
                className="field mt-1"
              />
            </label>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-mute">
                {form.camera_type === "rtsp"
                  ? "Include credentials if required: rtsp://user:pass@ip:port/path"
                  : form.camera_type === "webcam"
                  ? "Use 0 for first webcam, 1 for second, etc."
                  : "Absolute path or HTTP URL to the video file"}
              </span>
              <button
                type="button"
                disabled={testing || !form.url?.trim()}
                onClick={testConnection}
                className="btn-ghost text-xs px-2.5 py-1 ml-2 flex-shrink-0"
              >
                {testing ? (
                  <span className="flex items-center gap-1">
                    <span className="size-3 rounded-full border border-current border-t-transparent animate-spin"/>
                    Testing…
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Wifi className="size-3"/> Test Connection
                  </span>
                )}
              </button>
            </div>

            {/* Test result */}
            {testMsg && (
              <div className={`mt-1.5 text-xs px-3 py-2 rounded-lg ${
                testMsg.ok
                  ? "bg-ok/10 border border-ok/30 text-ok"
                  : "bg-danger/10 border border-danger/30 text-danger"
              }`}>
                {testMsg.text}
              </div>
            )}
          </div>

          {/* Location */}
          <label className="block text-sm text-mute">
            Location / Zone
            <input
              value={form.location ?? ""}
              onChange={e => set("location", e.target.value)}
              placeholder="e.g. Gate A, Lobby, Parking Level 1"
              className="field mt-1"
            />
          </label>

          {/* Description */}
          <label className="block text-sm text-mute">
            Description <span className="opacity-50">(optional)</span>
            <input
              value={form.description ?? ""}
              onChange={e => set("description", e.target.value)}
              placeholder="Notes about this camera"
              className="field mt-1"
            />
          </label>

          {/* Status */}
          <label className="block text-sm text-mute">
            Status
            <select
              value={form.status ?? "active"}
              onChange={e => set("status", e.target.value)}
              className="field mt-1"
            >
              <option value="active">Active — include in processing</option>
              <option value="inactive">Inactive — registered but not used</option>
              <option value="error">Error — connection problem</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button disabled={busy} onClick={() => onSave(form)} className="btn-primary">
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                Saving…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="size-4"/>
                {form.id ? "Save Changes" : "Add Camera"}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Camera card ────────────────────────────────────────────────────────────
function CameraCard({
  cam, isAdmin, onEdit, onDelete, onView,
}: {
  cam: Camera;
  isAdmin: boolean;
  onEdit: (c: Camera) => void;
  onDelete: (c: Camera) => void;
  onView: (c: Camera) => void;
}) {
  const isActive = cam.status === "active";
  const [snapErr, setSnapErr] = useState(false);
  // Single JPEG snapshot for thumbnail — much faster than full MJPEG stream
  const snapshotUrl = `${BACKEND}/api/v1/cameras/${cam.id}/snapshot`;

  return (
    <div className="glass flex flex-col overflow-hidden transition-colors hover:border-accent/60 group">
      {/* Snapshot thumbnail */}
      <div
        className="aspect-video bg-bg relative cursor-pointer"
        onClick={() => onView(cam)}
        title={`View ${cam.name} live feed`}
      >
        {isActive && !snapErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshotUrl}
            alt={cam.name}
            className="w-full h-full object-cover"
            onError={() => setSnapErr(true)}
          />
        ) : (
          /* Fallback — show camera scene art when stream not available */
          <CctvScene
            people={isActive ? [{ trackId: cam.id, status: "identified", score: 0.88 }] : []}
            mode="detection"
            cameraNumber={cam.id}
            compact
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
          <div className="flex items-center gap-2 bg-black/70 rounded-full px-4 py-2 text-sm font-medium">
            <Play className="size-4 fill-white text-white"/> View Live
          </div>
        </div>

        {/* LIVE / OFFLINE badge */}
        <div className={`absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-bold rounded-full px-2 py-0.5 ${
          isActive ? "bg-danger text-white" : "bg-mute/40 text-mute"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full bg-current ${isActive ? "animate-pulse" : ""}`}/>
          {isActive ? "LIVE" : "OFFLINE"}
        </div>

        {/* Type badge */}
        <div className="absolute top-2 right-2 text-[10px] font-bold uppercase bg-black/60 text-white rounded px-1.5 py-0.5">
          {cam.camera_type}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{cam.name}</p>
            {cam.location && (
              <p className="text-xs text-mute truncate">📍 {cam.location}</p>
            )}
          </div>
        </div>

        <div className="text-[11px] text-mute font-mono truncate bg-panel-2/60 px-2 py-1 rounded" title={cam.url}>
          {cam.url.length > 55 ? cam.url.slice(0, 55) + "…" : cam.url}
        </div>

        {cam.description && (
          <p className="text-xs text-mute line-clamp-1">{cam.description}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => onView(cam)}
            className="btn-primary text-xs py-1 flex-1 justify-center"
          >
            <Play className="size-3"/> View Live
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(cam)}
                className="btn-ghost text-xs py-1 px-2.5"
                aria-label="Edit camera"
              >
                <Edit2 className="size-3.5"/>
              </button>
              <button
                onClick={() => onDelete(cam)}
                className="text-xs border border-danger/40 text-danger hover:bg-danger/10 rounded-lg px-2.5 py-1 transition-colors"
                aria-label="Delete camera"
              >
                <Trash2 className="size-3.5"/>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function CamerasPage() {
  const { authFetch, isAdmin } = useAuth();
  const [cameras,   setCameras]  = useState<Camera[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [editing,   setEditing]  = useState<Partial<Camera> | null>(null);
  const [deleting,  setDeleting] = useState<Camera | null>(null);
  const [viewing,   setViewing]  = useState<Camera | null>(null);
  const [formErr,   setFormErr]  = useState("");
  const [busy,      setBusy]     = useState(false);
  const [toast,     setToast]    = useState("");
  const [typeFilter,setTypeFilter] = useState<"all"|string>("all");

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

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
      const r = await authFetch(isEdit ? `${API}/cameras/${form.id}` : `${API}/cameras`, {
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
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Save failed."); }
      showToast(isEdit ? "Camera updated." : "Camera added.");
      setEditing(null); load();
    } catch (e: any) { setFormErr(e.message); }
    finally { setBusy(false); }
  };

  const deleteCamera = async (id: number) => {
    try {
      const r = await authFetch(`${API}/cameras/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Delete failed."); }
      showToast("Camera deleted.");
      setDeleting(null); load();
    } catch (e: any) { showToast(e.message); setDeleting(null); }
  };

  const filtered  = typeFilter === "all" ? cameras : cameras.filter(c => c.camera_type === typeFilter);
  const types     = Array.from(new Set(cameras.map(c => c.camera_type)));
  const online    = cameras.filter(c => c.status === "active").length;

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 glass px-4 py-2.5 text-sm flex items-center gap-2 text-ok shadow-xl">
          <Check className="size-4"/> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Cameras</h1>
          <p className="text-sm text-mute">
            {online > 0 ? (
              <span className="flex items-center gap-1.5">
                <Wifi className="size-3.5 text-ok"/> {online} online
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <WifiOff className="size-3.5"/> No cameras online
              </span>
            )}
            {" · "}{cameras.length} registered
            {!isAdmin && " · Read-only view"}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditing({ ...EMPTY }); setFormErr(""); }}
            className="btn-primary"
          >
            <Plus className="size-4"/> Add Camera
          </button>
        )}
      </div>

      {/* Type filter pills */}
      {cameras.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5 mt-3">
          {["all", ...types].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`chip ${typeFilter === t ? "!bg-accent/20 !border-accent !text-white" : ""}`}>
              {t === "all" ? `All (${cameras.length})` : `${t.toUpperCase()} (${cameras.filter(c=>c.camera_type===t).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="aspect-[4/3] glass rounded-xl"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-12 text-center">
          <Camera className="size-14 text-mute mx-auto mb-4" aria-hidden/>
          <p className="font-display text-xl font-semibold">
            {cameras.length === 0 ? "No cameras registered yet" : "No cameras match this filter"}
          </p>
          <p className="text-sm text-mute mt-2 mb-6 max-w-md mx-auto">
            {isAdmin
              ? "Register your RTSP streams, IP cameras, webcams, or video files. Each camera can be processed by the AI pipeline to detect and track persons."
              : "Ask an administrator to add cameras."}
          </p>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { setEditing({ ...EMPTY, camera_type: "rtsp" }); setFormErr(""); }}
                className="btn-primary"
              >
                <Plus className="size-4"/> Add RTSP Camera
              </button>
              <button
                onClick={() => { setEditing({ ...EMPTY, camera_type: "file" }); setFormErr(""); }}
                className="btn-ghost"
              >
                Use video file as virtual camera
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => (
            <CameraCard
              key={c.id}
              cam={c}
              isAdmin={isAdmin}
              onEdit={cam => { setEditing({ ...cam }); setFormErr(""); }}
              onDelete={setDeleting}
              onView={setViewing}
            />
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {editing !== null && (
        <CameraModal
          editing={editing}
          onSave={saveCamera}
          onClose={() => setEditing(null)}
          busy={busy}
          error={formErr}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-sm p-5">
            <h2 className="font-display text-lg font-semibold mb-3">Delete Camera</h2>
            <p className="text-sm text-mute mb-5">
              Delete <strong className="text-white">{deleting.name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => deleteCamera(deleting.id)} className="btn-danger">
                <Trash2 className="size-4"/> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live stream viewer */}
      {viewing && (
        <LiveViewer cam={viewing} onClose={() => setViewing(null)}/>
      )}
    </AppShell>
  );
}
