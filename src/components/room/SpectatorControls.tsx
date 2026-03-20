'use client';

import React from 'react';
import { C, roleColor, roleLabel, displayName } from '@/styles/tokens';
import { Card, SectionLabel } from '@/components/ui';
import type { ClientGameState } from '@/lib/game/types';

export function SpectatorControls({ gameState }: { gameState: ClientGameState }) {
  const { users, userOrder, phase } = gameState;
  const gameUsers = (userOrder.length > 0
    ? userOrder.map(id => users[id]).filter(Boolean)
    : Object.values(users)
  ).filter(u => u.type === 'player');

  const spectators = Object.values(users).filter(u => u.type === 'spectator');

  return (
    <>
      <div style={{ padding: '20px 0 8px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 20,
          background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: C.textMuted,
          textTransform: 'uppercase',
        }}>
          Spectating
        </div>
      </div>

      <SectionLabel>Players</SectionLabel>
      <Card style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {gameUsers.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 6px', borderRadius: 6,
            background: !u.isAlive ? 'rgba(0,0,0,0.2)' : 'transparent',
            opacity: u.isAlive ? 1 : 0.5,
          }}>
            <span style={{ fontSize: 12, color: u.isAlive ? C.text : C.textMuted }}>
              {displayName(u)}
              {!u.isAlive && <span style={{ marginLeft: 6, fontSize: 10, color: C.textMuted }}>✕</span>}
            </span>
            {u.role && (
              <span style={{ fontSize: 10, color: roleColor(u.role), fontWeight: 600, letterSpacing: '0.05em' }}>
                {roleLabel(u.role)}
              </span>
            )}
          </div>
        ))}
        {gameUsers.length === 0 && phase.type === 'lobby' && (
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: '4px 0' }}>
            Waiting for game to start…
          </div>
        )}
      </Card>

      {spectators.length > 0 && (
        <>
          <SectionLabel>Spectators</SectionLabel>
          <Card style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {spectators.map(u => (
              <div key={u.id} style={{ fontSize: 12, color: C.textMuted, padding: '3px 6px' }}>
                {u.name}
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
