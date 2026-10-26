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

  it("renders plain English in English mode", () => {
    render("en", <T k="settings.title" />);
    expect(container.textContent).toBe("Settings");
    expect(container.querySelector("[data-tip]")).toBeNull();
    expect(document.documentElement.lang).toBe("en");
  });

  it("works without a provider (keeps Chinese)", () => {
    act(() => root.render(<T k="settings.title" />));
    expect(container.textContent).toBe("設定");
  });

  describe("English + Chinese hints mode", () => {
    it("inline: underlined English whose tooltip opens on tap and closes outside", () => {
      render("en-hint", <T k="settings.theme.title" />);
      const hint = container.querySelector<HTMLElement>("[data-tip]")!;
      expect(hint.dataset.tip).toBe("外觀主題");
      expect(hint.textContent).toContain("Theme");
      expect(hint.classList.contains("tooltip-open")).toBe(false);

      act(() => hint.click());
      expect(hint.classList.contains("tooltip-open")).toBe(true);
      expect(hint.getAttribute("aria-expanded")).toBe("true");

      act(() => {
        document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      });
      expect(hint.classList.contains("tooltip-open")).toBe(false);
    });

    it("inline: Escape closes an open hint", () => {
      render("en-hint", <T k="settings.theme.title" />);
      const hint = container.querySelector<HTMLElement>("[data-tip]")!;
      act(() => hint.click());
      act(() => {
        hint.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(hint.classList.contains("tooltip-open")).toBe(false);
    });

    it("stacked: shows the Chinese under the English without a tooltip", () => {
      render("en-hint", <T k="settings.title" variant="stacked" />);
      expect(container.querySelector("[data-tip]")).toBeNull();
      expect(container.textContent).toBe("Settings設定");
      expect(container.querySelector('[lang="zh-Hant-TW"]')?.textContent).toBe("設定");
    });

    it("inline: tapping a hint inside a <label> does not pick the option", () => {
      render(
        "en-hint",
        <label>
          <input type="radio" name="opt" />
          <T k="settings.tts.browserDesc" />
        </label>,
      );
      const hint = container.querySelector<HTMLElement>("[data-tip]")!;
      act(() => hint.click());
      expect(container.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
      expect(hint.classList.contains("tooltip-open")).toBe(true);
    });

    it("inline: a hint that slipped into a button never swallows the button's click", () => {
      let clicks = 0;
      render(
        "en-hint",
        <button type="button" onClick={() => clicks++}>
          <T k="settings.theme.title" />
        </button>,
      );
      act(() => container.querySelector<HTMLElement>("[data-tip]")!.click());
      expect(clicks).toBe(1);
    });

    it("skips the hint when both languages read the same", () => {
      render("en-hint", <T k="settings.language.en" />);
      expect(container.textContent).toBe("English");
      expect(container.querySelector("[data-tip]")).toBeNull();
    });
  });
});
