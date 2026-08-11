import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const speechMocks = vi.hoisted(() => ({ speak: vi.fn() }));

vi.mock("../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({ speak: speechMocks.speak }),
}));

import { ClickableWords } from "./ClickableWords";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("ClickableWords", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("ignores an older definition response after another word is selected", async () => {
    const alpha = deferred<string | null>();
    const beta = deferred<string | null>();
    const getWordDefinition = vi.fn((word: string) =>
      word === "alpha" ? alpha.promise : beta.promise,
    );
    await act(async () => {
      root.render(
        <ClickableWords
          text="Alpha beta"
          getWordDefinition={getWordDefinition}
        />,
      );
    });

    const wordElements = container.querySelectorAll(".cursor-pointer");
    act(() => {
      wordElements[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      wordElements[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => beta.resolve("definition for beta"));
    expect(container.textContent).toContain("definition for beta");
    expect(container.textContent).toContain("beta");

    await act(async () => alpha.resolve("definition for alpha"));
    expect(container.textContent).toContain("definition for beta");
    expect(container.textContent).not.toContain("definition for alpha");
  });
});
