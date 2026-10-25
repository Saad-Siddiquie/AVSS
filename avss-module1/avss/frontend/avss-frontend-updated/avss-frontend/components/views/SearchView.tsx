"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, CloudUpload, ImageIcon, LoaderCircle, Search as SearchIcon, Sparkles } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { PersonThumb } from "@/components/art/Figure";
import { cameras, cameraName, defaultTarget, getPerson, hitsFor, persons } from "@/lib/data";

type Phase = "idle" | "searching" | "done";
type Reference = { kind: "upload"; url: string; name: string } | { kind: "person"; id: string };
type Tab = "upload" | "gallery";

const PAGE_SIZE = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export default function SearchView() {
  const [tab, setTab] = useState<Tab>("upload");
  const [ref, setRef] = useState<Reference | null>(null);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(0.6);
  const [cameraId, setCameraId] = useState("all");
  const [phase, setPhase] = useState<Phase>("idle");
  const [page, setPage] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // Revoke the previous object URL when the reference changes or the page unmounts.
  const uploadUrl = ref?.kind === "upload" ? ref.url : null;
  useEffect(() => () => { if (uploadUrl) URL.revokeObjectURL(uploadUrl); }, [uploadUrl]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (phase === "done") resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [phase]);

  function accept(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) return setError("Use a JPG or PNG image of the person.");
    if (file.size > MAX_BYTES) return setError("That image is over 5 MB. Choose a smaller one.");
    setError("");
    setRef({ kind: "upload", url: URL.createObjectURL(file), name: file.name });
    setPhase("idle");
  }
  const onPick = (e: ChangeEvent<HTMLInputElement>) => accept(e.target.files?.[0]);
  const onDrop = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); accept(e.dataTransfer.files[0]); };

  function choosePerson(id: string) {
    setError("");
    setRef({ kind: "person", id });
    setPhase("idle");
  }

  function runSearch() {
    // Replace with: POST /api/search (multipart: image or personId, cameraId). Scoring below is demo data.
    setPage(1);
    setPhase("searching");
    timer.current = setTimeout(() => setPhase("done"), 900);
  }

  const referencePerson = ref?.kind === "person" ? ref.id : null;
  const all = useMemo(() => hitsFor(referencePerson, cameraId), [referencePerson, cameraId]);
  const hits = useMemo(() => all.filter((h) => h.score >= threshold * 100), [all, threshold]);
  const pages = Math.max(1, Math.ceil(hits.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = hits.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const refLabel = ref?.kind === "upload" ? ref.name : ref?.kind === "person" ? `${getPerson(ref.id)?.name ?? "Person"}` : "";
  const refSeed = ref?.kind === "person" ? (getPerson(ref.id)?.trackId ?? 1) : defaultTarget.trackId;

  return (
    <div className="space-y-6">
      <PageHeader title="Search Person" subtitle="Upload a reference image or pick someone from the gallery to find the person." />

      <section className="glass p-4 sm:p-5" aria-label="Reference">
        <div role="tablist" aria-label="Reference source" className="flex w-fit overflow-hidden rounded-lg border border-edge/70">
          {([["upload", "Upload Image"], ["gallery", "Select from Gallery"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
              className={`px-4 py-2 text-sm transition-colors ${tab === value ? "bg-accent text-white" : "bg-panel-2 text-mute hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_16rem]">
          {tab === "upload" ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="relative grid min-h-64 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-accent/50 bg-panel-2/60 text-center transition-colors hover:border-accent focus-within:border-accent"
            >
              <input type="file" accept="image/jpeg,image/png" onChange={onPick} className="sr-only" />
              {ref?.kind === "upload" ? (
                <span className="flex w-full flex-col items-center gap-2 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.url} alt={`Reference: ${ref.name}`} className="max-h-56 rounded-lg object-contain" />
                  <span className="max-w-full truncate text-xs text-mute">{ref.name}. Click to replace.</span>
                </span>
              ) : (
                <span className="flex flex-col items-center gap-3 p-6">
                  <CloudUpload className="size-12 text-accent" aria-hidden />
                  <span className="text-sm">Drag &amp; drop reference image here</span>
                  <span className="text-xs text-mute">or</span>
                  <span className="btn-primary pointer-events-none inline-flex items-center gap-2 text-sm"><ImageIcon className="size-4" aria-hidden /> Choose File</span>
                  <span className="text-xs text-mute">Supported formats: JPG, PNG (Max 5MB)</span>
                </span>
              )}
            </label>
          ) : (
            <div className="min-h-64">
              <p className="mb-3 text-sm text-mute">Pick the person you want to find. Their best crop becomes the reference.</p>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                {persons.map((p) => {
                  const on = ref?.kind === "person" && ref.id === p.id;
                  return (
                    <li key={p.id}>
                      <button type="button" aria-pressed={on} onClick={() => choosePerson(p.id)}
                        className={`block w-full overflow-hidden rounded-lg border text-left transition-colors ${on ? "border-accent ring-2 ring-accent/60" : "border-edge/60 hover:border-accent"}`}>
                        <PersonThumb seed={p.trackId} alt={p.name} className="aspect-[3/4] w-full" />
                        <span className="block truncate bg-panel-2 px-2 py-1 text-xs">ID {p.trackId}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <aside className="rounded-xl border border-edge/60 bg-panel-2/50 p-3 text-center" aria-label="Example">
            <h2 className="text-sm font-medium">Example</h2>
            <PersonThumb seed={defaultTarget.trackId} alt="Example reference image" className="mx-auto mt-2 aspect-[3/4] w-32 rounded-lg" />
            <p className="mt-2 text-xs text-mute">Reference Image</p>
            <button type="button" onClick={() => { choosePerson(defaultTarget.id); setTab("gallery"); }} className="btn-ghost mt-2 w-full justify-center text-xs">
              <Sparkles className="size-3.5" aria-hidden /> Try the example
            </button>
          </aside>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 grid gap-4 border-t border-edge/50 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="camera" className="text-sm">Camera</label>
            <select id="camera" value={cameraId} onChange={(e) => setCameraId(e.target.value)} className="field mt-1.5">
              <option value="all">All cameras</option>
              {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.zone}</option>)}
            </select>
          </div>
          <p className="text-xs text-mute">{ref ? <>Reference: <span className="text-white">{refLabel}</span></> : "Add a reference image or pick someone to start."}</p>
          <button type="button" className="btn-primary inline-flex items-center justify-center gap-2" disabled={!ref || phase === "searching"} onClick={runSearch}>
            {phase === "searching" ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <SearchIcon className="size-4" aria-hidden />}
            {phase === "searching" ? "Searching" : "Find Person"}
          </button>
        </div>
      </section>

      <section ref={resultsRef} aria-label="Search results" aria-live="polite" className="scroll-mt-4">
        {phase !== "done" ? (
          <EmptyState
            title={phase === "searching" ? "Comparing faces and clothing across cameras" : "No search yet"}
            text={phase === "searching" ? "This usually takes a few seconds." : "Results appear here, ranked by similarity."}
          />
        ) : (
          <div className="glass p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold">Search Results</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-3">
                {ref?.kind === "upload" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ref.url} alt="" className="size-12 rounded-md object-cover" />
                ) : (
                  <PersonThumb seed={refSeed} alt="" className="size-12 rounded-md" />
                )}
                <p className="text-xs text-mute">Reference:<br /><span className="text-sm text-white">{refLabel}</span></p>
              </div>
              <div className="min-w-56 flex-1 sm:max-w-sm">
                <div className="flex justify-between text-xs text-mute">
                  <label htmlFor="threshold">Similarity Threshold</label>
                  <output htmlFor="threshold" className="tabular-nums text-white">{threshold.toFixed(2)}</output>
                </div>
                <input id="threshold" type="range" min={0.3} max={0.99} step={0.01} value={threshold}
                  onChange={(e) => { setThreshold(Number(e.target.value)); setPage(1); }} className="mt-1.5 w-full accent-accent" />
              </div>
            </div>

            {hits.length === 0 ? (
              <div className="mt-5"><EmptyState title="No matches above the threshold" text="Lower the similarity threshold or search all cameras." /></div>
            ) : (
              <>
                <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {shown.map(({ sighting, person, score }, i) => {
                    const best = current === 1 && i === 0;
                    return (
                      <li key={person.id + sighting.time}>
                        <Link href={`/person/${person.id}?t=${sighting.time}`} className={`block overflow-hidden rounded-xl border bg-panel-2 transition-colors hover:border-accent ${best ? "border-ok ring-1 ring-ok/60" : "border-edge/60"}`}>
                          <div className="relative">
                            <PersonThumb seed={person.trackId} alt={`${person.name}, ID ${person.trackId}`} className="aspect-[3/4] w-full" />
                            {best && <span className="absolute left-1.5 top-1.5 rounded bg-ok px-1.5 py-0.5 text-[10px] font-semibold text-bg">Best Match</span>}
                          </div>
                          <div className="p-2.5 text-center">
                            <p className={`font-display text-lg font-semibold ${score >= 80 ? "text-ok" : "text-white"}`}>{score.toFixed(1)}%</p>
                            <p className="text-xs text-mute">{cameraName(sighting.cameraId)}</p>
                            <p className="text-xs text-mute">{sighting.time}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-mute">Showing {shown.length} of {hits.length} results</p>
                  <nav aria-label="Results pages" className="flex items-center gap-1">
                    <button type="button" className="btn-ghost px-2 py-1.5" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page"><ChevronLeft className="size-4" aria-hidden /></button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === current ? "page" : undefined}
                        className={`size-8 rounded-md text-sm ${n === current ? "bg-accent text-white" : "bg-panel-2 text-mute hover:text-white"}`}>{n}</button>
                    ))}
                    <button type="button" className="btn-ghost px-2 py-1.5" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page"><ChevronRight className="size-4" aria-hidden /></button>
                  </nav>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
