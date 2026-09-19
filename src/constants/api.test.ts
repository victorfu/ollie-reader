import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([true, false])("uses the own server when no API override is set (DEV=%s)", async (dev) => {
  vi.resetModules();
  vi.stubEnv("DEV", dev);
  vi.stubEnv("VITE_API_BASE_URL", "   ");
  vi.stubEnv("VITE_ETTS_API_BASE_URL", "");
  const { API_BASE_URL, ETTS_API_BASE_URL, VERSION_API_URL } = await import("./api");
  const expected = dev ? "http://localhost:3000" : "https://server-one-xi-16.vercel.app";
  expect(API_BASE_URL).toBe(expected);
  expect(ETTS_API_BASE_URL).toBe(expected);
  expect(VERSION_API_URL).toBe(`${expected}/api/version`);
});

it.each([undefined, "", "   "])("defaults the ETTS base to the existing API when configured as %s", async (value) => {
  vi.resetModules();
  vi.stubEnv("VITE_ETTS_API_BASE_URL", value);
  vi.stubEnv("VITE_API_BASE_URL", "https://existing.example");
  const { ETTS_API_BASE_URL } = await import("./api");
  expect(ETTS_API_BASE_URL).toBe("https://existing.example");
});

it("normalizes the separate Edge base without changing the existing API", async () => {
  vi.resetModules();
  vi.stubEnv("VITE_ETTS_API_BASE_URL", " https://etts.example/ ");
  vi.stubEnv("VITE_API_BASE_URL", "https://existing.example");
  const { API_BASE_URL, ETTS_API_BASE_URL } = await import("./api");
  expect(API_BASE_URL).toBe("https://existing.example");
  expect(ETTS_API_BASE_URL).toBe("https://etts.example");
});
