# Smart Account Support — Implementation Plan

**Date:** 2026-02-12
**Updated:** 2026-02-12 (reworked after `feat/byow_signer` merge)
**Companion:** [smart-account-identity-report.md](./smart-account-identity-report.md)

---

## Goal

Enable SIWA to authenticate agents using any account type — EOA, TBA (ERC-6551), 4337 smart account, Safe, or any ERC-1271-compatible contract — without mandating a specific account framework. Platforms should be able to set policy on what signer types they accept.

## Design Principles

1. **The signing/verification API shape does not change.** `signAuthenticatedRequest()` and `verifyAuthenticatedRequest()` stay the same.
2. **No new Solidity contracts.** SIWA is an authentication protocol, not an account framework. Any ERC-1271 account works.
3. **No per-request RPC calls.** The receipt caches the sign-in verification. Per-request auth is pure math (ECDSA recovery + HMAC check).
4. **Backwards compatible.** All changes are additive. Existing agents with EOAs continue to work unchanged.
5. **The protocol surfaces signer type; platforms decide policy.** SIWA doesn't prefer any account type.

---

## Current State (post `feat/byow_signer`)

### What already works

- **Wallet-agnostic `Signer` interface** (`signer.ts`) — abstracts signing operations behind `getAddress()`, `signMessage()`, `signRawMessage()` with three implementations: `createKeyringProxySigner`, `createLocalAccountSigner`, `createWalletClientSigner`
- **ERC-1271 in sign-in** — `verifySIWA()` uses `client.verifyMessage()` which transparently handles EOA (ECDSA) and smart contract (ERC-1271 `isValidSignature`) signers
- **ERC-1271 in per-request verification** — `verifyAuthenticatedRequest()` supports it when `publicClient` is passed
- **ERC-8128 signing via abstract `Signer`** — `createErc8128Signer(signer, chainId)` creates an `EthHttpSigner` from any SIWA `Signer`
- **Receipt system** — caches sign-in verification, per-request path is zero RPC calls

### What doesn't work yet

- **Signer type not surfaced** — `SiwaAgent`, `SIWAVerificationResult`, and `ReceiptPayload` don't indicate whether the signer is an EOA or smart contract.
- **No platform policy** — platforms can't express "reject EOA signers" or "require smart contract accounts."
- **Agent can't present TBA identity** — `createErc8128Signer()` uses the signer's own address. There's no way to present a TBA address in the ERC-8128 `keyid` while signing with the underlying EOA key.
- **No TBA address utilities** — platforms that want to verify a signer is specifically a TBA for a given agent NFT have to implement `create2` derivation themselves.

---

## Implementation Phases

### ~~Phase 1: ERC-1271 in Sign-In~~ ✅ DONE

Completed in `feat/byow_signer`. `verifySIWA()` at `siwa.ts:533` now uses `client.verifyMessage()` instead of the bare `verifyMessage()` import. This transparently handles both EOA and ERC-1271 smart contract signers.

---

### Phase 2: Signer Type Detection and Surfacing

**Problem:** After verification, platforms don't know whether the signature came from an EOA or a smart contract. They can't make policy decisions based on signer type.

**Solution:** Detect the signer type during sign-in and include it in the result. Detection: check if the signer address has deployed code (`getCode`). Cache in the receipt so per-request verification stays zero-RPC.

**Files:**
- `packages/siwa/src/siwa.ts` — `SIWAVerificationResult`, `verifySIWA()`
- `packages/siwa/src/erc8128.ts` — `SiwaAgent`, `verifyAuthenticatedRequest()`
- `packages/siwa/src/receipt.ts` — `ReceiptPayload`

**Changes:**

1. Add `signerType` to `SIWAVerificationResult`:
```typescript
export interface SIWAVerificationResult {
  // ... existing fields
  signerType?: 'eoa' | 'sca';    // new
}
```

2. Detect in `verifySIWA()` after successful signature verification:
```typescript
const code = await client.getCode({ address: fields.address as Address });
const signerType = (code && code !== '0x') ? 'sca' : 'eoa';
```

3. Add `signerType` to `ReceiptPayload`:
```typescript
export interface ReceiptPayload {
  // ... existing fields
  signerType?: 'eoa' | 'sca';    // new, optional for backwards compat
}
```

4. Add `signerType` to `SiwaAgent`:
```typescript
export interface SiwaAgent {
  // ... existing fields
  signerType?: 'eoa' | 'sca';    // new
}
```

5. In `verifyAuthenticatedRequest()`, read `signerType` from the receipt and include it in the `SiwaAgent` result.

**Why detect at sign-in, not per-request:** The `getCode` call requires an RPC round-trip. By detecting at sign-in and storing in the receipt, per-request verification stays zero-RPC.

**Why `'sca'` and not `'tba'`:** SIWA can detect "this is a smart contract" (code exists at address). It cannot reliably detect "this is specifically a TBA" without knowing the 6551 implementation address. `sca` is the honest, verifiable signal. Platforms that need TBA-specific verification can use the utility from Phase 5.

**Backwards compatibility:** `signerType` is optional everywhere. Old receipts without it still work.

---

### Phase 3: Platform Policy Enforcement

**Problem:** Platforms have no way to express "only accept smart contract signers" or "reject EOA agents."

**Solution:** Add a `requiredSignerType` option to both the sign-in and per-request verification paths.

