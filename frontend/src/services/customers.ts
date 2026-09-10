import { api } from './api.ts';
import type { ApiSuccess } from '../types/api.ts';
import type {
  CreateFollowUpPayload,
  Customer,
  CustomerFollowUp,
  CustomerListParams,
  CustomerListResponse,
  CustomerUpdatePayload,
  CustomerWritePayload,
} from '../types/customer.ts';

function toSearchParams(params: CustomerListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.search) search.set('search', params.search);
  if (params.status) search.set('status', params.status);
  if (params.customerType) search.set('customerType', params.customerType);
  if (params.followUp) search.set('followUp', params.followUp);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortOrder) search.set('sortOrder', params.sortOrder);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listCustomers(params: CustomerListParams = {}): Promise<CustomerListResponse> {
  const response = await api.get<ApiSuccess<CustomerListResponse>>(`/customers${toSearchParams(params)}`);
  return response.data.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await api.get<ApiSuccess<{ customer: Customer }>>(`/customers/${id}`);
  return response.data.data.customer;
}

export async function createCustomer(payload: CustomerWritePayload): Promise<Customer> {
  const response = await api.post<ApiSuccess<{ customer: Customer }>>('/customers', payload);
  return response.data.data.customer;
}

export async function updateCustomer(id: string, payload: CustomerUpdatePayload): Promise<Customer> {
  const response = await api.patch<ApiSuccess<{ customer: Customer }>>(`/customers/${id}`, payload);
  return response.data.data.customer;
}

export async function listCustomerFollowUps(id: string): Promise<CustomerFollowUp[]> {
  const response = await api.get<ApiSuccess<{ followUps: CustomerFollowUp[] }>>(`/customers/${id}/follow-ups`);
  return response.data.data.followUps;
}

export async function createCustomerFollowUp(
  id: string,
  payload: CreateFollowUpPayload,
): Promise<CustomerFollowUp> {
  const response = await api.post<ApiSuccess<{ followUp: CustomerFollowUp }>>(
    `/customers/${id}/follow-ups`,
    payload,
  );
  return response.data.data.followUp;
}
