"use client";

import { useState } from "react";

const COMMAND = "npm install @buildersgarden/siwa";

export function CopyInstallCommand() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-8 rounded-lg border border-border bg-surface overflow-hidden inline-flex items-center">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="font-mono text-sm text-muted select-none">$</span>
        <code className="font-mono text-sm text-foreground">{COMMAND}</code>
      </div>
      <button
        onClick={copy}
        className="px-3 py-3 border-l border-border text-dim hover:text-foreground transition-colors duration-200 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
