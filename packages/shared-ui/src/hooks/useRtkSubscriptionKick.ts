import { useEffect, useState } from 'react';

/**
 * Workaround for an RTK Query / react-redux notify-on-fulfill race we hit in
 * production: the cache resolves but the hook's subscriber never re-reads, so
 * the component sits on `isLoading=true` forever. Calling this hook schedules a
 * single dummy `useState` update 80 ms after mount, which forces a fresh
 * selector pass and surfaces the cached payload. The cleanup tears the timeout
 * down on unmount so a quickly-unmounted component (StrictMode double-mount)
 * never tries to set state on a dead instance.
 */
export function useRtkSubscriptionKick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handle = setTimeout(() => setTick((x) => x + 1), 80);
    return () => clearTimeout(handle);
  }, []);
}
