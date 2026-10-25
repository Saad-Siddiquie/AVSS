"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import TopBar from "./TopBar";
import ThemeSync from "./ThemeSync";
import { AlertsProvider } from "./AlertsProvider";

interface Props {
  children: React.ReactNode;
  /** true = only admins allowed; non-admins redirect to /dashboard */
  adminOnly?: boolean;
}

export function AppShell({ children, adminOnly = false }: Props) {
  const { ready, isLoggedIn, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn)          { router.replace("/login"); return; }
    if (adminOnly && !isAdmin){ router.replace("/dashboard"); }
  }, [ready, isLoggedIn, isAdmin, adminOnly, router]);

  // Show spinner while resolving
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-mute">
          <div className="size-8 rounded-full border-2 border-edge border-t-accent animate-spin"/>
          <span className="text-sm">Loading AVSS…</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn)           return null;
  if (adminOnly && !isAdmin) return null;

  return (
    <AlertsProvider>
      <ThemeSync/>
      <div className="flex gap-4 p-4">
        <Sidebar/>
        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <TopBar/>
          <main>{children}</main>
        </div>
      </div>
    </AlertsProvider>
  );
}
