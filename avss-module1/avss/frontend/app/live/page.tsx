"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Pause, Play, Maximize2, WifiOff, Wifi,
  RefreshCw, ScanEye, Route, ScanFace, Shirt, Layers,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/ui";
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
  camera, paused,
}: {
  camera: Camera; paused: boolean;
}) {
  const [key,     setKey]     = useState(0);   // bump to force re-mount the <img>
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  // Build the MJPEG URL — backend proxies RTSP → MJPEG (no auth needed on stream endpoint)
  const mjpegUrl    = `${BACKEND}/api/v1/cameras/${camera.id}/stream`;
  const snapshotUrl = `${BACKEND}/api/v1/cameras/${camera.id}/snapshot`;

  // When paused, we stop the stream by unmounting the img
  const showStream = !paused;

  const reload = () => { setLoading(true); setErrored(false); setKey(k => k + 1); };

  return (
    <div className="relative w-full h-full bg-bg min-h-[300px]">
      {/* MJPEG stream via <img> — works natively in all browsers */}
      {showStream && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={mjpegUrl}
          alt={`Live feed: ${camera.name}`}
          className={`w-full h-full object-contain transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
          onLoad={() => { setLoading(false); setErrored(false); }}
          onError={() => { setLoading(false); setErrored(true); }}
        />
      )}

      {/* Loading spinner */}
      {loading && showStream && !errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
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

// ── Main page ─────────────────────────────────────────────────────────────────
function LiveContent() {
  const params    = useSearchParams();
  const { authFetch } = useAuth();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [camIdx,  setCamIdx]  = useState(0);
  const [paused,  setPaused]  = useState(false);
  const [now,     setNow]     = useState("");
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLDivElement>(null);

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
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const camera  = cameras[camIdx];
  const online  = cameras.filter(c => c.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Monitoring"
        subtitle={`${online} of ${cameras.length} cameras online · Real-time RTSP stream via MJPEG proxy`}
        actions={
          <button className="btn-ghost" onClick={() => setPaused(p => !p)}>
            {paused ? <Play className="size-4"/> : <Pause className="size-4"/>}
            {paused ? "Resume" : "Pause"}
          </button>
        }
      />

      {loading ? (
        <div className="glass animate-pulse aspect-video rounded-xl"/>
      ) : cameras.length === 0 ? (
        <EmptyState
          title="No cameras registered"
          text="Go to the Cameras section to add your first RTSP stream or IP camera."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          {/* ── Main viewer ─────────────────────────────────────────── */}
          <section className="glass p-3 sm:p-4 space-y-3" aria-labelledby="cam-title">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="cam-title" className="font-display text-base font-semibold">
                {camera?.name || "No camera"}
                {camera?.location && (
                  <span className="font-normal text-mute ml-2">— {camera.location}</span>
                )}
              </h2>

              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ml-auto ${
                paused ? "bg-mute/20 text-mute" : "bg-danger text-white"
              }`}>
                <span className={`size-1.5 rounded-full bg-current ${paused ? "" : "animate-pulse"}`} aria-hidden/>
                {paused ? "PAUSED" : "LIVE"}
              </span>

              <time className="text-xs tabular-nums text-mute" suppressHydrationWarning>{now}</time>

              <button onClick={fullscreen} className="btn-ghost px-2 py-1.5" aria-label="Fullscreen">
                <Maximize2 className="size-4"/>
              </button>
            </div>

            {/* Stream */}
            <div
              ref={videoRef}
              className="aspect-video overflow-hidden rounded-xl border border-edge/70 bg-bg"
            >
              {camera ? (
                <RTSPViewer camera={camera} paused={paused}/>
              ) : (
                <div className="w-full h-full grid place-items-center text-mute">
                  <p className="text-sm">Select a camera below</p>
                </div>
              )}
            </div>

            {/* Connection info */}
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
              </div>
            )}
          </section>

          {/* ── Right panel: camera list ─────────────────────────────── */}
          <section className="glass p-4" aria-labelledby="cam-list">
            <h2 id="cam-list" className="font-display text-base font-semibold mb-3">
              All Cameras
              <span className="ml-2 text-xs font-normal text-mute">({cameras.length})</span>
            </h2>
            <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
              {cameras.map((c, i) => (
                <CameraThumbnail
                  key={c.id}
                  cam={c}
                  active={i === camIdx}
                  onClick={() => { setCamIdx(i); setPaused(false); }}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Note about MJPEG */}
      {cameras.length > 0 && (
        <div className="glass px-4 py-3 text-xs text-mute">
          <strong className="text-white">How it works:</strong>{" "}
          The backend proxies your RTSP stream as MJPEG so it plays natively in any browser.
          Stream latency is typically 1–3 seconds. For zero-latency, use VLC directly with the RTSP URL.
        </div>
      )}
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
