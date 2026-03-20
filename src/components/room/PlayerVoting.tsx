'use client';

import React, { useState } from 'react';
import { C, displayName } from '@/styles/tokens';
import { Card, SectionLabel, PrimaryBtn } from '@/components/ui';
import { VoteCountdown } from './VoteCountdown';
import type { ClientGameState, GameAction } from '@/lib/game/types';

export function PlayerVoting({
  gameState, myUserId, sendPlayerAction,
}: {
  gameState: ClientGameState;
  myUserId: string;
  sendPlayerAction: (a: GameAction) => void;
}) {
  const { vote, users } = gameState;
  const [expired, setExpired] = useState(false);
  const hasVoted = vote.usedVotes.includes(myUserId);
  const currentNominee = vote.currentNomineeIndex >= 0 ? vote.nominees[vote.currentNomineeIndex] : null;
  const isEliminateAll = vote.eliminateAllIds.length > 0;

  if (vote.finished) {
    return (
      <>
        <SectionLabel>Voting Results</SectionLabel>
        <Card style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isEliminateAll ? (
            <div style={{ fontSize: 12, color: C.textSec, padding: '4px 6px' }}>
              Eliminate all: {vote.eliminateAllIds.map(nid => displayName(users[nid])).join(', ')}
              <span style={{ color: C.textMuted }}> — {vote.usedVotes.length} voted yes</span>
            </div>
          ) : (
            vote.nominees.map(nid => {
              const count = Object.values(vote.votes).filter(v => v === nid).length;
              return (
                <div key={nid} style={{
                  padding: '6px 8px', borderRadius: 6, fontSize: 12,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: C.textSec }}>{displayName(users[nid])}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 11, color: C.textMuted }}>{count} votes</span>
                </div>
              );
            })
          )}
        </Card>
      </>
    );
  }

  if (!currentNominee) {
    return (
      <>
        <SectionLabel>Nominated</SectionLabel>
        <Card style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted }}>
          {vote.nominees.map(nid => displayName(users[nid])).join(', ')}
          <div style={{ marginTop: 4, fontSize: 11, color: C.textMuted, opacity: 0.7 }}>Waiting for host to start vote…</div>
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionLabel>Vote</SectionLabel>
      <Card style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isEliminateAll ? (
          <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 500 }}>
            Voting to eliminate all:<br />
            <span style={{ color: C.textSec }}>{vote.eliminateAllIds.map(nid => displayName(users[nid])).join(', ')}</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.textSec }}>
            Vote on: <span style={{ color: C.text, fontWeight: 500 }}>{displayName(users[currentNominee])}</span>
            <span style={{ color: C.textMuted }}> ({vote.currentNomineeIndex + 1}/{vote.nominees.length})</span>
          </div>
        )}
        {vote.votingDeadline && <VoteCountdown deadline={vote.votingDeadline} onExpiredChange={setExpired} />}
        {hasVoted ? (
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>Vote cast ✓</div>
        ) : expired ? (
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>Time expired</div>
        ) : (
          <PrimaryBtn onClick={() => sendPlayerAction({ type: 'cast_vote', voterId: myUserId })} style={{ fontSize: 13, padding: '10px 14px' }}>
            {isEliminateAll ? 'Vote to eliminate all' : `Vote for ${displayName(users[currentNominee])}`}
          </PrimaryBtn>
        )}
      </Card>
    </>
  );
}
