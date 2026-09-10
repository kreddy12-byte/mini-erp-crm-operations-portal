import { api } from './api.ts';
import type { ApiSuccess } from '../types/api.ts';
import type { AuthUser, LoginResult } from '../types/auth.ts';

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const response = await api.post<ApiSuccess<LoginResult>>('/auth/login', { email, password });
  return response.data.data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get<ApiSuccess<{ user: AuthUser }>>('/auth/me');
  return response.data.data.user;
}
