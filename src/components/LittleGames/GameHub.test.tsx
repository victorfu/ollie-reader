import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameHub from "./GameHub";

type FakeGameTab = {
  closed: boolean;
  focus: ReturnType<typeof vi.fn>;
  location: { href: string };
};

let container: HTMLDivElement;
let root: Root;
let fakeTabs: FakeGameTab[];

function createFakeGameTab(href = "about:blank"): FakeGameTab {
  const tab = { closed: false, focus: vi.fn(), location: { href } };
  fakeTabs.push(tab);
  return tab;
}

function cardButton(title: string, label: string): HTMLButtonElement {
  const card = [...container.querySelectorAll("article")].find(
    (candidate) => candidate.querySelector("h2")?.textContent === title,
  );
  const button = [...(card?.querySelectorAll("button") ?? [])].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) throw new Error(`button not found: ${title} / ${label}`);
  return button;
}

function renderGameHub(): void {
  act(() => root.render(<GameHub />));
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  fakeTabs = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  fakeTabs.forEach((tab) => {
    tab.closed = true;
  });
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("GameHub card layout", () => {
  it("keeps the cards in the order the hub is designed around", () => {
    renderGameHub();

    const cards = [...container.querySelectorAll("article")];
    const titles = cards.map((card) => card.querySelector("h2")?.textContent);

    // 順序是排過的，不是陣列寫下來的先後而已——改動順序要是有意識的。
    expect(titles).toEqual([
      "單字大冒險",
      "人氣角色扭蛋機",
      "大耳狗的雲朵小窩",
      "甜心防衛隊",
      "Mushroom Adventure",
      "Meteor Glider",
      "Bunny Jumper",
    ]);
  });

  it("flags the games still in development", () => {
    renderGameHub();

    const cards = [...container.querySelectorAll("article")];
    const flagged = cards.filter((card) => card.textContent?.includes("開發中"));

    expect(flagged.map((card) => card.querySelector("h2")?.textContent)).toEqual(
      ["大耳狗的雲朵小窩", "甜心防衛隊"],
    );
  });

  it("shows the Cloud Cottage card copy and cloud-save status from the design", () => {
    renderGameHub();

    const card = [...container.querySelectorAll("article")].find(
      (candidate) =>
        candidate.querySelector("h2")?.textContent === "大耳狗的雲朵小窩",
    );

    expect(card).toBeDefined();
    expect(card!.textContent).toContain("☁️");
    expect(card!.textContent).toContain("Pet Care");
    expect(card!.textContent).toContain(
      "大耳狗喜拿住進了雲朵小窩:餵點心、洗泡泡澡、佈置房間,越照顧感情越好。",
    );
    expect(card!.textContent).toContain("雲端存檔");
  });

  it("shows the English name above the Chinese one where both exist", () => {
    renderGameHub();

    // 這是英文學習 App，英文名擺主位、中文名放下一行。
    for (const [en, zh] of [
      ["Mushroom Adventure", "森林蘑菇冒險"],
      ["Meteor Glider", "隕石滑翔機"],
      ["Bunny Jumper", "兔兔跳跳"],
    ] as const) {
      const card = [...container.querySelectorAll("article")].find(
        (candidate) => candidate.querySelector("h2")?.textContent === en,
      );

      expect(card, `找不到 ${en} 的卡片`).toBeDefined();
      expect(card!.textContent).toContain(zh);
    }
  });

  it("refreshes best scores when another game tab writes local storage", () => {
    renderGameHub();

    localStorage.setItem("bunnyJumperBestScore", "42");
    localStorage.setItem("meteor-glider-best", "31");
    localStorage.setItem("mushroom-adventure-best", "27");
    act(() => window.dispatchEvent(new Event("storage")));

    expect(container.textContent).toContain("最高星星 42");
    expect(container.textContent).toContain("最高星星 31");
    expect(container.textContent).toContain("最高星星 27");
  });

  it("refreshes best scores when the Hub regains focus", () => {
    renderGameHub();

    localStorage.setItem("meteor-glider-best", "88");
    act(() => window.dispatchEvent(new Event("focus")));

    expect(container.textContent).toContain("最高星星 88");
  });

  it("still renders when local storage reads are blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => renderGameHub()).not.toThrow();
    expect(container.textContent).toContain("Meteor Glider");
    expect(container.textContent).toContain("Mushroom Adventure");
  });
});

