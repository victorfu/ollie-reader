import type {
  ExamQuestion,
  ExamQuizSession,
  ExamScopeId,
  ExamSessionMode,
  ExamTab,
} from "../../types/exam";
import { isTextQuestion } from "../../types/exam";
import { isAcceptedAnswer } from "./examAnswerMatching";

/**
 * 有效選項數:一般題 = options 長度;圖含選項題 = optionCount(預設 4);
 * 打字題 = 0(自然關閉數字快捷鍵與選項索引檢查)。
 */
export function optionCountOf(question: ExamQuestion): number {
  if (isTextQuestion(question)) return 0;
  if (question.imageContainsOptions) return question.optionCount ?? 4;
  return question.options?.length ?? 4;
}

/** 單一正確性來源:選擇題比對索引;打字題走寬鬆批改。 */
export function isCorrectAnswer(
  question: ExamQuestion,
  given: number | string | null,
): boolean {
  if (given === null) return false;
  if (isTextQuestion(question)) {
    return typeof given === "string" && isAcceptedAnswer(question.acceptedAnswers, given);
  }
  return given === question.answerIndex;
}

export function createSession(input: {
  subject: ExamTab;
  scopeId: ExamScopeId;
  scopeLabel: string;
  mode: ExamSessionMode;
  questions: readonly ExamQuestion[];
}): ExamQuizSession {
  return {
    subject: input.subject,
    scopeId: input.scopeId,
    scopeLabel: input.scopeLabel,
    mode: input.mode,
    questions: input.questions,
    currentIndex: 0,
    answers: input.questions.map(() => null),
    isAnswered: false,
    lastAnswerCorrect: null,
  };
}

/**
 * 對目前題目作答(選擇題傳選項索引;打字題傳輸入字串)。
 * 已作答(回饋顯示中)或作答內容無效時原樣返回——
 * 防止連點/鍵盤重複送出的核心防線。
 */
export function answerCurrent(
  session: ExamQuizSession,
  answer: number | string,
): ExamQuizSession {
  if (session.isAnswered) return session;
  const question = session.questions[session.currentIndex];
  if (!question) return session;

  let recorded: number | string;
  if (isTextQuestion(question)) {
    if (typeof answer !== "string") return session;
    const trimmed = answer.trim();
    if (!trimmed) return session;
    recorded = trimmed; // 保留原始輸入(成績頁顯示用),批改時才 normalize
  } else {
    if (typeof answer !== "number" || !Number.isInteger(answer)) return session;
    if (answer < 0 || answer >= optionCountOf(question)) return session;
    recorded = answer;
  }

  const answers = session.answers.slice();
  answers[session.currentIndex] = recorded;
  return {
    ...session,
    answers,
    isAnswered: true,
    lastAnswerCorrect: isCorrectAnswer(question, recorded),
  };
}

export function isLastQuestion(session: ExamQuizSession): boolean {
  return session.currentIndex >= session.questions.length - 1;
}

/** 目前題目是否為所在區段的最後一題。 */
export function isEndOfSection(session: ExamQuizSession): boolean {
  const current = session.questions[session.currentIndex];
  if (!current) return false;
  const next = session.questions[session.currentIndex + 1];
  return !next || next.sectionId !== current.sectionId;
}

export interface ExamSectionStats {
  sectionId: string;
  score: number;
  total: number;
}

/**
 * 統計目前題目所在的連續區段。呼叫端會在區段結尾使用，因此區段內題目
 * 均已作答；以連續範圍計算可避免未來重複 sectionId 時誤納其他題目。
 */
export function sectionStatsAtCurrent(
  session: ExamQuizSession,
): ExamSectionStats | null {
  const current = session.questions[session.currentIndex];
  if (!current) return null;

  let start = session.currentIndex;
  while (
    start > 0 &&
    session.questions[start - 1]?.sectionId === current.sectionId
  ) {
    start -= 1;
  }

  let end = session.currentIndex;
  while (
    end + 1 < session.questions.length &&
    session.questions[end + 1]?.sectionId === current.sectionId
  ) {
    end += 1;
  }

  let score = 0;
  for (let index = start; index <= end; index += 1) {
    const question = session.questions[index];
    if (question && isCorrectAnswer(question, session.answers[index] ?? null)) {
      score += 1;
    }
  }

  return {
    sectionId: current.sectionId,
    score,
    total: end - start + 1,
  };
}

/** 前往下一題;尚未作答或已是最後一題時原樣返回。 */
export function advance(session: ExamQuizSession): ExamQuizSession {
  if (!session.isAnswered || isLastQuestion(session)) return session;
  return {
    ...session,
    currentIndex: session.currentIndex + 1,
    isAnswered: false,
    lastAnswerCorrect: null,
  };
}

export function scoreOf(session: ExamQuizSession): number {
  return session.questions.reduce(
    (total, question, index) =>
      total + (isCorrectAnswer(question, session.answers[index] ?? null) ? 1 : 0),
    0,
  );
}

export interface ExamWrongAnswer {
  question: ExamQuestion;
  /** 當時的作答:選擇題 = 選項索引;打字題 = 輸入字串。 */
  chosen: number | string;
}

/** 答錯的題目(依原卷順序)與當時的作答。 */
export function wrongAnswersOf(session: ExamQuizSession): ExamWrongAnswer[] {
  const wrong: ExamWrongAnswer[] = [];
  session.questions.forEach((question, index) => {
    const chosen = session.answers[index];
    if (chosen !== null && !isCorrectAnswer(question, chosen)) {
      wrong.push({ question, chosen });
    }
  });
  return wrong;
}
