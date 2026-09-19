import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  serverExternalPackages: ["msedge-tts", "pdfjs-dist"],
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
