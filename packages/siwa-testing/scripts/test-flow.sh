#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "=== Step 1: Create Wallet ==="
pnpm tsx agent/cli.ts create-wallet
echo ""

echo "=== Step 2: Register (mock) ==="
pnpm tsx agent/cli.ts register
echo ""

echo "=== Step 3: SIWA Sign-In ==="
pnpm tsx agent/cli.ts sign-in
echo ""

echo "=== Step 4: Check Status ==="
pnpm tsx agent/cli.ts status
