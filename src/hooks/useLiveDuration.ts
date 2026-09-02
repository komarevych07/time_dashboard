import { useEffect, useState } from 'react';

const MINUTE_MS = 60 * 1000;

export function useLiveDuration(statusSince: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, MINUTE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [statusSince]);

  const sinceMs = new Date(statusSince).getTime();
  const durationMs = Math.max(0, now - sinceMs);

  return Math.floor(durationMs / (1000 * 60));
}
