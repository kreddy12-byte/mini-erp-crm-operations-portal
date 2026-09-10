import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiClientError, type ApiErrorPayload } from '../types/api.ts';
import {
  clearAccessToken,
  getAccessToken,
  notifyUnauthorized,
} from './authSession.ts';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    const status = error.response?.status ?? 0;
    const requestUrl = error.config?.url ?? '';
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (status === 401 && !isLoginRequest) {
      clearAccessToken();
      notifyUnauthorized();
    }

    const code = error.response?.data?.error?.code ?? 'NETWORK_ERROR';
    const message =
      error.response?.data?.error?.message ??
      'Unable to reach the API. Check that the backend is running.';

    return Promise.reject(new ApiClientError(status, code, message));
  },
);
