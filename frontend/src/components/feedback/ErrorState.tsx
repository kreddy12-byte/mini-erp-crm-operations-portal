import { AlertIcon } from '../../assets/icons.tsx';
import { Button } from '../ui/Button.tsx';

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="max-w-lg">
      <AlertIcon className="mb-3 h-6 w-6 text-danger" />
      <h2 className="text-section">{title}</h2>
      <p className="mt-1 text-secondary">{description}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
