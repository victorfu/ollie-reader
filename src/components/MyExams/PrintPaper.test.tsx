import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePage, makeQuestion } from "../../testing/questionBankFixtures";
import { PrintPaper } from "./PrintPaper";

let container: HTMLDivElement;
let root: Root;

const page = makePage({ storagePath: "p0.jpg", masks: [{ x: 0.2, y: 0.2, w: 0.1, h: 0.05 }] });
const items = [
  { question: makeQuestion({ id: "q1", answer: "(3)", answerSpace: "medium" }), pages: [page] },
  { question: makeQuestion({ id: "q2", answerSpace: "none" }), pages: [page] },
  { question: makeQuestion({ id: "q3", answer: "12 公分" }), pages: [page] },
];

function render(overrides: Partial<ComponentProps<typeof PrintPaper>> = {}) {
  act(() =>
    root.render(
      <PrintPaper
        title="期中考複習"
        items={items}
        urls={{ "p0.jpg": "https://signed/p0" }}
        scale={1}
        enhance={false}
        includeAnswers
        onImageLoad={vi.fn()}
        {...overrides}
      />,
    ),
  );
}

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

describe("PrintPaper", () => {
  it("uses fixed light colors instead of theme tokens (dark mode prints black text)", () => {
    render();
    const paper = container.firstElementChild as HTMLElement;
    expect(paper.className).toContain("bg-white");
    expect(paper.className).toContain("text-black");
    expect(container.innerHTML).not.toContain("base-content");
  });

  it("numbers questions continuously and loads every image eagerly", () => {
    render();
    const numbers = [...container.querySelectorAll("li[data-question-id] > span")].map((item) => item.textContent);
    expect(numbers).toEqual(["1.", "2.", "3."]);
    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(3);
    expect(images.every((image) => image.getAttribute("loading") === "eager")).toBe(true);
  });

  it("draws masks as SVG rects", () => {
    render();
    expect(container.querySelectorAll("svg rect")).toHaveLength(3);
  });

  it("adds answer space below questions", () => {
    render();
    const spaces = [...container.querySelectorAll<HTMLElement>('[data-testid="answer-space"]')];
    expect(spaces.map((space) => space.style.height)).toEqual(["4cm"]);
  });

  it("prints an answer page with a dash for missing answers", () => {
    render();
    const answerPage = container.querySelector('[data-testid="answer-page"]');
    expect(answerPage?.className).toContain("break-before-page");
    expect([...(answerPage?.querySelectorAll("li") ?? [])].map((item) => item.textContent)).toEqual([
      "1. (3)",
      "2. —",
      "3. 12 公分",
    ]);
  });

  it("omits the answer page when turned off", () => {
    render({ includeAnswers: false });
    expect(container.querySelector('[data-testid="answer-page"]')).toBeNull();
  });

  it("reports image loads with question and region keys", () => {
    const onImageLoad = vi.fn();
    render({ onImageLoad });
    act(() => {
      container.querySelectorAll("img")[1].dispatchEvent(new Event("load"));
    });
    expect(onImageLoad).toHaveBeenCalledWith("q2:0");
  });
});
