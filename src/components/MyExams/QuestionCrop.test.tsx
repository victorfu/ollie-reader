import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePage } from "../../testing/questionBankFixtures";
import { QuestionCrop } from "./QuestionCrop";

let container: HTMLDivElement;
let root: Root;

const page = makePage({
  storagePath: "p0.jpg",
  width: 1000,
  height: 2000,
  masks: [{ x: 0.3, y: 0.55, w: 0.1, h: 0.05 }],
});
const region = { pageIndex: 0, box: { x: 0.25, y: 0.5, w: 0.5, h: 0.25 } };
const urls = { "p0.jpg": "https://signed/p0" };

function render(ui: ReactElement): void {
  act(() => root.render(ui));
}

function image(): HTMLImageElement {
  const element = container.querySelector("img");
  if (!(element instanceof HTMLImageElement)) throw new Error("image not rendered");
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

describe("QuestionCrop", () => {
  it("positions the full page image so only the box is visible", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="lazy" layout={{ kind: "fill" }} />);
    const img = image();
    expect(img.getAttribute("src")).toBe("https://signed/p0");
    expect(img.style.width).toBe("200%");
    expect(img.style.height).toBe("400%");
    expect(img.style.left).toBe("-50%");
    expect(img.style.top).toBe("-200%");
    // Tailwind preflight 的 max-width: 100% 會壓扁 200% 寬的圖
    expect(img.className).toContain("max-w-none");
  });

  it("draws masks as white SVG rects so they print without background graphics", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="lazy" layout={{ kind: "fill" }} />);
    const rect = container.querySelector("svg rect");
    expect(rect?.getAttribute("fill")).toBe("white");
    expect(rect?.getAttribute("x")).toBe("0.3");
    expect(rect?.getAttribute("width")).toBe("0.1");
  });

  it("passes the loading strategy through", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="eager" layout={{ kind: "fill" }} />);
    expect(image().getAttribute("loading")).toBe("eager");
  });

  it("sizes print regions as a percentage of the content column", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="eager" layout={{ kind: "print", scale: 1 }} />);
    const wrapper = container.querySelector<HTMLElement>('[data-testid="question-crop-region"]');
    expect(wrapper?.style.width).toBe("50%");
  });

  it("stacks multiple regions and reports each loaded image", () => {
    const onImageLoad = vi.fn();
    render(
      <QuestionCrop
        regions={[region, { pageIndex: 0, box: { x: 0, y: 0, w: 1, h: 0.1 } }]}
        pages={[page]}
        urls={urls}
        loading="eager"
        layout={{ kind: "fill" }}
        onImageLoad={onImageLoad}
      />,
    );
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    act(() => {
      images[1].dispatchEvent(new Event("load"));
    });
    expect(onImageLoad).toHaveBeenCalledWith(1);
  });

  it("shows a placeholder until the signed URL arrives", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={{}} loading="lazy" layout={{ kind: "fill" }} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("offers a retry after the image fails to load", () => {
    const onRetry = vi.fn();
    render(
      <QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="lazy" layout={{ kind: "fill" }} onRetry={onRetry} />,
    );
    act(() => {
      image().dispatchEvent(new Event("error"));
    });
    expect(container.textContent).toContain("圖片載入失敗");

    const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "重試");
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledWith("p0.jpg");
    expect(container.querySelector("img")).not.toBeNull();
  });
});
