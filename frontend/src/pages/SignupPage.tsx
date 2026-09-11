import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthBrand } from '../components/auth/AuthBrand.tsx';
import { AuthDivider } from '../components/auth/AuthDivider.tsx';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton.tsx';
import { PasswordField } from '../components/auth/PasswordField.tsx';
import { PasswordStrength } from '../components/auth/PasswordStrength.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Input } from '../components/ui/Input.tsx';
import { paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { signupWithPassword } from '../services/auth.ts';
import { ApiClientError } from '../types/api.ts';
import { validateEmail, validateFullName, validateStrongPassword } from '../utils/authValidation.ts';

export function SignupPage() {
  const navigate = useNavigate();
  const { establishSession, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = {
      name: validateFullName(name),
      email: validateEmail(email),
      password: validateStrongPassword(password),
      confirmPassword: confirmPassword === password ? undefined : 'Password confirmation does not match.',
    };
    setErrors(nextErrors);
    setFormError(undefined);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await signupWithPassword({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      establishSession(result);
      navigate(paths.dashboard, { replace: true });
    } catch (reason: unknown) {
      setFormError(
        reason instanceof ApiClientError ? reason.message : 'Unable to create the account. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthBrand />
      <Card padding="md">
        <h1 className="text-page-title">Create your account</h1>
        <p className="mt-1 text-secondary">Self-registered users join as Sales. Privileged roles are assigned internally.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <Input
            label="Full name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            disabled={submitting}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            disabled={submitting}
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            disabled={submitting}
          />
          <PasswordStrength password={password} />
          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={errors.confirmPassword}
            disabled={submitting}
          />

          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <AuthDivider />

        <GoogleSignInButton
          disabled={submitting}
          onCredential={signInWithGoogle}
          onError={setFormError}
        />

        <p className="mt-6 text-center text-sm text-ink-secondary">
          Already have an account?{' '}
          <Link to={paths.login} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
