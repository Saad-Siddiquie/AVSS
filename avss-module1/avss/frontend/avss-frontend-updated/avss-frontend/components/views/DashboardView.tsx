"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, UserCheck, Camera, TriangleAlert, ScanFace, UserPlus, ShieldAlert, Activity, Search, Video, Bell } from "lucide-react";
import { useAlerts } from "@/components/AlertsProvider";
import { cameras } from "@/lib/data";
import { currentUser } from "@/lib/user";

// Replace with data from your FastAPI endpoints (e.g. GET /api/stats, /api/activity, /api/detections/daily)
const activity = [
  { icon: ScanFace, text: "Person matched with reference (Camera 03)", when: "2 mins ago", tone: "text-accent", href: "/person/p-103" },
  { icon: UserPlus, text: "New person detected (Camera 07)", when: "5 mins ago", tone: "text-mute", href: "/person/p-108" },
  { icon: ShieldAlert, text: "Alert: Unknown person (Camera 05)", when: "12 mins ago", tone: "text-danger", href: "/person/p-104" },
  { icon: Activity, text: "System running smoothly", when: "23 mins ago", tone: "text-ok", href: "/live" },
];

const trend = [142, 118, 176, 131, 104, 196, 248]; // detections per day, oldest first, ending today
const AXIS_MAX = 250;

function TrendChart() {
  const [labels, setLabels] = useState<string[]>(trend.map(() => ""));
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
    setLabels(trend.map((_, i) => fmt.format(new Date(Date.now() - (trend.length - 1 - i) * 86_400_000))));
  }, []);

  const W = 420, H = 190, L = 34, R = 10, T = 10, B = 24;
  const x = (i: number) => L + (i / (trend.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / AXIS_MAX) * (H - T - B);
  const line = trend.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(trend.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Detections over the last 7 days, from ${trend[0]} to ${trend.at(-1)} today`}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c5cff" stopOpacity=".45" />
          <stop offset="1" stopColor="#7c5cff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {[0, 50, 100, 150, 200, 250].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#1b3a78" strokeOpacity=".5" />
          <text x={L - 6} y={y(t) + 3} fontSize="9" fill="var(--color-mute)" textAnchor="end">{t}</text>
        </g>
      ))}
      <path d={area} fill="url(#trend-fill)" />
      <path d={line} fill="none" stroke="url(#trend-line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {trend.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="3.5" fill="#0a1630" stroke="#a78bfa" strokeWidth="2"><title>{`${labels[i] || "Day " + (i + 1)}: ${v} detections`}</title></circle>
          <text x={x(i)} y={H - 6} fontSize="9" fill="var(--color-mute)" textAnchor="middle">{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}

export default function DashboardView() {
  const { unread } = useAlerts();
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening");
  }, []);

  const online = cameras.filter((c) => c.status === "online").length;
  const stats = [
    { label: "Total Detections", value: 248, note: "+12% today", icon: Users, tone: "text-accent", noteTone: "text-ok", href: "/gallery" },
    { label: "Identified Persons", value: 186, note: "+8% today", icon: UserCheck, tone: "text-violet", noteTone: "text-ok", href: "/gallery" },
    { label: "Active Cameras", value: online, note: online === cameras.length ? "Online" : `${cameras.length - online} offline`, icon: Camera, tone: "text-cyan", noteTone: online === cameras.length ? "text-ok" : "text-warn", href: "/live" },
    { label: "Alerts", value: unread, note: unread ? "Needs Attention" : "All clear", icon: TriangleAlert, tone: "text-danger", noteTone: unread ? "text-danger" : "text-ok", href: "/alerts" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{greeting}, {currentUser.first}!</h1>
          <p className="text-sm text-mute">Here&rsquo;s what&rsquo;s happening with your surveillance system today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/search" className="btn-ghost"><Search className="size-4" aria-hidden /> New search</Link>
          <Link href="/live" className="btn-ghost"><Video className="size-4" aria-hidden /> Live view</Link>
          <Link href="/alerts" className="btn-ghost"><Bell className="size-4" aria-hidden /> Review alerts</Link>
        </div>
      </header>

      <section aria-label="Key statistics" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon, tone, noteTone, href }) => (
          <Link key={label} href={href} className="glass flex items-center gap-4 p-4 transition-colors hover:border-accent">
            <span className={`grid size-12 shrink-0 place-items-center rounded-xl bg-panel-2 ${tone}`}><Icon className="size-6" aria-hidden /></span>
            <div>
              <p className="text-xs text-mute">{label}</p>
              <p className="font-display text-2xl font-semibold">{value}</p>
              <p className={`text-xs ${noteTone}`}>{note}</p>
            </div>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass p-4" aria-labelledby="recent">
          <div className="flex items-center justify-between">
            <h2 id="recent" className="font-display text-base font-semibold">Recent Activity</h2>
            <Link href="/alerts" className="text-xs text-accent hover:underline">View alerts</Link>
          </div>
          <ul className="mt-3 space-y-2">
            {activity.map(({ icon: Icon, text, when, tone, href }) => (
              <li key={text}>
                <Link href={href} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2.5 text-sm transition-colors hover:ring-1 hover:ring-accent">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-md bg-bg/60 ${tone}`}><Icon className="size-4" aria-hidden /></span>
                  <span className="flex-1">{text}</span>
                  <span className="shrink-0 text-xs text-mute">{when}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass p-4" aria-labelledby="trend">
          <h2 id="trend" className="font-display text-base font-semibold">Detections Trend</h2>
          <TrendChart />
        </section>
      </div>
    </div>
  );
}
