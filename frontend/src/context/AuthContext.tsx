import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiClientError } from '../types/api.ts';
import type { AuthUser } from '../types/auth.ts';
import { fetchCurrentUser, loginWithGoogle, loginWithPassword } from '../services/auth.ts';
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '../services/authSession.ts';
import { AuthContext, type AuthStatus } from './auth-context.ts';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAccessToken() ? 'restoring' : 'unauthenticated',
  );
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setRestoreError(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
      setRestoreError(null);
      setStatus('unauthenticated');
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    let cancelled = false;

    fetchCurrentUser()
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        setRestoreError(null);
        setStatus('authenticated');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiClientError && reason.status === 401) {
          clearSession();
          return;
        }
        setRestoreError(
          reason instanceof ApiClientError
            ? reason.message
            : 'Unable to restore the signed-in session.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [restoreAttempt, clearSession]);

  const establishSession = useCallback((result: { token: string; user: AuthUser }) => {
    setAccessToken(result.token);
    setUser(result.user);
    setRestoreError(null);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginWithPassword(email, password);
      establishSession(result);
    },
    [establishSession],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const result = await loginWithGoogle(idToken);
      establishSession(result);
    },
    [establishSession],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const retryRestore = useCallback(() => {
    setRestoreError(null);
    setStatus('restoring');
    setRestoreAttempt((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ user, status, restoreError, login, signInWithGoogle, establishSession, logout, retryRestore }),
    [user, status, restoreError, login, signInWithGoogle, establishSession, logout, retryRestore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
