import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioUpload } from "../../types/audioUpload";
import { AudioUploadList } from "./AudioUploadList";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const upload = (id: string): AudioUpload => ({
  id,
  userId: "user-1",
  title: `Audio ${id}`,
  audioUrl: `audio-uploads/user-1/${id}.mp3`,
  durationSeconds: 10,
  fileSize: 100,
  mimeType: "audio/mpeg",
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

describe("AudioUploadList playback ownership", () => {
  let container: HTMLDivElement;
  let root: Root;
  let pauseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("pauses the current audio before awaiting a first-time URL load", async () => {
    let resolveUrl!: (value: string | null) => void;
    const pendingUrl = new Promise<string | null>((resolve) => {
      resolveUrl = resolve;
    });
    const onLoadUrl = vi.fn(() => pendingUrl);

    act(() => {
      root.render(
        <AudioUploadList
          uploads={[upload("a"), upload("b")]}
          loading={false}
          audioUrls={new Map([["a", "https://signed.example/a"]])}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onRefreshUrl={vi.fn()}
          onLoadUrl={onLoadUrl}
        />,
      );
    });

    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .filter((button) => button.title === "播放");
    await act(async () => buttons[0]?.click());
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    act(() => buttons[1]?.click());
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(onLoadUrl).toHaveBeenCalledWith(
      "b",
      "audio-uploads/user-1/b.mp3",
    );

    resolveUrl(null);
    await act(async () => pendingUrl);
  });
});
