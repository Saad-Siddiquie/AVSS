"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

export default function TopBar() {
  const router        = useRouter();
  const { user, authFetch } = useAuth();
  const [q,       setQ]       = useState("");
  const [unread,  setUnread]  = useState(0);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = async () => {
    try {
      const r = await authFetch(`${API}/alerts?unread_only=true`);
      if (r.ok) { const d = await r.json(); setUnread(d.unread ?? 0); }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchAlerts();
    // Refresh unread count every 30 seconds
    refreshRef.current = setInterval(fetchAlerts, 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/gallery?q=${encodeURIComponent(term)}` : "/gallery");
  }

  return (
    <div className="glass mb-4 flex items-center gap-3 px-4 py-2.5">
      {/* Global search */}
      <form onSubmit={submit} role="search"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-edge/70 bg-panel-2 px-3 py-2">
        <Search className="size-4 shrink-0 text-mute" aria-hidden/>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by person, camera or time…"
          aria-label="Global search"
          className="w-full bg-transparent text-sm outline-none placeholder:text-mute"
        />
      </form>

      {/* Alerts bell with live unread count */}
      <button
        onClick={() => router.push("/alerts")}
        className="relative btn-ghost px-2.5 py-2"
        aria-label={unread > 0 ? `${unread} unread alerts` : "No unread alerts"}
      >
        <Bell className="size-5"/>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* User avatar */}
      <div className="flex shrink-0 items-center gap-2">
        <Avatar name={user?.full_name || "User"} size="sm"/>
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium">{user?.full_name || "User"}</p>
          <p className="text-xs text-mute capitalize">{user?.role === "admin" ? "Administrator" : "Operator"}</p>
        </div>
      </div>
    </div>
  );
}
