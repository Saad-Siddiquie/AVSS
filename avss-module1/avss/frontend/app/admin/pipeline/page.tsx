"use client";

/**
 * Admin pipeline page — identical 5-step wizard but inside the admin shell.
 * We just render the pipeline content wrapped in AppShell adminOnly.
 */
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatTag } from "@/components/ui/StatTag";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuth } from "@/hooks/useAuth";

const API     = "/api/backend";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8002";
const POLL    = 5000;

type Step = "source" | "processing" | "query" | "searching" | "results";
type Tab  = "upload" | "camera";

interface Camera { id: number; name: string; camera_type: string; url: string; location: string | null }
interface Job    { job_id: string|number; status: string; progress: number; frames_processed?: number|null; total_detections?: number; duration?: string|null; error_message?: string|null; source_file?: string }
interface Search { query_id: string|number; status: string; total_matches: number; output_video_url: string|null; error_message?: string|null; camera_name?: string|null; camera_location?: string|null; camera_id?: number|null }

const STEPS = ["Video Source","Processing","Query Photo","Searching","Results"];

export default function AdminPipelinePage() {
  const { authFetch } = useAuth();

  const [step, setStep]           = useState<Step>("source");
  const [tab, setTab]             = useState<Tab>("upload");
  const [cameras, setCameras]     = useState<Camera[]>([]);
  const [camId, setCamId]         = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [job, setJob]             = useState<Job | null>(null);
  const [jobId, setJobId]         = useState<string | number | null>(null);
  const [photo, setPhoto]         = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [threshold, setThr]       = useState(0.50);
  const [search, setSearch]       = useState<Search | null>(null);
  const [error, setError]         = useState("");
  const [busy, setBusy]           = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  useEffect(() => () => stopPoll(), []);

  useEffect(() => {
    authFetch(`${API}/cameras`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCameras(d?.cameras ?? (Array.isArray(d) ? d : [])));
  }, []);

  const pollJob = (id: string | number) => {
    stopPoll();
    timerRef.current = setInterval(async () => {
      try {
        const r = await authFetch(`${API}/pipeline/jobs/${id}`);
        if (!r.ok) return;
        const d: Job = await r.json();
        setJob(d);
        if (d.status === "completed") { stopPoll(); setStep("query"); }
        if (d.status === "failed")    { stopPoll(); setError(d.error_message || "Processing failed."); }
      } catch { /* ignore */ }
    }, POLL);
  };

  const pollSearch = (qid: string | number) => {
    stopPoll();
    timerRef.current = setInterval(async () => {
      try {
        const r = await authFetch(`${API}/pipeline/search/${qid}`);
        if (!r.ok) return;
        const d: Search = await r.json();
        setSearch(d);
        if (d.status === "completed") { stopPoll(); setStep("results"); }
        if (d.status === "failed")    { stopPoll(); setError(d.error_message || "Search failed."); }
      } catch { /* ignore */ }
    }, POLL);
  };

  const startJob = async () => {
    setBusy(true); setError("");
    try {
      let res: Response;
      if (tab === "upload") {
        if (!videoFile) throw new Error("Select a video file.");
        const fd = new FormData(); fd.append("video", videoFile);
        res = await authFetch(`${API}/pipeline/process/upload`, { method: "POST", body: fd });
      } else {
        if (!camId) throw new Error("Select a camera.");
        const fd = new FormData(); fd.append("camera_id", String(camId));
        res = await authFetch(`${API}/pipeline/process/camera`, { method: "POST", body: fd });
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d?.detail || `Error ${res.status}`); }
      const d = await res.json();
      setJobId(d.job_id);
      setJob({ job_id: d.job_id, status: "processing", progress: 0 });
      setStep("processing");
      pollJob(d.job_id);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const startSearch = async () => {
    if (!photo || !jobId) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("query_image", photo);
      fd.append("job_id", String(jobId));
      fd.append("similarity_threshold", String(threshold));
      const res = await authFetch(`${API}/pipeline/search`, { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.detail || `Error ${res.status}`); }
      const d = await res.json();
      setSearch({ ...d, output_video_url: null, camera_name: null, camera_location: null, camera_id: null });
      setStep("searching");
      pollSearch(d.query_id);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const reset = () => {
    stopPoll();
    setStep("source"); setJob(null); setJobId(null); setSearch(null);
    setPhoto(null); if (preview) URL.revokeObjectURL(preview); setPreview(null);
    setError(""); setVideoFile(null); setCamId(null);
  };

  const setPhotoFile = (f: File | null) => {
    if (!f) return;
    if (!["image/jpeg","image/png","image/webp"].includes(f.type)) { setError("Photo must be JPEG, PNG or WebP."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(f); setPreview(URL.createObjectURL(f)); setError("");
  };

  const stepKeys: Step[] = ["source","processing","query","searching","results"];
  const stepIdx = stepKeys.indexOf(step);
  const videoSrc = search?.output_video_url ? `${BACKEND}${search.output_video_url}` : null;

  return (
    <AppShell adminOnly>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold font-display">Person Search</h1>
        <span className="px-2 py-0.5 text-xs font-semibold bg-orange-500/20 text-orange-300 rounded">
          Admin Mode
        </span>
      </div>
      <p className="text-sm text-slate-400 mb-5">
        Five steps: pick footage → process → upload photo → search → review results.
      </p>

      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2 mb-6">
        {STEPS.map((label, i) => {
          const done = i < stepIdx; const current = i === stepIdx;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
                done    ? "bg-orange-600/20 border-orange-600 text-orange-300" :
                current ? "border-orange-500 text-orange-300 bg-orange-500/10 font-semibold" :
                          "border-slate-700 text-slate-500"
              }`}
            >
              {done ? "✓" : i + 1} {label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Step 1 */}
      {step === "source" && (
        <div className="avss-card p-5">
          <div className="flex gap-2 mb-5">
            {(["upload","camera"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={tab === t ? "btn-admin" : "btn-outline"}>
                {t === "upload" ? "📁 Upload Video File" : "📹 Registered Camera"}
              </button>
            ))}
          </div>
          {tab === "upload" ? (
            <>
              <label className="block border-2 border-dashed border-slate-600 rounded p-8 text-center cursor-pointer hover:border-orange-500 transition-colors">
                <input type="file" className="sr-only"
                  accept="video/mp4,video/x-msvideo,video/quicktime,video/x-matroska"
                  onChange={e => setVideoFile(e.target.files?.[0] ?? null)} />
                {videoFile
                  ? <><b>{videoFile.name}</b><div className="text-sm text-slate-400 mt-1">{(videoFile.size/1e6).toFixed(1)} MB</div></>
                  : <span className="text-slate-400">Choose an MP4, AVI, MOV or MKV file</span>}
              </label>
              <button disabled={!videoFile||busy} onClick={startJob} className="btn-admin mt-4">
                {busy ? "Uploading…" : "Upload & Process →"}
              </button>
            </>
          ) : cameras.length > 0 ? (
            <>
              <label className="block text-sm text-slate-300">
                Camera
                <select className="avss-input mt-1" value={camId ?? ""}
                  onChange={e => setCamId(Number(e.target.value))}>
                  <option value="">Select a camera…</option>
                  {cameras.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.camera_type} · {c.location || ""}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={!camId||busy} onClick={startJob} className="btn-admin mt-4">
                {busy ? "Starting…" : "Process Camera →"}
              </button>
            </>
          ) : (
            <div className="avss-card p-8 text-center">
              <p className="font-medium">No cameras registered</p>
              <p className="text-sm text-slate-400 mt-1">Add cameras in the Cameras section first.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2 */}
      {step === "processing" && job && (
        <div className="avss-card p-5">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-slate-300">Processing {job.source_file || "video"}…</span>
            <StatusBadge status={job.status} />
          </div>
          <ProgressBar value={job.progress} admin />
          <div className="grid grid-cols-3 gap-3 mt-5">
            <StatTag label="Progress"   value={`${job.progress}%`} />
            <StatTag label="Frames"     value={job.frames_processed ?? "…"} />
            <StatTag label="Detections" value={job.total_detections ?? 0} />
          </div>
          {job.status === "failed" ? (
            <div className="mt-4">
              <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm">
                {job.error_message || "Processing failed."}
              </div>
              <button onClick={reset} className="btn-admin mt-3">← Back to Step 1</button>
            </div>
          ) : <p className="text-xs text-slate-400 mt-3">Checking every 5 seconds…</p>}
        </div>
      )}

      {/* Step 3 */}
      {step === "query" && job && (
        <div className="avss-card p-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatTag label="Frames"     value={job.frames_processed ?? "—"} />
            <StatTag label="Detections" value={job.total_detections ?? 0} />
            <StatTag label="Duration"   value={job.duration ?? "—"} />
          </div>
          <label className="block border-2 border-dashed border-slate-600 rounded p-5 text-center cursor-pointer hover:border-orange-500 transition-colors mb-4">
            <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp"
              onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
            {photo && preview
              ? <><img src={preview} alt="Query" className="mx-auto h-40 rounded object-cover" /><div className="text-sm mt-2 text-slate-300">{photo.name}</div></>
              : <span className="text-slate-400">Choose a JPEG, PNG or WebP face photo</span>}
          </label>
          <div className="mb-5">
            <div className="flex justify-between text-sm text-slate-300 mb-1">
              <span>Similarity threshold</span>
              <span className="font-bold text-slate-100">{threshold.toFixed(2)}</span>
            </div>
            <input type="range" min={0.10} max={0.90} step={0.05} value={threshold}
              onChange={e => setThr(Number(e.target.value))} className="w-full accent-orange-500" />
            <p className="text-xs text-slate-400 mt-1">Lower = more matches · 0.50 recommended · Higher = stricter</p>
          </div>
          <button disabled={!photo||busy} onClick={startSearch} className="btn-admin w-full py-2.5">
            {busy ? "Submitting…" : "🔍 Find Person & Generate Tracked Video →"}
          </button>
        </div>
      )}

      {/* Step 4 */}
      {step === "searching" && (
        <div className="avss-card p-5 text-center py-10">
          <div className="w-12 h-12 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
          <div className="font-medium mb-1">Searching…</div>
          <p className="text-sm text-slate-400">Comparing face embeddings across stored tracks…</p>
        </div>
      )}

      {/* Step 5 */}
      {step === "results" && search && (
        <div className="avss-card p-5">
          {search.total_matches > 0 ? (
            <>
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-4 py-3 mb-5 text-sm font-medium">
                ✓ Person found in {search.total_matches} frame(s)
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatTag label="Camera"    value={search.camera_name ?? "Uploaded"} />
                <StatTag label="Location"  value={search.camera_location ?? "—"} />
                <StatTag label="Camera ID" value={search.camera_id ?? "—"} />
                <StatTag label="Matches"   value={search.total_matches} />
              </div>
              {videoSrc && (
                <>
                  <video src={videoSrc} controls autoPlay
                    className="w-full rounded bg-black border border-slate-700" style={{ maxHeight: 440 }} />
                  <div className="flex flex-wrap gap-3 mt-4">
                    <a href={videoSrc} download className="btn-admin">⬇ Download MP4</a>
                    <button onClick={() => { setStep("query"); setSearch(null); setPhoto(null); if(preview) URL.revokeObjectURL(preview); setPreview(null); }} className="btn-outline">
                      Try Different Photo
                    </button>
                    <button onClick={reset} className="btn-outline">Search Another Video</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 px-4 py-3 mb-4 text-sm">
                ✗ Person not found — try lowering the similarity threshold
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => { setStep("query"); setSearch(null); setPhoto(null); if(preview) URL.revokeObjectURL(preview); setPreview(null); }} className="btn-admin">
                  Try Different Photo / Lower Threshold
                </button>
                <button onClick={reset} className="btn-outline">Start Over</button>
              </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
