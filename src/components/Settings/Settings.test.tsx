import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GACHA_MISS_RATE_STORAGE_KEY,
  SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY,
} from "../../services/gachaPreferences";

const updateSettingMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
// 可變的設定替身：保留系統語音與 Edge TTS 的模式選擇。
const settingsState = vi.hoisted(() => ({
  ttsMode: "browser",
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "player-1" } }),
}));

vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({
    ttsMode: settingsState.ttsMode,
    ttsEngine: "edge",
    speechRate: 1,
    readingMode: "word",
    computeMode: "cloud",
    loading: false,
    error: null,
    updateTtsMode: updateSettingMock,
    updateSpeechRate: updateSettingMock,
    updateReadingMode: updateSettingMock,
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

function openAudioSettings(): void {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "語音",
  );
  if (!button) throw new Error("audio settings category not found");
  act(() => button.click());
}

function openAdvancedSettings(): void {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "進階",
  );
  if (!button) throw new Error("advanced settings category not found");
  act(() => button.click());
}

function showAllToggle(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-describedby="show-all-gacha-description"]',
  );
  if (!input) throw new Error("show-all gacha toggle not found");
  return input;
}

function missRateSlider(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="空膠囊機率"]',
  );
  if (!input) throw new Error("gacha miss-rate slider not found");
  return input;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  settingsState.ttsMode = "browser";
  updateSettingMock.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Settings gacha preferences", () => {
  it("stores the empty-capsule rate in game settings and restores it", () => {
    renderSettings();
    openGameSettings();

    const slider = missRateSlider();
    expect(slider.value).toBe("50");

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(slider, "75");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(slider.value).toBe("75");
    expect(window.localStorage.getItem(GACHA_MISS_RATE_STORAGE_KEY)).toBe(
      "75",
    );
    expect(container.textContent).toContain(
      "下一次轉動扭蛋機把手時套用",
    );

    act(() => root.unmount());
    root = createRoot(container);
    renderSettings();
    openGameSettings();

    expect(missRateSlider().value).toBe("75");
  });

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

describe("Settings PDF interaction", () => {
  it("does not expose an empty reading category", () => {
    renderSettings();

    const readingButton = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "閱讀",
    );
    expect(readingButton).toBeUndefined();
    expect(container.textContent).not.toContain("PDF 閱讀操作");
  });

  it("does not expose a manual PDF text parsing mode", () => {
    renderSettings();
    openAdvancedSettings();

    expect(container.querySelector('input[name="textParsingMode"]')).toBeNull();
    expect(container.textContent).not.toContain("前端解析");
    expect(container.textContent).not.toContain("後端解析");
    expect(container.textContent).toContain("運算後端");
  });
});

describe("Settings speech modes", () => {
  it.each(["browser", "api"])("offers only system speech and Edge in %s mode", (mode) => {
    settingsState.ttsMode = mode;
    renderSettings();
    openAudioSettings();

    const radios = [...container.querySelectorAll<HTMLInputElement>('input[name="ttsMode"]')];
    const labels = radios.map(
      (radio) => radio.closest("label")?.textContent ?? "",
    );
    expect(labels).toHaveLength(2);
    expect(labels.some((l) => l.includes("系統語音"))).toBe(true);
    expect(labels.some((l) => l.includes("Edge TTS"))).toBe(true);
    expect(container.textContent).not.toMatch(/Piper|Kokoro/);
    expect(container.querySelector('input[name="ttsEngine"]')).toBeNull();
    expect(radios.find((radio) => radio.checked)?.closest("label")?.textContent)
      .toContain(mode === "api" ? "Edge TTS" : "系統語音");
  });

  it("tells the user Edge works through desktop or cloud and needs network", () => {
    settingsState.ttsMode = "api";
    renderSettings();
    openAudioSettings();

    expect(container.textContent).toContain("需連網");
    expect(container.textContent).toContain("桌面 App 或雲端服務");
  });

  it("selects Edge directly from system speech", async () => {
    renderSettings();
    openAudioSettings();

    const edgeRadio = [...container.querySelectorAll<HTMLInputElement>('input[name="ttsMode"]')].find((radio) =>
      radio.closest("label")?.textContent?.includes("Edge TTS"),
    );
    if (!edgeRadio) throw new Error("edge engine radio not found");
    await act(async () => edgeRadio.click());
    expect(updateSettingMock).toHaveBeenCalledExactlyOnceWith("api");
  });
});
