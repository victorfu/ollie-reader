import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamSectionResultView } from "./ExamSectionResultView";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ExamSectionResultView", () => {
  it("shows the section accuracy and continues to the next section", () => {
    const onContinue = vi.fn();
    act(() => {
      root.render(
        <ExamSectionResultView
          result={{
            sectionId: "math-p1",
            sectionLabel: "第一部分",
            score: 18,
            total: 25,
            isFinalSection: false,
          }}
          onContinue={onContinue}
          onExit={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("正確率");
    expect(container.textContent).toContain("72%");
    expect(container.textContent).toContain("答對 18 / 25 題");

    const continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("繼續下一區段"),
    );
    expect(continueButton).toBeInstanceOf(HTMLButtonElement);
    act(() => continueButton?.click());
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("offers the overall result after the final section", () => {
    act(() => {
      root.render(
        <ExamSectionResultView
          result={{
            sectionId: "chi-s5",
            sectionLabel: "五、成語進階練習",
            score: 11,
            total: 11,
            isFinalSection: true,
          }}
          onContinue={vi.fn()}
          onExit={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("100%");
    expect(container.textContent).toContain("查看總成績");
  });
});
