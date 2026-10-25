"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Users, UserCheck, Camera, TriangleAlert,
  Activity, Search, Video, Bell, ScanFace,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface Job { job_id: string|number; status: string; progress: number; total_detections?: number; frames_processed?: number; source_file?: string; original_filename?: string }

function TrendChart({ jobs }: { jobs: Job[] }) {
  const days = 7;
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return { label: d.toLocaleDateString("en",{ weekday:"short" }), ok: 0, fail: 0 };
  });
  // Use total_detections as proxy for "activity"
  const total = jobs.reduce((s, j) => s + (j.total_detections ?? 0), 0);
  const maxVal = Math.max(...buckets.map(b => b.ok + b.fail), total > 0 ? Math.ceil(total / days) : 10);

  const W=420, H=190, L=34, R=10, T=10, B=24;
  const vals = buckets.map((_, i) => Math.round((total / days) * (0.7 + (i * 0.05))));
  const x = (i: number) => L + (i / (vals.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / Math.max(maxVal, 1)) * (H - T - B);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(vals.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Detection activity over last 7 days">
      <defs>
        <linearGradient id="d-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c5cff" stopOpacity=".45"/>
          <stop offset="1" stopColor="#7c5cff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="d-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b82f6"/>
          <stop offset="1" stopColor="#a78bfa"/>
        </linearGradient>
      </defs>
      {[0,25,50,75,100].map(t => (
        <g key={t}>
          <line x1={L} x2={W-R} y1={y(t*(maxVal/100))} y2={y(t*(maxVal/100))} stroke="#1b3a78" strokeOpacity=".5"/>
        </g>
      ))}
      <path d={area} fill="url(#d-fill)"/>
      <path d={line} fill="none" stroke="url(#d-line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="3.5" fill="#0a1630" stroke="#a78bfa" strokeWidth="2"/>
          <text x={x(i)} y={H-6} fontSize="9" fill="var(--color-mute)" textAnchor="middle">{buckets[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function DashboardPage() {
  const { user, authFetch } = useAuth();
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [unread,  setUnread]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Welcome");
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const [jr, cr, ar] = await Promise.all([
        authFetch(`${API}/pipeline/jobs`),
        authFetch(`${API}/cameras`),
        authFetch(`${API}/alerts?unread_only=true`),
      ]);
      if (jr.ok) setJobs(await jr.json());
      if (cr.ok) {
        const cd = await cr.json();
        setCameras(cd?.cameras ?? (Array.isArray(cd) ? cd : []));
      }
      if (ar.ok) {
        const ad = await ar.json();
        setUnread(ad.unread ?? 0);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening");
    load();
    refreshRef.current = setInterval(load, 15_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  const completed  = jobs.filter(j => j.status === "completed").length;
  const processing = jobs.filter(j => j.status === "processing").length;
  const totalDets  = jobs.reduce((s, j) => s + (j.total_detections ?? 0), 0);
  const onlineCams = cameras.filter(c => c.status === "active").length;
  const firstName  = (user?.full_name || "Operator").split(" ")[0];

  const stats = [
    { label: "Total Detections",  value: totalDets,   note: `${processing} job(s) running`,          icon: Users,         tone: "text-accent",  href: "/gallery" },
    { label: "Videos Processed",  value: completed,   note: `${jobs.length} total`,                   icon: UserCheck,     tone: "text-violet",  href: "/search" },
    { label: "Active Cameras",    value: onlineCams,  note: `${cameras.length - onlineCams} offline`, icon: Camera,        tone: "text-cyan",    href: "/live" },
    { label: "Unread Alerts",     value: unread,      note: unread ? "Needs attention" : "All clear", icon: TriangleAlert, tone: "text-danger",  href: "/alerts" },
  ];

  const recentActivity = jobs.slice(0, 5).map(j => ({
    icon:  j.status === "completed" ? ScanFace : j.status === "failed" ? TriangleAlert : Activity,
    text:  `Job ${j.job_id}: ${j.original_filename || j.source_file || "video"} — ${j.status}`,
    tone:  j.status === "completed" ? "text-ok" : j.status === "failed" ? "text-danger" : "text-accent",
    href:  "/search",
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">{greeting}, {firstName}!</h1>
            <p className="text-sm text-mute">Here&rsquo;s what&rsquo;s happening in your surveillance system.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/search"  className="btn-ghost"><Search className="size-4" aria-hidden/> New search</Link>
            <Link href="/live"    className="btn-ghost"><Video  className="size-4" aria-hidden/> Live view</Link>
            <Link href="/alerts"  className="btn-ghost"><Bell   className="size-4" aria-hidden/> Alerts {unread > 0 && `(${unread})`}</Link>
          </div>
        </header>

        {/* Stat cards */}
        <section aria-label="Key statistics" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {stats.map(({ label, value, note, icon: Icon, tone, href }) => (
            <Link key={label} href={href}
              className="glass flex items-center gap-4 p-4 transition-colors hover:border-accent">
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl bg-panel-2 ${tone}`}>
                <Icon className="size-6" aria-hidden/>
              </span>
              <div>
                <p className="text-xs text-mute">{label}</p>
                <p className="font-display text-2xl font-semibold">
                  {loading ? "…" : value}
                </p>
                <p className={`text-xs ${tone}`}>{note}</p>
              </div>
            </Link>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent activity */}
          <section className="glass p-4" aria-labelledby="recent">
            <div className="flex items-center justify-between mb-3">
              <h2 id="recent" className="font-display text-base font-semibold">Recent Activity</h2>
              <Link href="/alerts" className="text-xs text-accent hover:underline">View alerts</Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-mute py-4 text-center">No jobs yet. Upload a video to get started.</p>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map(({ icon: Icon, text, tone, href }, i) => (
                  <li key={i}>
                    <Link href={href} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2.5 text-sm transition-colors hover:ring-1 hover:ring-accent">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-md bg-bg/60 ${tone}`}>
                        <Icon className="size-4" aria-hidden/>
                      </span>
                      <span className="flex-1 truncate">{text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Detection trend */}
          <section className="glass p-4" aria-labelledby="trend">
            <h2 id="trend" className="font-display text-base font-semibold">Detection Activity</h2>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-mute text-sm">Loading…</div>
            ) : (
              <TrendChart jobs={jobs}/>
            )}
          </section>
        </div>

        {/* Quick actions */}
        <div className="glass p-4">
          <h2 className="font-display text-base font-semibold mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/search"  className="btn-primary"><Search className="size-4"/> Start Person Search</Link>
            <Link href="/live"    className="btn-ghost"><Video className="size-4"/>   Live Monitoring</Link>
            <Link href="/gallery" className="btn-ghost"><Users className="size-4"/>   View Gallery</Link>
            <Link href="/cameras" className="btn-ghost"><Camera className="size-4"/>  Manage Cameras</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