**Files:**
- `packages/siwa/src/siwa.ts` — `SIWAVerifyCriteria`
- `packages/siwa/src/erc8128.ts` — `VerifyOptions`
- `packages/siwa/src/express.ts` — `SiwaMiddlewareOptions`
- `packages/siwa/src/next.ts` — `WithSiwaOptions`

**Changes:**

1. Add to `VerifyOptions` (per-request):
```typescript
export interface VerifyOptions {
  // ... existing fields
  requiredSignerType?: 'eoa' | 'sca';    // new
}
```

2. In `verifyAuthenticatedRequest()`, after extracting the receipt:
```typescript
if (options.requiredSignerType && receipt.signerType !== options.requiredSignerType) {
  return { valid: false, error: `Signer type '${receipt.signerType || 'unknown'}' does not meet required '${options.requiredSignerType}'` };
}
```

3. Add to `SIWAVerifyCriteria` (sign-in):
```typescript
export interface SIWAVerifyCriteria {
  // ... existing fields
  requiredSignerType?: 'eoa' | 'sca';    // new
}
```

4. Pass through in Express/Next.js middleware options.

**Why enforce on the receipt, not re-detect:** The receipt already carries `signerType` from Phase 2. Re-detecting per-request would require an RPC call.

---

### Phase 4: TBA Identity in ERC-8128 Signing

**Problem:** `createErc8128Signer()` uses `signer.getAddress()` as the `EthHttpSigner.address`. This address goes into the ERC-8128 `keyid` field. If an agent's identity is a TBA, the keyid should contain the TBA address, but the actual signing still uses the underlying EOA key.

**Solution:** Add an optional `signerAddress` override to `createErc8128Signer()`.

**File:** `packages/siwa/src/erc8128.ts`

**Change:**
```typescript
export async function createErc8128Signer(
  signer: Signer,
  chainId: number,
  options?: { signerAddress?: Address },    // new
): Promise<EthHttpSigner> {
  const address = options?.signerAddress ?? await signer.getAddress();
  return {
    address,
    chainId,
    signMessage: async (message: Uint8Array): Promise<Hex> => {
      // Signing always uses the underlying signer (unchanged)
      const hex = ('0x' + Array.from(message).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex;
      if (signer.signRawMessage) return signer.signRawMessage(hex);
      return signer.signMessage(hex);
    },
  };
}
```

Also add `signerAddress` to `signAuthenticatedRequest()`:
```typescript
export async function signAuthenticatedRequest(
  request: Request,
  receipt: string,
  signer: Signer,
  chainId: number,
  options?: { signerAddress?: Address },    // new
): Promise<Request> { ... }
```

**How it works end-to-end:**
1. Agent calls `signAuthenticatedRequest(req, receipt, signer, chainId, { signerAddress: tbaAddress })`
2. The `EthHttpSigner.address` is the TBA address → goes into the ERC-8128 `keyid`
3. The `signMessage` callback signs with the EOA key (unchanged)
4. Server verifies via `publicClient.verifyMessage({ address: tbaAddress, ... })`
5. viem detects that `tbaAddress` is a contract → calls `isValidSignature()` on the TBA
6. The TBA checks the ECDSA signature against its registered agent key → valid

---

### Phase 5: TBA Address Computation Utility

**Problem:** Platforms that want to verify a signer is specifically a TBA for a given agent NFT need to compute the expected 6551 address.

**Solution:** Export a utility module with `computeTbaAddress()` and `isTbaForAgent()`.

**File:** New `packages/siwa/src/tba.ts`, exported as `@buildersgarden/siwa/tba`

**Why a separate module:** TBA verification requires knowing the `implementation` address, which is deployment-specific. SIWA shouldn't hardcode any particular TBA implementation. Platforms that use TBAs know their implementation address and call this utility. Platforms that don't never import it.

---

## Phase Summary

| Phase | Status | Files Changed | RPC Impact | Breaking Changes |
|---|---|---|---|---|
| 1. ERC-1271 in sign-in | ✅ DONE | `siwa.ts` | — | None |
| 2. Signer type detection | TODO | `siwa.ts`, `erc8128.ts`, `receipt.ts` | +1 `getCode` at sign-in | None (optional fields) |
| 3. Platform policy | TODO | `erc8128.ts`, `siwa.ts`, `express.ts`, `next.ts` | None | None (optional options) |
| 4. TBA signing | TODO | `erc8128.ts` | None | None (optional parameter) |
| 5. TBA utilities | TODO | New `tba.ts`, `package.json`, `index.ts` | None (pure computation) | None (new module) |

## Dependency Order

```
Phase 1 ✅ (ERC-1271 in sign-in)
  └──▶ Phase 2 (signer type detection)
         ├──▶ Phase 3 (policy enforcement) — needs signerType in receipt
         └──▶ Phase 4 (TBA signing) — independent
                └──▶ Phase 5 (TBA utilities) — independent

Phases 4 and 5 have no dependency on Phases 2/3 and can be done in parallel.
```

---

## What This Does NOT Include

- **Solidity contracts** — SIWA is an auth protocol, not an account framework. Use any ERC-1271 account.
- **4337 integration** — 4337 is for onchain transaction execution, not authentication. Orthogonal concern.
- **TEE attestation** — Out of scope for the SDK. Platforms can implement custom `isValidSignature()` logic.
- **Changes to ERC-8128 / `@slicekit/erc8128`** — Already supports custom verify functions.
- **Changes to ERC-8004 registry contract** — Already account-type agnostic.
