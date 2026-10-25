import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { PartyPopper } from "lucide-react";
import type { Homework } from "../../types/wordPractice";
import { gradeDictation } from "../../utils/homeworkFlow";

interface FinishedViewProps {
  homework: Homework;
  onBack: () => void;
  onAgain?: () => void;
  /** True only right after the homework was handed in; false when opened from the history. */
  celebrate?: boolean;
}

/** The finished screen: the dictation score, and every new word's sentence for the parent. */
export function FinishedView({ homework, onBack, onAgain, celebrate = false }: FinishedViewProps) {
  const result = homework.result ?? gradeDictation(homework);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (celebrate && result.total > 0 && result.correctCount === result.total) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, disableForReducedMotion: true });
    }
  }, [celebrate, result.correctCount, result.total]);

  const corrected = result.wrongKeys.flatMap((key) => {
    const item = homework.dictation.find((candidate) => candidate.key === key);
    const word = [...homework.newWords, ...homework.reviewWords].find((candidate) => candidate.key === key);
    return item && word ? [{ key, word: word.word, answer: item.answer }] : [];
  });

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
          <h3 className="text-base font-semibold">造句（給家長看）</h3>
          <ul className="space-y-2">
            {homework.newWords.map((word, i) => {
              const page = homework.pages[i];
              return (
                <li key={word.key} className="rounded-[10px] border border-border-hairline px-4 py-3">
                  <p className="font-semibold">{word.word}</p>
                  {/* Only homework written before the phrase step was dropped has one. */}
                  {page?.phrase && <p className="text-sm">{page.phrase}</p>}
                  <p className="text-sm">{page?.sentence ?? "（沒有寫）"}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {corrected.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">寫錯、已訂正的字</h3>
          <ul className="space-y-2">
            {corrected.map(({ key, word, answer }) => (
              <li
                key={key}
                className="flex flex-wrap items-baseline gap-x-3 rounded-[10px] border border-border-hairline px-4 py-3"
              >
                <span className="font-semibold">{word}</span>
                <span className="text-sm text-muted-foreground">你寫的：{answer ?? "（沒有寫）"}</span>
                <span className="text-sm text-success">已訂正</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onBack} className="btn btn-primary min-h-11 active:scale-[0.98]">
          回到首頁
        </button>
        {onAgain && (
          <button type="button" onClick={onAgain} className="btn btn-outline min-h-11 active:scale-[0.98]">
            再寫一份
          </button>
        )}
      </div>
    </div>
  );
}
