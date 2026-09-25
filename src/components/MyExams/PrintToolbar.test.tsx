import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRINT_PREFERENCES } from "./printSettings";
import { PrintToolbar } from "./PrintToolbar";

let container: HTMLDivElement;
let root: Root;

type Props = ComponentProps<typeof PrintToolbar>;

function render(overrides: Partial<Props> = {}): Props {
  const props: Props = {
    onBack: vi.fn(),
    onPrint: vi.fn(),
    loadedCount: 3,
    totalCount: 3,
    preferences: DEFAULT_PRINT_PREFERENCES,
    onChange: vi.fn(),
    hasAnswers: true,
    missingCount: 0,
    ...overrides,
  };
  act(() => root.render(<PrintToolbar {...props} />));
  return props;
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
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

describe("PrintToolbar", () => {
  it("is hidden when printing", () => {
    render();
    expect((container.firstElementChild as HTMLElement).className).toContain("print:hidden");
  });

  it("blocks printing until every image has loaded", () => {
    render({ loadedCount: 1, totalCount: 3 });
    expect(button("圖片載入中 1/3").disabled).toBe(true);
  });

  it("prints when ready", () => {
    const props = render();
    act(() => button("列印").click());
    expect(props.onPrint).toHaveBeenCalled();
  });

  it("disables the answer page toggle when no question has an answer", () => {
    render({ hasAnswers: false });
    const toggle = container.querySelector<HTMLInputElement>('input[aria-label="附答案頁"]');
    expect(toggle?.disabled).toBe(true);
    expect(toggle?.checked).toBe(false);
  });

  it("changes the question size", () => {
    const props = render();
    act(() => button("大").click());
    expect(props.onChange).toHaveBeenCalledWith({ ...DEFAULT_PRINT_PREFERENCES, scale: "large" });
  });

  it("warns about deleted questions", () => {
    render({ missingCount: 2 });
    expect(container.textContent).toContain("有 2 題已從題庫刪除，列印時會略過");
  });
});
