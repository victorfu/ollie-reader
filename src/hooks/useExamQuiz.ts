import { useCallback, useRef, useState } from "react";
import type {
  ExamPaper,
  ExamQuizPhase,
  ExamQuizResult,
  ExamQuizSession,
  ExamScopeId,
  ExamSectionResult,
  ExamSessionMode,
  ExamSubject,
} from "../types/exam";
import { FULL_SCOPE_ID } from "../types/exam";
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
  isEndOfSection,
  createSession,
  sectionStatsAtCurrent,
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
  sectionResult: ExamSectionResult | null;
  startSession: (scopeId: ExamScopeId, mode?: ExamSessionMode) => void;
  /** 選擇題傳選項索引;打字題傳輸入字串。 */
  submitAnswer: (answer: number | string) => void;
  nextQuestion: () => void;
  continueAfterSection: () => void;
  retryWrong: () => void;
  restart: () => void;
  exitToHub: () => void;
}

interface ExamQuizState {
  subject: ExamSubject;
  phase: ExamQuizPhase;
  session: ExamQuizSession | null;
  result: ExamQuizResult | null;
  sectionResult: ExamSectionResult | null;
}

function idleState(subject: ExamSubject): ExamQuizState {
  return {
    subject,
    phase: "idle",
    session: null,
    result: null,
    sectionResult: null,
  };
}

/** 考卷練習狀態機:idle(列表)→ active(作答)→ finished(成績)。 */
export function useExamQuiz(subject: ExamSubject): UseExamQuizReturn {
  const paper = getExamPaper(subject);
  const [state, setState] = useState<ExamQuizState>(() => idleState(subject));
  const finishingRef = useRef<ExamQuizSession | null>(null);

  // query 可能因瀏覽器上一頁而直接換科別。舊科別狀態不與新 paper 混用，
  // 並在下一次開始練習時以新 subject 覆蓋，不需要 effect 同步 state。
  const currentState = state.subject === subject ? state : idleState(subject);
  const { phase, session, result, sectionResult } = currentState;

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
        sectionResult: null,
      });
    },
    [paper, subject],
  );

  const submitAnswer = useCallback(
    (answer: number | string) => {
      setState((previous) => {
        if (
          previous.subject !== subject ||
          previous.phase !== "active" ||
          !previous.session
        ) {
          return previous;
        }
        const nextSession = answerCurrent(previous.session, answer);
        return nextSession === previous.session
          ? previous
          : { ...previous, session: nextSession };
      });
    },
    [subject],
  );

  const finishSession = useCallback(
    (
      completedSession: ExamQuizSession,
      finalSectionResult: ExamSectionResult | null = null,
    ) => {
      if (finishingRef.current === completedSession) return;
      finishingRef.current = completedSession;
      const score = scoreOf(completedSession);
      const wrong = wrongAnswersOf(completedSession);
      const { isNewBest } = recordSessionResult({
        subject,
        scopeId: completedSession.scopeId,
        mode: completedSession.mode,
        score,
        total: completedSession.questions.length,
        wrongIds: wrong.map((item) => item.question.id),
      });
      const nextResult: ExamQuizResult = {
        score,
        total: completedSession.questions.length,
        wrong: wrong.map((item) => item.question),
        wrongChosen: wrong.map((item) => item.chosen),
        mode: completedSession.mode,
        isNewBest,
      };
      setState({
        subject,
        phase: "finished",
        session: completedSession,
        result: nextResult,
        sectionResult: finalSectionResult,
      });
    },
    [subject],
  );

  const nextQuestion = useCallback(() => {
    if (phase !== "active" || !session || !session.isAnswered) return;

    if (session.scopeId === FULL_SCOPE_ID && isEndOfSection(session)) {
      const stats = sectionStatsAtCurrent(session);
      if (!stats) return;
      const nextSectionResult: ExamSectionResult = {
        ...stats,
        sectionLabel: getScopeLabel(paper, stats.sectionId),
        isFinalSection: isLastQuestion(session),
      };
      if (nextSectionResult.isFinalSection) {
        // 全卷已實際作答完畢：先保存整卷，再讓使用者查看最後區段統計。
        finishSession(session, nextSectionResult);
        return;
      }
      setState((previous) =>
        previous.subject === subject && previous.session === session
          ? {
              ...previous,
              sectionResult: nextSectionResult,
            }
          : previous,
      );
      return;
    }

    if (!isLastQuestion(session)) {
      setState((previous) =>
        previous.subject === subject && previous.session === session
          ? { ...previous, session: advance(session) }
          : previous,
      );
      return;
    }

    finishSession(session);
  }, [finishSession, paper, phase, session, subject]);

  const continueAfterSection = useCallback(() => {
    if (!session || !sectionResult) return;
    if (sectionResult.isFinalSection) {
      setState((previous) =>
        previous.subject === subject &&
        previous.phase === "finished" &&
        previous.session === session &&
        previous.sectionResult === sectionResult
          ? { ...previous, sectionResult: null }
          : previous,
      );
      return;
    }
    if (phase !== "active") return;
    setState((previous) =>
      previous.subject === subject &&
      previous.session === session &&
      previous.sectionResult === sectionResult
        ? {
            ...previous,
            session: advance(session),
            sectionResult: null,
          }
        : previous,
    );
  }, [phase, sectionResult, session, subject]);

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
      sectionResult: null,
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
    sectionResult,
    startSession,
    submitAnswer,
    nextQuestion,
    continueAfterSection,
    retryWrong,
    restart,
    exitToHub,
  };
}
