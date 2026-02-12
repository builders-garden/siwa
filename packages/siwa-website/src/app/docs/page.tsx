import { Metadata } from "next";
import { DocsSidebar } from "@/components/docs-sidebar";
import { CopyableAddress } from "@/components/copyable-address";
import { CodeBlock } from "@/components/code-block";
import { ImageModal } from "@/components/image-modal";
import { GettingStartedTabs } from "@/components/getting-started-tabs";

export const metadata: Metadata = {
  title: "Docs — SIWA",
  description:
    "Documentation for SIWA (Sign In With Agent) — getting started, API reference, wallet integration, and contract addresses.",
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
            <span className="font-mono font-semibold text-accent">What is SIWA?</span>{" "}
            SIWA (Sign In With Agent) helps AI agents authenticate with services using their{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-8004"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
            >
              ERC-8004
            </a>{" "}
            onchain identity. Like SIWE (Sign In With Ethereum) for humans, but for agents with verifiable registration.
          </p>
          <p className="text-sm text-muted leading-relaxed mt-3">
            <span className="font-mono font-semibold text-accent">For AI agents:</span>{" "}
            Read{" "}
            <a
              href="/skill.md"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              /skill.md
            </a>{" "}
            for structured instructions.
          </p>
        </div>

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started">
          <P>
            SIWA provides two core capabilities:
          </P>
          <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
            <li className="flex gap-3">
              <span className="text-accent shrink-0">&#x2022;</span>
              <span><strong className="text-foreground">Agent-side:</strong> Sign SIWA messages to prove ownership of an ERC-8004 identity</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent shrink-0">&#x2022;</span>
              <span><strong className="text-foreground">Server-side:</strong> Verify signatures and check onchain registration</span>
            </li>
          </ul>

          <GettingStartedTabs />

          <div className="mt-8 mb-4 grid gap-3 sm:grid-cols-3">
            <a
              href="#wallets"
              className="rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Wallet Options</h4>
              <p className="text-xs text-dim">Use any wallet: Privy, MetaMask, private key, or keyring proxy.</p>
            </a>
            <a
              href="#api"
              className="rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">API Reference</h4>
              <p className="text-xs text-dim">SDK functions, modules, and types.</p>
            </a>
            <a
              href="#protocol"
              className="rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Protocol Spec</h4>
              <p className="text-xs text-dim">Message format and authentication flow.</p>
            </a>
          </div>
        </Section>

        {/* How It Works */}
        <Section id="architecture" title="How It Works">
          <SubSection id="auth-flow" title="Authentication Flow">
            <ol className="space-y-3 mb-6 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">1.</span>
                <span>The agent requests a <strong className="text-foreground">nonce</strong> from the service, sending its address and agent ID.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">2.</span>
                <span>The service returns the nonce along with timestamps.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">3.</span>
                <span>The agent builds a SIWA message and <strong className="text-foreground">signs it</strong> with its wallet.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">4.</span>
                <span>The agent sends the message and signature to the service.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">5.</span>
                <span>The service <strong className="text-foreground">verifies</strong> the signature and calls the blockchain to confirm the agent owns that identity NFT.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-semibold text-accent shrink-0">6.</span>
                <span>If verified, the service returns a <strong className="text-foreground">receipt</strong>. The agent uses this for subsequent authenticated requests.</span>
              </li>
            </ol>
            <P>
              The SDK provides two main functions:
            </P>
            <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Agent-side:</strong> <InlineCode>signSIWAMessage(fields, signer)</InlineCode> — builds and signs the message</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Server-side:</strong> <InlineCode>verifySIWA(message, signature, options)</InlineCode> — validates signature and checks onchain ownership</span>
              </li>
            </ul>

            <ImageModal
              src="/siwa-flow.png"
              alt="SIWA authentication flow: Agent requests nonce, signs SIWA message, Service verifies signature and checks onchain ownership, returns HMAC-signed verification receipt, then subsequent API requests use ERC-8128 HTTP signatures"
              className="w-full rounded-lg border border-border"
              width={800}
              height={730}
            />
          </SubSection>
        </Section>

        {/* Wallet Options */}
        <Section id="wallets" title="Wallet Options">
          <P>
            SIWA is <strong className="text-foreground">wallet-agnostic</strong>. The SDK provides a unified <InlineCode>Signer</InlineCode> interface that works with any wallet provider. You choose how to manage keys — SIWA handles the authentication.
          </P>

          <div className="rounded-lg bg-surface border border-border px-4 py-3 mb-6">
            <p className="text-sm text-muted">
              <strong className="text-foreground">The Signer interface:</strong> All signing operations use a simple interface with <InlineCode>getAddress()</InlineCode> and <InlineCode>signMessage()</InlineCode>. Create a signer from any wallet type and pass it to SIWA functions.
            </p>
          </div>

          <SubSection id="wallet-privy" title="Embedded Wallets (Privy, Dynamic, Magic)">
            <P>
              For embedded wallet providers that give you a WalletClient or EIP-1193 provider:
            </P>
            <CodeBlock language="typescript">{`import { createWalletClientSigner } from "@buildersgarden/siwa/signer";
import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

// Privy example
const provider = await privyWallet.getEthereumProvider();
const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(provider),
});
const signer = createWalletClientSigner(walletClient);

// Now use with SIWA
const { message, signature } = await signSIWAMessage(fields, signer);`}</CodeBlock>
          </SubSection>

          <SubSection id="wallet-browser" title="Browser Wallets (MetaMask, Coinbase, WalletConnect)">
            <P>
              For browser-injected wallets:
            </P>
            <CodeBlock language="typescript">{`import { createWalletClientSigner } from "@buildersgarden/siwa/signer";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

const walletClient = createWalletClient({
  chain: base,
  transport: custom(window.ethereum),
});
const signer = createWalletClientSigner(walletClient);`}</CodeBlock>
          </SubSection>

          <SubSection id="wallet-privatekey" title="Private Key (Backend Scripts)">
            <P>
              For server-side agents or scripts with direct private key access:
            </P>
            <CodeBlock language="typescript">{`import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);
const signer = createLocalAccountSigner(account);`}</CodeBlock>
          </SubSection>

          <SubSection id="wallet-keyring" title="Keyring Proxy (Self-Hosted, Non-Custodial)">
            <P>
              For AI agents that need secure key isolation, we provide an optional <strong className="text-foreground">keyring proxy</strong> — a separate service that holds the encrypted private key and performs all signing. The agent never touches the key.
            </P>
            <CodeBlock language="typescript">{`import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});`}</CodeBlock>
            <P>
              The keyring proxy is completely optional. It&apos;s useful when you want:
            </P>
            <ul className="space-y-2 mb-4 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span>Key isolation from the agent process (protection against prompt injection)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span>Optional 2FA via Telegram for transaction approval</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span>Self-hosted, non-custodial key management</span>
              </li>
            </ul>
            <P>
              See{" "}
              <a
                href="/docs/deploy"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                Deploy
              </a>{" "}
              for keyring proxy setup, architecture, and security model.
            </P>
          </SubSection>

          <SubSection id="signer-interface" title="Signer Interface">
            <CodeBlock language="typescript">{`interface Signer {
  getAddress(): Promise<Address>;
  signMessage(message: string): Promise<Hex>;
  signRawMessage?(rawHex: Hex): Promise<Hex>;  // For ERC-8128
}

interface TransactionSigner extends Signer {
  signTransaction(tx: TransactionRequest): Promise<Hex>;
}`}</CodeBlock>
          </SubSection>
        </Section>

        {/* API Reference */}
        <Section id="api" title="API Reference">
          <P>
            Install the SDK: <InlineCode>npm install @buildersgarden/siwa viem</InlineCode>
          </P>

          {/* Signer */}
          <SubSection id="api-signer" title="Signer">
            <P>
              Create signers from any wallet provider.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["createLocalAccountSigner(account)", "TransactionSigner", "Create signer from viem LocalAccount (private key)."],
                ["createWalletClientSigner(client, account?)", "Signer", "Create signer from viem WalletClient (Privy, MetaMask, etc.)."],
                ["createKeyringProxySigner(config)", "TransactionSigner", "Create signer from keyring proxy service."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/signer</InlineCode>.
            </P>
          </SubSection>

          {/* SIWA Signing */}
          <SubSection id="api-signing" title="SIWA Signing">
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["signSIWAMessage(fields, signer)", "{ message, signature, address }", "Build and sign a SIWA message."],
                ["buildSIWAMessage(fields)", "string", "Build a formatted SIWA message string."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa</InlineCode>.
            </P>
            <CodeBlock language="typescript">{`import { signSIWAMessage } from "@buildersgarden/siwa";

const { message, signature, address } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce: nonceFromServer,
  issuedAt: new Date().toISOString(),
}, signer);`}</CodeBlock>
          </SubSection>

          {/* SIWA Verification */}
          <SubSection id="api-verification" title="SIWA Verification">
            <P>
              Server-side functions for verifying agent identity.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["verifySIWA(msg, sig, options)", "SIWAVerificationResult", "Verify signature + onchain ownership."],
                ["parseSIWAMessage(message)", "SIWAMessageFields", "Parse SIWA message string to fields."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa</InlineCode>. The <InlineCode>options</InlineCode> argument:
            </P>
            <Table
              headers={["Option", "Type", "Description"]}
              rows={[
                ["client", "PublicClient", "viem PublicClient for onchain verification."],
                ["expectedDomain", "string", "Must match message domain."],
                ["expectedAgentRegistry", "string", "Must match message registry."],
                ["skipOnchainVerification", "boolean", "Skip registry check (signature-only mode)."],
              ]}
            />
            <CodeBlock language="typescript">{`import { verifySIWA, parseSIWAMessage } from "@buildersgarden/siwa";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const result = await verifySIWA(message, signature, {
  client,
  expectedDomain: "api.example.com",
  expectedAgentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
});

if (result.success) {
  console.log("Verified agent:", result.data.agentId);
}`}</CodeBlock>
          </SubSection>

          {/* ERC-8128 */}
          <SubSection id="api-erc8128" title="ERC-8128 Request Signing">
            <P>
              After SIWA sign-in, use ERC-8128 HTTP Message Signatures for authenticated API calls.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["signAuthenticatedRequest(req, receipt, signer, chainId)", "Request", "Sign outgoing request with ERC-8128."],
                ["verifyAuthenticatedRequest(req, options)", "AuthResult", "Verify incoming signed request."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode>.
            </P>
            <CodeBlock language="typescript">{`import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

const request = new Request("https://api.example.com/action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "transfer" }),
});

const signedRequest = await signAuthenticatedRequest(
  request,
  receipt,  // from SIWA sign-in
  signer,
  84532
);

const response = await fetch(signedRequest);`}</CodeBlock>
          </SubSection>

          {/* Receipts */}
          <SubSection id="api-receipts" title="Receipts">
            <P>
              Stateless HMAC-signed tokens that prove successful SIWA verification.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["createReceipt(payload, options)", "{ receipt, expiresAt }", "Create an HMAC-signed receipt."],
                ["verifyReceipt(receipt, secret)", "ReceiptPayload | null", "Verify and decode. Returns null if invalid."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/receipt</InlineCode>.
            </P>
          </SubSection>

          {/* Server Wrappers */}
          <SubSection id="api-wrappers" title="Server Wrappers">
            <P>
              High-level middleware for Express and Next.js.
            </P>

            <div id="api-wrappers-next" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Next.js</h4>
            </div>
            <Table
              headers={["Export", "Description"]}
              rows={[
                ["withSiwa(handler, options?)", "Wrap route handler with ERC-8128 auth."],
                ["siwaOptions()", "Return 204 OPTIONS response with CORS."],
                ["corsJson(data, init?)", "JSON Response with CORS headers."],
              ]}
            />
            <CodeBlock language="typescript">{`import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

export const POST = withSiwa(async (agent, req) => {
  return { agent: { address: agent.address, agentId: agent.agentId } };
});

export { siwaOptions as OPTIONS };`}</CodeBlock>

            <div id="api-wrappers-express" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Express</h4>
            </div>
            <Table
              headers={["Export", "Description"]}
              rows={[
                ["siwaMiddleware(options?)", "Auth middleware for protected routes."],
                ["siwaJsonParser()", "JSON parser with rawBody capture."],
                ["siwaCors(options?)", "CORS middleware with SIWA headers."],
              ]}
            />
            <CodeBlock language="typescript">{`import express from "express";
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";

const app = express();
app.use(siwaJsonParser());
app.use(siwaCors());

app.get("/api/protected", siwaMiddleware(), (req, res) => {
  res.json({ agent: req.agent });
});`}</CodeBlock>
          </SubSection>

          {/* Identity & Registry */}
          <SubSection id="api-identity" title="Identity & Registry">
            <P>
              Read and write agent identity state, query onchain profiles.
            </P>

            <div id="api-identity-file" className="scroll-mt-20 mt-6 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Identity File</h4>
            </div>
            <Table
              headers={["Function", "Description"]}
              rows={[
                ["ensureIdentityExists(path, template)", "Initialize SIWA_IDENTITY.md if missing."],
                ["readIdentity(path)", "Parse SIWA_IDENTITY.md to typed object."],
                ["writeIdentityField(key, value, path)", "Write a field to SIWA_IDENTITY.md."],
                ["isRegistered({ identityPath, client? })", "Check registration status."],
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
                ["registerAgent(options)", "RegisterResult", "Register as ERC-8004 agent onchain."],
                ["getAgent(agentId, options)", "AgentProfile", "Read agent profile from registry."],
                ["getReputation(agentId, options)", "ReputationSummary", "Read agent reputation."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/registry</InlineCode>.
            </P>
          </SubSection>

          {/* Keystore (Proxy Admin) */}
          <SubSection id="api-keystore" title="Keystore (Proxy Admin)">
            <P>
              Administrative functions for the keyring proxy. Only needed if using the keyring proxy.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["createWallet(config?)", "{ address }", "Create a new wallet in the proxy."],
                ["hasWallet(config?)", "boolean", "Check if wallet exists."],
                ["getAddress(config?)", "string | null", "Get wallet address."],
                ["signAuthorization(auth, config?)", "SignedAuthorization", "Sign EIP-7702 authorization."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/keystore</InlineCode>.
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
              For production, use a provider like Alchemy or Infura with your own API key.
            </P>
          </SubSection>

          <SubSection id="contracts-explorer" title="Explorer">
            <P>
              View registered agents at{" "}
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
              Live HTTP endpoints to try the full SIWA auth flow.
            </p>
          </a>
          <a
            href="/docs/deploy"
            className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
          >
            <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
              Deploy Keyring Proxy
            </h4>
            <p className="text-xs text-muted">
              Self-hosted key management with optional 2FA for AI agents.
            </p>
          </a>
        </div>
      </article>
    </div>
  );
}
