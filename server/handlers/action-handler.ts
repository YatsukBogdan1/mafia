import type WebSocket from 'ws';
import type { GameRoom, GameAction } from '../../src/lib/game/types';
import { transition, InvalidActionError } from '../../src/lib/game/state-machine';
import { getRoom, updateRoom } from '../room-manager';
import * as livekit from '../livekit';
import { connections, userSockets, socketKey, send } from '../connection-state';
import { broadcastState, notifyRoleAssignments } from './state-broadcast';

export function handleAction(ws: WebSocket, action: GameAction, isHostAction: boolean): void {
  const info = connections.get(ws);
  if (!info) {
    send(ws, { type: 'error', message: 'Not in a room' });
    return;
  }

  const room = getRoom(info.roomCode);
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  if (room.users[info.userId]?.type === 'spectator') {
    send(ws, { type: 'error', message: 'Spectators cannot take actions' });
    return;
  }

  if (isHostAction && info.userId !== room.hostId) {
    send(ws, { type: 'error', message: 'Only the host can do that' });
    return;
  }

  // Validate player-side actions
  if (!isHostAction) {
    const allowed: GameAction['type'][] = ['cast_vote', 'become_host'];
    if (!allowed.includes(action.type)) {
      send(ws, { type: 'error', message: 'Action not allowed for players' });
      return;
    }
  }

  try {
    const newState = transition(room, action);
    updateRoom(info.roomCode, newState);

    // LiveKit side effects for host actions
    if (isHostAction) {
      handleLivekitSideEffects(room, newState, action).catch(console.error);
    }

    // Notify users of role assignments when host assigns them
    if (action.type === 'assign_roles') {
      notifyRoleAssignments(info.roomCode, newState);
    }

    // Disconnect kicked user
    if (action.type === 'kick_player') {
      const kickedKey = socketKey(info.roomCode, action.userId);
      const kickedWs = userSockets.get(kickedKey);
      if (kickedWs) {
        send(kickedWs, { type: 'kicked' });
        connections.delete(kickedWs);
        userSockets.delete(kickedKey);
        kickedWs.close();
      }
    }

    broadcastState(info.roomCode);
  } catch (err) {
    if (err instanceof InvalidActionError) {
      send(ws, { type: 'error', message: err.message });
    } else {
      console.error('Action error:', err);
      send(ws, { type: 'error', message: 'Internal error' });
    }
  }
}

async function handleLivekitSideEffects(prevState: GameRoom, newState: GameRoom, action: GameAction): Promise<void> {
  const { livekitRoomName, hostId } = newState;

  switch (action.type) {
    case 'mute_all':
      await livekit.muteAll(livekitRoomName, hostId);
      break;
    case 'unmute_all':
      await livekit.unmuteAll(livekitRoomName);
      break;
    case 'grant_speaking': {
      const wasUnmuted = prevState.speaking.unmutedUsers.includes(action.userId);
      if (wasUnmuted) {
        await livekit.muteUser(livekitRoomName, action.userId);
      } else {
        await livekit.unmuteUser(livekitRoomName, action.userId);
      }
      break;
    }
    case 'host_eliminate':
    case 'vote_eliminate':
      await livekit.setSpectator(livekitRoomName, action.userId);
      break;
    case 'reset_game':
      await livekit.unmuteAll(livekitRoomName);
      break;
  }
}
