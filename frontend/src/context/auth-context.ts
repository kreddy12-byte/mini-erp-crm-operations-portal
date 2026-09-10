import { createContext } from 'react';
import type { AuthUser } from '../types/auth.ts';

export type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  restoreError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  retryRestore: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
