import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  serverExternalPackages: ["ws", "ffmpeg-static"],
  // jwks-rsa uses require('jose'), but jose 6 is ESM-only. Bundle this chain
  // instead of relying on require(esm), which deployment runtimes may disable.
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"],
  outputFileTracingIncludes: {
    "/api/podcasts/audio": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/ffmpeg.exe"],
  },
  poweredByHeader: false,
  // Stop `next dev` from writing AGENTS.md/CLAUDE.md into server/.
  agentRules: false,
};

export default nextConfig;
