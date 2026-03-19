import type { PlayerRole, PlayerId, RoleDistribution } from './types';
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

export function assignRoles(playerIds: PlayerId[], override?: RoleDistribution | null): Record<PlayerId, PlayerRole> {
  const count = playerIds.length;

  let distribution: Record<PlayerRole, number>;
  if (override) {
    const total = override.mafia + override.don + override.sheriff + override.villager;
    if (total !== count) {
      throw new Error(`Distribution total (${total}) doesn't match player count (${count})`);
    }
    distribution = override;
  } else {
    const fallback = ROLE_DISTRIBUTION[count];
    if (!fallback) {
      throw new Error(`No role distribution for ${count} players`);
    }
    distribution = fallback;
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
