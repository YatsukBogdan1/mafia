import type WebSocket from 'ws';
import type {
  GameRoom,
  GameAction,
  PlayerId,
  RoomCode,
  C2SMessage,
  ClientGameState,
  ClientPlayer,
  DeadViewMode,
  PlayerRole,
  S2CMessage,
} from '../src/lib/game/types';
import { transition, InvalidActionError } from '../src/lib/game/state-machine';
import { createRoom, joinRoom, getRoom, updateRoom, createSandboxRoom } from './room-manager';
import { encode } from './protocol';
import * as livekit from './livekit';

interface ConnectionInfo {
  roomCode: RoomCode;
  playerId: PlayerId;
}

interface SandboxConnectionInfo {
  roomCode: RoomCode;
  hostId: PlayerId;
  playerIds: PlayerId[];
  viewingAs: PlayerId;
}

const connections = new Map<WebSocket, ConnectionInfo>();
const sandboxConnections = new Map<WebSocket, SandboxConnectionInfo>();
const playerSockets = new Map<string, WebSocket>();

function socketKey(roomCode: string, playerId: string) {
  return `${roomCode}:${playerId}`;
}

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
      if (room && room.players[info.playerId]) {
        room.players[info.playerId].isConnected = false;
        updateRoom(info.roomCode, room);
        broadcastState(info.roomCode);
      }
      playerSockets.delete(socketKey(info.roomCode, info.playerId));
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
      handleReconnect(ws, msg.roomCode, msg.playerId);
      break;
    case 'host_action':
      handleAction(ws, msg.action, true);
      break;
    case 'player_action':
      handleAction(ws, msg.action, false);
      break;
    case 'create_sandbox':
      handleCreateSandbox(ws, msg.playerCount, msg.settings);
      break;
    case 'sandbox_action':
      handleSandboxAction(ws, msg.asPlayerId, msg.action);
      break;
    case 'switch_view':
      handleSwitchView(ws, msg.playerId);
      break;
    case 'set_dead_view':
      handleSetDeadView(ws, msg.mode);
      break;
    case 'ping':
      send(ws, { type: 'pong' });
      break;
  }
}

function handleCreateRoom(ws: WebSocket, playerName: string, settings?: Partial<import('../src/lib/game/types').RoomSettings>): void {
  const { room, hostId } = createRoom(playerName, settings);

  connections.set(ws, { roomCode: room.code, playerId: hostId });
  playerSockets.set(socketKey(room.code, hostId), ws);

  send(ws, { type: 'room_created', roomCode: room.code, playerId: hostId });
  broadcastState(room.code);
}

function handleReconnect(ws: WebSocket, roomCode: string, playerId: string): void {
  const room = getRoom(roomCode.toUpperCase());
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  const player = room.players[playerId];
  if (!player) {
    send(ws, { type: 'error', message: 'Player not found in room' });
    return;
  }

  connections.set(ws, { roomCode: room.code, playerId });
  playerSockets.set(socketKey(room.code, playerId), ws);

  player.isConnected = true;
  updateRoom(room.code, room);

  send(ws, { type: 'reconnected', playerId, roomCode: room.code, role: player.role });
  broadcastState(room.code);
}

function handleJoinRoom(ws: WebSocket, roomCode: string, playerName: string): void {
  const result = joinRoom(roomCode.toUpperCase(), playerName);
  if (!result) {
    send(ws, { type: 'error', message: 'Room not found or game already started' });
    return;
  }

  const { room, playerId } = result;
  connections.set(ws, { roomCode: room.code, playerId });
  playerSockets.set(socketKey(room.code, playerId), ws);

  send(ws, { type: 'room_joined', playerId, roomCode: room.code });
  broadcastState(room.code);
}

