import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";
import type { CompanionSceneProps } from "./CompanionScene";
import CompanionPage from "./CompanionPage";
import { advanceSpin, releaseSpin, turnSpin } from "./logic/spin";

// jsdom has no WebGL; the 3D scene is replaced by a plain element that
// exposes the props the page hands it.
let sceneProps: CompanionSceneProps | null = null;
vi.mock("./CompanionScene", () => ({
  default: (props: CompanionSceneProps) => {
    sceneProps = props;
    return <div data-scene="" />;
  },
}));

let container: HTMLDivElement;
let root: Root;

function setWebGL(available: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => (available ? ({} as RenderingContext) : null),
  );
}

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!match) throw new Error(`button not found: ${label}`);
  return match;
}

async function renderPage(onExit = vi.fn()) {
  await act(async () => {
    root.render(<CompanionPage onExit={onExit} />);
  });
  return onExit;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  sceneProps = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("CompanionPage", () => {
  it("explains and offers a way back when the device has no WebGL", async () => {
    setWebGL(false);
    const onExit = await renderPage();

    expect(container.textContent).toContain("無法顯示 3D");
    expect(container.querySelector("[data-scene]")).toBeNull();

    act(() => button("返回").click());
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("turns by default, with petting off until asked for", async () => {
    setWebGL(true);
    await renderPage();

    expect(button("轉一轉").getAttribute("aria-pressed")).toBe("true");
    expect(button("摸摸頭").getAttribute("aria-pressed")).toBe("false");
    expect(sceneProps?.runtime.petting).toBe(false);
    expect(container.textContent).toContain("拖曳");
  });

  it("switches to petting with a pat, and pats again on each press", async () => {
    setWebGL(true);
    await renderPage();

    act(() => button("摸摸頭").click());
    expect(button("摸摸頭").getAttribute("aria-pressed")).toBe("true");
    expect(sceneProps?.runtime.petting).toBe(true);
    expect(sceneProps?.runtime.pet.phase).toBe("petting");

    const patUntil = sceneProps?.runtime.pet.patUntil ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 5));
    act(() => button("摸摸頭").click());
    expect(sceneProps?.runtime.pet.patUntil ?? 0).toBeGreaterThan(patUntil);
  });

  it("goes back to turning from petting", async () => {
    setWebGL(true);
    await renderPage();
    act(() => button("摸摸頭").click());

    act(() => button("轉一轉").click());

    expect(button("轉一轉").getAttribute("aria-pressed")).toBe("true");
    expect(sceneProps?.runtime.petting).toBe(false);
  });

  it("puts the model back upright and facing front with 回正", async () => {
    setWebGL(true);
    await renderPage();
    const runtime = sceneProps!.runtime;
    runtime.spin = releaseSpin(turnSpin(runtime.spin, 1.2, 0.8, 0), 500);

    act(() => button("回正").click());
    for (let i = 0; i < 120; i += 1) runtime.spin = advanceSpin(runtime.spin, 1 / 60);

    const front = new Vector3(0, 0, 1).applyQuaternion(runtime.spin.orientation);
    expect(front.z).toBeCloseTo(1, 5);
  });

  it("keeps the model credit off the play screen until asked for", async () => {
    setWebGL(true);
    await renderPage();
    expect(container.textContent).not.toContain("fukkacumy");

    act(() => button("模型出處").click());

    const links = [...container.querySelectorAll("a")];
    const source = links.find((a) => a.href.includes("sketchfab.com/3d-models/cinnamoroll-eae98497b99f47b8897c4ffd06521e31"));
    const author = links.find((a) => a.href.includes("sketchfab.com/kraevaya201"));
    const licence = links.find((a) => a.href.includes("creativecommons.org/licenses/by/4.0"));

    expect(source?.textContent).toContain("Cinnamoroll");
    expect(author?.textContent).toContain("fukkacumy");
    expect(licence?.textContent).toContain("CC BY 4.0");
  });

  it("keeps the loading message up until the scene has drawn", async () => {
    setWebGL(true);
    await renderPage();
    expect(container.textContent).toContain("大耳狗準備中");

    act(() => sceneProps?.onReady());

    expect(container.textContent).not.toContain("大耳狗準備中");
  });

  it("offers to reload the scene after the GPU context is lost", async () => {
    setWebGL(true);
    await renderPage();

    act(() => sceneProps?.onContextLost());
    expect(container.querySelector("[data-scene]")).toBeNull();

    await act(async () => button("重新載入").click());
    expect(container.querySelector("[data-scene]")).not.toBeNull();
  });
});
