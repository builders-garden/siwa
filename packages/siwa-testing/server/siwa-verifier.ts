import { ethers } from 'ethers';
import { parseSIWAMessage } from '@buildersgarden/siwa/siwa';

export interface SIWAVerifyResult {
  valid: boolean;
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  verified: 'offline' | 'onchain';
  error?: string;
}

export async function verifySIWARequest(
  message: string,
  signature: string,
  domain: string,
  nonceValidator: (nonce: string) => boolean,
  provider?: ethers.Provider | null
): Promise<SIWAVerifyResult> {
  try {
    // 1. Parse the SIWA message
    const fields = parseSIWAMessage(message);

    // 2. Recover signer from EIP-191 signature
    const recovered = ethers.verifyMessage(message, signature);

    // 3. Check recovered address matches message address
    if (recovered.toLowerCase() !== fields.address.toLowerCase()) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        error: 'Recovered address does not match message address',
      };
    }

    // 4. Validate domain matches expected domain
    if (fields.domain !== domain) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        error: `Domain mismatch: expected ${domain}, got ${fields.domain}`,
      };
    }

    // 5. Validate nonce
    if (!nonceValidator(fields.nonce)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
        error: 'Invalid or consumed nonce',
      };
    }

    // 6. Check time window
    const now = new Date();
    if (fields.expirationTime && now > new Date(fields.expirationTime)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: 'offline',
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
        error: 'Message not yet valid (notBefore)',
      };
    }

    // 7. Onchain verification (live mode only)
    if (provider) {
      const registryParts = fields.agentRegistry.split(':');
      if (registryParts.length !== 3 || registryParts[0] !== 'eip155') {
        return {
          valid: false,
          address: recovered,
          agentId: fields.agentId,
          agentRegistry: fields.agentRegistry,
          chainId: fields.chainId,
          verified: 'onchain',
          error: 'Invalid agentRegistry format',
        };
      }
      const registryAddress = registryParts[2];

      const registry = new ethers.Contract(
        registryAddress,
        ['function ownerOf(uint256) view returns (address)'],
        provider
      );
      const owner = await registry.ownerOf(fields.agentId);

      if (owner.toLowerCase() !== recovered.toLowerCase()) {
        // ERC-1271 fallback for smart contract wallets / EIP-7702 delegated accounts.
        // If ecrecover doesn't match the NFT owner, the owner may be a contract
        // that validates signatures via isValidSignature (ERC-1271).
        const messageHash = ethers.hashMessage(message);
        try {
          const ownerContract = new ethers.Contract(
            owner,
            ['function isValidSignature(bytes32, bytes) view returns (bytes4)'],
            provider
          );
          const magicValue = await ownerContract.isValidSignature(messageHash, signature);
          // ERC-1271 magic value: 0x1626ba7e
          if (magicValue !== '0x1626ba7e') {
            return {
              valid: false,
              address: recovered,
              agentId: fields.agentId,
              agentRegistry: fields.agentRegistry,
              chainId: fields.chainId,
              verified: 'onchain',
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
      error: err.message || 'Verification failed',
    };
  }
}
