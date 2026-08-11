import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "user-1" } as { uid: string } | null },
  fetchWithComputeBase: vi.fn(),
  getComputeMode: vi.fn(() => "cloud" as const),
  loadPdfFromCache: vi.fn(),
  savePdfToCache: vi.fn(),
  saveScrollPosition: vi.fn(),
  clearPdfCache: vi.fn(),
  clearLegacyPdfCache: vi.fn(),
  createObjectURL: vi.fn((blob: Blob) =>
    blob instanceof File ? `blob:${blob.name}` : "blob:remote.pdf",
  ),
  revokeObjectURL: vi.fn(),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../services/localBackend", () => ({
  fetchWithComputeBase: mocks.fetchWithComputeBase,
  getComputeMode: mocks.getComputeMode,
  localUnavailableMessage: () => "本機 sidecar 未連線",
}));

vi.mock("../services/pdfSessionCache", () => ({
  pdfSessionCache: {
    loadPdfFromCache: mocks.loadPdfFromCache,
    savePdfToCache: mocks.savePdfToCache,
    saveScrollPosition: mocks.saveScrollPosition,
    clearPdfCache: mocks.clearPdfCache,
    clearLegacyPdfCache: mocks.clearLegacyPdfCache,
  },
}));

import { usePdfState } from "../hooks/usePdfState";
import { PdfProvider } from "./PdfContext";

type PdfState = ReturnType<typeof usePdfState>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function extractResponse(filename: string, text: string): Response {
  return new Response(
    JSON.stringify({
      status: "success",
      filename,
      total_pages: 1,
      pages: [{ page_number: 1, text, text_length: text.length }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

let host: HTMLDivElement;
let root: Root;
let currentState: PdfState | null;
let recordRenderedFiles = false;
let renderedFiles: Array<string | null> = [];
let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;

function PdfProbe() {
  const state = usePdfState();
  if (recordRenderedFiles) {
    renderedFiles.push(state.selectedFile?.name ?? null);
  }
  useEffect(() => {
    currentState = state;
  });
  return null;
}

function state(): PdfState {
  if (!currentState) throw new Error("PDF context did not render");
  return currentState;
}

async function mountProvider(): Promise<void> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <PdfProvider>
        <PdfProbe />
      </PdfProvider>,
    );
  });
  await flushAsyncWork();
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  currentState = null;
  recordRenderedFiles = false;
  renderedFiles = [];
  mocks.auth.user = { uid: "user-1" };
  mocks.loadPdfFromCache.mockResolvedValue(null);
  mocks.savePdfToCache.mockResolvedValue(undefined);
  mocks.saveScrollPosition.mockResolvedValue(undefined);
  mocks.clearPdfCache.mockResolvedValue(undefined);
  mocks.clearLegacyPdfCache.mockResolvedValue(undefined);

  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: mocks.createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: mocks.revokeObjectURL,
  });

  await mountProvider();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "revokeObjectURL");
  }
});

