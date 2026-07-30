import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CottageToolbar,
  type CottageToolbarAction,
} from "./CottageToolbar";

const TOOLBAR_ACTIONS = [
  "food",
  "bath",
  "toys",
  "shop",
  "decorate",
  "wardrobe",
  "actions",
  "sleep",
  "settings",
] as const satisfies readonly CottageToolbarAction[];

let container: HTMLDivElement;
let root: Root;

function toolbarButton(action: CottageToolbarAction): HTMLButtonElement {
  const element = container.querySelector(`[data-toolbar="${action}"]`);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`toolbar button not found: ${action}`);
  }
  return element;
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

describe("CottageToolbar", () => {
  it("renders all nine stable actions and routes every click once", () => {
    const handlers = {
      food: vi.fn<() => void>(),
      bath: vi.fn<() => void>(),
      toys: vi.fn<() => void>(),
      shop: vi.fn<() => void>(),
      decorate: vi.fn<() => void>(),
      wardrobe: vi.fn<() => void>(),
      actions: vi.fn<() => void>(),
      sleep: vi.fn<() => void>(),
      settings: vi.fn<() => void>(),
    } satisfies Record<CottageToolbarAction, () => void>;

    act(() => {
      root.render(
        <CottageToolbar
          onFood={handlers.food}
          onBath={handlers.bath}
          onToys={handlers.toys}
          onShop={handlers.shop}
          onDecorate={handlers.decorate}
          onWardrobe={handlers.wardrobe}
          onActions={handlers.actions}
          onSleep={handlers.sleep}
          onSettings={handlers.settings}
        />,
      );
    });

    expect(
      [...container.querySelectorAll<HTMLButtonElement>("[data-toolbar]")].map(
        (element) => element.dataset.toolbar,
      ),
    ).toEqual(TOOLBAR_ACTIONS);

    for (const action of TOOLBAR_ACTIONS) {
      act(() => toolbarButton(action).click());
      expect(handlers[action]).toHaveBeenCalledTimes(1);
    }
  });

  it("exposes active, sleeping, and per-action disabled states", () => {
    const noop = vi.fn();
    act(() => {
      root.render(
        <CottageToolbar
          active="decorate"
          sleeping
          disabled={{ wardrobe: true }}
          onFood={noop}
          onBath={noop}
          onToys={noop}
          onShop={noop}
          onDecorate={noop}
          onWardrobe={noop}
          onActions={noop}
          onSleep={noop}
          onSettings={noop}
        />,
      );
    });

    expect(toolbarButton("decorate").getAttribute("aria-pressed")).toBe("true");
    expect(toolbarButton("food").getAttribute("aria-pressed")).toBe("false");
    expect(toolbarButton("wardrobe").disabled).toBe(true);
    expect(toolbarButton("sleep").textContent).toContain("叫醒");
  });
});
