import { Outlet } from 'react-router-dom';

/**
 * JWT/RBAC checks will live here in the authentication phase.
 * Phase 1 renders children so the application shell can be developed without fake users.
 */
export function ProtectedRoute() {
  return <Outlet />;
}
