import { nanoid } from 'nanoid';
import type { GameRoom, PlayerId, RoomSettings } from '../src/lib/game/types';
import {
  createEmptySpeakingState,
  createEmptyVoteState,
  DEFAULT_ROOM_SETTINGS,
} from '../src/lib/game/types';
import { ROOM_CODE_LENGTH } from '../src/lib/game/constants';

const rooms = new Map<string, GameRoom>();

export function createRoom(
  hostName: string,
  settingsOverride?: Partial<RoomSettings>,
): { room: GameRoom; hostId: PlayerId } {
  const code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  const hostId = nanoid(10);

  const room: GameRoom = {
    code,
    hostId,
    players: {
      [hostId]: {
        id: hostId,
        name: hostName,
        seatNumber: null,
        role: null,
        isAlive: true,
        isHost: true,
        isConnected: true,
      },
    },
    playerOrder: [],
    phase: { type: 'lobby' },
    round: 1,
    speaking: createEmptySpeakingState(),
    vote: createEmptyVoteState(),
    settings: { ...DEFAULT_ROOM_SETTINGS, ...settingsOverride },
    deadViewMode: {},
    eliminationLog: [],
    livekitRoomName: `mafia-${code}`,
  };

  rooms.set(code, room);
  return { room, hostId };
}

export function joinRoom(
  code: string,
  playerName: string,
): { room: GameRoom; playerId: PlayerId } | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.phase.type !== 'lobby') return null;

  const playerId = nanoid(10);
  room.players[playerId] = {
    id: playerId,
    name: playerName,
    seatNumber: null,
    role: null,
    isAlive: true,
    isHost: false,
    isConnected: true,
  };

  return { room, playerId };
}

export function getRoom(code: string): GameRoom | undefined {
  return rooms.get(code);
}

export function updateRoom(code: string, room: GameRoom): void {
  rooms.set(code, room);
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

const PLAYER_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
  'Frank', 'Grace', 'Hank', 'Iris', 'Jack', 'Kate',
];

export function createSandboxRoom(
  playerCount: number,
  settingsOverride?: Partial<RoomSettings>,
): { room: GameRoom; hostId: PlayerId; playerIds: PlayerId[]; playerNames: Record<PlayerId, string> } {
  const code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  const hostId = nanoid(10);

  const players: Record<PlayerId, GameRoom['players'][string]> = {
    [hostId]: {
      id: hostId,
      name: 'Host',
      seatNumber: null,
      role: null,
      isAlive: true,
      isHost: true,
      isConnected: true,
    },
  };

  const playerIds: PlayerId[] = [];
  const playerNames: Record<PlayerId, string> = { [hostId]: 'Host' };

  const count = Math.min(playerCount, PLAYER_NAMES.length);
  for (let i = 0; i < count; i++) {
    const id = nanoid(10);
    const name = PLAYER_NAMES[i];
    players[id] = { id, name, seatNumber: null, role: null, isAlive: true, isHost: false, isConnected: true };
    playerIds.push(id);
    playerNames[id] = name;
  }

  const room: GameRoom = {
    code,
    hostId,
    players,
    playerOrder: playerIds,
    phase: { type: 'lobby' },
    round: 1,
    speaking: createEmptySpeakingState(),
    vote: createEmptyVoteState(),
    settings: { ...DEFAULT_ROOM_SETTINGS, ...settingsOverride },
    deadViewMode: {},
    eliminationLog: [],
    livekitRoomName: `mafia-sandbox-${code}`,
  };

  rooms.set(code, room);
  return { room, hostId, playerIds, playerNames };
}
