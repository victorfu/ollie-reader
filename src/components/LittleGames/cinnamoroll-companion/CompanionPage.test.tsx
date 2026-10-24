import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionSceneProps } from "./CompanionScene";
import CompanionPage from "./CompanionPage";

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

  it("hides the petting hint after the first pat from the button", async () => {
    setWebGL(true);
    await renderPage();
    expect(container.textContent).toContain("摸摸我的頭吧");

    act(() => button("摸摸頭").click());

    expect(container.textContent).not.toContain("摸摸我的頭吧");
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
