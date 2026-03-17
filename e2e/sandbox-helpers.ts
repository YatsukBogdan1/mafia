import { type Page, expect } from '@playwright/test';

/**
 * Helper class wrapping the sandbox page for E2E game scenario tests.
 * All interactions go through the actual UI — clicking buttons, reading text.
 */
export class SandboxPage {
  constructor(private page: Page) {}

  // --- Setup ---

  async goto() {
    await this.page.goto('/sandbox');
    await this.page.waitForSelector('text=Sandbox Mode');
  }

  async createSandbox() {
    await this.page.click('button:has-text("Create Sandbox")');
    await this.page.waitForSelector('text=SANDBOX');
  }

  // --- Phase helpers ---

  async getPhaseText(): Promise<string> {
    const el = this.page.locator('header span, [class*="text-indigo"], [class*="text-amber"], [class*="text-green"], [class*="text-zinc-400"]').first();
    // The phase display is in the header area
    const header = this.page.locator('.border-b').first();
    return (await header.textContent()) ?? '';
  }

  async expectPhaseContains(text: string) {
    await expect(this.page.locator('.border-b').first()).toContainText(text, { timeout: 5000 });
  }

  // --- Navigation ---

  async advancePhase() {
    await this.page.click('button:has-text("Next Phase")');
  }

  async startGame() {
    await this.page.click('button:has-text("Start Game")');
  }

  // --- Player switching ---

  async switchToHost() {
    // Host is first in the impersonate sidebar
    const hostButton = this.page.locator('text=Host').first();
    await hostButton.click();
    // Wait for sandbox_view to update
    await this.page.waitForTimeout(300);
  }

  async switchToPlayer(name: string) {
    const button = this.page.locator(`button:has-text("${name}")`).first();
    await button.click();
    await this.page.waitForTimeout(300);
  }

