import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const resolver = vi.hoisted(() => vi.fn());
vi.mock("../../services/podcastService", () => ({ resolvePodcast: resolver }));
vi.mock("./PodcastTranscriptionPlayer", () => ({ PodcastTranscriptionPlayer: () => <div>Audio controls</div> }));
import Podcasts from "./Podcasts";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  act(() => root.render(<Podcasts />));
  const input = host.querySelector("input")!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "https://podcasts.apple.com/us/podcast/id1?i=2"); input.dispatchEvent(new Event("input", { bubbles: true })); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.resetAllMocks(); });
const submit = () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
it("renders the resolved metadata as text and mounts the player", async () => {
  resolver.mockResolvedValue({ title: "<b>A story</b>", podcastTitle: "Stories", durationSeconds: 382, sourceUrl: "source", artworkUrl: null });
  await act(async () => { submit(); });
  expect(host.querySelector("h2")?.textContent).toBe("<b>A story</b>");
  expect(host.querySelector("h2 b")).toBeNull();
  expect(host.textContent).toContain("6:22");
  expect(host.textContent).toContain("Audio controls");
});
it("shows resolver errors and lets the user retry", async () => {
  resolver.mockRejectedValue(new Error("RSS 中找不到指定單集"));
  await act(async () => { submit(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("RSS 中找不到");
  expect(host.querySelector("button")?.disabled).toBe(false);
});
it("cancels pending resolution on unmount", () => {
  resolver.mockImplementation(() => new Promise(() => {}));
  act(() => { submit(); });
  const signal = resolver.mock.calls[0][1] as AbortSignal;
  expect(signal.aborted).toBe(false);
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  act(() => root.render(null));
  expect(signal.aborted).toBe(true);
});
it("waits for an explicit episode choice when loading a show", async () => {
  resolver.mockResolvedValue({ kind: "show", podcastTitle: "Stories", sourceUrl: "show", unavailableCount: 0,
    episodes: [
      { title: "First story", podcastTitle: "Stories", guid: "one", durationSeconds: 60, artworkUrl: null },
      { title: "Second story", podcastTitle: "Stories", guid: "two", durationSeconds: 120, artworkUrl: null },
    ],
  });
  await act(async () => { submit(); });
  expect(host.textContent).toContain("2 集可播放");
  expect(host.textContent).not.toContain("Audio controls");
  const select = host.querySelector("select")!;
  act(() => { select.value = "two"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelector("article h2")?.textContent).toBe("Second story");
  expect(host.textContent).toContain("Audio controls");
});
