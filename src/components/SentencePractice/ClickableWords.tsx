import { useState, useCallback, useEffect, useRef } from "react";
import { useSpeechState } from "../../hooks/useSpeechState";
import { isGeminiRateLimitError } from "../../services/geminiErrorPolicy";

interface ClickableWordsProps {
  text: string;
  getWordDefinition: (
    word: string,
    signal?: AbortSignal,
  ) => Promise<string | null>;
}

export const ClickableWords = ({
  text,
  getWordDefinition,
}: ClickableWordsProps) => {
  const { speak } = useSpeechState();
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const activeWordIndexRef = useRef<number | null>(null);
  const lookupRequestIdRef = useRef(0);
  const lookupControllerRef = useRef<AbortController | null>(null);

  // Split text into words while preserving punctuation
  const splitTextIntoWords = (text: string): string[] => {
    // Split by spaces but keep punctuation attached to words
    return text.split(/\s+/).filter((word) => word.length > 0);
  };

  // Extract clean word without punctuation for lookup
  const cleanWord = (word: string): string => {
    return word.replace(/[^\w'-]/g, "").toLowerCase();
  };

  const handleWordClick = useCallback(
    async (word: string, index: number, event: React.MouseEvent) => {
      event.stopPropagation();

      const clean = cleanWord(word);
      if (!clean) return;

      // Speak the word
      speak(clean);

      // If clicking the same word index, toggle off
      if (activeWordIndexRef.current === index) {
        lookupControllerRef.current?.abort();
        lookupControllerRef.current = null;
        lookupRequestIdRef.current += 1;
        activeWordIndexRef.current = null;
        setActiveWordIndex(null);
        setDefinition(null);
        setIsLoading(false);
        return;
      }

      const requestId = ++lookupRequestIdRef.current;
      lookupControllerRef.current?.abort();
      const controller = new AbortController();
      lookupControllerRef.current = controller;
      activeWordIndexRef.current = index;
      setActiveWordIndex(index);
      setDefinition(null);
      setIsLoading(true);

      try {
        const def = await getWordDefinition(clean, controller.signal);
        if (requestId !== lookupRequestIdRef.current) return;
        setDefinition(def);
      } catch (error) {
        if (requestId !== lookupRequestIdRef.current) return;
        console.error("Failed to get definition:", error);
        setDefinition(
          isGeminiRateLimitError(error) ? error.message : "無法取得解釋",
        );
      } finally {
        if (requestId === lookupRequestIdRef.current) {
          lookupControllerRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [speak, getWordDefinition],
  );

  const handleCloseDropdown = useCallback(() => {
    lookupControllerRef.current?.abort();
    lookupControllerRef.current = null;
    lookupRequestIdRef.current += 1;
    activeWordIndexRef.current = null;
    setActiveWordIndex(null);
    setDefinition(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    lookupControllerRef.current?.abort();
    lookupControllerRef.current = null;
    lookupRequestIdRef.current += 1;
    activeWordIndexRef.current = null;
    setActiveWordIndex(null);
    setDefinition(null);
    setIsLoading(false);
  }, [text]);

  useEffect(
    () => () => {
      lookupControllerRef.current?.abort();
    },
    [],
  );

  const words = splitTextIntoWords(text);

  return (
    <span className="inline">
      {words.map((word, index) => {
        const isActive = activeWordIndex === index;
        const clean = cleanWord(word);
        const isClickable = clean.length > 0;

        return (
          <span key={index} className="relative inline-block">
            <span
              onClick={
                isClickable ? (e) => handleWordClick(word, index, e) : undefined
              }
              className={`
                ${
                  isClickable
                    ? "cursor-pointer rounded-md px-0.5 transition-colors duration-150 hover:bg-accent-tint hover:text-accent"
                    : ""
                }
                ${isActive ? "bg-accent-tint text-accent rounded-md px-0.5" : ""}
              `}
            >
              {word}
            </span>
            {index < words.length - 1 && <span className="whitespace-pre"> </span>}

            {/* DaisyUI Dropdown for definition */}
            {isActive && (
              <div className="absolute left-0 top-full z-50 mt-1">
                <div className="glass rounded-xl shadow-floating min-w-[200px] max-w-[300px]">
                  <div className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-accent">{clean}</span>
                      <button
                        type="button"
                        onClick={handleCloseDropdown}
                        className="btn btn-ghost btn-xs btn-circle active:scale-[0.98]"
                      >
                        ✕
                      </button>
                    </div>
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="loading loading-spinner loading-xs"></span>
                        查詢中...
                      </div>
                    ) : definition ? (
                      <span className="text-sm text-foreground/90">
                        {definition}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        無法取得解釋
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </span>
        );
      })}
    </span>
  );
};
