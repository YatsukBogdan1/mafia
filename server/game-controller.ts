import type WebSocket from 'ws';
import type { C2SMessage } from '../src/lib/game/types';
import { transition } from '../src/lib/game/state-machine';
import { getRoom, updateRoom, listRooms } from './room-manager';
import { connections, userSockets, socketKey, send } from './connection-state';
import { handleCreateRoom, handleJoinRoom, handleReconnect } from './handlers/room-handlers';
import { handleAction } from './handlers/action-handler';
import { handleCreateSandbox, handleSandboxAction, handleSwitchView } from './handlers/sandbox-handlers';
import { handleSetDeadView, broadcastState } from './handlers/state-broadcast';

export function handleConnection(ws: WebSocket, authUserId: string | null): void {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as C2SMessage;
      handleMessage(ws, msg, authUserId);
    } catch {
      send(ws, { type: 'error', message: 'Invalid message format' });
    }
  });

  ws.on('close', () => {
    const info = connections.get(ws);
    if (!info) return;

    connections.delete(ws);

    // Only mark user as disconnected if this socket is still the active one.
    // A newer socket may have already replaced it via reconnect.
    const key = socketKey(info.roomCode, info.userId);
    if (userSockets.get(key) !== ws) return;

    userSockets.delete(key);
    const room = getRoom(info.roomCode);
    if (room && room.users[info.userId]) {
      const updated = transition(room, { type: 'player_leave', userId: info.userId });
      updateRoom(info.roomCode, updated);
      broadcastState(info.roomCode);
    }
  });
}

function handleMessage(ws: WebSocket, msg: C2SMessage, authUserId: string | null): void {
  switch (msg.type) {
    case 'create_room':
      handleCreateRoom(ws, msg.playerName, msg.settings, authUserId);
      break;
    case 'join_room':
      handleJoinRoom(ws, msg.roomCode, msg.playerName, authUserId);
      break;
    case 'reconnect':
      handleReconnect(ws, msg.roomCode, msg.userId, authUserId);
      break;
    case 'host_action':
      handleAction(ws, msg.action, true);
      break;
    case 'player_action':
      handleAction(ws, msg.action, false);
      break;
    case 'create_sandbox':
      handleCreateSandbox(ws, msg.userCount, msg.settings);
      break;
    case 'sandbox_action':
      handleSandboxAction(ws, msg.asUserId, msg.action);
      break;
    case 'switch_view':
      handleSwitchView(ws, msg.userId);
      break;
    case 'set_dead_view':
      handleSetDeadView(ws, msg.mode);
      break;
    case 'list_rooms':
      send(ws, { type: 'room_list', rooms: listRooms() });
      break;
    case 'ping':
      send(ws, { type: 'pong' });
      break;
  }
}
