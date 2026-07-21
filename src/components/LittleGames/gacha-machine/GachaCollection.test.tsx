import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GachaSaveV1 } from "./gachaTypes";

vi.mock("framer-motion", async () => {
  const { createElement, forwardRef } = await import("react");
  const motionProps = new Set([
    "initial",
    "animate",
    "transition",
    "whileTap",
  ]);
  const components = new Map<string | symbol, unknown>();
  const motion = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_target, tag) => {
      const cached = components.get(tag);
      if (cached) return cached;
      const component = forwardRef(function MotionStub(
        props: Record<string, unknown>,
        ref: unknown,
      ) {
        const domProps: Record<string, unknown> = { ref };
        for (const [key, value] of Object.entries(props)) {
          if (!motionProps.has(key) && key !== "children") domProps[key] = value;
        }
        return createElement(String(tag), domProps, props.children as ReactNode);
      });
      components.set(tag, component);
      return component;
    },
  });
  return { motion, useReducedMotion: () => true };
});

import { GachaCollection } from "./GachaCollection";

let container: HTMLDivElement;
let root: Root;

const EMPTY_SAVE: GachaSaveV1 = {
  schemaVersion: 1,
  resetVersion: 0,
  totalDraws: 0,
  ownedCounts: {},
};

function renderCollection(
  save: GachaSaveV1 = EMPTY_SAVE,
  showAllEntries = false,
): void {
  act(() => {
    root.render(
      <GachaCollection save={save} showAllEntries={showAllEntries} />,
    );
  });
}

function characterButton(name: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label^="查看${name}角色圖片"]`,
  );
  if (!button) throw new Error(`character button not found: ${name}`);
  return button;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (!this.open) return;
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("GachaCollection image viewer", () => {
  it("opens an owned character image and restores focus after closing", () => {
    renderCollection({
      ...EMPTY_SAVE,
      totalDraws: 2,
      ownedCounts: { kuromi: 2 },
    });

    const kuromiButton = characterButton("酷洛米");
    expect(kuromiButton.disabled).toBe(false);
    kuromiButton.focus();
    act(() => kuromiButton.click());

    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog?.textContent).toContain("已遇見 2 次");
    expect(dialog?.querySelector('img[alt="酷洛米角色圖片"]')).toBeTruthy();

    const closeButton = dialog?.querySelector<HTMLButtonElement>(
      'button[aria-label="關閉角色圖片"]',
    );
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      closeButton?.click();
    });
    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(document.activeElement).toBe(kuromiButton);
  });

  it("keeps unowned characters hidden and noninteractive by default", () => {
    renderCollection({
      ...EMPTY_SAVE,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
    });

    const lockedButtons = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="尚未解鎖的角色"]',
    );
    expect(lockedButtons).toHaveLength(56);
    expect(lockedButtons[0]?.disabled).toBe(true);
    expect(container.textContent).toContain("1 / 57");
    expect(container.querySelector('img[alt="Hello Kitty"]')).toBeNull();
  });

  it("reveals every image as a preview without changing real progress", () => {
    renderCollection(EMPTY_SAVE, true);

    expect(container.textContent).toContain("完整圖鑑預覽已開啟");
    expect(container.textContent).toContain("0 / 57");
    expect(
      container.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="查看"]',
      ),
    ).toHaveLength(57);

    const helloKittyButton = characterButton("Hello Kitty");
    expect(helloKittyButton.disabled).toBe(false);
    expect(helloKittyButton.getAttribute("aria-label")).toContain("尚未解鎖");
    act(() => helloKittyButton.click());

    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    expect(dialog?.textContent).toContain("完整圖鑑預覽");
    expect(dialog?.textContent).toContain("尚未透過扭蛋解鎖");
    expect(dialog?.querySelector('img[alt="Hello Kitty角色圖片"]')).toBeTruthy();
  });

  it("syncs state after the dialog closes natively and can reopen", () => {
    renderCollection({ ...EMPTY_SAVE, ownedCounts: { kuromi: 1 } });
    const kuromiButton = characterButton("酷洛米");
    act(() => kuromiButton.click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");

    act(() => dialog?.close());
    expect(container.querySelector("dialog[open]")).toBeNull();

    act(() => kuromiButton.click());
    expect(container.querySelector("dialog[open]")).toBeTruthy();
  });
});
