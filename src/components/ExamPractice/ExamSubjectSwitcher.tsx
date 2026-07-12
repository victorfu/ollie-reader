import type { ExamTab } from "../../types/exam";
import { SUBJECT_LABELS } from "../../data/exams/mixed";

const TABS: { id: ExamTab; label: string }[] = [
  { id: "chinese", label: SUBJECT_LABELS.chinese },
  { id: "math", label: SUBJECT_LABELS.math },
  { id: "english", label: SUBJECT_LABELS.english },
  { id: "mixed", label: "綜合" },
];

interface ExamSubjectSwitcherProps {
  value: ExamTab;
  onSelect: (tab: ExamTab) => void;
}

/** 考科膠囊切換器(三個固定科目 + 隨機綜合卷),各 hub 共用。 */
export function ExamSubjectSwitcher({
  value,
  onSelect,
}: ExamSubjectSwitcherProps) {
  return (
    <div className="flex justify-center">
      <div
        role="group"
        aria-label="選擇考科"
        className="inline-flex rounded-full border border-border-hairline bg-card p-1 shadow-soft"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === value;
          return (
            <button
              key={tab.id}
              aria-pressed={isActive}
              onClick={() => onSelect(tab.id)}
              className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition-all active:scale-[0.98] sm:px-8 ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
