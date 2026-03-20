'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRoomList } from '@/hooks/useRoomList';

type Mode = 'choose' | 'create' | 'join';
type AuthMode = 'choose' | 'login' | 'register';

export default function LobbyPage() {
  const router = useRouter();
  const { user, loading, refetch } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>('choose');
  const [roomMode, setRoomMode] = useState<Mode>('choose');

  if (loading) return <Screen><Spinner /></Screen>;

  if (!user) {
    return (
      <Screen>
        <Logo />
        <Card>
          <AuthPanel mode={authMode} setMode={setAuthMode} onSuccess={refetch} />
        </Card>
      </Screen>
    );
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    refetch();
  }

  return (
    <Screen>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#5a5552', letterSpacing: '0.06em' }}>
            {user.displayName}
          </span>
          <span style={{ color: '#2a2726', fontSize: 11 }}>·</span>
          <button
            onClick={() => router.push('/profile')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#3a3330', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 0' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#7a6f6a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3330')}
          >
            Settings
          </button>
          <span style={{ color: '#2a2726', fontSize: 11 }}>·</span>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#3a3330', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 0' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#7a6f6a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3330')}
          >
            Sign out
          </button>
        </div>
      </div>

      <Card>
        {roomMode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: '#5a5552', margin: '0 0 6px', textAlign: 'center', lineHeight: 1.5 }}>
              Create a new room or join an existing one
            </p>
            <Btn variant="primary" onClick={() => router.push('/room/new')}>Create Room</Btn>
            <Btn variant="secondary" onClick={() => setRoomMode('join')}>Join Room</Btn>
          </div>
        )}

        {roomMode === 'join' && (
          <JoinPanel onBack={() => setRoomMode('choose')} />
        )}
      </Card>
    </Screen>
  );
}

// ─── Join panel (room list + manual code) ────────────────────────────────────

