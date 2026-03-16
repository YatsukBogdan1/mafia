'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  C2SMessage,
  S2CMessage,
  ClientGameState,
  GameAction,
  PlayerRole,
  NightResult,
} from '@/lib/game/types';

interface UseGameSocketOptions {
  url: string;
}

interface UseGameSocketReturn {
  isConnected: boolean;
  gameState: ClientGameState | null;
  myPlayerId: string | null;
  myRole: PlayerRole | null;
  roomCode: string | null;
  nightResult: NightResult | null;
  error: string | null;
  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  sendHostAction: (action: GameAction) => void;
  sendPlayerAction: (action: GameAction) => void;
  clearNightResult: () => void;
}

export function useGameSocket({ url }: UseGameSocketOptions): UseGameSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<PlayerRole | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [nightResult, setNightResult] = useState<NightResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as S2CMessage;
      switch (msg.type) {
        case 'room_created':
          setMyPlayerId(msg.playerId);
          setRoomCode(msg.roomCode);
          break;
        case 'room_joined':
          setMyPlayerId(msg.playerId);
          setRoomCode(msg.roomCode);
          break;
        case 'state_update':
          setGameState(msg.state);
          break;
        case 'role_assigned':
          setMyRole(msg.role);
          break;
        case 'night_result':
          setNightResult(msg.result);
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
      // Reconnect with exponential backoff
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000);
      reconnectAttempts.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Ping to keep connection alive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback((msg: C2SMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const createRoom = useCallback(
    (playerName: string) => {
      sendMessage({ type: 'create_room', playerName });
    },
    [sendMessage],
  );

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      sendMessage({ type: 'join_room', roomCode: code, playerName });
    },
    [sendMessage],
  );

  const sendHostAction = useCallback(
    (action: GameAction) => {
      sendMessage({ type: 'host_action', action });
    },
    [sendMessage],
  );

  const sendPlayerAction = useCallback(
    (action: GameAction) => {
      sendMessage({ type: 'player_action', action });
    },
    [sendMessage],
  );

  const clearNightResult = useCallback(() => {
    setNightResult(null);
  }, []);

  return {
    isConnected,
    gameState,
    myPlayerId,
    myRole,
    roomCode,
    nightResult,
    error,
    createRoom,
    joinRoom,
    sendHostAction,
    sendPlayerAction,
    clearNightResult,
  };
}
