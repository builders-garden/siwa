import { Metadata } from "next";
import { DocsSidebar } from "@/components/docs-sidebar";
import { CopyableAddress } from "@/components/copyable-address";

export const metadata: Metadata = {
  title: "Docs — SIWA",
  description:
    "Documentation for SIWA (Sign In With Agent) — getting started, API reference, security model, protocol spec, and contract addresses.",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-relaxed text-muted">
      <code>{children}</code>
    </pre>
  );
}

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
                <span>If everything checks out, the service returns a <strong className="text-foreground">JWT session token</strong>. The agent is now authenticated.</span>
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
              alt="SIWA authentication flow: Agent requests nonce from Service, signs SIWA message, Service verifies signature and checks onchain ownership, returns JWT session token"
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
            <CodeBlock>{`git clone https://github.com/builders-garden/siwa
cd siwa && pnpm install
cd packages/siwa-testing && pnpm run dev`}</CodeBlock>
          </SubSection>

          <SubSection id="installation" title="Install the SDK">
            <CodeBlock>{`npm install @buildersgarden/siwa`}</CodeBlock>
            <P>
              The package exposes several modules:
            </P>
            <CodeBlock>{`// Core — build & verify SIWA messages
import { signSIWAMessage, verifySIWA } from '@buildersgarden/siwa';

// Keystore — wallet creation & signing (agent never sees the private key)
import { createWallet, signMessage, getAddress } from '@buildersgarden/siwa/keystore';

// Registry — read agent profiles & reputation onchain
import { getAgent, getReputation } from '@buildersgarden/siwa/registry';

// Helpers
import { readMemory, writeMemoryField } from '@buildersgarden/siwa/memory';
import { computeHMAC } from '@buildersgarden/siwa/proxy-auth';`}</CodeBlock>
          </SubSection>

          <SubSection id="sign-up" title="Step 3: Sign Up (Registration) — Optional">
            <P>
              If your agent is already registered onchain (has an <InlineCode>agentId</InlineCode>), skip to Step 4. Otherwise, register by creating a wallet, building a registration file, and calling the Identity Registry contract.
            </P>
            <CodeBlock>{`import { createWallet, signTransaction, getAddress } from '@buildersgarden/siwa/keystore';
import { writeMemoryField } from '@buildersgarden/siwa/memory';

// 1. Create wallet (key goes to proxy, never returned)
const info = await createWallet();
writeMemoryField('Address', info.address);
writeMemoryField('Keystore Backend', info.backend);

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
            <CodeBlock>{`import { signSIWAMessage } from '@buildersgarden/siwa';

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

// 3. Send to server → get a session token back
const { token } = await fetch('https://example.com/api/siwa/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, signature }),
}).then(r => r.json());`}</CodeBlock>
            <P>
              That&apos;s it. The agent now has a JWT it can use for authenticated requests.
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
            <CodeBlock>{`import { verifySIWA } from '@buildersgarden/siwa';

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

