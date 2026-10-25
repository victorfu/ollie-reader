import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Coins, PartyPopper } from "lucide-react";
import type { HomeworkReward, HomeworkRewardItem } from "../../services/economyService";
import type { Homework, SentenceReview } from "../../types/wordPractice";
import { dictationAnswer, findDictationItem, gradeDictation, sentencesToReview } from "../../utils/homeworkFlow";
import { INFLECTION_LABEL } from "../../utils/inflection";

interface FinishedViewProps {
  homework: Homework;
  onBack: () => void;
  onAgain?: () => void;
  /** True only right after the homework was handed in; false when opened from the history. */
  celebrate?: boolean;
  /** Gemini review in progress or failed; absent when idle or done. */
  reviewState?: "reviewing" | "failed";
  /** Asks Gemini to review the sentences (again). Without it no review button is shown. */
  onReview?: () => void;
}

function rewardLabel(item: HomeworkRewardItem): string {
  switch (item.kind) {
    case "handIn":
      return "交作業";
    case "dictation":
      return `聽寫寫對 ${item.count ?? 0} 題`;
    case "perfect":
      return "聽寫全對";
    case "firstToday":
      return "今天第一份功課";
    case "streak":
      return `連續寫功課 ${item.count ?? 0} 天`;
  }
}

function RewardBox({ reward }: { reward: HomeworkReward }) {
  return (
    <section className="mx-auto w-full max-w-sm space-y-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <p className="flex items-center justify-center gap-2 text-lg font-semibold">
        <Coins className="size-5 text-warning" strokeWidth={1.75} aria-hidden="true" />
        獲得 {reward.coins} 代幣！
      </p>
      <ul className="space-y-1 text-sm">
        {reward.items.map((item) => (
          <li key={item.kind} className="flex justify-between gap-3">
            <span>{rewardLabel(item)}</span>
            <span className="font-medium tabular-nums">+{item.coins}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewNote({ review }: { review: SentenceReview }) {
  return (
    <div className="mt-2 space-y-1 border-t border-border-hairline pt-2 text-sm">
      <p className={review.ok ? "text-success" : "text-warning"}>
        {review.ok ? "✓ " : ""}
        {review.comment}
      </p>
      {review.corrected && <p className="text-muted-foreground">修正：{review.corrected}</p>}
    </div>
  );
}

/** The finished screen: the dictation score, and every new word's sentence for the parent. */
export function FinishedView({
  homework,
  onBack,
  onAgain,
  celebrate = false,
  reviewState,
  onReview,
}: FinishedViewProps) {
  const result = homework.result ?? gradeDictation(homework);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (celebrate && result.total > 0 && result.correctCount === result.total) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, disableForReducedMotion: true });
    }
  }, [celebrate, result.correctCount, result.total]);

  const corrected = result.wrongKeys.flatMap((id) => {
    const item = findDictationItem(homework, id);
    const word = item && [...homework.newWords, ...homework.reviewWords].find((candidate) => candidate.key === item.key);
    if (!item || !word) return [];
    const spelling = dictationAnswer(homework, item);
    const note = item.form && word.inflection ? `（${word.word} 的${INFLECTION_LABEL[word.inflection.kind]}）` : "";
    return [{ key: id, word: `${spelling}${note}`, answer: item.answer }];
  });

  const reviews = new Map((homework.review?.items ?? []).map((item) => [item.key, item]));
  const canReview = !homework.review && sentencesToReview(homework).length > 0;

  const score = result.total === 0 ? "這次沒有聽寫成績" : `聽寫 ${result.correctCount} / ${result.total}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <PartyPopper className="size-10 text-accent" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-2xl font-semibold">寫完了！</h2>
        <p className="text-lg">{score}</p>
      </div>

      {homework.reward && <RewardBox reward={homework.reward} />}

      {homework.newWords.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">造句（給家長看）</h3>
          {canReview && reviewState === "reviewing" && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
              正在批改造句…
            </p>
          )}
          {canReview && reviewState !== "reviewing" && onReview && (
            <div className="flex flex-wrap items-center gap-3">
              {reviewState === "failed" && (
                <p role="status" className="text-sm text-warning">
                  還沒改好
                </p>
              )}
              <button type="button" onClick={onReview} className="btn btn-outline btn-sm min-h-11">
                {reviewState === "failed" ? "再改一次" : "批改造句"}
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {homework.newWords.map((word, i) => {
              const page = homework.pages[i];
              return (
                <li key={word.key} className="rounded-[10px] border border-border-hairline px-4 py-3">
                  <p className="font-semibold">
                    {word.word}
                    {word.inflection && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {word.inflection.form}（{INFLECTION_LABEL[word.inflection.kind]}）
                      </span>
                    )}
                  </p>
                  {/* Only homework written before the phrase step was dropped has one. */}
                  {page?.phrase && <p className="text-sm">{page.phrase}</p>}
                  <p className="text-sm">{page?.sentence ?? "（沒有寫）"}</p>
                  {reviews.has(word.key) && <ReviewNote review={reviews.get(word.key)!} />}
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
