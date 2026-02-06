"use client";

import { useEffect, useState } from "react";

const sections = [
  {
    title: "Getting Started",
    id: "getting-started",
    children: [
      { title: "Prerequisites", id: "prerequisites" },
      { title: "Step 1: Deploy Proxy", id: "deploy-proxy" },
      { title: "Step 2: Install SDK", id: "installation" },
      { title: "Step 3: Sign Up (Optional)", id: "sign-up" },
      { title: "Step 4: Sign In", id: "sign-in" },
      { title: "Step 5: Server Verification", id: "verify" },
      { title: "Quick Start", id: "quick-start" },
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
