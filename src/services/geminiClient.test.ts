import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  run: vi.fn(),
  gateRun: vi.fn(),
  blockProviderUntil: vi.fn(),
  waitForSharedAvailability: vi.fn(),
  observeProviderError: vi.fn(),
}));

vi.mock("../utils/firebaseUtil", () => ({
  GEMINI_MODEL_NAME: "gemini-test",
  firebaseApp: { options: { projectId: "project-test" } },
  geminiModel: { generateContent: mocks.generateContent },
}));
vi.mock("./geminiRequestQueue", () => ({
  geminiRequestQueue: {
    run: mocks.run,
    waitForSharedAvailability: mocks.waitForSharedAvailability,
    observeProviderError: mocks.observeProviderError,
  },
}));
vi.mock("./geminiCrossTabGate", () => ({
  geminiCrossTabGate: {
    run: mocks.gateRun,
    blockProviderUntil: mocks.blockProviderUntil,
  },
}));
vi.mock("./geminiRuntimeConfig", () => ({
  getGeminiMinimumStartIntervalMs: () => 15_000,
}));

import { generateGeminiContent } from "./geminiClient";

describe("generateGeminiContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.observeProviderError.mockReturnValue(null);
    mocks.run.mockImplementation(async (operation) =>
      operation(new AbortController().signal),
    );
    mocks.gateRun.mockImplementation(async (operation, options) => {
      const signal = new AbortController().signal;
      await options.beforeStart?.(signal);
      return operation(signal);
    });
    mocks.waitForSharedAvailability.mockResolvedValue(undefined);
    mocks.generateContent.mockResolvedValue({ response: {} });
  });

  it("routes provider work through the singleton queue and passes its signal", async () => {
    const externalController = new AbortController();

    await generateGeminiContent("hello", {
      action: "translation",
      signal: externalController.signal,
    });

    expect(mocks.run).toHaveBeenCalledWith(expect.any(Function), {
      action: "translation",
      quotaKey: "project-test:gemini-test",
      signal: externalController.signal,
    });
    expect(mocks.generateContent).toHaveBeenCalledWith("hello", {
      signal: expect.any(AbortSignal),
    });
    const gateOptions = mocks.gateRun.mock.calls[0]?.[1];
    expect(gateOptions).toMatchObject({
      signal: expect.any(AbortSignal),
      minIntervalMs: expect.any(Function),
      beforeStart: expect.any(Function),
    });
    expect(gateOptions.minIntervalMs()).toBe(15_000);
    expect(mocks.waitForSharedAvailability).toHaveBeenCalledWith(
      "project-test:gemini-test",
      expect.any(AbortSignal),
    );
  });

  it("records a provider error before releasing the cross-tab gate", async () => {
    const providerError = { customErrorData: { status: 429 } };
    mocks.generateContent.mockRejectedValue(providerError);

    await expect(
      generateGeminiContent("hello", { action: "translation" }),
    ).rejects.toBe(providerError);

    expect(mocks.observeProviderError).toHaveBeenCalledWith(
      providerError,
      "project-test:gemini-test",
    );
  });

  it("installs a quota barrier when cross-tab state cannot be persisted", async () => {
    const providerError = { customErrorData: { status: 429 } };
    mocks.generateContent.mockRejectedValue(providerError);
    mocks.observeProviderError.mockReturnValue({
      decision: {
        kind: "daily_exhausted",
        retryable: false,
        quotaIds: ["RPD"],
      },
      crossTabStatePersisted: false,
      blockUntil: 123_456,
    });

    await expect(
      generateGeminiContent("hello", { action: "translation" }),
    ).rejects.toBe(providerError);

    expect(mocks.blockProviderUntil).toHaveBeenCalledWith(123_456);
  });
});
