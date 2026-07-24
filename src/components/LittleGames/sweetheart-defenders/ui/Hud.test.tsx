import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Hud } from "./Hud";
import { LEVELS } from "../data/levels";
import type { HudSnapshot } from "./BattleScreen";
import type { AudioControls } from "../useAudioSettings";

/**
 * 這支測的是「header 的骨架不隨 phase 增減」。
 *
 * 波次資訊列與開始按鈕如果在 prep ↔ wave 之間整個掛載／卸載，header 高度
 * 就會一下高一下矮，底下 flex-1 的畫布跟著重新 letterbox，整個畫面在每波
 * 開始與結束時都閃一下。修法是列永遠都在（開打後顯示這一波），按鈕改用
 * invisible 保留位置。
 */

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

const AUDIO: AudioControls = {
  settings: { muted: true, music: 0.6, sfx: 0.7 },
  setMuted: () => {},
  setMusicVolume: () => {},
  setSfxVolume: () => {},
};

function snapshot(phase: HudSnapshot["phase"]): HudSnapshot {
  return {
    phase,
    waveNumber: 6,
    waveCount: 10,
    cakes: 10,
    maxCakes: 10,
    frosting: 289,
    prepSeconds: 19,
    kills: 40,
    speed: 2,
    towers: [],
  };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function renderHud(phase: HudSnapshot["phase"]): HTMLDivElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root!.render(
      <Hud
        hud={snapshot(phase)}
        levelName="廚房十字"
        nextWave={LEVELS[1].waves[5]}
        paused={false}
        audio={AUDIO}
        onStartWave={() => {}}
        onToggleSpeed={() => {}}
        onTogglePause={() => {}}
        onExit={() => {}}
      />,
    );
  });

  return host;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("the hud keeps a stable footprint across phases", () => {
  it("keeps the wave info row mounted while a wave is running", () => {
    const dom = renderHud("wave");

    // 開打後顯示的是「這一波」的組成，內容仍然有意義。
    // 不指名怪物：波表重新平衡時這裡不該跟著壞，「×數量」是列固定會有的標記。
    expect(dom.textContent).toContain("第 6 波");
    expect(dom.textContent).toContain("×");
  });

  it("reserves the start button's space while a wave is running", () => {
    const dom = renderHud("wave");
    const button = [...dom.querySelectorAll("button")].find((el) =>
      (el.textContent ?? "").includes("開始第"),
    );

    expect(button).toBeDefined();
    // invisible（保留佔位）而不是卸載，右側的暫停／速度鈕才不會左右跳。
    expect(button!.className).toContain("invisible");
  });

  it("shows a clickable start button during prep", () => {
    const dom = renderHud("prep");
    const button = [...dom.querySelectorAll("button")].find((el) =>
      (el.textContent ?? "").includes("開始第 6 波"),
    );

    expect(button).toBeDefined();
    expect(button!.className).not.toContain("invisible");
  });

  it("renders the same header skeleton in prep and in wave", () => {
    // 骨架相同 = 高度相同的結構性保證；jsdom 量不到像素，改比對元素結構。
    const shape = (dom: HTMLDivElement) =>
      [...dom.querySelectorAll("header *")].map((el) => el.tagName).join(",");

    const prep = shape(renderHud("prep"));
    act(() => root!.unmount());
    host?.remove();

    const wave = shape(renderHud("wave"));

    expect(wave).toBe(prep);
  });
});
