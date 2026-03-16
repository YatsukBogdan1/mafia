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
    router.push(
      `/room?name=${encodeURIComponent(name.trim())}&action=create`,
    );
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !roomCode.trim()) return;
    router.push(
      `/room?name=${encodeURIComponent(name.trim())}&action=join&code=${encodeURIComponent(roomCode.trim().toUpperCase())}`,
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-zinc-900 p-8">
        <h1 className="text-3xl font-bold text-white">Mafia</h1>

        {mode === 'choose' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-400">
              Create a new game or join an existing one.
            </p>
            <button
              onClick={() => setMode('create')}
              className="rounded-lg bg-white py-3 font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode('join')}
              className="rounded-lg border border-zinc-600 py-3 font-semibold text-white transition-colors hover:border-zinc-400"
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <p className="text-sm text-zinc-400">
              You&apos;ll be the host (game master).
            </p>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-zinc-400">Your name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
                autoFocus
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-white py-3 font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              Create Room
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-zinc-400">Your name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
                autoFocus
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-zinc-400">Room code</span>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="XXXXX"
                required
                maxLength={6}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-center font-mono text-lg tracking-widest text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-white py-3 font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
