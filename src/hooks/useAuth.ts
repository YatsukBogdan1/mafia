'use client';
import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  mediaPrefs: { camera: boolean; mic: boolean };
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { user, loading, refetch };
}
