export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  return EMAIL_PATTERN.test(value.trim()) ? undefined : 'Enter a valid email address.';
}

export function validateFullName(value: string): string | undefined {
  const name = value.trim();
  if (name.length < 2) return 'Enter your full name.';
  if (name.length > 80) return 'Full name is too long.';
  return undefined;
}

export function validateStrongPassword(password: string): string | undefined {
  if (password.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include a letter and a number.';
  }
  if (password.length > 128) return 'Password is too long.';
  return undefined;
}

export function passwordChecks(password: string) {
  return {
    length: password.length >= 10,
    letter: /[A-Za-z]/.test(password),
    number: /[0-9]/.test(password),
  };
}
