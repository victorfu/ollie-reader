import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitEditorChanges: vi.fn(),
  nextId: 0,
}));

vi.mock("../../services/bankQuestionService", () => ({
  commitEditorChanges: mocks.commitEditorChanges,
  newBankQuestionId: () => {
    mocks.nextId += 1;
    return `new-${mocks.nextId}`;
  },
}));
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));

import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { CropEditorWorkspace } from "./CropEditorWorkspace";

let container: HTMLDivElement;
let root: Root;

function renderWorkspace(entry = "/my-exams/sources/source-1") {
  const source = makeSource({ pages: [makePage(), makePage({ storagePath: "p1.jpg" })] });
  const questions = [
    makeQuestion({ id: "q1", answer: "(1)", regions: [{ pageIndex: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }] }),
    makeQuestion({ id: "q2", regions: [{ pageIndex: 1, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }] }),
  ];
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <CropEditorWorkspace source={source} initialQuestions={questions} />
      </MemoryRouter>,
    ),
  );
  const overlay = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (overlay) {
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  }
}

function overlay(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!element) throw new Error("overlay missing");
  return element;
}

function pointer(type: string, target: Element, clientX: number, clientY: number): void {
  const EventType = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  act(() => {
    target.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

function draw(): void {
  pointer("pointerdown", overlay(), 20, 50);
  pointer("pointermove", overlay(), 120, 90);
  pointer("pointerup", overlay(), 120, 90);
}

function headings(): string[] {
  return [...container.querySelectorAll("article header span")].map((item) => item.textContent ?? "");
}

function answerInputs(): string[] {
  return [...container.querySelectorAll<HTMLInputElement>('article input[placeholder^="例如"]')].map(
    (input) => input.value,
  );
}

function pressKey(key: string, target: EventTarget = window): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  // Pin "now" after the fixtures' FIXED_DATE (2026-09-01): a question drawn
  // "now" is created after q1/q2 and must sort after them (spec §6/§8.3 —
  // source-wide crop order, oldest first), regardless of which page it's
  // drawn on.
  vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));
  mocks.commitEditorChanges.mockReset().mockResolvedValue(undefined);
  mocks.nextId = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("CropEditorWorkspace", () => {
  it("creates a question from a drag and autosaves it", async () => {
    renderWorkspace();
    expect(headings()).toEqual(["第 1 題"]);

    draw();
    // q2 (page 1, not shown here) is source-wide #2 by crop order; the newly
    // drawn question is created after both q1 and q2, so it is #3 even
    // though it's drawn on page 1's neighbour, page 0 (spec §6/§8.3).
    expect(headings()).toEqual(["第 1 題", "第 3 題"]);
    // Card order proves it's crop order, not draw position: the first card
    // is still q1 (its answer "(1)" survives), the new card is the empty one.
    expect(answerInputs()).toEqual(["(1)", ""]);
    expect(container.querySelector('[data-box-key="q:new-1:0"]')?.textContent).toContain("3");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.upserts.map((question: { id: string }) => question.id)).toEqual(["new-1"]);
    expect(commit.upserts[0]).toMatchObject({ subject: "math", answerSpace: "none", sourceId: "source-1" });
  });

  it("opens the page of the question given by ?q=", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q2");
    expect(container.textContent).toContain("這一頁的題目（1）");
    expect(container.querySelector('[data-box-key="q:q2:0"]')).not.toBeNull();
  });

  it("does not delete the selected question while typing in the answer field", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q1");
    const answer = container.querySelector<HTMLInputElement>('input[placeholder^="例如"]');
    if (!answer) throw new Error("answer input missing");
    pressKey("Backspace", answer);
    expect(headings()).toEqual(["第 1 題"]);

    pressKey("Backspace");
    expect(headings()).toEqual([]);
  });

  it("draws masks in mask mode and saves the source", async () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());
    draw();
    expect(headings()).toEqual(["第 1 題"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.source.pages[0].masks).toHaveLength(1);
  });

  it("does not delete a question card selected while in mask mode", () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());

    const article = container.querySelector("article");
    if (!article) throw new Error("card missing");
    act(() => article.click());

    pressKey("Backspace");
    expect(headings()).toEqual(["第 1 題"]);
  });

  it("does not delete a mask left selected after switching to question mode via 新增區塊", async () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());
    draw(); // draws and selects a mask

    const appendButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "新增區塊",
    );
    if (!appendButton) throw new Error("append button missing");
    act(() => appendButton.click());

    pressKey("Backspace");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.source.pages[0].masks).toHaveLength(1);
  });

  it("clears the append hint when the append-target question is deleted via keyboard", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q1");
    const appendButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "新增區塊",
    );
    if (!appendButton) throw new Error("append button missing");
    act(() => appendButton.click());
    expect(container.textContent).toContain("新增區塊：");

    const article = container.querySelector("article");
    if (!article) throw new Error("card missing");
    act(() => article.click());
    pressKey("Backspace");

    expect(container.textContent).not.toContain("新增區塊：");
  });
});
