export type UserRole = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export interface SignupResult {
  user: AuthUser;
}
