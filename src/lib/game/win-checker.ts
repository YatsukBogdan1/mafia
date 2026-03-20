import type { User } from './types';

export type WinResult = 'mafia' | 'villagers' | null;

export function checkWinCondition(users: Record<string, User>): WinResult {
  const alive = Object.values(users).filter((u) => u.isAlive && u.type === 'player');

  const mafiaAlive = alive.filter(
    (u) => u.role === 'mafia' || u.role === 'don',
  ).length;

  const villagersAlive = alive.length - mafiaAlive;

  if (mafiaAlive === 0) return 'villagers';
  if (mafiaAlive >= villagersAlive) return 'mafia';

  return null;
}
