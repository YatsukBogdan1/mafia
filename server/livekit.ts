import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import type { PlayerId, Player, GamePhase } from '../src/lib/game/types';

// Permissions for a "muted" participant: camera on, microphone blocked
const CAMERA_ONLY = { canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: [TrackSource.CAMERA] };
// Permissions for a fully unmuted participant
const FULL_PUBLISH = { canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: [] };
// Permissions for a dead player: no publishing at all
const NO_PUBLISH = { canPublish: false, canSubscribe: true, canPublishData: false, canPublishSources: [] };

const apiKey = process.env.LIVEKIT_API_KEY || '';
const apiSecret = process.env.LIVEKIT_API_SECRET || '';
const livekitHost =
  process.env.LIVEKIT_HOST || 'https://mafia-game-fsg1jukw.livekit.cloud';

let client: RoomServiceClient | null = null;

function getClient(): RoomServiceClient {
  if (!client) {
    client = new RoomServiceClient(livekitHost, apiKey, apiSecret);
  }
  return client;
}

export async function muteAll(roomName: string, hostId: PlayerId): Promise<void> {
  const svc = getClient();
  try {
    const participants = await svc.listParticipants(roomName);
    for (const p of participants) {
      // Host keeps full publish; everyone else: camera only (mic blocked)
      await svc.updateParticipant(roomName, p.identity, undefined,
        p.identity === hostId ? FULL_PUBLISH : CAMERA_ONLY,
      );
    }
  } catch (err) {
    console.error('Failed to mute all:', err);
  }
}

export async function unmuteAll(roomName: string): Promise<void> {
  const svc = getClient();
  try {
    const participants = await svc.listParticipants(roomName);
    for (const p of participants) {
      await svc.updateParticipant(roomName, p.identity, undefined, FULL_PUBLISH);
    }
  } catch (err) {
    console.error('Failed to unmute all:', err);
  }
}

export async function mutePlayer(roomName: string, playerId: PlayerId): Promise<void> {
  const svc = getClient();
  try {
    await svc.updateParticipant(roomName, playerId, undefined, CAMERA_ONLY);
  } catch (err) {
    console.error('Failed to mute player:', err);
  }
}

export async function unmutePlayer(roomName: string, playerId: PlayerId): Promise<void> {
  const svc = getClient();
  try {
    await svc.updateParticipant(roomName, playerId, undefined, FULL_PUBLISH);
  } catch (err) {
    console.error('Failed to unmute player:', err);
  }
}

export async function setSpectator(roomName: string, playerId: PlayerId): Promise<void> {
  const svc = getClient();
  try {
    // Dead players: no camera or mic
    await svc.updateParticipant(roomName, playerId, undefined, NO_PUBLISH);
  } catch (err) {
    console.error('Failed to set spectator:', err);
  }
}

/**
 * Pure computation of what each player can see/hear.
 * Used by sandbox for display.
 * With no subphases, everyone sees everyone except dead players (non-host).
 */
export interface PlayerMediaState {
  canPublish: boolean;
  canSee: PlayerId[];
}

export function computeMediaStates(
  players: Record<PlayerId, Player>,
  phase: GamePhase,
): Record<PlayerId, PlayerMediaState> {
  const result: Record<PlayerId, PlayerMediaState> = {};
  const allIds = Object.keys(players);

  const deadIds = new Set(
    Object.values(players)
      .filter((p) => !p.isAlive && !p.isHost)
      .map((p) => p.id),
  );

  for (const [id, player] of Object.entries(players)) {
    // canPublish: dead non-host players can't publish
    const canPublish = player.isAlive || player.isHost;

    // canSee: everyone sees everyone except dead players (only host sees dead)
    const canSee = player.isHost || phase.type === 'gameover'
      ? allIds
      : allIds.filter((pid) => !deadIds.has(pid));
    void phase; // used above

    void id; // suppress unused warning
    result[id] = { canPublish, canSee };
  }

  return result;
}
