import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { VocabularyWord } from "../../types/vocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";
import { usePronunciation } from "../../hooks/usePronunciation";
import { shuffleArray } from "../../utils/arrayUtils";

interface FlashcardModeProps {
  words: VocabularyWord[];
  onClose: () => void;
  onUpdateReview: (wordId: string, remembered: boolean) => void;
}

interface ReviewStats {
  remembered: number;
  forgot: number;
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
  const [stats, setStats] = useState<ReviewStats>({
    remembered: 0,
    forgot: 0,
  });
  const [showFeedback, setShowFeedback] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayIndexRef = useRef<number>(0);
  const wasPlayingRef = useRef(false);

  const { speak, stopSpeaking, isSpeaking } = useSpeechState();

  const currentCard = cards[currentIndex];

  const handlePronunciationMatch = useCallback(() => {
    setShowFeedback("correct");
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"],
    });

    setTimeout(() => {
      setShowFeedback(null);
    }, 2000);
  }, []);

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: isSpeechRecognitionSupported,
  } = usePronunciation(currentCard?.word || "", handlePronunciationMatch);

  // Set cards on mount (already shuffled by service layer)
  useEffect(() => {
    setCards(initialWords);
  }, [initialWords]);

  // Auto-play: speak words one by one
  useEffect(() => {
    if (!isAutoPlaying) return;

    // Detect when speech ends (isSpeaking transitions from true to false)
    if (wasPlayingRef.current && !isSpeaking) {
      // Speech just ended, move to next word after a short delay
      const nextIndex = autoPlayIndexRef.current + 1;
      if (nextIndex < cards.length) {
        const timer = setTimeout(() => {
          autoPlayIndexRef.current = nextIndex;
          setCurrentIndex(nextIndex);
          setIsFlipped(false);
          // Speak the next word
          if (cards[nextIndex]) {
            speak(cards[nextIndex].word);
          }
        }, 500); // 500ms delay between words
        return () => clearTimeout(timer);
      } else {
        // Finished all words
        setIsAutoPlaying(false);
      }
    }

    wasPlayingRef.current = isSpeaking;
  }, [isSpeaking, isAutoPlaying, cards, speak]);

  const handleStartAutoPlay = useCallback(() => {
    if (cards.length === 0) return;
    stopListening();
    setIsAutoPlaying(true);
    autoPlayIndexRef.current = 0;
    setCurrentIndex(0);
    setIsFlipped(false);
    wasPlayingRef.current = false;
    // Start speaking the first word
    if (cards[0]) {
      speak(cards[0].word);
    }
  }, [cards, speak, stopListening]);

  const handleStopAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    stopSpeaking();
  }, [stopSpeaking]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const goToNext = useCallback(() => {
    stopSpeaking();
    stopListening();
    setIsFlipped(false);
    setShowFeedback(null);

    if (currentIndex < cards.length - 1) {
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 200);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, cards.length, stopSpeaking, stopListening]);

  const handleNext = useCallback(
    (remembered: boolean) => {
      if (currentCard?.id) {
        onUpdateReview(currentCard.id, remembered);
      }

      setStats((prev) => ({
        ...prev,
        remembered: remembered ? prev.remembered + 1 : prev.remembered,
        forgot: !remembered ? prev.forgot + 1 : prev.forgot,
      }));

      goToNext();
    },
    [currentCard, onUpdateReview, goToNext],
  );

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      stopSpeaking();
      stopListening();
      setIsFlipped(false);
      setShowFeedback(null);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex, stopSpeaking, stopListening]);

  const handleNextCard = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      stopSpeaking();
      stopListening();
      setIsFlipped(false);
      setShowFeedback(null);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, cards.length, stopSpeaking, stopListening]);

  const handleRestart = () => {
    setCards(shuffleArray(initialWords));
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
    setStats({ remembered: 0, forgot: 0 });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;

      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (e.code === "ArrowRight" && isFlipped) {
        handleNext(true);
      } else if (e.code === "ArrowLeft" && isFlipped) {
        handleNext(false);
      } else if (e.code === "ArrowUp" && !isFlipped) {
        handlePrev();
      } else if (e.code === "ArrowDown" && !isFlipped) {
        handleNextCard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isFlipped,
    isFinished,
    handleNext,
    handleFlip,
    handlePrev,
    handleNextCard,
  ]);

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

  const totalReviewed = stats.remembered + stats.forgot;

  if (isFinished) {
    return (
      <div className="fixed inset-0 z-50 bg-base-200/95 flex items-center justify-center p-4">
        <div className="bg-base-100 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-bold mb-6">複習完成！</h2>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-success/10 rounded-xl p-4">
              <div className="text-3xl font-bold text-success">
                {stats.remembered}
              </div>
              <div className="text-sm text-base-content/60">記住了</div>
            </div>
            <div className="bg-error/10 rounded-xl p-4">
              <div className="text-3xl font-bold text-error">
                {stats.forgot}
              </div>
              <div className="text-sm text-base-content/60">忘記了</div>
            </div>
          </div>

          {/* Encouragement based on performance */}
          <p className="text-base-content/70 mb-8">
            {totalReviewed === 0
              ? "下次試著多複習幾個單字吧！"
              : stats.remembered >= totalReviewed * 0.8
              ? "太棒了！你記得大部分的單字 👏"
              : stats.remembered >= totalReviewed * 0.5
              ? "做得不錯！繼續加油 💪"
              : "沒關係，多練習幾次就會記住了！"}
          </p>

          <div className="flex gap-3">
            <button className="btn btn-outline flex-1" onClick={onClose}>
              返回列表
            </button>
            <button className="btn btn-primary flex-1" onClick={handleRestart}>
              再次複習
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-base-200/95 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Auto-play button */}
        <button
          className={`btn btn-circle ${
            isAutoPlaying ? "btn-error" : "btn-ghost"
          }`}
          onClick={isAutoPlaying ? handleStopAutoPlay : handleStartAutoPlay}
          title={isAutoPlaying ? "停止自動播放" : "自動播放全部單字"}
        >
          {isAutoPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 22v-20l18 10-18 10z" />
            </svg>
          )}
        </button>
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
      <div
        className="perspective-1000 w-full max-w-md h-[400px] cursor-pointer group"
        onClick={handleFlip}
      >
        <motion.div
          className="relative w-full h-full transition-all duration-500 preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{
            duration: 0.6,
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-base-100 rounded-2xl shadow-xl flex flex-col items-center justify-center p-8 border-2 border-base-200 overflow-hidden">
            <span className="text-sm uppercase tracking-widest text-base-content/40 mb-4 flex-shrink-0">
              單字
            </span>
            <h2 className="text-5xl sm:text-6xl font-bold text-center mb-2 break-words w-full flex-shrink-0">
              {currentCard?.word}
            </h2>
            {currentCard?.phonetic && (
              <p className="text-xl text-base-content/60 font-serif mb-4">
                {currentCard.phonetic}
              </p>
            )}

            {/* Play pronunciation button */}
            {!isFlipped && (
              <button
                className="btn btn-circle btn-ghost btn-lg mb-4"
                onClick={(e) => {
                  e.stopPropagation();
                  speak(currentCard?.word || "");
                }}
                title="播放發音"
              >
                {isSpeaking ? (
                  <span className="loading loading-spinner loading-md" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-primary"
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
                )}
              </button>
            )}

            {/* Pronunciation Practice */}
            {!isFlipped && isSpeechRecognitionSupported && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <button
                    className={`btn btn-circle btn-lg transition-all duration-300 ${
                      isListening
                        ? "btn-error animate-pulse scale-110 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        : "btn-secondary shadow-lg"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isListening) {
                        stopListening();
                      } else {
                        startListening();
                      }
                    }}
                    title="錄音練習"
                  >
                    {isListening ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-7 w-7"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-7 w-7"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="h-6 flex items-center justify-center">
                  {isListening ? (
                    <span className="text-sm text-base-content/60 animate-pulse">
                      請大聲唸出單字...
                    </span>
                  ) : showFeedback === "correct" ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-lg font-bold text-success flex items-center gap-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      太棒了！
                    </motion.span>
                  ) : transcript ? (
                    <span className="text-sm text-base-content/40">
                      聽到: "{transcript}"
                    </span>
                  ) : (
                    <span className="text-xs text-base-content/40">
                      點擊麥克風練習發音
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 text-sm text-base-content/40 flex items-center gap-2">
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
      <div className="mt-8 w-full max-w-md">
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front-btns"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-3"
            >
              <button
                className="btn btn-primary btn-lg w-full shadow-lg gap-2"
                onClick={handleFlip}
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                翻看答案
              </button>
              <div className="flex gap-2 justify-center">
                <button
                  className="btn btn-ghost btn-sm text-base-content/50 gap-1"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  上一個
                </button>
                <button
                  className="btn btn-ghost btn-sm text-base-content/50 gap-1"
                  onClick={handleNextCard}
                  disabled={currentIndex === cards.length - 1}
                >
                  下一個
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="action-btns"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex gap-3"
            >
              <button
                className="btn btn-outline flex-1 btn-lg gap-2 border-error/50 text-error hover:bg-error hover:text-white hover:border-error"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext(false);
                }}
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                忘記了
              </button>
              <button
                className="btn btn-success flex-1 btn-lg text-white gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext(true);
                }}
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                記住了
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
