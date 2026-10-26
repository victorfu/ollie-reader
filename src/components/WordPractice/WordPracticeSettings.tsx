import { useWordPractice } from "../../hooks/useWordPractice";
import { T } from "../common/T";
import { ParentSettings } from "./ParentSettings";

/** Loads the word practice on its own, so the settings page can change it without the practice page open. */
export function WordPracticeSettings() {
  const wordPractice = useWordPractice();
  const { status, error, active, settings, starting } = wordPractice;

  if (status === "loading") {
    return (
      <div className="flex justify-center p-6">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-3">
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void wordPractice.reload()}
          className="btn btn-primary min-h-11 active:scale-[0.98]"
        >
          <T k="practice.word.reload" variant="stacked" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {error}
        </p>
      )}
      <ParentSettings
        key={`${settings.newWordCount}/${settings.reviewLimit}/${settings.startLevel}`}
        settings={settings}
        hasActive={active !== null}
        busy={starting}
        onSave={wordPractice.saveSettings}
        onAbandon={wordPractice.abandon}
        onReset={wordPractice.resetProgress}
      />
    </div>
  );
}
