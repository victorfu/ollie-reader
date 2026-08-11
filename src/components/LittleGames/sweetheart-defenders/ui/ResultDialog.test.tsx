import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultDialog } from "./ResultDialog";

const outcome = {
  phase: "cleared" as const,
  cakes: 10,
  maxCakes: 10,
  kills: 5,
  waveIndex: 0,
};

describe("ResultDialog settlement controls", () => {
  let host: HTMLDivElement;
  let root: Root;
  const onRetry = vi.fn();
  const onExit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function render(isSettling: boolean, coinsEarned = 0) {
    act(() => root.render(
      <ResultDialog
        outcome={outcome}
        coinsEarned={coinsEarned}
        isSettling={isSettling}
        settlementError={null}
        totalWaves={1}
        onRetry={onRetry}
        onExit={onExit}
      />,
    ));
  }

  it("shows settlement progress and locks every run-changing action", () => {
    render(true);

    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "結算中",
    );
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    act(() => buttons.forEach((button) => button.click()));
    expect(onRetry).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  it("unlocks after settlement and displays the committed reward", () => {
    render(true);
    render(false, 25);

    expect(host.textContent).toContain("+25 扭蛋代幣");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    act(() => buttons[0].click());
    act(() => buttons[1].click());
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });
});
