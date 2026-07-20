# Mafia

Real-time multiplayer Mafia (Werewolf) with live voice chat, built for actually playing with friends over the internet — not just a text-based simulation of the game.

## What it does

- Players join a room, get assigned secret roles, and play through day/night phases together in real time.
- **Live voice** during the game via [LiveKit](https://livekit.io/) — day-phase discussion and accusations happen over actual voice, the way the game is meant to be played.
- Room management and connection-state tracking handle players joining, disconnecting, and reconnecting mid-game.
- Covered by Playwright end-to-end tests exercising real game flows.

## Stack

- **Frontend:** Next.js, TypeScript
- **Server:** Custom Node server (`server.ts`) alongside Next.js, handling game state, rooms, and auth
- **Voice:** LiveKit
- **Testing:** Playwright (e2e)

## Architecture

```
src/       → Next.js frontend
server/    → game-controller, room-manager, auth, LiveKit integration, connection state
e2e/       → Playwright end-to-end tests
```

`room-manager` and `game-controller` own the core game loop (phases, roles, win conditions); `livekit.ts` wires up voice channels per room; `auth-routes.ts` / `auth.ts` handle player identity.

## Running locally

```bash
npm install
./dev.sh
```
