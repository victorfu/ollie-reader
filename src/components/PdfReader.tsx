import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import type { ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";
// React-PDF CSS (path differs by version). Use non-esm paths for broader compatibility.
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

type ExtractedPage = {
  page_number: number;
  text: string;
  text_length: number;
};

type ExtractResponse = {
  status: string;
  filename: string;
  total_pages: number;
  pages: ExtractedPage[];
};

const API_BASE_URL = "https://purism-ev-bot-1027147244019.asia-east1.run.app";
const API_URL = `${API_BASE_URL}/api/pdf/extract`;
const TRANSLATE_API_URL = `${API_BASE_URL}/api/translate`;
const FETCH_URL_API = `${API_BASE_URL}/api/fetch-url`;
const TTS_API_URL = `${API_BASE_URL}/api/tts`;

// Memoized text area component to prevent re-render when other pages change
const PageTextArea = memo(
  ({
    pageNumber,
    text,
    textLength,
    readingMode,
    onSpeak,
    onStopSpeaking,
    onTextSelection,
    isLoadingAudio,
  }: {
    pageNumber: number;
    text: string;
    textLength: number;
    readingMode: "word" | "selection";
    onSpeak: (text: string) => void;
    onStopSpeaking: () => void;
    onTextSelection: () => void;
    isLoadingAudio?: boolean;
  }) => {
    const renderTextWithClickableWords = useCallback(
      (text: string) => {
        const nodes: ReactNode[] = [];
        const wordRegex = /[A-Za-z]+(?:[''-][A-Za-z]+)*/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let key = 0;

        while ((match = wordRegex.exec(text)) !== null) {
          const [word] = match;
          const start = match.index;
          const end = start + word.length;
          if (start > lastIndex) {
            nodes.push(text.slice(lastIndex, start));
          }
          nodes.push(
            <button
              key={`w-${key++}-${start}`}
              type="button"
              onClick={() => onSpeak(word)}
              className="inline px-0.5 rounded hover:bg-warning/30 hover:text-warning-content transition-colors focus:outline-none focus:ring-2 focus:ring-warning/50"
              title={`Speak: ${word}`}
            >
              {word}
            </button>,
          );
          lastIndex = end;
        }
        if (lastIndex < text.length) {
          nodes.push(text.slice(lastIndex));
        }

        return (
          <div className="whitespace-pre-wrap leading-relaxed text-left text-lg">
            {nodes}
          </div>
        );
      },
      [onSpeak],
    );

    const renderSelectableText = useCallback(
      (text: string) => {
        return (
          <div
            className="whitespace-pre-wrap leading-relaxed text-left select-text cursor-text text-xl sm:text-2xl"
            onMouseUp={onTextSelection}
            onTouchEnd={onTextSelection}
          >
            {text}
          </div>
        );
      },
      [onTextSelection],
    );

    return (
      <div className="card bg-base-100 shadow-md">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="card-title text-xl sm:text-2xl">
              <span className="badge badge-primary badge-lg">
                Page {pageNumber}
              </span>
              {textLength != null && (
                <span className="text-sm text-base-content/60 font-normal ml-2">
                  {textLength} 字符
                </span>
              )}
            </h3>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onSpeak(text)}
                className="btn btn-success btn-sm sm:btn-md gap-2"
                disabled={isLoadingAudio}
              >
                {isLoadingAudio ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    生成中
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    朗讀此頁
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onStopSpeaking}
                className="btn btn-ghost btn-sm sm:btn-md"
              >
                停止
              </button>
            </div>
          </div>
          <div className="divider my-2"></div>
          <div
            className="prose prose-lg sm:prose-xl lg:prose-2xl max-w-none overflow-auto"
            style={{ maxHeight: "750px" }}
          >
            {readingMode === "word" && renderTextWithClickableWords(text || "")}
            {readingMode === "selection" && renderSelectableText(text || "")}
          </div>
        </div>
      </div>
    );
  },
);

PageTextArea.displayName = "PageTextArea";

