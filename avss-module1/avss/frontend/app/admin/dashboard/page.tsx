"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatTag } from "@/components/ui/StatTag";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuth } from "@/hooks/useAuth";

const API             = "/api/backend";
const AUTO_REFRESH_MS = 12_000;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Job {
  job_id: string | number;
  source_file?: string;
  original_filename?: string;
  camera_id?: number | null;
  status: string;
  progress: number;
  frames_processed?: number | null;
  total_frames?: number | null;
  total_detections?: number;
  duration_seconds?: number | null;
  duration?: string | null;
  error_message?: string | null;
  error?: string | null;
  created_at?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDur = (s?: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};
const srcName = (j: Job) =>
  j.original_filename || j.source_file || `Job ${j.job_id}`;

const etaLabel = (progress: number, createdAt?: string) => {
  if (progress <= 0 || !createdAt) return "";
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  const rem     = (elapsed / (progress / 100)) - elapsed;
  if (rem <= 0 || rem > 3600) return "";
  const m = Math.floor(rem / 60), s = Math.round(rem % 60);
  return m > 0 ? `~${m}m ${s}s left` : `~${s}s left`;
};

// ── Mini activity chart (7-day, CSS bars) ─────────────────────────────────────
function ActivityChart({ jobs }: { jobs: Job[] }) {
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key  = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en", { weekday: "short" });
    const slice = jobs.filter(j => (j.created_at || "").startsWith(key));
    return {
      label,
      ok:   slice.filter(j => j.status === "completed").length,
      fail: slice.filter(j => j.status === "failed").length,
    };
  });
  const maxVal = Math.max(...buckets.map(b => b.ok + b.fail), 1);

  return (
    <div className="avss-card p-4">
      <h3 className="text-sm font-semibold mb-3 font-display">Jobs — last 7 days</h3>
      <div className="flex items-end gap-1.5 h-16">
        {buckets.map(b => {
          const total  = b.ok + b.fail;
          const pct    = total / maxVal;
          const okPct  = total > 0 ? (b.ok   / total) * pct : 0;
          const failPct= total > 0 ? (b.fail  / total) * pct : 0;
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5"
              title={`${b.ok} ok · ${b.fail} failed`}>
              <div className="w-full flex flex-col-reverse gap-px" style={{ height: 48 }}>
                <div className="w-full bg-emerald-500/70 rounded-t-sm transition-all"
                  style={{ height: `${okPct * 48}px` }} />
                {failPct > 0 && (
                  <div className="w-full bg-rose-500/70"
                    style={{ height: `${failPct * 48}px` }} />
                )}
              </div>
              <span className="text-[9px] text-slate-500">{b.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" /> Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-rose-500/70 inline-block" /> Failed
        </span>
      </div>
    </div>
  );
}

// ── System health card ────────────────────────────────────────────────────────
function HealthCard() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/backend/health")
      .then(r => setOk(r.ok))
      .catch(() => setOk(false));
  }, []);
  const dot = (v: boolean | null) =>
    v === null ? "bg-yellow-400 animate-pulse" : v ? "bg-emerald-400" : "bg-rose-400";
  const lbl = (v: boolean | null) =>
    v === null ? "Checking…" : v ? "Online" : "Offline";

  return (
    <div className="avss-card p-4">
      <h3 className="text-sm font-semibold mb-3 font-display">System Health</h3>
      <div className="space-y-2 text-sm">
        {["Backend API", "AI Pipeline", "Database"].map(name => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-slate-300">{name}</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dot(ok)}`} />
              <span className="text-xs text-slate-400">{lbl(ok)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ jobs }: { jobs: Job[] }) {
  const events = jobs.slice(0, 8).map(j => {
    const icon  = j.status === "completed" ? "✓" : j.status === "failed" ? "✗" : "⟳";
    const color = j.status === "completed"
      ? "text-emerald-400"
      : j.status === "failed"
      ? "text-rose-400"
      : "text-blue-400";
    const label = j.status === "completed"
      ? `Job ${j.job_id} completed`
      : j.status === "failed"
      ? `Job ${j.job_id} failed`
      : `Job ${j.job_id} processing…`;
    const sub = srcName(j);
    return { icon, color, label, sub, key: j.job_id };
  });

  return (
    <div className="avss-card p-4">
      <h3 className="text-sm font-semibold mb-3 font-display">Activity Feed</h3>
      {events.length === 0 ? (
        <p className="text-xs text-slate-500">No activity yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.key} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 font-bold flex-shrink-0 ${e.color}`}>{e.icon}</span>
              <div>
                <span className="text-slate-200">{e.label}</span>
                <span className="text-slate-500 ml-1 truncate">— {e.sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { authFetch } = useAuth();
  const [users,   setUsers]   = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedErr, setExpandedErr] = useState<Set<string|number>>(new Set());
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const [ur, cr, jr] = await Promise.all([
        authFetch(`${API}/admin/users`),
        authFetch(`${API}/cameras`),
        authFetch(`${API}/pipeline/jobs`),
      ]);
      if (ur.ok) setUsers(await ur.json());
      if (cr.ok) {
        const cd = await cr.json();
        setCameras(cd?.cameras ?? (Array.isArray(cd) ? cd : []));
      }
      if (jr.ok) setJobs(await jr.json());
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    refreshRef.current = setInterval(load, AUTO_REFRESH_MS);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  const toggleErr = (id: string|number) =>
    setExpandedErr(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const active      = jobs.filter(j => j.status === "processing").length;
  const completed   = jobs.filter(j => j.status === "completed").length;
  const failed      = jobs.filter(j => j.status === "failed").length;
  const successRate = jobs.length > 0 ? Math.round((completed / jobs.length) * 100) : 0;
  const avgDur      = (() => {
    const w = jobs.filter(j => j.duration_seconds && j.duration_seconds > 0);
    if (!w.length) return null;
    return w.reduce((s, j) => s + (j.duration_seconds || 0), 0) / w.length;
  })();
  const recent = jobs.slice(0, 8);

  return (
    <AppShell adminOnly>
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold font-display">Admin Dashboard</h1>
          <p className="text-sm text-slate-400">System-wide overview</p>
        </div>
        {lastUpdated && (
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
            <button
              onClick={load}
              className="block text-xs text-orange-400 hover:text-orange-300 mt-0.5 ml-auto"
            >
              ↻ Refresh
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse mt-6">
          <div className="h-24 avss-card" />
          <div className="h-48 avss-card" />
        </div>
      ) : (
        <>
          {/* ── Primary stat row ──────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 mb-3">
            <StatTag label="Total users"     value={users.length} />
            <StatTag label="Cameras"         value={`${cameras.filter(c=>c.status==="active").length} online / ${cameras.length}`} />
            <StatTag label="Total jobs"      value={jobs.length} />
            <StatTag label="Active now"      value={active} />
          </div>

          {/* ── Secondary stat row ────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatTag label="Completed"    value={`${completed} (${successRate}%)`} />
            <StatTag label="Failed"       value={failed} />
            <StatTag label="Avg duration" value={avgDur ? fmtDur(avgDur) : "—"} />
            <StatTag label="Success rate" value={`${successRate}%`} />
          </div>

          {/* ── Quick actions ──────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Link href="/admin/cameras" className="btn-admin">➕ Add Camera</Link>
            <Link href="/admin/users"   className="btn-outline">👤 Manage Users</Link>
            <Link href="/admin/pipeline" className="btn-outline">🔍 Run Search</Link>
            <Link href="/admin/jobs"    className="btn-outline">📋 All Jobs</Link>
          </div>

          {/* ── Charts + health + feed ────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-3 mb-6">
            <div className="lg:col-span-1">
              <ActivityChart jobs={jobs} />
            </div>
            <HealthCard />
            <ActivityFeed jobs={jobs} />
          </div>

          {/* ── Recent jobs table ─────────────────────────────────── */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold font-display">Recent Jobs</h2>
            <Link href="/admin/jobs" className="text-xs text-orange-400 hover:underline">
              View all →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="avss-card p-10 text-center">
              <p className="font-medium">No jobs yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Processing jobs will appear here once videos are uploaded.
              </p>
            </div>
          ) : (
            <div className="avss-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="p-3">Job</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Camera</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-36">Progress</th>
                    <th className="p-3">Frames</th>
                    <th className="p-3">Detections</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(j => {
                    const errMsg   = j.error_message || j.error;
                    const isExpanded = expandedErr.has(j.job_id);
                    const frames = j.frames_processed
                      ? j.total_frames
                        ? `${j.frames_processed.toLocaleString()} / ${j.total_frames.toLocaleString()}`
                        : j.frames_processed.toLocaleString()
                      : "—";
                    return (
                      <>
                        <tr
                          key={j.job_id}
                          className="border-t border-slate-700 hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="p-3 font-mono text-xs text-slate-400">{j.job_id}</td>
                          <td className="p-3 max-w-[140px]">
                            <span className="truncate block" title={srcName(j)}>{srcName(j)}</span>
                          </td>
                          <td className="p-3 text-slate-500 text-xs">
                            {j.camera_id ? `Cam ${j.camera_id}` : "Upload"}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={j.status} />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <ProgressBar value={j.progress} admin />
                              </div>
                              <span className="text-xs text-slate-400 w-8 text-right">
                                {j.progress}%
                              </span>
                            </div>
                            {j.status === "processing" && j.created_at && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {etaLabel(j.progress, j.created_at)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-300">{frames}</td>
                          <td className="p-3 text-slate-300">{j.total_detections ?? "—"}</td>
                          <td className="p-3 text-slate-300">{fmtDur(j.duration_seconds)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {j.status === "completed" && (
                                <Link href="/admin/pipeline"
                                  className="text-xs text-orange-400 hover:underline">
                                  Search
                                </Link>
                              )}
                              {errMsg && (
                                <button
                                  onClick={() => toggleErr(j.job_id)}
                                  className="text-xs text-rose-400 hover:underline"
                                >
                                  {isExpanded ? "Hide ▲" : "Error ▼"}
                                </button>
                              )}
                              {j.status === "failed" && (
                                <Link href="/admin/pipeline"
                                  className="text-xs text-slate-400 hover:underline">
                                  Retry
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded error */}
                        {errMsg && isExpanded && (
                          <tr key={`${j.job_id}-err`} className="bg-rose-500/5">
                            <td colSpan={9} className="px-3 py-2">
                              <div className="text-xs text-rose-300 font-mono break-all">
                                ⚠ {errMsg}
                              </div>
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
        </>
      )}
    </AppShell>
  );
}
