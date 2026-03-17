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
import type { ClientPlayer } from '@/lib/game/types';

interface VideoRoomProps {
  token: string;
  onDisconnect: () => void;
  players: Record<string, ClientPlayer>;
}

export function VideoRoom({ token, onDisconnect, players }: VideoRoomProps) {
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
        <CustomVideoGrid players={players} />
      </div>
      <ControlBar controls={{ screenShare: false }} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function CustomVideoGrid({ players }: { players: Record<string, ClientPlayer> }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  const sorted = [...tracks].sort((a, b) => {
    const pA = players[a.participant.identity];
    const pB = players[b.participant.identity];

    // Host always last
    if (pA?.isHost && !pB?.isHost) return 1;
    if (!pA?.isHost && pB?.isHost) return -1;

    // Sort by seat number (assigned at game start); null = not yet assigned
    const seatA = pA?.seatNumber ?? 999;
    const seatB = pB?.seatNumber ?? 999;
    if (seatA !== seatB) return seatA - seatB;

    // Fallback: alphabetical by name for consistent lobby order
    return (pA?.name ?? '').localeCompare(pB?.name ?? '');
  });

  const count = sorted.length || 1;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 4,
        height: '100%',
        padding: 4,
        backgroundColor: '#09090b',
        boxSizing: 'border-box',
      }}
    >
      {sorted.map((track) => {
        const player = players[track.participant.identity];
        const label = player
          ? player.isHost
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
              borderRadius: 8,
              backgroundColor: '#27272a',
            }}
          >
            {track.publication ? (
              <VideoTrack
                trackRef={track}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#71717a',
                  fontSize: 14,
                }}
              >
                {player?.name ?? track.participant.identity}
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                background: 'rgba(0,0,0,0.65)',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 12,
                color: 'white',
                pointerEvents: 'none',
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
