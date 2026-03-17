// --- Identifiers ---
export type PlayerId = string;
export type RoomCode = string;

// --- Roles ---
export type PlayerRole = 'mafia' | 'don' | 'sheriff' | 'villager';

// --- Game Phases ---
export type GamePhase =
  | { type: 'lobby' }
  | { type: 'game' }
  | { type: 'gameover'; winner: 'mafia' | 'villagers' };

// --- Player ---
export interface Player {
  id: PlayerId;
  name: string;
  seatNumber: number | null;
  role: PlayerRole | null;
  isAlive: boolean;
  isHost: boolean;
  isConnected: boolean;
}

// --- Speaking (tracks who currently has mic permission) ---
export interface SpeakingState {
  currentSpeaker: PlayerId | null;
}

// --- Voting ---
export interface VoteState {
  nominees: PlayerId[];
  currentNomineeIndex: number;       // -1 = not started, 0..n = active
  votingDeadline: number | null;     // epoch ms when 3s window closes
  votes: Record<PlayerId, PlayerId>; // voterId -> nomineeId
  usedVotes: PlayerId[];
  finished: boolean;
}

// --- Room Settings ---
export interface RoomSettings {}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {};

// --- Dead player view mode ---
export type DeadViewMode = 'spectator' | 'role';

// --- Room (full server-side state) ---
export interface GameRoom {
  code: RoomCode;
  hostId: PlayerId;
  players: Record<PlayerId, Player>;
  playerOrder: PlayerId[];
  phase: GamePhase;
  round: number;                     // increments each time host clicks Next Round
  speaking: SpeakingState;
  vote: VoteState;
  settings: RoomSettings;
  deadViewMode: Record<PlayerId, DeadViewMode>;
  eliminationLog: Array<{ playerId: PlayerId }>;
  livekitRoomName: string;
}

// --- Game Actions (state machine inputs) ---
export type GameAction =
  | { type: 'player_join'; playerId: PlayerId; name: string }
  | { type: 'player_leave'; playerId: PlayerId }
  | { type: 'start_game' }
  | { type: 'grant_speaking'; playerId: PlayerId }     // unmute a player
  | { type: 'end_speaking' }                           // clear current speaker
  | { type: 'mute_all' }                               // mute everyone (LiveKit side effect)
  | { type: 'unmute_all' }                             // unmute everyone (LiveKit side effect)
  | { type: 'nominate'; targetId: PlayerId }           // host adds nominee
  | { type: 'start_nominee_vote' }                     // host starts vote on next nominee
  | { type: 'cast_vote'; voterId: PlayerId }
  | { type: 'host_eliminate'; playerId: PlayerId }
  | { type: 'host_save' }
  | { type: 'next_round' }
  | { type: 'reset_game' };

// --- Client-to-Server Messages ---
export type C2SMessage =
  | { type: 'create_room'; playerName: string; settings?: Partial<RoomSettings> }
  | { type: 'join_room'; roomCode: RoomCode; playerName: string }
  | { type: 'reconnect'; roomCode: RoomCode; playerId: PlayerId }
  | { type: 'host_action'; action: GameAction }
  | { type: 'player_action'; action: GameAction }
  | { type: 'create_sandbox'; playerCount: number; settings?: Partial<RoomSettings> }
  | { type: 'sandbox_action'; asPlayerId: PlayerId; action: GameAction }
  | { type: 'switch_view'; playerId: PlayerId }
  | { type: 'set_dead_view'; mode: DeadViewMode }
  | { type: 'ping' };

// --- Server-to-Client Messages ---
export type S2CMessage =
  | { type: 'room_created'; roomCode: RoomCode; playerId: PlayerId }
  | { type: 'room_joined'; playerId: PlayerId; roomCode: RoomCode }
  | { type: 'reconnected'; playerId: PlayerId; roomCode: RoomCode; role: PlayerRole | null }
  | { type: 'state_update'; state: ClientGameState }
  | { type: 'role_assigned'; role: PlayerRole }
  | { type: 'sandbox_created'; roomCode: RoomCode; hostId: PlayerId; playerIds: PlayerId[]; playerNames: Record<PlayerId, string> }
  | { type: 'sandbox_view'; playerId: PlayerId; state: ClientGameState; role: PlayerRole | null; mediaStates: Record<PlayerId, { canPublish: boolean; canSee: PlayerId[] }> }
  | { type: 'error'; message: string }
  | { type: 'pong' };

// --- Filtered state sent to each client ---
export interface ClientPlayer {
  id: PlayerId;
  name: string;
  seatNumber: number | null;
  role: PlayerRole | null;
  isAlive: boolean;
  isHost: boolean;
  isConnected: boolean;
}

export interface ClientGameState {
  code: RoomCode;
  hostId: PlayerId;
  players: Record<PlayerId, ClientPlayer>;
  playerOrder: PlayerId[];
  phase: GamePhase;
  round: number;
  speaking: SpeakingState;
  vote: VoteState;
  settings: RoomSettings;
  livekitRoomName: string;
  eliminationLog: GameRoom['eliminationLog'];
  myDeadViewMode?: DeadViewMode;
}

// --- Helpers ---
export function createEmptySpeakingState(): SpeakingState {
  return { currentSpeaker: null };
}

export function createEmptyVoteState(): VoteState {
  return {
    nominees: [],
    currentNomineeIndex: -1,
    votingDeadline: null,
    votes: {},
    usedVotes: [],
    finished: false,
  };
}
