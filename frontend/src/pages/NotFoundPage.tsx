import { Link } from 'react-router-dom';
import { paths } from '../constants/navigation.ts';
import { Button } from '../components/ui/Button.tsx';

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-canvas px-4">
      <p className="text-caption">404</p>
      <h1 className="mt-2 text-page-title">Page not found</h1>
      <p className="mt-1 max-w-md text-center text-secondary">
        The route you opened is not part of the operations portal.
      </p>
      <Link to={paths.dashboard} className="mt-6">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
