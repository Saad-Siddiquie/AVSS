type FeatureItem = {
  name: string;
  description: string;
  status: string;
};

type Module6WorkflowProps = {
  overview: {
    model_name: string;
    task: string;
    input_types: string[];
    features: FeatureItem[];
  } | null;
  error: string | null;
};

export function Module6Workflow({ overview, error }: Module6WorkflowProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Module 6</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Person detection</h2>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          {overview?.model_name ?? "YOLOv8"}
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {!error && !overview && <p className="mt-4 text-sm text-slate-600">Loading detection module...</p>}

      {overview && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Detection task</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{overview.task}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {overview.input_types.map((source) => (
                <span key={source} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm">
                  {source}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {overview.features.map((feature) => (
              <div key={feature.name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{feature.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {feature.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
