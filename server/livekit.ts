import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import type { UserId, User, GamePhase } from '../src/lib/game/types';

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

export async function muteAll(roomName: string, hostId: UserId): Promise<void> {
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

export async function muteUser(roomName: string, userId: UserId): Promise<void> {
  const svc = getClient();
  try {
    await svc.updateParticipant(roomName, userId, undefined, CAMERA_ONLY);
  } catch (err) {
    console.error('Failed to mute user:', err);
  }
}

export async function unmuteUser(roomName: string, userId: UserId): Promise<void> {
  const svc = getClient();
  try {
    await svc.updateParticipant(roomName, userId, undefined, FULL_PUBLISH);
  } catch (err) {
    console.error('Failed to unmute user:', err);
  }
}

export async function setSpectator(roomName: string, userId: UserId): Promise<void> {
  const svc = getClient();
  try {
    // Dead users: no camera or mic
    await svc.updateParticipant(roomName, userId, undefined, NO_PUBLISH);
  } catch (err) {
    console.error('Failed to set spectator:', err);
  }
}

/**
 * Pure computation of what each user can see/hear.
 * Used by sandbox for display.
 */
export interface UserMediaState {
  canPublish: boolean;
  canSee: UserId[];
}

export function computeMediaStates(
  users: Record<UserId, User>,
  phase: GamePhase,
): Record<UserId, UserMediaState> {
  const result: Record<UserId, UserMediaState> = {};
  const allIds = Object.keys(users);

  const deadIds = new Set(
    Object.values(users)
      .filter((u) => !u.isAlive && u.type !== 'host')
      .map((u) => u.id),
  );

  for (const [id, user] of Object.entries(users)) {
    // canPublish: dead non-host users can't publish
    const canPublish = user.isAlive || user.type === 'host';

    // canSee: everyone sees everyone except dead users (only host sees dead)
    const canSee = user.type === 'host' || phase.type === 'gameover'
      ? allIds
      : allIds.filter((uid) => !deadIds.has(uid));
    void phase; // used above

    void id; // suppress unused warning
    result[id] = { canPublish, canSee };
  }

  return result;
}
