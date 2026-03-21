import type WebSocket from 'ws';
import type { RoomSettings, User } from '../../src/lib/game/types';
import { transition } from '../../src/lib/game/state-machine';
import { createRoom, joinRoom, getRoom, updateRoom } from '../room-manager';
import type { JoinRoomResult } from '../room-manager';
import { User as UserModel } from '../models/user';
import { connections, userSockets, socketKey, send } from '../connection-state';
import { broadcastState } from './state-broadcast';

export async function handleCreateRoom(
  ws: WebSocket,
  playerName: string,
  settings: Partial<RoomSettings> | undefined,
  authUserId: string | null,
): Promise<void> {
  if (!authUserId) {
    send(ws, { type: 'error', message: 'Authentication required' });
    return;
  }

  const dbUser = await UserModel.findById(authUserId).select('-password');
  if (!dbUser) {
    send(ws, { type: 'error', message: 'User not found' });
    return;
  }

  const host: User = {
    id: dbUser._id.toString(),
    name: dbUser.displayName || playerName,
    seatNumber: null,
    role: null,
    isAlive: true,
    type: 'host',
    isConnected: true,
  };

  const room = createRoom(host, settings);

  connections.set(ws, { roomCode: room.code, userId: authUserId });
  userSockets.set(socketKey(room.code, authUserId), ws);

  send(ws, { type: 'room_created', roomCode: room.code, userId: authUserId });
  broadcastState(room.code);
}

export function handleReconnect(
  ws: WebSocket,
  roomCode: string,
  clientUserId: string,
  authUserId: string | null,
): void {
  // Prefer the server-verified identity; fall back to the client-supplied id
  // only for unauthenticated (sandbox/test) connections.
  const userId = authUserId ?? clientUserId;

  const room = getRoom(roomCode.toUpperCase());
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  const user = room.users[userId];
  if (!user) {
    send(ws, { type: 'error', message: 'Player not found in room' });
    return;
  }

  // If there's already an active socket for this user, notify and close it
  const key = socketKey(room.code, userId);
  const oldWs = userSockets.get(key);
  if (oldWs && oldWs !== ws && oldWs.readyState === oldWs.OPEN) {
    connections.delete(oldWs);
    send(oldWs, { type: 'session_replaced' });
    oldWs.close();
  }

  connections.set(ws, { roomCode: room.code, userId });
  userSockets.set(key, ws);

  const updated = transition(room, { type: 'player_reconnect', userId });
  updateRoom(room.code, updated);

  send(ws, { type: 'reconnected', userId, roomCode: room.code, role: user.role });
  broadcastState(room.code);
}

export function handleJoinRoom(
  ws: WebSocket,
  roomCode: string,
  playerName: string,
  authUserId: string | null,
): void {
  if (!authUserId) {
    send(ws, { type: 'error', message: 'Authentication required' });
    return;
  }
  const result: JoinRoomResult = joinRoom(roomCode.toUpperCase(), playerName, authUserId);

  if (result.status === 'not_found') {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }
  if (result.status === 'already_connected') {
    send(ws, { type: 'error', message: 'You are already connected to this room in another tab' });
    return;
  }
  if (result.status === 'name_taken') {
    send(ws, { type: 'error', message: 'Name already taken in this room' });
    return;
  }

  const { room, userId } = result;
  connections.set(ws, { roomCode: room.code, userId });
  userSockets.set(socketKey(room.code, userId), ws);

  if (result.status === 'reconnected') {
    const user = room.users[userId];
    send(ws, { type: 'reconnected', userId, roomCode: room.code, role: user.role });
  } else {
    send(ws, { type: 'room_joined', userId, roomCode: room.code, userType: result.userType });
  }
  broadcastState(room.code);
}
