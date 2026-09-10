import { useCallback, useEffect, useState } from 'react';
import { getHealth } from '../services/health.ts';
import { ApiClientError, type HealthData } from '../types/api.ts';

interface HealthState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: HealthData | null;
  error: string | null;
  retry: () => void;
}

export function useHealth(): HealthState {
  const [status, setStatus] = useState<HealthState['status']>('loading');
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    setRequestId((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const message =
          reason instanceof ApiClientError
            ? reason.message
            : 'Unable to reach the API.';
        setError(message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  return { status, data, error, retry };
}
