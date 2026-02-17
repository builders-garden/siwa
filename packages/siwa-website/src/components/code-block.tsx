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

interface CollapsibleCodeBlockProps extends CodeBlockProps {
  title: string;
  defaultOpen?: boolean;
}

export function CollapsibleCodeBlock({
  children,
  language = "typescript",
  title,
  defaultOpen = false,
}: CollapsibleCodeBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const code = children.trim();

  // Get first 3 lines for preview
  const previewLines = code.split('\n').slice(0, 3).join('\n');
  const hasMore = code.split('\n').length > 3;

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-background/50 transition-colors duration-200 cursor-pointer"
      >
        <span className="font-mono text-sm font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dim">{isOpen ? "collapse" : "expand"}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-dim transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {!isOpen && (
        <div className="border-t border-border px-4 py-3 bg-background/30">
          <pre className="font-mono text-xs text-dim leading-relaxed overflow-hidden">
            <code>{previewLines}{hasMore && '\n...'}</code>
          </pre>
        </div>
      )}
      {isOpen && (
        <div className="border-t border-border">
          <CodeBlock language={language}>{children}</CodeBlock>
        </div>
      )}
    </div>
  );
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
