"use client";

import { useState } from "react";
import Link from "next/link";

function NavLink({
  href,
  children,
  external,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  onClick?: () => void;
}) {
  const className =
    "text-sm text-muted hover:text-foreground transition-colors duration-200 cursor-pointer";
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-mono text-sm font-semibold tracking-tight text-foreground hover:text-accent transition-colors duration-200"
        >
          SIWA
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <NavLink href="/docs">Docs</NavLink>
          <NavLink href="/docs/endpoints">Endpoints</NavLink>
          <NavLink href="https://github.com/builders-garden/siwa" external>
            GitHub
          </NavLink>
          <NavLink href="https://8004.org" external>
            ERC-8004
          </NavLink>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 cursor-pointer"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-px w-5 bg-muted transition-all duration-200 ${
              open ? "translate-y-[3.5px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-px w-5 bg-muted transition-all duration-200 ${
              open ? "-translate-y-[3.5px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-sm px-6 py-4 flex flex-col gap-4">
          <NavLink href="/docs" onClick={() => setOpen(false)}>
            Docs
          </NavLink>
          <NavLink href="/docs/endpoints" onClick={() => setOpen(false)}>
            Endpoints
          </NavLink>
          <NavLink
            href="https://github.com/builders-garden/siwa"
            external
            onClick={() => setOpen(false)}
          >
            GitHub
          </NavLink>
          <NavLink
            href="https://8004.org"
            external
            onClick={() => setOpen(false)}
          >
            ERC-8004
          </NavLink>
        </div>
      )}
    </nav>
  );
}
