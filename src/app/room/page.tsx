'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGameSocket } from '@/hooks/useGameSocket';
import { VideoRoom } from '@/components/VideoRoom';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bgBase:    '#0c0b0b',
  bgPanel:   '#131111',
  bgSurface: '#1c1919',
  bgHover:   '#241f1f',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(255,255,255,0.13)',
  text:      '#e8e3de',
  textSec:   '#9c948c',
  textMuted: '#5a5552',
  crimson:   '#c41e3a',
  crimsonDk: '#981630',
  amber:     '#d4923a',
  green:     '#22c55e',
  blue:      '#3b82f6',
} as const;

const ROLE_COLORS: Record<string, string> = {
  mafia:    '#ef4444',
  don:      '#b91c1c',
  sheriff:  '#3b82f6',
  villager: '#6b7280',
};

function roleColor(role: string | null | undefined): string {
  return role ? (ROLE_COLORS[role] ?? '#6b7280') : '#3a3838';
}
function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Format a player as "N. Name" when a seat number is assigned, else just "Name". */
function pName(player: { name: string; seatNumber: number | null } | null | undefined): string {
  if (!player) return '?';
  return player.seatNumber != null ? `${player.seatNumber}. ${player.name}` : player.name;
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
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

function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
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

function PrimaryBtn({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
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

function GhostBtn({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
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

function IconBtn({ children, onClick, title, tint = 'neutral', disabled }: {
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

// ─── Route ────────────────────────────────────────────────────────────────────

function getWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const name = searchParams.get('name');
  const action = searchParams.get('action');
  const code = searchParams.get('code');

  // null → skip stale-session reconnect (creating fresh room)
  // code → only reconnect if session matches the requested code
  // undefined → always attempt reconnect (no explicit intent)
  const forceRoomCode = action === 'create' ? null : (action === 'join' && code ? code.toUpperCase() : undefined);

  const {
    isConnected, gameState, myPlayerId, myRole, roomCode, error,
    createRoom, joinRoom, sendHostAction, sendPlayerAction,
  } = useGameSocket({ url: getWsUrl(), forceRoomCode });

  const hasJoined = useRef(false);
  const [token, setToken] = React.useState('');
  const [tokenRetry, setTokenRetry] = React.useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isConnected || hasJoined.current || !name) return;
    if (roomCode) { hasJoined.current = true; return; }
    const timer = setTimeout(() => {
      if (hasJoined.current) return;
      hasJoined.current = true;
      if (action === 'create') createRoom(name);
      else if (action === 'join' && code) joinRoom(code, name);
      else router.push('/');
    }, 200);
    return () => clearTimeout(timer);
  }, [isConnected, name, action, code, roomCode, createRoom, joinRoom, router]);

  useEffect(() => {
    if (!gameState?.livekitRoomName || !myPlayerId || token) return;
    let cancelled = false;
    fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: gameState.livekitRoomName, participantName: myPlayerId }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.token) setToken(d.token); })
      .catch(() => {
        if (!cancelled) setTimeout(() => setTokenRetry(n => n + 1), 2000);
      });
    return () => { cancelled = true; };
  }, [gameState?.livekitRoomName, myPlayerId, token, tokenRetry]);

  // Update host URL to include room code so refresh reconnects instead of creating a new room
  useEffect(() => {
    if (roomCode && action === 'create' && name) {
      router.replace(`/room?name=${encodeURIComponent(name)}&action=join&code=${roomCode}`);
    }
  }, [roomCode, action, name, router]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: C.bgBase, color: C.text }}>
        <p style={{ color: '#f87171' }}>{error}</p>
        <button onClick={() => router.push('/')} style={{ padding: '8px 20px', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.textSec, cursor: 'pointer' }}>
          Back to Lobby
        </button>
      </div>
    );
  }

  if (!gameState || !token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgBase }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${C.crimson}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: C.textMuted, letterSpacing: '0.05em' }}>Connecting…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isHost = myPlayerId === gameState.hostId;
  const phase = gameState.phase;
  const players = Object.values(gameState.players);

  const phaseLabel =
    phase.type === 'lobby'    ? 'Lobby' :
    phase.type === 'game'     ? 'In Progress' :
    `Game Over`;

  const phaseColor =
    phase.type === 'lobby'    ? C.textMuted :
    phase.type === 'game'     ? C.green :
    C.crimson;

  // Voted IDs for current active nominee only
  const votedIds = (() => {
    const { vote } = gameState;
    if (vote.finished || vote.currentNomineeIndex < 0) return [];
    const currentNominee = vote.nominees[vote.currentNomineeIndex];
    return Object.entries(vote.votes)
      .filter(([, nid]) => nid === currentNominee)
      .map(([voterId]) => voterId);
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bgBase, color: C.text }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        height: 50, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: `1px solid ${C.border}`, background: C.bgPanel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: C.text }}>
            MAFIA
          </span>
          <div style={{ width: 1, height: 16, background: C.border }} />
          <span data-testid="room-code" style={{
            fontFamily: 'var(--font-jetbrains-mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.18em', color: C.textSec,
            background: C.bgSurface, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '2px 8px',
          }}>
            {gameState.code}
          </span>
          <div className="room-header-phase" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: phaseColor, boxShadow: `0 0 6px ${phaseColor}` }} />
            <span style={{ fontSize: 12, color: C.textMuted, letterSpacing: '0.04em' }}>{phaseLabel}</span>
          </div>
          {phase.type === 'game' && (
            <span className="room-header-round" style={{
              fontFamily: 'var(--font-jetbrains-mono)', fontSize: 11,
              color: C.textMuted, background: C.bgSurface,
              border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 7px',
            }}>
              R{gameState.round}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {myRole && (
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
              color: roleColor(myRole), background: `${roleColor(myRole)}18`,
              border: `1px solid ${roleColor(myRole)}40`,
              borderRadius: 5, padding: '3px 8px', textTransform: 'capitalize',
            }}>
              {myRole}
            </span>
          )}
          <span style={{ fontSize: 12, color: C.textMuted }} className="room-header-details">
            {players.filter(p => !p.isHost).length} players
          </span>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              display: 'none', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, border: `1px solid ${C.border}`,
              borderRadius: 8, background: sidebarOpen ? C.bgSurface : 'transparent',
              color: C.textSec, fontSize: 16, cursor: 'pointer',
            }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="room-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VideoRoom token={token} onDisconnect={() => router.push('/')} players={gameState.players} votedIds={votedIds} />
        </div>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 99,
            }}
            className="sidebar-backdrop"
          />
        )}

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside
          className={`room-sidebar${sidebarOpen ? ' open' : ''}`}
          style={{
            width: 292, flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 10,
            overflowY: 'auto', padding: 14,
            borderLeft: `1px solid ${C.border}`, background: C.bgPanel,
          }}
        >
          {isHost ? (
            <HostControls gameState={gameState} sendHostAction={sendHostAction} />
          ) : (
            <PlayerControls gameState={gameState} myPlayerId={myPlayerId!} myRole={myRole} sendPlayerAction={sendPlayerAction} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Host Sidebar ─────────────────────────────────────────────────────────────

function HostControls({
  gameState, sendHostAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  sendHostAction: (a: import('@/lib/game/types').GameAction) => void;
}) {
  const { phase, players, vote, speaking, round, playerOrder } = gameState;
  const alivePlayers = (playerOrder.length > 0
    ? playerOrder.map(id => players[id]).filter(Boolean)
    : Object.values(players)
  ).filter(p => p.isAlive && !p.isHost);
  const inGame = phase.type === 'game';

  const aliveOrder = playerOrder.filter(id => players[id]?.isAlive && !players[id]?.isHost);
  const suggestedSpeakerId = inGame && aliveOrder.length > 0 ? aliveOrder[(round - 1) % aliveOrder.length] : null;
  const suggestedSpeaker = suggestedSpeakerId ? players[suggestedSpeakerId] : null;

  return (
    <>
      {/* Lobby */}
      {phase.type === 'lobby' && (() => {
        const lobbyPlayers = Object.values(players).filter(p => !p.isHost);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '20px 0 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
                {lobbyPlayers.length} player{lobbyPlayers.length !== 1 ? 's' : ''} in lobby
              </p>
            </div>
            {lobbyPlayers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lobbyPlayers.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', background: C.bgSurface,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 12, color: C.text }}>{p.name}</span>
                    <IconBtn tint="red" title="Kick" onClick={() => sendHostAction({ type: 'kick_player', playerId: p.id })}>×</IconBtn>
                  </div>
                ))}
              </div>
            )}
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
          {/* Round */}
          <SectionLabel>Round</SectionLabel>
          <Card style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: 22, fontWeight: 700, color: C.text }}>{round}</span>
                {suggestedSpeaker && (
                  <span style={{ fontSize: 11, color: C.amber }}>
                    · {pName(suggestedSpeaker)} speaks first
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
          <SectionLabel>Players ({alivePlayers.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {alivePlayers.map(p => {
              const isSpeaking = speaking.unmutedPlayers.includes(p.id);
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  background: isSpeaking ? 'rgba(34,197,94,0.06)' : C.bgSurface,
                  border: `1px solid ${isSpeaking ? 'rgba(34,197,94,0.25)' : C.border}`,
                  borderLeft: `3px solid ${roleColor(p.role)}`,
                  borderRadius: 8,
                  transition: 'all 0.2s',
                  ...(isSpeaking ? { boxShadow: '0 0 0 0 rgba(34,197,94,0.4)', animation: 'pulse-ring 2s ease-out infinite' } : {}),
                }}>
                  <span style={{
                    fontFamily: 'var(--font-jetbrains-mono)', fontSize: 11,
                    color: roleColor(p.role), minWidth: 18, fontWeight: 600,
                  }}>
                    {p.seatNumber ?? '—'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    {p.role && (
                      <div style={{ fontSize: 10, color: roleColor(p.role), opacity: 0.8, textTransform: 'capitalize' }}>
                        {roleLabel(p.role)}
                      </div>
                    )}
                  </div>
                  {isSpeaking && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} className="animate-breath" />
                  )}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    <IconBtn tint={isSpeaking ? 'green' : 'amber'} title={isSpeaking ? 'Mute' : 'Unmute'} onClick={() => sendHostAction({ type: 'grant_speaking', playerId: p.id })}>🎤</IconBtn>
                    <IconBtn tint="neutral" title="Nominate" disabled={vote.nominees.includes(p.id)} onClick={() => sendHostAction({ type: 'nominate', targetId: p.id })}>+</IconBtn>
                    <IconBtn tint="red" title="Eliminate" onClick={() => sendHostAction({ type: 'host_eliminate', playerId: p.id })}>×</IconBtn>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dead players */}
          <DeadPlayers players={Object.values(players)} />

          {/* Voting */}
          <VotingControls gameState={gameState} sendHostAction={sendHostAction} />
        </>
      )}
    </>
  );
}

