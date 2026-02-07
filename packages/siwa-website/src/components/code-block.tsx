"use client";

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
  // Trim trailing whitespace/newlines
  const code = children.trim();

  return (
    <Highlight theme={themes.nightOwl} code={code} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className="overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-relaxed"
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
  );
}
