"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Severity  = "high" | "medium" | "low" | "info";
export type AlertKind = "unknown" | "match" | "lowconf" | "access" | "system";

export type AppAlert = {
  id: string; kind: AlertKind; severity: Severity;
  title: string; text: string; cameraId: string;
  personId?: string; time: string; read: boolean;
};

type Ctx = {
  alerts: AppAlert[]; unread: number;
  markRead: (ids: string[]) => void; markAllRead: () => void;
  addAlert: (a: Omit<AppAlert, "id" | "read">) => void;
};

const Ctx = createContext<Ctx | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);

  const markRead    = useCallback((ids: string[]) =>
    setAlerts(all => all.map(a => ids.includes(a.id) ? { ...a, read: true } : a)), []);
  const markAllRead = useCallback(() =>
    setAlerts(all => all.map(a => ({ ...a, read: true }))), []);
  const addAlert    = useCallback((a: Omit<AppAlert,"id"|"read">) =>
    setAlerts(all => [{ ...a, id: `a-${Date.now()}`, read: false }, ...all]), []);

  const value = useMemo(() => ({
    alerts, unread: alerts.filter(a => !a.read).length, markRead, markAllRead, addAlert,
  }), [alerts, markRead, markAllRead, addAlert]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAlerts() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAlerts must be used inside AlertsProvider");
  return ctx;
}
