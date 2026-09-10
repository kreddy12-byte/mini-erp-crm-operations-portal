import type { UserRole } from '../types/auth.ts';
import type { ChallanStatus } from '../types/challan.ts';

export const CHALLAN_STATUS_LABELS: Record<ChallanStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

export function canManageChallans(role?: UserRole): boolean {
  return role === 'ADMIN' || role === 'SALES';
}

export function canViewCustomersForChallans(role?: UserRole): boolean {
  return role === 'ADMIN' || role === 'SALES';
}
