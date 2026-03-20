import type { GameRoom, UserId } from '../types';
import { checkWinCondition } from '../win-checker';
import { InvalidActionError } from '../state-machine';

export function handleHostEliminate(state: GameRoom, userId: UserId): GameRoom {
  const user = state.users[userId];
  if (!user || !user.isAlive) {
    throw new InvalidActionError('Player not found or already dead');
  }

  let newState: GameRoom = {
    ...state,
    users: {
      ...state.users,
      [userId]: { ...user, isAlive: false },
    },
    eliminationLog: [...state.eliminationLog, { userId }],
  };

  const winner = checkWinCondition(newState.users);
  if (winner) {
    newState = { ...newState, phase: { type: 'gameover', winner } };
  }

  return newState;
}

export function handleNextRound(state: GameRoom): GameRoom {
  if (state.phase.type !== 'game') {
    throw new InvalidActionError('Can only advance round during game');
  }
  return {
    ...state,
    round: state.round + 1,
  };
}
