export type ProductStockStatus = 'HEALTHY' | 'LOW' | 'CRITICAL';
export type MovementType = 'IN' | 'OUT';
export type ProductSortField = 'name' | 'sku' | 'category' | 'currentStock' | 'unitPrice' | 'updatedAt' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface StockMovementAuthor {
  id: string;
  name: string;
  role: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  quantity: number;
  movementType: MovementType;
  reason: string;
  createdAt: string;
  createdBy: StockMovementAuthor;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: number;
  minStock: number;
  location: string;
  stockStatus: ProductStockStatus;
  createdAt: string;
  updatedAt: string;
  recentMovements?: StockMovement[];
}

export interface InventorySummary {
  total: number;
  healthy: number;
  low: number;
  critical: number;
}

export interface ProductListResponse {
  products: Product[];
  pagination: PaginationMeta;
  categories: string[];
}

export interface InventoryListResponse {
  products: Product[];
  pagination: PaginationMeta;
  categories: string[];
  summary: InventorySummary;
}

export interface ProductListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  location?: string;
  stockStatus?: ProductStockStatus | '';
  sortBy?: ProductSortField;
  sortOrder?: SortOrder;
}

export interface CreateProductRequest {
  name: string;
  sku: string;
  category: string;
  unitPrice: number | string;
  currentStock: number;
  minStock: number;
  location: string;
}

export interface UpdateProductRequest {
  name?: string;
  sku?: string;
  category?: string;
  unitPrice?: number | string;
  minStock?: number;
  location?: string;
}

export interface CreateStockMovementRequest {
  movementType: MovementType;
  quantity: number;
  reason: string;
}

export interface StockMovementResponse {
  product: Product;
  previousStock: number;
  quantity: number;
  movementType: MovementType;
  newStock: number;
  movement: StockMovement;
}

export interface StockMovementListParams {
  page?: number;
  pageSize?: number;
  movementType?: MovementType | '';
  sortOrder?: SortOrder;
}

export interface StockMovementListResponse {
  product: Product;
  movements: StockMovement[];
  pagination: PaginationMeta;
}
