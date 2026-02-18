import { createClientResolver, parseChainId } from "@buildersgarden/siwa/client-resolver";
import { createMemorySIWANonceStore } from "@buildersgarden/siwa";

const resolver = createClientResolver();

/** Re-export parseChainId from the SDK. */
export { parseChainId };

/** Get (or lazily create) a PublicClient for the given chain ID. */
export const getClient = (chainId: number) => resolver.getClient(chainId);

/** Singleton nonce store — shared across all chains (nonces are random, no collision risk). */
export const nonceStore = createMemorySIWANonceStore();
