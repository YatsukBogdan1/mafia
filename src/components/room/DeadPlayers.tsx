'use client';

import React from 'react';
import { C, roleColor, roleLabel, displayName } from '@/styles/tokens';
import { SectionLabel } from '@/components/ui';
import type { ClientUser } from '@/lib/game/types';

export function DeadPlayers({ users }: { users: ClientUser[] }) {
  const dead = users.filter(u => !u.isAlive && u.type !== 'host');
  if (dead.length === 0) return null;
  return (
    <>
      <SectionLabel>Eliminated ({dead.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {dead.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 7,
            background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.04)`,
            opacity: 0.6,
          }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: C.textMuted, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.textMuted, textDecoration: 'line-through' }}>{displayName(u)}</span>
            {u.role && <span style={{ fontSize: 10, color: roleColor(u.role), opacity: 0.7, marginLeft: 'auto', textTransform: 'capitalize' }}>{roleLabel(u.role)}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
