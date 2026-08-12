import { beforeEach, describe, expect, it, vi } from "vitest";

const remoteConfigMocks = vi.hoisted(() => ({
  activate: vi.fn(),
  fetchAndActivate: vi.fn(),
  getNumber: vi.fn(),
  getRemoteConfig: vi.fn(),
  isSupported: vi.fn(),
  onConfigUpdate: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("firebase/remote-config", () => remoteConfigMocks);
vi.mock("../utils/firebaseUtil", () => ({
  firebaseApp: { name: "test-app" },
}));
vi.mock("../utils/logger", () => ({
  logger: loggerMocks,
  default: loggerMocks,
}));

const createRemoteConfig = () => ({
  defaultConfig: {} as Record<string, string | number | boolean>,
});

describe("geminiRuntimeConfig", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    remoteConfigMocks.activate.mockResolvedValue(true);
    remoteConfigMocks.fetchAndActivate.mockResolvedValue(true);
    remoteConfigMocks.isSupported.mockResolvedValue(true);
    remoteConfigMocks.onConfigUpdate.mockReturnValue(vi.fn());
  });

  it("uses the safe 4 RPM fallback before remote initialization", async () => {
    const config = await import("./geminiRuntimeConfig");

    expect(config.getGeminiClientRpmBudget()).toBe(4);
    expect(config.getGeminiMinimumStartIntervalMs()).toBe(15_000);
  });

  it.each([
    [Number.NaN, 4],
    [Number.POSITIVE_INFINITY, 4],
    ["10", 4],
    [0, 4],
    [-3, 4],
    [0.5, 1],
    [8.9, 8],
    [10_000, 120],
  ])("normalizes %j to a bounded RPM budget", async (value, expected) => {
    const { normalizeGeminiClientRpmBudget } = await import(
      "./geminiRuntimeConfig"
    );

    expect(normalizeGeminiClientRpmBudget(value)).toBe(expected);
  });

  it("fetches in the background and applies the activated remote budget", async () => {
    const remoteConfig = createRemoteConfig();
    remoteConfigMocks.getRemoteConfig.mockReturnValue(remoteConfig);
    remoteConfigMocks.getNumber
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(10);
    let resolveFetch: ((value: boolean) => void) | undefined;
    remoteConfigMocks.fetchAndActivate.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const config = await import("./geminiRuntimeConfig");

    expect(config.initializeGeminiRuntimeConfig()).toBeUndefined();
    await vi.waitFor(() => {
      expect(remoteConfigMocks.fetchAndActivate).toHaveBeenCalledWith(
        remoteConfig,
      );
    });
    expect(config.getGeminiClientRpmBudget()).toBe(4);

    resolveFetch?.(true);
    await vi.waitFor(() => {
      expect(config.getGeminiClientRpmBudget()).toBe(10);
    });
    expect(config.getGeminiMinimumStartIntervalMs()).toBe(6_000);
    expect(remoteConfig.defaultConfig).toEqual({
      gemini_client_rpm_budget: 4,
    });
  });

  it("activates real-time changes before applying them", async () => {
    const remoteConfig = createRemoteConfig();
    remoteConfigMocks.getRemoteConfig.mockReturnValue(remoteConfig);
    remoteConfigMocks.getNumber
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12);
    let observer:
      | {
          next: (update: { getUpdatedKeys: () => Set<string> }) => void;
        }
      | undefined;
    remoteConfigMocks.onConfigUpdate.mockImplementation(
      (_remoteConfig, nextObserver) => {
        observer = nextObserver;
        return vi.fn();
      },
    );
    const config = await import("./geminiRuntimeConfig");
    config.initializeGeminiRuntimeConfig();
    await vi.waitFor(() => {
      expect(remoteConfigMocks.fetchAndActivate).toHaveBeenCalled();
    });

    observer?.next({
      getUpdatedKeys: () => new Set(["gemini_client_rpm_budget"]),
    });

    await vi.waitFor(() => {
      expect(remoteConfigMocks.activate).toHaveBeenCalledWith(remoteConfig);
      expect(config.getGeminiClientRpmBudget()).toBe(12);
    });
  });

  it("keeps the safe fallback when Remote Config is unsupported", async () => {
    remoteConfigMocks.isSupported.mockResolvedValue(false);
    const config = await import("./geminiRuntimeConfig");

    config.initializeGeminiRuntimeConfig();

    await vi.waitFor(() => {
      expect(loggerMocks.warn).toHaveBeenCalled();
    });
    expect(remoteConfigMocks.getRemoteConfig).not.toHaveBeenCalled();
    expect(config.getGeminiClientRpmBudget()).toBe(4);
  });

  it("starts Remote Config initialization only once", async () => {
    const remoteConfig = createRemoteConfig();
    remoteConfigMocks.getRemoteConfig.mockReturnValue(remoteConfig);
    remoteConfigMocks.getNumber.mockReturnValue(4);
    const config = await import("./geminiRuntimeConfig");

    config.initializeGeminiRuntimeConfig();
    config.initializeGeminiRuntimeConfig();

    await vi.waitFor(() => {
      expect(remoteConfigMocks.isSupported).toHaveBeenCalledTimes(1);
    });
  });
});
