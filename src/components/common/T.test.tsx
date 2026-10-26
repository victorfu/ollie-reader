import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { LANGUAGE_STORAGE_KEY } from "../../i18n/storage";
import type { LanguageMode } from "../../i18n/translate";
import { T } from "./T";

let container: HTMLDivElement;
let root: Root;

function render(mode: LanguageMode | null, ui: React.ReactNode): void {
  if (mode) localStorage.setItem(LANGUAGE_STORAGE_KEY, mode);
  act(() => root.render(<LanguageProvider>{ui}</LanguageProvider>));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("<T>", () => {
  it("defaults to Chinese and sets <html lang>", () => {
    render(null, <T k="settings.title" />);
    expect(container.textContent).toBe("設定");
    expect(document.documentElement.lang).toBe("zh-Hant-TW");
  });

  it("renders English with the Chinese as a hover tooltip in English mode", () => {
    render("en", <T k="settings.theme.title" />);
    const hint = container.querySelector<HTMLElement>("[title]")!;
    expect(hint.title).toBe("外觀主題");
    expect(container.textContent).toBe("Theme");
    expect(document.documentElement.lang).toBe("en");
  });

  it("has no tooltip in Chinese mode", () => {
    render("zh-TW", <T k="settings.theme.title" />);
    expect(container.querySelector("[title]")).toBeNull();
  });

  it("skips the tooltip when both languages read the same", () => {
    render("en", <T k="settings.language.en" />);
    expect(container.textContent).toBe("English");
    expect(container.querySelector("[title]")).toBeNull();
  });

  it("reads the retired hint mode as English", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en-hint");
    act(() => root.render(<LanguageProvider><T k="settings.title" /></LanguageProvider>));
    expect(container.textContent).toBe("Settings");
  });

  it("works without a provider (keeps Chinese)", () => {
    act(() => root.render(<T k="settings.title" />));
    expect(container.textContent).toBe("設定");
  });
});
