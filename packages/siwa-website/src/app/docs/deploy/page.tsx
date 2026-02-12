import { Metadata } from "next";
import { DeploySidebar } from "@/components/deploy-sidebar";
import { CodeBlock } from "@/components/code-block";
import { ImageModal } from "@/components/image-modal";

export const metadata: Metadata = {
  title: "Deploy Keyring Proxy — SIWA",
  description:
    "Deploy the SIWA keyring proxy — self-hosted, non-custodial key management for AI agents with optional Telegram 2FA.",
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

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
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

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
        <span className="font-mono text-sm font-semibold text-accent">{number}</span>
      </div>
      <div className="flex-1 pt-1">
        <h4 className="font-mono text-sm font-semibold text-foreground mb-2">{title}</h4>
        {children}
      </div>
    </div>
  );
}

export default function DeployPage() {
  return (
    <div className="mx-auto flex max-w-6xl px-6 py-12">
      <DeploySidebar />

      <article className="min-w-0 flex-1 pl-0 md:pl-12">
        <h1 className="font-mono text-2xl font-bold text-foreground mb-2">
          Deploy Keyring Proxy
        </h1>
        <p className="text-sm text-dim mb-8">
          Self-hosted, non-custodial key management for AI agents
        </p>

        <div className="mb-12 rounded-lg border border-accent/30 bg-accent/5 px-5 py-4">
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-mono font-semibold text-accent">Optional component:</span>{" "}
            The keyring proxy is one of several wallet options for SIWA. If you&apos;re using Privy, MetaMask, or managing keys directly, you don&apos;t need this. See{" "}
            <a
              href="/docs#wallets"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
            >
              Wallet Options
            </a>{" "}
            for alternatives.
          </p>
        </div>

        {/* Why Keyring Proxy */}
        <Section id="why" title="Why Keyring Proxy?">
          <P>
            AI agents face unique security challenges. Prompt injection attacks can trick an agent into revealing secrets. The keyring proxy solves this by keeping the private key in a separate process:
          </P>
          <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
            <li className="flex gap-3">
              <span className="text-accent shrink-0">&#x2022;</span>
              <span><strong className="text-foreground">Key isolation</strong> — Private key never enters the agent&apos;s process or context</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent shrink-0">&#x2022;</span>
              <span><strong className="text-foreground">Non-custodial</strong> — You control the key, stored encrypted on your infrastructure</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent shrink-0">&#x2022;</span>
              <span><strong className="text-foreground">Optional 2FA</strong> — Require Telegram approval before signing transactions</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent shrink-0">&#x2022;</span>
              <span><strong className="text-foreground">Audit trail</strong> — Every signing request is logged</span>
            </li>
          </ul>
        </Section>

        {/* Architecture */}
        <Section id="architecture" title="Architecture">
          <SubSection id="security-model" title="Security Model">
            <P>
              All signing is delegated to the keyring proxy over HMAC-authenticated HTTP. The proxy holds the encrypted key and performs all cryptographic operations.
            </P>
            <CodeBlock language="text">{`Agent Process                     Keyring Proxy
(uses Signer interface)           (holds encrypted key)

signer.signMessage("hello")
  |
  +--> POST /sign-message
       + HMAC-SHA256 header  ---> Validates HMAC + timestamp (30s)
                                  Loads key, signs, discards
                              <-- Returns { signature }`}</CodeBlock>
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

          <SubSection id="threat-model" title="Threat Model">
            <Table
              headers={["Threat", "Mitigation"]}
              rows={[
                ["Prompt injection exfiltration", "Key never in any file the agent reads into context."],
                ["Context window leakage", "Key loaded inside proxy function, used, and discarded — never returned."],
                ["File system snooping", "AES-encrypted V3 JSON Keystore (scrypt KDF)."],
                ["Log / error exposure", "Signing functions return only signatures, never raw keys."],
                ["Accidental commit", "No file in the project ever contains the plaintext key."],
              ]}
            />
          </SubSection>

          <SubSection id="network-topology" title="Network Topology">
            <P>
              A deployed keyring proxy setup runs as a set of services on a private network:
            </P>
            <ul className="space-y-2 mb-6 text-sm leading-relaxed text-muted list-none">
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Keyring Proxy</strong> — holds the agent&apos;s encrypted private key and performs all signing. Never exposed publicly.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Your Agent</strong> — AI agent (OpenClaw, custom framework, etc). Uses the SIWA SDK to request signatures.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">2FA Gateway + Server</strong> (optional) — adds Telegram-based owner approval before signing. The gateway receives webhooks; the server manages approval flows.</span>
              </li>
            </ul>

            <ImageModal
              src="/siwa-topology.png"
              alt="SIWA network topology: Users connect to agent gateway, which delegates signing to the Keyring Proxy over a private network. Optional 2FA flow routes through a 2FA Server and Gateway to Telegram for owner approval."
              className="w-full rounded-lg border border-border"
              width={800}
              height={480}
            />

            <P>
              The keyring proxy and 2FA server communicate over a private network. Only the 2FA gateway (for Telegram webhooks) and your agent (for user-facing interface) are exposed externally.
            </P>
          </SubSection>

          <SubSection id="2fa" title="2FA via Telegram">
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
                ["2FA Server", "Manages the approval queue. Receives signing requests from keyring proxy, holds until owner responds."],
                ["2FA Gateway", "Connects to Telegram Bot API. Sends approval messages and receives webhook callbacks."],
              ]}
            />
            <div className="rounded-lg bg-surface border border-border px-4 py-3 mb-4">
              <p className="text-sm text-muted">
                <strong className="text-foreground">Telegram message example:</strong>
              </p>
              <pre className="mt-2 text-xs text-dim font-mono">{`🔐 SIWA Signing Request

📋 Request ID: abc123
⏱️ Expires: 60 seconds

🔑 Wallet: 0x742d35Cc...
📝 Operation: Sign Transaction
⛓️ Chain: Base (8453)

📤 To: 0xdead...beef
💰 Value: 0.5 ETH

[✅ Approve]  [❌ Reject]`}</pre>
            </div>
            <Table
              headers={["Property", "Detail"]}
              rows={[
                ["Scope", "Configurable per operation type — e.g. require approval for transactions but not for message signing."],
                ["Timeout", "Pending approvals expire after a configurable window (default 60 seconds)."],
                ["Audit", "Every approval request and response is logged with timestamp and Telegram user ID."],
                ["Fallback", "If the owner doesn't respond within the timeout, the request is rejected."],
              ]}
            />
          </SubSection>
        </Section>

        {/* Prerequisites */}
        <Section id="prerequisites" title="Prerequisites">
          <SubSection id="prereq-railway" title="Railway Account">
            <P>
              You need a{" "}
              <a
                href="https://railway.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                Railway
              </a>{" "}
              account. That&apos;s it for the one-click deployment.
            </P>
          </SubSection>

          <SubSection id="prereq-2fa" title="2FA Bot Setup (Optional)">
            <P>
              To enable 2FA, create a Telegram bot before deploying:
            </P>
            <Step number={1} title="Create the bot">
              <P>
                Open{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
                >
                  @BotFather
                </a>{" "}
                on Telegram and send <InlineCode>/newbot</InlineCode>. Follow the prompts to name your bot.
              </P>
              <P>
                BotFather will give you a <strong className="text-foreground">Bot Token</strong> — save it for deployment.
              </P>
            </Step>
            <Step number={2} title="Get your Chat ID">
              <P>
                Send a message to <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200">@userinfobot</a>. The bot will reply with your <strong className="text-foreground">Chat ID</strong>.
              </P>
            </Step>
            <div className="rounded-lg bg-surface border border-border px-4 py-3 mb-4">
              <p className="text-xs text-dim">
                More 2FA channels coming soon: Slack, Discord, Gmail, wallet-based approvals.
              </p>
            </div>
          </SubSection>
        </Section>

        {/* One-Click Deployment */}
        <Section id="one-click" title="One-Click Deployment">
          <P>
            The fastest way to get started. This template deploys a <strong className="text-foreground">new OpenClaw agent</strong> along with all services:
          </P>
          <Table
            headers={["Service", "Description"]}
            rows={[
              ["OpenClaw", "AI agent gateway with SIWA skill built-in"],
              ["Keyring Proxy", "Secure signing service — holds encrypted keys, never exposed publicly"],
              ["2FA Gateway", "Receives Telegram webhooks for approval requests"],
              ["2FA Server", "Manages the approval queue between keyring and Telegram"],
            ]}
          />

          <div className="mb-6">
            <a
              href="https://railway.com/deploy/siwa-keyring-proxy?referralCode=ZUrs1W"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
            >
              <div className="flex items-center gap-3 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://railway.com/button.svg"
                  alt="Deploy on Railway"
                  className="h-8"
                />
              </div>
              <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
                Deploy Full Stack (New Agent)
              </h4>
              <p className="text-xs text-muted">
                OpenClaw + Keyring Proxy + 2FA services. All connected via private networking.
              </p>
            </a>
          </div>

          <div className="rounded-lg bg-surface border border-border px-4 py-3 mb-6">
            <p className="text-sm text-muted">
              <strong className="text-foreground">Already have an agent?</strong> Use the{" "}
              <a
                href="https://railway.com/deploy/siwa-keyring-keyring-proxy-telegram-2fa-?referralCode=ZUrs1W&utm_medium=integration&utm_source=template&utm_campaign=generic"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                Keyring Proxy + 2FA template
              </a>{" "}
              instead. See{" "}
              <a
                href="#existing-agent"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                Using an Existing Agent
              </a>.
            </p>
          </div>

          <SubSection id="one-click-config" title="Configuration">
            <P>
              During deployment, Railway will prompt you for:
            </P>
            <Table
              headers={["Variable", "Description"]}
              rows={[
                ["TELEGRAM_BOT_TOKEN", "The bot token from @BotFather"],
                ["TELEGRAM_CHAT_ID", "Your chat ID (from @userinfobot)"],
              ]}
            />
            <P>
              Once deployed, open OpenClaw and chat with your agent. The SIWA skill is pre-installed — ask it to create a wallet and register onchain.
            </P>
          </SubSection>
        </Section>

        {/* SDK Usage */}
        <Section id="sdk-usage" title="SDK Usage">
          <P>
            Connect your agent to the keyring proxy using the SIWA SDK:
          </P>

          <SubSection id="sdk-signer" title="Create a Signer">
            <CodeBlock language="typescript">{`import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});

// Use with any SIWA function
const { message, signature } = await signSIWAMessage(fields, signer);
const signedRequest = await signAuthenticatedRequest(req, receipt, signer, chainId);`}</CodeBlock>
          </SubSection>

          <SubSection id="sdk-admin" title="Admin Functions">
            <P>
              Create and manage wallets via the keystore module:
            </P>
            <CodeBlock language="typescript">{`import { createWallet, hasWallet, getAddress } from "@buildersgarden/siwa/keystore";

// Check if wallet exists
const exists = await hasWallet();

// Create a new wallet (key stored in proxy)
const { address } = await createWallet();

// Get the wallet address
const addr = await getAddress();`}</CodeBlock>
          </SubSection>

          <SubSection id="sdk-transactions" title="Sign Transactions">
            <P>
              Sign and broadcast transactions via the signer:
            </P>
            <CodeBlock language="typescript">{`import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});

const client = createPublicClient({ chain: base, transport: http() });
const address = await signer.getAddress();

const tx = {
  to: "0xRecipient...",
  value: parseEther("0.01"),
  nonce: await client.getTransactionCount({ address }),
  chainId: base.id,
  type: 2,
  maxFeePerGas: 1000000000n,
  maxPriorityFeePerGas: 1000000n,
  gas: 21000n,
};

// Sign via proxy (if 2FA enabled, requires Telegram approval)
const signedTx = await signer.signTransaction(tx);

// Broadcast
const hash = await client.sendRawTransaction({ serializedTransaction: signedTx });`}</CodeBlock>
          </SubSection>
        </Section>

        {/* Manual Deployment */}
        <Section id="manual" title="Manual Deployment">
          <P>
            For full control over what services to deploy and where:
          </P>
          <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
            <li>Deploy only specific services</li>
            <li>Use your own infrastructure (AWS, GCP, self-hosted)</li>
            <li>Customize the Docker images</li>
          </ul>

          <SubSection id="manual-repo" title="Repository">
            <CodeBlock language="bash">{`git clone https://github.com/builders-garden/siwa.git
cd siwa`}</CodeBlock>
            <P>
              Each service has its own Dockerfile in <InlineCode>packages/</InlineCode>:
            </P>
            <Table
              headers={["Service", "Path", "Purpose"]}
              rows={[
                ["keyring-proxy", "packages/keyring-proxy/", "Secure key storage and signing"],
                ["2fa-telegram", "packages/2fa-telegram/", "Approval queue server"],
                ["2fa-gateway", "packages/2fa-gateway/", "Telegram webhook handler"],
              ]}
            />
          </SubSection>

          <SubSection id="manual-docker" title="Build & Deploy">
            <CodeBlock language="bash">{`# Keyring Proxy
docker build -t keyring-proxy -f packages/keyring-proxy/Dockerfile .

# 2FA Server
docker build -t 2fa-telegram -f packages/2fa-telegram/Dockerfile .

# 2FA Gateway
docker build -t 2fa-gateway -f packages/2fa-gateway/Dockerfile .`}</CodeBlock>
            <P>
              Make sure services can communicate:
            </P>
            <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
              <li><strong className="text-foreground">Keyring Proxy</strong> — only accessible from your agent (private network)</li>
              <li><strong className="text-foreground">2FA Gateway</strong> — needs a public URL for Telegram webhooks</li>
              <li><strong className="text-foreground">2FA Server</strong> — only accessible from keyring proxy and 2FA gateway</li>
            </ul>
          </SubSection>

          <SubSection id="manual-env" title="Environment Variables">
            <P><strong className="text-foreground">keyring-proxy:</strong></P>
            <Table
              headers={["Variable", "Required", "Description"]}
              rows={[
                ["KEYRING_PROXY_SECRET", "Yes", "HMAC secret for authenticating requests"],
                ["KEYSTORE_PASSWORD", "Yes", "Password for encrypted keystore"],
                ["TFA_SERVER_URL", "No", "URL of 2FA server (enables transaction approval)"],
                ["TFA_SECRET", "No", "Shared secret with 2FA server"],
                ["TFA_OPERATIONS", "No", "Comma-separated list of operations requiring 2FA"],
                ["TFA_ENABLED", "No", "Set to true to enable 2FA"],
              ]}
            />
            <P><strong className="text-foreground">2fa-telegram:</strong></P>
            <Table
              headers={["Variable", "Required", "Description"]}
              rows={[
                ["TELEGRAM_BOT_TOKEN", "Yes", "Bot token from @BotFather"],
                ["TELEGRAM_CHAT_ID", "Yes", "Chat ID for approval messages"],
                ["TFA_SECRET", "Yes", "Shared secret with keyring proxy"],
                ["TFA_PORT", "Yes", "Server port (default: 3200)"],
              ]}
            />
            <P><strong className="text-foreground">2fa-gateway:</strong></P>
            <Table
              headers={["Variable", "Required", "Description"]}
              rows={[
                ["TELEGRAM_BOT_TOKEN", "Yes", "Same bot token as 2fa-telegram"],
                ["TFA_INTERNAL_URL", "Yes", "Internal URL of 2fa-telegram server"],
                ["TFA_GATEWAY_PORT", "Yes", "Gateway port (default: 3201)"],
              ]}
            />
          </SubSection>
        </Section>

        {/* Advanced Options */}
        <Section id="advanced" title="Advanced Options">
          <SubSection id="existing-wallet" title="Using an Existing Wallet">
            <P>
              Import an existing private key instead of creating a new wallet:
            </P>
            <CodeBlock language="bash">{`KEYSTORE_BACKEND=env
AGENT_PRIVATE_KEY=0x<your-private-key>`}</CodeBlock>
            <P>
              Useful when migrating an existing agent or using a wallet that already holds funds. Note: the key is held in memory at runtime. For higher security, prefer the <InlineCode>encrypted-file</InlineCode> backend.
            </P>
          </SubSection>

          <SubSection id="existing-agent" title="Using an Existing Agent">
            <P>
              If you have an existing AI agent, deploy only the Keyring Proxy and 2FA services. This template exposes the Keyring Proxy <strong className="text-foreground">publicly via HTTPS</strong>:
            </P>

            <div className="mb-6">
              <a
                href="https://railway.com/deploy/siwa-keyring-keyring-proxy-telegram-2fa-?referralCode=ZUrs1W&utm_medium=integration&utm_source=template&utm_campaign=generic"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
              >
                <div className="flex items-center gap-3 mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://railway.com/button.svg"
                    alt="Deploy on Railway"
                    className="h-8"
                  />
                </div>
                <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
                  Deploy Keyring Proxy + 2FA Only
                </h4>
                <p className="text-xs text-muted">
                  Connect your existing agent via HTTPS.
                </p>
              </a>
            </div>

            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 mb-4">
              <p className="text-sm font-mono text-yellow-400">
                Requires additional security measures for production use.
              </p>
            </div>
            <P>
              <strong className="text-foreground">Security implications:</strong>
            </P>
            <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
              <li>The keyring proxy becomes accessible over the internet</li>
              <li>If <InlineCode>KEYRING_PROXY_SECRET</InlineCode> is leaked, anyone can request signatures</li>
              <li>All signing requests still require 2FA approval (if enabled)</li>
            </ul>
            <P>
              <strong className="text-foreground">Recommended:</strong>
            </P>
            <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
              <li><strong className="text-foreground">Always enable 2FA</strong> — Even if the HMAC secret is compromised, attackers cannot complete transactions without your Telegram approval.</li>
              <li><strong className="text-foreground">Use Tailscale</strong> — Enforce that only your agent machine can connect to the keyring proxy.</li>
            </ul>
            <P>
              <strong className="text-foreground">Connect your agent:</strong>
            </P>
            <CodeBlock language="bash">{`KEYRING_PROXY_URL=https://your-keyring-proxy.example.com
KEYRING_PROXY_SECRET=<your-hmac-secret>`}</CodeBlock>
          </SubSection>
        </Section>

        {/* Cross-references */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <a
            href="/docs"
            className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 cursor-pointer block"
          >
            <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
              Documentation
            </h4>
            <p className="text-xs text-muted">
              SDK reference, protocol spec, and wallet options.
            </p>
          </a>
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
        </div>
      </article>
    </div>
  );
}
