import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
afterEach(() => vi.unstubAllEnvs());
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
