import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialPetSave } from "../logic/petState";
import type { PetSaveV1 } from "../types";

vi.mock("framer-motion", async () => {
  const { createElement, forwardRef, Fragment } = await import("react");
  const motion = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_target, tag) =>
      forwardRef(function MotionStub(
        props: Record<string, unknown>,
        ref: unknown,
      ) {
        const domProps = { ...props };
        delete domProps.animate;
        delete domProps.initial;
        delete domProps.exit;
        delete domProps.transition;
        delete domProps.children;
        return createElement(
          String(tag),
          { ...domProps, ref },
          props.children as ReactNode,
        );
      }),
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) =>
      createElement(Fragment, null, children),
  };
});

import { PetAvatar } from "./PetAvatar";
import { CottageScene } from "./CottageScene";
import { RoomWorld } from "./RoomWorld";

const NOW = new Date("2026-07-30T12:00:00+08:00").getTime();

let container: HTMLDivElement;
let root: Root;

function personalizedSave(): PetSaveV1 {
  const initial = createInitialPetSave(NOW, "2026-07-30");
  return {
    ...initial,
    inventory: {
      ...initial.inventory,
      furniture: [...initial.inventory.furniture, "lamp"],
      wallpapers: [...initial.inventory.wallpapers, "starry-night"],
      floors: [...initial.inventory.floors, "cloud-carpet"],
      outfits: ["strawberry-clip", "red-ribbon"],
    },
    equipped: { head: "strawberry-clip", neck: "red-ribbon" },
    room: {
      wallpaperId: "starry-night",
      floorId: "cloud-carpet",
      placed: [
        ...initial.room.placed,
        { id: "lamp", x: 24, y: 72, zone: "floor" },
      ],
    },
  };
}

