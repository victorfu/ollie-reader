import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, LOCAL_BASE_URL } from "../constants/api";
import { fetchWithComputeBase, getComputeStatusSync, setComputeMode } from "./localBackend";

const ETTS_BASE = "https://etts.example";
const init = { method: "POST", body: JSON.stringify({ text: "hi" }) };
const probe = vi.fn();
const fetcher = vi.fn();

beforeEach(() => {
  probe.mockReset();
  fetcher.mockReset().mockResolvedValue(new Response("audio"));
  vi.stubGlobal("fetch", probe);
  setComputeMode("auto");
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("per-request cloud base", () => {
  it("uses the Edge cloud base without probing in cloud mode", async () => {
    setComputeMode("cloud");
    await fetchWithComputeBase("/api/etts", init, fetcher, `${ETTS_BASE}/`);
    expect(fetcher).toHaveBeenCalledWith(`${ETTS_BASE}/api/etts`, init);
    expect(probe).not.toHaveBeenCalled();
    expect(getComputeStatusSync().resolvedBase).toBe(API_BASE_URL);
  });

  it("always uses desktop in local mode", async () => {
    setComputeMode("local");
    await fetchWithComputeBase("/api/etts", init, fetcher, ETTS_BASE);
    expect(fetcher).toHaveBeenCalledWith(`${LOCAL_BASE_URL}/api/etts`, init);
    expect(probe).not.toHaveBeenCalled();
  });

  it.each([true, false])("auto routes with local reachability=%s", async (reachable) => {
    probe.mockResolvedValue({ ok: reachable });
    await fetchWithComputeBase("/api/etts", init, fetcher, ETTS_BASE);
    expect(fetcher).toHaveBeenCalledWith(`${reachable ? LOCAL_BASE_URL : ETTS_BASE}/api/etts`, init);
  });

  it("auto uses the per-request cloud base after local connection loss", async () => {
    probe.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new TypeError("offline"));
    fetcher.mockRejectedValueOnce(new TypeError("offline"));
    await fetchWithComputeBase("/api/etts", init, fetcher, ETTS_BASE);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([`${LOCAL_BASE_URL}/api/etts`, `${ETTS_BASE}/api/etts`]);
    expect(getComputeStatusSync().resolvedBase).toBe(API_BASE_URL);
    await fetchWithComputeBase("/api/pdf/extract", init, fetcher);
    expect(fetcher).toHaveBeenLastCalledWith(`${API_BASE_URL}/api/pdf/extract`, init);
  });

  it.each(["/api/pdf/extract", "/api/fetch-url", "/api/oikid/booking-records", "/api/etts"])("preserves the default cloud base for %s", async (path) => {
    setComputeMode("cloud");
    await fetchWithComputeBase(path, init, fetcher);
    expect(fetcher).toHaveBeenCalledWith(`${API_BASE_URL}${path}`, init);
  });

  it("does not retry HTTP errors", async () => {
    probe.mockResolvedValue({ ok: true });
    fetcher.mockResolvedValue(new Response("unavailable", { status: 503 }));
    expect((await fetchWithComputeBase("/api/etts", init, fetcher, ETTS_BASE)).status).toBe(503);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledOnce();
  });

  it("does not fall back from explicit local mode", async () => {
    setComputeMode("local");
    fetcher.mockRejectedValue(new TypeError("offline"));
    await expect(fetchWithComputeBase("/api/etts", init, fetcher, ETTS_BASE)).rejects.toThrow("offline");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(probe).not.toHaveBeenCalled();
  });

  it.each(["abort-error", "type-error"])("never retries cancellation reported as %s", async (kind) => {
    const controller = new AbortController();
    probe.mockResolvedValue({ ok: true });
    fetcher.mockImplementation(() => {
      controller.abort();
      throw kind === "abort-error" ? new DOMException("cancelled", "AbortError") : new TypeError("cancelled");
    });
    await expect(fetchWithComputeBase("/api/etts", { ...init, signal: controller.signal }, fetcher, ETTS_BASE)).rejects.toThrow("cancelled");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledOnce();
  });
});
