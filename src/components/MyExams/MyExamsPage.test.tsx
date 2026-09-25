import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bank: {
    sources: [],
    questions: [],
    sheets: [],
    loading: false,
    error: null as string | null,
    reload: vi.fn(),
  },
}));

vi.mock("../../hooks/useQuestionBank", () => ({ useQuestionBank: () => mocks.bank }));
// 以下只是不讓子元件載入 Firebase／Supabase／PDF；這些測試用不到它們。
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));
vi.mock("../../services/questionSourceService", () => ({ deleteSource: vi.fn() }));
vi.mock("../../services/examSheetService", () => ({ deleteSheet: vi.fn() }));
vi.mock("./SourceUploadDialog", () => ({ SourceUploadDialog: () => null }));

import MyExamsPage from "./MyExamsPage";

let container: HTMLDivElement;
let root: Root;

function renderPage() {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/my-exams"]}>
        <MyExamsPage />
      </MemoryRouter>,
    ),
  );
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  mocks.bank.loading = false;
  mocks.bank.error = null;
  mocks.bank.reload.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("MyExamsPage", () => {
  it("shows the empty state when the bank is empty", () => {
    renderPage();
    expect(container.textContent).toContain("題庫還是空的");
  });

  it("shows only the error when loading fails", () => {
    mocks.bank.error = "讀取題庫失敗";
    renderPage();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("讀取題庫失敗");
    expect(container.textContent).not.toContain("題庫還是空的");
  });

  it("retries from the error", () => {
    mocks.bank.error = "讀取題庫失敗";
    renderPage();
    act(() => button("重試").click());
    expect(mocks.bank.reload).toHaveBeenCalledTimes(1);
  });
});
