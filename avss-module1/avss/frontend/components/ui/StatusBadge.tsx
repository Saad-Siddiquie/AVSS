const MAP: Record<string, string> = {
  pending:    "bg-warn/15 text-warn",
  processing: "bg-accent/15 text-accent animate-pulse",
  searching:  "bg-accent/15 text-accent animate-pulse",
  completed:  "bg-ok/15 text-ok",
  failed:     "bg-danger/15 text-danger",
  active:     "bg-ok/15 text-ok",
  inactive:   "bg-mute/15 text-mute",
  admin:      "bg-warn/15 text-warn",
  user:       "bg-accent/15 text-accent",
  rtsp:       "bg-accent/15 text-accent",
  webcam:     "bg-ok/15 text-ok",
  file:       "bg-violet/15 text-violet",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = MAP[status?.toLowerCase()] ?? "bg-mute/15 text-mute";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
