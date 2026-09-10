import { Badge } from '../ui/Badge.tsx';
import { CHALLAN_STATUS_LABELS } from '../../constants/challan.ts';
import type { ChallanStatus } from '../../types/challan.ts';

export function ChallanStatusBadge({ status }: { status: ChallanStatus }) {
  const tone = status === 'CONFIRMED' ? 'success' : status === 'CANCELLED' ? 'neutral' : 'warning';
  return <Badge tone={tone}>{CHALLAN_STATUS_LABELS[status]}</Badge>;
}
