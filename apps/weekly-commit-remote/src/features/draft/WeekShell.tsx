import { useGetCurrentWeekQuery } from '../../api/weeksEndpoints.js';
import { DraftWeek } from './DraftWeek.js';
import { LockedWeek } from '../locked/LockedWeek.js';
import { Reconcile } from '../reconcile/Reconcile.js';
import { ReconciledWeek } from '../reconciled/ReconciledWeek.js';

// Top-level shell — switches between DRAFT / LOCKED / RECONCILING / RECONCILED views based on
// week.state from the current-week query.
export function WeekShell() {
  const { data, isLoading, error } = useGetCurrentWeekQuery();

  if (isLoading) {
    return (
      <p data-testid="week-shell-loading" className="p-6 text-sm text-(--shell-muted)">
        Loading current week…
      </p>
    );
  }
  if (error || !data) {
    return (
      <p data-testid="week-shell-error" className="p-6 text-sm text-(--shell-error)">
        Could not load the current week.
      </p>
    );
  }

  switch (data.state) {
    case 'DRAFT':
      return <DraftWeek week={data} />;
    case 'LOCKED':
      return <LockedWeek week={data} />;
    case 'RECONCILING':
      return <Reconcile week={data} />;
    case 'RECONCILED':
      return <ReconciledWeek week={data} />;
    default:
      return null;
  }
}
