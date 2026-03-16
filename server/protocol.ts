import type { C2SMessage, S2CMessage } from '../src/lib/game/types';

export function parseMessage(data: string): C2SMessage | null {
  try {
    const msg = JSON.parse(data);
    if (!msg || typeof msg.type !== 'string') return null;
    return msg as C2SMessage;
  } catch {
    return null;
  }
}

export function encode(msg: S2CMessage): string {
  return JSON.stringify(msg);
}
