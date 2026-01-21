import {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type { ExtractResponse } from "../types/pdf";
import { API_URL, FETCH_URL_API } from "../constants/api";
import { pdfSessionCache } from "../services/pdfSessionCache";
import { isAbortError } from "../utils/errorUtils";

interface PdfState {
  selectedFile: File | null;
  isUploading: boolean;
  error: string | null;
  result: ExtractResponse | null;
  pdfUrl: string | null;
  isLoadingFromUrl: boolean;
}

interface PdfContextType extends PdfState {
  handleFileChange: (file: File | null) => void;
  loadPdfFromUrl: (url: string) => Promise<void>;
  cancelUpload: () => void;
  clearPdfCache: () => Promise<void>;
}

const PdfContext = createContext<PdfContextType | undefined>(undefined);

export { PdfContext };

interface PdfProviderProps {
  children: ReactNode;
}

export const PdfProvider = ({ children }: PdfProviderProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const currentBlobRef = useRef<Blob | null>(null);

  // Restore PDF from cache on mount
  useEffect(() => {
    const restoreFromCache = async () => {
      try {
        const cached = await pdfSessionCache.loadPdfFromCache();
        if (cached) {
          const { blob, result: cachedResult, filename } = cached;
          const objectUrl = URL.createObjectURL(blob);
          pdfUrlRef.current = objectUrl;
          currentBlobRef.current = blob;
          setPdfUrl(objectUrl);
          setResult(cachedResult);
          const file = new File([blob], filename, { type: "application/pdf" });
          setSelectedFile(file);
        } else {
          // Mark session as active for future saves
          pdfSessionCache.markSessionActive();
        }
      } catch (err) {
        console.warn("Failed to restore PDF from cache:", err);
        // Mark session as active even on error
        pdfSessionCache.markSessionActive();
      }
    };

    void restoreFromCache();
  }, []);

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  const uploadAndExtract = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(API_URL, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `上傳失敗: ${res.status}`);
      }

      const data = (await res.json()) as ExtractResponse;
      setResult(data);

      // Save to session cache
      if (currentBlobRef.current) {
        void pdfSessionCache.savePdfToCache(
          currentBlobRef.current,
          data,
          currentBlobRef.current instanceof File
            ? (currentBlobRef.current as File).name
            : "uploaded.pdf",
        );
      }
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      const message = err instanceof Error ? err.message : "發生未知錯誤";
      if (/Failed to fetch|CORS/i.test(message)) {
        setError("連線失敗或 CORS 問題，請稍後再試。");
      } else {
        setError(message);
      }
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileChange = useCallback(
    (file: File | null) => {
      // Revoke previous object URL to prevent memory leaks
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }

      if (!file) {
        setSelectedFile(null);
        setPdfUrl(null);
        return;
      }
      if (file.type !== "application/pdf") {
        setError("請上傳 PDF 檔案 (application/pdf)");
        setSelectedFile(null);
        setPdfUrl(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      pdfUrlRef.current = url;
      currentBlobRef.current = file;
      setPdfUrl(url);
      void uploadAndExtract(file);
    },
    [uploadAndExtract],
  );

  const loadPdfFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) {
      setError("請輸入有效的 URL");
      return;
    }

    // Revoke previous object URL to prevent memory leaks
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }

    setIsLoadingFromUrl(true);
    setError(null);
    setResult(null);
    setSelectedFile(null);
    setPdfUrl(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiUrl = new URL(FETCH_URL_API);
      apiUrl.searchParams.set("url", url);
      apiUrl.searchParams.set("follow_redirects", "true");

      const response = await fetch(apiUrl.toString(), {
        signal: controller.signal,
      });

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
          default:
            try {
              const errorText = await response.text();
              if (errorText) errorMessage = errorText;
            } catch {
              // ignore
            }
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/pdf")) {
        throw new Error(`URL 未返回 PDF 檔案 (Content-Type: ${contentType})`);
      }

      const blob = await response.blob();
      const currentTime = Date.now();
      const filename = `downloaded_${currentTime}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      pdfUrlRef.current = objectUrl;
      currentBlobRef.current = blob;
      setPdfUrl(objectUrl);

      setIsUploading(true);
      const form = new FormData();
      form.append("file", file);

      const extractRes = await fetch(API_URL, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!extractRes.ok) {
        const text = await extractRes.text().catch(() => "");
        throw new Error(text || `文字提取失敗: ${extractRes.status}`);
      }

      const data = (await extractRes.json()) as ExtractResponse;
      setResult(data);
      setSelectedFile(file);

      // Save to session cache
      void pdfSessionCache.savePdfToCache(blob, data, filename);
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      const message =
        err instanceof Error ? err.message : "載入 PDF 時發生未知錯誤";
      setError(message);
      setSelectedFile(null);
      setPdfUrl(null);
      setResult(null);
    } finally {
      setIsLoadingFromUrl(false);
      setIsUploading(false);
    }
  }, []);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    setIsUploading(false);
  }, []);

  const clearPdfCache = useCallback(async () => {
    // Clear IndexedDB cache
    await pdfSessionCache.clearPdfCache();

    // Revoke object URL to prevent memory leaks
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }

    // Reset all PDF state to initial values
    currentBlobRef.current = null;
    setSelectedFile(null);
    setPdfUrl(null);
    setResult(null);
    setError(null);
  }, []);

  const value: PdfContextType = {
    selectedFile,
    isUploading,
    error,
    result,
    pdfUrl,
    isLoadingFromUrl,
    handleFileChange,
    loadPdfFromUrl,
    cancelUpload,
    clearPdfCache,
  };

  return <PdfContext.Provider value={value}>{children}</PdfContext.Provider>;
};
