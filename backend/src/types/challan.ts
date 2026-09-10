import type { ChallanStatus } from '@prisma/client';

export type ChallanSortField = 'createdAt' | 'updatedAt' | 'challanNumber' | 'totalQuantity' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface ChallanLineInput {
  productId: string;
  quantity: number;
}

export interface ChallanWriteInput {
  customerId: string;
  items: ChallanLineInput[];
}

export interface ChallanPatchInput {
  customerId?: string;
  items?: ChallanLineInput[];
}

export interface ChallanListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: ChallanStatus;
  customerId?: string;
  sortBy: ChallanSortField;
  sortOrder: SortOrder;
}
