import type {
  GameRoom,
  GameAction,
  GamePhase,
  PlayerId,
} from './types';
import {
  createEmptyNightActions,
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
    case 'advance_phase':
      return handleAdvancePhase(state);
    case 'grant_speaking':
      return handleGrantSpeaking(state, action.playerId);
    case 'end_speaking':
      return handleEndSpeaking(state);
    case 'mafia_vote':
      return handleMafiaVote(state, action.voterId, action.targetId);
    case 'sheriff_check':
      return handleSheriffCheck(state, action.targetId);
    case 'don_check':
      return handleDonCheck(state, action.targetId);
    case 'nominate':
      return handleNominate(state, action.nominatorId, action.targetId);
    case 'cast_vote':
      return handleCastVote(state, action.voterId, action.targetId);
    case 'host_eliminate':
      return handleHostEliminate(state, action.playerId);
    case 'host_save':
      return handleHostSave(state);
    default:
      throw new InvalidActionError(`Unknown action type`);
  }
}

// --- Handlers ---

function handlePlayerJoin(
  state: GameRoom,
  playerId: PlayerId,
  name: string,
): GameRoom {
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

  return {
    ...state,
    players,
    phase: { type: 'night', subphase: 'mafia_deliberation', nightNumber: 1 },
    nightActions: createEmptyNightActions(),
  };
}

function handleAdvancePhase(state: GameRoom): GameRoom {
  const { phase } = state;

  if (phase.type === 'lobby' || phase.type === 'gameover') {
    throw new InvalidActionError(`Cannot advance from ${phase.type}`);
  }

  const nextPhase = getNextPhase(phase, state);
  let newState = {
    ...state,
    phase: nextPhase,
  };

  // Reset state for new phases
  if (nextPhase.type === 'night') {
    newState.nightActions = createEmptyNightActions();
    newState.speaking = createEmptySpeakingState();
    newState.vote = createEmptyVoteState();
  } else if (
    nextPhase.type === 'day' &&
    nextPhase.subphase === 'discussion'
  ) {
    const alivePlayers = getAlivePlayers(newState);
    newState.speaking = {
      currentSpeaker: null,
      speakingOrder: alivePlayers.map((p) => p.id),
      speakingIndex: 0,
    };
  } else if (nextPhase.type === 'day' && nextPhase.subphase === 'voting') {
    newState.vote = createEmptyVoteState();
  }

  return newState;
}

function getNextPhase(phase: GamePhase, state: GameRoom): GamePhase {
  if (phase.type === 'night') {
    switch (phase.subphase) {
      case 'mafia_deliberation': {
        // Skip don_check if no don alive
        const hasDon = getAlivePlayers(state).some((p) => p.role === 'don');
        if (hasDon) return { ...phase, subphase: 'don_check' };
        const hasSheriff = getAlivePlayers(state).some(
          (p) => p.role === 'sheriff',
        );
        if (hasSheriff) return { ...phase, subphase: 'sheriff_check' };
        return {
          type: 'day',
          subphase: 'announcement',
          dayNumber: phase.nightNumber,
        };
      }
      case 'don_check': {
        const hasSheriff = getAlivePlayers(state).some(
          (p) => p.role === 'sheriff',
        );
        if (hasSheriff) return { ...phase, subphase: 'sheriff_check' };
        return {
          type: 'day',
          subphase: 'announcement',
          dayNumber: phase.nightNumber,
        };
      }
      case 'sheriff_check':
        return {
          type: 'day',
          subphase: 'announcement',
          dayNumber: phase.nightNumber,
        };
    }
  }

  if (phase.type === 'day') {
    switch (phase.subphase) {
      case 'announcement':
        return { ...phase, subphase: 'discussion' };
      case 'discussion':
        return { ...phase, subphase: 'voting' };
      case 'voting':
        return { ...phase, subphase: 'defense' };
      case 'defense':
        return { ...phase, subphase: 'final_vote' };
      case 'final_vote':
        return {
          type: 'night',
          subphase: 'mafia_deliberation',
          nightNumber: phase.dayNumber + 1,
        };
    }
  }

  throw new InvalidActionError('Cannot determine next phase');
}

function handleGrantSpeaking(
  state: GameRoom,
  playerId: PlayerId,
): GameRoom {
  assertPhase(state, 'day');
  const player = state.players[playerId];
  if (!player || !player.isAlive) {
    throw new InvalidActionError('Player not found or dead');
  }

  return {
    ...state,
    speaking: {
      ...state.speaking,
      currentSpeaker: playerId,
    },
  };
}

function handleEndSpeaking(state: GameRoom): GameRoom {
  assertPhase(state, 'day');
  return {
    ...state,
    speaking: {
      ...state.speaking,
      currentSpeaker: null,
      speakingIndex: state.speaking.speakingIndex + 1,
    },
  };
}

