import { Metadata } from "next";
import { DocsSidebar } from "@/components/docs-sidebar";
import { CopyableAddress } from "@/components/copyable-address";
import { CodeBlock } from "@/components/code-block";

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
            This project is a work in progress. APIs and documentation may change.
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
        </div>

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started">
          <P>
            Think of{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-4361"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              Sign In With Ethereum (SIWE)
            </a>
            , but for AI agents instead of humans. SIWE lets a person prove they own a wallet; SIWA lets an agent prove it owns an{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-8004"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              ERC-8004
            </a>
            {" "}identity NFT. Same challenge-response pattern, extended with <InlineCode>agentId</InlineCode> and an onchain ownership check.
          </P>

          <SubSection id="how-it-works" title="How It Works">
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

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/siwa-flow.png"
              alt="SIWA authentication flow: Agent requests nonce from Service, signs SIWA message, Service verifies signature and checks onchain ownership, returns verification receipt"
              className="w-full rounded-lg border border-border"
              width={800}
              height={530}
            />

            <div className="mt-6 rounded-lg border border-border bg-surface px-5 py-4">
              <p className="text-sm text-muted leading-relaxed mb-3">
                <strong className="text-foreground">Before signing in or registering on ERC-8004,</strong> the agent needs a wallet. The SDK provides <InlineCode>createWallet()</InlineCode> for this. The agent uses it to generate a wallet whose private key is stored in a <strong className="text-foreground">keyring proxy</strong> (a separate process), so the agent never touches it directly. This is what keeps the key safe even if the agent is compromised.
              </p>
              <p className="text-sm text-muted leading-relaxed">
                For wallet setup, proxy deployment, and onchain registration, see the{" "}
                <a
                  href="/docs/deploy"
                  className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
                >
                  deployment guide
                </a>
                {" "}and the{" "}
                <a
                  href="#security-proxy"
                  className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
                >
                  keyring proxy
                </a>
                {" "}section below.
              </p>
            </div>
          </SubSection>

          <SubSection id="quick-start" title="Try It Locally">
            <P>
              Run the full flow (wallet creation, registration, SIWA sign-in) without deploying anything:
            </P>
            <CodeBlock language="bash">{`git clone https://github.com/builders-garden/siwa
cd siwa && pnpm install
cd packages/siwa-testing && pnpm run dev`}</CodeBlock>
          </SubSection>

          <SubSection id="installation" title="Install the SDK">
            <CodeBlock language="bash">{`npm install @buildersgarden/siwa`}</CodeBlock>
            <P>
              The package exposes several modules:
            </P>
            <CodeBlock language="typescript">{`// Core — build & verify SIWA messages
import { signSIWAMessage, verifySIWA } from '@buildersgarden/siwa';

// Keystore — wallet creation & signing (agent never sees the private key)
import { createWallet, signMessage, getAddress } from '@buildersgarden/siwa/keystore';

// Registry — read agent profiles & reputation onchain
import { getAgent, getReputation } from '@buildersgarden/siwa/registry';

// Identity — minimal agent state (address, agentId, registry, chainId)
import { readIdentity, writeIdentityField } from '@buildersgarden/siwa/identity';

// Server-side wrappers (recommended for new projects)
import { withSiwa, siwaOptions, corsJson } from '@buildersgarden/siwa/next';
import { siwaMiddleware, siwaJsonParser, siwaCors } from '@buildersgarden/siwa/express';

// Helpers
import { computeHMAC } from '@buildersgarden/siwa/proxy-auth';`}</CodeBlock>
          </SubSection>

          <SubSection id="sign-up" title="Step 3: Sign Up (Registration) — Optional">
            <P>
              If your agent is already registered onchain (has an <InlineCode>agentId</InlineCode>), skip to Step 4. Otherwise, register by creating a wallet, building a registration file, and calling the Identity Registry contract.
            </P>
            <CodeBlock language="typescript">{`import { createWallet, signTransaction, getAddress } from '@buildersgarden/siwa/keystore';
import { writeIdentityField } from '@buildersgarden/siwa/identity';

// 1. Create wallet (key goes to proxy, never returned)
const info = await createWallet();
writeIdentityField('Address', info.address);

// 2. Build registration JSON
const registration = {
  type: "AI Agent",
  name: "My Agent",
  description: "An ERC-8004 registered agent",
  services: [{ type: "MCP", url: "https://api.example.com/mcp" }],
  active: true
};

// 3. Upload to IPFS or use data URI
const encoded = Buffer.from(JSON.stringify(registration)).toString('base64');
const agentURI = \`data:application/json;base64,\${encoded}\`;

// 4. Register onchain (sign via proxy)
import { encodeFunctionData } from 'viem';

const data = encodeFunctionData({
  abi: [{ name: 'register', type: 'function', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ type: 'uint256' }] }],
  functionName: 'register',
  args: [agentURI]
});
const { signedTx } = await signTransaction({ to: REGISTRY, data, ... });
const txHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx });`}</CodeBlock>
          </SubSection>

          <SubSection id="sign-in" title="Step 4: Sign In (SIWA Authentication)">
            <P>
              Authenticate with any SIWA-aware service using the challenge-response flow.
            </P>
            <CodeBlock language="typescript">{`import { signSIWAMessage } from '@buildersgarden/siwa';

// 1. Request a nonce from the server
const { nonce, issuedAt, expirationTime } = await fetch(
  'https://example.com/api/siwa/nonce',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, agentId, agentRegistry }),
  }
).then(r => r.json());

// 2. Sign the SIWA message
const { message, signature } = await signSIWAMessage({
  domain: 'example.com',
  address,
  uri: 'https://example.com/api/siwa',
  agentId,
  agentRegistry,
  chainId,
  nonce,
  issuedAt,
  expirationTime,
});

// 3. Send to server → get a verification receipt back
const { receipt } = await fetch('https://example.com/api/siwa/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, signature }),
}).then(r => r.json());

// 4. Use the receipt with ERC-8128 signed requests
import { signAuthenticatedRequest } from '@buildersgarden/siwa/erc8128';

const req = new Request('https://example.com/api/protected', { method: 'GET' });
const signedReq = await signAuthenticatedRequest(req, receipt, keystoreConfig, chainId);
const res = await fetch(signedReq);`}</CodeBlock>
            <P>
              That&apos;s it. The agent now has a receipt it can use with ERC-8128 signed requests for authenticated API calls.
              For a live server you can test against right now, see the{" "}
              <a
                href="/docs/endpoints"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                API Endpoints
              </a>
              {" "}page.
            </P>
          </SubSection>

          <SubSection id="verify" title="Verify (Server-Side)">
            <P>
              On your server, validate the signature and issue a session:
            </P>
            <CodeBlock language="typescript">{`import { verifySIWA } from '@buildersgarden/siwa';

const { message, signature } = req.body;

const result = verifySIWA(message, signature, {
  domain: 'example.com',
  nonce: storedNonce,
});
// → { address, agentId, agentRegistry, chainId }

// Verify onchain ownership
const owner = await identityRegistry.ownerOf(result.agentId);
if (owner.toLowerCase() !== result.address.toLowerCase()) {
  throw new Error('Signer does not own this agent NFT');
}

// Issue a verification receipt (HMAC-signed, stateless)
import { createReceipt } from '@buildersgarden/siwa/receipt';

const { receipt, expiresAt } = createReceipt(
  { address: result.address, agentId: result.agentId, agentRegistry: result.agentRegistry, chainId: result.chainId, verified: 'onchain' },
  { secret: RECEIPT_SECRET },
);`}</CodeBlock>
            <P>
              For advanced verification options (reputation checks, service requirements, custom validators), see{" "}
              <a
                href="#api-siwa"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                <InlineCode>verifySIWA</InlineCode> in the API Reference
              </a>
              {" "}below.
            </P>
          </SubSection>

          <div className="mt-8 rounded-lg border border-border bg-surface px-5 py-4">
            <p className="text-sm text-muted leading-relaxed">
              <strong className="text-foreground">Next steps:</strong>{" "}
              The sections below go deeper into each part of SIWA: the full API surface, the security model (including the{" "}
              <a
                href="#security-proxy"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                keyring proxy
              </a>
              {" "}that keeps private keys out of the agent process), the{" "}
              <a
                href="#protocol"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                protocol specification
              </a>
              , and{" "}
              <a
                href="#contracts"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                contract addresses
              </a>
              .
              To deploy your own keyring proxy and SIWA server, see the{" "}
              <a
                href="/docs/deploy"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                deployment guide
              </a>
              .
            </p>
          </div>
        </Section>

        {/* API Reference */}
        <Section id="api" title="API Reference">
          <SubSection id="api-keystore" title="@buildersgarden/siwa/keystore">
            <P>
              Secure key storage abstraction. None of these functions return the private key.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["createWallet()", "{ address, backend }", "Create a new wallet. Key stored in backend, never returned."],
                ["signMessage(msg)", "{ signature, address }", "Sign a message. Key loaded, used, discarded."],
                ["signTransaction(tx)", "{ signedTx, address }", "Sign a transaction. Same pattern."],
                ["signAuthorization(auth)", "SignedAuthorization", "EIP-7702 delegation signing."],
                ["getAddress()", "string", "Get the wallet's public address."],
                ["hasWallet()", "boolean", "Check if a wallet exists in the backend."],
              ]}
            />
            <P>
              With the <InlineCode>proxy</InlineCode> backend, all signing is delegated over HMAC-authenticated HTTP. <InlineCode>getSigner()</InlineCode> is not available with proxy.
            </P>
          </SubSection>

          <SubSection id="api-siwa" title="@buildersgarden/siwa">
            <P>
              SIWA protocol operations — message building, signing, and verification.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["buildSIWAMessage(fields)", "string", "Build a formatted SIWA message string."],
                ["signSIWAMessage(fields)", "{ message, signature }", "Build and sign a SIWA message."],
                ["verifySIWA(msg, sig, domain, nonceValid, provider, criteria?)", "SIWAVerificationResult", "Verify a SIWA signature. Optional criteria param validates agent profile/reputation."],
              ]}
            />
            <P>
              <InlineCode>verifySIWA</InlineCode> accepts an optional <InlineCode>SIWAVerifyCriteria</InlineCode> object as the 6th argument to validate agent profile and reputation after the ownership check. When criteria are provided, the result includes the full <InlineCode>agent</InlineCode> profile.
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
  provider,
  {
    mustBeActive: true,
    requiredServices: ['MCP'],
    requiredTrust: ['reputation'],
    minScore: 0.5,
    minFeedbackCount: 10,
    reputationRegistryAddress: '0x8004BAa1...9b63',
  }
);

