import type { GameRoom, UserId } from '../types';
import { createEmptyVoteState } from '../types';
import { checkWinCondition } from '../win-checker';
import { InvalidActionError } from '../state-machine';

export function handleHostEliminate(state: GameRoom, userId: UserId): GameRoom {
  const user = state.users[userId];
  if (!user || !user.isAlive) {
    throw new InvalidActionError('Player not found or already dead');
  }

  // Remove the player from active vote nominees/votes so the vote UI stays consistent
  let vote = state.vote;
  if (vote.nominees.includes(userId)) {
    const newNominees = vote.nominees.filter(id => id !== userId);
    const newVotes = { ...vote.votes };
    // Remove votes cast *for* this nominee
    for (const [voterId, nomineeId] of Object.entries(newVotes)) {
      if (nomineeId === userId) delete newVotes[voterId];
    }
    vote = newNominees.length === 0
      ? createEmptyVoteState()
      : {
          ...vote,
          nominees: newNominees,
          votes: newVotes,
          // Clamp index so it doesn't point past the end
          currentNomineeIndex: Math.min(vote.currentNomineeIndex, newNominees.length - 1),
          finished: vote.finished && newNominees.length > 0,
          eliminateAllIds: vote.eliminateAllIds.filter(id => id !== userId),
        };
  }

  let newState: GameRoom = {
    ...state,
    vote,
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

export function handleVoteEliminate(state: GameRoom, userId: UserId): GameRoom {
  const user = state.users[userId];
  // Already dead (e.g. host manually eliminated them during an active vote) — just clear vote state
  if (!user || !user.isAlive) {
    return { ...state, vote: createEmptyVoteState() };
  }
  const eliminated = handleHostEliminate(state, userId);
  return { ...eliminated, vote: createEmptyVoteState() };
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
