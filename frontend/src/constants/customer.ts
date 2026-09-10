import type { CustomerStatus, CustomerType } from '../types/customer.ts';

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  RETAIL: 'Retail',
  WHOLESALE: 'Wholesale',
  DISTRIBUTOR: 'Distributor',
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  LEAD: 'Lead',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

export function canAccessCrm(role?: string): boolean {
  return role === 'ADMIN' || role === 'SALES';
}
