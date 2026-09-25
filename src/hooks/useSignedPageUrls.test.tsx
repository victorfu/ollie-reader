import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSignedUrls: vi.fn() }));

vi.mock("../utils/supabaseClient", () => ({
  STORAGE_BUCKET: "ollie-reader",
  supabase: {
    storage: { from: vi.fn(() => ({ createSignedUrls: mocks.createSignedUrls })) },
  },
}));

import {
  fetchSignedUrls,
  resetSignedUrlCache,
  useSignedPageUrls,
} from "./useSignedPageUrls";

function signed(paths: string[], tag = "v1") {
  return {
    data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}?${tag}`, error: null })),
    error: null,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.createSignedUrls.mockReset();
  resetSignedUrlCache();
});

describe("fetchSignedUrls", () => {
  it("requests each unique path once and caches the result", async () => {
    mocks.createSignedUrls.mockImplementation(async (paths: string[]) => signed(paths));

    const first = await fetchSignedUrls(["a.jpg", "b.jpg", "a.jpg"]);
    expect(first).toEqual({
      "a.jpg": "https://signed/a.jpg?v1",
      "b.jpg": "https://signed/b.jpg?v1",
    });
    expect(mocks.createSignedUrls).toHaveBeenCalledWith(["a.jpg", "b.jpg"], 3600);

    await fetchSignedUrls(["a.jpg"]);
    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("refetches when fewer than 5 minutes remain", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v1"));
    await fetchSignedUrls(["a.jpg"]);

    now.mockReturnValue((3600 - 4 * 60) * 1000);
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v2"));
    expect(await fetchSignedUrls(["a.jpg"])).toEqual({ "a.jpg": "https://signed/a.jpg?v2" });
  });

  it("forces a refresh when asked", async () => {
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v1"));
    await fetchSignedUrls(["a.jpg"]);
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v2"));
    expect(await fetchSignedUrls(["a.jpg"], true)).toEqual({ "a.jpg": "https://signed/a.jpg?v2" });
  });

  it("skips entries that failed individually and throws on a request error", async () => {
    mocks.createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: "a.jpg", signedUrl: "https://signed/a", error: null },
        { path: "b.jpg", signedUrl: "", error: "not found" },
      ],
      error: null,
    });
    expect(await fetchSignedUrls(["a.jpg", "b.jpg"])).toEqual({ "a.jpg": "https://signed/a" });

    mocks.createSignedUrls.mockResolvedValueOnce({ data: null, error: new Error("offline") });
    await expect(fetchSignedUrls(["c.jpg"])).rejects.toThrow("offline");
  });
});

describe("useSignedPageUrls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useSignedPageUrls> | null = null;

  function Probe({ paths }: { paths: string[] }) {
    const result = useSignedPageUrls(paths);
    useEffect(() => {
      latest = result;
    });
    return null;
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("exposes urls for the requested paths and can refresh one", async () => {
    mocks.createSignedUrls.mockImplementation(async (paths: string[]) => signed(paths, "v1"));
    await act(async () => {
      root.render(<Probe paths={["a.jpg", "b.jpg"]} />);
    });
    expect(latest?.urls["a.jpg"]).toBe("https://signed/a.jpg?v1");

    mocks.createSignedUrls.mockImplementation(async (paths: string[]) => signed(paths, "v2"));
    await act(async () => {
      await latest?.refresh("a.jpg");
    });
    expect(latest?.urls["a.jpg"]).toBe("https://signed/a.jpg?v2");
    expect(latest?.urls["b.jpg"]).toBe("https://signed/b.jpg?v1");
  });
});
