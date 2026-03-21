/**
 * Tests a full 11-player lobby.
 * Prerequisites: run create-test-users.ts first to seed the DB.
 *
 * Usage:
 *   npx tsx scripts/test-prod-lobby.ts                  # localhost:3000
 *   BASE_URL=https://mafia-service-production.up.railway.app npx tsx scripts/test-prod-lobby.ts  # production
 */

import { chromium, type Browser, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = 'test123456';

const HOST = 'testhost';
const PLAYERS = [
  'testalice', 'testbob', 'testcharlie', 'testdiana', 'testeve',
  'testfrank', 'testgrace', 'testhank', 'testivy', 'testjack',
];

async function login(browser: Browser, username: string): Promise<Page> {
  // Each user gets its own isolated context (separate cookies/session)
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Login via API to get session cookie
  const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username, password: PASSWORD },
  });
  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${username}: ${res.status()} ${body.error || ''}`);
  }

  // Ensure media prefs are disabled (camera/mic off) to save LiveKit traffic
  await page.request.put(`${BASE_URL}/api/auth/media-prefs`, {
    data: { camera: false, mic: false },
  });

  return page;
}

async function main() {
  console.log(`Target: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: false });

  // 1. Login as host and create a room
  console.log(`Logging in as ${HOST}...`);
  const hostPage = await login(browser, HOST);
  console.log(`Creating room...`);
  await hostPage.goto(`${BASE_URL}/room/new`, { waitUntil: 'networkidle' });

  // Wait for room code to appear
  const codeEl = hostPage.locator('[data-testid="room-code"]');
  await codeEl.waitFor({ timeout: 30000 });
  const roomCode = (await codeEl.textContent())!.trim();
  console.log(`Room created: ${roomCode}\n`);

  // 2. Login all players and join the room in parallel
  console.log(`Joining ${PLAYERS.length} players in parallel...`);
  await Promise.all(PLAYERS.map(async (username) => {
    const page = await login(browser, username);
    await page.goto(`${BASE_URL}/room/${roomCode}`, { waitUntil: 'networkidle' });
    console.log(`  ${username} joined`);
  }));

  // Bring host tab to front
  await hostPage.bringToFront();
  console.log(`\nDone! 1 host + ${PLAYERS.length} players in room ${roomCode}`);
  console.log('Close the browser window to exit.');

  // Keep alive until browser is closed
  await new Promise<void>((resolve) => {
    browser.on('disconnected', resolve);
  });
}

main().catch(console.error);
