import { formatEther, formatUnits } from "viem";

// Cache for 4byte signatures to avoid repeated API calls
const signatureCache = new Map<string, string>();

// Common chain names
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  8453: "Base",
  84532: "Base Sepolia",
  11155111: "Sepolia",
  59141: "Linea Sepolia",
  80002: "Polygon Amoy",
};

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

export async function decodeTransactionData(
  data: string | undefined
): Promise<string> {
  if (!data || data === "0x" || data.length < 10) {
    return "No data";
  }

  const selector = data.slice(0, 10).toLowerCase();

  // Check cache first
  if (signatureCache.has(selector)) {
    return signatureCache.get(selector)!;
  }

  try {
    const response = await fetch(
      `https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`,
      {
        signal: AbortSignal.timeout(3000), // 3 second timeout
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      results?: { text_signature: string }[];
    };

    if (json.results && json.results.length > 0) {
      const signature = json.results[0].text_signature;
      signatureCache.set(selector, signature);
      return signature;
    }
  } catch (err) {
    // Silently fail and return raw hex
    console.log(`[4byte] Failed to decode ${selector}: ${(err as Error).message}`);
  }

  // Fallback: show first 32 bytes of data
  const truncated = data.length > 66 ? `${data.slice(0, 66)}...` : data;
  return `Raw: ${truncated}`;
}

export function formatValue(value: string | undefined): string {
  if (!value || value === "0") {
    return "0 ETH";
  }

  try {
    const wei = BigInt(value);
    const eth = formatEther(wei);

    // Remove trailing zeros after decimal
    const formatted = parseFloat(eth).toString();
    return `${formatted} ETH`;
  } catch {
    return value;
  }
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 10) {
    return address || "Unknown";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatGas(gas: string | undefined): string {
  if (!gas) return "Not specified";

  try {
    const wei = BigInt(gas);
    const gwei = formatUnits(wei, 9);
    return `${parseFloat(gwei).toFixed(2)} Gwei`;
  } catch {
    return gas;
  }
}
