import { useEffect, useState } from 'react';

/**
 * Workaround for an RTK Query / react-redux notify-on-fulfill race we hit in
 * production: the cache resolves but the hook's subscriber never re-reads, so
 * the component sits on `isLoading=true` forever. Calling this hook schedules
 * three staggered dummy `useState` updates (80 ms / 600 ms / 1.5 s) after
 * mount, each forcing a fresh selector pass. The first kick covers fast
 * cache-hit re-mounts (persona switches), the later two cover the case where
 * the network request is still in flight when the component first mounts (the
 * auto-IC-login race). Cleanup tears every pending timeout down on unmount so
 * StrictMode double-mounts never set state on a dead instance.
 */
const KICK_DELAYS_MS = [80, 600, 1500];

export function useRtkSubscriptionKick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handles = KICK_DELAYS_MS.map((delay) =>
      setTimeout(() => setTick((x) => x + 1), delay),
    );
    return () => {
      for (const h of handles) clearTimeout(h);
    };
  }, []);
}
