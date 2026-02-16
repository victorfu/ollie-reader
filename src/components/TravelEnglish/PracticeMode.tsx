import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TravelPhrase, TravelDialogue, PracticeItem } from "../../types/travelEnglish";
import { SpeakerIcon } from "../icons";

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface PracticeModeProps {
  phrases: TravelPhrase[];
  dialogues: TravelDialogue[];
  speakAsync: (text: string) => Promise<void>;
  speak: (text: string) => void;
}

export function PracticeMode({ phrases, dialogues, speakAsync, speak }: PracticeModeProps) {
  const quizBank = useMemo(() => {
    const fromPhrases: PracticeItem[] = phrases.map((p) => ({
      english: p.english,
      chinese: p.chinese,
    }));
    const fromDialogues: PracticeItem[] = dialogues.flatMap((d) =>
      d.lines
        .filter((l) => l.speaker === "A")
        .map((l) => ({ english: l.english, chinese: l.chinese }))
    );
    const seen = new Set<string>();
    const combined: PracticeItem[] = [];
    for (const item of [...fromPhrases, ...fromDialogues]) {
      if (!seen.has(item.english)) {
        seen.add(item.english);
        combined.push(item);
      }
    }
    return combined;
  }, [phrases, dialogues]);

  const [items, setItems] = useState<PracticeItem[]>(() => shuffleArray(quizBank));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"ready" | "listen" | "try" | "reveal">("ready");
  const [isFinished, setIsFinished] = useState(false);

  // Re-shuffle when quiz bank changes
  useEffect(() => {
    setItems(shuffleArray(quizBank));
    setCurrentIndex(0);
    setPhase("ready");
    setIsFinished(false);
  }, [quizBank]);

  // Auto-play speech during "listen" phase
  useEffect(() => {
    if (phase !== "listen") return;
    let cancelled = false;
    speakAsync(items[currentIndex].english).then(() => {
      if (!cancelled) setPhase("try");
    });
    return () => { cancelled = true; };
  }, [phase, currentIndex]);

  const handleNext = () => {
    setCurrentIndex((i) => i + 1);
    setPhase("ready");
  };

  const handleRestart = () => {
    setItems(shuffleArray(quizBank));
    setCurrentIndex(0);
    setPhase("ready");
    setIsFinished(false);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/60">
        沒有可練習的題目
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <span className="text-6xl">🎉</span>
        <p className="text-2xl font-bold">太棒了！</p>
        <p className="text-base-content/60">你完成了 {items.length} 題練習</p>
        <button
          className="btn btn-primary btn-lg min-h-[44px]"
          onClick={handleRestart}
        >
          重新練習
        </button>
      </div>
    );
  }

  const isLast = currentIndex === items.length - 1;
  const current = items[currentIndex];

  return (
    <div className="flex flex-col gap-4">
      <progress
        className="progress progress-primary w-full"
        value={currentIndex}
        max={items.length}
      />
      <p className="text-sm text-base-content/60 text-center">
        第 {currentIndex + 1} / {items.length} 題
      </p>

      <div className="bg-base-100 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm p-6 text-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentIndex}-${phase}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {phase === "ready" && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xl">準備好了嗎？</p>
                <button
                  className="btn btn-primary btn-lg min-h-[44px]"
                  onClick={() => setPhase("listen")}
                >
                  <SpeakerIcon className="h-5 w-5" /> 聽英文
                </button>
              </div>
            )}

            {phase === "listen" && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xl">正在播放...</p>
                <span className="loading loading-dots loading-md" />
              </div>
            )}

            {phase === "try" && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xl">{current.chinese}</p>
                <p className="text-base-content/60">試著說出英文！</p>
                <div className="flex gap-2">
                  <button
                    className="btn btn-outline btn-sm min-h-[44px]"
                    onClick={() => setPhase("listen")}
                  >
                    <SpeakerIcon className="h-4 w-4" /> 再聽一次
                  </button>
                  <button
                    className="btn btn-primary min-h-[44px]"
                    onClick={() => setPhase("reveal")}
                  >
                    看答案 👀
                  </button>
                </div>
              </div>
            )}

            {phase === "reveal" && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-base-content/60">{current.chinese}</p>
                <p className="text-2xl font-bold text-primary mt-2">
                  {current.english}
                </p>
                <button
                  className="btn btn-ghost btn-sm min-h-[44px]"
                  onClick={() => speak(current.english)}
                >
                  <SpeakerIcon />
                </button>
                <div className="divider my-0" />
                {!isLast ? (
                  <button
                    className="btn btn-primary btn-lg w-full min-h-[44px]"
                    onClick={handleNext}
                  >
                    下一題 →
                  </button>
                ) : (
                  <button
                    className="btn btn-success btn-lg w-full min-h-[44px]"
                    onClick={() => setIsFinished(true)}
                  >
                    完成！🎉
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
