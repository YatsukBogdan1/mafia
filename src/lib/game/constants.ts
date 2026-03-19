import type { PlayerRole } from './types';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

// Role distribution by player count (excluding host)
export const ROLE_DISTRIBUTION: Record<number, Record<PlayerRole, number>> = {
  3:  { mafia: 1, don: 0, sheriff: 0, villager: 2, doctor: 0, hooker: 0 },
  4:  { mafia: 1, don: 0, sheriff: 0, villager: 3, doctor: 0, hooker: 0 },
  5:  { mafia: 1, don: 0, sheriff: 1, villager: 3, doctor: 0, hooker: 0 },
  6:  { mafia: 1, don: 1, sheriff: 1, villager: 3, doctor: 0, hooker: 0 },
  7:  { mafia: 2, don: 1, sheriff: 1, villager: 3, doctor: 0, hooker: 0 },
  8:  { mafia: 2, don: 1, sheriff: 1, villager: 4, doctor: 0, hooker: 0 },
  9:  { mafia: 2, don: 1, sheriff: 1, villager: 5, doctor: 0, hooker: 0 },
  10: { mafia: 2, don: 1, sheriff: 1, villager: 6, doctor: 0, hooker: 0 },
  11: { mafia: 3, don: 1, sheriff: 1, villager: 6, doctor: 0, hooker: 0 },
  12: { mafia: 3, don: 1, sheriff: 1, villager: 7, doctor: 0, hooker: 0 },
};

export const ROOM_CODE_LENGTH = 5;
