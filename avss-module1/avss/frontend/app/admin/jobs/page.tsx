"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuth } from "@/hooks/useAuth";

const API             = "/api/backend";
const AUTO_REFRESH_MS = 10_000;

type Filter = "all" | "pending" | "processing" | "completed" | "failed";

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

const fmtFrames = (done?: number | null, total?: number | null) => {
  if (!done && done !== 0) return "—";
  if (total && total > 0) return `${done.toLocaleString()} / ${total.toLocaleString()}`;
  return done.toLocaleString();
};

const etaLabel = (progress: number, createdAt?: string) => {
  if (progress <= 0 || !createdAt) return "";
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  const rem     = (elapsed / (progress / 100)) - elapsed;
  if (rem <= 0 || rem > 3600) return "";
  const m = Math.floor(rem / 60), s = Math.round(rem % 60);
  return m > 0 ? `~${m}m ${s}s left` : `~${s}s left`;
};

const srcName = (j: Job) =>
  j.original_filename || j.source_file || `Job ${j.job_id}`;

export default function AdminJobsPage() {
  const { authFetch } = useAuth();
  const [all,      setAll]      = useState<Job[]>([]);
  const [filter,   setFilter]   = useState<Filter>("all");
  const [query,    setQuery]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const r = await authFetch(`${API}/pipeline/jobs`);
    if (r.ok) setAll(await r.json());
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    load();
    refreshRef.current = setInterval(load, AUTO_REFRESH_MS);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  const toggle = (id: string | number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Counts per status
  const counts = {
    all:        all.length,
    pending:    all.filter(j => j.status === "pending").length,
    processing: all.filter(j => j.status === "processing").length,
    completed:  all.filter(j => j.status === "completed").length,
    failed:     all.filter(j => j.status === "failed").length,
  };

  const shown = all
    .filter(j => filter === "all" || j.status === filter)
    .filter(j => {
      if (!query) return true;
      const q = query.toLowerCase();
      return srcName(j).toLowerCase().includes(q) ||
             String(j.job_id).includes(q) ||
             (j.camera_id ? String(j.camera_id).includes(q) : false);
    });

  const FILTERS: Filter[] = ["all","pending","processing","completed","failed"];

  return (
    <AppShell adminOnly>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold font-display">All Jobs</h1>
          <p className="text-sm text-slate-400">
            {all.length} total · {counts.processing} running · {counts.failed} failed
          </p>
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

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 border rounded-full transition-colors ${
              filter === f
                ? "bg-orange-600/20 border-orange-600 text-orange-300"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {counts[f] > 0 && (
              <span className="ml-1 opacity-60">{counts[f]}</span>
            )}
          </button>
        ))}
        <input
          type="search"
          placeholder="Search jobs…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="avss-input !w-44 !py-1 text-xs ml-auto"
        />
      </div>

      {loading ? (
        <div className="avss-card animate-pulse h-48" />
      ) : shown.length === 0 ? (
        <div className="avss-card p-10 text-center">
          <p className="font-medium">No jobs found</p>
          <p className="text-sm text-slate-400 mt-1">
            {all.length === 0
              ? "No videos have been processed yet."
              : "No jobs match the current filter."}
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
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(j => {
                const errMsg     = j.error_message || j.error;
                const isExpanded = expanded.has(j.job_id);

                return (
                  <>
                    <tr
                      key={j.job_id}
                      className="border-t border-slate-700 hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Job ID */}
                      <td className="p-3 font-mono text-xs text-slate-400">
                        {j.job_id}
                      </td>

                      {/* Source */}
                      <td className="p-3 max-w-[160px]">
                        <span className="truncate block" title={srcName(j)}>
                          {srcName(j)}
                        </span>
                      </td>

                      {/* Camera */}
                      <td className="p-3 text-slate-500 text-xs">
                        {j.camera_id ? `Cam ${j.camera_id}` : "Upload"}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <StatusBadge status={j.status} />
                      </td>

                      {/* Progress + ETA */}
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

                      {/* Frames */}
                      <td className="p-3 text-slate-300">
                        {fmtFrames(j.frames_processed, j.total_frames)}
                      </td>

                      {/* Detections */}
                      <td className="p-3 text-slate-300">
                        {j.total_detections?.toLocaleString() ?? "—"}
                      </td>

                      {/* Duration */}
                      <td className="p-3 text-slate-300">
                        {fmtDur(j.duration_seconds)}
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {j.status === "completed" && (
                            <Link href="/admin/pipeline"
                              className="text-xs text-orange-400 hover:underline">
                              Search
                            </Link>
                          )}
                          {errMsg && (
                            <button
                              onClick={() => toggle(j.job_id)}
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

                    {/* Expanded error row */}
                    {errMsg && isExpanded && (
                      <tr key={`${j.job_id}-err`} className="bg-rose-500/5">
                        <td colSpan={9} className="px-4 py-2">
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
    </AppShell>
  );
}
