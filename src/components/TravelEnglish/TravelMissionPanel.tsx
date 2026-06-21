import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Play,
  RefreshCcw,
  Sparkles,
  Stamp,
} from "lucide-react";
import { travelTopics } from "../../data/travelTopics";
import type { TravelTopic } from "../../types/travelEnglish";
import type { TravelProgress } from "../../services/travelProgressService";
import {
  buildTravelMission,
  getTravelMissionStatus,
  type TravelDialogueMissionStep,
  type TravelMissionStep,
  type TravelMissionStepKind,
} from "./travelMissionUtils";
import { SpeakerButton } from "./SpeakerButton";

type AnswerState = "idle" | "correct" | "wrong";

interface TravelMissionPanelProps {
  topic: TravelTopic;
  progress: TravelProgress | null;
  isProgressLoading: boolean;
  progressError: string | null;
  speak: (text: string) => void;
  onMarkStep: (topicId: string, step: TravelMissionStepKind) => void;
  onCompleteMission: (topicId: string) => void;
}

function isSameOrder(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function StepDots({
  steps,
  currentStepIndex,
}: {
  steps: TravelMissionStep[];
  currentStepIndex: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const isPast = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        return (
          <span
            key={step.id}
            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold ring-1 ring-border-hairline ${
              isPast
                ? "bg-success text-success-content"
                : isCurrent
                  ? "bg-primary text-primary-content"
                  : "bg-base-100 text-muted-foreground dark:bg-white/5"
            }`}
          >
            {isPast ? <Check className="size-4" /> : index + 1}
          </span>
        );
      })}
    </div>
  );
}

function MissionOptionButton({
  id,
  label,
  supportingText,
  selected,
  correct,
  revealedWrong,
  onSelect,
}: {
  id: string;
  label: string;
  supportingText?: string;
  selected: boolean;
  correct: boolean;
  revealedWrong: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`min-h-[52px] rounded-xl border p-3 text-left text-sm transition-all active:scale-[0.99] ${
        selected && correct
          ? "border-success bg-success/10 text-base-content"
          : selected && revealedWrong
            ? "border-error bg-error/10 text-base-content"
            : "border-border-hairline bg-base-100/70 hover:border-primary/30 hover:bg-accent-tint dark:bg-white/5"
      }`}
    >
      <span className="flex items-start gap-2">
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ${
            selected && correct
              ? "bg-success text-success-content ring-success"
              : selected && revealedWrong
                ? "bg-error text-error-content ring-error"
                : "bg-background text-muted-foreground ring-border-hairline"
          }`}
        >
          {selected && correct ? (
            <Check className="size-3.5" />
          ) : (
            <Circle className="size-2.5 fill-current" />
          )}
        </span>
        <span>
          <span className="block font-semibold">{label}</span>
          {supportingText && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {supportingText}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function TravelMissionPanel({
  topic,
  progress,
  isProgressLoading,
  progressError,
  speak,
  onMarkStep,
  onCompleteMission,
}: TravelMissionPanelProps) {
  const mission = useMemo(() => buildTravelMission(topic, travelTopics), [topic]);
  const status = getTravelMissionStatus(topic.id, progress);
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const currentStep = mission.steps[currentStepIndex] ?? mission.steps[0];

  const resetAnswerState = () => {
    setSelectedOptionId(null);
    setAnswerState("idle");
    setSelectedLineIds([]);
  };

  const startMission = () => {
    setIsActive(true);
    setSessionCompleted(false);
    setCurrentStepIndex(0);
    resetAnswerState();
    onMarkStep(topic.id, mission.steps[0].kind);
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    const nextStep = mission.steps[nextIndex];

    if (!nextStep) {
      setSessionCompleted(true);
      setIsActive(false);
      onCompleteMission(topic.id);
      return;
    }

    resetAnswerState();
    setCurrentStepIndex(nextIndex);
    onMarkStep(topic.id, nextStep.kind);
  };

  const answerOption = (optionId: string, correctOptionId: string) => {
    setSelectedOptionId(optionId);
    setAnswerState(optionId === correctOptionId ? "correct" : "wrong");
  };

  const selectDialogueLine = (step: TravelDialogueMissionStep, lineId: string) => {
    if (selectedLineIds.includes(lineId) || answerState === "correct") return;

    const nextSelected = [...selectedLineIds, lineId];
    setSelectedLineIds(nextSelected);

    if (nextSelected.length === step.correctOrder.length) {
      setAnswerState(isSameOrder(nextSelected, step.correctOrder) ? "correct" : "wrong");
    }
  };

  const resetDialogue = () => {
    setSelectedLineIds([]);
    setAnswerState("idle");
  };

  return (
    <section className="surface-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Passport mission
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <Stamp className="size-5 text-primary" />
            本站護照任務
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            完成聽音、情境配對和對話排序，就能替這一站蓋上護照印章。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isProgressLoading && (
            <span className="pill px-3 py-1 text-xs text-muted-foreground">
              同步中
            </span>
          )}
          {status === "completed" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              <CheckCircle2 className="size-3.5" />
              已蓋章
            </span>
          )}
          {status === "in-progress" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
              <Sparkles className="size-3.5" />
              任務進行中
            </span>
          )}
        </div>
      </div>

      {progressError && (
        <div className="mt-4 rounded-xl border border-warning/25 bg-warning/10 p-3 text-sm text-base-content/75">
          {progressError}
        </div>
      )}

      {!isActive && !sessionCompleted && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-base-100/60 p-4 ring-1 ring-border-hairline dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              {status === "completed" ? "想再挑戰一次嗎？" : "準備開始本站任務"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              每題都可以重試，答對後再前往下一段。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary min-h-[44px] gap-2 rounded-[6px]"
            onClick={startMission}
          >
            <Play className="size-4" />
            {status === "completed" ? "再玩一次" : "開始任務"}
          </button>
        </div>
      )}

      {sessionCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border border-success/20 bg-success/10 p-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success text-success-content">
              <Stamp className="size-6" />
            </span>
            <div>
              <h4 className="text-base font-semibold">護照已蓋章</h4>
              <p className="mt-1 text-sm leading-relaxed text-base-content/75">
                這一站完成了。回到路線頁時，這張主題卡會顯示已完成狀態。
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-3 min-h-[40px] gap-2 rounded-[6px]"
                onClick={startMission}
              >
                <RefreshCcw className="size-4" />
                再練一次
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl bg-base-100/70 p-4 ring-1 ring-border-hairline dark:bg-white/5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step {currentStepIndex + 1} / {mission.steps.length}
              </p>
              <h4 className="mt-1 text-base font-semibold">{currentStep.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{currentStep.prompt}</p>
            </div>
            <StepDots steps={mission.steps} currentStepIndex={currentStepIndex} />
          </div>

          <div className="mt-4">
            {currentStep.kind === "word" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-accent-tint p-3">
                  <span className="text-sm font-semibold">聽這個單字</span>
                  <SpeakerButton text={currentStep.speakText} speak={speak} />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {currentStep.options.map((option) => (
                    <MissionOptionButton
                      key={option.id}
                      id={option.id}
                      label={option.label}
                      supportingText={option.supportingText}
                      selected={selectedOptionId === option.id}
                      correct={option.id === currentStep.correctOptionId}
                      revealedWrong={answerState === "wrong"}
                      onSelect={(id) => answerOption(id, currentStep.correctOptionId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentStep.kind === "phrase" && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 rounded-xl bg-accent-tint p-3">
                  <div>
                    <p className="text-base font-semibold leading-relaxed">
                      {currentStep.phrase}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      選出這句話最適合使用的旅遊情境。
                    </p>
                  </div>
                  <SpeakerButton text={currentStep.phrase} speak={speak} />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {currentStep.options.map((option) => (
                    <MissionOptionButton
                      key={option.id}
                      id={option.id}
                      label={option.label}
                      selected={selectedOptionId === option.id}
                      correct={option.id === currentStep.correctOptionId}
                      revealedWrong={answerState === "wrong"}
                      onSelect={(id) => answerOption(id, currentStep.correctOptionId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentStep.kind === "dialogue" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-accent-tint p-3">
                  <p className="text-sm font-semibold">依照自然順序點選句子</p>
                  <div className="mt-2 flex min-h-10 flex-wrap gap-2">
                    {selectedLineIds.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        還沒有選句子
                      </span>
                    ) : (
                      selectedLineIds.map((lineId, index) => {
                        const line = currentStep.lines.find((item) => item.id === lineId);
                        return (
                          <span
                            key={lineId}
                            className="rounded-full bg-base-100 px-3 py-1 text-xs font-semibold ring-1 ring-border-hairline dark:bg-white/10"
                          >
                            {index + 1}. {line?.role}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  {currentStep.lines.map((line) => {
                    const selected = selectedLineIds.includes(line.id);
                    return (
                      <button
                        type="button"
                        key={line.id}
                        disabled={selected}
                        onClick={() => selectDialogueLine(currentStep, line.id)}
                        className="min-h-[56px] rounded-xl border border-border-hairline bg-base-100/70 p-3 text-left transition-all hover:border-primary/30 hover:bg-accent-tint disabled:opacity-45 dark:bg-white/5"
                      >
                        <span className="block text-xs font-semibold text-muted-foreground">
                          {line.role}
                        </span>
                        <span className="mt-1 block text-sm font-semibold">
                          {line.english}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {line.chinese}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {answerState === "wrong" && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm min-h-[40px] gap-2 rounded-[6px]"
                    onClick={resetDialogue}
                  >
                    <RefreshCcw className="size-4" />
                    重新排序
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              className={`text-sm font-medium ${
                answerState === "correct"
                  ? "text-success"
                  : answerState === "wrong"
                    ? "text-error"
                    : "text-muted-foreground"
              }`}
            >
              {answerState === "correct"
                ? "答對了，可以前往下一段。"
                : answerState === "wrong"
                  ? "再試一次，提示就在卡片上的中文說明。"
                  : "選一個答案開始。"}
            </p>
            <button
              type="button"
              className="btn btn-primary min-h-[44px] gap-2 rounded-[6px]"
              disabled={answerState !== "correct"}
              onClick={goNext}
            >
              {currentStepIndex === mission.steps.length - 1 ? "完成蓋章" : "下一段"}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
