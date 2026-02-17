"use client";

import { useState } from "react";

const SKILL_COMMAND = "Read https://siwa.id/skill.md";

export function SkillCallout() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(SKILL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-6">
      <div className="font-mono text-xs text-accent uppercase tracking-wider mb-2">
        Agent Skill
      </div>
      <p className="text-sm text-muted mb-3">
        Paste this into your agent to teach it the full SIWA authentication flow:
      </p>
      <div className="rounded-md bg-background px-4 py-3 flex items-center justify-between gap-3">
        <code className="font-mono text-sm text-accent">
          {SKILL_COMMAND}
        </code>
        <button
          onClick={copy}
          className="flex-shrink-0 text-dim hover:text-foreground transition-colors duration-200 cursor-pointer"
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
    </div>
  );
}
