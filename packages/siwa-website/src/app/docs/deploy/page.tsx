import { Metadata } from "next";
import { DeploySidebar } from "@/components/deploy-sidebar";

export const metadata: Metadata = {
  title: "Deploy — SIWA",
  description:
    "Deploy SIWA to Railway — keyring proxy and optional OpenClaw gateway.",
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

export default function DeployPage() {
  return (
    <div className="mx-auto flex max-w-6xl px-6 py-12">
      <DeploySidebar />

      <article className="min-w-0 flex-1 pl-0 md:pl-12">
        <h1 className="font-mono text-2xl font-bold text-foreground mb-2">
          Deploy to Railway
        </h1>
        <p className="text-sm text-dim mb-8">
          Keyring proxy from a Dockerfile, optional OpenClaw gateway alongside it.
        </p>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <P>
            The core deployment is a single <InlineCode>keyring-proxy</InlineCode> service built from <InlineCode>Dockerfile.proxy</InlineCode> in the repo root. Railway builds directly from your Git repository — no Docker Hub needed.
          </P>
          <P>
            Optionally, you can add an <InlineCode>openclaw-gateway</InlineCode> service in the same Railway project. OpenClaw is an AI agent gateway that routes chat messages to agents — agents use the keyring proxy for all signing operations via <InlineCode>KEYSTORE_BACKEND=proxy</InlineCode>.
          </P>

          <SubSection id="architecture" title="Architecture">
            <Table
              headers={["Service", "Image", "Port", "Purpose"]}
              rows={[
                ["keyring-proxy", "Dockerfile.proxy (this repo)", "3100", "Holds encrypted keys, HMAC-auth signing API"],
                ["openclaw-gateway", "Docker image (optional)", "18789", "AI agent gateway with SIWA skill installed"],
              ]}
            />
            <CodeBlock>{`Agent / OpenClaw
  |
  +---> keyring-proxy (port 3100)
  |     KEYSTORE_BACKEND=encrypted-file
  |     Signs messages, never exposes keys
  |     (private networking)
  |
  +---> openclaw-gateway (port 18789)   [optional]
        KEYSTORE_BACKEND=proxy
        Delegates signing to keyring-proxy`}</CodeBlock>
            <P>
              Railway auto-provisions private DNS between services in the same project. The openclaw-gateway reaches the keyring-proxy at <InlineCode>keyring-proxy.railway.internal:3100</InlineCode>.
            </P>
          </SubSection>
        </Section>

        {/* Prerequisites */}
        <Section id="prerequisites" title="Prerequisites">
          <P>
            Before you begin, make sure you have:
          </P>
          <ul className="list-disc list-inside text-sm text-muted mb-4 space-y-1">
            <li>A <a href="https://railway.com" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer">Railway</a> account</li>
            <li>The SIWA repo forked or cloned to your GitHub account</li>
            <li>A password for the encrypted-file keystore</li>
            <li>A shared HMAC secret for proxy authentication</li>
          </ul>
          <P>
            Generate a random HMAC secret:
          </P>
          <CodeBlock>{`openssl rand -hex 32`}</CodeBlock>
        </Section>

        {/* Create Project */}
        <Section id="create-project" title="Create Railway Project">
          <P>
            Create a new project in Railway. At minimum you need one service (keyring-proxy). Add the openclaw-gateway only if you want to run an agent gateway alongside it.
          </P>

          <SubSection id="configure-keyring-proxy" title="Configure keyring-proxy">
            <P>
              <strong className="text-foreground">1.</strong> Add a new service from your SIWA repo. Railway will detect the <InlineCode>railway.json</InlineCode> and use <InlineCode>Dockerfile.proxy</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">2.</strong> Name the service <InlineCode>keyring-proxy</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">3.</strong> No start command override needed — the Dockerfile&apos;s default <InlineCode>CMD</InlineCode> runs <InlineCode>pnpm run proxy</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">4.</strong> Set the port to <InlineCode>3100</InlineCode> in the service&apos;s networking settings.
            </P>
            <P>
              <strong className="text-foreground">5.</strong> If the openclaw-gateway (or your agent) runs in the <strong className="text-foreground">same Railway project</strong>, keep this service private — it&apos;s reachable via internal networking. If your agent or OpenClaw instance runs <strong className="text-foreground">outside Railway</strong>, assign a public domain so it can reach the proxy over the internet.
            </P>
          </SubSection>

          <SubSection id="configure-openclaw" title="Configure openclaw-gateway (optional)">
            <P>
              The OpenClaw gateway is a separate Docker image — it is not built from this repo. You can deploy it as a Railway service using a Docker image reference.
            </P>
            <P>
              <strong className="text-foreground">1.</strong> Add a new service and select <strong className="text-foreground">Docker Image</strong> as the source.
            </P>
            <P>
              <strong className="text-foreground">2.</strong> Point it at your OpenClaw image (e.g. from a container registry).
            </P>
            <P>
              <strong className="text-foreground">3.</strong> Name the service <InlineCode>openclaw-gateway</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">4.</strong> Set the port to <InlineCode>18789</InlineCode>.
            </P>
            <P>
              <strong className="text-foreground">5.</strong> Use Railway reference variables to connect to the keyring-proxy:
            </P>
            <CodeBlock>{`KEYRING_PROXY_URL=http://keyring-proxy.railway.internal:3100
KEYRING_PROXY_SECRET=<same secret as keyring-proxy>`}</CodeBlock>
            <P>
              <strong className="text-foreground">6.</strong> The entrypoint script (<InlineCode>scripts/openclaw-entrypoint.sh</InlineCode>) installs SIWA skill dependencies and registers the skill before starting the gateway.
            </P>
          </SubSection>
        </Section>

        {/* Environment Variables */}
        <Section id="env-vars" title="Environment Variables">
          <SubSection id="env-keyring-proxy" title="keyring-proxy">
            <Table
              headers={["Variable", "Required", "Description"]}
              rows={[
                ["KEYRING_PROXY_SECRET", "Yes", "Shared HMAC secret. Must match openclaw-gateway (if deployed)."],
                ["KEYSTORE_BACKEND", "No", "Defaults to encrypted-file."],
                ["KEYSTORE_PASSWORD", "Yes", "Password for the encrypted-file keystore."],
                ["KEYRING_PROXY_PORT", "No", "Defaults to 3100."],
              ]}
            />
          </SubSection>

          <SubSection id="env-openclaw" title="openclaw-gateway (optional)">
            <Table
              headers={["Variable", "Required", "Description"]}
              rows={[
                ["KEYSTORE_BACKEND", "Yes", "Must be proxy."],
                ["KEYRING_PROXY_URL", "Yes", "http://keyring-proxy.railway.internal:3100"],
                ["KEYRING_PROXY_SECRET", "Yes", "Shared HMAC secret. Must match keyring-proxy."],
              ]}
            />
            <P>
              Use Railway&apos;s shared variables to keep <InlineCode>KEYRING_PROXY_SECRET</InlineCode> in sync between both services.
            </P>
          </SubSection>
        </Section>

        {/* Verify Deployment */}
        <Section id="verify" title="Verify Deployment">
          <SubSection id="health-checks" title="Health Checks">
            <P>
              The keyring-proxy exposes a <InlineCode>/health</InlineCode> endpoint. Railway uses this for automatic health checks (configured in <InlineCode>railway.json</InlineCode>).
            </P>
            <CodeBlock>{`# keyring-proxy (internal only — run from Railway shell)
curl http://keyring-proxy.railway.internal:3100/health

# Expected: { "status": "ok", ... }`}</CodeBlock>
          </SubSection>

          <SubSection id="test-curl" title="Test with curl">
            <P>
              If you gave the keyring-proxy a public domain for debugging, you can test signing:
            </P>
            <CodeBlock>{`# Check health
curl https://your-keyring-proxy.up.railway.app/health

# Check address (requires valid HMAC headers)
# In production, only the openclaw-gateway or your agent
# should call the proxy — never expose it publicly.`}</CodeBlock>
            <P>
              In production, remove any public domain from the keyring-proxy. It should only be reachable via Railway&apos;s internal network.
            </P>
          </SubSection>
        </Section>

        {/* Connect Your Agent */}
        <Section id="connect-agent" title="Connect Your Agent">
          <P>
            Point your agent at the deployed keyring-proxy by setting these environment variables:
          </P>
          <CodeBlock>{`# Same Railway project — use internal networking
KEYSTORE_BACKEND=proxy
KEYRING_PROXY_URL=http://keyring-proxy.railway.internal:3100
KEYRING_PROXY_SECRET=<your-shared-secret>

# External agent / existing OpenClaw — use the public domain
KEYSTORE_BACKEND=proxy
KEYRING_PROXY_URL=https://your-keyring-proxy.up.railway.app
KEYRING_PROXY_SECRET=<your-shared-secret>`}</CodeBlock>
          <P>
            If your agent or OpenClaw instance runs inside the same Railway project, it reaches the proxy via internal networking. If it runs externally (e.g. an existing OpenClaw container or a local agent), assign a public domain to the keyring-proxy and use that URL instead. The HMAC secret ensures only authorized clients can request signatures.
          </P>
          <P>
            For the full authentication flow, see the{" "}
            <a
              href="/docs#sign-in"
              className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200 cursor-pointer"
            >
              Sign In documentation
            </a>.
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
