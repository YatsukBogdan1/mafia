'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  C2SMessage,
  S2CMessage,
  ClientGameState,
  DeadViewMode,
  GameAction,
  PlayerRole,
} from '@/lib/game/types';

const SESSION_KEY = 'mafia_session';

interface SessionInfo {
  roomCode: string;
  userId: string;
}

function saveSession(info: SessionInfo) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(info)); } catch {}
}

function loadSession(): SessionInfo | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

interface UseGameSocketOptions {
  url: string;
  /**
   * Controls session-based auto-reconnect on connect:
   *   undefined  → always attempt reconnect with saved session (default)
   *   null       → skip reconnect entirely (e.g. when creating a fresh room)
   *   "XXXXX"    → only reconnect if the saved session's roomCode matches this code
   */
  forceRoomCode?: string | null;
}

interface UseGameSocketReturn {
  isConnected: boolean;
  gameState: ClientGameState | null;
  myUserId: string | null;
  myRole: PlayerRole | null;
  roomCode: string | null;
  error: string | null;
  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  sendHostAction: (action: GameAction) => void;
  sendPlayerAction: (action: GameAction) => void;
  setDeadViewMode: (mode: DeadViewMode) => void;
}

export function useGameSocket({ url, forceRoomCode }: UseGameSocketOptions): UseGameSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<PlayerRole | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttempts = useRef(0);
  const hasTriedReconnect = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;

      if (!hasTriedReconnect.current) {
        hasTriedReconnect.current = true;
        const session = loadSession();
        if (session) {
          const shouldReconnect =
            forceRoomCode === undefined ||
            (forceRoomCode !== null && session.roomCode === forceRoomCode.toUpperCase());
          if (shouldReconnect) {
            ws.send(JSON.stringify({
              type: 'reconnect',
              roomCode: session.roomCode,
              userId: session.userId,
            }));
          }
        }
      }
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as S2CMessage;
      switch (msg.type) {
        case 'room_created':
          setMyUserId(msg.userId);
          setRoomCode(msg.roomCode);
          setError(null);
          saveSession({ roomCode: msg.roomCode, userId: msg.userId });
          break;
        case 'room_joined':
          setMyUserId(msg.userId);
          setRoomCode(msg.roomCode);
          setError(null);
          saveSession({ roomCode: msg.roomCode, userId: msg.userId });
          break;
        case 'reconnected':
          setMyUserId(msg.userId);
          setRoomCode(msg.roomCode);
          if (msg.role) setMyRole(msg.role);
          setError(null);
          saveSession({ roomCode: msg.roomCode, userId: msg.userId });
          break;
        case 'state_update':
          setGameState(msg.state);
          break;
        case 'role_assigned':
          setMyRole(msg.role);
          break;
        case 'error':
          setError(msg.message);
          break;
        case 'pong':
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      hasTriedReconnect.current = false;
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000);
      reconnectAttempts.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => { ws.close(); };
  }, [url, forceRoomCode]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Ping to keep connection alive (10s to beat any proxy idle timeout)
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback((msg: C2SMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const createRoom = useCallback(
    (playerName: string) => sendMessage({ type: 'create_room', playerName }),
    [sendMessage],
  );

  const joinRoom = useCallback(
    (code: string, playerName: string) => sendMessage({ type: 'join_room', roomCode: code, playerName }),
    [sendMessage],
  );

  const sendHostAction = useCallback(
    (action: GameAction) => sendMessage({ type: 'host_action', action }),
    [sendMessage],
  );

  const sendPlayerAction = useCallback(
    (action: GameAction) => sendMessage({ type: 'player_action', action }),
    [sendMessage],
  );

  const setDeadViewMode = useCallback(
    (mode: DeadViewMode) => sendMessage({ type: 'set_dead_view', mode }),
    [sendMessage],
  );

  return {
    isConnected,
    gameState,
    myUserId,
    myRole,
    roomCode,
    error,
    createRoom,
    joinRoom,
    sendHostAction,
    sendPlayerAction,
    setDeadViewMode,
  };
}
