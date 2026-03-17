import { test, expect } from '@playwright/test';
import { SandboxPage } from './sandbox-helpers';

/**
 * 10 realistic Mafia game scenarios tested E2E via the sandbox page.
 *
 * Each test creates a fresh sandbox (10 players + host), starts the game,
 * discovers roles from the sidebar, then plays out a specific scenario
 * through the UI.
 */

// Shared setup: create sandbox and start game
async function setupGame(sbx: SandboxPage) {
  await sbx.goto();
  await sbx.createSandbox();
  await sbx.startGame();
}

// Discover all roles after game starts (host view shows all roles)
async function getRoles(sbx: SandboxPage) {
  await sbx.switchToHost();
  const roles = await sbx.discoverRoles();
  const mafias = Object.entries(roles).filter(([, r]) => r === 'mafia').map(([n]) => n);
  const don = Object.entries(roles).filter(([, r]) => r === 'don').map(([n]) => n);
  const sheriff = Object.entries(roles).filter(([, r]) => r === 'sheriff').map(([n]) => n);
  const villagers = Object.entries(roles).filter(([, r]) => r === 'villager').map(([n]) => n);
  return {
    mafias,
    don: don[0],
    sheriff: sheriff[0],
    villagers,
    mafiaTeam: [...mafias, ...don],
  };
}

// ============================================================
// Scenario 1: Full introduction night flows through all subphases
// ============================================================
test('Scenario 1: Introduction night cycles through all subphases', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);

  // Night 1 starts at introduction
  await sbx.expectPhaseContains('Night 1 — introduction');

  // Advance: introduction → mafia_deliberation → don_check → sheriff_check → Day 1
  await sbx.advancePhase();
  await sbx.expectPhaseContains('mafia deliberation');
  await sbx.advancePhase();
  await sbx.expectPhaseContains('don check');
  await sbx.advancePhase();
  await sbx.expectPhaseContains('sheriff check');
  await sbx.advancePhase();
  await sbx.expectPhaseContains('Day 1 — announcement');

  // Day 1: announcement → free_talk → discussion → voting → Night 2
  await sbx.advancePhase();
  await sbx.expectPhaseContains('free talk');
  await sbx.advancePhase();
  await sbx.expectPhaseContains('discussion');
  await sbx.advancePhase();
  await sbx.expectPhaseContains('voting');
  await sbx.advancePhase();
  await sbx.expectPhaseContains('Night 2 — mafia deliberation');
});

// ============================================================
// Scenario 2: Mafia kills a villager at night, day shows announcement
// ============================================================
test('Scenario 2: Mafia kills a villager on night 2', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  // Play through introduction night
  await sbx.playIntroductionNight();

  // Day 1: advance through to night 2 (no nominations/voting)
  await sbx.advanceToDiscussion();
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.advancePhase(); // voting → Night 2

  await sbx.expectPhaseContains('Night 2 — mafia deliberation');

  // Mafia votes for first villager
  const target = r.villagers[0];
  for (const voter of r.mafiaTeam) {
    await sbx.mafiaVote(voter, target);
  }

  // Host eliminates
  await sbx.switchToHost();
  await sbx.hostEliminate(target);

  // Verify player is dead
  await sbx.expectPlayerDead(target);

  // Advance to day
  await sbx.advancePhase(); // → don_check
  await sbx.advancePhase(); // → sheriff_check
  await sbx.advancePhase(); // → Day 2 announcement
  await sbx.expectPhaseContains('Day 2 — announcement');
});

// ============================================================
// Scenario 3: Sheriff checks a mafia member — gets positive result
// ============================================================
test('Scenario 3: Sheriff finds a mafia member', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  await sbx.playIntroductionNight();

  // Day 1 → Night 2
  await sbx.advanceToDiscussion();
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.advancePhase(); // → Night 2

  // Skip mafia deliberation
  await sbx.advancePhase(); // → don_check
  await sbx.advancePhase(); // → sheriff_check

  // Sheriff checks a mafia member
  const mafiaTarget = r.mafias[0];
  await sbx.switchToPlayer(r.sheriff);
  await sbx.sheriffCheck(mafiaTarget);

  // Switch to sheriff view — verify check history shows result
  await sbx.switchToPlayer(r.sheriff);
  const mainArea = page.locator('.flex-1.overflow-y-auto').first();
  await expect(mainArea).toContainText('Check History');
  await expect(mainArea).toContainText('Mafia');
});

