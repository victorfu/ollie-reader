import { StrictMode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExamQuestionImage } from "./ExamQuestionImage";

let container: HTMLDivElement;
let root: Root;

function zoomButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label^="放大附圖"]',
  );
  if (!button) throw new Error("zoom button not found");
  return button;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom 未實作 dialog 的 modal API;比照 ExamHub.test.tsx 補上,
  // close 額外派發 close 事件以模擬原生行為(Esc 路徑靠它同步狀態)。
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StrictMode>
        <ExamQuestionImage
          image="math-q25.png"
          number={25}
          questionPdf="/exams/math.pdf"
        />
      </StrictMode>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ExamQuestionImage lightbox", () => {
  it("opens the modal dialog when the image is tapped", () => {
    expect(container.querySelector("dialog[open]")).toBeNull();
    act(() => zoomButton().click());
    const dialog = container.querySelector("dialog[open]");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog?.querySelector("img")).toBeTruthy();
  });

  it("closes via the close button", () => {
    act(() => zoomButton().click());
    expect(container.querySelector("dialog[open]")).toBeTruthy();

    const closeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="關閉放大檢視"]',
    );
    expect(closeButton).toBeTruthy();
    act(() => closeButton?.click());
    expect(container.querySelector("dialog[open]")).toBeNull();
  });

  it("stays consistent when the dialog closes natively (Esc)", () => {
    act(() => zoomButton().click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    expect(dialog).toBeTruthy();

    // 原生 Esc 會直接 close dialog 並發出 close 事件;元件須同步回關閉狀態
    act(() => dialog?.close());
    expect(container.querySelector("dialog[open]")).toBeNull();

    // 之後仍可再次開啟
    act(() => zoomButton().click());
    expect(container.querySelector("dialog[open]")).toBeTruthy();
  });
});