  async switchToPlayerByRole(role: string): Promise<string> {
    // Find a player with the given role in the impersonate sidebar
    const sidebar = this.page.locator('.border-r').first();
    const buttons = sidebar.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      if (text?.includes(role)) {
        const name = text.replace(role, '').replace(/\d+\./, '').trim();
        await btn.click();
        await this.page.waitForTimeout(300);
        return name;
      }
    }
    throw new Error(`No player with role ${role} found`);
  }

  /** Get the name of the player currently being viewed */
  async getViewingAs(): Promise<string> {
    const header = this.page.locator('.border-b').first();
    const text = await header.textContent();
    const match = text?.match(/Viewing as:\s*(.+)/);
    return match?.[1]?.trim() ?? '';
  }

  /** Get the role shown in the header for the currently viewed player */
  async getViewRole(): Promise<string | null> {
    const header = this.page.locator('.border-b').first();
    const badges = header.locator('span');
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      const text = (await badges.nth(i).textContent())?.trim();
      if (text && ['mafia', 'don', 'sheriff', 'villager'].includes(text)) {
        return text;
      }
    }
    return null;
  }

  // --- Role discovery: find all player names by role ---

  async discoverRoles(): Promise<Record<string, string>> {
    const roles: Record<string, string> = {};
    const sidebar = this.page.locator('.border-r').first();
    const buttons = sidebar.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = (await btn.textContent()) ?? '';
      // Format: "1. Alice mafia" or "Host"
      for (const role of ['mafia', 'don', 'sheriff', 'villager']) {
        if (text.includes(role)) {
          const name = text.replace(role, '').replace(/\d+\./, '').trim();
          roles[name] = role;
          break;
        }
      }
    }
    return roles;
  }

  async getPlayerNamesByRole(targetRole: string): Promise<string[]> {
    const roles = await this.discoverRoles();
    return Object.entries(roles)
      .filter(([, role]) => role === targetRole)
      .map(([name]) => name);
  }

  // --- Host actions ---

  async grantSpeaking(playerName: string) {
    // Click the player button in the speaking section
    const actionsPanel = this.page.locator('.border-l').last();
    await actionsPanel.locator(`button:has-text("${playerName}")`).first().click();
    await this.page.waitForTimeout(200);
  }

  async endSpeaking(playerName: string) {
    // Click the same button again to end speaking (it toggles)
    const actionsPanel = this.page.locator('.border-l').last();
    await actionsPanel.locator(`button:has-text("${playerName}")`).first().click();
    await this.page.waitForTimeout(200);
  }

  async hostEliminate(playerName: string) {
    const actionsPanel = this.page.locator('.border-l').last();
    // During voting results: "Eliminate" button in a row containing the name
    const resultRow = actionsPanel.locator(`div:has-text("${playerName}")`).filter({ has: this.page.locator('button:has-text("Eliminate")') });
    if (await resultRow.count() > 0) {
      await resultRow.first().locator('button:has-text("Eliminate")').click();
    } else {
      // During night: button with the player name directly
      await actionsPanel.locator(`button:has-text("${playerName}")`).first().click();
    }
    await this.page.waitForTimeout(200);
  }

  async hostSave() {
    await this.page.click('button:has-text("No elimination")');
    await this.page.waitForTimeout(200);
  }

  async startNomineeVote() {
    const actionsPanel = this.page.locator('.border-l').last();
    const btn = actionsPanel.locator('button').filter({ hasText: /Start voting|Next:|Finalize/ });
    await btn.click();
    await this.page.waitForTimeout(200);
  }

  // --- Player actions (switch to player first) ---

  async mafiaVote(voterName: string, targetName: string) {
    await this.switchToPlayer(voterName);
    const actionsPanel = this.page.locator('.border-l').last();
    await actionsPanel.locator(`button:has-text("${targetName}")`).first().click();
    await this.page.waitForTimeout(200);
  }

  async donCheck(targetName: string) {
    const actionsPanel = this.page.locator('.border-l').last();
    // Click target to select
    await actionsPanel.locator(`button:has-text("${targetName}")`).first().click();
    await this.page.waitForTimeout(200);
    // Click confirm
    await actionsPanel.locator('button:has-text("Confirm check")').click();
    await this.page.waitForTimeout(200);
  }

  async sheriffCheck(targetName: string) {
    const actionsPanel = this.page.locator('.border-l').last();
    // Click target to select
    await actionsPanel.locator(`button:has-text("${targetName}")`).first().click();
    await this.page.waitForTimeout(200);
    // Click confirm
    await actionsPanel.locator('button:has-text("Confirm check")').click();
    await this.page.waitForTimeout(200);
  }

  async nominate(targetName: string) {
    const actionsPanel = this.page.locator('.border-l').last();
    await actionsPanel.locator(`button:has-text("${targetName}")`).first().click();
    await this.page.waitForTimeout(200);
    await actionsPanel.locator('button:has-text("Confirm nomination")').click();
    await this.page.waitForTimeout(200);
  }

  async castVote() {
    const actionsPanel = this.page.locator('.border-l').last();
    await actionsPanel.locator('button:has-text("Vote for")').click();
    await this.page.waitForTimeout(200);
  }

  // --- Quick night actions (host view) ---

  async quickMafiaVoteAll(targetName: string) {
    await this.switchToHost();
    const quickSection = this.page.locator('text=Quick Actions').locator('..');
    await quickSection.locator(`button:has-text("${targetName}")`).first().click();
    await this.page.waitForTimeout(200);
  }

  // --- Assertions ---

  async expectGameOver(winner: 'mafia' | 'villagers') {
    await expect(this.page.locator('.border-b').first()).toContainText(
      `Game Over — ${winner} win`,
      { timeout: 5000 },
    );
  }

  async expectPlayerDead(name: string) {
    // Dead players have line-through styling or DEAD text
    const card = this.page.locator(`.grid >> div:has-text("${name}")`).first();
    await expect(card).toContainText('DEAD');
  }

  async expectPlayerAlive(name: string) {
    const mainArea = this.page.locator('.flex-1.overflow-y-auto').first();
    const card = mainArea.locator(`div:has-text("${name}")`).first();
    const text = await card.textContent();
    expect(text).not.toContain('DEAD');
  }

  async expectError(message: string) {
    await expect(this.page.locator('.bg-red-900\\/50')).toContainText(message, { timeout: 5000 });
  }

  async hasText(text: string): Promise<boolean> {
    return (await this.page.locator(`text=${text}`).count()) > 0;
  }

  // --- Full night cycle helper ---

  /** Run through introduction night (night 1): advance through all subphases */
  async playIntroductionNight() {
    await this.switchToHost();
    await this.expectPhaseContains('Night 1 — introduction');
    await this.advancePhase(); // → mafia_deliberation
    await this.expectPhaseContains('mafia deliberation');
    await this.advancePhase(); // → don_check
    await this.expectPhaseContains('don check');
    await this.advancePhase(); // → sheriff_check
    await this.expectPhaseContains('sheriff check');
    await this.advancePhase(); // → Day 1 announcement
    await this.expectPhaseContains('Day 1 — announcement');
  }

  /** Advance through day phases: free_talk → discussion */
  async advanceToDiscussion() {
    await this.switchToHost();
    await this.advancePhase(); // announcement → free_talk
    await this.expectPhaseContains('free talk');
    await this.advancePhase(); // free_talk → discussion
    await this.expectPhaseContains('discussion');
  }

  /** Advance from discussion to voting */
  async advanceToVoting() {
    await this.switchToHost();
    await this.advancePhase(); // discussion → voting
    await this.expectPhaseContains('voting');
  }

  /** Full night with actions: mafia vote, don check, sheriff check */
  async playActiveNight(opts: {
    mafiaTarget: string;
    mafiaVoters: string[];
    donTarget?: string;
    sheriffTarget?: string;
    eliminateTarget?: boolean;
  }) {
    await this.switchToHost();
    await this.expectPhaseContains('mafia deliberation');

    // Mafia votes
    for (const voter of opts.mafiaVoters) {
      await this.mafiaVote(voter, opts.mafiaTarget);
    }

    // Host eliminates during mafia phase
    await this.switchToHost();
    await this.hostEliminate(opts.mafiaTarget);
    await this.advancePhase(); // → don_check

    // Don check
    if (opts.donTarget) {
      const donName = (await this.getPlayerNamesByRole('don'))[0];
      await this.switchToPlayer(donName);
      await this.donCheck(opts.donTarget);
    }
    await this.switchToHost();
    await this.advancePhase(); // → sheriff_check

    // Sheriff check
    if (opts.sheriffTarget) {
      const sheriffName = (await this.getPlayerNamesByRole('sheriff'))[0];
      await this.switchToPlayer(sheriffName);
      await this.sheriffCheck(opts.sheriffTarget);
    }
    await this.switchToHost();
    await this.advancePhase(); // → Day announcement
  }
}
