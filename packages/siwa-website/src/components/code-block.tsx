"use client";

import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

type Language =
  | "typescript"
  | "javascript"
  | "bash"
  | "json"
  | "markdown"
  | "python"
  | "tsx"
  | "jsx"
  | "text";

interface CodeBlockProps {
  children: string;
  language?: Language;
}

export function CodeBlock({ children, language = "typescript" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  // Trim trailing whitespace/newlines
  const code = children.trim();

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <Highlight theme={themes.nightOwl} code={code} language={language}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="overflow-x-auto rounded-lg border border-border bg-surface p-4 pr-12 font-mono text-sm leading-relaxed"
            style={{ ...style, backgroundColor: "transparent" }}
          >
            <code>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded text-dim hover:text-foreground transition-all duration-200 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
