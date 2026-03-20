'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface RoomInfo {
  code: string;
  hostName: string;
  playerCount: number;
  phase: string;
}

function getWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export function useRoomList() {
  const wsRef = useRef<WebSocket | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'list_rooms' }));
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'list_rooms' }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'room_list') {
        setRooms(msg.rooms);
        setLoading(false);
      }
    };

    ws.onerror = () => {
      setLoading(false);
    };

    return () => { ws.close(); };
  }, []);

  return { rooms, loading, refresh };
}
