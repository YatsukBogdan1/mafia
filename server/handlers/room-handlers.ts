import type WebSocket from 'ws';
import type { RoomSettings } from '../../src/lib/game/types';
import { transition } from '../../src/lib/game/state-machine';
import { createRoom, joinRoom, getRoom, updateRoom } from '../room-manager';
import type { JoinRoomResult } from '../room-manager';
import { connections, userSockets, socketKey, send } from '../connection-state';
import { broadcastState } from './state-broadcast';

export function handleCreateRoom(ws: WebSocket, playerName: string, settings?: Partial<RoomSettings>): void {
  const { room, hostId } = createRoom(playerName, settings);

  connections.set(ws, { roomCode: room.code, userId: hostId });
  userSockets.set(socketKey(room.code, hostId), ws);

  send(ws, { type: 'room_created', roomCode: room.code, userId: hostId });
  broadcastState(room.code);
}

export function handleReconnect(ws: WebSocket, roomCode: string, userId: string): void {
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

  connections.set(ws, { roomCode: room.code, userId });
  userSockets.set(socketKey(room.code, userId), ws);

  const updated = transition(room, { type: 'player_reconnect', userId });
  updateRoom(room.code, updated);

  send(ws, { type: 'reconnected', userId, roomCode: room.code, role: user.role });
  broadcastState(room.code);
}

export function handleJoinRoom(ws: WebSocket, roomCode: string, playerName: string): void {
  const result: JoinRoomResult = joinRoom(roomCode.toUpperCase(), playerName);

  if (result.status === 'not_found') {
    send(ws, { type: 'error', message: 'Room not found' });
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
    updateRoom(room.code, room);
    send(ws, { type: 'reconnected', userId, roomCode: room.code, role: user.role });
  } else {
    send(ws, { type: 'room_joined', userId, roomCode: room.code, userType: result.userType });
  }
  broadcastState(room.code);
}
