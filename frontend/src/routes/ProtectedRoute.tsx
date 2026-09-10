import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { PageSkeleton } from '../components/ui/Skeleton.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { paths } from '../constants/navigation.ts';

export function AuthRestoreScreen({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        {error ? (
          <ErrorState
            title="Unable to restore session"
            description={error}
            onRetry={onRetry}
          />
        ) : (
          <PageSkeleton />
        )}
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { status, restoreError, retryRestore } = useAuth();
  const location = useLocation();

  if (status === 'restoring') {
    return <AuthRestoreScreen error={restoreError} onRetry={retryRestore} />;
  }

  if (status !== 'authenticated') {
    return <Navigate to={paths.login} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { status, restoreError, retryRestore } = useAuth();

  if (status === 'restoring') {
    return <AuthRestoreScreen error={restoreError} onRetry={retryRestore} />;
  }

  if (status === 'authenticated') {
    return <Navigate to={paths.dashboard} replace />;
  }

  return <Outlet />;
}
