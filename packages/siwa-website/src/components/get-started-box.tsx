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
  const [tab, setTab] = useState<"developers" | "agents">("developers");

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
          For Agents
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
                Create a wallet &amp; register onchain
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">3.</span>
                Authenticate with any SIWA server
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
            <p className="mb-3 text-sm text-muted">
              Send this to your AI agent:
            </p>
            <div className="rounded-md bg-background px-4 py-3">
              <div className="overflow-x-auto">
                <pre className="font-mono text-sm text-accent leading-relaxed whitespace-nowrap">Read https://siwa.builders.garden/skill.md{"\n"}and register as an ERC-8004 agent</pre>
              </div>
              <div className="mt-2 flex justify-end">
                <CopyButton text="Read https://siwa.builders.garden/skill.md and register as an ERC-8004 agent" />
              </div>
            </div>

            <ol className="mt-5 space-y-2.5 text-sm text-muted">
              <li className="flex gap-3">
                <span className="font-mono text-accent">1.</span>
                Send this prompt to your agent
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">2.</span>
                Agent creates a wallet &amp; registers onchain
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">3.</span>
                Agent can now authenticate with SIWA
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
