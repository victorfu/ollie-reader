import {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { FETCH_URL_PATH } from "../constants/api";
import {
  fetchWithComputeBase,
  getComputeMode,
  localUnavailableMessage,
} from "../services/localBackend";
import { pdfSessionCache } from "../services/pdfSessionCache";
import { apiFetch } from "../utils/apiUtil";
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";
import { useAuth } from "../hooks/useAuth";
import { isSupportedPdfFile } from "../utils/pdfFile";

interface PdfState {
  selectedFile: File | null;
  error: string | null;
  pdfUrl: string | null;
  isLoadingFromUrl: boolean;
  initialScrollPosition: number | null;
}

interface PdfContextType extends PdfState {
  handleFileChange: (file: File | null) => void;
  loadPdfFromUrl: (url: string) => Promise<void>;
  clearPdfCache: () => Promise<void>;
  saveScrollPosition: (position: number) => void;
}

type DocumentRequest = {
  generation: number;
  documentId: string;
  controller: AbortController;
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
  const [error, setError] = useState<string | null>(null);
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
      filename: string,
      documentId: string,
      migratedScrollPosition?: number,
    ) => {
      if (!ownerUid) return;
      void pdfSessionCache
        .savePdfToCache(
          ownerUid,
          blob,
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

  // Restore the cached PDF of the current owner.
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
      setError(null);
      setInitialScrollPosition(null);
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
        setSelectedFile(restoredFile);
        if (cached.scrollPosition !== undefined) {
          setInitialScrollPosition(cached.scrollPosition);
        }

        if (!cached.documentId) {
          cacheDocument(
            cached.blob,
            cached.filename,
            documentId,
            cached.scrollPosition,
          );
        }
      } catch (restoreError) {
        logger.warn("Failed to restore PDF from cache:", restoreError);
      }
    };

    void restoreFromCache();
    return () => {
      cancelled = true;
    };
  }, [cacheDocument, ownerUid, revokeCurrentPdfUrl]);

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
      setIsLoadingFromUrl(false);
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
      cacheDocument(file, file.name, request.documentId);
    },
    [
      cacheDocument,
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
      setSelectedFile(null);
      setPdfUrl(null);
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
          // 雲端帶 Firebase token；本機 sidecar 會忽略它。
          (target, init) => apiFetch(target, { ...init, includeAuthToken: true }),
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
        cacheDocument(blob, filename, request.documentId);
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
        throw loadError;
      } finally {
        if (isCurrentRequest(request.generation)) {
          setIsLoadingFromUrl(false);
        }
      }
    },
    [
      cacheDocument,
      isCurrentRequest,
      revokeCurrentPdfUrl,
      startDocumentRequest,
    ],
  );

  const clearPdfCache = useCallback(async () => {
    requestGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    revokeCurrentPdfUrl();
    documentIdRef.current = null;
    setSelectedFile(null);
    setPdfUrl(null);
    setError(null);
    setInitialScrollPosition(null);
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
      error: stateBelongsToCurrentOwner ? error : null,
      pdfUrl: stateBelongsToCurrentOwner ? pdfUrl : null,
      isLoadingFromUrl: stateBelongsToCurrentOwner
        ? isLoadingFromUrl
        : false,
      initialScrollPosition: stateBelongsToCurrentOwner
        ? initialScrollPosition
        : null,
      handleFileChange,
      loadPdfFromUrl,
      clearPdfCache,
      saveScrollPosition,
    }),
    [
      selectedFile,
      error,
      pdfUrl,
      isLoadingFromUrl,
      initialScrollPosition,
      handleFileChange,
      loadPdfFromUrl,
      clearPdfCache,
      saveScrollPosition,
      stateBelongsToCurrentOwner,
    ],
  );

  return <PdfContext.Provider value={value}>{children}</PdfContext.Provider>;
};
