import type { PlayerRole } from './types';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;

// Role distribution by player count (excluding host)
// Format: [mafia, don, sheriff, villager]
export const ROLE_DISTRIBUTION: Record<number, Record<PlayerRole, number>> = {
  4:  { mafia: 1, don: 0, sheriff: 0, villager: 3 },
  5:  { mafia: 1, don: 0, sheriff: 1, villager: 3 },
  6:  { mafia: 1, don: 1, sheriff: 1, villager: 3 },
  7:  { mafia: 2, don: 1, sheriff: 1, villager: 3 },
  8:  { mafia: 2, don: 1, sheriff: 1, villager: 4 },
  9:  { mafia: 2, don: 1, sheriff: 1, villager: 5 },
  10: { mafia: 3, don: 1, sheriff: 1, villager: 5 },
  11: { mafia: 3, don: 1, sheriff: 1, villager: 6 },
  12: { mafia: 3, don: 1, sheriff: 1, villager: 7 },
};

export const ROOM_CODE_LENGTH = 5;
