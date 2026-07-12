import type {
  ExamScopeId,
  ExamScopeProgress,
  ExamSessionMode,
  ExamSubject,
} from "../../types/exam";

/** 版本化前綴:schema 改變時 bump 版本號,舊 key 直接忽略。 */
export const EXAM_PROGRESS_PREFIX = "ollie-exam-practice-v1";

export function examProgressKey(
  subject: ExamSubject,
  scopeId: ExamScopeId,
): string {
  return `${EXAM_PROGRESS_PREFIX}:${subject}:${scopeId}`;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeProgress(raw: unknown): ExamScopeProgress | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (
    !isNonNegativeNumber(record.bestScore) ||
    !isNonNegativeNumber(record.bestTotal) ||
    !isNonNegativeNumber(record.lastScore) ||
    !isNonNegativeNumber(record.lastTotal) ||
    !isNonNegativeNumber(record.updatedAt) ||
    !Array.isArray(record.lastWrongIds) ||
    !record.lastWrongIds.every((id) => typeof id === "string")
  ) {
    return null;
  }
  return {
    bestScore: record.bestScore,
    bestTotal: record.bestTotal,
    lastScore: record.lastScore,
    lastTotal: record.lastTotal,
    lastWrongIds: record.lastWrongIds as string[],
    updatedAt: record.updatedAt,
  };
}

/** 讀取紀錄;不存在、壞 JSON 或 schema 不符時回傳 null,永不 throw。 */
export function readScopeProgress(
  subject: ExamSubject,
  scopeId: ExamScopeId,
  storage: Storage | null = defaultStorage(),
): ExamScopeProgress | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(examProgressKey(subject, scopeId));
    if (!raw) return null;
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 清除指定科目的所有區段與整卷進度；其他科目及非考卷資料不受影響。 */
export function clearSubjectProgress(
  subject: ExamSubject,
  storage: Storage | null = defaultStorage(),
): number {
  if (!storage) return 0;
  const subjectPrefix = `${EXAM_PROGRESS_PREFIX}:${subject}:`;
  const keys: string[] = [];
  let removed = 0;

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(subjectPrefix)) keys.push(key);
    }
    for (const key of keys) {
      storage.removeItem(key);
      removed += 1;
    }
  } catch {
    // 儲存空間不可用或刪除失敗時不影響頁面操作。
  }

  return removed;
}

export interface ExamSessionResultInput {
  subject: ExamSubject;
  scopeId: ExamScopeId;
  mode: ExamSessionMode;
  score: number;
  total: number;
  wrongIds: string[];
}

export interface ExamSessionResultOutcome {
  progress: ExamScopeProgress;
  isNewBest: boolean;
}

/**
 * 寫入一次練習結果。
 * - bestScore/bestTotal 只在 normal 模式且分數超越舊紀錄時更新
 *   (retry 只練錯題、分母不同,不能污染最佳成績)。
 * - lastScore/lastTotal/lastWrongIds 任何模式都更新(錯題重練後錯題清單會縮小)。
 */
export function recordSessionResult(
  input: ExamSessionResultInput,
  storage: Storage | null = defaultStorage(),
): ExamSessionResultOutcome {
  const previous = readScopeProgress(input.subject, input.scopeId, storage);
  const hasPreviousBest = previous !== null && previous.bestTotal > 0;
  const beatsPrevious =
    input.mode === "normal" &&
    (!hasPreviousBest || input.score > (previous?.bestScore ?? 0));
  const isNewBest = beatsPrevious && input.score > 0;

  const progress: ExamScopeProgress = {
    bestScore: beatsPrevious ? input.score : (previous?.bestScore ?? 0),
    bestTotal: beatsPrevious ? input.total : (previous?.bestTotal ?? 0),
    lastScore: input.score,
    lastTotal: input.total,
    lastWrongIds: [...input.wrongIds],
    updatedAt: Date.now(),
  };

  if (storage) {
    try {
      storage.setItem(
        examProgressKey(input.subject, input.scopeId),
        JSON.stringify(progress),
      );
    } catch {
      // 儲存失敗(隱私模式、容量滿)不影響本次練習流程。
    }
  }

  return { progress, isNewBest };
}
