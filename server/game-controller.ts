import type WebSocket from 'ws';
import type {
  GameRoom,
  GameAction,
  PlayerId,
  RoomCode,
  C2SMessage,
  ClientGameState,
  ClientPlayer,
  PlayerRole,
  S2CMessage,
} from '../src/lib/game/types';
import { transition, InvalidActionError } from '../src/lib/game/state-machine';
import { createRoom, joinRoom, getRoom, updateRoom } from './room-manager';
import { encode } from './protocol';
import * as livekit from './livekit';

// Track which WS belongs to which room/player
interface ConnectionInfo {
  roomCode: RoomCode;
  playerId: PlayerId;
}

const connections = new Map<WebSocket, ConnectionInfo>();
const playerSockets = new Map<string, WebSocket>(); // `${roomCode}:${playerId}` -> ws

function socketKey(roomCode: string, playerId: string) {
  return `${roomCode}:${playerId}`;
}

export function handleConnection(ws: WebSocket): void {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as C2SMessage;
      handleMessage(ws, msg);
    } catch (err) {
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
      handleCreateRoom(ws, msg.playerName);
      break;
    case 'join_room':
      handleJoinRoom(ws, msg.roomCode, msg.playerName);
      break;
    case 'host_action':
      handleAction(ws, msg.action, true);
      break;
    case 'player_action':
      handleAction(ws, msg.action, false);
      break;
    case 'ping':
      send(ws, { type: 'pong' });
      break;
  }
}

function handleCreateRoom(ws: WebSocket, playerName: string): void {
  const { room, hostId } = createRoom(playerName);

  connections.set(ws, { roomCode: room.code, playerId: hostId });
  playerSockets.set(socketKey(room.code, hostId), ws);

  send(ws, {
    type: 'room_created',
    roomCode: room.code,
    playerId: hostId,
  });
  broadcastState(room.code);
}

function handleJoinRoom(
  ws: WebSocket,
  roomCode: string,
  playerName: string,
): void {
  const result = joinRoom(roomCode.toUpperCase(), playerName);
  if (!result) {
    send(ws, { type: 'error', message: 'Room not found or game already started' });
    return;
  }

  const { room, playerId } = result;
  connections.set(ws, { roomCode: room.code, playerId });
  playerSockets.set(socketKey(room.code, playerId), ws);

  send(ws, {
    type: 'room_joined',
    playerId,
    roomCode: room.code,
  });
  broadcastState(room.code);
}

