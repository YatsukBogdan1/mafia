'use client';

import React from 'react';
import { C, displayName } from '@/styles/tokens';
import { Card, SectionLabel, PrimaryBtn, GhostBtn, IconBtn } from '@/components/ui';
import { VoteCountdown } from './VoteCountdown';
import type { ClientGameState, GameAction } from '@/lib/game/types';

export function VotingControls({
  gameState, sendHostAction,
}: {
  gameState: ClientGameState;
  sendHostAction: (a: GameAction) => void;
}) {
  const { vote, users } = gameState;
  if (vote.nominees.length === 0) return null;

  const currentNominee = vote.currentNomineeIndex >= 0 ? vote.nominees[vote.currentNomineeIndex] : null;

  return (
    <>
      <SectionLabel>Voting</SectionLabel>
      <Card style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Nominee list */}
        {vote.eliminateAllIds.length > 0 ? (
          <div style={{
            padding: '8px 10px', borderRadius: 7,
            background: vote.finished ? 'rgba(255,255,255,0.03)' : 'rgba(196,30,58,0.1)',
            border: `1px solid ${vote.finished ? C.border : 'rgba(196,30,58,0.3)'}`,
            fontSize: 12, color: vote.finished ? C.textSec : '#fca5a5',
          }}>
            Eliminate all: {vote.eliminateAllIds.map(nid => displayName(users[nid])).join(', ')}
            {vote.finished && <span style={{ color: C.textMuted }}> — {vote.usedVotes.length} voted yes</span>}
            {!vote.finished && <span style={{ color: C.textMuted }}> (voting now)</span>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vote.nominees.map((nid, i) => {
              const voteCount = Object.values(vote.votes).filter(v => v === nid).length;
              const isCurrent = i === vote.currentNomineeIndex;
              const isDone = i < vote.currentNomineeIndex || vote.finished;
              const canRemove = vote.currentNomineeIndex < 0;
              return (
                <div key={nid} style={{
                  padding: '7px 10px', borderRadius: 7, fontSize: 12,
                  background: isCurrent ? 'rgba(196,30,58,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCurrent ? 'rgba(196,30,58,0.35)' : C.border}`,
                  color: isDone ? C.textMuted : C.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>{displayName(users[nid])}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>
                      {isDone ? `${voteCount} votes` : isCurrent ? 'voting…' : ''}
                    </span>
                    {canRemove && (
                      <IconBtn tint="red" title="Remove" onClick={() => sendHostAction({ type: 'remove_nominee', targetId: nid })}>×</IconBtn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vote countdown (for host) */}
        {!vote.finished && vote.votingDeadline && (
          <VoteCountdown deadline={vote.votingDeadline} />
        )}

        {/* Start/next/finalize */}
        {!vote.finished && vote.eliminateAllIds.length === 0 && (
          <PrimaryBtn onClick={() => sendHostAction({ type: 'start_nominee_vote' })} style={{ fontSize: 12, padding: '9px 14px' }}>
            {vote.currentNomineeIndex < 0
              ? `Start vote · ${displayName(users[vote.nominees[0]])}`
              : vote.currentNomineeIndex + 1 < vote.nominees.length
                ? `Next · ${displayName(users[vote.nominees[vote.currentNomineeIndex + 1]])}`
                : 'Finalize'}
          </PrimaryBtn>
        )}

        {!vote.finished && vote.eliminateAllIds.length > 0 && (
          <GhostBtn onClick={() => sendHostAction({ type: 'start_nominee_vote' })} style={{ fontSize: 11, padding: '7px 12px' }}>
            Finalize vote
          </GhostBtn>
        )}

        {/* Finished state */}
        {vote.finished && vote.eliminateAllIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <PrimaryBtn
              onClick={() => vote.eliminateAllIds.forEach(nid => sendHostAction({ type: 'host_eliminate', userId: nid }))}
              style={{ fontSize: 12, padding: '9px 14px' }}
            >
              Eliminate all
            </PrimaryBtn>
            <GhostBtn onClick={() => sendHostAction({ type: 'host_save' })} style={{ fontSize: 12, padding: '9px 14px' }}>Save</GhostBtn>
          </div>
        )}

        {vote.finished && vote.eliminateAllIds.length === 0 && (() => {
          const topVotes = Math.max(...vote.nominees.map(nid =>
            Object.values(vote.votes).filter(v => v === nid).length
          ));
          const topNominees = vote.nominees.filter(nid =>
            Object.values(vote.votes).filter(v => v === nid).length === topVotes
          );
          const isTie = topNominees.length > 1;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {isTie && (
                <div style={{ fontSize: 11, color: '#fbbf24', textAlign: 'center', padding: '4px 0' }}>
                  {vote.revoteRound === 0 ? 'Tie — revote or decide' : 'Tie again — vote to eliminate all or decide'}
                </div>
              )}

              {!isTie && (
                <PrimaryBtn onClick={() => sendHostAction({ type: 'host_eliminate', userId: topNominees[0] })} style={{ fontSize: 12, padding: '9px 14px' }}>
                  Eliminate {displayName(users[topNominees[0]])}
                </PrimaryBtn>
              )}

              {isTie && vote.revoteRound === 0 && (
                <>
                  <PrimaryBtn onClick={() => sendHostAction({ type: 'revote', tiedIds: topNominees })} style={{ fontSize: 12, padding: '9px 14px', background: '#b45309' }}>
                    Revote ({topNominees.map(nid => displayName(users[nid])).join(' vs ')})
                  </PrimaryBtn>
                  {topNominees.map(nid => (
                    <GhostBtn key={nid} onClick={() => sendHostAction({ type: 'host_eliminate', userId: nid })} style={{ fontSize: 11, padding: '7px 12px' }}>
                      Eliminate {displayName(users[nid])}
                    </GhostBtn>
                  ))}
                </>
              )}

              {isTie && vote.revoteRound >= 1 && (
                <>
                  <PrimaryBtn onClick={() => sendHostAction({ type: 'vote_eliminate_all', tiedIds: topNominees })} style={{ fontSize: 12, padding: '9px 14px' }}>
                    Vote to eliminate all
                  </PrimaryBtn>
                  {topNominees.map(nid => (
                    <GhostBtn key={nid} onClick={() => sendHostAction({ type: 'host_eliminate', userId: nid })} style={{ fontSize: 11, padding: '7px 12px' }}>
                      Eliminate {displayName(users[nid])}
                    </GhostBtn>
                  ))}
                </>
              )}

              <GhostBtn onClick={() => sendHostAction({ type: 'host_save' })} style={{ fontSize: 11, padding: '7px 12px' }}>
                Save
              </GhostBtn>
            </div>
          );
        })()}
      </Card>
    </>
  );
}
