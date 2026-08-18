import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../services/settingsService", () => ({
  getUserSettings: vi.fn().mockResolvedValue(null),
  saveUserSettings: vi.fn().mockResolvedValue(undefined),
  normalizeTtsEngine: () => "piper",
}));
vi.mock("../services/localBackend", () => ({
  getComputeMode: () => "auto",
  setComputeMode: vi.fn(),
}));

import { SettingsProvider } from "./SettingsContext";
import { useSettings } from "../hooks/useSettings";
import { VOCABULARY_PANEL_MODE_KEY } from "../utils/vocabularyPanelPreferences";

function Probe() {
  const { vocabularyPanelMode, updateVocabularyPanelMode } = useSettings();
  return (
    <button
      data-testid="probe"
      onClick={() =>
        updateVocabularyPanelMode(
          vocabularyPanelMode === "docked" ? "floating" : "docked",
        )
      }
    >
      {vocabularyPanelMode}
    </button>
  );
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("SettingsContext vocabulary panel mode", () => {
  it("defaults to docked", () => {
    act(() => root.render(<SettingsProvider><Probe /></SettingsProvider>));
    expect(host.querySelector('[data-testid="probe"]')?.textContent).toBe("docked");
  });

  it("reads the stored preference on mount", () => {
    localStorage.setItem(VOCABULARY_PANEL_MODE_KEY, "floating");
    act(() => root.render(<SettingsProvider><Probe /></SettingsProvider>));
    expect(host.querySelector('[data-testid="probe"]')?.textContent).toBe("floating");
  });

  it("updates state and persists on change", () => {
    act(() => root.render(<SettingsProvider><Probe /></SettingsProvider>));
    const probe = host.querySelector<HTMLElement>('[data-testid="probe"]');

    act(() => probe?.click());

    expect(probe?.textContent).toBe("floating");
    expect(localStorage.getItem(VOCABULARY_PANEL_MODE_KEY)).toBe("floating");
  });
});
