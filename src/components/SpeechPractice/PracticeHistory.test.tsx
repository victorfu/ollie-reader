import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PracticeHistory } from "./PracticeHistory";
import { getAudioSignedUrl } from "../../services/audioStorageService";
vi.mock("../../services/audioStorageService", () => ({ getAudioSignedUrl: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.mocked(getAudioSignedUrl).mockReset().mockResolvedValue("https://example.com/audio");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function renderHistory() {
  await act(async () => root.render(<PracticeHistory records={[{
    id: "record", userId: "user", topicId: "topic", topicTitle: "Topic",
    durationSeconds: 10, createdAt: new Date(), recordingUrl: "audio/path",
  }]} loading={false} isLoadingMore={false} hasMore={false} onLoadMore={vi.fn()} onDelete={vi.fn()} />));
}
async function mediaError(code = 2) {
  const audio = container.querySelector("audio")!;
  Object.defineProperty(audio, "error", { value: { code }, configurable: true });
  await act(async () => audio.dispatchEvent(new Event("error")));
}
it("allows one automatic refresh, then waits for manual retry even when signing succeeds", async () => {
  await renderHistory();
  await mediaError();
  expect(getAudioSignedUrl).toHaveBeenCalledTimes(2);
  await mediaError();
  expect(getAudioSignedUrl).toHaveBeenCalledTimes(2);
  expect(container.querySelector("audio")).toBeNull();
  expect(container.textContent).toContain("載入音訊失敗");
  await renderHistory();
  expect(getAudioSignedUrl).toHaveBeenCalledTimes(2);
  const retry = [...container.querySelectorAll("button")].find(b => b.textContent === "重試")!;
  await act(async () => retry.click());
  expect(getAudioSignedUrl).toHaveBeenCalledTimes(3);
  await mediaError();
  await mediaError();
  expect(getAudioSignedUrl).toHaveBeenCalledTimes(4);
  expect(container.querySelector("audio")).toBeNull();
});
it("does not re-sign for a decoding failure", async () => {
  await renderHistory();
  await mediaError(3);
  expect(getAudioSignedUrl).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("載入音訊失敗");
});

it("keeps failed media unmounted until manual URL signing completes", async () => {
  await renderHistory();
  await mediaError(3);
  let resolveUrl!: (url: string) => void;
  vi.mocked(getAudioSignedUrl).mockReturnValueOnce(new Promise(resolve => { resolveUrl = resolve; }));
  const retry = [...container.querySelectorAll("button")].find(b => b.textContent === "重試")!;
  act(() => retry.click());
  expect(container.querySelector("audio")).toBeNull();
  await act(async () => resolveUrl("https://example.com/audio"));
  expect(container.querySelector("audio")).not.toBeNull();
  await mediaError(3);
  expect(container.textContent).toContain("載入音訊失敗");
  expect(getAudioSignedUrl).toHaveBeenCalledTimes(2);
});