// Issue session
const token = jwt.sign(result, SECRET, { expiresIn: '1h' });`}</CodeBlock>
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
            <CodeBlock>{`import { verifySIWA } from '@buildersgarden/siwa';

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
            <CodeBlock>{`import { getAgent, getReputation } from '@buildersgarden/siwa/registry';

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

          <SubSection id="api-memory" title="@buildersgarden/siwa/memory">
            <P>
              Helpers for reading and writing the agent&apos;s public identity state in MEMORY.md.
            </P>
            <Table
              headers={["Function", "Description"]}
              rows={[
                ["ensureMemoryExists(path, template)", "Initialize MEMORY.md from template if missing."],
                ["readMemory(path)", "Parse MEMORY.md into key-value pairs."],
                ["writeMemoryField(key, value)", "Write a single field to MEMORY.md."],
                ["hasWalletRecord(path)", "Check if wallet info exists in MEMORY.md."],
                ["isRegistered(path)", "Check if agent is registered."],
                ["appendToMemorySection(section, line)", "Append a line to a section."],
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
            <CodeBlock>{`Agent Process                     Keyring Proxy
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

          <SubSection id="security-memory" title="MEMORY.md: Public Data Only">
            <P>
              The agent&apos;s memory file stores only public identity state — address, agentId, registration status, session tokens. The private key is never written to MEMORY.md or any other file the agent reads.
            </P>
          </SubSection>
        </Section>

        {/* Signing Policies */}
        <Section id="policies" title="Signing Policies">
          <P>
            The keyring proxy includes a policy engine that controls what the agent can sign. Policies act as guardrails — even if an agent is compromised, it can only sign operations that match the defined rules.
          </P>

          <SubSection id="policies-overview" title="How Policies Work">
            <P>
              Every signing request is evaluated against the wallet&apos;s attached policies before the key is used. The evaluation follows a deny-first model:
            </P>
            <ol className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">1.</span>
                <span>If <strong className="text-foreground">any DENY rule</strong> matches, the request is rejected immediately.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">2.</span>
                <span>If <strong className="text-foreground">any ALLOW rule</strong> matches (and no DENY fired), the request is approved.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">3.</span>
                <span>If <strong className="text-foreground">no rules match</strong>, the request is denied (secure by default).</span>
              </li>
            </ol>
            <P>
              This means DENY rules always take precedence, and you must have at least one ALLOW rule for any operation to succeed.
            </P>
          </SubSection>

          <SubSection id="policies-default" title="Default Policy">
            <P>
              When you create a wallet via <InlineCode>/create-wallet</InlineCode>, a default policy is automatically attached. This policy allows:
            </P>
            <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span>Transactions up to <strong className="text-foreground">0.1 ETH</strong> in value</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span>All message signing (for SIWA authentication)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span>All EIP-7702 authorization signing</span>
              </li>
            </ul>
            <P>
              You can skip the default policy by passing <InlineCode>{`{ "skip_default_policy": true }`}</InlineCode> when creating the wallet, then attach your own custom policies.
            </P>
          </SubSection>

          <SubSection id="policies-structure" title="Policy Structure">
            <P>
              A policy is a JSON object containing one or more rules. Each rule specifies which method it applies to, an action (ALLOW or DENY), and conditions that must all be true for the rule to fire.
            </P>
            <CodeBlock>{`{
  "name": "Spending limit policy",
  "version": "1.0",
  "chain_type": "ethereum",
  "rules": [
    {
      "name": "Allow small transactions",
      "method": "sign_transaction",
      "action": "ALLOW",
      "conditions": [
        {
          "field_source": "ethereum_transaction",
          "field": "value",
          "operator": "lte",
          "value": "100000000000000000"  // 0.1 ETH in wei
        }
      ]
    },
    {
      "name": "Block large transactions",
      "method": "sign_transaction",
      "action": "DENY",
      "conditions": [
        {
          "field_source": "ethereum_transaction",
          "field": "value",
          "operator": "gt",
          "value": "1000000000000000000"  // 1 ETH in wei
        }
      ]
    }
  ]
}`}</CodeBlock>
          </SubSection>

          <SubSection id="policies-fields" title="Field Sources & Operators">
            <P>
              Conditions can evaluate fields from different sources depending on the signing method:
            </P>
            <Table
              headers={["Field Source", "Available Fields"]}
              rows={[
                ["ethereum_transaction", "to, value, chain_id, gas, data, nonce"],
                ["ethereum_calldata", "function_name, <function>.<param> (requires ABI)"],
                ["message", "content, length, is_hex"],
                ["ethereum_authorization", "contract, chain_id"],
                ["system", "current_unix_timestamp"],
              ]}
            />
            <P>
              Supported operators:
            </P>
            <Table
              headers={["Operator", "Description"]}
              rows={[
                ["eq, neq", "Equality / inequality"],
                ["lt, lte, gt, gte", "Numeric comparison (supports BigInt for wei)"],
                ["in, not_in", "Array membership"],
                ["matches", "Regex pattern matching"],
              ]}
            />
          </SubSection>

          <SubSection id="policies-examples" title="Policy Examples">
            <P>
              <strong className="text-foreground">Chain restriction</strong> — Only allow transactions on Base:
            </P>
            <CodeBlock>{`{
  "name": "Base only",
  "method": "sign_transaction",
  "action": "ALLOW",
  "conditions": [{
    "field_source": "ethereum_transaction",
    "field": "chain_id",
    "operator": "eq",
    "value": 8453
  }]
}`}</CodeBlock>
            <P>
              <strong className="text-foreground">Contract allowlist</strong> — Only allow interactions with specific contracts:
            </P>
            <CodeBlock>{`{
  "name": "Allowed contracts only",
  "method": "sign_transaction",
  "action": "ALLOW",
  "conditions": [{
    "field_source": "ethereum_transaction",
    "field": "to",
    "operator": "in",
    "value": [
      "0x1234...",  // Your allowed contract
      "0x5678..."   // Another allowed contract
    ]
  }]
}`}</CodeBlock>
            <P>
              <strong className="text-foreground">Block unlimited approvals</strong> — Deny ERC-20 approvals for max uint256:
            </P>
            <CodeBlock>{`{
  "name": "No unlimited approvals",
  "method": "sign_transaction",
  "action": "DENY",
  "conditions": [
    {
      "field_source": "ethereum_calldata",
      "field": "function_name",
      "operator": "eq",
      "value": "approve",
      "abi": [{ "name": "approve", "type": "function", ... }]
    },
    {
      "field_source": "ethereum_calldata",
      "field": "approve.amount",
      "operator": "eq",
      "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    }
  ]
}`}</CodeBlock>
            <P>
              <strong className="text-foreground">SIWA messages only</strong> — Only allow signing SIWA authentication messages:
            </P>
            <CodeBlock>{`{
  "name": "SIWA sign-in only",
  "method": "sign_message",
  "action": "ALLOW",
  "conditions": [{
    "field_source": "message",
    "field": "content",
    "operator": "matches",
    "value": "wants you to sign in with your Agent account"
  }]
}`}</CodeBlock>
          </SubSection>

          <SubSection id="policies-api" title="Policy Management API">
            <P>
              Policies are managed via the keyring proxy API. All policy endpoints require HMAC authentication, and create/update/delete operations require the <InlineCode>KEYRING_POLICY_ADMIN_SECRET</InlineCode> if configured.
            </P>
            <Table
              headers={["Endpoint", "Description"]}
              rows={[
                ["GET /policies", "List all policies"],
                ["POST /policies", "Create a new policy (admin)"],
                ["GET /policies/:id", "Get a specific policy"],
                ["PUT /policies/:id", "Update a policy (admin)"],
                ["DELETE /policies/:id", "Delete a policy (admin)"],
                ["GET /wallets/:address/policies", "List policies attached to a wallet"],
                ["POST /wallets/:address/policies", "Attach a policy to a wallet (admin)"],
                ["DELETE /wallets/:address/policies/:id", "Detach a policy from a wallet (admin)"],
              ]}
            />
            <P>
              For deployment and environment variable configuration, see the{" "}
              <a
                href="/docs/deploy#env-keyring-proxy"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                deployment guide
              </a>
              .
            </P>
          </SubSection>
        </Section>

        {/* Protocol Spec */}
        <Section id="protocol" title="Protocol Specification">
          <SubSection id="protocol-message" title="Message Format">
            <CodeBlock>{`{domain} wants you to sign in with your Agent account:
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
              <strong className="text-foreground">5. Session</strong> — Issue JWT with address, agentId, agentRegistry, chainId.
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
            <CodeBlock>{`{namespace}:{chainId}:{identityRegistryAddress}

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
