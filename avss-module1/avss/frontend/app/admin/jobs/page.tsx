"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";
type Filter = "all"|"pending"|"processing"|"completed"|"failed";

interface Job {
  job_id: string|number;
  source_file?: string; original_filename?: string;
  camera_id?: number|null; status: string; progress: number;
  frames_processed?: number|null; total_frames?: number|null;
  total_detections?: number; duration_seconds?: number|null;
  error_message?: string|null; error?: string|null; created_at?: string;
}

const fmtDur  = (s?: number|null) => { if(!s)return"—"; const m=Math.floor(s/60),sec=Math.round(s%60); return m>0?`${m}m ${sec}s`:`${sec}s`; };
const fmtFrm  = (d?: number|null, t?: number|null) => { if(!d&&d!==0)return"—"; if(t&&t>0)return`${d.toLocaleString()}/${t.toLocaleString()}`; return d.toLocaleString(); };
const etaLabel = (p: number, ca?: string) => {
  if(p<=0||!ca)return"";
  const el=(Date.now()-new Date(ca).getTime())/1000, rem=(el/(p/100))-el;
  if(rem<=0||rem>3600)return"";
  const m=Math.floor(rem/60),s=Math.round(rem%60); return m>0?`~${m}m ${s}s left`:`~${s}s left`;
};
const srcName = (j: Job) => j.original_filename||j.source_file||`Job ${j.job_id}`;

export default function AdminJobsPage() {
  const { authFetch } = useAuth();
  const [all,     setAll]     = useState<Job[]>([]);
  const [filter,  setFilter]  = useState<Filter>("all");
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded,setExpanded]= useState<Set<string|number>>(new Set());
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const load = async () => {
    const r = await authFetch(`${API}/pipeline/jobs`);
    if(r.ok) setAll(await r.json());
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(()=>{ load(); refreshRef.current=setInterval(load,10_000); return()=>{ if(refreshRef.current)clearInterval(refreshRef.current); }; },[]);

  const toggle = (id: string|number) =>
    setExpanded(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });

  const counts = {
    all:all.length, pending:all.filter(j=>j.status==="pending").length,
    processing:all.filter(j=>j.status==="processing").length,
    completed:all.filter(j=>j.status==="completed").length,
    failed:all.filter(j=>j.status==="failed").length,
  };

  const shown = all
    .filter(j=>filter==="all"||j.status===filter)
    .filter(j=>{ if(!query)return true; const q=query.toLowerCase(); return srcName(j).toLowerCase().includes(q)||String(j.job_id).includes(q)||(j.camera_id?String(j.camera_id).includes(q):false); });

  const FILTERS: Filter[] = ["all","pending","processing","completed","failed"];

  return (
    <AppShell adminOnly>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">All Jobs</h1>
            <p className="text-sm text-mute">{all.length} total · {counts.processing} running · {counts.failed} failed</p>
          </div>
          {lastUpdated&&(
            <div className="text-right hidden sm:block">
              <span className="text-xs text-mute">Updated {lastUpdated.toLocaleTimeString()}</span>
              <button onClick={load} className="block text-xs text-warn mt-0.5 ml-auto">↻ Refresh</button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`chip ${filter===f?"!bg-accent/20 !border-accent !text-white":""}`}>
              {f.charAt(0).toUpperCase()+f.slice(1)} {counts[f]>0&&<span className="opacity-60 ml-1">{counts[f]}</span>}
            </button>
          ))}
          <input type="search" placeholder="Search jobs…" value={query} onChange={e=>setQuery(e.target.value)}
            className="field !w-44 !py-1 text-xs ml-auto"/>
        </div>

        {loading ? <div className="glass animate-pulse h-48 rounded-xl"/> :
          shown.length === 0 ? (
            <div className="glass p-10 text-center">
              <p className="font-medium">No jobs found</p>
              <p className="text-sm text-mute mt-1">{all.length===0?"No videos processed yet.":"No jobs match this filter."}</p>
            </div>
          ) : (
            <div className="glass overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-mute text-left text-xs uppercase tracking-wide">
                  <tr>{["Job","Source","Camera","Status","Progress","Frames","Detections","Duration","Actions"].map(h=>(
                    <th key={h} className="p-3 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {shown.map(j=>{
                    const errMsg=j.error_message||j.error;
                    const isExp=expanded.has(j.job_id);
                    return (
                      <>
                        <tr key={j.job_id} className="border-t border-edge/40 hover:bg-panel-2/40 transition-colors">
                          <td className="p-3 font-mono text-xs text-mute">{j.job_id}</td>
                          <td className="p-3 max-w-[160px]"><span className="truncate block" title={srcName(j)}>{srcName(j)}</span></td>
                          <td className="p-3 text-xs text-mute">{j.camera_id?`Cam ${j.camera_id}`:"Upload"}</td>
                          <td className="p-3"><StatusBadge status={j.status}/></td>
                          <td className="p-3 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1"><ProgressBar value={j.progress} admin/></div>
                              <span className="text-xs text-mute w-8 text-right">{j.progress}%</span>
                            </div>
                            {j.status==="processing"&&j.created_at&&(
                              <div className="text-[10px] text-mute mt-0.5">{etaLabel(j.progress,j.created_at)}</div>
                            )}
                          </td>
                          <td className="p-3 text-mute">{fmtFrm(j.frames_processed,j.total_frames)}</td>
                          <td className="p-3 text-mute">{j.total_detections?.toLocaleString()??"—"}</td>
                          <td className="p-3 text-mute">{fmtDur(j.duration_seconds)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {j.status==="completed"&&<Link href="/search" className="text-xs text-accent hover:underline">Search</Link>}
                              {errMsg&&<button onClick={()=>toggle(j.job_id)} className="text-xs text-danger hover:underline">{isExp?"Hide ▲":"Error ▼"}</button>}
                              {j.status==="failed"&&<Link href="/search" className="text-xs text-mute hover:underline">Retry</Link>}
                            </div>
                          </td>
                        </tr>
                        {errMsg&&isExp&&(
                          <tr key={`${j.job_id}-err`} className="bg-danger/5">
                            <td colSpan={9} className="px-4 py-2">
                              <div className="text-xs text-danger font-mono break-all">⚠ {errMsg}</div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </AppShell>
  );
}
