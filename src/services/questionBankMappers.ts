import { Timestamp, type DocumentData } from "firebase/firestore";
import {
  isAnswerSpace,
  isBankSubject,
  type BankQuestion,
  type Box,
  type QuestionRegion,
  type QuestionSource,
  type SourcePage,
} from "../types/questionBank";
import { logger } from "../utils/logger";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonNull<T>(value: T | null): value is T {
  return value !== null;
}

function toDate(value: unknown): Date {
  if (isRecord(value) && typeof value.toDate === "function") {
    return (value.toDate as () => Date)();
  }
  return new Date();
}

export function toBox(value: unknown): Box | null {
  if (!isRecord(value)) return null;
  const { x, y, w, h } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) {
    return null;
  }
  return { x, y, w, h };
}

function toSourcePage(value: unknown): SourcePage | null {
  if (!isRecord(value)) return null;
  const { storagePath, width, height, masks } = value;
  if (typeof storagePath !== "string" || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    return null;
  }
  return {
    storagePath,
    width,
    height,
    masks: Array.isArray(masks) ? masks.map(toBox).filter(nonNull) : [],
  };
}

function toQuestionRegion(value: unknown): QuestionRegion | null {
  if (!isRecord(value) || !isFiniteNumber(value.pageIndex)) return null;
  const box = toBox(value.box);
  return box ? { pageIndex: value.pageIndex, box } : null;
}

export function toQuestionSource(id: string, data: DocumentData): QuestionSource | null {
  const rawPages: unknown[] = Array.isArray(data.pages) ? data.pages : [];
  const pages = rawPages.map(toSourcePage);
  const validPages = pages.filter(nonNull);
  if (
    typeof data.userId !== "string" ||
    !isBankSubject(data.subject) ||
    validPages.length !== pages.length
  ) {
    // 壞掉的頁會讓後面的 pageIndex 全部錯位，整份來源視為壞資料。
    logger.warn("[questionBank] skip invalid source", id);
    return null;
  }
  return {
    id,
    userId: data.userId,
    title: typeof data.title === "string" ? data.title : "",
    subject: data.subject,
    pages: validPages,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toBankQuestion(id: string, data: DocumentData): BankQuestion | null {
  const rawRegions: unknown[] = Array.isArray(data.regions) ? data.regions : [];
  const [first, ...rest] = rawRegions.map(toQuestionRegion).filter(nonNull);
  if (
    !first ||
    typeof data.userId !== "string" ||
    typeof data.sourceId !== "string" ||
    !isBankSubject(data.subject)
  ) {
    logger.warn("[questionBank] skip invalid question", id);
    return null;
  }
  const answer = typeof data.answer === "string" && data.answer.trim() ? data.answer : null;
  return {
    id,
    userId: data.userId,
    sourceId: data.sourceId,
    subject: data.subject,
    regions: [first, ...rest],
    ...(answer ? { answer } : {}),
    answerSpace: isAnswerSpace(data.answerSpace) ? data.answerSpace : "none",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function plainBox(box: Box): Box {
  return { x: box.x, y: box.y, w: box.w, h: box.h };
}

/** 寫入用：不含 id、沒有值為 undefined 的欄位（spec §6）。 */
export function toFirestoreQuestion(question: BankQuestion): DocumentData {
  const answer = question.answer?.trim();
  return {
    userId: question.userId,
    sourceId: question.sourceId,
    subject: question.subject,
    regions: question.regions.map((region) => ({
      pageIndex: region.pageIndex,
      box: plainBox(region.box),
    })),
    answerSpace: question.answerSpace,
    ...(answer ? { answer } : {}),
    createdAt: Timestamp.fromDate(question.createdAt),
    updatedAt: Timestamp.now(),
  };
}

export function toFirestorePages(pages: readonly SourcePage[]): DocumentData[] {
  return pages.map((page) => ({
    storagePath: page.storagePath,
    width: page.width,
    height: page.height,
    masks: page.masks.map(plainBox),
  }));
}
