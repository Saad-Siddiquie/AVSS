// Stylised person figures used until the backend returns real face and body crops.
import type { CSSProperties } from "react";

const jackets = ["#1f2937","#273a5c","#4b5d3a","#7a2d3b","#c9b79c","#2f6f73","#3a3f4f","#8a5a2b"];
const pants   = ["#11182b","#3a3a42","#6b5b45","#243b55"];
const skins   = ["#f0c8a0","#d9a577","#b97f55","#8a5a3b"];
const hairs   = ["#0b0b0f","#2a1a10","#4a3220","#6a5a48"];
const bags    = ["#0f172a","#334155","#7c2d12","#1e3a8a"];

export function look(seed: number) {
  const n = Math.abs(Math.round(seed)) + 3;
  return {
    jacket: jackets[(n * 5) % jackets.length],
    pants:  pants[(n * 3)  % pants.length],
    skin:   skins[(n * 7)  % skins.length],
    hair:   hairs[(n * 11) % hairs.length],
    bag:    n % 3 === 0 ? bags[n % bags.length] : null,
    hood:   n % 2 === 0,
  };
}

export function Figure({ seed }: { seed: number }) {
  const l = look(seed);
  return (
    <g>
      {l.bag && <rect x="62" y="56" width="18" height="34" rx="6" fill={l.bag} />}
      <rect x="36" y="104" width="12" height="46" rx="4" fill={l.pants} />
      <rect x="52" y="104" width="12" height="46" rx="4" fill={l.pants} />
      <rect x="33" y="146" width="16" height="7"  rx="3.5" fill="#06080f" />
      <rect x="51" y="146" width="16" height="7"  rx="3.5" fill="#06080f" />
      <rect x="23" y="54"  width="10" height="46" rx="5"   fill={l.jacket} />
      <rect x="67" y="54"  width="10" height="46" rx="5"   fill={l.jacket} />
      <rect x="30" y="50"  width="40" height="58" rx="12"  fill={l.jacket} />
      <rect x="45" y="43"  width="10" height="11" rx="3"   fill={l.skin} />
      <ellipse cx="50" cy="33" rx="12" ry="14" fill={l.skin} />
      <path d="M38 31c0-8 5-12 12-12s12 4 12 12c-4-6-8-8-12-8s-8 2-12 8z" fill={l.hair} />
      {l.hood && <path d="M36 52c4-6 9-8 14-8s10 2 14 8l-4 4c-3-3-6-4-10-4s-7 1-10 4z" fill={l.jacket} stroke="#00000033" />}
    </g>
  );
}

const frame: CSSProperties = { width:"100%", height:"100%", display:"block" };

function Backdrop({ id, seed }: { id: string; seed: number }) {
  const hue = 215 + ((Math.abs(seed) * 17) % 40);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 40% 20%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 45% 9%)`} />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  );
}

type ThumbProps = { seed: number; src?: string; alt?: string; className?: string };

export function PersonThumb({ seed, src, alt = "", className = "" }: ThumbProps) {
  const id = `bg-b-${seed}`;
  return (
    <div className={`overflow-hidden bg-panel-2 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <svg viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt || "Person crop"} style={frame}>
          <Backdrop id={id} seed={seed} />
          <ellipse cx="50" cy="153" rx="30" ry="4" fill="#00000066" />
          <Figure seed={seed} />
        </svg>
      )}
    </div>
  );
}

export function FaceThumb({ seed, src, alt = "", className = "" }: ThumbProps) {
  const l = look(seed);
  const id = `bg-f-${seed}`;
  return (
    <div className={`overflow-hidden bg-panel-2 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt || "Face crop"} style={frame}>
          <Backdrop id={id} seed={seed + 5} />
          <rect x="8" y="72" width="84" height="40" rx="22" fill={l.jacket} />
          <rect x="41" y="58" width="18" height="18" rx="6" fill={l.skin} />
          <ellipse cx="50" cy="40" rx="22" ry="26" fill={l.skin} />
          <path d="M28 38c0-16 9-24 22-24s22 8 22 24c-6-10-13-14-22-14s-16 4-22 14z" fill={l.hair} />
          <circle cx="42" cy="42" r="2.2" fill="#1b1b22" />
          <circle cx="58" cy="42" r="2.2" fill="#1b1b22" />
          <path d="M43 54q7 5 14 0" stroke="#7a3b2e" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
