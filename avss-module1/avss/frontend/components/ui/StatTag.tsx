"use client";

import { type MouseEvent } from "react";

interface Props {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}

function tilt(e: MouseEvent<HTMLDivElement>) {
  const el  = e.currentTarget;
  const r   = el.getBoundingClientRect();
  const x   = (e.clientX - r.left) / r.width  - 0.5;
  const y   = (e.clientY - r.top)  / r.height - 0.5;
  el.style.transform = `perspective(500px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
}

export function StatTag({ label, value, valueClass = "" }: Props) {
  return (
    <div
      className="avss-tag p-4 select-none"
      onMouseMove={tilt}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}
    >
      <div className="text-xs font-semibold text-black/60">{label}</div>
      <div className={`text-2xl font-bold mt-1 text-slate-950 ${valueClass}`}>{value}</div>
    </div>
  );
}
