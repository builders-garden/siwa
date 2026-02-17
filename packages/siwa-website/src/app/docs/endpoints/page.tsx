import { Metadata } from "next";
import { EndpointsSidebar } from "@/components/endpoints-sidebar";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = {
  title: "API Endpoints — SIWA",
  description:
    "Live SIWA server endpoints you can call to run the full Sign In With Agent authentication flow.",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 pb-16">
      <h2 className="font-mono text-xl font-semibold text-foreground mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-20 mt-8">
      <h3 className="font-mono text-base font-semibold text-foreground mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted mb-4">{children}</p>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">
      {children}
    </code>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const color =
    method === "GET"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-blue-500/10 text-blue-400 border-blue-500/20";
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 font-mono text-xs font-semibold ${color}`}
    >
      {method}
    </span>
  );
}

function EndpointHeader({
  method,
  path,
  auth,
  paid,
}: {
  method: "GET" | "POST";
  path: string;
  auth?: boolean;
  paid?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <MethodBadge method={method} />
      <code className="font-mono text-sm text-foreground">{path}</code>
      {auth && (
        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs text-amber-400">
          ERC-8128 signed
        </span>
      )}
      {paid && (
        <span className="rounded border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono text-xs text-violet-400">
          x402 paid
        </span>
      )}
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th
                key={h}
                className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-muted font-mono text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EndpointsPage() {
  return (
    <div className="mx-auto flex max-w-6xl px-6 py-12">
      <EndpointsSidebar />

      <article className="min-w-0 flex-1 pl-0 md:pl-12">
        <h1 className="font-mono text-2xl font-bold text-foreground mb-2">
          API Endpoints
        </h1>
        <p className="text-sm text-dim mb-8">
          SIWA Server — HTTP endpoints for the full authentication flow
        </p>

        <div className="mb-12 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-mono font-semibold text-emerald-400">Live</span>{" "}
            — These endpoints are running on this website right now. You can call them directly from your terminal or agent to try the full SIWA authentication flow. No setup required.
          </p>
        </div>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <P>
            The SIWA server implements a challenge-response authentication flow. An agent requests a nonce, signs a structured message, and submits it for verification. On success, the server returns a verification receipt. The agent then uses ERC-8128 HTTP Message Signatures with the receipt for subsequent authenticated requests.
          </P>

          <SubSection id="base-url" title="Base URL">
            <CodeBlock language="text">{`https://siwa.id`}</CodeBlock>
            <P>
              All endpoints accept and return <InlineCode>application/json</InlineCode>. CORS is enabled for all origins. You can also run a local instance with the{" "}
              <a
                href="https://github.com/builders-garden/siwa"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                siwa-testing
              </a>{" "}
              package.
            </P>
          </SubSection>

          <SubSection id="networks" title="Networks">
            <P>
              The server supports both testnet and mainnet. Use the appropriate endpoint prefix for your target network:
            </P>
            <Table
              headers={["Network", "Chain ID", "Endpoint Prefix"]}
              rows={[
                ["Base Sepolia (testnet)", "84532", "/api/siwa/*"],
                ["Base (mainnet)", "8453", "/api/siwa/mainnet/*"],
              ]}
            />
            <P>
              For example, to authenticate on mainnet, use <InlineCode>/api/siwa/mainnet/nonce</InlineCode> and <InlineCode>/api/siwa/mainnet/verify</InlineCode>.
            </P>
          </SubSection>

          <SubSection id="address-formats" title="Address Formats">
            <P>
              SIWA follows EVM address standards:
            </P>
            <ul className="space-y-2 mb-4 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Wallet addresses</strong> — Must be <a href="https://eips.ethereum.org/EIPS/eip-55" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">EIP-55</a> checksummed (mixed-case), e.g. <InlineCode>0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0</InlineCode></span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Agent Registry</strong> — Uses <a href="https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-10.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">CAIP-10</a> format: <InlineCode>eip155:{"{chainId}"}:{"{address}"}</InlineCode></span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Chain IDs</strong> — Numeric identifiers per <a href="https://eips.ethereum.org/EIPS/eip-155" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">EIP-155</a> (e.g. 8453 for Base, 84532 for Base Sepolia)</span>
              </li>
            </ul>
          </SubSection>

          <SubSection id="auth-flow" title="Authentication Flow">
            <div className="rounded-lg border border-border bg-surface p-5 mb-4">
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">1.</span>
                  <div>
                    <span className="text-foreground">Agent</span>
                    <span className="text-dim mx-2">&rarr;</span>
                    <span className="inline-block rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-400 mr-2">POST</span>
                    <span className="text-muted">/api/siwa/nonce</span>
                    <span className="text-dim mx-2">&rarr;</span>
                    <span className="text-foreground">Server returns nonce + timestamps</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">2.</span>
                  <div>
                    <span className="text-foreground">Agent builds SIWA message and signs via EIP-191</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">3.</span>
                  <div>
                    <span className="text-foreground">Agent</span>
                    <span className="text-dim mx-2">&rarr;</span>
                    <span className="inline-block rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-400 mr-2">POST</span>
                    <span className="text-muted">/api/siwa/verify</span>
                    <span className="text-dim mx-2">&rarr;</span>
                    <span className="text-foreground">Server returns verification receipt</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">4.</span>
                  <div>
                    <span className="text-foreground">Agent uses</span>
                    <span className="mx-1 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">ERC-8128 signature + receipt</span>
                    <span className="text-foreground">for protected endpoints</span>
                  </div>
                </div>
              </div>
            </div>
          </SubSection>

        </Section>

        {/* Authentication Endpoints */}
        <Section id="authentication" title="Authentication Endpoints">
          <SubSection id="post-siwa-nonce" title="Request Nonce">
            <EndpointHeader method="POST" path="/api/siwa/nonce" />
            <EndpointHeader method="POST" path="/api/siwa/mainnet/nonce" />
            <P>
              Request a cryptographic nonce to include in the SIWA message. Nonces are single-use and expire after 5 minutes. Use <InlineCode>/api/siwa/nonce</InlineCode> for Base Sepolia (testnet) or <InlineCode>/api/siwa/mainnet/nonce</InlineCode> for Base (mainnet).
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Request Body</h4>
            <Table
              headers={["Field", "Type", "Required", "Description"]}
              rows={[
                ["address", "string", "Yes", "Agent wallet address (EIP-55 checksummed, mixed-case)"],
                ["agentId", "number", "No", "ERC-8004 agent token ID (numeric)"],
                ["agentRegistry", "string", "No", "CAIP-10 registry reference (eip155:{chainId}:{address})"],
              ]}
            />
            <P>
              The <InlineCode>agentRegistry</InlineCode> uses{" "}
              <a href="https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-10.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">CAIP-10</a>{" "}
              format: <InlineCode>eip155:{"{chainId}"}:{"{contractAddress}"}</InlineCode>. For Base Sepolia: <InlineCode>eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e</InlineCode>. For Base mainnet: <InlineCode>eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432</InlineCode>.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Response 200</h4>
            <CodeBlock language="json">{`{
  "nonce": "a1b2c3d4e5f6g7h8",
  "nonceToken": "eyJub25jZSI6ImExYjJj...",
  "issuedAt": "2026-02-05T12:00:00.000Z",
  "expirationTime": "2026-02-05T12:05:00.000Z",
  "domain": "siwa.id",
  "uri": "https://siwa.id/api/siwa/verify",
  "chainId": 84532
}`}</CodeBlock>
            <P>
              The <InlineCode>nonceToken</InlineCode> is an HMAC-signed token that binds the nonce to the server. You must pass it back in the verify request.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 400</h4>
            <CodeBlock language="json">{`{ "error": "Missing address" }`}</CodeBlock>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 403</h4>
            <CodeBlock language="json">{`{
  "status": "not_registered",
  "code": "NOT_REGISTERED",
  "error": "Agent is not registered onchain"
}`}</CodeBlock>
          </SubSection>

          <SubSection id="post-siwa-verify" title="Verify Signature">
            <EndpointHeader method="POST" path="/api/siwa/verify" />
            <EndpointHeader method="POST" path="/api/siwa/mainnet/verify" />
            <P>
              Submit the signed SIWA message for verification. On success, the server validates the signature, checks nonce freshness, verifies domain binding, and returns a verification receipt (30 minute default expiry). Use <InlineCode>/api/siwa/verify</InlineCode> for Base Sepolia (testnet) or <InlineCode>/api/siwa/mainnet/verify</InlineCode> for Base (mainnet).
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Request Body</h4>
            <Table
              headers={["Field", "Type", "Required", "Description"]}
              rows={[
                ["message", "string", "Yes", "Full SIWA message (plaintext)"],
                ["signature", "string", "Yes", "EIP-191 signature (hex, 0x-prefixed)"],
                ["nonceToken", "string", "Yes", "HMAC nonce token from the /nonce response"],
              ]}
            />

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Response 200</h4>
            <CodeBlock language="json">{`{
  "status": "authenticated",
  "receipt": "eyJhZGRyZXNzIjoiMHg3NDJk...",
  "receiptExpiresAt": "2026-02-05T12:30:00.000Z",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "agentId": 42,
  "agentRegistry": "eip155:84532:0x8004A818...",
  "signerType": "eoa",
  "verified": "onchain"
}`}</CodeBlock>
            <P>
              The <InlineCode>verified</InlineCode> field indicates the verification mode:{" "}
              <InlineCode>offline</InlineCode> (signature only) or{" "}
              <InlineCode>onchain</InlineCode> (signature + ERC-721 ownership check via RPC).
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 400</h4>
            <CodeBlock language="json">{`{
  "status": "rejected",
  "code": "VERIFICATION_FAILED",
  "error": "Missing message or signature"
}`}</CodeBlock>
            <CodeBlock language="json">{`{
  "status": "rejected",
  "code": "INVALID_NONCE",
  "error": "Missing nonceToken"
}`}</CodeBlock>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 401</h4>
            <CodeBlock language="json">{`{
  "status": "rejected",
  "code": "VERIFICATION_FAILED",
  "error": "Signature mismatch"
}`}</CodeBlock>
            <P>
              Other possible errors: <InlineCode>INVALID_NONCE</InlineCode>,{" "}
              <InlineCode>MESSAGE_EXPIRED</InlineCode>,{" "}
              <InlineCode>DOMAIN_MISMATCH</InlineCode>.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 403</h4>
            <CodeBlock language="json">{`{
  "status": "not_registered",
  "code": "NOT_REGISTERED",
  "error": "Signer does not own agent NFT"
}`}</CodeBlock>
          </SubSection>
        </Section>

        {/* Protected Endpoints */}
        <Section id="protected" title="Protected Endpoints">
          <P>
            These endpoints require ERC-8128 HTTP Message Signatures with a valid verification receipt.
            Get a receipt by completing the nonce + verify flow above, then sign requests using <InlineCode>signAuthenticatedRequest()</InlineCode>.
          </P>
          <CodeBlock language="text">{`X-SIWA-Receipt: <receipt>
Signature: eth=:<base64-signature>:
Signature-Input: eth=(...);keyid="erc8128:<chainId>:<address>";...
Content-Digest: sha-256=:<base64-hash>:  (for POST requests)`}</CodeBlock>

          <SubSection id="get-api-protected" title="Test Auth">
            <EndpointHeader method="GET" path="/api/protected" auth />
            <P>
              Simple endpoint to verify your session is working. Returns the authenticated agent&apos;s identity.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Response 200</h4>
            <CodeBlock language="json">{`{
  "message": "Hello Agent #42!",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "agentId": 42,
  "timestamp": "2026-02-05T12:01:00.000Z"
}`}</CodeBlock>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 401</h4>
            <CodeBlock language="json">{`{ "error": "Unauthorized" }`}</CodeBlock>
          </SubSection>

          <SubSection id="post-api-agent-action" title="Agent Action">
            <EndpointHeader method="POST" path="/api/agent-action" auth />
            <P>
              Submit an action as an authenticated agent. The server echoes the request and identifies the agent.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Request Body</h4>
            <Table
              headers={["Field", "Type", "Required", "Description"]}
              rows={[
                ["action", "string", "Yes", "Action identifier"],
                ["data", "object", "No", "Arbitrary action payload"],
              ]}
            />

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Response 200</h4>
            <CodeBlock language="json">{`{
  "received": {
    "action": "transfer",
    "data": { "to": "0xabc...", "amount": "1.0" }
  },
  "processedBy": "siwa-server",
  "agent": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "agentId": 42
  },
  "timestamp": "2026-02-05T12:02:00.000Z"
}`}</CodeBlock>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 401</h4>
            <CodeBlock language="json">{`{ "error": "Unauthorized" }`}</CodeBlock>
          </SubSection>
        </Section>

        {/* x402 Paid Endpoints */}
        <Section id="x402" title="x402 Paid Endpoints">
          <P>
            These endpoints require both SIWA authentication <strong className="text-foreground">and</strong> an{" "}
            <a
              href="https://www.x402.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              x402 payment
            </a>.
            The server enforces a two-gate flow: first SIWA auth (returns 401 if invalid), then x402 payment (returns 402 if missing or invalid).
            Payments are settled on-chain via a Coinbase CDP facilitator.
            For server-side setup, middleware integration, agent-side handling, and session configuration, see the{" "}
            <a
              href="/docs#x402"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              x402 Payments documentation
            </a>.
          </P>

          <SubSection id="x402-payment-flow" title="Payment Flow">
            <div className="rounded-lg border border-border bg-surface p-5 mb-4">
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">1.</span>
                  <div>
                    <span className="text-foreground">Agent sends request with</span>
                    <span className="mx-1 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">ERC-8128 + receipt</span>
                    <span className="text-dim mx-2">&rarr;</span>
                    <span className="text-foreground">SIWA gate passes</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">2.</span>
                  <div>
                    <span className="text-foreground">No</span>
                    <span className="mx-1 rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-400">Payment-Signature</span>
                    <span className="text-foreground">header</span>
                    <span className="text-dim mx-2">&rarr;</span>
                    <span className="text-foreground">Server returns</span>
                    <span className="mx-1 rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-xs text-red-400">402</span>
                    <span className="text-foreground">with</span>
                    <span className="mx-1"><InlineCode>Payment-Required</InlineCode></span>
                    <span className="text-foreground">header</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">3.</span>
                  <div>
                    <span className="text-foreground">Agent signs payment and retries with</span>
                    <span className="mx-1"><InlineCode>Payment-Signature</InlineCode></span>
                    <span className="text-foreground">header</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-accent font-semibold shrink-0">4.</span>
                  <div>
                    <span className="text-foreground">Server verifies + settles via facilitator</span>
                    <span className="text-dim mx-2">&rarr;</span>
                    <span className="text-foreground">Returns data +</span>
                    <span className="mx-1"><InlineCode>Payment-Response</InlineCode></span>
                    <span className="text-foreground">header with txHash</span>
                  </div>
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection id="x402-headers" title="x402 Headers">
            <Table
              headers={["Header", "Direction", "Description"]}
              rows={[
                ["Payment-Required", "Response (402)", "Base64 JSON with accepted payment options and resource info"],
                ["Payment-Signature", "Request", "Base64 JSON with signed payment payload"],
                ["Payment-Response", "Response (200)", "Base64 JSON with settlement details (txHash, amount, network)"],
              ]}
            />
            <P>
              The <InlineCode>Payment-Required</InlineCode> header is base64-encoded JSON containing the <InlineCode>accepts</InlineCode> array (payment options) and <InlineCode>resource</InlineCode> info. Decode it to build your payment:
            </P>
            <CodeBlock language="json">{`{
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "10000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xffddB7C78D466f7d55C879c56EB8BF4c66400ab5",
    "maxTimeoutSeconds": 60
  }],
  "resource": {
    "url": "/api/x402/weather",
    "description": "Premium weather data"
  }
}`}</CodeBlock>
          </SubSection>

          <SubSection id="x402-payment-config" title="Payment Configuration">
            <div className="rounded-lg border border-border bg-surface p-5 mb-4">
              <Table
                headers={["Field", "Value"]}
                rows={[
                  ["Network", "Base Sepolia (eip155:84532)"],
                  ["Asset", "USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e)"],
                  ["Amount", "0.01 USDC (10000 units, 6 decimals)"],
                  ["Pay To", "0xffddB7C78D466f7d55C879c56EB8BF4c66400ab5"],
                  ["Facilitator", "https://api.cdp.coinbase.com/platform/v2/x402"],
                ]}
              />
            </div>
          </SubSection>

          <SubSection id="get-x402-weather" title="Weather (Per-Request)">
            <EndpointHeader method="GET" path="/api/x402/weather" auth paid />
            <P>
              Premium weather data endpoint. Requires a <strong className="text-foreground">new payment on every request</strong> (no session caching). This demonstrates the basic x402 per-request payment model.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Response 200</h4>
            <CodeBlock language="json">{`{
  "agent": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "agentId": 42
  },
  "payment": {
    "txHash": "0xabc123...",
    "amount": "10000",
    "network": "eip155:84532"
  },
  "weather": {
    "location": "Base Sepolia Testnet City",
    "temperature": 21,
    "unit": "celsius",
    "conditions": "Sunny with a chance of blocks",
    "humidity": 55,
    "wind": { "speed": 12, "direction": "NE", "unit": "km/h" },
    "forecast": [
      { "day": "Tomorrow", "high": 23, "low": 15, "conditions": "Partly cloudy" },
      { "day": "Day after", "high": 19, "low": 12, "conditions": "Light rain" }
    ]
  },
  "timestamp": "2026-02-17T12:00:00.000Z"
}`}</CodeBlock>
            <P>
              The response includes a <InlineCode>Payment-Response</InlineCode> header with the on-chain settlement details.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 401</h4>
            <CodeBlock language="json">{`{ "error": "Missing or invalid SIWA receipt" }`}</CodeBlock>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Error 402</h4>
            <P>Returned when no <InlineCode>Payment-Signature</InlineCode> header is present, or when payment verification/settlement fails:</P>
            <CodeBlock language="json">{`{
  "error": "Payment required",
  "accepts": [{ "scheme": "exact", "network": "eip155:84532", "amount": "10000", "..." }],
  "resource": { "url": "/api/x402/weather", "description": "Premium weather data" }
}`}</CodeBlock>
          </SubSection>

          <SubSection id="get-x402-analytics" title="Analytics (Pay-Once Session)">
            <EndpointHeader method="GET" path="/api/x402/analytics" auth paid />
            <EndpointHeader method="POST" path="/api/x402/analytics" auth paid />
            <P>
              Agent analytics dashboard with <strong className="text-foreground">pay-once session</strong> mode.
              The first request requires payment. After payment succeeds, a session is created for the agent and resource.
              Subsequent requests within the session TTL (1 hour) skip payment automatically.
              Both GET and POST share the same session.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">GET Response 200</h4>
            <CodeBlock language="json">{`{
  "agent": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "agentId": 42
  },
  "sessionActive": false,
  "payment": {
    "txHash": "0xabc123...",
    "amount": "10000",
    "network": "eip155:84532"
  },
  "analytics": {
    "totalRequests": 7421,
    "uniqueAgents": 312,
    "avgResponseTime": "45.2ms",
    "topEndpoints": [
      { "path": "/api/protected", "calls": 4821 },
      { "path": "/api/agent-action", "calls": 3102 },
      { "path": "/api/x402/weather", "calls": 1547 }
    ],
    "period": "last_24h"
  },
  "timestamp": "2026-02-17T12:00:00.000Z"
}`}</CodeBlock>
            <P>
              When <InlineCode>sessionActive</InlineCode> is <InlineCode>true</InlineCode>, the request was served from an existing session (no new payment).
              When <InlineCode>false</InlineCode>, a fresh payment was processed and <InlineCode>payment</InlineCode> contains the settlement details.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">POST Request Body</h4>
            <Table
              headers={["Field", "Type", "Required", "Description"]}
              rows={[
                ["event", "string", "Yes", "Event name"],
                ["data", "object", "No", "Arbitrary event payload"],
              ]}
            />

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">POST Response 200</h4>
            <CodeBlock language="json">{`{
  "agent": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "agentId": 42
  },
  "sessionActive": true,
  "received": { "event": "page_view", "data": { "path": "/dashboard" } },
  "status": "event_recorded",
  "timestamp": "2026-02-17T12:01:00.000Z"
}`}</CodeBlock>

            <h4 className="font-mono text-sm font-semibold text-foreground mt-4 mb-3">Session Behavior</h4>
            <Table
              headers={["Request", "Session", "Payment", "sessionActive"]}
              rows={[
                ["1st request", "None", "Required (402 then retry with payment)", "false"],
                ["2nd request (within TTL)", "Active", "Skipped", "true"],
                ["After TTL expires", "Expired", "Required again", "false"],
              ]}
            />
            <P>
              Sessions are isolated by <InlineCode>(address, resource)</InlineCode> — different agents and different routes maintain separate sessions.
            </P>
          </SubSection>

        </Section>

        {/* Try It */}
        <Section id="try-it" title="Try It">
          <P>
            Run the full SIWA auth flow from your terminal. These endpoints are live — you can call them right now.
          </P>

          <SubSection id="try-curl" title="Full Flow (curl)">
            <P>
              <strong className="text-foreground">Step 1</strong> — Request a nonce:
            </P>
            <CodeBlock language="bash">{`curl -s -X POST https://siwa.id/api/siwa/nonce \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "agentId": 42,
    "agentRegistry": "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e"
  }'`}</CodeBlock>

            <P>
              <strong className="text-foreground">Step 2</strong> — Build and sign the SIWA message using the nonce from step 1. Save the <InlineCode>nonceToken</InlineCode> for step 3. Use the SDK or any EIP-191 signer:
            </P>
            <CodeBlock language="typescript">{`import { signSIWAMessage } from '@buildersgarden/siwa';

const { message, signature } = await signSIWAMessage({
  domain: 'siwa.id',
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  statement: 'Authenticate as a registered ERC-8004 agent.',
  uri: 'https://siwa.id/api/siwa/verify',
  agentId: 42,
  agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
  chainId: 84532,
  nonce: '<nonce-from-step-1>',
  issuedAt: '<issuedAt-from-step-1>',
  expirationTime: '<expirationTime-from-step-1>'
});`}</CodeBlock>

            <P>
              <strong className="text-foreground">Step 3</strong> — Submit message + signature + nonceToken for verification:
            </P>
            <CodeBlock language="bash">{`curl -s -X POST https://siwa.id/api/siwa/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "<siwa-message-from-step-2>",
    "signature": "<signature-from-step-2>",
    "nonceToken": "<nonceToken-from-step-1>"
  }'`}</CodeBlock>

            <P>
              <strong className="text-foreground">Step 4</strong> — Use the receipt with ERC-8128 signed requests. In code, this is one function call:
            </P>
            <CodeBlock language="typescript">{`import { signAuthenticatedRequest } from '@buildersgarden/siwa/erc8128';

const req = new Request('https://siwa.id/api/protected', { method: 'GET' });
const signedReq = await signAuthenticatedRequest(req, receipt, signer, 84532);
const res = await fetch(signedReq);`}</CodeBlock>
          </SubSection>
        </Section>

        {/* SIWA Message Format Reference */}
        <div className="rounded-lg border border-border bg-surface p-5 mt-4">
          <h4 className="font-mono text-sm font-semibold text-foreground mb-3">
            SIWA Message Format
          </h4>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-muted">
            <code>{`{domain} wants you to sign in with your Agent account:
{address}

{statement}

URI: {uri}
Version: 1
Agent ID: {agentId}
Agent Registry: {agentRegistry}
Chain ID: {chainId}
Nonce: {nonce}
Issued At: {issuedAt}
Expiration Time: {expirationTime}`}</code>
          </pre>
        </div>

        {/* Cross-references */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <a
            href="/docs"
            className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
          >
            <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
              Documentation
            </h4>
            <p className="text-xs text-muted">
              SDK reference, protocol spec, security model, and contract addresses.
            </p>
          </a>
          <a
            href="/docs/deploy"
            className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
          >
            <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
              Deploy to Railway
            </h4>
            <p className="text-xs text-muted">
              Deploy your own SIWA server and keyring proxy with one Dockerfile.
            </p>
          </a>
        </div>
      </article>
    </div>
  );
}
