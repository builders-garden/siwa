/**
 * tba.ts
 *
 * ERC-6551 Token Bound Account address computation utilities.
 *
 * Pure math — no RPC calls. Useful for platforms that want to verify
 * a signer is specifically a TBA derived from a given agent NFT.
 *
 * The ERC-6551 registry deploys a modified ERC-1167 minimal proxy with
 * immutable data (salt, chainId, tokenContract, tokenId) appended.
 * The CREATE2 address is deterministic from these inputs.
 */

import {
  type Address,
  type Hex,
  encodePacked,
  getContractAddress,
  keccak256,
  pad,
} from 'viem';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical ERC-6551 registry address, deployed across all EVM chains. */
export const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758' as const;

/**
 * ERC-1167 modified proxy init code prefix + proxy runtime header (20 bytes).
 *
 * Breakdown:
 *   3d60ad80600a3d3981f3  — init code (10 bytes): deploys 0xad bytes of runtime
 *   363d3d373d3d3d363d73  — proxy runtime header (10 bytes): delegatecall setup
 */
const ERC1167_HEADER: Hex = '0x3d60ad80600a3d3981f3363d3d373d3d3d363d73';

/** ERC-1167 proxy runtime footer (15 bytes): delegatecall + return/revert. */
const ERC1167_FOOTER: Hex = '0x5af43d82803e903d91602b57fd5bf3';

/** Default salt (bytes32 zero). */
const DEFAULT_SALT: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Address computation
// ---------------------------------------------------------------------------

/**
 * Compute the deterministic ERC-6551 Token Bound Account address for an NFT.
 *
 * Pure math — no RPC call needed. Given the same inputs, the address is
 * the same whether or not the account is deployed.
 *
 * Mirrors the on-chain `ERC6551Registry.account()` function exactly.
 *
 * @example
 * ```typescript
 * import { computeTbaAddress } from '@buildersgarden/siwa/tba';
 *
 * const tba = computeTbaAddress({
 *   implementation: '0x...TBAImpl',
 *   tokenContract: '0x...AgentRegistry',
 *   tokenId: 42n,
 *   chainId: 84532,
 * });
 * ```
 */
export function computeTbaAddress(params: {
  /** TBA implementation contract address. */
  implementation: Address;
  /** NFT contract address. */
  tokenContract: Address;
  /** NFT token ID. */
  tokenId: bigint;
  /** Chain ID where the NFT lives. */
  chainId: number;
  /** Registry address (defaults to canonical ERC-6551 registry). */
  registry?: Address;
  /** CREATE2 salt (defaults to bytes32(0)). */
  salt?: Hex;
}): Address {
  const {
    implementation,
    tokenContract,
    tokenId,
    chainId,
    registry = ERC6551_REGISTRY,
    salt = DEFAULT_SALT,
  } = params;

  // Build the 183-byte creation code (init code) matching ERC6551Registry.sol
  //
  // Layout:
  //   [20 bytes] ERC1167_HEADER (init prefix + proxy header)
  //   [20 bytes] implementation address
  //   [15 bytes] ERC1167_FOOTER (proxy footer)
  //   [32 bytes] salt
  //   [32 bytes] chainId
  //   [32 bytes] tokenContract (address as uint256, left-padded)
  //   [32 bytes] tokenId
  const creationCode = encodePacked(
    ['bytes', 'address', 'bytes', 'bytes32', 'uint256', 'uint256', 'uint256'],
    [
      ERC1167_HEADER,
      implementation,
      ERC1167_FOOTER,
      salt,
      BigInt(chainId),
      BigInt(tokenContract),
      tokenId,
    ],
  );

  return getContractAddress({
    bytecode: creationCode,
    from: registry,
    opcode: 'CREATE2',
    salt,
  });
}

// ---------------------------------------------------------------------------
// Agent-specific helpers
// ---------------------------------------------------------------------------

/**
 * Check if a signer address matches the expected TBA for an agent NFT.
 *
 * Useful for platforms that want to verify the signer is specifically
 * a TBA derived from the agent's registry, not just any smart contract.
 *
 * @example
 * ```typescript
 * import { isTbaForAgent } from '@buildersgarden/siwa/tba';
 *
 * const isValid = isTbaForAgent({
 *   signerAddress: agent.address as Address,
 *   implementation: '0x...TBAImpl',
 *   agentRegistry: '0x...AgentRegistry',
 *   agentId: 42,
 *   chainId: 84532,
 * });
 * ```
 */
export function isTbaForAgent(params: {
  /** The signer address to check. */
  signerAddress: Address;
  /** TBA implementation contract address. */
  implementation: Address;
  /** ERC-8004 agent registry address. */
  agentRegistry: Address;
  /** Agent NFT token ID. */
  agentId: number;
  /** Chain ID. */
  chainId: number;
  /** CREATE2 salt (defaults to bytes32(0)). */
  salt?: Hex;
}): boolean {
  const expected = computeTbaAddress({
    implementation: params.implementation,
    tokenContract: params.agentRegistry,
    tokenId: BigInt(params.agentId),
    chainId: params.chainId,
    salt: params.salt,
  });
  return expected.toLowerCase() === params.signerAddress.toLowerCase();
}
