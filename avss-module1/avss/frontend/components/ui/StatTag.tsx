"use client";
import { type MouseEvent } from "react";

interface Props { label: string; value: React.ReactNode; valueClass?: string }

function tilt(e: MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget, r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top)  / r.height - 0.5;
  el.style.transform = `perspective(500px) rotateY(${x*10}deg) rotateX(${-y*10}deg)`;
}

export function StatTag({ label, value, valueClass = "" }: Props) {
  return (
    <div
      className="glass p-4 select-none transition-transform hover:border-accent cursor-default"
      onMouseMove={tilt}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}
    >
      <p className="text-xs text-mute">{label}</p>
      <p className={`font-display text-2xl font-semibold mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}
