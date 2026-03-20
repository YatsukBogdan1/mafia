'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, refetch } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/');
    if (user) setDisplayName(user.displayName ?? '');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0b0b', color: '#5a5552', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      setMessage('Saved');
      await refetch();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(140,18,36,0.18) 0%, #0c0b0b 65%)',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 28 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-cinzel)', fontSize: 16, fontWeight: 700, letterSpacing: '0.18em', color: '#e8e3de' }}>
            SETTINGS
          </h2>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#3a3330', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#7a6f6a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3330')}
          >
            ← Back
          </button>
        </div>

        <div style={{ background: '#131111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28 }}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#5a5552' }}>
                Username
              </label>
              <div style={{ fontSize: 13, color: '#3a3330', padding: '10px 0' }}>
                {user.username}
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#5a5552' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setMessage(''); }}
                placeholder="How you appear in game"
                required
                maxLength={24}
                style={{
                  background: '#1c1919',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 9,
                  padding: '12px 14px',
                  color: '#e8e3de',
                  fontSize: 14,
                  outline: 'none',
                  width: '100%',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(196,30,58,0.55)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
              />
              <p style={{ margin: 0, fontSize: 11, color: '#3a3330' }}>
                Shown to other players in the room
              </p>
            </div>

            {error && <p style={{ margin: 0, fontSize: 12, color: '#c41e3a' }}>{error}</p>}
            {message && <p style={{ margin: 0, fontSize: 12, color: '#4a9' }}>{message}</p>}

            <button
              type="submit"
              disabled={busy || !displayName.trim()}
              style={{
                border: 'none', borderRadius: 10, padding: '12px 20px',
                fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
                background: '#c41e3a', color: 'white',
                opacity: busy || !displayName.trim() ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#a81b33'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#c41e3a'; }}
            >
              {busy ? '…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
