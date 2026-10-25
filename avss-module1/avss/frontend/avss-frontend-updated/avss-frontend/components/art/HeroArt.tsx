import { Figure } from "./Figure";

// Illustration for the welcome page: a security camera watching a crowd, with scan brackets on a few people.
export default function HeroArt() {
  const crowd = [
    { x: 40, y: 250, s: 0.9, seed: 12, box: false },
    { x: 118, y: 270, s: 1.05, seed: 7, box: true },
    { x: 198, y: 246, s: 0.85, seed: 3, box: false },
    { x: 264, y: 276, s: 1.1, seed: 21, box: true },
  ];
  return (
    <svg viewBox="0 0 320 340" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Security camera scanning a crowd" className="size-full">
      <defs>
        <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#101d4a" />
          <stop offset="1" stopColor="#1b1457" />
        </linearGradient>
        <radialGradient id="hero-glow" cx=".5" cy=".3" r=".6">
          <stop offset="0" stopColor="#4f8cff" stopOpacity=".55" />
          <stop offset="1" stopColor="#4f8cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity=".4" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hero-cam" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8eefc" />
          <stop offset="1" stopColor="#8fa3cf" />
        </linearGradient>
      </defs>
      <rect width="320" height="340" fill="url(#hero-bg)" />
      <rect width="320" height="340" fill="url(#hero-glow)" />
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1="0" y1={150 + i * 24} x2="320" y2={150 + i * 24} stroke="#3b6bd6" strokeOpacity=".18" />)}
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1={i * 40} y1="150" x2={i * 40 - (160 - i * 40) * 0.6} y2="340" stroke="#3b6bd6" strokeOpacity=".18" />)}

      {/* scan beam */}
      <polygon points="168,92 40,320 300,320" fill="url(#hero-beam)" />

      {/* camera */}
      <g transform="rotate(-18 190 70)">
        <rect x="150" y="18" width="104" height="44" rx="14" fill="url(#hero-cam)" />
        <rect x="236" y="26" width="26" height="28" rx="8" fill="#0a1226" stroke="#22d3ee" strokeWidth="2" />
        <circle cx="249" cy="40" r="7" fill="#22d3ee" />
        <circle cx="249" cy="40" r="3" fill="#e0fbff" />
        <rect x="160" y="62" width="14" height="22" fill="#6b7fae" />
        <rect x="146" y="82" width="42" height="8" rx="3" fill="#6b7fae" />
      </g>

      {crowd.map((p) => (
        <g key={p.seed}>
          <g transform={`translate(${p.x - 50 * p.s} ${p.y - 152 * p.s}) scale(${p.s})`} opacity=".92"><Figure seed={p.seed} /></g>
          {p.box && (
            <g stroke="#22d3ee" strokeWidth="2" fill="none">
              <path d={`M${p.x - 32 * p.s} ${p.y - 128 * p.s + 12}v-12h12M${p.x + 32 * p.s} ${p.y - 128 * p.s + 12}v-12h-12M${p.x - 32 * p.s} ${p.y - 4}v12h12M${p.x + 32 * p.s} ${p.y - 4}v12h-12`} />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
