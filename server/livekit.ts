import { RoomServiceClient } from 'livekit-server-sdk';
import type { PlayerId, Player, GamePhase } from '../src/lib/game/types';

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

export async function muteAllExceptSpeaker(
  roomName: string,
  speakerId: PlayerId,
  hostId: PlayerId,
): Promise<void> {
  const svc = getClient();
  try {
    const participants = await svc.listParticipants(roomName);
    for (const p of participants) {
      const canPublish =
        p.identity === speakerId || p.identity === hostId;
      await svc.updateParticipant(roomName, p.identity, undefined, {
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      });
    }
  } catch (err) {
    console.error('Failed to update mute state:', err);
  }
}

export async function muteAll(
  roomName: string,
  hostId: PlayerId,
): Promise<void> {
  const svc = getClient();
  try {
    const participants = await svc.listParticipants(roomName);
    for (const p of participants) {
      const canPublish = p.identity === hostId;
      await svc.updateParticipant(roomName, p.identity, undefined, {
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      });
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
      await svc.updateParticipant(roomName, p.identity, undefined, {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
    }
  } catch (err) {
    console.error('Failed to unmute all:', err);
  }
}

export async function setSpectator(
  roomName: string,
  playerId: PlayerId,
): Promise<void> {
  const svc = getClient();
  try {
    await svc.updateParticipant(roomName, playerId, undefined, {
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    });
  } catch (err) {
    console.error('Failed to set spectator:', err);
  }
}

/**
 * Controls which video/audio tracks each participant can see.
 *
 * Night phase: villagers/sheriff only see host. Mafia see host + mafia team.
 * Day/lobby/gameover: everyone sees everyone.
 */
export async function updateVisibility(
  roomName: string,
  players: Record<PlayerId, Player>,
  hostId: PlayerId,
  phase: GamePhase,
): Promise<void> {
  const svc = getClient();
  try {
    const participants = await svc.listParticipants(roomName);

    // Build a map of identity -> published track SIDs
    const tracksByIdentity = new Map<string, string[]>();
    for (const p of participants) {
      const sids = p.tracks.map((t) => t.sid);
      tracksByIdentity.set(p.identity, sids);
    }

    // All track SIDs in the room
    const allTrackSids = participants.flatMap((p) => p.tracks.map((t) => t.sid));
    if (allTrackSids.length === 0) return;

    const isNight = phase.type === 'night';

    for (const p of participants) {
      const player = players[p.identity];
      if (!player) continue;

      if (isNight && !player.isHost) {
        const isMafiaTeam =
          player.role === 'mafia' || player.role === 'don';

        // Tracks this participant SHOULD see
        const allowedTrackSids: string[] = [];

        // Everyone sees host during night
        const hostTracks = tracksByIdentity.get(hostId) || [];
        allowedTrackSids.push(...hostTracks);

        if (isMafiaTeam) {
          // Mafia sees other mafia members
          for (const [identity, sids] of tracksByIdentity) {
            const other = players[identity];
            if (
              other &&
              !other.isHost &&
              (other.role === 'mafia' || other.role === 'don')
            ) {
              allowedTrackSids.push(...sids);
            }
          }
        }

        // Unsubscribe from tracks they shouldn't see
        const blockedSids = allTrackSids.filter(
          (sid) => !allowedTrackSids.includes(sid),
        );
        if (blockedSids.length > 0) {
          await svc.updateSubscriptions(roomName, p.identity, blockedSids, false);
        }
        // Subscribe to allowed tracks
        if (allowedTrackSids.length > 0) {
          await svc.updateSubscriptions(roomName, p.identity, allowedTrackSids, true);
        }
      } else {
        // Day / lobby / gameover / host: subscribe to everything
        if (allTrackSids.length > 0) {
          await svc.updateSubscriptions(roomName, p.identity, allTrackSids, true);
        }
      }
    }
  } catch (err) {
    console.error('Failed to update visibility:', err);
  }
}
