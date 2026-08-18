import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSceneDirector, type SceneDirector } from "./useSceneDirector";

let container: HTMLDivElement;
let root: Root;
let director: SceneDirector;

function Harness() {
  const next = useSceneDirector();
  useLayoutEffect(() => {
    director = next;
  }, [next]);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("useSceneDirector", () => {
  it("starts idle with no emoji", () => {
    expect(director.action).toBe("idle");
    expect(director.emoji).toBeUndefined();
  });

  it("plays a request and decays back to idle", () => {
    act(() => director.play({ action: "feed", emoji: "🍎" }));
    expect(director.action).toBe("feed");
    expect(director.emoji).toBe("🍎");

    advance(1_449);
    expect(director.action).toBe("feed");

    advance(1);
    expect(director.action).toBe("idle");
    expect(director.emoji).toBeUndefined();
  });

  it("keeps a toy on screen for the whole play animation", () => {
    // The reported bug: the toy vanished because a queued reaction overwrote
    // the play request in the same tick it was made.
    act(() => {
      director.play({ action: "playBall", emoji: "⚽" });
      director.enqueue({ action: "celebrate" });
    });

    expect(director.action).toBe("playBall");
    expect(director.emoji).toBe("⚽");

    advance(1_899);
    expect(director.action).toBe("playBall");
    expect(director.emoji).toBe("⚽");

    advance(1);
    expect(director.action).toBe("celebrate");
  });

  it("runs queued reactions in order, one full turn each", () => {
    act(() => {
      director.play({ action: "feed" });
      director.enqueue({ action: "celebrate" });
      director.enqueue({ action: "heartBurst" });
    });

    expect(director.action).toBe("feed");
    advance(1_450);
    expect(director.action).toBe("celebrate");
    advance(2_650);
    expect(director.action).toBe("heartBurst");
    advance(2_200);
    expect(director.action).toBe("idle");
  });

  it("holds a persisted request indefinitely", () => {
    act(() => director.play({ action: "sleep", persist: true }));
    advance(60 * 60 * 1_000);
    expect(director.action).toBe("sleep");
  });

  it("lets reactions interrupt a persisted request, then restores it", () => {
    act(() => {
      director.play({ action: "sleep", persist: true });
      director.enqueue({ action: "celebrate" });
    });

    expect(director.action).toBe("sleep");
    advance(1_450);
    expect(director.action).toBe("celebrate");

    advance(2_650);
    expect(director.action).toBe("sleep");
    // Still persisted, so it holds again rather than decaying.
    advance(60 * 60 * 1_000);
    expect(director.action).toBe("sleep");
  });

  it("drops stale queued reactions when the player acts again", () => {
    act(() => {
      director.play({ action: "feed" });
      director.enqueue({ action: "celebrate" });
    });
    act(() => director.play({ action: "bath", emoji: "🫧" }));

    expect(director.action).toBe("bath");
    advance(2_650);
    expect(director.action).toBe("idle");
  });

  it("replays the same action with a fresh key", () => {
    act(() => director.play({ action: "pet" }));
    const first = director.actionKey;
    act(() => director.play({ action: "pet" }));

    expect(director.action).toBe("pet");
    expect(director.actionKey).toBeGreaterThan(first);
  });

  it("enqueues straight to the scene when nothing is playing", () => {
    act(() => director.enqueue({ action: "celebrate" }));
    expect(director.action).toBe("celebrate");
  });

  it("clears everything on reset", () => {
    act(() => {
      director.play({ action: "sleep", persist: true });
      director.enqueue({ action: "celebrate" });
    });
    act(() => director.reset());

    expect(director.action).toBe("idle");
    advance(10_000);
    expect(director.action).toBe("idle");
  });
});
