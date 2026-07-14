import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GachaDrawResult } from "./gachaTypes";

const confettiMock = vi.hoisted(() => vi.fn());
const playSoundMock = vi.hoisted(() => vi.fn());

vi.mock("canvas-confetti", () => ({ default: confettiMock }));
vi.mock("../../../services/gameService", () => ({ playSound: playSoundMock }));
vi.mock("framer-motion", async () => {
  const { createElement, forwardRef } = await import("react");
  const motionProps = new Set(["initial", "animate", "transition"]);
  const motion = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_target, tag) =>
      forwardRef(function MotionStub(
        props: Record<string, unknown>,
        ref: unknown,
      ) {
        const domProps: Record<string, unknown> = { ref };
        for (const [key, value] of Object.entries(props)) {
          if (!motionProps.has(key) && key !== "children") domProps[key] = value;
        }
        return createElement(String(tag), domProps, props.children as ReactNode);
      }),
  });
  return { motion };
});

import { GachaRevealDialog } from "./GachaRevealDialog";

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;

const NEW_RESULT: GachaDrawResult = {
  characterId: "kuromi",
  isNew: true,
  ownedCount: 1,
  totalDraws: 3,
};

function renderDialog(
  result: GachaDrawResult,
  reduceMotion: boolean,
  onClose = vi.fn(),
): void {
  act(() => {
    root.render(
      <GachaRevealDialog
        isOpen
        result={result}
        reduceMotion={reduceMotion}
        onClose={onClose}
        onOpenCollection={vi.fn()}
        onRestoreFocus={vi.fn()}
      />,
    );
  });
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
  confettiMock.mockReset().mockResolvedValue(undefined);
  playSoundMock.mockReset();
  trigger = document.createElement("button");
  trigger.textContent = "開啟膠囊";
  document.body.appendChild(trigger);
  trigger.focus();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  trigger.remove();
});

describe("GachaRevealDialog", () => {
  it("has an accessible name and restores focus after native close", () => {
    const onClose = vi.fn();
    renderDialog(NEW_RESULT, false, onClose);

    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog?.getAttribute("aria-labelledby")).toBe("gacha-reveal-title");
    expect(container.querySelector("#gacha-reveal-title")?.textContent).toBe(
      "酷洛米",
    );
    expect(container.textContent).toContain("NEW · 圖鑑解鎖");

    act(() => dialog?.close());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it("suppresses confetti when reduced motion is enabled", () => {
    renderDialog(NEW_RESULT, true);

    expect(playSoundMock).toHaveBeenCalledWith("unlock");
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it("labels a duplicate with its encounter count", () => {
    renderDialog(
      { ...NEW_RESULT, isNew: false, ownedCount: 4, totalDraws: 8 },
      false,
    );

    expect(container.textContent).toContain("第 4 次遇見");
    expect(confettiMock).not.toHaveBeenCalled();
  });
});
