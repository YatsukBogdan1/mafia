'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGameSocket } from '@/hooks/useGameSocket';
import { VideoRoom } from '@/components/VideoRoom';

/** Format a player as "N. Name" when a seat number is assigned, else just "Name". */
function pName(player: { name: string; seatNumber: number | null } | null | undefined): string {
  if (!player) return '?';
  return player.seatNumber != null ? `${player.seatNumber}. ${player.name}` : player.name;
}

function getWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const name = searchParams.get('name');
  const action = searchParams.get('action');
  const code = searchParams.get('code');

  const {
    isConnected,
    gameState,
    myPlayerId,
    myRole,
    roomCode,
    error,
    createRoom,
    joinRoom,
    sendHostAction,
    sendPlayerAction,
  } = useGameSocket({ url: getWsUrl() });

  const hasJoined = useRef(false);
  const [token, setToken] = React.useState('');

  useEffect(() => {
    if (!isConnected || hasJoined.current || !name) return;
    if (roomCode) { hasJoined.current = true; return; }
    const timer = setTimeout(() => {
      if (hasJoined.current) return;
      hasJoined.current = true;
      if (action === 'create') createRoom(name);
      else if (action === 'join' && code) joinRoom(code, name);
      else router.push('/');
    }, 200);
    return () => clearTimeout(timer);
  }, [isConnected, name, action, code, roomCode, createRoom, joinRoom, router]);

  useEffect(() => {
    if (!gameState?.livekitRoomName || !myPlayerId || token) return;
    fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: gameState.livekitRoomName, participantName: myPlayerId }),
    })
      .then((res) => res.json())
      .then((data) => setToken(data.token));
  }, [gameState?.livekitRoomName, myPlayerId, token]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push('/')} className="rounded-lg border border-zinc-600 px-6 py-2 hover:border-zinc-400">
          Back to Lobby
        </button>
      </div>
    );
  }

  if (!gameState || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        Connecting...
      </div>
    );
  }

  const isHost = myPlayerId === gameState.hostId;
  const phase = gameState.phase;
  const players = Object.values(gameState.players);

  const phaseLabel =
    phase.type === 'lobby' ? 'Lobby' :
    phase.type === 'game' ? 'In Progress' :
    `Game Over — ${phase.winner} win!`;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-bold">Mafia</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-sm">{gameState.code}</span>
          <span className="text-sm text-zinc-400">{phaseLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {myRole && <span className="rounded bg-zinc-800 px-2 py-0.5 text-sm">{myRole}</span>}
          <span className="text-sm text-zinc-400">{players.filter((p) => !p.isHost).length} players</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video */}
        <div className="flex-1 overflow-hidden">
          <VideoRoom token={token} onDisconnect={() => router.push('/')} players={gameState.players} />
        </div>

        {/* Sidebar */}
        <div className="flex w-72 flex-col gap-3 overflow-y-auto border-l border-zinc-800 p-3">
          {isHost ? (
            <HostControls
              gameState={gameState}
              sendHostAction={sendHostAction}
            />
          ) : (
            <PlayerControls
              gameState={gameState}
              myPlayerId={myPlayerId!}
              myRole={myRole}
              sendPlayerAction={sendPlayerAction}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Host Sidebar ────────────────────────────────────────────────────────────

function HostControls({
  gameState,
  sendHostAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  sendHostAction: (action: import('@/lib/game/types').GameAction) => void;
}) {
  const { phase, players, vote, speaking, round, playerOrder } = gameState;
  const alivePlayers = Object.values(players).filter((p) => p.isAlive && !p.isHost);
  const inGame = phase.type === 'game';

  const aliveOrder = playerOrder.filter((id) => players[id]?.isAlive && !players[id]?.isHost);
  const suggestedSpeakerId = inGame && aliveOrder.length > 0
    ? aliveOrder[(round - 1) % aliveOrder.length]
    : null;
  const suggestedSpeaker = suggestedSpeakerId ? players[suggestedSpeakerId] : null;

  return (
    <>
      {phase.type === 'lobby' && (
        <button
          onClick={() => sendHostAction({ type: 'start_game' })}
          className="rounded-lg bg-white py-2 text-sm font-semibold text-black hover:bg-zinc-200"
        >
          Start Game
        </button>
      )}

      {phase.type === 'gameover' && (
        <div className="flex flex-col gap-2">
          <div className="rounded bg-zinc-800 px-3 py-2 text-center text-sm">
            {phase.winner === 'mafia' ? '🔴 Mafia wins!' : '🟢 Villagers win!'}
          </div>
          <button
            onClick={() => sendHostAction({ type: 'reset_game' })}
            className="rounded-lg bg-white py-2 text-sm font-semibold text-black hover:bg-zinc-200"
          >
            Back to Lobby
          </button>
        </div>
      )}

      {inGame && (
        <>
          {/* Round info + Next Round */}
          <div className="flex items-center justify-between rounded bg-zinc-800 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-400">Round {round}</span>
              {suggestedSpeaker && (
                <span className="text-xs text-amber-400">First speaker: {pName(suggestedSpeaker)}</span>
              )}
            </div>
            <button
              onClick={() => sendHostAction({ type: 'next_round' })}
              className="rounded bg-zinc-600 px-3 py-1 text-xs hover:bg-zinc-500"
            >
              Next Round
            </button>
          </div>

          {/* Mic controls */}
          <div className="flex gap-2">
            <button
              onClick={() => sendHostAction({ type: 'mute_all' })}
              className="flex-1 rounded bg-zinc-700 py-1.5 text-xs hover:bg-zinc-600"
            >
              Mute All
            </button>
            <button
              onClick={() => sendHostAction({ type: 'unmute_all' })}
              className="flex-1 rounded bg-zinc-700 py-1.5 text-xs hover:bg-zinc-600"
            >
              Unmute All
            </button>
          </div>

          {/* 1-min timer */}
          <SpeakingTimer />

          {/* Player list */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-zinc-400">Players</span>
            {alivePlayers.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded bg-zinc-800 px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-sm">
                  <span>{pName(p)}</span>
                  {p.role && <span className="text-xs text-zinc-500">{p.role}</span>}
                  {speaking.currentSpeaker === p.id && <span className="text-xs text-green-400">●</span>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => sendHostAction({ type: 'grant_speaking', playerId: p.id })}
                    title="Grant mic"
                    className="rounded px-1.5 py-0.5 text-xs bg-green-800 hover:bg-green-700"
                  >
                    🎤
                  </button>
                  <button
                    onClick={() => sendHostAction({ type: 'nominate', targetId: p.id })}
                    title="Nominate for voting"
                    disabled={vote.nominees.includes(p.id)}
                    className="rounded px-1.5 py-0.5 text-xs bg-zinc-600 hover:bg-zinc-500 disabled:opacity-30"
                  >
                    +
                  </button>
                  <button
                    onClick={() => sendHostAction({ type: 'host_eliminate', playerId: p.id })}
                    title="Eliminate"
                    className="rounded px-1.5 py-0.5 text-xs bg-red-900 hover:bg-red-700"
                  >
                    💀
                  </button>
                </div>
              </div>
            ))}
            {speaking.currentSpeaker && (
              <button
                onClick={() => sendHostAction({ type: 'end_speaking' })}
                className="mt-1 rounded bg-zinc-700 py-1 text-xs hover:bg-zinc-600"
              >
                End Speaking
              </button>
            )}
          </div>

          {/* Dead players */}
          <DeadPlayers players={Object.values(players)} />

          {/* Voting */}
          <VotingControls gameState={gameState} sendHostAction={sendHostAction} />
        </>
      )}
    </>
  );
}

// ─── 1-minute speaking timer ─────────────────────────────────────────────────

function SpeakingTimer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = (duration: number) => {
    setSeconds(duration);
    setRunning(true);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { setRunning(false); clearInterval(intervalRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const stop = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setSeconds(60);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div className="flex items-center gap-2 rounded bg-zinc-800 px-3 py-2">
      <span className={`font-mono text-lg font-bold w-10 ${seconds <= 10 && running ? 'text-red-400' : 'text-amber-400'}`}>
        {String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')}
      </span>
      {running ? (
        <button onClick={stop} className="rounded bg-zinc-600 px-3 py-1 text-xs hover:bg-zinc-500">Stop</button>
      ) : (
        <>
          <button onClick={() => start(30)} className="rounded bg-amber-700 px-2 py-1 text-xs hover:bg-amber-600">30s</button>
          <button onClick={() => start(60)} className="rounded bg-amber-700 px-2 py-1 text-xs hover:bg-amber-600">1 min</button>
        </>
      )}
    </div>
  );
}

// ─── Dead players section ─────────────────────────────────────────────────────

function DeadPlayers({ players }: { players: import('@/lib/game/types').ClientPlayer[] }) {
  const dead = players.filter((p) => !p.isAlive && !p.isHost);
  if (dead.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-zinc-500">Eliminated</span>
      {dead.map((p) => (
        <div key={p.id} className="rounded bg-zinc-900 px-2 py-1 text-sm text-zinc-500">
          {pName(p)} {p.role && <span className="text-xs">({p.role})</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Voting (host side) ───────────────────────────────────────────────────────

function VotingControls({
  gameState,
  sendHostAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  sendHostAction: (action: import('@/lib/game/types').GameAction) => void;
}) {
  const { vote, players } = gameState;

  if (vote.nominees.length === 0) return null;

  const currentNominee = vote.currentNomineeIndex >= 0
    ? vote.nominees[vote.currentNomineeIndex]
    : null;

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-700 p-2">
      <span className="text-xs font-semibold text-zinc-400">Voting</span>

      {vote.nominees.map((nid, i) => {
        const voteCount = Object.values(vote.votes).filter((v) => v === nid).length;
        const isCurrent = i === vote.currentNomineeIndex;
        const isDone = i < vote.currentNomineeIndex || vote.finished;
        return (
          <div key={nid} className={`rounded px-2 py-1 text-sm ${isCurrent ? 'bg-zinc-700 ring-1 ring-white' : 'bg-zinc-800'} ${isDone ? 'text-zinc-500' : ''}`}>
            {pName(players[nid])}
            {isDone && ` — ${voteCount} votes`}
            {isCurrent && ' (voting now)'}
          </div>
        );
      })}

      {!vote.finished && (
        <button
          onClick={() => sendHostAction({ type: 'start_nominee_vote' })}
          className="rounded bg-white py-1.5 text-xs font-semibold text-black hover:bg-zinc-200"
        >
          {vote.currentNomineeIndex < 0
            ? `Start vote: ${pName(players[vote.nominees[0]])}`
            : vote.currentNomineeIndex + 1 < vote.nominees.length
              ? `Next: ${pName(players[vote.nominees[vote.currentNomineeIndex + 1]])}`
              : 'Finalize'}
        </button>
      )}

      {vote.finished && currentNominee && (() => {
        const topVotes = Math.max(...vote.nominees.map((nid) =>
          Object.values(vote.votes).filter((v) => v === nid).length
        ));
        const topNominees = vote.nominees.filter((nid) =>
          Object.values(vote.votes).filter((v) => v === nid).length === topVotes
        );
        const eliminate = topNominees[0];
        return (
          <div className="flex gap-2">
            <button
              onClick={() => sendHostAction({ type: 'host_eliminate', playerId: eliminate })}
              className="flex-1 rounded bg-red-700 py-1.5 text-xs font-semibold hover:bg-red-600"
            >
              Eliminate {pName(players[eliminate])}
            </button>
            <button
              onClick={() => sendHostAction({ type: 'host_save' })}
              className="flex-1 rounded bg-zinc-700 py-1.5 text-xs hover:bg-zinc-600"
            >
              Save
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Player Sidebar ───────────────────────────────────────────────────────────

function PlayerControls({
  gameState,
  myPlayerId,
  myRole,
  sendPlayerAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  myPlayerId: string;
  myRole: import('@/lib/game/types').PlayerRole | null;
  sendPlayerAction: (action: import('@/lib/game/types').GameAction) => void;
}) {
  const { phase, players, vote, speaking } = gameState;
  const me = players[myPlayerId];

  return (
    <>
      {/* Role */}
      {myRole && (
        <div className="rounded bg-zinc-800 px-3 py-2 text-center">
          <span className="text-xs text-zinc-500">Your role</span>
          <div className="font-semibold capitalize">{myRole}</div>
        </div>
      )}

      {/* Phase */}
      <div className="text-center text-sm text-zinc-400">
        {phase.type === 'lobby' && 'Waiting for host to start…'}
        {phase.type === 'game' && `Round ${gameState.round}`}
        {phase.type === 'gameover' && `Game over — ${phase.winner} win!`}
      </div>

      {/* Eliminated notice */}
      {me && !me.isAlive && (
        <div className="rounded bg-red-950 border border-red-800 px-3 py-2 text-center text-sm text-red-300">
          You have been eliminated
        </div>
      )}

      {/* Speaking indicator */}
      {speaking.currentSpeaker === myPlayerId && (
        <div className="rounded bg-green-900 px-3 py-2 text-center text-sm text-green-300">
          You have the mic 🎤
        </div>
      )}

      {/* Voting */}
      {me?.isAlive && phase.type === 'game' && vote.nominees.length > 0 && (
        <PlayerVoting
          gameState={gameState}
          myPlayerId={myPlayerId}
          sendPlayerAction={sendPlayerAction}
        />
      )}

      {/* Mafia teammates */}
      {(myRole === 'mafia' || myRole === 'don') && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Mafia team</span>
          {Object.values(players)
            .filter((p) => !p.isHost && (p.role === 'mafia' || p.role === 'don') && p.id !== myPlayerId)
            .map((p) => (
              <div key={p.id} className="rounded bg-zinc-800 px-2 py-1 text-sm">
                {pName(p)} <span className="text-xs text-zinc-500">({p.role})</span>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

// ─── Player voting UI ─────────────────────────────────────────────────────────

function PlayerVoting({
  gameState,
  myPlayerId,
  sendPlayerAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  myPlayerId: string;
  sendPlayerAction: (action: import('@/lib/game/types').GameAction) => void;
}) {
  const { vote, players } = gameState;
  const [expired, setExpired] = useState(false);

  const hasVoted = vote.usedVotes.includes(myPlayerId);
  const currentNominee = vote.currentNomineeIndex >= 0
    ? vote.nominees[vote.currentNomineeIndex]
    : null;

  if (vote.finished) {
    return (
      <div className="flex flex-col gap-1 rounded border border-zinc-700 p-2">
        <span className="text-xs text-zinc-400">Voting results</span>
        {vote.nominees.map((nid) => {
          const count = Object.values(vote.votes).filter((v) => v === nid).length;
          return (
            <div key={nid} className="rounded bg-zinc-800 px-2 py-1 text-sm">
              {pName(players[nid])} — {count} votes
            </div>
          );
        })}
      </div>
    );
  }

  if (!currentNominee) {
    return (
      <div className="rounded border border-zinc-700 p-2 text-sm text-zinc-500">
        Nominees: {vote.nominees.map((nid) => pName(players[nid])).join(', ')}
        <br />Waiting for host to start vote…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-700 p-2">
      <span className="text-xs text-zinc-400">
        Vote on: {pName(players[currentNominee])} ({vote.currentNomineeIndex + 1}/{vote.nominees.length})
      </span>
      {vote.votingDeadline && (
        <VoteCountdown deadline={vote.votingDeadline} onExpiredChange={setExpired} />
      )}
      {hasVoted ? (
        <p className="text-sm text-zinc-500">Vote cast</p>
      ) : expired ? (
        <p className="text-sm text-zinc-500">Time expired</p>
      ) : (
        <button
          onClick={() => sendPlayerAction({ type: 'cast_vote', voterId: myPlayerId })}
          className="rounded-lg bg-red-700 py-2 text-sm font-semibold hover:bg-red-600"
        >
          Vote for {pName(players[currentNominee])}
        </button>
      )}
    </div>
  );
}

function VoteCountdown({ deadline, onExpiredChange }: { deadline: number; onExpiredChange?: (expired: boolean) => void }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      onExpiredChange?.(left <= 0);
      if (left <= 0) clearInterval(interval);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [deadline, onExpiredChange]);

  return (
    <div className="text-center">
      <span className={`font-mono text-lg font-bold ${remaining <= 1 ? 'text-red-400' : 'text-amber-400'}`}>
        {remaining}s
      </span>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">Loading…</div>
    }>
      <RoomContent />
    </Suspense>
  );
}
