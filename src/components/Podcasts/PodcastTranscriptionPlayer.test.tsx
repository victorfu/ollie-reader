import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PodcastEpisode } from "../../types/podcast";
import type { TranscriptResult } from "../../types/podcastTranscript";
const mocks = vi.hoisted(() => ({ request: vi.fn(), user: { uid: "user" } }));
vi.mock("../../services/podcastTranscriptionService", () => ({ requestPodcastTranscript: mocks.request }));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
import { PodcastTranscriptionPlayer } from "./PodcastTranscriptionPlayer";
const episode: PodcastEpisode = { title: "Story", podcastTitle: "Stories", sourceUrl: "source", audioUrl: "https://audio.example/story.mp3", artworkUrl: null, durationSeconds: 100, podcastId: "1", episodeId: "2", guid: "first" };
const completed = (text = "Complete transcript.", timing = true): TranscriptResult => ({ status: "completed", transcript: {
  id: "id", podcastId: "1", episodeId: "2", guid: "first", episodeTitle: "Story", model: "gemini-3.5-flash-lite", language: "en", status: "completed", fullText: text,
  segments: [{ id: "1", text, start: timing ? 10 : null, end: timing ? 20 : null }], timingAvailable: timing, schemaVersion: 1, createdAt: "now", updatedAt: "now",
} });
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  mocks.request.mockResolvedValue({ status: "idle" });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.useRealTimers(); });
const render = (value = episode) => act(async () => { root.render(<PodcastTranscriptionPlayer episode={value} />); });
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === text)!;
it("checks cache, waits for explicit generation, and prevents double clicks", async () => {
  await render(); expect(button("產生英文字幕")).toBeDefined();
  expect(mocks.request.mock.calls.map((call) => call[2])).toEqual(["check"]);
  let finish!: (value: TranscriptResult) => void;
  mocks.request.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  act(() => { const generate = button("產生英文字幕"); generate.click(); generate.click(); });
  expect(host.textContent).toContain("正在產生英文字幕…"); expect(mocks.request).toHaveBeenCalledTimes(2);
  await act(async () => finish(completed()));
  expect(host.textContent).toContain("Complete transcript.");
  await render(); expect(host.textContent).toContain("Complete transcript."); expect(mocks.request).toHaveBeenCalledTimes(2);
});
it("displays cached text automatically and never starts generation", async () => {
  mocks.request.mockResolvedValue(completed()); await render();
  expect(host.textContent).toContain("Complete transcript."); expect(button("產生英文字幕")).toBeUndefined();
  expect(mocks.request.mock.calls[0][2]).toBe("check");
});
it("shows failure and allows explicit retry", async () => {
  await render(); mocks.request.mockRejectedValueOnce(new Error("Gemini 額度不足"));
  await act(async () => button("產生英文字幕").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Gemini 額度不足");
  mocks.request.mockResolvedValueOnce(completed()); await act(async () => button("重試產生英文字幕").click());
  expect(host.textContent).toContain("Complete transcript.");
});
it("ignores pending results after rapid episode switches and cancels on unmount", async () => {
  await render(); let finish!: (result: TranscriptResult) => void;
  mocks.request.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  act(() => button("產生英文字幕").click());
  const signal = mocks.request.mock.calls[1][3] as AbortSignal;
  await render({ ...episode, guid: "second", audioUrl: "https://audio.example/second.mp3" });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(completed("Old episode text")));
  expect(host.textContent).not.toContain("Old episode text"); expect(button("產生英文字幕")).toBeDefined();
  const newSignal = mocks.request.mock.calls[2][3] as AbortSignal;
  act(() => root.render(null)); expect(newSignal.aborted).toBe(true);
});
it("seeks and highlights with the existing audio element, retaining speed controls", async () => {
  mocks.request.mockResolvedValue(completed()); await render();
  const audio = host.querySelector("audio")!;
  expect(host.querySelectorAll("audio")).toHaveLength(1);
  const jump = host.querySelector<HTMLButtonElement>('button[aria-label^="跳至 0:10"]')!;
  expect(jump.disabled).toBe(true);
  Object.defineProperty(audio, "duration", { configurable: true, value: 100 });
  Object.defineProperty(audio, "seekable", { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
  act(() => audio.dispatchEvent(new Event("canplay")));
  act(() => jump.click()); expect(audio.currentTime).toBe(10); expect(host.querySelector('[aria-current="true"]')).not.toBeNull();
  const select = host.querySelector("select")!;
  act(() => { select.value = "1.5"; select.dispatchEvent(new Event("change", { bubbles: true })); }); expect(audio.playbackRate).toBe(1.5);
  mocks.request.mockResolvedValue({ status: "idle" }); await render({ ...episode, guid: "other", audioUrl: "https://audio.example/other.mp3" });
  expect(host.querySelector('[aria-current="true"]')).toBeNull();
});
it("plain text has no seek controls or fake active segment", async () => {
  mocks.request.mockResolvedValue(completed("No alignment.", false)); await render();
  expect(host.textContent).toContain("No alignment.");
  expect(host.querySelector('button[aria-label^="跳至"]')).toBeNull(); expect(host.querySelector('[aria-current="true"]')).toBeNull();
});
it("polls a duplicate active job using cache checks only", async () => {
  vi.useFakeTimers(); mocks.request.mockResolvedValueOnce({ status: "generating" }).mockResolvedValueOnce(completed());
  await render(); expect(host.textContent).toContain("正在產生英文字幕");
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(host.textContent).toContain("Complete transcript."); expect(mocks.request.mock.calls.map((call) => call[2])).toEqual(["check", "check"]);
});
