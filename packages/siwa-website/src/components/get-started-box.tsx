"use client";

import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs text-dim hover:text-muted transition-colors duration-200 cursor-pointer"
      aria-label="Copy to clipboard"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function GetStartedBox() {
  const [tab, setTab] = useState<"developers" | "agents">("agents");

  return (
    <div className="w-full max-w-lg rounded-lg border border-border bg-surface">
      {/* Tab toggle */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("developers")}
          className={`flex-1 py-3 text-sm font-mono transition-colors duration-200 cursor-pointer ${
            tab === "developers"
              ? "text-accent border-b-2 border-accent"
              : "text-dim hover:text-muted"
          }`}
        >
          For Developers
        </button>
        <button
          onClick={() => setTab("agents")}
          className={`flex-1 py-3 text-sm font-mono transition-colors duration-200 cursor-pointer ${
            tab === "agents"
              ? "text-accent border-b-2 border-accent"
              : "text-dim hover:text-muted"
          }`}
        >
          <span className="relative">
            For Agents
            <span className="absolute -top-0.5 -right-2.5 h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === "developers" ? (
          <>
            <div className="rounded-md bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <code className="font-mono text-sm text-accent truncate min-w-0">
                  <span className="text-dim select-none">$ </span>
                  npm install @buildersgarden/siwa
                </code>
                <CopyButton text="npm install @buildersgarden/siwa" />
              </div>
            </div>

            <ol className="mt-5 space-y-2.5 text-sm text-muted">
              <li className="flex gap-3">
                <span className="font-mono text-accent">1.</span>
                Install the SDK
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">2.</span>
                Add SIWA verification to your server
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">3.</span>
                Agents authenticate with ERC-8004 identity
              </li>
            </ol>

            <a
              href="/docs"
              className="mt-5 inline-flex items-center gap-1 text-sm text-accent hover:text-blue-400 transition-colors duration-200 cursor-pointer"
            >
              Read the docs
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
          </>
        ) : (
          <>
            <div className="rounded-md bg-background px-4 py-3">
              <div className="flex items-start justify-between gap-3 min-w-0">
                <code className="font-mono text-sm text-accent min-w-0">
                  Read https://siwa.id/skill.md
                </code>
                <CopyButton text="Read https://siwa.id/skill.md and register as an ERC-8004 agent" />
              </div>
            </div>

            <ol className="mt-5 space-y-2.5 text-sm text-muted">
              <li className="flex gap-3">
                <span className="font-mono text-accent">1.</span>
                Read the skill file above
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">2.</span>
                Get a wallet (any provider works)
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">3.</span>
                Register onchain as an ERC-8004 agent
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">4.</span>
                Authenticate with any SIWA-compatible service
              </li>
            </ol>

            <a
              href="/skill.md"
              className="mt-5 inline-flex items-center gap-1 text-sm text-accent hover:text-blue-400 transition-colors duration-200 cursor-pointer"
            >
              View skill.md
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
          </>
        )}
      </div>
    </div>
  );
}
