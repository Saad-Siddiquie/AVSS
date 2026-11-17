"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Pause, Play, Maximize2, WifiOff, Wifi,
  RefreshCw, ScanFace, ImageIcon, X, Check, Upload,
  Smartphone, Video, Square, Loader2, AlertCircle, Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const API     = "/api/backend";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8002";

interface Camera {
  id: number; name: string; camera_type: string;
  url: string; location: string | null; status: string; description: string | null;
}

const pad   = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ── RTSP stream viewer — backend MJPEG proxy ─────────────────────────────────
function RTSPViewer({
  camera, paused, aiOverlay = true, conf = 0.55,
}: {
  camera: Camera; paused: boolean; aiOverlay?: boolean; conf?: number;
}) {
  const [key,     setKey]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  // For webcam/V4L2 cameras use the raw stream by default — no inference delay
  const isWebcam = camera.camera_type === "webcam" || camera.url.startsWith("/dev/video");

  // /stream/live = AI detection overlay, /stream = raw
  const mjpegUrl = (aiOverlay && !isWebcam)
    ? `${BACKEND}/api/v1/cameras/${camera.id}/stream/live?conf=${conf.toFixed(2)}`
    : `${BACKEND}/api/v1/cameras/${camera.id}/stream`;

  const showStream = !paused;
  const reload = () => { setLoading(true); setErrored(false); setKey(k => k + 1); };

  // Auto-dismiss loading after 4s — MJPEG onLoad is unreliable
  useEffect(() => {
    if (!showStream) return;
    setLoading(true);
    setErrored(false);
    const t = setTimeout(() => setLoading(false), 4000);
    return () => clearTimeout(t);
  }, [key, showStream]);

  return (
    <div className="relative w-full h-full bg-bg min-h-[300px]">
      {/* MJPEG stream via <img> — works natively in all browsers */}
      {showStream && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={mjpegUrl}
          alt={`Live feed: ${camera.name}`}
          className="w-full h-full object-contain"
          onLoad={() => { setLoading(false); setErrored(false); }}
          onError={() => { setLoading(false); setErrored(true); }}
        />
      )}

      {/* Loading spinner — shown for first 4s while stream connects */}
      {loading && showStream && !errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="size-10 rounded-full border-2 border-accent border-t-transparent animate-spin"/>
          <p className="text-sm text-mute">Connecting to stream…</p>
          <p className="text-xs text-mute opacity-60">
            {camera.url.length > 60 ? camera.url.slice(0, 60) + "…" : camera.url}
          </p>
        </div>
      )}

      {/* Error state */}
      {errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
          <WifiOff className="size-12 text-danger opacity-60" aria-hidden/>
          <div>
            <p className="font-semibold text-danger">Stream Unavailable</p>
            <p className="text-xs text-mute mt-1 max-w-xs">
              Cannot connect to the camera stream. Check that the camera is online and the RTSP URL is correct.
            </p>
          </div>
          <button onClick={reload} className="btn-ghost text-sm">
            <RefreshCw className="size-4"/> Retry
          </button>
          <code className="text-[10px] text-mute bg-panel-2 px-2 py-1 rounded break-all max-w-sm">
            {camera.url}
          </code>
        </div>
      )}

      {/* Paused overlay */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/80">
          <div className="flex flex-col items-center gap-2 text-mute">
            <Pause className="size-12 opacity-40"/>
            <span className="text-sm">Stream paused</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Person-search live viewer ─────────────────────────────────────────────────
// Flow: POST photo → get token → <img src="/stream/person?token=...">
// cameraId is captured at search-start time and doesn't change mid-stream.
function PersonSearchViewer({
  cameraId, queryPhoto, threshold, appearanceThreshold, conf, paused, focusMode = false,
}: {
  cameraId: number;
  queryPhoto: File;
  threshold: number;
  appearanceThreshold: number;
  conf: number;
  paused: boolean;
  focusMode?: boolean;
}) {
  const [streamUrl,    setStreamUrl]   = useState<string | null>(null);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState("");
  const [searchLabel,  setSearchLabel] = useState("");
  // Key to force a full restart when the user explicitly re-runs the search
  const [searchKey,    setSearchKey]   = useState(0);

  useEffect(() => {
    if (paused) return;

    setLoading(true); setError(""); setStreamUrl(null);

    const fd = new FormData();
    fd.append("query_image", queryPhoto);
    fd.append("similarity_threshold", String(threshold));
    fd.append("appearance_threshold", String(appearanceThreshold));
    fd.append("conf", String(conf));
    fd.append("focus_mode", String(focusMode));

    let storedToken: string | null = null;
    try { storedToken = localStorage.getItem("avss_token"); } catch { /* */ }
    const controller = new AbortController();
    let active = true;

    fetch(`/api/backend/cameras/${cameraId}/query/register`, {
      method:  "POST",
      headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      body:    fd,
      signal:  controller.signal,
    })
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d?.detail || `Error ${r.status}`); });
        return r.json();
      })
      .then(d => {
        if (!active) return;
        const modes = [
          d.face_ready ? "ArcFace face" : null,
          d.appearance_ready ? "OSNet appearance" : null,
        ].filter(Boolean);
        setSearchLabel(modes.length ? `Matching: ${modes.join(" + ")}` : "No model available");
        const B = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8002";
        setStreamUrl(`${B}/api/v1/cameras/${cameraId}/stream/person?token=${d.stream_token}`);
        setLoading(false);
      })
      .catch(e => {
        if (!active || controller.signal.aborted) return;
        setError(e.message || "Failed to start person search.");
        setLoading(false);
      });

    return () => { active = false; controller.abort(); };
    // Only re-run when the user explicitly restarts (searchKey) or pauses
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, searchKey, paused, focusMode]);

  if (paused) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg text-mute">
        <p className="text-sm">Stream paused</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-bg">
        <div className="size-10 rounded-full border-2 border-accent border-t-transparent animate-spin"/>
        <p className="text-sm text-mute">Generating face embedding…</p>
        <p className="text-xs text-mute opacity-60">Sending query to ArcFace recognition model</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-bg text-center p-6">
        <ScanFace className="size-12 text-danger opacity-50"/>
        <p className="text-danger font-semibold text-sm">{error}</p>
        <p className="text-xs text-mute">Try a clearer front-facing photo</p>
        <button
          onClick={() => setSearchKey(k => k + 1)}
          className="btn-ghost text-xs mt-2"
        >
          <RefreshCw className="size-3"/> Retry
        </button>
      </div>
    );
  }

  if (!streamUrl) return null;

  return (
    <div className="relative w-full h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={streamUrl}
        alt="Person search stream"
        className="w-full h-full object-contain"
      />
      {searchLabel && (
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] text-white">
          {searchLabel}
        </span>
      )}
    </div>
  );
}

