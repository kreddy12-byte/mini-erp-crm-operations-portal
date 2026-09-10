export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
export type CustomerStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE';
export type FollowUpFilter = 'overdue' | 'dueToday' | 'upcoming' | 'none';
export type CustomerSortField = 'createdAt' | 'updatedAt' | 'name' | 'businessName' | 'followUpDate';
export type SortOrder = 'asc' | 'desc';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface CustomerFollowUpAuthor {
  id: string;
  name: string;
  role: string;
}

export interface CustomerFollowUp {
  id: string;
  customerId: string;
  note: string;
  followUpDate: string;
  createdAt: string;
  createdBy: CustomerFollowUpAuthor;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string;
  gstNumber: string | null;
  customerType: CustomerType;
  address: string;
  status: CustomerStatus;
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  latestFollowUpAt: string | null;
  followUps?: CustomerFollowUp[];
}

export interface CustomerListResponse {
  customers: Customer[];
  pagination: PaginationMeta;
}

export interface CustomerListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CustomerStatus | '';
  customerType?: CustomerType | '';
  followUp?: FollowUpFilter | '';
  sortBy?: CustomerSortField;
  sortOrder?: SortOrder;
}

export interface CustomerWritePayload {
  name: string;
  mobile: string;
  email?: string;
  businessName?: string;
  gstNumber?: string;
  customerType: CustomerType;
  address?: string;
  status: CustomerStatus;
  followUpDate?: string;
  notes?: string;
}

export interface CustomerUpdatePayload {
  name?: string;
  mobile?: string;
  email?: string | null;
  businessName?: string;
  gstNumber?: string | null;
  customerType?: CustomerType;
  address?: string;
  status?: CustomerStatus;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface CreateFollowUpPayload {
  note: string;
  followUpDate?: string;
}
