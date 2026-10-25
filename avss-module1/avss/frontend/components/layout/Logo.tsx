export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee"/>
          <stop offset="1" stopColor="#7c5cff"/>
        </linearGradient>
      </defs>
      <path d="M20 3 34 8v11c0 9-6 15.5-14 18C12 34.5 6 28 6 19V8z"
        fill="#0a1630" stroke="url(#logo-g)" strokeWidth="2"/>
      <path d="M10.5 20c3-5 6-7.5 9.5-7.5S26.5 15 29.5 20c-3 5-6 7.5-9.5 7.5S13.5 25 10.5 20z"
        fill="none" stroke="url(#logo-g)" strokeWidth="1.8"/>
      <circle cx="20" cy="20" r="3.6" fill="url(#logo-g)"/>
    </svg>
  );
}

export function Logo({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark/>
      <span>
        <span className="block font-display text-xl font-semibold leading-none">AVSS</span>
        {subtitle && (
          <span className="mt-1 block text-[11px] leading-none text-mute">
            AI-Powered Visual Surveillance System
          </span>
        )}
      </span>
    </span>
  );
}
