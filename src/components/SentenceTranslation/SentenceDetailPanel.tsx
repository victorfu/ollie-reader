import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useSpeechState } from "../../hooks/useSpeechState";
import type { SentenceTranslation } from "../../types/sentenceTranslation";
import { SpeakerIcon } from "../icons";

export interface SentenceDetailPanelProps {
  sentence: SentenceTranslation;
  onAddKeyWord: (
    word: string,
  ) => Promise<{ success: boolean; existed?: boolean; message?: string }>;
}

/** Detail view for a translated sentence: full text, translation, key words. */
export const SentenceDetailPanel = ({
  sentence,
  onAddKeyWord,
}: SentenceDetailPanelProps) => {
  const { speak, isSpeaking, stopSpeaking } = useSpeechState();
  // addWord aborts any previous in-flight AI request, so chip adds are
  // serialized: while one is pending all chips are disabled.
  const [pendingWord, setPendingWord] = useState<string | null>(null);
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speak(sentence.english);
    }
  };

  const handleAddKeyWord = async (word: string) => {
    if (pendingWord) return;
    setPendingWord(word);
    try {
      const result = await onAddKeyWord(word);
      if (result.success) {
        setAddedWords((prev) => new Set(prev).add(word.toLowerCase()));
      }
    } finally {
      setPendingWord(null);
    }
  };

  const keyWords = sentence.keyWords ?? [];

  return (
    <div className="h-full">
      {/* Header — mirrors WordDetailPanel: speak button hugs the text */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {sentence.english}
            </h2>
            <button
              type="button"
              onClick={handleSpeak}
              className="btn btn-circle btn-sm btn-ghost shrink-0"
              title={isSpeaking ? "停止朗讀" : "朗讀句子"}
            >
              <SpeakerIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Translation */}
      <div className="mb-6">
        <h3 className="mb-3 text-lg font-semibold">🌐 中文翻譯</h3>
        <p className="border-l-4 border-accent pl-4 text-base leading-relaxed">
          {sentence.chinese}
        </p>
      </div>

      {/* Key words */}
      {keyWords.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-1 text-lg font-semibold">⭐ 重點單字</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            點一下把單字加入生詞本
          </p>
          <div className="flex flex-wrap gap-2">
            {keyWords.map((keyWord) => {
              const added = addedWords.has(keyWord.word.toLowerCase());
              const isPending = pendingWord === keyWord.word;
              return (
                <button
                  key={keyWord.word}
                  type="button"
                  disabled={added || pendingWord !== null}
                  onClick={() => handleAddKeyWord(keyWord.word)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm shadow-soft transition-all active:scale-[0.98] ${
                    added
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border-hairline bg-background/70 hover:border-accent/50 hover:bg-accent-tint disabled:opacity-60"
                  }`}
                  title={added ? "已在生詞本" : `把 ${keyWord.word} 加入生詞本`}
                >
                  {isPending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : added ? (
                    <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  )}
                  <span className="font-semibold">{keyWord.word}</span>
                  <span
                    className={added ? "text-success/80" : "text-muted-foreground"}
                  >
                    {keyWord.meaning}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats surface-card w-full rounded-xl">
        <div className="stat">
          <div className="stat-title">加入時間</div>
          <div className="stat-value text-lg">
            {new Date(sentence.createdAt).toLocaleString("zh-TW", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
