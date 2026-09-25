import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CropCanvas } from "./CropCanvas";

let container: HTMLDivElement;
let root: Root;

type Props = ComponentProps<typeof CropCanvas>;

function renderCanvas(overrides: Partial<Props> = {}): Props {
  const props: Props = {
    imageUrl: "https://signed/p0",
    imageAlt: "第 1 頁",
    mode: "question",
    questionBoxes: [],
    maskBoxes: [],
    selectedKey: null,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
  act(() => root.render(<CropCanvas {...props} />));
  const overlay = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!overlay) throw new Error("overlay missing");
  overlay.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return props;
}

function pointer(type: string, target: Element, clientX: number, clientY: number): void {
  const EventType = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  act(() => {
    target.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

function overlay(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!element) throw new Error("overlay missing");
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

describe("CropCanvas", () => {
  it("creates a normalized box from a drag on empty space", () => {
    const props = renderCanvas();
    pointer("pointerdown", overlay(), 20, 10);
    pointer("pointermove", overlay(), 120, 60);
    pointer("pointerup", overlay(), 120, 60);

    expect(props.onSelect).toHaveBeenCalledWith(null);
    expect(props.onCreate).toHaveBeenCalledTimes(1);
    const [box] = (props.onCreate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(box.x).toBeCloseTo(0.1);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.5);
    expect(box.h).toBeCloseTo(0.5);
  });

  it("ignores a tiny accidental drag", () => {
    const props = renderCanvas();
    pointer("pointerdown", overlay(), 20, 10);
    pointer("pointerup", overlay(), 21, 10);
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("selects and moves an existing box", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, label: "1" }],
    });
    const boxElement = container.querySelector('[data-box-key="q:a:0"]');
    if (!boxElement) throw new Error("box missing");

    pointer("pointerdown", boxElement, 40, 20);
    pointer("pointermove", overlay(), 60, 30);
    pointer("pointerup", overlay(), 60, 30);

    expect(props.onSelect).toHaveBeenCalledWith("q:a:0");
    expect(props.onCreate).not.toHaveBeenCalled();
    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.x).toBeCloseTo(0.2);
    expect(box.y).toBeCloseTo(0.2);
    expect(box.w).toBeCloseTo(0.2);
  });

  it("does not report a change for a click without movement", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    const boxElement = container.querySelector('[data-box-key="q:a:0"]');
    if (!boxElement) throw new Error("box missing");
    pointer("pointerdown", boxElement, 40, 20);
    pointer("pointerup", overlay(), 40, 20);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("resizes the selected box from a corner handle", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    const handle = container.querySelector('[data-box-key="q:a:0"] [data-corner="se"]');
    if (!handle) throw new Error("handle missing");

    pointer("pointerdown", handle, 60, 30);
    pointer("pointermove", overlay(), 100, 80);
    pointer("pointerup", overlay(), 100, 80);

    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.x).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.4);
    expect(box.h).toBeCloseTo(0.7);
  });

  it("only lets the current mode's boxes be grabbed", () => {
    const props = renderCanvas({
      mode: "mask",
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    expect(container.querySelector('[data-box-key="q:a:0"]')).toBeNull();
    pointer("pointerdown", overlay(), 40, 20);
    pointer("pointermove", overlay(), 80, 60);
    pointer("pointerup", overlay(), 80, 60);
    expect(props.onCreate).toHaveBeenCalledTimes(1);
  });
});
