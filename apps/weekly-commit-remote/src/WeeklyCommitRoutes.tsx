import { Route, Routes } from 'react-router-dom';
import { WeeklyCommitApp } from './WeeklyCommitApp.js';

// Phase 2 expands this into nested DraftWeek / Reconcile / Manager routes.
export function WeeklyCommitRoutes() {
  return (
    <Routes>
      <Route path="/*" element={<WeeklyCommitApp />} />
    </Routes>
  );
}

export default WeeklyCommitRoutes;
