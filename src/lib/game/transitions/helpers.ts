import type { GameRoom } from '../types';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getAliveUsers(state: GameRoom) {
  return Object.values(state.users).filter((u) => u.isAlive && u.type === 'player');
}
