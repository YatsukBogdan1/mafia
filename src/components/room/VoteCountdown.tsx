'use client';

import React, { useEffect, useRef, useState } from 'react';
import { C } from '@/styles/tokens';

export function VoteCountdown({ deadline, onExpiredChange }: { deadline: number; onExpiredChange?: (e: boolean) => void }) {
  const [remaining, setRemaining] = useState(0);
  const rafRef = useRef<number>(undefined);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      onExpiredChange?.(left <= 0);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [deadline, onExpiredChange]);

  const secs   = Math.floor(remaining / 1000);
  const centis = Math.floor((remaining % 1000) / 10);
  const urgent = remaining <= 3000;

  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{
        fontFamily: 'var(--font-jetbrains-mono)', fontSize: 24, fontWeight: 600,
        color: urgent ? '#f87171' : C.amber,
        textShadow: `0 0 16px ${urgent ? 'rgba(248,113,113,0.4)' : 'rgba(212,146,58,0.4)'}`,
        transition: 'color 0.3s, text-shadow 0.3s',
      }}>
        {secs}.{String(centis).padStart(2, '0')}s
      </span>
    </div>
  );
}
