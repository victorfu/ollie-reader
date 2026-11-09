import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const speech = vi.hoisted(() => ({
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  isSpeaking: false,
  isLoadingAudio: false,
  speakingText: null as string | null,
}));

vi.mock("../../hooks/useSpeechState", () => ({
  useSpeechState: () => speech,
}));

import { SpeakButton } from "./SpeakButton";

let root: Root | null;
let host: HTMLDivElement | null;

async function render(text = "river", onParentClick?: () => void, replayOnClick = false) {
  root = createRoot(host as HTMLDivElement);
  await act(async () => {
    root?.render(
      <div onClick={onParentClick}>
        <SpeakButton text={text} label="播放發音" replayOnClick={replayOnClick} />
      </div>,
    );
  });
  return (host as HTMLDivElement).querySelector("button") as HTMLButtonElement;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  root = null;
  host = document.createElement("div");
  document.body.appendChild(host);
  speech.speak.mockReset();
  speech.stopSpeaking.mockReset();
  speech.isSpeaking = false;
  speech.isLoadingAudio = false;
  speech.speakingText = null;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
});

describe("SpeakButton", () => {
  it("replays an active pronunciation instead of stopping it", async () => {
    speech.isSpeaking = true;
    speech.speakingText = "river";
    const button = await render("river", undefined, true);
    expect(button.getAttribute("aria-label")).toBe("播放發音");
    await act(async () => button.click());
    expect(speech.speak).toHaveBeenCalledWith("river");
    expect(speech.stopSpeaking).not.toHaveBeenCalled();
  });

  it("does not cancel a loading pronunciation on repeated taps", async () => {
    speech.isLoadingAudio = true;
    speech.speakingText = "river";
    const button = await render("river", undefined, true);
    await act(async () => { button.click(); button.click(); });
    expect(speech.speak).not.toHaveBeenCalled();
    expect(speech.stopSpeaking).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("speaks its text when idle and does not bubble the click", async () => {
    const onParentClick = vi.fn();
    const button = await render("river", onParentClick);

    expect(button.getAttribute("aria-pressed")).toBe("false");
    await act(async () => button.click());

    expect(speech.speak).toHaveBeenCalledWith("river");
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("shows a spinner while its own audio is loading", async () => {
    speech.isLoadingAudio = true;
    speech.speakingText = "river";
    const button = await render();

    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector(".loading-spinner")).not.toBeNull();
  });

  it("is pressed while playing and stops on the next tap", async () => {
    speech.isSpeaking = true;
    speech.speakingText = "river";
    const button = await render();

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("停止播放");
    await act(async () => button.click());

    expect(speech.stopSpeaking).toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("stays idle while a different text is playing", async () => {
    speech.isSpeaking = true;
    speech.speakingText = "ocean";
    const button = await render("river");

    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-busy")).toBe("false");
  });
});
