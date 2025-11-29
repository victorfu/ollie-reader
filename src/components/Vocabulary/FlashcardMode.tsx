import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { VocabularyWord } from "../../types/vocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";

interface FlashcardModeProps {
  words: VocabularyWord[];
  onClose: () => void;
  onUpdateReview: (wordId: string) => void;
}

export const FlashcardMode = ({
  words: initialWords,
  onClose,
  onUpdateReview,
}: FlashcardModeProps) => {
  const [cards, setCards] = useState<VocabularyWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const { speak, stopSpeaking, isSpeaking } = useSpeechState();

  // Shuffle words on mount
  useEffect(() => {
    const shuffled = [...initialWords].sort(() => Math.random() - 0.5);
    setCards(shuffled);
  }, [initialWords]);

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (!isFlipped && currentCard) {
      // Auto-play audio when flipping to back (optional, maybe better on demand)
      // speak(currentCard.word); 
    }
  };

  const handleNext = useCallback(
    (remembered: boolean) => {
      if (remembered && currentCard?.id) {
        onUpdateReview(currentCard.id);
      }

      stopSpeaking();
      setIsFlipped(false);
      setReviewedCount((prev) => prev + 1);

      if (currentIndex < cards.length - 1) {
        setTimeout(() => setCurrentIndex((prev) => prev + 1), 200);
      } else {
        setIsFinished(true);
      }
    },
    [currentIndex, cards.length, currentCard, onUpdateReview, stopSpeaking],
  );

  const handleRestart = () => {
    const shuffled = [...initialWords].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
    setReviewedCount(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      
      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (e.code === "ArrowRight" && isFlipped) {
        handleNext(true); // Treat right arrow as "Remembered" for quick nav
      } else if (e.code === "ArrowLeft" && isFlipped) {
        handleNext(false); // Treat left arrow as "Forgot"
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, isFinished, handleNext]);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-lg text-base-content/70">沒有單字可以複習</p>
        <button className="btn btn-primary mt-4" onClick={onClose}>
          返回
        </button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-base-100 rounded-xl shadow-lg max-w-2xl mx-auto mt-8">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold mb-4">複習完成！</h2>
        <p className="text-xl mb-8">
          你已經複習了 {reviewedCount} 個單字。
        </p>
        <div className="flex gap-4">
          <button className="btn btn-outline" onClick={onClose}>
            返回列表
          </button>
          <button className="btn btn-primary" onClick={handleRestart}>
            再次複習
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-base-200/95 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-4 right-4">
        <button className="btn btn-circle btn-ghost" onClick={onClose}>
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between text-sm font-medium text-base-content/60">
        <span>進度</span>
        <span>
          {currentIndex + 1} / {cards.length}
        </span>
      </div>
      <progress
        className="progress progress-primary w-full max-w-md mb-8"
        value={currentIndex}
        max={cards.length}
      ></progress>

      {/* Card Container */}
      <div className="perspective-1000 w-full max-w-md h-[400px] cursor-pointer group" onClick={handleFlip}>
        <motion.div
          className="relative w-full h-full transition-all duration-500 preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-base-100 rounded-2xl shadow-xl flex flex-col items-center justify-center p-8 border-2 border-base-200">
            <span className="text-sm uppercase tracking-widest text-base-content/40 mb-4">
              單字
            </span>
            {currentCard?.emoji && (
              <div className="text-8xl mb-6 animate-bounce-slow">
                {currentCard.emoji}
              </div>
            )}
            <h2 className="text-4xl font-bold text-center mb-4 break-words w-full">
              {currentCard?.word}
            </h2>
            {currentCard?.phonetic && (
              <p className="text-xl text-base-content/60 font-serif">
                {currentCard.phonetic}
              </p>
            )}
            <div className="mt-8 text-sm text-base-content/40 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              點擊翻看背面
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 backface-hidden bg-base-100 rounded-2xl shadow-xl flex flex-col p-8 border-2 border-primary/20 overflow-y-auto"
            style={{ transform: "rotateY(180deg)" }}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm uppercase tracking-widest text-primary/60">
                釋義
              </span>
              <button
                className="btn btn-circle btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  speak(currentCard?.word || "");
                }}
              >
                {isSpeaking ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="flex-1 space-y-4">
              {currentCard?.definitions.map((def, idx) => (
                <div key={idx} className="text-left">
                  <span className="badge badge-sm badge-ghost mr-2 align-middle">
                    {def.partOfSpeech}
                  </span>
                  <span className="font-medium text-lg align-middle">
                    {def.definitionChinese || def.definition}
                  </span>
                </div>
              ))}

              {currentCard?.examples && currentCard.examples.length > 0 && (
                <div className="mt-6 pt-4 border-t border-base-200">
                  <p className="text-xs text-base-content/50 mb-2">例句</p>
                  <p className="italic text-base-content/80">
                    "{currentCard.examples[0].sentence}"
                  </p>
                  {currentCard.examples[0].translation && (
                    <p className="text-sm text-base-content/60 mt-1">
                      {currentCard.examples[0].translation}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex gap-4 w-full max-w-md justify-center h-16">
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.button
              key="flip-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="btn btn-wide btn-lg shadow-lg"
              onClick={handleFlip}
            >
              翻看背面 (Space)
            </motion.button>
          ) : (
            <motion.div
              key="action-btns"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex gap-4 w-full"
            >
              <button
                className="btn btn-error btn-outline flex-1 btn-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext(false);
                }}
              >
                忘記了
              </button>
              <button
                className="btn btn-success flex-1 btn-lg text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext(true);
                }}
              >
                記住了
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
