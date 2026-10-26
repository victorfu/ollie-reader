import { useState } from "react";
import { SpellCheck } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { useWordPractice } from "../../hooks/useWordPractice";
import type { MessageKey } from "../../i18n/translate";
import type { HistoryHomework, LegacyHomework } from "../../types/wordPractice";
import { FinishedView } from "./FinishedView";
import { HomeworkBook } from "./HomeworkBook";
import { HomeworkHistory } from "./HomeworkHistory";
import { TodayCard } from "./TodayCard";
import { formatHomeworkDate, formatHomeworkScore, isHomeworkBook } from "./homeworkFormat";
import { T } from "../common/T";

const CEFR_J_CREDIT =
  "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.";
const OCTANOVE_CREDIT = "Octanove Vocabulary Profile (CC BY-SA 4.0)";

/** An old homework only has its date, its score and its words to show. */
function LegacyResult({ homework, onBack }: { homework: LegacyHomework; onBack: () => void }) {
  const { language } = useLanguage();
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-semibold">
          {formatHomeworkDate(homework, language === "en" ? "en-US" : "zh-TW")}
        </h2>
        {homework.result && (
          <p className="text-lg">
            <T k="practice.word.legacyScore" params={{ score: formatHomeworkScore(homework) }} />
          </p>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {homework.words.map((word) => (
          <li
            key={word.key}
            className="rounded-[10px] border border-border-hairline px-3 py-1 text-sm"
          >
            {word.word}
          </li>
        ))}
      </ul>
      <div className="flex justify-center">
        <button type="button" onClick={onBack} className="btn btn-primary min-h-11 active:scale-[0.98]">
          <T k="practice.word.backHome" variant="stacked" />
        </button>
      </div>
    </div>
  );
}

export default function WordPracticePage() {
  const wordPractice = useWordPractice();
  const { status, error, saveError, active, history, settings, starting } = wordPractice;
  const [inBook, setInBook] = useState(false);
  // The finished screen: the homework just handed in (can start another) or one opened from the history.
  const [viewing, setViewing] = useState<{ homework: HistoryHomework; justFinished: boolean } | null>(
    null,
  );
  const [noWords, setNoWords] = useState(false);
  /** Set when a homework was just created here, so that only a fresh review-only homework gets its notice. */
  const [justStarted, setJustStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const goHome = () => {
    setInBook(false);
    setViewing(null);
  };

  const start = async (): Promise<void> => {
    if (starting || submitting) return;
    setNoWords(false);
    setJustStarted(false);
    const outcome = await wordPractice.start();
    setNoWords(outcome === "empty");
    if (outcome === "created") {
      setJustStarted(true);
      setViewing(null);
      setInBook(true);
    } else if (outcome === "empty") {
      setViewing(null);
    }
  };

  const submit = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const completed = await wordPractice.submit();
      if (completed) {
        setInBook(false);
        setViewing({ homework: completed, justFinished: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  let content;
  if (status === "loading") {
    content = null;
  } else if (status === "error") {
    content = (
      <button
        type="button"
        onClick={() => void wordPractice.reload()}
        className="btn btn-primary min-h-11 active:scale-[0.98]"
      >
        <T k="practice.word.reload" variant="stacked" />
      </button>
    );
  } else if (viewing) {
    // The history copy carries the sentence review once Gemini has answered.
    const shown = history.find((item) => item.id === viewing.homework.id) ?? viewing.homework;
    content = isHomeworkBook(shown) ? (
      <FinishedView
        homework={shown}
        onBack={goHome}
        onAgain={viewing.justFinished ? () => void start() : undefined}
        celebrate={viewing.justFinished}
        reviewState={wordPractice.reviewState[shown.id]}
        onReview={() => void wordPractice.reviewHomework(shown)}
      />
    ) : (
      <LegacyResult homework={shown} onBack={goHome} />
    );
  } else if (inBook && active) {
    content = (
      <HomeworkBook
        homework={active}
        onProgress={wordPractice.updateProgress}
        onRest={goHome}
        onSubmit={() => void submit()}
        submitting={submitting}
        locked={starting}
      />
    );
  } else {
    content = (
      <>
        <TodayCard
          settings={settings}
          reviewDueCount={wordPractice.reviewDueCount}
          active={active}
          starting={starting || submitting}
          homeworkStreak={wordPractice.homeworkStreak}
          onStart={() => void start()}
          onContinue={() => setInBook(true)}
        />
        <HomeworkHistory
          history={history}
          onOpen={(homeworkId) => {
            const homework = history.find((candidate) => candidate.id === homeworkId);
            if (homework) setViewing({ homework, justFinished: false });
          }}
        />
      </>
    );
  }

  const busyMessage: MessageKey | null =
    status === "loading" ? "practice.word.loading" : starting ? "practice.word.preparing" : null;
  const reviewOnly = justStarted && inBook && active !== null && active.newWords.length === 0;
  const statusMessage: MessageKey | null =
    busyMessage ??
    (noWords ? "practice.word.noWords" : reviewOnly ? "practice.word.reviewOnly" : null);
  const saveMessage = status === "ready" ? saveError : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <div className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <SpellCheck className="shrink-0" aria-hidden="true" />
            <T k="practice.word.title" variant="stacked" />
          </h1>
          <p className="text-muted-foreground">
            <T k="practice.word.subtitle" />
          </p>
        </div>
        {/* The live regions stay mounted so that a change in their text is announced. */}
        <div role="status" className="[&:not(:empty)]:mt-3">
          {statusMessage && (
            <p
              className={`flex items-center gap-2 text-sm ${
                busyMessage ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {busyMessage && (
                <span className="loading loading-spinner loading-sm" aria-hidden="true" />
              )}
              <T k={statusMessage} />
            </p>
          )}
        </div>
        <div role="status" className="[&:not(:empty)]:mt-3">
          {saveMessage && (
            <p className="rounded-[10px] border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
              {saveMessage}
            </p>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {error}
        </p>
      )}

      {content}

      <footer className="space-y-1 border-t border-border-hairline pt-4 text-xs text-muted-foreground">
        <p>{CEFR_J_CREDIT}</p>
        <p>{OCTANOVE_CREDIT}</p>
      </footer>
    </div>
  );
}
