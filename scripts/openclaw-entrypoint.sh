#!/bin/sh
# Pre-install SIWA skill dependencies for Linux, then start the OpenClaw gateway.
# The host's node_modules may contain darwin-specific binaries (esbuild, etc.)
# that won't work on Linux, so we must reinstall from scratch.

SIWA_DIR="/home/node/.openclaw/workspace/siwa"
SIWA_TESTING_DIR="$SIWA_DIR/packages/siwa-testing"

echo "[siwa] Cleaning host node_modules (wrong platform)..."
rm -rf "$SIWA_DIR/node_modules" "$SIWA_TESTING_DIR/node_modules" "$SIWA_DIR/packages/siwa/node_modules"

echo "[siwa] Installing workspace dependencies..."
cd "$SIWA_DIR" && pnpm install --prefer-offline 2>&1 | tail -3 || npm install --prefer-offline --no-audit 2>&1 | tail -3 || true

echo "[siwa] Registering SIWA as workspace skill..."
mkdir -p /home/node/.openclaw/workspace/skills
ln -sfn "$SIWA_DIR/packages/siwa-skill" /home/node/.openclaw/workspace/skills/siwa

echo "[siwa] Dependencies ready, skill registered."
cd /app
exec node dist/index.js gateway --bind lan --port 18789
