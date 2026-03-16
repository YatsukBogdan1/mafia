import { nanoid } from 'nanoid';
import type { GameRoom, PlayerId } from '../src/lib/game/types';
import {
  createEmptyNightActions,
  createEmptySpeakingState,
  createEmptyVoteState,
} from '../src/lib/game/types';
import { ROOM_CODE_LENGTH } from '../src/lib/game/constants';

const rooms = new Map<string, GameRoom>();

export function createRoom(hostName: string): { room: GameRoom; hostId: PlayerId } {
  const code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  const hostId = nanoid(10);

  const room: GameRoom = {
    code,
    hostId,
    players: {
      [hostId]: {
        id: hostId,
        name: hostName,
        role: null,
        isAlive: true,
        isHost: true,
        isConnected: true,
      },
    },
    phase: { type: 'lobby' },
    speaking: createEmptySpeakingState(),
    vote: createEmptyVoteState(),
    nightActions: createEmptyNightActions(),
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
