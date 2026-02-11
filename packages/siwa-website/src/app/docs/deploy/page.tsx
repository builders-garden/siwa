import { Metadata } from "next";
import { DeploySidebar } from "@/components/deploy-sidebar";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = {
  title: "Deploy — SIWA",
  description:
    "Deploy SIWA to Railway — keyring proxy, OpenClaw gateway, and 2FA services in one click.",
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
          Deploy SIWA
        </h1>
        <p className="text-sm text-dim mb-8">
          Two deployment paths: one-click for quick setup, or manual for full control.
        </p>

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

          <SubSection id="prereq-2fa" title="2FA Bot Setup (Optional if want to use 2FA)">
            <P>
              Before deploying, create a Telegram bot to receive transaction approval requests. This is required for secure operation.
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
                BotFather will give you a <strong className="text-foreground">Bot Token</strong> — save it, you&apos;ll need it during deployment.
              </P>
            </Step>
            <Step number={2} title="Get your Chat ID">
              <P>
                Open your new bot in Telegram and send <InlineCode>/start</InlineCode>. The bot will reply with your <strong className="text-foreground">Chat ID</strong>.
              </P>
              <P>
                Save this Chat ID — it tells the 2FA service where to send approval requests.
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
            The fastest way to get started. This deploys all services pre-configured and connected:
          </P>
          <Table
            headers={["Service", "Description"]}
            rows={[
              ["OpenClaw", "AI agent gateway with SIWA and Security skills built-in"],
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
                Deploy Full Stack
              </h4>
              <p className="text-xs text-muted">
                OpenClaw + Keyring Proxy + 2FA services. All connected via private networking.
              </p>
            </a>
          </div>

          <SubSection id="one-click-config" title="Configuration">
            <P>
              During deployment, Railway will prompt you for environment variables:
            </P>
            <Table
              headers={["Variable", "Description"]}
              rows={[
                ["TELEGRAM_BOT_TOKEN", "The bot token from @BotFather"],
                ["TELEGRAM_CHAT_ID", "Your chat ID (from /start command)"],
              ]}
            />
            <P>
              Once deployed, open OpenClaw and chat with your agent. The SIWA skill is pre-installed — ask it to create a wallet and register onchain.
            </P>
          </SubSection>
        </Section>

        {/* Manual Deployment */}
        <Section id="manual" title="Manual Deployment">
          <P>
            For full control over what services to deploy and where. Use this if you want to:
          </P>
          <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
            <li>Deploy only specific services</li>
            <li>Use your own infrastructure (AWS, GCP, self-hosted)</li>
            <li>Customize the Docker images</li>
            <li>Integrate with an existing agent</li>
          </ul>

          <SubSection id="manual-repo" title="Repository">
            <P>
              Clone or fork the SIWA repository:
            </P>
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
            <P>
              Build the Docker images:
            </P>
            <CodeBlock language="bash">{`# Keyring Proxy
docker build -t keyring-proxy -f packages/keyring-proxy/Dockerfile .

# 2FA Server
docker build -t 2fa-telegram -f packages/2fa-telegram/Dockerfile .

# 2FA Gateway
docker build -t 2fa-gateway -f packages/2fa-gateway/Dockerfile .`}</CodeBlock>
            <P>
              Deploy to your infrastructure of choice. Make sure services can communicate:
            </P>
            <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
              <li><strong className="text-foreground">Keyring Proxy</strong> should only be accessible from your agent (private network)</li>
              <li><strong className="text-foreground">2FA Gateway</strong> needs a public URL for Telegram webhooks</li>
              <li><strong className="text-foreground">2FA Server</strong> should only be accessible from keyring proxy and 2FA gateway</li>
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
                ["TFA_OPERATIONS", "No", "Comma-separated list of operations requiring 2FA (sign-message,sign-transaction,sign-authorization)"],
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
                ["TFA_AUDIT_LOG_PATH", "No", "Path to audit log file (default: ./audit.jsonl)"],
                ["TFA_APPROVAL_TIMEOUT_MS", "No", "Timeout in milliseconds (default: 60000)"],
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
              By default, the keyring proxy creates a new encrypted wallet. If you have an existing wallet you want to use, pass the private key via environment variable:
            </P>
            <CodeBlock language="bash">{`KEYSTORE_BACKEND=env
AGENT_PRIVATE_KEY=0x<your-private-key>`}</CodeBlock>
            <P>
              This is useful when migrating an existing agent or using a wallet that already holds funds. Note that the private key is held in memory at runtime — for higher security, prefer the <InlineCode>encrypted-file</InlineCode> backend with a strong password.
            </P>
          </SubSection>

          <SubSection id="existing-agent" title="Using an Existing Agent">
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 mb-4">
              <p className="text-sm font-mono text-yellow-400">
                Not recommended for production use.
              </p>
            </div>
            <P>
              If you have an existing AI agent (not deployed via the one-click template), you can connect it to the keyring proxy. However, this requires <strong className="text-foreground">publicly exposing</strong> the keyring proxy so your external agent can reach it.
            </P>
            <P>
              <strong className="text-foreground">Security implications:</strong>
            </P>
            <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
              <li>The keyring proxy becomes accessible over the internet</li>
              <li>If <InlineCode>KEYRING_PROXY_SECRET</InlineCode> is leaked, anyone can request signatures</li>
              <li>All signing requests will still require 2FA approval (if enabled)</li>
            </ul>
            <P>
              <strong className="text-foreground">Mitigation:</strong> Always enable 2FA when exposing the keyring proxy. Even if the HMAC secret is compromised, attackers cannot complete transactions without your Telegram approval.
            </P>
            <P>
              To connect an external agent, set these environment variables on your agent:
            </P>
            <CodeBlock language="bash">{`KEYRING_PROXY_URL=https://your-keyring-proxy.example.com
KEYRING_PROXY_SECRET=<your-hmac-secret>`}</CodeBlock>
            <P>
              The agent can then use the SIWA SDK to sign messages and transactions:
            </P>
            <CodeBlock language="typescript">{`import { signMessage, signTransaction } from "@buildersgarden/siwa/keystore";

// Signs via the remote keyring proxy
const { signature } = await signMessage("Hello");
const { signedTx } = await signTransaction({ to: "0x...", value: 1000n });`}</CodeBlock>
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
              SDK reference, protocol spec, security model, and contract addresses.
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
              Live HTTP endpoints you can call right now to try the full SIWA auth flow.
            </p>
          </a>
        </div>
      </article>
    </div>
  );
}
