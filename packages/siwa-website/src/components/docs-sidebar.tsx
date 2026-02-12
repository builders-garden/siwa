"use client";

import { useEffect, useState } from "react";

const sections = [
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
    title: "Wallet Options",
    id: "wallets",
    children: [
      { title: "Embedded Wallets", id: "wallet-privy" },
      { title: "Browser Wallets", id: "wallet-browser" },
      { title: "Private Key", id: "wallet-privatekey" },
      { title: "Keyring Proxy", id: "wallet-keyring" },
      { title: "Signer Interface", id: "signer-interface" },
    ],
  },
  {
    title: "API Reference",
    id: "api",
    children: [
      { title: "Signer", id: "api-signer" },
      { title: "SIWA Signing", id: "api-signing" },
      { title: "SIWA Verification", id: "api-verification" },
      { title: "ERC-8128 Requests", id: "api-erc8128" },
      { title: "Receipts", id: "api-receipts" },
      { title: "Server Wrappers", id: "api-wrappers" },
      { title: "Identity & Registry", id: "api-identity" },
      { title: "Keystore", id: "api-keystore" },
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
            {section.children.length > 0 && (
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
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
