import { GetStartedBox } from "@/components/get-started-box";
import { CodeBlock } from "@/components/code-block";
import { CopyInstallCommand } from "@/components/copy-install-command";
import { SkillCallout } from "@/components/skill-callout";

const SIGN_IN_CODE = `import { signSIWAMessage } from "@buildersgarden/siwa";
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";

// Use any wallet - private key, Privy, etc.
const signer = createLocalAccountSigner(account);

const { message, signature } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004...",
  chainId: 84532,
  nonce,
  issuedAt: new Date().toISOString(),
}, signer);`;

const VERIFY_CODE = `import { createSIWANonce, verifySIWA } from "@buildersgarden/siwa";
import { createMemorySIWANonceStore } from "@buildersgarden/siwa/nonce-store";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia, transport: http(),
});
const nonceStore = createMemorySIWANonceStore();

// Nonce endpoint — issue
const nonce = await createSIWANonce(params, client, { nonceStore });

// Verify endpoint — consume
const result = await verifySIWA(
  message, signature, "api.example.com",
  { nonceStore }, client,
);
// result.valid, result.agentId, result.address`;

function HeroSection() {
  return (
    <section className="px-6 pt-24 pb-20">
      <div className="mx-auto max-w-5xl grid gap-12 md:grid-cols-2 md:items-center">
        {/* Left — problem statement + CTAs */}
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl leading-tight">
            Your API can&apos;t tell agents from humans.
          </h1>
          <p className="mt-6 max-w-md text-muted leading-relaxed">
            SIWA lets your server authenticate AI agents and filter out humans.
            Built on{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-8004"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-accent underline underline-offset-4 decoration-border transition-colors duration-200 cursor-pointer"
            >
              ERC-8004
            </a>
            {" "}and{" "}
            <a
              href="https://erc8128.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-accent underline underline-offset-4 decoration-border transition-colors duration-200 cursor-pointer"
            >
              ERC-8128
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

function TwoPhaseAuthSection() {
  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-12">
          How It Works
        </h2>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          {/* Phase 1 */}
          <div className="rounded-lg border border-border bg-surface p-6 flex flex-col">
            <div className="font-mono text-xs text-accent uppercase tracking-wider mb-3">
              Phase 1 — Sign-In
            </div>
            <h3 className="font-mono text-lg font-bold text-foreground mb-2">
              <a
                href="https://eips.ethereum.org/EIPS/eip-8004"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors duration-200"
              >
                ERC-8004
              </a>
            </h3>
            <p className="text-sm text-muted leading-relaxed flex-1">
              Agent proves its onchain identity. The server verifies NFT ownership on the ERC-8004 registry, checks the signer type, and issues a session receipt.
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

          {/* Phase 2 */}
          <div className="rounded-lg border border-border bg-surface p-6 flex flex-col">
            <div className="font-mono text-xs text-accent uppercase tracking-wider mb-3">
              Phase 2 — Session
            </div>
            <h3 className="font-mono text-lg font-bold text-foreground mb-2">
              <a
                href="https://erc8128.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors duration-200"
              >
                ERC-8128
              </a>
            </h3>
            <p className="text-sm text-muted leading-relaxed flex-1">
              Every subsequent API call is signed. The server verifies the signature and receipt on each request — no tokens, no API keys.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ForServersSection() {
  const capabilities = [
    {
      title: "Ownership",
      description: "Verify the agent owns its ERC-8004 identity onchain.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      title: "Signer type",
      description: "Enforce EOA-only, smart account-only, or allow both.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      ),
    },
    {
      title: "Framework support",
      description: "Drop-in middleware for Next.js, Express, Hono, and Fastify.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      title: "Registry criteria",
      description: "Query score, reputation, services, required trust level, crypto-economic guarantees, and TEE attestation from the ERC-8004 registry.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      title: "Per-request signing",
      description: "Every API call is cryptographically signed with ERC-8128. No bearer tokens, no shared secrets.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: "Agentic captcha",
      description: "Challenge callers to prove they're agents, not humans.",
      comingSoon: true,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-4">
          For Servers
        </h2>
        <p className="text-lg text-foreground font-mono font-semibold mb-8">
          One SDK, full control over who calls your API.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className={`rounded-lg border border-border bg-surface p-6${cap.comingSoon ? " opacity-50" : ""}`}
            >
              <div className="mb-3">{cap.icon}</div>
              <h3 className="font-mono text-sm font-semibold text-foreground">
                {cap.title}
                {cap.comingSoon && (
                  <span className="ml-2 text-[10px] font-normal text-dim uppercase tracking-wider border border-border rounded px-1.5 py-0.5">
                    Coming soon
                  </span>
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForAgentsSection() {
  const steps = [
    {
      number: "1",
      title: "Get a wallet",
      description: "Use any provider: Bankr, Privy, Coinbase, private key, keyring proxy, or others.",
    },
    {
      number: "2",
      title: "Register onchain",
      description: "Mint an ERC-8004 identity NFT on the registry.",
    },
    {
      number: "3",
      title: "Authenticate",
      description: "Sign in with SIWA, then sign every request with ERC-8128.",
    },
  ];

  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-4">
          For Agents
        </h2>
        <p className="text-lg text-foreground font-mono font-semibold mb-3">
          Your agent already knows how to authenticate.
        </p>
        <p className="text-sm text-muted mb-8 max-w-lg">
          Give your agent the SIWA skill or use the SDK directly. It learns what messages to sign, how to sign them, and how to maintain an authenticated session.
        </p>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {steps.map((step) => (
            <div key={step.number} className="rounded-lg border border-border bg-surface p-6">
              <div className="font-mono text-2xl font-bold text-accent mb-2">
                {step.number}
              </div>
              <h4 className="font-mono text-sm font-semibold text-foreground">
                {step.title}
              </h4>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Skill callout */}
        <SkillCallout />
      </div>
    </section>
  );
}

function QuickstartSection() {
  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-4">
          Quickstart
        </h2>
        <p className="text-sm text-muted mb-8 max-w-lg">
          Two functions — one on the agent to sign, one on the server to verify.
        </p>

        {/* Install command */}
        <CopyInstallCommand />

        {/* Code panels */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Agent side */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="font-mono text-xs text-dim">agent.ts</span>
              <span className="ml-auto font-mono text-[10px] text-accent uppercase tracking-wider">Agent</span>
            </div>
            <div className="[&>pre]:rounded-none [&>pre]:border-0">
              <CodeBlock language="typescript">{SIGN_IN_CODE}</CodeBlock>
            </div>
          </div>

          {/* Server side */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="font-mono text-xs text-dim">server.ts</span>
              <span className="ml-auto font-mono text-[10px] text-accent uppercase tracking-wider">Server</span>
            </div>
            <div className="[&>pre]:rounded-none [&>pre]:border-0">
              <CodeBlock language="typescript">{VERIFY_CODE}</CodeBlock>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/docs#getting-started"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors duration-200 cursor-pointer"
          >
            Read the full docs
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

function OpenStandardsSection() {
  const links = [
    {
      title: "ERC-8004",
      description: "Agent identity standard — onchain NFT registry",
      href: "https://eips.ethereum.org/EIPS/eip-8004",
      external: true,
    },
    {
      title: "ERC-8128",
      description: "HTTP message signatures for agent authentication",
      href: "https://erc8128.org/",
      external: true,
    },
    {
      title: "GitHub",
      description: "Source code, issues, and contributions",
      href: "https://github.com/builders-garden/siwa",
      external: true,
    },
    {
      title: "Documentation",
      description: "Guides, API reference, and examples",
      href: "/docs",
      external: false,
    },
  ];

  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-4">
            Built On Open Standards
          </h2>
          <p className="text-sm text-muted max-w-lg mx-auto">
            SIWA is MIT licensed, built on ERC-8004 and ERC-8128. No vendor lock-in, no proprietary protocols.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((link) => (
            <a
              key={link.title}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="rounded-lg border border-border bg-surface p-6 hover:border-dim transition-colors duration-200 group cursor-pointer"
            >
              <h3 className="font-mono text-sm font-semibold text-foreground group-hover:text-accent transition-colors duration-200">
                {link.title}
                {link.external && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1.5 mb-0.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                )}
              </h3>
              <p className="mt-2 text-sm text-muted">
                {link.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-6 py-3 text-center">
        <p className="text-sm font-mono text-yellow-400">
          This project is a work in progress. Use at your own risk — we welcome{" "}
          <a href="https://github.com/builders-garden/siwa" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-yellow-300 transition-colors duration-200">feedback and contributions</a>.
        </p>
      </div>
      <HeroSection />
      <TwoPhaseAuthSection />
      <ForServersSection />
      <ForAgentsSection />
      <QuickstartSection />
      <OpenStandardsSection />
    </div>
  );
}
