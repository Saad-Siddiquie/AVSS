"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize2, Search, Video, X } from "lucide-react";
import { ConfidenceBar } from "@/components/ui";
import { FaceThumb, PersonThumb } from "@/components/art/Figure";
import { cameraName, cameraZone, fused, type Person, type Sighting } from "@/lib/data";

function FullImage({ person, onClose }: { person: Person; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={`Full image of ID ${person.trackId}`}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-edge bg-panel p-3 text-white backdrop:bg-black/70">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">ID {person.trackId}</p>
        <button type="button" onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close"><X className="size-4" aria-hidden /></button>
      </div>
      <PersonThumb seed={person.trackId} alt={`${person.name}, full body`} className="aspect-[5/8] w-full rounded-lg" />
    </dialog>
  );
}

export default function PersonDetailView({ person, path }: { person: Person; path: Sighting[] }) {
  const params = useSearchParams();
  const wanted = params.get("t");
  const start = Math.max(0, path.findIndex((s) => s.time === wanted));
  const [index, setIndex] = useState(start);
  const [full, setFull] = useState(false);

  const s = path[index];
  const matched = person.status !== "unknown";
  const combined = s ? fused(s) : 0;
  const camerasVisited = new Set(path.map((p) => p.cameraId)).size;

  return (
    <div className="space-y-6">
      <Link href="/gallery" className="inline-flex items-center gap-2 text-sm text-mute hover:text-white">
        <ArrowLeft className="size-4" aria-hidden /> Back to gallery
      </Link>

      <section className="glass p-4 sm:p-6" aria-labelledby="person-title">
        <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
          <div>
            <PersonThumb seed={person.trackId} alt={`${person.name}, full body`} className="aspect-[3/4] w-full rounded-xl" />
            {path.length > 1 && (
              <ul className="mt-3 flex gap-2" aria-label="Other sightings">
                {path.slice(0, 4).map((p, i) => (
                  <li key={p.time}>
                    <button type="button" onClick={() => setIndex(i)} aria-pressed={i === index} aria-label={`Sighting at ${p.time} on ${cameraName(p.cameraId)}`}
                      className={`block overflow-hidden rounded-md border ${i === index ? "border-accent ring-2 ring-accent/60" : "border-edge/60"}`}>
                      <PersonThumb seed={person.trackId + i} className="aspect-[3/4] w-12" />
                    </button>
                  </li>
                ))}
                {path.length > 4 && <li className="grid w-12 place-items-center rounded-md bg-panel-2 text-xs text-mute">+{path.length - 4}</li>}
              </ul>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-4">
              <FaceThumb seed={person.trackId} alt={`${person.name}, face`} className="size-16 shrink-0 rounded-lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 id="person-title" className="font-display text-2xl font-semibold">Person ID: {person.trackId}</h1>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${matched ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{matched ? "Matched" : "Unknown"}</span>
                </div>
                <p className="text-sm text-mute">{person.name}</p>
                {s && <p className="mt-0.5 text-sm">Confidence: <span className="font-semibold">{combined.toFixed(1)}%</span></p>}
              </div>
            </div>

            {person.note && <p className="mt-4 text-sm text-mute">{person.note}</p>}

            {s ? (
              <>
                <div className="mt-5 max-w-lg space-y-2.5">
                  {s.face !== null ? <ConfidenceBar label="Face" value={s.face} /> : <p className="text-xs text-mute">No face visible. Matched by clothing only.</p>}
                  <ConfidenceBar label="Clothing" value={s.body} />
                  <ConfidenceBar label="Combined" value={combined} />
                </div>
                <p className="mt-1 text-xs text-mute">Face = ArcFace similarity, Clothing = OSNet similarity, Combined = weighted fusion.</p>

                <dl className="mt-5 max-w-lg divide-y divide-edge/40 rounded-xl border border-edge/60 bg-panel-2/50 px-4 text-sm">
                  {[["Camera ID", cameraName(s.cameraId)], ["Time", s.time], ["Location", cameraZone(s.cameraId)]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-mute">{k}</dt><dd className="font-medium">{v}</dd></div>
                  ))}
                </dl>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setFull(true)}><Maximize2 className="size-4" aria-hidden /> View Full Image</button>
                  <Link href={`/live?camera=${s.cameraId}`} className="btn-ghost"><Video className="size-4" aria-hidden /> View in Video</Link>
                  <Link href="/search" className="btn-ghost"><Search className="size-4" aria-hidden /> Search for this person</Link>
                </div>
              </>
            ) : (
              <p className="mt-5 text-sm text-mute">No sightings yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="glass p-4 sm:p-6" aria-labelledby="path">
        <h2 id="path" className="font-display text-base font-semibold">Camera Path</h2>
        <p className="text-sm text-mute">
          {path.length ? `${path.length} sightings across ${camerasVisited} ${camerasVisited === 1 ? "camera" : "cameras"}. Select one to see its scores above.` : "No sightings yet."}
        </p>
        <ol className="mt-5 space-y-4 border-l border-edge pl-6">
          {path.map((p, i) => (
            <li key={p.time} className="relative">
              <span className={`absolute -left-[1.85rem] top-2 size-2.5 rounded-full ring-4 ring-panel ${i === index ? "bg-accent" : "bg-cyan"}`} aria-hidden />
              <button type="button" onClick={() => { setIndex(i); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-current={i === index ? "true" : undefined}
                className="block w-full rounded-lg p-1 text-left transition-colors hover:bg-panel-2">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{cameraName(p.cameraId)} <span className="font-normal text-mute">{cameraZone(p.cameraId)}</span></span>
                  <time className="text-xs text-mute">{p.time}</time>
                </span>
                <span className="mt-2 block max-w-sm"><ConfidenceBar label="Match" value={fused(p)} /></span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {full && <FullImage person={person} onClose={() => setFull(false)} />}
    </div>
  );
}
