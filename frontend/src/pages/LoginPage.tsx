import { useState } from 'react';
import type { FormEvent } from 'react';
import { APP_NAME, APP_PRODUCT } from '../constants/app.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { ApiClientError } from '../types/api.ts';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Input } from '../components/ui/Input.tsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextEmailError = EMAIL_PATTERN.test(email.trim())
      ? undefined
      : 'Enter a valid email address.';
    const nextPasswordError = password.length > 0 ? undefined : 'Enter your password.';

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError(undefined);

    if (nextEmailError || nextPasswordError) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (reason: unknown) {
      const message =
        reason instanceof ApiClientError
          ? reason.message
          : 'Unable to sign in. Please try again.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
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

      <Card padding="md">
        <h1 className="text-page-title">Sign in</h1>
        <p className="mt-1 text-secondary">Use your operations portal account to continue.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
            disabled={submitting}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
            disabled={submitting}
          />

          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