function handleAction(ws: WebSocket, action: GameAction, isHostAction: boolean): void {
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

  if (isHostAction && info.playerId !== room.hostId) {
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

    // Notify players of role assignments when game starts
    if (room.phase.type === 'lobby' && newState.phase.type !== 'lobby') {
      notifyRoleAssignments(info.roomCode, newState);
    }

    // Disconnect kicked player
    if (action.type === 'kick_player') {
      const kickedKey = socketKey(info.roomCode, action.playerId);
      const kickedWs = playerSockets.get(kickedKey);
      if (kickedWs) {
        send(kickedWs, { type: 'error', message: 'You have been kicked from the room' });
        connections.delete(kickedWs);
        playerSockets.delete(kickedKey);
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
      const wasUnmuted = prevState.speaking.unmutedPlayers.includes(action.playerId);
      if (wasUnmuted) {
        await livekit.mutePlayer(livekitRoomName, action.playerId);
      } else {
        await livekit.unmutePlayer(livekitRoomName, action.playerId);
      }
      break;
    }
    case 'host_eliminate':
      await livekit.setSpectator(livekitRoomName, action.playerId);
      break;
    case 'reset_game':
      await livekit.unmuteAll(livekitRoomName);
      break;
  }
}

// --- Sandbox handlers ---

function handleCreateSandbox(ws: WebSocket, playerCount: number, settings?: Partial<import('../src/lib/game/types').RoomSettings>): void {
  const { room, hostId, playerIds, playerNames } = createSandboxRoom(playerCount, settings);

  const info: SandboxConnectionInfo = { roomCode: room.code, hostId, playerIds, viewingAs: hostId };
  sandboxConnections.set(ws, info);

  send(ws, { type: 'sandbox_created', roomCode: room.code, hostId, playerIds, playerNames });
  sendSandboxView(ws, room.code, hostId);
}

function handleSandboxAction(ws: WebSocket, _asPlayerId: PlayerId, action: GameAction): void {
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

function handleSetDeadView(ws: WebSocket, mode: DeadViewMode): void {
  const info = connections.get(ws);
  if (!info) { send(ws, { type: 'error', message: 'Not in a room' }); return; }

  const room = getRoom(info.roomCode);
  if (!room) { send(ws, { type: 'error', message: 'Room not found' }); return; }

  const player = room.players[info.playerId];
  if (!player || player.isAlive) {
    send(ws, { type: 'error', message: 'Only dead players can change view mode' });
    return;
  }

  room.deadViewMode[info.playerId] = mode;
  updateRoom(info.roomCode, room);

  const state = filterStateForPlayer(room, info.playerId);
  send(ws, { type: 'state_update', state });
}

function handleSwitchView(ws: WebSocket, playerId: PlayerId): void {
  const sandbox = sandboxConnections.get(ws);
  if (!sandbox) { send(ws, { type: 'error', message: 'Not in a sandbox' }); return; }

  sandbox.viewingAs = playerId;
  sendSandboxView(ws, sandbox.roomCode, playerId);
}

function sendSandboxView(ws: WebSocket, roomCode: string, playerId: PlayerId): void {
  const room = getRoom(roomCode);
  if (!room) return;

  const player = room.players[playerId];
  const state = filterStateForPlayer(room, playerId);
  const mediaStates = livekit.computeMediaStates(room.players, room.phase);

  send(ws, {
    type: 'sandbox_view',
    playerId,
    state,
    role: player?.role ?? null,
    mediaStates,
  });
}

function notifyRoleAssignments(roomCode: string, room: GameRoom): void {
  for (const player of Object.values(room.players)) {
    if (player.role && !player.isHost) {
      const ws = playerSockets.get(socketKey(roomCode, player.id));
      if (ws) {
        send(ws, { type: 'role_assigned', role: player.role });
      }
    }
  }
}

function broadcastState(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room) return;

  for (const player of Object.values(room.players)) {
    const ws = playerSockets.get(socketKey(roomCode, player.id));
    if (ws) {
      const state = filterStateForPlayer(room, player.id);
      send(ws, { type: 'state_update', state });
    }
  }
}

function filterStateForPlayer(room: GameRoom, playerId: PlayerId): ClientGameState {
  const viewer = room.players[playerId];
  const isHost = viewer?.isHost ?? false;
  const viewerRole = viewer?.role;
  const isMafiaTeam = viewerRole === 'mafia' || viewerRole === 'don';
  const isGameOver = room.phase.type === 'gameover';
  const isDeadSpectator =
    viewer && !viewer.isAlive && !viewer.isHost &&
    (room.deadViewMode[playerId] ?? 'spectator') === 'spectator';

  const players: Record<string, ClientPlayer> = {};
  for (const [id, player] of Object.entries(room.players)) {
    let visibleRole: PlayerRole | null = null;

    if (isHost || isGameOver || isDeadSpectator) {
      visibleRole = player.role;
    } else if (id === playerId) {
      visibleRole = player.role;
    } else if (isMafiaTeam && (player.role === 'mafia' || player.role === 'don')) {
      visibleRole = player.role;
    }

    players[id] = {
      id: player.id,
      name: player.name,
      seatNumber: player.seatNumber,
      role: visibleRole,
      isAlive: player.isAlive,
      isHost: player.isHost,
      isConnected: player.isConnected,
    };
  }

  const myDeadViewMode =
    viewer && !viewer.isAlive && !viewer.isHost
      ? (room.deadViewMode[playerId] ?? 'spectator')
      : undefined;

  return {
    code: room.code,
    hostId: room.hostId,
    players,
    playerOrder: room.playerOrder,
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

function send(ws: WebSocket, msg: S2CMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(encode(msg));
  }
}