// ─── Speaking timer ───────────────────────────────────────────────────────────

function SpeakingTimer() {
  const [endTime, setEndTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const rafRef = useRef<number>(undefined);

  const start = (duration: number) => setEndTime(Date.now() + duration * 1000);
  const stop = () => { setEndTime(null); setRemaining(0); };

  useEffect(() => {
    if (endTime === null) return;
    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(left);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
      else setEndTime(null);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [endTime]);

  const running = endTime !== null;
  const mins   = Math.floor(remaining / 60000);
  const secs   = Math.floor((remaining % 60000) / 1000);
  const centis = Math.floor((remaining % 1000) / 10);
  const display = `${mins}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
  const urgent = running && remaining <= 10000;

  return (
    <Card style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontFamily: 'var(--font-jetbrains-mono)', fontSize: 28, fontWeight: 600,
        textAlign: 'center', letterSpacing: '0.04em',
        color: urgent ? '#f87171' : C.amber,
        textShadow: `0 0 20px ${urgent ? 'rgba(248,113,113,0.35)' : 'rgba(212,146,58,0.35)'}`,
        transition: 'color 0.3s, text-shadow 0.3s',
      }}>
        {display}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {running ? (
          <GhostBtn onClick={stop} style={{ fontSize: 11, padding: '6px 10px' }}>Stop</GhostBtn>
        ) : (
          <>
            <GhostBtn onClick={() => start(30)} style={{ fontSize: 11, padding: '6px 10px' }}>30s</GhostBtn>
            <GhostBtn onClick={() => start(60)} style={{ fontSize: 11, padding: '6px 10px' }}>1 min</GhostBtn>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Dead players ─────────────────────────────────────────────────────────────

function DeadPlayers({ players }: { players: import('@/lib/game/types').ClientPlayer[] }) {
  const dead = players.filter(p => !p.isAlive && !p.isHost);
  if (dead.length === 0) return null;
  return (
    <>
      <SectionLabel>Eliminated ({dead.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {dead.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 7,
            background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.04)`,
            opacity: 0.6,
          }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: C.textMuted, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.textMuted, textDecoration: 'line-through' }}>{pName(p)}</span>
            {p.role && <span style={{ fontSize: 10, color: roleColor(p.role), opacity: 0.7, marginLeft: 'auto', textTransform: 'capitalize' }}>{roleLabel(p.role)}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Voting controls (host) ───────────────────────────────────────────────────

function VotingControls({
  gameState, sendHostAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  sendHostAction: (a: import('@/lib/game/types').GameAction) => void;
}) {
  const { vote, players } = gameState;
  if (vote.nominees.length === 0) return null;

  const currentNominee = vote.currentNomineeIndex >= 0 ? vote.nominees[vote.currentNomineeIndex] : null;

  return (
    <>
      <SectionLabel>Voting</SectionLabel>
      <Card style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Nominee list */}
        {vote.eliminateAllIds.length > 0 ? (
          <div style={{
            padding: '8px 10px', borderRadius: 7,
            background: vote.finished ? 'rgba(255,255,255,0.03)' : 'rgba(196,30,58,0.1)',
            border: `1px solid ${vote.finished ? C.border : 'rgba(196,30,58,0.3)'}`,
            fontSize: 12, color: vote.finished ? C.textSec : '#fca5a5',
          }}>
            Eliminate all: {vote.eliminateAllIds.map(nid => pName(players[nid])).join(', ')}
            {vote.finished && <span style={{ color: C.textMuted }}> — {vote.usedVotes.length} voted yes</span>}
            {!vote.finished && <span style={{ color: C.textMuted }}> (voting now)</span>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vote.nominees.map((nid, i) => {
              const voteCount = Object.values(vote.votes).filter(v => v === nid).length;
              const isCurrent = i === vote.currentNomineeIndex;
              const isDone = i < vote.currentNomineeIndex || vote.finished;
              const canRemove = vote.currentNomineeIndex < 0;
              return (
                <div key={nid} style={{
                  padding: '7px 10px', borderRadius: 7, fontSize: 12,
                  background: isCurrent ? 'rgba(196,30,58,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCurrent ? 'rgba(196,30,58,0.35)' : C.border}`,
                  color: isDone ? C.textMuted : C.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>{pName(players[nid])}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>
                      {isDone ? `${voteCount} votes` : isCurrent ? 'voting…' : ''}
                    </span>
                    {canRemove && (
                      <IconBtn tint="red" title="Remove" onClick={() => sendHostAction({ type: 'remove_nominee', targetId: nid })}>×</IconBtn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vote countdown (for host) */}
        {!vote.finished && vote.votingDeadline && (
          <VoteCountdown deadline={vote.votingDeadline} />
        )}

        {/* Start/next/finalize */}
        {!vote.finished && vote.eliminateAllIds.length === 0 && (
          <PrimaryBtn onClick={() => sendHostAction({ type: 'start_nominee_vote' })} style={{ fontSize: 12, padding: '9px 14px' }}>
            {vote.currentNomineeIndex < 0
              ? `Start vote · ${pName(players[vote.nominees[0]])}`
              : vote.currentNomineeIndex + 1 < vote.nominees.length
                ? `Next · ${pName(players[vote.nominees[vote.currentNomineeIndex + 1]])}`
                : 'Finalize'}
          </PrimaryBtn>
        )}

        {!vote.finished && vote.eliminateAllIds.length > 0 && (
          <GhostBtn onClick={() => sendHostAction({ type: 'start_nominee_vote' })} style={{ fontSize: 11, padding: '7px 12px' }}>
            Finalize vote
          </GhostBtn>
        )}

        {/* Finished state */}
        {vote.finished && vote.eliminateAllIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <PrimaryBtn
              onClick={() => vote.eliminateAllIds.forEach(nid => sendHostAction({ type: 'host_eliminate', playerId: nid }))}
              style={{ fontSize: 12, padding: '9px 14px' }}
            >
              Eliminate all
            </PrimaryBtn>
            <GhostBtn onClick={() => sendHostAction({ type: 'host_save' })} style={{ fontSize: 12, padding: '9px 14px' }}>Save</GhostBtn>
          </div>
        )}

        {vote.finished && vote.eliminateAllIds.length === 0 && (() => {
          const topVotes = Math.max(...vote.nominees.map(nid =>
            Object.values(vote.votes).filter(v => v === nid).length
          ));
          const topNominees = vote.nominees.filter(nid =>
            Object.values(vote.votes).filter(v => v === nid).length === topVotes
          );
          const isTie = topNominees.length > 1;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {isTie && (
                <div style={{ fontSize: 11, color: '#fbbf24', textAlign: 'center', padding: '4px 0' }}>
                  {vote.revoteRound === 0 ? 'Tie — revote or decide' : 'Tie again — vote to eliminate all or decide'}
                </div>
              )}

              {!isTie && (
                <PrimaryBtn onClick={() => sendHostAction({ type: 'host_eliminate', playerId: topNominees[0] })} style={{ fontSize: 12, padding: '9px 14px' }}>
                  Eliminate {pName(players[topNominees[0]])}
                </PrimaryBtn>
              )}

              {isTie && vote.revoteRound === 0 && (
                <>
                  <PrimaryBtn onClick={() => sendHostAction({ type: 'revote', tiedIds: topNominees })} style={{ fontSize: 12, padding: '9px 14px', background: '#b45309' }}>
                    Revote ({topNominees.map(nid => pName(players[nid])).join(' vs ')})
                  </PrimaryBtn>
                  {topNominees.map(nid => (
                    <GhostBtn key={nid} onClick={() => sendHostAction({ type: 'host_eliminate', playerId: nid })} style={{ fontSize: 11, padding: '7px 12px' }}>
                      Eliminate {pName(players[nid])}
                    </GhostBtn>
                  ))}
                </>
              )}

              {isTie && vote.revoteRound >= 1 && (
                <>
                  <PrimaryBtn onClick={() => sendHostAction({ type: 'vote_eliminate_all', tiedIds: topNominees })} style={{ fontSize: 12, padding: '9px 14px' }}>
                    Vote to eliminate all
                  </PrimaryBtn>
                  {topNominees.map(nid => (
                    <GhostBtn key={nid} onClick={() => sendHostAction({ type: 'host_eliminate', playerId: nid })} style={{ fontSize: 11, padding: '7px 12px' }}>
                      Eliminate {pName(players[nid])}
                    </GhostBtn>
                  ))}
                </>
              )}

              <GhostBtn onClick={() => sendHostAction({ type: 'host_save' })} style={{ fontSize: 11, padding: '7px 12px' }}>
                Save
              </GhostBtn>
            </div>
          );
        })()}
      </Card>
    </>
  );
}

// ─── Player Sidebar ───────────────────────────────────────────────────────────

function PlayerControls({
  gameState, myPlayerId, myRole, sendPlayerAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  myPlayerId: string;
  myRole: import('@/lib/game/types').PlayerRole | null;
  sendPlayerAction: (a: import('@/lib/game/types').GameAction) => void;
}) {
  const { phase, players, vote, speaking } = gameState;
  const me = players[myPlayerId];

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
        <GhostBtn onClick={() => sendPlayerAction({ type: 'become_host', playerId: myPlayerId })}>
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
      {speaking.unmutedPlayers.includes(myPlayerId) && (
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
        <PlayerVoting gameState={gameState} myPlayerId={myPlayerId} sendPlayerAction={sendPlayerAction} />
      )}

      {/* Mafia teammates */}
      {(myRole === 'mafia' || myRole === 'don') && (
        <>
          <SectionLabel>Mafia Team</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.values(players)
              .filter(p => !p.isHost && (p.role === 'mafia' || p.role === 'don') && p.id !== myPlayerId)
              .map(p => (
                <div key={p.id} style={{
                  padding: '7px 10px', borderRadius: 7, fontSize: 12,
                  background: C.bgSurface, border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${roleColor(p.role)}`,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ color: C.text }}>{pName(p)}</span>
                  <span style={{ fontSize: 10, color: roleColor(p.role), marginLeft: 'auto', textTransform: 'capitalize' }}>{p.role}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </>
  );
}

// ─── Player voting UI ─────────────────────────────────────────────────────────

function PlayerVoting({
  gameState, myPlayerId, sendPlayerAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  myPlayerId: string;
  sendPlayerAction: (a: import('@/lib/game/types').GameAction) => void;
}) {
  const { vote, players } = gameState;
  const [expired, setExpired] = useState(false);
  const hasVoted = vote.usedVotes.includes(myPlayerId);
  const currentNominee = vote.currentNomineeIndex >= 0 ? vote.nominees[vote.currentNomineeIndex] : null;
  const isEliminateAll = vote.eliminateAllIds.length > 0;

  if (vote.finished) {
    return (
      <>
        <SectionLabel>Voting Results</SectionLabel>
        <Card style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isEliminateAll ? (
            <div style={{ fontSize: 12, color: C.textSec, padding: '4px 6px' }}>
              Eliminate all: {vote.eliminateAllIds.map(nid => pName(players[nid])).join(', ')}
              <span style={{ color: C.textMuted }}> — {vote.usedVotes.length} voted yes</span>
            </div>
          ) : (
            vote.nominees.map(nid => {
              const count = Object.values(vote.votes).filter(v => v === nid).length;
              return (
                <div key={nid} style={{
                  padding: '6px 8px', borderRadius: 6, fontSize: 12,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: C.textSec }}>{pName(players[nid])}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 11, color: C.textMuted }}>{count} votes</span>
                </div>
              );
            })
          )}
        </Card>
      </>
    );
  }

  if (!currentNominee) {
    return (
      <>
        <SectionLabel>Nominated</SectionLabel>
        <Card style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted }}>
          {vote.nominees.map(nid => pName(players[nid])).join(', ')}
          <div style={{ marginTop: 4, fontSize: 11, color: C.textMuted, opacity: 0.7 }}>Waiting for host to start vote…</div>
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionLabel>Vote</SectionLabel>
      <Card style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isEliminateAll ? (
          <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 500 }}>
            Voting to eliminate all:<br />
            <span style={{ color: C.textSec }}>{vote.eliminateAllIds.map(nid => pName(players[nid])).join(', ')}</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.textSec }}>
            Vote on: <span style={{ color: C.text, fontWeight: 500 }}>{pName(players[currentNominee])}</span>
            <span style={{ color: C.textMuted }}> ({vote.currentNomineeIndex + 1}/{vote.nominees.length})</span>
          </div>
        )}
        {vote.votingDeadline && <VoteCountdown deadline={vote.votingDeadline} onExpiredChange={setExpired} />}
        {hasVoted ? (
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>Vote cast ✓</div>
        ) : expired ? (
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>Time expired</div>
        ) : (
          <PrimaryBtn onClick={() => sendPlayerAction({ type: 'cast_vote', voterId: myPlayerId })} style={{ fontSize: 13, padding: '10px 14px' }}>
            {isEliminateAll ? 'Vote to eliminate all' : `Vote for ${pName(players[currentNominee])}`}
          </PrimaryBtn>
        )}
      </Card>
    </>
  );
}

// ─── Vote countdown ───────────────────────────────────────────────────────────

function VoteCountdown({ deadline, onExpiredChange }: { deadline: number; onExpiredChange?: (e: boolean) => void }) {
  const [remaining, setRemaining] = useState(0);
  const rafRef = useRef<number>(undefined);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      onExpiredChange?.(left <= 0);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [deadline, onExpiredChange]);

  const secs   = Math.floor(remaining / 1000);
  const centis = Math.floor((remaining % 1000) / 10);
  const urgent = remaining <= 3000;

  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{
        fontFamily: 'var(--font-jetbrains-mono)', fontSize: 24, fontWeight: 600,
        color: urgent ? '#f87171' : C.amber,
        textShadow: `0 0 16px ${urgent ? 'rgba(248,113,113,0.4)' : 'rgba(212,146,58,0.4)'}`,
        transition: 'color 0.3s, text-shadow 0.3s',
      }}>
        {secs}.{String(centis).padStart(2, '0')}s
      </span>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0b0b', color: '#5a5552', fontSize: 13 }}>
        Loading…
      </div>
    }>
      <RoomContent />
    </Suspense>
  );
}
