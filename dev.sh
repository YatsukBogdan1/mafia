#!/bin/bash

# Start Next.js dev server and game WS server (+ optional ngrok)
# Usage: ./dev.sh [--ngrok]

PORT_NEXT=${PORT_NEXT:-3000}
PORT_WS=${PORT_WS:-3001}

cleanup() {
  echo "Shutting down..."
  kill $WS_PID $DEV_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# Load env vars for the WS server
set -a
source .env.local 2>/dev/null
set +a

# Start WS game server
echo "Starting game server on port $PORT_WS..."
npx tsx server/index.ts &
WS_PID=$!

# Start Next.js dev server
echo "Starting Next.js on port $PORT_NEXT..."
npm run dev -- -p "$PORT_NEXT" &
DEV_PID=$!

# Wait for dev server to be ready
echo "Waiting for dev server..."
while ! curl -s "http://localhost:$PORT_NEXT" > /dev/null 2>&1; do
  sleep 1
done
echo "Dev server ready!"

if [ "$1" = "--ngrok" ]; then
  echo "Starting ngrok tunnel..."
  ngrok http "$PORT_NEXT"
else
  echo ""
  echo "App:    http://localhost:$PORT_NEXT"
  echo "WS:     ws://localhost:$PORT_WS"
  echo ""
  echo "Run with --ngrok to start a tunnel."
  echo "Press Ctrl+C to stop."
  wait
fi

cleanup
