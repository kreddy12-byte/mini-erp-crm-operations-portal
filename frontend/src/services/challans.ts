import { api } from './api.ts';
import type { ApiSuccess } from '../types/api.ts';
import type {
  Challan,
  ChallanListParams,
  ChallanListResponse,
  ChallanPatchPayload,
  ChallanWritePayload,
} from '../types/challan.ts';

function toSearchParams(params: ChallanListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.search) search.set('search', params.search);
  if (params.status) search.set('status', params.status);
  if (params.customerId) search.set('customerId', params.customerId);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortOrder) search.set('sortOrder', params.sortOrder);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listChallans(params: ChallanListParams = {}): Promise<ChallanListResponse> {
  const response = await api.get<ApiSuccess<ChallanListResponse>>(`/challans${toSearchParams(params)}`);
  return response.data.data;
}

export async function getChallan(id: string): Promise<Challan> {
  const response = await api.get<ApiSuccess<{ challan: Challan }>>(`/challans/${id}`);
  return response.data.data.challan;
}

export async function createChallan(payload: ChallanWritePayload): Promise<Challan> {
  const response = await api.post<ApiSuccess<{ challan: Challan }>>('/challans', payload);
  return response.data.data.challan;
}

export async function updateChallan(id: string, payload: ChallanPatchPayload): Promise<Challan> {
  const response = await api.patch<ApiSuccess<{ challan: Challan }>>(`/challans/${id}`, payload);
  return response.data.data.challan;
}

export async function confirmChallan(id: string): Promise<Challan> {
  const response = await api.post<ApiSuccess<{ challan: Challan }>>(`/challans/${id}/confirm`);
  return response.data.data.challan;
}

export async function cancelChallan(id: string): Promise<Challan> {
  const response = await api.post<ApiSuccess<{ challan: Challan }>>(`/challans/${id}/cancel`);
  return response.data.data.challan;
}
