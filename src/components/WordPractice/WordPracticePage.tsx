import { useState } from "react";
import { SpellCheck } from "lucide-react";
import { useWordPractice } from "../../hooks/useWordPractice";
import type { StepId } from "../../utils/homeworkProgress";
import { GenerateHomeworkPanel } from "./GenerateHomeworkPanel";
import { HomeworkHistory } from "./HomeworkHistory";
import { HomeworkOverview } from "./HomeworkOverview";
import { HomeworkResultView } from "./HomeworkResult";
import { STEP_LABELS, type StepProps } from "./stepTypes";

type Screen =
  | { view: "home" }
  | { view: "step"; step: StepId }
  | { view: "result"; homeworkId: string };

const CEFR_J_CREDIT =
  "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.";
const OCTANOVE_CREDIT = "Octanove Vocabulary Profile (CC BY-SA 4.0)";

/** Stands in for a practice step until its real component replaces it. */
function StepPlaceholder({ step, onExit }: Pick<StepProps, "onExit"> & { step: StepId }) {
  return (
    <section className="space-y-4 rounded-xl border border-border-hairline bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold">{STEP_LABELS[step]}</h2>
      <p className="text-muted-foreground">這個步驟還在準備中。</p>
      <button
        type="button"
        onClick={onExit}
        className="btn btn-outline min-h-11 active:scale-[0.98]"
      >
        回到總覽
      </button>
    </section>
  );
}

export default function WordPracticePage() {
  const wordPractice = useWordPractice();
  const [screen, setScreen] = useState<Screen>({ view: "home" });
  const { status, error, saveError, active, history } = wordPractice;

  const goHome = () => setScreen({ view: "home" });
  const resultHomework =
    screen.view === "result"
      ? history.find((homework) => homework.id === screen.homeworkId)
      : undefined;

  let content;
  if (status === "loading") {
    content = (
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        載入中…
      </p>
    );
  } else if (status === "error") {
    content = (
      <button
        type="button"
        onClick={() => void wordPractice.reload()}
        className="btn btn-primary min-h-11 active:scale-[0.98]"
      >
        重新載入
      </button>
    );
  } else if (screen.view === "step" && active) {
    content = <StepPlaceholder step={screen.step} onExit={goHome} />;
  } else if (resultHomework) {
    content = <HomeworkResultView homework={resultHomework} onBack={goHome} />;
  } else {
    content = (
      <>
        {active && (
          <HomeworkOverview
            homework={active}
            onOpenStep={(step) => setScreen({ view: "step", step })}
            onAbandon={wordPractice.abandon}
          />
        )}
        <GenerateHomeworkPanel
          hasActive={active !== null}
          generating={wordPractice.generating}
          onGenerate={wordPractice.generate}
        />
        <HomeworkHistory
          history={history}
          onOpen={(homeworkId) => setScreen({ view: "result", homeworkId })}
        />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <SpellCheck className="shrink-0" aria-hidden="true" />
          單字練習
        </h1>
        <p className="text-muted-foreground">
          從生詞本挑出單字，認識、拼寫、填空、造句，最後來一場拼字考試。
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {error}
        </p>
      )}
      {status === "ready" && saveError && (
        <p
          role="status"
          className="rounded-[10px] border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          {saveError}
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