if (result.valid) {
  // result.agent contains the full AgentProfile
  console.log(result.agent.metadata.services);
}`}</CodeBlock>
          </SubSection>

          <SubSection id="api-registry" title="@buildersgarden/siwa/registry">
            <P>
              Read agent profiles and reputation from on-chain registries.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["getAgent(agentId, options)", "AgentProfile", "Read agent profile from the Identity Registry (owner, tokenURI, agentWallet, metadata)."],
                ["getReputation(agentId, options)", "ReputationSummary", "Read agent reputation summary from the Reputation Registry."],
              ]}
            />
            <P>
              <InlineCode>getAgent</InlineCode> fetches and parses the agent&apos;s metadata JSON from its <InlineCode>tokenURI</InlineCode>. Supported URI schemes: <InlineCode>ipfs://</InlineCode>, <InlineCode>data:application/json;base64,</InlineCode>, and <InlineCode>https://</InlineCode>.
            </P>
            <CodeBlock language="typescript">{`import { getAgent, getReputation } from '@buildersgarden/siwa/registry';

const agent = await getAgent(42, {
  registryAddress: '0x8004A169...a432',
  provider,
});
// agent.owner        — NFT owner address
// agent.agentWallet  — linked wallet (null if unset)
// agent.metadata     — parsed JSON (name, services, active, ...)

