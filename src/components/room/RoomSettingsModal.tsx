'use client';

import React, { useState } from 'react';
import { C } from '@/styles/tokens';
import type { RoomSettings, RoleDistribution } from '@/lib/game/types';

const TIMEOUT_OPTIONS = [3, 5, 10, 15, 20, 30, 45, 60] as const;

const DIST_ROLES: { key: keyof RoleDistribution; label: string; color: string }[] = [
  { key: 'mafia',    label: 'Mafia',    color: '#ef4444' },
  { key: 'don',      label: 'Don',      color: '#b91c1c' },
  { key: 'sheriff',  label: 'Sheriff',  color: '#3b82f6' },
  { key: 'doctor',   label: 'Doctor',   color: '#22c55e' },
  { key: 'hooker',   label: 'Hooker',   color: '#a855f7' },
  { key: 'villager', label: 'Villager', color: '#6b7280' },
];

export function RoomSettingsModal({
  settings,
  playerCount,
  onSave,
  onClose,
}: {
  settings: RoomSettings;
  playerCount: number;
  onSave: (s: Partial<RoomSettings>) => void;
  onClose: () => void;
}) {
  const [timeoutMs, setTimeoutMs] = useState(settings.votingTimeoutMs);
  const [useCustomDist, setUseCustomDist] = useState(settings.roleDistribution !== null);
  const [dist, setDist] = useState<RoleDistribution>(
    settings.roleDistribution ?? { mafia: 2, don: 1, sheriff: 1, doctor: 0, hooker: 0, villager: Math.max(0, playerCount - 4) }
  );

  const distTotal = dist.mafia + dist.don + dist.sheriff + dist.villager;
  const distValid = distTotal === playerCount;

  function setRole(key: keyof RoleDistribution, delta: number) {
    setDist(d => ({ ...d, [key]: Math.max(0, d[key] + delta) }));
  }

  function handleSave() {
    onSave({
      votingTimeoutMs: timeoutMs,
      roleDistribution: useCustomDist ? dist : null,
    });
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bgPanel, border: `1px solid ${C.borderHi}`,
        borderRadius: 14, padding: '24px 28px', width: 360, display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: '0.02em' }}>Room Settings</div>

        {/* Voting timeout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Voting timeout</span>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 13, fontWeight: 600, color: C.amber }}>
              {timeoutMs / 1000}s
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TIMEOUT_OPTIONS.map(sec => {
              const ms = sec * 1000;
              const active = timeoutMs === ms;
              return (
                <button key={sec} onClick={() => setTimeoutMs(ms)} style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${active ? C.amber : C.border}`,
                  background: active ? 'rgba(212,146,58,0.15)' : 'transparent',
                  color: active ? C.amber : C.textMuted,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>{sec}s</button>
              );
            })}
          </div>
        </div>

        {/* Role distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Role distribution</span>
            <button onClick={() => setUseCustomDist(v => !v)} style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${useCustomDist ? C.amber : C.border}`,
              background: useCustomDist ? 'rgba(212,146,58,0.15)' : 'transparent',
              color: useCustomDist ? C.amber : C.textMuted, transition: 'all 0.12s',
            }}>
              {useCustomDist ? 'Custom' : 'Auto'}
            </button>
          </div>

          {useCustomDist && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DIST_ROLES.map(({ key, label, color }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color, width: 58, fontWeight: 500 }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <button onClick={() => setRole(key, -1)} style={{
                        width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.textSec, fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>−</button>
                      <span style={{
                        fontFamily: 'var(--font-jetbrains-mono)', fontSize: 14, fontWeight: 600,
                        color: dist[key] > 0 ? color : C.textMuted, minWidth: 20, textAlign: 'center',
                      }}>{dist[key]}</span>
                      <button onClick={() => setRole(key, +1)} style={{
                        width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.textSec, fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                fontSize: 11, padding: '6px 10px', borderRadius: 7,
                background: distValid ? 'rgba(34,197,94,0.07)' : 'rgba(196,30,58,0.1)',
                border: `1px solid ${distValid ? 'rgba(34,197,94,0.2)' : 'rgba(196,30,58,0.3)'}`,
                color: distValid ? '#4ade80' : '#fca5a5',
              }}>
                Total: {distTotal} / {playerCount} players{distValid ? ' ✓' : ` — need ${playerCount}`}
              </div>
            </>
          )}

          {!useCustomDist && (
            <div style={{ fontSize: 11, color: C.textMuted }}>
              Uses built-in table based on player count.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={handleSave} disabled={useCustomDist && !distValid} style={{
            flex: 1, padding: '9px 0', border: 'none', borderRadius: 8,
            background: useCustomDist && !distValid ? C.bgSurface : C.crimson,
            color: useCustomDist && !distValid ? C.textMuted : '#fff',
            fontSize: 13, fontWeight: 600,
            cursor: useCustomDist && !distValid ? 'not-allowed' : 'pointer',
          }}>Save</button>
          <button onClick={onClose} style={{
            flex: 1, padding: '9px 0', border: `1px solid ${C.border}`, borderRadius: 8,
            background: 'transparent', color: C.textMuted, fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
