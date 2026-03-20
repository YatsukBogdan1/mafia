import type { GameRoom, GameAction } from './types';
import {
  handlePlayerJoin, handlePlayerLeave, handlePlayerReconnect,
  handleStartGame, handleAssignRoles, handleKickPlayer,
  handleBecomeHost, handleUpdateSettings, handleResetGame,
} from './transitions/lobby';
import { handleGrantSpeaking, handleMuteAll, handleUnmuteAll } from './transitions/speaking';
import {
  handleNominate, handleRemoveNominee, handleStartNomineeVote,
  handleCastVote, handleRevote, handleVoteEliminateAll, handleHostSave,
} from './transitions/voting';
import { handleHostEliminate, handleNextRound } from './transitions/elimination';

export class InvalidActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActionError';
  }
}

export function transition(state: GameRoom, action: GameAction): GameRoom {
  switch (action.type) {
    case 'player_join':
      return handlePlayerJoin(state, action.userId, action.name);
    case 'player_leave':
      return handlePlayerLeave(state, action.userId);
    case 'player_reconnect':
      return handlePlayerReconnect(state, action.userId);
    case 'start_game':
      return handleStartGame(state);
    case 'grant_speaking':
      return handleGrantSpeaking(state, action.userId);
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
      return handleHostEliminate(state, action.userId);
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
    case 'become_host':
      return handleBecomeHost(state, action.userId);
    case 'kick_player':
      return handleKickPlayer(state, action.userId);
    case 'assign_roles':
      return handleAssignRoles(state);
    case 'update_settings':
      return handleUpdateSettings(state, action.settings);
    default:
      throw new InvalidActionError(`Unknown action type`);
  }
}
