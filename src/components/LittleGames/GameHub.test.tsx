import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameHub from "./GameHub";

type FakeGameTab = {
  closed: boolean;
  focus: ReturnType<typeof vi.fn>;
};

let container: HTMLDivElement;
let root: Root;
let fakeTabs: FakeGameTab[];

function createFakeGameTab(): FakeGameTab {
  const tab = { closed: false, focus: vi.fn() };
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
      ["Wonder Academy", "開始遊戲", "/games/wonder-academy"],
      ["Bunny Jumper", "開始遊戲", "/games/bunny"],
      ["森林蘑菇冒險", "開始遊戲", "/games/mushroom"],
      ["Meteor Glider", "開始遊戲", "/games/meteor"],
    ] as const;

    for (const [title, label] of entries) {
      act(() => cardButton(title, label).click());
    }

    expect(openMock).toHaveBeenCalledTimes(entries.length);
    const targetNames = new Set<string>();
    entries.forEach(([, , path], index) => {
      const expectedUrl = new URL(path, window.location.href);
      const call = openMock.mock.calls[index];
      expect(call?.[0]).toBe(expectedUrl.href);
      expect(call?.[1]).toBe(
        `ollie-game-${encodeURIComponent(`${expectedUrl.pathname}${expectedUrl.search}${expectedUrl.hash}`)}`,
      );
      expect(call).toHaveLength(2);
      targetNames.add(String(call?.[1]));
      expect(fakeTabs[index]?.focus).toHaveBeenCalledTimes(1);
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

    act(() => cardButton("森林蘑菇冒險", "開始遊戲").click());
    act(() => root.unmount());
    root = createRoot(container);
    renderGameHub();
    act(() => cardButton("森林蘑菇冒險", "開始遊戲").click());

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
