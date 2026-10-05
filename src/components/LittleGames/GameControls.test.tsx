import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameControls } from "./GameControls";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const onChange = vi.fn();
beforeEach(() => {
  onChange.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  act(() => root.render(<GameControls onChange={onChange} jump />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
function pointer(label: string, type: string, pointerId: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId, button: 0 });
  act(() => container.querySelector(`[aria-label="${label}"]`)!.dispatchEvent(event));
}
function key(type: string, key: string) {
  act(() => window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true })));
}
it("supports simultaneous direction and jump, releasing each pointer separately", () => {
  pointer("向右", "pointerdown", 1);
  pointer("跳躍", "pointerdown", 2);
  expect(onChange.mock.calls).toEqual([["right", true], ["jump", true]]);
  pointer("向右", "pointerup", 1);
  pointer("跳躍", "pointercancel", 2);
  expect(onChange.mock.calls.slice(2)).toEqual([["right", false], ["jump", false]]);
});
it("retains held keyboard input when a touch or alternate key releases", () => {
  key("keydown", "ArrowLeft");
  key("keydown", "a");
  pointer("向左", "pointerdown", 3);
  key("keyup", "a");
  pointer("向左", "lostpointercapture", 3);
  expect(onChange.mock.calls).toEqual([["left", true]]);
  key("keyup", "ArrowLeft");
  expect(onChange).toHaveBeenLastCalledWith("left", false);
});
it("releases input on blur and when controls unmount for pause or exit", () => {
  pointer("向右", "pointerdown", 1);
  act(() => window.dispatchEvent(new Event("blur")));
  expect(onChange).toHaveBeenLastCalledWith("right", false);
  pointer("跳躍", "pointerdown", 2);
  act(() => root.render(null));
  expect(onChange).toHaveBeenLastCalledWith("jump", false);
  key("keydown", "ArrowLeft");
  expect(onChange).toHaveBeenCalledTimes(4);
});
it("does not queue repeated jumps for held keyboard keys", () => {
  key("keydown", " ");
  key("keydown", " ");
  expect(onChange.mock.calls).toEqual([["jump", true]]);
  key("keyup", " ");
  key("keydown", "w");
  expect(onChange.mock.calls).toEqual([["jump", true], ["jump", false], ["jump", true]]);
});
