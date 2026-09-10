import type { CustomerStatus, CustomerType } from '@prisma/client';

export type CustomerSortField = 'createdAt' | 'updatedAt' | 'name' | 'businessName' | 'followUpDate';
export type SortOrder = 'asc' | 'desc';
export type FollowUpFilter = 'overdue' | 'dueToday' | 'upcoming' | 'none';

export interface CustomerListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: CustomerStatus;
  customerType?: CustomerType;
  followUp?: FollowUpFilter;
  sortBy: CustomerSortField;
  sortOrder: SortOrder;
}

export interface CustomerWriteInput {
  name: string;
  mobile: string;
  email?: string;
  businessName: string;
  gstNumber?: string;
  customerType: CustomerType;
  address: string;
  status: CustomerStatus;
  followUpDate?: Date;
  notes?: string;
}

export interface CustomerPatchInput {
  name?: string;
  mobile?: string;
  email?: string | null;
  businessName?: string;
  gstNumber?: string | null;
  customerType?: CustomerType;
  address?: string;
  status?: CustomerStatus;
  followUpDate?: Date | null;
  notes?: string | null;
}

export interface CreateFollowUpInput {
  note: string;
  followUpDate?: Date;
}