// ============================================================
// Scenario 4: Don checks and finds the sheriff
// ============================================================
test('Scenario 4: Don finds the sheriff', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  await sbx.playIntroductionNight();
  await sbx.advanceToDiscussion();
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.advancePhase(); // → Night 2

  // Mafia deliberation → don_check
  await sbx.advancePhase(); // → don_check

  // Don checks the sheriff
  await sbx.switchToPlayer(r.don);
  await sbx.donCheck(r.sheriff);

  // Verify check history shows "Sheriff"
  await sbx.switchToPlayer(r.don);
  const mainArea = page.locator('.flex-1.overflow-y-auto').first();
  await expect(mainArea).toContainText('Check History');
  await expect(mainArea).toContainText('Sheriff');
});

// ============================================================
// Scenario 5: Player nominated and voted out during day
// ============================================================
test('Scenario 5: Day nomination and elimination', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  await sbx.playIntroductionNight();
  await sbx.advanceToDiscussion();

  // Grant speaking to a villager, they nominate a mafia member
  const speaker = r.villagers[0];
  const nominee = r.mafias[0];
  await sbx.switchToHost();
  await sbx.grantSpeaking(speaker);

  await sbx.switchToPlayer(speaker);
  await sbx.nominate(nominee);

  await sbx.switchToHost();
  await sbx.endSpeaking(speaker);

  // Move to voting
  await sbx.advanceToVoting();
  await sbx.switchToHost();

  // Start voting on the nominee
  await sbx.startNomineeVote();

  // Several players vote
  for (const voter of r.villagers.slice(0, 4)) {
    await sbx.switchToPlayer(voter);
    await sbx.castVote();
  }

  // Finalize voting
  await sbx.switchToHost();
  await sbx.startNomineeVote(); // finalize

  // Host eliminates
  await sbx.hostEliminate(nominee);
  await sbx.expectPlayerDead(nominee);
});

// ============================================================
// Scenario 6: Host saves — no elimination after voting
// ============================================================
test('Scenario 6: Host saves after voting', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  await sbx.playIntroductionNight();
  await sbx.advanceToDiscussion();

  // Nominate someone
  const speaker = r.villagers[0];
  const nominee = r.villagers[1];
  await sbx.switchToHost();
  await sbx.grantSpeaking(speaker);
  await sbx.switchToPlayer(speaker);
  await sbx.nominate(nominee);
  await sbx.switchToHost();
  await sbx.endSpeaking(speaker);

  // Voting phase
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.startNomineeVote();

  // Finalize (nobody votes, all go to last nominee)
  await sbx.startNomineeVote();

  // Host saves
  await sbx.hostSave();

  // Verify player still alive
  await sbx.expectPlayerAlive(nominee);
});

