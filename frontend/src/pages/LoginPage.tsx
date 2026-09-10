import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthBrand } from '../components/auth/AuthBrand.tsx';
import { AuthDivider } from '../components/auth/AuthDivider.tsx';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton.tsx';
import { PasswordField } from '../components/auth/PasswordField.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Input } from '../components/ui/Input.tsx';
import { paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { ApiClientError } from '../types/api.ts';
import { validateEmail } from '../utils/authValidation.ts';

export function LoginPage() {
  const { login, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [unverified, setUnverified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextEmailError = validateEmail(email);
    const nextPasswordError = password.length > 0 ? undefined : 'Enter your password.';

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError(undefined);
    setUnverified(false);

    if (nextEmailError || nextPasswordError) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (reason: unknown) {
      const error = reason instanceof ApiClientError ? reason : null;
      setUnverified(error?.code === 'EMAIL_NOT_VERIFIED');
      setFormError(error?.message ?? 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthBrand />

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
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
            disabled={submitting}
          />

          <div className="flex justify-end">
            <Link to={paths.forgotPassword} className="text-sm font-medium text-primary hover:underline">
              Forgot password
            </Link>
          </div>

          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
              {unverified ? (
                <>
                  {' '}
                  <Link
                    to={`${paths.verifyEmail}?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                    className="font-medium text-primary underline"
                  >
                    Resend verification
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <AuthDivider />

        <GoogleSignInButton
          disabled={submitting}
          onCredential={signInWithGoogle}
          onError={setFormError}
        />

        <p className="mt-6 text-center text-sm text-ink-secondary">
          Need an account?{' '}
          <Link to={paths.signup} className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
