export type StockStatus = 'HEALTHY' | 'LOW' | 'CRITICAL';
export type MovementType = 'IN' | 'OUT';
export type ProductSortField = 'name' | 'sku' | 'category' | 'currentStock' | 'unitPrice' | 'updatedAt' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface ProductListQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  location?: string;
  stockStatus?: StockStatus;
  sortBy: ProductSortField;
  sortOrder: SortOrder;
}

export interface ProductWriteInput {
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: number;
  minStock: number;
  location: string;
}

export interface ProductPatchInput {
  name?: string;
  sku?: string;
  category?: string;
  unitPrice?: string;
  minStock?: number;
  location?: string;
}

export interface StockMovementInput {
  movementType: MovementType;
  quantity: number;
  reason: string;
}

export interface MovementListQuery {
  page: number;
  pageSize: number;
  movementType?: MovementType;
  sortOrder: SortOrder;
}
