"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Play, Download, Trash2, Search, CalendarDays,
  X, Check, Video, ScanFace, CloudIcon, HardDrive,
  Eye, ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, PageHeader } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const API     = "/api/backend";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8002";

interface GalleryCard {
  query_id:           number;
  search_ref_id:      string;
  status:             string;
  total_matches:      number;
  source_name:        string;
  location:           string | null;
  created_at:         string;
  threshold:          number;
  best_similarity:    number;
  video_url:          string | null;
  query_image_url:    string | null;
  supabase_video_url: string | null;
  has_supabase:       boolean;
}

// ── Utility: build absolute URL ──────────────────────────────────────────────
function absUrl(url: string | null): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${BACKEND}${url}`;
}

// ── Video Player Modal ────────────────────────────────────────────────────────
function VideoPlayer({ card, onClose }: { card: GalleryCard; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playUrl  = absUrl(card.supabase_video_url || card.video_url);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => { videoRef.current?.play().catch(() => {}); }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label={`Playing ${card.search_ref_id}`}
    >
      <div className="w-full max-w-5xl bg-panel rounded-2xl overflow-hidden shadow-2xl border border-edge/50">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-edge/50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-white">{card.search_ref_id}</span>
              {card.has_supabase && (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-ok/15 text-ok rounded-full px-2 py-0.5">
                  <CloudIcon className="size-2.5"/> Supabase
                </span>
              )}
            </div>
            <p className="text-xs text-mute truncate">
              {card.source_name}{card.location ? ` · ${card.location}` : ""} · {card.created_at}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {playUrl && (
              <a href={playUrl} download className="btn-ghost text-xs px-2.5 py-1.5">
                <Download className="size-3.5"/> Download
              </a>
            )}
            <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
              <X className="size-4"/>
            </button>
          </div>
        </div>

        {/* ── Video ────────────────────────────────────────────────────── */}
        <div className="bg-black relative">
          {playUrl ? (
            <video
              ref={videoRef}
              src={playUrl}
              controls
              className="w-full max-h-[65vh] object-contain"
              playsInline
            >
              Your browser does not support video playback.
            </video>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center gap-3 text-mute">
              <Video className="size-14 opacity-30"/>
              <p className="text-sm">Video not available</p>
              <p className="text-xs opacity-50">Run a search to generate an annotated video</p>
            </div>
          )}
        </div>

        {/* ── Metadata strip ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-edge/40 border-t border-edge/50">
          {[
            { label: "Search ID",   value: card.search_ref_id },
            { label: "Source",      value: card.source_name },
            { label: "Matches",     value: `${card.total_matches} frame${card.total_matches !== 1 ? "s" : ""}` },
            { label: "Best match",  value: card.best_similarity > 0 ? `${card.best_similarity}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3">
              <p className="text-[10px] text-mute uppercase tracking-widest">{label}</p>
              <p className="text-sm font-semibold truncate mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Gallery Card ──────────────────────────────────────────────────────────────
