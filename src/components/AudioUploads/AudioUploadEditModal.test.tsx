import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioUpload } from "../../types/audioUpload";
import { AudioUploadEditModal } from "./AudioUploadEditModal";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const upload: AudioUpload = {
  id: "audio-1",
  userId: "user-1",
  title: "Lesson",
  description: "Old description",
  audioUrl: "audio.mp3",
  durationSeconds: 10,
  fileSize: 100,
  mimeType: "audio/mpeg",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("AudioUploadEditModal", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("submits an explicit empty description so the stored value is cleared", () => {
    const onSave = vi.fn();
    act(() => {
      root.render(
        <AudioUploadEditModal
          isOpen={false}
          upload={null}
          isSaving={false}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      );
    });
    act(() => {
      root.render(
        <AudioUploadEditModal
          isOpen
          upload={upload}
          isSaving={false}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      );
    });

    const textarea = container.querySelector("textarea")!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    act(() => {
      valueSetter.call(textarea, "");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => container.querySelector("form")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ));

    expect(onSave).toHaveBeenCalledWith("audio-1", {
      title: "Lesson",
      description: "",
    });
  });
});
