import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ deleteSheet: vi.fn() }));
vi.mock("../../services/examSheetService", () => ({ deleteSheet: mocks.deleteSheet }));

import type { ExamSheet } from "../../types/questionBank";
import { SheetList } from "./SheetList";

let container: HTMLDivElement;
let root: Root;

const sheet: ExamSheet = {
  id: "sheet-1",
  userId: "user-1",
  title: "期中考複習",
  questionIds: ["q1", "q2", "q3"],
  createdAt: new Date("2026-09-20T00:00:00Z"),
  updatedAt: new Date("2026-09-20T00:00:00Z"),
};

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
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
  mocks.deleteSheet.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SheetList", () => {
  it("links to print and edit", () => {
    act(() =>
      root.render(
        <MemoryRouter>
          <SheetList sheets={[sheet]} onDeleted={vi.fn()} />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("期中考複習");
    expect(container.textContent).toContain("3 題");
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/my-exams/sheets/sheet-1/print", "/my-exams/sheets/sheet-1/edit"]);
  });

  it("deletes after confirmation", async () => {
    const onDeleted = vi.fn();
    act(() =>
      root.render(
        <MemoryRouter>
          <SheetList sheets={[sheet]} onDeleted={onDeleted} />
        </MemoryRouter>,
      ),
    );
    act(() => button("刪除 期中考複習").click());
    await act(async () => {
      button("刪除").click();
    });
    expect(mocks.deleteSheet).toHaveBeenCalledWith("sheet-1");
    expect(onDeleted).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    act(() =>
      root.render(
        <MemoryRouter>
          <SheetList sheets={[]} onDeleted={vi.fn()} />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("還沒有考卷");
  });
});
