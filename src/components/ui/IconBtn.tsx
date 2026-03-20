'use client';

import React, { useState } from 'react';
import { C } from '@/styles/tokens';

export function IconBtn({ children, onClick, title, tint = 'neutral', disabled }: {
  children: React.ReactNode; onClick?: () => void; title?: string;
  tint?: 'amber' | 'red' | 'neutral' | 'green'; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const bg = {
    amber:   hov ? 'rgba(180,90,20,0.55)' : 'rgba(120,60,10,0.4)',
    red:     hov ? 'rgba(153,27,27,0.65)'  : 'rgba(100,20,20,0.4)',
    neutral: hov ? C.bgHover               : 'rgba(255,255,255,0.04)',
    green:   hov ? 'rgba(20,120,60,0.55)'  : 'rgba(10,80,40,0.4)',
  }[tint];
  const color = { amber: '#fbbf24', red: '#f87171', neutral: C.textSec, green: '#4ade80' }[tint];
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 6,
      background: bg, color, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.12s', opacity: disabled ? 0.3 : 1,
    }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </button>
  );
}