function handleAction(
  ws: WebSocket,
  action: GameAction,
  isHostAction: boolean,
): void {
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

  // Validate host-only actions
  if (isHostAction && info.playerId !== room.hostId) {
    send(ws, { type: 'error', message: 'Only the host can do that' });
    return;
  }

  const prevPhase = room.phase;

  try {
    const newState = transition(room, action);
    updateRoom(info.roomCode, newState);

    // Handle role assignment on game start
    if (
      prevPhase.type === 'lobby' &&
      newState.phase.type === 'night'
    ) {
      notifyRoleAssignments(info.roomCode, newState);
    }

    // Handle night results when transitioning to day announcement
    if (
      prevPhase.type === 'night' &&
      newState.phase.type === 'day' &&
      newState.phase.subphase === 'announcement'
    ) {
      notifyNightResults(info.roomCode, newState);
    }

    // Handle LiveKit mute state changes
    handleMuteChanges(newState, prevPhase).catch(console.error);

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

async function handleMuteChanges(
  room: GameRoom,
  prevPhase: GameRoom['phase'],
): Promise<void> {
  const { phase, livekitRoomName, hostId } = room;

  // Night phase: mute all except host + restrict visibility
  if (phase.type === 'night' && prevPhase.type !== 'night') {
    await livekit.muteAll(livekitRoomName, hostId);
    await livekit.updateVisibility(livekitRoomName, room.players, hostId, phase);
  }

  // Night subphase change: mafia can publish during deliberation
  if (
    phase.type === 'night' &&
    prevPhase.type === 'night' &&
    phase.subphase !== prevPhase.subphase
  ) {
    await livekit.updateVisibility(livekitRoomName, room.players, hostId, phase);
  }

  // Day discussion: speaker-based muting
  if (
    phase.type === 'day' &&
    phase.subphase === 'discussion' &&
    room.speaking.currentSpeaker
  ) {
    await livekit.muteAllExceptSpeaker(
      livekitRoomName,
      room.speaking.currentSpeaker,
      hostId,
    );
  }

  // Day voting / announcement: unmute all + restore full visibility
  if (
    phase.type === 'day' &&
    (phase.subphase === 'voting' ||
      phase.subphase === 'announcement' ||
      phase.subphase === 'defense')
  ) {
    if (
      prevPhase.type === 'night' ||
      (prevPhase.type === 'day' && prevPhase.subphase === 'discussion')
    ) {
      await livekit.unmuteAll(livekitRoomName);
    }
    // Restore full visibility when entering day from night
    if (prevPhase.type === 'night') {
      await livekit.updateVisibility(livekitRoomName, room.players, hostId, phase);
    }
  }

  // Game over: restore full visibility
  if (phase.type === 'gameover' && prevPhase.type !== 'gameover') {
    await livekit.updateVisibility(livekitRoomName, room.players, hostId, phase);
  }

  // Player eliminated: set as spectator
  if (phase.type === 'gameover' || phase.type === 'day' || phase.type === 'night') {
    for (const player of Object.values(room.players)) {
      if (!player.isAlive && !player.isHost) {
        await livekit.setSpectator(livekitRoomName, player.id);
      }
    }
  }
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

function notifyNightResults(roomCode: string, room: GameRoom): void {
  const { nightActions } = room;

  // Notify sheriff of their check result
  if (nightActions.sheriffCheck && nightActions.sheriffResult !== null) {
    const sheriff = Object.values(room.players).find(
      (p) => p.role === 'sheriff' && p.isAlive,
    );
    if (sheriff) {
      const ws = playerSockets.get(socketKey(roomCode, sheriff.id));
      if (ws) {
        send(ws, {
          type: 'night_result',
          result: {
            type: 'sheriff_result',
            targetId: nightActions.sheriffCheck,
            result: nightActions.sheriffResult,
          },
        });
      }
    }
  }

  // Notify don of their check result
  if (nightActions.donCheck && nightActions.donResult !== null) {
    const don = Object.values(room.players).find(
      (p) => p.role === 'don' && p.isAlive,
    );
    if (don) {
      const ws = playerSockets.get(socketKey(roomCode, don.id));
      if (ws) {
        send(ws, {
          type: 'night_result',
          result: {
            type: 'don_result',
            targetId: nightActions.donCheck,
            result: nightActions.donResult,
          },
        });
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

function filterStateForPlayer(
  room: GameRoom,
  playerId: PlayerId,
): ClientGameState {
  const viewer = room.players[playerId];
  const isHost = viewer?.isHost ?? false;
  const viewerRole = viewer?.role;
  const isMafiaTeam = viewerRole === 'mafia' || viewerRole === 'don';
  const isGameOver = room.phase.type === 'gameover';

  const players: Record<string, ClientPlayer> = {};
  for (const [id, player] of Object.entries(room.players)) {
    let visibleRole: PlayerRole | null = null;

    if (isHost || isGameOver) {
      // Host and gameover: see all roles
      visibleRole = player.role;
    } else if (id === playerId) {
      // You see your own role
      visibleRole = player.role;
    } else if (isMafiaTeam && (player.role === 'mafia' || player.role === 'don')) {
      // Mafia sees teammates
      visibleRole = player.role;
    } else if (!player.isAlive) {
      // Dead players' roles are revealed
      visibleRole = player.role;
    }

    players[id] = {
      id: player.id,
      name: player.name,
      role: visibleRole,
      isAlive: player.isAlive,
      isHost: player.isHost,
      isConnected: player.isConnected,
    };
  }

  return {
    code: room.code,
    hostId: room.hostId,
    players,
    phase: room.phase,
    speaking: room.speaking,
    vote: room.vote,
    livekitRoomName: room.livekitRoomName,
    eliminationLog: room.eliminationLog,
  };
}

function send(ws: WebSocket, msg: S2CMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(encode(msg));
  }
}
