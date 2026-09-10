import { api } from './api.ts';
import type { ApiSuccess } from '../types/api.ts';
import type { AuthUser, LoginResult, SignupResult } from '../types/auth.ts';

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const response = await api.post<ApiSuccess<LoginResult>>('/auth/login', { email, password });
  return response.data.data;
}

export async function signupWithPassword(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<SignupResult> {
  const response = await api.post<ApiSuccess<SignupResult>>('/auth/signup', input);
  return response.data.data;
}

export async function loginWithGoogle(idToken: string): Promise<LoginResult> {
  const response = await api.post<ApiSuccess<LoginResult>>('/auth/google', { idToken });
  return response.data.data;
}

export async function verifyEmailToken(token: string): Promise<LoginResult> {
  const response = await api.post<ApiSuccess<LoginResult>>('/auth/verify-email', { token });
  return response.data.data;
}

export async function resendVerificationEmail(email: string): Promise<string> {
  const response = await api.post<ApiSuccess<{ sent: boolean }>>('/auth/resend-verification', { email });
  return response.data.message;
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await api.post<ApiSuccess<{ sent: boolean }>>('/auth/forgot-password', { email });
  return response.data.message;
}

export async function resetPassword(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<string> {
  const response = await api.post<ApiSuccess<{ updated: boolean }>>('/auth/reset-password', input);
  return response.data.message;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get<ApiSuccess<{ user: AuthUser }>>('/auth/me');
  return response.data.data.user;
}
