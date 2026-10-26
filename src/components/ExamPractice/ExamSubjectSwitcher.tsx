import type { ExamTab } from "../../types/exam";
import { useLanguage } from "../../hooks/useLanguage";
import { T } from "../common/T";
import { SUBJECT_KEYS } from "./examUi";

const TABS: readonly ExamTab[] = ["chinese", "math", "english", "mixed"];

interface ExamSubjectSwitcherProps {
  value: ExamTab;
  onSelect: (tab: ExamTab) => void;
}

/** 考科膠囊切換器(三個固定科目 + 隨機綜合卷),各 hub 共用。 */
export function ExamSubjectSwitcher({
  value,
  onSelect,
}: ExamSubjectSwitcherProps) {
  const { t } = useLanguage();
  return (
    <div className="flex justify-center">
      <div
        role="group"
        aria-label={t("exams.switcher.label")}
        className="inline-flex rounded-full border border-border-hairline bg-card p-1 shadow-soft"
      >
        {TABS.map((tab) => {
          const isActive = tab === value;
          return (
            <button
              key={tab}
              aria-pressed={isActive}
              onClick={() => onSelect(tab)}
              className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition-all active:scale-[0.98] sm:px-8 ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent/10"
              }`}
            >
              <T k={SUBJECT_KEYS[tab]} variant="stacked" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
