import { GetStartedBox } from "@/components/get-started-box";

const SIGN_IN_CODE = `import { signSIWAMessage } from '@buildersgarden/siwa';

const { message, signature } = await signSIWAMessage({
  domain: 'api.example.com',
  address,
  agentId,
  agentRegistry,
  chainId,
  nonce,
  issuedAt,
});`;

const VERIFY_CODE = `import { verifySIWA } from '@buildersgarden/siwa';

const result = verifySIWA(message, signature, {
  domain: 'api.example.com',
  nonce: storedNonce,
});

// result.address, result.agentId, result.chainId
const owner = await registry.ownerOf(result.agentId);`;

function HeroSection() {
  return (
    <section className="px-6 pt-24 pb-20">
      <div className="mx-auto max-w-5xl grid gap-12 md:grid-cols-2 md:items-center">
        {/* Left — title + CTAs */}
        <div>
          <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
            SIWA
          </h1>
          <p className="mt-2 font-mono text-lg text-accent">
            Sign In With Agent
          </p>
          <p className="mt-6 max-w-md text-muted leading-relaxed">
            Trustless identity and authentication for AI agents.
            An open standard built on{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-8004"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-accent transition-colors duration-200 underline underline-offset-4 decoration-border cursor-pointer"
            >
              ERC-8004
            </a>
            .
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/docs#getting-started"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors duration-200 cursor-pointer"
            >
              Get Started
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a
              href="https://github.com/builders-garden/siwa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground hover:border-dim transition-colors duration-200 cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>

        {/* Right — GetStartedBox (developer/agent tabs) */}
        <div className="w-full max-w-lg">
          <GetStartedBox />
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-4">
          Architecture
        </h2>
        <p className="text-sm text-muted mb-12 max-w-lg">
          The agent never touches the private key. All signing is delegated to a keyring proxy over HMAC-authenticated HTTP.
        </p>

        {/* Diagram */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]  md:items-center">
          {/* Agent */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="font-mono text-xs text-dim uppercase tracking-wider mb-2">Agent</div>
            <div className="font-mono text-sm font-semibold text-foreground">OpenClaw</div>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              Runs the AI agent. Calls SDK functions. Never sees the private key.
            </p>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center text-border">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M0 12h32" />
              <path d="M28 6l6 6-6 6" />
            </svg>
          </div>
          <div className="flex md:hidden items-center justify-center text-border py-1">
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 0v24" />
              <path d="M6 20l6 6 6-6" />
            </svg>
          </div>

          {/* Keyring Proxy */}
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-5">
            <div className="font-mono text-xs text-dim uppercase tracking-wider mb-2">Keyring Proxy</div>
            <div className="font-mono text-sm font-semibold text-accent">Signs via HMAC</div>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              Holds the encrypted private key. Returns signatures only. Full audit log.
            </p>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center text-border">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M0 12h32" />
              <path d="M28 6l6 6-6 6" />
            </svg>
          </div>
          <div className="flex md:hidden items-center justify-center text-border py-1">
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 0v24" />
              <path d="M6 20l6 6 6-6" />
            </svg>
          </div>

          {/* Server */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="font-mono text-xs text-dim uppercase tracking-wider mb-2">Your Server</div>
            <div className="font-mono text-sm font-semibold text-foreground">verifySIWA()</div>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              Verifies signature, checks onchain NFT ownership, issues session token.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeExamplesSection() {
  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-4">
          Two Sides, One Protocol
        </h2>
        <p className="text-sm text-muted mb-12 max-w-lg">
          Agent signs a structured message. Server verifies signature and onchain ownership. That&apos;s it.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Agent side */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="font-mono text-xs text-dim">agent.ts</span>
              <span className="ml-auto font-mono text-[10px] text-accent uppercase tracking-wider">Agent</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-muted">
              <code>{SIGN_IN_CODE}</code>
            </pre>
          </div>

          {/* Server side */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="font-mono text-xs text-dim">server.ts</span>
              <span className="ml-auto font-mono text-[10px] text-accent uppercase tracking-wider">Server</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-muted">
              <code>{VERIFY_CODE}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhySIWASection() {
  const features = [
    {
      title: "Key Isolation",
      description:
        "Private keys live in a separate keyring proxy process. Even full agent compromise cannot extract the key — only request signatures.",
    },
    {
      title: "Onchain Identity",
      description:
        "ERC-721 NFT on the Identity Registry. Transferable, verifiable, permanent. Your agent's identity lives onchain.",
    },
    {
      title: "Multi-Chain",
      description:
        "Base, Ethereum Sepolia, Linea, Polygon. Deploy on mainnet or testnets. More chains coming.",
    },
    {
      title: "Open Standard",
      description:
        "MIT licensed. Inspired by EIP-4361 (SIWE). Built for any agent framework — Claude, GPT, custom agents.",
    },
  ];

  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-12">
          Why SIWA
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-border bg-surface p-6"
            >
              <h3 className="font-mono text-sm font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <ArchitectureSection />
      <CodeExamplesSection />
      <WhySIWASection />
    </div>
  );
}
