import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

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

const API_URL =
  "https://purism-ev-bot-1027147244019.asia-east1.run.app/api/pdf/extract";

function PdfReader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResponse | null>(null);

  const [speechRate, setSpeechRate] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
    setResult(null);

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

  const handleFileChange = useCallback((file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError("請上傳 PDF 檔案 (application/pdf)");
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
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

  const stopSpeaking = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const pickEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!speechSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
    return en ?? null;
  }, [speechSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported) return;
      if (!text.trim()) return;
      const voice = pickEnglishVoice();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang || "en-US";
      utterance.voice = voice || null;
      utterance.rate = speechRate;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [pickEnglishVoice, speechRate, speechSupported],
  );

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
            onClick={() => speak(word)}
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
        <div className="whitespace-pre-wrap leading-relaxed text-left">
          {nodes}
        </div>
      );
    },
    [speak],
  );

  const header = useMemo(() => {
    return (
      <div className="text-center mb-8 lg:mb-12">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
          📚 Ollie Reader
        </h1>
        <p className="text-base sm:text-lg text-base-content/70 max-w-2xl mx-auto px-4">
          上傳 PDF 文件，自動解析英文文字，點擊任何單字即可朗讀發音
        </p>
      </div>
    );
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {header}

      {/* Upload Area */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body p-4 sm:p-6 lg:p-8">
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <button
              type="button"
              disabled={!selectedFile || isUploading}
              onClick={uploadAndExtract}
              className="btn btn-primary btn-lg gap-2"
            >
              {isUploading ? (
                <>
                  <span className="loading loading-spinner"></span>
                  解析中...
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  重新解析
                </>
              )}
            </button>
            {isUploading && (
              <button
                type="button"
                onClick={cancelUpload}
                className="btn btn-error btn-outline btn-lg"
              >
                取消
              </button>
            )}
          </div>

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

      {/* TTS Controls */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body p-4 sm:p-6">
          <h3 className="card-title text-lg sm:text-xl mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
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
            朗讀設定
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 w-full">
              <label className="label">
                <span className="label-text">朗讀速度</span>
                <span className="label-text-alt badge badge-primary">
                  {speechRate.toFixed(1)}x
                </span>
              </label>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="range range-primary"
              />
              <div className="w-full flex justify-between text-xs px-2 mt-1 text-base-content/60">
                <span>慢速</span>
                <span>正常</span>
                <span>快速</span>
              </div>
            </div>
            <button
              type="button"
              onClick={stopSpeaking}
              disabled={!isSpeaking}
              className="btn btn-error btn-outline w-full sm:w-auto"
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
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              停止朗讀
            </button>
          </div>
        </div>
      </div>

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
          </div>

          {/* Pages */}
          <div className="space-y-6">
            {result.pages.map((p) => (
              <div key={p.page_number} className="card bg-base-100 shadow-xl">
                <div className="card-body p-4 sm:p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <h3 className="card-title text-xl sm:text-2xl">
                      <span className="badge badge-primary badge-lg">
                        Page {p.page_number}
                      </span>
                      <span className="text-sm text-base-content/60 font-normal ml-2">
                        {p.text_length} 字符
                      </span>
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => speak(p.text)}
                        className="btn btn-success btn-sm sm:btn-md gap-2"
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
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        朗讀整頁
                      </button>
                      <button
                        type="button"
                        onClick={stopSpeaking}
                        className="btn btn-ghost btn-sm sm:btn-md"
                      >
                        停止
                      </button>
                    </div>
                  </div>
                  <div className="divider my-2"></div>
                  <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none">
                    {renderTextWithClickableWords(p.text || "")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfReader;
