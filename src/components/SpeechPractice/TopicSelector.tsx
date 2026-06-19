import type { SpeechPracticeTopic } from "../../types/speechPractice";
import { SPEECH_TOPICS } from "../../types/speechPractice";

interface TopicSelectorProps {
  selectedTopic: SpeechPracticeTopic | null;
  onSelect: (topic: SpeechPracticeTopic) => void;
  onStartPractice: () => void;
  onGenerateScript: () => void;
  topicCounts: Map<string, number>;
  topicScripts: Map<string, string>;
}

export function TopicSelector({
  selectedTopic,
  onSelect,
  onStartPractice,
  onGenerateScript,
  topicCounts,
  topicScripts,
}: TopicSelectorProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) {
      return `${secs}秒`;
    }
    return secs === 0 ? `${mins}分鐘` : `${mins}分${secs}秒`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">🎯 選擇練習主題</h2>

      {/* Topic Grid */}
      <div className="grid gap-4 auto-grid">
        {SPEECH_TOPICS.map((topic) => {
          const practiceCount = topicCounts.get(topic.id) || 0;
          const hasScript = topicScripts.has(topic.id);
          const isSelected = selectedTopic?.id === topic.id;

          return (
            <div
              key={topic.id}
              className={`surface-card rounded-xl cursor-pointer transition-all duration-200 hover:shadow-elevated active:scale-[0.99] ${
                isSelected
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-base-100"
                  : ""
              }`}
              onClick={() => onSelect(topic)}
            >
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold">{topic.titleChinese}</h3>

                <p className="text-base text-muted-foreground mt-2">
                  {topic.descriptionChinese}
                </p>

                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="badge badge-outline badge-sm">
                    ⏱️ {formatTime(topic.suggestedTimeSeconds)}
                  </span>
                  {hasScript && (
                    <span className="badge badge-success badge-sm">
                      📝 已有講稿
                    </span>
                  )}
                  {practiceCount > 0 && (
                    <span className="badge badge-primary badge-sm">
                      已練習 {practiceCount} 次
                    </span>
                  )}
                </div>

                {/* Action buttons when selected */}
                {isSelected && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-3 border-t border-border-hairline">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex-1 gap-1 active:scale-[0.98]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartPractice();
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      開始練習
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm flex-1 gap-1 active:scale-[0.98]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerateScript();
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      {hasScript ? "編輯講稿" : "產生講稿"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
