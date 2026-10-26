import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { Home, RotateCcw, Trophy } from "lucide-react";
import type { ExamPaper, ExamQuizResult, ExamScopeId } from "../../types/exam";
import { isTextQuestion } from "../../types/exam";
import { useLanguage } from "../../hooks/useLanguage";
import { T } from "../common/T";
import { ExamRichText } from "./ExamRichText";
import { ExamQuestionImage } from "./ExamQuestionImage";
import { CIRCLED_NUMBERS, questionLabel, scopeTitle, scopeTitleParam } from "./examUi";

interface ExamResultViewProps {
  paper: ExamPaper;
  result: ExamQuizResult;
  /** 用來在顯示時翻譯範圍名稱;未知 id 顯示 scopeLabel。 */
  scopeId: ExamScopeId;
  scopeLabel: string;
  onRetryWrong: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function ExamResultView({
  paper,
  result,
  scopeId,
  scopeLabel,
  onRetryWrong,
  onRestart,
  onExit,
}: ExamResultViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const percent =
    result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
  const isPerfect = result.score === result.total && result.total > 0;

  // 進成績頁放一次煙火,滿分加大
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (shouldReduceMotion) return;
    confetti({
      particleCount: isPerfect ? 180 : 80,
      spread: isPerfect ? 110 : 70,
      origin: { y: 0.5 },
    });
  }, [isPerfect, shouldReduceMotion]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* 成績卡 */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" }}
        className="rounded-2xl border border-border-hairline bg-card p-6 text-center shadow-elevated"
      >
        <p className="text-sm text-muted-foreground">
          {result.mode === "retry" ? (
            <T
              k="exams.result.scopeRetry"
              params={{ scope: scopeTitleParam(scopeId, scopeLabel) }}
            />
          ) : (
            scopeTitle(scopeId, scopeLabel, t)
          )}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-6xl font-semibold tracking-tight"
        >
          {percent}
          <span className="ml-1 text-2xl text-muted-foreground">%</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <T
            k="exams.result.accuracyLine"
            params={{ score: result.score, total: result.total }}
          />
        </p>
        <div className="mt-3 flex justify-center gap-2">
          {isPerfect && (
            <span className="badge badge-success gap-1">
              🎉 <T k="exams.result.perfect" />
            </span>
          )}
          {result.isNewBest && (
            <span className="badge badge-success gap-1">
              <Trophy size={13} strokeWidth={2} />
              <T k="exams.result.newBest" />
            </span>
          )}
        </div>
      </motion.div>

      {/* 動作列 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {result.wrong.length > 0 && (
          <button
            onClick={onRetryWrong}
            className="btn btn-primary min-h-[48px] flex-1 gap-1.5 rounded-xl"
          >
            <RotateCcw size={18} strokeWidth={2} />
            <T
              k="exams.result.retryWrong"
              params={{ n: result.wrong.length }}
              variant="stacked"
            />
          </button>
        )}
        <button
          onClick={onRestart}
          className="btn btn-outline min-h-[48px] flex-1 rounded-xl"
        >
          <T k="exams.result.restart" variant="stacked" />
        </button>
        <button
          onClick={onExit}
          className="btn btn-ghost min-h-[48px] flex-1 gap-1.5 rounded-xl"
        >
          <Home size={18} strokeWidth={2} />
          <T k="exams.result.backToList" variant="stacked" />
        </button>
      </div>

      {/* 錯題檢討 */}
      {result.wrong.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">
            <T
              k="exams.result.review"
              params={{ n: result.wrong.length }}
              variant="stacked"
            />
          </h3>
          {result.wrong.map((question, index) => {
            const chosen = result.wrongChosen[index];
            return (
              <article
                key={question.id}
                className="flex flex-col gap-2 rounded-xl border border-border-hairline bg-card p-4 shadow-soft"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  <T
                    k="exams.question.original"
                    params={{ label: questionLabel(paper, question, t) }}
                  />
                </p>
                <p className="leading-relaxed">
                  <ExamRichText text={question.text} />
                </p>
                {question.image && (
                  <ExamQuestionImage
                    image={question.image}
                    number={question.number}
                    questionPdf={paper.questionPdf}
                    alt={question.imageAlt}
                  />
                )}
                {isTextQuestion(question) ? (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-error">
                      <T k="exams.answer.yours" />
                      {typeof chosen === "string" ? chosen : ""}
                    </p>
                    <p className="text-success">
                      <T k="exams.answer.correct" />
                      {question.acceptedAnswers[0]}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-error">
                      <T k="exams.answer.yours" />
                      {typeof chosen === "number" ? CIRCLED_NUMBERS[chosen] : ""}
                      {typeof chosen === "number" &&
                        (question.options?.[chosen] ??
                          question.imageOptionLabels?.[chosen]) && (
                          <>
                            {" "}
                            <ExamRichText
                              text={
                                question.options?.[chosen] ??
                                question.imageOptionLabels?.[chosen] ??
                                ""
                              }
                            />
                          </>
                        )}
                    </p>
                    <p className="text-success">
                      <T k="exams.answer.correct" />
                      {CIRCLED_NUMBERS[question.answerIndex]}
                      {(question.options?.[question.answerIndex] ??
                        question.imageOptionLabels?.[question.answerIndex]) && (
                        <>
                          {" "}
                          <ExamRichText
                            text={
                              question.options?.[question.answerIndex] ??
                              question.imageOptionLabels?.[question.answerIndex] ??
                              ""
                            }
                          />
                        </>
                      )}
                    </p>
                  </div>
                )}
                {question.explanation && (
                  <p className="border-t border-border-hairline pt-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold">
                      <T k="exams.answer.explanation" />
                    </span>
                    <ExamRichText text={question.explanation} />
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
