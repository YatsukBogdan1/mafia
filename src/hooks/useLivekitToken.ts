import { useEffect, useState } from 'react';

export function useLivekitToken(roomName: string | undefined, participantName: string | null): string {
  const [token, setToken] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!roomName || !participantName || token) return;
    let cancelled = false;
    fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantName }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.token) setToken(d.token); })
      .catch(() => {
        if (!cancelled) setTimeout(() => setRetry(n => n + 1), 2000);
      });
    return () => { cancelled = true; };
  }, [roomName, participantName, token, retry]);

  return token;
}
