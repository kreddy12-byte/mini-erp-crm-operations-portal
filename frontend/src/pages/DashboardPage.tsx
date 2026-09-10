import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Card } from '../components/ui/Card.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PageSkeleton } from '../components/ui/Skeleton.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useHealth } from '../hooks/useHealth.ts';

export function DashboardPage() {
  const health = useHealth();
  const { user } = useAuth();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Operational overview for customers, inventory, challans, and follow-ups."
      />

      {health.status === 'loading' ? <PageSkeleton /> : null}

      {health.status === 'error' ? (
        <ErrorState
          title="Unable to reach the API"
          description={health.error ?? 'The health endpoint did not respond.'}
          onRetry={health.retry}
        />
      ) : null}

      {health.status === 'success' && health.data ? (
        <div className="space-y-6">
          <Card className="max-w-xl" padding="md">
            <p className="text-caption">API status</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="success">Healthy</Badge>
              <span className="text-secondary">
                {health.data.service} · {health.data.environment}
                {user ? ` · ${user.name} (${user.role})` : ''}
              </span>
            </div>
          </Card>

          <EmptyState
            title="No operational data yet"
            description="Customers, products, inventory, and sales challans are available from the sidebar. Dashboard analytics will appear here after a later phase."
          />
        </div>
      ) : null}
    </div>
  );
}
