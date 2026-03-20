import type { GameRoom, UserId } from '../types';
import { InvalidActionError } from '../state-machine';

export function handleGrantSpeaking(state: GameRoom, userId: UserId): GameRoom {
  const user = state.users[userId];
  if (!user || !user.isAlive) {
    throw new InvalidActionError('Player not found or dead');
  }
  const current = state.speaking.unmutedUsers;
  const unmutedUsers = current.includes(userId)
    ? current.filter(id => id !== userId)
    : [...current, userId];
  return {
    ...state,
    speaking: { unmutedUsers },
  };
}

export function handleMuteAll(state: GameRoom): GameRoom {
  return {
    ...state,
    speaking: { unmutedUsers: [] },
  };
}

export function handleUnmuteAll(state: GameRoom): GameRoom {
  const unmutedUsers = Object.values(state.users)
    .filter(u => u.isAlive && u.type === 'player')
    .map(u => u.id);
  return {
    ...state,
    speaking: { unmutedUsers },
  };
}
