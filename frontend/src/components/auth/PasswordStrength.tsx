import { passwordChecks } from '../../utils/authValidation.ts';

export function PasswordStrength({ password }: { password: string }) {
  const checks = passwordChecks(password);
  const passed = [checks.length, checks.letter, checks.number].filter(Boolean).length;

  if (!password) {
    return null;
  }

  const tone = passed === 3 ? 'bg-success' : passed === 2 ? 'bg-warning' : 'bg-danger';
  const label = passed === 3 ? 'Strong enough' : passed === 2 ? 'Almost there' : 'Too weak';

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${index < passed ? tone : 'bg-line'}`}
          />
        ))}
      </div>
      <p className="text-caption">
        {label}. Use at least 10 characters with a letter and a number.
      </p>
      <ul className="space-y-1 text-caption">
        <Rule ok={checks.length} label="At least 10 characters" />
        <Rule ok={checks.letter} label="Contains a letter" />
        <Rule ok={checks.number} label="Contains a number" />
      </ul>
    </div>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? 'text-success' : 'text-ink-muted'}>
      {ok ? '✓' : '○'} {label}
    </li>
  );
}
