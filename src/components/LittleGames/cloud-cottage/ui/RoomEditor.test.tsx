import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialPetSave } from "../logic/petState";
import {
  applyPersonalizationAction,
  type PersonalizationAction,
} from "../logic/personalization";
import type { PetSaveV1 } from "../types";
import { RoomEditor } from "./RoomEditor";

const NOW = new Date("2026-07-30T12:00:00+08:00").getTime();

let container: HTMLDivElement;
let root: Root;

function editorSave(): PetSaveV1 {
  const initial = createInitialPetSave(NOW, "2026-07-30");
  return {
    ...initial,
    inventory: {
      ...initial.inventory,
      furniture: [...initial.inventory.furniture, "lamp"],
      wallpapers: [...initial.inventory.wallpapers, "starry-night"],
      floors: [...initial.inventory.floors, "cloud-carpet"],
    },
  };
}

function zOrderSave(): PetSaveV1 {
  const initial = editorSave();
  return {
    ...initial,
    inventory: {
      ...initial.inventory,
      furniture: [...initial.inventory.furniture, "plant"],
    },
    room: {
      ...initial.room,
      placed: [
        { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
        { id: "lamp", x: 34, y: 72, zone: "floor" },
        { id: "plant", x: 62, y: 72, zone: "floor" },
      ],
    },
  };
}

function button(selector: string): HTMLButtonElement {
  const element = container.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`button not found: ${selector}`);
  }
  return element;
}

function buttonWithText(text: string): HTMLButtonElement {
  const element = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`button not found by text: ${text}`);
  }
  return element;
}

function placedFurniture(id: string): HTMLButtonElement {
  return button(`button[data-placed-furniture-id="${id}"]`);
}

function renderEditor(
  save: PetSaveV1,
  onSave: (actions: PersonalizationAction[]) => Promise<void> = vi.fn(),
  onPreviewChange?: (room: PetSaveV1["room"] | null) => void,
): void {
  act(() => {
    root.render(
      <RoomEditor
        save={save}
        busy={false}
        onCancel={vi.fn()}
        onPreviewChange={onPreviewChange}
        onSave={onSave}
      />,
    );
  });
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

describe("RoomEditor inventory and safety", () => {
  it("shows owned surfaces and furniture only and never removes the cloud bed", () => {
    const onSave = vi.fn<(actions: PersonalizationAction[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    renderEditor(editorSave(), onSave);

    expect(
      [...container.querySelectorAll<HTMLButtonElement>("[data-room-add-id]")]
        .map((element) => element.dataset.roomAddId),
    ).toEqual(["cloud-bed", "lamp"]);
    expect(container.querySelector('[data-room-add-id="plant"]')).toBeNull();

    act(() => button('[data-room-add-id="cloud-bed"]').click());
    const removeBed = button('[aria-label="雲朵床不能收起"]');
    expect(removeBed.disabled).toBe(true);
    act(() => {
      placedFurniture("cloud-bed").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
      );
    });
    expect(placedFurniture("cloud-bed")).toBeDefined();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "雲朵床是小屋的重要家具",
    );
    expect(onSave).not.toHaveBeenCalled();

    act(() => buttonWithText("壁紙").click());
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button[data-wallpaper-id]")]
        .map((element) => element.dataset.wallpaperId),
    ).toEqual(["cloud-blue", "starry-night"]);
    expect(container.querySelector('button[data-wallpaper-id="forest"]')).toBeNull();

    act(() => buttonWithText("地板").click());
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button[data-floor-id]")]
        .map((element) => element.dataset.floorId),
    ).toEqual(["cream-wood", "cloud-carpet"]);
    expect(container.querySelector('button[data-floor-id="frosting-check"]')).toBeNull();
  });
});

