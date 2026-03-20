import { useEffect, useRef, useState } from 'react';

export function useCountdown(endTime: number | null): number {
  const [remaining, setRemaining] = useState(0);
  const rafRef = useRef<number>(undefined);

  useEffect(() => {
    if (endTime === null) { setRemaining(0); return; }
    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(left);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [endTime]);

  return remaining;
}
