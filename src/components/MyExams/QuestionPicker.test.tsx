import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useSignedPageUrls: vi.fn() }));
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: mocks.useSignedPageUrls }));

import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { QuestionPicker } from "./QuestionPicker";

let container: HTMLDivElement;
let root: Root;

const at = (second: number) => new Date(`2026-09-01T00:00:0${second}Z`);
const bank = [
  makeQuestion({ id: "m1", subject: "math", createdAt: at(1) }),
  makeQuestion({ id: "m2", subject: "math", createdAt: at(2) }),
  makeQuestion({ id: "c1", subject: "chinese", createdAt: at(3) }),
];

function cards(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button[data-question-id]")];
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.startsWith(label));
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

function render(onAdd = vi.fn(), excludeIds = new Set(["m2"])) {
  act(() =>
    root.render(
      <QuestionPicker
        isOpen
        bank={bank}
        sources={[makeSource()]}
        excludeIds={excludeIds}
        onAdd={onAdd}
        onClose={vi.fn()}
      />,
    ),
  );
  return onAdd;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  mocks.useSignedPageUrls.mockReturnValue({ urls: {}, failed: false, refresh: vi.fn() });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("QuestionPicker", () => {
  it("hides questions that are already on the sheet", () => {
    render();
    expect(cards().map((card) => card.dataset.questionId)).toEqual(["m1", "c1"]);
  });

  it("filters by subject", () => {
    render();
    act(() => button("國語").click());
    expect(cards().map((card) => card.dataset.questionId)).toEqual(["c1"]);
  });

  it("adds the selected questions in display order", () => {
    const onAdd = render();
    const addButton = button("加入");
    expect(addButton.disabled).toBe(true);

    act(() => cards()[1].click());
    act(() => cards()[0].click());
    expect(button("加入").textContent).toBe("加入 2 題");

    act(() => button("加入").click());
    expect(onAdd.mock.calls[0][0].map((question: { id: string }) => question.id)).toEqual(["m1", "c1"]);
  });
});
