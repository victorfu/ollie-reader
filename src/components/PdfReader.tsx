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
    // Warm-up voices for better first-use selection in some browsers
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
      // Heuristic for CORS
      if (/Failed to fetch|CORS/i.test(message)) {
        setError("連線失敗或 CORS 問題，請稍後再試。");
      } else {
        setError(message);
      }
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile]);

  // Auto-extract when file is selected
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
      // Preserve original whitespace and newlines while making words clickable
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
            className="inline px-1 rounded cursor-pointer hover:bg-yellow-300/70 dark:hover:bg-yellow-300/20 focus:outline-none focus:ring focus:ring-yellow-400"
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
        <div className="whitespace-pre-wrap leading-relaxed text-left text-gray-100">
          {nodes}
        </div>
      );
    },
    [speak],
  );

  const header = useMemo(() => {
    return (
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">PDF Reader</h2>
        <p className="mt-2 text-gray-300">
          上傳 PDF，呼叫 API 解析英文文字，點擊單字即可發音。
        </p>
      </div>
    );
  }, []);

  return (
    <div className="max-w-5xl w-full mx-auto">
      {header}

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="border-2 border-dashed border-gray-600 rounded-xl p-6 bg-gray-800/50 text-center"
      >
        <input
          id="file"
          type="file"
          accept="application/pdf"
          onChange={onInputChange}
          className="hidden"
        />
        <label htmlFor="file" className="block">
          <div className="text-gray-200 font-medium cursor-pointer">
            {selectedFile ? selectedFile.name : "拖曳或點擊這裡選擇 PDF 檔"}
          </div>
          <div className="text-gray-400 text-sm mt-1">僅支援 .pdf</div>
        </label>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={uploadAndExtract}
            className="px-4 py-2 rounded-lg bg-blue-600 enabled:hover:bg-blue-700 disabled:opacity-50 text-white font-semibold"
          >
            {isUploading ? "上傳中…" : "解析 PDF 文字"}
          </button>
          {isUploading && (
            <button
              type="button"
              onClick={cancelUpload}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
            >
              取消
            </button>
          )}
        </div>
        {!speechSupported && (
          <div className="mt-4 text-yellow-300 text-sm">
            您的瀏覽器不支援語音朗讀 (Speech Synthesis)。
          </div>
        )}
      </div>

      {/* TTS controls */}
      <div className="mt-6 bg-gray-800/60 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <label className="text-gray-300 text-sm">
            朗讀速度：
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="ml-2 align-middle"
            />
            <span className="ml-2 text-gray-400">{speechRate.toFixed(1)}x</span>
          </label>
          <button
            type="button"
            onClick={stopSpeaking}
            disabled={!isSpeaking}
            className="px-3 py-1.5 rounded bg-red-600 enabled:hover:bg-red-700 disabled:opacity-50 text-white"
          >
            停止朗讀
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-900/40 text-red-200 border border-red-800 p-3 rounded-lg">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="text-gray-300">
            <div className="font-semibold">
              檔名：<span className="text-white">{result.filename}</span>
            </div>
            <div>總頁數：{result.total_pages}</div>
          </div>

          <div className="space-y-8">
            {result.pages.map((p) => (
              <div
                key={p.page_number}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-semibold text-white">
                    Page {p.page_number}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => speak(p.text)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      朗讀整頁
                    </button>
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      停止
                    </button>
                  </div>
                </div>
                {renderTextWithClickableWords(p.text || "")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfReader;
