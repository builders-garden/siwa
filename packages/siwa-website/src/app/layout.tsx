import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/navbar";
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
        <Navbar />

        <main className="pt-14">{children}</main>

        <footer className="border-t border-border py-8 text-sm text-dim">
          <div className="mx-auto max-w-5xl px-6 flex flex-col items-center gap-3">
            <div>
              Built by{" "}
              <a
                href="https://builders.garden"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-accent transition-colors duration-200 cursor-pointer"
              >
                Builders Garden
              </a>
            </div>
            <div>
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
              <a
                href="https://github.com/builders-garden/siwa/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-muted transition-colors duration-200 cursor-pointer"
              >
                MIT License
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
