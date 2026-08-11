import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TitleScreen } from "./TitleScreen";
import { CHARACTERS } from "../data/characters";
import { LEVELS } from "../data/levels";
import type { AudioControls } from "../useAudioSettings";

/**
 * 這支測的是「圖鑑跟聲音一樣，是右上角一顆按鈕加彈出面板」。
 *
 * 之前圖鑑是路線頁最底下一整條卡片，還會整頁切走；改成彈出面板之後，
 * 關掉圖鑑要能回到原本的闖關路線，而不是回到一個重新掛載的畫面。
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

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function renderTitle(
  levelStars: Record<string, 0 | 1 | 2 | 3> = {},
): HTMLDivElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root!.render(
      <TitleScreen
        levelStars={levelStars}
        bestWave={{}}
        availableCharacters={CHARACTERS.slice(0, 3)}
        syncStatus="idle"
        isSignedIn
        audio={AUDIO}
        onStart={() => {}}
      />,
    );
  });

  return host;
}

function dexButton(dom: HTMLDivElement): HTMLButtonElement {
  const button = [...dom.querySelectorAll("button")].find((el) =>
    (el.getAttribute("aria-label") ?? "").startsWith("角色圖鑑"),
  );

  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("the character dex sits in the corner as a popup", () => {
  it("starts closed, with the dex reachable from a single corner button", () => {
    const dom = renderTitle();

    expect(dom.querySelector("[role='dialog']")).toBeNull();
    // 收藏進度看不到圖示的話還有 aria-label 可讀。
    expect(dexButton(dom).getAttribute("aria-label")).toBe(
      `角色圖鑑（已收集 3 / ${CHARACTERS.length}）`,
    );
  });

  it("opens the dex in a popup without leaving the level route", () => {
    const dom = renderTitle();
    click(dexButton(dom));

    const dialog = dom.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain(`已收集 3 / ${CHARACTERS.length}`);
    // 路線頁還在底下，關掉面板就直接看得到，不用重新掛載。
    expect(dom.textContent).toContain("甜心防衛隊");
  });

  it("closes on Escape", () => {
    const dom = renderTitle();
    click(dexButton(dom));
    expect(dom.querySelector("[role='dialog']")).not.toBeNull();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(dom.querySelector("[role='dialog']")).toBeNull();
  });

  it("shows the number of slots the planner actually produced", () => {
    const allUnlocked = Object.fromEntries(
      LEVELS.map((level) => [level.id, 3]),
    ) as Record<string, 3>;
    const dom = renderTitle(allUnlocked);
    const honeyCard = [...dom.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("蜂蜜漩渦"),
    );
    const chocolateCard = [...dom.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("巧克力噴泉"),
    );

    expect(honeyCard).toBeDefined();
    expect(honeyCard!.textContent).toContain("15 個塔位");
    expect(honeyCard!.textContent).not.toContain("18 個塔位");
    expect(chocolateCard).toBeDefined();
    expect(chocolateCard!.textContent).toContain("17 個塔位");
    expect(chocolateCard!.textContent).not.toContain("18 個塔位");
  });
});
