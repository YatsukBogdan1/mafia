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
    case 'end_speaking':
      return handleEndSpeaking(state);
    case 'mute_all':
      return handleMuteAll(state);
    case 'unmute_all':
      return state; // pure LiveKit side effect, no state change
    case 'nominate':
      return handleNominate(state, action.targetId);
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
  const players = { ...state.players };
  for (const [id, role] of Object.entries(roleAssignments)) {
    players[id] = { ...players[id], role };
  }
  for (let i = 0; i < playerIds.length; i++) {
    players[playerIds[i]] = { ...players[playerIds[i]], seatNumber: i + 1 };
  }

  return {
    ...state,
    players,
    playerOrder: playerIds,
    phase: { type: 'game' },
    speaking: createEmptySpeakingState(),
    vote: createEmptyVoteState(),
  };
}


function handleGrantSpeaking(state: GameRoom, playerId: PlayerId): GameRoom {
  const player = state.players[playerId];
  if (!player || !player.isAlive) {
    throw new InvalidActionError('Player not found or dead');
  }
  return {
    ...state,
    speaking: { currentSpeaker: playerId },
  };
}

function handleEndSpeaking(state: GameRoom): GameRoom {
  return {
    ...state,
    speaking: { currentSpeaker: null },
  };
}

function handleMuteAll(state: GameRoom): GameRoom {
  // Clear current speaker when muting all; LiveKit side effect handled in controller
  return {
    ...state,
    speaking: { currentSpeaker: null },
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
      votingDeadline: Date.now() + 3000,
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
    speaking: createEmptySpeakingState(),
  };
}

// --- Helpers ---

function getAlivePlayers(state: GameRoom) {
  return Object.values(state.players).filter((p) => p.isAlive && !p.isHost);
}
