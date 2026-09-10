const STORAGE_KEY = 'mini-erp-crm.accessToken';

export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

export function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable; callers still clear in-memory auth state.
  }
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}
