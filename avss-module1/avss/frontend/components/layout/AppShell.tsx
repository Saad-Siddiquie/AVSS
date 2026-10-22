"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";

interface Props {
  children: React.ReactNode;
  /** If true, redirects non-admins to /dashboard. Does NOT redirect admins away. */
  adminOnly?: boolean;
}

export function AppShell({ children, adminOnly = false }: Props) {
  const { ready, isLoggedIn, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    // Admin-only page accessed by a non-admin user
    if (adminOnly && !isAdmin) {
      router.replace("/dashboard");
    }
    // NOTE: We intentionally do NOT redirect admins away from user pages.
    // Admins can access everything.
  }, [ready, isLoggedIn, isAdmin, adminOnly, router]);

  // Show loading while auth resolves
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-slate-600 border-t-emerald-500 animate-spin" />
          <span className="text-sm">Loading AVSS…</span>
        </div>
      </div>
    );
  }

  // Not logged in — render nothing (redirect fires above)
  if (!isLoggedIn) return null;

  // Non-admin on admin-only page — render nothing (redirect fires above)
  if (adminOnly && !isAdmin) return null;

  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
