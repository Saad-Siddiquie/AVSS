import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { statusLabel, type PersonStatus } from "@/lib/data";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-mute">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

const badge: Record<PersonStatus, string> = {
  identified: "bg-ok/15 text-ok",
  unknown: "bg-danger/15 text-danger",
  target: "bg-warn/15 text-warn",
};

export function StatusBadge({ status }: { status: PersonStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[status]}`}>{statusLabel[status]}</span>;
}

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-20 text-2xl" } as const;

// Placeholder until the backend returns a cropped face/body image per person.
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof sizes }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const unknown = name.startsWith("Unknown");
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display font-semibold text-white ${sizes[size]}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 50%), hsl(${(hue + 50) % 360} 65% 38%))` }}
    >
      {unknown ? <UserRound className="size-1/2" /> : initials}
    </span>
  );
}

export function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const color = value >= 80 ? "bg-ok" : value >= 65 ? "bg-warn" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-12 shrink-0 text-xs text-mute">{label}</span>}
      <div
        role="meter"
        aria-label={label ?? "Confidence"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2"
      >
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums">{value.toFixed(1)}%</span>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="glass p-10 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-mute">{text}</p>
    </div>
  );
}
