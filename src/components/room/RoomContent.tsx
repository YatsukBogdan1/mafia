'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useAuth } from '@/hooks/useAuth';
import { useLivekitToken } from '@/hooks/useLivekitToken';
import { VideoRoom } from '@/components/VideoRoom';
import { C, roleColor } from '@/styles/tokens';
import { HostControls } from './HostControls';
import { PlayerControls } from './PlayerControls';
import { SpectatorControls } from './SpectatorControls';

function getWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

interface Props {
  roomId: string; // 'NEW' = create, otherwise = room code to join
}

export function RoomContent({ roomId }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const isCreating = roomId === 'NEW';
  const forceRoomCode = isCreating ? null : roomId;

  const {
    isConnected, reconnectPending, gameState, myUserId, myRole, roomCode, error,
    createRoom, joinRoom, sendHostAction, sendPlayerAction,
  } = useGameSocket({ url: getWsUrl(), forceRoomCode });

  const hasJoined = useRef(false);
  const saveDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const token = useLivekitToken(gameState?.livekitRoomName, myUserId);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMediaChange = useCallback((camera: boolean, mic: boolean) => {
    clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      fetch('/api/auth/media-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera, mic }),
      }).catch(() => {});
    }, 800);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/');
  }, [authLoading, user, router]);

  // Join or create once connected (wait for any in-flight reconnect first)
  useEffect(() => {
    if (!isConnected || hasJoined.current || authLoading || !user || reconnectPending) return;
    if (roomCode) { hasJoined.current = true; return; }
    hasJoined.current = true;
    const name = user.displayName;
    if (isCreating) createRoom(name);
    else joinRoom(roomId, name);
  }, [isConnected, reconnectPending, authLoading, user, roomCode, isCreating, roomId, createRoom, joinRoom]);

  // After creation, replace /room/NEW → /room/[CODE]
  useEffect(() => {
    if (roomCode && isCreating) {
      router.replace(`/room/${roomCode}`);
    }
  }, [roomCode, isCreating, router]);

  if (authLoading || !user) {
    return <LoadingScreen />;
  }

  if (error && !gameState) {
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
    return <LoadingScreen />;
  }

  const isHost = myUserId === gameState.hostId;
  const isSpectator = myUserId ? (gameState.users[myUserId]?.type === 'spectator') : false;
  const phase = gameState.phase;
  const users = Object.values(gameState.users);

  const phaseLabel =
    phase.type === 'lobby'    ? 'Lobby' :
    phase.type === 'game'     ? 'In Progress' :
    `Game Over`;

  const phaseColor =
    phase.type === 'lobby'    ? C.textMuted :
    phase.type === 'game'     ? C.green :
    C.crimson;

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

      {/* Header */}
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
            {users.filter(u => u.type !== 'host').length} players
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

      {/* Main */}
      <div className="room-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VideoRoom
            token={token}
            onDisconnect={() => router.push('/')}
            players={gameState.users}
            votedIds={votedIds}
            initialCamera={user.mediaPrefs.camera}
            initialMic={user.mediaPrefs.mic}
            onMediaChange={handleMediaChange}
            hideLeave={phase.type === 'game'}
          />
        </div>

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

        <aside
          className={`room-sidebar${sidebarOpen ? ' open' : ''}`}
          style={{
            width: 292, flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 10,
            overflowY: 'auto', padding: 14,
            borderLeft: `1px solid ${C.border}`, background: C.bgPanel,
          }}
        >
          {isSpectator ? (
            <SpectatorControls gameState={gameState} />
          ) : isHost ? (
            <HostControls gameState={gameState} sendHostAction={sendHostAction} />
          ) : (
            <PlayerControls gameState={gameState} myUserId={myUserId!} myRole={myRole} sendPlayerAction={sendPlayerAction} />
          )}
        </aside>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0b0b' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #c41e3a', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#4a4744', letterSpacing: '0.05em' }}>Connecting…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
