"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Search, Star } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PersonThumb } from "@/components/art/Figure";
import { bestScore, cameraName, lastSighting, persons, statusLabel } from "@/lib/data";

const tabs = [
  { value: "all", label: "All" },
  { value: "matches", label: "Matches" },
  { value: "detections", label: "Detections" },
  { value: "favorites", label: "Favorites" },
] as const;
type Tab = (typeof tabs)[number]["value"];

const ranges = [
  { value: "1", label: "Last 24 hours", days: 0 },
  { value: "7", label: "Last 7 days", days: 6 },
  { value: "30", label: "Last 30 days", days: 29 },
] as const;

export default function GalleryView() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [range, setRange] = useState<(typeof ranges)[number]["value"]>("7");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [favorites, setFavorites] = useState<string[]>(["p-103"]);

  // The top-bar search sends people here with ?q=, including when they are already on this page.
  const urlQuery = params.get("q") ?? "";
  useEffect(() => { setQuery(urlQuery); }, [urlQuery]);

  const toggleFavorite = (id: string) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const shown = useMemo(() => {
    const days = ranges.find((r) => r.value === range)!.days;
    const q = query.trim().toLowerCase().replace(/^id\s*/, "");
    return persons.filter((p) => {
      if (p.daysAgo > days) return false;
      if (tab === "matches" && p.status === "unknown") return false;
      if (tab === "detections" && p.status !== "unknown") return false;
      if (tab === "favorites" && !favorites.includes(p.id)) return false;
      if (!q) return true;
      const last = lastSighting(p.id);
      const cam = last ? cameraName(last.cameraId).toLowerCase() : "";
      return p.name.toLowerCase().includes(q) || String(p.trackId) === q || cam.includes(q) || (last?.time.startsWith(q) ?? false);
    });
  }, [tab, range, query, favorites]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Gallery</h1>
        <p className="text-sm text-mute">View matched and detected people history. Open a person to see where they went.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Gallery filter" className="flex overflow-hidden rounded-lg border border-edge/70">
          {tabs.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
              className={`px-4 py-2 text-sm transition-colors ${tab === t.value ? "bg-accent text-white" : "bg-panel-2 text-mute hover:text-white"}`}>{t.label}</button>
          ))}
        </div>
        <label className="ml-auto flex w-full items-center gap-2 rounded-lg border border-edge bg-panel-2 px-3 py-2 sm:w-64">
          <Search className="size-4 text-mute" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, ID or camera" aria-label="Search the gallery" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm">
          <CalendarDays className="size-4 text-mute" aria-hidden />
          <span className="sr-only">Date range</span>
          <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="bg-transparent outline-none">
            {ranges.map((r) => <option key={r.value} value={r.value} className="bg-panel">{r.label}</option>)}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No one matches these filters" text={tab === "favorites" ? "Star a person to keep them here." : "Clear the search or widen the date range."} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p) => {
            const last = lastSighting(p.id);
            const fav = favorites.includes(p.id);
            return (
              <li key={p.id} className="glass relative overflow-hidden transition-colors hover:border-accent">
                <Link href={`/person/${p.id}`} className="block">
                  <PersonThumb seed={p.trackId} alt={`${p.name}, ID ${p.trackId}`} className="aspect-[3/4] w-full" />
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold">ID {p.trackId}</p>
                      <p className="truncate text-xs text-mute">{statusLabel[p.status]}{last ? ` · ${cameraName(last.cameraId)}` : ""}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-ok">{bestScore(p.id).toFixed(1)}% <ChevronRight className="size-3.5 text-mute" aria-hidden /></span>
                  </div>
                </Link>
                <button type="button" onClick={() => toggleFavorite(p.id)} aria-pressed={fav} aria-label={`${fav ? "Remove" : "Add"} ID ${p.trackId} ${fav ? "from" : "to"} favorites`}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-bg/70 hover:bg-bg">
                  <Star className={`size-4 ${fav ? "fill-warn text-warn" : "text-white"}`} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
