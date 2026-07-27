type AlertItem = {
  id: number;
  title: string;
  zone: string;
  severity: string;
  description: string;
  status: string;
};

type Module4WorkflowProps = {
  overview: {
    workflow_status: string;
    queue_size: number;
    active_alerts: number;
    resolved_today: number;
    alerts: AlertItem[];
  } | null;
  error: string | null;
};

export function Module4Workflow({ overview, error }: Module4WorkflowProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Module 4</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Intelligence workflow</h2>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          {overview?.workflow_status ?? "Standby"}
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      {!error && !overview && <p className="mt-4 text-sm text-slate-600">Loading workflow data...</p>}

      {overview && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Queue size</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.queue_size}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Active alerts</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.active_alerts}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Resolved today</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.resolved_today}</p>
            </div>
          </div>

          <div className="space-y-3">
            {overview.alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{alert.title}</h3>
                    <p className="text-sm text-slate-600">{alert.zone} • {alert.description}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    {alert.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">{alert.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
