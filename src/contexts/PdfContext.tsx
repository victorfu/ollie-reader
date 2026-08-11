import {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { ExtractResponse } from "../types/pdf";
import { FETCH_URL_PATH, PDF_EXTRACT_PATH } from "../constants/api";
import {
  fetchWithComputeBase,
  getComputeMode,
  localUnavailableMessage,
} from "../services/localBackend";
import { pdfSessionCache } from "../services/pdfSessionCache";
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";
import { useAuth } from "../hooks/useAuth";
import { isSupportedPdfFile } from "../utils/pdfFile";

interface PdfState {
  selectedFile: File | null;
  isUploading: boolean;
  error: string | null;
  result: ExtractResponse | null;
  pdfUrl: string | null;
  isLoadingFromUrl: boolean;
  initialScrollPosition: number | null;
}

interface PdfContextType extends PdfState {
  handleFileChange: (file: File | null) => void;
  loadPdfFromUrl: (url: string) => Promise<void>;
  cancelUpload: () => void;
  clearPdfCache: () => Promise<void>;
  saveScrollPosition: (position: number) => void;
}

type DocumentRequest = {
  generation: number;
  documentId: string;
  controller: AbortController;
};

type ExtractDocumentOptions = DocumentRequest & {
  file: File;
  blob: Blob;
  filename: string;
};

const PdfContext = createContext<PdfContextType | undefined>(undefined);

export { PdfContext };

interface PdfProviderProps {
  children: ReactNode;
}

function createDocumentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const PdfProvider = ({ children }: PdfProviderProps) => {
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
  const [initialScrollPosition, setInitialScrollPosition] = useState<
    number | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const documentIdRef = useRef<string | null>(null);
  const requestGenerationRef = useRef(0);
  const restoredOwnerUidRef = useRef<string | null>(null);

  const isCurrentRequest = useCallback(
    (generation: number, documentId?: string): boolean =>
      requestGenerationRef.current === generation &&
      (documentId === undefined || documentIdRef.current === documentId),
    [],
  );

  const revokeCurrentPdfUrl = useCallback(() => {
    if (!pdfUrlRef.current) return;
    URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
  }, []);

  const startDocumentRequest = useCallback((): DocumentRequest => {
    abortRef.current?.abort();
    const controller = new AbortController();
    const generation = requestGenerationRef.current + 1;
    const documentId = createDocumentId();
    requestGenerationRef.current = generation;
    abortRef.current = controller;
    return { generation, documentId, controller };
  }, []);

  const cacheDocument = useCallback(
    (
      blob: Blob,
      extraction: ExtractResponse | null,
      filename: string,
      documentId: string,
      migratedScrollPosition?: number,
    ) => {
      if (!ownerUid) return;
      void pdfSessionCache
        .savePdfToCache(
          ownerUid,
          blob,
          extraction,
          filename,
          documentId,
          migratedScrollPosition,
        )
        .catch((cacheError) => {
          logger.warn("Failed to cache PDF document:", cacheError);
        });
    },
    [ownerUid],
  );

  const extractDocument = useCallback(
    async ({
      file,
      blob,
      filename,
      generation,
      documentId,
      controller,
    }: ExtractDocumentOptions) => {
      try {
        const form = new FormData();
        form.append("file", file);

        const response = await fetchWithComputeBase(PDF_EXTRACT_PATH, {
          method: "POST",
          body: form,
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `文字提取失敗: ${response.status}`);
        }

        const data = (await response.json()) as ExtractResponse;
        if (!isCurrentRequest(generation, documentId)) return;

        setResult(data);
        setError(null);
        cacheDocument(blob, data, filename, documentId);
      } catch (extractError: unknown) {
        if (!isCurrentRequest(generation, documentId)) return;
        if (isAbortError(extractError)) return;

        const message =
          extractError instanceof Error
            ? extractError.message
            : "發生未知錯誤";
        const isConnectionError = /Failed to fetch|CORS|NetworkError/i.test(
          message,
        );
        if (getComputeMode() === "local" && isConnectionError) {
          setError(localUnavailableMessage());
        } else if (/Failed to fetch|CORS/i.test(message)) {
          setError("PDF 已載入，但文字解析連線失敗。您仍可繼續閱讀 PDF。");
        } else {
          setError(message);
        }
      } finally {
        if (isCurrentRequest(generation, documentId)) {
          setIsUploading(false);
        }
      }
    },
    [cacheDocument, isCurrentRequest],
  );

  // Restore the PDF independently from its optional extracted text.
  useEffect(() => {
    if (restoredOwnerUidRef.current !== ownerUid) {
      restoredOwnerUidRef.current = ownerUid;
      requestGenerationRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      revokeCurrentPdfUrl();
      documentIdRef.current = null;
      setSelectedFile(null);
      setPdfUrl(null);
      setResult(null);
      setError(null);
      setInitialScrollPosition(null);
      setIsUploading(false);
      setIsLoadingFromUrl(false);
    }

    if (!ownerUid) return;

    let cancelled = false;
    const restoreGeneration = requestGenerationRef.current;

    const restoreFromCache = async () => {
      try {
        await pdfSessionCache.clearLegacyPdfCache();
        const cached = await pdfSessionCache.loadPdfFromCache(ownerUid);
        if (
          cancelled ||
          requestGenerationRef.current !== restoreGeneration
        ) {
          return;
        }

        if (!cached) {
          return;
        }

        const documentId = cached.documentId ?? createDocumentId();
        const objectUrl = URL.createObjectURL(cached.blob);
        if (
          cancelled ||
          requestGenerationRef.current !== restoreGeneration
        ) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        pdfUrlRef.current = objectUrl;
        documentIdRef.current = documentId;
        const restoredFile = new File([cached.blob], cached.filename, {
          type: "application/pdf",
        });
        setPdfUrl(objectUrl);
        setResult(cached.result);
        setSelectedFile(restoredFile);
        if (cached.scrollPosition !== undefined) {
          setInitialScrollPosition(cached.scrollPosition);
        }

        if (!cached.documentId) {
          cacheDocument(
            cached.blob,
            cached.result,
            cached.filename,
            documentId,
            cached.scrollPosition,
          );
        }

        // A refresh can happen after the blob is cached but before extraction
        // finishes. Resume that hydration instead of leaving page actions
        // permanently disabled for the restored document.
        if (cached.result === null) {
          const controller = new AbortController();
          abortRef.current = controller;
          setIsUploading(true);
          void extractDocument({
            file: restoredFile,
            blob: cached.blob,
            filename: cached.filename,
            generation: restoreGeneration,
            documentId,
            controller,
          });
        }
      } catch (restoreError) {
        logger.warn("Failed to restore PDF from cache:", restoreError);
      }
    };

    void restoreFromCache();
    return () => {
      cancelled = true;
    };
  }, [cacheDocument, extractDocument, ownerUid, revokeCurrentPdfUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revokeCurrentPdfUrl();
    };
  }, [revokeCurrentPdfUrl]);

  const handleFileChange = useCallback(
    (file: File | null) => {
      const request = startDocumentRequest();
      setInitialScrollPosition(null);
      setError(null);
      setResult(null);
      setIsLoadingFromUrl(false);
      setIsUploading(false);
      revokeCurrentPdfUrl();
      documentIdRef.current = null;

      if (!file) {
        setSelectedFile(null);
        setPdfUrl(null);
        if (ownerUid) void pdfSessionCache.clearPdfCache(ownerUid);
        return;
      }

      if (!isSupportedPdfFile(file)) {
        setError("請上傳 PDF 檔案 (application/pdf)");
        setSelectedFile(null);
        setPdfUrl(null);
        if (ownerUid) void pdfSessionCache.clearPdfCache(ownerUid);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      pdfUrlRef.current = objectUrl;
      documentIdRef.current = request.documentId;
      setSelectedFile(file);
      setPdfUrl(objectUrl);
      setIsUploading(true);
      cacheDocument(file, null, file.name, request.documentId);
      void extractDocument({
        ...request,
        file,
        blob: file,
        filename: file.name,
      });
    },
    [
      cacheDocument,
      extractDocument,
      ownerUid,
      revokeCurrentPdfUrl,
      startDocumentRequest,
    ],
  );

  const loadPdfFromUrl = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        setError("請輸入有效的 URL");
        throw new Error("請輸入有效的 URL");
      }

      const request = startDocumentRequest();
      setInitialScrollPosition(null);
      setError(null);
      setResult(null);
      setSelectedFile(null);
      setPdfUrl(null);
      setIsUploading(false);
      setIsLoadingFromUrl(true);
      revokeCurrentPdfUrl();
      documentIdRef.current = null;

      try {
        const params = new URLSearchParams({
          url,
          follow_redirects: "true",
        });
        const response = await fetchWithComputeBase(
          `${FETCH_URL_PATH}?${params.toString()}`,
          { signal: request.controller.signal },
        );

        if (!response.ok) {
          let errorMessage = `無法載入 PDF: ${response.status}`;
          switch (response.status) {
            case 400:
              errorMessage = "URL 格式錯誤或參數不正確";
              break;
            case 404:
              errorMessage = "找不到指定的 PDF 檔案";
              break;
            case 408:
              errorMessage = "請求超時，請稍後再試";
              break;
            case 429:
              errorMessage = "請求過於頻繁，請稍後再試";
              break;
            case 500:
              errorMessage = "伺服器錯誤，無法抓取檔案";
              break;
            default: {
              const errorText = await response.text().catch(() => "");
              if (errorText) errorMessage = errorText;
            }
          }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/pdf")) {
          throw new Error(
            `URL 未返回 PDF 檔案 (Content-Type: ${contentType})`,
          );
        }

        const blob = await response.blob();
        if (!isCurrentRequest(request.generation)) return;

        const filename = `downloaded_${Date.now()}.pdf`;
        const file = new File([blob], filename, { type: "application/pdf" });
        const objectUrl = URL.createObjectURL(blob);
        if (!isCurrentRequest(request.generation)) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        pdfUrlRef.current = objectUrl;
        documentIdRef.current = request.documentId;
        setSelectedFile(file);
        setPdfUrl(objectUrl);
        setIsLoadingFromUrl(false);
        setIsUploading(true);
        cacheDocument(blob, null, filename, request.documentId);
        void extractDocument({
          ...request,
          file,
          blob,
          filename,
        });
      } catch (loadError: unknown) {
        if (!isCurrentRequest(request.generation)) return;
        if (isAbortError(loadError)) return;

        const message =
          loadError instanceof Error
            ? loadError.message
            : "載入 PDF 時發生未知錯誤";
        const isConnectionError = /Failed to fetch|CORS|NetworkError/i.test(
          message,
        );
        setError(
          getComputeMode() === "local" && isConnectionError
            ? localUnavailableMessage()
            : message,
        );
        setSelectedFile(null);
        setPdfUrl(null);
        setResult(null);
        throw loadError;
      } finally {
        if (isCurrentRequest(request.generation)) {
          setIsLoadingFromUrl(false);
        }
      }
    },
    [
      cacheDocument,
      extractDocument,
      isCurrentRequest,
      revokeCurrentPdfUrl,
      startDocumentRequest,
    ],
  );

  const cancelUpload = useCallback(() => {
    requestGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsUploading(false);
    setIsLoadingFromUrl(false);
  }, []);

  const clearPdfCache = useCallback(async () => {
    requestGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    revokeCurrentPdfUrl();
    documentIdRef.current = null;
    setSelectedFile(null);
    setPdfUrl(null);
    setResult(null);
    setError(null);
    setInitialScrollPosition(null);
    setIsUploading(false);
    setIsLoadingFromUrl(false);
    if (ownerUid) await pdfSessionCache.clearPdfCache(ownerUid);
  }, [ownerUid, revokeCurrentPdfUrl]);

  const saveScrollPosition = useCallback((position: number) => {
    if (!ownerUid) return;
    const documentId = documentIdRef.current;
    if (!documentId) return;
    void pdfSessionCache.saveScrollPosition(ownerUid, position, documentId);
  }, [ownerUid]);

  // Auth changes render before passive effects run. Never expose the previous
  // owner's document during that commit; the effect above will then clear the
  // backing state and restore only the new owner's cache.
  const stateBelongsToCurrentOwner =
    restoredOwnerUidRef.current === ownerUid;

  const value: PdfContextType = useMemo(
    () => ({
      selectedFile: stateBelongsToCurrentOwner ? selectedFile : null,
      isUploading: stateBelongsToCurrentOwner ? isUploading : false,
      error: stateBelongsToCurrentOwner ? error : null,
      result: stateBelongsToCurrentOwner ? result : null,
      pdfUrl: stateBelongsToCurrentOwner ? pdfUrl : null,
      isLoadingFromUrl: stateBelongsToCurrentOwner
        ? isLoadingFromUrl
        : false,
      initialScrollPosition: stateBelongsToCurrentOwner
        ? initialScrollPosition
        : null,
      handleFileChange,
      loadPdfFromUrl,
      cancelUpload,
      clearPdfCache,
      saveScrollPosition,
    }),
    [
      selectedFile,
      isUploading,
      error,
      result,
      pdfUrl,
      isLoadingFromUrl,
      initialScrollPosition,
      handleFileChange,
      loadPdfFromUrl,
      cancelUpload,
      clearPdfCache,
      saveScrollPosition,
      stateBelongsToCurrentOwner,
    ],
  );

  return <PdfContext.Provider value={value}>{children}</PdfContext.Provider>;
};
