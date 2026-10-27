import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), get: vi.fn() }));
vi.mock("../../services/podcastService", () => ({ resolvePodcast: mocks.resolve }));
vi.mock("../../services/podcastLibraryService", () => ({ getSavedPodcast: mocks.get }));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: "user-1" } }) }));
vi.mock("./PodcastPlayer", () => ({ PodcastPlayer: () => <div>Audio controls</div> }));
import PodcastDetail from "./PodcastDetail";

let host: HTMLDivElement, root: Root;
async function render() {
  await act(async () => root.render(
    <MemoryRouter initialEntries={["/podcasts/p1"]}>
      <Routes><Route path="/podcasts/:podcastId" element={<PodcastDetail />} /></Routes>
    </MemoryRouter>,
  ));
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mocks.get.mockResolvedValue({ id: "p1", kind: "episode", url: "https://podcasts.apple.com/a", title: "A story", podcastTitle: "Stories", artworkUrl: null, addedAt: 1 });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.resetAllMocks(); });

it("resolves the saved link again and mounts the player", async () => {
  mocks.resolve.mockResolvedValue({ title: "<b>A story</b>", podcastTitle: "Stories", durationSeconds: 382, sourceUrl: "source", artworkUrl: null });
  await render();
  expect(mocks.get).toHaveBeenCalledWith("user-1", "p1");
  expect(mocks.resolve.mock.calls[0][0]).toBe("https://podcasts.apple.com/a");
  expect(host.querySelector("article h2")?.textContent).toBe("<b>A story</b>");
  expect(host.querySelector("article h2 b")).toBeNull();
  expect(host.textContent).toContain("6:22");
  expect(host.textContent).toContain("Audio controls");
  expect(host.querySelector('a[href="/podcasts"]')).not.toBeNull();
});

it("waits for an explicit episode choice when opening a show", async () => {
  mocks.resolve.mockResolvedValue({ kind: "show", podcastTitle: "Stories", sourceUrl: "show", unavailableCount: 0,
    episodes: [
      { title: "First story", podcastTitle: "Stories", guid: "one", durationSeconds: 60, artworkUrl: null },
      { title: "Second story", podcastTitle: "Stories", guid: "two", durationSeconds: 120, artworkUrl: null },
    ],
  });
  await render();
  expect(host.textContent).toContain("2 集可播放");
  expect(host.textContent).not.toContain("Audio controls");
  const select = host.querySelector("select")!;
  act(() => { select.value = "two"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelector("article h2")?.textContent).toBe("Second story");
  expect(host.textContent).toContain("Audio controls");
});

it("shows resolver errors and retries", async () => {
  mocks.resolve.mockRejectedValueOnce(new Error("RSS 中找不到指定單集"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("RSS 中找不到");
  mocks.resolve.mockResolvedValue({ title: "A story", podcastTitle: "Stories", durationSeconds: null, sourceUrl: "source", artworkUrl: null });
  await act(async () => { host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(); });
  expect(host.textContent).toContain("Audio controls");
});

it("says so when the saved podcast no longer exists", async () => {
  mocks.get.mockResolvedValue(null);
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("找不到這個 Podcast");
  expect(mocks.resolve).not.toHaveBeenCalled();
});

it("cancels pending resolution on unmount", async () => {
  mocks.resolve.mockImplementation(() => new Promise(() => {}));
  await render();
  const signal = mocks.resolve.mock.calls[0][1] as AbortSignal;
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  act(() => root.render(null));
  expect(signal.aborted).toBe(true);
});
