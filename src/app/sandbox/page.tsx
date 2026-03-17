'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type {
  S2CMessage,
  ClientGameState,
  GameAction,
  PlayerRole,
  PlayerId,
  NightActions,
  RoomSettings,
} from '@/lib/game/types';
import { DEFAULT_ROOM_SETTINGS } from '@/lib/game/types';

function getWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}
const PLAYER_COUNT = 10;

interface SandboxState {
  roomCode: string;
  hostId: string;
  playerIds: string[];
  playerNames: Record<string, string>;
}

export default function SandboxPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sandbox, setSandbox] = useState<SandboxState | null>(null);
  const [viewingAs, setViewingAs] = useState<string | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [viewRole, setViewRole] = useState<PlayerRole | null>(null);
  const [nightActions, setNightActions] = useState<NightActions | null>(null);
  const [mediaStates, setMediaStates] = useState<Record<string, { canPublish: boolean; canSee: string[] }> | null>(null);
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_ROOM_SETTINGS });
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-50), `${new Date().toLocaleTimeString()} ${msg}`]);
  }, []);

  // Connect to WS
  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      addLog('Connected to game server');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as S2CMessage;
      switch (msg.type) {
        case 'sandbox_created':
          setSandbox({
            roomCode: msg.roomCode,
            hostId: msg.hostId,
            playerIds: msg.playerIds,
            playerNames: msg.playerNames,
          });
          setViewingAs(msg.hostId);
          addLog(`Sandbox created: ${msg.roomCode} with ${msg.playerIds.length} players`);
          break;
        case 'sandbox_view':
          setGameState(msg.state);
          setViewRole(msg.role);
          setViewingAs(msg.playerId);
          setNightActions(msg.nightActions);
          setMediaStates(msg.mediaStates);
          break;
        case 'error':
          setError(msg.message);
          addLog(`Error: ${msg.message}`);
          setTimeout(() => setError(null), 3000);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      addLog('Disconnected');
    };

    return () => ws.close();
  }, [addLog]);

  const sendMsg = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const createSandbox = () => {
    sendMsg({ type: 'create_sandbox', playerCount: PLAYER_COUNT, settings });
  };

  const switchView = (playerId: string) => {
    sendMsg({ type: 'switch_view', playerId });
  };

  const sandboxAction = (asPlayerId: string, action: GameAction) => {
    sendMsg({ type: 'sandbox_action', asPlayerId, action });
    addLog(`${sandbox?.playerNames[asPlayerId] || asPlayerId}: ${action.type}`);
  };

  if (!connected) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        Connecting to game server...
      </div>
    );
  }

  if (!sandbox || !gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl bg-zinc-900 p-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Sandbox Mode</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Create a sandbox room with {PLAYER_COUNT} players + 1 host.
              Control all players from a single browser tab.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              Room Settings
            </h3>
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3">
                <div>
                  <span className="text-sm text-white">Mafia can speak at night</span>
                  <p className="text-xs text-zinc-500">
                    Allow mafia members to talk during deliberation
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.mafiaCanSpeakAtNight}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, mafiaCanSpeakAtNight: e.target.checked }))
                  }
                  className="h-4 w-4 accent-white"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3">
                <div>
                  <span className="text-sm text-white">Free speech during day</span>
                  <p className="text-xs text-zinc-500">
                    All players unmuted during discussion, host manages order verbally
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.freeSpeechDay}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, freeSpeechDay: e.target.checked }))
                  }
                  className="h-4 w-4 accent-white"
                />
              </label>
            </div>
          </div>

          <button
            onClick={createSandbox}
            className="rounded-lg bg-white py-3 font-semibold text-black hover:bg-zinc-200"
          >
            Create Sandbox
          </button>
        </div>
      </div>
    );
  }

  const phase = gameState.phase;
  const allPlayerIds = [sandbox.hostId, ...sandbox.playerIds];
  const playerList = Object.values(gameState.players);
  const isViewingHost = viewingAs === sandbox.hostId;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-bold text-yellow-400">SANDBOX</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-sm">
            {sandbox.roomCode}
          </span>
          <PhaseDisplay phase={phase} />
        </div>
        <div className="flex items-center gap-3">
          {gameState.settings.mafiaCanSpeakAtNight && (
            <span className="rounded bg-red-900/50 px-2 py-0.5 text-[10px] text-red-300">
              mafia voice ON
            </span>
          )}
          {gameState.settings.freeSpeechDay && (
            <span className="rounded bg-blue-900/50 px-2 py-0.5 text-[10px] text-blue-300">
              free speech ON
            </span>
          )}
          {viewRole && (
            <RoleBadge role={viewRole} />
          )}
          <span className="text-sm text-zinc-400">
            Viewing as: {sandbox.playerNames[viewingAs!] || viewingAs}
          </span>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="bg-red-900/50 px-4 py-2 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Player switcher (left sidebar) */}
        <div className="flex w-48 flex-col gap-1 overflow-y-auto border-r border-zinc-800 p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">
            Impersonate
          </h3>
          {allPlayerIds.map((pid) => {
            const p = gameState.players[pid];
            if (!p) return null;
            const isActive = pid === viewingAs;
            return (
              <button
                key={pid}
                onClick={() => switchView(pid)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-white text-black font-semibold'
                    : !p.isAlive
                      ? 'text-zinc-600 line-through hover:bg-zinc-800'
                      : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    p.isHost ? 'bg-yellow-500' : roleColor(p.role)
                  }`}
                />
                <span className="truncate">
                  {p.seatNumber != null && <span className="mr-1 text-[10px] opacity-50">{p.seatNumber}.</span>}
                  {p.name}
                </span>
                {p.role && (
                  <span className="ml-auto text-[10px] opacity-60">
                    {p.role}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main area: game state view */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          {/* What this player sees */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-400">
              {sandbox.playerNames[viewingAs!]}&apos;s View — Players
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {playerList.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 text-sm ${
                    !p.isAlive
                      ? 'border-zinc-800 bg-zinc-900/50 text-zinc-600'
                      : p.id === gameState.speaking.currentSpeaker
                        ? 'border-green-700 bg-green-950'
                        : 'border-zinc-800 bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={!p.isAlive ? 'line-through' : ''}>
                      {p.seatNumber != null && <span className="text-[10px] text-zinc-500 mr-1">{p.seatNumber}.</span>}
                      {p.name}
                    </span>
                    {p.isHost && (
                      <span className="text-[10px] text-yellow-500">HOST</span>
                    )}
                  </div>
                  {p.role ? (
                    <RoleBadge role={p.role} small />
                  ) : (
                    <span className="text-[10px] text-zinc-600">hidden</span>
                  )}
                  {!p.isAlive && (
                    <span className="text-[10px] text-red-700">DEAD</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Media visibility panel */}
          {mediaStates && viewingAs && phase.type !== 'lobby' && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-400">
                Video &amp; Audio — {sandbox.playerNames[viewingAs]}&apos;s perspective
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {allPlayerIds.map((pid) => {
                  const p = gameState.players[pid];
                  if (!p) return null;
                  const myMedia = mediaStates[viewingAs];
                  const theirMedia = mediaStates[pid];
                  const canSee = myMedia?.canSee?.includes(pid) ?? false;
                  const theyPublish = theirMedia?.canPublish ?? false;
                  // Effective: can I actually see/hear them?
                  // I need to be subscribed (canSee) AND they need to be publishing
                  const effectiveVideo = canSee && theyPublish;
                  const effectiveAudio = canSee && theyPublish;

                  return (
                    <div
                      key={pid}
                      className={`rounded border p-2 text-xs ${
                        effectiveVideo
                          ? 'border-green-800 bg-green-950/50'
                          : 'border-zinc-800 bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={!p.isAlive ? 'text-zinc-600 line-through' : 'text-zinc-200'}>
                          {p.name}
                        </span>
                        {p.isHost && <span className="text-[9px] text-yellow-500">HOST</span>}
                      </div>
                      <div className="mt-1 flex gap-2">
                        <span className={theyPublish ? 'text-green-400' : 'text-zinc-600'}>
                          {theyPublish ? '🔊 broadcasting' : '🔇 muted'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className={canSee ? 'text-green-400' : 'text-red-400'}>
                          {canSee ? '👁 subscribed' : '🚫 hidden'}
                        </span>
                      </div>
                      <div className="mt-1 border-t border-zinc-800 pt-1">
                        <span className={effectiveVideo ? 'font-semibold text-green-300' : 'text-zinc-600'}>
                          {effectiveVideo ? '✓ visible + audible' : '✗ not visible'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Night actions status */}
          {phase.type === 'night' && nightActions && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-indigo-400">
                Night Actions
              </h3>
              <div className="flex flex-col gap-2 text-sm">
                {/* Mafia votes */}
                <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
                  <span className="text-xs font-semibold text-red-400">Mafia</span>
                  {Object.keys(nightActions.mafiaVotes).length > 0 ? (
                    <div className="mt-1 text-zinc-300">
                      {Object.entries(nightActions.mafiaVotes).map(([voter, target]) => (
                        <div key={voter}>
                          {gameState.players[voter]?.name} → {gameState.players[target]?.name}
                        </div>
                      ))}
                      {nightActions.mafiaTarget && (
                        <div className="mt-1 font-semibold text-red-300">
                          Target: {gameState.players[nightActions.mafiaTarget]?.name}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-zinc-600">No votes yet</p>
                  )}
                </div>

                {/* Don check */}
                <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
                  <span className="text-xs font-semibold text-yellow-400">Don Check</span>
                  {nightActions.donCheck ? (
                    <p className="mt-1 text-zinc-300">
                      Checked {gameState.players[nightActions.donCheck]?.name}
                      {nightActions.donResult !== null && (
                        <span className={nightActions.donResult ? ' text-green-400' : ' text-zinc-500'}>
                          {nightActions.donResult ? ' — IS Sheriff!' : ' — not Sheriff'}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-zinc-600">Not checked yet</p>
                  )}
                </div>

                {/* Sheriff check */}
                <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
                  <span className="text-xs font-semibold text-blue-400">Sheriff Check</span>
                  {nightActions.sheriffCheck ? (
                    <p className="mt-1 text-zinc-300">
                      Checked {gameState.players[nightActions.sheriffCheck]?.name}
                      {nightActions.sheriffResult !== null && (
                        <span className={nightActions.sheriffResult ? ' text-red-400' : ' text-zinc-500'}>
                          {nightActions.sheriffResult ? ' — IS Mafia!' : ' — not Mafia'}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-zinc-600">Not checked yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Check history for sheriff/don */}
          {gameState.myCheckedHistory && gameState.myCheckedHistory.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-400">
                Check History ({viewRole === 'sheriff' ? 'Sheriff' : viewRole === 'don' ? 'Don' : viewRole})
              </h3>
              <div className="flex flex-col gap-1">
                {gameState.myCheckedHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded bg-zinc-800 px-2 py-1 text-sm"
                  >
                    <span>{gameState.players[entry.targetId]?.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Night {entry.nightNumber}</span>
                      <span className={entry.result ? 'text-red-400' : 'text-green-400'}>
                        {viewRole === 'sheriff'
                          ? (entry.result ? 'Mafia' : 'Clean')
                          : (entry.result ? 'Sheriff' : 'Not Sheriff')}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nominees list during discussion */}
          {phase.type === 'day' &&
            phase.subphase === 'discussion' &&
            gameState.vote.nominees.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-zinc-400">Nominated</h3>
                <div className="flex flex-col gap-1">
                  {gameState.vote.nominees.map((id, i) => (
                    <div key={id} className="rounded bg-zinc-800 px-2 py-1 text-sm">
                      {i + 1}. {gameState.players[id]?.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Voting status */}
          {phase.type === 'day' && phase.subphase === 'voting' && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-400">Voting</h3>
              <div className="flex flex-col gap-1 text-sm">
                {gameState.vote.nominees.map((id, i) => {
                  const isCurrent = i === gameState.vote.currentNomineeIndex;
                  const isDone = i < gameState.vote.currentNomineeIndex || gameState.vote.finished;
                  const count = Object.values(gameState.vote.votes).filter((v) => v === id).length;
                  return (
                    <div
                      key={id}
                      className={`rounded px-2 py-1 ${
                        isCurrent && !gameState.vote.finished ? 'bg-amber-900/50 ring-1 ring-amber-400' : 'bg-zinc-800'
                      } ${isDone ? 'text-zinc-400' : ''}`}
                    >
                      {gameState.players[id]?.name}
                      {(isDone || gameState.vote.finished) && ` — ${count} votes`}
                      {isCurrent && !gameState.vote.finished && ' — voting now'}
                    </div>
                  );
                })}
                {gameState.vote.finished && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Votes: {Object.entries(gameState.vote.votes).map(
                      ([voter, target]) =>
                        `${gameState.players[voter]?.name} → ${gameState.players[target]?.name}`,
                    ).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions sidebar (right) */}
        <div className="flex w-80 flex-col gap-3 overflow-y-auto border-l border-zinc-800 p-4">
          <h3 className="text-xs font-semibold uppercase text-zinc-500">
            Actions as {sandbox.playerNames[viewingAs!]}
          </h3>

          {/* Host actions */}
          {isViewingHost && (
            <HostActions
              phase={phase}
              gameState={gameState}
              sandbox={sandbox}
              sandboxAction={sandboxAction}
            />
          )}

          {/* Player actions */}
          {!isViewingHost && (
            <PlayerActions
              viewingAs={viewingAs!}
              viewRole={viewRole}
              phase={phase}
              gameState={gameState}
              sandbox={sandbox}
              sandboxAction={sandboxAction}
            />
          )}

          {/* Quick actions: do action as any player */}
          {phase.type === 'night' && isViewingHost && (
            <QuickNightActions
              gameState={gameState}
              sandbox={sandbox}
              sandboxAction={sandboxAction}
            />
          )}

          {/* Log */}
          <div className="mt-auto">
            <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">
              Log
            </h3>
            <div className="max-h-40 overflow-y-auto rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-500">
              {log.map((entry, i) => (
                <div key={i}>{entry}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function PhaseDisplay({ phase }: { phase: ClientGameState['phase'] }) {
  let text = '';
  let color = 'text-zinc-400';
  if (phase.type === 'lobby') {
    text = 'Lobby';
  } else if (phase.type === 'night') {
    text = `Night ${phase.nightNumber} — ${phase.subphase.replace(/_/g, ' ')}`;
    color = 'text-indigo-400';
  } else if (phase.type === 'day') {
    text = `Day ${phase.dayNumber} — ${phase.subphase.replace(/_/g, ' ')}`;
    color = 'text-amber-400';
  } else if (phase.type === 'gameover') {
    text = `Game Over — ${phase.winner} win!`;
    color = 'text-green-400';
  }
  return <span className={`text-sm ${color}`}>{text}</span>;
}

function RoleBadge({ role, small }: { role: PlayerRole; small?: boolean }) {
  const colors: Record<PlayerRole, string> = {
    mafia: 'bg-red-900 text-red-300',
    don: 'bg-red-800 text-red-200',
    sheriff: 'bg-blue-900 text-blue-300',
    villager: 'bg-zinc-700 text-zinc-300',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 ${colors[role]} ${
        small ? 'text-[10px]' : 'text-xs'
      }`}
    >
      {role}
    </span>
  );
}

function roleColor(role: PlayerRole | null): string {
  if (!role) return 'bg-zinc-600';
  const map: Record<PlayerRole, string> = {
    mafia: 'bg-red-500',
    don: 'bg-red-400',
    sheriff: 'bg-blue-500',
    villager: 'bg-zinc-400',
  };
  return map[role];
}

function HostActions({
  phase,
  gameState,
  sandbox,
  sandboxAction,
}: {
  phase: ClientGameState['phase'];
  gameState: ClientGameState;
  sandbox: SandboxState;
  sandboxAction: (asPlayerId: string, action: GameAction) => void;
}) {
  const hostId = sandbox.hostId;
  const playerList = Object.values(gameState.players).filter((p) => !p.isHost);
  const alivePlayers = playerList.filter((p) => p.isAlive);

  return (
    <div className="flex flex-col gap-2">
      {phase.type === 'lobby' && (
        <button
          onClick={() => sandboxAction(hostId, { type: 'start_game' })}
          disabled={playerList.length < 4}
          className="rounded-lg bg-white py-2 font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          Start Game ({playerList.length} players)
        </button>
      )}

      {(phase.type === 'night' || phase.type === 'day') && (
        <>
          <button
            onClick={() => sandboxAction(hostId, { type: 'advance_phase' })}
            className="rounded-lg border border-zinc-600 py-2 text-sm font-semibold hover:border-zinc-400"
          >
            Next Phase →
          </button>

          {/* Night: eliminate */}
          {phase.type === 'night' && phase.subphase === 'mafia_deliberation' && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-red-400">Night kill:</span>
              {alivePlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    sandboxAction(hostId, {
                      type: 'host_eliminate',
                      playerId: p.id,
                    })
                  }
                  className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-red-900"
                >
                  {p.name} {p.role && <span className="text-zinc-500">({p.role})</span>}
                </button>
              ))}
            </div>
          )}

          {/* Day discussion: grant speaking */}
          {phase.type === 'day' && phase.subphase === 'discussion' && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Speaking:</span>
              {gameState.speaking.suggestedSpeaker &&
                !gameState.speaking.currentSpeaker && (
                  <span className="text-xs text-amber-400">
                    Suggested: {gameState.players[gameState.speaking.suggestedSpeaker]?.name}
                  </span>
                )}
              {gameState.speaking.speakingOrder
                .map((id) => gameState.players[id])
                .filter((p): p is NonNullable<typeof p> => !!p && p.isAlive && !p.isHost)
                .map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    gameState.speaking.currentSpeaker === p.id
                      ? sandboxAction(hostId, { type: 'end_speaking' })
                      : sandboxAction(hostId, {
                          type: 'grant_speaking',
                          playerId: p.id,
                        })
                  }
                  className={`rounded px-2 py-1 text-left text-sm ${
                    gameState.speaking.currentSpeaker === p.id
                      ? 'bg-green-800 text-green-200'
                      : p.id === gameState.speaking.suggestedSpeaker && !gameState.speaking.currentSpeaker
                        ? 'bg-zinc-800 ring-1 ring-amber-400 hover:bg-zinc-700'
                        : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {p.name}
                  {gameState.speaking.currentSpeaker === p.id && (
                    <>
                      {' ● '}
                      <SpeakingTimer startedAt={gameState.speaking.speakingStartedAt} />
                    </>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Voting phase: sequential nominee voting */}
          {phase.type === 'day' && phase.subphase === 'voting' && (
            <div className="flex flex-col gap-2">
              {gameState.vote.nominees.length === 0 ? (
                <p className="text-sm text-zinc-500">No nominations</p>
              ) : gameState.vote.finished ? (
                <>
                  <span className="text-xs text-zinc-500">Results:</span>
                  {gameState.vote.nominees.map((nid) => {
                    const count = Object.values(gameState.vote.votes).filter((v) => v === nid).length;
                    return (
                      <div key={nid} className="flex items-center justify-between rounded bg-zinc-800 px-2 py-1">
                        <span className="text-sm">{gameState.players[nid]?.name} ({count} votes)</span>
                        <button
                          onClick={() => sandboxAction(hostId, { type: 'host_eliminate', playerId: nid })}
                          className="rounded bg-red-700 px-2 py-0.5 text-xs hover:bg-red-600"
                        >
                          Eliminate
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => sandboxAction(hostId, { type: 'host_save' })}
                    className="rounded border border-zinc-600 py-1 text-sm hover:border-zinc-400"
                  >
                    No elimination
                  </button>
                </>
              ) : (
                <button
                  onClick={() => sandboxAction(hostId, { type: 'start_nominee_vote' })}
                  className="rounded-lg bg-white py-2 text-sm font-semibold text-black hover:bg-zinc-200"
                >
                  {gameState.vote.currentNomineeIndex < 0
                    ? `Start voting: ${gameState.players[gameState.vote.nominees[0]]?.name}`
                    : gameState.vote.currentNomineeIndex + 1 < gameState.vote.nominees.length
                      ? `Next: ${gameState.players[gameState.vote.nominees[gameState.vote.currentNomineeIndex + 1]]?.name}`
                      : 'Finalize voting'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlayerActions({
  viewingAs,
  viewRole,
  phase,
  gameState,
  sandbox,
  sandboxAction,
}: {
  viewingAs: string;
  viewRole: PlayerRole | null;
  phase: ClientGameState['phase'];
  gameState: ClientGameState;
  sandbox: SandboxState;
  sandboxAction: (asPlayerId: string, action: GameAction) => void;
}) {
  const me = gameState.players[viewingAs];
  if (!me?.isAlive) {
    return <p className="text-sm text-zinc-600">This player is dead.</p>;
  }

  const targets = Object.values(gameState.players).filter(
    (p) => p.isAlive && !p.isHost && p.id !== viewingAs,
  );

  const isMafia = viewRole === 'mafia' || viewRole === 'don';
  const isDon = viewRole === 'don';
  const isSheriff = viewRole === 'sheriff';

  return (
    <div className="flex flex-col gap-2">
      {/* Night: mafia vote */}
      {phase.type === 'night' &&
        phase.subphase === 'mafia_deliberation' &&
        isMafia && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-red-400">Mafia target:</span>
            {targets.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  sandboxAction(viewingAs, {
                    type: 'mafia_vote',
                    voterId: viewingAs,
                    targetId: p.id,
                  })
                }
                className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-red-900"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

      {/* Night: don check */}
      {phase.type === 'night' && phase.subphase === 'don_check' && isDon && (
        <ConfirmTargetAction
          label="Check for Sheriff:"
          labelColor="text-yellow-400"
          targets={targets}
          selectedColor="bg-yellow-800 ring-1 ring-yellow-400"
          hoverColor="hover:bg-yellow-900"
          confirmColor="bg-yellow-700 hover:bg-yellow-600"
          confirmLabel="Confirm check"
          onConfirm={(targetId) => sandboxAction(viewingAs, { type: 'don_check', targetId })}
        />
      )}

      {/* Night: sheriff check */}
      {phase.type === 'night' &&
        phase.subphase === 'sheriff_check' &&
        isSheriff && (
        <ConfirmTargetAction
          label="Check for Mafia:"
          labelColor="text-blue-400"
          targets={targets}
          selectedColor="bg-blue-800 ring-1 ring-blue-400"
          hoverColor="hover:bg-blue-900"
          confirmColor="bg-blue-700 hover:bg-blue-600"
          confirmLabel="Confirm check"
          onConfirm={(targetId) => sandboxAction(viewingAs, { type: 'sheriff_check', targetId })}
        />
      )}

      {/* Day discussion: nominate (only while speaking) */}
      {phase.type === 'day' &&
        phase.subphase === 'discussion' &&
        gameState.speaking.currentSpeaker === viewingAs && (
          gameState.vote.nominatedBy.includes(viewingAs) ? (
            <p className="text-sm text-zinc-500">Already nominated someone this round.</p>
          ) : (
            <ConfirmTargetAction
              label="Nominate:"
              labelColor="text-zinc-400"
              targets={targets.filter((p) => !gameState.vote.nominees.includes(p.id))}
              selectedColor="bg-zinc-700 ring-1 ring-white"
              hoverColor="hover:bg-zinc-700"
              confirmColor="bg-white text-black hover:bg-zinc-200"
              confirmLabel="Confirm nomination"
              onConfirm={(targetId) => sandboxAction(viewingAs, { type: 'nominate', nominatorId: viewingAs, targetId })}
            />
          )
        )}

      {/* Day voting: cast vote for current nominee */}
      {phase.type === 'day' && phase.subphase === 'voting' && (() => {
        const { vote } = gameState;
        const hasUsed = vote.usedVotes.includes(viewingAs);
        if (vote.finished || vote.currentNomineeIndex < 0) return null;
        const currentNominee = vote.nominees[vote.currentNomineeIndex];
        return (
          <SandboxVoteAction
            nomineeName={gameState.players[currentNominee]?.name ?? ''}
            hasUsed={hasUsed}
            votingDeadline={vote.votingDeadline}
            onVote={() => sandboxAction(viewingAs, { type: 'cast_vote', voterId: viewingAs })}
          />
        );
      })()}

      {/* No action available */}
      {phase.type === 'night' && !isMafia && !isSheriff && (
        <p className="text-sm text-zinc-500">
          Night time — no actions for {viewRole || 'this role'}.
        </p>
      )}
    </div>
  );
}

function QuickNightActions({
  gameState,
  sandbox,
  sandboxAction,
}: {
  gameState: ClientGameState;
  sandbox: SandboxState;
  sandboxAction: (asPlayerId: string, action: GameAction) => void;
}) {
  const phase = gameState.phase;
  if (phase.type !== 'night') return null;

  // Find players by role from the host view (host sees all roles)
  const allPlayers = Object.values(gameState.players).filter(
    (p) => !p.isHost && p.isAlive,
  );
  const mafiaPlayers = allPlayers.filter(
    (p) => p.role === 'mafia' || p.role === 'don',
  );
  const don = allPlayers.find((p) => p.role === 'don');
  const sheriff = allPlayers.find((p) => p.role === 'sheriff');
  const nonMafia = allPlayers.filter(
    (p) => p.role !== 'mafia' && p.role !== 'don',
  );

  return (
    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
      <h3 className="text-xs font-semibold uppercase text-yellow-500">
        Quick Actions (act as any player)
      </h3>

      {phase.subphase === 'mafia_deliberation' && mafiaPlayers.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-red-400">
            Mafia vote as {mafiaPlayers.map((p) => p.name).join(', ')}:
          </span>
          {nonMafia.map((target) => (
            <button
              key={target.id}
              onClick={() => {
                // All mafia vote for the same target
                for (const m of mafiaPlayers) {
                  sandboxAction(m.id, {
                    type: 'mafia_vote',
                    voterId: m.id,
                    targetId: target.id,
                  });
                }
              }}
              className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-red-900"
            >
              All mafia → {target.name} ({target.role})
            </button>
          ))}
        </div>
      )}

      {phase.subphase === 'don_check' && don && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-yellow-400">
            Don ({don.name}) checks:
          </span>
          {allPlayers
            .filter((p) => p.id !== don.id)
            .map((target) => (
              <button
                key={target.id}
                onClick={() =>
                  sandboxAction(don.id, {
                    type: 'don_check',
                    targetId: target.id,
                  })
                }
                className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-yellow-900"
              >
                {target.name} ({target.role})
              </button>
            ))}
        </div>
      )}

      {phase.subphase === 'sheriff_check' && sheriff && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-blue-400">
            Sheriff ({sheriff.name}) checks:
          </span>
          {allPlayers
            .filter((p) => p.id !== sheriff.id)
            .map((target) => (
              <button
                key={target.id}
                onClick={() =>
                  sandboxAction(sheriff.id, {
                    type: 'sheriff_check',
                    targetId: target.id,
                  })
                }
                className="rounded bg-zinc-800 px-2 py-1 text-left text-sm hover:bg-blue-900"
              >
                {target.name} ({target.role})
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function ConfirmTargetAction({
  label,
  labelColor,
  targets,
  selectedColor,
  hoverColor,
  confirmColor,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  labelColor: string;
  targets: Array<{ id: string; name: string }>;
  selectedColor: string;
  hoverColor: string;
  confirmColor: string;
  confirmLabel: string;
  onConfirm: (targetId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <span className={`text-xs ${labelColor}`}>{label}</span>
      {targets.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p.id)}
          className={`rounded px-2 py-1 text-left text-sm ${
            selected === p.id ? selectedColor : `bg-zinc-800 ${hoverColor}`
          }`}
        >
          {p.name}
        </button>
      ))}
      {selected && (
        <button
          onClick={() => {
            onConfirm(selected);
            setSelected(null);
          }}
          className={`rounded-lg py-2 text-sm font-semibold ${confirmColor}`}
        >
          {confirmLabel}: {targets.find((p) => p.id === selected)?.name}
        </button>
      )}
    </div>
  );
}

function SandboxVoteAction({
  nomineeName,
  hasUsed,
  votingDeadline,
  onVote,
}: {
  nomineeName: string;
  hasUsed: boolean;
  votingDeadline: number | null;
  onVote: () => void;
}) {
  const [expired, setExpired] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">
        Voting: {nomineeName}
      </span>
      {votingDeadline && (
        <VoteCountdown deadline={votingDeadline} onExpiredChange={setExpired} />
      )}
      {hasUsed ? (
        <p className="text-sm text-zinc-500">Vote used</p>
      ) : expired ? (
        <p className="text-sm text-zinc-500">Time expired</p>
      ) : (
        <button
          onClick={onVote}
          className="rounded-lg bg-red-700 py-2 text-sm font-semibold hover:bg-red-600"
        >
          Vote for {nomineeName}
        </button>
      )}
    </div>
  );
}

function VoteCountdown({ deadline, onExpiredChange }: { deadline: number; onExpiredChange?: (expired: boolean) => void }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );

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

function SpeakingTimer({ startedAt }: { startedAt: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="font-mono text-xs">
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}
