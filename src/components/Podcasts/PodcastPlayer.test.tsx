import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PodcastPlayer } from "./PodcastPlayer";
import type { PodcastEpisode } from "../../types/podcast";
vi.mock("cactus-needle/browser", () => ({ createWhistle: async () => ({ close: async () => {}, stream: async function* () {} }) }));
const episode: PodcastEpisode = { title: "A story", podcastTitle: "Stories", sourceUrl: "https://podcasts.apple.com/us/podcast/id1?i=2", audioUrl: "https://audio.example/story.mp3", artworkUrl: null, durationSeconds: 100, podcastId: "1", episodeId: "2", guid: "guid" };
let host: HTMLDivElement, root: Root;
let play: ReturnType<typeof vi.spyOn>, pause: ReturnType<typeof vi.spyOn>, load: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) { Object.defineProperty(this, "paused", { configurable: true, value: false }); this.dispatchEvent(new Event("playing")); });
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { Object.defineProperty(this, "paused", { configurable: true, value: true }); this.dispatchEvent(new Event("pause")); });
  load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const ready = () => {
  const audio = host.querySelector("audio")!;
  Object.defineProperty(audio, "duration", { configurable: true, value: 100 });
  Object.defineProperty(audio, "seekable", { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
  act(() => audio.dispatchEvent(new Event("canplay")));
  return audio;
};
it("plays only on a click, pauses, skips within bounds and changes speed", async () => {
  act(() => root.render(<PodcastPlayer episode={episode} />));
  const audio = ready();
  expect(play).not.toHaveBeenCalled();
  await act(async () => button("播放").click());
  expect(play).toHaveBeenCalledOnce();
  act(() => button("暫停").click());
  expect(pause).toHaveBeenCalledOnce();
  act(() => button("快轉 10 秒").click()); expect(audio.currentTime).toBe(10);
  act(() => button("倒退 10 秒").click()); expect(audio.currentTime).toBe(0);
  act(() => button("倒退 10 秒").click()); expect(audio.currentTime).toBe(0);
  audio.currentTime = 98; act(() => audio.dispatchEvent(new Event("timeupdate")));
  act(() => button("快轉 10 秒").click()); expect(audio.currentTime).toBe(100);
  const select = host.querySelector("select")!;
  act(() => { select.value = "1.5"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(audio.playbackRate).toBe(1.5);
});
it("seeks with the range control", () => {
  act(() => root.render(<PodcastPlayer episode={episode} />)); const audio = ready();
  const range = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(range, "42");
    range.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(audio.currentTime).toBe(42);
});
it("reports playback rejection and media errors", async () => {
  play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
  act(() => root.render(<PodcastPlayer episode={episode} />));
  await act(async () => button("播放").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("再按一次");
  act(() => host.querySelector("audio")!.dispatchEvent(new Event("error")));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("來源可能已失效");
});
it("restores the source under StrictMode and releases media on unmount", () => {
  act(() => root.render(<StrictMode><PodcastPlayer episode={episode} /></StrictMode>));
  const audio = host.querySelector("audio")!;
  expect(audio.getAttribute("src")).toBe(episode.audioUrl);
  act(() => root.render(null));
  expect(audio.hasAttribute("src")).toBe(false);
  expect(pause).toHaveBeenCalled(); expect(load).toHaveBeenCalled();
});
it("keeps captions off by default and explains unsupported browsers without touching playback", () => {
  act(() => root.render(<PodcastPlayer episode={episode} />));
  const toggle = host.querySelector<HTMLInputElement>('input[role="switch"]')!;
  expect(toggle.checked).toBe(false);
  expect(host.querySelector('[lang="en"]')).toBeNull();
  act(() => toggle.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("不支援即時字幕");
  expect(host.querySelector("audio")!.getAttribute("src")).toBe(episode.audioUrl);
  expect(play).not.toHaveBeenCalled();
});
it("keeps the same audio and position when entering and leaving large captions", async () => {
  act(() => root.render(<PodcastPlayer episode={episode} />));
  const modal = host.querySelector("dialog")!;
  modal.showModal = () => { modal.open = true; };
  modal.close = () => { modal.open = false; modal.dispatchEvent(new Event("close")); };
  const audio = ready();
  audio.currentTime = 42;
  act(() => audio.dispatchEvent(new Event("timeupdate")));
  await act(async () => button("播放").click());
  const loads = load.mock.calls.length;
  act(() => Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "大字幕模式")!.click());
  const dialog = host.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain("不支援即時字幕");
  expect(host.querySelector("audio")).toBe(audio);
  expect(audio.currentTime).toBe(42);
  expect(load).toHaveBeenCalledTimes(loads);
  act(() => dialog.querySelector<HTMLButtonElement>('button[aria-label="快轉 10 秒"]')!.click());
  expect(audio.currentTime).toBe(52);
  act(() => dialog.querySelector<HTMLButtonElement>('button[aria-label="暫停"]')!.click());
  expect(audio.paused).toBe(true);
  act(() => button("離開大字幕模式").click());
  expect(dialog.open).toBe(false);
  expect(audio.currentTime).toBe(52);
  expect(host.querySelector("audio")).toBe(audio);
});
it("does not revive the old episode when unmounted while captions prepare a CORS source", async () => {
  class FakeAudioContext { sampleRate = 48_000; currentTime = 0; resume = vi.fn(async () => {}); suspend = vi.fn(async () => {}); close = vi.fn(async () => {}); }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", class {});
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
  try {
    act(() => root.render(<PodcastPlayer episode={episode} />));
    const audio = ready();
    await act(async () => button("播放").click());
    play.mockClear();
    const toggle = host.querySelector<HTMLInputElement>('input[role="switch"]')!;
    // Captions switch the element to a CORS load and wait for its metadata.
    await act(async () => { toggle.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(audio.crossOrigin).toBe("anonymous");
    act(() => root.render(null));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(audio.hasAttribute("src")).toBe(false);
    expect(play).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
