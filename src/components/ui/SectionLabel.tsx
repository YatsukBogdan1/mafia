'use client';

import React from 'react';
import { C } from '@/styles/tokens';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.17em',
        textTransform: 'uppercase', color: C.textMuted, whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}
