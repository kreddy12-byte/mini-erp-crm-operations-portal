import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { EyeIcon, EyeOffIcon } from '../../assets/icons.tsx';
import { Input } from '../ui/Input.tsx';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

export function PasswordField({ label, error, hint, disabled, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      label={label}
      type={visible ? 'text' : 'password'}
      error={error}
      hint={hint}
      disabled={disabled}
      trailing={
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      }
      {...props}
    />
  );
}
