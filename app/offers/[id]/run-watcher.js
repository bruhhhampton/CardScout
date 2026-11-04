'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// While the AI works in the background, refresh the page every few seconds so the
// draft and verdict appear on their own. Stops after the run's time limit.
export default function RunWatcher({ startedAt }) {
  const router = useRouter();
  useEffect(() => {
    const stopAt = new Date(startedAt).getTime() + 4 * 60 * 1000;
    const timer = setInterval(() => {
      if (Date.now() > stopAt) clearInterval(timer);
      router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [router, startedAt]);
  return null;
}