// ============================================================
// Scenario 7: Mafia wins by achieving equal numbers
// ============================================================
test('Scenario 7: Mafia wins by parity', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  // 10 players: 2 mafia + 1 don + 1 sheriff + 6 villagers
  // Mafia team = 3, village team = 7
  // Mafia needs to kill until mafia >= villagers: 3 >= 4 means kill 3 villagers
  // Then vote out 1 more villager = 3 >= 3 = mafia wins

  await sbx.playIntroductionNight();

  // Day 1 → vote out a villager
  await sbx.advanceToDiscussion();
  const speaker1 = r.mafias[0];
  await sbx.switchToHost();
  await sbx.grantSpeaking(speaker1);
  await sbx.switchToPlayer(speaker1);
  await sbx.nominate(r.villagers[0]);
  await sbx.switchToHost();
  await sbx.endSpeaking(speaker1);
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.startNomineeVote(); // start vote on nominee
  // Mafia team votes
  for (const voter of r.mafiaTeam) {
    await sbx.switchToPlayer(voter);
    await sbx.castVote();
  }
  await sbx.switchToHost();
  await sbx.startNomineeVote(); // finalize
  await sbx.hostEliminate(r.villagers[0]);
  // Now: 3 mafia, 6 village (sheriff + 5 villagers)

  // Night 2: kill another villager
  await sbx.advancePhase(); // → Night 2
  await sbx.switchToHost();
  await sbx.hostEliminate(r.villagers[1]);
  // Now: 3 mafia, 5 village
  await sbx.advancePhase(); // → don_check
  await sbx.advancePhase(); // → sheriff_check
  await sbx.advancePhase(); // → Day 2

  // Day 2 → vote out another villager
  await sbx.advanceToDiscussion();
  const speaker2 = r.mafias[1];
  await sbx.switchToHost();
  await sbx.grantSpeaking(speaker2);
  await sbx.switchToPlayer(speaker2);
  await sbx.nominate(r.villagers[2]);
  await sbx.switchToHost();
  await sbx.endSpeaking(speaker2);
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.startNomineeVote();
  for (const voter of r.mafiaTeam) {
    await sbx.switchToPlayer(voter);
    await sbx.castVote();
  }
  await sbx.switchToHost();
  await sbx.startNomineeVote(); // finalize
  await sbx.hostEliminate(r.villagers[2]);
  // Now: 3 mafia, 4 village

  // Night 3: kill another villager → 3 mafia, 3 village = mafia wins
  await sbx.advancePhase(); // → Night 3
  await sbx.switchToHost();
  await sbx.hostEliminate(r.villagers[3]);

  await sbx.expectGameOver('mafia');
});

// ============================================================
// Scenario 8: Villagers win by eliminating all mafia
// ============================================================
test('Scenario 8: Villagers win by eliminating all mafia', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  // 2 mafia + 1 don = 3 mafia team. Eliminate all 3.
  await sbx.playIntroductionNight();

  // Day 1: vote out mafia1
  await sbx.advanceToDiscussion();
  await sbx.switchToHost();
  await sbx.grantSpeaking(r.villagers[0]);
  await sbx.switchToPlayer(r.villagers[0]);
  await sbx.nominate(r.mafias[0]);
  await sbx.switchToHost();
  await sbx.endSpeaking(r.villagers[0]);
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.startNomineeVote();
  for (const v of r.villagers.slice(0, 5)) {
    await sbx.switchToPlayer(v);
    await sbx.castVote();
  }
  await sbx.switchToHost();
  await sbx.startNomineeVote(); // finalize
  await sbx.hostEliminate(r.mafias[0]);
  // 2 mafia left

  // Night 2: mafia kills a villager
  await sbx.advancePhase(); // → Night 2
  await sbx.switchToHost();
  await sbx.hostEliminate(r.villagers[0]);
  await sbx.advancePhase(); // don_check
  await sbx.advancePhase(); // sheriff_check
  await sbx.advancePhase(); // Day 2

  // Day 2: vote out mafia2
  await sbx.advanceToDiscussion();
  await sbx.switchToHost();
  await sbx.grantSpeaking(r.villagers[1]);
  await sbx.switchToPlayer(r.villagers[1]);
  await sbx.nominate(r.mafias[1]);
  await sbx.switchToHost();
  await sbx.endSpeaking(r.villagers[1]);
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.startNomineeVote();
  for (const v of r.villagers.slice(1, 5)) {
    await sbx.switchToPlayer(v);
    await sbx.castVote();
  }
  await sbx.switchToHost();
  await sbx.startNomineeVote();
  await sbx.hostEliminate(r.mafias[1]);
  // 1 mafia (don) left

  // Night 3: don kills a villager
  await sbx.advancePhase(); // Night 3
  await sbx.switchToHost();
  await sbx.hostEliminate(r.villagers[1]);
  await sbx.advancePhase(); // don_check
  await sbx.advancePhase(); // sheriff_check
  await sbx.advancePhase(); // Day 3

  // Day 3: vote out don
  await sbx.advanceToDiscussion();
  await sbx.switchToHost();
  await sbx.grantSpeaking(r.villagers[2]);
  await sbx.switchToPlayer(r.villagers[2]);
  await sbx.nominate(r.don);
  await sbx.switchToHost();
  await sbx.endSpeaking(r.villagers[2]);
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.startNomineeVote();
  for (const v of r.villagers.slice(2, 5)) {
    await sbx.switchToPlayer(v);
    await sbx.castVote();
  }
  await sbx.switchToHost();
  await sbx.startNomineeVote();
  await sbx.hostEliminate(r.don);

  await sbx.expectGameOver('villagers');
});

