import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SquadSelect } from "./SquadSelect";
import { CHARACTERS } from "../data/characters";
import { ARCHETYPE_BY_ELEMENT, ARCHETYPE_DESC_ZH } from "../data/elements";

/**
 * 這支測的是「選隊時看得到打得多兇、打得多遠、也看得到怎麼打」。
 *
 * 攻擊力與射程都用五格圖示（劍／準星）呈現——裸數字和沒刻度的長條對
 * 小朋友都沒有意義，五格一數就能跟隔壁那張卡比。招式說明收在 ⓘ 的
 * 彈出面板裡。
 */

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

/**
 * 狙擊（射程最遠）與藤蔓（最近）各一隻，射程差得出來才測得出來；
 * 再帶一隻應援（不攻擊），確認不會出現空的攻擊力格。
 */
const ROSTER = [
  CHARACTERS.find((character) => character.elements[0] === "light")!,
  CHARACTERS.find((character) => character.elements[0] === "leaf")!,
  CHARACTERS.find(
    (character) => ARCHETYPE_BY_ELEMENT[character.elements[0]] === "cheer",
  )!,
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

/** 抓出畫面上某個五格圖示的填格數，照 DOM 順序（= ROSTER 順序）。 */
function pipCounts(dom: HTMLElement, statLabel: string): number[] {
  return [...dom.querySelectorAll(`[aria-label^="${statLabel} "]`)].map((el) =>
    Number.parseInt(
      (el.getAttribute("aria-label") ?? "").slice(statLabel.length),
      10,
    ),
  );
}

describe("the squad screen shows power and reach at a glance", () => {
  it("gives every card range pips, and the sniper more than the vine", () => {
    const dom = renderSquad();

    const reach = pipCounts(dom, "射程");
    expect(reach).toHaveLength(ROSTER.length);
    expect(reach[0]).toBeGreaterThan(reach[1]);
  });

  it("gives attackers power pips and supporters a helper label instead", () => {
    const dom = renderSquad();

    const power = pipCounts(dom, "攻擊力");
    // 應援不攻擊——空的五把劍看起來像「很弱」，那一排改放「加速夥伴」。
    // 同一個位置一定有東西，卡片高度才會一致。
    expect(power).toHaveLength(2);
    for (const filled of power) {
      expect(filled).toBeGreaterThanOrEqual(1);
    }
    expect(dom.textContent).toContain("加速夥伴");
  });

  it("no longer draws the unlabelled range bar on the cards", () => {
    const dom = renderSquad();

    expect(dom.querySelectorAll("[style*='width']")).toHaveLength(0);
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
    // 細節面板跟卡片說同一套語言：射程也是五格，不再有無刻度的長條。
    expect(dialog!.querySelector('[aria-label^="射程 "]')).not.toBeNull();
    expect(dialog!.querySelectorAll("[style*='width']")).toHaveLength(0);
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
