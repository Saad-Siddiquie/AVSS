const metrics = [
  { label: "Detection Queue", value: "24" },
  { label: "Active Alerts", value: "6" },
  { label: "Resolved Cases", value: "18" },
];

export function Module4Metrics() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {metrics.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-sm text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
