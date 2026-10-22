const MAP: Record<string, string> = {
  pending:    "bg-yellow-500/15 text-yellow-300",
  processing: "bg-blue-500/15 text-blue-300 animate-pulse",
  searching:  "bg-blue-500/15 text-blue-300 animate-pulse",
  completed:  "bg-emerald-500/15 text-emerald-300",
  failed:     "bg-rose-500/15 text-rose-300",
  active:     "bg-emerald-500/15 text-emerald-300",
  inactive:   "bg-slate-500/15 text-slate-400",
  admin:      "bg-orange-500/15 text-orange-300",
  user:       "bg-blue-500/15 text-blue-300",
  rtsp:       "bg-blue-500/15 text-blue-300",
  webcam:     "bg-emerald-500/15 text-emerald-300",
  file:       "bg-purple-500/15 text-purple-300",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = MAP[status.toLowerCase()] ?? "bg-slate-700 text-slate-300";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
