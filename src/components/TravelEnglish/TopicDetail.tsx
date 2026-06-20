import { ArrowLeft } from "lucide-react";
import type { TravelTopic } from "../../types/travelEnglish";
import { WordCard } from "./WordCard";
import { PhraseCard } from "./PhraseCard";

interface TopicDetailProps {
  topic: TravelTopic;
  onBack: () => void;
  speak: (text: string) => void;
}

/** 單一情境頁：必學單字 + 實用句子（多分組主題會依分組顯示小標） */
export function TopicDetail({ topic, onBack, speak }: TopicDetailProps) {
  const multiGroup = topic.groups.length > 1;

  return (
    <div className="space-y-5 pb-8">
      {/* Back */}
      <button
        type="button"
        className="btn btn-ghost btn-sm gap-1.5 min-h-[44px] active:scale-[0.98]"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4" />
        返回
      </button>

      {/* Hero */}
      <div
        className={`rounded-2xl border border-border-hairline p-5 shadow-elevated sm:p-6 ${topic.colorClass}`}
      >
        <span className="text-5xl">{topic.emoji}</span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {topic.titleChinese}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{topic.title}</p>
      </div>

      {topic.groups.map((group, gi) => (
        <div key={gi} className="space-y-4">
          {/* 分組小標（只有多分組主題顯示，例如機場的出發/入境、動物園各園區） */}
          {multiGroup && (
            <div className="flex items-center gap-2 pt-2">
              {group.emoji && <span className="text-2xl">{group.emoji}</span>}
              <div>
                <h3 className="text-lg font-semibold leading-tight">
                  {group.labelChinese}
                </h3>
                {group.label && (
                  <p className="text-xs text-muted-foreground">{group.label}</p>
                )}
              </div>
            </div>
          )}

          {/* 必學單字 */}
          {group.vocabulary.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-base font-semibold">
                📚 必學單字
                <span className="text-xs font-normal text-muted-foreground">
                  Must-learn words
                </span>
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.vocabulary.map((vocab) => (
                  <WordCard
                    key={vocab.word}
                    vocab={vocab}
                    colorClass={topic.colorClass}
                    speak={speak}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 實用句子 */}
          {group.phrases.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-base font-semibold">
                💬 實用句子
                <span className="text-xs font-normal text-muted-foreground">
                  Useful sentences
                </span>
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.phrases.map((phrase) => (
                  <PhraseCard key={phrase.id} phrase={phrase} speak={speak} />
                ))}
              </div>
            </section>
          )}
        </div>
      ))}
    </div>
  );
}
