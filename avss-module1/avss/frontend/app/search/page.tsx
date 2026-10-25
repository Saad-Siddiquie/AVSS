"use client";
import { useEffect, useRef, useState } from "react";
import {
  CloudUpload, ImageIcon, LoaderCircle, Search as SearchIcon,
  Video, Play, Download, Check, X, ChevronRight,
  ScanFace, Clock, Target, MapPin, Camera,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const API     = "/api/backend";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8002";
const POLL_MS = 5000;

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase       = "idle" | "searching" | "done" | "error";
type UploadPhase = "idle" | "uploading" | "processing" | "done" | "error";

interface VideoJob {
  job_id: number; status: string; progress: number;
  total_frames: number|null; frames_processed: number|null;
  total_detections: number; error_message: string|null;
  source_file: string|null; source_type: string;
}

interface Hit {
  job_id: number; camera_id: number|null; camera_name: string;
  camera_location: string|null; total_matches: number; best_similarity: number;
  first_seen: string|null; last_seen: string|null;
  output_video_url: string|null;
  supabase_video_url?: string|null;
  timeline: Array<{ frame_index:number; timestamp_ms:number; track_id:number; similarity:number }>;
}

interface SearchResult {
  query_id: number; status: string; total_matches: number;
  error_message: string|null; search_scope: string; hits: Hit[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const absUrl = (path: string|null|undefined) => {
  if (!path) return "";
  return path.startsWith("http") ? path : `${BACKEND}${path}`;
};

const fmtTime = (ms: number) => {
  const s = Math.floor(ms/1000);
  return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60]
    .map(v => String(v).padStart(2,"0")).join(":");
};

const fmtPct = (v: number) => `${(v*100).toFixed(1)}%`;

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepBadge({ n, active, done, label }: { n:number; active:boolean; done:boolean; label:string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`size-7 rounded-full grid place-items-center text-xs font-bold flex-shrink-0 transition-colors ${
        done ? "bg-ok text-bg" : active ? "bg-accent text-white" : "bg-panel-2 text-mute border border-edge"
      }`}>
        {done ? <Check className="size-3.5"/> : n}
      </div>
      <span className={`text-sm font-medium ${active ? "text-white" : done ? "text-ok" : "text-mute"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Result Hit Card ────────────────────────────────────────────────────────────
function HitCard({ hit, queryPhoto }: { hit: Hit; queryPhoto: string|null }) {
  const [playing, setPlaying] = useState(false);
  const videoUrl = absUrl(hit.supabase_video_url || hit.output_video_url);
  const simPct   = Math.round(hit.best_similarity * 100);
  const simColor = simPct >= 80 ? "text-ok" : simPct >= 60 ? "text-warn" : "text-danger";
  const barColor = simPct >= 80 ? "bg-ok"   : simPct >= 60 ? "bg-warn"  : "bg-danger";

  return (
    <article className="glass overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-edge/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent flex-shrink-0">
              <Camera className="size-5"/>
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-white truncate">{hit.camera_name}</h3>
              {hit.camera_location && (
                <p className="text-xs text-mute flex items-center gap-1 mt-0.5">
                  <MapPin className="size-3"/> {hit.camera_location}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="rounded-full bg-accent/15 border border-accent/30 px-3 py-1 text-xs font-semibold text-accent">
              {hit.total_matches} match{hit.total_matches !== 1 ? "es" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-edge/40 border-b border-edge/40">
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] text-mute uppercase tracking-wide">Best Match</p>
          <p className={`font-display text-xl font-bold mt-0.5 ${simColor}`}>
            {fmtPct(hit.best_similarity)}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] text-mute uppercase tracking-wide">First Seen</p>
          <p className="text-sm font-semibold mt-0.5 tabular-nums">{hit.first_seen || "—"}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] text-mute uppercase tracking-wide">Last Seen</p>
          <p className="text-sm font-semibold mt-0.5 tabular-nums">{hit.last_seen || "—"}</p>
        </div>
      </div>

      {/* ── Similarity bar ──────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-edge/40">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-mute">Confidence</span>
          <span className={`font-semibold ${simColor}`}>{simPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-panel-2 overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width:`${simPct}%` }}/>
        </div>
      </div>

      {/* ── Video player ────────────────────────────────────────── */}
      <div className="p-4">
        {videoUrl ? (
          <>
            {/* Side-by-side: query photo + annotated video */}
            <div className="grid sm:grid-cols-[auto_1fr] gap-4 mb-4">
              {/* Query face */}
              {queryPhoto && (
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-[10px] text-mute uppercase tracking-wide">Query Photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={queryPhoto}
                    alt="Query face"
                    className="w-24 h-32 object-cover rounded-xl border-2 border-accent/40 shadow-lg shadow-accent/20"
                  />
                  <span className="text-[10px] text-accent font-medium">Reference</span>
                </div>
              )}

              {/* Arrow */}
              {queryPhoto && (
                <div className="hidden sm:flex items-center justify-start">
                  <div className="flex flex-col items-center gap-1 text-mute">
                    <ChevronRight className="size-6"/>
                    <span className="text-[9px] text-mute">Match</span>
                  </div>
                </div>
              )}

              {/* Video */}
              <div className="flex-1">
                <p className="text-[10px] text-mute uppercase tracking-wide mb-1.5">Annotated Output</p>
                <video
                  src={videoUrl}
                  controls
                  preload="metadata"
                  onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.5; }}
                  className="w-full rounded-xl border border-edge/60 bg-bg"
                  style={{ maxHeight: 340 }}
                />
              </div>
            </div>

            {/* Timestamps */}
            {hit.timeline.length > 0 && (
              <div className="mb-4 rounded-xl bg-panel-2/60 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="size-3.5 text-mute"/>
                  <span className="text-xs text-mute">Detected at timestamps:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hit.timeline.slice(0, 12).map((t, i) => (
                    <span key={i} className="text-[10px] font-mono bg-panel rounded px-1.5 py-0.5 text-mute">
                      {fmtTime(t.timestamp_ms)}
                    </span>
                  ))}
                  {hit.timeline.length > 12 && (
                    <span className="text-[10px] text-mute">+{hit.timeline.length - 12} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Download */}
            <a href={videoUrl} download className="btn-primary text-sm">
              <Download className="size-4"/> Download Annotated Clip
            </a>
          </>
        ) : (
          <div className="rounded-xl border border-edge/40 bg-panel-2/50 p-6 text-center text-mute">
            <Video className="size-8 mx-auto mb-2 opacity-30"/>
            <p className="text-sm">Video clip not generated yet</p>
            <p className="text-xs mt-1 opacity-60">Re-run the search to generate the annotated clip</p>
          </div>
        )}
      </div>
    </article>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const { authFetch } = useAuth();

  // Video upload
  const [video,       setVideo]       = useState<File|null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadErr,   setUploadErr]   = useState("");
  const [job,         setJob]         = useState<VideoJob|null>(null);
  const [jobs,        setJobs]        = useState<VideoJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");

  // Query photo
  const [photo,    setPhoto]    = useState<File|null>(null);
  const [photoUrl, setPhotoUrl] = useState<string|null>(null);
  const [threshold,setThreshold]= useState(0.50);

  // Search result
  const [phase,     setPhase]     = useState<Phase>("idle");
  const [phaseErr,  setPhaseErr]  = useState("");
  const [result,    setResult]    = useState<SearchResult|null>(null);

  const videoRef   = useRef<HTMLInputElement>(null);
  const photoRef   = useRef<HTMLInputElement>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const jobTimer   = useRef<ReturnType<typeof setInterval>|null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const stop = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  useEffect(() => () => { stop(); if (jobTimer.current) clearInterval(jobTimer.current); }, []);

  useEffect(() => {
    authFetch(`${API}/pipeline/jobs`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setJobs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { if (phase === "done") resultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }); }, [phase]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  // ── Video upload ────────────────────────────────────────────────────────────
  function pickVideo(f?: File) {
    if (!f) return;
    setVideo(f); setUploadPhase("idle"); setUploadErr(""); setJob(null);
  }

  async function pollJob(jobId: number) {
    const r = await authFetch(`${API}/pipeline/jobs/${jobId}`);
    if (!r.ok) throw new Error(`Status check failed (${r.status})`);
    const d: VideoJob = await r.json();
    setJob(d);
    setJobs(prev => [d, ...prev.filter(j => j.job_id !== d.job_id)]);
    if (d.status === "completed") {
      if (jobTimer.current) { clearInterval(jobTimer.current); jobTimer.current = null; }
      setUploadPhase("done");
      setSelectedJobId(String(d.job_id));
      return true;
    }
    if (d.status === "failed") {
      if (jobTimer.current) { clearInterval(jobTimer.current); jobTimer.current = null; }
      setUploadPhase("error"); setUploadErr(d.error_message || "Processing failed.");
      return true;
    }
    return false;
  }

  async function uploadVideo() {
    if (!video) return;
    if (jobTimer.current) clearInterval(jobTimer.current);
    setUploadPhase("uploading"); setUploadErr(""); setJob(null);
    try {
      const fd = new FormData(); fd.append("video", video);
      const r = await authFetch(`${API}/pipeline/process/upload`, { method:"POST", body:fd });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Upload failed."); }
      const { job_id } = await r.json();
      setSelectedJobId(String(job_id));
      setUploadPhase("processing");
      const done = await pollJob(job_id);
      if (!done) {
        jobTimer.current = setInterval(() =>
          pollJob(job_id).catch(e => {
            if (jobTimer.current) clearInterval(jobTimer.current);
            setUploadPhase("error"); setUploadErr(String(e.message));
          }), POLL_MS);
      }
    } catch (e: any) { setUploadPhase("error"); setUploadErr(e.message); }
  }

  // ── Photo pick ──────────────────────────────────────────────────────────────
  function pickPhoto(f?: File) {
    if (!f) return;
    if (!["image/jpeg","image/png","image/webp"].includes(f.type)) { setPhaseErr("Use JPG, PNG or WebP."); return; }
    setPhoto(f); setPhotoUrl(URL.createObjectURL(f)); setResult(null); setPhase("idle"); setPhaseErr("");
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  async function startSearch() {
    if (!photo) return;
    stop(); setPhase("searching"); setPhaseErr(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("query_image", photo);
      fd.append("similarity_threshold", String(threshold));
      if (selectedJobId) fd.append("job_id", selectedJobId);
      const r = await authFetch(`${API}/pipeline/search`, { method:"POST", body:fd });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Search failed."); }
      const d: SearchResult = await r.json();
      setResult(d);
      if (d.status === "completed") { setPhase("done"); return; }
      timerRef.current = setInterval(async () => {
        try {
          const sr = await authFetch(`${API}/pipeline/search/${d.query_id}`);
          if (!sr.ok) return;
          const sd: SearchResult = await sr.json();
          setResult(sd);
          if (sd.status === "completed") { stop(); setPhase("done"); }
          if (sd.status === "failed")    { stop(); setPhase("error"); setPhaseErr(sd.error_message||"Search failed."); }
        } catch { stop(); setPhase("error"); setPhaseErr("Poll error."); }
      }, POLL_MS);
    } catch (e: any) { setPhase("error"); setPhaseErr(e.message); }
  }

  // Derived
  const completedJobs = jobs.filter(j => j.status === "completed");
  const step1Done = uploadPhase === "done" || !!selectedJobId;
  const step2Done = !!photo;
  const step3Done = phase === "done";
  const canSearch = !!photo && phase !== "searching";

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div>
          <h1 className="font-display text-2xl font-semibold">Person Search</h1>
          <p className="text-sm text-mute mt-1">
            Upload footage → upload a face photo → find the person with AI.
          </p>
        </div>

        {/* ── Step indicators ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 glass px-5 py-4">
          <StepBadge n={1} active={!step1Done} done={step1Done} label="Process Video" />
          <ChevronRight className="size-4 text-edge hidden sm:block"/>
          <StepBadge n={2} active={step1Done && !step2Done} done={step2Done} label="Query Photo" />
          <ChevronRight className="size-4 text-edge hidden sm:block"/>
          <StepBadge n={3} active={step2Done && phase !== "done"} done={step3Done} label="Results" />
        </div>

        {/* ══════════════════════════════════════════════════════════
            CARD 1: Video Source
        ══════════════════════════════════════════════════════════ */}
        <section className="glass overflow-hidden" aria-label="Step 1 — Video source">
          {/* Card header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-edge/40 bg-panel-2/30">
            <div className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
              <Video className="size-4"/>
            </div>
            <div>
              <h2 className="font-display text-base font-semibold">Step 1 — Video Source</h2>
              <p className="text-xs text-mute">Upload a recording OR select an already-processed job</p>
            </div>
            {step1Done && <Check className="size-5 text-ok ml-auto flex-shrink-0"/>}
          </div>

          <div className="p-5 space-y-4">
            {/* Upload area */}
            <input ref={videoRef} type="file"
              accept="video/mp4,video/avi,video/x-msvideo,video/quicktime,video/x-matroska,.mp4,.avi,.mov,.mkv"
              className="hidden" onChange={e => pickVideo(e.target.files?.[0])}/>

            <div
              className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                video ? "border-accent/50 bg-accent/5" : "border-edge hover:border-accent/50 hover:bg-panel-2/40"
              }`}
              onClick={() => videoRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); pickVideo(e.dataTransfer.files[0]); }}
            >
              {video ? (
                <div className="flex items-center gap-3 justify-center">
                  <Video className="size-8 text-accent flex-shrink-0"/>
                  <div className="text-left min-w-0">
                    <p className="font-medium truncate">{video.name}</p>
                    <p className="text-xs text-mute">{(video.size/1e6).toFixed(1)} MB · Click to change</p>
                  </div>
                </div>
              ) : (
                <div>
                  <CloudUpload className="size-10 text-accent mx-auto mb-2"/>
                  <p className="text-sm font-medium">Drop video here or click to browse</p>
                  <p className="text-xs text-mute mt-1">MP4, AVI, MOV, MKV</p>
                </div>
              )}
            </div>

            {/* Progress */}
            {job && (uploadPhase === "processing" || uploadPhase === "done") && (
              <div className="rounded-xl bg-panel-2 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="truncate font-medium">{job.source_file || video?.name}</span>
                  <span className={`font-semibold capitalize ${job.status==="completed"?"text-ok":job.status==="failed"?"text-danger":"text-accent"}`}>
                    {job.status}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-edge overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-500"
                    style={{ width:`${Math.max(0,Math.min(100,job.progress||0))}%` }}/>
                </div>
                <p className="text-xs text-mute">
                  {Math.round(job.progress||0)}% · {(job.frames_processed??0).toLocaleString()} frames · {job.total_detections.toLocaleString()} detections
                </p>
              </div>
            )}

            {uploadErr && <p role="alert" className="text-sm text-danger">{uploadErr}</p>}

            <button disabled={!video || uploadPhase==="uploading" || uploadPhase==="processing"}
              onClick={uploadVideo} className="btn-primary w-full justify-center">
              {uploadPhase==="uploading" ? <><LoaderCircle className="size-4 animate-spin"/>Uploading…</>
              : uploadPhase==="processing" ? <><LoaderCircle className="size-4 animate-spin"/>Processing video…</>
              : <><Video className="size-4"/>Upload &amp; Process Video</>}
            </button>

            {/* OR select existing */}
            {completedJobs.length > 0 && (
              <div>
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-edge/60"/>
                  <span className="text-xs text-mute">or use processed job</span>
                  <div className="flex-1 h-px bg-edge/60"/>
                </div>
                <select value={selectedJobId}
                  onChange={e => { setSelectedJobId(e.target.value); setResult(null); setPhase("idle"); }}
                  className="field">
                  <option value="">Select a completed job…</option>
                  {completedJobs.map(j => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.source_file || `Job #${j.job_id}`} — Job #{j.job_id}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            CARD 2: Query Photo
        ══════════════════════════════════════════════════════════ */}
        <section className="glass overflow-hidden" aria-label="Step 2 — Query photo">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-edge/40 bg-panel-2/30">
            <div className="grid size-8 place-items-center rounded-lg bg-violet/15 text-violet">
              <ScanFace className="size-4"/>
            </div>
            <div>
              <h2 className="font-display text-base font-semibold">Step 2 — Query Photo</h2>
              <p className="text-xs text-mute">Upload a clear face photo of the person to find</p>
            </div>
            {step2Done && <Check className="size-5 text-ok ml-auto flex-shrink-0"/>}
          </div>

          <div className="p-5 space-y-4">
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={e => pickPhoto(e.target.files?.[0])}/>

            {/* Photo drop zone with side-by-side layout when selected */}
            {photo && photoUrl ? (
              <div className="flex gap-4 items-start rounded-xl border border-ok/30 bg-ok/5 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Query face" className="w-28 h-36 object-cover rounded-xl border-2 border-ok/40 flex-shrink-0 shadow-lg"/>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-semibold truncate">{photo.name}</p>
                  <p className="text-xs text-mute mt-1">{(photo.size/1e3).toFixed(1)} KB · Face photo ready</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Check className="size-3.5 text-ok"/>
                    <span className="text-xs text-ok">Reference image loaded</span>
                  </div>
                  <button onClick={() => { setPhoto(null); if(photoUrl) URL.revokeObjectURL(photoUrl); setPhotoUrl(null); if(photoRef.current) photoRef.current.value=""; }}
                    className="mt-3 text-xs text-mute hover:text-danger underline flex items-center gap-1">
                    <X className="size-3"/> Remove photo
                  </button>
                </div>
                <button onClick={() => photoRef.current?.click()} className="btn-ghost text-xs py-1.5 px-3 flex-shrink-0">
                  <ImageIcon className="size-3.5"/> Replace
                </button>
              </div>
            ) : (
              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-edge hover:border-violet/50 hover:bg-panel-2/40 p-8 text-center transition-colors"
                onClick={() => photoRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); pickPhoto(e.dataTransfer.files[0]); }}
              >
                <ScanFace className="size-12 text-violet mx-auto mb-3 opacity-70"/>
                <p className="font-medium text-sm">Drop face photo here or click to browse</p>
                <p className="text-xs text-mute mt-1">Clear, front-facing photo works best · JPG, PNG, WebP</p>
              </div>
            )}

            {/* Threshold */}
            <div className="rounded-xl bg-panel-2/50 p-4">
              <div className="flex justify-between text-sm mb-2">
                <label htmlFor="thr" className="text-mute font-medium">Similarity Threshold</label>
                <output htmlFor="thr" className="font-bold tabular-nums text-white">{threshold.toFixed(2)}</output>
              </div>
              <input id="thr" type="range" min={0.1} max={0.9} step={0.05} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))} className="w-full accent-accent"/>
              <div className="flex justify-between text-[10px] text-mute mt-1.5">
                <span>0.10 — more results</span>
                <span>0.50 recommended</span>
                <span>0.90 — strict match</span>
              </div>
            </div>

            {phaseErr && <p role="alert" className="text-sm text-danger">{phaseErr}</p>}

            {/* Search button */}
            <button disabled={!canSearch} onClick={startSearch}
              className="btn-primary w-full justify-center py-3 text-base">
              {phase === "searching"
                ? <><LoaderCircle className="size-5 animate-spin"/>Searching with AI…</>
                : <><SearchIcon className="size-5"/>Find This Person</>}
            </button>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            CARD 3: Results
        ══════════════════════════════════════════════════════════ */}
        <section ref={resultsRef} aria-label="Search results" aria-live="polite" className="scroll-mt-4">

          {phase === "idle" && !result && (
            <EmptyState
              title="Results appear here"
              text="Process a video and upload a query photo, then click Find This Person."
            />
          )}

          {phase === "searching" && (
            <div className="glass p-10 text-center">
              <div className="size-14 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-4"/>
              <p className="font-display font-semibold text-lg">Searching with AI…</p>
              <p className="text-sm text-mute mt-1">
                ArcFace + OSNet are comparing embeddings across all frames.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="glass p-6 text-center">
              <p className="font-semibold text-danger mb-2">Search Failed</p>
              <p className="text-sm text-mute">{phaseErr}</p>
              <button onClick={() => setPhase("idle")} className="btn-ghost mt-4">Try Again</button>
            </div>
          )}

          {phase === "done" && result && (
            <div className="space-y-4">
              {/* Summary banner */}
              {result.total_matches > 0 ? (
                <div className="glass px-5 py-4 flex items-center gap-3 border-ok/30 bg-ok/5">
                  <div className="grid size-10 place-items-center rounded-xl bg-ok/20 text-ok flex-shrink-0">
                    <Target className="size-5"/>
                  </div>
                  <div>
                    <p className="font-display font-bold text-ok">Person Found</p>
                    <p className="text-sm text-mute">
                      {result.total_matches} matching frame{result.total_matches!==1?"s":""} across {result.hits.length} source{result.hits.length!==1?"s":""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="glass px-5 py-4 border-warn/30 bg-warn/5">
                  <p className="font-semibold text-warn">No match found</p>
                  <p className="text-sm text-mute mt-1">
                    Try a clearer photo, lower the threshold, or process more footage.
                  </p>
                </div>
              )}

              {/* Hit cards */}
              {result.hits.map(hit => (
                <HitCard key={hit.job_id} hit={hit} queryPhoto={photoUrl}/>
              ))}

              {/* New search */}
              <button onClick={() => { setResult(null); setPhase("idle"); setPhoto(null); if(photoUrl) URL.revokeObjectURL(photoUrl); setPhotoUrl(null); }}
                className="btn-ghost w-full justify-center">
                ↺ Start New Search
              </button>
            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
}
