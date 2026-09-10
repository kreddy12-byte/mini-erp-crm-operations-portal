import { api } from './api.ts';
import type { ApiSuccess } from '../types/api.ts';
import type {
  CreateStockMovementRequest,
  InventoryListResponse,
  ProductListParams,
  StockMovementListParams,
  StockMovementListResponse,
  StockMovementResponse,
} from '../types/product.ts';

function toSearchParams(params: ProductListParams | StockMovementListParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listInventory(params: ProductListParams = {}): Promise<InventoryListResponse> {
  const response = await api.get<ApiSuccess<InventoryListResponse>>(`/inventory${toSearchParams(params)}`);
  return response.data.data;
}

export async function listStockMovements(
  productId: string,
  params: StockMovementListParams = {},
): Promise<StockMovementListResponse> {
  const response = await api.get<ApiSuccess<StockMovementListResponse>>(
    `/inventory/${productId}/movements${toSearchParams(params)}`,
  );
  return response.data.data;
}

export async function createStockMovement(
  productId: string,
  payload: CreateStockMovementRequest,
): Promise<StockMovementResponse> {
  const response = await api.post<ApiSuccess<StockMovementResponse>>(
    `/inventory/${productId}/movements`,
    payload,
  );
  return response.data.data;
}
