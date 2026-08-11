import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SentenceInput } from "./SentenceInput";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

function enterText(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("SentenceInput", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the submitted text and panel open when processing fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <SentenceInput
          isOpen
          isProcessing={false}
          onSubmit={onSubmit}
          onClose={onClose}
        />,
      );
    });

    const textarea = container.querySelector("textarea")!;
    act(() => enterText(textarea, "Keep this paragraph."));
    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("分句並翻譯"),
    )!;

    await act(async () => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith("Keep this paragraph.");
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")?.value).toBe(
      "Keep this paragraph.",
    );
  });

  it("clears and closes only after a successful submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <SentenceInput
          isOpen
          isProcessing={false}
          onSubmit={onSubmit}
          onClose={onClose}
        />,
      );
    });

    const textarea = container.querySelector("textarea")!;
    act(() => enterText(textarea, "Saved paragraph."));
    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("分句並翻譯"),
    )!;

    await act(async () => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("textarea")?.value).toBe("");
  });

  it("does not clear newer input when an older successful submit resolves", async () => {
    const submitting = deferred<boolean>();
    const onSubmit = vi.fn().mockReturnValue(submitting.promise);
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <SentenceInput
          isOpen
          isProcessing={false}
          onSubmit={onSubmit}
          onClose={onClose}
        />,
      );
    });

    const textarea = container.querySelector("textarea")!;
    act(() => enterText(textarea, "Submitted paragraph."));
    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("分句並翻譯"),
    )!;
    act(() => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => enterText(textarea, "A newer draft."));

    await act(async () => submitting.resolve(true));

    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")?.value).toBe("A newer draft.");
  });
});
