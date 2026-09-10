import { Outlet } from 'react-router-dom';
import { APP_NAME, APP_PRODUCT } from '../constants/app.ts';

export function AuthLayout() {
  return (
    <div className="min-h-svh bg-canvas lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary px-12 py-16 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide">{APP_NAME}</p>
          <p className="mt-1 text-sm text-primary-foreground/70">{APP_PRODUCT}</p>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">Operations, without the clutter.</h1>
          <p className="mt-4 text-sm leading-6 text-primary-foreground/80">
            Sign in to manage customers, inventory, and sales challans from one workspace. Role access is
            enforced by the API, not just the screens you can see.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/55">Secure staff access for the operations portal.</p>
      </aside>

      <main className="flex min-h-svh items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
