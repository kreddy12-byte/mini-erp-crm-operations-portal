import type { CustomerStatus, CustomerType, PaginationMeta } from './customer.ts';
import type { UserRole } from './auth.ts';

export type ChallanStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type ChallanSortField = 'createdAt' | 'updatedAt' | 'challanNumber' | 'totalQuantity' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface ChallanCustomer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string;
  customerType: CustomerType;
  status: CustomerStatus;
}

export interface ChallanAuthor {
  id: string;
  name: string;
  role: UserRole;
}

export interface ChallanItem {
  id: string;
  productId: string;
  quantity: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPriceSnapshot: string;
  createdAt: string;
}

export interface Challan {
  id: string;
  challanNumber: string;
  status: ChallanStatus;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
  customer: ChallanCustomer;
  createdBy: ChallanAuthor;
  items: ChallanItem[];
}

export interface ChallanListResponse {
  challans: Challan[];
  pagination: PaginationMeta;
}

export interface ChallanListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ChallanStatus | '';
  customerId?: string;
  sortBy?: ChallanSortField;
  sortOrder?: SortOrder;
}

export interface ChallanLinePayload {
  productId: string;
  quantity: number;
}

export interface ChallanWritePayload {
  customerId: string;
  items: ChallanLinePayload[];
}

export interface ChallanPatchPayload {
  customerId?: string;
  items?: ChallanLinePayload[];
}

export type { PaginationMeta };
