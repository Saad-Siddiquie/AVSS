type FeatureItem = {
  name: string;
  description: string;
  status: string;
};

type Module5WorkflowProps = {
  overview: {
    pipeline_name: string;
    framework: string;
    input_sources: string[];
    features: FeatureItem[];
  } | null;
  error: string | null;
};

export function Module5Workflow({ overview, error }: Module5WorkflowProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Module 5</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Video processing</h2>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          {overview?.framework ?? "OpenCV"}
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {!error && !overview && <p className="mt-4 text-sm text-slate-600">Loading video processing pipeline...</p>}

      {overview && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Pipeline</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{overview.pipeline_name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {overview.input_sources.map((source) => (
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