function GalleryCard({
  card, onPlay, onDelete, isAdmin,
}: {
  card: GalleryCard;
  onPlay: (c: GalleryCard) => void;
  onDelete: (id: number) => void;
  isAdmin: boolean;
}) {
  const [imgErr,   setImgErr]   = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const hasVideo = !!(card.supabase_video_url || card.video_url);
  const queryImgSrc = absUrl(card.query_image_url);
  const videoThumb  = card.supabase_video_url || absUrl(card.video_url);

  const simColor =
    card.best_similarity >= 80 ? "bg-ok" :
    card.best_similarity >= 60 ? "bg-warn" : "bg-danger";

  return (
    <article className="glass flex flex-col overflow-hidden transition-all duration-200 hover:border-accent/70 hover:shadow-lg hover:shadow-accent/10 group">

      {/* ── Thumbnail section ─────────────────────────────────────── */}
      <div className="relative aspect-video bg-bg overflow-hidden cursor-pointer"
        onClick={() => hasVideo && onPlay(card)}>

        {/* Video thumbnail — try to show first frame */}
        {hasVideo && !thumbErr ? (
          <video
            src={videoThumb}
            className="w-full h-full object-cover"
            muted playsInline preload="metadata"
            onError={() => setThumbErr(true)}
            // Show frame at 0.5s for thumbnail
            onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.5; }}
          />
        ) : queryImgSrc && !imgErr ? (
          /* Fall back to query face photo */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={queryImgSrc}
            alt="Query face photo"
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          /* Last resort — icon placeholder */
          <div className="w-full h-full flex items-center justify-center bg-panel-2">
            <ScanFace className="size-16 text-mute/20"/>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"/>

        {/* Play button */}
        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2 bg-black/75 backdrop-blur-sm rounded-full px-5 py-2.5 text-sm font-semibold border border-white/20">
              <Play className="size-5 fill-white text-white"/> Play Video
            </div>
          </div>
        )}

        {/* Top-left: match count badge */}
        {card.total_matches > 0 && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-accent rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow">
            <Eye className="size-3"/> {card.total_matches}
          </div>
        )}

        {/* Top-right: storage badge */}
        <div className={`absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
          card.has_supabase ? "bg-ok/20 text-ok border border-ok/30" : "bg-panel/80 text-mute border border-edge/50"
        }`}>
          {card.has_supabase
            ? <><CloudIcon className="size-2.5"/> Cloud</>
            : <><HardDrive className="size-2.5"/> Local</>}
        </div>

        {/* Bottom: query photo thumbnail overlay */}
        {queryImgSrc && !imgErr && hasVideo && (
          <div className="absolute bottom-2 left-2 w-10 h-14 rounded overflow-hidden border-2 border-white/40 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={queryImgSrc} alt="Query" className="w-full h-full object-cover" onError={() => {}}/>
          </div>
        )}
      </div>

      {/* ── Card body ─────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Search ID + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display font-bold text-white truncate">{card.search_ref_id}</p>
            <p className="text-xs text-mute flex items-center gap-1 mt-0.5">
              <CalendarDays className="size-3 flex-shrink-0"/>
              {card.created_at}
            </p>
          </div>
          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 ${
            card.status === "completed" ? "bg-ok/15 text-ok" :
            card.status === "failed"    ? "bg-danger/15 text-danger" :
            "bg-accent/15 text-accent animate-pulse"
          }`}>
            {card.status}
          </span>
        </div>

        {/* Source */}
        <div className="flex items-center gap-2 text-xs">
          <Video className="size-3.5 text-mute flex-shrink-0"/>
          <span className="text-mute truncate" title={card.source_name}>
            {card.source_name}
          </span>
        </div>

        {/* Similarity bar */}
        {card.best_similarity > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-mute">Best match similarity</span>
              <span className={`font-semibold tabular-nums ${
                card.best_similarity >= 80 ? "text-ok" :
                card.best_similarity >= 60 ? "text-warn" : "text-danger"
              }`}>{card.best_similarity}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${simColor}`}
                style={{ width: `${card.best_similarity}%` }}
              />
            </div>
          </div>
        )}

        {/* Candidates */}
        <p className="text-xs text-mute">
          {card.total_matches > 0
            ? `${card.total_matches} candidate frame${card.total_matches !== 1 ? "s" : ""} found`
            : "No person matched in this footage"}
        </p>

        {/* ── Action buttons ────────────────────────────────────────── */}
        <div className="flex gap-2 mt-auto">
          {/* Play */}
          <button
            disabled={!hasVideo}
            onClick={() => hasVideo && onPlay(card)}
            className={`btn-primary flex-1 justify-center text-xs py-2 ${!hasVideo ? "opacity-40 cursor-not-allowed" : ""}`}
            title={hasVideo ? "Watch annotated video" : "No video available yet"}
          >
            <Play className="size-3.5 fill-white"/> Play
          </button>

          {/* View details */}
          <button
            onClick={() => hasVideo && onPlay(card)}
            className="btn-ghost text-xs py-2 px-3"
            title="View details"
          >
            <Eye className="size-3.5"/>
          </button>

          {/* Download */}
          {hasVideo && (
            <a
              href={absUrl(card.supabase_video_url || card.video_url)}
              download={`${card.search_ref_id}.mp4`}
              className="btn-ghost text-xs py-2 px-3"
              title="Download video"
            >
              <Download className="size-3.5"/>
            </a>
          )}

          {/* Delete (admin only) */}
          {isAdmin && (
            <button
              onClick={() => onDelete(card.query_id)}
              className="text-xs border border-danger/40 text-danger hover:bg-danger/10 rounded-xl px-2.5 py-2 transition-colors"
              title="Delete result"
            >
              <Trash2 className="size-3.5"/>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function GalleryContent() {
  const { authFetch, isAdmin } = useAuth();
  const params  = useSearchParams();
  const [cards,   setCards]   = useState<GalleryCard[]>([]);
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState(params.get("q") ?? "");
  const [playing, setPlaying] = useState<GalleryCard | null>(null);
  const [toast,   setToast]   = useState("");
  const [tab,     setTab]     = useState<"all"|"cloud"|"local">("all");

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    try {
      const [gr, sr] = await Promise.all([
        authFetch(`${API}/gallery`),
        authFetch(`${API}/gallery/stats/summary`),
      ]);
      if (gr.ok) { const d = await gr.json(); setCards(d.results ?? []); }
      if (sr.ok) setStats(await sr.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteCard = async (id: number) => {
    try {
      const r = await authFetch(`${API}/gallery/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || "Delete failed."); }
      showToast("Deleted.");
      setCards(prev => prev.filter(c => c.query_id !== id));
    } catch (e: any) { showToast(e.message); }
  };

  const shown = cards
    .filter(c => tab === "cloud" ? c.has_supabase : tab === "local" ? !c.has_supabase : true)
    .filter(c => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        c.search_ref_id.toLowerCase().includes(q) ||
        c.source_name.toLowerCase().includes(q) ||
        (c.location || "").toLowerCase().includes(q) ||
        c.created_at.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 glass px-4 py-2.5 text-sm flex items-center gap-2 text-ok shadow-xl">
          <Check className="size-4"/> {toast}
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Search Results Gallery"
        subtitle="All completed person searches with annotated output videos."
        actions={
          <button onClick={load} className="btn-ghost text-sm">
            ↻ Refresh
          </button>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Searches",  value: stats.total_searches,  color: "text-accent" },
            { label: "Completed",       value: stats.completed,       color: "text-ok" },
            { label: "Cloud Storage",   value: stats.in_supabase,     color: "text-cyan" },
            { label: "Matches Found",   value: stats.total_matches,   color: "text-violet" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass p-4">
              <p className="text-xs text-mute">{label}</p>
              <p className={`font-display text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-xl border border-edge/70">
          {(["all","cloud","local"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm transition-colors ${
                tab === t ? "bg-accent text-white" : "bg-panel-2 text-mute hover:text-white"
              }`}>
              {t === "cloud" ? "☁ Cloud" : t === "local" ? "💾 Local" : "All"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-edge bg-panel-2 px-3 py-2 flex-1 max-w-xs">
          <Search className="size-4 text-mute" aria-hidden/>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by ID, source, date…"
            className="w-full bg-transparent text-sm outline-none"/>
        </label>

        <p className="text-xs text-mute ml-auto">
          {shown.length} result{shown.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="aspect-[3/4] glass rounded-2xl"/>)}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          title={cards.length === 0 ? "Gallery is empty" : "No results match"}
          text={
            cards.length === 0
              ? "Run a person search. The annotated output video will appear here automatically."
              : "Clear the search filter or switch to a different tab."
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shown.map(c => (
            <GalleryCard
              key={c.query_id}
              card={c}
              onPlay={setPlaying}
              onDelete={deleteCard}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Video modal */}
      {playing && <VideoPlayer card={playing} onClose={() => setPlaying(null)}/>}
    </div>
  );
}

export default function GalleryPage() {
  return (
    <AppShell>
      <Suspense>
        <GalleryContent/>
      </Suspense>
    </AppShell>
  );
}
