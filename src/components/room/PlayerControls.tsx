'use client';

import React from 'react';
import { C, roleColor, displayName } from '@/styles/tokens';
import { Card, SectionLabel, GhostBtn } from '@/components/ui';
import { PlayerVoting } from './PlayerVoting';
import type { ClientGameState, GameAction, PlayerRole } from '@/lib/game/types';

export function PlayerControls({
  gameState, myUserId, myRole, sendPlayerAction,
}: {
  gameState: ClientGameState;
  myUserId: string;
  myRole: PlayerRole | null;
  sendPlayerAction: (a: GameAction) => void;
}) {
  const { phase, users, vote, speaking } = gameState;
  const me = users[myUserId];

  return (
    <>
      {/* Role */}
      {myRole && (
        <Card style={{ padding: '14px 16px', textAlign: 'center', borderColor: `${roleColor(myRole)}30`, borderLeft: `3px solid ${roleColor(myRole)}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 4 }}>
            Your Role
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: roleColor(myRole), textTransform: 'capitalize', letterSpacing: '0.04em' }}>
            {myRole}
          </div>
        </Card>
      )}

      {/* Become host (lobby only) */}
      {phase.type === 'lobby' && (
        <GhostBtn onClick={() => sendPlayerAction({ type: 'become_host', userId: myUserId })}>
          Become Host
        </GhostBtn>
      )}

      {/* Phase / round */}
      <div style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, padding: '4px 0' }}>
        {phase.type === 'lobby' && 'Waiting for host to start…'}
        {phase.type === 'game' && (
          <span style={{ fontFamily: 'var(--font-jetbrains-mono)', letterSpacing: '0.06em' }}>
            Round {gameState.round}
          </span>
        )}
        {phase.type === 'gameover' && (
          <span style={{ color: phase.winner === 'mafia' ? '#f87171' : '#4ade80' }}>
            Game over — {phase.winner} win!
          </span>
        )}
      </div>

      {/* Eliminated notice */}
      {me && !me.isAlive && (
        <Card style={{
          padding: '12px 16px', textAlign: 'center',
          background: 'rgba(153,27,27,0.12)', borderColor: 'rgba(153,27,27,0.3)',
        }}>
          <div style={{ fontSize: 16, marginBottom: 4 }}>💀</div>
          <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 500 }}>You have been eliminated</div>
        </Card>
      )}

      {/* Speaking indicator */}
      {speaking.unmutedUsers.includes(myUserId) && (
        <Card style={{
          padding: '10px 16px', textAlign: 'center',
          background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)',
        }}
          className="animate-pulse-ring">
          <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 500 }}>You have the mic 🎤</div>
        </Card>
      )}

      {/* Voting */}
      {me?.isAlive && phase.type === 'game' && vote.nominees.length > 0 && (
        <PlayerVoting gameState={gameState} myUserId={myUserId} sendPlayerAction={sendPlayerAction} />
      )}

      {/* Mafia teammates */}
      {(myRole === 'mafia' || myRole === 'don') && (
        <>
          <SectionLabel>Mafia Team</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.values(users)
              .filter(u => u.type === 'player' && (u.role === 'mafia' || u.role === 'don') && u.id !== myUserId)
              .map(u => (
                <div key={u.id} style={{
                  padding: '7px 10px', borderRadius: 7, fontSize: 12,
                  background: C.bgSurface, border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${roleColor(u.role)}`,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ color: C.text }}>{displayName(u)}</span>
                  <span style={{ fontSize: 10, color: roleColor(u.role), marginLeft: 'auto', textTransform: 'capitalize' }}>{u.role}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </>
  );
}
