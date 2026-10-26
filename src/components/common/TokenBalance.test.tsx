import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: { uid: "player-1" } as { uid: string } | null }));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => auth }));

const subscription = vi.hoisted(() => ({
  onBalance: null as ((balance: number) => void) | null,
  unsubscribe: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("../../services/gameProgressService", () => ({
  subscribeTokenBalance: subscription.subscribe,
}));

import { TokenBalance } from "./TokenBalance";

let host: HTMLDivElement;
let root: Root;

function render() {
  act(() =>
    root.render(
      <MemoryRouter>
        <TokenBalance />
      </MemoryRouter>,
    ),
  );
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  auth.user = { uid: "player-1" };
  subscription.unsubscribe.mockReset();
  subscription.subscribe.mockReset().mockImplementation((_uid, onBalance) => {
    subscription.onBalance = onBalance;
    return subscription.unsubscribe;
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("TokenBalance", () => {
  it("shows nothing until the balance arrives, then follows it", () => {
    render();
    expect(subscription.subscribe).toHaveBeenCalledWith("player-1", expect.any(Function), expect.any(Function));
    expect(host.querySelector("a")).toBeNull();

    act(() => subscription.onBalance!(120));
    const link = host.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/games/gacha");
    expect(link.textContent).toBe("120");

    act(() => subscription.onBalance!(1500));
    expect(host.querySelector("a")!.textContent).toBe((1500).toLocaleString());
  });

  it("stops watching on unmount", () => {
    render();
    act(() => root.unmount());
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    root = createRoot(host);
  });

  it("shows nothing when signed out", () => {
    auth.user = null;
    render();
    expect(subscription.subscribe).not.toHaveBeenCalled();
    expect(host.textContent).toBe("");
  });
});
