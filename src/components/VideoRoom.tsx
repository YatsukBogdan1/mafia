'use client';

import { useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  ControlBar,
  useTracks,
  VideoTrack,
  RoomAudioRenderer,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { DisconnectReason, Track } from 'livekit-client';
import type { ClientUser } from '@/lib/game/types';

interface VideoRoomProps {
  token: string;
  onDisconnect: () => void;
  players: Record<string, ClientUser>;
  votedIds?: string[];
  initialCamera?: boolean;
  initialMic?: boolean;
  onMediaChange?: (camera: boolean, mic: boolean) => void;
  hideLeave?: boolean;
  canPublish?: boolean;
  isGameOver?: boolean;
}

export function VideoRoom({
  token,
  onDisconnect,
  players,
  votedIds = [],
  initialCamera = true,
  initialMic = true,
  onMediaChange,
  hideLeave = false,
  canPublish = true,
  isGameOver = false,
}: VideoRoomProps) {
  return (
    <LiveKitRoom
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      token={token}
      connect={true}
      video={canPublish ? initialCamera : false}
      audio={canPublish ? initialMic : false}
      onDisconnected={(reason) => {
        if (reason === DisconnectReason.CLIENT_INITIATED) {
          onDisconnect();
        }
      }}
      data-lk-theme="default"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CustomVideoGrid players={players} votedIds={votedIds} isGameOver={isGameOver} />
      </div>
      <ControlBar controls={{ screenShare: false, leave: !hideLeave, camera: canPublish, microphone: canPublish }} />
      <RoomAudioRenderer />
      {onMediaChange && <MediaStateTracker onMediaChange={onMediaChange} />}
    </LiveKitRoom>
  );
}

/** Watches local mic/camera state from inside LiveKitRoom and reports changes. */
function MediaStateTracker({ onMediaChange }: { onMediaChange: (camera: boolean, mic: boolean) => void }) {
  const { isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const initializedRef = useRef(false);
  const prevRef = useRef({ camera: isCameraEnabled, mic: isMicrophoneEnabled });

  useEffect(() => {
    // Skip the very first effect — that's just the initial state being reported
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = { camera: isCameraEnabled, mic: isMicrophoneEnabled };
      return;
    }
    if (prevRef.current.camera !== isCameraEnabled || prevRef.current.mic !== isMicrophoneEnabled) {
      prevRef.current = { camera: isCameraEnabled, mic: isMicrophoneEnabled };
      onMediaChange(isCameraEnabled, isMicrophoneEnabled);
    }
  }, [isCameraEnabled, isMicrophoneEnabled, onMediaChange]);

  return null;
}


const ROLE_COLORS: Record<string, string> = {
  mafia: '#c41e3a',
  don: '#c41e3a',
  sheriff: '#3b82f6',
  villager: '#a3a09d',
  doctor: '#22c55e',
  hooker: '#a855f7',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        background: 'rgba(10,9,9,0.72)',
        backdropFilter: 'blur(4px)',
        borderRadius: 5,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: 600,
        color: ROLE_COLORS[role] ?? '#a3a09d',
        pointerEvents: 'none',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        border: '1px solid rgba(255,255,255,0.07)',
        fontFamily: 'var(--font-dm-sans)',
      }}
    >
      {role}
    </div>
  );
}

