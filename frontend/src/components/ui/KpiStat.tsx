import { cn } from '../../utils/cn.ts';

type KpiTone = 'default' | 'success' | 'warning' | 'danger';

export function KpiStat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: KpiTone;
}) {
  return (
    <div>
      <dt className="text-caption">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-section tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-caption">{hint}</p> : null}
    </div>
  );
}
