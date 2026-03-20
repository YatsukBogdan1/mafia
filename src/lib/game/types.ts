// --- Identifiers ---
export type UserId = string;
export type RoomCode = string;

// --- Roles ---
export type PlayerRole = 'mafia' | 'don' | 'sheriff' | 'villager' | 'doctor' | 'hooker';

// --- User type (replaces boolean isHost / isSpectator flags) ---
export type UserType = 'host' | 'player' | 'spectator';

// --- Game Phases ---
export type GamePhase =
  | { type: 'lobby' }
  | { type: 'game' }
  | { type: 'gameover'; winner: 'mafia' | 'villagers' };

// --- User ---
export interface User {
  id: UserId;
  name: string;
  seatNumber: number | null;
  role: PlayerRole | null;
  isAlive: boolean;
  type: UserType;
  isConnected: boolean;
}

// --- Microphone state (tracks who has mic permission) ---
export interface SpeakingState {
  unmutedUsers: UserId[];
}

// --- Voting ---
export interface VoteState {
  nominees: UserId[];
  currentNomineeIndex: number;       // -1 = not started, 0..n = active
  votingDeadline: number | null;     // epoch ms when 3s window closes
  votes: Record<UserId, UserId>;     // voterId -> nomineeId
  usedVotes: UserId[];
  finished: boolean;
  revoteRound: number;               // 0 = first vote, 1 = first revote
  eliminateAllIds: UserId[];         // non-empty = "eliminate all" vote in progress for these users
}

// --- Role counts for a custom distribution ---
export interface RoleDistribution {
  mafia: number;
  don: number;
  sheriff: number;
  villager: number;
  doctor: number;
  hooker: number;
}

// --- Room Settings ---
export interface RoomSettings {
  votingTimeoutMs: number; // how long players have to vote (ms)
  roleDistribution: RoleDistribution | null;  // null = use built-in table
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  votingTimeoutMs: 3000,
  roleDistribution: null,
};

// --- Dead player view mode ---
export type DeadViewMode = 'spectator' | 'role';

// --- Room (full server-side state) ---
export interface GameRoom {
  code: RoomCode;
  hostId: UserId;
  users: Record<UserId, User>;
  userOrder: UserId[];
  phase: GamePhase;
  round: number;                     // increments each time host clicks Next Round
  speaking: SpeakingState;
  vote: VoteState;
  settings: RoomSettings;
  deadViewMode: Record<UserId, DeadViewMode>;
  eliminationLog: Array<{ userId: UserId }>;
  livekitRoomName: string;
}

// --- Game Actions (state machine inputs) ---
export type GameAction =
  | { type: 'player_join'; userId: UserId; name: string }
  | { type: 'player_leave'; userId: UserId }
  | { type: 'player_reconnect'; userId: UserId }
  | { type: 'start_game' }
  | { type: 'grant_speaking'; userId: UserId }       // toggle mic for a user
  | { type: 'mute_all' }                              // mute everyone
  | { type: 'unmute_all' }                            // unmute everyone
  | { type: 'nominate'; targetId: UserId }            // host adds nominee
  | { type: 'remove_nominee'; targetId: UserId }     // host removes nominee
  | { type: 'start_nominee_vote' }                    // host starts vote on next nominee
  | { type: 'cast_vote'; voterId: UserId }
  | { type: 'host_eliminate'; userId: UserId }
  | { type: 'host_save' }
  | { type: 'next_round' }
  | { type: 'reset_game' }
  | { type: 'revote'; tiedIds: UserId[] }
  | { type: 'vote_eliminate_all'; tiedIds: UserId[] }
  | { type: 'become_host'; userId: UserId }
  | { type: 'kick_player'; userId: UserId }
  | { type: 'update_settings'; settings: Partial<RoomSettings> }
  | { type: 'assign_roles' };

// --- Client-to-Server Messages ---
export type C2SMessage =
  | { type: 'create_room'; playerName: string; settings?: Partial<RoomSettings> }
  | { type: 'join_room'; roomCode: RoomCode; playerName: string }
  | { type: 'reconnect'; roomCode: RoomCode; userId: UserId }
  | { type: 'host_action'; action: GameAction }
  | { type: 'player_action'; action: GameAction }
  | { type: 'create_sandbox'; userCount: number; settings?: Partial<RoomSettings> }
  | { type: 'sandbox_action'; asUserId: UserId; action: GameAction }
  | { type: 'switch_view'; userId: UserId }
  | { type: 'set_dead_view'; mode: DeadViewMode }
  | { type: 'ping' };

// --- Server-to-Client Messages ---
export type S2CMessage =
  | { type: 'room_created'; roomCode: RoomCode; userId: UserId }
  | { type: 'room_joined'; userId: UserId; roomCode: RoomCode; userType: UserType }
  | { type: 'reconnected'; userId: UserId; roomCode: RoomCode; role: PlayerRole | null }
  | { type: 'state_update'; state: ClientGameState }
  | { type: 'role_assigned'; role: PlayerRole }
  | { type: 'sandbox_created'; roomCode: RoomCode; hostId: UserId; userIds: UserId[]; userNames: Record<UserId, string> }
  | { type: 'sandbox_view'; userId: UserId; state: ClientGameState; role: PlayerRole | null; mediaStates: Record<UserId, { canPublish: boolean; canSee: UserId[] }> }
  | { type: 'error'; message: string }
  | { type: 'pong' };

// --- Filtered state sent to each client ---
export interface ClientUser {
  id: UserId;
  name: string;
  seatNumber: number | null;
  role: PlayerRole | null;
  isAlive: boolean;
  type: UserType;
  isConnected: boolean;
}

export interface ClientGameState {
  code: RoomCode;
  hostId: UserId;
  users: Record<UserId, ClientUser>;
  userOrder: UserId[];
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
  return { unmutedUsers: [] };
}

export function createEmptyVoteState(): VoteState {
  return {
    nominees: [],
    currentNomineeIndex: -1,
    votingDeadline: null,
    votes: {},
    usedVotes: [],
    finished: false,
    revoteRound: 0,
    eliminateAllIds: [],
  };
}
