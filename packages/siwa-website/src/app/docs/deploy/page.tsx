import { Metadata } from "next";
import { DeploySidebar } from "@/components/deploy-sidebar";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = {
  title: "Deploy — SIWA",
  description:
    "Deploy SIWA to Railway — keyring proxy and optional OpenClaw gateway.",
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

export default function DeployPage() {
  return (
    <div className="mx-auto flex max-w-6xl px-6 py-12">
      <DeploySidebar />

      <article className="min-w-0 flex-1 pl-0 md:pl-12">
        <h1 className="font-mono text-2xl font-bold text-foreground mb-2">
          Deploy to Railway
        </h1>
        <p className="text-sm text-dim mb-8">
          Keyring proxy from a Dockerfile, optional OpenClaw gateway alongside
          it.
        </p>

        {/* Deploy Buttons */}
        <div className="mb-12 grid gap-4 sm:grid-cols-2">
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
              Keyring Proxy Only
            </h4>
            <p className="text-xs text-muted">
              Deploy the signing proxy. Connect your own agent or OpenClaw
              instance externally.
            </p>
          </a>
          <div className="rounded-lg border border-border bg-surface p-5 opacity-50 cursor-default block">
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://railway.com/button.svg"
                alt="Deploy on Railway"
                className="h-8 grayscale"
              />
            </div>
            <h4 className="font-mono text-sm font-semibold text-foreground mb-1">
              Keyring Proxy + OpenClaw
            </h4>
            <p className="text-xs text-muted">
              Full stack: signing proxy and AI agent gateway with the SIWA skill
              pre-installed.
            </p>
            <p className="text-xs text-dim mt-2 italic">Coming soon</p>
          </div>
        </div>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <P>
            The core deployment is a single{" "}
            <InlineCode>keyring-proxy</InlineCode> service built from{" "}
            <InlineCode>packages/keyring-proxy/Dockerfile</InlineCode>. Railway
            builds directly from your Git repository — no Docker Hub needed.
          </P>
          <P>
            Optionally, you can add an <InlineCode>openclaw-gateway</InlineCode>{" "}
            service in the same Railway project. OpenClaw is an AI agent gateway
            that routes chat messages to agents — agents use the keyring proxy
            for all signing operations via{" "}
            <InlineCode>KEYSTORE_BACKEND=proxy</InlineCode>.
          </P>

          <SubSection id="architecture" title="Architecture">
            <Table
              headers={["Service", "Image", "Purpose"]}
              rows={[
                [
                  "keyring-proxy",
                  "packages/keyring-proxy/Dockerfile",
                  "Holds encrypted keys, HMAC-auth signing API",
                ],
                [
                  "openclaw-gateway",
                  "Docker image (optional)",
                  "AI agent gateway with SIWA skill installed",
                ],
              ]}
            />
            <CodeBlock language="text">{`Agent / OpenClaw
  |
  +---> keyring-proxy
  |     KEYSTORE_BACKEND=encrypted-file
  |     Signing service
  |     (private networking)
  |
  +---> openclaw-gateway   [optional]
        KEYSTORE_BACKEND=proxy
        Delegates signing to keyring-proxy`}</CodeBlock>
            <P>
              Railway auto-provisions private DNS between services in the same
              project. The openclaw-gateway reaches the keyring-proxy at its
              internal URL — no public exposure needed.
            </P>
          </SubSection>
        </Section>

        {/* Prerequisites */}
        <Section id="prerequisites" title="Prerequisites">
          <P>Before you begin, make sure you have:</P>
          <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
            <li>
              A{" "}
              <a
                href="https://railway.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                Railway
              </a>{" "}
              account
            </li>
            <li>The SIWA repo forked or cloned to your GitHub account</li>
            <li>A password for the encrypted-file keystore</li>
            <li>A shared HMAC secret for proxy authentication</li>
          </ul>
          <P>Generate a random HMAC secret:</P>
          <CodeBlock language="bash">{`openssl rand -hex 32`}</CodeBlock>
        </Section>

        {/* Create Project */}
        <Section id="create-project" title="Create Railway Project">
          <P>
            The fastest way to create your project is with the deploy button —
            it sets up the keyring-proxy service with the correct Dockerfile and
            configuration automatically:
          </P>
          <div className="mb-4">
            <a
              href="https://railway.com/deploy/siwa-keyring-proxy?referralCode=ZUrs1W"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://railway.com/button.svg"
                alt="Deploy on Railway"
                className="h-10"
              />
            </a>
          </div>
          <P>
            If you prefer to set things up manually, or want to add an
            openclaw-gateway alongside it, follow the steps below.
          </P>

          <SubSection
            id="configure-keyring-proxy"
            title="Configure keyring-proxy (manual)"
          >
            <P>
              <strong className="text-foreground">1.</strong> Add a new service
              from your SIWA repo. Railway will detect the{" "}
              <InlineCode>railway.json</InlineCode> and use{" "}
              <InlineCode>packages/keyring-proxy/Dockerfile</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">2.</strong> Name the service{" "}
              <InlineCode>keyring-proxy</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">3.</strong> No start command
              override needed — the Dockerfile&apos;s default{" "}
              <InlineCode>CMD</InlineCode> runs{" "}
              <InlineCode>pnpm run start</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">4.</strong> If the
              openclaw-gateway (or your agent) runs in the{" "}
              <strong className="text-foreground">same Railway project</strong>,
              keep this service private — it&apos;s reachable via internal
              networking. If your agent or OpenClaw instance runs{" "}
              <strong className="text-foreground">outside Railway</strong>,
              assign a public domain so it can reach the proxy over the
              internet.
            </P>
          </SubSection>

          <SubSection
            id="configure-openclaw"
            title="Configure openclaw-gateway (optional)"
          >
            <P>
              OpenClaw is an open-source AI agent gateway. Follow the{" "}
              <a
                href="https://docs.openclaw.ai/install/railway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
              >
                OpenClaw Railway installation guide
              </a>{" "}
              to deploy it. Once running, connect it to the keyring-proxy by
              setting these environment variables on the OpenClaw service:
            </P>
            <CodeBlock language="bash">{`KEYRING_PROXY_URL=https://your-keyring-proxy.up.railway.app
KEYRING_PROXY_SECRET=<same secret as keyring-proxy>`}</CodeBlock>
          </SubSection>
        </Section>

        {/* Environment Variables */}
        <Section id="env-vars" title="Environment Variables">
          <SubSection id="env-keyring-proxy" title="keyring-proxy">
            <Table
              headers={["Variable", "Required", "Description"]}
              rows={[
                [
                  "KEYRING_PROXY_SECRET",
                  "Yes",
                  "Shared HMAC secret. Must match openclaw-gateway (if deployed).",
                ],
                [
                  "KEYSTORE_BACKEND",
                  "No",
                  "Defaults to encrypted-file. Set to 'env' to use AGENT_PRIVATE_KEY.",
                ],
                [
                  "KEYSTORE_PASSWORD",
                  "Conditional",
                  "Required when KEYSTORE_BACKEND=encrypted-file.",
                ],
                [
                  "AGENT_PRIVATE_KEY",
                  "Conditional",
                  "Required when KEYSTORE_BACKEND=env. Hex-encoded private key (0x...).",
                ],
              ]}
            />
          </SubSection>

          <SubSection id="env-openclaw" title="openclaw-gateway (optional)">
            <Table
              headers={["Variable", "Required", "Description"]}
              rows={[
                [
                  "KEYRING_PROXY_URL",
                  "Yes",
                  "Public URL of the keyring proxy (e.g. https://your-keyring-proxy.up.railway.app).",
                ],
                [
                  "KEYRING_PROXY_SECRET",
                  "Yes",
                  "Shared HMAC secret. Must match keyring-proxy.",
                ],
              ]}
            />
            <P>
              Use Railway&apos;s shared variables to keep{" "}
              <InlineCode>KEYRING_PROXY_SECRET</InlineCode> in sync between
              both services.
            </P>
          </SubSection>
        </Section>

        {/* Use an Existing Wallet */}
        <Section id="existing-wallet" title="Use an Existing Wallet">
          <P>
            By default the keyring proxy generates and manages its own encrypted
            keystore. If you already have a wallet you want to use, you can pass
            the private key directly via environment variable instead.
          </P>
          <P>Set these two variables on your keyring-proxy service:</P>
          <CodeBlock language="bash">{`KEYSTORE_BACKEND=env
AGENT_PRIVATE_KEY=0x<your-private-key>`}</CodeBlock>
          <P>
            When <InlineCode>AGENT_PRIVATE_KEY</InlineCode> is set, the proxy
            automatically uses the <InlineCode>env</InlineCode> backend — you
            can omit <InlineCode>KEYSTORE_BACKEND</InlineCode> entirely. No{" "}
            <InlineCode>KEYSTORE_PASSWORD</InlineCode> is needed in this mode.
          </P>
          <P>
            This is useful when you want to plug in an existing wallet (e.g. one
            that already holds funds or is registered onchain) without going
            through the encrypted-file keystore flow.
          </P>
          <P>
            <strong className="text-foreground">Security note:</strong> the
            private key is held in memory at runtime. Make sure Railway&apos;s
            variable storage meets your security requirements. For higher
            security, prefer <InlineCode>encrypted-file</InlineCode> with a
            strong <InlineCode>KEYSTORE_PASSWORD</InlineCode>.
          </P>
        </Section>

        {/* Verify Deployment */}
        <Section id="verify" title="Verify Deployment">
          <SubSection id="health-checks" title="Health Checks">
            <P>
              The keyring-proxy exposes a <InlineCode>/health</InlineCode>{" "}
              endpoint. Railway uses this for automatic health checks
              (configured in <InlineCode>railway.json</InlineCode>).
            </P>
            <CodeBlock language="bash">{`curl https://your-keyring-proxy.up.railway.app/health

# Expected: { "status": "ok", ... }`}</CodeBlock>
          </SubSection>

          <SubSection id="test-curl" title="Test with curl">
            <P>
              If you gave the keyring-proxy a public domain for debugging, you
              can test signing:
            </P>
            <CodeBlock language="bash">{`# Check health
curl https://your-keyring-proxy.up.railway.app/health

# Check address (requires valid HMAC headers)
# In production, only the openclaw-gateway or your agent
# should call the proxy — never expose it publicly.`}</CodeBlock>
            <P>
              In production, remove any public domain from the keyring-proxy. It
              should only be reachable via Railway&apos;s internal network.
            </P>
          </SubSection>
        </Section>

        {/* Connect Your Agent */}
        <Section id="connect-agent" title="Connect Your Agent">
          <P>
            Point your agent at the deployed keyring-proxy by setting these
            environment variables:
          </P>
          <CodeBlock language="bash">{`KEYRING_PROXY_URL=https://your-keyring-proxy.up.railway.app
KEYRING_PROXY_SECRET=<your-shared-secret>`}</CodeBlock>
          <P>
            Use the public domain Railway assigns to your keyring-proxy service.
            The HMAC secret ensures only authorized clients can request
            signatures.
          </P>
          <P>
            For the full authentication flow, see the{" "}
            <a
              href="/docs#sign-in"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              Sign In documentation
            </a>
            .
          </P>
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
              SDK reference, protocol spec, security model, and contract
              addresses.
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
              Live HTTP endpoints you can call right now to try the full SIWA
              auth flow.
            </p>
          </a>
        </div>
      </article>
    </div>
  );
}
