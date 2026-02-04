# SPEC: Local ERC-8004 Agent + SIWA Test Environment

## Goal

Build a local development environment to test the full ERC-8004 agent lifecycle:
wallet creation → agent registration (mocked) → SIWA sign-in → authenticated API calls.

Two processes:
1. **SIWA Server** — Express app acting as a relying party (verifies SIWA signatures, issues JWTs, serves a dashboard)
2. **Agent CLI** — Command-line agent that creates a wallet, registers (mock), and authenticates via SIWA

Everything runs locally. On-chain verification is optional (mocked by default, real via `--live` flag with RPC).

---

## Project Structure

```
test/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── server/
│   ├── index.ts              ← Express SIWA relying party (port 3000)
│   ├── siwa-verifier.ts      ← SIWA verification logic (offline + on-chain modes)
│   ├── nonce-store.ts        ← In-memory nonce store with expiry
│   ├── session-store.ts      ← In-memory session/JWT store
│   └── dashboard.ts          ← HTML dashboard route (GET /)
├── agent/
│   ├── cli.ts                ← Main agent CLI entry point
│   ├── flows/
│   │   ├── create-wallet.ts  ← Step 1: wallet creation via keystore
│   │   ├── register.ts       ← Step 2: mock registration (writes MEMORY.md)
│   │   └── sign-in.ts        ← Step 3: SIWA sign-in against the local server
│   └── config.ts             ← Agent configuration (server URL, keystore settings)
├── shared/
│   └── types.ts              ← Shared TypeScript types between agent and server
└── scripts/
    ├── run-all.sh            ← Start server + run agent full flow
    ├── test-flow.sh          ← Run agent CLI through all steps sequentially
    └── reset.sh              ← Clean up keystore, MEMORY.md, server state
```

---

## Source Files to Import

The following files from the existing skill provide the core crypto and keystore logic.
They live at the project root (outside `test/`), and test code imports them relatively.

```
scripts/
├── keystore.ts      ← Secure key storage (3 backends: os-keychain, encrypted-file, env)
├── memory.ts        ← MEMORY.md read/write helpers
├── siwa.ts          ← SIWA message building, signing, parsing, verification
assets/
├── MEMORY.md.template
├── registration-template.json
```

**Important**: Import these using relative paths from the test files:
```typescript
import { createWallet, hasWallet, getAddress, signMessage, getSigner } from '../../scripts/keystore';
import { buildSIWAMessage, parseSIWAMessage, generateNonce, signSIWAMessageUnsafe } from '../../scripts/siwa';
import { ensureMemoryExists, readMemory, writeMemoryField, isRegistered } from '../../scripts/memory';
```

The `signSIWAMessage()` function in siwa.ts uses the keystore internally. For the test agent, use this directly — it loads the key from the keystore, signs, and discards the key.

But the server-side verification does NOT need the keystore at all — it only uses `parseSIWAMessage()` and `ethers.verifyMessage()` to recover the signer from the signature.

---

## Dependencies (test/package.json)

```json
{
  "name": "erc-8004-test",
  "private": true,
  "type": "module",
  "scripts": {
    "server": "tsx server/index.ts",
    "agent": "tsx agent/cli.ts",
    "agent:create": "tsx agent/cli.ts create-wallet",
    "agent:register": "tsx agent/cli.ts register",
    "agent:signin": "tsx agent/cli.ts sign-in",
    "agent:flow": "tsx agent/cli.ts full-flow",
    "agent:status": "tsx agent/cli.ts status",
    "reset": "bash scripts/reset.sh",
    "dev": "concurrently \"npm run server\" \"sleep 2 && npm run agent:flow\""
  },
  "dependencies": {
    "ethers": "^6.13.0",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.0",
    "chalk": "^5.3.0",
    "tsx": "^4.0.0",
    "concurrently": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.5.0"
  }
}
```

