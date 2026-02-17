"use client";

import { useEffect, useState } from "react";

type NavItem = { title: string; id: string };
type NavGroup = { label: string; items: NavItem[] };
type SectionChild = NavItem | NavGroup;

function isGroup(child: SectionChild): child is NavGroup {
  return "items" in child;
}

const sections: {
  title: string;
  id: string;
  children: SectionChild[];
}[] = [
  {
    title: "Getting Started",
    id: "getting-started",
    children: [],
  },
  {
    title: "How It Works",
    id: "architecture",
    children: [
      { title: "Auth Flow", id: "auth-flow" },
    ],
  },
  {
    title: "Signing (Agent-Side)",
    id: "signing",
    children: [
      {
        label: "Agentic Wallets",
        items: [
          { title: "Bankr", id: "wallet-bankr" },
          { title: "Circle", id: "wallet-circle" },
          { title: "Privy", id: "wallet-privy" },
        ],
      },
      {
        label: "Other Signers",
        items: [
          { title: "Private Key", id: "wallet-privatekey" },
          { title: "Keyring Proxy", id: "wallet-keyring" },
          { title: "Smart Accounts", id: "smart-accounts" },
        ],
      },
      {
        label: "Sign & Send",
        items: [
          { title: "SIWA Sign-In", id: "signing-siwa" },
          { title: "ERC-8128 Request Signing", id: "signing-erc8128" },
        ],
      },
    ],
  },
  {
    title: "Verification (Server-Side)",
    id: "verification",
    children: [
      {
        label: "Verify",
        items: [
          { title: "SIWA Verification", id: "verify-siwa" },
          { title: "ERC-8128 Request Verification", id: "verify-erc8128" },
        ],
      },
      {
        label: "Auth State",
        items: [
          { title: "Receipts", id: "verify-receipts" },
        ],
      },
      {
        label: "Server Middleware",
        items: [
          { title: "Next.js", id: "verify-wrappers-next" },
          { title: "Express", id: "verify-wrappers-express" },
          { title: "Hono", id: "verify-wrappers-hono" },
          { title: "Fastify", id: "verify-wrappers-fastify" },
        ],
      },
      {
        label: "Nonce Store",
        items: [
          { title: "Why Nonces", id: "nonce-why" },
          { title: "Memory", id: "nonce-memory" },
          { title: "Redis", id: "nonce-redis" },
          { title: "Cloudflare KV", id: "nonce-kv" },
          { title: "Database", id: "nonce-database" },
        ],
      },
    ],
  },
  {
    title: "x402 Payments",
    id: "x402",
    children: [
      {
        label: "Server",
        items: [
          { title: "Overview", id: "x402-overview" },
          { title: "Server Setup", id: "x402-server" },
          { title: "Sessions", id: "x402-sessions" },
          { title: "Config Reference", id: "x402-config" },
        ],
      },
      {
        label: "Middleware",
        items: [
          { title: "Express", id: "x402-express" },
          { title: "Next.js", id: "x402-next" },
          { title: "Hono", id: "x402-hono" },
          { title: "Fastify", id: "x402-fastify" },
        ],
      },
      {
        label: "Agent",
        items: [
          { title: "Agent-Side", id: "x402-agent" },
        ],
      },
    ],
  },
  {
    title: "Identity & Registry",
    id: "identity",
    children: [
      { title: "Identity File", id: "identity-file" },
      { title: "Onchain Registry", id: "identity-registry" },
    ],
  },
  {
    title: "Protocol Spec",
    id: "protocol",
    children: [
      { title: "Message Format", id: "protocol-message" },
      { title: "Field Definitions", id: "protocol-fields" },
      { title: "SIWA vs SIWE", id: "protocol-vs-siwe" },
    ],
  },
  {
    title: "Contracts",
    id: "contracts",
    children: [
      { title: "Mainnet", id: "contracts-mainnet" },
      { title: "Testnets", id: "contracts-testnet" },
      { title: "Registry Format", id: "contracts-format" },
      { title: "RPC Endpoints", id: "contracts-rpc" },
      { title: "Explorer", id: "contracts-explorer" },
    ],
  },
];

function getAllIds(): string[] {
  return sections.flatMap((s) => [
    s.id,
    ...s.children.flatMap((c) =>
      isGroup(c) ? c.items.map((i) => i.id) : [c.id]
    ),
  ]);
}

export function DocsSidebar() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const allIds = getAllIds();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const id of allIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const itemLink = (item: NavItem) => (
    <a
      key={item.id}
      href={`#${item.id}`}
      className={`block text-xs transition-colors duration-200 cursor-pointer ${
        activeId === item.id
          ? "text-accent"
          : "text-dim hover:text-muted"
      }`}
    >
      {item.title}
    </a>
  );

  return (
    <aside className="hidden md:block w-56 shrink-0 sticky top-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto">
      <nav className="space-y-4">
        {sections.map((section) => (
          <div key={section.id}>
            <a
              href={`#${section.id}`}
              className={`block font-mono text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                activeId === section.id
                  ? "text-accent"
                  : "text-foreground hover:text-accent"
              }`}
            >
              {section.title}
            </a>
            {section.children.length > 0 && (
              <div className="mt-1.5 ml-2 border-l border-border pl-3">
                {section.children.map((child) =>
                  isGroup(child) ? (
                    <div key={child.label} className="mt-2 first:mt-0">
                      <span className="block text-[10px] font-mono font-medium text-dim/60 uppercase tracking-wider mb-1">
                        {child.label}
                      </span>
                      <div className="space-y-1">
                        {child.items.map(itemLink)}
                      </div>
                    </div>
                  ) : (
                    <div key={child.id} className="mt-1">
                      {itemLink(child)}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
