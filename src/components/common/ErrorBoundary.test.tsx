import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_STORAGE_KEY } from "../../i18n/storage";
import { ErrorBoundary } from "./ErrorBoundary";

let container: HTMLDivElement;
let root: Root;

function Boom(): never {
  throw new Error("boom");
}

function renderCrash(): void {
  act(() =>
    root.render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    ),
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("ErrorBoundary language", () => {
  it("shows Chinese by default", () => {
    renderCrash();
    expect(container.querySelector("h2")?.textContent).toBe("發生錯誤");
  });

  it("follows the stored mode even though it sits above LanguageProvider", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    renderCrash();
    expect(container.querySelector("h2")?.textContent).toBe("Something went wrong");
  });

  it("treats the retired hint mode as English", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en-hint");
    renderCrash();
    expect(container.querySelector("h2")?.textContent).toBe("Something went wrong");
  });
});
