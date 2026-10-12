import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { HEIGHT } from "./constants";

vi.mock("./levels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./levels")>();
  return {
    ...actual,
    buildLevels: () => [{
      ...actual.BASE_LEVELS[0],
      platforms: [], enemies: [], coins: [],
      powerups: [{ x: 98, y: HEIGHT - 116, r: 15, type: "star", taken: false }],
      flag: { x: 3000, y: 200, h: 300 },
    }],
  };
});
vi.mock("./sprites", async (importOriginal) => ({
  ...await importOriginal<typeof import("./sprites")>(),
  drawHero: vi.fn(),
}));
vi.mock("framer-motion", () => ({ useReducedMotion: () => true }));
import MushroomAdventure from "./MushroomAdventure";
import { drawHero } from "./sprites";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("respawns immediately after falling with a star still active", () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const callbacks = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const fillText = vi.fn();
  const context = new Proxy({
    fillText,
    measureText: () => ({ width: 30 }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  }, {
    get: (target, key) => Reflect.get(target, key) ?? (() => {}),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<MushroomAdventure />));
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "直接開始")!.click());
    let time = performance.now();
    const frame = () => act(() => {
      time += 50;
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach(callback => callback(time));
    });
    frame();
    expect(vi.mocked(drawHero).mock.lastCall?.[2]).toBe(true);
    for (let index = 0; index < 13; index++) frame();
    expect(fillText).toHaveBeenCalledWith("❤️❤️", expect.any(Number), expect.any(Number));
    expect(vi.mocked(drawHero).mock.lastCall?.[1].y).toBeLessThan(HEIGHT);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