describe("PdfProvider document lifecycle", () => {
  it("restores a cached PDF even when extracted text is unavailable", async () => {
    act(() => root.unmount());
    host.remove();
    currentState = null;
    const cachedBlob = new Blob(["cached"], { type: "application/pdf" });
    const resumedExtraction = deferred<Response>();
    mocks.fetchWithComputeBase.mockReturnValueOnce(resumedExtraction.promise);
    mocks.loadPdfFromCache.mockResolvedValueOnce({
      blob: cachedBlob,
      result: null,
      filename: "cached-scan.pdf",
      scrollPosition: 125,
    });

    await mountProvider();

    expect(state().pdfUrl).toBe("blob:remote.pdf");
    expect(state().selectedFile?.name).toBe("cached-scan.pdf");
    expect(state().result).toBeNull();
    expect(state().initialScrollPosition).toBe(125);
    expect(state().isUploading).toBe(true);
    expect(mocks.fetchWithComputeBase).toHaveBeenCalledTimes(1);
    expect(mocks.savePdfToCache).toHaveBeenCalledWith(
      "user-1",
      cachedBlob,
      null,
      "cached-scan.pdf",
      expect.any(String),
      125,
    );

    resumedExtraction.resolve(
      extractResponse("cached-scan.pdf", "Recovered cached text"),
    );
    await flushAsyncWork();
    expect(state().result?.filename).toBe("cached-scan.pdf");
    expect(state().isUploading).toBe(false);
  });

  it("does not retain the previous account PDF while a new account restores", async () => {
    const cachedBlob = new Blob(["alice"], { type: "application/pdf" });
    act(() => root.unmount());
    host.remove();
    currentState = null;
    mocks.loadPdfFromCache.mockResolvedValueOnce({
      blob: cachedBlob,
      result: null,
      filename: "alice.pdf",
      documentId: "alice-document",
    });
    await mountProvider();
    expect(state().selectedFile?.name).toBe("alice.pdf");

    const bobCache = deferred<null>();
    mocks.loadPdfFromCache.mockReturnValueOnce(bobCache.promise);
    mocks.auth.user = { uid: "user-2" };
    renderedFiles = [];
    recordRenderedFiles = true;
    await act(async () => {
      root.render(
        <PdfProvider>
          <PdfProbe />
        </PdfProvider>,
      );
    });
    recordRenderedFiles = false;

    expect(renderedFiles.length).toBeGreaterThan(0);
    expect(renderedFiles).not.toContain("alice.pdf");
    expect(state().selectedFile).toBeNull();
    expect(state().pdfUrl).toBeNull();
    expect(mocks.loadPdfFromCache).toHaveBeenLastCalledWith("user-2");
    bobCache.resolve(null);
    await flushAsyncWork();
    expect(state().selectedFile).toBeNull();
  });

  it("does not restore cached state over a PDF selected by the user", async () => {
    act(() => root.unmount());
    host.remove();
    currentState = null;
    const cachedPdf = deferred<{
      blob: Blob;
      result: null;
      filename: string;
      documentId: string;
    } | null>();
    mocks.loadPdfFromCache.mockReturnValueOnce(cachedPdf.promise);

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <PdfProvider>
          <PdfProbe />
        </PdfProvider>,
      );
    });
    const extraction = deferred<Response>();
    mocks.fetchWithComputeBase.mockReturnValueOnce(extraction.promise);
    const selected = new File(["new"], "selected.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(selected));

    cachedPdf.resolve({
      blob: new Blob(["old"], { type: "application/pdf" }),
      result: null,
      filename: "cached.pdf",
      documentId: "cached-document",
    });
    await flushAsyncWork();

    expect(state().selectedFile?.name).toBe("selected.pdf");
    expect(state().pdfUrl).toBe("blob:selected.pdf");
    extraction.resolve(extractResponse("selected.pdf", "Selected text"));
    await flushAsyncWork();
  });

  it("shows a new local PDF immediately and clears the previous extraction", async () => {
    mocks.fetchWithComputeBase.mockResolvedValueOnce(
      extractResponse("first.pdf", "First document text"),
    );
    const firstFile = new File(["first"], "first.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(firstFile));
    await flushAsyncWork();
    expect(state().result?.filename).toBe("first.pdf");

    const secondExtraction = deferred<Response>();
    mocks.fetchWithComputeBase.mockReturnValueOnce(secondExtraction.promise);
    const secondFile = new File(["second"], "second.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(secondFile));

    expect(state().selectedFile?.name).toBe("second.pdf");
    expect(state().pdfUrl).toBe("blob:second.pdf");
    expect(state().result).toBeNull();
    expect(state().isUploading).toBe(true);

    secondExtraction.resolve(extractResponse("second.pdf", "Second text"));
    await flushAsyncWork();
  });

  it("accepts a PDF extension when the browser leaves MIME empty", async () => {
    mocks.fetchWithComputeBase.mockResolvedValueOnce(
      extractResponse("mime-less.pdf", "PDF text"),
    );
    const file = new File(["%PDF-1.7"], "mime-less.pdf", { type: "" });

    act(() => state().handleFileChange(file));
    await flushAsyncWork();

    expect(state().selectedFile?.name).toBe("mime-less.pdf");
    expect(state().error).toBeNull();
    expect(mocks.fetchWithComputeBase).toHaveBeenCalledTimes(1);
  });

  it("keeps a local PDF visible when background extraction fails", async () => {
    mocks.fetchWithComputeBase.mockResolvedValueOnce(
      new Response("文字提取失敗", { status: 500 }),
    );
    const file = new File(["scanned"], "scan.pdf", {
      type: "application/pdf",
    });

    act(() => state().handleFileChange(file));
    await flushAsyncWork();

    expect(state().pdfUrl).toBe("blob:scan.pdf");
    expect(state().selectedFile?.name).toBe("scan.pdf");
    expect(state().result).toBeNull();
    expect(state().error).toContain("文字提取失敗");
  });

  it("publishes a URL-fetched PDF before its extraction finishes", async () => {
    const extraction = deferred<Response>();
    mocks.fetchWithComputeBase
      .mockResolvedValueOnce(
        new Response("%PDF", {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        }),
      )
      .mockReturnValueOnce(extraction.promise);

    act(() => {
      void state().loadPdfFromUrl("https://example.com/lesson.pdf");
    });
    await flushAsyncWork();

    expect(mocks.fetchWithComputeBase).toHaveBeenCalledTimes(2);
    expect(state().pdfUrl).toBe("blob:remote.pdf");
    expect(state().selectedFile?.type).toBe("application/pdf");
    expect(state().result).toBeNull();
    expect(state().isUploading).toBe(true);

    extraction.resolve(extractResponse("downloaded.pdf", "Remote text"));
    await flushAsyncWork();
  });

  it("keeps a URL-fetched PDF visible when background extraction fails", async () => {
    mocks.fetchWithComputeBase
      .mockResolvedValueOnce(
        new Response("%PDF", {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("圖片頁沒有可解析文字", { status: 500 }),
      );

    await act(async () => {
      await state().loadPdfFromUrl("https://example.com/scanned.pdf");
    });
    await flushAsyncWork();

    expect(state().pdfUrl).toBe("blob:remote.pdf");
    expect(state().selectedFile).not.toBeNull();
    expect(state().result).toBeNull();
    expect(state().error).toContain("圖片頁沒有可解析文字");
  });

  it("ignores an older extraction response after a newer file is selected", async () => {
    const firstExtraction = deferred<Response>();
    const secondExtraction = deferred<Response>();
    mocks.fetchWithComputeBase
      .mockReturnValueOnce(firstExtraction.promise)
      .mockReturnValueOnce(secondExtraction.promise);

    const firstFile = new File(["first"], "first.pdf", {
      type: "application/pdf",
    });
    const secondFile = new File(["second"], "second.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(firstFile));
    act(() => state().handleFileChange(secondFile));

    firstExtraction.resolve(extractResponse("first.pdf", "Stale text"));
    await flushAsyncWork();
    expect(state().selectedFile?.name).toBe("second.pdf");
    expect(state().result).toBeNull();
    expect(state().isUploading).toBe(true);

    secondExtraction.resolve(extractResponse("second.pdf", "Current text"));
    await flushAsyncWork();
    expect(state().result?.filename).toBe("second.pdf");
    expect(state().isUploading).toBe(false);
  });

  it("does not let an in-flight extraction repopulate cleared state", async () => {
    const extraction = deferred<Response>();
    mocks.fetchWithComputeBase.mockReturnValueOnce(extraction.promise);
    const file = new File(["pdf"], "clear-me.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(file));

    await act(async () => {
      await state().clearPdfCache();
    });
    extraction.resolve(extractResponse("clear-me.pdf", "Late text"));
    await flushAsyncWork();

    expect(state().selectedFile).toBeNull();
    expect(state().pdfUrl).toBeNull();
    expect(state().result).toBeNull();
    expect(state().isUploading).toBe(false);
  });

  it("keeps the PDF visible and ignores late extraction after cancel", async () => {
    const extraction = deferred<Response>();
    mocks.fetchWithComputeBase.mockReturnValueOnce(extraction.promise);
    const file = new File(["pdf"], "cancelled.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(file));

    act(() => state().cancelUpload());
    expect(state().pdfUrl).toBe("blob:cancelled.pdf");
    expect(state().selectedFile?.name).toBe("cancelled.pdf");
    expect(state().isUploading).toBe(false);

    extraction.resolve(extractResponse("cancelled.pdf", "Late text"));
    await flushAsyncWork();
    expect(state().result).toBeNull();
  });

  it("ignores a stale URL download after a local PDF is selected", async () => {
    const remoteDownload = deferred<Response>();
    mocks.fetchWithComputeBase
      .mockReturnValueOnce(remoteDownload.promise)
      .mockResolvedValueOnce(extractResponse("local.pdf", "Local text"));

    let remotePromise!: Promise<void>;
    act(() => {
      remotePromise = state().loadPdfFromUrl(
        "https://example.com/stale.pdf",
      );
    });
    const localFile = new File(["local"], "local.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(localFile));

    remoteDownload.resolve(
      new Response("%PDF", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    await act(async () => remotePromise);
    await flushAsyncWork();

    expect(state().selectedFile?.name).toBe("local.pdf");
    expect(state().pdfUrl).toBe("blob:local.pdf");
    expect(state().result?.filename).toBe("local.pdf");
  });
});
