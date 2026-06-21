import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  MessageCircle,
  MessagesSquare,
  Route,
  Sparkles,
} from "lucide-react";
import type { TravelTopic } from "../../types/travelEnglish";
import type { TravelProgress } from "../../services/travelProgressService";
import type { TravelMissionStepKind } from "./travelMissionUtils";
import { WordCard } from "./WordCard";
import { PhraseCard } from "./PhraseCard";
import { SpeakerButton } from "./SpeakerButton";
import { TopicSceneVisual } from "./TopicSceneVisual";
import { TravelMissionPanel } from "./TravelMissionPanel";
import { getTopicStats } from "./travelTopicUtils";

interface TopicDetailProps {
  topic: TravelTopic;
  onBack: () => void;
  speak: (text: string) => void;
  progress: TravelProgress | null;
  isProgressLoading: boolean;
  progressError: string | null;
  onMarkMissionStep: (topicId: string, step: TravelMissionStepKind) => void;
  onCompleteMission: (topicId: string) => void;
}

/** 單一情境頁：必學單字 + 實用句子（多分組主題會依分組顯示小標） */
export function TopicDetail({
  topic,
  onBack,
  speak,
  progress,
  isProgressLoading,
  progressError,
  onMarkMissionStep,
  onCompleteMission,
}: TopicDetailProps) {
  const multiGroup = topic.groups.length > 1;
  const stats = getTopicStats(topic);

  return (
    <div className="space-y-6 pb-8">
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
      <div className="grid overflow-hidden rounded-2xl border border-border-hairline bg-card shadow-elevated lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              第 {topic.stage} 站 · {topic.stageLabel}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {topic.titleChinese}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{topic.title}</p>
            <p className="mt-4 text-base leading-relaxed text-base-content/75">
              {topic.summary}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Metric icon={BookOpen} value={stats.words} label="Words" />
            <Metric icon={MessageCircle} value={stats.phrases} label="Sentences" />
            <Metric icon={MessagesSquare} value={stats.dialogues} label="Dialogues" />
          </div>

          <div className="grid gap-3 rounded-2xl bg-base-100/60 p-4 ring-1 ring-border-hairline dark:bg-white/5">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-base font-semibold">本站任務</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {topic.mission}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-border-hairline pt-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-warning" />
              <div>
                <h3 className="text-base font-semibold">複習提示</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {topic.reviewPrompt}
                </p>
              </div>
            </div>
          </div>
        </div>
        <TopicSceneVisual topic={topic} size="hero" />
      </div>

      <section className="surface-card rounded-2xl p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Route className="size-5 text-primary" />
          學習目標
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {topic.learningGoals.map((goal) => (
            <div
              key={goal}
              className="flex items-start gap-2 rounded-xl bg-base-100/60 p-3 text-sm text-base-content/75 ring-1 ring-border-hairline dark:bg-white/5"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              {goal}
            </div>
          ))}
        </div>
      </section>

      <TravelMissionPanel
        topic={topic}
        progress={progress}
        isProgressLoading={isProgressLoading}
        progressError={progressError}
        speak={speak}
        onMarkStep={onMarkMissionStep}
        onCompleteMission={onCompleteMission}
      />

      {topic.groups.map((group, gi) => (
        <div key={group.sceneId ?? gi} className="space-y-5">
          {/* 分組小標（只有多分組主題顯示，例如機場的出發/入境、動物園各園區） */}
          <section className="surface-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-sm font-semibold text-primary ring-1 ring-border-hairline">
                {multiGroup ? gi + 1 : topic.stage}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Scene {gi + 1}
                </p>
                <h3 className="text-lg font-semibold leading-tight">
                  {group.labelChinese ?? topic.titleChinese}
                </h3>
                {group.label && (
                  <p className="text-xs text-muted-foreground">{group.label}</p>
                )}
                {group.description && (
                  <p className="mt-2 text-sm leading-relaxed text-base-content/70">
                    {group.description}
                  </p>
                )}
              </div>
            </div>
          </section>

          {group.funFacts && group.funFacts.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-base font-semibold">
                <Lightbulb className="size-4 text-warning" />
                情境小知識
                <span className="text-xs font-normal text-muted-foreground">
                  Scene notes
                </span>
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.funFacts.map((fact) => (
                  <div
                    key={fact.english}
                    className="rounded-2xl border border-border-hairline bg-base-100/70 p-4 shadow-soft dark:bg-white/5"
                  >
                    <p className="text-sm font-semibold leading-relaxed">{fact.english}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {fact.chinese}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 必學單字 */}
          {group.vocabulary.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-base font-semibold">
                <BookOpen className="size-4 text-primary" />
                必學單字
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
                <MessageCircle className="size-4 text-primary" />
                實用句子
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

          {group.dialogues && group.dialogues.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-base font-semibold">
                <MessagesSquare className="size-4 text-primary" />
                對話練習
                <span className="text-xs font-normal text-muted-foreground">
                  Role-play dialogues
                </span>
              </h4>
              <div className="grid gap-3">
                {group.dialogues.map((dialogue) => (
                  <div
                    key={dialogue.id}
                    className="surface-card overflow-hidden rounded-2xl"
                  >
                    <div className="border-b border-border-hairline p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {dialogue.title}
                      </p>
                      <h5 className="mt-1 text-base font-semibold">
                        {dialogue.titleChinese}
                      </h5>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {dialogue.description}
                      </p>
                    </div>
                    <div className="divide-y divide-border-hairline">
                      {dialogue.lines.map((line, index) => (
                        <div key={`${dialogue.id}-${index}`} className="flex gap-3 p-4">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-xs font-semibold text-primary ring-1 ring-border-hairline">
                            {line.speaker}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-muted-foreground">
                                {line.role}
                              </span>
                              <SpeakerButton
                                text={line.english}
                                speak={speak}
                                label={`播放對話：${line.english}`}
                                className="btn-xs min-h-[30px] min-w-[30px]"
                              />
                            </div>
                            <p className="mt-1 text-sm font-semibold leading-relaxed sm:text-base">
                              {line.english}
                            </p>
                            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                              {line.chinese}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ))}
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-base-100/60 p-3 ring-1 ring-border-hairline dark:bg-white/5">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
