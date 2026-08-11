import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptGeneratorModal } from "./ScriptGeneratorModal";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("ScriptGeneratorModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    Object.defineProperties(HTMLDialogElement.prototype, {
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute("open");
        },
      },
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderModal({
    isSaving = false,
    onUseScript = vi.fn(async () => true),
    onClose = vi.fn(),
  }: {
    isSaving?: boolean;
    onUseScript?: (script: string) => Promise<boolean>;
    onClose?: () => void;
  } = {}) {
    act(() => {
      root.render(
        <ScriptGeneratorModal
          isOpen
          topic={null}
          prompt="prompt"
          generatedScript="A generated script"
          isGenerating={false}
          error={null}
          isSaving={isSaving}
          onPromptChange={vi.fn()}
          onScriptChange={vi.fn()}
          onGenerate={vi.fn()}
          onUseScript={onUseScript}
          onClose={onClose}
        />,
      );
    });
  }

  it("waits for a successful save before closing", async () => {
    const save = deferred<boolean>();
    const onUseScript = vi.fn(() => save.promise);
    const onClose = vi.fn();
    renderModal({ onUseScript, onClose });

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("儲存講稿"),
    );
    expect(saveButton).toBeTruthy();

    act(() => saveButton?.click());
    expect(onUseScript).toHaveBeenCalledWith("A generated script");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      save.resolve(false);
      await save.promise;
    });
    expect(onClose).not.toHaveBeenCalled();

    const successfulSave = deferred<boolean>();
    onUseScript.mockReturnValueOnce(successfulSave.promise);
    act(() => saveButton?.click());

    await act(async () => {
      successfulSave.resolve(true);
      await successfulSave.promise;
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks escape, native cancel, and backdrop close while saving", () => {
    const onClose = vi.fn();
    renderModal({ isSaving: true, onClose });

    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    act(() => window.dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true);

    const dialog = container.querySelector("dialog");
    const cancel = new Event("cancel", { bubbles: false, cancelable: true });
    act(() => dialog?.dispatchEvent(cancel));
    expect(cancel.defaultPrevented).toBe(true);

    const backdropButton = container.querySelector<HTMLButtonElement>(
      ".modal-backdrop button",
    );
    expect(backdropButton?.disabled).toBe(true);
    act(() => backdropButton?.click());
    expect(onClose).not.toHaveBeenCalled();
  });
});
