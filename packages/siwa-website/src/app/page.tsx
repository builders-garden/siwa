import { GetStartedBox } from "@/components/get-started-box";

const SIWA_MESSAGE = `api.example.com wants you to sign in with your Agent account:
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0

Authenticate as a registered ERC-8004 agent.

URI: https://api.example.com/siwa
Version: 1
Agent ID: 42
Agent Registry: eip155:84532:0x8004A818...
Chain ID: 84532
Nonce: abc123def456
Issued At: 2026-02-05T12:00:00Z`;

function HeroSection() {
  return (
    <section className="flex flex-col items-center px-6 pt-24 pb-20 text-center">
      <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
        SIWA
      </h1>
      <p className="mt-2 font-mono text-lg text-accent">
        Sign In With Agent
      </p>
      <p className="mt-6 max-w-lg text-muted leading-relaxed">
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

      <div className="mt-12 w-full flex justify-center">
        <GetStartedBox />
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Register",
      description:
        "Agent mints an ERC-8004 identity NFT. Gets a unique agentId and agentURI pointing to its metadata.",
    },
    {
      number: "02",
      title: "Challenge",
      description:
        "Service sends a nonce. Agent signs a structured SIWA message via the keyring proxy. Key never touches the agent.",
    },
    {
      number: "03",
      title: "Verify",
      description:
        "Service recovers the signer, checks onchain NFT ownership, and issues a session token.",
    },
  ];

  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-12">
          How SIWA Works
        </h2>
        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <div key={step.number}>
              <span className="font-mono text-5xl font-bold text-border">
                {step.number}
              </span>
              <h3 className="mt-4 font-mono text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.description}
              </p>
            </div>
          ))}
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

function MessageFormatSection() {
  return (
    <section className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-mono text-sm font-medium tracking-widest text-dim uppercase mb-4">
          SIWA Message Format
        </h2>
        <p className="text-sm text-muted mb-8 max-w-lg">
          Like{" "}
          <a
            href="https://eips.ethereum.org/EIPS/eip-4361"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-accent transition-colors duration-200 underline underline-offset-4 decoration-border cursor-pointer"
          >
            SIWE
          </a>
          , but extended with Agent ID and Agent Registry fields for ERC-8004 identity verification.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-6 font-mono text-sm leading-relaxed text-muted">
          <code>{SIWA_MESSAGE}</code>
        </pre>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <HowItWorksSection />
      <WhySIWASection />
      <MessageFormatSection />
    </div>
  );
}
