import { useId } from "react";
import { BookOpen, Coins } from "lucide-react";
import { HOMEWORK_REWARDS } from "../../services/economyService";
import type { Homework, PracticeSettings } from "../../types/wordPractice";
import { currentPosition } from "../../utils/homeworkFlow";
import { T } from "../common/T";

interface TodayCardProps {
  settings: PracticeSettings;
  reviewDueCount: number;
  active: Homework | null;
  /** A homework is being made; the buttons wait. */
  starting: boolean;
  /** Whether a homework handed in now is the day's first, and the streak it would make. */
  homeworkStreak: { firstToday: boolean; days: number };
  onStart: () => void;
  onContinue: () => void;
}

function CoinHint({ firstToday, days }: { firstToday: boolean; days: number }) {
  const streak = Math.min((days - 1) * HOMEWORK_REWARDS.streakStep, HOMEWORK_REWARDS.streakCap);
  return (
    <span>
      <T k="practice.today.coins" />
      {firstToday && (
        <>
          ・<T k="practice.today.coinsFirst" params={{ coins: HOMEWORK_REWARDS.firstToday }} />
          {days >= 2 && (
            <>
              ・<T k="practice.today.coinsStreak" params={{ days, coins: streak }} />
            </>
          )}
        </>
      )}
    </span>
  );
}

function ContinueLabel({ homework }: { homework: Homework }) {
  const position = currentPosition(homework);
  switch (position.phase) {
    case "page":
      return (
        <T
          k="practice.today.continuePage"
          params={{ current: position.wordIndex + 1, total: homework.newWords.length }}
          variant="stacked"
        />
      );
    case "dictation":
      return <T k="practice.today.continueDictation" variant="stacked" />;
    case "correction":
      return <T k="practice.today.continueCorrection" variant="stacked" />;
    case "submit":
      return <T k="practice.today.continueSubmit" variant="stacked" />;
  }
}

/** The card on the home screen: today's homework to start, or the one in progress to continue. */
export function TodayCard({
  settings,
  reviewDueCount,
  active,
  starting,
  homeworkStreak,
  onStart,
  onContinue,
}: TodayCardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border border-border-hairline bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex items-center gap-3">
        <BookOpen className="size-6 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
        <h2 id={headingId} className="text-xl font-semibold">
          <T k={active ? "practice.today.titleActive" : "practice.today.title"} variant="stacked" />
        </h2>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Coins className="size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
        <CoinHint {...homeworkStreak} />
      </p>

      {active ? (
        <button
          type="button"
          disabled={starting}
          onClick={onContinue}
          className="btn btn-primary btn-lg min-h-14 w-full active:scale-[0.98]"
        >
          <ContinueLabel homework={active} />
        </button>
      ) : (
        <>
          <p className="text-lg">
            <T
              k="practice.today.counts"
              params={{ newCount: settings.newWordCount, reviewCount: reviewDueCount }}
            />
          </p>
          <button
            type="button"
            disabled={starting}
            onClick={onStart}
            className="btn btn-primary btn-lg min-h-14 w-full active:scale-[0.98]"
          >
            {starting && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
            <T k="practice.today.start" variant="stacked" />
          </button>
        </>
      )}
    </section>
  );
}
