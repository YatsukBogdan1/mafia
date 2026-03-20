import type WebSocket from 'ws';
import type { C2SMessage } from '../src/lib/game/types';
import { transition } from '../src/lib/game/state-machine';
import { getRoom, updateRoom } from './room-manager';
import { connections, userSockets, socketKey, send } from './connection-state';
import { handleCreateRoom, handleJoinRoom, handleReconnect } from './handlers/room-handlers';
import { handleAction } from './handlers/action-handler';
import { handleCreateSandbox, handleSandboxAction, handleSwitchView } from './handlers/sandbox-handlers';
import { handleSetDeadView, broadcastState } from './handlers/state-broadcast';

export function handleConnection(ws: WebSocket): void {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as C2SMessage;
      handleMessage(ws, msg);
    } catch {
      send(ws, { type: 'error', message: 'Invalid message format' });
    }
  });

  ws.on('close', () => {
    const info = connections.get(ws);
    if (info) {
      const room = getRoom(info.roomCode);
      if (room && room.users[info.userId]) {
        const updated = transition(room, { type: 'player_leave', userId: info.userId });
        updateRoom(info.roomCode, updated);
        broadcastState(info.roomCode);
      }
      userSockets.delete(socketKey(info.roomCode, info.userId));
      connections.delete(ws);
    }
  });
}

function handleMessage(ws: WebSocket, msg: C2SMessage): void {
  switch (msg.type) {
    case 'create_room':
      handleCreateRoom(ws, msg.playerName, msg.settings);
      break;
    case 'join_room':
      handleJoinRoom(ws, msg.roomCode, msg.playerName);
      break;
    case 'reconnect':
      handleReconnect(ws, msg.roomCode, msg.userId);
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
    case 'ping':
      send(ws, { type: 'pong' });
      break;
  }
}
