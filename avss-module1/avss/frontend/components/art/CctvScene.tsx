import { Figure } from "./Figure";

export type SceneMode   = "all" | "detection" | "tracking" | "face" | "clothing";
export type ScenePerson = { trackId: number; status: "identified"|"unknown"|"target"; score: number };

const tone = { identified: "#34d399", target: "#f59e0b", unknown: "#f43f5e" } as const;
const xs = [88, 176, 262, 352, 444, 540];
const ys = [300, 262, 328, 276, 338, 288];

export default function CctvScene({
  people, mode, cameraNumber, compact = false,
}: {
  people: ScenePerson[]; mode: SceneMode; cameraNumber: number; compact?: boolean;
}) {
  const shift  = ((cameraNumber * 37) % 40) - 20;
  const show   = (m: SceneMode) => mode === "all" || mode === m;
  const placed = people.slice(0, compact ? 4 : 6).map((p, i) => {
    const baseY = ys[(i + cameraNumber) % ys.length];
    const s = 0.5 + (baseY - 210) / 270;
    return { ...p, x: xs[i % xs.length] + shift, baseY, s };
  });
  const gid = `scene-${cameraNumber}`;

  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Camera view with detected people" className="size-full">
      <defs>
        <linearGradient id={`${gid}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1b3d"/><stop offset="1" stopColor="#14284f"/>
        </linearGradient>
        <linearGradient id={`${gid}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2b4d"/><stop offset="1" stopColor="#0a1226"/>
        </linearGradient>
        <linearGradient id={`${gid}-shop`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c177" stopOpacity=".85"/>
          <stop offset="1" stopColor="#c0603a" stopOpacity=".5"/>
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#5fa8ff" stopOpacity=".35"/>
          <stop offset="1" stopColor="#5fa8ff" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <rect width="640" height="360" fill={`url(#${gid}-wall)`}/>
      {[60,190,320,450,580].map(x=><rect key={x} x={x-26} y="8" width="52" height="7" rx="3" fill="#cfe3ff" opacity=".75"/>)}
      {[24,168,312,456].map((x,i)=>(
        <g key={x}>
          <rect x={x} y="62" width="130" height="104" rx="4" fill={`url(#${gid}-shop)`} opacity={0.55+(i%2)*0.2}/>
          <rect x={x} y="48" width="130" height="14" rx="3" fill="#0a1630" stroke="#2c5aa8"/>
          {[0,1,2].map(k=><rect key={k} x={x+12+k*38} y="86" width="26" height="56" rx="3" fill="#0a0f1f" opacity=".55"/>)}
        </g>
      ))}
      <polygon points="0,170 640,170 640,360 0,360" fill={`url(#${gid}-floor)`}/>
      {[-240,-120,0,120,240,360,480,600,720,840].map(x=>(
        <line key={x} x1={x+320-(x+320-320)*0.18} y1="170" x2={x*1.9-280} y2="360" stroke="#2a4a86" strokeOpacity=".35"/>
      ))}
      {[190,215,250,295,350].map(y=><line key={y} x1="0" y1={y} x2="640" y2={y} stroke="#2a4a86" strokeOpacity=".3"/>)}
      <ellipse cx="320" cy="300" rx="260" ry="46" fill={`url(#${gid}-glow)`}/>

      {placed.map(p=>{
        const left=p.x-30*p.s, top=p.baseY-152*p.s+14*p.s;
        const w=60*p.s, h=152*p.s-14*p.s;
        const c=tone[p.status];
        const fs=Math.max(9,11*p.s);
        return (
          <g key={p.trackId}>
            {show("tracking")&&(
              <g>
                <polyline points={`${p.x-60*p.s},${p.baseY-6} ${p.x-30*p.s},${p.baseY-2} ${p.x},${p.baseY}`} fill="none" stroke={c} strokeWidth="2" strokeDasharray="5 4" opacity=".9"/>
                <circle cx={p.x-60*p.s} cy={p.baseY-6} r="3" fill={c}/>
              </g>
            )}
            <g transform={`translate(${p.x-50*p.s} ${p.baseY-152*p.s}) scale(${p.s})`}><Figure seed={p.trackId}/></g>
            {show("detection")&&(
              <g>
                <rect x={left} y={top} width={w} height={h} fill="none" stroke={c} strokeWidth="2"/>
                <rect x={left} y={top-fs-4} width={fs*7.5} height={fs+4} fill={c}/>
                <text x={left+4} y={top-5} fontSize={fs} fill="#050b1a" fontWeight="600">ID {p.trackId}  {p.score.toFixed(2)}</text>
              </g>
            )}
            {mode==="tracking"&&<text x={p.x} y={top-6} fontSize={fs} fill={c} textAnchor="middle" fontWeight="600">ID {p.trackId}</text>}
            {show("face")&&(
              <g>
                <rect x={p.x-14*p.s} y={p.baseY-152*p.s+18*p.s} width={28*p.s} height={32*p.s} fill="none" stroke="#22d3ee" strokeWidth="2"/>
                <text x={p.x+17*p.s} y={p.baseY-152*p.s+30*p.s} fontSize={fs*0.9} fill="#22d3ee">Face</text>
              </g>
            )}
            {show("clothing")&&(
              <g>
                <rect x={p.x-20*p.s} y={p.baseY-152*p.s+50*p.s} width={40*p.s} height={58*p.s} fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 3"/>
                <text x={p.x+23*p.s} y={p.baseY-152*p.s+70*p.s} fontSize={fs*0.9} fill="#a78bfa">OSNet</text>
              </g>
            )}
          </g>
        );
      })}
      <rect width="640" height="360" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="6"/>
    </svg>
  );
}
