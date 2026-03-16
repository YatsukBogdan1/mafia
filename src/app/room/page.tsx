'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGameSocket } from '@/hooks/useGameSocket';
import { VideoRoom } from '@/components/VideoRoom';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const name = searchParams.get('name');
  const action = searchParams.get('action'); // 'create' or 'join'
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
  } = useGameSocket({ url: WS_URL });

  const hasJoined = useRef(false);
  const [token, setToken] = React.useState('');

  // Join/create room once connected
  useEffect(() => {
    if (!isConnected || hasJoined.current || !name) return;
    hasJoined.current = true;

    if (action === 'create') {
      createRoom(name);
    } else if (action === 'join' && code) {
      joinRoom(code, name);
    } else {
      router.push('/');
    }
  }, [isConnected, name, action, code, createRoom, joinRoom, router]);

  // Fetch LiveKit token once we have a room and player ID
  useEffect(() => {
    if (!gameState?.livekitRoomName || !myPlayerId) return;
    if (token) return; // already fetched

    fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: gameState.livekitRoomName,
        participantName: myPlayerId,
      }),
    })
      .then((res) => res.json())
      .then((data) => setToken(data.token));
  }, [gameState?.livekitRoomName, myPlayerId, token]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg border border-zinc-600 px-6 py-2 hover:border-zinc-400"
        >
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
  const playerList = Object.values(gameState.players);
  const phase = gameState.phase;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-bold">Mafia</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-sm">
            {gameState.code}
          </span>
          <span className="text-sm text-zinc-400">
            {phase.type === 'lobby' && 'Lobby'}
            {phase.type === 'night' &&
              `Night ${phase.nightNumber} — ${phase.subphase.replace('_', ' ')}`}
            {phase.type === 'day' &&
              `Day ${phase.dayNumber} — ${phase.subphase}`}
            {phase.type === 'gameover' &&
              `Game Over — ${phase.winner} win!`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {myRole && (
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-sm">
              {myRole}
            </span>
          )}
          <span className="text-sm text-zinc-400">
            {playerList.filter((p) => !p.isHost).length} players
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex-1">
          <VideoRoom
            token={token}
            onDisconnect={() => router.push('/')}
          />
        </div>

        {/* Sidebar */}
        <div className="flex w-72 flex-col gap-4 overflow-y-auto border-l border-zinc-800 p-4">
          {/* Player list */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-400">
              Players
            </h3>
            <div className="flex flex-col gap-1">
              {playerList.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                    !p.isAlive ? 'text-zinc-600 line-through' : ''
                  } ${
                    p.id === gameState.speaking.currentSpeaker
                      ? 'bg-zinc-800'
                      : ''
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      p.isConnected ? 'bg-green-500' : 'bg-zinc-600'
                    }`}
                  />
                  <span>{p.name}</span>
                  {p.isHost && (
                    <span className="text-xs text-zinc-500">host</span>
                  )}
                  {p.role && (
                    <span className="ml-auto text-xs text-zinc-500">
                      {p.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Host controls */}
          {isHost && phase.type === 'lobby' && (
            <button
              onClick={() => sendHostAction({ type: 'start_game' })}
              disabled={
                playerList.filter((p) => !p.isHost).length < 4
              }
              className="rounded-lg bg-white py-2 font-semibold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start Game
            </button>
          )}

          {isHost && (phase.type === 'night' || phase.type === 'day') && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => sendHostAction({ type: 'advance_phase' })}
                className="rounded-lg border border-zinc-600 py-2 text-sm font-semibold transition-colors hover:border-zinc-400"
              >
                Next Phase
              </button>

              {phase.type === 'day' && phase.subphase === 'discussion' && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">
                    Grant speaking to:
                  </span>
                  {playerList
                    .filter((p) => p.isAlive && !p.isHost)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          gameState.speaking.currentSpeaker === p.id
                            ? sendHostAction({ type: 'end_speaking' })
                            : sendHostAction({
                                type: 'grant_speaking',
                                playerId: p.id,
                              })
                        }
                        className={`rounded px-2 py-1 text-left text-sm ${
                          gameState.speaking.currentSpeaker === p.id
                            ? 'bg-white text-black'
                            : 'bg-zinc-800 hover:bg-zinc-700'
                        }`}
                      >
                        {p.name}
                        {gameState.speaking.currentSpeaker === p.id &&
                          ' (speaking)'}
                      </button>
                    ))}
                </div>
              )}

              {/* Night: show mafia target for host */}
              {phase.type === 'night' &&
                phase.subphase === 'mafia_deliberation' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">
                      Eliminate (night kill):
                    </span>
                    {playerList
                      .filter((p) => p.isAlive && !p.isHost)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            sendHostAction({
                              type: 'host_eliminate',
                              playerId: p.id,
                            })
                          }
                          className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-red-900"
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                )}

              {/* Day voting: host can eliminate or save */}
              {phase.type === 'day' && phase.subphase === 'final_vote' && (
                <div className="flex flex-col gap-2">
                  {gameState.vote.nominees.map((nomineeId) => {
                    const votesFor = Object.values(
                      gameState.vote.votes,
                    ).filter((v) => v === nomineeId).length;
                    const nominee = gameState.players[nomineeId];
                    return (
                      <div
                        key={nomineeId}
                        className="flex items-center justify-between rounded bg-zinc-800 px-2 py-1"
                      >
                        <span className="text-sm">
                          {nominee?.name} ({votesFor} votes)
                        </span>
                        <button
                          onClick={() =>
                            sendHostAction({
                              type: 'host_eliminate',
                              playerId: nomineeId,
                            })
                          }
                          className="rounded bg-red-700 px-2 py-0.5 text-xs hover:bg-red-600"
                        >
                          Eliminate
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => sendHostAction({ type: 'host_save' })}
                    className="rounded-lg border border-zinc-600 py-1 text-sm hover:border-zinc-400"
                  >
                    No elimination
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Player night actions */}
          {!isHost && phase.type === 'night' && (
            <NightActions
              phase={phase}
              myRole={myRole}
              myPlayerId={myPlayerId!}
              players={playerList}
              sendPlayerAction={sendPlayerAction}
            />
          )}

          {/* Player voting */}
          {!isHost &&
            phase.type === 'day' &&
            (phase.subphase === 'voting' ||
              phase.subphase === 'final_vote') && (
              <VotingActions
                gameState={gameState}
                myPlayerId={myPlayerId!}
                sendPlayerAction={sendPlayerAction}
              />
            )}
        </div>
      </div>
    </div>
  );
}

// Night action sub-component
function NightActions({
  phase,
  myRole,
  myPlayerId,
  players,
  sendPlayerAction,
}: {
  phase: { type: 'night'; subphase: string };
  myRole: string | null;
  myPlayerId: string;
  players: Array<{
    id: string;
    name: string;
    isAlive: boolean;
    isHost: boolean;
  }>;
  sendPlayerAction: (action: import('@/lib/game/types').GameAction) => void;
}) {
  const targets = players.filter(
    (p) => p.isAlive && !p.isHost && p.id !== myPlayerId,
  );

  const isMafia = myRole === 'mafia' || myRole === 'don';
  const isDon = myRole === 'don';
  const isSheriff = myRole === 'sheriff';

  if (phase.subphase === 'mafia_deliberation' && isMafia) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-red-400">Choose a target:</span>
        {targets.map((p) => (
          <button
            key={p.id}
            onClick={() =>
              sendPlayerAction({
                type: 'mafia_vote',
                voterId: myPlayerId,
                targetId: p.id,
              })
            }
            className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-red-900"
          >
            {p.name}
          </button>
        ))}
      </div>
    );
  }

  if (phase.subphase === 'don_check' && isDon) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-yellow-400">Check if someone is Sheriff:</span>
        {targets.map((p) => (
          <button
            key={p.id}
            onClick={() =>
              sendPlayerAction({ type: 'don_check', targetId: p.id })
            }
            className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-yellow-900"
          >
            {p.name}
          </button>
        ))}
      </div>
    );
  }

  if (phase.subphase === 'sheriff_check' && isSheriff) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-blue-400">Check if someone is Mafia:</span>
        {targets.map((p) => (
          <button
            key={p.id}
            onClick={() =>
              sendPlayerAction({ type: 'sheriff_check', targetId: p.id })
            }
            className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-blue-900"
          >
            {p.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <p className="text-sm text-zinc-500">
      Night time... waiting for others.
    </p>
  );
}

// Voting sub-component
function VotingActions({
  gameState,
  myPlayerId,
  sendPlayerAction,
}: {
  gameState: import('@/lib/game/types').ClientGameState;
  myPlayerId: string;
  sendPlayerAction: (action: import('@/lib/game/types').GameAction) => void;
}) {
  const hasVoted = myPlayerId in gameState.vote.votes;
  const myPlayer = gameState.players[myPlayerId];
  if (!myPlayer?.isAlive) return null;

  const alivePlayers = Object.values(gameState.players).filter(
    (p) => p.isAlive && !p.isHost && p.id !== myPlayerId,
  );

  if (gameState.phase.type === 'day' && gameState.phase.subphase === 'voting') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Nominate a player:</span>
        {alivePlayers.map((p) => (
          <button
            key={p.id}
            onClick={() =>
              sendPlayerAction({
                type: 'nominate',
                nominatorId: myPlayerId,
                targetId: p.id,
              })
            }
            disabled={gameState.vote.nominees.includes(p.id)}
            className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            {p.name}
            {gameState.vote.nominees.includes(p.id) && ' (nominated)'}
          </button>
        ))}
      </div>
    );
  }

  if (gameState.phase.type === 'day' && gameState.phase.subphase === 'final_vote') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">
          {hasVoted ? 'Vote cast!' : 'Vote to eliminate:'}
        </span>
        {gameState.vote.nominees.map((nomineeId) => {
          const nominee = gameState.players[nomineeId];
          const votesFor = Object.values(gameState.vote.votes).filter(
            (v) => v === nomineeId,
          ).length;
          return (
            <button
              key={nomineeId}
              onClick={() =>
                sendPlayerAction({
                  type: 'cast_vote',
                  voterId: myPlayerId,
                  targetId: nomineeId,
                })
              }
              disabled={hasVoted}
              className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              {nominee?.name} ({votesFor} votes)
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
          Loading...
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
