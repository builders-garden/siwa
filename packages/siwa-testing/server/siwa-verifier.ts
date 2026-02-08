import { verifyMessage, hashMessage, type PublicClient, type Address, type Hex } from 'viem';
import { parseSIWAMessage, type SIWAErrorCode } from '@buildersgarden/siwa/siwa';

export interface SIWAVerifyResult {
  valid: boolean;
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  verified: 'offline' | 'onchain';
  code?: SIWAErrorCode;
  error?: string;
}

export async function verifySIWARequest(
  message: string,
  signature: string,
  domain: string,
  nonceValidator: (nonce: string) => boolean,
  client?: PublicClient | null
): Promise<SIWAVerifyResult> {
  try {
    // 1. Parse the SIWA message
    const fields = parseSIWAMessage(message);

    // 2. Verify EIP-191 signature
    const isValidSignature = await verifyMessage({
      address: fields.address as Address,
      message,
      signature: signature as Hex,
    });

    if (!isValidSignature) {
      return {
        valid: false,
        address: fields.address,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        code: 'INVALID_SIGNATURE',
        error: 'Invalid signature',
      };
    }

    const recovered = fields.address;

    // 3. Validate domain matches expected domain
    if (fields.domain !== domain) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        code: 'DOMAIN_MISMATCH',
        error: `Domain mismatch: expected ${domain}, got ${fields.domain}`,
      };
    }

    // 4. Validate nonce
    if (!nonceValidator(fields.nonce)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        code: 'INVALID_NONCE',
        error: 'Invalid or consumed nonce',
      };
    }

    // 5. Check time window
    const now = new Date();
    if (fields.expirationTime && now > new Date(fields.expirationTime)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        code: 'MESSAGE_EXPIRED',
        error: 'Message expired',
      };
    }
    if (fields.notBefore && now < new Date(fields.notBefore)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        code: 'MESSAGE_NOT_YET_VALID',
        error: 'Message not yet valid (notBefore)',
      };
    }

    // 6. Onchain verification (live mode only)
    if (client) {
      const registryParts = fields.agentRegistry.split(':');
      if (registryParts.length !== 3 || registryParts[0] !== 'eip155') {
        return {
          valid: false,
          address: recovered,
          agentId: fields.agentId,
          agentRegistry: fields.agentRegistry,
          chainId: fields.chainId,
          verified: 'onchain',
          code: 'INVALID_REGISTRY_FORMAT',
          error: 'Invalid agentRegistry format',
        };
      }
      const registryAddress = registryParts[2] as Address;

      let owner: string;
      try {
        owner = await client.readContract({
          address: registryAddress,
          abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
          functionName: 'ownerOf',
          args: [BigInt(fields.agentId)],
        }) as string;
      } catch {
        // ownerOf reverts when the token doesn't exist — agent is not registered
        return {
          valid: false,
          address: recovered,
          agentId: fields.agentId,
          agentRegistry: fields.agentRegistry,
          chainId: fields.chainId,
          verified: 'onchain',
          code: 'NOT_REGISTERED',
          error: 'Agent is not registered on the ERC-8004 Identity Registry',
        };
      }

      if (owner.toLowerCase() !== recovered.toLowerCase()) {
        // ERC-1271 fallback for smart contract wallets / EIP-7702 delegated accounts.
        // If ecrecover doesn't match the NFT owner, the owner may be a contract
        // that validates signatures via isValidSignature (ERC-1271).
        const messageHash = hashMessage(message);
        try {
          const magicValue = await client.readContract({
            address: owner as Address,
            abi: [{ name: 'isValidSignature', type: 'function', stateMutability: 'view', inputs: [{ name: 'hash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }], outputs: [{ name: '', type: 'bytes4' }] }] as const,
            functionName: 'isValidSignature',
            args: [messageHash, signature as Hex],
          });
          // ERC-1271 magic value: 0x1626ba7e
          if (magicValue !== '0x1626ba7e') {
            return {
              valid: false,
              address: recovered,
              agentId: fields.agentId,
              agentRegistry: fields.agentRegistry,
              chainId: fields.chainId,
              verified: 'onchain',
              code: 'NOT_OWNER',
              error: 'Signer is not the owner of this agent NFT (ERC-1271 check also failed)',
            };
          }
          // ERC-1271 validated — the owner contract accepted the signature
        } catch {
          // Owner is not a contract or doesn't implement ERC-1271
          return {
            valid: false,
            address: recovered,
            agentId: fields.agentId,
            agentRegistry: fields.agentRegistry,
            chainId: fields.chainId,
            verified: 'onchain',
            code: 'NOT_OWNER',
            error: 'Signer is not the owner of this agent NFT',
          };
        }
      }

      return {
        valid: true,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'onchain',
      };
    }

    // Offline mode — skip onchain check, trust the signature
    return {
      valid: true,
      address: recovered,
      agentId: fields.agentId,
      agentRegistry: fields.agentRegistry,
      chainId: fields.chainId,
      verified: 'offline',
    };
  } catch (err: any) {
    return {
      valid: false,
      address: '',
      agentId: 0,
      agentRegistry: '',
      chainId: 0,
      verified: 'offline',
      code: 'VERIFICATION_FAILED',
      error: err.message || 'Verification failed',
    };
  }
}
