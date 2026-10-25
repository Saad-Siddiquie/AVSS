"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { alerts as initial, type Alert } from "@/lib/data";

type Ctx = { alerts: Alert[]; unread: number; markRead: (ids: string[]) => void; markAllRead: () => void };
const AlertsContext = createContext<Ctx | null>(null);

// Shared so the sidebar badge, dashboard card and Alerts page always agree.
export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>(initial);
  // Replace with: POST /api/alerts/{id}/read (and POST /api/alerts/read-all)
  const markRead = useCallback((ids: string[]) => setAlerts((all) => all.map((a) => (ids.includes(a.id) ? { ...a, read: true } : a))), []);
  const markAllRead = useCallback(() => setAlerts((all) => all.map((a) => ({ ...a, read: true }))), []);
  const value = useMemo(() => ({ alerts, unread: alerts.filter((a) => !a.read).length, markRead, markAllRead }), [alerts, markRead, markAllRead]);
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used inside AlertsProvider");
  return ctx;
}
