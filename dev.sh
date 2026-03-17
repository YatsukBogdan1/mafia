#!/bin/bash

# Start dev server (+ optional ngrok)
# Usage: ./dev.sh [--ngrok]

PORT=${PORT:-3000}

cleanup() {
  echo "Shutting down..."
  kill $DEV_PID $NGROK_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# Load env vars
set -a
source .env.local 2>/dev/null
set +a

# Start the server (Next.js + WS on same port)
echo "Starting server on port $PORT..."
npm run dev &
DEV_PID=$!

if [ "$1" = "--ngrok" ]; then
  # Wait for server to be ready
  echo "Waiting for server..."
  while ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; do
    sleep 1
  done

  echo "Starting ngrok tunnel..."
  ngrok http "$PORT" --config "$HOME/Library/Application Support/ngrok/ngrok.yml" &
  NGROK_PID=$!

  sleep 3
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
tunnels = json.load(sys.stdin)['tunnels']
for t in tunnels:
    if t['public_url'].startswith('https'):
        print(t['public_url']); break
" 2>/dev/null)

  echo ""
  echo "==========================="
  echo "Share with players: $NGROK_URL"
  echo "==========================="
  echo ""
fi

echo "Press Ctrl+C to stop."
wait

cleanup
