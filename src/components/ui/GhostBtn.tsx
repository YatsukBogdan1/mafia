'use client';

import React, { useState } from 'react';
import { C } from '@/styles/tokens';

export function GhostBtn({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '9px 16px', border: `1px solid ${hov ? C.borderHi : C.border}`,
      borderRadius: 9, background: hov ? C.bgHover : 'transparent',
      color: hov ? C.textSec : C.textMuted,
      fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', ...style,
    }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </button>
  );
}
