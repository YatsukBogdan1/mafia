/**
 * Opens a browser with 11 tabs: 1 host + 10 players.
 * Usage: npx playwright test scripts/test-11-players.ts
 *   or:  npx tsx scripts/test-11-players.ts
 */

import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HOST_NAME = 'Host';
const PLAYER_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
  'Frank', 'Grace', 'Hank', 'Ivy', 'Jack',
];

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['microphone', 'camera'],
  });

  // 1. Host creates a room
  console.log('Creating room as Host...');
  const hostPage = await context.newPage();
  await hostPage.goto(
    `${BASE_URL}/room?name=${encodeURIComponent(HOST_NAME)}&action=create`,
  );

  // Wait for room code to appear
  const codeEl = hostPage.locator('.font-mono.text-sm').first();
  await codeEl.waitFor({ timeout: 15000 });
  const roomCode = (await codeEl.textContent())!.trim();
  console.log(`Room created: ${roomCode}`);

  // 2. Open 10 player tabs that join the room
  for (const name of PLAYER_NAMES) {
    console.log(`Joining as ${name}...`);
    const page = await context.newPage();
    await page.goto(
      `${BASE_URL}/room?name=${encodeURIComponent(name)}&action=join&code=${roomCode}`,
    );
    // Small delay to avoid overwhelming the server
    await page.waitForTimeout(500);
  }

  // Bring host tab to front
  await hostPage.bringToFront();
  console.log(`\nDone! 1 host + ${PLAYER_NAMES.length} players in room ${roomCode}`);
  console.log('Close the browser window to exit.');

  // Keep alive until browser is closed
  await new Promise<void>((resolve) => {
    context.on('close', resolve);
    browser.on('disconnected', resolve);
  });
}

main().catch(console.error);
