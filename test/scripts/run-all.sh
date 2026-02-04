#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "Starting SIWA server..."
pnpm tsx server/index.ts &
SERVER_PID=$!
sleep 2

echo "Running agent full flow..."
pnpm tsx agent/cli.ts full-flow

echo ""
echo "Server still running at http://localhost:3000"
echo "Press Ctrl+C to stop"
wait $SERVER_PID
