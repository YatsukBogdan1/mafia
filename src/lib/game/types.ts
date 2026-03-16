// --- Identifiers ---
export type PlayerId = string;
export type RoomCode = string;

// --- Roles ---
export type PlayerRole = 'mafia' | 'don' | 'sheriff' | 'villager';

// --- Game Phases ---
export type GamePhase =
  | { type: 'lobby' }
  | { type: 'night'; subphase: NightSubphase; nightNumber: number }
  | { type: 'day'; subphase: DaySubphase; dayNumber: number }
  | { type: 'gameover'; winner: 'mafia' | 'villagers' };

export type NightSubphase =
  | 'mafia_deliberation'
  | 'don_check'
  | 'sheriff_check';

export type DaySubphase =
  | 'announcement'
  | 'discussion'
  | 'voting'
  | 'defense'
  | 'final_vote';

// --- Player ---
export interface Player {
  id: PlayerId;
  name: string;
  role: PlayerRole | null;
  isAlive: boolean;
  isHost: boolean;
  isConnected: boolean;
}

// --- Speaking ---
export interface SpeakingState {
  currentSpeaker: PlayerId | null;
  speakingOrder: PlayerId[];
  speakingIndex: number;
}

// --- Voting ---
export interface VoteState {
  nominees: PlayerId[];
  votes: Record<PlayerId, PlayerId>;
  votingOpen: boolean;
}

// --- Night Actions ---
export interface NightActions {
  mafiaTarget: PlayerId | null;
  mafiaVotes: Record<PlayerId, PlayerId>;
  sheriffCheck: PlayerId | null;
  sheriffResult: boolean | null;
  donCheck: PlayerId | null;
  donResult: boolean | null;
}

// --- Room (full server-side state) ---
export interface GameRoom {
  code: RoomCode;
  hostId: PlayerId;
  players: Record<PlayerId, Player>;
  phase: GamePhase;
  speaking: SpeakingState;
  vote: VoteState;
  nightActions: NightActions;
  eliminationLog: Array<{
    playerId: PlayerId;
    phase: 'night' | 'day';
    round: number;
  }>;
  livekitRoomName: string;
}

// --- Game Actions (state machine inputs) ---
export type GameAction =
  | { type: 'player_join'; playerId: PlayerId; name: string }
  | { type: 'player_leave'; playerId: PlayerId }
  | { type: 'start_game' }
  | { type: 'advance_phase' }
  | { type: 'grant_speaking'; playerId: PlayerId }
  | { type: 'end_speaking' }
  | { type: 'mafia_vote'; voterId: PlayerId; targetId: PlayerId }
  | { type: 'sheriff_check'; targetId: PlayerId }
  | { type: 'don_check'; targetId: PlayerId }
  | { type: 'nominate'; nominatorId: PlayerId; targetId: PlayerId }
  | { type: 'cast_vote'; voterId: PlayerId; targetId: PlayerId }
  | { type: 'host_eliminate'; playerId: PlayerId }
  | { type: 'host_save' };

// --- Client-to-Server Messages ---
export type C2SMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join_room'; roomCode: RoomCode; playerName: string }
  | { type: 'host_action'; action: GameAction }
  | { type: 'player_action'; action: GameAction }
  | { type: 'ping' };

// --- Server-to-Client Messages ---
export type S2CMessage =
  | { type: 'room_created'; roomCode: RoomCode; playerId: PlayerId }
  | { type: 'room_joined'; playerId: PlayerId; roomCode: RoomCode }
  | { type: 'state_update'; state: ClientGameState }
  | { type: 'role_assigned'; role: PlayerRole }
  | { type: 'night_result'; result: NightResult }
  | { type: 'error'; message: string }
  | { type: 'pong' };

// --- Filtered state sent to each client ---
export interface ClientPlayer {
  id: PlayerId;
  name: string;
  role: PlayerRole | null; // null unless revealed (death, gameover, or teammate)
  isAlive: boolean;
  isHost: boolean;
  isConnected: boolean;
}

export interface ClientGameState {
  code: RoomCode;
  hostId: PlayerId;
  players: Record<PlayerId, ClientPlayer>;
  phase: GamePhase;
  speaking: SpeakingState;
  vote: VoteState;
  livekitRoomName: string;
  eliminationLog: GameRoom['eliminationLog'];
}

export interface NightResult {
  type: 'sheriff_result' | 'don_result' | 'mafia_kill';
  targetId: PlayerId;
  result?: boolean; // for sheriff/don checks
}

// --- Helpers ---
export function createEmptyNightActions(): NightActions {
  return {
    mafiaTarget: null,
    mafiaVotes: {},
    sheriffCheck: null,
    sheriffResult: null,
    donCheck: null,
    donResult: null,
  };
}

export function createEmptySpeakingState(): SpeakingState {
  return {
    currentSpeaker: null,
    speakingOrder: [],
    speakingIndex: 0,
  };
}

export function createEmptyVoteState(): VoteState {
  return {
    nominees: [],
    votes: {},
    votingOpen: false,
  };
}
