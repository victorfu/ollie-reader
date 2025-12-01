import { useState, useCallback } from "react";
import { useSpeechState } from "../../hooks/useSpeechState";

interface ClickableWordsProps {
  text: string;
  getWordDefinition: (word: string) => Promise<string | null>;
}

export const ClickableWords = ({
  text,
  getWordDefinition,
}: ClickableWordsProps) => {
  const { speak } = useSpeechState();
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    async (word: string, event: React.MouseEvent) => {
      event.stopPropagation();

      const clean = cleanWord(word);
      if (!clean) return;

      // Speak the word
      speak(clean);

      // If clicking the same word, toggle off
      if (activeWord === word) {
        setActiveWord(null);
        setDefinition(null);
        return;
      }

      setActiveWord(word);
      setDefinition(null);
      setIsLoading(true);

      try {
        const def = await getWordDefinition(clean);
        setDefinition(def);
      } catch (error) {
        console.error("Failed to get definition:", error);
        setDefinition("無法取得解釋");
      } finally {
        setIsLoading(false);
      }
    },
    [speak, getWordDefinition, activeWord],
  );

  const handleCloseDropdown = useCallback(() => {
    setActiveWord(null);
    setDefinition(null);
  }, []);

  const words = splitTextIntoWords(text);

  return (
    <span className="inline">
      {words.map((word, index) => {
        const isActive = activeWord === word;
        const clean = cleanWord(word);
        const isClickable = clean.length > 0;

        return (
          <span key={index} className="relative inline-block">
            <span
              onClick={
                isClickable ? (e) => handleWordClick(word, e) : undefined
              }
              className={`
                ${
                  isClickable
                    ? "cursor-pointer hover:bg-primary/20 hover:text-primary rounded px-0.5 transition-colors"
                    : ""
                }
                ${isActive ? "bg-primary/30 text-primary rounded px-0.5" : ""}
              `}
            >
              {word}
            </span>
            {index < words.length - 1 && " "}

            {/* DaisyUI Dropdown for definition */}
            {isActive && (
              <div className="absolute left-0 top-full z-50 mt-1">
                <div className="card bg-base-200 shadow-xl min-w-[200px] max-w-[300px]">
                  <div className="card-body p-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-primary">{clean}</span>
                      <button
                        type="button"
                        onClick={handleCloseDropdown}
                        className="btn btn-ghost btn-xs btn-circle"
                      >
                        ✕
                      </button>
                    </div>
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-base-content/60">
                        <span className="loading loading-spinner loading-xs"></span>
                        查詢中...
                      </div>
                    ) : definition ? (
                      <p className="text-sm text-base-content/80">
                        {definition}
                      </p>
                    ) : (
                      <p className="text-sm text-base-content/60">
                        無法取得解釋
                      </p>
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
