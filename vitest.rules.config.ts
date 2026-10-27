import { defineConfig } from "vitest/config";

// Firestore security rules tests. They need the Firestore emulator, so they
// stay out of `npm run test`; run them with `npm run test:rules`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/firestore-rules/**/*.rules.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
