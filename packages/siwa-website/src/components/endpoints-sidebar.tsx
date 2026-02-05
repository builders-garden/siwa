"use client";

import { useEffect, useState } from "react";

const sections = [
  {
    title: "Overview",
    id: "overview",
    children: [
      { title: "Base URL", id: "base-url" },
      { title: "Auth Flow", id: "auth-flow" },
    ],
  },
  {
    title: "Authentication",
    id: "authentication",
    children: [
      { title: "POST /api/siwa/nonce", id: "post-siwa-nonce" },
      { title: "POST /api/siwa/verify", id: "post-siwa-verify" },
    ],
  },
  {
    title: "Protected",
    id: "protected",
    children: [
      { title: "GET /api/protected", id: "get-api-protected" },
      { title: "POST /api/agent-action", id: "post-api-agent-action" },
    ],
  },
  {
    title: "Try It",
    id: "try-it",
    children: [
      { title: "Full Flow (curl)", id: "try-curl" },
    ],
  },
];

export function EndpointsSidebar() {
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
