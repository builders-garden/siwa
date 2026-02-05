import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ethers"],
  transpilePackages: ["@buildersgarden/siwa"],
};

export default nextConfig;
