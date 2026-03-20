import type WebSocket from 'ws';
import type { UserId, GameAction, RoomSettings } from '../../src/lib/game/types';
import { transition, InvalidActionError } from '../../src/lib/game/state-machine';
import { getRoom, updateRoom, createSandboxRoom } from '../room-manager';
import * as livekit from '../livekit';
import { sandboxConnections, send } from '../connection-state';
import { filterStateForUser } from './state-broadcast';

export function handleCreateSandbox(ws: WebSocket, userCount: number, settings?: Partial<RoomSettings>): void {
  const { room, hostId, userIds, userNames } = createSandboxRoom(userCount, settings);

  sandboxConnections.set(ws, { roomCode: room.code, hostId, userIds, viewingAs: hostId });

  send(ws, { type: 'sandbox_created', roomCode: room.code, hostId, userIds, userNames });
  sendSandboxView(ws, room.code, hostId);
}

export function handleSandboxAction(ws: WebSocket, _asUserId: UserId, action: GameAction): void {
  const sandbox = sandboxConnections.get(ws);
  if (!sandbox) {
    send(ws, { type: 'error', message: 'Not in a sandbox' });
    return;
  }

  const room = getRoom(sandbox.roomCode);
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  try {
    const newState = transition(room, action);
    updateRoom(sandbox.roomCode, newState);
    sendSandboxView(ws, sandbox.roomCode, sandbox.viewingAs);
  } catch (err) {
    if (err instanceof InvalidActionError) {
      send(ws, { type: 'error', message: err.message });
    } else {
      console.error('Sandbox action error:', err);
      send(ws, { type: 'error', message: 'Internal error' });
    }
  }
}

export function handleSwitchView(ws: WebSocket, userId: UserId): void {
  const sandbox = sandboxConnections.get(ws);
  if (!sandbox) { send(ws, { type: 'error', message: 'Not in a sandbox' }); return; }

  sandbox.viewingAs = userId;
  sendSandboxView(ws, sandbox.roomCode, userId);
}

function sendSandboxView(ws: WebSocket, roomCode: string, userId: UserId): void {
  const room = getRoom(roomCode);
  if (!room) return;

  const user = room.users[userId];
  const state = filterStateForUser(room, userId);
  const mediaStates = livekit.computeMediaStates(room.users, room.phase);

  send(ws, {
    type: 'sandbox_view',
    userId,
    state,
    role: user?.role ?? null,
    mediaStates,
  });
}
