import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-pdf", async () => {
  const React = await import("react");

  return {
    pdfjs: { version: "test", GlobalWorkerOptions: { workerSrc: "" } },
    Document: ({
      children,
      onLoadSuccess,
    }: {
      children: React.ReactNode;
      onLoadSuccess: (result: { numPages: number }) => void;
    }) => {
      React.useEffect(() => onLoadSuccess({ numPages: 1 }), [onLoadSuccess]);
      return <div>{children}</div>;
    },
    Page: () => <div data-testid="pdf-page" />,
  };
});

import { PdfViewer } from "./PdfViewer";

let host: HTMLDivElement;
let root: Root;
let scrollToMock: ReturnType<typeof vi.fn>;

const defaultProps = {
  pagesByNumber: new Map(),
  readingMode: "selection" as const,
  onSpeak: vi.fn(),
  onTextSelection: vi.fn(),
};

function renderViewer(
  url: string,
  initialScrollPosition: number | null,
  onScrollPositionChange = vi.fn(),
) {
  act(() => {
    root.render(
      <PdfViewer
        {...defaultProps}
        url={url}
        initialScrollPosition={initialScrollPosition}
        onScrollPositionChange={onScrollPositionChange}
      />,
    );
  });
  return onScrollPositionChange;
}

function scrollContainer(): HTMLDivElement {
  const element = host.querySelector(".overflow-y-auto");
  if (!(element instanceof HTMLDivElement)) {
    throw new Error("PDF scroll container was not rendered");
  }
  return element;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  scrollToMock = vi.fn();
  HTMLElement.prototype.scrollTo =
    scrollToMock as unknown as typeof HTMLElement.prototype.scrollTo;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  host.remove();
});

describe("PdfViewer scroll management", () => {
  it("restores startup position inside the PDF container", () => {
    renderViewer("blob:cached", 420);

    act(() => vi.advanceTimersByTime(300));

    expect(scrollToMock).toHaveBeenCalledWith({ top: 420, left: 0 });
  });

  it("starts a newly selected course at the top", () => {
    renderViewer("blob:first", 420);
    act(() => vi.advanceTimersByTime(300));
    scrollToMock.mockClear();

    renderViewer("blob:next-course", null);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0 });
    expect(scrollToMock).not.toHaveBeenCalledWith({ top: 420, left: 0 });
  });

  it("saves the PDF container position instead of the window position", () => {
    const onScrollPositionChange = renderViewer("blob:course", null);
    const container = scrollContainer();
    container.scrollTop = 275;

    act(() => container.dispatchEvent(new Event("scroll", { bubbles: true })));
    act(() => vi.advanceTimersByTime(500));

    expect(onScrollPositionChange).toHaveBeenCalledWith(275);
  });
});
