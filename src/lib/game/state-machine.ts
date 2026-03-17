import type {
  GameRoom,
  GameAction,
  PlayerId,
} from './types';
import {
  createEmptySpeakingState,
  createEmptyVoteState,
} from './types';
import { MIN_PLAYERS } from './constants';
import { assignRoles } from './role-assigner';
import { checkWinCondition } from './win-checker';

export class InvalidActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActionError';
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function transition(state: GameRoom, action: GameAction): GameRoom {
  switch (action.type) {
    case 'player_join':
      return handlePlayerJoin(state, action.playerId, action.name);
    case 'player_leave':
      return handlePlayerLeave(state, action.playerId);
    case 'start_game':
      return handleStartGame(state);
    case 'grant_speaking':
      return handleGrantSpeaking(state, action.playerId);
    case 'mute_all':
      return handleMuteAll(state);
    case 'unmute_all':
      return handleUnmuteAll(state);
    case 'nominate':
      return handleNominate(state, action.targetId);
    case 'remove_nominee':
      return handleRemoveNominee(state, action.targetId);
    case 'start_nominee_vote':
      return handleStartNomineeVote(state);
    case 'cast_vote':
      return handleCastVote(state, action.voterId);
    case 'host_eliminate':
      return handleHostEliminate(state, action.playerId);
    case 'host_save':
      return handleHostSave(state);
    case 'next_round':
      return handleNextRound(state);
    case 'reset_game':
      return handleResetGame(state);
    case 'revote':
      return handleRevote(state, action.tiedIds);
    case 'vote_eliminate_all':
      return handleVoteEliminateAll(state, action.tiedIds);
    default:
      throw new InvalidActionError(`Unknown action type`);
  }
}

// --- Handlers ---

function handlePlayerJoin(state: GameRoom, playerId: PlayerId, name: string): GameRoom {
  if (state.phase.type !== 'lobby') {
    throw new InvalidActionError('Cannot join after game has started');
  }
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        id: playerId,
        name,
        seatNumber: null,
        role: null,
        isAlive: true,
        isHost: false,
        isConnected: true,
      },
    },
  };
}

function handlePlayerLeave(state: GameRoom, playerId: PlayerId): GameRoom {
  const player = state.players[playerId];
  if (!player) throw new InvalidActionError('Player not found');
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, isConnected: false },
    },
  };
}

function handleStartGame(state: GameRoom): GameRoom {
  if (state.phase.type !== 'lobby') {
    throw new InvalidActionError('Game already started');
  }

  const playerIds = getAlivePlayers(state).map((p) => p.id);
  if (playerIds.length < MIN_PLAYERS) {
    throw new InvalidActionError(
      `Need at least ${MIN_PLAYERS} players, have ${playerIds.length}`,
    );
  }

  const roleAssignments = assignRoles(playerIds);
  const seatedOrder = shuffle(playerIds);
  const players = { ...state.players };
  for (const [id, role] of Object.entries(roleAssignments)) {
    players[id] = { ...players[id], role };
  }
  for (let i = 0; i < seatedOrder.length; i++) {
    players[seatedOrder[i]] = { ...players[seatedOrder[i]], seatNumber: i + 1 };
  }

  return {
    ...state,
    players,
    playerOrder: seatedOrder,
    phase: { type: 'game' },
    speaking: { unmutedPlayers: playerIds },
    vote: createEmptyVoteState(),
  };
}


function handleGrantSpeaking(state: GameRoom, playerId: PlayerId): GameRoom {
  const player = state.players[playerId];
  if (!player || !player.isAlive) {
    throw new InvalidActionError('Player not found or dead');
  }
  const current = state.speaking.unmutedPlayers;
  const unmutedPlayers = current.includes(playerId)
    ? current.filter(id => id !== playerId)
    : [...current, playerId];
  return {
    ...state,
    speaking: { unmutedPlayers },
  };
}

function handleMuteAll(state: GameRoom): GameRoom {
  return {
    ...state,
    speaking: { unmutedPlayers: [] },
  };
}

