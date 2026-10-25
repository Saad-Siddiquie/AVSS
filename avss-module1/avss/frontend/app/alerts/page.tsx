"use client";
import { useEffect, useState, useCallback } from "react";
import { Bell, Check, ChevronRight, DoorOpen, ScanFace, ScanSearch, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

type Severity  = "high" | "medium" | "low" | "info";
type AlertKind = "unknown" | "match" | "lowconf" | "access" | "system";

interface Alert {
  id: string; kind: AlertKind; severity: Severity;
  title: string; text: string; cameraId: string;
  personId?: string; time: string; read: boolean;
}

const iconMap: Record<AlertKind, typeof Bell> = {
  unknown: UserRound, match: ScanFace, lowconf: ScanSearch, access: DoorOpen, system: Bell,
};
const iconTone: Record<AlertKind, string> = {
  unknown: "bg-danger/20 text-danger", match:   "bg-warn/20 text-warn",
  lowconf: "bg-accent/20 text-accent", access:  "bg-danger/20 text-danger",
  system:  "bg-accent/20 text-accent",
};
const severityBadge: Record<Severity, string> = {
  high:   "bg-danger/20 text-danger", medium: "bg-warn/20 text-warn",
  low:    "bg-ok/20 text-ok",         info:   "bg-accent/20 text-accent",
};
const severityLabel: Record<Severity, string> = { high:"High", medium:"Medium", low:"Low", info:"Info" };

export default function AlertsPage() {
  const { authFetch } = useAuth();
  const [alerts,   setAlerts]   = useState<Alert[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"unread"|"read"|"all">("unread");

  const load = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/alerts`);
      if (r.ok) { const d = await r.json(); setAlerts(d.alerts ?? []); }
    } finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    await authFetch(`${API}/alerts/${id}/read`, { method: "POST" });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const markAllRead = async () => {
    await authFetch(`${API}/alerts/read-all`, { method: "POST" });
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const unread = alerts.filter(a => !a.read).length;
  const shown  = tab === "unread" ? alerts.filter(a => !a.read)
               : tab === "read"   ? alerts.filter(a =>  a.read)
               : alerts;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Alerts</h1>
            <p className="text-sm text-mute">
              {unread ? `${unread} alert${unread === 1 ? "" : "s"} need attention.`
                      : "Nothing needs attention right now."}
            </p>
          </div>
          <button className="btn-ghost" disabled={unread === 0} onClick={markAllRead}>
            <Check className="size-4"/> Mark All Read
          </button>
        </header>

        <div role="group" className="flex flex-wrap gap-2">
          {(["unread","read","all"] as const).map(t => (
            <button key={t} className="chip" aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "unread" && unread > 0 && ` (${unread})`}
              {t === "all" && ` (${alerts.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-16 glass rounded-xl"/>)}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState title="No alerts here" text="Alerts from jobs and searches will appear here."/>
        ) : (
          <ul className="space-y-3">
            {shown.map(a => {
              const Icon = iconMap[a.kind];
              return (
                <li key={a.id} className={`glass flex items-center gap-2 p-2 pr-3 ${a.read ? "opacity-60" : ""}`}>
                  <div className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-full ${iconTone[a.kind]}`}>
                      <Icon className="size-5" aria-hidden/>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {a.title}
                        {!a.read && <span className="size-2 rounded-full bg-accent" aria-label="Unread"/>}
                      </div>
                      <p className="truncate text-xs text-mute">{a.text}</p>
                      <p className="text-xs text-mute">{a.cameraId} · {a.time}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${severityBadge[a.severity]}`}>
                      {severityLabel[a.severity]}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-mute" aria-hidden/>
                  </div>
                  {!a.read && (
                    <button className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs"
                      onClick={() => markRead(a.id)}>
                      <Check className="size-3.5"/> Read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
