"use client";

export default function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-edge"}`}>
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`}/>
    </button>
  );
}
