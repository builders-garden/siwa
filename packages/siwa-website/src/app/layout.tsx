import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIWA — Sign In With Agent",
  description:
    "Trustless identity and authentication for AI agents. An open standard built on ERC-8004.",
  openGraph: {
    title: "SIWA — Sign In With Agent",
    description:
      "Trustless identity and authentication for AI agents. An open standard built on ERC-8004.",
    type: "website",
  },
};

function NavLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    "text-sm text-muted hover:text-foreground transition-colors duration-200 cursor-pointer";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
            <Link
              href="/"
              className="font-mono text-sm font-semibold tracking-tight text-foreground hover:text-accent transition-colors duration-200"
            >
              SIWA
            </Link>
            <div className="flex items-center gap-6">
              <NavLink href="/docs">Docs</NavLink>
              <NavLink href="/docs/endpoints">Endpoints</NavLink>
              <NavLink href="/docs/deploy">Deploy</NavLink>
              <NavLink
                href="https://github.com/builders-garden/siwa"
                external
              >
                GitHub
              </NavLink>
              <NavLink
                href="https://eips.ethereum.org/EIPS/eip-8004"
                external
              >
                ERC-8004
              </NavLink>
            </div>
          </div>
        </nav>

        <main className="pt-14">{children}</main>

        <footer className="border-t border-border py-8 text-center text-sm text-dim">
          <div className="mx-auto max-w-5xl px-6">
            SIWA{" "}
            <span className="text-border mx-2">/</span>{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-8004"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted transition-colors duration-200 cursor-pointer"
            >
              ERC-8004
            </a>{" "}
            <span className="text-border mx-2">/</span>{" "}
            MIT License{" "}
            <span className="text-border mx-2">/</span>{" "}
            <a
              href="https://builders.garden"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted transition-colors duration-200 cursor-pointer"
            >
              Builders Garden
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
