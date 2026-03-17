'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LobbyPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    router.push(`/room?name=${encodeURIComponent(name.trim())}&action=create`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !roomCode.trim()) return;
    router.push(`/room?name=${encodeURIComponent(name.trim())}&action=join&code=${encodeURIComponent(roomCode.trim().toUpperCase())}`);
  }

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

        {/* Title */}
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

        {/* Card */}
        <div style={{
          background: '#131111',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}>
          {mode === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#5a5552', margin: '0 0 6px', textAlign: 'center', lineHeight: 1.5 }}>
                Create a new room or join an existing one
              </p>
              <Btn variant="primary" onClick={() => setMode('create')}>Create Room</Btn>
              <Btn variant="secondary" onClick={() => setMode('join')}>Join Room</Btn>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ModeLabel>Create Room · Host</ModeLabel>
              <NameInput value={name} onChange={setName} />
              <Btn variant="primary" type="submit">Create Room →</Btn>
              <Btn variant="ghost" type="button" onClick={() => setMode('choose')}>← Back</Btn>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ModeLabel>Join Room · Player</ModeLabel>
              <NameInput value={name} onChange={setName} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <FieldLabel>Room Code</FieldLabel>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="XXXXX"
                  required
                  maxLength={6}
                  style={{
                    background: '#1c1919',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 9,
                    padding: '12px 14px',
                    color: '#e8e3de',
                    fontSize: 22,
                    fontFamily: 'var(--font-jetbrains-mono)',
                    letterSpacing: '0.35em',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    outline: 'none',
                    width: '100%',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(196,30,58,0.55)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                />
              </div>
              <Btn variant="primary" type="submit">Join Room →</Btn>
              <Btn variant="ghost" type="button" onClick={() => setMode('choose')}>← Back</Btn>
            </form>
          )}
        </div>
      </div>
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

function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FieldLabel>Your Name</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your name"
        required
        autoFocus
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
    </div>
  );
}

function Btn({ children, variant, type, onClick }: {
  children: React.ReactNode;
  variant: 'primary' | 'secondary' | 'ghost';
  type?: 'submit' | 'button';
  onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 10, padding: '12px 20px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    letterSpacing: '0.02em', transition: 'all 0.15s', width: '100%',
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
      style={styles[variant]}
      onMouseEnter={e => {
        if (variant === 'primary')   e.currentTarget.style.background = '#a81b33';
        if (variant === 'secondary') { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }
        if (variant === 'ghost')     e.currentTarget.style.color = '#9c948c';
      }}
      onMouseLeave={e => {
        if (variant === 'primary')   e.currentTarget.style.background = '#c41e3a';
        if (variant === 'secondary') { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }
        if (variant === 'ghost')     e.currentTarget.style.color = '#5a5552';
      }}
    >
      {children}
    </button>
  );
}
