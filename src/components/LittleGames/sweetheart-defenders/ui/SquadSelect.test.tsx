import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SquadSelect } from "./SquadSelect";
import { CHARACTERS } from "../data/characters";
import { ARCHETYPE_BY_ELEMENT, ARCHETYPE_DESC_ZH } from "../data/elements";
import { getTowerStats } from "../engine/combat";

/**
 * 這支測的是「選隊時看得到打得多遠、也看得到怎麼打」。
 *
 * 選隊畫面本來只有造價和兩個標籤，射程要進到戰鬥點開塔位才知道——那時候糖霜
 * 已經花下去了。射程改成卡片上就有，招式說明則收在 ⓘ 的彈出面板裡。
 */

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

/** 狙擊（射程最遠）與藤蔓（最近）各一隻，射程差得出來才測得出來。 */
const ROSTER = [
  CHARACTERS.find((character) => character.elements[0] === "light")!,
  CHARACTERS.find((character) => character.elements[0] === "leaf")!,
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let started: string[][] = [];

function renderSquad(initialSquadIds: string[] = []): HTMLDivElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root!.render(
      <SquadSelect
        levelName="店門小徑"
        availableCharacters={ROSTER}
        initialSquadIds={initialSquadIds}
        onStart={(squadIds) => started.push(squadIds)}
        onBack={() => {}}
      />,
    );
  });

  return host;
}

function buttonByLabel(dom: HTMLElement, label: string): HTMLButtonElement {
  const button = [...dom.querySelectorAll("button")].find(
    (el) => el.getAttribute("aria-label") === label,
  );

  expect(button, `找不到 aria-label 為「${label}」的按鈕`).toBeDefined();
  return button as HTMLButtonElement;
}

function buttonByText(dom: HTMLElement, text: string): HTMLButtonElement {
  const button = [...dom.querySelectorAll("button")].find((el) =>
    (el.textContent ?? "").includes(text),
  );

  expect(button, `找不到寫著「${text}」的按鈕`).toBeDefined();
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
  started = [];
});

describe("the squad screen shows how far each character reaches", () => {
  it("prints every character's range on its card", () => {
    const dom = renderSquad();

    for (const character of ROSTER) {
      const range = Math.round(getTowerStats(character, 1).range);
      expect(dom.textContent).toContain(String(range));
    }
  });

  it("draws a longer range bar for the sniper than for the vine", () => {
    const dom = renderSquad();
    const widths = [...dom.querySelectorAll("[style*='width']")]
      .map((el) => Number.parseFloat((el as HTMLElement).style.width))
      .filter((width) => !Number.isNaN(width));

    // 兩張卡各一條，順序跟 ROSTER 一樣：狙擊在前，藤蔓在後。
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeGreaterThan(widths[1]);
  });
});

describe("the squad screen explains what each character does", () => {
  it("opens the move details in a popup", () => {
    const dom = renderSquad();
    const sniper = ROSTER[0];

    expect(dom.querySelector("[role='dialog']")).toBeNull();
    click(buttonByLabel(dom, `看 ${sniper.nameZh} 的招式細節`));

    const dialog = dom.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    // 招式說明來自打法，不是寫死的字串——重新平衡時這裡不該跟著壞。
    expect(dialog!.textContent).toContain(
      ARCHETYPE_DESC_ZH[ARCHETYPE_BY_ELEMENT[sniper.elements[0]]],
    );
  });

  it("lets you pick the character straight from the popup", () => {
    const [sniper, vine] = ROSTER;
    // 給一支不含狙擊的隊伍：空陣列會觸發自動推薦，那就沒有「還沒選的人」可以測。
    const dom = renderSquad([vine.id]);

    click(buttonByLabel(dom, `看 ${sniper.nameZh} 的招式細節`));
    click(buttonByText(dom, "選入隊伍"));

    // 面板收起來，而且那隻已經站上隊伍欄位。
    expect(dom.querySelector("[role='dialog']")).toBeNull();
    expect(buttonByLabel(dom, `把 ${sniper.nameZh} 請下場`)).toBeDefined();

    click(buttonByText(dom, "出發"));
    expect(started).toEqual([[vine.id, sniper.id]]);
  });
});
