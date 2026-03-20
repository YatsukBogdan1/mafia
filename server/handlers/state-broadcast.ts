import type WebSocket from 'ws';
import type {
  GameRoom, UserId, ClientGameState, ClientUser, PlayerRole, DeadViewMode,
} from '../../src/lib/game/types';
import { getRoom, updateRoom } from '../room-manager';
import { connections, userSockets, socketKey, send } from '../connection-state';

export function broadcastState(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room) return;

  for (const user of Object.values(room.users)) {
    const ws = userSockets.get(socketKey(roomCode, user.id));
    if (ws) {
      const state = filterStateForUser(room, user.id);
      send(ws, { type: 'state_update', state });
    }
  }
}

export function notifyRoleAssignments(roomCode: string, room: GameRoom): void {
  for (const user of Object.values(room.users)) {
    if (user.role && user.type !== 'host') {
      const ws = userSockets.get(socketKey(roomCode, user.id));
      if (ws) {
        send(ws, { type: 'role_assigned', role: user.role });
      }
    }
  }
}

export function handleSetDeadView(ws: WebSocket, mode: DeadViewMode): void {
  const info = connections.get(ws);
  if (!info) { send(ws, { type: 'error', message: 'Not in a room' }); return; }

  const room = getRoom(info.roomCode);
  if (!room) { send(ws, { type: 'error', message: 'Room not found' }); return; }

  const user = room.users[info.userId];
  if (!user || user.isAlive) {
    send(ws, { type: 'error', message: 'Only dead players can change view mode' });
    return;
  }

  room.deadViewMode[info.userId] = mode;
  updateRoom(info.roomCode, room);

  const state = filterStateForUser(room, info.userId);
  send(ws, { type: 'state_update', state });
}

export function filterStateForUser(room: GameRoom, userId: UserId): ClientGameState {
  const viewer = room.users[userId];
  const isHost = viewer?.type === 'host';
  const viewerRole = viewer?.role;
  const isMafiaTeam = viewerRole === 'mafia' || viewerRole === 'don';
  const isGameOver = room.phase.type === 'gameover';
  const isDeadSpectator =
    viewer && !viewer.isAlive && viewer.type === 'player' &&
    (room.deadViewMode[userId] ?? 'spectator') === 'spectator';

  const users: Record<string, ClientUser> = {};
  for (const [id, user] of Object.entries(room.users)) {
    let visibleRole: PlayerRole | null = null;

    if (isHost || isGameOver || isDeadSpectator) {
      visibleRole = user.role;
    } else if (id === userId) {
      visibleRole = user.role;
    } else if (isMafiaTeam && (user.role === 'mafia' || user.role === 'don')) {
      visibleRole = user.role;
    }

    users[id] = {
      id: user.id,
      name: user.name,
      seatNumber: user.seatNumber,
      role: visibleRole,
      isAlive: user.isAlive,
      type: user.type,
      isConnected: user.isConnected,
    };
  }

  const myDeadViewMode =
    viewer && !viewer.isAlive && viewer.type === 'player'
      ? (room.deadViewMode[userId] ?? 'spectator')
      : undefined;

  return {
    code: room.code,
    hostId: room.hostId,
    users,
    userOrder: room.userOrder,
    phase: room.phase,
    round: room.round,
    speaking: room.speaking,
    vote: room.vote,
    settings: room.settings,
    livekitRoomName: room.livekitRoomName,
    eliminationLog: room.eliminationLog,
    myDeadViewMode,
  };
}
