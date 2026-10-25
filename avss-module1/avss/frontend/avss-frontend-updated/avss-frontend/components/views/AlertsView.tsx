"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, Check, ChevronRight, DoorOpen, ScanFace, ScanSearch, UserRound, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { useAlerts } from "@/components/AlertsProvider";
import { cameraName, severityLabel, type AlertKind, type Severity } from "@/lib/data";

const icon: Record<AlertKind, LucideIcon> = { unknown: UserRound, match: ScanFace, lowconf: ScanSearch, access: DoorOpen, system: Bell };
const iconTone: Record<AlertKind, string> = {
  unknown: "bg-danger/20 text-danger", match: "bg-warn/20 text-warn", lowconf: "bg-accent/20 text-accent", access: "bg-danger/20 text-danger", system: "bg-accent/20 text-accent",
};
const badge: Record<Severity, string> = {
  high: "bg-danger/20 text-danger", medium: "bg-warn/20 text-warn", low: "bg-ok/20 text-ok", info: "bg-accent/20 text-accent",
};
const tabs = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "all", label: "All" },
] as const;

export default function AlertsView() {
  const { alerts, unread, markRead, markAllRead } = useAlerts();
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("unread");

  const count = { unread, read: alerts.length - unread, all: alerts.length };
  const shown = tab === "unread" ? alerts.filter((a) => !a.read) : tab === "read" ? alerts.filter((a) => a.read) : alerts;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Alerts</h1>
          <p className="text-sm text-mute">
            {unread ? `${unread} ${unread === 1 ? "alert needs" : "alerts need"} attention. Get notified about important events and unknown persons.` : "Nothing needs attention."}
          </p>
        </div>
        <button type="button" className="btn-ghost" disabled={unread === 0} onClick={markAllRead}><Check className="size-4" aria-hidden /> Mark All as Read</button>
      </header>

      <div role="group" aria-label="Filter alerts" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.value} type="button" className="chip" aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>{t.label} ({count[t.value]})</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No alerts here" text="New unknown-person and match alerts from your cameras will appear in this list." />
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => {
            const Icon = icon[a.kind];
            const href = a.personId ? `/person/${a.personId}` : `/live?camera=${a.cameraId}`;
            return (
              <li key={a.id} className={`glass flex items-center gap-2 p-2 pr-3 ${a.read ? "opacity-70" : ""}`}>
                <Link href={href} onClick={() => markRead([a.id])} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2 transition-colors hover:bg-panel-2">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-full ${iconTone[a.kind]}`}><Icon className="size-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {a.title}
                      {!a.read && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
                    </span>
                    <span className="block truncate text-xs text-mute">{a.text}</span>
                    <span className="block text-xs text-mute">{cameraName(a.cameraId)} &bull; {a.time}</span>
                  </span>
                  <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${badge[a.severity]}`}>{severityLabel[a.severity]}</span>
                  <ChevronRight className="size-4 shrink-0 text-mute" aria-hidden />
                </Link>
                {!a.read && (
                  <button type="button" className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs" onClick={() => markRead([a.id])} aria-label={`Mark "${a.title}" as read`}>
                    <Check className="size-3.5" aria-hidden /> Read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
