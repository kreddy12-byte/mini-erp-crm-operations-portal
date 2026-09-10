import { api } from './api.ts';
import type { ApiSuccess } from '../types/api.ts';
import type {
  CreateProductRequest,
  Product,
  ProductListParams,
  ProductListResponse,
  UpdateProductRequest,
} from '../types/product.ts';

function toSearchParams(params: ProductListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.search) search.set('search', params.search);
  if (params.category) search.set('category', params.category);
  if (params.location) search.set('location', params.location);
  if (params.stockStatus) search.set('stockStatus', params.stockStatus);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortOrder) search.set('sortOrder', params.sortOrder);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listProducts(params: ProductListParams = {}): Promise<ProductListResponse> {
  const response = await api.get<ApiSuccess<ProductListResponse>>(`/products${toSearchParams(params)}`);
  return response.data.data;
}

export async function getProduct(id: string): Promise<Product> {
  const response = await api.get<ApiSuccess<{ product: Product }>>(`/products/${id}`);
  return response.data.data.product;
}

export async function createProduct(payload: CreateProductRequest): Promise<Product> {
  const response = await api.post<ApiSuccess<{ product: Product }>>('/products', payload);
  return response.data.data.product;
}

export async function updateProduct(id: string, payload: UpdateProductRequest): Promise<Product> {
  const response = await api.patch<ApiSuccess<{ product: Product }>>(`/products/${id}`, payload);
  return response.data.data.product;
}
