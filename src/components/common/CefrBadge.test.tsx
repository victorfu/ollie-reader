import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CefrBadge } from "./CefrBadge";
import type { CefrInfo } from "../../types/wordPractice";

let root: Root | null;
let host: HTMLDivElement | null;

async function renderBadge(info: CefrInfo): Promise<HTMLElement> {
  root = createRoot(host as HTMLDivElement);
  await act(async () => {
    root?.render(<CefrBadge info={info} />);
  });
  const badge = (host as HTMLDivElement).firstElementChild;
  if (!(badge instanceof HTMLElement)) throw new Error("CefrBadge rendered nothing");
  return badge;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  root = null;
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
});

describe("CefrBadge", () => {
  it("shows a list level as plain text with its own label", async () => {
    const badge = await renderBadge({ level: "B1", source: "list" });

    expect(badge.textContent).toBe("B1");
    expect(badge.getAttribute("aria-label")).toBe("CEFR B1");
  });

  it("marks an AI estimate with a tilde and an estimate label", async () => {
    const badge = await renderBadge({ level: "B1", source: "ai" });

    expect(badge.textContent).toBe("≈B1");
    expect(badge.getAttribute("aria-label")).toBe("CEFR 估計 B1");
  });

  it("styles the two sources differently", async () => {
    const list = await renderBadge({ level: "B1", source: "list" });
    const listClass = list.className;
    act(() => root?.unmount());
    root = null;
    (host as HTMLDivElement).replaceChildren();

    const estimate = await renderBadge({ level: "B1", source: "ai" });

    expect(estimate.className).not.toBe(listClass);
  });

  it("stays on one line and keeps its width inside a crowded row", async () => {
    const badge = await renderBadge({ level: "C2", source: "ai" });

    expect(badge.classList.contains("shrink-0")).toBe(true);
    expect(badge.classList.contains("whitespace-nowrap")).toBe(true);
  });
});