function handleMafiaVote(
  state: GameRoom,
  voterId: PlayerId,
  targetId: PlayerId,
): GameRoom {
  assertNightSubphase(state, 'mafia_deliberation');
  const voter = state.players[voterId];
  if (
    !voter ||
    !voter.isAlive ||
    (voter.role !== 'mafia' && voter.role !== 'don')
  ) {
    throw new InvalidActionError('Only alive mafia members can vote');
  }

  const target = state.players[targetId];
  if (!target || !target.isAlive || target.isHost) {
    throw new InvalidActionError('Invalid target');
  }

  const mafiaVotes = { ...state.nightActions.mafiaVotes, [voterId]: targetId };

  // Resolve mafia target (majority of mafia votes)
  const mafiaAlive = getAlivePlayers(state).filter(
    (p) => p.role === 'mafia' || p.role === 'don',
  );
  const mafiaTarget = resolveMafiaTarget(mafiaVotes, mafiaAlive.length);

  return {
    ...state,
    nightActions: {
      ...state.nightActions,
      mafiaVotes,
      mafiaTarget,
    },
  };
}

function handleSheriffCheck(state: GameRoom, targetId: PlayerId): GameRoom {
  assertNightSubphase(state, 'sheriff_check');
  const target = state.players[targetId];
  if (!target || !target.isAlive || target.isHost) {
    throw new InvalidActionError('Invalid target');
  }

  const isMafia = target.role === 'mafia' || target.role === 'don';

  return {
    ...state,
    nightActions: {
      ...state.nightActions,
      sheriffCheck: targetId,
      sheriffResult: isMafia,
    },
  };
}

function handleDonCheck(state: GameRoom, targetId: PlayerId): GameRoom {
  assertNightSubphase(state, 'don_check');
  const target = state.players[targetId];
  if (!target || !target.isAlive || target.isHost) {
    throw new InvalidActionError('Invalid target');
  }

  const isSheriff = target.role === 'sheriff';

  return {
    ...state,
    nightActions: {
      ...state.nightActions,
      donCheck: targetId,
      donResult: isSheriff,
    },
  };
}

function handleNominate(
  state: GameRoom,
  nominatorId: PlayerId,
  targetId: PlayerId,
): GameRoom {
  assertDaySubphase(state, 'voting');
  const nominator = state.players[nominatorId];
  const target = state.players[targetId];
  if (!nominator?.isAlive || !target?.isAlive) {
    throw new InvalidActionError('Both players must be alive');
  }
  if (state.vote.nominees.includes(targetId)) {
    throw new InvalidActionError('Player already nominated');
  }

  return {
    ...state,
    vote: {
      ...state.vote,
      nominees: [...state.vote.nominees, targetId],
      votingOpen: true,
    },
  };
}

function handleCastVote(
  state: GameRoom,
  voterId: PlayerId,
  targetId: PlayerId,
): GameRoom {
  if (
    state.phase.type !== 'day' ||
    (state.phase.subphase !== 'voting' && state.phase.subphase !== 'final_vote')
  ) {
    throw new InvalidActionError('Voting not active');
  }

  const voter = state.players[voterId];
  if (!voter?.isAlive) {
    throw new InvalidActionError('Dead players cannot vote');
  }
  if (!state.vote.nominees.includes(targetId)) {
    throw new InvalidActionError('Target not nominated');
  }

  return {
    ...state,
    vote: {
      ...state.vote,
      votes: { ...state.vote.votes, [voterId]: targetId },
    },
  };
}

function handleHostEliminate(state: GameRoom, playerId: PlayerId): GameRoom {
  const player = state.players[playerId];
  if (!player || !player.isAlive) {
    throw new InvalidActionError('Player not found or already dead');
  }

  const round =
    state.phase.type === 'night'
      ? (state.phase as { nightNumber: number }).nightNumber
      : state.phase.type === 'day'
        ? (state.phase as { dayNumber: number }).dayNumber
        : 0;

  const phaseType =
    state.phase.type === 'night' ? 'night' : 'day';

  let newState: GameRoom = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, isAlive: false },
    },
    eliminationLog: [
      ...state.eliminationLog,
      { playerId, phase: phaseType as 'night' | 'day', round },
    ],
  };

  // Check win condition
  const winner = checkWinCondition(newState.players);
  if (winner) {
    newState = { ...newState, phase: { type: 'gameover', winner } };
  }

  return newState;
}

function handleHostSave(state: GameRoom): GameRoom {
  // Host decides not to eliminate — just reset vote state
  return {
    ...state,
    vote: createEmptyVoteState(),
  };
}

// --- Helpers ---

function getAlivePlayers(state: GameRoom) {
  return Object.values(state.players).filter((p) => p.isAlive && !p.isHost);
}

function assertPhase(state: GameRoom, type: string) {
  if (state.phase.type !== type) {
    throw new InvalidActionError(`Expected ${type} phase, got ${state.phase.type}`);
  }
}

function assertNightSubphase(state: GameRoom, subphase: string) {
  if (state.phase.type !== 'night' || state.phase.subphase !== subphase) {
    throw new InvalidActionError(`Expected night/${subphase}`);
  }
}

function assertDaySubphase(state: GameRoom, subphase: string) {
  if (state.phase.type !== 'day' || state.phase.subphase !== subphase) {
    throw new InvalidActionError(`Expected day/${subphase}`);
  }
}

function resolveMafiaTarget(
  votes: Record<PlayerId, PlayerId>,
  totalMafia: number,
): PlayerId | null {
  const voteCounts: Record<PlayerId, number> = {};
  for (const target of Object.values(votes)) {
    voteCounts[target] = (voteCounts[target] || 0) + 1;
  }

  // Need majority
  const majority = Math.ceil(totalMafia / 2);
  for (const [target, count] of Object.entries(voteCounts)) {
    if (count >= majority) return target;
  }

  return null;
}
