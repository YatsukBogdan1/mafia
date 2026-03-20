import type { GameRoom, UserId } from '../types';
import { createEmptyVoteState } from '../types';
import { InvalidActionError } from '../state-machine';
import { getAliveUsers } from './helpers';

export function handleNominate(state: GameRoom, targetId: UserId): GameRoom {
  const target = state.users[targetId];
  if (!target || !target.isAlive || target.type === 'host') {
    throw new InvalidActionError('Invalid nomination target');
  }
  if (state.vote.nominees.includes(targetId)) {
    throw new InvalidActionError('Player already nominated');
  }

  return {
    ...state,
    vote: {
      ...state.vote,
      nominees: [...state.vote.nominees, targetId],
    },
  };
}

export function handleRemoveNominee(state: GameRoom, targetId: UserId): GameRoom {
  const { vote } = state;
  if (vote.currentNomineeIndex >= 0) {
    throw new InvalidActionError('Cannot remove nominee after voting has started');
  }
  if (!vote.nominees.includes(targetId)) {
    throw new InvalidActionError('Player is not nominated');
  }
  return {
    ...state,
    vote: {
      ...vote,
      nominees: vote.nominees.filter(id => id !== targetId),
    },
  };
}

export function handleStartNomineeVote(state: GameRoom): GameRoom {
  const { vote } = state;

  if (vote.nominees.length === 0) {
    throw new InvalidActionError('No nominees to vote on');
  }

  const nextIndex = vote.currentNomineeIndex + 1;

  if (nextIndex >= vote.nominees.length) {
    return finalizeVoting(state);
  }

  return {
    ...state,
    vote: {
      ...state.vote,
      currentNomineeIndex: nextIndex,
      votingDeadline: Date.now() + state.settings.votingTimeoutMs,
    },
  };
}

export function handleCastVote(state: GameRoom, voterId: UserId): GameRoom {
  const { vote } = state;

  if (vote.currentNomineeIndex < 0 || vote.finished) {
    throw new InvalidActionError('Voting not active');
  }

  const voter = state.users[voterId];
  if (!voter?.isAlive || voter.type === 'host') {
    throw new InvalidActionError('Cannot vote');
  }
  if (vote.usedVotes.includes(voterId)) {
    throw new InvalidActionError('Already used your vote');
  }
  if (vote.votingDeadline && Date.now() > vote.votingDeadline) {
    throw new InvalidActionError('Voting window closed');
  }

  const currentNominee = vote.nominees[vote.currentNomineeIndex];

  return {
    ...state,
    vote: {
      ...state.vote,
      votes: { ...vote.votes, [voterId]: currentNominee },
      usedVotes: [...vote.usedVotes, voterId],
    },
  };
}

export function finalizeVoting(state: GameRoom): GameRoom {
  const { vote } = state;

  // For eliminate-all votes, don't auto-assign uncast votes — only explicit yes-votes count.
  if (vote.eliminateAllIds.length > 0) {
    return {
      ...state,
      vote: {
        ...vote,
        currentNomineeIndex: vote.nominees.length - 1,
        votingDeadline: null,
        finished: true,
      },
    };
  }

  const lastNominee = vote.nominees[vote.nominees.length - 1];
  const newVotes = { ...vote.votes };

  const aliveUsers = getAliveUsers(state);
  for (const user of aliveUsers) {
    if (!vote.usedVotes.includes(user.id)) {
      newVotes[user.id] = lastNominee;
    }
  }

  return {
    ...state,
    vote: {
      ...state.vote,
      votes: newVotes,
      usedVotes: aliveUsers.map((u) => u.id),
      currentNomineeIndex: vote.nominees.length - 1,
      votingDeadline: null,
      finished: true,
    },
  };
}

export function handleRevote(state: GameRoom, tiedIds: UserId[]): GameRoom {
  if (!state.vote.finished) {
    throw new InvalidActionError('Voting not finished');
  }
  return {
    ...state,
    vote: {
      nominees: tiedIds,
      currentNomineeIndex: -1,
      votingDeadline: null,
      votes: {},
      usedVotes: [],
      finished: false,
      revoteRound: state.vote.revoteRound + 1,
      eliminateAllIds: [],
    },
  };
}

export function handleVoteEliminateAll(state: GameRoom, tiedIds: UserId[]): GameRoom {
  if (!state.vote.finished) {
    throw new InvalidActionError('Voting not finished');
  }
  return {
    ...state,
    vote: {
      nominees: [tiedIds[0]],
      currentNomineeIndex: 0,
      votingDeadline: Date.now() + state.settings.votingTimeoutMs,
      votes: {},
      usedVotes: [],
      finished: false,
      revoteRound: state.vote.revoteRound,
      eliminateAllIds: tiedIds,
    },
  };
}

export function handleHostSave(state: GameRoom): GameRoom {
  return {
    ...state,
    vote: createEmptyVoteState(),
  };
}
