interface Props { value: number; admin?: boolean }

export function ProgressBar({ value, admin = false }: Props) {
  const color = admin ? "bg-warn" : "bg-accent";
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-panel-2"
      role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/>
    </div>
  );
}