describe("GameHub single-tab game launcher", () => {
  it("opens every game URL in its own stable named tab", () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => {
      return createFakeGameTab() as unknown as Window;
    });
    renderGameHub();

    const entries = [
      ["單字大冒險", "開始遊戲", "/games/spirit"],
      ["人氣角色扭蛋機", "開始扭蛋", "/games/gacha"],
      ["人氣角色扭蛋機", "查看圖鑑", "/games/gacha?view=collection"],
      ["大耳狗的雲朵小窩", "開始遊戲", "/games/cottage"],
      ["甜心防衛隊", "開始遊戲", "/games/sweetheart"],
      ["Mushroom Adventure", "開始遊戲", "/games/mushroom"],
      ["Meteor Glider", "開始遊戲", "/games/meteor"],
      ["Bunny Jumper", "開始遊戲", "/games/bunny"],
    ] as const;

    for (const [title, label] of entries) {
      act(() => cardButton(title, label).click());
    }

    expect(openMock).toHaveBeenCalledTimes(entries.length);
    const targetNames = new Set<string>();
    entries.forEach(([, , path], index) => {
      const expectedUrl = new URL(path, window.location.href);
      const call = openMock.mock.calls[index];
      expect(call?.[0]).toBe("");
      expect(call?.[1]).toBe(
        `ollie-game-${encodeURIComponent(`${expectedUrl.pathname}${expectedUrl.search}${expectedUrl.hash}`)}`,
      );
      expect(call).toHaveLength(2);
      targetNames.add(String(call?.[1]));
      expect(fakeTabs[index]?.focus).toHaveBeenCalledTimes(1);
      expect(fakeTabs[index]?.location.href).toBe(expectedUrl.href);
    });
    expect(targetNames.size).toBe(entries.length);
  });

  it("focuses an already-open matching URL without reopening or reloading it", () => {
    const tab = createFakeGameTab();
    const openMock = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);
    renderGameHub();

    const button = cardButton("Bunny Jumper", "開始遊戲");
    act(() => button.click());
    act(() => button.click());

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(tab.focus).toHaveBeenCalledTimes(2);
  });

  it("keeps detecting the open tab after the game hub remounts", () => {
    const tab = createFakeGameTab();
    const openMock = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);
    renderGameHub();

    act(() => cardButton("Mushroom Adventure", "開始遊戲").click());
    act(() => root.unmount());
    root = createRoot(container);
    renderGameHub();
    act(() => cardButton("Mushroom Adventure", "開始遊戲").click());

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(tab.focus).toHaveBeenCalledTimes(2);
  });

  it("opens the URL again when the previous game tab was closed", () => {
    const firstTab = createFakeGameTab();
    const secondTab = createFakeGameTab();
    const openMock = vi
      .spyOn(window, "open")
      .mockReturnValueOnce(firstTab as unknown as Window)
      .mockReturnValueOnce(secondTab as unknown as Window);
    renderGameHub();

    const button = cardButton("Meteor Glider", "開始遊戲");
    act(() => button.click());
    firstTab.closed = true;
    act(() => button.click());

    expect(openMock).toHaveBeenCalledTimes(2);
    expect(firstTab.focus).toHaveBeenCalledTimes(1);
    expect(secondTab.focus).toHaveBeenCalledTimes(1);
  });

  it("stays usable when the browser blocks the new tab", () => {
    const openMock = vi.spyOn(window, "open").mockReturnValue(null);
    renderGameHub();

    const button = cardButton("單字大冒險", "開始遊戲");
    expect(() => {
      act(() => button.click());
      act(() => button.click());
    }).not.toThrow();

    expect(openMock).toHaveBeenCalledTimes(2);
  });
});
