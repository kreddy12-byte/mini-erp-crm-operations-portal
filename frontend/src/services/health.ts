import { api } from './api.ts';
import type { ApiSuccess, HealthData } from '../types/api.ts';

export async function getHealth(): Promise<HealthData> {
  const response = await api.get<ApiSuccess<HealthData>>('/health');
  return response.data.data;
}
