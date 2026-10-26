import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseWordPractice } from "../../hooks/useWordPractice";
import type { Homework, PracticeSettings } from "../../types/wordPractice";

const hook = vi.hoisted(() => ({ current: null as unknown as UseWordPractice }));
vi.mock("../../hooks/useWordPractice", () => ({ useWordPractice: () => hook.current }));

import { WordPracticeSettings } from "./WordPracticeSettings";

const SETTINGS: PracticeSettings = { newWordCount: 5, reviewLimit: 3, startLevel: "A1" };
/** Only its presence matters here: it makes the abandon button show. */
const ACTIVE = { id: "hw-active" } as Homework;

let host: HTMLDivElement;
let root: Root;

function makeHook(overrides: Partial<UseWordPractice> = {}): UseWordPractice {
  return {
    status: "ready",
    error: null,
    active: null,
    history: [],
    settings: SETTINGS,
    reviewDueCount: 0,
    homeworkStreak: { firstToday: true, days: 1 },
    starting: false,
    saveError: null,
    start: vi.fn().mockResolvedValue("created"),
    updateProgress: vi.fn(),
    submit: vi.fn().mockResolvedValue(null),
    abandon: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    resetProgress: vi.fn().mockResolvedValue(undefined),
    reviewState: {},
    reviewHomework: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function render() {
  act(() => root.render(<WordPracticeSettings />));
}

function text(): string {
  return host.textContent ?? "";
}

async function click(label: string) {
  const button = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`No button containing "${label}"`);
  await act(async () => button.click());
}

function openDialog(): HTMLDialogElement | null {
  return host.querySelector<HTMLDialogElement>("dialog[open]");
}

async function confirmDialog(label: string) {
  await act(async () => {
    Array.from(openDialog()!.querySelectorAll("button"))
      .find((button) => button.textContent === label)!
      .click();
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  // jsdom does not implement the modal dialog methods ConfirmModal calls.
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
  hook.current = makeHook();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("word practice settings", () => {
  it("abandons the homework in progress only after a confirmation", async () => {
    hook.current = makeHook({ active: ACTIVE });
    render();

    expect(text()).toContain("家長設定");
    expect(openDialog()).toBeNull();

    await click("放棄這份功課");
    expect(openDialog()?.textContent).toContain("放棄這份功課");
    expect(hook.current.abandon).not.toHaveBeenCalled();

    await confirmDialog("放棄功課");
    expect(hook.current.abandon).toHaveBeenCalledTimes(1);
  });

  it("saves the changed settings", async () => {
    render();

    const select = host.querySelector<HTMLSelectElement>("select")!;
    act(() => {
      select.value = "8";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("儲存設定");

    expect(hook.current.saveSettings).toHaveBeenCalledWith({ ...SETTINGS, newWordCount: 8 });
  });

  it("resets the progress only after a confirmation", async () => {
    render();

    await click("重設練習進度");
    expect(openDialog()?.textContent).toContain("無法復原");
    expect(hook.current.resetProgress).not.toHaveBeenCalled();

    await confirmDialog("重設進度");
    expect(hook.current.resetProgress).toHaveBeenCalledTimes(1);
  });

  it("has no abandon button when there is no homework in progress", () => {
    render();
    expect(text()).not.toContain("放棄這份功課");
  });

  it("offers a reload when the practice could not load", async () => {
    hook.current = makeHook({ status: "error", error: "載入失敗" });
    render();

    expect(text()).toContain("載入失敗");
    await click("重新載入");
    expect(hook.current.reload).toHaveBeenCalledTimes(1);
  });
});
