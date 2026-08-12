import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("geminiRuntimeConfig", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the safe 4 RPM fallback when the environment variable is absent", async () => {
    vi.stubEnv("VITE_GEMINI_CLIENT_RPM_BUDGET", "");
    const config = await import("./geminiRuntimeConfig");

    expect(config.getGeminiClientRpmBudget()).toBe(4);
    expect(config.getGeminiMinimumStartIntervalMs()).toBe(15_000);
  });

  it("reads the build-time RPM budget from the Vite environment", async () => {
    vi.stubEnv("VITE_GEMINI_CLIENT_RPM_BUDGET", "10");
    const config = await import("./geminiRuntimeConfig");

    expect(config.getGeminiClientRpmBudget()).toBe(10);
    expect(config.getGeminiMinimumStartIntervalMs()).toBe(6_000);
  });

  it.each([
    [Number.NaN, 4],
    [Number.POSITIVE_INFINITY, 4],
    ["invalid", 4],
    ["", 4],
    [0, 4],
    [-3, 4],
    [0.5, 1],
    ["8.9", 8],
    [10_000, 120],
  ])("normalizes %j to a bounded RPM budget", async (value, expected) => {
    const { normalizeGeminiClientRpmBudget } = await import(
      "./geminiRuntimeConfig"
    );

    expect(normalizeGeminiClientRpmBudget(value)).toBe(expected);
  });
});