const rep = await getReputation(42, {
  reputationRegistryAddress: '0x8004BAa1...9b63',
  provider,
  tag1: 'starred',     // filter by reputation tag
});
// rep.score  — normalized score
// rep.count  — total feedback count`}</CodeBlock>
            <P>
              The module exports typed string literals for values defined in the{" "}
              <a
                href="https://eips.ethereum.org/EIPS/eip-8004"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-blue-400 transition-colors duration-200 underline underline-offset-4 cursor-pointer"
              >
                ERC-8004
              </a>
              {" "}specification. These provide autocompletion while still accepting custom strings.
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

          <SubSection id="api-identity" title="@buildersgarden/siwa/identity">
            <P>
              Helpers for reading and writing the agent&apos;s public identity state in IDENTITY.md (4 fields: Address, Agent ID, Agent Registry, Chain ID).
            </P>
            <Table
              headers={["Function", "Description"]}
              rows={[
                ["ensureIdentityExists(path, template)", "Initialize IDENTITY.md from template if missing."],
                ["readIdentity(path)", "Parse IDENTITY.md into a typed AgentIdentity object."],
                ["writeIdentityField(key, value, path)", "Write a single field to IDENTITY.md."],
                ["hasWalletRecord(path)", "Check if an address is recorded in IDENTITY.md."],
                ["isRegistered({ identityPath, client? })", "Check registration (local cache or onchain ownerOf)."],
              ]}
            />
          </SubSection>

          <SubSection id="api-proxy-auth" title="@buildersgarden/siwa/proxy-auth">
            <P>
              HMAC-SHA256 authentication utilities for the keyring proxy transport.
            </P>
            <Table
              headers={["Function", "Description"]}
              rows={[
                ["computeHMAC(secret, method, path, body, timestamp)", "Compute HMAC-SHA256 signature for a proxy request."],
              ]}
            />
          </SubSection>

          <SubSection id="api-next" title="@buildersgarden/siwa/next">
            <P>
              Server-side wrappers for Next.js App Router route handlers. Uses only web standard APIs (Request, Response) — no <InlineCode>next</InlineCode> dependency required.
            </P>
            <Table
              headers={["Export", "Description"]}
              rows={[
                ["withSiwa(handler, options?)", "Wrap a route handler with ERC-8128 auth. Handles body cloning, URL normalization, CORS, and 401 on failure."],
                ["siwaOptions()", "Return a 204 OPTIONS response with CORS headers. Use as: export { siwaOptions as OPTIONS }"],
                ["corsJson(data, init?)", "Return a JSON Response with CORS headers. Useful for unprotected routes that still need CORS."],
                ["corsHeaders()", "Raw CORS headers record for custom responses."],
              ]}
            />
            <P>
              The <InlineCode>withSiwa</InlineCode> handler receives <InlineCode>(agent: SiwaAgent, req: Request)</InlineCode> and can return a plain object (auto-wrapped in JSON) or a Response.
            </P>
            <CodeBlock language="typescript">{`import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

// Protected POST endpoint — 3 lines instead of ~20
export const POST = withSiwa(async (agent, req) => {
  const body = await req.json();
  return {
    received: body,
    agent: { address: agent.address, agentId: agent.agentId },
  };
});

// Protected GET endpoint
export const GET = withSiwa(async (agent) => {
  return { message: \`Hello Agent #\${agent.agentId}!\` };
});

// CORS preflight
export { siwaOptions as OPTIONS };`}</CodeBlock>
            <P>
              Options: <InlineCode>receiptSecret</InlineCode> (defaults to <InlineCode>RECEIPT_SECRET</InlineCode> or <InlineCode>SIWA_SECRET</InlineCode> env), <InlineCode>rpcUrl</InlineCode>, <InlineCode>verifyOnchain</InlineCode>.
            </P>
          </SubSection>

          <SubSection id="api-express" title="@buildersgarden/siwa/express">
            <P>
              Server-side wrappers for Express applications. Requires <InlineCode>express</InlineCode> as a peer dependency.
            </P>
            <Table
              headers={["Export", "Description"]}
              rows={[
                ["siwaMiddleware(options?)", "Auth middleware: verifies ERC-8128 signature + receipt, sets req.agent, returns 401 on failure."],
                ["siwaJsonParser()", "express.json() with rawBody capture for Content-Digest verification."],
                ["siwaCors(options?)", "CORS middleware with SIWA-specific headers. Handles OPTIONS preflight."],
              ]}
            />
            <CodeBlock language="typescript">{`import express from 'express';
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";

const app = express();
app.use(siwaJsonParser());
app.use(siwaCors());

app.get('/api/protected', siwaMiddleware(), (req, res) => {
  res.json({ agent: req.agent });
});

app.post('/api/action', siwaMiddleware(), (req, res) => {
  res.json({ received: req.body, agent: req.agent });
});`}</CodeBlock>
            <P>
              The middleware adds <InlineCode>agent</InlineCode> and <InlineCode>rawBody</InlineCode> to the Express Request type via module augmentation.
            </P>
          </SubSection>

          <div className="mt-8 rounded-lg border border-border bg-surface px-5 py-4">
            <p className="text-sm text-muted leading-relaxed">
              <strong className="text-foreground">Low-level primitives</strong> — The wrappers above are the recommended approach for new projects. If you need full control, the underlying functions (<InlineCode>verifyAuthenticatedRequest</InlineCode>, <InlineCode>expressToFetchRequest</InlineCode>, <InlineCode>nextjsToFetchRequest</InlineCode>) are still available from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode>.
            </p>
          </div>
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

          <SubSection id="security-identity" title="IDENTITY.md: Public Data Only">
            <P>
              The agent&apos;s identity file stores only public state — address, agentId, agentRegistry, chainId. The private key is never written to IDENTITY.md or any other file the agent reads.
            </P>
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
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Base Sepolia</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">84532</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004A818BFB912233c491871b3d84c89A494BD9e" /></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">ETH Sepolia</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">11155111</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004a6090Cd10A7288092483047B097295Fb8847" /></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Linea Sepolia</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">59141</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004aa7C931bCE1233973a0C6A667f73F66282e7" /></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Polygon Amoy</td>
                    <td className="py-2 pr-4 text-muted font-mono text-xs">80002</td>
                    <td className="py-2 pr-4"><CopyableAddress address="0x8004ad19E14B9e0654f73353e8a0B600D46C2898" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SubSection>

          <SubSection id="contracts-solana" title="Solana">
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Network</th>
                    <th className="py-2 pr-4 text-left font-mono text-xs font-medium text-dim">Program ID</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted font-mono text-xs">Devnet</td>
                    <td className="py-2 pr-4"><CopyableAddress address="HvF3JqhahcX7JfhbDRYYCJ7S3f6nJdrqu5yi9shyTREp" /></td>
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
                ["Base Sepolia", "https://sepolia.base.org"],
                ["ETH Sepolia", "https://rpc.sepolia.org"],
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
