import { Metadata } from "next";
import { DocsSidebar } from "@/components/docs-sidebar";
import { CopyableAddress } from "@/components/copyable-address";
import { CodeBlock, CollapsibleCodeBlock } from "@/components/code-block";
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
  rows: React.ReactNode[][];
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
              href="https://8004.org"
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
              href="https://siwa.id/skill.md"
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
              <span><strong className="text-foreground">Server-side:</strong> Verify signatures and check onchain registration with multiple modular criteria</span>
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
                <span><strong className="text-foreground">Server-side:</strong> <InlineCode>verifySIWA(message, signature, domain, nonceValid, client, criteria?)</InlineCode> — validates signature and checks onchain ownership</span>
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
        <Section id="signing" title="Signing (Agent-Side)">
          <P>
            Everything an agent needs to authenticate: choose a signer, sign SIWA messages for initial sign-in, then sign subsequent API requests with ERC-8128. <br></br> SIWA supports both <strong className="text-foreground">EOA</strong> (Externally Owned Account) and <strong className="text-foreground">SCA</strong> (Smart Contract Account) signers — agents backed by smart wallets like Safe, Base Accounts, or ERC-6551 Token Bound Accounts work alongside traditional EOA-based agents.
          </P>

          <SubSection id="wallet-circle" title="Circle">
            <P>
              Circle&apos;s developer-controlled wallets provide secure key management for AI agents. Install the Circle SDK alongside SIWA:
            </P>
            <CodeBlock language="bash">{`npm install @circle-fin/developer-controlled-wallets`}</CodeBlock>
            <P>
              Create a signer from your Circle wallet credentials:
            </P>
            <CollapsibleCodeBlock title="Circle Signer Example" language="typescript">{`import { signSIWAMessage } from "@buildersgarden/siwa";
import { createCircleSiwaSigner } from "@buildersgarden/siwa/signer";

// Create signer - wallet address is fetched automatically from Circle
const signer = await createCircleSiwaSigner({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  walletId: process.env.CIRCLE_WALLET_ID!,
});

// Sign SIWA message
const { message, signature, address } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt: new Date().toISOString(),
}, signer);`}</CollapsibleCodeBlock>
            <P>
              If you already have a Circle client instance, use <InlineCode>createCircleSiwaSignerFromClient</InlineCode>:
            </P>
            <CollapsibleCodeBlock title="From Existing Client" language="typescript">{`import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createCircleSiwaSignerFromClient } from "@buildersgarden/siwa/signer";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const signer = await createCircleSiwaSignerFromClient({
  client,
  walletId: process.env.CIRCLE_WALLET_ID!,
});`}</CollapsibleCodeBlock>
          </SubSection>

          <SubSection id="wallet-privy" title="Privy">
            <P>
              Privy&apos;s server wallets provide embedded wallet infrastructure for AI agents. Install the Privy Node SDK alongside SIWA:
            </P>
            <CodeBlock language="bash">{`npm install @privy-io/node`}</CodeBlock>
            <P>
              Create a signer from your Privy wallet:
            </P>
            <CollapsibleCodeBlock title="Privy Signer Example" language="typescript">{`import { PrivyClient } from "@privy-io/node";
import { signSIWAMessage } from "@buildersgarden/siwa";
import { createPrivySiwaSigner } from "@buildersgarden/siwa/signer";

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

const signer = createPrivySiwaSigner({
  client: privy,
  walletId: process.env.PRIVY_WALLET_ID!,
  walletAddress: process.env.PRIVY_WALLET_ADDRESS! as \`0x\${string}\`,
});

// Sign SIWA message
const { message, signature, address } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt: new Date().toISOString(),
}, signer);`}</CollapsibleCodeBlock>
          </SubSection>

          <SubSection id="wallet-privatekey" title="Private Key (Backend Scripts)">
            <P>
              For server-side agents or scripts with direct private key access:
            </P>
            <CollapsibleCodeBlock title="Private Key Signer Example" language="typescript">{`import { signSIWAMessage } from "@buildersgarden/siwa";
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);
const signer = createLocalAccountSigner(account);

// Sign SIWA message
const { message, signature } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt: new Date().toISOString(),
}, signer);`}</CollapsibleCodeBlock>
          </SubSection>

          <SubSection id="wallet-keyring" title="Keyring Proxy (Self-Hosted, Non-Custodial)">
            <P>
              For AI agents that need secure key isolation, we provide an optional <strong className="text-foreground">keyring proxy</strong> — a separate service that holds the encrypted private key and performs all signing. The agent never touches the key.
            </P>
            <CollapsibleCodeBlock title="Keyring Proxy Example" language="typescript">{`import { signSIWAMessage } from "@buildersgarden/siwa";
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});

// Sign SIWA message
const { message, signature } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt: new Date().toISOString(),
}, signer);`}</CollapsibleCodeBlock>
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

          <SubSection id="smart-accounts" title="Smart Accounts">
            <P>
              Smart contract wallets (Safe, ZeroDev/Kernel, Coinbase Smart Wallet) work with the same <InlineCode>createWalletClientSigner</InlineCode> — their SDKs expose a standard WalletClient or EIP-1193 provider. The SDK detects the signer type automatically during verification via ERC-1271.
            </P>
            <CollapsibleCodeBlock title="Smart Account Example" language="typescript">{`import { signSIWAMessage } from "@buildersgarden/siwa";
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";
import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

// Safe example
import Safe from "@safe-global/protocol-kit";
const safe = await Safe.init({ provider, safeAddress });
const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(safe.getProvider()),
});
const signer = createWalletClientSigner(walletClient);

// ZeroDev / Kernel example
// const walletClient = kernelClient.toWalletClient();
// const signer = createWalletClientSigner(walletClient);

// Sign SIWA message — same as any other signer
const { message, signature } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt: new Date().toISOString(),
}, signer);`}</CollapsibleCodeBlock>
          </SubSection>

          <SubSection id="signing-siwa" title="SIWA Sign-In">
            <P>
              Build and sign a SIWA message to prove ownership of an ERC-8004 identity. The authentication flow consists of two steps:
            </P>
            <ul className="space-y-2 mb-4 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">1.</span>
                <span><strong className="text-foreground">Get a nonce</strong> from the server&apos;s <InlineCode>/siwa/nonce</InlineCode> endpoint</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">2.</span>
                <span><strong className="text-foreground">Sign and verify</strong> by sending the signature to <InlineCode>/siwa/verify</InlineCode></span>
              </li>
            </ul>
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
            <CollapsibleCodeBlock title="Full Authentication Flow" language="typescript">{`import { signSIWAMessage } from "@buildersgarden/siwa";

// Step 1: Request nonce from server
const nonceRes = await fetch("https://api.example.com/siwa/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    address: await signer.getAddress(),
    agentId: 42,
    agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  }),
});
const { nonce, issuedAt, expirationTime } = await nonceRes.json();

// Step 2: Sign the SIWA message
const { message, signature, address } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt,
  expirationTime,
}, signer);

// Step 3: Send to server for verification
const verifyRes = await fetch("https://api.example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature }),
});

const { receipt, agentId } = await verifyRes.json();
// Store the receipt for authenticated API calls`}</CollapsibleCodeBlock>
          </SubSection>

          <SubSection id="signing-erc8128" title="ERC-8128 Request Signing">
            <P>
              After SIWA sign-in, sign every outgoing API request with ERC-8128 HTTP Message Signatures.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["signAuthenticatedRequest(req, receipt, signer, chainId, options?)", "Request", "Sign outgoing request with ERC-8128."],
                ["createErc8128Signer(signer, chainId, options?)", "EthHttpSigner", "Create ERC-8128 HTTP signer from SIWA Signer."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode>.
            </P>
            <CollapsibleCodeBlock title="Request Signing Example" language="typescript">{`import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

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

const response = await fetch(signedRequest);`}</CollapsibleCodeBlock>
          </SubSection>
        </Section>

        {/* Verification (Server-Side) */}
        <Section id="verification" title="Verification (Server-Side)">
          <P>
            Everything a service needs to verify agents: validate SIWA sign-in, verify ERC-8128 signed requests, issue receipts, and plug into Express or Next.js.
          </P>

          <SubSection id="verify-siwa" title="SIWA Verification">
            <P>
              Verify a signed SIWA message, check onchain ownership, and optionally validate ERC-8004 agent profile criteria. Implement two endpoints:
            </P>
            <ul className="space-y-2 mb-4 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">1.</span>
                <span><InlineCode>/siwa/nonce</InlineCode> — Issue a nonce for the agent to sign</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">2.</span>
                <span><InlineCode>/siwa/verify</InlineCode> — Verify the signed message and issue a receipt</span>
              </li>
            </ul>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["verifySIWA(msg, sig, domain, nonceValid, client, criteria?)", "SIWAVerificationResult", "Verify signature + onchain ownership + criteria."],
                ["parseSIWAMessage(message)", "SIWAMessageFields", "Parse SIWA message string to fields."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa</InlineCode>. Parameters:
            </P>
            <Table
              headers={["Parameter", "Type", "Description"]}
              rows={[
                ["message", "string", "The full SIWA message string."],
                ["signature", "string", "EIP-191 signature hex string."],
                ["expectedDomain", "string", "Must match message domain."],
                ["nonceValid", "function | object", <>Nonce validator: callback (nonce) =&gt; boolean, {"{ nonceToken, secret }"} for stateless, or {"{ nonceStore }"} for store-based replay protection. See <a href="#nonce-store" className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200">Nonce Store</a>.</>],
                ["client", "PublicClient", "viem PublicClient for onchain verification."],
                ["criteria?", "SIWAVerifyCriteria", "Optional criteria to filter agents (see below)."],
              ]}
            />

            <div className="mt-4 mb-4">
              <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Criteria Options</h4>
            </div>
            <P>
              Use criteria to enforce policies on which agents can authenticate. These are checked during sign-in and encoded into the receipt.
            </P>
            <Table
              headers={["Criteria", "Type", "Description"]}
              rows={[
                ["allowedSignerTypes", "('eoa' | 'sca')[]", "Restrict to EOA-only or allow smart contract accounts."],
                ["mustBeActive", "boolean", "Require agent metadata.active === true."],
                ["requiredServices", "string[]", "Agent must support these services (e.g., 'llm', 'web3')."],
                ["requiredTrust", "string[]", "Agent must support these trust models (e.g., 'tee', 'crypto-economic')."],
                ["minScore", "number", "Minimum reputation score (requires reputationRegistryAddress)."],
                ["minFeedbackCount", "number", "Minimum feedback count (requires reputationRegistryAddress)."],
                ["reputationRegistryAddress", "string", "Reputation registry address for score/feedback checks."],
                ["custom", "(agent) => Promise<boolean>", "Custom validation function with full agent profile."],
              ]}
            />
            <P>
              The result includes <InlineCode>signerType</InlineCode> and optionally <InlineCode>agent</InlineCode> (full profile if criteria fetched metadata).
            </P>

            <div className="mt-6 mb-3">
              <h4 className="font-mono text-sm font-semibold text-foreground">Nonce Endpoint Examples</h4>
              <p className="text-xs text-dim mt-1">Issue a nonce for the agent to sign. Import <InlineCode>createSIWANonce</InlineCode> from <InlineCode>@buildersgarden/siwa</InlineCode>.</p>
            </div>

            <CollapsibleCodeBlock title="Next.js Nonce Endpoint" language="typescript">{`// app/api/siwa/nonce/route.ts
import { createSIWANonce } from "@buildersgarden/siwa";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

// Simple in-memory nonce store (use Redis in production)
const nonceStore = new Map<string, number>();

export async function POST(req: Request) {
  const { address, agentId, agentRegistry } = await req.json();

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
  );

  // Store nonce for verification
  nonceStore.set(result.nonce, Date.now());

  return corsJson({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
  });
}

export { siwaOptions as OPTIONS };`}</CollapsibleCodeBlock>

            <CollapsibleCodeBlock title="Express Nonce Endpoint" language="typescript">{`// routes/siwa.ts
import express from "express";
import { createSIWANonce } from "@buildersgarden/siwa";
import { siwaCors, siwaJsonParser } from "@buildersgarden/siwa/express";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const router = express.Router();
router.use(siwaJsonParser());
router.use(siwaCors());

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const nonceStore = new Map<string, number>();

router.post("/nonce", async (req, res) => {
  const { address, agentId, agentRegistry } = req.body;

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
  );

  nonceStore.set(result.nonce, Date.now());

  res.json({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
  });
});

export default router;`}</CollapsibleCodeBlock>

            <CollapsibleCodeBlock title="Hono Nonce Endpoint" language="typescript">{`// src/routes/siwa.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSIWANonce } from "@buildersgarden/siwa";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "X-SIWA-Receipt", "Signature", "Signature-Input", "Content-Digest"],
}));

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const nonceStore = new Map<string, number>();

app.post("/nonce", async (c) => {
  const { address, agentId, agentRegistry } = await c.req.json();

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
  );

  nonceStore.set(result.nonce, Date.now());

  return c.json({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
  });
});

export default app;`}</CollapsibleCodeBlock>

            <CollapsibleCodeBlock title="Fastify Nonce Endpoint" language="typescript">{`// src/routes/siwa.ts
import { FastifyPluginAsync } from "fastify";
import { createSIWANonce } from "@buildersgarden/siwa";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const nonceStore = new Map<string, number>();

const siwaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/nonce", async (req) => {
    const { address, agentId, agentRegistry } = req.body as {
      address: string;
      agentId: number;
      agentRegistry: string;
    };

    const result = await createSIWANonce(
      { address, agentId, agentRegistry },
      client,
    );

    nonceStore.set(result.nonce, Date.now());

    return {
      nonce: result.nonce,
      issuedAt: result.issuedAt,
      expirationTime: result.expirationTime,
    };
  });
};

export default siwaRoutes;`}</CollapsibleCodeBlock>

            <div className="mt-6 mb-3">
              <h4 className="font-mono text-sm font-semibold text-foreground">Verify Endpoint Examples</h4>
              <p className="text-xs text-dim mt-1">Verify the signed message and issue a receipt.</p>
            </div>

            <CollapsibleCodeBlock title="Next.js Verify Endpoint" language="typescript">{`// app/api/siwa/verify/route.ts
import { verifySIWA } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

// Simple in-memory nonce store (use Redis in production)
const nonceStore = new Map<string, number>();

export async function POST(req: Request) {
  const { message, signature } = await req.json();

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => {
      if (!nonceStore.has(nonce)) return false;
      nonceStore.delete(nonce); // consume nonce
      return true;
    },
    client,
    {
      allowedSignerTypes: ["eoa", "sca"],
      mustBeActive: true,
      requiredServices: ["llm"],
    }
  );

  if (!result.valid) {
    return corsJson({ error: result.error }, { status: 401 });
  }

  // Issue receipt for authenticated requests
  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    signerType: result.signerType,
  }, { secret: process.env.RECEIPT_SECRET! });

  return corsJson({ receipt, agentId: result.agentId });
}

export { siwaOptions as OPTIONS };`}</CollapsibleCodeBlock>

            <CollapsibleCodeBlock title="Express Verify Endpoint" language="typescript">{`// routes/siwa.ts (add to same router as nonce)
import { verifySIWA } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { siwaCors, siwaJsonParser } from "@buildersgarden/siwa/express";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const router = express.Router();
router.use(siwaJsonParser());
router.use(siwaCors());

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

// Simple in-memory nonce store (use Redis in production)
const nonceStore = new Map<string, number>();

router.post("/verify", async (req, res) => {
  const { message, signature } = req.body;

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => {
      if (!nonceStore.has(nonce)) return false;
      nonceStore.delete(nonce);
      return true;
    },
    client,
    {
      allowedSignerTypes: ["eoa", "sca"],
      mustBeActive: true,
      requiredServices: ["llm"],
    }
  );

  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    signerType: result.signerType,
  }, { secret: process.env.RECEIPT_SECRET! });

  res.json({ receipt, agentId: result.agentId });
});

export default router;`}</CollapsibleCodeBlock>

            <CollapsibleCodeBlock title="Hono Verify Endpoint" language="typescript">{`// src/routes/siwa.ts (add to same app as nonce)
import { verifySIWA } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "X-SIWA-Receipt", "Signature", "Signature-Input", "Content-Digest"],
}));

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const nonceStore = new Map<string, number>();

app.post("/verify", async (c) => {
  const { message, signature } = await c.req.json();

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => {
      if (!nonceStore.has(nonce)) return false;
      nonceStore.delete(nonce);
      return true;
    },
    client,
    {
      allowedSignerTypes: ["eoa", "sca"],
      mustBeActive: true,
      requiredServices: ["llm"],
    }
  );

  if (!result.valid) {
    return c.json({ error: result.error }, 401);
  }

  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    signerType: result.signerType,
  }, { secret: process.env.RECEIPT_SECRET! });

  return c.json({ receipt, agentId: result.agentId });
});

export default app;`}</CollapsibleCodeBlock>

            <CollapsibleCodeBlock title="Fastify Verify Endpoint" language="typescript">{`// src/routes/siwa.ts (add to same plugin as nonce)
import { verifySIWA } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const nonceStore = new Map<string, number>();

const siwaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/verify", async (req, reply) => {
    const { message, signature } = req.body as { message: string; signature: string };

    const result = await verifySIWA(
      message,
      signature,
      "api.example.com",
      (nonce) => {
        if (!nonceStore.has(nonce)) return false;
        nonceStore.delete(nonce);
        return true;
      },
      client,
      {
        allowedSignerTypes: ["eoa", "sca"],
        mustBeActive: true,
        requiredServices: ["llm"],
      }
    );

    if (!result.valid) {
      return reply.status(401).send({ error: result.error });
    }

    const { receipt } = createReceipt({
      address: result.address,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry,
      chainId: result.chainId,
      signerType: result.signerType,
    }, { secret: process.env.RECEIPT_SECRET! });

    return { receipt, agentId: result.agentId };
  });
};

export default siwaRoutes;`}</CollapsibleCodeBlock>
          </SubSection>

          <SubSection id="verify-erc8128" title="ERC-8128 Request Verification">
            <P>
              Verify incoming ERC-8128 signed requests from authenticated agents.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["verifyAuthenticatedRequest(req, options)", "AuthResult", "Verify incoming signed request."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode>. Options accept <InlineCode>allowedSignerTypes</InlineCode> for policy enforcement. The verified agent includes a <InlineCode>signerType</InlineCode> field.
            </P>
          </SubSection>

          <SubSection id="verify-receipts" title="Receipts">
            <P>
              Stateless HMAC-signed tokens issued after successful SIWA verification. The agent includes the receipt in subsequent requests, and the server verifies it.
            </P>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["createReceipt(payload, options)", "{ receipt, expiresAt }", "Create an HMAC-signed receipt."],
                ["verifyReceipt(receipt, secret)", "ReceiptPayload | null", "Verify and decode. Returns null if invalid."],
              ]}
            />
            <Table
              headers={["Payload Field", "Type", "Description"]}
              rows={[
                ["address", "string", "Agent wallet address."],
                ["agentId", "number", "ERC-8004 token ID."],
                ["signerType", "SignerType?", "Optional: 'eoa' or 'sca'."],
              ]}
            />
            <P>
              Import from <InlineCode>@buildersgarden/siwa/receipt</InlineCode>.
            </P>
          </SubSection>

          <SubSection id="verify-wrappers" title="Server Middleware">
            <P>
              Drop-in middleware for popular frameworks. Each handles ERC-8128 verification, receipt checking, and CORS.
            </P>

            <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 mb-6">
              <p className="text-sm text-muted leading-relaxed">
                <span className="font-mono font-semibold text-accent">Note:</span>{" "}
                ERC-8004 criteria (reputation, services, trust models) are checked during SIWA sign-in via{" "}
                <InlineCode>verifySIWA()</InlineCode>. The middleware below verifies ERC-8128 signatures on subsequent requests — it accepts{" "}
                <InlineCode>allowedSignerTypes</InlineCode> and <InlineCode>verifyOnchain</InlineCode> options for per-request policy.
              </p>
            </div>

            <Table
              headers={["Option", "Type", "Description"]}
              rows={[
                ["receiptSecret", "string", "HMAC secret for receipt verification. Defaults to RECEIPT_SECRET env."],
                ["allowedSignerTypes", "('eoa' | 'sca')[]", "Restrict to EOA-only or SCA-only agents."],
                ["verifyOnchain", "boolean", "Re-check ownerOf on every request (slower but more secure)."],
                ["rpcUrl", "string", "RPC URL for onchain verification."],
                ["publicClient", "PublicClient", "viem PublicClient for ERC-1271 smart account signatures."],
              ]}
            />

            <div id="verify-wrappers-next" className="scroll-mt-20 mt-8 mb-2">
              <h4 className="font-mono text-sm font-semibold text-foreground">Next.js (App Router)</h4>
              <p className="text-xs text-dim mb-3">Import from <InlineCode>@buildersgarden/siwa/next</InlineCode> — exports: withSiwa, siwaOptions, corsJson</p>
            </div>
            <CollapsibleCodeBlock title="Next.js Example" language="typescript">{`// app/api/protected/route.ts
import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

export const POST = withSiwa(
  async (agent, req) => {
    // agent.address, agent.agentId, agent.chainId, agent.signerType
    const body = await req.json();
    return { received: body, agent };
  },
  {
    // Optional: restrict to EOA-only agents
    allowedSignerTypes: ["eoa"],
    // Optional: re-verify onchain ownership on every request
    verifyOnchain: true,
    rpcUrl: process.env.RPC_URL,
  }
);

export { siwaOptions as OPTIONS };`}</CollapsibleCodeBlock>

            <div id="verify-wrappers-express" className="scroll-mt-20 mt-8 mb-2">
              <h4 className="font-mono text-sm font-semibold text-foreground">Express</h4>
              <p className="text-xs text-dim mb-3">Import from <InlineCode>@buildersgarden/siwa/express</InlineCode> — exports: siwaMiddleware, siwaJsonParser, siwaCors</p>
            </div>
            <CollapsibleCodeBlock title="Express Example" language="typescript">{`import express from "express";
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const app = express();
app.use(siwaJsonParser());
app.use(siwaCors());

// Optional: create a public client for ERC-1271 smart account support
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

app.post(
  "/api/protected",
  siwaMiddleware({
    // Optional: allow both EOA and smart contract accounts
    allowedSignerTypes: ["eoa", "sca"],
    // Optional: pass publicClient for ERC-1271 signature verification
    publicClient,
    // Optional: re-verify onchain on every request
    verifyOnchain: false,
  }),
  (req, res) => {
    // req.agent contains { address, agentId, chainId, agentRegistry, signerType }
    res.json({ agent: req.agent });
  }
);`}</CollapsibleCodeBlock>

            <div id="verify-wrappers-hono" className="scroll-mt-20 mt-8 mb-2">
              <h4 className="font-mono text-sm font-semibold text-foreground">Hono</h4>
              <p className="text-xs text-dim mb-3">Uses web standard Request/Response — import <InlineCode>verifyAuthenticatedRequest</InlineCode> from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode></p>
            </div>
            <CollapsibleCodeBlock title="Hono Example" language="typescript">{`import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyAuthenticatedRequest, type VerifyOptions } from "@buildersgarden/siwa/erc8128";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const app = new Hono();

// CORS with SIWA headers
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "X-SIWA-Receipt", "Signature", "Signature-Input", "Content-Digest"],
}));

// Optional: public client for ERC-1271 smart account support
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

// Configurable SIWA auth middleware factory
function siwaAuth(options?: Partial<VerifyOptions>) {
  return async (c, next) => {
    const result = await verifyAuthenticatedRequest(c.req.raw, {
      receiptSecret: process.env.RECEIPT_SECRET!,
      ...options,
    });

    if (!result.valid) {
      return c.json({ error: result.error }, 401);
    }

    c.set("agent", result.agent);
    await next();
  };
}

// Route with EOA-only policy
app.post("/api/eoa-only", siwaAuth({ allowedSignerTypes: ["eoa"] }), (c) => {
  return c.json({ agent: c.get("agent") });
});

// Route allowing smart accounts with ERC-1271 verification
app.post("/api/with-sca", siwaAuth({ publicClient, allowedSignerTypes: ["eoa", "sca"] }), (c) => {
  return c.json({ agent: c.get("agent") });
});

// Route with onchain re-verification on every request
app.post("/api/high-security", siwaAuth({ verifyOnchain: true, rpcUrl: process.env.RPC_URL }), (c) => {
  return c.json({ agent: c.get("agent") });
});

export default app;`}</CollapsibleCodeBlock>

            <div id="verify-wrappers-fastify" className="scroll-mt-20 mt-8 mb-2">
              <h4 className="font-mono text-sm font-semibold text-foreground">Fastify</h4>
              <p className="text-xs text-dim mb-3">Uses preHandler hooks — import <InlineCode>verifyAuthenticatedRequest</InlineCode> from <InlineCode>@buildersgarden/siwa/erc8128</InlineCode></p>
            </div>
            <CollapsibleCodeBlock title="Fastify Example" language="typescript">{`import Fastify from "fastify";
import cors from "@fastify/cors";
import { verifyAuthenticatedRequest, type VerifyOptions } from "@buildersgarden/siwa/erc8128";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const fastify = Fastify();

await fastify.register(cors, {
  origin: true,
  allowedHeaders: ["Content-Type", "X-SIWA-Receipt", "Signature", "Signature-Input", "Content-Digest"],
});

// Optional: public client for ERC-1271 smart account support
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

// Convert Fastify request to Fetch Request
function toFetchRequest(req) {
  const url = \`\${req.protocol}://\${req.hostname}\${req.url}\`;
  return new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
  });
}

// Configurable SIWA auth decorator
function siwaAuth(options?: Partial<VerifyOptions>) {
  return async (req, reply) => {
    if (!req.headers["signature"] || !req.headers["x-siwa-receipt"]) {
      return reply.status(401).send({ error: "Missing SIWA authentication headers" });
    }

    const result = await verifyAuthenticatedRequest(toFetchRequest(req), {
      receiptSecret: process.env.RECEIPT_SECRET!,
      ...options,
    });

    if (!result.valid) {
      return reply.status(401).send({ error: result.error });
    }

    req.agent = result.agent;
  };
}

// Route with EOA-only policy
fastify.post("/api/eoa-only", { preHandler: siwaAuth({ allowedSignerTypes: ["eoa"] }) }, async (req) => {
  return { agent: req.agent };
});

// Route allowing smart accounts
fastify.post("/api/with-sca", { preHandler: siwaAuth({ publicClient }) }, async (req) => {
  return { agent: req.agent };
});

// Route with onchain re-verification
fastify.post("/api/high-security", { preHandler: siwaAuth({ verifyOnchain: true, rpcUrl: process.env.RPC_URL }) }, async (req) => {
  return { agent: req.agent };
});

await fastify.listen({ port: 3000 });`}</CollapsibleCodeBlock>
          </SubSection>

          <SubSection id="nonce-store" title="Nonce Store">
            <P>
              Pluggable server-side nonce tracking for replay protection. The SDK ships built-in adapters for Memory, Redis, Cloudflare KV, and any SQL database — no extra dependencies, you bring your own client.
            </P>
          </SubSection>

          <SubSection id="nonce-why" title="Why Nonces Matter">
            <P>
              A SIWA message is valid for its entire TTL window (default 5 minutes). Without server-side tracking, an attacker who intercepts a signed message can <strong className="text-foreground">replay</strong> it — submitting the same signature multiple times to authenticate as the agent.
            </P>
            <P>
              A nonce store solves this by recording every issued nonce and consuming it on first use. Once consumed, the nonce is deleted and any replay attempt is rejected.
            </P>
            <P>
              The SDK provides three nonce validation strategies:
            </P>
            <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Callback</strong> — <InlineCode>{'(nonce) => boolean'}</InlineCode>: you manage nonce storage yourself</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Stateless token</strong> — <InlineCode>{'{ nonceToken, secret }'}</InlineCode>: HMAC-signed token, no server storage needed (but replayable within TTL)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Nonce store</strong> — <InlineCode>{'{ nonceStore }'}</InlineCode>: server-side tracking with exactly-once consumption (recommended for production)</span>
              </li>
            </ul>
            <P>
              The <InlineCode>SIWANonceStore</InlineCode> interface:
            </P>
            <CodeBlock language="typescript">{`interface SIWANonceStore {
  /** Store an issued nonce. Returns true on success, false if already exists. */
  issue(nonce: string, ttlMs: number): Promise<boolean>;
  /** Atomically check-and-delete a nonce. Returns true if it existed. */
  consume(nonce: string): Promise<boolean>;
}`}</CodeBlock>
            <P>
              Wire the store into both <InlineCode>createSIWANonce</InlineCode> (issue) and <InlineCode>verifySIWA</InlineCode> (consume):
            </P>
            <CodeBlock language="typescript">{`import { createSIWANonce, verifySIWA } from "@buildersgarden/siwa";
import { createMemorySIWANonceStore } from "@buildersgarden/siwa/nonce-store";

const nonceStore = createMemorySIWANonceStore();

// Nonce endpoint — issue
const result = await createSIWANonce(params, client, { nonceStore });

// Verify endpoint — consume
const verification = await verifySIWA(
  message, signature, domain,
  { nonceStore },
  client,
);`}</CodeBlock>
          </SubSection>

          <SubSection id="nonce-memory" title="Memory (Default)">
            <P>
              In-memory store using a <InlineCode>Map</InlineCode> with TTL-based expiry. Suitable for single-process servers. Nonces are lost on restart.
            </P>
            <CodeBlock language="typescript">{`import { createMemorySIWANonceStore } from "@buildersgarden/siwa/nonce-store";

const nonceStore = createMemorySIWANonceStore();`}</CodeBlock>
          </SubSection>

          <SubSection id="nonce-redis" title="Redis">
            <P>
              Redis-backed store using <InlineCode>SET ... PX ttl NX</InlineCode> for atomic issue and <InlineCode>DEL</InlineCode> for atomic consume. Works with any Redis client that implements <InlineCode>set()</InlineCode> and <InlineCode>del()</InlineCode>.
            </P>
            <CodeBlock language="typescript">{`import { createRedisSIWANonceStore } from "@buildersgarden/siwa/nonce-store";

// ioredis (works out of the box)
import Redis from "ioredis";
const redis = new Redis();
const nonceStore = createRedisSIWANonceStore(redis);`}</CodeBlock>
            <P>
              For <strong className="text-foreground">node-redis v4</strong>, wrap with a small adapter since its <InlineCode>set()</InlineCode> signature differs:
            </P>
            <CodeBlock language="typescript">{`import { createClient } from "redis";
import { createRedisSIWANonceStore } from "@buildersgarden/siwa/nonce-store";

const client = createClient(); await client.connect();

const nonceStore = createRedisSIWANonceStore({
  set: (...args: unknown[]) =>
    client
      .set(args[0] as string, args[1] as string, {
        PX: args[3] as number,
        NX: true,
      })
      .then((r) => r ?? null),
  del: (key: unknown) => client.del(key as string),
});`}</CodeBlock>
          </SubSection>

          <SubSection id="nonce-kv" title="Cloudflare KV">
            <P>
              Cloudflare Workers KV-backed store. Uses <InlineCode>put</InlineCode> with <InlineCode>expirationTtl</InlineCode> for auto-expiry. The consume path does a <InlineCode>get</InlineCode> + <InlineCode>delete</InlineCode> — not fully atomic, but acceptable for random nonces.
            </P>
            <CodeBlock language="typescript">{`import { createKVSIWANonceStore } from "@buildersgarden/siwa/nonce-store";

// In a Cloudflare Worker
export default {
  async fetch(request: Request, env: Env) {
    const nonceStore = createKVSIWANonceStore(env.SIWA_NONCES);
    // use with createSIWANonce / verifySIWA
  },
};`}</CodeBlock>
            <P>
              Bind a KV namespace called <InlineCode>SIWA_NONCES</InlineCode> in your <InlineCode>wrangler.toml</InlineCode>:
            </P>
            <CodeBlock language="text">{`[[kv_namespaces]]
binding = "SIWA_NONCES"
id = "<your-kv-namespace-id>"`}</CodeBlock>
          </SubSection>

          <SubSection id="nonce-database" title="Database">
            <P>
              For databases, implement <InlineCode>SIWANonceStore</InlineCode> directly — it&apos;s just two methods. No factory needed.
            </P>
            <P>
              <strong className="text-foreground">Schema</strong> — create a table with a unique nonce column and an expiry timestamp:
            </P>
            <CodeBlock language="text">{`CREATE TABLE siwa_nonces (
  nonce      VARCHAR(64) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
-- Optional: periodic cleanup of expired rows
-- DELETE FROM siwa_nonces WHERE expires_at < NOW();`}</CodeBlock>
            <P>
              <strong className="text-foreground">Prisma</strong>:
            </P>
            <CodeBlock language="typescript">{`import type { SIWANonceStore } from "@buildersgarden/siwa/nonce-store";

const nonceStore: SIWANonceStore = {
  async issue(nonce, ttlMs) {
    try {
      await prisma.siwaNonce.create({
        data: { nonce, expiresAt: new Date(Date.now() + ttlMs) },
      });
      return true;
    } catch (e: any) {
      if (e.code === "P2002") return false; // unique constraint
      throw e;
    }
  },
  async consume(nonce) {
    try {
      await prisma.siwaNonce.delete({ where: { nonce } });
      return true;
    } catch {
      return false;
    }
  },
};`}</CodeBlock>
            <P>
              <strong className="text-foreground">Drizzle</strong>:
            </P>
            <CodeBlock language="typescript">{`import type { SIWANonceStore } from "@buildersgarden/siwa/nonce-store";
import { eq, and, gt } from "drizzle-orm";
import { siwaNonces } from "./schema";

const nonceStore: SIWANonceStore = {
  async issue(nonce, ttlMs) {
    try {
      await db.insert(siwaNonces).values({
        nonce,
        expiresAt: new Date(Date.now() + ttlMs),
      });
      return true;
    } catch (e: any) {
      if (e.code === "23505") return false; // unique violation
      throw e;
    }
  },
  async consume(nonce) {
    const result = await db
      .delete(siwaNonces)
      .where(
        and(
          eq(siwaNonces.nonce, nonce),
          gt(siwaNonces.expiresAt, new Date()),
        ),
      );
    return (result.rowCount ?? 0) > 0;
  },
};`}</CodeBlock>
          </SubSection>
        </Section>

        {/* Identity & Registry */}
        <Section id="identity" title="Identity & Registry">
          <P>
            Read and write agent identity state, and query onchain profiles.
          </P>

          <SubSection id="identity-file" title="Identity File">
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
          </SubSection>

          <SubSection id="identity-registry" title="Onchain Registry">
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
