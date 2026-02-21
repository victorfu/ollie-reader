import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import type { TravelScene } from "../../types/travelEnglish";
import type { useTravelProgress } from "../../hooks/useTravelProgress";

interface WordExplorerProps {
  scene: TravelScene;
  onBack: () => void;
  speak: (text: string) => void;
  travelProgress: ReturnType<typeof useTravelProgress>;
}

export function WordExplorer({ scene, onBack, speak, travelProgress }: WordExplorerProps) {
  const { getSceneProgress, markWordLearned } = travelProgress;
  const sp = getSceneProgress(scene.id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  const vocab = scene.vocabulary;
  const current = vocab[currentIndex];
  const learnedCount = sp.wordsLearned.length;
  const allLearned = learnedCount >= vocab.length;

  const goNext = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex < vocab.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, vocab.length]);

  const goPrev = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleKnown = () => {
    markWordLearned(scene.id, current.word);
    if (currentIndex < vocab.length - 1) {
      goNext();
    } else if (learnedCount + 1 >= vocab.length) {
      setShowCompletion(true);
    }
  };

  if (showCompletion || allLearned) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <motion.span
          className="text-6xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          🎉
        </motion.span>
        <p className="text-2xl font-bold">太棒了！</p>
        <p className="text-base-content/60">你學會了所有單字！</p>
        <p className="text-sm text-base-content/40">
          You learned all {vocab.length} words!
        </p>
        <button
          type="button"
          className="btn btn-primary min-h-[44px] mt-4"
          onClick={onBack}
        >
          ← 返回任務
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-1.5 min-h-[44px]"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <span className="text-sm text-base-content/60">
          {currentIndex + 1} / {vocab.length} 單字
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
          animate={{ width: `${((currentIndex + 1) / vocab.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Flashcard */}
      <div className="flex justify-center py-4">
        <div
          className="relative w-full max-w-sm cursor-pointer"
          style={{ perspective: "1000px", minHeight: "280px" }}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <AnimatePresence mode="wait">
            {!isFlipped ? (
              <motion.div
                key={`front-${currentIndex}`}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -180, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[16px] border border-black/5 dark:border-white/10 shadow-lg min-h-[280px] ${scene.colorClass}`}
              >
                <span className="text-5xl">{current.emoji}</span>
                <p className="text-3xl font-bold mt-2">{current.word}</p>
                {current.phonetic && (
                  <p className="text-sm text-base-content/50">[{current.phonetic}]</p>
                )}
                <p className="text-xs text-base-content/40 mt-4">
                  👆 Tap to flip
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`back-${currentIndex}`}
                initial={{ rotateY: -180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 180, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-[16px] border border-black/5 dark:border-white/10 shadow-lg bg-base-100 min-h-[280px]"
              >
                <p className="text-2xl font-semibold">{current.chinese}</p>
                {current.example && (
                  <div className="mt-3 text-center">
                    <p className="text-base italic text-base-content/70">
                      &ldquo;{current.example}&rdquo;
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-2 min-h-[44px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(current.example!);
                      }}
                      aria-label="播放例句"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center gap-1">
        {vocab.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentIndex ? "bg-blue-500" : "bg-base-300"
            }`}
          />
        ))}
      </div>

      {/* Nav arrows */}
      <div className="flex justify-between items-center px-4">
        <button
          type="button"
          className="btn btn-ghost btn-sm min-h-[44px]"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-5 h-5" /> 上一個
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm min-h-[44px]"
          onClick={goNext}
          disabled={currentIndex === vocab.length - 1}
        >
          下一個 <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Self-assessment buttons */}
      <div className="flex justify-center gap-3 px-4">
        <button
          type="button"
          className="btn btn-outline btn-sm flex-1 max-w-[180px] min-h-[44px]"
          onClick={goNext}
        >
          😕 再看
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1 max-w-[180px] min-h-[44px]"
          onClick={handleKnown}
        >
          👍 我會了！
        </button>
      </div>

      {/* Phrase cards */}
      {scene.phrases.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold mb-3">
            常用句型 <span className="text-sm font-normal text-base-content/50">Key Phrases</span>
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {scene.phrases.map((phrase) => (
              <button
                key={phrase.id}
                type="button"
                className="flex-shrink-0 w-64 p-3 rounded-[10px] border border-black/5 dark:border-white/10 bg-base-100 shadow-sm text-left min-h-[44px]"
                onClick={() => speak(phrase.english)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{phrase.english}</p>
                    <p className="text-xs text-base-content/50 mt-0.5">{phrase.chinese}</p>
                    {phrase.situation && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-base-200 text-base-content/50">
                        {phrase.situation}
                      </span>
                    )}
                  </div>
                  <Volume2 className="w-4 h-4 text-base-content/30 flex-shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