**Note**: `keytar` is intentionally NOT listed. The test environment uses the `encrypted-file` keystore backend so it works everywhere without native dependencies. The keystore auto-detects this.

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "..",
    "resolveJsonModule": true,
    "declaration": false,
    "skipLibCheck": true
  },
  "include": ["./**/*.ts", "../scripts/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## .env.example

```env
# Server
PORT=3000
SERVER_DOMAIN=localhost:3000
JWT_SECRET=test-secret-change-in-production

# Agent keystore
KEYSTORE_BACKEND=encrypted-file
KEYSTORE_PASSWORD=test-password-local-only
KEYSTORE_PATH=./test/agent-keystore.json

# On-chain (optional — set for live mode)
# RPC_URL=https://sepolia.base.org
# CHAIN_ID=84532

# Mock registration defaults
MOCK_AGENT_ID=1
MOCK_AGENT_REGISTRY=eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb
MOCK_CHAIN_ID=84532
```

---

## Server Specification

### server/index.ts — Express App

```
Port: process.env.PORT || 3000
```

Routes:

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/`  | HTML dashboard showing registered agents & active sessions |
| `GET`  | `/health` | `{ status: "ok", agents: <count>, sessions: <count> }` |
| `POST` | `/siwa/nonce` | Generate nonce for SIWA challenge |
| `POST` | `/siwa/verify` | Verify SIWA signature, issue JWT |
| `GET`  | `/siwa/sessions` | List active sessions (for dashboard) |
| `GET`  | `/api/protected` | Example protected endpoint requiring JWT |
| `POST` | `/api/agent-action` | Example protected action endpoint |

CORS: Enable for all origins (local testing).
Body parser: `express.json()`.

Startup log:
```
🌐 SIWA Server running at http://localhost:3000
📋 Dashboard: http://localhost:3000
🔑 Mode: offline (no on-chain verification)
```

If `RPC_URL` is set, log `🔑 Mode: live (on-chain verification via <RPC_URL>)` instead.

### server/nonce-store.ts

In-memory nonce store.

```typescript
interface StoredNonce {
  nonce: string;
  address: string;       // which agent requested it
  createdAt: Date;
  expiresAt: Date;       // default: 5 minutes from creation
  consumed: boolean;
}
```

Exports:
- `createNonce(address: string): { nonce, issuedAt, expirationTime }` — generates crypto-random nonce, stores it, returns fields for the SIWA message
- `validateNonce(nonce: string): boolean` — checks nonce exists, is not expired, is not consumed. If valid, marks as consumed and returns true.
- `getNonceCount(): number` — for dashboard stats

Use `crypto.randomBytes(16).toString('hex')` for nonce generation.
Nonce expiry: 5 minutes.
Clean up expired nonces every 60 seconds via `setInterval`.

### server/session-store.ts

In-memory session store.

```typescript
interface AgentSession {
  token: string;          // JWT
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  issuedAt: Date;
  expiresAt: Date;
  verified: 'offline' | 'on-chain';  // which verification mode was used
}
```

Exports:
- `createSession(verificationResult, mode): AgentSession` — creates JWT with `{ address, agentId, agentRegistry }` payload, stores session, returns it
- `validateToken(token: string): payload | null` — verify JWT signature and expiry
- `getSessions(): AgentSession[]` — all active sessions (for dashboard)
- `getSessionCount(): number`

JWT signing: use `jsonwebtoken` with `process.env.JWT_SECRET`, expiry `1h`.

### server/siwa-verifier.ts

Two verification modes:

**Offline mode** (default — no RPC needed):
1. Parse the SIWA message via `parseSIWAMessage()`
2. Recover signer: `ethers.verifyMessage(message, signature)`
3. Check recovered address matches message address
4. Validate domain matches `SERVER_DOMAIN`
5. Validate nonce via nonce store
6. Check time window (expirationTime, notBefore)
7. **Skip on-chain `ownerOf()` check** — trust the signature alone
8. Return `{ valid: true, address, agentId, agentRegistry, chainId, verified: 'offline' }`

**Live mode** (when `RPC_URL` is set and `--live` flag or `VERIFICATION_MODE=live`):
1. Steps 1–6 same as offline
2. **Call `ownerOf(agentId)` on-chain** via the Identity Registry contract
3. Verify the recovered address is the NFT owner
4. Return `{ valid: true, ..., verified: 'on-chain' }`

Export a single function:
```typescript
async function verifySIWARequest(
  message: string,
  signature: string,
  domain: string,
  nonceValidator: (nonce: string) => boolean,
  provider?: ethers.Provider  // null = offline mode
): Promise<{ valid: boolean; address: string; agentId: number; agentRegistry: string; chainId: number; verified: 'offline' | 'on-chain'; error?: string }>
```

### server/dashboard.ts

Export a function that returns an HTML string for `GET /`.

The dashboard is a single-page HTML document (no framework, inline CSS + JS) that shows:

1. **Header**: "ERC-8004 SIWA Test Server" + mode badge (offline/live)
2. **Stats row**: Nonces issued / Sessions active / Agents seen
3. **Active Sessions table**:
   - Agent ID
   - Address (truncated: `0x1234...abcd`)
   - Registry
   - Verified (offline/on-chain badge)
   - Issued At
   - Expires At
   - Token (truncated, click to copy)
4. **Test Panel** at the bottom with:
   - A "Request Nonce" button that calls `POST /siwa/nonce` with a text input for address
   - A read-only text area showing the server's JSON response
   - A "Verify Signature" section with inputs for message + signature, and a verify button
5. **Auto-refresh**: Poll `/siwa/sessions` every 5 seconds to update the table

Style: Dark theme, monospace font, compact. Think "blockchain explorer" aesthetic.
Use only inline `<style>` and `<script>` — no external dependencies.

### Route Implementations

**POST /siwa/nonce**

Request body:
```json
{
  "address": "0x1234...",
  "agentId": 1,
  "agentRegistry": "eip155:84532:0x8004AA63..."
}
```

Response:
```json
{
  "nonce": "a1b2c3d4e5f6g7h8",
  "issuedAt": "2026-02-04T17:00:00.000Z",
  "expirationTime": "2026-02-04T17:05:00.000Z",
  "domain": "localhost:3000",
  "uri": "http://localhost:3000/siwa/verify",
  "chainId": 84532
}
```

Log: `📨 Nonce requested by 0x1234...abcd`

**POST /siwa/verify**

Request body:
```json
{
  "message": "<full SIWA message string>",
  "signature": "0xabc..."
}
```

Success response:
```json
{
  "success": true,
  "token": "eyJhbG...",
  "address": "0x1234...",
  "agentId": 1,
  "agentRegistry": "eip155:84532:0x8004AA63...",
  "verified": "offline",
  "expiresAt": "2026-02-04T18:00:00.000Z"
}
```

Failure response:
```json
{
  "success": false,
  "error": "Invalid or consumed nonce"
}
```

Log on success: `✅ Agent #1 (0x1234...abcd) signed in [offline]`
Log on failure: `❌ SIWA verification failed: <error>`

**GET /api/protected**

Requires `Authorization: Bearer <token>` header.
Validates JWT, returns:
```json
{
  "message": "Hello Agent #1!",
  "address": "0x1234...",
  "agentId": 1,
  "timestamp": "2026-02-04T17:01:00.000Z"
}
```

If no/invalid token: `401 { error: "Unauthorized" }`

**POST /api/agent-action**

Same auth as above. Accepts any JSON body and echoes it back with agent identity:
```json
{
  "received": { ... },
  "processedBy": "siwa-test-server",
  "agent": { "address": "0x...", "agentId": 1 },
  "timestamp": "..."
}
```

This simulates a real API that an authenticated agent would call.

---

## Agent CLI Specification

### agent/config.ts

```typescript
export const config = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  serverDomain: process.env.SERVER_DOMAIN || 'localhost:3000',
  memoryPath: process.env.MEMORY_PATH || './test/MEMORY.md',
  keystorePath: process.env.KEYSTORE_PATH || './test/agent-keystore.json',
  keystorePassword: process.env.KEYSTORE_PASSWORD || 'test-password-local-only',
  keystoreBackend: (process.env.KEYSTORE_BACKEND || 'encrypted-file') as KeystoreBackend,
  mockAgentId: parseInt(process.env.MOCK_AGENT_ID || '1'),
  mockAgentRegistry: process.env.MOCK_AGENT_REGISTRY || 'eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
  mockChainId: parseInt(process.env.MOCK_CHAIN_ID || '84532'),
};
```

### agent/cli.ts — Entry Point

Parses the first CLI argument as a subcommand:

| Command | Description |
|---------|-------------|
| `create-wallet` | Create wallet in keystore, write address to MEMORY.md |
| `register` | Mock-register the agent (write mock agentId etc. to MEMORY.md) |
| `sign-in` | Full SIWA flow against the local server |
| `call-api` | Make an authenticated call to `/api/protected` using the session token from MEMORY.md |
| `full-flow` | Run all four steps sequentially |
| `status` | Print current MEMORY.md state + keystore status |
| (no args) | Print help/usage |

All output should use colored console logging with emoji prefixes for readability:
- `🔑` for keystore/wallet operations
- `📝` for MEMORY.md writes
- `🌐` for HTTP requests
- `✅` for success
- `❌` for errors

### agent/flows/create-wallet.ts

```typescript
export async function createWalletFlow(): Promise<void>
```

1. Call `ensureMemoryExists()` with config.memoryPath
2. Check `hasWallet()` via keystore — if exists, print address and skip
3. Call `createWallet({ backend, keystorePath, password })` from keystore.ts
4. Write Address, Keystore Backend, Keystore Path, Created At to MEMORY.md
5. Print summary:
   ```
   🔑 Wallet created
      Address:  0x1234...
      Backend:  encrypted-file
      Keystore: ./test/agent-keystore.json
   📝 MEMORY.md updated (public data only — no private key stored here)
   ```

### agent/flows/register.ts

```typescript
export async function registerFlow(): Promise<void>
```

This is a **mock registration** for local testing — no on-chain transaction.

1. Check MEMORY.md — if already registered (`isRegistered()`), print status and skip
2. Check wallet exists — if not, print error and exit
3. Write mock registration data to MEMORY.md:
   - Status: `registered`
   - Agent ID: `config.mockAgentId`
   - Agent Registry: `config.mockAgentRegistry`
   - Agent URI: `data:application/json;base64,<encoded mock metadata>`
   - Chain ID: `config.mockChainId`
   - Registered At: `<now ISO>`
4. Also write mock profile:
   - Name: `Test Agent`
   - Description: `Local test agent for SIWA development`
5. Print summary:
   ```
   📝 Mock registration complete
      Agent ID:       1
      Agent Registry: eip155:84532:0x8004AA63...
      Chain ID:       84532
      ℹ️  This is a mock — no on-chain transaction was made.
      ℹ️  Use --live with RPC_URL for real registration.
   ```

### agent/flows/sign-in.ts

```typescript
export async function signInFlow(): Promise<void>
```

This is the most important flow — the full SIWA round-trip:

1. Read MEMORY.md — get address, agentId, agentRegistry, chainId
2. If not registered, error out
3. **Request nonce from server**:
   ```
   POST http://localhost:3000/siwa/nonce
   { address, agentId, agentRegistry }
   ```
   Print: `🌐 Requesting nonce from localhost:3000...`
   Print: `📨 Nonce received: <nonce> (expires: <expirationTime>)`

4. **Build and sign SIWA message via keystore**:
   Import `signSIWAMessage` from `../../scripts/siwa.ts`.
   Call it with the fields from step 1 + nonce response:
   ```typescript
   const { message, signature } = await signSIWAMessage({
     domain: config.serverDomain,
     address,
     statement: 'Authenticate as a registered ERC-8004 agent.',
     uri: `${config.serverUrl}/siwa/verify`,
     agentId,
     agentRegistry,
     chainId,
     nonce: nonceResponse.nonce,
     issuedAt: nonceResponse.issuedAt,
     expirationTime: nonceResponse.expirationTime,
   });
   ```
   Print: `🔑 SIWA message signed (key loaded from keystore, used, discarded)`
   Print the full SIWA message in a box/border for visibility.

5. **Submit signature to server**:
   ```
   POST http://localhost:3000/siwa/verify
   { message, signature }
   ```
   Print: `🌐 Submitting signature to localhost:3000...`

6. **Handle response**:
   - On success: print token, write session to MEMORY.md Sessions section
     ```
     ✅ SIWA Sign-In Successful!
        Token:    eyJhbG... (truncated)
        Verified: offline
        Expires:  2026-02-04T18:00:00.000Z
     📝 Session saved to MEMORY.md
     ```
   - On failure: print error
     ```
     ❌ SIWA Sign-In Failed: <error message>
     ```

7. **Test authenticated API call** (if sign-in succeeded):
   ```
   GET http://localhost:3000/api/protected
   Authorization: Bearer <token>
   ```
   Print: `🌐 Testing authenticated API call...`
   Print the response body.
   ```
   ✅ Authenticated API call successful:
      "Hello Agent #1!"
   ```

### Full Flow

The `full-flow` command runs all steps with 1-second delays between them for readability:

```
═══════════════════════════════════════════════
  ERC-8004 Agent — Local Test Flow
═══════════════════════════════════════════════

Step 1/4: Create Wallet
────────────────────────
🔑 Wallet created
   Address: 0x742d...
   ...

Step 2/4: Mock Registration
────────────────────────────
📝 Mock registration complete
   Agent ID: 1
   ...

Step 3/4: SIWA Sign-In
────────────────────────
🌐 Requesting nonce...
🔑 Message signed...
✅ Sign-in successful!
   ...

Step 4/4: Authenticated API Call
─────────────────────────────────
🌐 GET /api/protected
✅ Response: "Hello Agent #1!"

═══════════════════════════════════════════════
  ✅ All steps completed successfully!
  📋 Dashboard: http://localhost:3000
═══════════════════════════════════════════════
```

### Status Command

Print current state from MEMORY.md + keystore:

```
Agent Status
────────────
Wallet:       0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
Keystore:     encrypted-file (./test/agent-keystore.json)
Registered:   yes (Agent #1)
Registry:     eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb
Chain:        84532
Sessions:     1 active
Last Sign-In: 2026-02-04T17:01:00.000Z @ localhost:3000
```

---

## Shell Scripts

### scripts/run-all.sh

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "Starting SIWA server..."
npx tsx server/index.ts &
SERVER_PID=$!
sleep 2

echo "Running agent full flow..."
npx tsx agent/cli.ts full-flow

echo ""
echo "Server still running at http://localhost:3000"
echo "Press Ctrl+C to stop"
wait $SERVER_PID
```

### scripts/reset.sh

```bash
#!/usr/bin/env bash
cd "$(dirname "$0")/.."

rm -f ./test/agent-keystore.json
rm -f ./test/MEMORY.md
echo "🧹 Cleaned up keystore and MEMORY.md"
```

### scripts/test-flow.sh

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "=== Step 1: Create Wallet ==="
npx tsx agent/cli.ts create-wallet
echo ""

echo "=== Step 2: Register (mock) ==="
npx tsx agent/cli.ts register
echo ""

echo "=== Step 3: SIWA Sign-In ==="
npx tsx agent/cli.ts sign-in
echo ""

echo "=== Step 4: Check Status ==="
npx tsx agent/cli.ts status
```

---

## README.md

Write a README with:

1. **What this is**: A local test environment for the ERC-8004 SIWA authentication flow
2. **Quick start**:
   ```bash
   cd test
   npm install
   
   # Terminal 1: Start the SIWA server
   npm run server
   
   # Terminal 2: Run the full agent flow
   npm run agent:flow
   
   # Or run both at once:
   npm run dev
   ```
3. **What happens**: Explain the 4-step flow (wallet → register → sign-in → API call)
4. **Dashboard**: Open `http://localhost:3000` to see sessions
5. **Individual commands**: Table of `npm run agent:create`, `agent:register`, etc.
6. **Reset**: `npm run reset` to start fresh
7. **Live mode**: How to set `RPC_URL` for real on-chain verification
8. **Security note**: Remind that the test env uses `encrypted-file` backend with a known password — not for production. In production, use OS keychain or a strong unique password.

---

## Implementation Notes for Claude Code

1. **All HTTP requests in the agent** should use native `fetch()` (available in Node 18+). Do NOT use axios or node-fetch.

2. **Do not install `keytar`**. The test environment should work with zero native dependencies by using the `encrypted-file` keystore backend. The keystore.ts auto-detects this.

3. **The keystore password for testing** is hardcoded in config as `'test-password-local-only'`. Pass it to keystore functions via the `KeystoreConfig.password` field. This avoids the `deriveMachinePassword()` fallback which would give different results in different environments.

4. **TypeScript execution**: Use `tsx` (esbuild-based TypeScript runner). It handles ESM, path resolution, and is much faster than `ts-node`.

5. **Console output**: Use `chalk` for colors. Color scheme:
   - Green: success messages
   - Yellow: warnings, skipped steps
   - Red: errors
   - Cyan: HTTP requests, URLs
   - Dim: secondary info (paths, timestamps)
   - Bold: step headers

6. **Error handling**: Every flow function should catch errors and print a clear message rather than crashing with a stack trace. Include the failing step name in the error.

7. **Paths**: All file paths (MEMORY.md, keystore) should be relative to the `test/` directory. Use `path.resolve()` with `import.meta.dirname` or `process.cwd()`.

8. **The SIWA message is the critical artifact** — during the sign-in flow, print the full SIWA plaintext message in a bordered box so the developer can inspect it. This is the actual string that gets signed.

9. **The signSIWAMessage function** in `scripts/siwa.ts` now takes fields as the first argument (no private key). It internally calls `keystore.signMessage()`. Pass `keystoreConfig` as the second argument so it knows which backend/path/password to use:
   ```typescript
   import { signSIWAMessage } from '../../scripts/siwa';
   
   const { message, signature } = await signSIWAMessage(
     { domain, address, agentId, ... },            // SIWAMessageFields
     { backend: 'encrypted-file', password: '...' } // KeystoreConfig
   );
   ```

10. **Server-side verification does NOT use the keystore at all**. It only needs:
    - `parseSIWAMessage()` from siwa.ts — to extract fields
    - `ethers.verifyMessage(message, signature)` — to recover the signer address
    - The nonce store — to validate + consume the nonce
    - (Optional) `ethers.Contract` for on-chain `ownerOf()` in live mode

11. **On the dashboard**, the JWT token column should show only the first 20 chars + `...` with a click-to-copy button.

12. **After building everything**, run the full flow once to verify it works end-to-end, then fix any issues. The expected outcome is:
    - Server starts on port 3000
    - Agent creates wallet (encrypted keystore file appears)
    - Agent mock-registers (MEMORY.md gets populated)
    - Agent requests nonce from server
    - Agent signs SIWA message via keystore
    - Server verifies signature + nonce, issues JWT
    - Agent calls protected API with JWT, gets 200
    - Dashboard shows the session

---

## Verification Checklist

After building, verify:

- [ ] `npm run server` starts without errors on port 3000
- [ ] `http://localhost:3000` shows the dashboard
- [ ] `npm run agent:create` creates `test/agent-keystore.json` (encrypted, NOT plaintext key) and `test/MEMORY.md`
- [ ] `test/MEMORY.md` does NOT contain any private key
- [ ] `test/agent-keystore.json` is an encrypted V3 JSON (has `Crypto.ciphertext`, `kdf: "scrypt"`)
- [ ] `npm run agent:register` writes mock agentId to MEMORY.md
- [ ] `npm run agent:signin` completes the full SIWA round-trip and prints a JWT
- [ ] `npm run agent:flow` runs all 4 steps end-to-end
- [ ] Dashboard updates to show the new session
- [ ] `npm run reset` cleans up all state
- [ ] Running `npm run agent:flow` again after reset creates fresh state
- [ ] The SIWA plaintext message printed by the agent is well-formatted and contains all required fields
- [ ] Server rejects a replayed nonce (run sign-in twice rapidly — second should fail)
- [ ] Server rejects an invalid signature (test with a tampered message)
- [ ] Protected API returns 401 without a token
- [ ] Protected API returns 200 with a valid token
