"use client";

import { useEffect, useState } from "react";

type NavItem = { title: string; id: string };
type NavGroup = { label: string; items: NavItem[] };
type SectionChild = NavItem | NavGroup;

function isGroup(child: SectionChild): child is NavGroup {
  return "items" in child;
}

const sections: {
  title: string;
  id: string;
  children: SectionChild[];
}[] = [
  {
    title: "Overview",
    id: "overview",
    children: [
      { title: "Base URL", id: "base-url" },
      { title: "Networks", id: "networks" },
      { title: "Address Formats", id: "address-formats" },
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
    title: "x402 Paid",
    id: "x402",
    children: [
      {
        label: "Overview",
        items: [
          { title: "Payment Flow", id: "x402-payment-flow" },
          { title: "x402 Headers", id: "x402-headers" },
          { title: "Payment Config", id: "x402-payment-config" },
        ],
      },
      {
        label: "Endpoints",
        items: [
          { title: "GET /api/x402/weather", id: "get-x402-weather" },
          { title: "GET+POST /api/x402/analytics", id: "get-x402-analytics" },
        ],
      },
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

function getAllIds(): string[] {
  return sections.flatMap((s) => [
    s.id,
    ...s.children.flatMap((c) =>
      isGroup(c) ? c.items.map((i) => i.id) : [c.id]
    ),
  ]);
}

export function EndpointsSidebar() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const allIds = getAllIds();

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

  const itemLink = (item: NavItem) => (
    <a
      key={item.id}
      href={`#${item.id}`}
      className={`block text-xs transition-colors duration-200 cursor-pointer ${
        activeId === item.id
          ? "text-accent"
          : "text-dim hover:text-muted"
      }`}
    >
      {item.title}
    </a>
  );

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
              <div className="mt-1.5 ml-2 border-l border-border pl-3">
                {section.children.map((child) =>
                  isGroup(child) ? (
                    <div key={child.label} className="mt-2 first:mt-0">
                      <span className="block text-[10px] font-mono font-medium text-dim/60 uppercase tracking-wider mb-1">
                        {child.label}
                      </span>
                      <div className="space-y-1">
                        {child.items.map(itemLink)}
                      </div>
                    </div>
                  ) : (
                    <div key={child.id} className="mt-1">
                      {itemLink(child)}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
