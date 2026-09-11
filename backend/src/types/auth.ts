import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  tokenVersion: number;
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

/** Signup returns the same session payload as login. */
export type SignupResult = LoginResult;
