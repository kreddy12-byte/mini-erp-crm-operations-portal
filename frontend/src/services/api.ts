import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiClientError, type ApiErrorPayload } from '../types/api.ts';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  // Future phase: read the JWT from session storage and set Authorization.
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    const status = error.response?.status ?? 0;
    const code = error.response?.data?.error?.code ?? 'NETWORK_ERROR';
    const message =
      error.response?.data?.error?.message ??
      'Unable to reach the API. Check that the backend is running.';

    return Promise.reject(new ApiClientError(status, code, message));
  },
);