// Memoized PDF Viewer to prevent re-renders
const PdfViewer = memo(
  ({
    url,
    pagesByNumber,
    readingMode,
    onSpeak,
    onStopSpeaking,
    onTextSelection,
    isLoadingAudio,
  }: {
    url: string;
    pagesByNumber: Map<number, ExtractedPage>;
    readingMode: "word" | "selection";
    onSpeak: (text: string) => void;
    onStopSpeaking: () => void;
    onTextSelection: () => void;
    isLoadingAudio?: boolean;
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [numPages, setNumPages] = useState<number>(0);
    const [containerWidth, setContainerWidth] = useState<number>(800);
    const rafIdRef = useRef<number | null>(null);

    // track container width for responsive Page width
    useEffect(() => {
      if (!containerRef.current) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          // padding is managed by parent; use full width minus a small margin
          setContainerWidth(Math.max(320, Math.floor(cr.width - 24)));
        }
      });
      ro.observe(containerRef.current);
      // init immediately
      const rect = containerRef.current.getBoundingClientRect();
      setContainerWidth(Math.max(320, Math.floor(rect.width - 24)));
      return () => ro.disconnect();
    }, []);

    // No scroll-driven state updates needed now that text is per-page
    const handleScroll = useCallback(() => {
      if (!containerRef.current || numPages === 0) return;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        /* noop: keep for future metrics or lazy-loading hooks */
      });
    }, [numPages]);

    useEffect(() => {
      return () => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      };
    }, []);

    // Removed currentPage sync; pages are paired with their own text

    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-3 bg-base-200 rounded-t-lg sticky top-0 z-10">
          <span className="text-sm font-medium">PDF 預覽</span>
        </div>
        <div
          ref={containerRef}
          className="w-full flex-1 overflow-y-auto overflow-x-hidden rounded-b-lg p-3"
          style={{ minHeight: "800px", height: "800px" }}
          onScroll={handleScroll}
        >
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="w-full h-64 grid place-items-center text-base-content/60">
                載入 PDF 中...
              </div>
            }
            error={<div className="alert alert-error m-3">PDF 載入失敗</div>}
          >
            <div className="flex flex-col items-stretch gap-6">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <div
                    key={`page-wrap-${pageNumber}`}
                    ref={(el) => {
                      pageRefs.current[pageNumber - 1] = el;
                    }}
                    data-page-number={pageNumber}
                    className="rounded-lg"
                  >
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
                      {/* PDF page */}
                      <div className="xl:col-span-3">
                        <div className="card bg-base-100 shadow-md max-w-full overflow-hidden">
                          <div className="card-body p-2 sm:p-3">
                            <Page
                              pageNumber={pageNumber}
                              width={containerWidth}
                              renderTextLayer
                              renderAnnotationLayer
                              loading={
                                <div className="skeleton w-full h-[600px]" />
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Text for this page */}
                      <div className="xl:col-span-2">
                        <PageTextArea
                          pageNumber={pageNumber}
                          text={pagesByNumber.get(pageNumber)?.text || ""}
                          textLength={
                            pagesByNumber.get(pageNumber)?.text_length || 0
                          }
                          readingMode={readingMode}
                          onSpeak={onSpeak}
                          onStopSpeaking={onStopSpeaking}
                          onTextSelection={onTextSelection}
                          isLoadingAudio={isLoadingAudio}
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </Document>
        </div>
      </div>
    );
  },
);

PdfViewer.displayName = "PdfViewer";

