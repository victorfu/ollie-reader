import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialPetSave } from "../logic/petState";
import type { PersonalizationAction } from "../logic/personalization";
import type { PetSaveV1 } from "../types";

vi.mock("framer-motion", async () => {
  const { createElement, forwardRef } = await import("react");
  const motion = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_target, tag) =>
      forwardRef(function MotionStub(
        props: Record<string, unknown>,
        ref: unknown,
      ) {
        const domProps = { ...props };
        delete domProps.animate;
        delete domProps.transition;
        delete domProps.children;
        return createElement(
          String(tag),
          { ...domProps, ref },
          props.children as ReactNode,
        );
      }),
  });
  return { motion, useReducedMotion: () => true };
});

import { Wardrobe } from "./Wardrobe";

const NOW = new Date("2026-07-30T12:00:00+08:00").getTime();

let container: HTMLDivElement;
let root: Root;

function wardrobeSave(): PetSaveV1 {
  const initial = createInitialPetSave(NOW, "2026-07-30");
  return {
    ...initial,
    inventory: {
      ...initial.inventory,
      outfits: ["strawberry-clip", "red-ribbon"],
    },
    equipped: { neck: "red-ribbon" },
  };
}

function outfitRadio(outfitId: string, slot: "head" | "neck"): HTMLInputElement {
  const element = container.querySelector(
    `input[data-outfit-id="${outfitId}"][data-slot="${slot}"]`,
  );
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`outfit radio not found: ${slot}/${outfitId}`);
  }
  return element;
}

function saveButton(): HTMLButtonElement {
  const element = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes("儲存 Save"),
  );
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error("wardrobe save button not found");
  }
  return element;
}

function avatar(): HTMLElement {
  const element = container.querySelector("[data-pet-avatar]");
  if (!(element instanceof HTMLElement)) {
    throw new Error("wardrobe avatar not found");
  }
  return element;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  window.cancelAnimationFrame = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Wardrobe", () => {
  it("shows owned outfits only, previews immediately, and emits minimal slot actions", async () => {
    const onSave = vi.fn<(actions: PersonalizationAction[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    const onPreviewChange = vi.fn();
    act(() => {
      root.render(
        <Wardrobe
          save={wardrobeSave()}
          busy={false}
          onCancel={vi.fn()}
          onPreviewChange={onPreviewChange}
          onSave={onSave}
        />,
      );
    });

    expect(outfitRadio("strawberry-clip", "head")).toBeDefined();
    expect(outfitRadio("red-ribbon", "neck")).toBeDefined();
    expect(
      container.querySelector('input[data-outfit-id="sailor-hat"]'),
    ).toBeNull();
    expect(
      container.querySelector('input[data-outfit-id="blue-scarf"]'),
    ).toBeNull();

    expect(avatar().dataset.equippedHead).toBe("");
    expect(avatar().dataset.equippedNeck).toBe("red-ribbon");
    expect(onPreviewChange).toHaveBeenLastCalledWith({ neck: "red-ribbon" });

    act(() => outfitRadio("strawberry-clip", "head").click());
    expect(avatar().dataset.equippedHead).toBe("strawberry-clip");
    expect(avatar().dataset.equippedNeck).toBe("red-ribbon");
    expect(container.textContent).toContain("頭飾 Head · 草莓髮夾");

    act(() => outfitRadio("none", "neck").click());
    expect(avatar().dataset.equippedHead).toBe("strawberry-clip");
    expect(avatar().dataset.equippedNeck).toBe("");
    expect(container.textContent).toContain("頸飾 Neck · 不戴頸飾");
    expect(onPreviewChange).toHaveBeenLastCalledWith({
      head: "strawberry-clip",
    });
    expect(saveButton().disabled).toBe(false);

    await act(async () => {
      saveButton().click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith([
      { type: "equip-outfit", outfitId: "strawberry-clip" },
      { type: "unequip-outfit", slot: "neck" },
    ]);
    expect(saveButton().disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "穿搭已儲存",
    );
  });

  it("does not emit an action when the player saves an unchanged outfit", () => {
    const onSave = vi.fn<(actions: PersonalizationAction[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    act(() => {
      root.render(
        <Wardrobe
          save={wardrobeSave()}
          busy={false}
          onCancel={vi.fn()}
          onSave={onSave}
        />,
      );
    });

    expect(saveButton().disabled).toBe(true);
    act(() => saveButton().click());
    expect(onSave).not.toHaveBeenCalled();
  });
});
