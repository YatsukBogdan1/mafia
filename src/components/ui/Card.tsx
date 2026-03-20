'use client';

import React from 'react';
import { C } from '@/styles/tokens';

export function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: C.bgSurface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      ...style,
    }}>
      {children}
    </div>
  );
}
