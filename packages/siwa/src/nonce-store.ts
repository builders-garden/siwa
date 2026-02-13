/**
 * nonce-store.ts
 *
 * Pluggable nonce store for SIWA sign-in replay protection.
 *
 * The default HMAC-based stateless nonces are convenient but can be replayed
 * within their TTL window. A SIWANonceStore tracks issued nonces server-side
 * so each nonce can only be consumed once.
 *
 * Built-in factories:
 *   - createMemorySIWANonceStore()      — single-process (Map + TTL)
 *   - createRedisSIWANonceStore(redis)  — ioredis / node-redis
 *   - createKVSIWANonceStore(kv)        — Cloudflare Workers KV
 *
 * For databases (SQL, Prisma, Drizzle), implement the SIWANonceStore interface
 * directly — it's just two methods.
 *
 * No new runtime dependencies — each factory accepts a minimal interface so
 * users bring their own client.
 */

export interface SIWANonceStore {
  /** Store an issued nonce. Returns true on success, false if already exists. */
  issue(nonce: string, ttlMs: number): Promise<boolean>;
  /** Atomically check-and-delete a nonce. Returns true if it existed (valid), false otherwise. */
  consume(nonce: string): Promise<boolean>;
}

/**
 * In-memory nonce store with TTL-based expiry.
 *
 * Suitable for single-process servers. For multi-instance deployments,
 * implement SIWANonceStore with a shared store (Redis, database, etc.).
 */
export function createMemorySIWANonceStore(): SIWANonceStore {
  const nonces = new Map<string, number>(); // nonce → expiry timestamp (ms)

  function cleanup() {
    const now = Date.now();
    for (const [k, expiry] of nonces) {
      if (expiry < now) nonces.delete(k);
    }
  }

  return {
    async issue(nonce: string, ttlMs: number): Promise<boolean> {
      cleanup();
      if (nonces.has(nonce)) return false;
      nonces.set(nonce, Date.now() + ttlMs);
      return true;
    },

    async consume(nonce: string): Promise<boolean> {
      cleanup();
      if (!nonces.has(nonce)) return false;
      const expiry = nonces.get(nonce)!;
      nonces.delete(nonce);
      return expiry >= Date.now();
    },
  };
}

// ─── Redis ────────────────────────────────────────────────────────────

/**
 * Minimal subset of the ioredis / node-redis API used by the nonce store.
 * Both ioredis and node-redis v4 (with legacyMode or the `.set()` overload)
 * satisfy this interface out of the box.
 */
export interface RedisLikeClient {
  set(...args: unknown[]): Promise<unknown>;
  del(...args: unknown[]): Promise<number>;
}

/**
 * Redis-backed nonce store.
 *
 * Uses `SET key 1 PX ttl NX` for atomic issue (fails if key exists) and
 * `DEL key` for atomic consume (returns 1 only on first delete).
 *
 * @param redis   An ioredis instance or any client matching `RedisLikeClient`.
 * @param prefix  Optional key prefix (default `"siwa:nonce:"`).
 *
 * @example
 * ```ts
 * // ioredis
 * import Redis from "ioredis";
 * const redis = new Redis();
 * const nonceStore = createRedisSIWANonceStore(redis);
 *
 * // node-redis v4 — wrap with a tiny adapter:
 * import { createClient } from "redis";
 * const client = createClient(); await client.connect();
 * const nonceStore = createRedisSIWANonceStore({
 *   set: (...a: unknown[]) => client.set(a[0] as string, a[1] as string,
 *     { PX: a[3] as number, NX: true }).then(r => r ?? null),
 *   del: (k: unknown) => client.del(k as string),
 * });
 * ```
 */
export function createRedisSIWANonceStore(
  redis: RedisLikeClient,
  prefix = 'siwa:nonce:',
): SIWANonceStore {
  return {
    async issue(nonce, ttlMs) {
      // SET key "1" PX ttlMs NX → "OK" if the key was set, null otherwise
      const result = await redis.set(prefix + nonce, '1', 'PX', ttlMs, 'NX');
      return result === 'OK';
    },
    async consume(nonce) {
      // DEL returns the number of keys removed (1 = existed, 0 = didn't)
      const deleted = await redis.del(prefix + nonce);
      return deleted === 1;
    },
  };
}

// ─── Cloudflare Workers KV ────────────────────────────────────────────

/**
 * Minimal subset of the Cloudflare KV namespace binding API.
 */
export interface KVNamespaceLike {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

/**
 * Cloudflare Workers KV-backed nonce store.
 *
 * `issue` uses `put` with an `expirationTtl` so nonces auto-expire.
 * `consume` does a `get` + `delete` pair — not fully atomic, but acceptable
 * for random 128-bit nonces where collisions are astronomically unlikely.
 *
 * @param kv      A KV namespace binding (e.g. `env.SIWA_NONCES`).
 * @param prefix  Optional key prefix (default `"siwa:nonce:"`).
 *
 * @example
 * ```ts
 * // In a Cloudflare Worker
 * export default {
 *   async fetch(request, env) {
 *     const nonceStore = createKVSIWANonceStore(env.SIWA_NONCES);
 *     // use with createSIWANonce / verifySIWA
 *   },
 * };
 * ```
 */
export function createKVSIWANonceStore(
  kv: KVNamespaceLike,
  prefix = 'siwa:nonce:',
): SIWANonceStore {
  return {
    async issue(nonce, ttlMs) {
      const key = prefix + nonce;
      // Check-before-write: KV put is unconditional, so read first
      const existing = await kv.get(key);
      if (existing !== null) return false;
      await kv.put(key, '1', { expirationTtl: Math.ceil(ttlMs / 1000) });
      return true;
    },
    async consume(nonce) {
      const key = prefix + nonce;
      const value = await kv.get(key);
      if (value === null) return false;
      await kv.delete(key);
      return true;
    },
  };
}

