"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/layout/Logo";

export default function RootPage() {
  const { ready, isLoggedIn, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) { router.replace("/login"); return; }
    router.replace(isAdmin ? "/admin/dashboard" : "/dashboard");
  }, [ready, isLoggedIn, isAdmin, router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <Logo/>
        <div className="flex items-center gap-2 text-mute text-sm">
          <div className="size-4 rounded-full border-2 border-edge border-t-accent animate-spin"/>
          Loading…
        </div>
      </div>
    </div>
  );
}
