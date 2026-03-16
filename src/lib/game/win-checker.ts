import type { Player } from './types';

export type WinResult = 'mafia' | 'villagers' | null;

export function checkWinCondition(players: Record<string, Player>): WinResult {
  const alive = Object.values(players).filter((p) => p.isAlive && !p.isHost);

  const mafiaAlive = alive.filter(
    (p) => p.role === 'mafia' || p.role === 'don',
  ).length;

  const villagersAlive = alive.length - mafiaAlive;

  if (mafiaAlive === 0) return 'villagers';
  if (mafiaAlive >= villagersAlive) return 'mafia';

  return null;
}
