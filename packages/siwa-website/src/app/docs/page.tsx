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

        {/* Simple Explanation */}
        <Section id="what-is-siwa" title="What is SIWA?">
          <P>
            <strong className="text-foreground">SIWA is "Sign in with Google" — but for AI agents.</strong>
          </P>
          <P>
            It lets AI agents prove who they are and sign in to apps and services, just like humans use "Sign in with Google" or "Sign in with Apple."
          </P>
          
          <div className="my-6 rounded-lg border border-border bg-surface p-6">
            <h3 className="font-mono text-sm font-semibold text-foreground mb-4">
              What SIWA does:
            </h3>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5">1.</span>
                <span><strong className="text-foreground">Create an identity</strong> — A unique digital passport on the blockchain</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5">2.</span>
                <span><strong className="text-foreground">Prove who they are</strong> — Cryptographically verify ownership of that identity</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5">3.</span>
                <span><strong className="text-foreground">Sign in anywhere</strong> — Use that identity across all SIWA-enabled services</span>
              </li>
            </ul>
          </div>

          <h3 className="font-mono text-sm font-semibold text-foreground mb-4 mt-8">
            Why use SIWA?
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-accent mb-2">✓</div>
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Simple for developers</h4>
              <p className="text-xs text-muted">Add agent authentication with a few lines of code</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-accent mb-2">🔒</div>
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Secure by design</h4>
              <p className="text-xs text-muted">Private keys stay safe, even if the agent is compromised</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-accent mb-2">🌐</div>
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Works everywhere</h4>
              <p className="text-xs text-muted">One identity works across all SIWA-enabled apps</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-accent mb-2">🤖</div>
              <h4 className="font-mono text-xs font-semibold text-foreground mb-1">Built for agents</h4>
              <p className="text-xs text-muted">Designed specifically for how AI agents work</p>
            </div>
          </div>
        </Section>

        {/* Quick Start */}
        <Section id="quick-start" title="Quick Start (5 Minutes)">
          <P>
            Want to see SIWA in action? Here is the fastest way to get running:
          </P>

          <CodeBlock>{`git clone https://github.com/builders-garden/siwa.git
cd siwa
pnpm install

# Run the demo
cd packages/siwa-testing
pnpm run dev`}</CodeBlock>

          <P>
            This runs a complete agent registration and sign-in flow locally. You will see:
          </P>
          <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
            <li>Wallet creation</li>
            <li>On-chain registration</li>
            <li>SIWA authentication</li>
            <li>Session establishment</li>
          </ul>
        </Section>

        {/* What do you want to do? */}
        <Section id="find-your-path" title="Find Your Path">
          <P>
            Not sure where to start? Pick what describes you:
          </P>

          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <a
              href="#simple-integration"
              className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                I want to add SIWA to my app
              </h4>
              <p className="text-xs text-muted mb-3">
                I am a developer building an app that needs to authenticate AI agents.
              </p>
              <span className="text-xs text-accent">Start here →</span>
            </a>

            <a
              href="#build-agent"
              className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                I am building an AI agent
              </h4>
              <p className="text-xs text-muted mb-3">
                I want my agent to have a verified identity and sign in to services.
              </p>
              <span className="text-xs text-accent">Start here →</span>
            </a>

            <a
              href="#security-model"
              className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                I care about security
              </h4>
              <p className="text-xs text-muted mb-3">
                I want to understand the threat model and security architecture.
              </p>
              <span className="text-xs text-accent">Read security docs →</span>
            </a>

            <a
              href="#protocol-spec"
              className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                I want the technical details
              </h4>
              <p className="text-xs text-muted mb-3">
                I need protocol specs, contract addresses, and API references.
              </p>
              <span className="text-xs text-accent">View full spec →</span>
            </a>
          </div>
        </Section>

        {/* Simple Integration Guide */}
        <Section id="simple-integration" title="Simple Integration Guide">
          <P>
            Adding SIWA to your app takes just a few steps. No blockchain expertise required.
          </P>

          <SubSection id="step1-nonce" title="Step 1: Generate a Nonce">
            <P>
              When an agent wants to sign in, generate a unique nonce (a random string) and save it temporarily.
            </P>
            <CodeBlock>{`// Your server
app.post('/siwa/nonce', (req, res) => {
  const { address, agentId } = req.body;
  
  // Generate random nonce
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Save it (expires in 5 minutes)
  nonces.set(address, { nonce, createdAt: Date.now() });
  
  res.json({ 
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 5 * 60000).toISOString()
  });
});`}</CodeBlock>
          </SubSection>

          <SubSection id="step2-verify" title="Step 2: Verify the Signature">
            <P>
              The agent signs a message and sends it back. You verify it matches the nonce.
            </P>
            <CodeBlock>{`// Your server
import { verifySIWA } from '@buildersgarden/siwa';

app.post('/siwa/verify', async (req, res) => {
  const { message, signature } = req.body;
  
  // Verify the SIWA message
  const result = verifySIWA(message, signature, {
    domain: 'your-app.com',
    nonce: (addr) => nonces.get(addr)?.nonce,
  });
  
  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Check onchain ownership
  const owner = await identityRegistry.ownerOf(result.agentId);
  if (owner.toLowerCase() !== result.address.toLowerCase()) {
    return res.status(401).json({ error: 'Not the owner' });
  }
  
  // Success! Create a session
  const session = createSession(result);
  res.json({ token: session.jwt });
});`}</CodeBlock>
          </SubSection>

          <SubSection id="step3-protect" title="Step 3: Protect Your Routes">
            <P>
              Use the session token to protect your API routes.
            </P>
            <CodeBlock>{`// Middleware to check authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  try {
    const session = jwt.verify(token, SECRET);
    req.agent = session; // { address, agentId, agentRegistry }
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Protected route
app.get('/api/secrets', requireAuth, (req, res) => {
  res.json({ 
    message: `Hello agent ${req.agent.agentId}!` 
  });
});`}</CodeBlock>
          </SubSection>

          <P>
            That is it! Your app now supports SIWA authentication.
          </P>
        </Section>

        {/* Build an Agent */}
        <Section id="build-agent" title="Building a SIWA-Enabled Agent">
          <P>
            If you are building an AI agent, here is how to add SIWA support.
          </P>

          <SubSection id="agent-prereq" title="Prerequisites">
            <P>
              You need an OpenClaw agent running — an open-source agent gateway. Follow the{" "}
              <a
                href="https://docs.openclaw.ai/install/railway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                installation guide
              </a>
              {" "}to deploy it on Railway.
            </P>
          </SubSection>

          <SubSection id="agent-wallet" title="1. Create a Wallet">
            <CodeBlock>{`import { createWallet } from '@buildersgarden/siwa/keystore';

// Create a wallet (key stored securely, never returned)
const { address, backend } = await createWallet();

// Save the address to your agent's memory
writeMemoryField('Address', address);
writeMemoryField('Keystore Backend', backend);`}</CodeBlock>
          </SubSection>

          <SubSection id="agent-register" title="2. Register Onchain">
            <CodeBlock>{`import { signTransaction } from '@buildersgarden/siwa/keystore';

// Build registration data
const registration = {
  type: "AI Agent",
  name: "My Awesome Agent",
  description: "An agent that does cool things",
  services: [{ type: "MCP", url: "https://api.example.com/mcp" }],
  active: true
};

// Upload to IPFS or use data URI
const agentURI = uploadToIPFS(registration);

// Register onchain
const iface = new ethers.Interface([
  'function register(string agentURI) external returns (uint256)'
]);
const data = iface.encodeFunctionData('register', [agentURI]);

const { signedTx } = await signTransaction({
  to: IDENTITY_REGISTRY,
  data,
  chainId: 8453
});

const tx = await provider.broadcastTransaction(signedTx);
const receipt = await tx.wait();

// Get your agentId from the event logs
const agentId = parseAgentIdFromReceipt(receipt);`}</CodeBlock>
          </SubSection>

          <SubSection id="agent-signin" title="3. Sign In to Services">
            <CodeBlock>{`import { signSIWAMessage } from '@buildersgarden/siwa';

// 1. Get nonce from the service
const { nonce, issuedAt, expirationTime } = await fetch(
  'https://api.example.com/siwa/nonce',
  {
    method: 'POST',
    body: JSON.stringify({ address, agentId, agentRegistry })
  }
).then(r => r.json());

// 2. Sign the SIWA message
const { message, signature } = await signSIWAMessage({
  domain: 'api.example.com',
  address,
  statement: 'Sign in to Example App',
  uri: 'https://api.example.com/siwa',
  agentId,
  agentRegistry,
  chainId: 8453,
  nonce,
  issuedAt,
  expirationTime
});

// 3. Submit for verification
const session = await fetch('https://api.example.com/siwa/verify', {
  method: 'POST',
  body: JSON.stringify({ message, signature })
}).then(r => r.json());

// Save the session token
writeMemoryField('Session Token', session.token);`}</CodeBlock>
          </SubSection>
        </Section>

        {/* Common Questions */}
        <Section id="faq" title="Common Questions">
          <div className="space-y-6">
            <div>
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                Do I need to run a blockchain node?
              </h4>
              <P>
                No! SIWA works with any EVM-compatible blockchain. You can use public RPCs like those from Base, or services like Alchemy/Infura.
              </P>
            </div>

            <div>
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                Can I use SIWA with my existing agent framework?
              </h4>
              <P>
                Yes! SIWA is framework-agnostic. It works with OpenClaw, LangChain, AutoGPT, or any custom agent.
              </P>
            </div>

            <div>
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                Is it free?
              </h4>
              <P>
                Yes! The protocol is open source (MIT license). You only pay blockchain gas fees for registration transactions (typically less than $1 on Base).
              </P>
            </div>

            <div>
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                What if my agent gets hacked?
              </h4>
              <P>
                If you use the keyring proxy, the attacker cannot steal your private key. They can only request signatures, and you can revoke the proxy's access at any time.
              </P>
            </div>

            <div>
              <h4 className="font-mono text-sm font-semibold text-foreground mb-2">
                How is this different from regular wallet auth?
              </h4>
              <P>
                SIWA is specifically designed for AI agents. It uses the ERC-8004 standard which creates an identity NFT for agents. Unlike regular wallets, SIWA verifies both cryptographic ownership AND onchain NFT ownership.
              </P>
            </div>
          </div>
        </Section>

        {/* Technical Details - The "Nerd Version" */}
        <Section id="technical-details" title="Technical Details">
          <div className="mb-6 rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-muted">
              <strong className="text-foreground">👋 Welcome, nerds!</strong> This section contains the full technical specification. If you just want to use SIWA, the sections above are all you need.
            </p>
          </div>

          <SubSection id="architecture" title="Architecture">
            <P>
              SIWA consists of several components working together:
            </P>

            <div className="my-6 rounded-lg border border-border bg-surface p-6 font-mono text-xs leading-relaxed">
              <div className="text-muted mb-4">
                <span className="text-accent">┌─────────────┐</span>      <span className="text-accent">┌──────────────┐</span>      <span className="text-accent">┌─────────────┐</span><br/>
                <span className="text-accent">│</span>   Agent     <span className="text-accent">│</span>──────<span className="text-accent">▶│</span> Keyring      <span className="text-accent">│</span>──────<span className="text-accent">▶│</span> Blockchain  <span className="text-accent">│</span><br/>
                <span className="text-accent">│</span>   (Your AI) <span className="text-accent">│</span>◀──────<span className="text-accent">│</span> Proxy        <span className="text-accent">│</span>◀──────<span className="text-accent">│</span> (Identity)  <span className="text-accent">│</span><br/>
                <span className="text-accent">└─────────────┘</span>      <span className="text-accent">└──────────────┘</span>      <span className="text-accent">└─────────────┘</span>
              </div>
              <div className="text-dim">
                <div className="mb-2">1. Agent asks proxy to sign something</div>
                <div className="mb-2">2. Proxy validates the request (HMAC + timestamp)</div>
                <div className="mb-2">3. Proxy signs using the stored key</div>
                <div>4. Agent gets signature, never sees the key</div>
              </div>
            </div>

            <Table
              headers={["Component", "Purpose"]}
              rows={[
                ["SIWA Library", "Core code for creating identities, signing messages, verifying proofs"],
                ["SIWA Skill", "Documentation and assets for building SIWA-enabled agents"],
                ["Keyring Proxy", "Security service that holds private keys outside the agent process"],
                ["Testing Tools", "Demo apps and test suites"],
              ]}
            />
          </SubSection>

          <SubSection id="security-model" title="Security Model">
            <P>
              The agent&apos;s private key is the root of its onchain identity. SIWA&apos;s security architecture ensures the key never enters the agent process.
            </P>

            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              Keyring Proxy
            </h4>
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

            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              Threat Model
            </h4>
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

          <SubSection id="protocol-spec" title="Protocol Specification">
            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              Message Format
            </h4>
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

            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              Field Definitions
            </h4>
            <Table
              headers={["Field", "Required", "Description"]}
              rows={[
                ["domain", "Yes", "Origin domain requesting authentication."],
                ["address", "Yes", "EIP-55 checksummed Ethereum address."],
                ["statement", "No", "Human-readable purpose string."],
                ["uri", "Yes", "RFC 3986 URI of the resource."],
                ["version", "Yes", 'Must be "1".'],
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

            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              SIWA vs SIWE
            </h4>
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

          <SubSection id="api-reference" title="API Reference">
            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              @buildersgarden/siwa/keystore
            </h4>
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

            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              @buildersgarden/siwa
            </h4>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["buildSIWAMessage(fields)", "string", "Build a formatted SIWA message string."],
                ["signSIWAMessage(fields)", "{ message, signature }", "Build and sign a SIWA message."],
                ["verifySIWA(msg, sig, ...)", "SIWAVerificationResult", "Verify a SIWA signature and optional criteria."],
              ]}
            />

            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              @buildersgarden/siwa/registry
            </h4>
            <Table
              headers={["Function", "Returns", "Description"]}
              rows={[
                ["getAgent(agentId, options)", "AgentProfile", "Read agent profile from the Identity Registry."],
                ["getReputation(agentId, options)", "ReputationSummary", "Read agent reputation from the Reputation Registry."],
              ]}
            />
          </SubSection>

          <SubSection id="contracts" title="Contract Addresses">
            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              Mainnet
            </h4>
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

            <h4 className="font-mono text-sm font-semibold text-foreground mb-2 mt-6">
              Testnets
            </h4>
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
                </tbody>
              </table>
            </div>

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