// ── Thumbnail for the all-cameras grid ───────────────────────────────────────
function CameraThumbnail({
  cam, active, onClick,
}: {
  cam: Camera; active: boolean; onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  // Use snapshot for thumbnails (single frame, much faster than MJPEG)
  const thumbUrl = `${BACKEND}/api/v1/cameras/${cam.id}/snapshot`;
  const isOnline = cam.status === "active";

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`block w-full overflow-hidden rounded-xl border text-left transition-colors ${
        active ? "border-accent ring-2 ring-accent/60" : "border-edge/60 hover:border-accent/60"
      }`}
    >
      <div className="aspect-video bg-bg relative">
        {isOnline && !errored ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={cam.name}
            className="w-full h-full object-cover"
            onError={() => setErrored(true)}
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <WifiOff className="size-6 text-mute opacity-40"/>
          </div>
        )}

        {/* Status dot */}
        <div className={`absolute top-1.5 left-1.5 text-[9px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-1 ${
          isOnline ? "bg-danger text-white" : "bg-mute/40 text-mute"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full bg-current ${isOnline ? "animate-pulse" : ""}`}/>
          {isOnline ? "LIVE" : "OFF"}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 bg-panel-2 px-2 py-1.5 text-xs">
        <span className="truncate font-medium">{cam.name}</span>
        <span className="text-mute shrink-0">{cam.camera_type.toUpperCase()}</span>
      </div>
    </button>
  );
}

// ── Live camera status interface ──────────────────────────────────────────────
interface LiveCamStatus {
  phone_connected: boolean;
  phone_model: string | null;
  adb_available: boolean;
  adb_error: string | null;
  unauthorized: boolean;
  scrcpy_running: boolean;
  v4l2_device: string;
  v4l2_ready: boolean;
  resolution: string;
  fps: number;
  camera_id: string;
  camera_name: string;
  scrcpy_path: string;
  scrcpy_exists: boolean;
  manual_command: string;
  camera_db_id: number | null;
}