function placedFurniture(id: string): HTMLElement {
  const element = container.querySelector(`[data-placed-furniture-id="${id}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`placed furniture not found: ${id}`);
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

describe("RoomWorld", () => {
  it("renders selected surfaces and a transient furniture preview without mutating the room", () => {
    const save = personalizedSave();
    act(() => {
      root.render(
        <RoomWorld
          room={save.room}
          previewPlacement={{ id: "lamp", x: 61, y: 67, zone: "floor" }}
        />,
      );
    });

    const world = container.querySelector<HTMLElement>("[data-room-world]");
    expect(world?.dataset.wallpaperId).toBe("starry-night");
    expect(world?.dataset.floorId).toBe("cloud-carpet");
    expect(container.querySelector('[data-room-zone="wall"]')).not.toBeNull();
    expect(container.querySelector('[data-room-zone="floor"]')).not.toBeNull();
    expect(placedFurniture("lamp").style.left).toBe("61%");
    expect(placedFurniture("lamp").style.top).toBe("67%");
    expect(save.room.placed.find((item) => item.id === "lamp")).toMatchObject({
      x: 24,
      y: 72,
    });
    expect(container.querySelector("button[data-placed-furniture-id]")).toBeNull();
  });

  it("exposes editor selection, pointer, and keyboard events with placement context", () => {
    const save = personalizedSave();
    const onSelect = vi.fn();
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();
    const onKeyDown = vi.fn();
    act(() => {
      root.render(
        <RoomWorld
          room={save.room}
          editor
          selectedId="lamp"
          onSelect={onSelect}
          onFurniturePointerDown={onPointerDown}
          onFurniturePointerUp={onPointerUp}
          onFurnitureKeyDown={onKeyDown}
        />,
      );
    });

    const lamp = placedFurniture("lamp");
    expect(lamp).toBeInstanceOf(HTMLButtonElement);
    expect(lamp.getAttribute("aria-pressed")).toBe("true");
    expect(lamp.getAttribute("aria-label")).toContain("移動檯燈");
    expect(lamp.dataset.furnitureZone).toBe("floor");

    act(() => lamp.click());
    act(() => {
      lamp.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      lamp.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
      lamp.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });

    expect(onSelect).toHaveBeenCalledWith("lamp");
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onPointerDown.mock.calls[0]?.[1]).toMatchObject({
      id: "lamp",
      x: 24,
      y: 72,
      zone: "floor",
    });
    expect(onPointerDown.mock.calls[0]?.[2]).toBe(1);
    expect(onKeyDown.mock.calls[0]?.[1]).toMatchObject({ id: "lamp" });
  });
});

describe("PetAvatar outfit layers", () => {
  it("anchors the equipped head and neck layers and omits unequipped layers", () => {
    act(() => {
      root.render(
        <PetAvatar
          equipped={{ head: "strawberry-clip", neck: "red-ribbon" }}
          reducedMotion
        />,
      );
    });

    const avatar = container.querySelector<HTMLElement>("[data-pet-avatar]");
    expect(avatar?.dataset.equippedHead).toBe("strawberry-clip");
    expect(avatar?.dataset.equippedNeck).toBe("red-ribbon");
    expect(
      container.querySelector('[data-outfit-layer="strawberry-clip"]')
        ?.getAttribute("data-outfit-slot"),
    ).toBe("head");
    expect(
      container.querySelector('[data-outfit-layer="red-ribbon"]')
        ?.getAttribute("data-outfit-slot"),
    ).toBe("neck");

    act(() => {
      root.render(<PetAvatar equipped={{}} reducedMotion />);
    });
    expect(container.querySelector("[data-outfit-layer]")).toBeNull();
  });

  it("exposes a distinct animation state for every toy", () => {
    const toyActions = [
      "playBall",
      "playFrisbee",
      "playBubbles",
      "playMusicBox",
      "playSwing",
    ] as const;

    for (const action of toyActions) {
      act(() => {
        root.render(<PetAvatar equipped={{}} action={action} />);
      });
      expect(
        container.querySelector<HTMLElement>("[data-pet-avatar]")?.dataset
          .avatarAction,
      ).toBe(action);
    }
  });
});

describe("CottageScene toy props", () => {
  function renderPlaying(toyId: "ball" | null) {
    act(() => {
      root.render(
        <CottageScene
          room={personalizedSave().room}
          equipped={{}}
          timeOfDay="day"
          action={toyId ? "playBall" : "idle"}
          actionKey={3}
          isSleeping={false}
          speech={null}
          wishLabel="一起玩吧"
          toyId={toyId}
          reducedMotion={false}
          onPet={vi.fn()}
          onWake={vi.fn()}
        />,
      );
    });
  }

  it("draws the toy into the room while she plays with it", () => {
    // Playing used to render only a small emoji over her face, which read as
    // the toy never appearing at all.
    renderPlaying("ball");

    const prop = container.querySelector('[data-toy-prop="ball"]');
    expect(prop).not.toBeNull();
    expect(prop?.textContent).toContain("⚽");
  });

  it("keeps the toy out of the room when she is not playing", () => {
    renderPlaying(null);
    expect(container.querySelector("[data-toy-prop]")).toBeNull();
  });

  it("does not also pin the toy over her face", () => {
    renderPlaying("ball");

    const avatar = container.querySelector("[data-pet-avatar]");
    expect(avatar?.parentElement?.parentElement?.textContent).not.toContain("⚽");
  });
});

describe("CottageScene celebrations", () => {
  it("fills the room with hearts and streamers for the L20 celebration", () => {
    const room = personalizedSave().room;
    act(() => {
      root.render(
        <CottageScene
          room={room}
          equipped={{}}
          timeOfDay="day"
          action="celebrate"
          actionKey={20}
          isSleeping={false}
          speech={null}
          wishLabel="今天的心願完成了"
          reducedMotion={false}
          onPet={vi.fn()}
          onWake={vi.fn()}
        />,
      );
    });

    const celebration = container.querySelector("[data-celebration-effects]");
    expect(celebration).not.toBeNull();
    expect(celebration?.textContent).toContain("💗");
    expect(celebration?.textContent).toContain("🎉");

    act(() => {
      root.render(
        <CottageScene
          room={room}
          equipped={{}}
          timeOfDay="day"
          action="idle"
          actionKey={21}
          isSleeping={false}
          speech={null}
          wishLabel="今天的心願完成了"
          reducedMotion
          onPet={vi.fn()}
          onWake={vi.fn()}
        />,
      );
    });
    expect(container.querySelector("[data-celebration-effects]")).toBeNull();
  });
});
