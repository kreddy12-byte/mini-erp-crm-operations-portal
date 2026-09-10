import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthBrand } from '../components/auth/AuthBrand.tsx';
import { PasswordField } from '../components/auth/PasswordField.tsx';
import { PasswordStrength } from '../components/auth/PasswordStrength.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { paths } from '../constants/navigation.ts';
import { resetPassword } from '../services/auth.ts';
import { ApiClientError } from '../types/api.ts';
import { validateStrongPassword } from '../utils/authValidation.ts';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(!token);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || invalidToken) return;

    const nextPasswordError = validateStrongPassword(password);
    const nextConfirmError =
      confirmPassword === password ? undefined : 'Password confirmation does not match.';
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    setFormError(undefined);
    if (nextPasswordError || nextConfirmError) return;

    setSubmitting(true);
    try {
      const message = await resetPassword({ token, password, confirmPassword });
      setSuccess(message);
    } catch (reason: unknown) {
      if (reason instanceof ApiClientError && reason.code === 'INVALID_TOKEN') {
        setInvalidToken(true);
        return;
      }
      setFormError(
        reason instanceof ApiClientError ? reason.message : 'Unable to update the password. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthBrand />
      <Card padding="md">
        <h1 className="text-page-title">Reset password</h1>

        {success ? (
          <>
            <p className="mt-2 text-secondary" role="status">
              {success}
            </p>
            <Link
              to={paths.login}
              className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : invalidToken ? (
          <>
            <p className="mt-2 text-secondary" role="alert">
              This reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Link
              to={paths.forgotPassword}
              className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Request a new reset link
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-secondary">Choose a new password for your account.</p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
              <PasswordField
                label="New password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={passwordError}
                disabled={submitting}
              />
              <PasswordStrength password={password} />
              <PasswordField
                label="Confirm password"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                error={confirmError}
                disabled={submitting}
              />
              {formError ? (
                <p className="text-sm text-danger" role="alert">
                  {formError}
                </p>
              ) : null}
              <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
                Update password
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
