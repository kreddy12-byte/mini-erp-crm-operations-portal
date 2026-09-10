import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-4 py-10">
      <Outlet />
    </div>
  );
}