function CustomVideoGrid({ players, votedIds, isGameOver }: { players: Record<string, ClientUser>; votedIds: string[]; isGameOver: boolean }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  // Filter out spectators — they should not appear in the grid
  const visiblePlayers = Object.fromEntries(
    Object.entries(players).filter(([, p]) => p.type !== 'spectator'),
  );

  // Merge connected tracks and players without a track into a single sorted list.
  // Players who are marked connected but don't have a LiveKit track yet (reconnecting)
  // stay as placeholder tiles so they don't vanish and re-appear ("jump").
  const trackIdentities = new Set(tracks.map(t => t.participant.identity));
  const playersWithoutTrack = Object.values(visiblePlayers)
    .filter(p => !trackIdentities.has(p.id));

  type GridItem =
    | { kind: 'track'; track: (typeof tracks)[number]; player: ClientUser | undefined }
    | { kind: 'placeholder'; player: ClientUser };

  // Only include tracks for visible (non-spectator) players
  const visibleTracks = tracks.filter(t => {
    const p = visiblePlayers[t.participant.identity];
    return p !== undefined;
  });

  const items: GridItem[] = [
    ...visibleTracks.map(t => ({ kind: 'track' as const, track: t, player: visiblePlayers[t.participant.identity] })),
    ...playersWithoutTrack.map(p => ({ kind: 'placeholder' as const, player: p })),
  ];

  items.sort((a, b) => {
    const pA = a.player;
    const pB = b.player;

    if (pA?.type === 'host' && pB?.type !== 'host') return 1;
    if (pA?.type !== 'host' && pB?.type === 'host') return -1;

    const seatA = pA?.seatNumber ?? 999;
    const seatB = pB?.seatNumber ?? 999;
    if (seatA !== seatB) return seatA - seatB;

    return (pA?.name ?? '').localeCompare(pB?.name ?? '');
  });

  const count = items.length || 1;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const cols = isMobile
    ? (count <= 1 ? 1 : count <= 4 ? 2 : 3)
    : (count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4);
  const rows = Math.ceil(count / cols);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 4,
        height: '100%',
        padding: 4,
        backgroundColor: '#0c0b0b',
        boxSizing: 'border-box',
      }}
    >
      {items.map((item) => {
        if (item.kind === 'track') {
          const { track, player } = item;
          const label = player
            ? player.type === 'host'
              ? `Host: ${player.name}`
              : player.seatNumber
                ? `${player.seatNumber}. ${player.name}`
                : player.name
            : track.participant.identity;

          const isDead = player != null && !player.isAlive;

          return (
            <div
              key={track.participant.identity}
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 10,
                minHeight: 0,
                backgroundColor: '#181515',
                outline: votedIds.includes(track.participant.identity) ? '3px solid #22c55e' : 'none',
                boxShadow: votedIds.includes(track.participant.identity)
                  ? '0 0 12px rgba(34,197,94,0.3)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                transition: 'outline 0.2s, box-shadow 0.2s',
              }}
            >
              {track.publication ? (
                <VideoTrack
                  trackRef={track}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    transform: track.participant.isLocal ? 'scaleX(-1)' : undefined,
                    filter: isDead ? 'grayscale(1) brightness(0.4)' : undefined,
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#4a4744',
                    fontSize: 13,
                    fontFamily: 'var(--font-dm-sans)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {player?.name ?? track.participant.identity}
                </div>
              )}
              {isDead && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.55)',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(196,30,58,0.85)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    Eliminated
                  </span>
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  background: 'rgba(10,9,9,0.72)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: 5,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  color: isDead ? 'rgba(232,227,222,0.4)' : 'rgba(232,227,222,0.9)',
                  pointerEvents: 'none',
                  letterSpacing: '0.02em',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {label}
              </div>
              {isGameOver && player?.role && <RoleBadge role={player.role} />}
            </div>
          );
        }

        const { player } = item;
        const label = player.seatNumber
          ? `${player.seatNumber}. ${player.name}`
          : player.name;
        const isDisconnected = !player.isConnected;
        const isDead = !player.isAlive;

        return (
          <div
            key={player.id}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 10,
              minHeight: 0,
              backgroundColor: '#181515',
              opacity: isDead ? 0.45 : isDisconnected ? 0.5 : 0.7,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 6,
                color: '#4a4744',
                fontSize: 13,
                fontFamily: 'var(--font-dm-sans)',
                letterSpacing: '0.02em',
              }}
            >
              {player.name}
              <span style={{ fontSize: 10, color: '#3a3330', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {isDead ? 'Eliminated' : isDisconnected ? 'Disconnected' : 'Reconnecting…'}
              </span>
            </div>
            {isDead && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.55)',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(196,30,58,0.85)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  Eliminated
                </span>
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                background: 'rgba(10,9,9,0.72)',
                backdropFilter: 'blur(4px)',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(232,227,222,0.4)',
                pointerEvents: 'none',
                letterSpacing: '0.02em',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {label}
            </div>
            {isGameOver && player.role && <RoleBadge role={player.role} />}
          </div>
        );
      })}
    </div>
  );
}
