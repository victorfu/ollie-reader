import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("undici", async (importOriginal) => ({ ...await importOriginal<typeof import("undici")>(), fetch: mocks.fetch }));
import { fetchOptions, isPublicAddress, parseTarget } from "./fetchUrl";
import { GET, OPTIONS } from "../app/api/fetch-url/route";

const request = (params = "") => new Request(`http://localhost/api/fetch-url?url=https%3A%2F%2Fexample.com%2Fdownload.php${params}`);
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe("fetch-url", () => {
  it("returns raw bytes with final URL, redirect count and MIME-derived extension", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/final.php" } }))
      .mockResolvedValueOnce(new Response("pdf-content", { headers: { "content-type": "application/pdf" } }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pdf-content");
    expect(response.headers.get("x-final-url")).toBe("https://example.com/final.php");
    expect(response.headers.get("x-redirect-count")).toBe("1");
    expect(response.headers.get("x-file-extension")).toBe(".pdf");
    expect(response.headers.get("content-disposition")).toContain('filename="final.pdf"');
    expect(response.headers.get("content-length")).toBe("11");
  });
  it("honors follow_redirects=false", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("redirect", { status: 302, headers: { location: "/final" } }));
    const response = await GET(request("&follow_redirects=false"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("redirect");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("enforces the redirect limit", async () => {
    mocks.fetch.mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/loop" } }));
    expect((await GET(request("&max_redirects=1"))).status).toBe(500);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([404, 429, 503])("preserves upstream error status %s", async (status) => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status }));
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toHaveProperty("detail");
  });
  it("limits the actual body even without a content-length header", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(new Uint8Array(4 * 1024 * 1024 + 1)));
    expect((await GET(request())).status).toBe(413);
  });
  it("passes a bounded signal to upstream requests and preserves cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.fetch.mockImplementation(async (_url, init) => init.signal.throwIfAborted());
    const response = await GET(new Request(request(), { signal: controller.signal }));
    expect(response.status).toBe(499);
  });
  it("validates query options before contacting upstream", () => {
    for (const params of ["timeout=0", "timeout=121", "max_redirects=31", "follow_redirects=invalid"]) {
      expect(() => fetchOptions(new URLSearchParams(`url=https://example.com&${params}`))).toThrow();
    }
    expect(() => fetchOptions(new URLSearchParams())).toThrow();
  });
  it("restricts targets to public HTTP resources", () => {
    expect(parseTarget("https://example.com/a.pdf").hostname).toBe("example.com");
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("127.0.0.1")).toBe(false);
    expect(isPublicAddress("::1")).toBe(false);
    expect(() => parseTarget("file:///sample.pdf")).toThrow();
  });
  it("supports authorized GET preflight and exposes download metadata", async () => {
    const response = await OPTIONS(new Request(request(), { method: "OPTIONS", headers: {
      origin: "http://localhost:5173", "access-control-request-method": "GET", "access-control-request-headers": "authorization",
    } }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-expose-headers")).toContain("X-Final-URL");
  });
});
