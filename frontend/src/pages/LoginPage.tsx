import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME, APP_PRODUCT } from '../constants/app.ts';
import { paths } from '../constants/navigation.ts';
import { useToast } from '../hooks/useToast.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';

export function LoginPage() {
  const { pushToast } = useToast();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushToast({
      title: 'Authentication is not enabled yet',
      description: 'JWT sign-in will be introduced in a later phase.',
      tone: 'info',
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-md" />
        <div>
          <p className="text-sm font-semibold text-ink">{APP_NAME}</p>
          <p className="text-caption">{APP_PRODUCT}</p>
        </div>
      </div>

      <h1 className="text-page-title">Sign in</h1>
      <p className="mt-1 text-secondary">
        Credential checks are intentionally disabled until the authentication phase.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>

      <p className="mt-6 text-secondary">
        Continue without an account?{' '}
        <Link to={paths.dashboard} className="font-medium text-primary hover:text-primary-hover">
          Open the workspace
        </Link>
      </p>
    </div>
  );
}
