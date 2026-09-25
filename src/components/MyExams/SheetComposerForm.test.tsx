import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSheet: vi.fn(), updateSheet: vi.fn() }));
vi.mock("../../services/examSheetService", () => ({
  createSheet: mocks.createSheet,
  updateSheet: mocks.updateSheet,
}));
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));

import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { seededRng } from "../../testing/seededRng";
import type { BankQuestion } from "../../types/questionBank";
import { SheetComposerForm } from "./SheetComposerForm";

let container: HTMLDivElement;
let root: Root;

const bank = [
  ...["m1", "m2", "m3", "m4"].map((id) => makeQuestion({ id, subject: "math" })),
  makeQuestion({ id: "c1", subject: "chinese" }),
];

function renderForm(props: Partial<Parameters<typeof SheetComposerForm>[0]> = {}) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/my-exams/sheets/new"]}>
        <Routes>
          <Route
            path="/my-exams/sheets/new"
            element={
              <SheetComposerForm
                sheetId={null}
                initialTitle=""
                initialQuestions={[]}
                missingCount={0}
                bank={bank}
                sources={[makeSource()]}
                rng={seededRng(11)}
                {...props}
              />
            }
          />
          <Route path="/my-exams/sheets/:id/print" element={<p>列印頁</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

function rows(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("li[data-question-id]")];
}

function rowIds(): string[] {
  return rows().map((row) => row.dataset.questionId ?? "");
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  mocks.createSheet.mockReset().mockResolvedValue({ id: "sheet-9" });
  mocks.updateSheet.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SheetComposerForm", () => {
  it("draws, replaces, removes, reorders and saves", async () => {
    renderForm();

    const mathCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="出數學"]');
    const chineseCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="出國語"]');
    const englishCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="出英文"]');
    expect(englishCheckbox?.disabled).toBe(true);
    act(() => mathCheckbox?.click());
    expect(container.querySelector('[data-testid="count-math"]')?.textContent).toBe("4");

    act(() => button("隨機抽題").click());
    expect(rows()).toHaveLength(4);
    expect(button("換一題", rows()[0]).disabled).toBe(true);

    act(() => button("減少數學題數").click());
    act(() => chineseCheckbox?.click());
    act(() => button("隨機抽題").click());
    // 清單非空 → 先確認
    act(() => button("重新抽題").click());
    expect(rows()).toHaveLength(4);
    expect(rowIds()[0]).toBe("c1");
    expect(rowIds().slice(1).every((id) => id.startsWith("m"))).toBe(true);

    const before = rowIds();
    act(() => button("換一題", rows()[1]).click());
    const after = rowIds();
    expect(after[1]).not.toBe(before[1]);
    expect(after[1].startsWith("m")).toBe(true);
    expect(new Set(after).size).toBe(4);

    act(() => button("移除", rows()[3]).click());
    expect(rows()).toHaveLength(3);

    const beforeMove = rowIds();
    act(() => button("下移", rows()[0]).click());
    expect(rowIds()).toEqual([beforeMove[1], beforeMove[0], beforeMove[2]]);

    const title = container.querySelector<HTMLInputElement>('input[aria-label="考卷標題"]');
    if (!title) throw new Error("title input missing");
    typeInto(title, "期中考複習");

    const finalIds = rowIds();
    await act(async () => {
      button("儲存並列印").click();
    });
    expect(mocks.createSheet).toHaveBeenCalledWith({ title: "期中考複習", questionIds: finalIds });
    expect(container.textContent).toContain("列印頁");
  });

  it("updates an existing sheet and reports removed questions", async () => {
    const initial: BankQuestion[] = [bank[0], bank[4]];
    renderForm({ sheetId: "sheet-1", initialTitle: "舊考卷", initialQuestions: initial, missingCount: 2 });

    expect(container.textContent).toContain("有 2 題已從題庫刪除，已自動移除");
    expect(rowIds()).toEqual(["m1", "c1"]);

    await act(async () => {
      button("儲存並列印").click();
    });
    expect(mocks.updateSheet).toHaveBeenCalledWith("sheet-1", { title: "舊考卷", questionIds: ["m1", "c1"] });
  });

  it("cannot save an empty sheet", () => {
    renderForm();
    expect(button("儲存並列印").disabled).toBe(true);
  });
});
