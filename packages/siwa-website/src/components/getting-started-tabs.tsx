"use client";

import { useState } from "react";
import { CodeBlock } from "./code-block";

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

export function GettingStartedTabs() {
  const [activeTab, setActiveTab] = useState<"agent" | "platform">("agent");

  return (
    <div>
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("agent")}
          className={`px-4 py-2 font-mono text-sm transition-colors duration-200 border-b-2 -mb-px ${
            activeTab === "agent"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-foreground"
          }`}
        >
          Build Agents
        </button>
        <button
          onClick={() => setActiveTab("platform")}
          className={`px-4 py-2 font-mono text-sm transition-colors duration-200 border-b-2 -mb-px ${
            activeTab === "platform"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-foreground"
          }`}
        >
          Build Apps
        </button>
      </div>

      {activeTab === "agent" && (
        <div>
          <P>
            Deploy an AI agent with a secure wallet and onchain identity. The agent can create wallets, register on ERC-8004, execute transactions, and authenticate with SIWA-compatible services.
          </P>

          <Step number={1} title="Create a Telegram 2FA Bot (Optional)">
            <P>
              For transaction approval via Telegram, create a bot on{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                @BotFather
              </a>
              . Send <InlineCode>/newbot</InlineCode>, follow the prompts, and save the bot token. Then, in Telegram, send any message to <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200">@userinfobot</a> to get your chat ID.
            </P>
            <p className="text-xs text-dim">
              More channels coming soon: Slack, Discord, Gmail, wallet approvals.
            </p>
          </Step>

          <Step number={2} title="Deploy on Railway">
            <P>
              Click the button below to deploy the keyring proxy, 2FA services, and{" "}
              <a
                href="https://openclaw.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                OpenClaw
              </a>{" "}
              agent gateway — all pre-wired and ready to go.
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
                  width={180}
                  height={40}
                />
              </a>
            </div>
            <P>
              Fill in the environment variables during deployment. See the{" "}
              <a
                href="/docs/deploy"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                deployment guide
              </a>{" "}
              for details, or if you already have an Agent,{" "}
              <a
                href="/docs/deploy#existing-agent"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                learn how to use SIWA
              </a>
              .
            </P>
          </Step>

          <Step number={3} title="Configure OpenClaw">
            <P>
              Set your LLM API key, system prompt, and any MCP servers in the OpenClaw dashboard. The SIWA skill is already installed — your agent knows how to create wallets and register onchain.
            </P>
          </Step>

          <Step number={4} title="Chat with Your Agent">
            <P>
              Open OpenClaw and ask your agent to set up its identity:
            </P>
            <div className="rounded-lg bg-surface border border-border px-4 py-3 mb-4">
              <p className="text-sm text-muted italic">&quot;Create a wallet and register on ERC-8004&quot;</p>
            </div>
            <P>
              The agent will create a wallet (key stored securely in the keyring proxy), register onchain, and save its identity. If 2FA is enabled, you&apos;ll approve the registration transaction via Telegram.
            </P>
          </Step>
        </div>
      )}

      {activeTab === "platform" && (
        <div>
          <P>
            Add SIWA authentication to your platform to verify that requests come from registered AI agents with valid onchain identities.
          </P>

          <Step number={1} title="Install the SDK">
            <CodeBlock language="bash">{`npm install @buildersgarden/siwa`}</CodeBlock>
          </Step>

          <Step number={2} title="Implement Auth Routes">
            <P>
              Add <InlineCode>/siwa/nonce</InlineCode> and <InlineCode>/siwa/verify</InlineCode> endpoints. The nonce endpoint issues challenges; the verify endpoint validates signatures and checks onchain ownership.
            </P>
            <CodeBlock language="typescript">{`import { verifySIWA } from "@buildersgarden/siwa";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({ chain: base, transport: http() });

// POST /siwa/nonce
app.post("/siwa/nonce", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  nonceStore.set(nonce, { createdAt: Date.now() });
  res.json({ nonce, issuedAt: new Date().toISOString() });
});

// POST /siwa/verify
app.post("/siwa/verify", async (req, res) => {
  const { message, signature } = req.body;
  const result = await verifySIWA(
    message,
    signature,
    "your-domain.com",
    (nonce) => nonceStore.delete(nonce),
    client
  );
  if (!result.success) return res.status(401).json({ error: result.error });
  // Issue session token or receipt...
});`}</CodeBlock>
          </Step>

          <Step number={3} title="Add Auth Middleware">
            <P>
              Protect your API routes with the appropriate middleware for your stack.
            </P>
            <CodeBlock language="typescript">{`// Next.js
import { withSiwa } from "@buildersgarden/siwa/next";

export const POST = withSiwa(async (agent, req) => {
  // agent.address, agent.agentId available
  return { message: "Authenticated!" };
});

// Express
import { siwaMiddleware } from "@buildersgarden/siwa/express";

app.use("/api/protected", siwaMiddleware());
app.get("/api/protected/data", (req, res) => {
  res.json({ agent: req.agent });
});`}</CodeBlock>
          </Step>
        </div>
      )}
    </div>
  );
}
