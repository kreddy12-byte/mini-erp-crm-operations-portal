import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthBrand } from '../components/auth/AuthBrand.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Input } from '../components/ui/Input.tsx';
import { paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { resendVerificationEmail, verifyEmailToken } from '../services/auth.ts';
import { ApiClientError } from '../types/api.ts';
import { validateEmail } from '../utils/authValidation.ts';

type VerifyState = 'idle' | 'verifying' | 'success' | 'invalid';

export function VerifyEmailPage() {
  const { establishSession } = useAuth();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);
  const presetEmail = useMemo(() => params.get('email')?.trim() ?? '', [params]);
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'idle');
  const [email, setEmail] = useState(presetEmail);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [tokenError, setTokenError] = useState<string | undefined>();
  const [resendMessage, setResendMessage] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    verifyEmailToken(token)
      .then((result) => {
        if (cancelled) return;
        establishSession(result);
        setState('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setState('invalid');
        setTokenError(
          reason instanceof ApiClientError ? reason.message : 'This verification link is invalid or has expired.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, establishSession]);

  async function onResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(undefined);
    setResendMessage(undefined);
    if (nextEmailError) return;

    setSubmitting(true);
    try {
      setResendMessage(await resendVerificationEmail(email.trim()));
    } catch (reason: unknown) {
      setFormError(
        reason instanceof ApiClientError ? reason.message : 'Unable to send a verification email. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthBrand />
      <Card padding="md">
        <h1 className="text-page-title">Verify email</h1>

        {state === 'verifying' ? (
          <p className="mt-2 text-secondary">Confirming your email address…</p>
        ) : null}

        {state === 'success' ? (
          <>
            <p className="mt-2 text-secondary" role="status">
              Your email is verified. You are signed in.
            </p>
            <Link
              to={paths.dashboard}
              className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Continue to dashboard
            </Link>
          </>
        ) : null}

        {state === 'invalid' ? (
          <p className="mt-2 text-secondary" role="alert">
            {tokenError ?? 'This verification link is invalid, expired, or has already been used.'}
          </p>
        ) : null}

        {state !== 'verifying' && state !== 'success' ? (
          <>
            <p className="mt-2 text-secondary">
              Enter the email on your account if you need a new verification link.
            </p>
            <form onSubmit={onResend} className="mt-8 space-y-4" noValidate>
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
              {resendMessage ? (
                <p className="text-sm text-secondary" role="status">
                  {resendMessage}
                </p>
              ) : null}
              <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
                Resend verification
              </Button>
            </form>
          </>
        ) : null}

        <p className="mt-6 text-center text-sm text-ink-secondary">
          <Link to={paths.login} className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
