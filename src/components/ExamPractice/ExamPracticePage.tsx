import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type {
  ExamScopeId,
  ExamSessionMode,
  ExamSubject,
} from "../../types/exam";
import { useExamQuiz } from "../../hooks/useExamQuiz";
import { ConfirmModal } from "../common/ConfirmModal";
import { ExamHub } from "./ExamHub";
import { ExamQuizView } from "./ExamQuizView";
import { ExamResultView } from "./ExamResultView";

const pageVariants = {
  enter: { x: 30, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -30, opacity: 0 },
};

const VALID_SUBJECTS: ReadonlySet<string> = new Set(["chinese", "math"]);

function paramsForSubject(subject: ExamSubject): Record<string, string> {
  return subject === "math" ? { subject: "math" } : {};
}

/**
 * 考卷練習頁(/exams):國語、數學同一頁,以 ?subject= 切換科別。
 * 已知限制:作答中經由 sidebar 站內導航離開無法攔截
 * (完整攔截需改用 data router 的 useBlocker,不在此功能範圍);
 * 頁內的離開/切科別路徑都有確認對話框,關閉分頁有 beforeunload 提示。
 */
export default function ExamPracticePage() {
  const shouldReduceMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSubject = searchParams.get("subject");
  const urlSubject: ExamSubject = rawSubject === "math" ? "math" : "chinese";
  const [lockedSubject, setLockedSubject] = useState<ExamSubject | null>(null);
  const subject = lockedSubject ?? urlSubject;
  const quiz = useExamQuiz(subject);
  const {
    exitToHub,
    nextQuestion,
    phase,
    restart,
    retryWrong,
    session,
    startSession: beginSession,
  } = quiz;
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);
  const transition = {
    duration: shouldReduceMotion ? 0 : 0.25,
    ease: "easeOut",
  } as const;

  // 清掉無效的 ?subject= 參數
  useEffect(() => {
    if (rawSubject !== null && !VALID_SUBJECTS.has(rawSubject)) {
      setSearchParams({}, { replace: true });
    }
  }, [rawSubject, setSearchParams]);

  // 作答中任何離開路徑先經過確認
  const requestExit = useCallback(
    (action: () => void) => {
      if (phase === "active") {
        setPendingExit(() => action);
      } else {
        action();
      }
    },
    [phase],
  );

  const handleExitToHub = useCallback(() => {
    setLockedSubject(null);
    exitToHub();
  }, [exitToHub]);

  const handleStartSession = useCallback(
    (scopeId: ExamScopeId, mode?: ExamSessionMode) => {
      setLockedSubject(subject);
      beginSession(scopeId, mode);
    },
    [beginSession, subject],
  );

  const handleNext = useCallback(() => {
    const willFinish =
      phase === "active" &&
      session?.isAnswered === true &&
      session.currentIndex >= session.questions.length - 1;
    nextQuestion();
    if (willFinish) setLockedSubject(null);
  }, [nextQuestion, phase, session]);

  const handleRetryWrong = useCallback(() => {
    setLockedSubject(subject);
    retryWrong();
  }, [retryWrong, subject]);

  const handleRestart = useCallback(() => {
    setLockedSubject(subject);
    restart();
  }, [restart, subject]);

  // BrowserRouter 沒有 useBlocker；鎖住 session 的科別，讓同頁 query 變更後
  // 仍保有 active 狀態，再把 history 還原並詢問是否放棄目前進度。
  useEffect(() => {
    const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
    if (
      phase !== "active" ||
      normalizedPath !== "/exams" ||
      urlSubject === subject
    ) {
      return;
    }

    queueMicrotask(() => {
      // push 回目前科別會保留剛才返回的 entry；取消後再按上一頁仍可重試。
      setSearchParams(paramsForSubject(subject));
      setPendingExit(() => () => {
        handleExitToHub();
        window.history.back();
      });
    });
  }, [handleExitToHub, phase, setSearchParams, subject, urlSubject]);

  // 作答中防止誤關/誤刷新分頁
  useEffect(() => {
    if (phase !== "active") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const selectSubject = useCallback(
    (next: ExamSubject) => {
      if (next === subject) return;
      requestExit(() => {
        handleExitToHub();
        setSearchParams(paramsForSubject(next));
      });
    },
    [handleExitToHub, subject, requestExit, setSearchParams],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
      <AnimatePresence mode="wait">
        {quiz.phase === "idle" && (
          <motion.div
            key={`hub-${subject}`}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
          >
            <ExamHub
              paper={quiz.paper}
              subject={subject}
              onSelectSubject={selectSubject}
              onStart={handleStartSession}
            />
          </motion.div>
        )}

        {quiz.phase === "active" && quiz.session && (
          <motion.div
            key="quiz"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
          >
            <ExamQuizView
              paper={quiz.paper}
              session={quiz.session}
              onSubmitAnswer={quiz.submitAnswer}
              onNext={handleNext}
              onExit={() => requestExit(handleExitToHub)}
            />
          </motion.div>
        )}

        {quiz.phase === "finished" && quiz.result && quiz.session && (
          <motion.div
            key="result"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
          >
            <ExamResultView
              paper={quiz.paper}
              result={quiz.result}
              scopeLabel={quiz.session.scopeLabel}
              onRetryWrong={handleRetryWrong}
              onRestart={handleRestart}
              onExit={handleExitToHub}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={pendingExit !== null}
        title="離開目前的練習？"
        message="這次的作答進度不會保存喔。"
        confirmText="離開"
        cancelText="繼續作答"
        confirmVariant="warning"
        onConfirm={() => {
          pendingExit?.();
          setPendingExit(null);
        }}
        onCancel={() => setPendingExit(null)}
      />
    </div>
  );
}
