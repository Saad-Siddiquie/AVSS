"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Avatar } from "@/components/ui";
import { currentUser } from "@/lib/user";

export default function TopBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/gallery?q=${encodeURIComponent(term)}` : "/gallery");
  }

  return (
    <div className="glass mb-4 flex items-center gap-3 px-4 py-2.5">
      <LogoMark className="size-7 lg:hidden" />
      <form onSubmit={submit} role="search" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-edge/70 bg-panel-2 px-3 py-2">
        <Search className="size-4 shrink-0 text-mute" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by person, camera ID or time..."
          aria-label="Search by person, camera ID or time"
          className="w-full bg-transparent text-sm outline-none placeholder:text-mute"
        />
      </form>
      <div className="flex shrink-0 items-center gap-3">
        <Avatar name={currentUser.name} size="sm" />
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium">{currentUser.name}</p>
          <p className="text-xs text-mute">{currentUser.role}</p>
        </div>
      </div>
    </div>
  );
}
