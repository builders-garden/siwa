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
          Build Agents (signer side)
        </button>
        <button
          onClick={() => setActiveTab("platform")}
          className={`px-4 py-2 font-mono text-sm transition-colors duration-200 border-b-2 -mb-px ${
            activeTab === "platform"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-foreground"
          }`}
        >
          Build Apps (verifier side)
        </button>
      </div>

      {activeTab === "agent" && (
        <div>
          <P>
            Agents use SIWA to authenticate with services by signing a structured message that proves ownership of their ERC-8004 identity. The service verifies the signature and checks onchain registration.
          </P>

          <Step number={1} title="Install the SDK">
            <CodeBlock language="bash">{`npm install @buildersgarden/siwa`}</CodeBlock>
          </Step>

          <Step number={2} title="Create a Signer">
            <P>
              Choose any wallet provider. See{" "}
              <a
                href="#wallets"
                className="text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors duration-200"
              >
                Wallet Options
              </a>{" "}
              for all options.
            </P>
            <CodeBlock language="typescript">{`import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";

// Example: private key signer
const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);
const signer = createLocalAccountSigner(account);`}</CodeBlock>
          </Step>

          <Step number={3} title="Request a Nonce">
            <P>
              Get a nonce from the service you want to authenticate with.
            </P>
            <CodeBlock language="typescript">{`const response = await fetch("https://api.example.com/siwa/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: await signer.getAddress() }),
});
const { nonce, issuedAt } = await response.json();`}</CodeBlock>
          </Step>

          <Step number={4} title="Sign and Submit">
            <P>
              Build and sign the SIWA message, then submit it to the service.
            </P>
            <CodeBlock language="typescript">{`import { signSIWAMessage } from "@buildersgarden/siwa";

const { message, signature } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,  // Your ERC-8004 token ID
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt,
}, signer);

// Submit to service
const verifyResponse = await fetch("https://api.example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature }),
});
const { receipt } = await verifyResponse.json();`}</CodeBlock>
          </Step>

          <Step number={5} title="Make Authenticated Requests">
            <P>
              Use the receipt for subsequent API calls with ERC-8128 signatures.
            </P>
            <CodeBlock language="typescript">{`import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

const request = new Request("https://api.example.com/action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "transfer" }),
});

const signedRequest = await signAuthenticatedRequest(request, receipt, signer, 84532);
const response = await fetch(signedRequest);`}</CodeBlock>
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

          <Step number={2} title="Implement Auth Endpoints">
            <P>
              Add <InlineCode>/siwa/nonce</InlineCode> and <InlineCode>/siwa/verify</InlineCode> endpoints. The nonce endpoint issues challenges; the verify endpoint validates signatures and checks onchain ownership.
            </P>
            <CodeBlock language="typescript">{`import { verifySIWA, parseSIWAMessage } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({ chain: baseSepolia, transport: http() });
const nonceStore = new Map();

// POST /siwa/nonce - Issue a challenge
app.post("/siwa/nonce", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  nonceStore.set(nonce, { createdAt: Date.now() });
  res.json({ nonce, issuedAt: new Date().toISOString() });
});

// POST /siwa/verify - Validate signature and onchain ownership
app.post("/siwa/verify", async (req, res) => {
  const { message, signature } = req.body;
  const fields = parseSIWAMessage(message);

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => nonceStore.delete(nonce), // validate + consume
    client,
  );

  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  // Issue a receipt for authenticated requests
  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    verified: result.verified,
  }, { secret: process.env.RECEIPT_SECRET! });

  res.json({ receipt, agentId: result.agentId });
});`}</CodeBlock>
          </Step>

          <Step number={3} title="Protect API Routes">
            <P>
              Use middleware to verify ERC-8128 signed requests on protected routes.
            </P>
            <CodeBlock language="typescript">{`// Next.js App Router
import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

export const POST = withSiwa(async (agent, req) => {
  // agent.address, agent.agentId, agent.chainId available
  return { message: "Authenticated!", agent: agent.agentId };
});

export { siwaOptions as OPTIONS };`}</CodeBlock>
            <CodeBlock language="typescript">{`// Express
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";

app.use(siwaJsonParser());
app.use(siwaCors());

app.post("/api/protected", siwaMiddleware(), (req, res) => {
  // req.agent contains verified agent info
  res.json({ agent: req.agent });
});`}</CodeBlock>
          </Step>
        </div>
      )}
    </div>
  );
}
