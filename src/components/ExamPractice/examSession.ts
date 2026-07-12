import type {
  ExamQuestion,
  ExamQuizSession,
  ExamScopeId,
  ExamSessionMode,
  ExamSubject,
} from "../../types/exam";

/** 有效選項數:一般題 = options 長度;圖含選項題 = optionCount(預設 4)。 */
export function optionCountOf(question: ExamQuestion): number {
  if (question.imageContainsOptions) return question.optionCount ?? 4;
  return question.options?.length ?? 4;
}

export function createSession(input: {
  subject: ExamSubject;
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
 * 對目前題目作答。已作答(回饋顯示中)或選項索引無效時原樣返回——
 * 防止連點/鍵盤重複送出的核心防線。
 */
export function answerCurrent(
  session: ExamQuizSession,
  optionIndex: number,
): ExamQuizSession {
  if (session.isAnswered) return session;
  const question = session.questions[session.currentIndex];
  if (!question) return session;
  if (!Number.isInteger(optionIndex)) return session;
  if (optionIndex < 0 || optionIndex >= optionCountOf(question)) return session;

  const answers = session.answers.slice();
  answers[session.currentIndex] = optionIndex;
  return {
    ...session,
    answers,
    isAnswered: true,
    lastAnswerCorrect: optionIndex === question.answerIndex,
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
    if (session.answers[index] === session.questions[index]?.answerIndex) {
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
      total + (session.answers[index] === question.answerIndex ? 1 : 0),
    0,
  );
}

export interface ExamWrongAnswer {
  question: ExamQuestion;
  chosen: number;
}

/** 答錯的題目(依原卷順序)與當時所選選項。 */
export function wrongAnswersOf(session: ExamQuizSession): ExamWrongAnswer[] {
  const wrong: ExamWrongAnswer[] = [];
  session.questions.forEach((question, index) => {
    const chosen = session.answers[index];
    if (chosen !== null && chosen !== question.answerIndex) {
      wrong.push({ question, chosen });
    }
  });
  return wrong;
}
