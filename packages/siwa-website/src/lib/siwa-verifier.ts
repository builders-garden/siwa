import { ethers } from "ethers";
import { parseSIWAMessage } from "@buildersgarden/siwa";

export interface SIWAVerifyResult {
  valid: boolean;
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  verified: "offline" | "onchain";
  error?: string;
}

export async function verifySIWARequest(
  message: string,
  signature: string,
  domain: string,
  nonceValidator: (nonce: string) => boolean
): Promise<SIWAVerifyResult> {
  try {
    const fields = parseSIWAMessage(message);
    const recovered = ethers.verifyMessage(message, signature);

    if (recovered.toLowerCase() !== fields.address.toLowerCase()) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: "offline",
        error: "Recovered address does not match message address",
      };
    }

    if (fields.domain !== domain) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: "offline",
        error: `Domain mismatch: expected ${domain}, got ${fields.domain}`,
      };
    }

    if (!nonceValidator(fields.nonce)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: "offline",
        error: "Invalid or consumed nonce",
      };
    }

    const now = new Date();
    if (fields.expirationTime && now > new Date(fields.expirationTime)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: "offline",
        error: "Message expired",
      };
    }
    if (fields.notBefore && now < new Date(fields.notBefore)) {
      return {
        valid: false,
        address: recovered,
        agentId: fields.agentId,
        agentRegistry: fields.agentRegistry,
        chainId: fields.chainId,
        verified: "offline",
        error: "Message not yet valid (notBefore)",
      };
    }

    return {
      valid: true,
      address: recovered,
      agentId: fields.agentId,
      agentRegistry: fields.agentRegistry,
      chainId: fields.chainId,
      verified: "offline",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return {
      valid: false,
      address: "",
      agentId: 0,
      agentRegistry: "",
      chainId: 0,
      verified: "offline",
      error: message,
    };
  }
}