function JoinPanel({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { rooms, loading, refresh } = useRoomList();
  const [manualCode, setManualCode] = useState('');

  function handleManualJoin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    router.push(`/room/${manualCode.trim().toUpperCase()}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModeLabel>Join Room · Player</ModeLabel>

      {/* Room list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FieldLabel>Active Rooms</FieldLabel>
          <button
            onClick={refresh}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#5a5552', letterSpacing: '0.08em', textTransform: 'uppercase', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9c948c')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5a5552')}
          >
            Refresh
          </button>
        </div>

        <div style={{
          background: '#1c1919',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 9,
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#4a4744', fontSize: 12 }}>
              Loading…
            </div>
          ) : rooms.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#4a4744', fontSize: 12 }}>
              No active rooms
            </div>
          ) : (
            rooms.map(room => (
              <button
                key={room.code}
                onClick={() => router.push(`/room/${room.code}`)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px',
                  background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', color: '#e8e3de', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-jetbrains-mono)', letterSpacing: '0.15em' }}>
                    {room.code}
                  </span>
                  <span style={{ fontSize: 11, color: '#5a5552' }}>
                    Host: {room.hostName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#5a5552' }}>
                    {room.playerCount} {room.playerCount === 1 ? 'player' : 'players'}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '2px 6px', borderRadius: 4,
                    background: room.phase === 'lobby' ? 'rgba(74,163,88,0.15)' : 'rgba(196,30,58,0.15)',
                    color: room.phase === 'lobby' ? '#4aa358' : '#c41e3a',
                  }}>
                    {room.phase === 'lobby' ? 'Open' : room.phase === 'game' ? 'In Game' : 'Ended'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Manual code entry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontSize: 10, color: '#3a3330', letterSpacing: '0.1em', textTransform: 'uppercase' }}>or enter code</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <form onSubmit={handleManualJoin} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="XXXXX"
          maxLength={6}
          style={{
            flex: 1,
            background: '#1c1919',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 9,
            padding: '10px 14px',
            color: '#e8e3de',
            fontSize: 16,
            fontFamily: 'var(--font-jetbrains-mono)',
            letterSpacing: '0.35em',
            textAlign: 'center',
            textTransform: 'uppercase',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(196,30,58,0.55)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
        />
        <button
          type="submit"
          disabled={!manualCode.trim()}
          style={{
            background: '#c41e3a', border: 'none', borderRadius: 9, padding: '10px 16px',
            color: 'white', fontSize: 13, fontWeight: 600, cursor: manualCode.trim() ? 'pointer' : 'default',
            opacity: manualCode.trim() ? 1 : 0.5, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (manualCode.trim()) e.currentTarget.style.background = '#a81b33'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#c41e3a'; }}
        >
          Join
        </button>
      </form>

      <Btn variant="ghost" type="button" onClick={onBack}>← Back</Btn>
    </div>
  );
}

// ─── Auth panel ──────────────────────────────────────────────────────────────

function AuthPanel({
  mode,
  setMode,
  onSuccess,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      onSuccess();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'choose') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13, color: '#5a5552', margin: '0 0 6px', textAlign: 'center', lineHeight: 1.5 }}>
          Sign in to play
        </p>
        <Btn variant="primary" onClick={() => setMode('login')}>Sign In</Btn>
        <Btn variant="secondary" onClick={() => setMode('register')}>Create Account</Btn>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModeLabel>{mode === 'login' ? 'Sign In' : 'Create Account'}</ModeLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <FieldLabel>Username</FieldLabel>
          <TextInput
            value={username}
            onChange={setUsername}
            placeholder="your_username"
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <FieldLabel>Password</FieldLabel>
          <TextInput
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
        </div>
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 12, color: '#c41e3a', textAlign: 'center' }}>{error}</p>
      )}

      <Btn variant="primary" type="submit" disabled={busy}>
        {busy ? '…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
      </Btn>
      <Btn variant="ghost" type="button" onClick={() => { setMode('choose'); setError(''); }}>← Back</Btn>
    </form>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(140,18,36,0.18) 0%, #0c0b0b 65%)',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 36 }}>
        {children}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,30,58,0.8) 0%, rgba(196,30,58,0.1) 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 30px rgba(196,30,58,0.35)',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#c41e3a' }} />
        </div>
      </div>
      <h1 style={{
        fontFamily: 'var(--font-cinzel)',
        fontSize: 48,
        fontWeight: 700,
        letterSpacing: '0.22em',
        color: '#e8e3de',
        margin: 0,
        lineHeight: 1,
      }}>
        MAFIA
      </h1>
      <p style={{
        marginTop: 10,
        fontSize: 11,
        color: '#4a4744',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        A game of deception &amp; trust
      </p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#131111',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: 28,
    }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', color: '#3a3330', fontSize: 13, letterSpacing: '0.08em' }}>
      Loading…
    </div>
  );
}

function ModeLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4a4744', marginBottom: 2 }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#5a5552' }}>
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text', autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required
      autoFocus={autoFocus}
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
  );
}

function Btn({ children, variant, type, onClick, disabled }: {
  children: React.ReactNode;
  variant: 'primary' | 'secondary' | 'ghost';
  type?: 'submit' | 'button';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 10, padding: '12px 20px',
    fontSize: 14, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    letterSpacing: '0.02em', transition: 'all 0.15s', width: '100%',
    opacity: disabled ? 0.5 : 1,
  };
  const styles: Record<string, React.CSSProperties> = {
    primary:   { ...base, background: '#c41e3a', color: 'white' },
    secondary: { ...base, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#c8c0b8' },
    ghost:     { ...base, background: 'none', color: '#5a5552', fontSize: 13, padding: '8px 20px' },
  };
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      style={styles[variant]}
      onMouseEnter={e => {
        if (disabled) return;
        if (variant === 'primary')   e.currentTarget.style.background = '#a81b33';
        if (variant === 'secondary') { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }
        if (variant === 'ghost')     e.currentTarget.style.color = '#9c948c';
      }}
      onMouseLeave={e => {
        if (variant === 'primary')   e.currentTarget.style.background = disabled ? '#c41e3a' : '#c41e3a';
        if (variant === 'secondary') { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }
        if (variant === 'ghost')     e.currentTarget.style.color = '#5a5552';
      }}
    >
      {children}
    </button>
  );
}
