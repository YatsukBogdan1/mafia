'use client';

import React, { useEffect, useRef, useState } from 'react';
import { C } from '@/styles/tokens';
import { Card, GhostBtn } from '@/components/ui';

export function SpeakingTimer() {
  const [endTime, setEndTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const rafRef = useRef<number>(undefined);

  const start = (duration: number) => setEndTime(Date.now() + duration * 1000);
  const stop = () => { setEndTime(null); setRemaining(0); };

  useEffect(() => {
    if (endTime === null) return;
    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(left);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
      else setEndTime(null);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [endTime]);

  const running = endTime !== null;
  const mins   = Math.floor(remaining / 60000);
  const secs   = Math.floor((remaining % 60000) / 1000);
  const centis = Math.floor((remaining % 1000) / 10);
  const display = `${mins}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
  const urgent = running && remaining <= 10000;

  return (
    <Card style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontFamily: 'var(--font-jetbrains-mono)', fontSize: 28, fontWeight: 600,
        textAlign: 'center', letterSpacing: '0.04em',
        color: urgent ? '#f87171' : C.amber,
        textShadow: `0 0 20px ${urgent ? 'rgba(248,113,113,0.35)' : 'rgba(212,146,58,0.35)'}`,
        transition: 'color 0.3s, text-shadow 0.3s',
      }}>
        {display}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {running ? (
          <GhostBtn onClick={stop} style={{ fontSize: 11, padding: '6px 10px' }}>Stop</GhostBtn>
        ) : (
          <>
            <GhostBtn onClick={() => start(30)} style={{ fontSize: 11, padding: '6px 10px' }}>30s</GhostBtn>
            <GhostBtn onClick={() => start(60)} style={{ fontSize: 11, padding: '6px 10px' }}>1 min</GhostBtn>
          </>
        )}
      </div>
    </Card>
  );
}
