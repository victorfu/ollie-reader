import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fitFloatingPanelToViewport,
  useFloatingPanel,
} from "./useFloatingPanel";

function pointerEvent(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
}

describe("fitFloatingPanelToViewport", () => {
  it("leaves an in-bounds desktop panel in its existing position", () => {
    expect(
      fitFloatingPanelToViewport({
        position: { x: 900, y: 240 },
        size: { width: 320, height: 520 },
        minSize: { width: 240, height: 200 },
        maxSize: { width: 600, height: 760 },
        viewport: { width: 1440, height: 900 },
      }),
    ).toEqual({
      position: { x: 900, y: 240 },
      size: { width: 320, height: 520 },
    });
  });

  it("shrinks and repositions a panel so its controls remain reachable", () => {
    expect(
      fitFloatingPanelToViewport({
        position: { x: 1000, y: 700 },
        size: { width: 560, height: 760 },
        minSize: { width: 260, height: 240 },
        maxSize: { width: 560, height: 760 },
        viewport: { width: 375, height: 320 },
      }),
    ).toEqual({
      position: { x: 12, y: 12 },
      size: { width: 351, height: 296 },
    });
  });
});

describe("useFloatingPanel viewport changes", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 900,
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value() {},
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("clamps the live panel on resize and orientation change", () => {
    function Harness() {
      const { panelStyle } = useFloatingPanel({
        defaultPosition: { x: 1000, y: 300 },
        defaultSize: { width: 320, height: 520 },
        minSize: { width: 240, height: 200 },
        maxSize: { width: 600, height: 760 },
      });
      return <div data-testid="panel" style={panelStyle} />;
    }

    act(() => root.render(<Harness />));
    const panel = container.querySelector<HTMLElement>('[data-testid="panel"]');
    expect(panel?.style.left).toBe("1000px");
    expect(panel?.style.top).toBe("300px");

    act(() => {
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event("resize"));
    });
    expect(panel?.style.left).toBe("43px");
    expect(panel?.style.top).toBe("135px");
    expect(panel?.style.width).toBe("320px");
    expect(panel?.style.height).toBe("520px");

    act(() => {
      window.innerWidth = 667;
      window.innerHeight = 375;
      window.dispatchEvent(new Event("orientationchange"));
    });
    expect(panel?.style.left).toBe("43px");
    expect(panel?.style.top).toBe("12px");
    expect(panel?.style.height).toBe("351px");
  });

  it("keeps drag ownership with one pointer and stops on pointercancel", () => {
    function Harness() {
      const { panelStyle, dragHandleProps, isDragging } = useFloatingPanel({
        defaultPosition: { x: 100, y: 100 },
        defaultSize: { width: 320, height: 300 },
      });
      return (
        <div data-testid="panel" style={panelStyle}>
          <button data-testid="drag" {...dragHandleProps}>
            {isDragging ? "dragging" : "idle"}
          </button>
        </div>
      );
    }

    act(() => root.render(<Harness />));
    const panel = container.querySelector<HTMLElement>('[data-testid="panel"]');
    const drag = container.querySelector<HTMLElement>('[data-testid="drag"]');

    act(() => {
      drag?.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
      drag?.dispatchEvent(pointerEvent("pointerdown", 2, 100, 100));
      window.dispatchEvent(pointerEvent("pointermove", 2, 500, 500));
      window.dispatchEvent(pointerEvent("pointerup", 2, 500, 500));
    });
    expect(panel?.style.left).toBe("100px");
    expect(drag?.textContent).toBe("dragging");

    act(() => {
      window.dispatchEvent(pointerEvent("pointermove", 1, 160, 170));
    });
    expect(panel?.style.left).toBe("160px");
    expect(panel?.style.top).toBe("170px");

    act(() => {
      window.dispatchEvent(pointerEvent("pointercancel", 1, 160, 170));
      window.dispatchEvent(pointerEvent("pointermove", 1, 400, 400));
    });
    expect(drag?.textContent).toBe("idle");
    expect(panel?.style.left).toBe("160px");
    expect(panel?.style.top).toBe("170px");
  });

  it("lets controls inside the drag handle receive their own clicks", () => {
    const captured: string[] = [];
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value(this: HTMLElement) {
        captured.push(this.dataset.testid ?? "unknown");
      },
    });

    let clicks = 0;
    function Harness() {
      const { panelStyle, dragHandleProps, isDragging } = useFloatingPanel({
        defaultPosition: { x: 100, y: 100 },
        defaultSize: { width: 320, height: 300 },
      });
      return (
        <div data-testid="panel" style={panelStyle}>
          <div data-testid="header" {...dragHandleProps}>
            <span data-testid="state">{isDragging ? "dragging" : "idle"}</span>
            <button data-testid="clear" onClick={() => clicks++}>
              清除
            </button>
          </div>
        </div>
      );
    }

    act(() => root.render(<Harness />));
    const panel = container.querySelector<HTMLElement>('[data-testid="panel"]');
    const header = container.querySelector<HTMLElement>('[data-testid="header"]');
    const state = container.querySelector<HTMLElement>('[data-testid="state"]');
    const clear = container.querySelector<HTMLElement>('[data-testid="clear"]');

    // Pressing a header control must not start a drag: capturing the pointer on
    // the header retargets the follow-up click away from the button.
    const press = pointerEvent("pointerdown", 3, 100, 100);
    act(() => {
      clear?.dispatchEvent(press);
    });
    expect(captured).toEqual([]);
    expect(press.defaultPrevented).toBe(false);
    expect(state?.textContent).toBe("idle");

    act(() => {
      clear?.click();
    });
    expect(clicks).toBe(1);

    // Dragging by the header background still works.
    act(() => {
      header?.dispatchEvent(pointerEvent("pointerdown", 4, 100, 100));
      window.dispatchEvent(pointerEvent("pointermove", 4, 160, 170));
    });
    expect(captured).toEqual(["header"]);
    expect(state?.textContent).toBe("dragging");
    expect(panel?.style.left).toBe("160px");
    expect(panel?.style.top).toBe("170px");

    act(() => {
      window.dispatchEvent(pointerEvent("pointerup", 4, 160, 170));
    });
  });

  it("stops resizing on lost pointer capture and ignores other pointers", () => {
    function Harness() {
      const { panelStyle, resizeHandleProps, isResizing } = useFloatingPanel({
        defaultPosition: { x: 100, y: 100 },
        defaultSize: { width: 320, height: 300 },
      });
      return (
        <div data-testid="panel" style={panelStyle}>
          <button data-testid="resize" {...resizeHandleProps}>
            {isResizing ? "resizing" : "idle"}
          </button>
        </div>
      );
    }

    act(() => root.render(<Harness />));
    const panel = container.querySelector<HTMLElement>('[data-testid="panel"]');
    const resize = container.querySelector<HTMLElement>('[data-testid="resize"]');

    act(() => {
      resize?.dispatchEvent(pointerEvent("pointerdown", 7, 0, 0));
      window.dispatchEvent(pointerEvent("pointermove", 8, 100, 100));
    });
    expect(panel?.style.width).toBe("320px");
    expect(resize?.textContent).toBe("resizing");

    act(() => {
      window.dispatchEvent(pointerEvent("pointermove", 7, 40, 50));
    });
    expect(panel?.style.width).toBe("360px");
    expect(panel?.style.height).toBe("350px");

    act(() => {
      resize?.dispatchEvent(pointerEvent("lostpointercapture", 7, 40, 50));
      window.dispatchEvent(pointerEvent("pointermove", 7, 100, 100));
    });
    expect(resize?.textContent).toBe("idle");
    expect(panel?.style.width).toBe("360px");
    expect(panel?.style.height).toBe("350px");
  });
});
