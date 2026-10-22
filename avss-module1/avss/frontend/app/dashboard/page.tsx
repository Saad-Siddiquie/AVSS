"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatTag } from "@/components/ui/StatTag";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";
const AUTO_REFRESH_MS = 15_000;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Job {
  job_id: string | number;
  source_file?: string;
  original_filename?: string;
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

interface SearchRecord {
  query_id: number;
  status: string;
  total_matches: number;
  output_video_url: string | null;
  camera_name: string | null;
  created_at?: string;
}

type Filter = "all" | "completed" | "processing" | "failed" | "pending";

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtDuration = (s?: number | null): string => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const fmtFrames = (done?: number | null, total?: number | null): string => {
  if (!done && done !== 0) return "—";
  if (total && total > 0) return `${done.toLocaleString()} / ${total.toLocaleString()}`;
  return done.toLocaleString();
};

const etaLabel = (progress: number, createdAt?: string): string => {
  if (progress <= 0 || !createdAt) return "";
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  const total   = elapsed / (progress / 100);
  const rem     = total - elapsed;
  if (rem <= 0 || rem > 3600) return "";
  const m = Math.floor(rem / 60);
  const s = Math.round(rem % 60);
  return m > 0 ? `~${m}m ${s}s left` : `~${s}s left`;
};

const sourceName = (j: Job): string =>
  j.original_filename || j.source_file || `Job ${j.job_id}`;

// ── Activity mini chart (pure CSS sparkline) ───────────────────────────────────
function ActivityChart({ jobs }: { jobs: Job[] }) {
  const days = 7;
  const buckets: { label: string; ok: number; fail: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en", { weekday: "short" });
    const dayJobs = jobs.filter(j => (j.created_at || "").startsWith(key));
    buckets.push({
      label,
      ok:   dayJobs.filter(j => j.status === "completed").length,
      fail: dayJobs.filter(j => j.status === "failed").length,
    });
  }
  const maxVal = Math.max(...buckets.map(b => b.ok + b.fail), 1);
  return (
    <div className="avss-card p-4">
      <h3 className="text-sm font-semibold mb-3 font-display">Jobs — last 7 days</h3>
      <div className="flex items-end gap-1.5 h-20">
        {buckets.map(b => {
          const total  = b.ok + b.fail;
          const height = Math.round((total / maxVal) * 100);
          const okH    = total > 0 ? Math.round((b.ok   / total) * height) : 0;
          const failH  = height - okH;
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5" title={`${b.ok} completed, ${b.fail} failed`}>
              <div className="w-full flex flex-col-reverse gap-px" style={{ height: 64 }}>
                <div className="w-full bg-emerald-500/70 rounded-t-sm" style={{ height: okH * 0.64 }} />
                {failH > 0 && <div className="w-full bg-rose-500/70" style={{ height: failH * 0.64 }} />}
              </div>
              <span className="text-[9px] text-slate-500">{b.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" /> Completed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/70 inline-block" /> Failed</span>
      </div>
    </div>
  );
}

// ── System health card ─────────────────────────────────────────────────────────
function HealthCard() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/backend/health")
      .then(r => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));
  }, []);
  const dot = (ok: boolean | null) =>
    ok === null ? "bg-yellow-400 animate-pulse" : ok ? "bg-emerald-400" : "bg-rose-400";
  const lbl = (ok: boolean | null) =>
    ok === null ? "Checking…" : ok ? "Online" : "Unreachable";
  return (
    <div className="avss-card p-4">
      <h3 className="text-sm font-semibold mb-3 font-display">System Health</h3>
      <div className="space-y-2 text-sm">
        {[
          { label: "Backend API",   ok: backendOk },
          { label: "AI Pipeline",   ok: backendOk },
          { label: "Database",      ok: backendOk },
        ].map(({ label, ok }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-slate-300">{label}</span>
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

// ── Recent searches panel ──────────────────────────────────────────────────────
function RecentSearches({ searches }: { searches: SearchRecord[] }) {
  if (searches.length === 0) return null;
  return (
    <div className="avss-card p-4">
      <h3 className="text-sm font-semibold mb-3 font-display">Recent Searches</h3>
      <div className="space-y-2">
        {searches.slice(0, 5).map(s => (
          <div key={s.query_id} className="flex items-center justify-between text-sm">
            <div>
              <span className="text-slate-300">{s.camera_name || `Query ${s.query_id}`}</span>
              <span className="text-xs text-slate-500 ml-2">
                {s.total_matches} match{s.total_matches !== 1 ? "es" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={s.status} />
              {s.output_video_url && (
                <Link
                  href={`/pipeline`}
                  className="text-xs text-emerald-400 underline"
                >
                  View
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, authFetch } = useAuth();
  const [jobs,     setJobs]     = useState<Job[]>([]);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [cameras,  setCameras]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Filter>("all");
  const [query,    setQuery]    = useState("");
  const [expandedErr, setExpandedErr] = useState<Set<string|number>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const [jr, cr, sr] = await Promise.all([
        authFetch(`${API}/pipeline/jobs`),
        authFetch(`${API}/cameras`),
        authFetch(`${API}/pipeline/jobs`), // searches would be a separate endpoint if it existed
      ]);
      if (jr.ok) setJobs(await jr.json());
      if (cr.ok) {
        const cd = await cr.json();
        setCameras(cd?.cameras ?? (Array.isArray(cd) ? cd : []));
      }
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

  const toggleErr = (id: string | number) =>
    setExpandedErr(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Derived stats
  const completed  = jobs.filter(j => j.status === "completed").length;
  const failed     = jobs.filter(j => j.status === "failed").length;
  const processing = jobs.filter(j => j.status === "processing").length;
  const successRate = jobs.length > 0 ? Math.round((completed / jobs.length) * 100) : 0;
  const avgDuration = (() => {
    const withDur = jobs.filter(j => j.duration_seconds && j.duration_seconds > 0);
    if (!withDur.length) return null;
    return withDur.reduce((s, j) => s + (j.duration_seconds || 0), 0) / withDur.length;
  })();

  // Filter + search
  const visibleJobs = jobs
    .filter(j => filter === "all" || j.status === filter)
    .filter(j => {
      if (!query) return true;
      const q = query.toLowerCase();
      return sourceName(j).toLowerCase().includes(q) || String(j.job_id).includes(q);
    });

  const FILTERS: { key: Filter; label: string; count: number; color: string }[] = [
    { key: "all",        label: "All",        count: jobs.length,   color: "btn-outline" },
    { key: "completed",  label: "Completed",  count: completed,     color: "btn-outline" },
    { key: "processing", label: "Processing", count: processing,    color: "btn-outline" },
    { key: "failed",     label: "Failed",     count: failed,        color: "btn-outline" },
  ];

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold font-display">
            Welcome, {user?.full_name ?? "Operator"}
          </h1>
          <p className="text-slate-400 text-sm">Find a person across your processed footage.</p>
        </div>
        {lastUpdated && (
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
            <button
              onClick={load}
              className="block text-xs text-emerald-400 hover:text-emerald-300 mt-0.5"
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
          {/* ── Stat cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 mb-5">
            <button onClick={() => setFilter("all")} className="text-left">
              <StatTag label="Total jobs" value={jobs.length} />
            </button>
            <button onClick={() => setFilter("completed")} className="text-left">
              <StatTag label="Completed" value={`${completed} (${successRate}%)`} />
            </button>
            <button onClick={() => setFilter("failed")} className="text-left">
              <StatTag label="Failed" value={failed} />
            </button>
            <StatTag label="Avg duration" value={avgDuration ? fmtDuration(avgDuration) : "—"} />
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatTag label="Cameras" value={`${cameras.filter(c=>c.status==="active").length} online / ${cameras.length} total`} />
            <StatTag label="Processing now" value={processing} />
            <StatTag label="Success rate" value={`${successRate}%`} />
            <StatTag label="Backend" value="Online" />
          </div>

          {/* ── Quick actions ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Link href="/pipeline" className="btn-primary">
              🔍 Start Search
            </Link>
            <Link href="/pipeline" className="btn-outline">
              📁 Upload Video
            </Link>
            <Link href="/cameras" className="btn-outline">
              📹 Add Camera
            </Link>
          </div>

          {/* ── Top panels row ────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-3 mb-6">
            <div className="lg:col-span-2">
              <ActivityChart jobs={jobs} />
            </div>
            <HealthCard />
          </div>

          {/* ── Recent searches ───────────────────────────────────────── */}
          <RecentSearches searches={searches} />

          {/* ── Jobs table ───────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 mt-2">
            <h2 className="font-semibold font-display">Recent Jobs</h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filters */}
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
                    filter === f.key
                      ? "bg-emerald-600/20 border-emerald-600 text-emerald-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {f.label}
                  {f.count > 0 && (
                    <span className="ml-1 opacity-60">{f.count}</span>
                  )}
                </button>
              ))}
              {/* Search box */}
              <input
                type="search"
                placeholder="Search jobs…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="avss-input !w-40 !py-1 text-xs"
              />
            </div>
          </div>

          {visibleJobs.length === 0 ? (
            <div className="avss-card p-10 text-center">
              <p className="font-medium">No jobs found</p>
              <p className="text-sm text-slate-400 mt-1">
                {jobs.length === 0
                  ? "Upload a video or connect a camera to get started."
                  : "No jobs match the current filter."}
              </p>
              {jobs.length === 0 && (
                <Link href="/pipeline" className="btn-primary mt-4 inline-block">
                  Upload your first video →
                </Link>
              )}
            </div>
          ) : (
            <div className="avss-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="p-3">Job</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-40">Progress</th>
                    <th className="p-3">Frames</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map(j => {
                    const errMsg = j.error_message || j.error;
                    const isExpanded = expandedErr.has(j.job_id);
                    return (
                      <>
                        <tr
                          key={j.job_id}
                          className="border-t border-slate-700 hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="p-3 font-mono text-xs text-slate-400">
                            {j.job_id}
                          </td>
                          <td className="p-3 max-w-[180px]">
                            <span className="truncate block" title={sourceName(j)}>
                              {sourceName(j)}
                            </span>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={j.status} />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <ProgressBar value={j.progress} />
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
                          <td className="p-3 text-slate-300">
                            {fmtFrames(j.frames_processed, j.total_frames)}
                          </td>
                          <td className="p-3 text-slate-300">
                            {fmtDuration(j.duration_seconds)}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {j.status === "completed" && (
                                <Link
                                  href="/pipeline"
                                  className="text-xs text-emerald-400 underline hover:text-emerald-300"
                                >
                                  Search
                                </Link>
                              )}
                              {j.status === "failed" && errMsg && (
                                <button
                                  onClick={() => toggleErr(j.job_id)}
                                  className="text-xs text-rose-400 underline hover:text-rose-300"
                                >
                                  {isExpanded ? "Hide error" : "Error ▼"}
                                </button>
                              )}
                              {j.status === "failed" && (
                                <Link
                                  href="/pipeline"
                                  className="text-xs text-orange-400 underline hover:text-orange-300"
                                >
                                  Retry
                                </Link>
                              )}
                              {j.status === "processing" && (
                                <span className="text-xs text-slate-500">Running…</span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded error row */}
                        {j.status === "failed" && isExpanded && errMsg && (
                          <tr key={`${j.job_id}-err`} className="bg-rose-500/5">
                            <td colSpan={7} className="px-3 py-2">
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
