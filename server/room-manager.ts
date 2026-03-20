import { nanoid } from 'nanoid';
import type { GameRoom, UserId, UserType, RoomSettings } from '../src/lib/game/types';
import {
  createEmptySpeakingState,
  createEmptyVoteState,
  DEFAULT_ROOM_SETTINGS,
} from '../src/lib/game/types';
import { ROOM_CODE_LENGTH } from '../src/lib/game/constants';
import { transition } from '../src/lib/game/state-machine';

const rooms = new Map<string, GameRoom>();

export function createRoom(
  hostName: string,
  settingsOverride?: Partial<RoomSettings>,
  explicitHostId?: string,
): { room: GameRoom; hostId: UserId } {
  const code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  const hostId = explicitHostId ?? nanoid(10);

  const room: GameRoom = {
    code,
    hostId,
    users: {
      [hostId]: {
        id: hostId,
        name: hostName,
        seatNumber: null,
        role: null,
        isAlive: true,
        type: 'host',
        isConnected: true,
      },
    },
    userOrder: [],
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

export type JoinRoomResult =
  | { status: 'joined'; room: GameRoom; userId: UserId; userType: UserType }
  | { status: 'reconnected'; room: GameRoom; userId: UserId; userType: UserType }
  | { status: 'already_connected' }
  | { status: 'name_taken' }
  | { status: 'not_found' };

export function joinRoom(code: string, playerName: string, userId: string): JoinRoomResult {
  const room = rooms.get(code);
  if (!room) return { status: 'not_found' };

  const existing = room.users[userId];
  if (existing) {
    if (existing.isConnected) return { status: 'already_connected' };
    const reconnected = transition(room, { type: 'player_reconnect', userId });
    rooms.set(code, reconnected);
    return { status: 'reconnected', room: reconnected, userId, userType: existing.type };
  }

  // First time this user joins — check name conflict with other users
  const nameTaken = Object.values(room.users).some(
    u => u.id !== userId && u.name.trim().toLowerCase() === playerName.trim().toLowerCase(),
  );
  if (nameTaken) return { status: 'name_taken' };

  const updated = transition(room, { type: 'player_join', userId, name: playerName });
  rooms.set(code, updated);
  return { status: 'joined', room: updated, userId, userType: updated.users[userId].type };
}

export interface RoomSummary {
  code: string;
  hostName: string;
  playerCount: number;
  phase: GameRoom['phase']['type'];
}

export function listRooms(): RoomSummary[] {
  const result: RoomSummary[] = [];
  for (const room of rooms.values()) {
    const host = room.users[room.hostId];
    result.push({
      code: room.code,
      hostName: host?.name ?? 'Unknown',
      playerCount: Object.values(room.users).filter(u => u.type !== 'host').length,
      phase: room.phase.type,
    });
  }
  return result;
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

const USER_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
  'Frank', 'Grace', 'Hank', 'Iris', 'Jack', 'Kate',
];

export function createSandboxRoom(
  userCount: number,
  settingsOverride?: Partial<RoomSettings>,
): { room: GameRoom; hostId: UserId; userIds: UserId[]; userNames: Record<UserId, string> } {
  const code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  const hostId = nanoid(10);

  const users: Record<UserId, GameRoom['users'][string]> = {
    [hostId]: {
      id: hostId,
      name: 'Host',
      seatNumber: null,
      role: null,
      isAlive: true,
      type: 'host',
      isConnected: true,
    },
  };

  const userIds: UserId[] = [];
  const userNames: Record<UserId, string> = { [hostId]: 'Host' };

  const count = Math.min(userCount, USER_NAMES.length);
  for (let i = 0; i < count; i++) {
    const id = nanoid(10);
    const name = USER_NAMES[i];
    users[id] = { id, name, seatNumber: null, role: null, isAlive: true, type: 'player', isConnected: true };
    userIds.push(id);
    userNames[id] = name;
  }

  const room: GameRoom = {
    code,
    hostId,
    users,
    userOrder: userIds,
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
  return { room, hostId, userIds, userNames };
}
