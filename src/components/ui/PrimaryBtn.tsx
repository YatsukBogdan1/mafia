'use client';

import React, { useState } from 'react';
import { C } from '@/styles/tokens';

export function PrimaryBtn({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '11px 16px', border: 'none', borderRadius: 9,
      background: hov ? C.crimsonDk : C.crimson, color: 'white',
      fontSize: 13, fontWeight: 600, letterSpacing: '0.03em', cursor: 'pointer',
      transition: 'background 0.15s', ...style,
    }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </button>
  );
}
