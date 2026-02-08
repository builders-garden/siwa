"use client";

import { useEffect, useState } from "react";

const sections = [
  {
    title: "Getting Started",
    id: "getting-started",
    children: [
      { title: "How It Works", id: "how-it-works" },
      { title: "Try It Locally", id: "quick-start" },
      { title: "Install the SDK", id: "installation" },
      { title: "Sign In (Agent-Side)", id: "sign-in" },
      { title: "Verify (Server-Side)", id: "verify" },
    ],
  },
  {
    title: "Wallet Providers",
    id: "providers",
    children: [
      { title: "Overview", id: "providers-overview" },
      { title: "Keyring Proxy", id: "providers-proxy" },
      { title: "Encrypted File", id: "providers-encrypted-file" },
      { title: "Env Variable", id: "providers-env" },
      { title: "Coinbase CDP", id: "providers-cdp" },
      { title: "Privy", id: "providers-privy" },
      { title: "Circle", id: "providers-circle" },
      { title: "Base Account", id: "providers-base-account" },
    ],
  },
  {
    title: "API Reference",
    id: "api",
    children: [
      { title: "@buildersgarden/siwa/keystore", id: "api-keystore" },
      { title: "@buildersgarden/siwa", id: "api-siwa" },
      { title: "@buildersgarden/siwa/registry", id: "api-registry" },
      { title: "@buildersgarden/siwa/memory", id: "api-memory" },
      { title: "@buildersgarden/siwa/proxy-auth", id: "api-proxy-auth" },
    ],
  },
  {
    title: "Security Model",
    id: "security",
    children: [
      { title: "Keyring Proxy", id: "security-proxy" },
      { title: "Threat Model", id: "security-threats" },
      { title: "MEMORY.md", id: "security-memory" },
    ],
  },
  {
    title: "Signing Policies",
    id: "policies",
    children: [
      { title: "How Policies Work", id: "policies-overview" },
      { title: "Default Policy", id: "policies-default" },
      { title: "Policy Structure", id: "policies-structure" },
      { title: "Fields & Operators", id: "policies-fields" },
      { title: "Examples", id: "policies-examples" },
      { title: "Management API", id: "policies-api" },
    ],
  },
  {
    title: "Protocol Spec",
    id: "protocol",
    children: [
      { title: "Message Format", id: "protocol-message" },
      { title: "Field Definitions", id: "protocol-fields" },
      { title: "Auth Flow", id: "protocol-flow" },
      { title: "SIWA vs SIWE", id: "protocol-vs-siwe" },
    ],
  },
  {
    title: "Contracts",
    id: "contracts",
    children: [
      { title: "Mainnet", id: "contracts-mainnet" },
      { title: "Testnets", id: "contracts-testnet" },
      { title: "Solana", id: "contracts-solana" },
      { title: "Registry Format", id: "contracts-format" },
      { title: "RPC Endpoints", id: "contracts-rpc" },
      { title: "Explorer", id: "contracts-explorer" },
    ],
  },
];

export function DocsSidebar() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const allIds = sections.flatMap((s) => [
      s.id,
      ...s.children.map((c) => c.id),
    ]);

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
            <div className="mt-1.5 ml-2 space-y-1 border-l border-border pl-3">
              {section.children.map((child) => (
                <a
                  key={child.id}
                  href={`#${child.id}`}
                  className={`block text-xs transition-colors duration-200 cursor-pointer ${
                    activeId === child.id
                      ? "text-accent"
                      : "text-dim hover:text-muted"
                  }`}
                >
                  {child.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
