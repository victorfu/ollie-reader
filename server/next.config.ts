import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  serverExternalPackages: ["msedge-tts", "pdfjs-dist"],
  // jwks-rsa uses require('jose'), but jose 6 is ESM-only. Bundle this chain
  // instead of relying on require(esm), which deployment runtimes may disable.
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"],
  outputFileTracingIncludes: {
    "/api/pdf/extract": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
      "./node_modules/pdfjs-dist/wasm/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
