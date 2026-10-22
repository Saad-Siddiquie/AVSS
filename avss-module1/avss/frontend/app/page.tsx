"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function RootPage() {
  const { ready, isLoggedIn, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) { router.replace("/login"); return; }
    // Route by role — only runs once on mount after auth resolves
    router.replace(isAdmin ? "/admin/dashboard" : "/dashboard");
  }, [ready, isLoggedIn, isAdmin, router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-slate-600 border-t-emerald-500 animate-spin" />
        <span className="text-sm">Loading AVSS…</span>
      </div>
    </div>
  );
}
