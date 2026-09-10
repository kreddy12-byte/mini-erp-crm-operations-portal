import { Link } from 'react-router-dom';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';

export function CrmPage() {
  const { user } = useAuth();
  const canCustomers = user?.role === 'ADMIN' || user?.role === 'SALES';

  return (
    <div>
      <PageHeader
        title="CRM / Follow-ups"
        description="A dedicated pipeline view will land here in a later phase. Follow-up dates, notes, and activity already live on each customer record."
      />
      <EmptyState
        title="CRM pipeline is not enabled yet"
        description="Use Customers to review overdue, due-today, and upcoming follow-ups. This page will become the dedicated CRM workspace without changing those existing records."
        action={
          canCustomers ? (
            <Link to={paths.customers}>
              <Button>Open customers</Button>
            </Link>
          ) : (
            <p className="text-caption">Customer records are available to Admin and Sales roles.</p>
          )
        }
      />
    </div>
  );
}
