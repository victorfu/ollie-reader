import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getExamPaper } from "../../data/exams";
import { ExamHub } from "./ExamHub";
import {
  readScopeProgress,
  recordSessionResult,
} from "./examProgressStorage";

let container: HTMLDivElement;
let root: Root;

function buttonIn(parent: ParentNode, label: string): HTMLButtonElement {
  const button = [...parent.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`button not found: ${label}`);
  }
  return button;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ExamHub progress reset", () => {
  it("clears the current subject after confirmation and refreshes the cards", () => {
    recordSessionResult({
      subject: "chinese",
      scopeId: "chi-s1",
      mode: "normal",
      score: 6,
      total: 8,
      wrongIds: ["chi-001", "chi-002"],
    });
    recordSessionResult({
      subject: "math",
      scopeId: "math-p1",
      mode: "normal",
      score: 20,
      total: 25,
      wrongIds: ["math-001"],
    });

    act(() => {
      root.render(
        <ExamHub
          paper={getExamPaper("chinese")}
          subject="chinese"
          onSelectSubject={vi.fn()}
          onStart={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("6 / 8");
    expect(container.textContent).toContain("錯題重練（2）");

    act(() => buttonIn(container, "重設進度").click());
    const dialog = container.querySelector("dialog[open]");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);

    act(() => buttonIn(dialog ?? container, "重設進度").click());

    expect(readScopeProgress("chinese", "chi-s1")).toBeNull();
    expect(readScopeProgress("math", "math-p1")).not.toBeNull();
    expect(container.textContent).not.toContain("6 / 8");
    expect(container.textContent).not.toContain("錯題重練（2）");
    expect(buttonIn(container, "重設進度").disabled).toBe(true);
  });

  it("keeps progress when the confirmation is cancelled", () => {
    recordSessionResult({
      subject: "chinese",
      scopeId: "chi-s1",
      mode: "normal",
      score: 7,
      total: 8,
      wrongIds: ["chi-001"],
    });
    act(() => {
      root.render(
        <ExamHub
          paper={getExamPaper("chinese")}
          subject="chinese"
          onSelectSubject={vi.fn()}
          onStart={vi.fn()}
        />,
      );
    });

    act(() => buttonIn(container, "重設進度").click());
    const dialog = container.querySelector("dialog[open]");
    act(() => buttonIn(dialog ?? container, "取消").click());

    expect(readScopeProgress("chinese", "chi-s1")).not.toBeNull();
    expect(container.textContent).toContain("7 / 8");
  });
});