describe("RoomEditor action round trip", () => {
  it("compacts add and keyboard movement, saves surfaces, and reopens identically", async () => {
    const original = editorSave();
    let committed = original;
    const onSave = vi.fn(async (actions: PersonalizationAction[]) => {
      for (const action of actions) {
        committed = applyPersonalizationAction(committed, action, NOW).save;
      }
    });
    const onPreviewChange = vi.fn();
    renderEditor(original, onSave, onPreviewChange);

    expect(onPreviewChange).toHaveBeenLastCalledWith(original.room);

    act(() => button('[data-room-add-id="lamp"]').click());
    expect(placedFurniture("lamp").style.left).toBe("50%");
    expect(placedFurniture("lamp").style.top).toBe("72%");

    act(() => {
      placedFurniture("lamp").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(placedFurniture("lamp").style.left).toBe("51%");
    act(() => {
      placedFurniture("lamp").dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowUp",
          shiftKey: true,
          bubbles: true,
        }),
      );
    });
    expect(placedFurniture("lamp").style.top).toBe("67%");

    act(() => buttonWithText("壁紙").click());
    act(() => button('button[data-wallpaper-id="starry-night"]').click());
    expect(
      container.querySelector<HTMLElement>("[data-room-world]")?.dataset.wallpaperId,
    ).toBe("starry-night");

    act(() => buttonWithText("地板").click());
    act(() => button('button[data-floor-id="cloud-carpet"]').click());
    expect(
      container.querySelector<HTMLElement>("[data-room-world]")?.dataset.floorId,
    ).toBe("cloud-carpet");
    expect(onPreviewChange).toHaveBeenLastCalledWith({
      wallpaperId: "starry-night",
      floorId: "cloud-carpet",
      placed: [
        { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
        { id: "lamp", x: 51, y: 67, zone: "floor" },
      ],
    });

    await act(async () => {
      buttonWithText("儲存").click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith([
      {
        type: "add-furniture",
        furnitureId: "lamp",
        x: 51,
        y: 67,
        zone: "floor",
      },
      { type: "select-wallpaper", wallpaperId: "starry-night" },
      { type: "select-floor", floorId: "cloud-carpet" },
    ]);
    expect(committed.room).toEqual({
      wallpaperId: "starry-night",
      floorId: "cloud-carpet",
      placed: [
        { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
        { id: "lamp", x: 51, y: 67, zone: "floor" },
      ],
    });

    act(() => root.unmount());
    root = createRoot(container);
    renderEditor(committed);
    expect(
      container.querySelector<HTMLElement>("[data-room-world]")?.dataset.wallpaperId,
    ).toBe("starry-night");
    expect(
      container.querySelector<HTMLElement>("[data-room-world]")?.dataset.floorId,
    ).toBe("cloud-carpet");
    expect(placedFurniture("lamp").style.left).toBe("51%");
    expect(placedFurniture("lamp").style.top).toBe("67%");
  });

  it("preserves changed z-order when a moved item returns to its original coordinates", async () => {
    const original = zOrderSave();
    let committed = original;
    const onSave = vi.fn(async (actions: PersonalizationAction[]) => {
      for (const action of actions) {
        committed = applyPersonalizationAction(committed, action, NOW).save;
      }
    });
    renderEditor(original, onSave);

    act(() => {
      placedFurniture("lamp").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(placedFurniture("lamp").style.left).toBe("35%");
    act(() => {
      placedFurniture("lamp").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    });

    expect(placedFurniture("lamp").style.left).toBe("34%");
    expect(
      [...container.querySelectorAll<HTMLButtonElement>(
        "button[data-placed-furniture-id]",
      )].map((element) => element.dataset.placedFurnitureId),
    ).toEqual(["cloud-bed", "plant", "lamp"]);

    await act(async () => {
      buttonWithText("儲存").click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith([
      {
        type: "move-furniture",
        furnitureId: "lamp",
        x: 34.01,
        y: 72,
        zone: "floor",
      },
      {
        type: "move-furniture",
        furnitureId: "lamp",
        x: 34,
        y: 72,
        zone: "floor",
      },
    ]);
    expect(committed.room.placed).toEqual([
      { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
      { id: "plant", x: 62, y: 72, zone: "floor" },
      { id: "lamp", x: 34, y: 72, zone: "floor" },
    ]);
    expect(buttonWithText("儲存").disabled).toBe(true);
  });
});