function PdfReader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>("");
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
  const pagesByNumber = useMemo(() => {
    const map = new Map<number, ExtractedPage>();
    if (result) {
      for (const p of result.pages) map.set(p.page_number, p);
    }
    return map;
  }, [result]);

  // Configure pdf.js worker for react-pdf
  useEffect(() => {
    if (pdfjs.GlobalWorkerOptions) {
      // Point worker to bundled pdf.worker for Vite
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    }
  }, []);

  const [speechRate, setSpeechRate] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [readingMode, setReadingMode] = useState<"word" | "selection">(
    "selection",
  );
  const [selectedText, setSelectedText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // TTS 模式選擇: "browser" 使用瀏覽器內建, "api" 使用 Piper TTS API
  const [ttsMode, setTtsMode] = useState<"browser" | "api">("browser");
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(
    null,
  );
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!speechSupported) return;
    const handle = () => {
      void window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.onvoiceschanged = handle;
    handle();
    return () => {
      if (window.speechSynthesis.onvoiceschanged === handle) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [speechSupported]);

  const uploadAndExtract = useCallback(async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);
    // Don't clear result immediately to avoid UI jump
    // setResult(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const form = new FormData();
      form.append("file", selectedFile);

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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "發生未知錯誤";
      if (/Failed to fetch|CORS/i.test(message)) {
        setError("連線失敗或 CORS 問題，請稍後再試。");
      } else {
        setError(message);
      }
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (selectedFile) {
      void uploadAndExtract();
    }
  }, [selectedFile, uploadAndExtract]);

  // Cleanup PDF URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleFileChange = useCallback((file: File | null) => {
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
    // Create URL for PDF display
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
  }, []);

  const loadPdfFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) {
      setError("請輸入有效的 URL");
      return;
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
      // Step 1: 使用伺服器端 API 抓取 PDF (自動處理 redirects 和 CORS)
      const apiUrl = new URL(FETCH_URL_API);
      apiUrl.searchParams.set("url", url);
      apiUrl.searchParams.set("follow_redirects", "true");

      const response = await fetch(apiUrl.toString(), {
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `無法載入 PDF: ${response.status}`;

        // 根據狀態碼提供更詳細的錯誤訊息
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

      // 取得檔案資訊
      // const finalUrl = response.headers.get("X-Final-URL");
      const redirectCount = response.headers.get("X-Redirect-Count");
      // const fileExtension = response.headers.get("X-File-Extension");

      // Get the PDF as a blob
      const blob = await response.blob();

      // 從 Content-Disposition 或 URL 取得檔名
      const currentTime = Date.now();
      const filename = `downloaded_${currentTime}.pdf`;

      // Create a File object from the blob
      const file = new File([blob], filename, { type: "application/pdf" });

      // Create object URL for PDF display
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);

      // 顯示成功訊息
      if (redirectCount && parseInt(redirectCount) > 0) {
        console.log(`✓ PDF 已載入 (經過 ${redirectCount} 次重定向)`);
      }

      // Step 2: 上傳 PDF 到文字提取 API
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
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

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] ?? null;
    handleFileChange(file);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(file);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    setIsUploading(false);
  };

  const stopSpeaking = useCallback(() => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsLoadingAudio(false);
    // 同時停止 API TTS 音訊
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
  }, [speechSupported, currentAudio]);

  // Use ref to track selectedText to avoid re-creating handleTextSelection
  const selectedTextRef = useRef<string>("");

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";
    if (text !== selectedTextRef.current) {
      selectedTextRef.current = text;
      setSelectedText(text);
      setTranslatedText("");
      setTranslateError(null);
    }
  }, []);

  const translateText = useCallback(async () => {
    if (!selectedText.trim()) return;

    setIsTranslating(true);
    setTranslateError(null);

    try {
      const response = await fetch(TRANSLATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: selectedText,
          from_lang: "en",
          to_lang: "zh-TW",
        }),
      });

      if (!response.ok) {
        throw new Error(`翻譯失敗: ${response.status}`);
      }

      const result = await response.json();
      setTranslatedText(result.text || "無翻譯結果");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "翻譯時發生未知錯誤";
      setTranslateError(message);
    } finally {
      setIsTranslating(false);
    }
  }, [selectedText]);

  const pickEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!speechSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
    return en ?? null;
  }, [speechSupported]);

  const speakWithAPI = useCallback(
    async (text: string) => {
      try {
        setIsLoadingAudio(true);
        setIsSpeaking(false);

        // 使用 POST 方法,參數放在 body 以 JSON 格式傳送
        const response = await fetch(TTS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            speaker: "0",
            length_scale: speechRate.toString(),
            noise_scale: "0.667",
            noise_w: "0.8",
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS API 錯誤: ${response.status}`);
        }

        // 取得音訊資料
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);

        setIsLoadingAudio(false);

        // 播放音訊
        const audio = new Audio(audioUrl);
        setCurrentAudio(audio);
        setIsSpeaking(true);

        audio.onended = () => {
          setIsSpeaking(false);
          setCurrentAudio(null);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          setIsLoadingAudio(false);
          setCurrentAudio(null);
          URL.revokeObjectURL(audioUrl);
          setError("音訊播放失敗");
        };

        await audio.play();
      } catch (err: unknown) {
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        const message = err instanceof Error ? err.message : "TTS API 呼叫失敗";
        setError(message);
      }
    },
    [speechRate],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      // 停止之前的播放
      stopSpeaking();

      if (ttsMode === "api") {
        // 使用 Piper TTS API
        speakWithAPI(text);
      } else {
        // 使用瀏覽器內建 TTS
        if (!speechSupported) return;
        const voice = pickEnglishVoice();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voice?.lang || "en-US";
        utterance.voice = voice || null;
        utterance.rate = speechRate;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    },
    [
      pickEnglishVoice,
      speechRate,
      speechSupported,
      ttsMode,
      stopSpeaking,
      speakWithAPI,
    ],
  );

  const speakSelection = useCallback(() => {
    if (selectedText) {
      speak(selectedText);
    }
  }, [selectedText, speak]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Escape: Clear selection
      if (e.key === "Escape" && selectedText) {
        setSelectedText("");
        setTranslatedText("");
        setTranslateError(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedText]);

  const header = useMemo(() => {
    return (
      <div className="text-center mb-8 lg:mb-12">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
          📚 Ollie Reader
        </h1>
        <p className="text-base sm:text-lg text-base-content/70 max-w-2xl mx-auto px-4">
          上傳 PDF 文件，選取文字即可朗讀或翻譯
        </p>
      </div>
    );
  }, []);

  return (
    <div className="w-full">
      {/* Local CSS to keep react-pdf pages within cards */}
      <style>
        {`
        .react-pdf__Document{width:100%}
        .react-pdf__Page{width:100% !important;max-width:100%}
        .react-pdf__Page canvas,.react-pdf__Page svg{width:100% !important;height:auto !important;max-width:100%;display:block}
        `}
      </style>
      {header}

      {/* Upload Area - Always show */}
      {
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body p-4 sm:p-6 lg:p-8">
            {/* URL Input Section */}
            <div className="mb-6">
              <label className="label">
                <span className="label-text font-semibold text-base">
                  從網址載入 PDF
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="輸入 PDF 連結，例如：https://example.com/file.pdf"
                  className="input input-bordered flex-1"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && urlInput.trim()) {
                      void loadPdfFromUrl(urlInput);
                    }
                  }}
                  disabled={isLoadingFromUrl}
                />
                <button
                  type="button"
                  onClick={() => loadPdfFromUrl(urlInput)}
                  disabled={isLoadingFromUrl || !urlInput.trim()}
                  className="btn btn-primary"
                >
                  {isLoadingFromUrl ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      載入中
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      載入
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="divider">或</div>

            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              className="border-2 border-dashed border-base-300 rounded-xl p-8 sm:p-12 hover:border-primary transition-colors cursor-pointer"
            >
              <input
                id="file"
                type="file"
                accept="application/pdf"
                onChange={onInputChange}
                className="hidden"
              />
              <label htmlFor="file" className="block cursor-pointer">
                <div className="text-center">
                  <div className="text-5xl sm:text-6xl mb-4">📄</div>
                  <div className="text-lg sm:text-xl font-semibold mb-2">
                    {selectedFile ? (
                      <span className="text-primary">{selectedFile.name}</span>
                    ) : (
                      "拖曳或點擊上傳 PDF"
                    )}
                  </div>
                  <div className="text-sm text-base-content/60">
                    支援格式：PDF (.pdf)
                  </div>
                </div>
              </label>
            </div>

            {isUploading && (
              <div className="flex justify-center gap-3 mt-6">
                <button
                  type="button"
                  disabled
                  className="btn btn-primary btn-lg gap-2"
                >
                  <span className="loading loading-spinner"></span>
                  解析中...
                </button>
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="btn btn-error btn-outline btn-lg"
                >
                  取消
                </button>
              </div>
            )}

            {!speechSupported && (
              <div className="alert alert-warning mt-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>您的瀏覽器不支援語音朗讀功能</span>
              </div>
            )}
          </div>
        </div>
      }

      {/* Compact TTS Controls - Only show when PDF loaded */}
      {result && (
        <div className="card bg-base-100 shadow-md mb-6">
          <div className="card-body p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* TTS Mode Selection */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTtsMode("browser")}
                  className={`btn btn-sm ${
                    ttsMode === "browser" ? "btn-info" : "btn-outline btn-info"
                  }`}
                  title="使用系統內建語音引擎"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline ml-1">系統語音</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTtsMode("api")}
                  className={`btn btn-sm ${
                    ttsMode === "api"
                      ? "btn-success"
                      : "btn-outline btn-success"
                  }`}
                  title="使用雲端 AI 語音合成"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                  </svg>
                  <span className="hidden sm:inline ml-1">AI 語音</span>
                </button>
              </div>

              <div className="divider divider-horizontal hidden sm:flex m-0"></div>

              {/* Reading Mode Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReadingMode("word")}
                  className={`btn btn-sm ${
                    readingMode === "word"
                      ? "btn-primary"
                      : "btn-outline btn-primary"
                  }`}
                  title="點擊單字朗讀"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <span className="hidden sm:inline ml-1">單字</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReadingMode("selection")}
                  className={`btn btn-sm ${
                    readingMode === "selection"
                      ? "btn-accent"
                      : "btn-outline btn-accent"
                  }`}
                  title="選取文字朗讀"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                    />
                  </svg>
                  <span className="hidden sm:inline ml-1">選取</span>
                </button>
              </div>

              {/* Speed Control */}
              <div className="flex-1 w-full sm:max-w-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm whitespace-nowrap">速度</span>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={speechRate}
                    onChange={(e) => setSpeechRate(Number(e.target.value))}
                    className="range range-primary range-xs"
                  />
                  <span className="badge badge-primary badge-sm">
                    {speechRate.toFixed(1)}x
                  </span>
                </div>
              </div>

              {/* Stop Button */}
              {(isSpeaking || isLoadingAudio) && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="btn btn-error btn-sm gap-1"
                  disabled={isLoadingAudio}
                >
                  {isLoadingAudio ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      <span className="hidden sm:inline">生成中</span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                        />
                      </svg>
                      停止
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error shadow-lg mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Floating Selection Toolbar - Only show when text is selected */}
      {readingMode === "selection" && result && selectedText && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-accent text-accent-content rounded-full shadow-2xl px-6 py-3 flex items-center gap-3 backdrop-blur-md">
            <span className="text-sm font-medium hidden sm:inline">
              已選 {selectedText.length} 字
            </span>
            <div className="h-4 w-px bg-accent-content/30 hidden sm:block"></div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={speakSelection}
                className="btn btn-sm btn-circle bg-accent-content text-accent hover:bg-accent-content/90 border-0 tooltip tooltip-top"
                data-tip="朗讀 (Ctrl+S)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={translateText}
                disabled={isTranslating}
                className="btn btn-sm btn-circle bg-accent-content text-accent hover:bg-accent-content/90 border-0 tooltip tooltip-top"
                data-tip="翻譯 (Ctrl+T)"
              >
                {isTranslating ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedText("");
                  setTranslatedText("");
                  setTranslateError(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="btn btn-sm btn-circle bg-accent-content/20 text-accent-content hover:bg-accent-content/30 border-0 tooltip tooltip-top"
                data-tip="清除 (ESC)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Translation Result Popup */}
          {translatedText && (
            <div className="mt-3 bg-base-100 rounded-lg shadow-2xl p-4 max-w-md mx-auto animate-in slide-in-from-bottom-2">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-sm flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    />
                  </svg>
                  翻譯結果
                </h4>
                <button
                  type="button"
                  onClick={() => setTranslatedText("")}
                  className="btn btn-ghost btn-xs btn-circle"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm leading-relaxed">{translatedText}</p>
            </div>
          )}

          {translateError && (
            <div className="mt-3 bg-error/10 text-error rounded-lg shadow-2xl p-3 max-w-md mx-auto">
              <p className="text-xs">{translateError}</p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* File Info */}
          <div className="stats stats-vertical sm:stats-horizontal shadow-xl w-full bg-base-100">
            <div className="stat">
              <div className="stat-figure text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-8 h-8 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <div className="stat-title">檔案名稱</div>
              <div className="stat-value text-primary text-lg sm:text-2xl break-all">
                {result.filename}
              </div>
            </div>

            <div className="stat">
              <div className="stat-figure text-secondary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-8 h-8 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  ></path>
                </svg>
              </div>
              <div className="stat-title">總頁數</div>
              <div className="stat-value text-secondary">
                {result.total_pages}
              </div>
              <div className="stat-desc">已成功解析</div>
            </div>

            {/* Removed current page navigation: per-page layout makes it unnecessary */}
          </div>

          {/* PDF and Text Side by Side */}
          {pdfUrl && (
            <div className="card bg-base-100 shadow-xl h-full">
              <div className="card-body p-0">
                <PdfViewer
                  url={pdfUrl}
                  pagesByNumber={pagesByNumber}
                  readingMode={readingMode}
                  onSpeak={speak}
                  onStopSpeaking={stopSpeaking}
                  onTextSelection={handleTextSelection}
                  isLoadingAudio={isLoadingAudio}
                />
              </div>
            </div>
          )}

          {/* All Pages Overview (when no PDF URL) */}
          {!pdfUrl && (
            <div className="space-y-6">
              {result.pages.map((p) => (
                <PageTextArea
                  key={p.page_number}
                  pageNumber={p.page_number}
                  text={p.text || ""}
                  textLength={p.text_length}
                  readingMode={readingMode}
                  onSpeak={speak}
                  onStopSpeaking={stopSpeaking}
                  onTextSelection={handleTextSelection}
                  isLoadingAudio={isLoadingAudio}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PdfReader;
