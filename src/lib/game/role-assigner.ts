import type { PlayerRole, PlayerId } from './types';
import { ROLE_DISTRIBUTION } from './constants';

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignRoles(playerIds: PlayerId[]): Record<PlayerId, PlayerRole> {
  const count = playerIds.length;
  const distribution = ROLE_DISTRIBUTION[count];

  if (!distribution) {
    throw new Error(`No role distribution for ${count} players`);
  }

  const roles: PlayerRole[] = [];
  for (const [role, num] of Object.entries(distribution)) {
    for (let i = 0; i < num; i++) {
      roles.push(role as PlayerRole);
    }
  }

  const shuffledRoles = shuffle(roles);
  const shuffledPlayers = shuffle(playerIds);

  const assignments: Record<PlayerId, PlayerRole> = {};
  shuffledPlayers.forEach((playerId, index) => {
    assignments[playerId] = shuffledRoles[index];
  });

  return assignments;
}
