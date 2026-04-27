import { useEffect, useState } from 'react';
import { useGetCurrentWeekQuery } from '../../api/weeksEndpoints.js';
import { DraftWeek } from './DraftWeek.js';
import { LockedWeek } from '../locked/LockedWeek.js';
import { Reconcile } from '../reconcile/Reconcile.js';
import { ReconciledWeek } from '../reconciled/ReconciledWeek.js';

// Top-level shell — switches between DRAFT / LOCKED / RECONCILING / RECONCILED views based on
// week.state from the current-week query.
export function WeekShell() {
  const { data, isLoading } = useGetCurrentWeekQuery();
  // Same StrictMode-driven sticky-loading workaround as ManagerDashboard:
  // force one re-read shortly after mount so a fulfilled cache is picked up.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => force((x) => x + 1), 80);
    return () => clearTimeout(t);
  }, []);

  // Only block on the skeleton if we genuinely have no data yet. Same
  // sticky-isLoading pattern as ManagerDashboard.
  if (isLoading && !data) {
    return (
      <div data-testid="week-shell-loading" className="space-y-4 p-6">
        <div className="h-24 animate-pulse rounded-lg bg-(--color-skeleton-bg)" />
        <div className="h-64 animate-pulse rounded-lg bg-(--color-skeleton-bg)" />
      </div>
    );
  }
  if (!data) {
    return (
      <p data-testid="week-shell-error" className="p-6 text-sm text-(--color-shell-error)">
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
