"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play, ScanEye, Route, ScanFace, Shirt, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PersonThumb } from "@/components/art/Figure";
import CctvScene, { type SceneMode } from "@/components/art/CctvScene";
import { cameras, cameraNumber, detectionsFor, statusLabel } from "@/lib/data";

const modes: { value: SceneMode; label: string; icon: typeof ScanEye }[] = [
  { value: "detection", label: "Detection", icon: ScanEye },
  { value: "tracking", label: "Tracking", icon: Route },
  { value: "face", label: "Face", icon: ScanFace },
  { value: "clothing", label: "Clothing (OSNet)", icon: Shirt },
  { value: "all", label: "All", icon: Layers },
];

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function useClock(running: boolean) {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    setNow(stamp(new Date()));
    if (!running) return;
    const t = setInterval(() => setNow(stamp(new Date())), 1000);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

export default function LiveView() {
  const params = useSearchParams();
  const initial = cameras.find((c) => c.id === params.get("camera"))?.id ?? "c03";
  const [cameraId, setCameraId] = useState(initial);
  const [mode, setMode] = useState<SceneMode>("detection");
  const [paused, setPaused] = useState(false);
  const now = useClock(!paused);

  const camera = cameras.find((c) => c.id === cameraId)!;
  const num = cameraNumber(cameraId);
  const detected = useMemo(() => detectionsFor(cameraId), [cameraId]);
  const people = useMemo(() => detected.map((d) => ({ trackId: d.person.trackId, status: d.person.status, score: d.score })), [detected]);
  const online = cameras.filter((c) => c.status === "online").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Monitoring"
        subtitle={`${online} of ${cameras.length} cameras online. Real-time person detection and tracking.`}
        actions={
          <button type="button" className="btn-ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />} {paused ? "Resume feeds" : "Pause feeds"}
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <section className="glass p-3 sm:p-4" aria-labelledby="cam-title">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 id="cam-title" className="font-display text-base font-semibold">{camera.name} - {camera.zone}</h2>
            <span className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${paused ? "bg-mute/20 text-mute" : "bg-danger text-white"}`}>
              <span className={`size-1.5 rounded-full bg-current ${paused ? "" : "motion-safe:animate-pulse"}`} aria-hidden /> {paused ? "PAUSED" : "LIVE"}
            </span>
            <time className="ml-auto text-xs tabular-nums text-mute" suppressHydrationWarning>{now}</time>
          </div>

          <div className="aspect-video overflow-hidden rounded-xl border border-edge/70 bg-bg">
            {/* Replace CctvScene with your stream: <video>, an MJPEG <img> or a WebRTC player, and draw boxes from /api/cameras/{id}/detections */}
            <CctvScene people={people} mode={mode} cameraNumber={num} />
          </div>

          <div role="group" aria-label="Overlay" className="mt-3 flex flex-wrap gap-2">
            {modes.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${mode === value ? "border-accent bg-accent/25 text-white" : "border-edge/70 bg-panel-2 text-mute hover:text-white"}`}>
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </section>

        <section className="glass p-4" aria-labelledby="det-title">
          <h2 id="det-title" className="font-display text-base font-semibold">Detected Persons</h2>
          <ul className="mt-3 space-y-2">
            {detected.map(({ person, score }) => (
              <li key={person.id}>
                <Link href={`/person/${person.id}`} className="flex items-center gap-3 rounded-lg bg-panel-2 p-2 transition-colors hover:ring-1 hover:ring-accent">
                  <PersonThumb seed={person.trackId} alt="" className="size-11 shrink-0 rounded-md" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">ID {person.trackId}</span>
                    <span className="block text-xs text-mute">{statusLabel[person.status]}</span>
                  </span>
                  <span className="text-sm tabular-nums">{score.toFixed(2)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="all-cams">
        <h2 id="all-cams" className="mb-3 font-display text-base font-semibold">All Cameras</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {cameras.map((c) => {
            const d = detectionsFor(c.id, 4).map((x) => ({ trackId: x.person.trackId, status: x.person.status, score: x.score }));
            const active = c.id === cameraId;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setCameraId(c.id)} aria-pressed={active} aria-label={`Open ${c.name}, ${c.zone}`}
                  className={`block w-full overflow-hidden rounded-lg border text-left transition-colors ${active ? "border-accent ring-2 ring-accent/60" : "border-edge/60 hover:border-accent"}`}>
                  <span className="block aspect-video bg-bg"><CctvScene people={d} mode="detection" cameraNumber={cameraNumber(c.id)} compact /></span>
                  <span className="flex items-center justify-between gap-2 bg-panel-2 px-2 py-1 text-xs">
                    <span className="truncate">{c.name}</span>
                    <span className="flex items-center gap-1 text-ok"><span className="size-1.5 rounded-full bg-ok" aria-hidden /> {c.status === "online" ? "Online" : "Offline"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
