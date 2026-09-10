export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export interface HealthData {
  service: string;
  environment: string;
}
