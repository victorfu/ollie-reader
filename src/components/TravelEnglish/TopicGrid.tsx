import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  CircleDot,
  MessageCircle,
  MessagesSquare,
  Route,
  Sparkles,
  Stamp,
} from "lucide-react";
import { travelTopics } from "../../data/travelTopics";
import type { TravelTopic } from "../../types/travelEnglish";
import type { TravelProgress } from "../../services/travelProgressService";
import { TopicSceneVisual } from "./TopicSceneVisual";
import {
  getNextSuggestedTopicId,
  getTravelMissionStatus,
  getTravelProgressSummary,
} from "./travelMissionUtils";
import { getTopicStats } from "./travelTopicUtils";

interface TopicGridProps {
  progress: TravelProgress | null;
  isProgressLoading: boolean;
  progressError: string | null;
  onSelectTopic: (id: string) => void;
}

const orderedTopics = [...travelTopics].sort((a, b) => a.stage - b.stage);

function LearningStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {value} {label}
    </span>
  );
}

function TopicPathCard({
  topic,
  index,
  progress,
  nextTopicId,
  onSelectTopic,
}: {
  topic: TravelTopic;
  index: number;
  progress: TravelProgress | null;
  nextTopicId: string | null;
  onSelectTopic: (id: string) => void;
}) {
  const stats = getTopicStats(topic);
  const missionStatus = getTravelMissionStatus(topic.id, progress);
  const isNextTopic = nextTopicId === topic.id;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelectTopic(topic.id)}
      className="group grid overflow-hidden rounded-2xl border border-border-hairline bg-card text-left shadow-soft transition-all hover:shadow-elevated focus-visible:focus-ring md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.1fr)]"
    >
      <TopicSceneVisual topic={topic} />
      <div className="flex min-h-[220px] flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              第 {topic.stage} 站 · {topic.stageLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight text-base-content sm:text-2xl">
              {topic.titleChinese}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{topic.title}</p>
          </div>
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-border-hairline ${
              missionStatus === "completed"
                ? "bg-success text-success-content"
                : "bg-accent-tint text-primary"
            }`}
          >
            {missionStatus === "completed" ? <Stamp className="size-4" /> : topic.stage}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-base-content/75">{topic.summary}</p>

        <div className="grid gap-2 rounded-xl bg-base-100/55 p-3 text-sm ring-1 ring-border-hairline dark:bg-white/5">
          {topic.learningGoals.slice(0, 2).map((goal) => (
            <span key={goal} className="flex items-start gap-2 text-base-content/75">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              {goal}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-border-hairline pt-3">
          <LearningStat icon={BookOpen} label="words" value={stats.words} />
          <LearningStat icon={MessageCircle} label="sentences" value={stats.phrases} />
          <LearningStat icon={MessagesSquare} label="dialogues" value={stats.dialogues} />
        </div>

        <div className="flex flex-wrap gap-2">
          {missionStatus === "completed" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              <CheckCircle2 className="size-3.5" />
              已蓋章
            </span>
          )}
          {missionStatus === "in-progress" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
              <Sparkles className="size-3.5" />
              任務進行中
            </span>
          )}
          {missionStatus === "not-started" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-base-100/70 px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border-hairline dark:bg-white/5">
              <CircleDot className="size-3.5" />
              尚未蓋章
            </span>
          )}
          {isNextTopic && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Route className="size-3.5" />
              建議下一站
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/** 首頁：分情境的大卡片，點一下進入該情境的單字與句子 */
export function TopicGrid({
  progress,
  isProgressLoading,
  progressError,
  onSelectTopic,
}: TopicGridProps) {
  const summary = getTravelProgressSummary(orderedTopics, progress);
  const nextTopicId = getNextSuggestedTopicId(orderedTopics, progress);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="toolbar sticky top-14 z-20 -mx-4 px-4 py-3 sm:rounded-b-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-primary ring-1 ring-border-hairline">
            <Route className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              新加坡旅遊英文路線
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              從出發、飛行、入境到城市探索，按真實旅程練會能開口使用的句子。
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="rounded-2xl bg-base-100/65 p-3 ring-1 ring-border-hairline dark:bg-white/5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-3 py-1 text-xs font-semibold text-primary">
                <Stamp className="size-3.5" />
                已完成 {summary.completed} / {summary.total} 站
              </span>
              {isProgressLoading && (
                <span className="text-xs font-medium text-muted-foreground">
                  同步中
                </span>
              )}
              {summary.nextTopicId && (
                <span className="text-xs font-medium text-muted-foreground">
                  下一站：第{" "}
                  {orderedTopics.find((topic) => topic.id === summary.nextTopicId)?.stage}
                  {" "}站
                </span>
              )}
            </div>
            {progressError && (
              <p className="mt-2 text-xs text-warning">{progressError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {orderedTopics.map((topic, index) => (
          <TopicPathCard
            key={topic.id}
            topic={topic}
            index={index}
            progress={progress}
            nextTopicId={nextTopicId}
            onSelectTopic={onSelectTopic}
          />
        ))}
      </div>
    </div>
  );
}
