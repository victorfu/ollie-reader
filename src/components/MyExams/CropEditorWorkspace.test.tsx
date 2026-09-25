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

function pressKey(key: string, target: EventTarget = window): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  // Pin "now" before the fixtures' FIXED_DATE (2026-09-01) so a freshly
  // created question's createdAt sorts deterministically relative to the
  // existing fixtures, matching the pattern used elsewhere in this repo
  // (e.g. geminiRequestQueue.test.ts, gachaPendingReveal.test.ts).
  vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));
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
    expect(headings()).toEqual(["第 1 題", "第 2 題"]);

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
});