function handleUnmuteAll(state: GameRoom): GameRoom {
  const unmutedPlayers = Object.values(state.players)
    .filter(p => p.isAlive && !p.isHost)
    .map(p => p.id);
  return {
    ...state,
    speaking: { unmutedPlayers },
  };
}

function handleNominate(state: GameRoom, targetId: PlayerId): GameRoom {
  const target = state.players[targetId];
  if (!target || !target.isAlive || target.isHost) {
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

function handleRemoveNominee(state: GameRoom, targetId: PlayerId): GameRoom {
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

function handleStartNomineeVote(state: GameRoom): GameRoom {
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
      votingDeadline: Date.now() + 10000,
    },
  };
}

function handleCastVote(state: GameRoom, voterId: PlayerId): GameRoom {
  const { vote } = state;

  if (vote.currentNomineeIndex < 0 || vote.finished) {
    throw new InvalidActionError('Voting not active');
  }

  const voter = state.players[voterId];
  if (!voter?.isAlive || voter.isHost) {
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

function finalizeVoting(state: GameRoom): GameRoom {
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

  const alivePlayers = getAlivePlayers(state);
  for (const player of alivePlayers) {
    if (!vote.usedVotes.includes(player.id)) {
      newVotes[player.id] = lastNominee;
    }
  }

  return {
    ...state,
    vote: {
      ...state.vote,
      votes: newVotes,
      usedVotes: alivePlayers.map((p) => p.id),
      currentNomineeIndex: vote.nominees.length - 1,
      votingDeadline: null,
      finished: true,
    },
  };
}

function handleHostEliminate(state: GameRoom, playerId: PlayerId): GameRoom {
  const player = state.players[playerId];
  if (!player || !player.isAlive) {
    throw new InvalidActionError('Player not found or already dead');
  }

  let newState: GameRoom = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, isAlive: false },
    },
    eliminationLog: [...state.eliminationLog, { playerId }],
    vote: createEmptyVoteState(),
  };

  const winner = checkWinCondition(newState.players);
  if (winner) {
    newState = { ...newState, phase: { type: 'gameover', winner } };
  }

  return newState;
}

function handleHostSave(state: GameRoom): GameRoom {
  return {
    ...state,
    vote: createEmptyVoteState(),
  };
}

function handleRevote(state: GameRoom, tiedIds: PlayerId[]): GameRoom {
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

function handleVoteEliminateAll(state: GameRoom, tiedIds: PlayerId[]): GameRoom {
  if (!state.vote.finished) {
    throw new InvalidActionError('Voting not finished');
  }
  // Single virtual nominee (tiedIds[0]) represents the whole group.
  // eliminateAllIds tells the UI this is a group vote.
  return {
    ...state,
    vote: {
      nominees: [tiedIds[0]],
      currentNomineeIndex: 0,
      votingDeadline: Date.now() + 10000,
      votes: {},
      usedVotes: [],
      finished: false,
      revoteRound: state.vote.revoteRound,
      eliminateAllIds: tiedIds,
    },
  };
}

function handleResetGame(state: GameRoom): GameRoom {
  if (state.phase.type !== 'gameover') {
    throw new InvalidActionError('Game is not over');
  }

  const players = { ...state.players };
  for (const [id, player] of Object.entries(players)) {
    players[id] = { ...player, role: null, seatNumber: null, isAlive: true };
  }

  return {
    ...state,
    players,
    playerOrder: [],
    phase: { type: 'lobby' },
    round: 1,
    speaking: createEmptySpeakingState(),
    vote: createEmptyVoteState(),
    deadViewMode: {},
    eliminationLog: [],
  };
}

function handleNextRound(state: GameRoom): GameRoom {
  if (state.phase.type !== 'game') {
    throw new InvalidActionError('Can only advance round during game');
  }
  return {
    ...state,
    round: state.round + 1,
    vote: createEmptyVoteState(),
    speaking: { unmutedPlayers: getAlivePlayers(state).map(p => p.id) },
  };
}

// --- Helpers ---

function getAlivePlayers(state: GameRoom) {
  return Object.values(state.players).filter((p) => p.isAlive && !p.isHost);
}
