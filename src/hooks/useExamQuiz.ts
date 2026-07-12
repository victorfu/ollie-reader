import { useCallback, useRef, useState } from "react";
import type {
  ExamPaper,
  ExamQuizPhase,
  ExamQuizResult,
  ExamQuizSession,
  ExamScopeId,
  ExamSessionMode,
  ExamSubject,
} from "../types/exam";
import {
  findQuestionsByIds,
  getExamPaper,
  getScopeLabel,
  getScopeQuestions,
} from "../data/exams";
import {
  advance,
  answerCurrent,
  isLastQuestion,
  createSession,
  scoreOf,
  wrongAnswersOf,
} from "../components/ExamPractice/examSession";
import {
  readScopeProgress,
  recordSessionResult,
} from "../components/ExamPractice/examProgressStorage";

export interface UseExamQuizReturn {
  paper: ExamPaper;
  phase: ExamQuizPhase;
  session: ExamQuizSession | null;
  result: ExamQuizResult | null;
  startSession: (scopeId: ExamScopeId, mode?: ExamSessionMode) => void;
  submitAnswer: (optionIndex: number) => void;
  nextQuestion: () => void;
  retryWrong: () => void;
  restart: () => void;
  exitToHub: () => void;
}

interface ExamQuizState {
  subject: ExamSubject;
  phase: ExamQuizPhase;
  session: ExamQuizSession | null;
  result: ExamQuizResult | null;
}

function idleState(subject: ExamSubject): ExamQuizState {
  return { subject, phase: "idle", session: null, result: null };
}

/** 考卷練習狀態機:idle(列表)→ active(作答)→ finished(成績)。 */
export function useExamQuiz(subject: ExamSubject): UseExamQuizReturn {
  const paper = getExamPaper(subject);
  const [state, setState] = useState<ExamQuizState>(() => idleState(subject));
  const finishingRef = useRef<ExamQuizSession | null>(null);

  // query 可能因瀏覽器上一頁而直接換科別。舊科別狀態不與新 paper 混用，
  // 並在下一次開始練習時以新 subject 覆蓋，不需要 effect 同步 state。
  const currentState = state.subject === subject ? state : idleState(subject);
  const { phase, session, result } = currentState;

  const startSession = useCallback(
    (scopeId: ExamScopeId, mode: ExamSessionMode = "normal") => {
      const questions =
        mode === "retry"
          ? findQuestionsByIds(
              paper,
              readScopeProgress(subject, scopeId)?.lastWrongIds ?? [],
            )
          : getScopeQuestions(paper, scopeId);
      if (!questions || questions.length === 0) return;
      finishingRef.current = null;
      setState({
        subject,
        phase: "active",
        session: createSession({
          subject,
          scopeId,
          scopeLabel: getScopeLabel(paper, scopeId),
          mode,
          questions,
        }),
        result: null,
      });
    },
    [paper, subject],
  );

  const submitAnswer = useCallback(
    (optionIndex: number) => {
      setState((previous) => {
        if (
          previous.subject !== subject ||
          previous.phase !== "active" ||
          !previous.session
        ) {
          return previous;
        }
        const nextSession = answerCurrent(previous.session, optionIndex);
        return nextSession === previous.session
          ? previous
          : { ...previous, session: nextSession };
      });
    },
    [subject],
  );

  const nextQuestion = useCallback(() => {
    if (phase !== "active" || !session || !session.isAnswered) return;
    if (!isLastQuestion(session)) {
      setState((previous) =>
        previous.subject === subject && previous.session === session
          ? { ...previous, session: advance(session) }
          : previous,
      );
      return;
    }
    if (finishingRef.current === session) return;
    finishingRef.current = session;
    // 最後一題:結算、寫入紀錄、進入成績頁。
    const score = scoreOf(session);
    const wrong = wrongAnswersOf(session);
    const { isNewBest } = recordSessionResult({
      subject,
      scopeId: session.scopeId,
      mode: session.mode,
      score,
      total: session.questions.length,
      wrongIds: wrong.map((item) => item.question.id),
    });
    const nextResult: ExamQuizResult = {
      score,
      total: session.questions.length,
      wrong: wrong.map((item) => item.question),
      wrongChosen: wrong.map((item) => item.chosen),
      mode: session.mode,
      isNewBest,
    };
    setState({
      subject,
      phase: "finished",
      session,
      result: nextResult,
    });
  }, [phase, session, subject]);

  const retryWrong = useCallback(() => {
    if (phase !== "finished" || !session || !result || result.wrong.length === 0) {
      return;
    }
    // 直接沿用畫面上的錯題，localStorage 被封鎖或寫入失敗時仍可重練。
    finishingRef.current = null;
    setState({
      subject,
      phase: "active",
      session: createSession({
        subject,
        scopeId: session.scopeId,
        scopeLabel: session.scopeLabel,
        mode: "retry",
        questions: result.wrong,
      }),
      result: null,
    });
  }, [phase, result, session, subject]);

  const restart = useCallback(() => {
    if (!session) return;
    startSession(session.scopeId, "normal");
  }, [session, startSession]);

  const exitToHub = useCallback(() => {
    finishingRef.current = null;
    setState(idleState(subject));
  }, [subject]);

  return {
    paper,
    phase,
    session,
    result,
    startSession,
    submitAnswer,
    nextQuestion,
    retryWrong,
    restart,
    exitToHub,
  };
}
