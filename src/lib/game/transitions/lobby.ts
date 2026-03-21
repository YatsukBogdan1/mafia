import type { GameRoom, UserId, RoomSettings } from '../types';
import { createEmptySpeakingState, createEmptyVoteState } from '../types';
import { MIN_PLAYERS } from '../constants';
import { assignRoles } from '../role-assigner';
import { InvalidActionError } from '../state-machine';
import { shuffle, getAliveUsers } from './helpers';

export function handlePlayerJoin(state: GameRoom, userId: UserId, name: string): GameRoom {
  const userType = state.phase.type === 'lobby' ? 'player' : 'spectator';
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: {
        id: userId, name, seatNumber: null, role: null,
        isAlive: true, type: userType, isConnected: true,
      },
    },
  };
}

export function handlePlayerLeave(state: GameRoom, userId: UserId): GameRoom {
  const user = state.users[userId];
  if (!user) throw new InvalidActionError('Player not found');

  // In lobby: remove the player entirely (no game state to preserve)
  // But never remove the host — just mark them disconnected so they can reconnect
  if (state.phase.type === 'lobby') {
    if (user.type === 'host') {
      return {
        ...state,
        users: { ...state.users, [userId]: { ...user, isConnected: false } },
      };
    }
    const { [userId]: _, ...remaining } = state.users;
    return { ...state, users: remaining };
  }

  // During game/gameover: just mark disconnected to keep game consistent
  return {
    ...state,
    users: { ...state.users, [userId]: { ...user, isConnected: false } },
  };
}

export function handlePlayerReconnect(state: GameRoom, userId: UserId): GameRoom {
  const user = state.users[userId];
  if (!user) throw new InvalidActionError('Player not found');
  return {
    ...state,
    users: { ...state.users, [userId]: { ...user, isConnected: true } },
  };
}

export function handleStartGame(state: GameRoom): GameRoom {
  if (state.phase.type !== 'lobby') {
    throw new InvalidActionError('Game already started');
  }

  const userIds = getAliveUsers(state).map((u) => u.id);
  if (userIds.length < MIN_PLAYERS) {
    throw new InvalidActionError(`Need at least ${MIN_PLAYERS} players, have ${userIds.length}`);
  }

  const seatedOrder = shuffle(userIds);
  const users = { ...state.users };
  for (let i = 0; i < seatedOrder.length; i++) {
    users[seatedOrder[i]] = { ...users[seatedOrder[i]], seatNumber: i + 1 };
  }

  return {
    ...state,
    users,
    userOrder: seatedOrder,
    phase: { type: 'game' },
    speaking: { unmutedUsers: userIds },
    vote: createEmptyVoteState(),
  };
}

export function handleAssignRoles(state: GameRoom): GameRoom {
  if (state.phase.type !== 'game') {
    throw new InvalidActionError('Game not started');
  }
  if (state.userOrder.length > 0 && state.users[state.userOrder[0]]?.role !== null) {
    throw new InvalidActionError('Roles already assigned');
  }

  const userIds = state.userOrder.filter(id => {
    const u = state.users[id];
    return u?.isAlive && u.type === 'player';
  });
  const roleAssignments = assignRoles(userIds, state.settings.roleDistribution);
  const users = { ...state.users };
  for (const [id, role] of Object.entries(roleAssignments)) {
    users[id] = { ...users[id], role };
  }

  return { ...state, users };
}

export function handleKickPlayer(state: GameRoom, userId: UserId): GameRoom {
  if (state.phase.type !== 'lobby') {
    throw new InvalidActionError('Can only kick players in lobby');
  }
  const user = state.users[userId];
  if (!user) throw new InvalidActionError('Player not found');
  if (user.type === 'host') throw new InvalidActionError('Cannot kick the host');

  const { [userId]: _, ...remaining } = state.users;
  return { ...state, users: remaining };
}

export function handleBecomeHost(state: GameRoom, userId: UserId): GameRoom {
  if (state.phase.type !== 'lobby') {
    throw new InvalidActionError('Can only change host in lobby');
  }
  const user = state.users[userId];
  if (!user) throw new InvalidActionError('Player not found');
  if (user.type === 'host') throw new InvalidActionError('Already the host');

  const oldHostId = state.hostId;
  const users = { ...state.users };
  users[oldHostId] = { ...users[oldHostId], type: 'player' };
  users[userId] = { ...users[userId], type: 'host' };

  return { ...state, hostId: userId, users };
}

export function handleUpdateSettings(state: GameRoom, settings: Partial<RoomSettings>): GameRoom {
  if (state.phase.type !== 'lobby') {
    throw new InvalidActionError('Can only change settings in lobby');
  }
  return { ...state, settings: { ...state.settings, ...settings } };
}

export function handleResetGame(state: GameRoom): GameRoom {
  if (state.phase.type !== 'gameover') {
    throw new InvalidActionError('Game is not over');
  }

  const users = { ...state.users };
  for (const [id, user] of Object.entries(users)) {
    users[id] = {
      ...user,
      role: null,
      seatNumber: null,
      isAlive: true,
      type: user.type === 'host' ? 'host' : 'player',
    };
  }

  return {
    ...state,
    users,
    userOrder: [],
    phase: { type: 'lobby' },
    round: 1,
    speaking: createEmptySpeakingState(),
    vote: createEmptyVoteState(),
    deadViewMode: {},
    eliminationLog: [],
  };
}
