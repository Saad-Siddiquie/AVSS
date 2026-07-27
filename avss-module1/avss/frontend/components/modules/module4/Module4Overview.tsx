type Module4CardProps = {
  title: string;
  description: string;
  badge: string;
};

export function Module4Overview({ title, description, badge }: Module4CardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Module 4
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          {badge}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </section>
  );
}
