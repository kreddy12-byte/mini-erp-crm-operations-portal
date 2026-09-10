import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthBrand } from '../components/auth/AuthBrand.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Input } from '../components/ui/Input.tsx';
import { paths } from '../constants/navigation.ts';
import { requestPasswordReset } from '../services/auth.ts';
import { ApiClientError } from '../types/api.ts';
import { validateEmail } from '../utils/authValidation.ts';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(undefined);
    if (nextEmailError) return;

    setSubmitting(true);
    try {
      const nextMessage = await requestPasswordReset(email.trim());
      setMessage(nextMessage);
    } catch (reason: unknown) {
      setFormError(
        reason instanceof ApiClientError ? reason.message : 'Unable to send a reset email. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthBrand />
      <Card padding="md">
        <h1 className="text-page-title">Forgot password</h1>
        <p className="mt-1 text-secondary">
          Enter the email on your account. If it exists, we will send a reset link.
        </p>

        {message ? (
          <p className="mt-8 text-secondary" role="status">
            {message}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={emailError}
              disabled={submitting}
            />
            {formError ? (
              <p className="text-sm text-danger" role="alert">
                {formError}
              </p>
            ) : null}
            <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-secondary">
          <Link to={paths.login} className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
