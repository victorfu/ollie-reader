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

function pdfResponse(): Response {
  return new Response("%PDF", {
    status: 200,
    headers: { "Content-Type": "application/pdf" },
  });
}

describe("PdfProvider document lifecycle", () => {
  it("restores a cached PDF without contacting the server", async () => {
    act(() => root.unmount());
    host.remove();
    currentState = null;
    const cachedBlob = new Blob(["cached"], { type: "application/pdf" });
    mocks.loadPdfFromCache.mockResolvedValueOnce({
      blob: cachedBlob,
      filename: "cached-scan.pdf",
      scrollPosition: 125,
    });

    await mountProvider();

    expect(state().pdfUrl).toBe("blob:remote.pdf");
    expect(state().selectedFile?.name).toBe("cached-scan.pdf");
    expect(state().initialScrollPosition).toBe(125);
    expect(mocks.fetchWithComputeBase).not.toHaveBeenCalled();
    // A legacy entry without a document id is re-saved with one.
    expect(mocks.savePdfToCache).toHaveBeenCalledWith(
      "user-1",
      cachedBlob,
      "cached-scan.pdf",
      expect.any(String),
      125,
    );
  });

  it("does not retain the previous account PDF while a new account restores", async () => {
    const cachedBlob = new Blob(["alice"], { type: "application/pdf" });
    act(() => root.unmount());
    host.remove();
    currentState = null;
    mocks.loadPdfFromCache.mockResolvedValueOnce({
      blob: cachedBlob,
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
    const selected = new File(["new"], "selected.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(selected));

    cachedPdf.resolve({
      blob: new Blob(["old"], { type: "application/pdf" }),
      filename: "cached.pdf",
      documentId: "cached-document",
    });
    await flushAsyncWork();

    expect(state().selectedFile?.name).toBe("selected.pdf");
    expect(state().pdfUrl).toBe("blob:selected.pdf");
  });

  it("shows a local PDF immediately and caches it without uploading", async () => {
    const firstFile = new File(["first"], "first.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(firstFile));
    const secondFile = new File(["second"], "second.pdf", {
      type: "application/pdf",
    });
    act(() => state().handleFileChange(secondFile));
    await flushAsyncWork();

    expect(state().selectedFile?.name).toBe("second.pdf");
    expect(state().pdfUrl).toBe("blob:second.pdf");
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:first.pdf");
    expect(mocks.savePdfToCache).toHaveBeenLastCalledWith(
      "user-1",
      secondFile,
      "second.pdf",
      expect.any(String),
      undefined,
    );
    expect(mocks.fetchWithComputeBase).not.toHaveBeenCalled();
  });

  it("accepts a PDF extension when the browser leaves MIME empty", async () => {
    const file = new File(["%PDF-1.7"], "mime-less.pdf", { type: "" });

    act(() => state().handleFileChange(file));
    await flushAsyncWork();

    expect(state().selectedFile?.name).toBe("mime-less.pdf");
    expect(state().error).toBeNull();
  });

  it("publishes and caches a URL-fetched PDF with a single request", async () => {
    mocks.fetchWithComputeBase.mockResolvedValueOnce(pdfResponse());

    await act(async () => {
      await state().loadPdfFromUrl("https://example.com/lesson.pdf");
    });
    await flushAsyncWork();

    expect(mocks.fetchWithComputeBase).toHaveBeenCalledTimes(1);
    expect(state().pdfUrl).toBe("blob:remote.pdf");
    expect(state().selectedFile?.type).toBe("application/pdf");
    expect(state().isLoadingFromUrl).toBe(false);
    expect(mocks.savePdfToCache).toHaveBeenCalledTimes(1);
  });

  it("does not let an in-flight URL download repopulate cleared state", async () => {
    const download = deferred<Response>();
    mocks.fetchWithComputeBase.mockReturnValueOnce(download.promise);

    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = state().loadPdfFromUrl("https://example.com/clear-me.pdf");
    });
    await act(async () => {
      await state().clearPdfCache();
    });
    download.resolve(pdfResponse());
    await act(async () => loadPromise.catch(() => {}));
    await flushAsyncWork();

    expect(state().selectedFile).toBeNull();
    expect(state().pdfUrl).toBeNull();
    expect(state().isLoadingFromUrl).toBe(false);
  });

  it("ignores a stale URL download after a local PDF is selected", async () => {
    const remoteDownload = deferred<Response>();
    mocks.fetchWithComputeBase.mockReturnValueOnce(remoteDownload.promise);

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

    remoteDownload.resolve(pdfResponse());
    await act(async () => remotePromise);
    await flushAsyncWork();

    expect(state().selectedFile?.name).toBe("local.pdf");
    expect(state().pdfUrl).toBe("blob:local.pdf");
  });
});
