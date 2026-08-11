import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEVELS } from "../data/levels";
import type { RunOutcome } from "../engine/progress";
import type { AudioControls } from "../useAudioSettings";
import { BattleScreen } from "./BattleScreen";
import { celebrateClear } from "../render/celebrate";
import { playSfx } from "../audio";

vi.mock("../audio", () => ({
  playMusic: vi.fn(),
  playSfx: vi.fn(),
  stopMusic: vi.fn(),
}));

vi.mock("../render/celebrate", () => ({
  celebrateClear: vi.fn(),
}));

vi.mock("../render/renderer", () => ({
  drawSpawnHint: vi.fn(),
  renderBattle: vi.fn(),
}));

vi.mock("../render/sprites", () => ({
  preloadSprites: vi.fn(),
}));

vi.mock("../engine/simulation", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../engine/simulation")
  >();

  return {
    ...actual,
    stepSimulation: vi.fn((state: { phase: string }) => {
      state.phase = "cleared";
      return state;
    }),
  };
});

const AUDIO: AudioControls = {
  settings: { music: 0.4, sfx: 0.7, muted: true },
  setMuted: vi.fn(),
  setMusicVolume: vi.fn(),
  setSfxVolume: vi.fn(),
};

describe("BattleScreen result reporting", () => {
  let container: HTMLDivElement;
  let root: Root;
  let nextFrameId: number;
  let frames: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    nextFrameId = 1;
    frames = new Map();

    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => frames.delete(id)),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function flushFrames(now: number) {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(now);
  }

  function render(onFinished: (outcome: RunOutcome) => void) {
    root.render(
      <BattleScreen
        level={LEVELS[0]}
        availableCharacters={[]}
        audio={AUDIO}
        coinsEarned={0}
        onExit={vi.fn()}
        onRetry={vi.fn()}
        onFinished={onFinished}
      />,
    );
  }

  it("uses the latest callback but reports UI, rewards and celebration only once", () => {
    const first = vi.fn();
    const active = vi.fn();
    const afterResult = vi.fn();

    act(() => render(first));
    // 模擬父元件正常重繪所產生的新 inline callback；戰鬥迴圈不該因此重建。
    act(() => render(active));
    act(() => flushFrames(performance.now() + 100));

    expect(first).not.toHaveBeenCalled();
    expect(active).toHaveBeenCalledTimes(1);
    expect(celebrateClear).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith("cleared");

    // 結算後再重繪一次。舊實作會重建 effect、把區域變數 reported 洗回 false，
    // 下一幀便再次發獎勵、播音效並灑彩帶。
    act(() => render(afterResult));
    act(() => flushFrames(performance.now() + 200));

    expect(active).toHaveBeenCalledTimes(1);
    expect(afterResult).not.toHaveBeenCalled();
    expect(celebrateClear).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledTimes(1);
  });
});
