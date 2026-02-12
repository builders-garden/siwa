import { GetStartedBox } from "@/components/get-started-box";
import { CodeBlock } from "@/components/code-block";

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

const VERIFY_CODE = `import { verifySIWA } from "@buildersgarden/siwa";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const result = await verifySIWA(message, signature, {
  client,
  expectedDomain: "api.example.com",
  expectedAgentRegistry: "eip155:84532:0x8004...",
});

// result.success, result.data.agentId, result.data.address`;

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
            Authentication for AI agents with onchain identity.
            Built on{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-8004"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-accent transition-colors duration-200 underline underline-offset-4 decoration-border cursor-pointer"
            >
              ERC-8004
            </a>
            {" "}— like SIWE, but for agents.
          </p>
          <p className="mt-3 max-w-md text-sm text-dim leading-relaxed">
            Wallet-agnostic. Works with any signer.
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

function ValueSection() {
  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-8">
          <div className="font-mono text-xs text-dim uppercase tracking-wider mb-4">For Agents</div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">
            Prove who you are
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Sign a SIWA message with your wallet and authenticate with any service. Your ERC-8004 identity is verifiable onchain.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-8">
          <div className="font-mono text-xs text-dim uppercase tracking-wider mb-4">For Agent Builders</div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">
            Give your agent an identity
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Register your agent onchain and let it authenticate with any SIWA-compatible service. Use any wallet solution.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-8">
          <div className="font-mono text-xs text-dim uppercase tracking-wider mb-4">For Platform Builders</div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">
            Verify agent identity
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Know which agent is calling your API. Verify signatures and check onchain registration — no API keys needed.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhySIWASection() {
  const features = [
    {
      title: "Wallet-agnostic",
      description:
        "Works with any wallet provider — Privy, Coinbase, private keys, or our optional keyring proxy. You choose how to manage keys.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ),
    },
    {
      title: "Identity lives onchain",
      description:
        "Each agent gets an ERC-721 NFT on the Identity Registry. Transferable, verifiable, permanent — anyone can check it.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
    },
    {
      title: "Works on any chain",
      description:
        "Base, Ethereum, Linea, Polygon. Deploy on mainnet or testnets — wherever your agents live.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      title: "Open standard",
      description:
        "MIT licensed, built on ERC-8004 and ERC-8128. Works with any agent framework — Claude, GPT, custom agents.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
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
              <div className="mb-3">{feature.icon}</div>
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

function HowItWorksSection() {
  const signInSteps = [
    {
      number: "1",
      title: "Agent has an identity",
      description:
        "The agent has a wallet and an ERC-8004 NFT registered onchain — proving it's a valid agent.",
    },
    {
      number: "2",
      title: "Agent signs a message",
      description:
        "Build a SIWA message with nonce, domain, and agent ID. Sign it with any wallet provider.",
    },
    {
      number: "3",
      title: "Server verifies onchain",
      description:
        "Check the signature, verify NFT ownership on the registry, and grant access.",
    },
  ];

  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-12">
          How It Works
        </h2>

        <div className="mb-12">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            {signInSteps.map((step, i) => (
              <div key={step.number} className="contents">
                <div className="rounded-lg border border-border bg-surface p-5">
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

                {i < signInSteps.length - 1 && (
                  <>
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
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Wallet Options */}
        <div className="rounded-lg border border-border bg-surface p-8">
          <h3 className="font-mono text-sm font-semibold text-foreground mb-4">
            Bring Your Own Wallet
          </h3>
          <p className="text-sm text-muted leading-relaxed mb-6">
            SIWA uses a simple <code className="text-accent">Signer</code> interface that works with any wallet. The SDK provides adapters for common providers:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <div className="font-mono text-xs text-foreground mb-1">Embedded</div>
              <div className="text-xs text-dim">Privy, Dynamic, Magic</div>
            </div>
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <div className="font-mono text-xs text-foreground mb-1">Browser</div>
              <div className="text-xs text-dim"> Coinbase, WalletConnect</div>
            </div>
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <div className="font-mono text-xs text-foreground mb-1">Backend</div>
              <div className="text-xs text-dim">Private key, viem LocalAccount</div>
            </div>
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <div className="font-mono text-xs text-foreground mb-1">Self-hosted</div>
              <div className="text-xs text-dim">Keyring proxy with 2FA</div>
            </div>
          </div>
          <a
            href="/docs#wallets"
            className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:text-blue-400 transition-colors duration-200 cursor-pointer"
          >
            See all wallet options
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
        <div className="mb-8 rounded-lg border border-border bg-surface overflow-hidden inline-block">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="font-mono text-sm text-muted select-none">$</span>
            <code className="font-mono text-sm text-foreground">
              npm install @buildersgarden/siwa viem
            </code>
          </div>
        </div>

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
      <ValueSection />
      <WhySIWASection />
      <HowItWorksSection />
      <QuickstartSection />
      <OpenStandardsSection />
    </div>
  );
}
