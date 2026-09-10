import type { CustomerStatus } from '../../types/customer.ts';
import { Badge } from '../ui/Badge.tsx';
import { followUpUrgency, formatDate } from '../../utils/dates.ts';
import { cn } from '../../utils/cn.ts';
import { CUSTOMER_STATUS_LABELS } from '../../constants/customer.ts';

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const tone = status === 'ACTIVE' ? 'success' : status === 'LEAD' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{CUSTOMER_STATUS_LABELS[status]}</Badge>;
}

export function FollowUpDate({ value }: { value: string | null | undefined }) {
  const urgency = followUpUrgency(value);
  const label =
    urgency === 'overdue' ? 'Overdue' : urgency === 'today' ? 'Due today' : urgency === 'upcoming' ? 'Upcoming' : null;

  return (
    <span className="inline-flex flex-col">
      <span
        className={cn(
          'text-sm',
          urgency === 'overdue' && 'font-medium text-danger',
          urgency === 'today' && 'font-medium text-warning',
          urgency === 'upcoming' && 'text-ink',
          urgency === 'none' && 'text-ink-muted',
        )}
      >
        {formatDate(value)}
      </span>
      {label ? <span className="text-caption">{label}</span> : null}
    </span>
  );
}
