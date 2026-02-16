/**
 * Pure unit tests for SIWA nonce store adapters.
 *
 * Tests all three built-in factories:
 *   1. Memory store — direct (no mocking)
 *   2. Redis store — mock RedisLikeClient
 *   3. KV store — mock KVNamespaceLike
 *
 * Plus the SIWANonceStore interface contract (shared behaviour).
 *
 * No external dependencies required — runs entirely in-process.
 */

import chalk from 'chalk';
import {
  createMemorySIWANonceStore,
  createRedisSIWANonceStore,
  createKVSIWANonceStore,
  type SIWANonceStore,
  type RedisLikeClient,
  type KVNamespaceLike,
} from '@buildersgarden/siwa-ts/nonce-store';

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed++;
  console.log(chalk.green(`  \u2705 ${label}`));
}

function fail(label: string, detail?: string) {
  failed++;
  console.log(chalk.red(`  \u274C ${label}`));
  if (detail) console.log(chalk.dim(`     ${detail}`));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Mock Redis ──────────────────────────────────────────────────────

function createMockRedis(): RedisLikeClient & { store: Map<string, { value: string; expiry: number }> } {
  const store = new Map<string, { value: string; expiry: number }>();

  return {
    store,
    async set(...args: unknown[]): Promise<unknown> {
      const key = args[0] as string;
      const value = args[1] as string;
      let ttlMs: number | undefined;
      let nx = false;

      // Parse ioredis-style args: SET key value PX ttl NX
      for (let i = 2; i < args.length; i++) {
        if (args[i] === 'PX' && i + 1 < args.length) {
          ttlMs = args[++i] as number;
        }
        if (args[i] === 'NX') nx = true;
      }

      // Cleanup expired
      const now = Date.now();
      for (const [k, v] of store) {
        if (v.expiry < now) store.delete(k);
      }

      if (nx && store.has(key)) return null;
      store.set(key, { value, expiry: now + (ttlMs ?? 60_000) });
      return 'OK';
    },
    async del(...args: unknown[]): Promise<number> {
      const key = args[0] as string;
      return store.delete(key) ? 1 : 0;
    },
  };
}

// ─── Mock KV ─────────────────────────────────────────────────────────

function createMockKV(): KVNamespaceLike & { store: Map<string, { value: string; expiry: number }> } {
  const store = new Map<string, { value: string; expiry: number }>();

  function cleanup() {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expiry < now) store.delete(k);
    }
  }

  return {
    store,
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const ttlMs = (options?.expirationTtl ?? 60) * 1000;
      store.set(key, { value, expiry: Date.now() + ttlMs });
    },
    async get(key: string): Promise<string | null> {
      cleanup();
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiry < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

// ─── Shared contract tests ───────────────────────────────────────────

async function testStoreContract(name: string, store: SIWANonceStore) {
  const prefix = `[${name}]`;

  // 1. Issue succeeds for new nonce
  try {
    const ok = await store.issue('nonce-1', 10_000);
    ok ? pass(`${prefix} issue new nonce → true`) : fail(`${prefix} issue new nonce`, 'Expected true');
  } catch (err: any) {
    fail(`${prefix} issue new nonce`, err.message);
  }

  // 2. Issue rejects duplicate nonce
  try {
    const ok = await store.issue('nonce-1', 10_000);
    !ok ? pass(`${prefix} issue duplicate nonce → false`) : fail(`${prefix} issue duplicate nonce`, 'Expected false');
  } catch (err: any) {
    fail(`${prefix} issue duplicate nonce`, err.message);
  }

  // 3. Consume succeeds for issued nonce
  try {
    const ok = await store.consume('nonce-1');
    ok ? pass(`${prefix} consume issued nonce → true`) : fail(`${prefix} consume issued nonce`, 'Expected true');
  } catch (err: any) {
    fail(`${prefix} consume issued nonce`, err.message);
  }

  // 4. Consume fails for already-consumed nonce (single-use)
  try {
    const ok = await store.consume('nonce-1');
    !ok ? pass(`${prefix} consume already-consumed nonce → false`) : fail(`${prefix} consume already-consumed`, 'Expected false');
  } catch (err: any) {
    fail(`${prefix} consume already-consumed nonce`, err.message);
  }

  // 5. Consume fails for unknown nonce
  try {
    const ok = await store.consume('never-issued');
    !ok ? pass(`${prefix} consume unknown nonce → false`) : fail(`${prefix} consume unknown nonce`, 'Expected false');
  } catch (err: any) {
    fail(`${prefix} consume unknown nonce`, err.message);
  }

  // 6. Issue after consume (same nonce can be re-issued)
  try {
    const ok = await store.issue('nonce-1', 10_000);
    ok ? pass(`${prefix} re-issue after consume → true`) : fail(`${prefix} re-issue after consume`, 'Expected true');
  } catch (err: any) {
    fail(`${prefix} re-issue after consume`, err.message);
  }

  // Cleanup: consume to leave store clean
  await store.consume('nonce-1');
}

// ─── Memory-specific tests ───────────────────────────────────────────

async function testMemoryTTL() {
  const store = createMemorySIWANonceStore();

  // Issue with very short TTL (50ms)
  try {
    await store.issue('ttl-nonce', 50);
    // Wait for expiry
    await sleep(100);
    const ok = await store.consume('ttl-nonce');
    !ok
      ? pass('[Memory] expired nonce cannot be consumed')
      : fail('[Memory] expired nonce consumed', 'Expected false after TTL');
  } catch (err: any) {
    fail('[Memory] TTL expiry', err.message);
  }
}

async function testMemoryCleanup() {
  const store = createMemorySIWANonceStore();

  // Issue several nonces with short TTL
  try {
    await store.issue('cleanup-1', 50);
    await store.issue('cleanup-2', 50);
    await store.issue('cleanup-3', 10_000); // this one stays alive
    await sleep(100);

    // Issue triggers cleanup — expired entries should be purged
    // The long-lived nonce should still reject duplicate issue
    const dupOk = await store.issue('cleanup-3', 10_000);
    !dupOk
      ? pass('[Memory] cleanup preserves live nonces')
      : fail('[Memory] cleanup preserves live nonces', 'Expected false for duplicate');

    // Expired nonces should now be consumable as new (re-issue)
    const reissue = await store.issue('cleanup-1', 10_000);
    reissue
      ? pass('[Memory] cleanup removes expired nonces')
      : fail('[Memory] cleanup removes expired nonces', 'Expected true for re-issue');
  } catch (err: any) {
    fail('[Memory] cleanup', err.message);
  }
}

// ─── Redis-specific tests ────────────────────────────────────────────

async function testRedisKeyPrefix() {
  const redis = createMockRedis();
  const store = createRedisSIWANonceStore(redis, 'custom:');

  try {
    await store.issue('abc', 10_000);
    const hasKey = redis.store.has('custom:abc');
    hasKey
      ? pass('[Redis] custom prefix applied to keys')
      : fail('[Redis] custom prefix', 'Key "custom:abc" not found in store');
  } catch (err: any) {
    fail('[Redis] custom prefix', err.message);
  }
}

async function testRedisDefaultPrefix() {
  const redis = createMockRedis();
  const store = createRedisSIWANonceStore(redis);

  try {
    await store.issue('xyz', 10_000);
    const hasKey = redis.store.has('siwa:nonce:xyz');
    hasKey
      ? pass('[Redis] default prefix "siwa:nonce:" applied')
      : fail('[Redis] default prefix', 'Key "siwa:nonce:xyz" not found');
  } catch (err: any) {
    fail('[Redis] default prefix', err.message);
  }
}

async function testRedisTTLExpiry() {
  const redis = createMockRedis();
  const store = createRedisSIWANonceStore(redis);

  try {
    await store.issue('ttl-redis', 50);
    await sleep(100);
    // Mock redis cleans up expired on set; but DEL on an expired key should still return 0
    // because mock cleans on set. Let's trigger cleanup via a new set.
    await store.issue('trigger-cleanup', 10_000);
    const ok = await store.consume('ttl-redis');
    !ok
      ? pass('[Redis] expired nonce rejected (mock TTL)')
      : fail('[Redis] expired nonce consumed', 'Expected false');
  } catch (err: any) {
    fail('[Redis] TTL expiry', err.message);
  }
}

// ─── KV-specific tests ──────────────────────────────────────────────

async function testKVKeyPrefix() {
  const kv = createMockKV();
  const store = createKVSIWANonceStore(kv, 'myapp:');

  try {
    await store.issue('def', 10_000);
    const hasKey = kv.store.has('myapp:def');
    hasKey
      ? pass('[KV] custom prefix applied to keys')
      : fail('[KV] custom prefix', 'Key "myapp:def" not found');
  } catch (err: any) {
    fail('[KV] custom prefix', err.message);
  }
}

async function testKVDefaultPrefix() {
  const kv = createMockKV();
  const store = createKVSIWANonceStore(kv);

  try {
    await store.issue('ghi', 10_000);
    const hasKey = kv.store.has('siwa:nonce:ghi');
    hasKey
      ? pass('[KV] default prefix "siwa:nonce:" applied')
      : fail('[KV] default prefix', 'Key "siwa:nonce:ghi" not found');
  } catch (err: any) {
    fail('[KV] default prefix', err.message);
  }
}

async function testKVTTLExpiry() {
  const kv = createMockKV();
  const store = createKVSIWANonceStore(kv);

  // KV expirationTtl has 1-second granularity (Math.ceil(ttlMs / 1000))
  // so use 1000ms TTL (= 1s in KV) and sleep just over 1s
  try {
    await store.issue('ttl-kv', 1000);
    await sleep(1100);
    const ok = await store.consume('ttl-kv');
    !ok
      ? pass('[KV] expired nonce rejected (1s TTL)')
      : fail('[KV] expired nonce consumed', 'Expected false after 1s expiry');
  } catch (err: any) {
    fail('[KV] TTL expiry', err.message);
  }
}

// ─── Multiple independent nonces ─────────────────────────────────────

async function testMultipleNonces() {
  const store = createMemorySIWANonceStore();

  try {
    await store.issue('a', 10_000);
    await store.issue('b', 10_000);
    await store.issue('c', 10_000);

    // Consume out of order
    const okB = await store.consume('b');
    const okA = await store.consume('a');
    const okC = await store.consume('c');

    okA && okB && okC
      ? pass('[Memory] multiple nonces consumed independently')
      : fail('[Memory] multiple nonces', `a=${okA} b=${okB} c=${okC}`);
  } catch (err: any) {
    fail('[Memory] multiple nonces', err.message);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────

export async function testNonceStoreFlow(): Promise<boolean> {
  console.log(chalk.bold('Nonce Store Tests'));
  console.log('\u2500'.repeat(40));

  // ── Memory adapter ──
  console.log(chalk.cyan('\n  Memory adapter'));
  const memoryStore = createMemorySIWANonceStore();
  await testStoreContract('Memory', memoryStore);
  await testMemoryTTL();
  await testMemoryCleanup();
  await testMultipleNonces();

  // ── Redis adapter (mocked) ──
  console.log(chalk.cyan('\n  Redis adapter (mocked)'));
  const redis = createMockRedis();
  const redisStore = createRedisSIWANonceStore(redis);
  await testStoreContract('Redis', redisStore);
  await testRedisKeyPrefix();
  await testRedisDefaultPrefix();
  await testRedisTTLExpiry();

  // ── KV adapter (mocked) ──
  console.log(chalk.cyan('\n  KV adapter (mocked)'));
  const kv = createMockKV();
  const kvStore = createKVSIWANonceStore(kv);
  await testStoreContract('KV', kvStore);
  await testKVKeyPrefix();
  await testKVDefaultPrefix();
  await testKVTTLExpiry();

  // ── Summary ──
  console.log('');
  console.log('\u2500'.repeat(40));
  const total = passed + failed;
  if (failed === 0) {
    console.log(chalk.green.bold(`  All ${total} nonce store tests passed!`));
  } else {
    console.log(chalk.red.bold(`  ${failed}/${total} tests failed`));
  }
  console.log('');

  return failed === 0;
}