// ── Laptop Webcam control ──────────────────────────────────────────────────
function LaptopCamControl({ authFetch, onCameraReady }: {
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onCameraReady: (cameraDbId: number) => void;
}) {
  const [available, setAvailable]       = useState<boolean | null>(null);
  const [loading,   setLoading]         = useState(false);
  const [error,     setError]           = useState("");
  const [cameraDbId, setCameraDbId]     = useState<number | null>(null);

  // Check laptop cam status once on mount
  useEffect(() => {
    let active = true;
    authFetch(`${API}/cameras/laptop-cam/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!active || !d) return;
        setAvailable(d.available);
        if (d.camera_db_id) setCameraDbId(d.camera_db_id);
      })
      .catch(() => setAvailable(false));
    return () => { active = false; };
  }, [authFetch]);

  async function openLaptopCam() {
    setLoading(true); setError("");
    try {
      const r = await authFetch(`${API}/cameras/laptop-cam/start`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail || "Failed to open laptop webcam.");
      } else {
        const d = await r.json();
        if (d.camera_db_id) {
          setCameraDbId(d.camera_db_id);
          onCameraReady(d.camera_db_id);
        }
      }
    } catch { setError("Network error — is the backend running?"); }
    setLoading(false);
  }

  if (available === false) return null; // hide panel if /dev/video0 doesn't exist

  return (
    <section className="glass p-4" aria-label="Laptop Webcam">
      <h2 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
        <Video className="size-4 text-ok" />
        Laptop Webcam
        <span className="ml-auto text-[10px] font-normal text-mute bg-panel-2 px-2 py-0.5 rounded">
          HP HD Camera · /dev/video0
        </span>
      </h2>

      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className={`size-2 rounded-full ${available ? "bg-ok animate-pulse" : "bg-mute"}`} />
        {available === null
          ? <span className="text-mute">Checking…</span>
          : available
          ? <span className="text-ok">640×480 @ 30fps · Ready</span>
          : <span className="text-mute">Not available</span>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={openLaptopCam}
          disabled={!available || loading}
          className="btn-primary flex-1 justify-center text-sm"
        >
          {loading
            ? <><Loader2 className="size-4 animate-spin" /> Opening…</>
            : <><Video className="size-4" /> Use Laptop Cam</>}
        </button>
        {cameraDbId && (
          <button
            onClick={() => onCameraReady(cameraDbId)}
            className="btn-ghost justify-center text-sm px-3"
            title="View in main viewer"
          >
            <Maximize2 className="size-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger">
          <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-[9px] text-mute mt-2">
        No scrcpy or USB required · Direct V4L2 access · Lowest latency
      </p>
    </section>
  );
}

// ── Pixel 7 USB Camera control ───────────────────────────────────────────────
function LiveCamControl({ authFetch, onCameraReady }: {
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onCameraReady: (cameraDbId: number) => void;
}) {
  const [status, setStatus]               = useState<LiveCamStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]                 = useState("");
  const [autoStart, setAutoStart]         = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const r = await authFetch(`${API}/cameras/live-cam/status`);
        if (active && r.ok) setStatus(await r.json());
      } catch { /* backend starting */ }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => { active = false; clearInterval(t); };
  }, [authFetch]);

  useEffect(() => {
    if (!autoStart || !status || actionLoading) return;
    if (status.phone_connected && !status.scrcpy_running && !status.v4l2_ready && !autoTriggered) {
      setAutoTriggered(true);
      doStart();
    }
    if (!status.phone_connected) setAutoTriggered(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, status, actionLoading, autoTriggered]);

  async function doStart() {
    setActionLoading(true); setError("");
    try {
      const r = await authFetch(`${API}/cameras/live-cam/start`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail || "Failed to start live camera.");
      } else {
        const d = await r.json();
        if (d.camera_db_id) onCameraReady(d.camera_db_id);
      }
      const sr = await authFetch(`${API}/cameras/live-cam/status`);
      if (sr.ok) setStatus(await sr.json());
    } catch { setError("Network error — is the backend running?"); }
    setActionLoading(false);
  }

  async function doStop() {
    setActionLoading(true); setError("");
    try {
      await authFetch(`${API}/cameras/live-cam/stop`, { method: "POST" });
      const sr = await authFetch(`${API}/cameras/live-cam/status`);
      if (sr.ok) setStatus(await sr.json());
    } catch { setError("Network error — is the backend running?"); }
    setActionLoading(false);
  }

  const phoneOk  = status?.phone_connected;
  const cameraOn = status?.v4l2_ready;
  const scrcpyOn = status?.scrcpy_running;
  const canStart = !!phoneOk && !!status?.scrcpy_exists && !actionLoading;

  return (
    <section className="glass p-4" aria-label="Pixel 7 USB Camera">
      <h2 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
        <Smartphone className="size-4 text-accent" />
        Pixel 7 USB Camera
      </h2>

      {/* Status indicators */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={`size-2 rounded-full ${phoneOk ? "bg-ok animate-pulse" : status?.unauthorized ? "bg-warn" : "bg-mute"}`} />
          {phoneOk ? (
            <span className="text-ok">Phone Connected{status?.phone_model ? ` (${status.phone_model})` : ""}</span>
          ) : status?.unauthorized ? (
            <span className="text-warn">Phone Connected — tap &quot;Allow USB debugging&quot;</span>
          ) : status?.adb_available ? (
            <span className="text-mute">Phone Not Connected</span>
          ) : status ? (
            <span className="text-mute">ADB Not Installed</span>
          ) : (
            <span className="text-mute">Checking…</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`size-2 rounded-full ${cameraOn ? "bg-ok animate-pulse" : scrcpyOn ? "bg-warn animate-pulse" : "bg-mute"}`} />
          {cameraOn ? (
            <span className="text-ok">Camera Running · {status?.resolution}@{status?.fps}fps</span>
          ) : scrcpyOn ? (
            <span className="text-warn">Starting scrcpy…</span>
          ) : (
            <span className="text-mute">Camera Stopped</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {cameraOn || scrcpyOn ? (
          <>
            {cameraOn && status?.camera_db_id && (
              <button onClick={() => onCameraReady(status.camera_db_id!)} className="btn-primary flex-1 justify-center text-sm">
                <Video className="size-4" /> View Live Feed
              </button>
            )}
            <button onClick={doStop} disabled={actionLoading}
              className="btn-ghost justify-center text-sm border-danger/40 text-danger hover:bg-danger/10">
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
              {actionLoading ? "…" : "Stop"}
            </button>
          </>
        ) : (
          <button onClick={doStart} disabled={!canStart} className="btn-primary w-full justify-center text-sm">
            {actionLoading
              ? <><Loader2 className="size-4 animate-spin" /> Starting…</>
              : <><Video className="size-4" /> Start Live Cam</>}
          </button>
        )}
      </div>

      {/* Auto-start toggle */}
      <label className="flex items-center gap-2 mt-3 text-xs text-mute cursor-pointer select-none">
        <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} className="accent-accent size-3.5" />
        <Zap className="size-3" />
        Auto-start when phone connects via USB
      </label>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger">
          <AlertCircle className="size-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {status?.unauthorized && !error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn/10 border border-warn/30 px-3 py-2 text-xs text-warn">
          <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
          <span>Unlock your phone and tap &quot;Allow USB debugging&quot; to continue.</span>
        </div>
      )}
      {!status?.scrcpy_exists && phoneOk && !error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn/10 border border-warn/30 px-3 py-2 text-xs text-warn">
          <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
          <span>scrcpy not found at <code className="text-warn/80">{status?.scrcpy_path}</code>. Set <code className="text-warn/80">AVSS_SCRCPY_DIR</code>.</span>
        </div>
      )}
      {cameraOn && (
        <div className="mt-3 flex items-center gap-2 text-[10px] text-mute">
          <code className="bg-panel-2 px-2 py-0.5 rounded">{status?.v4l2_device}</code>
          <span>·</span>
          <code className="bg-panel-2 px-2 py-0.5 rounded">{status?.camera_id}</code>
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function LiveContent() {
  const params        = useSearchParams();
  const { authFetch } = useAuth();
  const [cameras, setCameras]   = useState<Camera[]>([]);
  const [camIdx,  setCamIdx]    = useState(0);
  const [paused,  setPaused]    = useState(false);
  const [now,     setNow]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [aiOverlay, setAiOverlay] = useState(true);
  const [conf,    setConf]      = useState(0.35);
  const [queryPhoto,    setQueryPhoto]    = useState<File | null>(null);
  const [queryPhotoUrl, setQueryPhotoUrl] = useState<string | null>(null);
  const [searchMode,    setSearchMode]    = useState(false);
  const [searchCameraId, setSearchCameraId] = useState<number | null>(null); // locked at search start
  const [simThreshold,  setSimThreshold]  = useState(0.45);
  const [appearanceThreshold, setAppearanceThreshold] = useState(0.65);
  const [focusMode, setFocusMode] = useState(false); // show only the matched person
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authFetch(`${API}/cameras`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list: Camera[] = d?.cameras ?? (Array.isArray(d) ? d : []);
        setCameras(list);
        const paramId = params.get("camera");
        if (paramId) {
          const idx = list.findIndex(c => String(c.id) === paramId);
          if (idx >= 0) setCamIdx(idx);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setNow(stamp(new Date()));
    if (paused) return;
    const t = setInterval(() => setNow(stamp(new Date())), 1000);
    return () => clearInterval(t);
  }, [paused]);

  const fullscreen = () => {
    if (!videoRef.current) return;
    document.fullscreenElement ? document.exitFullscreen() : videoRef.current.requestFullscreen();
  };

  const camera = cameras[camIdx];
  const online = cameras.filter(c => c.status === "active").length;

  function openCameraById(dbId: number) {
    const idx = cameras.findIndex(c => c.id === dbId);
    if (idx >= 0) {
      setCamIdx(idx);
      setPaused(false);
      // Keep searchMode active if a search is running — only clear it on explicit camera switch
      return;
    }
    authFetch(`${API}/cameras`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list: Camera[] = d?.cameras ?? (Array.isArray(d) ? d : []);
        setCameras(list);
        const newIdx = list.findIndex(c => c.id === dbId);
        if (newIdx >= 0) { setCamIdx(newIdx); setPaused(false); }
      }).catch(() => {});
  }

  function pickPhoto(f?: File) {
    if (!f || !["image/jpeg","image/png","image/webp"].includes(f.type)) return;
    if (queryPhotoUrl) URL.revokeObjectURL(queryPhotoUrl);
    setQueryPhoto(f);
    setQueryPhotoUrl(URL.createObjectURL(f));
    setSearchMode(false);
  }
  function startPersonSearch() {
    if (!queryPhoto || !camera) return;
    // Pause the raw stream first — this unmounts RTSPViewer and closes the browser
    // HTTP connection to /stream, freeing the V4L2 device for the person search stream.
    setPaused(true);
    // Small delay to let the browser close the raw stream connection before the
    // person search stream tries to open the same V4L2 device.
    setTimeout(() => {
      setSearchCameraId(camera.id);
      setSearchMode(true);
      setPaused(false);
    }, 600);
  }
  function clearSearch() {
    setSearchMode(false);
    setSearchCameraId(null);
    setQueryPhoto(null);
    if (queryPhotoUrl) URL.revokeObjectURL(queryPhotoUrl);
    setQueryPhotoUrl(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Monitoring"
        subtitle={`${online} of ${cameras.length} cameras online · Real-time RTSP stream`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {searchMode && queryPhoto && searchCameraId !== null ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-ok/15 border border-ok/40 text-ok rounded-full px-3 py-1">
                <ScanFace className="size-3.5"/>
                Searching on {cameras.find(c => c.id === searchCameraId)?.name ?? `Camera ${searchCameraId}`}
              </span>
            ) : (
              <>
                <button onClick={() => setAiOverlay(v => !v)}
                  className={`btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 ${aiOverlay ? "border-ok/60 text-ok" : ""}`}>
                  <span className={`size-2 rounded-full ${aiOverlay ? "bg-ok animate-pulse" : "bg-mute"}`}/>
                  {aiOverlay ? "AI ON" : "AI OFF"}
                </button>
                {aiOverlay && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-mute hidden sm:inline">Conf</span>
                    <input type="range" min={0.30} max={0.90} step={0.05} value={conf}
                      onChange={e => setConf(Number(e.target.value))} className="w-16 accent-ok"/>
                    <span className="tabular-nums text-ok w-8">{conf.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <button className="btn-ghost" onClick={() => setPaused(p => !p)}>
              {paused ? <Play className="size-4"/> : <Pause className="size-4"/>}
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">

        {/* ── Main viewer ─────────────────────────────────────────── */}
        <section className="glass p-3 sm:p-4 space-y-3" aria-labelledby="cam-title">
          {loading ? (
            <div className="aspect-video animate-pulse bg-panel rounded-xl" />
          ) : cameras.length === 0 ? (
            <div className="aspect-video flex flex-col items-center justify-center gap-4 text-center rounded-xl border border-dashed border-edge/50">
              <Smartphone className="size-14 text-accent opacity-40" />
              <div>
                <p className="font-semibold text-base">No cameras registered</p>
                <p className="text-sm text-mute mt-1">
                  Connect your Pixel 7 and click <strong className="text-accent">Start Live Cam →</strong>
                </p>
                <p className="text-xs text-mute mt-1 opacity-60">Or go to Cameras to add an RTSP stream.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="cam-title" className="font-display text-base font-semibold">
                  {camera?.name || "No camera"}
                  {camera?.location && <span className="font-normal text-mute ml-2">— {camera.location}</span>}
                </h2>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ml-auto ${
                  paused ? "bg-mute/20 text-mute" : (searchMode && searchCameraId !== null) ? "bg-ok text-bg" : "bg-danger text-white"
                }`}>
                  <span className={`size-1.5 rounded-full bg-current ${!paused ? "animate-pulse" : ""}`} aria-hidden/>
                  {paused ? "PAUSED" : (searchMode && searchCameraId !== null) ? "SEARCHING" : "LIVE"}
                </span>
                <time className="text-xs tabular-nums text-mute" suppressHydrationWarning>{now}</time>
                <button onClick={fullscreen} className="btn-ghost px-2 py-1.5" aria-label="Fullscreen">
                  <Maximize2 className="size-4"/>
                </button>
              </div>

              <div ref={videoRef} className="aspect-video overflow-hidden rounded-xl border border-edge/70 bg-bg">
                {camera ? (
                  searchMode && queryPhoto && searchCameraId !== null ? (
                    <PersonSearchViewer cameraId={searchCameraId} queryPhoto={queryPhoto}
                      threshold={simThreshold} appearanceThreshold={appearanceThreshold}
                      conf={conf} paused={paused} focusMode={focusMode}/>
                  ) : (
                    <RTSPViewer camera={camera} paused={paused} aiOverlay={aiOverlay} conf={conf}/>
                  )
                ) : (
                  <div className="w-full h-full grid place-items-center text-mute text-sm">Select a camera below</div>
                )}
              </div>

              {camera && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-mute bg-panel-2/50 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {camera.status === "active"
                      ? <Wifi className="size-3.5 text-ok"/>
                      : <WifiOff className="size-3.5 text-danger"/>}
                    {camera.status === "active" ? "Connected" : "Offline"}
                  </span>
                  <span>Type: <strong className="text-white">{camera.camera_type.toUpperCase()}</strong></span>
                  <span className="font-mono truncate max-w-xs" title={camera.url}>
                    {camera.url.length > 55 ? camera.url.slice(0, 55) + "…" : camera.url}
                  </span>
                  {/* Direct stream test link — opens raw MJPEG in new tab */}
                  <a
                    href={`${BACKEND}/api/v1/cameras/${camera.id}/stream`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-accent hover:underline text-[10px]"
                  >
                    Test stream ↗
                  </a>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Right panel ──────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Laptop Webcam — fastest option, no USB/ADB overhead */}
          <LaptopCamControl authFetch={authFetch} onCameraReady={openCameraById} />

          {/* Pixel 7 USB Camera control — always visible */}
          <LiveCamControl authFetch={authFetch} onCameraReady={openCameraById} />

          {/* Live person search */}
          <section className="glass p-4" aria-label="Person search">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-semibold flex items-center gap-2">
                <ScanFace className="size-4 text-ok"/>
                Live Person Search
              </h2>
              {searchMode && (
                <button onClick={clearSearch} className="text-xs text-mute hover:text-danger flex items-center gap-1">
                  <X className="size-3"/> Clear
                </button>
              )}
            </div>

            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }} onChange={e => pickPhoto(e.target.files?.[0])} />

            {queryPhoto && queryPhotoUrl ? (
              <div className="flex gap-3 items-start mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={queryPhotoUrl} alt="Query person"
                  className="w-16 h-20 object-cover rounded-lg border-2 border-ok/50 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{queryPhoto.name}</p>
                  <p className="text-[10px] text-mute mt-0.5">{(queryPhoto.size/1e3).toFixed(1)} KB</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Check className="size-3 text-ok"/>
                    <span className="text-[10px] text-ok">Photo ready</span>
                  </div>
                  <button onClick={() => photoInputRef.current?.click()}
                    className="text-[10px] text-mute hover:text-white underline mt-1 block">Replace</button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-edge hover:border-ok/50 rounded-xl p-4 text-center cursor-pointer transition-colors mb-3"
                onClick={() => photoInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); pickPhoto(e.dataTransfer.files[0]); }}>
                <ScanFace className="size-8 text-mute mx-auto mb-1.5 opacity-60"/>
                <p className="text-xs font-medium">Upload face or full-person photo</p>
                <p className="text-[10px] text-mute mt-0.5">Full-body photo enables OSNet appearance matching</p>
              </div>
            )}

            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-mute mb-1">
                <span>YOLO person confidence</span>
                <span className="text-white font-semibold">{conf.toFixed(2)}</span>
              </div>
              <input type="range" min={0.20} max={0.80} step={0.05} value={conf}
                onChange={e => setConf(Number(e.target.value))} className="w-full accent-ok"/>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-mute mb-1">
                <span>Face match threshold</span>
                <span className="text-white font-semibold">{simThreshold.toFixed(2)}</span>
              </div>
              <input type="range" min={0.30} max={0.85} step={0.05} value={simThreshold}
                onChange={e => setSimThreshold(Number(e.target.value))} className="w-full accent-ok"/>
              <div className="flex justify-between text-[9px] text-mute mt-0.5">
                <span>0.30 more results</span><span>0.85 strict</span>
              </div>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-mute mb-1">
                <span>OSNet appearance threshold</span>
                <span className="text-white font-semibold">{appearanceThreshold.toFixed(2)}</span>
              </div>
              <input type="range" min={0.40} max={0.95} step={0.05} value={appearanceThreshold}
                onChange={e => setAppearanceThreshold(Number(e.target.value))} className="w-full accent-ok"/>
            </div>

            {/* Focus mode toggle */}
            <label className="flex items-center gap-2 mb-3 text-xs text-mute cursor-pointer select-none">
              <input
                type="checkbox"
                checked={focusMode}
                onChange={e => setFocusMode(e.target.checked)}
                className="accent-ok size-3.5"
              />
              <ScanFace className="size-3 text-ok" />
              <span>
                Show only matched person{" "}
                <span className="text-[9px] opacity-60">(hide others)</span>
              </span>
            </label>

            {queryPhoto ? (
              searchMode && searchCameraId !== null ? (
                <button onClick={() => { setSearchMode(false); setSearchCameraId(null); }}
                  className="btn-ghost w-full justify-center text-xs">
                  Stop Person Search
                </button>
              ) : (
                <button onClick={startPersonSearch}
                  disabled={!camera}
                  className="btn-primary w-full justify-center text-sm">
                  <ScanFace className="size-4"/> Find This Person Live
                </button>
              )
            ) : (
              <button onClick={() => photoInputRef.current?.click()} className="btn-ghost w-full justify-center text-xs">
                <Upload className="size-3.5"/> Browse Photo
              </button>
            )}

            <p className="text-[9px] text-mute text-center mt-2">
              {searchMode && searchCameraId !== null
                ? focusMode
                  ? "Only the matched person is shown · others hidden"
                  : "GREEN = face/appearance match · Grey = other persons detected"
                : "Use a face photo for ArcFace, or a full-body photo for OSNet appearance matching"}
            </p>
          </section>

          {/* All cameras list */}
          <section className="glass p-4" aria-labelledby="cam-list">
            <h2 id="cam-list" className="font-display text-sm font-semibold mb-3">
              All Cameras <span className="text-xs font-normal text-mute ml-1">({cameras.length})</span>
            </h2>
            <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1">
              {cameras.map((c, i) => (
                <CameraThumbnail key={c.id} cam={c} active={i === camIdx}
                  onClick={() => { setCamIdx(i); setPaused(false); setSearchMode(false); setSearchCameraId(null); }}/>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  return (
    <AppShell>
      <Suspense fallback={
        <div className="glass animate-pulse aspect-video rounded-xl"/>
      }>
        <LiveContent/>
      </Suspense>
    </AppShell>
  );
}
