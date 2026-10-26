import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Coins, PartyPopper } from "lucide-react";
import type { HomeworkReward, HomeworkRewardItem } from "../../services/economyService";
import type { Homework, SentenceReview } from "../../types/wordPractice";
import { dictationAnswer, findDictationItem, gradeDictation, sentencesToReview } from "../../utils/homeworkFlow";
import type { MessageKey } from "../../i18n/translate";
import { T } from "../common/T";
import { PracticeText } from "./PracticeText";

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

const REWARD_LABEL: Record<HomeworkRewardItem["kind"], MessageKey> = {
  handIn: "practice.finished.reward.handIn",
  dictation: "practice.finished.reward.dictation",
  perfect: "practice.finished.reward.perfect",
  firstToday: "practice.finished.reward.firstToday",
  streak: "practice.finished.reward.streak",
};

function RewardBox({ reward }: { reward: HomeworkReward }) {
  return (
    <section className="mx-auto w-full max-w-sm space-y-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <p className="flex items-center justify-center gap-2 text-lg font-semibold">
        <Coins className="size-5 text-warning" strokeWidth={1.75} aria-hidden="true" />
        <T k="practice.finished.coins" params={{ coins: reward.coins }} />
      </p>
      <ul className="space-y-1 text-sm">
        {reward.items.map((item) => (
          <li key={item.kind} className="flex justify-between gap-3">
            <span>
              <T k={REWARD_LABEL[item.kind]} params={{ count: item.count ?? 0 }} />
            </span>
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
      {review.corrected && (
        <p className="text-muted-foreground">
          <T k="practice.finished.suggestion" params={{ text: review.corrected }} />
        </p>
      )}
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
    const formKind = item.form ? word.inflection?.kind : undefined;
    return [{ key: id, spelling, base: word.word, formKind, answer: item.answer }];
  });

  const reviews = new Map((homework.review?.items ?? []).map((item) => [item.key, item]));
  const canReview = !homework.review && sentencesToReview(homework).length > 0;


  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <PartyPopper className="size-10 text-accent" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-2xl font-semibold">
          <T k="practice.finished.title" variant="stacked" />
        </h2>
        <p className="text-lg">
          {result.total === 0 ? (
            <T k="practice.finished.noScore" />
          ) : (
            <T k="practice.finished.score" params={{ correct: result.correctCount, total: result.total }} />
          )}
        </p>
      </div>

      {homework.reward && <RewardBox reward={homework.reward} />}

      {homework.newWords.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">
            <T k="practice.finished.sentencesTitle" variant="stacked" />
          </h3>
          {canReview && reviewState === "reviewing" && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
              <T k="practice.finished.reviewing" />
            </p>
          )}
          {canReview && reviewState !== "reviewing" && onReview && (
            <div className="flex flex-wrap items-center gap-3">
              {reviewState === "failed" && (
                <p role="status" className="text-sm text-warning">
                  <T k="practice.finished.reviewFailed" />
                </p>
              )}
              <button type="button" onClick={onReview} className="btn btn-outline btn-sm min-h-11">
                <T
                  k={reviewState === "failed" ? "practice.finished.reviewAgain" : "practice.finished.review"}
                  variant="stacked"
                />
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
                        <PracticeText
                          k="practice.finished.formLabel"
                          params={{ form: word.inflection.form }}
                          inflection={word.inflection.kind}
                        />
                      </span>
                    )}
                  </p>
                  {/* Only homework written before the phrase step was dropped has one. */}
                  {page?.phrase && <p className="text-sm">{page.phrase}</p>}
                  <p className="text-sm">{page?.sentence ?? <T k="practice.finished.notWritten" />}</p>
                  {reviews.has(word.key) && <ReviewNote review={reviews.get(word.key)!} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {corrected.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">
            <T k="practice.finished.wrongTitle" variant="stacked" />
          </h3>
          <ul className="space-y-2">
            {corrected.map(({ key, spelling, base, formKind, answer }) => (
              <li
                key={key}
                className="flex flex-wrap items-baseline gap-x-3 rounded-[10px] border border-border-hairline px-4 py-3"
              >
                <span className="font-semibold">
                  {spelling}
                  {formKind && (
                    <PracticeText k="practice.finished.formNote" params={{ word: base }} inflection={formKind} />
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {answer === null ? (
                    <T k="practice.finished.youWroteNothing" />
                  ) : (
                    <T k="practice.finished.youWrote" params={{ answer }} />
                  )}
                </span>
                <span className="text-sm text-success">
                  <T k="practice.finished.corrected" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onBack} className="btn btn-primary min-h-11 active:scale-[0.98]">
          <T k="practice.word.backHome" variant="stacked" />
        </button>
        {onAgain && (
          <button type="button" onClick={onAgain} className="btn btn-outline min-h-11 active:scale-[0.98]">
            <T k="practice.finished.again" variant="stacked" />
          </button>
        )}
      </div>
    </div>
  );
}
