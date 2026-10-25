"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatTag } from "@/components/ui/StatTag";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface Job {
  job_id: string|number;
  source_file?: string; original_filename?: string;
  camera_id?: number|null; status: string; progress: number;
  frames_processed?: number|null; total_frames?: number|null;
  total_detections?: number; duration_seconds?: number|null;
  error_message?: string|null; error?: string|null; created_at?: string;
}

const fmtDur = (s?: number|null) => { if (!s) return "—"; const m=Math.floor(s/60),sec=Math.round(s%60); return m>0?`${m}m ${sec}s`:`${sec}s`; };
const srcName = (j: Job) => j.original_filename||j.source_file||`Job ${j.job_id}`;
const etaLabel = (p: number, ca?: string) => {
  if (p<=0||!ca) return "";
  const el=(Date.now()-new Date(ca).getTime())/1000, rem=(el/(p/100))-el;
  if (rem<=0||rem>3600) return "";
  const m=Math.floor(rem/60),s=Math.round(rem%60); return m>0?`~${m}m ${s}s left`:`~${s}s left`;
};

function ActivityChart({ jobs }: { jobs: Job[] }) {
  const buckets = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(6-i));
    const label=d.toLocaleDateString("en",{weekday:"short"});
    const slice=jobs.filter(j=>(j.created_at||"").startsWith(d.toISOString().slice(0,10)));
    return { label, ok:slice.filter(j=>j.status==="completed").length, fail:slice.filter(j=>j.status==="failed").length };
  });
  const maxVal = Math.max(...buckets.map(b=>b.ok+b.fail),1);
  return (
    <div className="glass p-4">
      <h3 className="font-display text-sm font-semibold mb-3">Jobs — last 7 days</h3>
      <div className="flex items-end gap-1.5 h-16">
        {buckets.map(b=>{
          const total=b.ok+b.fail, pct=total/maxVal;
          const okH=total>0?(b.ok/total)*pct:0, failH=total>0?(b.fail/total)*pct:0;
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5" title={`${b.ok} ok · ${b.fail} failed`}>
              <div className="w-full flex flex-col-reverse gap-px" style={{height:48}}>
                <div className="w-full bg-ok/70 rounded-t-sm" style={{height:`${okH*48}px`}}/>
                {failH>0&&<div className="w-full bg-danger/70" style={{height:`${failH*48}px`}}/>}
              </div>
              <span className="text-[9px] text-mute">{b.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-mute">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-ok/70 inline-block"/> Completed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-danger/70 inline-block"/> Failed</span>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { authFetch } = useAuth();
  const [users,   setUsers]   = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedErr, setExpandedErr] = useState<Set<string|number>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const load = async () => {
    try {
      const [ur,cr,jr] = await Promise.all([
        authFetch(`${API}/admin/users`),
        authFetch(`${API}/cameras`),
        authFetch(`${API}/pipeline/jobs`),
      ]);
      if (ur.ok) setUsers(await ur.json());
      if (cr.ok) { const cd=await cr.json(); setCameras(cd?.cameras??(Array.isArray(cd)?cd:[])); }
      if (jr.ok) setJobs(await jr.json());
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    refreshRef.current = setInterval(load, 12_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  const toggleErr = (id: string|number) =>
    setExpandedErr(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });

  const active      = jobs.filter(j=>j.status==="processing").length;
  const completed   = jobs.filter(j=>j.status==="completed").length;
  const failed      = jobs.filter(j=>j.status==="failed").length;
  const successRate = jobs.length>0?Math.round((completed/jobs.length)*100):0;
  const avgDur      = (() => { const w=jobs.filter(j=>j.duration_seconds&&j.duration_seconds>0); if(!w.length)return null; return w.reduce((s,j)=>s+(j.duration_seconds||0),0)/w.length; })();
  const recent      = jobs.slice(0,8);

  return (
    <AppShell adminOnly>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-mute">System-wide overview</p>
          </div>
          {lastUpdated && (
            <div className="text-right hidden sm:block">
              <span className="text-xs text-mute">Updated {lastUpdated.toLocaleTimeString()}</span>
              <button onClick={load} className="block text-xs text-warn hover:text-warn/80 mt-0.5 ml-auto">↻ Refresh</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 glass rounded-xl"/><div className="h-48 glass rounded-xl"/>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTag label="Total Users"     value={users.length}/>
              <StatTag label="Cameras"         value={cameras.length}/>
              <StatTag label="Total Jobs"      value={jobs.length}/>
              <StatTag label="Active Now"      value={active}/>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTag label="Completed"    value={`${completed} (${successRate}%)`}/>
              <StatTag label="Failed"       value={failed}/>
              <StatTag label="Avg Duration" value={avgDur?fmtDur(avgDur):"—"}/>
              <StatTag label="Success Rate" value={`${successRate}%`}/>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/cameras"  className="btn-primary">➕ Add Camera</Link>
              <Link href="/admin/users"    className="btn-ghost">👤 Manage Users</Link>
              <Link href="/search"         className="btn-ghost">🔍 Run Search</Link>
              <Link href="/admin/jobs"     className="btn-ghost">📋 All Jobs</Link>
            </div>

            {/* Chart row */}
            <div className="grid lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2"><ActivityChart jobs={jobs}/></div>

              {/* Health */}
              <div className="glass p-4">
                <h3 className="font-display text-sm font-semibold mb-3">System Health</h3>
                <div className="space-y-2 text-sm">
                  {["Backend API","AI Pipeline","Database"].map(name=>(
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-mute">{name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-ok">
                        <span className="w-2 h-2 rounded-full bg-ok"/>Online
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent jobs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-semibold">Recent Jobs</h2>
                <Link href="/admin/jobs" className="text-xs text-accent hover:underline">View all →</Link>
              </div>

              {recent.length === 0 ? (
                <div className="glass p-10 text-center">
                  <p className="font-medium">No jobs yet</p>
                  <p className="text-sm text-mute mt-1">Processing jobs appear here once videos are uploaded.</p>
                </div>
              ) : (
                <div className="glass overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-mute text-left text-xs uppercase tracking-wide">
                      <tr>
                        {["Job","Source","Camera","Status","Progress","Frames","Detections","Duration",""].map(h=>(
                          <th key={h} className="p-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(j=>{
                        const errMsg=j.error_message||j.error;
                        const isExpanded=expandedErr.has(j.job_id);
                        const frames=j.frames_processed?(j.total_frames?`${j.frames_processed.toLocaleString()}/${j.total_frames.toLocaleString()}`:j.frames_processed.toLocaleString()):"—";
                        return (
                          <>
                            <tr key={j.job_id} className="border-t border-edge/40 hover:bg-panel-2/40 transition-colors">
                              <td className="p-3 font-mono text-xs text-mute">{j.job_id}</td>
                              <td className="p-3 max-w-[140px]"><span className="truncate block" title={srcName(j)}>{srcName(j)}</span></td>
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
                              <td className="p-3 text-mute">{frames}</td>
                              <td className="p-3 text-mute">{j.total_detections?.toLocaleString()??"—"}</td>
                              <td className="p-3 text-mute">{fmtDur(j.duration_seconds)}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {j.status==="completed"&&<Link href="/search" className="text-xs text-accent hover:underline">Search</Link>}
                                  {errMsg&&<button onClick={()=>toggleErr(j.job_id)} className="text-xs text-danger hover:underline">{isExpanded?"Hide ▲":"Error ▼"}</button>}
                                  {j.status==="failed"&&<Link href="/search" className="text-xs text-mute hover:underline">Retry</Link>}
                                </div>
                              </td>
                            </tr>
                            {errMsg&&isExpanded&&(
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
          </>
        )}
      </div>
    </AppShell>
  );
}
