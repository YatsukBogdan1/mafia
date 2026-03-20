export const C = {
  bgBase:    '#0c0b0b',
  bgPanel:   '#131111',
  bgSurface: '#1c1919',
  bgHover:   '#241f1f',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(255,255,255,0.13)',
  text:      '#e8e3de',
  textSec:   '#9c948c',
  textMuted: '#5a5552',
  crimson:   '#c41e3a',
  crimsonDk: '#981630',
  amber:     '#d4923a',
  green:     '#22c55e',
  blue:      '#3b82f6',
} as const;

export const ROLE_COLORS: Record<string, string> = {
  mafia:    '#ef4444',
  don:      '#b91c1c',
  sheriff:  '#3b82f6',
  villager: '#6b7280',
  doctor:   '#22c55e',
  hooker:   '#a855f7',
};

export function roleColor(role: string | null | undefined): string {
  return role ? (ROLE_COLORS[role] ?? '#6b7280') : '#3a3838';
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Format a user as "N. Name" when a seat number is assigned, else just "Name". */
export function displayName(user: { name: string; seatNumber: number | null } | null | undefined): string {
  if (!user) return '?';
  return user.seatNumber != null ? `${user.seatNumber}. ${user.name}` : user.name;
}
