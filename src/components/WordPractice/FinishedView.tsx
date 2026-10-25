import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { PartyPopper } from "lucide-react";
import type { Homework } from "../../types/wordPractice";
import { gradeDictation } from "../../utils/homeworkFlow";

interface FinishedViewProps {
  homework: Homework;
  onBack: () => void;
  onAgain?: () => void;
}

/** The finished screen: the dictation score, and every new word's phrase and sentence for the parent. */
export function FinishedView({ homework, onBack, onAgain }: FinishedViewProps) {
  const result = homework.result ?? gradeDictation(homework);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (result.total > 0 && result.correctCount === result.total) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }
  }, [result.correctCount, result.total]);

  const score = result.total === 0 ? "這次沒有聽寫成績" : `聽寫 ${result.correctCount} / ${result.total}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <PartyPopper className="size-10 text-accent" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-2xl font-semibold">寫完了！</h2>
        <p className="text-lg">{score}</p>
      </div>

      {homework.newWords.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">造詞和造句（給家長看）</h3>
          <ul className="space-y-2">
            {homework.newWords.map((word, i) => {
              const page = homework.pages[i];
              return (
                <li key={word.key} className="rounded-[10px] border border-border-hairline px-4 py-3">
                  <p className="font-semibold">{word.word}</p>
                  <p className="text-sm">{page?.phrase ?? "（沒有寫）"}</p>
                  <p className="text-sm">{page?.sentence ?? "（沒有寫）"}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onBack} className="btn btn-primary min-h-11 active:scale-[0.98]">
          回首頁
        </button>
        {onAgain && (
          <button type="button" onClick={onAgain} className="btn btn-outline min-h-11 active:scale-[0.98]">
            再來一份
          </button>
        )}
      </div>
    </div>
  );
}
