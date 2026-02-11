import { Metadata } from "next";
import { DocsSidebar } from "@/components/docs-sidebar";
import { CopyableAddress } from "@/components/copyable-address";
import { CodeBlock } from "@/components/code-block";
import { ImageModal } from "@/components/image-modal";
import { GettingStartedTabs } from "@/components/getting-started-tabs";

export const metadata: Metadata = {
  title: "Docs — SIWA",
  description:
    "Documentation for SIWA (Sign In With Agent) — getting started, API reference, security model, protocol spec, and contract addresses.",
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

export default function DocsPage() {
  return (
    <div className="mx-auto flex max-w-6xl px-6 py-12">
      <DocsSidebar />

      <article className="min-w-0 flex-1 pl-0 md:pl-12">
        <div className="mb-6 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-5 py-3">
          <p className="text-sm font-mono text-yellow-400">
            This project is a work in progress. Use at your own risk — we welcome{" "}
            <a href="https://github.com/builders-garden/siwa" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-yellow-300 transition-colors duration-200">feedback and contributions</a>.
          </p>
        </div>

        <h1 className="font-mono text-2xl font-bold text-foreground mb-2">
          SIWA Documentation
        </h1>
        <p className="text-sm text-dim mb-8">
          Sign In With Agent — v1.0
        </p>

        <div className="mb-12 rounded-lg border border-accent/30 bg-accent/5 px-5 py-4">
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-mono font-semibold text-accent">Agent?</span>{" "}
            If you are an AI agent, read{" "}
            <a
              href="/skill.md"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              /skill.md
            </a>{" "}
            instead — it contains structured instructions for wallet creation, registration, and SIWA authentication.
          </p>
          <p className="text-sm text-muted leading-relaxed mt-3">
            <span className="underline underline-offset-4 decoration-accent/40">
              Note: Your human must deploy the SIWA services first, learn more on the{" "}
            </span>
            <a
              href="#deploy"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              deploy section
            </a>
            .
          </p>
        </div>

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started">
          <P>
            SIWA gives AI agents an onchain identity — a wallet, a verifiable profile, and secure authentication. Choose your path below.
          </P>

          <GettingStartedTabs />

          <div className="mt-8 mb-4 grid gap-3 sm:grid-cols-3">
            <a
              href="#architecture"
              className="rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Architecture</h4>
              <p className="text-xs text-dim">How the auth flow and network topology work.</p>
            </a>
            <a
              href="#api"
              className="rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">API Reference</h4>
              <p className="text-xs text-dim">SDK functions, modules, and types.</p>
            </a>
            <a
              href="#security"
              className="rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Security Model</h4>
              <p className="text-xs text-dim">How keys stay safe, even if the agent is compromised.</p>
            </a>
          </div>
        </Section>

        {/* Architecture */}
        <Section id="architecture" title="Architecture">
          <SubSection id="how-it-works" title="How It Works">
            {/* Subsection 1: Sign-in with Agent verification */}
            <div className="mb-12">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-6">
                Sign-in with Agent Flow
              </h3>
              <ol className="space-y-3 mb-6 text-sm leading-relaxed text-muted list-none">
                <li className="flex gap-3">
                  <span className="font-mono font-semibold text-accent shrink-0">1.</span>
                  <span>The agent asks the service for a <strong className="text-foreground">nonce</strong> (a one-time challenge), sending its address and agent ID.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono font-semibold text-accent shrink-0">2.</span>
                  <span>The service returns the nonce along with timestamps.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono font-semibold text-accent shrink-0">3.</span>
                  <span>The agent builds a SIWA message containing those fields and <strong className="text-foreground">signs it</strong> with its private key.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono font-semibold text-accent shrink-0">4.</span>
                  <span>The agent sends the message and signature back to the service.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono font-semibold text-accent shrink-0">5.</span>
                  <span>The service <strong className="text-foreground">verifies</strong> the signature and calls the blockchain to confirm the agent actually owns that identity NFT.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono font-semibold text-accent shrink-0">6.</span>
                  <span>If everything checks out, the service returns a <strong className="text-foreground">verification receipt</strong>. The agent attaches this receipt to every subsequent request, signed with ERC-8128 HTTP Message Signatures.</span>
                </li>
              </ol>
              <P>
                The SDK gives you two functions to implement this:
              </P>
              <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
                <li className="flex gap-3">
                  <span className="text-accent shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Agent-side:</strong> call <InlineCode>signSIWAMessage()</InlineCode>, which builds the message and signs it in one step (steps 3-4 above).</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Server-side:</strong> call <InlineCode>verifySIWA()</InlineCode> to validate the signature, check all fields, and recover the agent&apos;s identity (step 5).</span>
                </li>
              </ul>

              <ImageModal
                src="/siwa-flow.png"
                alt="SIWA authentication flow: Agent requests nonce, signs SIWA message, Service verifies signature and checks onchain ownership, returns HMAC-signed verification receipt, then subsequent API requests use ERC-8128 HTTP signatures"
                className="w-full rounded-lg border border-border"
                width={800}
                height={730}
              />
            </div>

            {/* Subsection 2: Use the SIWA Agentic Wallet */}
            <div>
              <h3 className="font-mono text-sm font-semibold text-foreground mb-6">
                Use the SIWA Agentic Wallet
              </h3>
              <P>
                Once the agent has a wallet, it can sign messages and transactions through the keyring proxy. The private key never leaves the proxy — the agent only receives signatures.
              </P>

              <div id="agentic-wallet-sign-message" className="scroll-mt-20 mt-6 mb-4">
                <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Sign a Message</h4>
              </div>
              <CodeBlock language="typescript">{`import { signMessage } from "@buildersgarden/siwa/keystore";

const { signature, address } = await signMessage("Hello from my agent!");
// signature: "0x..." (EIP-191 personal_sign)
// address: "0x..." (wallet address)`}</CodeBlock>

              <div id="agentic-wallet-send-tx" className="scroll-mt-20 mt-6 mb-4">
                <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Send a Transaction</h4>
              </div>
              <P>
                Sign a transaction via the proxy, then broadcast it with viem.
              </P>
              <CodeBlock language="typescript">{`import { signTransaction, getAddress } from "@buildersgarden/siwa/keystore";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({ chain: base, transport: http() });
const address = await getAddress();

// Build and sign the transaction
const { signedTx } = await signTransaction({
  to: "0xRecipient...",
  value: parseEther("0.01"),
  chainId: base.id,
});

// Broadcast to the network
const hash = await client.sendRawTransaction({ serializedTransaction: signedTx });`}</CodeBlock>

              <P>
                If 2FA is enabled, transaction signing will require owner approval via Telegram before the proxy returns the signature.
              </P>
            </div>
          </SubSection>

          <SubSection id="network-topology" title="Network Topology">
            <P>
              A deployed SIWA agent runs as a set of containers on a private network. Each component has a single job:
            </P>
            <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Keyring Proxy</strong> — holds the agent&apos;s encrypted private key and performs all signing. Never exposed publicly.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">OpenClaw</strong> — the AI agent gateway. Routes messages from users, delegates signing to the keyring proxy, and handles onchain verification and registration.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">2FA Gateway + Server</strong> (optional) — adds Telegram-based owner approval before high-value signing operations. The gateway receives Telegram webhooks; the server manages approval flows. The agent owner gets a Telegram message and taps to approve or reject.</span>
              </li>
            </ul>

            <ImageModal
              src="/siwa-topology.png"
              alt="SIWA network topology: Users connect to OpenClaw gateway, which delegates signing to the Keyring Proxy over a private network. Optional 2FA flow routes through a 2FA Server and Gateway to Telegram for owner approval."
              className="w-full rounded-lg border border-border"
              width={800}
              height={480}
            />

            <P>
              The keyring proxy, OpenClaw, and 2FA server communicate over a private Docker network. Only the 2FA gateway (for Telegram webhooks) and OpenClaw (for user-facing chat) are exposed externally.
            </P>
          </SubSection>
        </Section>

        {/* API Reference */}
        <Section id="api" title="API Reference">
          <P>
            Install the SDK: <InlineCode>npm install @buildersgarden/siwa</InlineCode>
          </P>

          {/* ── Signing ────────────────────────────────────────────── */}
          <SubSection id="api-signing" title="Signing">
            <P>
              All signing is delegated to the keyring proxy — the agent process never touches the private key.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["createWallet()", "{ address, backend }", "Create a new wallet. Key stored in proxy, never returned."],
                ["getAddress()", "string", "Get the wallet's public address."],
                ["hasWallet()", "boolean", "Check if a wallet exists."],
                ["signMessage(msg)", "{ signature, address }", "Sign a message (EIP-191)."],
                ["signRawMessage(rawHex)", "{ signature, address }", "Sign raw bytes without EIP-191 prefix (used by ERC-8128)."],
                ["signTransaction(tx)", "{ signedTx, address }", "Sign a transaction."],
                ["signAuthorization(auth)", "SignedAuthorization", "EIP-7702 delegation signing."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/keystore</InlineCode>. All functions accept an optional <InlineCode>KeystoreConfig</InlineCode> ({"{"}proxyUrl, proxySecret{"}"}).
            </P>

            <div id="api-signing-siwa" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">SIWA Message Signing</h4>
            </div>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["buildSIWAMessage(fields)", "string", "Build a formatted SIWA message string."],
                ["signSIWAMessage(fields, keystoreConfig?)", "{ message, signature, address }", "Build, sign, and return the SIWA message. Address auto-resolved from keystore."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa</InlineCode>.
            </P>

            <div id="api-signing-erc8128" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">ERC-8128 Request Signing</h4>
            </div>
            <P>
              After SIWA sign-in, every subsequent API request is signed with ERC-8128 HTTP Message Signatures and carries a verification receipt.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["signAuthenticatedRequest(request, receipt, config, chainId)", "Request", "Attach receipt + ERC-8128 signature to an outgoing request."],
                ["createProxySigner(config, chainId)", "EthHttpSigner", "Create an RFC 9421 signer backed by the keyring proxy."],
                ["attachReceipt(request, receipt)", "Request", "Set the X-SIWA-Receipt header on a request."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode>.
            </P>
          </SubSection>

          {/* ── Verification ───────────────────────────────────────── */}
          <SubSection id="api-verification" title="Verification">
            <P>
              Server-side functions for verifying agent identity and authenticating requests.
            </P>

            <div id="api-verify-siwa" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">SIWA Verification</h4>
            </div>
            <P>
              Verify a SIWA signature, check onchain ownership, and optionally validate agent profile and reputation — all in one call.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["verifySIWA(msg, sig, domain, nonceValid, client, criteria?)", "SIWAVerificationResult", "Verify signature + onchain ownership. client is a viem PublicClient."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa</InlineCode>. The optional <InlineCode>criteria</InlineCode> argument validates the agent&apos;s profile after the ownership check:
            </P>
            <Table
              headers={["Criteria Field", "Type", "Description"]}
              rows={[
                ["mustBeActive", "boolean", "Require metadata.active === true."],
                ["requiredServices", "ServiceType[]", "Agent must expose all listed service types (e.g. 'MCP', 'A2A')."],
                ["requiredTrust", "TrustModel[]", "Agent must support all listed trust models."],
                ["minScore", "number", "Minimum reputation score."],
                ["minFeedbackCount", "number", "Minimum reputation feedback count."],
                ["reputationRegistryAddress", "string", "Required when using minScore or minFeedbackCount."],
                ["custom", "(agent) => boolean", "Custom validation function receiving the full AgentProfile."],
              ]}
            />
            <CodeBlock language="typescript">{`import { verifySIWA } from '@buildersgarden/siwa';

const result = await verifySIWA(
  message,
  signature,
  'api.example.com',
  (nonce) => nonceStore.consume(nonce),
  client,
  {
    mustBeActive: true,
    requiredServices: ['MCP'],
    minScore: 0.5,
    reputationRegistryAddress: '0x8004BAa1...9b63',
  }
);`}</CodeBlock>

            <div id="api-verify-erc8128" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">ERC-8128 Request Verification</h4>
            </div>
            <P>
              Verify the ERC-8128 signature and receipt on incoming requests.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["verifyAuthenticatedRequest(request, options)", "AuthResult", "Verify ERC-8128 signature + receipt + optional onchain check."],
                ["expressToFetchRequest(req)", "Request", "Convert an Express request to a Fetch API Request."],
                ["nextjsToFetchRequest(req)", "Request", "Normalize a Next.js request for proxy situations."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode>. <InlineCode>VerifyOptions</InlineCode>: <InlineCode>receiptSecret</InlineCode>, <InlineCode>rpcUrl</InlineCode>, <InlineCode>verifyOnchain</InlineCode>, <InlineCode>publicClient</InlineCode>.
            </P>

            <div id="api-verify-receipts" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Receipts</h4>
            </div>
            <P>
              Stateless HMAC-signed tokens that prove onchain registration was checked during SIWA sign-in.
            </P>
            <Table
              headers={["Export", "Returns", "Description"]}
              rows={[
                ["createReceipt(payload, options)", "{ receipt, expiresAt }", "Create an HMAC-signed receipt."],
                ["verifyReceipt(receipt, secret)", "ReceiptPayload | null", "Verify and decode. Returns null if invalid or expired."],
                ["DEFAULT_RECEIPT_TTL", "number", "Default TTL: 30 minutes (1800000 ms)."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/receipt</InlineCode>.
            </P>
          </SubSection>

          {/* ── Server Wrappers ────────────────────────────────────── */}
          <SubSection id="api-wrappers" title="Server Wrappers">
            <P>
              High-level middleware that handles ERC-8128 verification, receipt checking, CORS, and error responses — so you don&apos;t have to wire the low-level functions yourself.
            </P>

            <div id="api-wrappers-next" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Next.js</h4>
            </div>
            <Table
              headers={["Export", "Description"]}
              rows={[
                ["withSiwa(handler, options?)", "Wrap a route handler with ERC-8128 auth. Handles body cloning, URL normalization, CORS, and 401 on failure."],
                ["siwaOptions()", "Return a 204 OPTIONS response with CORS headers."],
                ["corsJson(data, init?)", "JSON Response with CORS headers."],
                ["corsHeaders()", "Raw CORS headers record for custom responses."],
              ]}
            />
            <CodeBlock language="typescript">{`import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

export const POST = withSiwa(async (agent, req) => {
  const body = await req.json();
  return { received: body, agent: { address: agent.address, agentId: agent.agentId } };
});

export const GET = withSiwa(async (agent) => {
  return { message: \`Hello Agent #\${agent.agentId}!\` };
});

export { siwaOptions as OPTIONS };`}</CodeBlock>
            <P>
              Options: <InlineCode>receiptSecret</InlineCode> (defaults to <InlineCode>RECEIPT_SECRET</InlineCode> or <InlineCode>SIWA_SECRET</InlineCode> env), <InlineCode>rpcUrl</InlineCode>, <InlineCode>verifyOnchain</InlineCode>.
            </P>

            <div id="api-wrappers-express" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Express</h4>
            </div>
            <Table
              headers={["Export", "Description"]}
              rows={[
                ["siwaMiddleware(options?)", "Auth middleware: verifies ERC-8128 + receipt, sets req.agent, returns 401 on failure."],
                ["siwaJsonParser()", "express.json() with rawBody capture for Content-Digest verification."],
                ["siwaCors(options?)", "CORS middleware with SIWA-specific headers."],
              ]}
            />
            <CodeBlock language="typescript">{`import express from 'express';
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";

const app = express();
app.use(siwaJsonParser());
app.use(siwaCors());

app.get('/api/protected', siwaMiddleware(), (req, res) => {
  res.json({ agent: req.agent });
});`}</CodeBlock>
          </SubSection>

          {/* ── Identity & Registry ────────────────────────────────── */}
          <SubSection id="api-identity" title="Identity & Registry">
            <P>
              Read and write agent identity state, and query onchain profiles and reputation.
            </P>

            <div id="api-identity-file" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Identity File</h4>
            </div>
            <P>
              The agent&apos;s SIWA_IDENTITY.md stores 4 public fields: Address, Agent ID, Agent Registry, Chain ID.
            </P>
            <Table
              headers={["Function", "Description"]}
              rows={[
                ["ensureIdentityExists(path, template)", "Initialize SIWA_IDENTITY.md from template if missing."],
                ["readIdentity(path)", "Parse SIWA_IDENTITY.md into a typed AgentIdentity object."],
                ["writeIdentityField(key, value, path)", "Write a single field to SIWA_IDENTITY.md."],
                ["hasWalletRecord(path)", "Check if an address is recorded in SIWA_IDENTITY.md."],
                ["isRegistered({ identityPath, client? })", "Check registration (local cache or onchain ownerOf)."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/identity</InlineCode>.
            </P>

            <div id="api-identity-registry" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Onchain Registry</h4>
            </div>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["getAgent(agentId, options)", "AgentProfile", "Read agent profile from the Identity Registry (owner, tokenURI, agentWallet, metadata)."],
                ["getReputation(agentId, options)", "ReputationSummary", "Read agent reputation summary from the Reputation Registry."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/registry</InlineCode>. Both accept a viem <InlineCode>PublicClient</InlineCode> via <InlineCode>options.client</InlineCode>.
            </P>
            <Table
              headers={["Type", "Values"]}
              rows={[
                ["ServiceType", "'web' | 'A2A' | 'MCP' | 'OASF' | 'ENS' | 'DID' | 'email'"],
                ["TrustModel", "'reputation' | 'crypto-economic' | 'tee-attestation'"],
                ["ReputationTag", "'starred' | 'reachable' | 'ownerVerified' | 'uptime' | 'successRate' | 'responseTime' | 'blocktimeFreshness' | 'revenues' | 'tradingYield'"],
              ]}
            />
          </SubSection>

          {/* ── Helpers ────────────────────────────────────────────── */}
          <SubSection id="api-helpers" title="Helpers">
            <Table
              headers={["Function", "Module", "Description"]}
              rows={[
                ["computeHMAC(secret, method, path, body, timestamp)", "@buildersgarden/siwa/proxy-auth", "Compute HMAC-SHA256 signature for a keyring proxy request."],
              ]}
            />
          </SubSection>
        </Section>

        {/* Security Model */}
        <Section id="security" title="Security Model">
          <P>
            The agent&apos;s private key is the root of its onchain identity. SIWA&apos;s security architecture ensures the key never enters the agent process.
          </P>

          <SubSection id="security-proxy" title="Keyring Proxy">
            <P>
              All signing is delegated to a separate keyring proxy server over HMAC-authenticated HTTP. The proxy holds the encrypted key and performs all cryptographic operations.
            </P>
            <CodeBlock language="text">{`Agent Process                     Keyring Proxy
(KEYSTORE_BACKEND=proxy)          (holds encrypted key)

signMessage("hello")
  |
  +--> POST /sign-message
       + HMAC-SHA256 header  ---> Validates HMAC + timestamp (30s)
                                  Loads key, signs, discards
                              <-- Returns { signature, address }`}</CodeBlock>
            <Table
              headers={["Property", "Detail"]}
              rows={[
                ["Key isolation", "Private key lives in a separate OS process; never enters agent memory."],
                ["Transport auth", "HMAC-SHA256 over method + path + body + timestamp; 30-second replay window."],
                ["Audit trail", "Every signing request logged with timestamp, endpoint, source IP."],
                ["Compromise limit", "Even full agent takeover can only request signatures — cannot extract key."],
              ]}
            />
          </SubSection>

          <SubSection id="security-threats" title="Threat Model">
            <Table
              headers={["Threat", "Mitigation"]}
              rows={[
                ["Prompt injection exfiltration", "Key never in any file the agent reads into context."],
                ["Context window leakage", "Key loaded inside function, used, and discarded — never returned."],
                ["File system snooping", "AES-encrypted V3 JSON Keystore (scrypt KDF)."],
                ["Log / error exposure", "Signing functions return only signatures, never raw keys."],
                ["Accidental commit", "No file in the project ever contains the plaintext key."],
              ]}
            />
          </SubSection>

          <SubSection id="security-identity" title="SIWA_IDENTITY.md: Public Data Only">
            <P>
              The agent&apos;s identity file stores only public state — address, agentId, agentRegistry, chainId. The private key is never written to SIWA_IDENTITY.md or any other file the agent reads.
            </P>
          </SubSection>

          <SubSection id="security-2fa" title="2FA via Telegram">
            <P>
              For high-value operations, the keyring proxy can require owner approval before signing. This adds a second factor — the agent can request a signature, but the owner must explicitly approve it through Telegram.
            </P>
            <CodeBlock language="text">{`Agent requests signature
  |
  +--> Keyring Proxy
       |
       +--> 2FA Server (approval queue)
            |
            +--> 2FA Gateway --> Telegram bot message
                                 Owner taps Approve / Reject
                             <-- Callback to 2FA Server
       <-- Signature (if approved)
  <-- Returns to agent`}</CodeBlock>
            <P>
              The flow adds two components to the private network:
            </P>
            <Table
              headers={["Component", "Role"]}
              rows={[
                ["2FA Server", "Manages the approval queue. Receives signing requests from the keyring proxy, holds them until the owner responds, and returns the result."],
                ["2FA Gateway", "Connects to Telegram Bot API. Sends approval messages and receives webhook callbacks. This is the only 2FA component exposed to the internet."],
              ]}
            />
            <P>
              Both the keyring proxy and the 2FA server run inside the private network — they are never exposed publicly. Only the 2FA gateway needs internet access for Telegram webhooks.
            </P>
            <Table
              headers={["Property", "Detail"]}
              rows={[
                ["Scope", "Configurable per operation type — e.g. require approval for transactions but not for message signing."],
                ["Timeout", "Pending approvals expire after a configurable window (default 5 minutes)."],
                ["Audit", "Every approval request and response is logged with timestamp and Telegram user ID."],
                ["Fallback", "If the owner doesn't respond within the timeout, the request is rejected by default."],
              ]}
            />
          </SubSection>
        </Section>

        {/* Protocol Spec */}
        <Section id="protocol" title="Protocol Specification">
          <SubSection id="protocol-message" title="Message Format">
            <CodeBlock language="text">{`{domain} wants you to sign in with your Agent account:
{address}

{statement}

URI: {uri}
Version: 1
Agent ID: {agentId}
Agent Registry: {agentRegistry}
Chain ID: {chainId}
Nonce: {nonce}
Issued At: {issuedAt}
[Expiration Time: {expirationTime}]
[Not Before: {notBefore}]
[Request ID: {requestId}]`}</CodeBlock>
          </SubSection>

          <SubSection id="protocol-fields" title="Field Definitions">
            <Table
              headers={["Field", "Required", "Description"]}
              rows={[
                ["domain", "Yes", "Origin domain requesting authentication."],
                ["address", "Yes", "EIP-55 checksummed Ethereum address."],
                ["statement", "No", "Human-readable purpose string."],
                ["uri", "Yes", "RFC 3986 URI of the resource."],
                ["version", "Yes", "Must be \"1\"."],
                ["agentId", "Yes", "ERC-721 tokenId in the Identity Registry."],
                ["agentRegistry", "Yes", "eip155:{chainId}:{registryAddress}"],
                ["chainId", "Yes", "EIP-155 Chain ID."],
                ["nonce", "Yes", "Server-generated, >= 8 alphanumeric chars."],
                ["issuedAt", "Yes", "RFC 3339 datetime."],
                ["expirationTime", "No", "RFC 3339 datetime."],
                ["notBefore", "No", "RFC 3339 datetime."],
                ["requestId", "No", "Opaque request identifier."],
              ]}
            />
          </SubSection>

          <SubSection id="protocol-flow" title="Authentication Flow">
            <P>
              <strong className="text-foreground">1. Nonce Request</strong> — Agent sends address, agentId, agentRegistry to <InlineCode>POST /siwa/nonce</InlineCode>. Server returns nonce + timestamps.
            </P>
            <P>
              <strong className="text-foreground">2. Agent Signs</strong> — Agent builds SIWA message and signs via EIP-191 <InlineCode>personal_sign</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">3. Verification</strong> — Agent submits message + signature to <InlineCode>POST /siwa/verify</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">4. Server Checks</strong> — Parse message, recover signer, verify address match, check domain binding, validate nonce + time window, call <InlineCode>ownerOf(agentId)</InlineCode> onchain.
            </P>
            <P>
              <strong className="text-foreground">5. Receipt</strong> — Issue an HMAC-signed verification receipt with address, agentId, agentRegistry, chainId. Agent uses this with ERC-8128 per-request signatures.
            </P>
          </SubSection>

          <SubSection id="protocol-vs-siwe" title="SIWA vs SIWE">
            <Table
              headers={["Aspect", "SIWE (EIP-4361)", "SIWA"]}
              rows={[
                ["Purpose", "Human wallet auth", "Agent identity auth"],
                ["Identity proof", "Owns an Ethereum address", "Owns an ERC-8004 agent NFT"],
                ["Onchain check", "None required", "ownerOf(agentId) REQUIRED"],
                ["Extra fields", "None", "agentId, agentRegistry"],
                ["Signing", "EIP-191", "EIP-191 (same)"],
                ["Message prefix", "...your Ethereum account", "...your Agent account"],
              ]}
            />
          </SubSection>
        </Section>

        {/* Contract Addresses */}
        <Section id="contracts" title="Contract Addresses">
          <SubSection id="contracts-mainnet" title="Mainnet">
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Chain</th>
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Chain ID</th>
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Identity Registry</th>
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Reputation Registry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Ethereum</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">1</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" /></td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" /></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Base</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">8453</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" /></td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SubSection>

          <SubSection id="contracts-testnet" title="Testnets">
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Chain</th>
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Chain ID</th>
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Identity Registry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Ethereum Sepolia</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">11155111</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004A818BFB912233c491871b3d84c89A494BD9e" /></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Base Sepolia</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">84532</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004A818BFB912233c491871b3d84c89A494BD9e" /></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Linea Sepolia</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">59141</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004A818BFB912233c491871b3d84c89A494BD9e" /></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Polygon Amoy</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">80002</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004A818BFB912233c491871b3d84c89A494BD9e" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SubSection>

          <SubSection id="contracts-format" title="Agent Registry String Format">
            <CodeBlock language="text">{`{namespace}:{chainId}:{identityRegistryAddress}

Examples:
  eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432    (Base)
  eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e   (Base Sepolia)`}</CodeBlock>
          </SubSection>

          <SubSection id="contracts-rpc" title="Public RPC Endpoints">
            <Table
              headers={["Chain", "RPC URL"]}
              rows={[
                ["Base", "https://mainnet.base.org"],
                ["Ethereum Sepolia", "https://rpc.sepolia.org"],
                ["Base Sepolia", "https://sepolia.base.org"],
                ["Linea Sepolia", "https://rpc.sepolia.linea.build"],
                ["Polygon Amoy", "https://rpc-amoy.polygon.technology"],
              ]}
            />
            <P>
              For production use, use a provider like Alchemy or Infura with your own API key.
            </P>
          </SubSection>

          <SubSection id="contracts-explorer" title="Explorer">
            <P>
              View any registered agent at{" "}
              <a
                href="https://www.8004scan.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-blue-400 transition-colors duration-200 underline underline-offset-4 cursor-pointer"
              >
                8004scan.io
              </a>
            </P>
          </SubSection>
        </Section>

        {/* Next Steps */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <a
            href="/docs/endpoints"
            className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
          >
            <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
              API Endpoints
            </h4>
            <p className="text-xs text-muted">
              Live HTTP endpoints you can call right now to try the full SIWA auth flow.
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
