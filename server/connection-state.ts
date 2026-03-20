import type WebSocket from 'ws';
import type { UserId, RoomCode, S2CMessage } from '../src/lib/game/types';
import { encode } from './protocol';

export interface ConnectionInfo {
  roomCode: RoomCode;
  userId: UserId;
}

export interface SandboxConnectionInfo {
  roomCode: RoomCode;
  hostId: UserId;
  userIds: UserId[];
  viewingAs: UserId;
}

export const connections = new Map<WebSocket, ConnectionInfo>();
export const sandboxConnections = new Map<WebSocket, SandboxConnectionInfo>();
export const userSockets = new Map<string, WebSocket>();

export function socketKey(roomCode: string, userId: string) {
  return `${roomCode}:${userId}`;
}

export function send(ws: WebSocket, msg: S2CMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(encode(msg));
  }
}
