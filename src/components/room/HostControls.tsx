'use client';

import React, { useState } from 'react';
import { C, roleColor, roleLabel, displayName } from '@/styles/tokens';
import { Card, SectionLabel, PrimaryBtn, GhostBtn, IconBtn } from '@/components/ui';
import { RoomSettingsModal } from './RoomSettingsModal';
import { SpeakingTimer } from './SpeakingTimer';
import { DeadPlayers } from './DeadPlayers';
import { VotingControls } from './VotingControls';
import type { ClientGameState, GameAction } from '@/lib/game/types';

export function HostControls({
  gameState, sendHostAction,
}: {
  gameState: ClientGameState;
  sendHostAction: (a: GameAction) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const { phase, users, vote, speaking, round, userOrder, settings } = gameState;
  const aliveUsers = (userOrder.length > 0
    ? userOrder.map(id => users[id]).filter(Boolean)
    : Object.values(users)
  ).filter(u => u.isAlive && u.type === 'player');
  const inGame = phase.type === 'game';

  const aliveOrder = userOrder.filter(id => users[id]?.isAlive && users[id]?.type === 'player');
  const suggestedSpeakerId = inGame && aliveOrder.length > 0 ? aliveOrder[(round - 1) % aliveOrder.length] : null;
  const suggestedSpeaker = suggestedSpeakerId ? users[suggestedSpeakerId] : null;

  return (
    <>
      {/* Lobby */}
      {phase.type === 'lobby' && (() => {
        const lobbyUsers = Object.values(users).filter(u => u.type !== 'host');
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {showSettings && (
              <RoomSettingsModal
                settings={settings}
                playerCount={lobbyUsers.length}
                onSave={s => sendHostAction({ type: 'update_settings', settings: s })}
                onClose={() => setShowSettings(false)}
              />
            )}
            <div style={{ padding: '20px 0 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
                {lobbyUsers.length} player{lobbyUsers.length !== 1 ? 's' : ''} in lobby
              </p>
            </div>
            {lobbyUsers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lobbyUsers.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', background: C.bgSurface,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 12, color: C.text }}>{u.name}</span>
                    <IconBtn tint="red" title="Kick" onClick={() => sendHostAction({ type: 'kick_player', userId: u.id })}>×</IconBtn>
                  </div>
                ))}
              </div>
            )}
            <GhostBtn onClick={() => setShowSettings(true)} style={{ fontSize: 12 }}>
              Room Settings · {settings.votingTimeoutMs / 1000}s vote
            </GhostBtn>
            <PrimaryBtn onClick={() => sendHostAction({ type: 'start_game' })}>
              Start Game
            </PrimaryBtn>
          </div>
        );
      })()}

      {/* Game Over */}
      {phase.type === 'gameover' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card style={{ padding: '14px 16px', textAlign: 'center', border: `1px solid ${phase.winner === 'mafia' ? '#b91c1c40' : '#16a34a40'}` }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>
              {phase.winner === 'mafia' ? '🔴' : '🟢'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: phase.winner === 'mafia' ? '#f87171' : '#4ade80' }}>
              {phase.winner === 'mafia' ? 'Mafia wins' : 'Villagers win'}
            </div>
          </Card>
          <PrimaryBtn onClick={() => sendHostAction({ type: 'reset_game' })} style={{ background: C.bgSurface, border: `1px solid ${C.border}`, color: C.textSec }}>
            Back to Lobby
          </PrimaryBtn>
        </div>
      )}

      {/* In Game */}
      {inGame && (
        <>
          {/* Assign Roles (before roles are distributed) */}
          {userOrder.length > 0 && users[userOrder[0]]?.role === null && (
            <PrimaryBtn onClick={() => sendHostAction({ type: 'assign_roles' })}>
              Assign Roles
            </PrimaryBtn>
          )}

          {/* Round */}
          <SectionLabel>Round</SectionLabel>
          <Card style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: 22, fontWeight: 700, color: C.text }}>{round}</span>
                {suggestedSpeaker && (
                  <span style={{ fontSize: 11, color: C.amber }}>
                    · {displayName(suggestedSpeaker)} speaks first
                  </span>
                )}
              </div>
            </div>
            <GhostBtn onClick={() => sendHostAction({ type: 'next_round' })} style={{ width: 'auto', padding: '6px 12px', fontSize: 11 }}>
              Next Round
            </GhostBtn>
          </Card>

          {/* Mic controls */}
          <SectionLabel>Microphone</SectionLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            <GhostBtn onClick={() => sendHostAction({ type: 'mute_all' })} style={{ fontSize: 11, padding: '7px 10px' }}>
              Mute All
            </GhostBtn>
            <GhostBtn onClick={() => sendHostAction({ type: 'unmute_all' })} style={{ fontSize: 11, padding: '7px 10px' }}>
              Unmute All
            </GhostBtn>
          </div>

          {/* Timer */}
          <SectionLabel>Timer</SectionLabel>
          <SpeakingTimer />

          {/* Players */}
          <SectionLabel>Players ({aliveUsers.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {aliveUsers.map(u => {
              const isSpeaking = speaking.unmutedUsers.includes(u.id);
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  background: isSpeaking ? 'rgba(34,197,94,0.06)' : C.bgSurface,
                  border: `1px solid ${isSpeaking ? 'rgba(34,197,94,0.25)' : C.border}`,
                  borderLeft: `3px solid ${roleColor(u.role)}`,
                  borderRadius: 8,
                  transition: 'all 0.2s',
                  ...(isSpeaking ? { boxShadow: '0 0 0 0 rgba(34,197,94,0.4)', animation: 'pulse-ring 2s ease-out infinite' } : {}),
                }}>
                  <span style={{
                    fontFamily: 'var(--font-jetbrains-mono)', fontSize: 11,
                    color: roleColor(u.role), minWidth: 18, fontWeight: 600,
                  }}>
                    {u.seatNumber ?? '—'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.name}
                    </div>
                    {u.role && (
                      <div style={{ fontSize: 10, color: roleColor(u.role), opacity: 0.8, textTransform: 'capitalize' }}>
                        {roleLabel(u.role)}
                      </div>
                    )}
                  </div>
                  {isSpeaking && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} className="animate-breath" />
                  )}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    <IconBtn tint={isSpeaking ? 'green' : 'amber'} title={isSpeaking ? 'Mute' : 'Unmute'} onClick={() => sendHostAction({ type: 'grant_speaking', userId: u.id })}>🎤</IconBtn>
                    <IconBtn tint="neutral" title="Nominate" disabled={vote.nominees.includes(u.id)} onClick={() => sendHostAction({ type: 'nominate', targetId: u.id })}>+</IconBtn>
                    <IconBtn tint="red" title="Eliminate" onClick={() => sendHostAction({ type: 'host_eliminate', userId: u.id })}>×</IconBtn>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dead players */}
          <DeadPlayers users={Object.values(users)} />

          {/* Voting */}
          <VotingControls gameState={gameState} sendHostAction={sendHostAction} />
        </>
      )}
    </>
  );
}