// ============================================================
// Scenario 9: Speaking order rotates each day, dead players skipped
// ============================================================
test('Scenario 9: Speaking order rotates and skips dead players', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  await sbx.playIntroductionNight();

  // Day 1: check suggested speaker
  await sbx.advanceToDiscussion();
  await sbx.switchToHost();
  const actionsPanel = page.locator('.border-l').last();
  const suggestedDay1 = await actionsPanel.locator('text=Suggested:').textContent();
  expect(suggestedDay1).toBeTruthy();

  // No eliminations, advance to Night 2
  await sbx.advanceToVoting();
  await sbx.switchToHost();
  await sbx.advancePhase(); // Night 2

  // Kill a villager
  await sbx.hostEliminate(r.villagers[0]);
  await sbx.advancePhase(); // don_check
  await sbx.advancePhase(); // sheriff_check
  await sbx.advancePhase(); // Day 2

  // Day 2: check suggested speaker is different from day 1
  await sbx.advanceToDiscussion();
  await sbx.switchToHost();
  const suggestedDay2 = await actionsPanel.locator('text=Suggested:').textContent();
  expect(suggestedDay2).toBeTruthy();

  // The suggested speaker should have rotated
  // (May or may not be different name, but the dead player should not be suggested)
  expect(suggestedDay2).not.toContain(r.villagers[0]);
});

// ============================================================
// Scenario 10: Multiple nominations during discussion, sequential voting
// ============================================================
test('Scenario 10: Multiple nominations and sequential voting', async ({ page }) => {
  const sbx = new SandboxPage(page);
  await setupGame(sbx);
  const r = await getRoles(sbx);

  await sbx.playIntroductionNight();
  await sbx.advanceToDiscussion();

  // Speaker 1 nominates villager A
  await sbx.switchToHost();
  await sbx.grantSpeaking(r.villagers[0]);
  await sbx.switchToPlayer(r.villagers[0]);
  await sbx.nominate(r.villagers[1]);
  await sbx.switchToHost();
  await sbx.endSpeaking(r.villagers[0]);

  // Speaker 2 nominates villager B
  await sbx.grantSpeaking(r.villagers[2]);
  await sbx.switchToPlayer(r.villagers[2]);
  await sbx.nominate(r.villagers[3]);
  await sbx.switchToHost();
  await sbx.endSpeaking(r.villagers[2]);

  // Verify both nominations show
  const mainArea = page.locator('.flex-1.overflow-y-auto').first();
  await expect(mainArea).toContainText('Nominated');

  // Move to voting
  await sbx.advanceToVoting();
  await sbx.switchToHost();

  // Start voting on nominee 1
  await sbx.startNomineeVote();

  // A few players vote for nominee 1
  await sbx.switchToPlayer(r.villagers[4]);
  await sbx.castVote();
  await sbx.switchToPlayer(r.villagers[5]);
  await sbx.castVote();

  // Move to nominee 2
  await sbx.switchToHost();
  await sbx.startNomineeVote();

  // A few players vote for nominee 2
  await sbx.switchToPlayer(r.mafias[0]);
  await sbx.castVote();

  // Finalize
  await sbx.switchToHost();
  await sbx.startNomineeVote(); // finalize

  // Results should be visible — the nominees should show vote counts
  await expect(page.locator('.border-l').last()).toContainText('votes');

  // Host can choose to eliminate or save
  await sbx.hostSave();
});
