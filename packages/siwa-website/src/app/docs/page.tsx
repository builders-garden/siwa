import { Metadata } from "next";
import { DocsSidebar } from "@/components/docs-sidebar";

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
            SIWA lets AI agents authenticate with off-chain services by proving ownership of an ERC-8004 identity NFT. Install the SDK, create a wallet, register onchain, and authenticate.
          </P>

          <SubSection id="installation" title="Installation">
            <CodeBlock>{`npm install @buildersgarden/siwa`}</CodeBlock>
            <P>
              The <InlineCode>@buildersgarden/siwa</InlineCode> package exposes four modules via package exports:
            </P>
            <CodeBlock>{`import { createWallet, signMessage, getAddress } from '@buildersgarden/siwa/keystore';
import { signSIWAMessage, verifySIWA } from '@buildersgarden/siwa';
import { getAgent, getReputation } from '@buildersgarden/siwa/registry';
import { readMemory, writeMemoryField } from '@buildersgarden/siwa/memory';
import { computeHMAC } from '@buildersgarden/siwa/proxy-auth';`}</CodeBlock>
          </SubSection>

          <SubSection id="quick-start" title="Quick Start">
            <P>
              The fastest way to try SIWA is with the test harness:
            </P>
            <CodeBlock>{`git clone https://github.com/builders-garden/siwa
cd siwa
pnpm install

# Run the full flow: wallet creation → registration → SIWA sign-in
cd packages/siwa-testing
pnpm run dev`}</CodeBlock>
          </SubSection>

          <SubSection id="sign-up" title="Sign Up (Registration)">
            <P>
              Register an agent by creating a wallet, building a registration file, and calling the Identity Registry contract.
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
const iface = new ethers.Interface([
  'function register(string agentURI) external returns (uint256 agentId)'
]);
const data = iface.encodeFunctionData('register', [agentURI]);
const { signedTx } = await signTransaction({ to: REGISTRY, data, ... });
const tx = await provider.broadcastTransaction(signedTx);`}</CodeBlock>
          </SubSection>

          <SubSection id="sign-in" title="Sign In (SIWA Authentication)">
            <P>
              Authenticate with any SIWA-aware service using the challenge-response flow.
            </P>
            <CodeBlock>{`import { signSIWAMessage } from '@buildersgarden/siwa';

// 1. Request nonce from server
const { nonce, issuedAt, expirationTime } = await fetch(
  'https://api.example.com/siwa/nonce',
  { method: 'POST', body: JSON.stringify({ address, agentId, agentRegistry }) }
).then(r => r.json());

// 2. Sign SIWA message (key never exposed — signs via proxy)
const { message, signature } = await signSIWAMessage({
  domain: 'api.example.com',
  address,
  statement: 'Authenticate as a registered ERC-8004 agent.',
  uri: 'https://api.example.com/siwa',
  agentId,
  agentRegistry,
  chainId,
  nonce,
  issuedAt,
  expirationTime
});

// 3. Submit to server for verification
const session = await fetch('https://api.example.com/siwa/verify', {
  method: 'POST',
  body: JSON.stringify({ message, signature })
}).then(r => r.json());
// session.token contains the JWT`}</CodeBlock>
          </SubSection>

          <SubSection id="verify" title="Server-Side Verification">
            <P>
              On the server, use <InlineCode>verifySIWA</InlineCode> to validate the signature, recover the signer, and check all protocol fields.
            </P>
            <CodeBlock>{`import { verifySIWA } from '@buildersgarden/siwa';

// In your /siwa/verify endpoint handler:
const { message, signature } = req.body;

const result = verifySIWA(message, signature, {
  domain: 'api.example.com',      // must match your server's origin
  nonce: storedNonce,              // the nonce you issued earlier
});

// result contains:
// {
//   address,        — recovered signer address
//   agentId,        — ERC-8004 agent token ID
//   agentRegistry,  — registry contract identifier
//   chainId,        — chain ID from the message
// }

// IMPORTANT: also verify onchain ownership
const owner = await identityRegistry.ownerOf(result.agentId);
if (owner.toLowerCase() !== result.address.toLowerCase()) {
  throw new Error('Signer does not own this agent NFT');
}

// All checks passed — issue a session token
const token = jwt.sign(result, SECRET, { expiresIn: '1h' });`}</CodeBlock>
          </SubSection>
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
            <CodeBlock>{`Agent Process                     Keyring Proxy (port 3100)
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
            <Table
              headers={["Chain", "Chain ID", "Identity Registry", "Reputation Registry"]}
              rows={[
                ["Base", "8453", "0x8004A169...a432", "0x8004BAa1...9b63"],
              ]}
            />
          </SubSection>

          <SubSection id="contracts-testnet" title="Testnets">
            <Table
              headers={["Chain", "Chain ID", "Identity Registry"]}
              rows={[
                ["Base Sepolia", "84532", "0x8004A818...BD9e"],
                ["ETH Sepolia", "11155111", "0x8004a609...8847"],
                ["Linea Sepolia", "59141", "0x8004aa7C...82e7"],
                ["Polygon Amoy", "80002", "0x8004ad19...2898"],
              ]}
            />
          </SubSection>

          <SubSection id="contracts-solana" title="Solana">
            <Table
              headers={["Network", "Program ID"]}
              rows={[
                ["Devnet", "HvF3JqhahcX7JfhbDRYYCJ7S3f6nJdrqu5yi9shyTREp"],
              ]}
            />
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
