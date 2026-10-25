import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  serverExternalPackages: ["ws"],
  // jwks-rsa uses require('jose'), but jose 6 is ESM-only. Bundle this chain
  // instead of relying on require(esm), which deployment runtimes may disable.
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"],
  poweredByHeader: false,
  // Stop `next dev` from writing AGENTS.md/CLAUDE.md into server/.
  agentRules: false,
};

export default nextConfig;
