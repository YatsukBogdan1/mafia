'use client';

import {
  LiveKitRoom,
  ControlBar,
  useTracks,
  VideoTrack,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { DisconnectReason, Track } from 'livekit-client';
import type { ClientUser } from '@/lib/game/types';

interface VideoRoomProps {
  token: string;
  onDisconnect: () => void;
  players: Record<string, ClientUser>;
  votedIds?: string[];
}

export function VideoRoom({ token, onDisconnect, players, votedIds = [] }: VideoRoomProps) {
  return (
    <LiveKitRoom
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      token={token}
      connect={true}
      video={true}
      audio={true}
      onDisconnected={(reason) => {
        if (reason === DisconnectReason.CLIENT_INITIATED) {
          onDisconnect();
        }
      }}
      data-lk-theme="default"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CustomVideoGrid players={players} votedIds={votedIds} />
      </div>
      <ControlBar controls={{ screenShare: false }} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function CustomVideoGrid({ players, votedIds }: { players: Record<string, ClientUser>; votedIds: string[] }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  const sorted = [...tracks].sort((a, b) => {
    const pA = players[a.participant.identity];
    const pB = players[b.participant.identity];

    // Host always last
    if (pA?.type === 'host' && pB?.type !== 'host') return 1;
    if (pA?.type !== 'host' && pB?.type === 'host') return -1;

    // Sort by seat number (assigned at game start); null = not yet assigned
    const seatA = pA?.seatNumber ?? 999;
    const seatB = pB?.seatNumber ?? 999;
    if (seatA !== seatB) return seatA - seatB;

    // Fallback: alphabetical by name for consistent lobby order
    return (pA?.name ?? '').localeCompare(pB?.name ?? '');
  });

  const count = sorted.length || 1;
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
      {sorted.map((track) => {
        const player = players[track.participant.identity];
        const label = player
          ? player.type === 'host'
            ? `Host: ${player.name}`
            : player.seatNumber
              ? `${player.seatNumber}. ${player.name}`
              : player.name
          : track.participant.identity;

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
                color: 'rgba(232,227,222,0.9)',
                pointerEvents: 'none',
                letterSpacing: '0.02em',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
