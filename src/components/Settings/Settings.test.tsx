import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY } from "../../services/gachaPreferences";

const updateSettingMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "player-1" } }),
}));

vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({
    ttsMode: "browser",
    ttsEngine: "piper",
    speechRate: 1,
    readingMode: "word",
    textParsingMode: "backend",
    computeMode: "cloud",
    loading: false,
    error: null,
    updateTtsMode: updateSettingMock,
    updateTtsEngine: updateSettingMock,
    updateSpeechRate: updateSettingMock,
    updateReadingMode: updateSettingMock,
    updateTextParsingMode: updateSettingMock,
    updateComputeMode: vi.fn(),
  }),
}));

vi.mock("../../services/gameProgressService", () => ({
  resetGameProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/localBackend", () => ({
  getComputeStatusSync: () => ({
    usingLocal: false,
    localReachable: false,
  }),
  refreshComputeBase: vi.fn().mockResolvedValue(undefined),
}));

import { Settings } from "./Settings";

let container: HTMLDivElement;
let root: Root;

function renderSettings(): void {
  act(() => root.render(<Settings />));
}

function openGameSettings(): void {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "遊戲",
  );
  if (!button) throw new Error("game settings category not found");
  act(() => button.click());
}

function showAllToggle(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-describedby="show-all-gacha-description"]',
  );
  if (!input) throw new Error("show-all gacha toggle not found");
  return input;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Settings gacha collection preference", () => {
  it("persists the full-collection toggle and restores it after remounting", () => {
    renderSettings();
    openGameSettings();

    const toggle = showAllToggle();
    expect(toggle.checked).toBe(false);
    act(() => toggle.click());
    expect(toggle.checked).toBe(true);
    expect(
      window.localStorage.getItem(SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY),
    ).toBe("true");

    act(() => root.unmount());
    root = createRoot(container);
    renderSettings();
    openGameSettings();

    expect(showAllToggle().checked).toBe(true);
    expect(container.textContent).toContain("不會更改抽取紀錄或實際收集進度");
  });
});
