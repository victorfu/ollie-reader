import { afterEach, expect, it, vi } from "vitest";
import { GET, OPTIONS } from "./route";
afterEach(() => vi.unstubAllEnvs());
it("allows the cache-control header sent by the Web warm-server hook", async () => {
  const response = await OPTIONS(new Request("http://localhost/api/version", {
    method: "OPTIONS", headers: {
      origin: "https://ollie-reader.web.app",
      "access-control-request-method": "GET",
      "access-control-request-headers": "cache-control",
    },
  }));
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-headers")).toContain("Cache-Control");
});
it("returns a configurable version and allows the frontend origin", async () => {
  vi.stubEnv("API_VERSION", "test-version");
  const response = await GET(new Request("http://localhost/api/version", { headers: { origin: "http://localhost:5173" } }));
  expect(await response.json()).toEqual({ version: "test-version" });
  expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rejects an unconfigured browser origin", async () => {
  expect((await GET(new Request("http://localhost/api/version", { headers: { origin: "https://example.com" } }))).status).toBe(403);
});
